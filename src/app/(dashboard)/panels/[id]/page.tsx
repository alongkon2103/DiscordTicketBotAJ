import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/guard'
import { readJson } from '@/lib/json-column'
import { emptyPayload, MessagePayloadSchema } from '@/lib/schema/message'
import type { PanelInput } from '@/lib/schema/panel'
import { BotNotReadyError, getGuild } from '@/lib/discord/bot'
import { getGuildResources, textualChannels, type ChannelOption } from '@/lib/discord/resources'
import { PageHeader } from '@/components/PageHeader'
import { PanelEditor } from './PanelEditor'
import styles from '@/components/editor.module.css'

export default async function PanelPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const panel = await prisma.panel.findUnique({
    where: { id },
    include: { items: { orderBy: [{ row: 'asc' }, { sortOrder: 'asc' }] } },
  })
  if (!panel) notFound()

  const ticketTypes = await prisma.ticketType.findMany({
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, name: true, emoji: true, enabled: true },
  })

  let channels: ChannelOption[] = []
  let botName = 'บอท'
  let botError: string | null = null

  try {
    const [resources, guild] = await Promise.all([getGuildResources(), getGuild()])
    channels = textualChannels(resources)
    botName = guild.client.user?.username ?? 'บอท'
  } catch (err) {
    botError = err instanceof BotNotReadyError ? err.message : 'อ่านข้อมูลเซิร์ฟเวอร์ไม่ได้'
  }

  const initial: PanelInput = {
    name: panel.name,
    channelId: panel.channelId,
    payload: readJson(panel.payload, MessagePayloadSchema, emptyPayload()),
    layout: panel.layout === 'select' ? 'select' : 'buttons',
    selectPlaceholder: panel.selectPlaceholder ?? '',
    items: panel.items.map((item) => ({
      id: item.id,
      ticketTypeId: item.ticketTypeId,
      label: item.label,
      emoji: item.emoji ?? '',
      style: (['primary', 'secondary', 'success', 'danger'] as const).includes(
        item.style as 'primary',
      )
        ? (item.style as 'primary' | 'secondary' | 'success' | 'danger')
        : 'secondary',
      row: item.row,
      description: item.description ?? '',
    })),
  }

  return (
    <>
      <PageHeader
        title={panel.name}
        lede={
          panel.messageId
            ? 'ส่งขึ้น Discord แล้ว — กดบันทึกเมื่อไหร่ ข้อความเดิมจะถูกแก้ให้อัตโนมัติ'
            : 'ยังไม่ได้ส่งขึ้น Discord — เลือกห้องปลายทางแล้วกด บันทึกและส่ง'
        }
      />

      {botError ? (
        <div className={styles.notice} style={{ marginBottom: 24 }}>
          {botError} — แก้ไขได้ แต่ส่งขึ้น Discord ไม่ได้จนกว่าบอทจะเชื่อมต่อสำเร็จ
        </div>
      ) : null}

      <PanelEditor
        id={panel.id}
        initial={initial}
        channels={channels}
        ticketTypes={ticketTypes}
        botName={botName}
        published={Boolean(panel.messageId)}
      />
    </>
  )
}
