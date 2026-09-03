import { z } from 'zod'

/** ข้อจำกัดจริงของ Discord — ใช้ทั้งฝั่ง validate และแสดงตัวนับใน UI */
export const LIMITS = {
  content: 2000,
  embedTitle: 256,
  embedDescription: 4096,
  embedFieldName: 256,
  embedFieldValue: 1024,
  embedFields: 25,
  embedFooter: 2048,
  embedAuthor: 256,
  /** ทุกส่วนของ embed รวมกันห้ามเกิน 6000 */
  embedTotal: 6000,
} as const

const url = z.string().trim().max(2048).optional().or(z.literal(''))
const hexColor = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, 'ต้องเป็นสีแบบ #rrggbb')
  .optional()
  .or(z.literal(''))

export const EmbedFieldSchema = z.object({
  name: z.string().max(LIMITS.embedFieldName).default(''),
  value: z.string().max(LIMITS.embedFieldValue).default(''),
  inline: z.boolean().default(false),
})

export const EmbedSchema = z.object({
  title: z.string().max(LIMITS.embedTitle).default(''),
  description: z.string().max(LIMITS.embedDescription).default(''),
  url: url.default(''),
  color: hexColor.default('#2b2d31'),
  authorName: z.string().max(LIMITS.embedAuthor).default(''),
  authorIconUrl: url.default(''),
  thumbnailUrl: url.default(''),
  imageUrl: url.default(''),
  footerText: z.string().max(LIMITS.embedFooter).default(''),
  footerIconUrl: url.default(''),
  showTimestamp: z.boolean().default(false),
  fields: z.array(EmbedFieldSchema).max(LIMITS.embedFields).default([]),
})

export const MessagePayloadSchema = z.object({
  content: z.string().max(LIMITS.content).default(''),
  useEmbed: z.boolean().default(true),
  embed: EmbedSchema.default(() => EmbedSchema.parse({})),
})

export type EmbedField = z.infer<typeof EmbedFieldSchema>
export type EmbedData = z.infer<typeof EmbedSchema>
export type MessagePayload = z.infer<typeof MessagePayloadSchema>

export const emptyPayload = (): MessagePayload => MessagePayloadSchema.parse({})

/** ความยาวรวมของ embed ตามวิธีที่ Discord นับ */
export function embedTotalLength(embed: EmbedData): number {
  return (
    embed.title.length +
    embed.description.length +
    embed.authorName.length +
    embed.footerText.length +
    embed.fields.reduce((sum, f) => sum + f.name.length + f.value.length, 0)
  )
}

/** true เมื่อ embed ไม่มีอะไรให้แสดงเลย — Discord จะปฏิเสธ embed เปล่า */
export function isEmbedEmpty(embed: EmbedData): boolean {
  return (
    !embed.title &&
    !embed.description &&
    !embed.authorName &&
    !embed.footerText &&
    !embed.imageUrl &&
    !embed.thumbnailUrl &&
    embed.fields.every((f) => !f.name && !f.value)
  )
}

/** ตรวจว่า payload ส่งขึ้น Discord ได้จริงไหม */
export function validatePayload(payload: MessagePayload): string[] {
  const errors: string[] = []
  const hasEmbed = payload.useEmbed && !isEmbedEmpty(payload.embed)

  if (!payload.content.trim() && !hasEmbed) {
    errors.push('ต้องมีข้อความหรือ embed อย่างน้อยอย่างใดอย่างหนึ่ง')
  }
  if (payload.content.length > LIMITS.content) {
    errors.push(`ข้อความยาวเกิน ${LIMITS.content} ตัวอักษร`)
  }
  if (hasEmbed && embedTotalLength(payload.embed) > LIMITS.embedTotal) {
    errors.push(`เนื้อหาใน embed รวมกันเกิน ${LIMITS.embedTotal} ตัวอักษร`)
  }
  return errors
}
