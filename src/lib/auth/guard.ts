import { redirect } from 'next/navigation'
import { env } from '@/lib/env'
import { BotNotReadyError, getGuild } from '@/lib/discord/bot'
import { getSettings } from '@/lib/settings'
import { readSessionUser, type SessionUser } from './session'

export type AdminContext = {
  user: SessionUser
  isOwner: boolean
  roleIds: string[]
}

export type AccessDenial = {
  reason: 'unauthenticated' | 'not-member' | 'not-admin' | 'bot-unavailable'
  message: string
}

export type AccessResult = { ok: true; ctx: AdminContext } | { ok: false } & AccessDenial

export async function resolveAccess(): Promise<AccessResult> {
  const user = await readSessionUser()
  if (!user) return { ok: false, reason: 'unauthenticated', message: 'ยังไม่ได้เข้าสู่ระบบ' }

  // เจ้าของเข้าได้เสมอ แม้บอทจะยังต่อ Discord ไม่ได้ — ไม่งั้นจะเข้ามาแก้ปัญหาไม่ได้เลย
  if (env.ownerIds.includes(user.id)) {
    return { ok: true, ctx: { user, isOwner: true, roleIds: [] } }
  }

  const settings = await getSettings()
  if (settings.adminRoleIds.length === 0) {
    return {
      ok: false,
      reason: 'not-admin',
      message: 'ยังไม่มีการกำหนด role แอดมิน — ให้เจ้าของระบบเพิ่ม role ให้ก่อนที่หน้า ตั้งค่า',
    }
  }

  let roleIds: string[]
  try {
    const guild = await getGuild()
    const member = await guild.members.fetch(user.id).catch(() => null)
    if (!member) {
      return { ok: false, reason: 'not-member', message: 'บัญชีนี้ไม่ได้อยู่ในเซิร์ฟเวอร์' }
    }
    roleIds = [...member.roles.cache.keys()]
  } catch (err) {
    if (err instanceof BotNotReadyError) {
      return { ok: false, reason: 'bot-unavailable', message: err.message }
    }
    throw err
  }

  const isAdmin = roleIds.some((id) => settings.adminRoleIds.includes(id))
  if (!isAdmin) {
    return { ok: false, reason: 'not-admin', message: 'บัญชีนี้ไม่มี role ที่เข้าหน้าจัดการได้' }
  }

  return { ok: true, ctx: { user, isOwner: false, roleIds } }
}

/** ใช้ในหน้า dashboard — เด้งไป /login พร้อมเหตุผลถ้าไม่ผ่าน */
export async function requireAdmin(): Promise<AdminContext> {
  const access = await resolveAccess()
  if (access.ok) return access.ctx
  redirect(`/login?reason=${access.reason}`)
}
