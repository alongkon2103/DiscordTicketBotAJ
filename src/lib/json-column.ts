import type { z } from 'zod'

/**
 * SQLite (ผ่าน Prisma) ไม่รองรับ Json และ String[]
 * คอลัมน์ที่เก็บโครงสร้างจึงเป็น String ที่บรรจุ JSON แล้วผ่าน Zod ตอนอ่าน
 * ถ้าข้อมูลในคอลัมน์พังหรือ schema เปลี่ยน จะได้ค่า fallback แทนที่จะ throw กลางหน้าเว็บ
 */
export function readJson<T>(raw: string | null | undefined, schema: z.ZodType<T>, fallback: T): T {
  if (!raw) return fallback
  try {
    const parsed = schema.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : fallback
  } catch {
    return fallback
  }
}

export function writeJson(value: unknown): string {
  return JSON.stringify(value)
}

/** คอลัมน์ที่เก็บ list ของ Discord ID */
export function readIdList(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((v): v is string => typeof v === 'string')
  } catch {
    return []
  }
}
