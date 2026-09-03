'use client'

import { useState, useTransition } from 'react'
import { MEMBER_VARIABLES } from '@/lib/discord/template'
import type { ChannelOption, RoleOption } from '@/lib/discord/resources'
import type { AnnouncementInput, MentionMode } from '@/lib/announcements'
import type { MessagePayload } from '@/lib/schema/message'
import { DiscordPreview } from '@/components/DiscordPreview'
import { EmbedEditor, VariableList } from '@/components/EmbedEditor'
import { Field, OptionPicker, TextInput } from '@/components/form'
import styles from '@/components/editor.module.css'
import own from './announcement.module.css'
import { deleteAnnouncement, importAnnouncementFromLink, saveAnnouncement } from '../actions'

const MENTIONS: { value: MentionMode; label: string }[] = [
  { value: 'none', label: 'ไม่แท็กใคร' },
  { value: 'everyone', label: '@everyone' },
  { value: 'here', label: '@here' },
  { value: 'roles', label: 'เลือก role' },
]

/** input type="datetime-local" ใช้เวลาท้องถิ่นของเบราว์เซอร์ ไม่มี timezone ต่อท้าย */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromLocalInput(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

const PRESET_VARIABLES = MEMBER_VARIABLES.filter((v) => !v.token.startsWith('{user'))

export type DeliveryView = {
  channelId: string
  channelName: string
  status: string
  error: string | null
  sentAt: string | null
  messageUrl: string | null
}

export function AnnouncementEditor({
  id,
  initial,
  channels,
  roles,
  botName,
  status,
  sentAt,
  deliveries,
}: {
  id: string
  initial: AnnouncementInput
  channels: ChannelOption[]
  roles: RoleOption[]
  botName: string
  status: string
  sentAt: string | null
  deliveries: DeliveryView[]
}) {
  const [form, setForm] = useState<AnnouncementInput>(initial)
  const [errors, setErrors] = useState<string[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [link, setLink] = useState('')
  const [pending, startTransition] = useTransition()

  const patch = (partial: Partial<AnnouncementInput>) => {
    setForm((prev) => ({ ...prev, ...partial }))
    setNote(null)
  }

  const run = (action: 'save' | 'send' | 'schedule' | 'cancel') => {
    setErrors([])
    setNote(null)
    startTransition(async () => {
      const result = await saveAnnouncement(id, form, { action })
      if (result.ok) setNote(result.note ?? 'เรียบร้อย')
      else {
        setErrors(result.errors)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  }

  const send = () => {
    if (form.channelIds.length === 0) {
      setErrors(['ยังไม่ได้เลือกห้องที่จะส่ง'])
      return
    }

    const names = form.channelIds
      .map((cid) => `#${channels.find((c) => c.id === cid)?.name ?? cid}`)
      .join(', ')
    const who =
      form.mentionMode === 'everyone'
        ? 'พร้อมแท็ก @everyone (เตือนทุกคนในเซิร์ฟเวอร์ เรียกคืนไม่ได้)'
        : form.mentionMode === 'here'
          ? 'พร้อมแท็ก @here'
          : form.mentionMode === 'roles'
            ? `พร้อมแท็ก ${form.mentionRoleIds.length} role`
            : 'โดยไม่แท็กใคร'

    const verb = deliveries.some((d) => d.messageUrl) ? 'ส่ง/แก้ข้อความใน' : 'ส่งประกาศเข้า'
    if (!window.confirm(`${verb} ${form.channelIds.length} ห้อง (${names}) ${who} ใช่ไหม?`)) return
    run('send')
  }

  const importLink = () => {
    setErrors([])
    setNote(null)
    startTransition(async () => {
      const result = await importAnnouncementFromLink(id, link)
      if (result.ok) {
        setForm((prev) => ({
          ...prev,
          channelIds: prev.channelIds.includes(result.channelId)
            ? prev.channelIds
            : [...prev.channelIds, result.channelId],
          payload: result.payload,
        }))
        setLink('')
        setNote('ดึงข้อความเดิมมาแล้ว — แก้แล้วกด "ส่ง" เพื่ออัปเดตข้อความนั้น')
      } else {
        setErrors([result.error])
      }
    })
  }

  const remove = () => {
    if (!window.confirm('ลบประกาศนี้? ข้อความที่ส่งไปแล้วใน Discord จะไม่ถูกลบตาม')) return
    startTransition(async () => {
      await deleteAnnouncement(id)
    })
  }

  return (
    <>
      {errors.length > 0 ? (
        <div className={styles.errors}>
          <ul>
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {deliveries.length > 0 && status !== 'draft' ? (
        <div className={own.statusCard}>
          <div className={own.statusRow}>
            <span className={own.statusKey}>สถานะ</span>
            <span className={own.statusValue}>
              {status === 'sent'
                ? 'ส่งครบทุกห้องแล้ว'
                : status === 'partial'
                  ? 'ส่งได้บางห้อง'
                  : status === 'scheduled'
                    ? 'ตั้งเวลาไว้'
                    : 'ส่งไม่สำเร็จ'}
            </span>

            {sentAt ? (
              <>
                <span className={own.statusKey}>ส่งครั้งแรก</span>
                <span className={own.statusValue}>
                  {new Date(sentAt).toLocaleString('th-TH', {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </span>
              </>
            ) : null}
          </div>

          <div className={own.deliveryList}>
            {deliveries.map((d) => (
              <div key={d.channelId} className={own.delivery} data-status={d.status}>
                <span className={own.deliveryDot} data-status={d.status} aria-hidden />
                <span className={own.deliveryName}>#{d.channelName}</span>
                <span className={own.deliveryMeta}>
                  {d.status === 'sent'
                    ? 'ส่งแล้ว'
                    : d.status === 'failed'
                      ? (d.error ?? 'ส่งไม่สำเร็จ')
                      : 'ยังไม่ได้ส่ง'}
                </span>
                {d.messageUrl ? (
                  <a className={own.link} href={d.messageUrl} target="_blank" rel="noreferrer">
                    เปิด
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className={styles.layout}>
        <div>
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>ปลายทาง</h2>
            </div>

            <Field label="ชื่อประกาศ" hint="ใช้เรียกในหน้าเว็บเท่านั้น ไม่ได้ส่งขึ้น Discord">
              <TextInput value={form.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>

            <Field
              label={`ห้องที่จะส่ง (เลือกแล้ว ${form.channelIds.length} ห้อง)`}
              hint="เลือกได้หลายห้อง ข้อความเดียวกันจะถูกส่งไปทุกห้องที่ติ๊กไว้ และแก้ย้อนหลังได้ทีเดียวทุกห้อง"
            >
              <OptionPicker
                options={channels.map((c) => ({ id: c.id, name: `#${c.name}` }))}
                selected={form.channelIds}
                onToggle={(cid) =>
                  patch({
                    channelIds: form.channelIds.includes(cid)
                      ? form.channelIds.filter((v) => v !== cid)
                      : [...form.channelIds, cid],
                  })
                }
                emptyText="ไม่พบห้องที่บอทส่งข้อความได้"
              />
            </Field>

            <Field
              label="แท็กใคร"
              hint="มีผลเฉพาะตอนส่งครั้งแรก — Discord ไม่ให้แก้การแท็กย้อนหลัง"
            >
              <div className={own.mentionRow}>
                {MENTIONS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    className={own.mentionBtn}
                    data-active={form.mentionMode === m.value}
                    onClick={() => patch({ mentionMode: m.value })}
                  >
                    {m.label}
                  </button>
                ))}
              </div>

              {form.mentionMode === 'everyone' ? (
                <div className={own.warn}>
                  @everyone จะเด้งเตือนสมาชิกทุกคนในเซิร์ฟเวอร์ และเรียกคืนไม่ได้
                  บอทต้องมีสิทธิ์ Mention Everyone ในห้องนั้นด้วย
                </div>
              ) : null}

              {form.mentionMode === 'roles' ? (
                <OptionPicker
                  options={roles.map((r) => ({ id: r.id, name: r.name, color: r.color }))}
                  selected={form.mentionRoleIds}
                  onToggle={(rid) =>
                    patch({
                      mentionRoleIds: form.mentionRoleIds.includes(rid)
                        ? form.mentionRoleIds.filter((v) => v !== rid)
                        : [...form.mentionRoleIds, rid],
                    })
                  }
                />
              ) : null}
            </Field>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>เนื้อหา</h2>
            </div>
            <EmbedEditor
              value={form.payload}
              onChange={(payload: MessagePayload) => patch({ payload })}
            />
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>ตั้งเวลาส่ง</h2>
              <p className={styles.sectionLede}>
                เวลาตามเครื่องคุณ ระบบจะตรวจคิวทุก 30 วินาที — เครื่องต้องเปิดบอทค้างไว้ถึงเวลาถึงจะส่ง
              </p>
            </div>

            <Field
              label="วันเวลาที่จะส่ง"
              optional
              hint={
                form.scheduledAt
                  ? `จะส่งประมาณ ${new Date(form.scheduledAt).toLocaleString('th-TH', { dateStyle: 'full', timeStyle: 'short' })}`
                  : 'เว้นว่างไว้ถ้าจะกดส่งเอง'
              }
            >
              <input
                type="datetime-local"
                className="mono"
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 11px',
                  border: '1px solid var(--line-strong)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--bg-inset)',
                  color: 'var(--text)',
                  font: 'inherit',
                  fontSize: 14,
                }}
                value={toLocalInput(form.scheduledAt)}
                onChange={(e) => patch({ scheduledAt: fromLocalInput(e.target.value) })}
              />
            </Field>
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>แก้ข้อความเก่าของบอท</h2>
              <p className={styles.sectionLede}>
                คลิกขวาที่ข้อความใน Discord → Copy Message Link แล้ววางที่นี่
                ระบบจะดึงเนื้อหามาให้แก้ กดส่งแล้วจะไปแก้ข้อความนั้นเลย
              </p>
            </div>

            <div className={own.importRow}>
              <TextInput
                value={link}
                placeholder="https://discord.com/channels/..."
                onChange={(e) => setLink(e.target.value)}
              />
              <button
                type="button"
                className="btn"
                onClick={importLink}
                disabled={pending || !link.trim()}
              >
                ดึงมาแก้
              </button>
            </div>
          </section>
        </div>

        <aside className={styles.side}>
          <div className={styles.sideHead}>ตัวอย่างที่จะเห็นใน Discord</div>
          <DiscordPreview payload={form.payload} botName={botName} />
          <div style={{ marginTop: 20 }}>
            <VariableList variables={PRESET_VARIABLES} />
          </div>
        </aside>
      </div>

      <div className={styles.bar}>
        <button type="button" className="btn btn-primary" onClick={send} disabled={pending}>
          {pending
            ? 'กำลังทำงาน...'
            : deliveries.some((d) => d.messageUrl)
              ? 'ส่งการแก้ไข'
              : 'ส่งเลย'}
        </button>

        <button type="button" className="btn" onClick={() => run('save')} disabled={pending}>
          บันทึกร่าง
        </button>

        {status === 'scheduled' ? (
          <button type="button" className="btn" onClick={() => run('cancel')} disabled={pending}>
            ยกเลิกการตั้งเวลา
          </button>
        ) : (
          <button
            type="button"
            className="btn"
            onClick={() => run('schedule')}
            disabled={pending || !form.scheduledAt}
            title={form.scheduledAt ? undefined : 'เลือกวันเวลาก่อน'}
          >
            ตั้งเวลาส่ง
          </button>
        )}

        <button type="button" className="btn btn-danger" onClick={remove} disabled={pending}>
          ลบ
        </button>

        <span className={styles.barSpacer} />
        {note ? (
          <span className={styles.status} data-tone="ok">
            {note}
          </span>
        ) : errors.length > 0 ? (
          <span className={styles.status} data-tone="error">
            ยังทำไม่ได้ — ดูรายละเอียดด้านบน
          </span>
        ) : null}
      </div>
    </>
  )
}
