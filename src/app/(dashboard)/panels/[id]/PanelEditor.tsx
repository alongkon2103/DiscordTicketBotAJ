'use client'

import { useState, useTransition } from 'react'
import type { ChannelOption } from '@/lib/discord/resources'
import type { MessagePayload } from '@/lib/schema/message'
import type { PanelInput, PanelItemInput } from '@/lib/schema/panel'
import { DiscordPreview, type PreviewButton } from '@/components/DiscordPreview'
import { EmbedEditor } from '@/components/EmbedEditor'
import { Field, NumberInput, Select, TextInput } from '@/components/form'
import styles from '@/components/editor.module.css'
import itemStyles from '@/components/modal-fields.module.css'
import { deletePanel, savePanel } from '../actions'

type TicketTypeOption = { id: string; name: string; emoji: string | null; enabled: boolean }

const STYLE_OPTIONS = [
  { value: 'primary', label: 'น้ำเงิน' },
  { value: 'secondary', label: 'เทา' },
  { value: 'success', label: 'เขียว' },
  { value: 'danger', label: 'แดง' },
]

function Section({
  title,
  lede,
  children,
}: {
  title: string
  lede?: string
  children: React.ReactNode
}) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>{title}</h2>
        {lede ? <p className={styles.sectionLede}>{lede}</p> : null}
      </div>
      {children}
    </section>
  )
}

export function PanelEditor({
  id,
  initial,
  channels,
  ticketTypes,
  botName,
  published,
}: {
  id: string
  initial: PanelInput
  channels: ChannelOption[]
  ticketTypes: TicketTypeOption[]
  botName: string
  published: boolean
}) {
  const [form, setForm] = useState<PanelInput>(initial)
  const [errors, setErrors] = useState<string[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const patch = (partial: Partial<PanelInput>) => {
    setForm((prev) => ({ ...prev, ...partial }))
    setNote(null)
  }

  const patchItem = (index: number, partial: Partial<PanelItemInput>) =>
    patch({ items: form.items.map((it, i) => (i === index ? { ...it, ...partial } : it)) })

  const moveItem = (index: number, delta: number) => {
    const target = index + delta
    const next = [...form.items]
    const a = next[index]
    const b = next[target]
    if (!a || !b) return
    next[index] = b
    next[target] = a
    patch({ items: next })
  }

  const addItem = () => {
    const used = new Set(form.items.map((i) => i.ticketTypeId))
    const available = ticketTypes.find((t) => !used.has(t.id))
    if (!available) return

    patch({
      items: [
        ...form.items,
        {
          ticketTypeId: available.id,
          label: available.name,
          emoji: available.emoji ?? '',
          style: 'secondary',
          row: 0,
          description: '',
        },
      ],
    })
  }

  const run = (options: { publish?: boolean; forceNew?: boolean }) => {
    setErrors([])
    setNote(null)
    startTransition(async () => {
      const result = await savePanel(id, form, options)
      if (result.ok) {
        setNote(result.note ?? 'บันทึกแล้ว')
      } else {
        setErrors(result.errors)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  }

  const remove = () => {
    if (!window.confirm(`ลบ "${form.name}" ใช่ไหม? ข้อความที่ส่งไปแล้วใน Discord จะไม่ถูกลบตาม`)) return
    startTransition(async () => {
      await deletePanel(id)
    })
  }

  const previewButtons: PreviewButton[] = form.items.map((item) => ({
    label: item.label,
    emoji: item.emoji || undefined,
    style: item.style,
    row: form.layout === 'select' ? 0 : item.row,
  }))

  const allUsed = form.items.length >= ticketTypes.length

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

      <div className={styles.layout}>
        <div>
          <Section title="ปลายทาง">
            <Field label="ชื่อ Panel" hint="ใช้เรียกในหน้าเว็บเท่านั้น ไม่ได้ส่งขึ้น Discord">
              <TextInput value={form.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>

            <Field
              label="ห้องที่จะส่งไป"
              hint={
                published
                  ? 'เปลี่ยนห้องแล้วต้องกด "ส่งเป็นข้อความใหม่" ข้อความเดิมในห้องเก่าจะยังอยู่'
                  : undefined
              }
            >
              <Select
                value={form.channelId ?? ''}
                options={[
                  { value: '', label: 'ยังไม่เลือก' },
                  ...channels.map((c) => ({ value: c.id, label: `#${c.name}` })),
                ]}
                onChange={(e) => patch({ channelId: e.target.value || null })}
              />
            </Field>
          </Section>

          <Section title="ข้อความของ Panel">
            <EmbedEditor
              value={form.payload}
              onChange={(payload: MessagePayload) => patch({ payload })}
              contentHint="ข้อความธรรมดาเหนือกล่อง embed — เว้นว่างได้"
            />
          </Section>

          <Section
            title="ตัวเลือกให้กด"
            lede="แต่ละอันผูกกับประเภท Ticket หนึ่งประเภท กดแล้วจะเปิดฟอร์มของประเภทนั้น"
          >
            <Field
              label="รูปแบบ"
              hint={
                form.layout === 'buttons'
                  ? 'ปุ่มเห็นชัดกว่า — Discord ให้ 5 แถว แถวละ 5 ปุ่ม'
                  : 'dropdown ประหยัดพื้นที่เมื่อมีหลายประเภท — ใส่ได้ถึง 25 ตัวเลือก'
              }
            >
              <Select
                value={form.layout}
                options={[
                  { value: 'buttons', label: 'ปุ่ม' },
                  { value: 'select', label: 'dropdown' },
                ]}
                onChange={(e) => patch({ layout: e.target.value as 'buttons' | 'select' })}
              />
            </Field>

            {form.layout === 'select' ? (
              <Field label="ข้อความใน dropdown" optional>
                <TextInput
                  value={form.selectPlaceholder}
                  placeholder="เลือกเรื่องที่ต้องการติดต่อ"
                  onChange={(e) => patch({ selectPlaceholder: e.target.value })}
                />
              </Field>
            ) : null}

            {ticketTypes.length === 0 ? (
              <div className={itemStyles.empty}>
                ยังไม่มีประเภท Ticket ให้เลือก — สร้างที่หน้า “ประเภท Ticket” ก่อน
              </div>
            ) : form.items.length === 0 ? (
              <div className={itemStyles.empty}>ยังไม่มีตัวเลือก — กดเพิ่มด้านล่าง</div>
            ) : (
              <div className={itemStyles.list}>
                {form.items.map((item, index) => {
                  const type = ticketTypes.find((t) => t.id === item.ticketTypeId)
                  return (
                    <div key={item.id ?? `new-${index}`} className={itemStyles.card}>
                      <div className={itemStyles.head}>
                        <span className={itemStyles.index}>{index + 1}</span>
                        <span className={itemStyles.headTitle}>{item.label || 'ยังไม่ได้ตั้งชื่อ'}</span>
                        {type && !type.enabled ? (
                          <span className={itemStyles.headKind}>ประเภทปิดอยู่</span>
                        ) : null}
                        <div className={itemStyles.headActions}>
                          <button
                            type="button"
                            className={itemStyles.iconBtn}
                            onClick={() => moveItem(index, -1)}
                            disabled={index === 0}
                            aria-label="เลื่อนขึ้น"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className={itemStyles.iconBtn}
                            onClick={() => moveItem(index, 1)}
                            disabled={index === form.items.length - 1}
                            aria-label="เลื่อนลง"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className={itemStyles.iconBtn}
                            onClick={() => patch({ items: form.items.filter((_, i) => i !== index) })}
                            aria-label="ลบ"
                          >
                            ✕
                          </button>
                        </div>
                      </div>

                      <div className={itemStyles.body}>
                        <Field label="ประเภท Ticket ที่จะเปิด">
                          <Select
                            value={item.ticketTypeId}
                            options={ticketTypes.map((t) => ({
                              value: t.id,
                              label: t.enabled ? t.name : `${t.name} (ปิดอยู่)`,
                            }))}
                            onChange={(e) => patchItem(index, { ticketTypeId: e.target.value })}
                          />
                        </Field>

                        <div className={itemStyles.grid2}>
                          <Field label="ข้อความที่แสดง" counter={{ current: item.label.length, max: 80 }}>
                            <TextInput
                              value={item.label}
                              onChange={(e) => patchItem(index, { label: e.target.value })}
                            />
                          </Field>
                          <Field label="อีโมจิ" optional>
                            <TextInput
                              value={item.emoji}
                              placeholder="🛒"
                              onChange={(e) => patchItem(index, { emoji: e.target.value })}
                            />
                          </Field>
                        </div>

                        {form.layout === 'buttons' ? (
                          <div className={itemStyles.grid2}>
                            <Field label="สีปุ่ม">
                              <Select
                                value={item.style}
                                options={STYLE_OPTIONS}
                                onChange={(e) =>
                                  patchItem(index, {
                                    style: e.target.value as PanelItemInput['style'],
                                  })
                                }
                              />
                            </Field>
                            <Field label="อยู่แถวที่" hint="เริ่มจาก 1 — แถวละไม่เกิน 5 ปุ่ม">
                              <NumberInput
                                value={item.row + 1}
                                min={1}
                                max={5}
                                onValueChange={(v) =>
                                  patchItem(index, { row: Math.min(4, Math.max(0, v - 1)) })
                                }
                              />
                            </Field>
                          </div>
                        ) : (
                          <Field
                            label="คำอธิบายใต้ตัวเลือก"
                            optional
                            counter={{ current: item.description.length, max: 100 }}
                          >
                            <TextInput
                              value={item.description}
                              onChange={(e) => patchItem(index, { description: e.target.value })}
                            />
                          </Field>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn"
                onClick={addItem}
                disabled={ticketTypes.length === 0 || allUsed}
              >
                เพิ่มตัวเลือก
              </button>
              {allUsed && ticketTypes.length > 0 ? (
                <p className={itemStyles.limitNote}>ใส่ครบทุกประเภทที่มีแล้ว</p>
              ) : null}
            </div>
          </Section>
        </div>

        <aside className={styles.side}>
          <div className={styles.sideHead}>ตัวอย่างที่จะเห็นใน Discord</div>
          <DiscordPreview
            payload={form.payload}
            botName={botName}
            buttons={previewButtons}
            layout={form.layout}
            selectPlaceholder={form.selectPlaceholder}
          />
        </aside>
      </div>

      <div className={styles.bar}>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => run({ publish: !published })}
          disabled={pending}
        >
          {pending ? 'กำลังบันทึก...' : published ? 'บันทึก' : 'บันทึกและส่ง'}
        </button>

        {published ? (
          <button
            type="button"
            className="btn"
            onClick={() => {
              if (window.confirm('ส่งเป็นข้อความใหม่? ข้อความเดิมจะยังค้างอยู่ในห้อง ต้องไปลบเอง')) {
                run({ publish: true, forceNew: true })
              }
            }}
            disabled={pending}
          >
            ส่งเป็นข้อความใหม่
          </button>
        ) : null}

        <button type="button" className="btn btn-danger" onClick={remove} disabled={pending}>
          ลบ Panel
        </button>

        <span className={styles.barSpacer} />
        {note ? (
          <span className={styles.status} data-tone="ok">
            {note}
          </span>
        ) : errors.length > 0 ? (
          <span className={styles.status} data-tone="error">
            ยังบันทึกไม่ได้ — ดูรายละเอียดด้านบน
          </span>
        ) : null}
      </div>
    </>
  )
}
