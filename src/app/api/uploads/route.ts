import { NextResponse, type NextRequest } from 'next/server'
import { resolveAccess } from '@/lib/auth/guard'
import { storeUpload } from '@/lib/uploads'

export async function POST(req: NextRequest) {
  const access = await resolveAccess()
  if (!access.ok) {
    return NextResponse.json({ ok: false, error: 'ไม่มีสิทธิ์อัปโหลด' }, { status: 403 })
  }

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: 'ไม่พบไฟล์ที่ส่งมา' }, { status: 400 })
  }

  const result = await storeUpload(file)
  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}

export const runtime = 'nodejs'
