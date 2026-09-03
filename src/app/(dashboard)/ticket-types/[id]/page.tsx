import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/guard'
import { readIdList, readJson } from '@/lib/json-column'
import { emptyPayload, MessagePayloadSchema } from '@/lib/schema/message'
import type { FieldKind } from '@/lib/schema/modal-field'
import type { TicketTypeInput } from '@/lib/schema/ticket-type'
import { BotNotReadyError, getGuild } from '@/lib/discord/bot'
import { getGuildResources, type GuildResources } from '@/lib/discord/resources'
import { PageHeader } from '@/components/PageHeader'
import { TicketTypeEditor } from './TicketTypeEditor'
import styles from '@/components/editor.module.css'

async function loadResources(): Promise<
  { ok: true; resources: GuildResources; botName: string } | { ok: false; message: string }
> {
  try {
    const [resources, guild] = await Promise.all([getGuildResources(), getGuild()])
    return { ok: true, resources, botName: guild.client.user?.username ?? 'บอท' }
  } catch (err) {
    return {
      ok: false,
      message: err instanceof BotNotReadyError ? err.message : 'อ่านข้อมูลเซิร์ฟเวอร์ไม่ได้',
    }
  }
}

export default async function TicketTypePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const type = await prisma.ticketType.findUnique({
    where: { id },
    include: { fields: { orderBy: { sortOrder: 'asc' } } },
  })
  if (!type) notFound()

  const loaded = await loadResources()

  const initial: TicketTypeInput = {
    name: type.name,
    emoji: type.emoji ?? '',
    enabled: type.enabled,
    disabledMessage: type.disabledMessage,
    categoryIds: readIdList(type.categoryIds),
    channelNameTemplate: type.channelNameTemplate,
    archiveCategoryId: type.archiveCategoryId,
    staffRoleIds: readIdList(type.staffRoleIds),
    allowedRoleIds: readIdList(type.allowedRoleIds),
    deniedRoleIds: readIdList(type.deniedRoleIds),
    modalTitle: type.modalTitle,
    fields: type.fields.map((f) => ({
      id: f.id,
      kind: f.kind as FieldKind,
      key: f.key,
      label: f.label,
      description: f.description ?? '',
      required: f.required,
      config: (() => {
        try {
          return JSON.parse(f.config) as unknown
        } catch {
          return {}
        }
      })(),
    })),
    openPayload: readJson(type.openPayload, MessagePayloadSchema, emptyPayload()),
    pingOpener: type.pingOpener,
    pingRoleIds: readIdList(type.pingRoleIds),
    showAnswers: type.showAnswers,
    maxOpenPerUser: type.maxOpenPerUser,
    cooldownSeconds: type.cooldownSeconds,
  }

  return (
    <>
      <PageHeader
        title={type.name}
        lede="ตั้งค่าทุกอย่างของประเภทนี้ — กด บันทึก ด้านล่างเมื่อแก้เสร็จ"
      />

      {loaded.ok ? (
        <TicketTypeEditor
          id={type.id}
          initial={initial}
          resources={loaded.resources}
          botName={loaded.botName}
        />
      ) : (
        <div className={styles.notice}>
          {loaded.message} — แก้ไขไม่ได้จนกว่าบอทจะเชื่อมต่อ Discord ได้ เพราะต้องอ่านรายชื่อห้องและ role
        </div>
      )}
    </>
  )
}
