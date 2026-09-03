'use client'

import { useState, useTransition } from 'react'
import { MEMBER_VARIABLES } from '@/lib/discord/template'
import type { ChannelOption, RoleOption } from '@/lib/discord/resources'
import type { MemberEventInput, MemberEventId } from '@/lib/member-events'
import type { MessagePayload } from '@/lib/schema/message'
import { DiscordPreview } from '@/components/DiscordPreview'
import { EmbedEditor, VariableList } from '@/components/EmbedEditor'
import { Field, OptionPicker, Select, Toggle } from '@/components/form'
import styles from '@/components/editor.module.css'
import tabStyles from './member-events.module.css'
import { saveMemberEventAction, sendMemberEventTest } from './actions'

type State = Record<MemberEventId, MemberEventInput>

const TABS: { id: MemberEventId; label: string; lede: string }[] = [
  {
    id: 'join',
    label: 'ตอนมีคนเข้า',
    lede: 'ส่งทันทีที่มีสมาชิกใหม่เข้าเซิร์ฟเวอร์',
  },
  {
    id: 'leave',
    label: 'ตอนมีคนออก',
    lede: 'ส่งเมื่อมีคนออกเอง ถูกเตะ หรือถูกแบน',
  },
]

export function MemberEventsEditor({
  initial,
  channels,
  roles,
  botName,
  botTopRoleName,
}: {
  initial: State
  channels: ChannelOption[]
  roles: RoleOption[]
  botName: string
  botTopRoleName: string | null
}) {
  const [tab, setTab] = useState<MemberEventId>('join')
  const [state, setState] = useState<State>(initial)
  const [errors, setErrors] = useState<string[]>([])
  const [note, setNote] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const current = state[tab]
  const meta = TABS.find((t) => t.id === tab)

  // role ที่เคยเลือกไว้แต่ตอนนี้บอทแจกไม่ได้ — เตือนตรงนี้ ดีกว่าให้ไปงงว่าทำไมไม่ทำงาน
  const blockedPicks = roles.filter(
    (r) => current.autoRoleIds.includes(r.id) && !r.assignable,
  )

  const patch = (partial: Partial<MemberEventInput>) => {
    setState((prev) => ({ ...prev, [tab]: { ...prev[tab], ...partial } }))
    setNote(null)
  }

  const save = () => {
    setErrors([])
    setNote(null)
    startTransition(async () => {
      const result = await saveMemberEventAction(tab, current)
      if (result.ok) setNote('บันทึกแล้ว')
      else setErrors(result.errors)
    })
  }

  const test = () => {
    setErrors([])
    setNote(null)
    startTransition(async () => {
      // บันทึกก่อนเสมอ ไม่งั้นจะส่งข้อความเวอร์ชันเก่าออกไป
      const saved = await saveMemberEventAction(tab, current)
      if (!saved.ok) {
        setErrors(saved.errors)
        return
      }
      const result = await sendMemberEventTest(tab)
      if (result.ok) setNote(result.note ?? 'ส่งทดสอบแล้ว')
      else setErrors(result.errors)
    })
  }

  return (
    <>
      <div className={tabStyles.tabs} role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={tabStyles.tab}
            data-active={tab === t.id}
            onClick={() => {
              setTab(t.id)
              setErrors([])
              setNote(null)
            }}
          >
            {t.label}
            <span className={tabStyles.tabDot} data-on={state[t.id].enabled} aria-hidden />
          </button>
        ))}
      </div>

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
          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{meta?.label}</h2>
              <p className={styles.sectionLede}>{meta?.lede}</p>
            </div>

            <div style={{ marginBottom: 20 }}>
              <Toggle
                checked={current.enabled}
                onChange={(v) => patch({ enabled: v })}
                label="เปิดใช้งาน"
                hint="ปิดไว้แล้วบอทจะไม่ส่งอะไรเลยตอนเกิดเหตุการณ์นี้"
              />
            </div>

            <Field label="ห้องที่จะส่งข้อความ">
              <Select
                value={current.channelId ?? ''}
                options={[
                  { value: '', label: 'ยังไม่เลือก' },
                  ...channels.map((c) => ({ value: c.id, label: `#${c.name}` })),
                ]}
                onChange={(e) => patch({ channelId: e.target.value || null })}
              />
            </Field>

            {tab === 'join' ? (
              <>
                <Field
                  label="Role ที่แจกให้อัตโนมัติ"
                  optional
                  hint={`แจกทันทีที่เข้าเซิร์ฟเวอร์ — Discord ให้บอทแจกได้เฉพาะ role ที่อยู่ต่ำกว่า role "${botTopRoleName ?? 'ของบอท'}" เท่านั้น สิทธิ์ Administrator ไม่ช่วยข้อนี้`}
                >
                  <OptionPicker
                    options={roles.map((r) => ({
                      id: r.id,
                      name: r.name,
                      color: r.color,
                      meta: r.assignable ? undefined : 'แจกไม่ได้',
                      disabled: !r.assignable,
                    }))}
                    selected={current.autoRoleIds}
                    onToggle={(id) =>
                      patch({
                        autoRoleIds: current.autoRoleIds.includes(id)
                          ? current.autoRoleIds.filter((v) => v !== id)
                          : [...current.autoRoleIds, id],
                      })
                    }
                  />
                </Field>

                {blockedPicks.length > 0 ? (
                  <div className={styles.errors}>
                    <strong>role ที่เลือกไว้ต่อไปนี้บอทแจกให้ไม่ได้ ระบบจะข้ามไป</strong>
                    <ul>
                      {blockedPicks.map((r) => (
                        <li key={r.id}>
                          <strong>{r.name}</strong> — {r.blockedReason}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : null}
          </section>

          <section className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>ข้อความ</h2>
              <p className={styles.sectionLede}>
                ใส่ {'{user.avatar}'} ในช่องรูปเพื่อดึงรูปโปรไฟล์ของคนนั้นมาแสดง
                หรืออัปโหลดแบนเนอร์ของคุณเองก็ได้
              </p>
            </div>

            <EmbedEditor
              value={current.payload}
              onChange={(payload: MessagePayload) => patch({ payload })}
              contentHint="ข้อความธรรมดาเหนือกล่อง embed — ใส่ {user} ตรงนี้ถ้าอยากให้แท็กคนนั้นจริงๆ"
            />
          </section>
        </div>

        <aside className={styles.side}>
          <div className={styles.sideHead}>ตัวอย่างที่จะเห็นใน Discord</div>
          <DiscordPreview payload={current.payload} botName={botName} />

          <div style={{ marginTop: 20 }}>
            <VariableList variables={MEMBER_VARIABLES} />
          </div>
        </aside>
      </div>

      <div className={styles.bar}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
        <button
          type="button"
          className="btn"
          onClick={test}
          disabled={pending || !current.channelId}
          title={current.channelId ? undefined : 'เลือกห้องก่อน'}
        >
          บันทึกแล้วส่งทดสอบ
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
