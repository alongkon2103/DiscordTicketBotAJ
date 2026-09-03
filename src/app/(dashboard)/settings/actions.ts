'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/guard'
import { recordAudit } from '@/lib/audit'
import { updateSettings } from '@/lib/settings'

const snowflake = z.string().regex(/^\d{17,20}$/)

const SettingsInputSchema = z.object({
  adminRoleIds: z.array(snowflake).max(20),
  ticketLogChannelId: snowflake.nullable(),
})

export type SettingsResult = { ok: true } | { ok: false; errors: string[] }

export async function saveSettings(raw: unknown): Promise<SettingsResult> {
  const ctx = await requireAdmin()

  const parsed = SettingsInputSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => i.message) }
  }

  await updateSettings(parsed.data)
  await recordAudit({
    actor: ctx.user,
    action: 'settings.update',
    detail: {
      adminRoles: parsed.data.adminRoleIds.length,
      logChannel: parsed.data.ticketLogChannelId,
    },
  })

  revalidatePath('/settings')
  revalidatePath('/')
  return { ok: true }
}
