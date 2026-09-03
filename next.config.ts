import path from 'node:path'
import type { NextConfig } from 'next'

/**
 * แพ็กเกจที่รันได้เฉพาะฝั่ง Node — ห้ามให้ bundler แตะ
 * discord.js ต้องการ worker_threads/zlib, better-sqlite3 เป็น native binding
 */
const NODE_ONLY_PACKAGES = [
  'discord.js',
  '@discordjs/ws',
  '@discordjs/rest',
  '@discordjs/collection',
  '@discordjs/builders',
  '@discordjs/util',
  '@prisma/client',
  '@prisma/adapter-better-sqlite3',
  'better-sqlite3',
  'bindings',
]

const config: NextConfig = {
  serverExternalPackages: NODE_ONLY_PACKAGES,

  // มี package-lock.json อยู่ที่ home directory ด้วย — บอก Next ให้ยึดโฟลเดอร์นี้เป็น root
  outputFileTracingRoot: path.resolve('.'),

  webpack(config, { nextRuntime, webpack }) {
    if (nextRuntime === 'edge') {
      // Next คอมไพล์ instrumentation.ts ให้ edge runtime ด้วยเสมอ ซึ่งไม่มี fs / worker_threads
      // instrumentation.ts เช็ค NEXT_RUNTIME ก่อน import อยู่แล้ว โค้ดนี้จึงไม่เคยรันบน edge
      //
      // สลับ bot.ts เป็น stub เฉพาะ build ของ edge = ตัดทั้ง dependency graph
      // (discord.js → prisma → better-sqlite3 → bindings) ออกทีเดียว
      // แทนการไล่ใส่ externals ทีละแพ็กเกจซึ่งไม่มีวันจบ
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(
          /lib[\\/]discord[\\/]bot$/,
          path.resolve('src/lib/discord/bot.edge-stub.ts'),
        ),
      )
    }
    return config
  },
}

export default config
