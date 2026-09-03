// Next.js ประกาศ type ไว้แค่ '*.module.css'
// global CSS ที่ import แบบ side-effect (import './globals.css') ต้องประกาศเอง ไม่งั้น TS 7 ฟ้อง TS2882
declare module '*.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}
