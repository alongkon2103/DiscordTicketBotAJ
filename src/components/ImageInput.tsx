'use client'

import { useRef, useState } from 'react'
import { TextInput } from './form'
import styles from './image-input.module.css'

/** ค่าที่ขึ้นต้นด้วย upload: คือไฟล์ที่อัปโหลดไว้ในเครื่อง ที่เหลือคือ URL ภายนอก */
const UPLOAD_PREFIX = 'upload:'

export const isUploadValue = (value: string) => value.startsWith(UPLOAD_PREFIX)
export const uploadSrc = (value: string) =>
  isUploadValue(value) ? `/uploads/${value.slice(UPLOAD_PREFIX.length)}` : value

export function ImageInput({
  value,
  onChange,
  placeholder = 'https://... หรือกดอัปโหลด',
}: {
  value: string
  onChange: (next: string) => void
  placeholder?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const upload = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const res = await fetch('/api/uploads', { method: 'POST', body })
      const json = (await res.json()) as { ok: boolean; ref?: string; error?: string }

      if (json.ok && json.ref) onChange(json.ref)
      else setError(json.error ?? 'อัปโหลดไม่สำเร็จ')
    } catch {
      setError('อัปโหลดไม่สำเร็จ — ตรวจว่าเซิร์ฟเวอร์ยังทำงานอยู่')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className={styles.wrap}>
      {isUploadValue(value) ? (
        <div className={styles.preview}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.thumb} src={uploadSrc(value)} alt="" />
          <div className={styles.previewMeta}>
            <div className={styles.previewName}>{value.slice(UPLOAD_PREFIX.length)}</div>
            <div className={styles.previewNote}>แนบไปกับข้อความตอนส่ง</div>
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => onChange('')}>
            เอาออก
          </button>
        </div>
      ) : (
        <div className={styles.row}>
          <TextInput
            value={value}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            className={`btn ${styles.uploadBtn}`}
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? 'กำลังอัป...' : 'อัปโหลด'}
          </button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        className={styles.file}
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void upload(file)
        }}
      />

      {error ? <div className={styles.error}>{error}</div> : null}
    </div>
  )
}
