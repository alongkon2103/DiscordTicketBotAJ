'use client'

import {
  EMPTY_CONFIG,
  FIELD_KINDS,
  FIELD_KIND_HINT,
  FIELD_KIND_LABEL,
  MAX_MODAL_FIELDS,
  slugifyKey,
  type FieldKind,
  type SelectOption,
} from '@/lib/schema/modal-field'
import type { ModalFieldInput } from '@/lib/schema/ticket-type'
import { Field, NumberInput, Select, TextArea, TextInput, Toggle } from './form'
import styles from './modal-fields.module.css'

type Cfg = Record<string, unknown>

const CHANNEL_TYPES = [
  { value: 'text', label: 'ห้องแชท' },
  { value: 'voice', label: 'ห้องเสียง' },
  { value: 'category', label: 'หมวด' },
  { value: 'forum', label: 'ฟอรัม' },
  { value: 'announcement', label: 'ประกาศ' },
] as const

const usesOptions = (kind: FieldKind) => kind === 'select' || kind === 'radio' || kind === 'checkbox'
const usesMinMax = (kind: FieldKind) =>
  kind === 'select' || kind === 'checkbox' || kind === 'user' || kind === 'role' ||
  kind === 'channel' || kind === 'mentionable'
const usesPlaceholder = (kind: FieldKind) =>
  kind === 'select' || kind === 'user' || kind === 'role' || kind === 'channel' || kind === 'mentionable'

function OptionsEditor({
  options,
  onChange,
}: {
  options: SelectOption[]
  onChange: (next: SelectOption[]) => void
}) {
  const patch = (index: number, partial: Partial<SelectOption>) =>
    onChange(options.map((o, i) => (i === index ? { ...o, ...partial } : o)))

  return (
    <div className={styles.options}>
      {options.map((option, index) => (
        <div key={index} className={styles.option}>
          <div className={styles.optionHead}>
            <span className={styles.optionIndex}>ตัวเลือกที่ {index + 1}</span>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ height: 24, padding: '0 8px', fontSize: 12 }}
              disabled={options.length <= 1}
              onClick={() => onChange(options.filter((_, i) => i !== index))}
            >
              ลบ
            </button>
          </div>

          <div className={styles.optionGrid}>
            <TextInput
              value={option.label}
              placeholder="ข้อความที่ผู้ใช้เห็น"
              onChange={(e) => {
                const label = e.target.value
                // ค่าที่เก็บควรตามชื่อไปเองจนกว่าผู้ใช้จะแก้เอง
                const shouldSync = !option.value || option.value === slugifyKey(option.label)
                patch(index, { label, ...(shouldSync ? { value: slugifyKey(label) } : {}) })
              }}
            />
            <TextInput
              mono
              value={option.value}
              placeholder="ค่าที่เก็บ"
              onChange={(e) => patch(index, { value: slugifyKey(e.target.value) })}
            />
            <TextInput
              value={option.description}
              placeholder="คำอธิบายใต้ตัวเลือก (ไม่บังคับ)"
              onChange={(e) => patch(index, { description: e.target.value })}
            />
            <TextInput
              value={option.emoji}
              placeholder="อีโมจิ (ไม่บังคับ)"
              onChange={(e) => patch(index, { emoji: e.target.value })}
            />
          </div>
        </div>
      ))}

      <div className={styles.addRow}>
        <button
          type="button"
          className="btn"
          disabled={options.length >= 25}
          onClick={() =>
            onChange([
              ...options,
              {
                label: `ตัวเลือกที่ ${options.length + 1}`,
                value: `option-${options.length + 1}`,
                description: '',
                emoji: '',
              },
            ])
          }
        >
          เพิ่มตัวเลือก
        </button>
      </div>
    </div>
  )
}

function KindConfig({
  kind,
  config,
  onChange,
}: {
  kind: FieldKind
  config: Cfg
  onChange: (next: Cfg) => void
}) {
  const patch = (partial: Cfg) => onChange({ ...config, ...partial })
  const num = (key: string, fallback: number) =>
    typeof config[key] === 'number' ? (config[key] as number) : fallback
  const str = (key: string) => (typeof config[key] === 'string' ? (config[key] as string) : '')

  return (
    <>
      {kind === 'text' ? (
        <>
          <div className={styles.grid2}>
            <Field label="รูปแบบช่อง">
              <Select
                value={str('style') || 'short'}
                options={[
                  { value: 'short', label: 'บรรทัดเดียว' },
                  { value: 'paragraph', label: 'หลายบรรทัด' },
                ]}
                onChange={(e) => patch({ style: e.target.value })}
              />
            </Field>
            <Field label="ข้อความจาง (placeholder)" optional>
              <TextInput
                value={str('placeholder')}
                onChange={(e) => patch({ placeholder: e.target.value })}
              />
            </Field>
            <Field label="ความยาวขั้นต่ำ" hint="0 = ไม่กำหนด">
              <NumberInput
                value={num('minLength', 0)}
                min={0}
                max={4000}
                onValueChange={(v) => patch({ minLength: v })}
              />
            </Field>
            <Field label="ความยาวสูงสุด" hint="สูงสุด 4000">
              <NumberInput
                value={num('maxLength', 1000)}
                min={1}
                max={4000}
                onValueChange={(v) => patch({ maxLength: v })}
              />
            </Field>
          </div>
          <Field label="ข้อความตั้งต้นในช่อง" optional hint="เติมไว้ให้ล่วงหน้า ผู้ใช้แก้ได้">
            <TextArea
              value={str('prefill')}
              rows={2}
              onChange={(e) => patch({ prefill: e.target.value })}
            />
          </Field>
        </>
      ) : null}

      {usesOptions(kind) ? (
        <Field label="ตัวเลือก" hint="Discord ให้ไม่เกิน 25 ตัวเลือก">
          <OptionsEditor
            options={(config.options as SelectOption[]) ?? []}
            onChange={(options) => patch({ options })}
          />
        </Field>
      ) : null}

      {usesPlaceholder(kind) ? (
        <Field label="ข้อความจาง (placeholder)" optional>
          <TextInput
            value={str('placeholder')}
            onChange={(e) => patch({ placeholder: e.target.value })}
          />
        </Field>
      ) : null}

      {kind === 'channel' ? (
        <Field label="จำกัดชนิดห้อง" optional hint="ไม่ติ๊กเลย = เลือกได้ทุกชนิด">
          <div className={styles.channelTypes}>
            {CHANNEL_TYPES.map((t) => {
              const list = (config.channelTypes as string[]) ?? []
              return (
                <label key={t.value} className={styles.checkLabel}>
                  <input
                    type="checkbox"
                    checked={list.includes(t.value)}
                    onChange={() =>
                      patch({
                        channelTypes: list.includes(t.value)
                          ? list.filter((v) => v !== t.value)
                          : [...list, t.value],
                      })
                    }
                  />
                  {t.label}
                </label>
              )
            })}
          </div>
        </Field>
      ) : null}

      {usesMinMax(kind) ? (
        <div className={styles.grid2}>
          <Field label="เลือกอย่างน้อย">
            <NumberInput
              value={num('minValues', 1)}
              min={0}
              max={25}
              onValueChange={(v) => patch({ minValues: v })}
            />
          </Field>
          <Field label="เลือกได้มากสุด">
            <NumberInput
              value={num('maxValues', 1)}
              min={1}
              max={25}
              onValueChange={(v) => patch({ maxValues: v })}
            />
          </Field>
        </div>
      ) : null}

      {kind === 'file' ? (
        <div className={styles.grid2}>
          <Field label="แนบอย่างน้อย" hint="0 = ไม่บังคับแนบ">
            <NumberInput
              value={num('minFiles', 0)}
              min={0}
              max={10}
              onValueChange={(v) => patch({ minFiles: v })}
            />
          </Field>
          <Field label="แนบได้มากสุด" hint="สูงสุด 10 ไฟล์">
            <NumberInput
              value={num('maxFiles', 1)}
              min={1}
              max={10}
              onValueChange={(v) => patch({ maxFiles: v })}
            />
          </Field>
        </div>
      ) : null}
    </>
  )
}

export function ModalFieldsEditor({
  fields,
  onChange,
}: {
  fields: ModalFieldInput[]
  onChange: (next: ModalFieldInput[]) => void
}) {
  const patch = (index: number, partial: Partial<ModalFieldInput>) =>
    onChange(fields.map((f, i) => (i === index ? { ...f, ...partial } : f)))

  const move = (index: number, delta: number) => {
    const target = index + delta
    const next = [...fields]
    const a = next[index]
    const b = next[target]
    if (!a || !b) return
    next[index] = b
    next[target] = a
    onChange(next)
  }

  const add = () => {
    const n = fields.length + 1
    onChange([
      ...fields,
      {
        kind: 'text',
        key: `field_${n}`,
        label: `คำถามที่ ${n}`,
        description: '',
        required: true,
        config: EMPTY_CONFIG.text,
      },
    ])
  }

  return (
    <>
      {fields.length === 0 ? (
        <div className={styles.empty}>
          ยังไม่มีฟิลด์ — ถ้าไม่เพิ่มเลย กดปุ่มแล้วจะสร้างห้องทันทีโดยไม่เด้งฟอร์มถาม
        </div>
      ) : (
        <div className={styles.list}>
          {fields.map((field, index) => (
            <div key={field.id ?? `new-${index}`} className={styles.card}>
              <div className={styles.head}>
                <span className={styles.index}>{index + 1}</span>
                <span className={styles.headTitle}>{field.label || 'ยังไม่ได้ตั้งหัวข้อ'}</span>
                <span className={styles.headKind}>{FIELD_KIND_LABEL[field.kind]}</span>
                <div className={styles.headActions}>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="เลื่อนขึ้น"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => move(index, 1)}
                    disabled={index === fields.length - 1}
                    aria-label="เลื่อนลง"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className={styles.iconBtn}
                    onClick={() => onChange(fields.filter((_, i) => i !== index))}
                    aria-label="ลบฟิลด์"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className={styles.body}>
                <Field label="ชนิดของฟิลด์" hint={FIELD_KIND_HINT[field.kind]}>
                  <Select
                    value={field.kind}
                    options={FIELD_KINDS.map((k) => ({ value: k, label: FIELD_KIND_LABEL[k] }))}
                    onChange={(e) => {
                      const kind = e.target.value as FieldKind
                      patch(index, { kind, config: EMPTY_CONFIG[kind] })
                    }}
                  />
                </Field>

                <div className={styles.grid2}>
                  <Field
                    label="หัวข้อคำถาม"
                    counter={{ current: field.label.length, max: 45 }}
                  >
                    <TextInput
                      value={field.label}
                      onChange={(e) => {
                        const label = e.target.value
                        const shouldSync = !field.id && field.key === slugifyKey(field.label)
                        patch(index, { label, ...(shouldSync ? { key: slugifyKey(label) } : {}) })
                      }}
                    />
                  </Field>

                  <Field
                    label="คีย์อ้างอิง"
                    hint={`ใช้ในเทมเพลตเป็น {field.${field.key || 'คีย์'}}`}
                  >
                    <TextInput
                      mono
                      value={field.key}
                      onChange={(e) => patch(index, { key: slugifyKey(e.target.value) })}
                    />
                  </Field>
                </div>

                <Field label="คำอธิบายใต้หัวข้อ" optional counter={{ current: field.description.length, max: 100 }}>
                  <TextInput
                    value={field.description}
                    onChange={(e) => patch(index, { description: e.target.value })}
                  />
                </Field>

                <div style={{ marginBottom: 20 }}>
                  <Toggle
                    checked={field.required}
                    onChange={(v) => patch(index, { required: v })}
                    label="บังคับกรอก"
                  />
                </div>

                <KindConfig
                  kind={field.kind}
                  config={(field.config as Cfg) ?? {}}
                  onChange={(config) => patch(index, { config })}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12 }}>
        <button
          type="button"
          className="btn"
          onClick={add}
          disabled={fields.length >= MAX_MODAL_FIELDS}
        >
          เพิ่มฟิลด์
        </button>
        <p className={styles.limitNote}>
          Discord ให้ modal มีได้สูงสุด {MAX_MODAL_FIELDS} ฟิลด์ — ตอนนี้ใช้ไป {fields.length}
        </p>
      </div>
    </>
  )
}
