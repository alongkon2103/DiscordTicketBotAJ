# ระบบจัดการบอท Discord

บอท Discord พร้อมหน้าเว็บสำหรับตั้งค่าทุกอย่าง — ระบบ Ticket, ข้อความต้อนรับ/อำลา และประกาศ
ไม่มีอะไรถูก hardcode ทุกอย่างตั้งค่าผ่านหน้าเว็บได้

## ทำอะไรได้บ้าง

**Ticket** — สร้างประเภท ticket ได้ไม่จำกัด แต่ละประเภทกำหนดเองได้ว่าสร้างห้องที่ category ไหน
(ใส่หลาย category เป็นตัวสำรองได้ เพราะ Discord จำกัด 50 ห้องต่อ category) ชื่อห้องเป็นเทมเพลต
ใครเห็นได้ ใครเปิดได้ เปิดค้างพร้อมกันได้กี่ห้อง และตอนกดเปิดจะถามอะไรบ้าง —
ฟอร์มรองรับครบทั้ง 9 แบบที่ Discord มี (ข้อความ, dropdown, เลือกสมาชิก/role/ห้อง, radio, checkbox, แนบไฟล์)

**Panel** — ข้อความพร้อมปุ่มหรือ dropdown ที่ส่งไปวางในห้อง แก้แล้วข้อความเดิมใน Discord อัปเดตตามอัตโนมัติ

**ต้อนรับ / อำลา** — ข้อความตอนคนเข้าและออก ตั้งคนละห้องได้ พร้อม autorole และปุ่มส่งทดสอบ

**ประกาศ** — เขียน เลือกได้หลายห้องพร้อมกัน เลือกแท็ก ส่งเลยหรือตั้งเวลา
ที่ส่งไปแล้วกลับมาแก้ได้ทุกห้องพร้อมกัน หรือวางลิงก์ข้อความเก่าของบอทมาแก้ก็ได้

**อื่นๆ** — บันทึกแชทตอนปิด ticket (ดูในเว็บหรือดาวน์โหลดเป็น HTML), สถิติย้อนหลัง 7 วัน,
บันทึกว่าใครแก้อะไรเมื่อไหร่

## ติดตั้ง

```bash
npm install
```

คัดลอก `.env.example` เป็น `.env` แล้วกรอกให้ครบ:

| ตัวแปร | หาได้จาก |
| --- | --- |
| `BOT_TOKEN` | Developer Portal → Bot → Token |
| `CLIENT_ID` | Developer Portal → General Information → Application ID |
| `CLIENT_SECRET` | Developer Portal → OAuth2 → Client Secret |
| `GUILD_ID` | คลิกขวาที่เซิร์ฟเวอร์ → Copy Server ID |
| `OWNER_IDS` | Discord user ID ของคุณ (คั่นด้วย comma) เข้าหน้าเว็บได้เสมอ |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |

สร้างฐานข้อมูล:

```bash
npx prisma migrate deploy
```

## ตั้งค่าฝั่ง Discord

**Developer Portal → Bot → Privileged Gateway Intents** ต้องเปิดสองอันนี้ ไม่งั้นบอทจะ login ไม่ผ่าน:

- `SERVER MEMBERS INTENT` — จับคนเข้า/ออกเซิร์ฟเวอร์
- `MESSAGE CONTENT INTENT` — อ่านข้อความตอนทำบันทึกแชท

**Developer Portal → OAuth2 → Redirects** เพิ่ม:

```
http://localhost:3000/api/auth/callback
```

**สิทธิ์ตอนเชิญบอทเข้าเซิร์ฟเวอร์** — Manage Channels, Manage Roles, View Channels, Send Messages,
Embed Links, Attach Files, Read Message History, Mention Everyone

**ลำดับ role** — ลาก role ของบอทขึ้นให้อยู่**เหนือ** role ทุกอันที่จะให้บอทแจก
Discord ไม่ให้แจก role ที่อยู่สูงกว่าหรือเท่ากับตัวเอง และสิทธิ์ Administrator ไม่ช่วยข้อนี้

## รัน

```bash
npm run dev
```

เปิด http://localhost:3000

## ขึ้น production

```bash
npm run build
```

```bash
pm2 start ecosystem.config.js
```

คุมด้วย `pm2 stop|restart|delete botdiscord-aj` และดู log ด้วย `pm2 logs botdiscord-aj`

> **อย่ารันซ้อนกัน** — บอทกับหน้าเว็บอยู่โปรเซสเดียวกัน ถ้ารัน `npm run dev` พร้อมกับ pm2
> จะมีบอทสองตัวต่อ Discord ด้วย token เดียวกัน ทำให้ทุกอย่างทำงานซ้ำสองรอบ
> เช็คก่อนสตาร์ตด้วย `lsof -nP -iTCP:3000 -sTCP:LISTEN`

### การปิดบอท

ปิดโปรเซส = ปิดบอท ไม่มีปุ่มปิดบอทแยก — `Ctrl+C` ตอน dev หรือ `pm2 stop botdiscord-aj` ตอน production

ตอนโปรเซสตาย ระบบปฏิบัติการปิด socket ให้เอง Discord จึงเห็นบอทออฟไลน์ทันที
ไม่ต้องรอ timeout และข้อมูลที่บันทึกไปแล้วไม่หาย

## คำสั่งที่มี

| คำสั่ง | ทำอะไร |
| --- | --- |
| `npm run dev` | รันโหมดพัฒนา |
| `npm run build` | build สำหรับ production |
| `npm start` | รัน production build |
| `npm run typecheck` | ตรวจ type ทั้งโปรเจกต์ |
| `npm run db:studio` | เปิด Prisma Studio ดูข้อมูลในฐานข้อมูล |
| `node --env-file=.env scripts/data.mjs export` | ดัมพ์ข้อมูลทั้งหมดเป็น JSON |

## ย้ายไป PostgreSQL

ดู [docs/postgres.md](docs/postgres.md) — สคีมาเตรียมไว้ให้แล้ว แก้ `provider` บรรทัดเดียว
แล้วใช้สคริปต์ย้ายข้อมูลที่มีให้

## โครงสร้าง

```
prisma/schema.prisma        สคีมาฐานข้อมูล
scripts/data.mjs            ดัมพ์/นำเข้าข้อมูลข้ามฐานข้อมูล
src/instrumentation.ts      จุดที่ Next เรียกตอน boot เพื่อสตาร์ตบอท
src/lib/discord/            ทุกอย่างที่คุยกับ Discord
  bot.ts                      lifecycle ของ client
  handlers/                   ตัวรับ interaction, slash command, คนเข้า/ออก
  ticket/                     สร้าง ปิด บันทึกแชท จัดการสมาชิกในห้อง
src/lib/schema/             Zod schema ของคอลัมน์ที่เก็บ JSON
src/app/(dashboard)/        หน้าเว็บทั้งหมด
```
