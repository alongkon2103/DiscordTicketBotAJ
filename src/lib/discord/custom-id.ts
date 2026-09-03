/**
 * customId ของทุก component ที่บอทส่งออกไป
 *
 * แยกไว้เป็นโมดูลเดี่ยวเพราะทั้ง panel.ts และตัวจัดการ interaction ต่างต้องใช้
 * ถ้าปล่อยไว้ใน panel.ts จะเกิดวงจร bot → interactions → panel → bot
 *
 * รูปแบบ "tk:<action>:<id>" — Discord จำกัด customId ที่ 100 ตัวอักษร (cuid ยาว 25 พอเหลือเฟือ)
 */
export const CUSTOM_ID = {
  /** ปุ่มเปิด ticket บน panel */
  open: (ticketTypeId: string) => `tk:open:${ticketTypeId}`,
  /** dropdown เลือกประเภทบน panel */
  pick: (panelId: string) => `tk:pick:${panelId}`,
  /** modal ที่เด้งหลังเลือกประเภท */
  modal: (ticketTypeId: string) => `tk:modal:${ticketTypeId}`,
  close: (ticketId: string) => `tk:close:${ticketId}`,
  closeConfirm: (ticketId: string) => `tk:close!:${ticketId}`,
  members: (ticketId: string) => `tk:members:${ticketId}`,
  memberAdd: (ticketId: string) => `tk:add:${ticketId}`,
  memberRemove: (ticketId: string) => `tk:rm:${ticketId}`,
  transcript: (ticketId: string) => `tk:script:${ticketId}`,
  reopen: (ticketId: string) => `tk:reopen:${ticketId}`,
  del: (ticketId: string) => `tk:del:${ticketId}`,
} as const
