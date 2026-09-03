import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'
import { env } from '@/lib/env'

/**
 * เลือก driver adapter จากรูปแบบของ DATABASE_URL อัตโนมัติ
 *
 *   file:./data/app.db                          → SQLite
 *   postgresql://user:pass@host:5432/dbname     → PostgreSQL
 *
 * ตอนย้ายไป Postgres ยังต้องแก้ provider ใน prisma/schema.prisma ด้วยมืออีกหนึ่งบรรทัด
 * เพราะ Prisma ไม่ยอมให้ใส่ env() ตรงนั้น (ตรวจแล้ว) — ดูขั้นตอนทั้งหมดใน docs/postgres.md
 */
function createAdapter() {
  const url = env.DATABASE_URL

  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) {
    return new PrismaPg({ connectionString: url })
  }
  if (url.startsWith('file:')) {
    return new PrismaBetterSqlite3({ url })
  }

  throw new Error(
    `DATABASE_URL ไม่รู้จักรูปแบบ "${url.slice(0, 20)}..." — ต้องขึ้นต้นด้วย file: หรือ postgresql://`,
  )
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createAdapter(),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
