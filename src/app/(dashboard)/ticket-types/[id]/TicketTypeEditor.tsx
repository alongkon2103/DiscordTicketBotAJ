'use client'

import { useMemo, useState, useTransition } from 'react'
import { CHANNEL_NAME_VARIABLES, TICKET_VARIABLES, toChannelName } from '@/lib/discord/template'
import type { GuildResources } from '@/lib/discord/resources'
import type { MessagePayload } from '@/lib/schema/message'
import type { TicketTypeInput } from '@/lib/schema/ticket-type'
import { DiscordPreview } from '@/components/DiscordPreview'
import { EmbedEditor, VariableList } from '@/components/EmbedEditor'
import { ModalFieldsEditor } from '@/components/ModalFieldsEditor'
import {
  Field,
  NumberInput,
  OptionPicker,
  OrderedList,
  Select,
  TextArea,
  TextInput,
  Toggle,
  type PickerOption,
} from '@/components/form'
import styles from '@/components/editor.module.css'
import { deleteTicketType, saveTicketType } from '../actions'

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

export function TicketTypeEditor({
  id,
  initial,
  resources,
  botName,
}: {
  id: string
  initial: TicketTypeInput
  resources: GuildResources
  botName: string
}) {
  const [form, setForm] = useState<TicketTypeInput>(initial)
  const [errors, setErrors] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const patch = (partial: Partial<TicketTypeInput>) => {
    setForm((prev) => ({ ...prev, ...partial }))
    setSaved(false)
  }

  const categoryOptions: PickerOption[] = useMemo(
    () => resources.categories.map((c) => ({ id: c.id, name: c.name })),
    [resources.categories],
  )

  const roleOptions: PickerOption[] = useMemo(
    () =>
      resources.roles.map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        meta: r.managed ? 'ระบบ' : undefined,
      })),
    [resources.roles],
  )

  const categoryName = (cid: string) =>
    resources.categories.find((c) => c.id === cid)?.name ?? `หมวดที่ถูกลบ (${cid})`

  const toggleIn = (key: keyof TicketTypeInput, list: string[], value: string) =>
    patch({
      [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    } as Partial<TicketTypeInput>)

  const previewName = toChannelName(
    form.channelNameTemplate
      .replace('{number}', '0042')
      .replace('{username}', 'somchai')
      .replace('{displayname}', 'สมชาย')
      .replace('{userid}', '123456789012345678')
      .replace('{type}', form.name)
      .replace('{date}', '03-09'),
  )

  const save = () => {
    setErrors([])
    startTransition(async () => {
      const result = await saveTicketType(id, form)
      if (result.ok) {
        setSaved(true)
      } else {
        setErrors(result.errors)
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    })
  }

  const remove = () => {
    if (!window.confirm(`ลบประเภท "${form.name}" ใช่ไหม? ปุ่มใน panel ที่ใช้ประเภทนี้จะหายไปด้วย`)) {
      return
    }
    startTransition(async () => {
      const result = await deleteTicketType(id)
      if (result && !result.ok) setErrors(result.errors)
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

      <div className={styles.layout}>
        <div>
          <Section title="ข้อมูลทั่วไป">
            <Field label="ชื่อประเภท" hint="ใช้แสดงในหน้าเว็บและเป็นค่าของตัวแปร {ticket.type}">
              <TextInput value={form.name} onChange={(e) => patch({ name: e.target.value })} />
            </Field>

            <Field label="อีโมจิ" optional hint="ใส่อีโมจิของ Discord หรือ <:ชื่อ:ไอดี> สำหรับอีโมจิเซิร์ฟเวอร์">
              <TextInput
                value={form.emoji}
                placeholder="🛒"
                onChange={(e) => patch({ emoji: e.target.value })}
              />
            </Field>

            <div style={{ marginBottom: 20 }}>
              <Toggle
                checked={form.enabled}
                onChange={(v) => patch({ enabled: v })}
                label="เปิดรับ ticket ประเภทนี้"
                hint="ปิดแล้วปุ่มยังอยู่ใน panel แต่กดแล้วจะขึ้นข้อความแจ้งแทน"
              />
            </div>

            {!form.enabled ? (
              <Field label="ข้อความตอนปิดรับ">
                <TextArea
                  value={form.disabledMessage}
                  rows={2}
                  onChange={(e) => patch({ disabledMessage: e.target.value })}
                />
              </Field>
            ) : null}
          </Section>

          <Section
            title="ห้องที่จะถูกสร้าง"
            lede="Discord ให้ category หนึ่งมีห้องได้ 50 ห้อง — เลือกหลาย category ไว้ ระบบจะไหลไปอันถัดไปเองเมื่ออันแรกเต็ม"
          >
            <Field label="Category ปลายทาง" hint="เรียงลำดับได้ อันบนสุดถูกใช้ก่อน">
              <OptionPicker
                options={categoryOptions}
                selected={form.categoryIds}
                onToggle={(cid) => toggleIn('categoryIds', form.categoryIds, cid)}
                emptyText="เซิร์ฟเวอร์นี้ยังไม่มี category"
              />
              <OrderedList
                ids={form.categoryIds}
                nameOf={categoryName}
                onChange={(next) => patch({ categoryIds: next })}
              />
            </Field>

            <Field
              label="รูปแบบชื่อห้อง"
              hint={
                <>
                  ตัวแปรที่ใช้ได้:{' '}
                  {CHANNEL_NAME_VARIABLES.map((v) => v.token).join(' ')}
                  <br />
                  จะได้ชื่อห้องประมาณ <span className="mono">#{previewName}</span>
                </>
              }
            >
              <TextInput
                mono
                value={form.channelNameTemplate}
                onChange={(e) => patch({ channelNameTemplate: e.target.value })}
              />
            </Field>

            <Field
              label="Category สำหรับเก็บห้องที่ปิดแล้ว"
              optional
              hint="ตอนกดปิด ห้องจะถูกย้ายมาที่นี่แทนการลบทันที เว้นว่างไว้ห้องจะอยู่ที่เดิม"
            >
              <Select
                value={form.archiveCategoryId ?? ''}
                options={[
                  { value: '', label: 'ไม่ย้าย — อยู่ที่เดิม' },
                  ...resources.categories.map((c) => ({ value: c.id, label: c.name })),
                ]}
                onChange={(e) => patch({ archiveCategoryId: e.target.value || null })}
              />
            </Field>
          </Section>

          <Section
            title="สิทธิ์การเข้าถึง"
            lede="ระบบตั้งให้อัตโนมัติว่า @everyone มองไม่เห็น ส่วนคนเปิดกับ role ทีมงานเห็นและพิมพ์ได้"
          >
            <Field
              label="Role ทีมงาน"
              hint="เห็นทุกห้อง ticket ประเภทนี้ และจัดการสมาชิก ปิด ลบห้องได้"
            >
              <OptionPicker
                options={roleOptions}
                selected={form.staffRoleIds}
                onToggle={(rid) => toggleIn('staffRoleIds', form.staffRoleIds, rid)}
              />
            </Field>

            <Field
              label="เปิดให้เฉพาะ role นี้"
              optional
              hint="ไม่เลือกเลย = ทุกคนเปิดได้"
            >
              <OptionPicker
                options={roleOptions}
                selected={form.allowedRoleIds}
                onToggle={(rid) => toggleIn('allowedRoleIds', form.allowedRoleIds, rid)}
              />
            </Field>

            <Field label="ห้าม role นี้เปิด" optional hint="ตรวจก่อนรายการอนุญาตเสมอ">
              <OptionPicker
                options={roleOptions}
                selected={form.deniedRoleIds}
                onToggle={(rid) => toggleIn('deniedRoleIds', form.deniedRoleIds, rid)}
              />
            </Field>
          </Section>

          <Section
            title="ฟอร์มตอนกดเปิด"
            lede="ฟอร์มที่เด้งขึ้นมาให้กรอกก่อนสร้างห้อง — ไม่ใส่ฟิลด์เลยก็ได้ ระบบจะสร้างห้องทันที"
          >
            <Field label="หัวข้อฟอร์ม" counter={{ current: form.modalTitle.length, max: 45 }}>
              <TextInput
                value={form.modalTitle}
                onChange={(e) => patch({ modalTitle: e.target.value })}
              />
            </Field>

            <ModalFieldsEditor
              fields={form.fields}
              onChange={(fields) => patch({ fields })}
            />
          </Section>

          <Section
            title="ข้อความแรกในห้อง"
            lede="ข้อความที่บอทโพสต์และปักหมุดทันทีที่ห้องถูกสร้าง"
          >
            <EmbedEditor
              value={form.openPayload}
              onChange={(openPayload: MessagePayload) => patch({ openPayload })}
            />

            <div style={{ marginBottom: 16 }}>
              <Toggle
                checked={form.showAnswers}
                onChange={(v) => patch({ showAnswers: v })}
                label="แสดงคำตอบจากฟอร์มต่อท้าย"
                hint="เพิ่ม embed อีกอันที่ลิสต์คำถามกับคำตอบทั้งหมด"
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <Toggle
                checked={form.pingOpener}
                onChange={(v) => patch({ pingOpener: v })}
                label="แท็กคนที่เปิด ticket"
              />
            </div>

            <Field label="แท็ก role เพิ่มตอนเปิด" optional hint="เช่นแท็กทีมงานให้รู้ว่ามีงานเข้า">
              <OptionPicker
                options={roleOptions}
                selected={form.pingRoleIds}
                onToggle={(rid) => toggleIn('pingRoleIds', form.pingRoleIds, rid)}
              />
            </Field>
          </Section>

          <Section title="การควบคุม" lede="กันคนเปิด ticket รัวๆ จนห้องล้นเซิร์ฟเวอร์">
            <Field
              label="เปิดค้างพร้อมกันได้กี่ห้องต่อคน"
              hint="0 = ไม่จำกัด — แนะนำให้ตั้ง 1"
            >
              <NumberInput
                value={form.maxOpenPerUser}
                min={0}
                max={50}
                onValueChange={(v) => patch({ maxOpenPerUser: v })}
              />
            </Field>

            <Field
              label="ต้องรอกี่วินาทีหลังปิดถึงเปิดใหม่ได้"
              hint="0 = เปิดใหม่ได้ทันที (3600 = 1 ชั่วโมง)"
            >
              <NumberInput
                value={form.cooldownSeconds}
                min={0}
                max={86400}
                onValueChange={(v) => patch({ cooldownSeconds: v })}
              />
            </Field>
          </Section>
        </div>

        <aside className={styles.side}>
          <div className={styles.sideHead}>ตัวอย่างข้อความแรกในห้อง</div>
          <DiscordPreview payload={form.openPayload} botName={botName} />

          <div style={{ marginTop: 20 }}>
            <VariableList variables={TICKET_VARIABLES} />
          </div>
        </aside>
      </div>

      <div className={styles.bar}>
        <button type="button" className="btn btn-primary" onClick={save} disabled={pending}>
          {pending ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
        <button type="button" className="btn btn-danger" onClick={remove} disabled={pending}>
          ลบประเภทนี้
        </button>
        <span className={styles.barSpacer} />
        {saved ? (
          <span className={styles.status} data-tone="ok">
            บันทึกแล้ว
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
