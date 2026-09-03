# ย้ายจาก SQLite ไป PostgreSQL

ทุก model ในสคีมาถูกออกแบบให้ย้ายได้อยู่แล้ว — ไม่มี `Json`, ไม่มี `String[]`, ไม่มี `enum`
คอลัมน์ที่เก็บโครงสร้างเป็น `String` ที่บรรจุ JSON แล้ว parse ด้วย Zod ที่ชั้นแอป
จึงไม่ต้องแก้ model ใดๆ มีแค่ `provider` บรรทัดเดียวที่ต้องเปลี่ยนด้วยมือ

> Prisma ไม่ยอมให้ใส่ `env()` ที่ `provider` (ตรวจแล้วกับ Prisma 7.10 — ขึ้น validation error)
> ส่วนการเลือก driver adapter ตอนรันจริง `src/lib/prisma.ts` ดูจาก `DATABASE_URL` ให้เองอัตโนมัติ

## ขั้นตอน

### 1. ดัมพ์ข้อมูลออกก่อน — ทำตอนที่ยังเป็น SQLite

```bash
node --env-file=.env scripts/data.mjs export
```

ได้ไฟล์ `data/export.json` เก็บทุกตาราง ถ้าเป็นการติดตั้งใหม่ที่ยังไม่มีข้อมูลก็ข้ามข้อนี้ได้

### 2. เตรียมฐานข้อมูล PostgreSQL

ใช้ Docker ในเครื่อง:

```bash
docker run -d --name aj-postgres -p 5432:5432 -e POSTGRES_PASSWORD=changeme -e POSTGRES_DB=botdiscord postgres:17
```

หรือใช้บริการคลาวด์ (Neon, Supabase, Railway) แล้วคัดลอก connection string มา

### 3. แก้ provider ในสคีมา

เปิด `prisma/schema.prisma` แล้วเปลี่ยนบรรทัดเดียว:

```prisma
datasource db {
  provider = "postgresql"   // เดิมคือ "sqlite"
}
```

### 4. ชี้ DATABASE_URL ไปที่ฐานข้อมูลใหม่

ใน `.env`:

```
DATABASE_URL=postgresql://postgres:changeme@localhost:5432/botdiscord
```

### 5. สร้าง migration ใหม่

ไฟล์ migration เดิมเป็น SQL ของ SQLite ใช้กับ Postgres ไม่ได้ ต้องเริ่มใหม่:

```bash
rm -rf prisma/migrations
```

```bash
npx prisma migrate dev --name init
```

### 6. นำข้อมูลเข้า

```bash
node --env-file=.env scripts/data.mjs import
```

สคริปต์เขียนทีละแถวตามลำดับ foreign key ถ้าแถวไหนพังจะบอกว่าแถวไหนแล้วทำต่อ ไม่ล้มทั้งก้อน

### 7. รีสตาร์ต

```bash
npm run build && pm2 restart botdiscord-aj
```

## ตรวจว่าย้ายสำเร็จ

เปิดหน้าเว็บแล้วดูว่า:

- หน้า **ประเภท Ticket** ยังมีประเภทเดิมครบ พร้อม category และ role ที่ตั้งไว้
- หน้า **Panel** ยังผูกกับห้องเดิม และปุ่มยังอยู่ครบ
- หน้า **รายการ Ticket** ยังเปิด transcript เก่าดูได้
- หน้า **บันทึกการใช้งาน** ยังมีประวัติเดิม

## ถ้าจะย้อนกลับมา SQLite

ทำกลับด้าน: export จาก Postgres → เปลี่ยน `provider` เป็น `"sqlite"` → เปลี่ยน `DATABASE_URL`
เป็น `file:./data/app.db` → `rm -rf prisma/migrations` → `npx prisma migrate dev --name init` → import

## ข้อควรรู้

- `data/export.json` มีการตั้งค่าทั้งหมดของคุณอยู่ข้างใน อยู่ในโฟลเดอร์ `data/` ที่ถูก gitignore ไว้แล้ว
- รูปที่อัปโหลดเก็บเป็นไฟล์ใน `public/uploads/` ไม่ได้อยู่ในฐานข้อมูล ต้องคัดลอกโฟลเดอร์นี้ตามไปด้วยถ้าย้ายเครื่อง
- Postgres บังคับ foreign key เข้มกว่า SQLite ถ้ามีข้อมูลกำพร้าค้างอยู่ตอน import จะเห็น error รายแถวชัดเจน
