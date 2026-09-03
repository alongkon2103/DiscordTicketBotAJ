import Link from 'next/link'

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: '100dvh',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
        textAlign: 'center',
      }}
    >
      <div>
        <p className="label-eyebrow" style={{ marginBottom: 12 }}>
          404
        </p>
        <h1 style={{ fontSize: 20, marginBottom: 8 }}>ไม่พบหน้านี้</h1>
        <p className="muted" style={{ fontSize: 14, marginBottom: 24 }}>
          ลิงก์อาจผิด หรือสิ่งที่คุณกำลังหาถูกลบไปแล้ว
        </p>
        <Link className="btn" href="/">
          กลับหน้าแรก
        </Link>
      </div>
    </main>
  )
}
