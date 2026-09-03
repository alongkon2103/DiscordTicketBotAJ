import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/guard'
import { getGuildResources } from '@/lib/discord/resources'
import { PageHeader } from '@/components/PageHeader'
import styles from '@/components/editor.module.css'
import { createPanel } from './actions'

export default async function PanelsPage() {
  await requireAdmin()

  const panels = await prisma.panel.findMany({
    orderBy: { createdAt: 'asc' },
    include: { _count: { select: { items: true } } },
  })

  // ชื่อห้องอ่านง่ายกว่าไอดี — แต่ถ้าบอทยังไม่พร้อมก็ยังแสดงตารางได้
  const channelNames = await getGuildResources()
    .then((r) => new Map(r.channels.map((c) => [c.id, c.name])))
    .catch(() => new Map<string, string>())

  return (
    <>
      <PageHeader
        title="Panel"
        lede="ข้อความพร้อมปุ่มหรือ dropdown ที่ส่งไปวางในห้อง ให้สมาชิกกดเปิด ticket"
        actions={
          <form action={createPanel}>
            <button type="submit" className="btn btn-primary">
              สร้าง Panel ใหม่
            </button>
          </form>
        }
      />

      {panels.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>ยังไม่มี Panel</div>
          <p className={styles.emptyLede}>สร้างประเภท Ticket ก่อน แล้วค่อยเอามาวางเป็นปุ่มที่นี่</p>
          <form action={createPanel}>
            <button type="submit" className="btn btn-primary">
              สร้าง Panel แรก
            </button>
          </form>
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>รูปแบบ</th>
              <th>ตัวเลือก</th>
              <th>ห้องปลายทาง</th>
              <th>สถานะ</th>
            </tr>
          </thead>
          <tbody>
            {panels.map((panel) => (
              <tr key={panel.id}>
                <td>
                  <Link className={styles.rowLink} href={`/panels/${panel.id}`}>
                    {panel.name}
                  </Link>
                </td>
                <td className="muted" style={{ fontSize: 13 }}>
                  {panel.layout === 'select' ? 'dropdown' : 'ปุ่ม'}
                </td>
                <td className={styles.num}>{panel._count.items}</td>
                <td className="muted" style={{ fontSize: 13 }}>
                  {panel.channelId ? `#${channelNames.get(panel.channelId) ?? panel.channelId}` : '—'}
                </td>
                <td>
                  <span className={styles.pill}>
                    <span className={styles.pillDot} data-on={Boolean(panel.messageId)} />
                    {panel.messageId ? 'ส่งแล้ว' : 'ยังไม่ได้ส่ง'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
