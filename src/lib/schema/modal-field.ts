import { z } from 'zod'

/**
 * Discord ให้ modal มี component ระดับบนสุดได้ 1-5 อัน
 * แต่ละฟิลด์ในหน้าเว็บ = Label component หนึ่งอันที่ห่อ input ไว้ข้างใน
 */
export const MAX_MODAL_FIELDS = 5

export const FIELD_KINDS = [
  'text',
  'select',
  'user',
  'role',
  'channel',
  'mentionable',
  'radio',
  'checkbox',
  'file',
] as const

export type FieldKind = (typeof FIELD_KINDS)[number]

export const FIELD_KIND_LABEL: Record<FieldKind, string> = {
  text: 'ช่องข้อความ',
  select: 'ตัวเลือกแบบ dropdown',
  user: 'เลือกสมาชิก',
  role: 'เลือก role',
  channel: 'เลือกห้อง',
  mentionable: 'เลือกสมาชิกหรือ role',
  radio: 'ตัวเลือกแบบเลือกอันเดียว',
  checkbox: 'ติ๊กถูกหลายอัน',
  file: 'แนบไฟล์',
}

export const FIELD_KIND_HINT: Record<FieldKind, string> = {
  text: 'พิมพ์ตอบได้อิสระ เลือกได้ว่าเป็นบรรทัดเดียวหรือหลายบรรทัด',
  select: 'ให้เลือกจากรายการที่คุณกำหนด',
  user: 'ให้เลือกสมาชิกในเซิร์ฟเวอร์',
  role: 'ให้เลือก role ในเซิร์ฟเวอร์',
  channel: 'ให้เลือกห้องในเซิร์ฟเวอร์',
  mentionable: 'เลือกได้ทั้งสมาชิกและ role',
  radio: 'ตัวเลือกกางออกให้เห็นทั้งหมด เลือกได้อันเดียว',
  checkbox: 'ติ๊กได้หลายอันพร้อมกัน',
  file: 'ให้แนบรูปหรือไฟล์มาพร้อมตอนเปิด ticket',
}

export const SelectOptionSchema = z.object({
  label: z.string().min(1).max(100),
  value: z.string().min(1).max(100),
  description: z.string().max(100).default(''),
  emoji: z.string().max(64).default(''),
})

export type SelectOption = z.infer<typeof SelectOptionSchema>

export const TextConfigSchema = z.object({
  style: z.enum(['short', 'paragraph']).default('short'),
  placeholder: z.string().max(100).default(''),
  minLength: z.number().int().min(0).max(4000).default(0),
  maxLength: z.number().int().min(1).max(4000).default(1000),
  prefill: z.string().max(4000).default(''),
})

export const OptionsConfigSchema = z.object({
  options: z.array(SelectOptionSchema).min(1).max(25),
  placeholder: z.string().max(150).default(''),
  minValues: z.number().int().min(0).max(25).default(1),
  maxValues: z.number().int().min(1).max(25).default(1),
})

export const MentionConfigSchema = z.object({
  placeholder: z.string().max(150).default(''),
  minValues: z.number().int().min(0).max(25).default(1),
  maxValues: z.number().int().min(1).max(25).default(1),
})

export const ChannelConfigSchema = MentionConfigSchema.extend({
  /** ว่าง = ทุกชนิด */
  channelTypes: z.array(z.enum(['text', 'voice', 'category', 'forum', 'announcement'])).default([]),
})

export const CheckboxConfigSchema = z.object({
  options: z.array(SelectOptionSchema).min(1).max(25),
  minValues: z.number().int().min(0).max(25).default(0),
  maxValues: z.number().int().min(1).max(25).default(25),
})

export const FileConfigSchema = z.object({
  minFiles: z.number().int().min(0).max(10).default(0),
  maxFiles: z.number().int().min(1).max(10).default(1),
})

export const EMPTY_CONFIG: Record<FieldKind, unknown> = {
  text: TextConfigSchema.parse({}),
  select: { options: [{ label: 'ตัวเลือกที่ 1', value: 'option-1', description: '', emoji: '' }], placeholder: '', minValues: 1, maxValues: 1 },
  user: MentionConfigSchema.parse({}),
  role: MentionConfigSchema.parse({}),
  channel: ChannelConfigSchema.parse({}),
  mentionable: MentionConfigSchema.parse({}),
  radio: { options: [{ label: 'ตัวเลือกที่ 1', value: 'option-1', description: '', emoji: '' }], placeholder: '', minValues: 1, maxValues: 1 },
  checkbox: { options: [{ label: 'ตัวเลือกที่ 1', value: 'option-1', description: '', emoji: '' }], minValues: 0, maxValues: 25 },
  file: FileConfigSchema.parse({}),
}

/** parse config ตาม kind — คืน null ถ้าข้อมูลไม่เข้ารูป */
export function parseFieldConfig(kind: FieldKind, raw: unknown) {
  switch (kind) {
    case 'text':
      return TextConfigSchema.safeParse(raw)
    case 'select':
    case 'radio':
      return OptionsConfigSchema.safeParse(raw)
    case 'checkbox':
      return CheckboxConfigSchema.safeParse(raw)
    case 'channel':
      return ChannelConfigSchema.safeParse(raw)
    case 'user':
    case 'role':
    case 'mentionable':
      return MentionConfigSchema.safeParse(raw)
    case 'file':
      return FileConfigSchema.safeParse(raw)
  }
}

/** คีย์ที่ใช้อ้างในเทมเพลตได้ เช่น {field.order_id} */
export const FieldKeySchema = z
  .string()
  .min(1, 'ต้องมีคีย์')
  .max(40)
  .regex(/^[a-z0-9_]+$/, 'ใช้ได้แค่ a-z, 0-9 และ _')

export function slugifyKey(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40)
  return slug || 'field'
}
