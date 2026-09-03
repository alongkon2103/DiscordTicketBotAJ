import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { getSettings } from '@/lib/settings'
import { BotNotReadyError, getBotStatus, getGuild } from '@/lib/discord/bot'
import { loadStats } from '@/lib/stats'
import { PageHeader } from '@/components/PageHeader'
import { StatsSection } from './StatsSection'
import styles from './overview.module.css'

const STATUS_TEXT = {
  ready: 'บอทออนไลน์',
  connecting: 'กำลังเชื่อมต่อ Discord',
  failed: 'เชื่อมต่อ Discord ไม่สำเร็จ',
  stopped: 'บอทยังไม่เริ่มทำงาน',
} as const

async function loadGuildInfo() {
  try {
    const guild = await getGuild()
    return {
      ok: true as const,
      name: guild.name,
      memberCount: guild.memberCount,
      channelCount: guild.channels.cache.size,
      roleCount: guild.roles.cache.size,
    }
  } catch (err) {
    return {
      ok: false as const,
      message: err instanceof BotNotReadyError ? err.message : 'อ่านข้อมูลเซิร์ฟเวอร์ไม่ได้',
    }
  }
}

export default async function OverviewPage() {
  const bot = getBotStatus()

  const [guild, settings, ticketTypeCount, panelCount, stats] = await Promise.all([
    loadGuildInfo(),
    getSettings(),
    prisma.ticketType.count(),
    prisma.panel.count(),
    loadStats(),
  ])

  const checklist = [
    {
      done: bot.status === 'ready',
      title: 'บอทเชื่อมต่อ Discord ได้',
      hint: 'ต้องเปิด SERVER MEMBERS และ MESSAGE CONTENT intent ใน Developer Portal',
    },
    {
      done: guild.ok,
      title: 'บอทอยู่ในเซิร์ฟเวอร์ที่ตั้งไว้',
      hint: `GUILD_ID = ${env.GUILD_ID}`,
    },
    {
      done: settings.adminRoleIds.length > 0,
      title: 'กำหนด role ที่เข้าหน้าจัดการได้',
      hint: 'ตอนนี้เข้าได้เฉพาะ OWNER_IDS — เพิ่ม role ทีมงานที่หน้าตั้งค่า',
    },
    {
      done: ticketTypeCount > 0,
      title: 'สร้างประเภท Ticket อย่างน้อยหนึ่งอัน',
      hint: 'กำหนด category ปลายทาง role ทีมงาน และฟิลด์ใน modal',
    },
    {
      done: panelCount > 0,
      title: 'สร้างและส่ง Panel ขึ้นห้อง',
      hint: 'ข้อความพร้อมปุ่มให้สมาชิกกดเปิด ticket',
    },
  ]

  return (
    <>
      <PageHeader
        title="ภาพรวม"
        lede="สถานะการเชื่อมต่อและสิ่งที่ยังต้องตั้งค่าให้ครบก่อนเริ่มใช้งานจริง"
      />

      <div className={styles.grid}>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.openNow}</div>
          <div className={styles.statLabel}>Ticket ค้างอยู่</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.openedToday}</div>
          <div className={styles.statLabel}>เปิดวันนี้</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>
            {guild.ok ? guild.memberCount.toLocaleString('th-TH') : '—'}
          </div>
          <div className={styles.statLabel}>สมาชิกทั้งหมด</div>
        </div>
        <div className={styles.stat}>
          <div className={styles.statValue}>{stats.announcementsSent30d}</div>
          <div className={styles.statLabel}>ประกาศ 30 วัน</div>
        </div>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>การเชื่อมต่อ</h2>
        </div>

        <div className={styles.connection} data-state={bot.status}>
          <div className={styles.connectionRow}>{STATUS_TEXT[bot.status]}</div>

          <div className={styles.connectionMeta}>
            <span className={styles.metaKey}>บัญชีบอท</span>
            <span className={`${styles.metaValue} mono`}>{bot.tag ?? '—'}</span>

            <span className={styles.metaKey}>เซิร์ฟเวอร์</span>
            <span className={styles.metaValue}>{guild.ok ? guild.name : '—'}</span>

            <span className={styles.metaKey}>สมาชิก</span>
            <span className={`${styles.metaValue} mono`}>
              {guild.ok ? guild.memberCount.toLocaleString('th-TH') : '—'}
            </span>

            <span className={styles.metaKey}>ห้อง / role</span>
            <span className={`${styles.metaValue} mono`}>
              {guild.ok ? `${guild.channelCount} / ${guild.roleCount}` : '—'}
            </span>
          </div>

          {bot.error ? <div className={styles.error}>{bot.error}</div> : null}
          {!bot.error && !guild.ok ? <div className={styles.error}>{guild.message}</div> : null}
        </div>
      </section>

      <StatsSection stats={stats} />

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>สิ่งที่ต้องตั้งค่า</h2>
          <span className="label-eyebrow">
            {checklist.filter((c) => c.done).length} / {checklist.length}
          </span>
        </div>

        <div className={styles.checklist}>
          {checklist.map((item) => (
            <div key={item.title} className={styles.check} data-done={item.done}>
              <span className={styles.checkMark} aria-hidden>
                {item.done ? '●' : '○'}
              </span>
              <div className={styles.checkBody}>
                <div className={styles.checkTitle}>{item.title}</div>
                <div className={styles.checkHint}>{item.hint}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
