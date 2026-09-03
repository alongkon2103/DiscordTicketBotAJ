# ฐานข้อมูล

โปรเจกต์นี้ใช้ **PostgreSQL** — `provider` ใน `prisma/schema.prisma` ตั้งเป็น `postgresql` แล้ว
และ `src/lib/prisma.ts` เลือก driver adapter จากรูปแบบของ `DATABASE_URL` ให้เองตอนรัน

## ตั้งค่าครั้งแรก

ชี้ `DATABASE_URL` ใน `.env` ไปที่ฐานข้อมูล:

```
DATABASE_URL=postgresql://user:password@host:5432/botdiscord
```

สร้างตารางทั้งหมด:

```bash
npx prisma migrate deploy
```

`migrate deploy` ใช้ไฟล์ migration ที่มีอยู่แล้วใน repo เหมาะกับ production
ส่วน `migrate dev` เอาไว้ใช้ตอนแก้สคีมาระหว่างพัฒนา (มันจะสร้าง migration ใหม่ให้)

## ย้ายข้อมูลข้ามฐานข้อมูล

ใช้ตอนย้ายเครื่อง ย้ายจาก dev ไป production หรือย้อนกลับ

ดัมพ์จากฐานข้อมูลที่ `DATABASE_URL` ชี้อยู่ตอนนั้น:

```bash
node --env-file=.env scripts/data.mjs export
```

ได้ไฟล์ `data/export.json` — เปลี่ยน `DATABASE_URL` ไปที่ปลายทาง รัน `npx prisma migrate deploy`
ให้ตารางพร้อมก่อน แล้วค่อยนำเข้า:

```bash
node --env-file=.env scripts/data.mjs import
```

สคริปต์เขียนทีละแถวตามลำดับ foreign key ถ้าแถวไหนพังจะบอกว่าแถวไหนแล้วทำต่อ ไม่ล้มทั้งก้อน

## ทำไม list กับ object ถึงเก็บเป็น String

คอลัมน์อย่าง `staffRoleIds`, `openPayload`, `answers` เก็บเป็น `String` ที่บรรจุ JSON
แล้ว parse ด้วย Zod ที่ `src/lib/schema/*` แทนการใช้ `Json` หรือ `String[]` ของ Prisma

เดิมทำเพราะตอนพัฒนาใช้ SQLite ซึ่งไม่รองรับชนิดพวกนั้น ตอนนี้ย้ายมา Postgres แล้วแต่คงรูปแบบไว้
เพราะข้อมูลที่มีอยู่ถูกเขียนเป็น JSON string แล้ว และการ validate ด้วย Zod ตอนอ่าน
ให้ type ที่แน่นอนกว่าคอลัมน์ `Json` ที่เป็น `any` อยู่ดี

## ข้อควรรู้

- รูปที่อัปโหลดเก็บเป็นไฟล์ใน `public/uploads/` ไม่ได้อยู่ในฐานข้อมูล
  ต้องคัดลอกโฟลเดอร์นี้ตามไปด้วยถ้าย้ายเครื่อง
- `data/export.json` มีการตั้งค่าทั้งหมดอยู่ข้างใน อยู่ในโฟลเดอร์ที่ gitignore ไว้แล้ว

## ถ้าอยากกลับไปใช้ SQLite ตอนพัฒนา

1. `node --env-file=.env scripts/data.mjs export` (ถ้ามีข้อมูลที่ต้องเก็บ)
2. แก้ `provider` ใน `prisma/schema.prisma` เป็น `"sqlite"`
3. เปลี่ยน `DATABASE_URL` เป็น `file:./data/app.db`
4. `rm -rf prisma/migrations && npx prisma migrate dev --name init`
5. `node --env-file=.env scripts/data.mjs import`

โค้ดฝั่งแอปไม่ต้องแก้เลย — adapter เลือกให้เองจาก `DATABASE_URL`
