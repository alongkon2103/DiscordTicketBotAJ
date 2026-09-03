import {
  ActionRowBuilder,
  ChannelType,
  PermissionFlagsBits,
  UserSelectMenuBuilder,
  type Guild,
} from 'discord.js'
import { prisma } from '@/lib/prisma'
import { readIdList } from '@/lib/json-column'
import { CUSTOM_ID } from '../custom-id'

const MEMBER_PERMS = {
  ViewChannel: true,
  SendMessages: true,
  ReadMessageHistory: true,
  AttachFiles: true,
  EmbedLinks: true,
} as const

export function memberPickerRows(ticketId: string) {
  return [
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(CUSTOM_ID.memberAdd(ticketId))
        .setPlaceholder('เลือกคนที่จะเพิ่มเข้าห้อง')
        .setMinValues(1)
        .setMaxValues(10),
    ),
    new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(
      new UserSelectMenuBuilder()
        .setCustomId(CUSTOM_ID.memberRemove(ticketId))
        .setPlaceholder('เลือกคนที่จะนำออกจากห้อง')
        .setMinValues(1)
        .setMaxValues(10),
    ),
  ]
}

export type MemberChangeResult = { ok: true; message: string } | { ok: false; message: string }

export async function changeTicketMembers(params: {
  guild: Guild
  ticketId: string
  userIds: string[]
  action: 'add' | 'remove'
}): Promise<MemberChangeResult> {
  const { guild, ticketId, userIds, action } = params

  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } })
  if (!ticket) return { ok: false, message: 'ไม่พบข้อมูล ticket นี้' }

  const channel = await guild.channels.fetch(ticket.channelId).catch(() => null)
  if (!channel || channel.type !== ChannelType.GuildText) {
    return { ok: false, message: 'ไม่พบห้องของ ticket นี้แล้ว' }
  }

  const current = new Set(readIdList(ticket.addedUserIds))
  const changed: string[] = []
  const skipped: string[] = []

  for (const userId of userIds) {
    if (action === 'remove' && userId === ticket.openerId) {
      skipped.push(userId) // เจ้าของ ticket นำออกไม่ได้
      continue
    }

    try {
      if (action === 'add') {
        await channel.permissionOverwrites.edit(userId, MEMBER_PERMS)
        current.add(userId)
      } else {
        await channel.permissionOverwrites.delete(userId).catch(async () => {
          await channel.permissionOverwrites.edit(userId, { ViewChannel: false })
        })
        current.delete(userId)
      }
      changed.push(userId)
    } catch {
      skipped.push(userId)
    }
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: { addedUserIds: JSON.stringify([...current]) },
  })

  if (changed.length === 0) {
    return { ok: false, message: 'ไม่มีใครถูกเปลี่ยนสิทธิ์ — อาจเป็นเจ้าของ ticket หรือบอทสิทธิ์ไม่พอ' }
  }

  const names = changed.map((id) => `<@${id}>`).join(' ')
  const note = skipped.length > 0 ? ` (ข้าม ${skipped.length} คน)` : ''

  return {
    ok: true,
    message:
      action === 'add' ? `เพิ่ม ${names} เข้าห้องแล้ว${note}` : `นำ ${names} ออกจากห้องแล้ว${note}`,
  }
}

export const VIEW_CHANNEL = PermissionFlagsBits.ViewChannel
