import type { Client, Guild } from 'discord.js'
import { env } from '@/lib/env'
import { createDiscordClient } from './client'
import { registerCommandHandlers, registerSlashCommands } from './handlers/commands'
import { registerInteractionHandlers } from './handlers/interactions'
import { registerMemberHandlers } from './handlers/members'
import { cleanupPendingTickets } from './ticket/create'
import { startScheduler } from '@/lib/scheduler'
import { bindShutdown } from '@/lib/shutdown'

export class BotNotReadyError extends Error {
  constructor(message = 'บอทยังไม่ได้เชื่อมต่อกับ Discord') {
    super(message)
    this.name = 'BotNotReadyError'
  }
}

type BotState = {
  client: Client
  /** resolve เมื่อ ready, reject เมื่อ login ไม่ผ่าน */
  ready: Promise<Client<true>>
  status: 'connecting' | 'ready' | 'failed'
  error: string | null
}

// dev mode ของ Next รีโหลดโมดูลได้หลายรอบ — ผูกไว้กับ globalThis กัน login ซ้ำจนโดน rate limit
const globalForBot = globalThis as unknown as { __ajBot?: BotState }

export function startBot(): BotState {
  if (globalForBot.__ajBot) return globalForBot.__ajBot

  const client = createDiscordClient()

  // ผูก handler ก่อน login เสมอ ไม่งั้น interaction ที่เข้ามาช่วงแรกจะหลุด
  registerInteractionHandlers(client)
  registerCommandHandlers(client)
  registerMemberHandlers(client)
  bindShutdown(client)

  const state: BotState = {
    client,
    status: 'connecting',
    error: null,
    ready: new Promise<Client<true>>((resolve, reject) => {
      client.once('clientReady', (c) => {
        state.status = 'ready'
        state.error = null
        console.log(`[bot] เชื่อมต่อแล้วในชื่อ ${c.user.tag}`)
        void registerSlashCommands()
        void cleanupPendingTickets().catch(() => {})
        // เริ่มหลังบอทพร้อม เพราะการส่งประกาศต้องใช้ gateway
        startScheduler()
        resolve(c)
      })

      client.login(env.BOT_TOKEN).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        state.status = 'failed'
        state.error = message

        if (message.includes('disallowed intents')) {
          console.error(
            '[bot] login ไม่ผ่าน: ยังไม่ได้เปิด privileged intents\n' +
              '      เปิดที่ Developer Portal > Bot > Privileged Gateway Intents\n' +
              '      ต้องเปิดทั้ง SERVER MEMBERS INTENT และ MESSAGE CONTENT INTENT',
          )
        } else {
          console.error('[bot] login ไม่ผ่าน:', message)
        }
        reject(err instanceof Error ? err : new Error(message))
      })
    }),
  }

  // กัน unhandled rejection ตอน login พัง — ตัว error เก็บไว้ใน state.error แล้ว
  state.ready.catch(() => {})

  client.on('error', (err) => console.error('[bot] client error:', err.message))

  globalForBot.__ajBot = state
  return state
}

export function getBotState(): BotState | null {
  return globalForBot.__ajBot ?? null
}

/** สถานะไว้แสดงในหน้าเว็บ */
export function getBotStatus(): { status: BotState['status'] | 'stopped'; error: string | null; tag: string | null } {
  const state = globalForBot.__ajBot
  if (!state) return { status: 'stopped', error: null, tag: null }
  return {
    status: state.status,
    error: state.error,
    tag: state.client.user?.tag ?? null,
  }
}

/** ใช้ในฝั่งเว็บเวลาต้องอ่านห้อง/role — throw BotNotReadyError ถ้าบอทยังไม่พร้อม */
export async function getGuild(): Promise<Guild> {
  const state = globalForBot.__ajBot
  if (!state) throw new BotNotReadyError('บอทยังไม่ได้เริ่มทำงาน')
  if (state.status === 'failed') throw new BotNotReadyError(state.error ?? 'บอทเชื่อมต่อไม่สำเร็จ')

  const client = await state.ready
  const guild = await client.guilds.fetch(env.GUILD_ID).catch(() => null)

  if (!guild) {
    throw new BotNotReadyError(
      `บอทไม่ได้อยู่ในเซิร์ฟเวอร์ ${env.GUILD_ID} — เชิญบอทเข้าเซิร์ฟเวอร์ หรือตรวจ GUILD_ID ใน .env`,
    )
  }
  return guild
}
