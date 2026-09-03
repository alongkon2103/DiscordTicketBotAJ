/**
 * ตัวแทนของ bot.ts สำหรับ edge runtime เท่านั้น
 *
 * Next คอมไพล์ instrumentation.ts ให้ทั้ง nodejs และ edge
 * ฝั่ง edge ไม่มี fs / worker_threads ทำให้ discord.js กับ better-sqlite3 พัง
 * instrumentation.ts เช็ค NEXT_RUNTIME ก่อนเรียก startBot อยู่แล้ว ฟังก์ชันพวกนี้จึงไม่มีวันถูกเรียกจริง
 *
 * next.config.ts สลับมาใช้ไฟล์นี้ผ่าน NormalModuleReplacementPlugin เฉพาะ build ของ edge
 */

const unreachable = (): never => {
  throw new Error('bot.edge-stub ถูกเรียกใช้งาน — โค้ดนี้ไม่ควรรันบน edge runtime')
}

export class BotNotReadyError extends Error {}

export const startBot = unreachable
export const getBotState = unreachable
export const getBotStatus = unreachable
export const getGuild = unreachable
