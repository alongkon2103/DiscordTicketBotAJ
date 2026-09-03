import { Client, GatewayIntentBits, Partials } from 'discord.js'

/**
 * GuildMembers และ MessageContent เป็น privileged intent
 * ต้องเปิดใน Developer Portal > Bot > Privileged Gateway Intents ก่อน ไม่งั้นบอทจะ login ไม่ผ่าน
 *   - GuildMembers   : จับคนเข้า/ออกเซิร์ฟเวอร์
 *   - MessageContent : อ่านข้อความในห้อง ticket ตอนทำ transcript
 */
export function createDiscordClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.GuildMember, Partials.Channel, Partials.Message],
  })
}
