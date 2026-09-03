import type { TranscriptMessage } from '@/lib/discord/ticket/transcript'
import styles from './transcript.module.css'

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif)$/i

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`

export function TranscriptView({ messages }: { messages: TranscriptMessage[] }) {
  if (messages.length === 0) {
    return <div className={styles.log}><div className={styles.empty}>ไม่มีข้อความในบันทึกนี้</div></div>
  }

  return (
    <div className={styles.log}>
      {messages.map((m) => (
        <div key={m.id} className={styles.msg}>
          {m.authorAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.avatar} src={m.authorAvatar} alt="" width={32} height={32} />
          ) : (
            <span className={styles.avatar} aria-hidden />
          )}

          <div className={styles.body}>
            <div className={styles.head}>
              <span className={styles.author}>{m.authorTag}</span>
              {m.isBot ? <span className={styles.botTag}>BOT</span> : null}
              <span className={styles.time}>
                {fmt(m.createdAt)}
                {m.editedAt ? ' · แก้ไขแล้ว' : ''}
              </span>
            </div>

            {m.content ? <div className={styles.content}>{m.content}</div> : null}

            {m.embeds
              .filter((e) => e.title || e.description)
              .map((e, i) => (
                <div key={i} className={styles.embed}>
                  {e.title ? <div className={styles.embedTitle}>{e.title}</div> : null}
                  {e.description ? <div className={styles.embedDesc}>{e.description}</div> : null}
                </div>
              ))}

            {m.attachments.length > 0 ? (
              <div className={styles.files}>
                {m.attachments.map((a) =>
                  IMAGE_EXT.test(a.name) ? (
                    <a key={a.url} href={a.url} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className={styles.thumb} src={a.url} alt={a.name} />
                    </a>
                  ) : (
                    <a key={a.url} className={styles.file} href={a.url} target="_blank" rel="noreferrer">
                      {a.name} · {formatSize(a.size)}
                    </a>
                  ),
                )}
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
