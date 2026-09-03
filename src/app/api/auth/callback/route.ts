import { NextResponse, type NextRequest } from 'next/server'
import { env } from '@/lib/env'
import { exchangeCode, fetchDiscordUser } from '@/lib/auth/oauth'
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
} from '@/lib/auth/session'

function fail(message: string) {
  const url = new URL('/login', env.APP_URL)
  url.searchParams.set('reason', 'error')
  url.searchParams.set('detail', message)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const state = req.nextUrl.searchParams.get('state')
  const expectedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value

  if (req.nextUrl.searchParams.get('error')) {
    return fail('คุณปฏิเสธการเข้าสู่ระบบด้วย Discord')
  }
  if (!code || !state) return fail('Discord ส่งกลับมาไม่ครบ (ไม่มี code หรือ state)')
  if (!expectedState || state !== expectedState) {
    return fail('state ไม่ตรง — ลองเข้าสู่ระบบใหม่อีกครั้ง')
  }

  try {
    const accessToken = await exchangeCode(code)
    const user = await fetchDiscordUser(accessToken)
    const token = await signSession(user)

    const res = NextResponse.redirect(new URL('/', env.APP_URL))
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions)
    res.cookies.delete(OAUTH_STATE_COOKIE)
    return res
  } catch (err) {
    return fail(err instanceof Error ? err.message : 'เข้าสู่ระบบไม่สำเร็จ')
  }
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
