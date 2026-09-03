import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/guard'
import { PageHeader } from '@/components/PageHeader'
import styles from '@/components/editor.module.css'

const STATUS_LABEL: Record<string, string> = {
  open: 'เปิดอยู่',
  archived: 'ปิดแล้ว',
  deleted: 'ลบห้องแล้ว',
}

const FILTERS = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'open', label: 'เปิดอยู่' },
  { value: 'archived', label: 'ปิดแล้ว' },
  { value: 'deleted', label: 'ลบห้องแล้ว' },
]

const fmt = (date: Date) =>
  date.toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>
}) {
  await requireAdmin()
  const { status } = await searchParams
  const active = status && status !== 'all' ? status : undefined

  const tickets = await prisma.ticket.findMany({
    where: active ? { status: active } : undefined,
    orderBy: { openedAt: 'desc' },
    take: 200,
    include: {
      ticketType: { select: { name: true } },
      transcript: { select: { messageCount: true } },
    },
  })

  return (
    <>
      <PageHeader
        title="รายการ Ticket"
        lede="ticket ทั้งหมดที่เคยเปิด คลิกเข้าไปดูคำตอบจากฟอร์มและบันทึกแชทย้อนหลังได้"
        actions={
          <div style={{ display: 'flex', gap: 6 }}>
            {FILTERS.map((f) => (
              <Link
                key={f.value}
                href={f.value === 'all' ? '/tickets' : `/tickets?status=${f.value}`}
                className="btn"
                style={
                  (active ?? 'all') === f.value
                    ? { borderColor: 'var(--accent)', color: 'var(--accent)' }
                    : undefined
                }
              >
                {f.label}
              </Link>
            ))}
          </div>
        }
      />

      {tickets.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>ยังไม่มี ticket ในหมวดนี้</div>
          <p className={styles.emptyLede}>
            เมื่อมีคนกดปุ่มใน panel ห้องจะถูกสร้างและโผล่มาที่นี่
          </p>
        </div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>เลข</th>
              <th>ประเภท</th>
              <th>เปิดโดย</th>
              <th>เปิดเมื่อ</th>
              <th>สถานะ</th>
              <th>ข้อความ</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td>
                  <Link className={`${styles.rowLink} mono`} href={`/tickets/${ticket.id}`}>
                    #{String(ticket.number).padStart(4, '0')}
                  </Link>
                </td>
                <td style={{ fontSize: 13 }}>{ticket.ticketType.name}</td>
                <td className="muted" style={{ fontSize: 13 }}>
                  {ticket.openerTag}
                </td>
                <td className={styles.num}>{fmt(ticket.openedAt)}</td>
                <td>
                  <span className={styles.pill}>
                    <span className={styles.pillDot} data-on={ticket.status === 'open'} />
                    {STATUS_LABEL[ticket.status] ?? ticket.status}
                  </span>
                </td>
                <td className={styles.num}>{ticket.transcript?.messageCount ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
