import {
  Events,
  type Client,
  type Guild,
  type GuildMember,
  type PartialGuildMember,
  type TextChannel,
  type User,
} from 'discord.js'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { getMemberEvent, type MemberEventId, type MemberEventInput } from '@/lib/member-events'
import { buildMessage } from '../message'
import type { TemplateVars } from '../template'

const thaiDate = (date: Date | null) =>
  date
    ? date.toLocaleDateString('th-TH', { day: '2-digit', month: 'long', year: 'numeric' })
    : '—'

export function memberVars(params: {
  user: User
  guild: Guild
  joinedAt: Date | null
  memberCount: number
  displayName: string
}): TemplateVars {
  const now = new Date()
  return {
    user: `<@${params.user.id}>`,
    'user.name': params.user.username,
    'user.display': params.displayName,
    'user.id': params.user.id,
    'user.avatar': params.user.displayAvatarURL({ size: 256 }),
    'user.joined': thaiDate(params.joinedAt),
    'user.created': thaiDate(params.user.createdAt),
    server: params.guild.name,
    'server.membercount': String(params.memberCount),
    'server.icon': params.guild.iconURL({ size: 256 }) ?? '',
    date: now.toLocaleDateString('th-TH'),
    time: now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
  }
}

async function announce(
  guild: Guild,
  config: MemberEventInput,
  vars: TemplateVars,
  label: MemberEventId,
): Promise<void> {
  if (!config.enabled || !config.channelId) return

  const channel = await guild.channels.fetch(config.channelId).catch(() => null)
  if (!channel?.isTextBased() || channel.isThread()) {
    console.error(`[members] ห้อง ${label} ไม่มีอยู่แล้วหรือส่งข้อความไม่ได้: ${config.channelId}`)
    return
  }

  const built = await buildMessage(config.payload, vars)
  if (!built.content && built.embeds.length === 0) return

  await (channel as TextChannel)
    .send({
      content: built.content,
      embeds: built.embeds,
      files: built.files,
      // ข้อความต้อนรับควรแท็กคนใหม่ได้ แต่ห้ามแตะ @everyone หรือ role
      allowedMentions: { parse: ['users'] },
    })
    .catch((err: unknown) => {
      console.error(`[members] ส่งข้อความ ${label} ไม่สำเร็จ:`, err instanceof Error ? err.message : err)
    })
}

/** แจก role อัตโนมัติ โดยข้าม role ที่บอทแตะไม่ได้แทนที่จะล้มทั้งชุด */
async function applyAutoRoles(member: GuildMember, roleIds: string[]): Promise<void> {
  if (roleIds.length === 0) return

  const me = await member.guild.members.fetchMe()
  const assignable: string[] = []

  for (const roleId of roleIds) {
    const role = member.guild.roles.cache.get(roleId)
    if (!role) continue
    if (role.managed) {
      console.error(`[members] ข้าม role "${role.name}" — เป็น role ที่ระบบอื่นจัดการ แจกเองไม่ได้`)
      continue
    }
    // Discord ให้แจกได้เฉพาะ role ที่ต่ำกว่า role สูงสุดของบอท
    // สิทธิ์ Administrator ไม่ช่วยข้อนี้ และ position ที่เท่ากันก็ถือว่าแจกไม่ได้
    if (me.roles.highest.comparePositionTo(role) <= 0) {
      console.error(
        `[members] ข้าม role "${role.name}" (position ${role.position}) — ` +
          `ไม่ได้ต่ำกว่า role "${me.roles.highest.name}" ของบอท (position ${me.roles.highest.position}) ` +
          'ให้ลาก role ของบอทขึ้นเหนือ role นี้ใน Server Settings > Roles',
      )
      continue
    }
    assignable.push(roleId)
  }

  if (assignable.length === 0) return

  await member.roles.add(assignable, 'แจก role อัตโนมัติตอนเข้าเซิร์ฟเวอร์').catch((err: unknown) => {
    console.error('[members] แจก role ไม่สำเร็จ:', err instanceof Error ? err.message : err)
  })
}

/** เก็บไว้ทำสถิติ — ล้มเหลวก็ไม่ควรกระทบการต้อนรับ */
async function logMemberEvent(params: {
  kind: MemberEventId
  userId: string
  userTag: string
  memberCount: number
}): Promise<void> {
  await prisma.memberLog
    .create({
      data: {
        kind: params.kind,
        userId: params.userId,
        userTag: params.userTag,
        memberCount: params.memberCount,
      },
    })
    .catch((err: unknown) => {
      console.error('[members] บันทึกสถิติไม่สำเร็จ:', err instanceof Error ? err.message : err)
    })
}

export function registerMemberHandlers(client: Client) {
  client.on(Events.GuildMemberAdd, async (member: GuildMember) => {
    if (member.guild.id !== env.GUILD_ID) return

    try {
      await logMemberEvent({
        kind: 'join',
        userId: member.id,
        userTag: member.user.tag,
        memberCount: member.guild.memberCount,
      })

      const config = await getMemberEvent('join')
      await applyAutoRoles(member, config.autoRoleIds)
      await announce(
        member.guild,
        config,
        memberVars({
          user: member.user,
          guild: member.guild,
          joinedAt: member.joinedAt,
          memberCount: member.guild.memberCount,
          displayName: member.displayName,
        }),
        'join',
      )
    } catch (err) {
      console.error('[members] จัดการคนเข้าไม่สำเร็จ:', err)
    }
  })

  client.on(Events.GuildMemberRemove, async (member: GuildMember | PartialGuildMember) => {
    if (member.guild.id !== env.GUILD_ID) return

    try {
      await logMemberEvent({
        kind: 'leave',
        userId: member.id,
        userTag: member.user.tag,
        memberCount: member.guild.memberCount,
      })

      const config = await getMemberEvent('leave')

      // สมาชิกที่ไม่ได้อยู่ใน cache จะมาเป็น partial — user กับ guild ยังใช้ได้เสมอ
      await announce(
        member.guild,
        config,
        memberVars({
          user: member.user,
          guild: member.guild,
          joinedAt: member.joinedAt,
          memberCount: member.guild.memberCount,
          displayName: member.displayName ?? member.user.username,
        }),
        'leave',
      )
    } catch (err) {
      console.error('[members] จัดการคนออกไม่สำเร็จ:', err)
    }
  })
}
