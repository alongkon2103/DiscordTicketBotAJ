import { randomBytes } from 'node:crypto'
import { NextResponse } from 'next/server'
import { buildAuthorizeUrl } from '@/lib/auth/oauth'
import { OAUTH_STATE_COOKIE, stateCookieOptions } from '@/lib/auth/session'

export async function GET() {
  const state = randomBytes(24).toString('base64url')
  const res = NextResponse.redirect(buildAuthorizeUrl(state))
  res.cookies.set(OAUTH_STATE_COOKIE, state, stateCookieOptions)
  return res
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
