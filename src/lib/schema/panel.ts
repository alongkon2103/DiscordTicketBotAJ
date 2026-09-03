import { z } from 'zod'
import { MessagePayloadSchema } from './message'

const snowflake = z.string().regex(/^\d{17,20}$/)

export const PanelItemInputSchema = z.object({
  id: z.string().optional(),
  ticketTypeId: z.string().min(1, 'ต้องเลือกประเภท ticket'),
  label: z.string().min(1, 'ต้องมีข้อความบนปุ่ม').max(80),
  emoji: z.string().max(64).default(''),
  style: z.enum(['primary', 'secondary', 'success', 'danger']).default('secondary'),
  row: z.number().int().min(0).max(4).default(0),
  description: z.string().max(100).default(''),
})

export const PanelInputSchema = z.object({
  name: z.string().min(1, 'ต้องตั้งชื่อ panel').max(60),
  channelId: snowflake.nullable().default(null),
  payload: MessagePayloadSchema,
  layout: z.enum(['buttons', 'select']).default('buttons'),
  selectPlaceholder: z.string().max(150).default(''),
  items: z.array(PanelItemInputSchema).max(25),
})

export type PanelInput = z.infer<typeof PanelInputSchema>
export type PanelItemInput = z.infer<typeof PanelItemInputSchema>

export function validatePanel(input: PanelInput): string[] {
  const errors: string[] = []

  if (input.items.length === 0) {
    errors.push('ต้องมีอย่างน้อยหนึ่งปุ่มหรือหนึ่งตัวเลือก')
  }

  if (input.layout === 'buttons') {
    const perRow = new Map<number, number>()
    for (const item of input.items) {
      perRow.set(item.row, (perRow.get(item.row) ?? 0) + 1)
    }
    for (const [row, count] of perRow) {
      if (count > 5) errors.push(`แถวที่ ${row + 1} มี ${count} ปุ่ม — Discord ให้แถวละไม่เกิน 5 ปุ่ม`)
    }
    if (input.items.length > 25) errors.push('ปุ่มรวมกันเกิน 25 อัน')
  } else if (input.items.length > 25) {
    errors.push('dropdown มีตัวเลือกได้ไม่เกิน 25 อัน')
  }

  const seen = new Set<string>()
  for (const item of input.items) {
    if (seen.has(item.ticketTypeId)) {
      errors.push('มีประเภท ticket ซ้ำกันใน panel เดียว')
      break
    }
    seen.add(item.ticketTypeId)
  }

  return errors
}
