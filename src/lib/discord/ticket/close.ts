import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type Guild,
  type TextChannel,
} from 'discord.js'
import { prisma } from '@/lib/prisma'
import { readIdList } from '@/lib/json-column'
import { getSettings } from '@/lib/settings'
import { CUSTOM_ID } from '../custom-id'
import {
  collectMessages,
  renderTranscriptHtml,
  saveTranscript,
  transcriptAttachment,
} from './transcript'

export type CloseResult = { ok: true } | { ok: false; message: string }

function archivedButtons(ticketId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.reopen(ticketId))
      .setLabel('เปิดใหม่')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.del(ticketId))
      .setLabel('ลบห้องถาวร')
      .setStyle(ButtonStyle.Danger),
  )
}

/**
 * จังหวะแรกของการปิด: เก็บ transcript แล้วย้ายห้องเข้า archive
 * ห้องยังอยู่ให้ทีมงานย้อนดูได้ จนกว่าจะกดลบ
 */
export async function archiveTicket(params: {
  guild: Guild
  ticketId: string
  closedById: string
  closedByTag: string
  reason?: string
}): Promise<CloseResult> {
  const { guild, ticketId, closedById, closedByTag, reason } = params

  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { ticketType: true },
  })
  if (!ticket) return { ok: false, message: 'ไม่พบข้อมูล ticket นี้' }
  if (ticket.status !== 'open') return { ok: false, message: 'ticket นี้ปิดไปแล้ว' }

  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null)
  if (!channel || channel.type !== ChannelType.GuildText) {
    // ห้องถูกลบมือไปแล้ว — ปิดในฐานข้อมูลให้ตรงกับความจริง
    await prisma.ticket.update({
      where: { id: ticketId },
      data: { status: 'deleted', closedAt: new Date(), closedById, closedByTag, closeReason: reason },
    })
    return { ok: false, message: 'ห้องนี้ถูกลบไปแล้ว — อัปเดตสถานะให้เรียบร้อยแล้ว' }
  }

  const closedAt = new Date()

  // เก็บ transcript ก่อนแตะสิทธิ์ เผื่อขั้นตอนหลังพลาด
  const messages = await collectMessages(channel).catch(() => [])
  await saveTranscript(ticketId, messages)

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: 'archived', closedAt, closedById, closedByTag, closeReason: reason ?? null },
  })

  // ตัดสิทธิ์คนเปิดและคนที่ถูกเพิ่มเข้ามา ทีมงานยังเห็นอยู่
  const revoke = [ticket.openerId, ...readIdList(ticket.addedUserIds)]
  for (const userId of revoke) {
    await channel.permissionOverwrites
      .edit(userId, { ViewChannel: false, SendMessages: false })
      .catch(() => {})
  }

  if (ticket.ticketType.archiveCategoryId) {
    const target = await guild.channels.fetch(ticket.ticketType.archiveCategoryId).catch(() => null)
    if (target?.type === ChannelType.GuildCategory) {
      await channel.setParent(target.id, { lockPermissions: false }).catch(() => {})
    }
  }

  const html = renderTranscriptHtml({
    number: ticket.number,
    typeName: ticket.ticketType.name,
    openerTag: ticket.openerTag,
    openedAt: ticket.openedAt,
    closedAt,
    closedByTag,
    messages,
  })

  const summary = new EmbedBuilder()
    .setTitle(`ปิด Ticket #${String(ticket.number).padStart(4, '0')}`)
    .setColor('#d65a44')
    .addFields(
      { name: 'ประเภท', value: ticket.ticketType.name, inline: true },
      { name: 'เปิดโดย', value: `<@${ticket.openerId}>`, inline: true },
      { name: 'ปิดโดย', value: `<@${closedById}>`, inline: true },
      { name: 'จำนวนข้อความ', value: String(messages.length), inline: true },
      {
        name: 'เปิดอยู่นาน',
        value: `<t:${Math.floor(ticket.openedAt.getTime() / 1000)}:R>`,
        inline: true,
      },
      ...(reason ? [{ name: 'เหตุผล', value: reason.slice(0, 1024), inline: false }] : []),
    )
    .setTimestamp(closedAt)

  await channel
    .send({ embeds: [summary], components: [archivedButtons(ticketId)] })
    .catch(() => {})

  // ส่งเข้าห้อง log พร้อมไฟล์ transcript
  const settings = await getSettings()
  if (settings.ticketLogChannelId) {
    const log = await guild.channels.fetch(settings.ticketLogChannelId).catch(() => null)
    if (log?.isTextBased() && !log.isThread()) {
      await (log as TextChannel)
        .send({ embeds: [summary], files: [transcriptAttachment(html, ticket.number)] })
        .catch(() => {})
    }
  }

  return { ok: true }
}

/** จังหวะที่สอง: ลบห้องจริง */
export async function deleteTicketChannel(params: {
  guild: Guild
  ticketId: string
  actorTag: string
}): Promise<CloseResult> {
  const ticket = await prisma.ticket.findUnique({ where: { id: params.ticketId } })
  if (!ticket) return { ok: false, message: 'ไม่พบข้อมูล ticket นี้' }

  await prisma.ticket.update({
    where: { id: params.ticketId },
    data: { status: 'deleted' },
  })

  const channel = await params.guild.channels.fetch(ticket.channelId).catch(() => null)
  if (channel) {
    await channel.delete(`ลบโดย ${params.actorTag}`).catch(() => {})
  }
  return { ok: true }
}

export async function reopenTicket(params: {
  guild: Guild
  ticketId: string
  actorTag: string
}): Promise<CloseResult> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: params.ticketId },
    include: { ticketType: true },
  })
  if (!ticket) return { ok: false, message: 'ไม่พบข้อมูล ticket นี้' }
  if (ticket.status === 'deleted') return { ok: false, message: 'ห้องนี้ถูกลบไปแล้ว เปิดใหม่ไม่ได้' }

  const channel = await params.guild.channels.fetch(ticket.channelId).catch(() => null)
  if (!channel || channel.type !== ChannelType.GuildText) {
    return { ok: false, message: 'ไม่พบห้องของ ticket นี้แล้ว' }
  }

  const restore = [ticket.openerId, ...readIdList(ticket.addedUserIds)]
  for (const userId of restore) {
    await channel.permissionOverwrites
      .edit(userId, {
        ViewChannel: true,
        SendMessages: true,
        ReadMessageHistory: true,
        AttachFiles: true,
        EmbedLinks: true,
      })
      .catch(() => {})
  }

  // ย้ายกลับ category เดิมถ้ายังมีที่ว่าง
  const categoryIds = readIdList(ticket.ticketType.categoryIds)
  const first = categoryIds[0]
  if (first) {
    const target = await params.guild.channels.fetch(first).catch(() => null)
    if (target?.type === ChannelType.GuildCategory) {
      await channel.setParent(target.id, { lockPermissions: false }).catch(() => {})
    }
  }

  await prisma.ticket.update({
    where: { id: params.ticketId },
    data: { status: 'open', closedAt: null, closedById: null, closedByTag: null, closeReason: null },
  })

  await channel.send(`เปิด ticket นี้ใหม่โดย ${params.actorTag}`).catch(() => {})
  return { ok: true }
}

/** ทีมงานคือคนที่มี role ทีมงานของ ticket ประเภทนั้น หรือมีสิทธิ์ Manage Channels */
export function isStaff(memberRoleIds: string[], staffRoleIds: string[], hasManageChannels: boolean) {
  return hasManageChannels || staffRoleIds.some((id) => memberRoleIds.includes(id))
}

export const MANAGE_CHANNELS = PermissionFlagsBits.ManageChannels
