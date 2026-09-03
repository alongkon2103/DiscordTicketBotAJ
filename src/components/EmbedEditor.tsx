'use client'

import { LIMITS, type EmbedField, type MessagePayload } from '@/lib/schema/message'
import type { VariableDoc } from '@/lib/discord/template'
import { Field, NumberInput, TextArea, TextInput, Toggle } from './form'
import { ImageInput } from './ImageInput'
import styles from './embed-editor.module.css'

type Patch = (next: MessagePayload) => void

export function VariableList({ variables }: { variables: VariableDoc[] }) {
  return (
    <div className={styles.vars}>
      <div className={styles.varsHead}>ตัวแปรที่ใช้ได้</div>
      <div className={styles.varsList}>
        {variables.map((v) => (
          <button
            key={v.token}
            type="button"
            className={styles.varChip}
            title={v.description}
            onClick={() => void navigator.clipboard?.writeText(v.token)}
          >
            {v.token}
          </button>
        ))}
      </div>
      <p className={styles.varsHint}>
        คลิกเพื่อคัดลอก แล้ววางลงในช่องไหนก็ได้ ตัวแปรจะถูกแทนค่าตอนบอทส่งข้อความจริง
      </p>
    </div>
  )
}

export function EmbedEditor({
  value,
  onChange,
  contentLabel = 'ข้อความนอก embed',
  contentHint = 'ข้อความธรรมดาที่แสดงเหนือกล่อง embed — เว้นว่างได้ถ้าใช้แค่ embed',
}: {
  value: MessagePayload
  onChange: Patch
  contentLabel?: string
  contentHint?: string
}) {
  const e = value.embed
  const patchEmbed = (partial: Partial<MessagePayload['embed']>) =>
    onChange({ ...value, embed: { ...e, ...partial } })

  const patchField = (index: number, partial: Partial<EmbedField>) => {
    const fields = e.fields.map((f, i) => (i === index ? { ...f, ...partial } : f))
    patchEmbed({ fields })
  }

  const moveField = (index: number, delta: number) => {
    const target = index + delta
    const fields = [...e.fields]
    const a = fields[index]
    const b = fields[target]
    if (!a || !b) return
    fields[index] = b
    fields[target] = a
    patchEmbed({ fields })
  }

  return (
    <>
      <Field
        label={contentLabel}
        hint={contentHint}
        counter={{ current: value.content.length, max: LIMITS.content }}
      >
        <TextArea
          value={value.content}
          rows={3}
          placeholder="พิมพ์ข้อความที่นี่"
          onChange={(ev) => onChange({ ...value, content: ev.target.value })}
        />
      </Field>

      <div style={{ marginBottom: 20 }}>
        <Toggle
          checked={value.useEmbed}
          onChange={(v) => onChange({ ...value, useEmbed: v })}
          label="ใช้ embed"
          hint="กล่องข้อความมีแถบสีด้านซ้าย ใส่รูป หัวข้อ และหลายช่องได้"
        />
      </div>

      {value.useEmbed ? (
        <>
          <Field label="หัวข้อ" optional counter={{ current: e.title.length, max: LIMITS.embedTitle }}>
            <TextInput
              value={e.title}
              placeholder="เช่น เปิด Ticket ติดต่อทีมงาน"
              onChange={(ev) => patchEmbed({ title: ev.target.value })}
            />
          </Field>

          <Field
            label="เนื้อหา"
            optional
            hint="ขึ้นบรรทัดใหม่ได้ ใช้ **ตัวหนา** *ตัวเอียง* `โค้ด` ได้"
            counter={{ current: e.description.length, max: LIMITS.embedDescription }}
          >
            <TextArea
              value={e.description}
              rows={5}
              placeholder="อธิบายว่าปุ่มแต่ละอันใช้ทำอะไร"
              onChange={(ev) => patchEmbed({ description: ev.target.value })}
            />
          </Field>

          <div className={styles.grid2}>
            <Field label="สีแถบด้านซ้าย">
              <div className={styles.colorRow}>
                <input
                  type="color"
                  className={styles.swatch}
                  value={/^#[0-9a-fA-F]{6}$/.test(e.color) ? e.color : '#2b2d31'}
                  onChange={(ev) => patchEmbed({ color: ev.target.value })}
                  aria-label="เลือกสี"
                />
                <TextInput
                  mono
                  value={e.color}
                  placeholder="#e0a03c"
                  onChange={(ev) => patchEmbed({ color: ev.target.value })}
                />
              </div>
            </Field>

            <Field label="ลิงก์ของหัวข้อ" optional hint="ทำให้หัวข้อกดได้">
              <TextInput
                value={e.url}
                placeholder="https://..."
                onChange={(ev) => patchEmbed({ url: ev.target.value })}
              />
            </Field>

            <Field label="รูปใหญ่ด้านล่าง" optional>
              <ImageInput
                value={e.imageUrl}
                onChange={(next) => patchEmbed({ imageUrl: next })}
              />
            </Field>

            <Field label="รูปเล็กมุมขวา" optional>
              <ImageInput
                value={e.thumbnailUrl}
                onChange={(next) => patchEmbed({ thumbnailUrl: next })}
              />
            </Field>

            <Field label="ชื่อผู้เขียน (มุมบน)" optional>
              <TextInput
                value={e.authorName}
                onChange={(ev) => patchEmbed({ authorName: ev.target.value })}
              />
            </Field>

            <Field label="ไอคอนผู้เขียน" optional>
              <ImageInput
                value={e.authorIconUrl}
                onChange={(next) => patchEmbed({ authorIconUrl: next })}
              />
            </Field>

            <Field label="ข้อความท้าย" optional counter={{ current: e.footerText.length, max: LIMITS.embedFooter }}>
              <TextInput
                value={e.footerText}
                onChange={(ev) => patchEmbed({ footerText: ev.target.value })}
              />
            </Field>

            <Field label="ไอคอนท้าย" optional>
              <ImageInput
                value={e.footerIconUrl}
                onChange={(next) => patchEmbed({ footerIconUrl: next })}
              />
            </Field>
          </div>

          <div style={{ marginBottom: 20 }}>
            <Toggle
              checked={e.showTimestamp}
              onChange={(v) => patchEmbed({ showTimestamp: v })}
              label="แสดงเวลาที่ส่ง"
            />
          </div>

          <Field
            label={`ช่องข้อมูลใน embed (${e.fields.length}/${LIMITS.embedFields})`}
            hint="แต่ละช่องมีหัวข้อกับเนื้อหา ติ๊ก “เรียงแนวนอน” เพื่อให้ 3 ช่องอยู่บรรทัดเดียวกัน"
          >
            <div className={styles.embedFields}>
              {e.fields.map((field, index) => (
                <div key={index} className={styles.embedField}>
                  <div className={styles.embedFieldHead}>
                    <span className={styles.embedFieldTitle}>ช่องที่ {index + 1}</span>
                    <div className={styles.embedFieldActions}>
                      <label className={styles.inlineToggle}>
                        <input
                          type="checkbox"
                          checked={field.inline}
                          onChange={(ev) => patchField(index, { inline: ev.target.checked })}
                        />
                        เรียงแนวนอน
                      </label>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ height: 24, padding: '0 6px', fontSize: 12 }}
                        onClick={() => moveField(index, -1)}
                        disabled={index === 0}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ height: 24, padding: '0 6px', fontSize: 12 }}
                        onClick={() => moveField(index, 1)}
                        disabled={index === e.fields.length - 1}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        style={{ height: 24, padding: '0 8px', fontSize: 12 }}
                        onClick={() =>
                          patchEmbed({ fields: e.fields.filter((_, i) => i !== index) })
                        }
                      >
                        ลบ
                      </button>
                    </div>
                  </div>

                  <TextInput
                    value={field.name}
                    placeholder="หัวข้อของช่อง"
                    style={{ marginBottom: 8 }}
                    onChange={(ev) => patchField(index, { name: ev.target.value })}
                  />
                  <TextArea
                    value={field.value}
                    rows={2}
                    placeholder="เนื้อหาของช่อง"
                    onChange={(ev) => patchField(index, { value: ev.target.value })}
                  />
                </div>
              ))}

              <div className={styles.addRow}>
                <button
                  type="button"
                  className="btn"
                  disabled={e.fields.length >= LIMITS.embedFields}
                  onClick={() =>
                    patchEmbed({ fields: [...e.fields, { name: '', value: '', inline: false }] })
                  }
                >
                  เพิ่มช่อง
                </button>
              </div>
            </div>
          </Field>
        </>
      ) : null}
    </>
  )
}

export { NumberInput }
