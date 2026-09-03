import process from 'node:process'
import { defineConfig, env } from 'prisma/config'

// Prisma CLI ไม่โหลด .env ให้เองแล้วใน v7 (Next.js โหลดให้ตอนรันแอป)
try {
  process.loadEnvFile('.env')
} catch {
  // ไม่มีไฟล์ .env ก็ใช้ค่าจาก environment ตรงๆ
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
})
