import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { readIdList, readJson } from '@/lib/json-column'
import { emptyPayload, MessagePayloadSchema } from '@/lib/schema/message'

export const MEMBER_EVENTS = ['join', 'leave'] as const
export type MemberEventId = (typeof MEMBER_EVENTS)[number]

const snowflake = z.string().regex(/^\d{17,20}$/)

export const MemberEventInputSchema = z.object({
  enabled: z.boolean(),
  channelId: snowflake.nullable(),
  payload: MessagePayloadSchema,
  /** ใช้เฉพาะ event "join" */
  autoRoleIds: z.array(snowflake).max(20).default([]),
})

export type MemberEventInput = z.infer<typeof MemberEventInputSchema>

const DEFAULTS: Record<MemberEventId, { title: string; description: string; color: string }> = {
  join: {
    title: 'ยินดีต้อนรับสู่ {server}',
    description: 'สวัสดี {user} 🎉\nขอต้อนรับเข้าสู่ครอบครัวของเรา\nอย่าลืมอ่านกฎก่อนเริ่มพูดคุยนะ\n\nตอนนี้เรามีสมาชิก {server.membercount} คนแล้ว',
    color: '#e0a03c',
  },
  leave: {
    title: 'ลาก่อน {user.name}',
    description: '{user.name} ออกจากเซิร์ฟเวอร์ไปแล้ว\nขอบคุณที่เคยอยู่ด้วยกัน แล้วเจอกันใหม่\n\nตอนนี้เหลือสมาชิก {server.membercount} คน',
    color: '#8b8d94',
  },
}

function defaultPayload(id: MemberEventId) {
  const base = emptyPayload()
  const preset = DEFAULTS[id]
  return {
    ...base,
    embed: {
      ...base.embed,
      title: preset.title,
      description: preset.description,
      color: preset.color,
      thumbnailUrl: '{user.avatar}',
    },
  }
}

export async function getMemberEvent(id: MemberEventId): Promise<MemberEventInput> {
  const row = await prisma.memberEvent.upsert({
    where: { id },
    update: {},
    create: { id, payload: JSON.stringify(defaultPayload(id)) },
  })

  return {
    enabled: row.enabled,
    channelId: row.channelId,
    payload: readJson(row.payload, MessagePayloadSchema, defaultPayload(id)),
    autoRoleIds: readIdList(row.autoRoleIds),
  }
}

export async function saveMemberEvent(id: MemberEventId, input: MemberEventInput): Promise<void> {
  const data = {
    enabled: input.enabled,
    channelId: input.channelId,
    payload: JSON.stringify(input.payload),
    autoRoleIds: JSON.stringify(id === 'join' ? input.autoRoleIds : []),
  }
  await prisma.memberEvent.upsert({ where: { id }, create: { id, ...data }, update: data })
}
