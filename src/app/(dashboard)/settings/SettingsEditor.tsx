'use client'

import { useState, useTransition } from 'react'
import type { ChannelOption, RoleOption } from '@/lib/discord/resources'
import { Field, OptionPicker, Select } from '@/components/form'
import styles from '@/components/editor.module.css'
import { saveSettings } from './actions'

type Input = { adminRoleIds: string[]; ticketLogChannelId: string | null }

export function SettingsEditor({
  initial,
  roles,
  channels,
  ownerCount,
  isOwner,
}: {
  initial: Input
  roles: RoleOption[]
  channels: ChannelOption[]
  ownerCount: number
  isOwner: boolean
}) {
  const [form, setForm] = useState<Input>(initial)
  const [errors, setErrors] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const patch = (partial: Partial<Input>) => {
    setForm((prev) => ({ ...prev, ...partial }))
    setSaved(false)
  }

  const save = () => {
    setErrors([])
    startTransition(async () => {
      const result = await saveSettings(form)
      if (result.ok) setSaved(true)
      else setErrors(result.errors)
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

      <div style={{ maxWidth: 560 }}>
        <Field
          label="Role ที่เข้าหน้าจัดการได้"
          hint={`นอกจากนี้ Discord ID ${ownerCount} คนใน OWNER_IDS เข้าได้เสมอ แม้ไม่มี role — แก้ได้เฉพาะในไฟล์ .env${isOwner ? '' : ' (คุณเข้ามาด้วย role ระวังอย่าเอา role ตัวเองออก)'}`}
        >
          <OptionPicker
            options={roles.map((r) => ({
              id: r.id,
              name: r.name,
              color: r.color,
              meta: r.managed ? 'ระบบ' : undefined,
            }))}
            selected={form.adminRoleIds}
            onToggle={(id) =>
              patch({
                adminRoleIds: form.adminRoleIds.includes(id)
                  ? form.adminRoleIds.filter((v) => v !== id)
                  : [...form.adminRoleIds, id],
              })
            }
          />
        </Field>

        <Field
          label="ห้องบันทึกการปิด Ticket"
          optional
          hint="ทุกครั้งที่ปิด ticket บอทจะส่งสรุปพร้อมไฟล์บันทึกแชทมาที่ห้องนี้ — ควรเป็นห้องที่เฉพาะทีมงานเห็น"
        >
          <Select
            value={form.ticketLogChannelId ?? ''}
            options={[
              { value: '', label: 'ไม่ส่ง log' },
              ...channels.map((c) => ({ value: c.id, label: `#${c.name}` })),
            ]}
            onChange={(e) => patch({ ticketLogChannelId: e.target.value || null })}
          />
        </Field>
      </div>

      <div className={styles.bar}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
        <span className={styles.barSpacer} />
        {saved ? (
          <span className={styles.status} data-tone="ok">
            บันทึกแล้ว
          </span>
        ) : null}
      </div>
    </>
  )
}
