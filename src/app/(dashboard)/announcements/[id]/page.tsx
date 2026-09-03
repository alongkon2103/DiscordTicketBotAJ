import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { requireAdmin } from '@/lib/auth/guard'
import { readIdList, readJson } from '@/lib/json-column'
import { emptyPayload, MessagePayloadSchema } from '@/lib/schema/message'
import { MENTION_MODES, type AnnouncementInput, type MentionMode } from '@/lib/announcements'
import { env } from '@/lib/env'
import { BotNotReadyError, getGuild } from '@/lib/discord/bot'
import {
  getGuildResources,
  textualChannels,
  type ChannelOption,
  type RoleOption,
} from '@/lib/discord/resources'
import { PageHeader } from '@/components/PageHeader'
import { AnnouncementEditor } from './AnnouncementEditor'
import styles from '@/components/editor.module.css'

export default async function AnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin()
  const { id } = await params

  const row = await prisma.announcement.findUnique({
    where: { id },
    include: { deliveries: { orderBy: { channelId: 'asc' } } },
  })
  if (!row) notFound()

  let channels: ChannelOption[] = []
  let roles: RoleOption[] = []
  let botName = 'บอท'
  let botError: string | null = null

  try {
    const [resources, guild] = await Promise.all([getGuildResources(), getGuild()])
    channels = textualChannels(resources)
    roles = resources.roles
    botName = guild.client.user?.username ?? 'บอท'
  } catch (err) {
    botError = err instanceof BotNotReadyError ? err.message : 'อ่านข้อมูลเซิร์ฟเวอร์ไม่ได้'
  }

  const mentionMode = (MENTION_MODES as readonly string[]).includes(row.mentionMode)
    ? (row.mentionMode as MentionMode)
    : 'none'

  const initial: AnnouncementInput = {
    name: row.name,
    channelIds: row.deliveries.map((d) => d.channelId),
    payload: readJson(row.payload, MessagePayloadSchema, emptyPayload()),
    mentionMode,
    mentionRoleIds: readIdList(row.mentionRoleIds),
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
  }

  const channelName = new Map(channels.map((c) => [c.id, c.name]))

  const deliveries = row.deliveries.map((d) => ({
    channelId: d.channelId,
    channelName: channelName.get(d.channelId) ?? d.channelId,
    status: d.status,
    error: d.error,
    sentAt: d.sentAt?.toISOString() ?? null,
    messageUrl: d.messageId
      ? `https://discord.com/channels/${env.GUILD_ID}/${d.channelId}/${d.messageId}`
      : null,
  }))

  return (
    <>
      <PageHeader
        title={row.name || 'ประกาศ'}
        lede={
          deliveries.some((d) => d.messageUrl)
            ? 'ส่งขึ้น Discord แล้ว — กดส่งอีกครั้งจะเป็นการแก้ข้อความเดิมในทุกห้อง ไม่ได้ส่งซ้ำ'
            : 'ยังไม่ได้ส่ง — เลือกห้อง (เลือกได้หลายห้อง) เขียนข้อความ แล้วส่งเลยหรือตั้งเวลาไว้ก็ได้'
        }
      />

      {botError ? (
        <div className={styles.notice} style={{ marginBottom: 24 }}>
          {botError} — แก้ไขได้ แต่ส่งขึ้น Discord ไม่ได้จนกว่าบอทจะเชื่อมต่อสำเร็จ
        </div>
      ) : null}

      <AnnouncementEditor
        id={row.id}
        initial={initial}
        channels={channels}
        roles={roles}
        botName={botName}
        status={row.status}
        sentAt={row.sentAt?.toISOString() ?? null}
        deliveries={deliveries}
      />
    </>
  )
}
