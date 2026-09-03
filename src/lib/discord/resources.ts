import { ChannelType, type Guild } from 'discord.js'
import { getGuild } from './bot'

export type ChannelKind = 'text' | 'voice' | 'category' | 'forum' | 'announcement' | 'stage' | 'other'

export type ChannelOption = {
  id: string
  name: string
  kind: ChannelKind
  parentId: string | null
  position: number
}

export type RoleOption = {
  id: string
  name: string
  /** '#rrggbb' หรือ null เมื่อเป็นสีเริ่มต้น */
  color: string | null
  position: number
  /** role ที่ระบบอื่นสร้าง (bot / booster) — แจกให้คนไม่ได้ */
  managed: boolean
  /** บอทแจก role นี้ให้สมาชิกได้ไหม */
  assignable: boolean
  /** เหตุผลที่แจกไม่ได้ — ไว้แสดงในหน้าเว็บ */
  blockedReason?: string
}

export type GuildResources = {
  channels: ChannelOption[]
  categories: ChannelOption[]
  roles: RoleOption[]
  /** ชื่อ role สูงสุดของบอท ไว้อธิบายให้ผู้ใช้เข้าใจว่าต้องลากอะไรขึ้น */
  botTopRoleName: string | null
}

function toKind(type: ChannelType): ChannelKind {
  switch (type) {
    case ChannelType.GuildText:
      return 'text'
    case ChannelType.GuildVoice:
      return 'voice'
    case ChannelType.GuildCategory:
      return 'category'
    case ChannelType.GuildForum:
      return 'forum'
    case ChannelType.GuildAnnouncement:
      return 'announcement'
    case ChannelType.GuildStageVoice:
      return 'stage'
    default:
      return 'other'
  }
}

async function collect(guild: Guild): Promise<GuildResources> {
  const [channelMap] = await Promise.all([guild.channels.fetch(), guild.roles.fetch()])
  const me = await guild.members.fetchMe()
  const botTop = me.roles.highest

  const channels: ChannelOption[] = []
  for (const channel of channelMap.values()) {
    if (!channel) continue
    channels.push({
      id: channel.id,
      name: channel.name,
      kind: toKind(channel.type),
      parentId: 'parentId' in channel ? (channel.parentId ?? null) : null,
      position: 'position' in channel ? channel.position : 0,
    })
  }

  const roles: RoleOption[] = guild.roles.cache
    .filter((role) => role.id !== guild.id) // ตัด @everyone ออก
    .map((role) => {
      // Discord ให้แจกได้เฉพาะ role ที่อยู่ต่ำกว่า role สูงสุดของบอทเท่านั้น
      // สิทธิ์ Administrator ไม่ช่วยข้อนี้ — เป็นกฎลำดับชั้นแยกต่างหาก
      // comparePositionTo จัดการกรณี position เท่ากันให้ด้วย (Discord ตัดสินด้วยไอดี)
      const belowBot = botTop.comparePositionTo(role) > 0
      const blockedReason = role.managed
        ? 'เป็น role ที่ Discord จัดการเอง (ของบอทหรือ booster) แจกให้ใครไม่ได้'
        : !belowBot
          ? `อยู่สูงกว่าหรือเท่ากับ role "${botTop.name}" ของบอท — ลาก role ของบอทขึ้นเหนือ role นี้ใน Server Settings > Roles`
          : undefined

      return {
        id: role.id,
        name: role.name,
        color: role.color === 0 ? null : `#${role.color.toString(16).padStart(6, '0')}`,
        position: role.position,
        managed: role.managed,
        assignable: !blockedReason,
        ...(blockedReason ? { blockedReason } : {}),
      }
    })
    .sort((a, b) => b.position - a.position)

  const categories = channels
    .filter((c) => c.kind === 'category')
    .sort((a, b) => a.position - b.position)

  // เรียงตาม category แล้วตามตำแหน่งในห้อง เหมือนที่เห็นใน Discord
  const categoryOrder = new Map(categories.map((c, i) => [c.id, i]))
  const sorted = channels
    .filter((c) => c.kind !== 'category')
    .sort((a, b) => {
      const ca = a.parentId ? (categoryOrder.get(a.parentId) ?? -1) : -1
      const cb = b.parentId ? (categoryOrder.get(b.parentId) ?? -1) : -1
      return ca === cb ? a.position - b.position : ca - cb
    })

  return { channels: sorted, categories, roles, botTopRoleName: botTop.name }
}

export async function getGuildResources(): Promise<GuildResources> {
  const guild = await getGuild()
  return collect(guild)
}

/** ห้องที่บอทโพสต์ข้อความได้ */
export function textualChannels(resources: GuildResources): ChannelOption[] {
  return resources.channels.filter((c) => c.kind === 'text' || c.kind === 'announcement')
}
