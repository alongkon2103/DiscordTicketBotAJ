import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'

export const SESSION_COOKIE = 'aj_session'
export const OAUTH_STATE_COOKIE = 'aj_oauth_state'

const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 วัน
const key = new TextEncoder().encode(env.SESSION_SECRET)

export type SessionUser = {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ user })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(key)
}

export async function verifySession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, key)
    const user = payload.user as SessionUser | undefined
    return user?.id ? user : null
  } catch {
    return null
  }
}

export async function readSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value
  return token ? verifySession(token) : null
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isHttps,
  path: '/',
  maxAge: SESSION_MAX_AGE,
} as const

export const stateCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.isHttps,
  path: '/',
  maxAge: 60 * 10, // 10 นาที
} as const
