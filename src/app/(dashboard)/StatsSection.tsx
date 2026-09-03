import type { DayBucket, MemberDayBucket, Stats } from '@/lib/stats'
import { formatDuration } from '@/lib/stats'
import styles from './stats.module.css'

/** กราฟแท่งสองชุดวาดด้วย CSS ล้วน — ไม่ต้องพึ่งไลบรารีชาร์ต */
function BarChart({
  days,
  series,
}: {
  days: (DayBucket | MemberDayBucket)[]
  series: [{ key: string; label: string; tone: 'up' | 'down' }, { key: string; label: string; tone: 'up' | 'down' }]
}) {
  const value = (day: DayBucket | MemberDayBucket, key: string) =>
    (day as unknown as Record<string, number>)[key] ?? 0

  const peak = Math.max(1, ...days.flatMap((d) => series.map((s) => value(d, s.key))))

  return (
    <div>
      <div className={styles.legend}>
        {series.map((s) => (
          <span key={s.key} className={styles.legendItem}>
            <span className={styles.legendDot} data-tone={s.tone} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>

      <div className={styles.chart}>
        {days.map((day) => (
          <div key={day.label} className={styles.column}>
            <div className={styles.bars}>
              {series.map((s) => {
                const v = value(day, s.key)
                return (
                  <div
                    key={s.key}
                    className={styles.bar}
                    data-tone={s.tone}
                    data-empty={v === 0}
                    style={{ height: `${(v / peak) * 100}%` }}
                    title={`${day.label} · ${s.label} ${v}`}
                  />
                )
              })}
            </div>
            <div className={styles.columnLabel}>{day.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function StatsSection({ stats }: { stats: Stats }) {
  const maxType = Math.max(1, ...stats.byType.map((t) => t.total))

  return (
    <>
      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>Ticket ย้อนหลัง 7 วัน</h2>
          <span className="label-eyebrow">
            เปิด {stats.opened7d} · ปิด {stats.closed7d}
          </span>
        </div>

        <div className={styles.card}>
          {stats.opened7d === 0 && stats.closed7d === 0 ? (
            <p className={styles.empty}>ยังไม่มี ticket ในช่วง 7 วันที่ผ่านมา</p>
          ) : (
            <BarChart
              days={stats.ticketDays}
              series={[
                { key: 'opened', label: 'เปิด', tone: 'up' },
                { key: 'closed', label: 'ปิด', tone: 'down' },
              ]}
            />
          )}

          <div className={styles.footRow}>
            <div>
              <div className={styles.footLabel}>เวลาเฉลี่ยจากเปิดถึงปิด</div>
              <div className={styles.footValue}>
                {stats.avgResolutionHours === null
                  ? '—'
                  : formatDuration(stats.avgResolutionHours)}
              </div>
            </div>
            <div>
              <div className={styles.footLabel}>ค้างอยู่ตอนนี้</div>
              <div className={styles.footValue}>{stats.openNow}</div>
            </div>
            <div>
              <div className={styles.footLabel}>เปิดวันนี้</div>
              <div className={styles.footValue}>{stats.openedToday}</div>
            </div>
          </div>
        </div>
      </section>

      {stats.byType.length > 0 ? (
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>แยกตามประเภท</h2>
            <span className="label-eyebrow">นับตั้งแต่เริ่มใช้งาน</span>
          </div>

          <div className={styles.card}>
            <div className={styles.typeList}>
              {stats.byType.map((type) => (
                <div key={type.name} className={styles.typeRow}>
                  <span className={styles.typeName}>{type.name}</span>
                  <div className={styles.typeTrack}>
                    <div
                      className={styles.typeFill}
                      style={{ width: `${(type.total / maxType) * 100}%` }}
                    />
                  </div>
                  <span className={styles.typeNum}>
                    {type.total}
                    {type.open > 0 ? <span className={styles.typeOpen}> · ค้าง {type.open}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHead}>
          <h2>สมาชิกเข้า-ออก 7 วัน</h2>
          <span className="label-eyebrow">
            เข้า {stats.joined7d} · ออก {stats.left7d}
          </span>
        </div>

        <div className={styles.card}>
          {stats.joined7d === 0 && stats.left7d === 0 ? (
            <p className={styles.empty}>
              ยังไม่มีข้อมูล — ระบบเริ่มเก็บตั้งแต่ตอนที่เปิดใช้งานเป็นต้นไป
              ไม่สามารถย้อนดูก่อนหน้านั้นได้เพราะ Discord ไม่มี API ให้ถาม
            </p>
          ) : (
            <BarChart
              days={stats.memberDays}
              series={[
                { key: 'joined', label: 'เข้า', tone: 'up' },
                { key: 'left', label: 'ออก', tone: 'down' },
              ]}
            />
          )}
        </div>
      </section>
    </>
  )
}
