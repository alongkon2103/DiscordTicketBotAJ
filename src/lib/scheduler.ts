import { prisma } from '@/lib/prisma'
import { deliverAnnouncement } from '@/lib/announcements'

const TICK_MS = 30_000

type SchedulerState = { timer: NodeJS.Timeout; running: boolean }

// dev mode ของ Next รีโหลดโมดูลได้หลายรอบ — ผูกกับ globalThis กันตั้ง timer ซ้อนกัน
const globalForScheduler = globalThis as unknown as { __ajScheduler?: SchedulerState }

async function runDue(state: SchedulerState): Promise<void> {
  // กันรอบก่อนหน้าที่ยังส่งไม่เสร็จชนกับรอบใหม่
  if (state.running) return
  state.running = true

  try {
    const due = await prisma.announcement.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: new Date() } },
      select: { id: true, name: true },
      take: 20,
    })

    for (const item of due) {
      // จองไว้ก่อนส่ง ถ้าโปรเซสดับกลางทางจะไม่ถูกส่งซ้ำโดยรอบถัดไป
      const claimed = await prisma.announcement.updateMany({
        where: { id: item.id, status: 'scheduled' },
        data: { status: 'draft' },
      })
      if (claimed.count === 0) continue

      const label = item.name || item.id
      const result = await deliverAnnouncement(item.id)

      if (!result.ok) {
        console.error(`[scheduler] ส่งประกาศ "${label}" ไม่สำเร็จ: ${result.error}`)
        continue
      }

      console.log(
        `[scheduler] ส่งประกาศ "${label}" ตามเวลาแล้ว — ` +
          `สำเร็จ ${result.sent + result.edited} ห้อง, ไม่สำเร็จ ${result.failed} ห้อง`,
      )
      for (const outcome of result.outcomes.filter((o) => !o.ok)) {
        console.error(`[scheduler]   #${outcome.channelName}: ${outcome.error}`)
      }
    }
  } catch (err) {
    console.error('[scheduler] ตรวจคิวไม่สำเร็จ:', err instanceof Error ? err.message : err)
  } finally {
    state.running = false
  }
}

export function startScheduler(): void {
  if (globalForScheduler.__ajScheduler) return

  const state: SchedulerState = {
    running: false,
    timer: setInterval(() => void runDue(state), TICK_MS),
  }

  // ไม่ให้ timer กัน process ไม่ให้ปิดตอน shutdown
  state.timer.unref?.()

  globalForScheduler.__ajScheduler = state
  console.log(`[scheduler] เริ่มตรวจคิวประกาศทุก ${TICK_MS / 1000} วินาที`)

  // ตรวจทันทีหนึ่งรอบ เผื่อมีของค้างจากตอนที่บอทดับอยู่
  void runDue(state)
}
