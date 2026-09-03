'use client'

import { Fragment, type ReactNode } from 'react'
import { isEmbedEmpty, type MessagePayload } from '@/lib/schema/message'
import { isUploadValue, uploadSrc } from './ImageInput'
import styles from './discord-preview.module.css'

export type PreviewButton = {
  label: string
  emoji?: string
  style: 'primary' | 'secondary' | 'success' | 'danger'
  row: number
}

/**
 * แปลง markdown ที่ Discord รองรับแบบพื้นฐาน + เน้นตัวแปร {xxx} ให้เห็นชัด
 * ไม่ได้ทำครบทุก syntax — แค่พอให้ตัดสินใจหน้าตาได้
 */
function renderInline(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|~~[^~]+~~|\{[a-zA-Z0-9_.]+\})/g
  const parts = text.split(pattern).filter((p) => p !== '')

  return parts.map((part, i) => {
    const key = `${i}-${part.slice(0, 8)}`
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={key}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('~~') && part.endsWith('~~')) {
      return <s key={key}>{part.slice(2, -2)}</s>
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return <em key={key}>{part.slice(1, -1)}</em>
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return <code key={key}>{part.slice(1, -1)}</code>
    }
    if (part.startsWith('{') && part.endsWith('}')) {
      return (
        <span key={key} className={styles.token}>
          {part}
        </span>
      )
    }
    return <Fragment key={key}>{part}</Fragment>
  })
}

/** รูปที่อัปโหลดไว้เสิร์ฟจาก /uploads ส่วนที่เหลือต้องเป็น URL เต็ม */
const isImage = (url: string) => {
  const value = url.trim()
  return isUploadValue(value) || /^https?:\/\//i.test(value)
}
const imageSrc = (url: string) => uploadSrc(url.trim())

export function DiscordPreview({
  payload,
  botName = 'บอท',
  buttons = [],
  selectPlaceholder,
  layout = 'buttons',
}: {
  payload: MessagePayload
  botName?: string
  buttons?: PreviewButton[]
  selectPlaceholder?: string
  layout?: 'buttons' | 'select'
}) {
  const e = payload.embed
  const showEmbed = payload.useEmbed && !isEmbedEmpty(e)
  const hasContent = payload.content.trim().length > 0

  const rows = new Map<number, PreviewButton[]>()
  for (const b of buttons) {
    rows.set(b.row, [...(rows.get(b.row) ?? []), b])
  }

  if (!hasContent && !showEmbed && buttons.length === 0) {
    return (
      <div className={styles.frame}>
        <div className={styles.empty}>ยังไม่มีอะไรให้แสดง — ใส่ข้อความหรือเปิด embed ก่อน</div>
      </div>
    )
  }

  return (
    <div className={styles.frame}>
      <div className={styles.row}>
        <div className={styles.avatar} aria-hidden>
          {botName.slice(0, 1).toUpperCase()}
        </div>

        <div className={styles.body}>
          <div className={styles.head}>
            <span className={styles.name}>{botName}</span>
            <span className={styles.botTag}>APP</span>
            <span className={styles.time}>วันนี้ 00:00</span>
          </div>

          {hasContent ? <div className={styles.content}>{renderInline(payload.content)}</div> : null}

          {showEmbed ? (
            <div className={styles.embed} style={{ borderLeftColor: e.color || '#4f545c' }}>
              <div className={styles.embedMain}>
                {e.authorName ? (
                  <div className={styles.author}>
                    {isImage(e.authorIconUrl) ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className={styles.authorIcon} src={imageSrc(e.authorIconUrl)} alt="" />
                    ) : null}
                    <span className={styles.authorName}>{renderInline(e.authorName)}</span>
                  </div>
                ) : null}

                {e.title ? (
                  <div className={styles.title} data-link={Boolean(e.url)}>
                    {renderInline(e.title)}
                  </div>
                ) : null}

                {e.description ? (
                  <div className={styles.description}>{renderInline(e.description)}</div>
                ) : null}

                {e.fields.length > 0 ? (
                  <div className={styles.fields}>
                    {e.fields
                      .filter((f) => f.name || f.value)
                      .map((f, i) => (
                        <div key={i} className={styles.fieldItem} data-inline={f.inline}>
                          <div className={styles.fieldName}>{renderInline(f.name)}</div>
                          <div className={styles.fieldValue}>{renderInline(f.value)}</div>
                        </div>
                      ))}
                  </div>
                ) : null}
              </div>

              {isImage(e.thumbnailUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.thumb} src={imageSrc(e.thumbnailUrl)} alt="" />
              ) : (
                <span />
              )}

              {isImage(e.imageUrl) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img className={styles.image} src={imageSrc(e.imageUrl)} alt="" />
              ) : null}

              {e.footerText || e.showTimestamp ? (
                <div className={styles.footer}>
                  {isImage(e.footerIconUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className={styles.footerIcon} src={imageSrc(e.footerIconUrl)} alt="" />
                  ) : null}
                  <span>
                    {e.footerText}
                    {e.footerText && e.showTimestamp ? ' • ' : ''}
                    {e.showTimestamp ? 'วันนี้ 00:00' : ''}
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}

          {layout === 'select' && buttons.length > 0 ? (
            <div className={styles.selectMenu}>
              <span>{selectPlaceholder || 'เลือกเรื่องที่ต้องการติดต่อ'}</span>
              <span aria-hidden>▾</span>
            </div>
          ) : null}

          {layout === 'buttons'
            ? [...rows.keys()]
                .sort((a, b) => a - b)
                .map((row) => (
                  <div key={row} className={styles.buttons}>
                    {(rows.get(row) ?? []).map((b, i) => (
                      <span key={i} className={styles.btn} data-style={b.style}>
                        {b.emoji ? <span>{b.emoji}</span> : null}
                        {b.label}
                      </span>
                    ))}
                  </div>
                ))
            : null}
        </div>
      </div>
    </div>
  )
}
