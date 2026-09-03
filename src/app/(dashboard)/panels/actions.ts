'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/guard'
import { recordAudit } from '@/lib/audit'
import { emptyPayload } from '@/lib/schema/message'
import { PanelInputSchema, validatePanel } from '@/lib/schema/panel'
import { publishPanel, syncPanelIfPublished } from '@/lib/discord/panel'

export type PanelActionResult = { ok: true; note?: string } | { ok: false; errors: string[] }

export async function createPanel() {
  const ctx = await requireAdmin()

  const count = await prisma.panel.count()
  const created = await prisma.panel.create({
    data: {
      name: `Panel ที่ ${count + 1}`,
      payload: JSON.stringify({
        ...emptyPayload(),
        embed: {
          ...emptyPayload().embed,
          title: 'เปิด Ticket ติดต่อทีมงาน',
          description: 'เลือกหัวข้อด้านล่างเพื่อเปิดห้องคุยส่วนตัวกับทีมงาน',
          color: '#e0a03c',
        },
      }),
    },
  })

  await recordAudit({ actor: ctx.user, action: 'panel.create', target: created.id })
  redirect(`/panels/${created.id}`)
}

export async function savePanel(
  id: string,
  raw: unknown,
  options: { publish?: boolean; forceNew?: boolean } = {},
): Promise<PanelActionResult> {
  const ctx = await requireAdmin()

  const parsed = PanelInputSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
  }

  const input = parsed.data
  const crossFieldErrors = validatePanel(input)
  if (crossFieldErrors.length > 0) return { ok: false, errors: crossFieldErrors }

  const keptItemIds = input.items.map((i) => i.id).filter((v): v is string => Boolean(v))

  await prisma.$transaction(async (tx) => {
    await tx.panel.update({
      where: { id },
      data: {
        name: input.name,
        channelId: input.channelId,
        payload: JSON.stringify(input.payload),
        layout: input.layout,
        selectPlaceholder: input.selectPlaceholder || null,
      },
    })

    await tx.panelItem.deleteMany({
      where: { panelId: id, ...(keptItemIds.length > 0 ? { id: { notIn: keptItemIds } } : {}) },
    })

    for (const [index, item] of input.items.entries()) {
      const data = {
        ticketTypeId: item.ticketTypeId,
        label: item.label,
        emoji: item.emoji || null,
        style: item.style,
        row: item.row,
        description: item.description || null,
        sortOrder: index,
      }
      if (item.id) {
        await tx.panelItem.update({ where: { id: item.id }, data })
      } else {
        await tx.panelItem.create({ data: { ...data, panelId: id } })
      }
    }
  })

  await recordAudit({
    actor: ctx.user,
    action: 'panel.update',
    target: id,
    detail: { name: input.name },
  })

  revalidatePath('/panels')
  revalidatePath(`/panels/${id}`)

  if (options.publish) {
    const result = await publishPanel(id, options.forceNew)
    if (!result.ok) return { ok: false, errors: [result.error] }

    await recordAudit({
      actor: ctx.user,
      action: 'panel.publish',
      target: id,
      detail: { messageId: result.messageId, created: result.created },
    })
    revalidatePath(`/panels/${id}`)
    return { ok: true, note: result.created ? 'ส่งข้อความใหม่ขึ้นห้องแล้ว' : 'แก้ข้อความเดิมใน Discord แล้ว' }
  }

  // เคยส่งขึ้นห้องแล้ว → แก้ข้อความเดิมให้ตรงกับที่บันทึก
  const synced = await syncPanelIfPublished(id)
  if (synced && !synced.ok) {
    return { ok: false, errors: [`บันทึกแล้ว แต่อัปเดตข้อความใน Discord ไม่สำเร็จ: ${synced.error}`] }
  }

  return { ok: true, note: synced ? 'บันทึกและอัปเดตข้อความใน Discord แล้ว' : undefined }
}

export async function deletePanel(id: string) {
  const ctx = await requireAdmin()
  await prisma.panel.delete({ where: { id } })
  await recordAudit({ actor: ctx.user, action: 'panel.delete', target: id })
  revalidatePath('/panels')
  redirect('/panels')
}
