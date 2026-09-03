import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/guard'
import { readIdList } from '@/lib/json-column'
import { PageHeader } from '@/components/PageHeader'
import styles from '@/components/editor.module.css'
import { createTicketType } from './actions'

export default async function TicketTypesPage() {
  await requireAdmin()

  const types = await prisma.ticketType.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: {
      _count: { select: { fields: true, panelItems: true } },
    },
  })

  const openCounts = await prisma.ticket.groupBy({
    by: ['ticketTypeId'],
    where: { status: 'open' },
    _count: { _all: true },
  })
  const openByType = new Map(openCounts.map((c) => [c.ticketTypeId, c._count._all]))

  return (
    <>
      <PageHeader
        title="ประเภท Ticket"
        lede="แต่ละประเภทกำหนดได้เองว่าสร้างห้องที่ category ไหน ใครเห็นได้ และตอนกดเปิดจะถามอะไรบ้าง"
        actions={
          <form action={createTicketType}>
            <button type="submit" className="btn btn-primary">
              สร้างประเภทใหม่
            </button>
          </form>
        }
      />

      {types.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>ยังไม่มีประเภท Ticket</div>
          <p className={styles.emptyLede}>
            สร้างอันแรกก่อน แล้วค่อยเอาไปวางเป็นปุ่มใน Panel
          </p>
          <form action={createTicketType}>
            <button type="submit" className="btn btn-primary">
              สร้างประเภทแรก
            </button>
          </form>
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>สถานะ</th>
              <th>ฟิลด์</th>
              <th>category</th>
              <th>ใช้ใน panel</th>
              <th>เปิดค้าง</th>
            </tr>
          </thead>
          <tbody>
            {types.map((type) => (
              <tr key={type.id}>
                <td>
                  <Link className={styles.rowLink} href={`/ticket-types/${type.id}`}>
                    {type.emoji ? `${type.emoji} ` : ''}
                    {type.name}
                  </Link>
                </td>
                <td>
                  <span className={styles.pill}>
                    <span className={styles.pillDot} data-on={type.enabled} />
                    {type.enabled ? 'เปิดรับ' : 'ปิดชั่วคราว'}
                  </span>
                </td>
                <td className={styles.num}>{type._count.fields}</td>
                <td className={styles.num}>{readIdList(type.categoryIds).length}</td>
                <td className={styles.num}>{type._count.panelItems}</td>
                <td className={styles.num}>{openByType.get(type.id) ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
