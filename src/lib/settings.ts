import { prisma } from '@/lib/prisma'
import { readIdList } from '@/lib/json-column'

const SINGLETON_ID = 'singleton'

export async function getSettings() {
  const row = await prisma.guildSettings.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  })

  return {
    ...row,
    adminRoleIds: readIdList(row.adminRoleIds),
  }
}

export async function updateSettings(data: {
  adminRoleIds?: string[]
  ticketLogChannelId?: string | null
  timezone?: string
}) {
  return prisma.guildSettings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      ...(data.adminRoleIds ? { adminRoleIds: JSON.stringify(data.adminRoleIds) } : {}),
      ...(data.ticketLogChannelId !== undefined ? { ticketLogChannelId: data.ticketLogChannelId } : {}),
      ...(data.timezone ? { timezone: data.timezone } : {}),
    },
    update: {
      ...(data.adminRoleIds ? { adminRoleIds: JSON.stringify(data.adminRoleIds) } : {}),
      ...(data.ticketLogChannelId !== undefined ? { ticketLogChannelId: data.ticketLogChannelId } : {}),
      ...(data.timezone ? { timezone: data.timezone } : {}),
    },
  })
}
