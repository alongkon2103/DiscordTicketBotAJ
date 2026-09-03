import { prisma } from '@/lib/prisma'

const DAY_MS = 24 * 60 * 60 * 1000

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export type DayBucket = { date: Date; label: string; opened: number; closed: number }
export type MemberDayBucket = { date: Date; label: string; joined: number; left: number }
export type TypeBreakdown = { name: string; open: number; total: number }

export type Stats = {
  openNow: number
  openedToday: number
  opened7d: number
  closed7d: number
  /** ชั่วโมงเฉลี่ยจากเปิดถึงปิด นับเฉพาะ 30 วันล่าสุด — null เมื่อยังไม่มีข้อมูล */
  avgResolutionHours: number | null
  ticketDays: DayBucket[]
  memberDays: MemberDayBucket[]
  joined7d: number
  left7d: number
  byType: TypeBreakdown[]
  announcementsSent30d: number
  /** จำนวนสมาชิกล่าสุดที่บันทึกไว้ — null เมื่อยังไม่เคยมีคนเข้าออกตั้งแต่ติดตั้ง */
  latestMemberCount: number | null
}

/**
 * ดึงข้อมูลดิบมาสรุปในฝั่ง JS แทนการเขียน SQL รายวัน
 * ปริมาณข้อมูลระดับเซิร์ฟเวอร์เดียวเล็กมาก และย้ายไป PostgreSQL ได้โดยไม่ต้องแก้อะไร
 */
export async function loadStats(): Promise<Stats> {
  const now = new Date()
  const todayStart = startOfDay(now)
  const weekStart = new Date(todayStart.getTime() - 6 * DAY_MS)
  const monthStart = new Date(now.getTime() - 30 * DAY_MS)

  const [openNow, openedToday, recentTickets, closedRecently, types, announcementsSent30d, memberLogs, latest] =
    await Promise.all([
      prisma.ticket.count({ where: { status: 'open' } }),
      prisma.ticket.count({ where: { openedAt: { gte: todayStart } } }),
      prisma.ticket.findMany({
        where: { OR: [{ openedAt: { gte: weekStart } }, { closedAt: { gte: weekStart } }] },
        select: { openedAt: true, closedAt: true },
      }),
      prisma.ticket.findMany({
        where: { closedAt: { gte: monthStart } },
        select: { openedAt: true, closedAt: true },
      }),
      prisma.ticketType.findMany({
        select: {
          name: true,
          tickets: { select: { status: true } },
        },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
      }),
      prisma.announcement.count({ where: { sentAt: { gte: monthStart } } }),
      prisma.memberLog.findMany({
        where: { createdAt: { gte: weekStart } },
        select: { kind: true, createdAt: true },
      }),
      prisma.memberLog.findFirst({
        orderBy: { createdAt: 'desc' },
        select: { memberCount: true },
      }),
    ])

  // สร้างช่องว่างของ 7 วันไว้ก่อน แล้วค่อยเทข้อมูลลง — วันที่ไม่มีข้อมูลจะได้ยังโผล่ในกราฟ
  const dayKeys: Date[] = []
  for (let i = 6; i >= 0; i -= 1) {
    dayKeys.push(new Date(todayStart.getTime() - i * DAY_MS))
  }
  const label = (d: Date) => d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
  const indexOfDay = (d: Date) =>
    Math.floor((startOfDay(d).getTime() - dayKeys[0]!.getTime()) / DAY_MS)

  const ticketDays: DayBucket[] = dayKeys.map((date) => ({
    date,
    label: label(date),
    opened: 0,
    closed: 0,
  }))

  for (const ticket of recentTickets) {
    const openIdx = indexOfDay(ticket.openedAt)
    if (openIdx >= 0 && openIdx < 7) ticketDays[openIdx]!.opened += 1

    if (ticket.closedAt) {
      const closeIdx = indexOfDay(ticket.closedAt)
      if (closeIdx >= 0 && closeIdx < 7) ticketDays[closeIdx]!.closed += 1
    }
  }

  const memberDays: MemberDayBucket[] = dayKeys.map((date) => ({
    date,
    label: label(date),
    joined: 0,
    left: 0,
  }))

  for (const log of memberLogs) {
    const idx = indexOfDay(log.createdAt)
    if (idx < 0 || idx >= 7) continue
    if (log.kind === 'join') memberDays[idx]!.joined += 1
    else memberDays[idx]!.left += 1
  }

  const durations = closedRecently
    .filter((t) => t.closedAt)
    .map((t) => t.closedAt!.getTime() - t.openedAt.getTime())
    .filter((ms) => ms > 0)

  const avgResolutionHours =
    durations.length > 0
      ? durations.reduce((sum, ms) => sum + ms, 0) / durations.length / (60 * 60 * 1000)
      : null

  return {
    openNow,
    openedToday,
    opened7d: ticketDays.reduce((sum, d) => sum + d.opened, 0),
    closed7d: ticketDays.reduce((sum, d) => sum + d.closed, 0),
    avgResolutionHours,
    ticketDays,
    memberDays,
    joined7d: memberDays.reduce((sum, d) => sum + d.joined, 0),
    left7d: memberDays.reduce((sum, d) => sum + d.left, 0),
    byType: types.map((t) => ({
      name: t.name,
      open: t.tickets.filter((x) => x.status === 'open').length,
      total: t.tickets.length,
    })),
    announcementsSent30d,
    latestMemberCount: latest?.memberCount ?? null,
  }
}

export function formatDuration(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} นาที`
  if (hours < 48) return `${hours.toFixed(1)} ชั่วโมง`
  return `${(hours / 24).toFixed(1)} วัน`
}
