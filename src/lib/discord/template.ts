/**
 * แทนค่าตัวแปรในข้อความที่ตั้งจากหน้าเว็บ
 * รูปแบบ {key} และ {field.some_key} — คีย์ที่ไม่รู้จักจะถูกทิ้งไว้เหมือนเดิม
 * เพื่อให้เห็นว่าพิมพ์ผิด แทนที่จะกลายเป็นช่องว่างเงียบๆ
 */
export type TemplateVars = Record<string, string>

const TOKEN = /\{([a-zA-Z0-9_.]+)\}/g

export function render(input: string, vars: TemplateVars): string {
  if (!input) return input
  return input.replace(TOKEN, (match, key: string) => vars[key] ?? match)
}

export type VariableDoc = { token: string; description: string }

export const MEMBER_VARIABLES: VariableDoc[] = [
  { token: '{user}', description: 'แท็กสมาชิก (@ชื่อ)' },
  { token: '{user.name}', description: 'ชื่อผู้ใช้' },
  { token: '{user.display}', description: 'ชื่อที่แสดงในเซิร์ฟเวอร์' },
  { token: '{user.id}', description: 'ไอดีของสมาชิก' },
  { token: '{user.avatar}', description: 'ลิงก์รูปโปรไฟล์' },
  { token: '{user.joined}', description: 'วันที่เข้าเซิร์ฟเวอร์' },
  { token: '{user.created}', description: 'วันที่สร้างบัญชี Discord' },
  { token: '{server}', description: 'ชื่อเซิร์ฟเวอร์' },
  { token: '{server.membercount}', description: 'จำนวนสมาชิกทั้งหมด' },
  { token: '{server.icon}', description: 'ลิงก์ไอคอนเซิร์ฟเวอร์' },
  { token: '{date}', description: 'วันที่ปัจจุบัน' },
  { token: '{time}', description: 'เวลาปัจจุบัน' },
]

export const TICKET_VARIABLES: VariableDoc[] = [
  ...MEMBER_VARIABLES,
  { token: '{ticket.number}', description: 'เลข ticket' },
  { token: '{ticket.type}', description: 'ชื่อประเภท ticket' },
  { token: '{ticket.channel}', description: 'ลิงก์ห้อง ticket' },
  { token: '{field.คีย์}', description: 'คำตอบจากฟิลด์ใน modal' },
]

export const CHANNEL_NAME_VARIABLES: VariableDoc[] = [
  { token: '{number}', description: 'เลขรันนิ่ง เช่น 0042' },
  { token: '{username}', description: 'ชื่อผู้ใช้' },
  { token: '{displayname}', description: 'ชื่อที่แสดงในเซิร์ฟเวอร์' },
  { token: '{userid}', description: 'ไอดีของสมาชิก' },
  { token: '{type}', description: 'ชื่อประเภท ticket' },
  { token: '{date}', description: 'วันที่ เช่น 02-09' },
]

/** Discord บังคับชื่อห้อง: ตัวพิมพ์เล็ก ไม่มีช่องว่าง ยาวไม่เกิน 100 */
export function toChannelName(input: string): string {
  const cleaned = input
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}\-_]/gu, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
  return cleaned || 'ticket'
}
