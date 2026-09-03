import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * รูปที่อัปโหลดผ่านหน้าเว็บถูกเก็บไว้ที่ public/uploads แล้วอ้างในเทมเพลตด้วย "upload:<ชื่อไฟล์>"
 *
 * ทำไมไม่เก็บเป็น URL ตรงๆ: Discord ดึงรูปใน embed จากฝั่งเซิร์ฟเวอร์ของตัวเอง
 * ถ้าแอปรันบน localhost หรือหลัง firewall Discord จะเข้าถึงไม่ได้ รูปจะไม่ขึ้น
 * ตอนส่งจริงจึงแนบไฟล์ไปด้วยแล้วอ้างเป็น attachment:// ซึ่งใช้ได้ทุกที่
 */
export const UPLOAD_PREFIX = 'upload:'
export const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads')

const MAX_BYTES = 8 * 1024 * 1024
const ALLOWED: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/** ชื่อไฟล์ที่ระบบสร้างเองเท่านั้น — กัน path traversal ตอนอ่านไฟล์กลับ */
const SAFE_NAME = /^[0-9a-f-]{36}\.(png|jpg|gif|webp)$/

export const isUploadRef = (value: string): boolean => value.startsWith(UPLOAD_PREFIX)

export function uploadFileName(value: string): string | null {
  if (!isUploadRef(value)) return null
  const name = value.slice(UPLOAD_PREFIX.length)
  return SAFE_NAME.test(name) ? name : null
}

/** URL ที่หน้าเว็บใช้แสดง preview (Discord ไม่ได้ใช้ทางนี้) */
export function uploadPreviewUrl(value: string): string | null {
  const name = uploadFileName(value)
  return name ? `/uploads/${name}` : null
}

export type StoreResult = { ok: true; ref: string; url: string } | { ok: false; error: string }

export async function storeUpload(file: File): Promise<StoreResult> {
  const ext = ALLOWED[file.type]
  if (!ext) return { ok: false, error: 'รองรับเฉพาะไฟล์ PNG, JPG, GIF และ WEBP' }
  if (file.size > MAX_BYTES) {
    return { ok: false, error: `ไฟล์ใหญ่เกิน ${MAX_BYTES / 1024 / 1024} MB` }
  }

  const name = `${randomUUID()}.${ext}`
  await mkdir(UPLOAD_DIR, { recursive: true })
  await writeFile(path.join(UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()))

  return { ok: true, ref: `${UPLOAD_PREFIX}${name}`, url: `/uploads/${name}` }
}

/** อ่านไฟล์กลับมาเพื่อแนบไปกับข้อความ Discord */
export async function readUpload(value: string): Promise<{ name: string; data: Buffer } | null> {
  const name = uploadFileName(value)
  if (!name) return null
  try {
    return { name, data: await readFile(path.join(UPLOAD_DIR, name)) }
  } catch {
    return null
  }
}

export async function deleteUpload(value: string): Promise<void> {
  const name = uploadFileName(value)
  if (!name) return
  await unlink(path.join(UPLOAD_DIR, name)).catch(() => {})
}
