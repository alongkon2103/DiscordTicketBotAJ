'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/guard'
import { recordAudit } from '@/lib/audit'
import { emptyPayload } from '@/lib/schema/message'
import { EMPTY_CONFIG, type FieldKind } from '@/lib/schema/modal-field'
import { TicketTypeInputSchema, validateTicketType } from '@/lib/schema/ticket-type'
import { syncPanelIfPublished } from '@/lib/discord/panel'

export type ActionResult = { ok: true } | { ok: false; errors: string[] }

export async function createTicketType() {
  const ctx = await requireAdmin()

  const count = await prisma.ticketType.count()
  const created = await prisma.ticketType.create({
    data: {
      name: `ประเภทที่ ${count + 1}`,
      channelNameTemplate: 'ticket-{number}',
      sortOrder: count,
      openPayload: JSON.stringify({
        ...emptyPayload(),
        embed: {
          ...emptyPayload().embed,
          title: 'ขอบคุณที่ติดต่อเรา',
          description: 'ทีมงานจะเข้ามาตอบในห้องนี้เร็วที่สุด กรุณารอสักครู่',
          color: '#e0a03c',
        },
      }),
    },
  })

  await recordAudit({ actor: ctx.user, action: 'ticket-type.create', target: created.id })
  redirect(`/ticket-types/${created.id}`)
}

export async function saveTicketType(id: string, raw: unknown): Promise<ActionResult> {
  const ctx = await requireAdmin()

  const parsed = TicketTypeInputSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
  }

  const input = parsed.data
  const crossFieldErrors = validateTicketType(input)
  if (crossFieldErrors.length > 0) return { ok: false, errors: crossFieldErrors }

  const existing = await prisma.ticketType.findUnique({
    where: { id },
    select: { id: true, panelItems: { select: { panelId: true } } },
  })
  if (!existing) return { ok: false, errors: ['ไม่พบประเภท ticket นี้'] }

  const keptFieldIds = input.fields.map((f) => f.id).filter((v): v is string => Boolean(v))

  await prisma.$transaction(async (tx) => {
    await tx.ticketType.update({
      where: { id },
      data: {
        name: input.name,
        emoji: input.emoji || null,
        enabled: input.enabled,
        disabledMessage: input.disabledMessage,
        categoryIds: JSON.stringify(input.categoryIds),
        channelNameTemplate: input.channelNameTemplate,
        archiveCategoryId: input.archiveCategoryId,
        staffRoleIds: JSON.stringify(input.staffRoleIds),
        allowedRoleIds: JSON.stringify(input.allowedRoleIds),
        deniedRoleIds: JSON.stringify(input.deniedRoleIds),
        modalTitle: input.modalTitle,
        openPayload: JSON.stringify(input.openPayload),
        pingOpener: input.pingOpener,
        pingRoleIds: JSON.stringify(input.pingRoleIds),
        showAnswers: input.showAnswers,
        maxOpenPerUser: input.maxOpenPerUser,
        cooldownSeconds: input.cooldownSeconds,
      },
    })

    // ฟิลด์ที่ถูกลบออกจากฟอร์ม
    await tx.modalField.deleteMany({
      where: { ticketTypeId: id, ...(keptFieldIds.length > 0 ? { id: { notIn: keptFieldIds } } : {}) },
    })

    for (const [index, field] of input.fields.entries()) {
      const config = JSON.stringify(field.config ?? EMPTY_CONFIG[field.kind as FieldKind])
      const data = {
        kind: field.kind,
        key: field.key,
        label: field.label,
        description: field.description || null,
        required: field.required,
        config,
        sortOrder: index,
      }

      if (field.id) {
        await tx.modalField.update({ where: { id: field.id }, data })
      } else {
        await tx.modalField.create({ data: { ...data, ticketTypeId: id } })
      }
    }
  })

  await recordAudit({
    actor: ctx.user,
    action: 'ticket-type.update',
    target: id,
    detail: { name: input.name },
  })

  // ชื่อ/emoji ที่เปลี่ยนอาจกระทบ panel ที่ส่งไปแล้ว
  const panelIds = [...new Set(existing.panelItems.map((p) => p.panelId))]
  for (const panelId of panelIds) {
    await syncPanelIfPublished(panelId).catch(() => {})
  }

  revalidatePath('/ticket-types')
  revalidatePath(`/ticket-types/${id}`)
  return { ok: true }
}

export async function deleteTicketType(id: string) {
  const ctx = await requireAdmin()

  const openTickets = await prisma.ticket.count({ where: { ticketTypeId: id, status: 'open' } })
  if (openTickets > 0) {
    return { ok: false as const, errors: [`ยังมี ticket ประเภทนี้เปิดค้างอยู่ ${openTickets} ห้อง ปิดให้หมดก่อน`] }
  }

  const panelIds = await prisma.panelItem.findMany({
    where: { ticketTypeId: id },
    select: { panelId: true },
  })

  await prisma.ticketType.delete({ where: { id } })
  await recordAudit({ actor: ctx.user, action: 'ticket-type.delete', target: id })

  for (const panelId of [...new Set(panelIds.map((p) => p.panelId))]) {
    await syncPanelIfPublished(panelId).catch(() => {})
  }

  revalidatePath('/ticket-types')
  redirect('/ticket-types')
}
