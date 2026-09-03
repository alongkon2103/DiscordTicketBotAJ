'use client'

import { useId, useMemo, useState } from 'react'
import styles from './form.module.css'

export function Field({
  label,
  hint,
  error,
  optional,
  counter,
  children,
  htmlFor,
}: {
  label: string
  hint?: React.ReactNode
  error?: string
  optional?: boolean
  counter?: { current: number; max: number }
  children: React.ReactNode
  htmlFor?: string
}) {
  const over = counter ? counter.current > counter.max : false

  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={htmlFor}>
          {label}
        </label>
        {counter ? (
          <span className={styles.counter} data-over={over}>
            {counter.current}/{counter.max}
          </span>
        ) : optional ? (
          <span className={styles.optional}>ไม่บังคับ</span>
        ) : null}
      </div>
      {children}
      {error ? <div className={styles.error}>{error}</div> : hint ? <div className={styles.hint}>{hint}</div> : null}
    </div>
  )
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  const { mono, className, ...rest } = props
  return <input {...rest} className={`${styles.input} ${mono ? styles.mono : ''} ${className ?? ''}`} />
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props
  return <textarea {...rest} className={`${styles.textarea} ${className ?? ''}`} />
}

export function Select({
  options,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  options: { value: string; label: string }[]
}) {
  return (
    <select {...rest} className={styles.select}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function NumberInput({
  value,
  onValueChange,
  min = 0,
  max,
  ...rest
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: number
  onValueChange: (v: number) => void
  min?: number
  max?: number
}) {
  return (
    <input
      {...rest}
      type="number"
      className={`${styles.input} ${styles.mono}`}
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      onChange={(e) => {
        const next = Number(e.target.value)
        onValueChange(Number.isFinite(next) ? next : 0)
      }}
    />
  )
}

export function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.toggleBox} aria-hidden />
      <span className={styles.toggleText}>
        <span className={styles.toggleLabel}>{label}</span>
        {hint ? <span className={styles.toggleHint} style={{ display: 'block' }}>{hint}</span> : null}
      </span>
    </label>
  )
}

// ── ตัวเลือกหลายอัน ────────────────────────────────────────────────────

export type PickerOption = {
  id: string
  name: string
  /** สีจุดนำหน้า เช่นสีของ role */
  color?: string | null
  /** ข้อความมุมขวา เช่นชนิดห้อง */
  meta?: string
  disabled?: boolean
}

export function OptionPicker({
  options,
  selected,
  onToggle,
  searchPlaceholder = 'ค้นหา',
  emptyText = 'ไม่มีตัวเลือก',
  showSearchFrom = 8,
}: {
  options: PickerOption[]
  selected: string[]
  onToggle: (id: string) => void
  searchPlaceholder?: string
  emptyText?: string
  showSearchFrom?: number
}) {
  const [query, setQuery] = useState('')
  const id = useId()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options
  }, [options, query])

  return (
    <div className={styles.picker}>
      {options.length >= showSearchFrom ? (
        <input
          className={styles.pickerSearch}
          placeholder={searchPlaceholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      ) : null}

      <div className={styles.pickerList}>
        {filtered.length === 0 ? (
          <div className={styles.pickerEmpty}>{emptyText}</div>
        ) : (
          filtered.map((option) => (
            <label key={option.id} className={styles.option}>
              <input
                type="checkbox"
                name={id}
                checked={selected.includes(option.id)}
                disabled={option.disabled}
                onChange={() => onToggle(option.id)}
              />
              {option.color !== undefined ? (
                <span
                  className={styles.optionDot}
                  style={option.color ? { background: option.color } : undefined}
                  aria-hidden
                />
              ) : null}
              <span className={styles.optionName}>{option.name}</span>
              {option.meta ? <span className={styles.optionMeta}>{option.meta}</span> : null}
            </label>
          ))
        )}
      </div>
    </div>
  )
}

/** รายการที่เลือกแล้วแบบเรียงลำดับได้ — ใช้กับ category สำรอง */
export function OrderedList({
  ids,
  nameOf,
  onChange,
}: {
  ids: string[]
  nameOf: (id: string) => string
  onChange: (next: string[]) => void
}) {
  if (ids.length === 0) return null

  const move = (index: number, delta: number) => {
    const next = [...ids]
    const target = index + delta
    const a = next[index]
    const b = next[target]
    if (a === undefined || b === undefined) return
    next[index] = b
    next[target] = a
    onChange(next)
  }

  return (
    <div className={styles.chosen}>
      {ids.map((id, index) => (
        <div key={id} className={styles.chosenRow}>
          <span className={styles.chosenIndex}>{index + 1}</span>
          <span className={styles.chosenName}>{nameOf(id)}</span>
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
            disabled={index === ids.length - 1}
            aria-label="เลื่อนลง"
          >
            ↓
          </button>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => onChange(ids.filter((v) => v !== id))}
            aria-label="เอาออก"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
