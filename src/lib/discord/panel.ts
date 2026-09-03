import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type MessageActionRowComponentBuilder,
  type TextChannel,
} from 'discord.js'
import { prisma } from '@/lib/prisma'
import { MessagePayloadSchema, emptyPayload } from '@/lib/schema/message'
import { readJson } from '@/lib/json-column'
import { getGuild } from './bot'
import { CUSTOM_ID } from './custom-id'
import { buildMessage } from './message'


const BUTTON_STYLE: Record<string, ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
}

type PanelWithItems = NonNullable<Awaited<ReturnType<typeof loadPanel>>>

function loadPanel(panelId: string) {
  return prisma.panel.findUnique({
    where: { id: panelId },
    include: {
      items: {
        orderBy: [{ row: 'asc' }, { sortOrder: 'asc' }],
        include: { ticketType: { select: { id: true, name: true, enabled: true } } },
      },
    },
  })
}

/** emoji ที่ผู้ใช้พิมพ์ผิดรูปทำให้ทั้งข้อความส่งไม่ออก — ใส่แบบกันพลาด */
function applyEmoji<T extends { setEmoji: (e: string) => T }>(builder: T, emoji: string | null): T {
  const value = emoji?.trim()
  if (!value) return builder
  try {
    return builder.setEmoji(value)
  } catch {
    return builder
  }
}

export function buildPanelComponents(
  panel: PanelWithItems,
): ActionRowBuilder<MessageActionRowComponentBuilder>[] {
  const items = panel.items
  if (items.length === 0) return []

  if (panel.layout === 'select') {
    const menu = new StringSelectMenuBuilder()
      .setCustomId(CUSTOM_ID.pick(panel.id))
      .setPlaceholder(panel.selectPlaceholder?.trim() || 'เลือกเรื่องที่ต้องการติดต่อ')
      .addOptions(
        items.slice(0, 25).map((item) => {
          const option = new StringSelectMenuOptionBuilder()
            .setLabel(item.label.slice(0, 100))
            .setValue(item.ticketTypeId)
          const description = item.description?.trim()
          if (description) option.setDescription(description.slice(0, 100))
          return applyEmoji(option, item.emoji)
        }),
      )

    return [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(menu)]
  }

  // ปุ่ม: Discord ให้ 5 แถว แถวละ 5 ปุ่ม — แถวที่ผู้ใช้ตั้งไว้เกินโควตาจะไหลลงแถวถัดไป
  const rows: ActionRowBuilder<MessageActionRowComponentBuilder>[] = []
  const byRow = new Map<number, typeof items>()

  for (const item of items) {
    const list = byRow.get(item.row) ?? []
    list.push(item)
    byRow.set(item.row, list)
  }

  for (const rowIndex of [...byRow.keys()].sort((a, b) => a - b)) {
    const group = byRow.get(rowIndex) ?? []
    for (let i = 0; i < group.length; i += 5) {
      if (rows.length >= 5) break
      const chunk = group.slice(i, i + 5)
      const row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
      for (const item of chunk) {
        const button = new ButtonBuilder()
          .setCustomId(CUSTOM_ID.open(item.ticketTypeId))
          .setLabel(item.label.slice(0, 80))
          .setStyle(BUTTON_STYLE[item.style] ?? ButtonStyle.Secondary)
        row.addComponents(applyEmoji(button, item.emoji))
      }
      rows.push(row)
    }
  }

  return rows
}

export type PublishResult =
  | { ok: true; messageId: string; created: boolean }
  | { ok: false; error: string }

/**
 * ส่ง panel ขึ้นห้อง หรือแก้ข้อความเดิมถ้าเคยส่งไปแล้ว
 * @param forceNew ส่งข้อความใหม่แม้จะมีข้อความเดิมอยู่ (ปุ่ม "ส่งใหม่")
 */
export async function publishPanel(panelId: string, forceNew = false): Promise<PublishResult> {
  const panel = await loadPanel(panelId)
  if (!panel) return { ok: false, error: 'ไม่พบ panel นี้' }
  if (!panel.channelId) return { ok: false, error: 'ยังไม่ได้เลือกห้องที่จะส่ง' }
  if (panel.items.length === 0) return { ok: false, error: 'ยังไม่ได้เพิ่มปุ่มหรือตัวเลือกใน panel' }

  const guild = await getGuild()
  const channel = await guild.channels.fetch(panel.channelId).catch(() => null)

  if (!channel || !channel.isTextBased() || channel.isThread()) {
    return { ok: false, error: 'ห้องที่เลือกไม่มีอยู่แล้ว หรือบอทส่งข้อความในห้องนั้นไม่ได้' }
  }

  const payload = readJson(panel.payload, MessagePayloadSchema, emptyPayload())
  const built = await buildMessage(payload, { server: guild.name })

  if (!built.content && built.embeds.length === 0) {
    return { ok: false, error: 'ยังไม่ได้ใส่ข้อความหรือ embed ให้ panel' }
  }

  const body = {
    content: built.content ?? '',
    embeds: built.embeds,
    files: built.files,
    components: buildPanelComponents(panel),
  }

  try {
    const target = channel as TextChannel

    if (panel.messageId && !forceNew) {
      const existing = await target.messages.fetch(panel.messageId).catch(() => null)
      if (existing) {
        await existing.edit(body)
        await prisma.panel.update({
          where: { id: panelId },
          data: { lastPublishedAt: new Date() },
        })
        return { ok: true, messageId: existing.id, created: false }
      }
      // ข้อความเดิมโดนลบไปแล้ว — ส่งใหม่แทนที่จะ error
    }

    const sent = await target.send(body)
    await prisma.panel.update({
      where: { id: panelId },
      data: { messageId: sent.id, channelId: target.id, lastPublishedAt: new Date() },
    })
    return { ok: true, messageId: sent.id, created: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: `ส่งขึ้น Discord ไม่สำเร็จ: ${message}` }
  }
}

/** เรียกหลังบันทึก config — เงียบถ้ายังไม่เคยส่ง panel ขึ้นห้อง */
export async function syncPanelIfPublished(panelId: string): Promise<PublishResult | null> {
  const panel = await prisma.panel.findUnique({
    where: { id: panelId },
    select: { channelId: true, messageId: true },
  })
  if (!panel?.channelId || !panel.messageId) return null
  return publishPanel(panelId)
}
