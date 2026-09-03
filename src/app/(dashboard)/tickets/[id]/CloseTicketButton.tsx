'use client'

import { useState, useTransition } from 'react'
import { closeTicketFromWeb } from '../actions'

export function CloseTicketButton({ ticketId }: { ticketId: string }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  return (
    <>
      <button
        type="button"
        className="btn btn-danger"
        disabled={pending}
        onClick={() => {
          if (!window.confirm('ปิด ticket นี้? ห้องจะถูกย้ายเข้าคลังและตัดสิทธิ์คนเปิด')) return
          setError(null)
          startTransition(async () => {
            const result = await closeTicketFromWeb(ticketId)
            if (!result.ok) setError(result.error)
          })
        }}
      >
        {pending ? 'กำลังปิด...' : 'ปิด Ticket'}
      </button>
      {error ? (
        <span style={{ color: 'var(--danger)', fontSize: 13, alignSelf: 'center' }}>{error}</span>
      ) : null}
    </>
  )
}
