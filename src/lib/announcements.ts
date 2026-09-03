import type { Guild, TextChannel } from 'discord.js'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { readIdList, readJson } from '@/lib/json-column'
import { emptyPayload, MessagePayloadSchema, type MessagePayload } from '@/lib/schema/message'
import { buildMessage } from '@/lib/discord/message'
import { getGuild } from '@/lib/discord/bot'

const snowflake = z.string().regex(/^\d{17,20}$/)

export const MENTION_MODES = ['none', 'everyone', 'here', 'roles'] as const
export type MentionMode = (typeof MENTION_MODES)[number]

export const AnnouncementInputSchema = z.object({
  name: z.string().max(80).default(''),
  /** ส่งประกาศเดียวไปหลายห้องพร้อมกันได้ */
  channelIds: z.array(snowflake).max(25).default([]),
  payload: MessagePayloadSchema,
  mentionMode: z.enum(MENTION_MODES).default('none'),
  mentionRoleIds: z.array(snowflake).max(20).default([]),
  /** ISO string จากฝั่งเบราว์เซอร์ — null คือส่งทันที/เก็บเป็นร่าง */
  scheduledAt: z.string().datetime().nullable().default(null),
})

export type AnnouncementInput = z.infer<typeof AnnouncementInputSchema>

export const STATUS_LABEL: Record<string, string> = {
  draft: 'ร่าง',
  scheduled: 'ตั้งเวลาไว้',
  sent: 'ส่งแล้ว',
  partial: 'ส่งได้บางห้อง',
  failed: 'ส่งไม่สำเร็จ',
}

/** ข้อความแท็กที่จะเติมไว้บนสุด และรายการที่อนุญาตให้ Discord แท็กจริง */
function mentionParts(mode: MentionMode, roleIds: string[]) {
  switch (mode) {
    case 'everyone':
      return { prefix: '@everyone', allowed: { parse: ['everyone' as const] } }
    case 'here':
      return { prefix: '@here', allowed: { parse: ['everyone' as const] } }
    case 'roles':
      return {
        prefix: roleIds.map((id) => `<@&${id}>`).join(' '),
        allowed: { roles: roleIds },
      }
    default:
      // ไม่แท็กใครเลย — กันข้อความที่พิมพ์ @everyone ไว้เองแล้วยิงโดนไม่ตั้งใจ
      return { prefix: '', allowed: { parse: [] as const } }
  }
}

export type DeliveryOutcome = {
  channelId: string
  channelName: string
  ok: boolean
  edited: boolean
  error?: string
}

/**
 * ok = ลงมือส่งแล้ว (อาจมีบางห้องพัง ดูที่ outcomes)
 * ok:false = ล้มตั้งแต่ยังไม่ได้ส่งห้องไหนเลย เช่นบอทไม่พร้อมหรือยังไม่ได้เลือกห้อง
 */
export type SendResult =
  | { ok: true; outcomes: DeliveryOutcome[]; sent: number; edited: number; failed: number }
  | { ok: false; error: string }

async function resolveChannel(guild: Guild, channelId: string) {
  const channel = await guild.channels.fetch(channelId).catch(() => null)
  if (!channel?.isTextBased() || channel.isThread()) return null
  return channel as TextChannel
}

/**
 * ส่งประกาศไปทุกห้องที่เลือกไว้ ห้องไหนเคยส่งแล้วจะเป็นการแก้ข้อความเดิม
 *
 * ห้องหนึ่งพังไม่ทำให้ห้องอื่นล้มตาม — เก็บผลแยกรายห้องแล้วรายงานกลับทั้งหมด
 * Discord ไม่ให้แก้ allowed_mentions ย้อนหลัง การแท็กจึงมีผลเฉพาะตอนส่งครั้งแรกของแต่ละห้อง
 */
export async function deliverAnnouncement(id: string): Promise<SendResult> {
  const row = await prisma.announcement.findUnique({
    where: { id },
    include: { deliveries: true },
  })
  if (!row) return { ok: false, error: 'ไม่พบประกาศนี้' }
  if (row.deliveries.length === 0) return { ok: false, error: 'ยังไม่ได้เลือกห้องที่จะส่ง' }

  let guild: Guild
  try {
    guild = await getGuild()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'บอทยังไม่พร้อม' }
  }

  const payload = readJson(row.payload, MessagePayloadSchema, emptyPayload())
  const built = await buildMessage(payload, {
    server: guild.name,
    'server.membercount': String(guild.memberCount),
    'server.icon': guild.iconURL({ size: 256 }) ?? '',
    date: new Date().toLocaleDateString('th-TH'),
    time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
  })

  if (!built.content && built.embeds.length === 0) {
    return { ok: false, error: 'ยังไม่ได้ใส่ข้อความหรือ embed' }
  }

  const { prefix, allowed } = mentionParts(
    row.mentionMode as MentionMode,
    readIdList(row.mentionRoleIds),
  )
  const content = [prefix, built.content].filter(Boolean).join('\n') || undefined

  const outcomes: DeliveryOutcome[] = []

  for (const delivery of row.deliveries) {
    const channel = await resolveChannel(guild, delivery.channelId)

    if (!channel) {
      const error = 'ห้องไม่มีอยู่แล้ว หรือบอทส่งข้อความในห้องนี้ไม่ได้'
      await prisma.announcementDelivery.update({
        where: { id: delivery.id },
        data: { status: 'failed', error },
      })
      outcomes.push({ channelId: delivery.channelId, channelName: delivery.channelId, ok: false, edited: false, error })
      continue
    }

    try {
      // เคยส่งไปแล้วในห้องนี้ → แก้ข้อความเดิม
      if (delivery.messageId) {
        const existing = await channel.messages.fetch(delivery.messageId).catch(() => null)
        if (existing) {
          await existing.edit({ content: content ?? '', embeds: built.embeds, files: built.files })
          await prisma.announcementDelivery.update({
            where: { id: delivery.id },
            data: { status: 'sent', error: null },
          })
          outcomes.push({ channelId: channel.id, channelName: channel.name, ok: true, edited: true })
          continue
        }
        // ข้อความถูกลบไปแล้ว — ส่งใหม่แทนที่จะ error
      }

      const sent = await channel.send({
        content,
        embeds: built.embeds,
        files: built.files,
        allowedMentions: allowed,
      })

      await prisma.announcementDelivery.update({
        where: { id: delivery.id },
        data: { messageId: sent.id, status: 'sent', sentAt: new Date(), error: null },
      })
      outcomes.push({ channelId: channel.id, channelName: channel.name, ok: true, edited: false })
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      await prisma.announcementDelivery.update({
        where: { id: delivery.id },
        data: { status: 'failed', error },
      })
      outcomes.push({ channelId: channel.id, channelName: channel.name, ok: false, edited: false, error })
    }
  }

  const failed = outcomes.filter((o) => !o.ok).length
  const edited = outcomes.filter((o) => o.ok && o.edited).length
  const sent = outcomes.filter((o) => o.ok && !o.edited).length

  await prisma.announcement.update({
    where: { id },
    data: {
      status: failed === 0 ? 'sent' : failed === outcomes.length ? 'failed' : 'partial',
      sentAt: row.sentAt ?? (sent > 0 ? new Date() : null),
    },
  })

  return { ok: true, outcomes, sent, edited, failed }
}

// ── ดึงข้อความเก่าของบอทมาแก้ ──────────────────────────────────────────

const MESSAGE_LINK = /channels\/(\d{17,20})\/(\d{17,20})\/(\d{17,20})/

export type ImportResult =
  | { ok: true; channelId: string; messageId: string; payload: MessagePayload; content: string }
  | { ok: false; error: string }

/** รับลิงก์ข้อความของ Discord แล้วดึงเนื้อหามาใส่ตัวแก้ไข */
export async function importMessageByLink(link: string): Promise<ImportResult> {
  const match = MESSAGE_LINK.exec(link.trim())
  if (!match) {
    return {
      ok: false,
      error: 'ลิงก์ไม่ถูกต้อง — คลิกขวาที่ข้อความใน Discord แล้วเลือก Copy Message Link',
    }
  }

  const [, linkGuildId, channelId, messageId] = match as unknown as [string, string, string, string]

  let guild: Guild
  try {
    guild = await getGuild()
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'บอทยังไม่พร้อม' }
  }

  if (linkGuildId !== guild.id) {
    return { ok: false, error: 'ลิงก์นี้มาจากเซิร์ฟเวอร์อื่น' }
  }

  const channel = await resolveChannel(guild, channelId)
  if (!channel) return { ok: false, error: 'บอทเข้าถึงห้องของข้อความนี้ไม่ได้' }

  const message = await channel.messages.fetch(messageId).catch(() => null)
  if (!message) return { ok: false, error: 'ไม่พบข้อความนี้ — อาจถูกลบไปแล้ว' }

  if (message.author.id !== guild.client.user?.id) {
    return { ok: false, error: 'แก้ได้เฉพาะข้อความที่บอทตัวนี้เป็นคนส่งเท่านั้น' }
  }

  const base = emptyPayload()
  const embed = message.embeds[0]

  const payload: MessagePayload = {
    content: message.content,
    useEmbed: Boolean(embed),
    embed: embed
      ? {
          ...base.embed,
          title: embed.title ?? '',
          description: embed.description ?? '',
          url: embed.url ?? '',
          color: embed.hexColor ?? base.embed.color,
          authorName: embed.author?.name ?? '',
          authorIconUrl: embed.author?.iconURL ?? '',
          thumbnailUrl: embed.thumbnail?.url ?? '',
          imageUrl: embed.image?.url ?? '',
          footerText: embed.footer?.text ?? '',
          footerIconUrl: embed.footer?.iconURL ?? '',
          showTimestamp: Boolean(embed.timestamp),
          fields: embed.fields.map((f) => ({
            name: f.name,
            value: f.value,
            inline: f.inline ?? false,
          })),
        }
      : base.embed,
  }

  return { ok: true, channelId, messageId, payload, content: message.content }
}
