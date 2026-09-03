import { AttachmentBuilder, type TextBasedChannel } from 'discord.js'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'

/** กันห้องที่คุยกันยาวมากจนดึงไม่จบ */
const MAX_MESSAGES = 5000
const PAGE_SIZE = 100

export const TranscriptMessageSchema = z.object({
  id: z.string(),
  authorId: z.string(),
  authorTag: z.string(),
  authorAvatar: z.string().nullable(),
  isBot: z.boolean(),
  content: z.string(),
  createdAt: z.string(),
  editedAt: z.string().nullable(),
  attachments: z.array(z.object({ name: z.string(), url: z.string(), size: z.number() })),
  embeds: z.array(z.object({ title: z.string(), description: z.string() })),
})

export const TranscriptSchema = z.array(TranscriptMessageSchema)
export type TranscriptMessage = z.infer<typeof TranscriptMessageSchema>

/** ดึงข้อความทั้งห้องเรียงจากเก่าไปใหม่ */
export async function collectMessages(channel: TextBasedChannel): Promise<TranscriptMessage[]> {
  const collected: TranscriptMessage[] = []
  let before: string | undefined

  while (collected.length < MAX_MESSAGES) {
    const batch = await channel.messages.fetch({ limit: PAGE_SIZE, before })
    if (batch.size === 0) break

    for (const message of batch.values()) {
      collected.push({
        id: message.id,
        authorId: message.author.id,
        authorTag: message.author.tag,
        authorAvatar: message.author.displayAvatarURL({ size: 64 }),
        isBot: message.author.bot,
        content: message.content,
        createdAt: message.createdAt.toISOString(),
        editedAt: message.editedAt?.toISOString() ?? null,
        attachments: [...message.attachments.values()].map((a) => ({
          name: a.name,
          url: a.url,
          size: a.size,
        })),
        embeds: message.embeds.map((e) => ({
          title: e.title ?? '',
          description: e.description ?? '',
        })),
      })
    }

    before = batch.last()?.id
    if (!before || batch.size < PAGE_SIZE) break
  }

  return collected.reverse()
}

export async function saveTranscript(
  ticketId: string,
  messages: TranscriptMessage[],
): Promise<void> {
  await prisma.ticketTranscript.upsert({
    where: { ticketId },
    create: { ticketId, messages: JSON.stringify(messages), messageCount: messages.length },
    update: { messages: JSON.stringify(messages), messageCount: messages.length },
  })
}

const escapeHtml = (input: string) =>
  input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)$/i

export function renderTranscriptHtml(meta: {
  number: number
  typeName: string
  openerTag: string
  openedAt: Date
  closedAt: Date | null
  closedByTag: string | null
  messages: TranscriptMessage[]
}): string {
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString('th-TH', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  const body = meta.messages
    .map((m) => {
      const attachments = m.attachments
        .map((a) =>
          IMAGE_EXT.test(a.name)
            ? `<a class="att" href="${escapeHtml(a.url)}" target="_blank" rel="noreferrer"><img src="${escapeHtml(a.url)}" alt="${escapeHtml(a.name)}"></a>`
            : `<a class="file" href="${escapeHtml(a.url)}" target="_blank" rel="noreferrer">${escapeHtml(a.name)} · ${formatSize(a.size)}</a>`,
        )
        .join('')

      const embeds = m.embeds
        .filter((e) => e.title || e.description)
        .map(
          (e) =>
            `<div class="embed">${e.title ? `<div class="embed-title">${escapeHtml(e.title)}</div>` : ''}${e.description ? `<div class="embed-desc">${escapeHtml(e.description)}</div>` : ''}</div>`,
        )
        .join('')

      const avatar = m.authorAvatar
        ? `<img class="avatar" src="${escapeHtml(m.authorAvatar)}" alt="">`
        : `<span class="avatar"></span>`

      return `<div class="msg">
  ${avatar}
  <div class="msg-body">
    <div class="msg-head">
      <span class="author">${escapeHtml(m.authorTag)}</span>
      ${m.isBot ? '<span class="tag">BOT</span>' : ''}
      <span class="time">${fmt(m.createdAt)}${m.editedAt ? ' · แก้ไขแล้ว' : ''}</span>
    </div>
    ${m.content ? `<div class="content">${escapeHtml(m.content)}</div>` : ''}
    ${embeds}
    ${attachments}
  </div>
</div>`
    })
    .join('\n')

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ticket #${meta.number} — ${escapeHtml(meta.typeName)}</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#0a0a0b; color:#eceded;
    font-family:"IBM Plex Sans Thai","Noto Sans Thai",ui-sans-serif,system-ui,sans-serif;
    font-size:15px; line-height:1.7; }
  .wrap { max-width:860px; margin:0 auto; padding:40px 24px 80px; }
  header { border-bottom:1px solid #1c1d20; padding-bottom:20px; margin-bottom:28px; }
  h1 { margin:0 0 10px; font-size:20px; font-weight:600; }
  .meta { display:grid; grid-template-columns:120px 1fr; gap:2px 16px; font-size:13px; color:#8b8d94; }
  .meta b { color:#5c5e66; font-weight:400; }
  .msg { display:flex; gap:12px; padding:9px 0; }
  .avatar { width:34px; height:34px; border-radius:50%; flex:none; background:#1c1d20; object-fit:cover; }
  .msg-body { min-width:0; flex:1; }
  .msg-head { display:flex; align-items:baseline; gap:8px; flex-wrap:wrap; }
  .author { font-weight:600; font-size:14px; }
  .tag { font-size:10px; letter-spacing:.06em; background:#46340f; color:#e0a03c;
    padding:1px 5px; border-radius:3px; }
  .time { font-size:11px; color:#5c5e66; font-family:ui-monospace,monospace; }
  .content { white-space:pre-wrap; word-break:break-word; }
  .embed { border-left:3px solid #2a2b30; background:#0f0f11; padding:10px 14px;
    border-radius:4px; margin-top:6px; }
  .embed-title { font-weight:600; margin-bottom:3px; }
  .embed-desc { white-space:pre-wrap; color:#b6b7bb; font-size:14px; }
  .att { display:block; margin-top:8px; }
  .att img { max-width:400px; max-height:300px; border-radius:5px; border:1px solid #1c1d20; }
  .file { display:inline-block; margin-top:8px; padding:8px 12px; border:1px solid #2a2b30;
    border-radius:5px; color:#e0a03c; text-decoration:none; font-size:13px; }
  .empty { color:#5c5e66; font-style:italic; }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <h1>Ticket #${meta.number} — ${escapeHtml(meta.typeName)}</h1>
    <div class="meta">
      <b>เปิดโดย</b><span>${escapeHtml(meta.openerTag)}</span>
      <b>เปิดเมื่อ</b><span>${fmt(meta.openedAt.toISOString())}</span>
      <b>ปิดเมื่อ</b><span>${meta.closedAt ? fmt(meta.closedAt.toISOString()) : '—'}</span>
      <b>ปิดโดย</b><span>${meta.closedByTag ? escapeHtml(meta.closedByTag) : '—'}</span>
      <b>จำนวนข้อความ</b><span>${meta.messages.length}</span>
    </div>
  </header>
  ${body || '<p class="empty">ไม่มีข้อความในห้องนี้</p>'}
</div>
</body>
</html>`
}

export function transcriptAttachment(html: string, number: number): AttachmentBuilder {
  return new AttachmentBuilder(Buffer.from(html, 'utf8'), {
    name: `ticket-${String(number).padStart(4, '0')}.html`,
  })
}
