import type { Client } from 'discord.js'

/**
 * เริ่มปิด Discord client เมื่อได้รับสัญญาณหยุดโปรเซส
 *
 * ## ทำไมถึงเป็นแค่ best-effort
 *
 * Next.js ลง handler ของ SIGTERM/SIGINT ไว้เองและเรียก process.exit() ทันที
 * ทดสอบแล้วทั้ง `next dev` และ `next start` (รวมถึงลอง process.prependListener แล้ว)
 * โปรเซสตายก่อนที่ await ตัวแรกของเราจะกลับมาเสมอ จึงรอให้ client.destroy() เสร็จไม่ได้
 *
 * ## แล้วทำไมไม่เป็นปัญหา
 *
 * พอโปรเซสตาย ระบบปฏิบัติการปิด TCP socket ให้เอง Discord เห็นการตัดการเชื่อมต่อทันที
 * และจบ session ให้ — ไม่ได้ค้างรอ heartbeat timeout 45 วินาทีแบบตอนเน็ตหลุด
 * ส่วนข้อมูลก็ไม่หาย เพราะการเขียนที่ commit แล้วอยู่บนดิสก์ ส่วนที่ยังค้างจะ rollback ตามปกติ
 *
 * ที่เหลือไว้ตรงนี้จึงเป็นการสั่งปิด WebSocket ให้เร็วขึ้นอีกนิดเท่านั้น
 * ถ้าวันไหนต้องการ shutdown ที่การันตีได้จริง ต้องแยกบอทออกไปเป็นคนละโปรเซสกับหน้าเว็บ
 */
const globalForShutdown = globalThis as unknown as { __ajShutdownBound?: boolean }

export function bindShutdown(client: Client): void {
  if (globalForShutdown.__ajShutdownBound) return
  globalForShutdown.__ajShutdownBound = true

  const close = (signal: string) => {
    console.log(`[shutdown] ได้รับ ${signal} — สั่งปิดการเชื่อมต่อ Discord`)
    // ไม่ await เพราะรอไม่ทันอยู่แล้ว แค่เริ่มปิดให้เร็วที่สุดเท่าที่ทำได้
    void client.destroy().catch(() => {})
  }

  process.prependListener('SIGTERM', () => close('SIGTERM'))
  process.prependListener('SIGINT', () => close('SIGINT'))
}
