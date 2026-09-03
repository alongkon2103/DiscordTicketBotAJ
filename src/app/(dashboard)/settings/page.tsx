import { env } from '@/lib/env'
import { requireAdmin } from '@/lib/auth/guard'
import { getSettings } from '@/lib/settings'
import { BotNotReadyError } from '@/lib/discord/bot'
import { getGuildResources, textualChannels, type ChannelOption, type RoleOption } from '@/lib/discord/resources'
import { PageHeader } from '@/components/PageHeader'
import { SettingsEditor } from './SettingsEditor'
import styles from '@/components/editor.module.css'

export default async function SettingsPage() {
  const ctx = await requireAdmin()
  const settings = await getSettings()

  let roles: RoleOption[] = []
  let channels: ChannelOption[] = []
  let botError: string | null = null

  try {
    const resources = await getGuildResources()
    roles = resources.roles
    channels = textualChannels(resources)
  } catch (err) {
    botError = err instanceof BotNotReadyError ? err.message : 'อ่านข้อมูลเซิร์ฟเวอร์ไม่ได้'
  }

  return (
    <>
      <PageHeader
        title="ตั้งค่า"
        lede="ใครเข้าหน้านี้ได้ และบันทึกการปิด ticket จะถูกส่งไปห้องไหน"
      />

      {botError ? (
        <div className={styles.notice} style={{ marginBottom: 24 }}>
          {botError}
        </div>
      ) : (
        <SettingsEditor
          initial={{
            adminRoleIds: settings.adminRoleIds,
            ticketLogChannelId: settings.ticketLogChannelId,
          }}
          roles={roles}
          channels={channels}
          ownerCount={env.ownerIds.length}
          isOwner={ctx.isOwner}
        />
      )}
    </>
  )
}
