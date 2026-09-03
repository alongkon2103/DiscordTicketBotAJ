'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import styles from './sidebar.module.css'

type NavItem = { href: string; label: string }
type NavGroup = { label: string; items: NavItem[] }

const GROUPS: NavGroup[] = [
  {
    label: 'ภาพรวม',
    items: [{ href: '/', label: 'หน้าแรก' }],
  },
  {
    label: 'Ticket',
    items: [
      { href: '/ticket-types', label: 'ประเภท Ticket' },
      { href: '/panels', label: 'Panel' },
      { href: '/tickets', label: 'รายการ Ticket' },
    ],
  },
  {
    label: 'สมาชิก',
    items: [{ href: '/member-events', label: 'ต้อนรับ / อำลา' }],
  },
  {
    label: 'ประกาศ',
    items: [{ href: '/announcements', label: 'เขียนประกาศ' }],
  },
  {
    label: 'ระบบ',
    items: [
      { href: '/settings', label: 'ตั้งค่า' },
      { href: '/audit', label: 'บันทึกการใช้งาน' },
    ],
  },
]

export type BotStatusView = {
  status: 'stopped' | 'connecting' | 'ready' | 'failed'
  tag: string | null
}

const STATUS_TEXT: Record<BotStatusView['status'], string> = {
  ready: 'ออนไลน์',
  connecting: 'กำลังเชื่อมต่อ',
  failed: 'เชื่อมต่อไม่ได้',
  stopped: 'ยังไม่เริ่ม',
}

export function Sidebar({
  user,
  isOwner,
  bot,
}: {
  user: { displayName: string; avatarUrl: string | null }
  isOwner: boolean
  bot: BotStatusView
}) {
  const pathname = usePathname()

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandDot} aria-hidden />
        <span className={styles.brandName}>ระบบจัดการบอท</span>
      </div>

      <nav className={styles.nav}>
        {GROUPS.map((group) => (
          <div key={group.label} className={styles.group}>
            <div className={styles.groupLabel}>{group.label}</div>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={styles.item}
                data-active={
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
                }
              >
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className={styles.foot}>
        <div className={styles.status}>
          <span className={styles.statusDot} data-state={bot.status} aria-hidden />
          <span>{bot.tag ? `${STATUS_TEXT[bot.status]} · ${bot.tag}` : STATUS_TEXT[bot.status]}</span>
        </div>

        <div className={styles.user}>
          {user.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.avatar} src={user.avatarUrl} alt="" width={24} height={24} />
          ) : (
            <span className={styles.avatar} aria-hidden />
          )}
          <div className={styles.userMeta}>
            <div className={styles.userName}>{user.displayName}</div>
            <div className={styles.userRole}>{isOwner ? 'owner' : 'admin'}</div>
          </div>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className={`btn btn-ghost ${styles.logout}`}>
              ออก
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}
