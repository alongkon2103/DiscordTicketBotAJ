import { env } from '@/lib/env'
import type { SessionUser } from './session'

const DISCORD_API = 'https://discord.com/api/v10'

/** ขอแค่ identify — สิทธิ์/role เราอ่านจาก guild cache ของบอทเอง ไม่ต้องขอจากผู้ใช้ */
const SCOPES = ['identify'] as const

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: env.CLIENT_ID,
    redirect_uri: env.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state,
    prompt: 'none',
  })
  return `https://discord.com/oauth2/authorize?${params.toString()}`
}

type TokenResponse = { access_token: string; token_type: string }

export async function exchangeCode(code: string): Promise<string> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.CLIENT_ID,
      client_secret: env.CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: env.redirectUri,
    }),
    cache: 'no-store',
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(
      `แลก token กับ Discord ไม่สำเร็จ (${res.status}) — ตรวจว่า CLIENT_SECRET ถูกต้อง ` +
        `และใส่ redirect URI "${env.redirectUri}" ไว้ใน Developer Portal แล้ว. ${detail.slice(0, 200)}`,
    )
  }

  const json = (await res.json()) as TokenResponse
  return json.access_token
}

type DiscordUser = {
  id: string
  username: string
  global_name: string | null
  avatar: string | null
  discriminator: string
}

export async function fetchDiscordUser(accessToken: string): Promise<SessionUser> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  })

  if (!res.ok) throw new Error(`ดึงข้อมูลผู้ใช้จาก Discord ไม่สำเร็จ (${res.status})`)

  const user = (await res.json()) as DiscordUser

  return {
    id: user.id,
    username: user.username,
    displayName: user.global_name ?? user.username,
    avatarUrl: user.avatar
      ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=128`
      : null,
  }
}
