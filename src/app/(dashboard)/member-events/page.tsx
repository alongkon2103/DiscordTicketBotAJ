import { requireAdmin } from '@/lib/auth/guard'
import { getMemberEvent, type MemberEventInput } from '@/lib/member-events'
import { BotNotReadyError, getGuild } from '@/lib/discord/bot'
import {
  getGuildResources,
  textualChannels,
  type ChannelOption,
  type RoleOption,
} from '@/lib/discord/resources'
import { PageHeader } from '@/components/PageHeader'
import { MemberEventsEditor } from './MemberEventsEditor'
import styles from '@/components/editor.module.css'

export default async function MemberEventsPage() {
  await requireAdmin()

  const [join, leave] = await Promise.all([getMemberEvent('join'), getMemberEvent('leave')])

  let channels: ChannelOption[] = []
  let roles: RoleOption[] = []
  let botName = 'บอท'
  let botTopRoleName: string | null = null
  let botError: string | null = null

  try {
    const [resources, guild] = await Promise.all([getGuildResources(), getGuild()])
    channels = textualChannels(resources)
    roles = resources.roles
    botTopRoleName = resources.botTopRoleName
    botName = guild.client.user?.username ?? 'บอท'
  } catch (err) {
    botError = err instanceof BotNotReadyError ? err.message : 'อ่านข้อมูลเซิร์ฟเวอร์ไม่ได้'
  }

  return (
    <>
      <PageHeader
        title="ต้อนรับ / อำลา"
        lede="ข้อความที่บอทส่งเมื่อมีคนเข้าและออกจากเซิร์ฟเวอร์ และ role ที่แจกให้สมาชิกใหม่อัตโนมัติ"
      />

      {botError ? (
        <div className={styles.notice}>
          {botError} — แก้ไขไม่ได้จนกว่าบอทจะเชื่อมต่อ Discord ได้ เพราะต้องอ่านรายชื่อห้องและ role
        </div>
      ) : (
        <MemberEventsEditor
          initial={{ join, leave } satisfies Record<'join' | 'leave', MemberEventInput>}
          channels={channels}
          roles={roles}
          botName={botName}
          botTopRoleName={botTopRoleName}
        />
      )}
    </>
  )
}
