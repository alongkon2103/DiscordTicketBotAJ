/**
 * Next.js เรียกไฟล์นี้ครั้งเดียวตอน server boot
 * ใช้สตาร์ต Discord gateway ให้อยู่ในโปรเซสเดียวกับหน้าเว็บ
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return

  const { startBot } = await import('@/lib/discord/bot')
  startBot()
}
