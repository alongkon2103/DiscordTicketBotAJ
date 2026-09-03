import { z } from 'zod'
import { MessagePayloadSchema } from './message'
import { FIELD_KINDS, FieldKeySchema, MAX_MODAL_FIELDS } from './modal-field'

const snowflake = z.string().regex(/^\d{17,20}$/)
const idList = z.array(snowflake).max(50).default([])

export const ModalFieldInputSchema = z.object({
  /** cuid เดิมเมื่อแก้ของเก่า / undefined เมื่อเพิ่งเพิ่ม */
  id: z.string().optional(),
  kind: z.enum(FIELD_KINDS),
  key: FieldKeySchema,
  label: z.string().min(1, 'ต้องมีหัวข้อ').max(45, 'หัวข้อยาวได้ไม่เกิน 45 ตัวอักษร'),
  description: z.string().max(100).default(''),
  required: z.boolean().default(true),
  config: z.unknown(),
})

export const TicketTypeInputSchema = z.object({
  name: z.string().min(1, 'ต้องตั้งชื่อประเภท').max(60),
  emoji: z.string().max(64).default(''),
  enabled: z.boolean().default(true),
  disabledMessage: z.string().max(500).default('ตอนนี้ปิดรับ ticket ประเภทนี้ชั่วคราว'),

  categoryIds: idList,
  channelNameTemplate: z.string().min(1, 'ต้องมีรูปแบบชื่อห้อง').max(100),
  archiveCategoryId: snowflake.nullable().default(null),

  staffRoleIds: idList,
  allowedRoleIds: idList,
  deniedRoleIds: idList,

  modalTitle: z.string().max(45).default('เปิด Ticket'),
  fields: z.array(ModalFieldInputSchema).max(MAX_MODAL_FIELDS),

  openPayload: MessagePayloadSchema,
  pingOpener: z.boolean().default(true),
  pingRoleIds: idList,
  showAnswers: z.boolean().default(true),

  maxOpenPerUser: z.number().int().min(0).max(50).default(1),
  cooldownSeconds: z.number().int().min(0).max(86400).default(0),
})

export type TicketTypeInput = z.infer<typeof TicketTypeInputSchema>
export type ModalFieldInput = z.infer<typeof ModalFieldInputSchema>

/** ตรวจสิ่งที่ zod ตรวจไม่ได้เพราะต้องดูข้ามฟิลด์ */
export function validateTicketType(input: TicketTypeInput): string[] {
  const errors: string[] = []

  if (input.categoryIds.length === 0) {
    errors.push('ต้องเลือก category อย่างน้อยหนึ่งอันสำหรับสร้างห้อง')
  }
  if (input.staffRoleIds.length === 0) {
    errors.push('ต้องเลือก role ทีมงานอย่างน้อยหนึ่ง role ไม่งั้นจะไม่มีใครเห็นห้อง ticket')
  }

  const keys = new Set<string>()
  for (const field of input.fields) {
    if (keys.has(field.key)) errors.push(`คีย์ "${field.key}" ซ้ำกัน — คีย์ต้องไม่ซ้ำในประเภทเดียวกัน`)
    keys.add(field.key)
  }

  const overlap = input.allowedRoleIds.filter((id) => input.deniedRoleIds.includes(id))
  if (overlap.length > 0) {
    errors.push('มี role ที่อยู่ทั้งในรายการอนุญาตและรายการห้ามพร้อมกัน')
  }

  return errors
}
