import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/guard'
import { AUDIT_LABEL } from '@/lib/audit'
import { PageHeader } from '@/components/PageHeader'
import styles from '@/components/editor.module.css'
import own from './audit.module.css'

const PAGE_SIZE = 60

const fmt = (date: Date) =>
  date.toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })

/** แปลง detail ที่เก็บเป็น JSON ให้เป็นข้อความสั้นๆ อ่านออก */
function describe(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const parts = Object.entries(parsed)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
    return parts.join(' · ')
  } catch {
    return ''
  }
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  await requireAdmin()

  const { page } = await searchParams
  const current = Math.max(1, Number(page) || 1)

  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (current - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count(),
  ])

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <PageHeader
        title="บันทึกการใช้งาน"
        lede="ทุกการเปลี่ยนแปลงที่ทำผ่านหน้าเว็บ ใครทำอะไรเมื่อไหร่ — ไม่รวมการกดปุ่มใน Discord"
      />

      {entries.length === 0 ? (
        <div className={styles.emptyState}>
          <div className={styles.emptyTitle}>ยังไม่มีบันทึก</div>
          <p className={styles.emptyLede}>
            เมื่อมีคนแก้ไขการตั้งค่าหรือส่งประกาศผ่านหน้าเว็บ รายการจะขึ้นที่นี่
          </p>
        </div>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>เวลา</th>
                <th>ใคร</th>
                <th>ทำอะไร</th>
                <th>รายละเอียด</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className={styles.num} style={{ whiteSpace: 'nowrap' }}>
                    {fmt(entry.createdAt)}
                  </td>
                  <td style={{ fontSize: 13 }}>{entry.actorTag}</td>
                  <td style={{ fontSize: 13 }}>
                    {AUDIT_LABEL[entry.action] ?? entry.action}
                  </td>
                  <td className={own.detail}>{describe(entry.detail) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {lastPage > 1 ? (
            <div className={own.pager}>
              <Link
                className="btn"
                href={`/audit?page=${current - 1}`}
                aria-disabled={current === 1}
                style={current === 1 ? { pointerEvents: 'none', opacity: 0.4 } : undefined}
              >
                ก่อนหน้า
              </Link>
              <span className={own.pageInfo}>
                หน้า {current} จาก {lastPage} · ทั้งหมด {total.toLocaleString('th-TH')} รายการ
              </span>
              <Link
                className="btn"
                href={`/audit?page=${current + 1}`}
                aria-disabled={current === lastPage}
                style={current === lastPage ? { pointerEvents: 'none', opacity: 0.4 } : undefined}
              >
                ถัดไป
              </Link>
            </div>
          ) : null}
        </>
      )}
    </>
  )
}
