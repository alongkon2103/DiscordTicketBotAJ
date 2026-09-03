module.exports = {
  apps: [
    {
      name: 'botdiscord-aj',
      // เรียก binary ของ next ตรงๆ ไม่ผ่าน npm เพื่อให้ pm2 คุมโปรเซสลูกได้ถูกตัว
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3500',

      // บอทต่อ Discord ด้วย token เดียว รันได้ instance เดียวเท่านั้น
      // ถ้าเพิ่มเป็น cluster จะมีบอทหลายตัวรับ event เดียวกันซ้ำกัน
      instances: 1,
      exec_mode: 'fork',

      autorestart: true,
      max_restarts: 10,
      // รีสตาร์ตถี่เกินไปมักแปลว่า config ผิด ไม่ใช่ปัญหาชั่วคราว
      min_uptime: '30s',
      restart_delay: 3000,

      env: {
        NODE_ENV: 'production',
        PORT: 3500,
      },
    },
  ],
}
