import { redirect } from 'next/navigation'
import { resolveAccess } from '@/lib/auth/guard'
import styles from './login.module.css'

const REASONS: Record<string, { title: string; body: string }> = {
  'not-member': {
    title: 'บัญชีนี้ไม่ได้อยู่ในเซิร์ฟเวอร์',
    body: 'เข้าเซิร์ฟเวอร์ที่บอทดูแลก่อน แล้วลองใหม่อีกครั้ง',
  },
  'not-admin': {
    title: 'ไม่มีสิทธิ์เข้าหน้าจัดการ',
    body: 'บัญชีนี้ไม่มี role ที่กำหนดไว้ ให้เจ้าของระบบเพิ่ม role ให้ที่หน้าตั้งค่า',
  },
  'bot-unavailable': {
    title: 'บอทยังเชื่อมต่อ Discord ไม่ได้',
    body: 'ตรวจ BOT_TOKEN และเปิด privileged intents ทั้งสองตัวใน Developer Portal แล้วรีสตาร์ต',
  },
  error: { title: 'เข้าสู่ระบบไม่สำเร็จ', body: '' },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; detail?: string }>
}) {
  const access = await resolveAccess()
  if (access.ok) redirect('/')

  const { reason, detail } = await searchParams
  const notice = reason ? REASONS[reason] : undefined

  return (
    <main className={styles.shell}>
      <div className={styles.panel}>
        <div className={styles.mark}>ระบบจัดการบอท</div>

        <h1 className={styles.title}>เข้าสู่ระบบ</h1>
        <p className={styles.lede}>
          ใช้บัญชี Discord ของคุณ ระบบจะตรวจสิทธิ์จาก role ในเซิร์ฟเวอร์
        </p>

        <a className={`btn btn-primary ${styles.action}`} href="/api/auth/login">
          เข้าสู่ระบบด้วย Discord
        </a>

        {notice ? (
          <div className={styles.notice}>
            <div className={styles.noticeTitle}>{notice.title}</div>
            {detail ?? notice.body}
          </div>
        ) : null}

        <p className={styles.foot}>
          ขอสิทธิ์แค่ <span className="mono">identify</span> — ดูชื่อและรูปโปรไฟล์เท่านั้น
          ไม่เข้าถึงข้อความหรือเซิร์ฟเวอร์อื่นของคุณ
        </p>
      </div>
    </main>
  )
}
