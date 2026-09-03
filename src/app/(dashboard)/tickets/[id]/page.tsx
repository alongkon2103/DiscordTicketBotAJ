import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/guard'
import { readIdList, readJson } from '@/lib/json-column'
import { TranscriptSchema } from '@/lib/discord/ticket/transcript'
import { PageHeader } from '@/components/PageHeader'
import { TranscriptView } from '@/components/TranscriptView'
import { CloseTicketButton } from './CloseTicketButton'
import styles from '@/components/transcript.module.css'
import editor from '@/components/editor.module.css'

const STATUS_LABEL: Record<string, string> = {
  open: 'เปิดอยู่',
  archived: 'ปิดแล้ว (ห้องยังอยู่)',
  deleted: 'ลบห้องแล้ว',
}

const fmt = (date: Date) =>
  date.toLocaleString('th-TH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

type StoredAnswer = { key: string; label: string; kind: string; display: string }

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { ticketType: { select: { name: true } }, transcript: true },
  })
  if (!ticket) notFound()

  const answers = (() => {
    try {
      return Object.values(JSON.parse(ticket.answers) as Record<string, StoredAnswer>)
    } catch {
      return []
    }
  })()

  const messages = ticket.transcript
    ? readJson(ticket.transcript.messages, TranscriptSchema, [])
    : []

  const added = readIdList(ticket.addedUserIds)

  return (
    <>
      <PageHeader
        title={`Ticket #${String(ticket.number).padStart(4, '0')}`}
        lede={ticket.ticketType.name}
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="btn" href="/tickets">
              กลับรายการ
            </Link>
            {ticket.status === 'open' ? <CloseTicketButton ticketId={ticket.id} /> : null}
          </div>
        }
      />

      <div className={styles.meta}>
        <span className={styles.metaKey}>สถานะ</span>
        <span className={styles.metaValue}>{STATUS_LABEL[ticket.status] ?? ticket.status}</span>

        <span className={styles.metaKey}>เปิดโดย</span>
        <span className={styles.metaValue}>
          {ticket.openerTag} <span className="faint mono">{ticket.openerId}</span>
        </span>

        <span className={styles.metaKey}>เปิดเมื่อ</span>
        <span className={styles.metaValue}>{fmt(ticket.openedAt)}</span>

        <span className={styles.metaKey}>ปิดเมื่อ</span>
        <span className={styles.metaValue}>{ticket.closedAt ? fmt(ticket.closedAt) : '—'}</span>

        <span className={styles.metaKey}>ปิดโดย</span>
        <span className={styles.metaValue}>{ticket.closedByTag ?? '—'}</span>

        {ticket.closeReason ? (
          <>
            <span className={styles.metaKey}>เหตุผล</span>
            <span className={styles.metaValue}>{ticket.closeReason}</span>
          </>
        ) : null}

        <span className={styles.metaKey}>ห้อง</span>
        <span className={`${styles.metaValue} mono`}>{ticket.channelId}</span>

        {added.length > 0 ? (
          <>
            <span className={styles.metaKey}>เพิ่มเข้าห้อง</span>
            <span className={`${styles.metaValue} mono`}>{added.join(', ')}</span>
          </>
        ) : null}
      </div>

      {answers.length > 0 ? (
        <>
          <h2 style={{ marginBottom: 12 }}>คำตอบจากฟอร์ม</h2>
          <div className={styles.answers}>
            {answers.map((answer) => (
              <div key={answer.key} className={styles.answer}>
                <div className={styles.answerLabel}>{answer.label}</div>
                <div className={styles.answerValue}>
                  {answer.display ? (
                    answer.display
                  ) : (
                    <span className={styles.answerEmpty}>ไม่ได้กรอก</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <h2 style={{ marginBottom: 12 }}>
        บันทึกแชท
        {ticket.transcript ? (
          <span className="faint mono" style={{ fontSize: 12, marginLeft: 8 }}>
            {ticket.transcript.messageCount} ข้อความ
          </span>
        ) : null}
      </h2>

      {ticket.transcript ? (
        <TranscriptView messages={messages} />
      ) : (
        <div className={editor.notice}>
          ยังไม่มีบันทึกแชท — ระบบจะเก็บให้อัตโนมัติตอนกดปิด ticket
          หรือกดปุ่ม “บันทึกแชท” ในห้องเพื่อเก็บตอนนี้เลย
        </div>
      )}
    </>
  )
}
