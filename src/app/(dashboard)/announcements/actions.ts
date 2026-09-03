'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/guard'
import { recordAudit } from '@/lib/audit'
import { emptyPayload, type MessagePayload } from '@/lib/schema/message'
import {
  AnnouncementInputSchema,
  deliverAnnouncement,
  importMessageByLink,
} from '@/lib/announcements'

export type AnnouncementResult = { ok: true; note?: string } | { ok: false; errors: string[] }

export async function createAnnouncement() {
  const ctx = await requireAdmin()

  const count = await prisma.announcement.count()
  const created = await prisma.announcement.create({
    data: {
      name: `ประกาศที่ ${count + 1}`,
      createdById: ctx.user.id,
      payload: JSON.stringify({
        ...emptyPayload(),
        embed: {
          ...emptyPayload().embed,
          title: 'หัวข้อประกาศ',
          description: 'เขียนเนื้อหาประกาศตรงนี้',
          color: '#e0a03c',
        },
      }),
    },
  })

  redirect(`/announcements/${created.id}`)
}

type SaveOptions = { action: 'save' | 'send' | 'schedule' | 'cancel' }

export async function saveAnnouncement(
  id: string,
  raw: unknown,
  options: SaveOptions = { action: 'save' },
): Promise<AnnouncementResult> {
  const ctx = await requireAdmin()

  const parsed = AnnouncementInputSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
  }
  const input = parsed.data

  if (input.mentionMode === 'roles' && input.mentionRoleIds.length === 0) {
    return { ok: false, errors: ['เลือกแท็บ role ไว้ แต่ยังไม่ได้เลือก role'] }
  }
  if (options.action !== 'save' && input.channelIds.length === 0) {
    return { ok: false, errors: ['ยังไม่ได้เลือกห้องที่จะส่ง'] }
  }

  const existing = await prisma.announcement.findUnique({ where: { id } })
  if (!existing) return { ok: false, errors: ['ไม่พบประกาศนี้'] }

  let scheduledAt: Date | null = input.scheduledAt ? new Date(input.scheduledAt) : null
  let status = existing.status

  if (options.action === 'schedule') {
    if (!scheduledAt) return { ok: false, errors: ['ยังไม่ได้เลือกวันเวลาที่จะส่ง'] }
    if (scheduledAt.getTime() <= Date.now()) {
      return { ok: false, errors: ['เวลาที่ตั้งอยู่ในอดีต — เลือกเวลาในอนาคต'] }
    }
    status = 'scheduled'
  } else if (options.action === 'cancel') {
    status = 'draft'
    scheduledAt = null
  }

  await prisma.$transaction(async (tx) => {
    await tx.announcement.update({
      where: { id },
      data: {
        name: input.name,
        payload: JSON.stringify(input.payload),
        mentionMode: input.mentionMode,
        mentionRoleIds: JSON.stringify(input.mentionRoleIds),
        scheduledAt,
        status,
      },
    })

    // ห้องที่ถูกเอาออก — ลบทิ้งไปเลย ข้อความที่ส่งไปแล้วใน Discord ยังอยู่ตามเดิม
    await tx.announcementDelivery.deleteMany({
      where: {
        announcementId: id,
        ...(input.channelIds.length > 0 ? { channelId: { notIn: input.channelIds } } : {}),
      },
    })

    // ห้องที่เพิ่งเพิ่ม — สร้างรายการรอส่ง ห้องเดิมคงสถานะและ messageId ไว้
    for (const channelId of input.channelIds) {
      await tx.announcementDelivery.upsert({
        where: { announcementId_channelId: { announcementId: id, channelId } },
        create: { announcementId: id, channelId },
        update: {},
      })
    }
  })

  await recordAudit({
    actor: ctx.user,
    action: options.action === 'send' ? 'announcement.send' : 'announcement.update',
    target: id,
    detail: { name: input.name, action: options.action },
  })

  if (options.action === 'send') {
    const result = await deliverAnnouncement(id)
    revalidatePath('/announcements')
    revalidatePath(`/announcements/${id}`)

    if (!result.ok) return { ok: false, errors: [result.error] }

    // ทุกห้องพัง = ถือว่าล้ม, บางห้องพัง = รายงานแต่ยังนับว่าสำเร็จบางส่วน
    if (result.failed === result.outcomes.length) {
      return {
        ok: false,
        errors: result.outcomes.map((o) => `#${o.channelName}: ${o.error ?? 'ส่งไม่สำเร็จ'}`),
      }
    }
    if (result.failed > 0) {
      return {
        ok: false,
        errors: [
          `ส่งสำเร็จ ${result.sent + result.edited} ห้อง แต่มี ${result.failed} ห้องที่ไม่สำเร็จ`,
          ...result.outcomes
            .filter((o) => !o.ok)
            .map((o) => `#${o.channelName}: ${o.error ?? 'ส่งไม่สำเร็จ'}`),
        ],
      }
    }

    const parts: string[] = []
    if (result.sent > 0) parts.push(`ส่งใหม่ ${result.sent} ห้อง`)
    if (result.edited > 0) parts.push(`แก้ข้อความเดิม ${result.edited} ห้อง`)
    if (result.failed > 0) parts.push(`ไม่สำเร็จ ${result.failed} ห้อง`)

    return { ok: true, note: parts.join(' · ') || 'เรียบร้อย' }
  }

  revalidatePath('/announcements')
  revalidatePath(`/announcements/${id}`)

  if (options.action === 'schedule') {
    return {
      ok: true,
      note: `ตั้งเวลาส่งไว้ ${scheduledAt?.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}`,
    }
  }
  if (options.action === 'cancel') return { ok: true, note: 'ยกเลิกการตั้งเวลาแล้ว' }
  return { ok: true, note: 'บันทึกร่างแล้ว' }
}

export async function deleteAnnouncement(id: string) {
  const ctx = await requireAdmin()
  await prisma.announcement.delete({ where: { id } })
  await recordAudit({ actor: ctx.user, action: 'announcement.delete', target: id })
  revalidatePath('/announcements')
  redirect('/announcements')
}

export type ImportActionResult =
  | { ok: true; channelId: string; payload: MessagePayload }
  | { ok: false; error: string }


/** ดึงข้อความเก่าของบอทมาแก้ต่อ แล้วผูก id ไว้เพื่อให้กดส่งแล้วเป็นการแก้ข้อความเดิม */
export async function importAnnouncementFromLink(
  id: string,
  link: string,
): Promise<ImportActionResult> {
  await requireAdmin()

  const result = await importMessageByLink(link)
  if (!result.ok) return { ok: false, error: result.error }

  await prisma.$transaction(async (tx) => {
    await tx.announcement.update({
      where: { id },
      data: { payload: JSON.stringify(result.payload), status: 'sent', sentAt: new Date() },
    })
    // ผูกข้อความเดิมเข้ากับห้องนั้น กดส่งครั้งหน้าจะเป็นการแก้ข้อความนี้
    await tx.announcementDelivery.upsert({
      where: { announcementId_channelId: { announcementId: id, channelId: result.channelId } },
      create: {
        announcementId: id,
        channelId: result.channelId,
        messageId: result.messageId,
        status: 'sent',
        sentAt: new Date(),
      },
      update: { messageId: result.messageId, status: 'sent', error: null },
    })
  })

  revalidatePath(`/announcements/${id}`)
  return { ok: true, channelId: result.channelId, payload: result.payload }
}
