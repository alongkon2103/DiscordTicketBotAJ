import { requireAdmin } from '@/lib/auth/guard'
import { getBotStatus } from '@/lib/discord/bot'
import { Sidebar, type BotStatusView } from '@/components/Sidebar'
import styles from './dashboard.module.css'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAdmin()
  const bot = getBotStatus()

  return (
    <div className={styles.shell}>
      <Sidebar
        user={{ displayName: ctx.user.displayName, avatarUrl: ctx.user.avatarUrl }}
        isOwner={ctx.isOwner}
        bot={{ status: bot.status, tag: bot.tag } satisfies BotStatusView}
      />
      <main className={styles.main}>{children}</main>
    </div>
  )
}

export const dynamic = 'force-dynamic'
