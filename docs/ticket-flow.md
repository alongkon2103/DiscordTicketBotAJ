# Flow ของระบบ Ticket

เอกสารนี้อธิบายกลไกของระบบ ticket ตั้งแต่ตอนตั้งค่าในเว็บจนถึงตอนห้องถูกลบ
เขียนไว้ให้คนหรือ AI ที่เพิ่งเข้ามาอ่านโค้ดเข้าใจภาพรวมก่อนลงไปแก้จริง

## สถาปัตยกรรมโดยย่อ

บอทกับหน้าเว็บ **รันในโปรเซสเดียวกัน** — `src/instrumentation.ts` ถูก Next เรียกตอน boot
แล้วเรียก `startBot()` ต่อ ทำให้ server action ของหน้าเว็บเรียก Discord client ตัวเดียวกับที่รับ event ได้เลย
ไม่ต้องมี IPC หรือ message queue

```
Next.js process
├── instrumentation.ts ──► startBot()
│                          ├── registerInteractionHandlers()  ปุ่ม/dropdown/modal
│                          ├── registerCommandHandlers()      slash command
│                          ├── registerMemberHandlers()       คนเข้า/ออก
│                          ├── bindShutdown()
│                          └── on clientReady:
│                              ├── registerSlashCommands()    ลงทะเบียนแบบ guild
│                              ├── cleanupPendingTickets()    เก็บกวาดแถวค้าง
│                              └── startScheduler()           คิวประกาศ ทุก 30 วิ
└── app/(dashboard)/** ──► server actions ──► prisma + Discord client เดียวกัน
```

**สำคัญ:** handler ทั้งหมดถูกผูกกับ client **ก่อน** `client.login()` เสมอ ไม่งั้น interaction
ที่เข้ามาช่วงแรกจะหลุด และ `startBot()` ใช้ singleton บน `globalThis` เพราะ dev mode ของ Next
รีโหลดโมดูลได้หลายรอบ ถ้าไม่กันจะ login ซ้ำจนโดน rate limit

## โครงข้อมูล

| Model | หน้าที่ | ความสัมพันธ์ |
| --- | --- | --- |
| `TicketType` | นิยามประเภท ticket หนึ่งอัน — category ปลายทาง, role ทีมงาน, ข้อความแรก, ลิมิต | มี `ModalField[]` |
| `ModalField` | หนึ่งช่องในฟอร์มที่เด้งตอนกดเปิด (สูงสุด 5 ช่อง) | เป็นของ `TicketType` |
| `Panel` | ข้อความที่ส่งไปวางในห้อง เก็บ `channelId` + `messageId` ที่ส่งไปแล้ว | มี `PanelItem[]` |
| `PanelItem` | หนึ่งปุ่ม/ตัวเลือกบน panel — เก็บแค่หน้าตา (label, สี, แถว) แล้วชี้ไป `TicketType` | เชื่อม `Panel` ↔ `TicketType` |
| `Ticket` | หนึ่งห้องที่ถูกเปิด — `number`, `channelId`, `openerId`, `status`, `answers` | อ้าง `TicketType`, มี `TicketTranscript` |
| `TicketTranscript` | บันทึกแชททั้งห้องเป็น JSON | 1:1 กับ `Ticket` |

`Panel` แยกจาก `TicketType` เพื่อให้ประเภทเดียวเอาไปวางได้หลาย panel โดยไม่ต้องตั้งค่าซ้ำ
`PanelItem` เก็บเฉพาะเรื่องหน้าตา ส่วนพฤติกรรมทั้งหมดอยู่ที่ `TicketType`

**คอลัมน์ที่เป็น list หรือ object เก็บเป็น `String` ที่บรรจุ JSON** (`categoryIds`, `staffRoleIds`,
`openPayload`, `answers`, ...) แล้ว parse ด้วย Zod ที่ `src/lib/schema/*` ตอนอ่าน
อย่าอ่านตรงๆ ให้ใช้ `readIdList()` / `readJson()` จาก `src/lib/json-column.ts` ซึ่งคืนค่า fallback
เมื่อข้อมูลพังแทนที่จะ throw กลางหน้าเว็บ

## customId — ตัวเชื่อมระหว่างปุ่มกับโค้ด

Discord ส่งกลับมาแค่ string เดียวเวลาคนกดปุ่ม ทุกอย่างจึงเข้ารหัสไว้ใน `customId`
นิยามรวมอยู่ที่ `src/lib/discord/custom-id.ts` รูปแบบ `tk:<action>:<id>`

| customId | เกิดจาก | `<id>` คืออะไร |
| --- | --- | --- |
| `tk:open:<id>` | ปุ่มบน panel | `TicketType.id` |
| `tk:pick:<id>` | dropdown บน panel (ค่าที่เลือก = `TicketType.id`) | `Panel.id` |
| `tk:modal:<id>` | ฟอร์มที่เด้งขึ้นมา | `TicketType.id` |
| `tk:close:<id>` | ปุ่มปิดในห้อง | `Ticket.id` |
| `tk:close!:<id>` | ปุ่มยืนยันปิด | `Ticket.id` |
| `tk:members:<id>` | ปุ่มจัดการสมาชิก | `Ticket.id` |
| `tk:add:<id>` / `tk:rm:<id>` | user select ที่โผล่หลังกดจัดการสมาชิก | `Ticket.id` |
| `tk:script:<id>` | ปุ่มบันทึกแชท | `Ticket.id` |
| `tk:reopen:<id>` / `tk:del:<id>` | ปุ่มที่โผล่หลังปิดแล้ว | `Ticket.id` |

ตัวแยก id ใช้ `lastIndexOf(':')` ไม่ใช่ `split(':')[2]` เพราะ `tk:close!:` มี `!` คั่น
และการ route ใช้ `startsWith()` — สังเกตว่า `tk:close!:` ไม่ match `tk:close:`
เพราะตัวที่ 9 เป็น `!` กับ `:` คนละตัว ถ้าจะเพิ่ม action ใหม่ต้องระวังจุดนี้

## Flow 1 — ตั้งค่าและส่ง panel (ฝั่งเว็บ)

1. แอดมินสร้าง `TicketType` ที่ `/ticket-types/[id]` ตั้ง category, role ทีมงาน, ฟิลด์ในฟอร์ม, ข้อความแรก
2. สร้าง `Panel` ที่ `/panels/[id]` เพิ่ม `PanelItem` ชี้ไปยัง `TicketType` ที่ต้องการ
3. กด **บันทึกและส่ง** → `savePanel()` → `publishPanel()`
   - `buildPanelComponents()` แปลง `PanelItem[]` เป็นปุ่มหรือ dropdown
   - ส่งข้อความแล้วเก็บ `channelId` + `messageId` ลง DB
4. ครั้งต่อไปกดบันทึก → `syncPanelIfPublished()` **แก้ข้อความเดิม** ไม่ส่งใหม่
   - ถ้าข้อความเดิมถูกลบไปแล้ว จะส่งใหม่ให้อัตโนมัติแทนที่จะ error

## Flow 2 — เปิด ticket

```mermaid
sequenceDiagram
    participant U as สมาชิก
    participant D as Discord
    participant H as interactions.ts
    participant C as createTicket()
    participant DB as ฐานข้อมูล

    U->>D: กดปุ่มบน panel
    D->>H: tk:open:&lt;ticketTypeId&gt;
    H->>DB: โหลด TicketType + fields
    H->>H: checkEligibility()
    alt ไม่ผ่าน
        H-->>U: ข้อความบอกเหตุผล (ephemeral)
    else มีฟิลด์ให้กรอก
        H-->>D: showModal(tk:modal:&lt;id&gt;)
        U->>D: กรอกแล้วส่ง
        D->>H: modal submit
        H->>H: checkEligibility() ซ้ำอีกรอบ
        H->>H: extractAnswers()
        H->>C: createTicket()
    else ไม่มีฟิลด์
        H->>C: createTicket() ทันที
    end
    C->>DB: จองเลข + สร้างแถว
    C->>D: สร้างห้อง + ส่งข้อความแรก
    C-->>U: ลิงก์ไปห้องที่เปิดให้
```

### `checkEligibility()` — ตรวจตามลำดับนี้

อยู่ที่ `src/lib/discord/ticket/create.ts` หยุดที่เงื่อนไขแรกที่ไม่ผ่าน

1. `type.enabled` เป็น false → ตอบด้วย `disabledMessage`
2. มี role อยู่ใน `deniedRoleIds` → ปฏิเสธ (ตรวจก่อน allowed เสมอ)
3. `allowedRoleIds` ไม่ว่างแต่ไม่มี role ที่ตรง → ปฏิเสธ
4. เปิดค้างอยู่ครบ `maxOpenPerUser` แล้ว → ปฏิเสธ พร้อมลิงก์ห้องเดิม
5. ยังไม่พ้น `cooldownSeconds` นับจาก `closedAt` ของ ticket ล่าสุด → ปฏิเสธ

**เรียกสองครั้ง** — ครั้งแรกก่อนเด้ง modal ครั้งที่สองตอน modal submit
เพราะระหว่างที่คนกำลังกรอกฟอร์มอาจไปเปิดห้องอื่นจนเต็มลิมิตแล้ว

### `createTicket()` — ลำดับที่ห้ามสลับ

1. **`pickCategory()`** — เช็คว่าเซิร์ฟเวอร์ยังไม่ครบ 500 ห้อง แล้วหา category แรกใน `categoryIds`
   ที่มีห้องน้อยกว่า 50 (ลิมิตของ Discord) จึงตั้ง category ได้หลายอันเป็นตัวสำรอง
2. **`reserveTicket()`** — จองเลข ticket โดยสร้างแถวใน DB **ก่อน** สร้างห้องจริง
   - ใส่ `channelId` ชั่วคราวเป็น `pending:<uuid>` เพราะยังไม่รู้ id ห้อง แต่คอลัมน์เป็น unique และห้าม null
   - อ่านเลขล่าสุด +1 แล้วเขียน ถ้าชน unique constraint (`P2002`) แปลว่ามีคนแย่งเลขไป → วนลองเลขถัดไป สูงสุด 8 รอบ
   - ต้องจองก่อนเพราะเทมเพลตชื่อห้องใช้ `{number}`
3. **สร้างห้อง** ด้วย permission overwrite: `@everyone` deny ViewChannel, คนเปิด allow ชุดพื้นฐาน,
   role ทีมงาน allow ชุดเดียวกัน + ManageMessages
   - ถ้าล้มเหลว → **ลบแถวที่จองไว้ทิ้ง** ไม่ให้เหลือ ticket ผีที่ไม่มีห้องจริง
4. **อัปเดตแถว** ใส่ `channelId` จริงกับ `answers`
5. **ประกอบข้อความแรก** จาก `openPayload` (แทนตัวแปร `{user}` `{ticket.number}` `{field.<key>}` ฯลฯ)
   ต่อท้ายด้วย embed สรุปคำตอบถ้า `showAnswers` เปิดอยู่ และเติมข้อความแท็กตาม `pingOpener` / `pingRoleIds`
6. **แนบไฟล์** — รวมรูปใน embed ที่อัปโหลดไว้ (`upload:` → `attachment://`) กับไฟล์ที่ผู้ใช้แนบมาในฟอร์ม
   ไฟล์จาก modal มีลิงก์อายุสั้น ต้องโหลดมาโพสต์ซ้ำทันที ไม่งั้นลิงก์ตาย
7. **ส่งแล้วปักหมุด** พร้อมปุ่ม 3 อัน: ปิด Ticket / เพิ่ม-นำออกสมาชิก / บันทึกแชท

> `cleanupPendingTickets()` ทำงานตอนบอท ready เพื่อลบแถวที่ `channelId` ขึ้นต้นด้วย `pending:`
> ซึ่งเกิดเมื่อโปรเซสดับระหว่างขั้นที่ 2 กับ 4 ถ้าไม่ลบ แถวพวกนี้จะถูกนับเป็น ticket ที่เปิดค้าง
> ทำให้เจ้าตัวเปิดใหม่ไม่ได้

## Flow 3 — จัดการในห้อง

ทุก action ตรวจสิทธิ์ก่อนเสมอ มีสองระดับ

- `canManage()` — เจ้าของ ticket **หรือ** ทีมงาน (ใช้กับ ปิด, บันทึกแชท)
- `staffOnly()` — ทีมงานเท่านั้น (ใช้กับ จัดการสมาชิก, เปิดใหม่, ลบห้อง)

ทีมงาน = มี role ใน `staffRoleIds` **หรือ** มีสิทธิ์ `ManageChannels`

| ปุ่ม | ทำอะไร |
| --- | --- |
| ปิด Ticket | ตอบ ephemeral พร้อมปุ่มยืนยัน ไม่ปิดทันที |
| ยืนยันปิด | `archiveTicket()` |
| เพิ่ม/นำออกสมาชิก | ตอบ ephemeral ที่มี user select 2 อัน → `changeTicketMembers()` แก้ permission overwrite แล้วอัปเดต `addedUserIds` (เจ้าของ ticket นำออกไม่ได้) |
| บันทึกแชท | ดึงข้อความตอนนี้ เซฟลง DB แล้วส่งไฟล์ HTML กลับแบบ ephemeral โดยยังไม่ปิดห้อง |

## Flow 4 — ปิดและลบ (`archiveTicket()`)

อยู่ที่ `src/lib/discord/ticket/close.ts` ลำดับสำคัญ

1. ถ้าห้องหายไปแล้ว (โดนลบมือ) → อัปเดต status เป็น `deleted` แล้วจบ ไม่ต้องทำต่อ
2. **`collectMessages()` ก่อนแตะอย่างอื่น** — ดึงทีละ 100 ข้อความ สูงสุด 5000 แล้ว `saveTranscript()`
   ทำก่อนเพราะถ้าขั้นตอนหลังพลาด อย่างน้อยบันทึกแชทต้องรอด
3. อัปเดต `status = 'archived'` พร้อม `closedAt` / `closedById` / `closedByTag`
4. ตัดสิทธิ์ `ViewChannel` + `SendMessages` ของคนเปิดและทุกคนใน `addedUserIds` — **ทีมงานยังเห็นอยู่**
5. ย้ายห้องไป `archiveCategoryId` ถ้าตั้งไว้
6. โพสต์ embed สรุปในห้อง พร้อมปุ่ม **เปิดใหม่** / **ลบห้องถาวร**
7. ส่ง embed สรุป + ไฟล์ HTML เข้าห้อง `ticketLogChannelId` (ถ้าตั้งไว้)

### วงจรของ `status`

```
open ──ยืนยันปิด──► archived ──ลบห้องถาวร──► deleted
                       │
                       └──เปิดใหม่──► open   (คืนสิทธิ์ + ย้ายกลับ category แรก)
```

`deleted` = ห้องไม่มีอยู่แล้ว แต่แถวกับ transcript ยังอยู่ให้ดูย้อนหลังในเว็บที่ `/tickets/[id]`

## Flow 5 — Slash command

`/close` `/add` `/remove` `/rename` อยู่ที่ `handlers/commands.ts`
ทั้งหมดหา ticket จาก `channelId` ของห้องที่พิมพ์คำสั่ง ถ้าไม่ใช่ห้อง ticket จะตอบปฏิเสธ
logic ใช้ร่วมกับปุ่ม (`archiveTicket()`, `changeTicketMembers()`) ไม่ได้เขียนซ้ำ

ลงทะเบียนแบบ guild command ตอนบอท ready เพื่อให้เห็นผลทันที ไม่ต้องรอ Discord กระจาย cache แบบ global

## จุดที่ต้องระวังเวลาแก้โค้ด

- **ลำดับใน `createTicket()` ห้ามสลับ** — จองเลขต้องมาก่อนสร้างห้อง เพราะชื่อห้องใช้เลขนั้น
  และถ้าสร้างห้องพลาดต้องลบแถวที่จองไว้
- **`checkEligibility()` ต้องเรียกสองรอบ** ถ้าตัดรอบที่สองออกจะเปิดช่องให้แหกลิมิตได้
- **`collectMessages()` ต้องมาก่อนตัดสิทธิ์** ไม่งั้นบอทอาจอ่านห้องไม่ได้แล้ว
- **customId มีเพดาน 100 ตัวอักษร** ตอนนี้ใช้ `tk:` + action + cuid 25 ตัว ยังเหลือเยอะ
- **อย่าอ่านคอลัมน์ JSON ตรงๆ** ใช้ helper ใน `json-column.ts` เสมอ
- **`instances: 1` ใน pm2 ห้ามเปลี่ยนเป็น cluster** — บอทหลายตัวด้วย token เดียวจะรับ event เดียวกันซ้ำกัน
  ทำให้กดเปิด ticket ครั้งเดียวได้หลายห้อง

## ไฟล์ที่เกี่ยวข้อง

```
src/lib/discord/
├── custom-id.ts              นิยาม customId ทั้งหมด (แยกไว้กัน import วนกัน)
├── panel.ts                  ประกอบและส่ง panel
├── message.ts                แปลง payload จาก DB เป็น embed จริง + จัดการรูปที่อัปโหลด
├── template.ts               แทนค่าตัวแปร {user} {ticket.number} ฯลฯ
├── handlers/
│   ├── interactions.ts       route ปุ่ม/dropdown/modal ทั้งหมด
│   └── commands.ts           slash command
└── ticket/
    ├── create.ts             checkEligibility, pickCategory, reserveTicket, createTicket
    ├── close.ts              archiveTicket, deleteTicketChannel, reopenTicket
    ├── members.ts            เพิ่ม/นำออกสมาชิก
    ├── modal.ts              ประกอบ modal จาก ModalField + อ่านคำตอบกลับ
    └── transcript.ts         ดึงข้อความ, เซฟ, สร้าง HTML
```
