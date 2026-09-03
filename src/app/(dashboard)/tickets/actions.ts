'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/guard'
import { recordAudit } from '@/lib/audit'
import { getGuild } from '@/lib/discord/bot'
import { archiveTicket } from '@/lib/discord/ticket/close'

export type CloseFromWebResult = { ok: true } | { ok: false; error: string }

export async function closeTicketFromWeb(ticketId: string): Promise<CloseFromWebResult> {
  const ctx = await requireAdmin()

  try {
    const guild = await getGuild()
    const result = await archiveTicket({
      guild,
      ticketId,
      closedById: ctx.user.id,
      closedByTag: ctx.user.username,
      reason: 'ปิดจากหน้าเว็บ',
    })

    if (!result.ok) return { ok: false, error: result.message }

    await recordAudit({ actor: ctx.user, action: 'ticket.close', target: ticketId })
    revalidatePath('/tickets')
    revalidatePath(`/tickets/${ticketId}`)
    revalidatePath('/')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'ปิด ticket ไม่สำเร็จ' }
  }
}
