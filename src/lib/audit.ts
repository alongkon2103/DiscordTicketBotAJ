import { prisma } from '@/lib/prisma'
import type { SessionUser } from '@/lib/auth/session'

export async function recordAudit(params: {
  actor: SessionUser
  action: string
  target?: string
  detail?: Record<string, unknown>
}): Promise<void> {
  await prisma.auditLog
    .create({
      data: {
        actorId: params.actor.id,
        actorTag: params.actor.username,
        action: params.action,
        target: params.target ?? null,
        detail: JSON.stringify(params.detail ?? {}),
      },
    })
    .catch(() => {
      // บันทึก audit ล้มเหลวไม่ควรทำให้การกระทำหลักล้มตาม
    })
}

export const AUDIT_LABEL: Record<string, string> = {
  'ticket-type.create': 'สร้างประเภท Ticket',
  'ticket-type.update': 'แก้ไขประเภท Ticket',
  'ticket-type.delete': 'ลบประเภท Ticket',
  'panel.create': 'สร้าง Panel',
  'panel.update': 'แก้ไข Panel',
  'panel.delete': 'ลบ Panel',
  'panel.publish': 'ส่ง Panel ขึ้น Discord',
  'ticket.close': 'ปิด Ticket จากหน้าเว็บ',
  'settings.update': 'แก้ไขการตั้งค่า',
  'member-event.update': 'แก้ไขข้อความต้อนรับ/อำลา',
  'announcement.send': 'ส่งประกาศ',
  'announcement.update': 'แก้ไขประกาศ',
  'announcement.delete': 'ลบประกาศ',
}
