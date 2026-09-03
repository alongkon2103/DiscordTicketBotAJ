import { z } from 'zod'

const snowflake = z
  .string()
  .regex(/^\d{17,20}$/, 'ต้องเป็น Discord ID (ตัวเลข 17-20 หลัก)')

const EnvSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'ต้องมี BOT_TOKEN'),
  CLIENT_ID: snowflake,
  CLIENT_SECRET: z.string().min(1, 'ต้องมี CLIENT_SECRET'),
  GUILD_ID: snowflake,
  OWNER_IDS: z.string().min(1, 'ต้องมี OWNER_IDS อย่างน้อยหนึ่งคน'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET ต้องยาวอย่างน้อย 32 ตัวอักษร'),
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().min(1),
})

function load() {
  const parsed = EnvSchema.safeParse(process.env)

  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    throw new Error(`ค่าใน .env ไม่ถูกต้อง\n${lines.join('\n')}\n\nดูตัวอย่างที่ .env.example`)
  }

  const raw = parsed.data
  const appUrl = raw.APP_URL.replace(/\/+$/, '')
  const ownerIds = raw.OWNER_IDS.split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  if (ownerIds.length === 0) {
    throw new Error('OWNER_IDS ว่าง — ใส่ Discord user ID ของคุณอย่างน้อยหนึ่งคน')
  }

  return {
    ...raw,
    APP_URL: appUrl,
    ownerIds,
    redirectUri: `${appUrl}/api/auth/callback`,
    isHttps: appUrl.startsWith('https://'),
  }
}

export const env = load()
