#!/usr/bin/env node
/**
 * ย้ายข้อมูลข้ามฐานข้อมูล — ใช้ตอนเปลี่ยนจาก SQLite ไป PostgreSQL
 *
 *   node --env-file=.env scripts/data.mjs export   # ดัมพ์ทุกตารางลง data/export.json
 *   node --env-file=.env scripts/data.mjs import   # ยัดกลับเข้าฐานข้อมูลที่ DATABASE_URL ชี้อยู่
 *
 * ทั้งสองคำสั่งอ่าน DATABASE_URL จาก .env จึงใช้สคริปต์เดียวได้ทั้งสองฝั่ง
 * ให้ export ตอนยังเป็น SQLite แล้วค่อย import หลังสลับไป Postgres แล้ว
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const OUT_FILE = path.join('data', 'export.json')

/**
 * เรียงตามลำดับ foreign key — ตารางลูกต้องมาหลังตารางแม่เสมอ
 * ตอน export ลำดับไม่สำคัญ แต่ตอน import สำคัญมากเพราะ Postgres บังคับ FK จริง
 */
const MODELS = [
  { name: 'guildSettings', dates: ['createdAt', 'updatedAt'] },
  { name: 'memberEvent', dates: ['updatedAt'] },
  { name: 'ticketType', dates: ['createdAt', 'updatedAt'] },
  { name: 'modalField', dates: [] },
  { name: 'panel', dates: ['createdAt', 'updatedAt', 'lastPublishedAt'] },
  { name: 'panelItem', dates: [] },
  { name: 'ticket', dates: ['openedAt', 'closedAt'] },
  { name: 'ticketTranscript', dates: ['createdAt'] },
  { name: 'announcement', dates: ['createdAt', 'updatedAt', 'scheduledAt', 'sentAt'] },
  { name: 'announcementDelivery', dates: ['sentAt'] },
  { name: 'memberLog', dates: ['createdAt'] },
  { name: 'auditLog', dates: ['createdAt'] },
]

function createClient() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('ไม่พบ DATABASE_URL — รันด้วย node --env-file=.env')

  const adapter =
    url.startsWith('postgres://') || url.startsWith('postgresql://')
      ? new PrismaPg({ connectionString: url })
      : new PrismaBetterSqlite3({ url })

  return { prisma: new PrismaClient({ adapter }), url }
}

async function exportData() {
  const { prisma, url } = createClient()
  const dump = {}

  for (const model of MODELS) {
    dump[model.name] = await prisma[model.name].findMany()
    console.log(`  ${model.name.padEnd(22)} ${dump[model.name].length} แถว`)
  }

  await mkdir(path.dirname(OUT_FILE), { recursive: true })
  await writeFile(OUT_FILE, JSON.stringify(dump, null, 2), 'utf8')
  await prisma.$disconnect()

  console.log(`\nดัมพ์จาก ${url.split('@').pop()} ลง ${OUT_FILE} เรียบร้อย`)
}

async function importData() {
  const { prisma, url } = createClient()
  const dump = JSON.parse(await readFile(OUT_FILE, 'utf8'))

  for (const model of MODELS) {
    const rows = dump[model.name] ?? []
    if (rows.length === 0) {
      console.log(`  ${model.name.padEnd(22)} ข้าม (ไม่มีข้อมูล)`)
      continue
    }

    // JSON เก็บวันที่เป็นสตริง ต้องแปลงกลับเป็น Date ก่อน ไม่งั้น Prisma ปฏิเสธ
    const prepared = rows.map((row) => {
      const next = { ...row }
      for (const field of model.dates) {
        if (next[field]) next[field] = new Date(next[field])
      }
      return next
    })

    // ทีละแถวเพื่อให้รู้ว่าแถวไหนพัง แทนที่จะล้มทั้งก้อนแบบไม่บอกสาเหตุ
    let inserted = 0
    for (const row of prepared) {
      try {
        await prisma[model.name].create({ data: row })
        inserted += 1
      } catch (err) {
        console.error(`  ! ${model.name} id=${row.id ?? '?'}: ${err.message.split('\n')[0]}`)
      }
    }
    console.log(`  ${model.name.padEnd(22)} ${inserted}/${rows.length} แถว`)
  }

  await prisma.$disconnect()
  console.log(`\nนำเข้าสู่ ${url.split('@').pop()} เรียบร้อย`)
}

const mode = process.argv[2]

if (mode === 'export') {
  console.log('กำลังดัมพ์ข้อมูล...\n')
  await exportData()
} else if (mode === 'import') {
  console.log('กำลังนำเข้าข้อมูล...\n')
  await importData()
} else {
  console.error('ใช้: node --env-file=.env scripts/data.mjs [export|import]')
  process.exit(1)
}
