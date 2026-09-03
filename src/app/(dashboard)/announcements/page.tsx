import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/guard'
import { STATUS_LABEL } from '@/lib/announcements'
import { getGuildResources } from '@/lib/discord/resources'
import { PageHeader } from '@/components/PageHeader'
import styles from '@/components/editor.module.css'
import { createAnnouncement } from './actions'

const fmt = (date: Date | null) =>
  date
    ? date.toLocaleString('th-TH', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

export default async function AnnouncementsPage() {
  await requireAdmin()

  const announcements = await prisma.announcement.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { deliveries: { select: { channelId: true, status: true } } },
  })

  const channelNames = await getGuildResources()
    .then((r) => new Map(r.channels.map((c) => [c.id, c.name])))
    .catch(() => new Map<string, string>())

  return (
    <>
      <PageHeader
        title="ประกาศ"
        lede="เขียนข้อความ เลือกห้อง แล้วส่งทันทีหรือตั้งเวลาไว้ล่วงหน้า — ที่ส่งไปแล้วก็ยังกลับมาแก้ได้"
        actions={
          <form action={createAnnouncement}>
            <button type="submit" className="btn btn-primary">
              เขียนประกาศใหม่
            </button>
          </form>
        }
      />

      {announcements.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>ยังไม่มีประกาศ</div>
          <p className={styles.emptyLede}>
            เขียนอันแรกได้เลย หรือวางลิงก์ข้อความเก่าของบอทเข้ามาแก้ต่อก็ได้
          </p>
          <form action={createAnnouncement}>
            <button type="submit" className="btn btn-primary">
              เขียนประกาศแรก
            </button>
          </form>
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>ห้อง</th>
              <th>สถานะ</th>
              <th>เวลาที่ตั้งไว้</th>
              <th>ส่งเมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {announcements.map((item) => (
              <tr key={item.id}>
                <td>
                  <Link className={styles.rowLink} href={`/announcements/${item.id}`}>
                    {item.name || 'ไม่มีชื่อ'}
                  </Link>
                </td>
                <td className="muted" style={{ fontSize: 13 }}>
                  {item.deliveries.length === 0
                    ? '—'
                    : item.deliveries.length <= 2
                      ? item.deliveries
                          .map((d) => `#${channelNames.get(d.channelId) ?? d.channelId}`)
                          .join(', ')
                      : `${item.deliveries.length} ห้อง`}
                </td>
                <td>
                  <span className={styles.pill}>
                    <span className={styles.pillDot} data-on={item.status === 'sent'} />
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>
                </td>
                <td className={styles.num}>{fmt(item.scheduledAt)}</td>
                <td className={styles.num}>{fmt(item.sentAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
