import styles from './page.module.css'

export function PageHeader({
  title,
  lede,
  actions,
}: {
  title: string
  lede?: string
  actions?: React.ReactNode
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerRow}>
        <div>
          <h1 className={styles.title}>{title}</h1>
          {lede ? <p className={styles.lede}>{lede}</p> : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
    </header>
  )
}

export function ComingSoon({ phase }: { phase: string }) {
  return <div className={styles.soon}>ส่วนนี้อยู่ใน{phase}</div>
}
