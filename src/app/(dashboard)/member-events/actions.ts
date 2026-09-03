'use server'

import { revalidatePath } from 'next/cache'
import type { TextChannel } from 'discord.js'
import { requireAdmin } from '@/lib/auth/guard'
import { recordAudit } from '@/lib/audit'
import { getGuild } from '@/lib/discord/bot'
import { buildMessage } from '@/lib/discord/message'
import { memberVars } from '@/lib/discord/handlers/members'
import {
  MEMBER_EVENTS,
  MemberEventInputSchema,
  getMemberEvent,
  saveMemberEvent,
  type MemberEventId,
} from '@/lib/member-events'

export type MemberEventResult = { ok: true; note?: string } | { ok: false; errors: string[] }

function isEventId(value: string): value is MemberEventId {
  return (MEMBER_EVENTS as readonly string[]).includes(value)
}

export async function saveMemberEventAction(
  id: string,
  raw: unknown,
): Promise<MemberEventResult> {
  const ctx = await requireAdmin()
  if (!isEventId(id)) return { ok: false, errors: ['ไม่รู้จักเหตุการณ์นี้'] }

  const parsed = MemberEventInputSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
  }

  const input = parsed.data
  if (input.enabled && !input.channelId) {
    return { ok: false, errors: ['เปิดใช้งานแล้วต้องเลือกห้องที่จะส่งข้อความ'] }
  }

  await saveMemberEvent(id, input)
  await recordAudit({
    actor: ctx.user,
    action: 'member-event.update',
    target: id,
    detail: { enabled: input.enabled, autoRoles: input.autoRoleIds.length },
  })

  revalidatePath('/member-events')
  return { ok: true }
}

/** ส่งข้อความจริงเข้าห้องที่ตั้งไว้ โดยใช้ตัวคุณเองเป็นตัวอย่าง */
export async function sendMemberEventTest(id: string): Promise<MemberEventResult> {
  const ctx = await requireAdmin()
  if (!isEventId(id)) return { ok: false, errors: ['ไม่รู้จักเหตุการณ์นี้'] }

  const config = await getMemberEvent(id)
  if (!config.channelId) return { ok: false, errors: ['ยังไม่ได้เลือกห้องที่จะส่ง'] }

  try {
    const guild = await getGuild()
    const channel = await guild.channels.fetch(config.channelId).catch(() => null)
    if (!channel?.isTextBased() || channel.isThread()) {
      return { ok: false, errors: ['ห้องที่เลือกไม่มีอยู่แล้ว หรือบอทส่งข้อความในห้องนั้นไม่ได้'] }
    }

    // ใช้บัญชีคุณเป็นตัวอย่าง ถ้าไม่ได้อยู่ในเซิร์ฟเวอร์ก็ใช้บอทแทน
    const sample =
      (await guild.members.fetch(ctx.user.id).catch(() => null)) ??
      (await guild.members.fetchMe())

    const built = await buildMessage(
      config.payload,
      memberVars({
        user: sample.user,
        guild,
        joinedAt: sample.joinedAt,
        memberCount: guild.memberCount,
        displayName: sample.displayName,
      }),
    )

    if (!built.content && built.embeds.length === 0) {
      return { ok: false, errors: ['ยังไม่ได้ใส่ข้อความหรือ embed'] }
    }

    await (channel as TextChannel).send({
      content: built.content,
      embeds: built.embeds,
      files: built.files,
      allowedMentions: { parse: ['users'] },
    })

    return { ok: true, note: `ส่งทดสอบเข้า #${channel.name} แล้ว` }
  } catch (err) {
    return { ok: false, errors: [err instanceof Error ? err.message : 'ส่งทดสอบไม่สำเร็จ'] }
  }
}
