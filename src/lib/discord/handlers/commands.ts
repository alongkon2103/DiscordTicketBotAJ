import {
  Events,
  MessageFlags,
  PermissionFlagsBits,
  REST,
  Routes,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Client,
  type GuildMember,
} from 'discord.js'
import { env } from '@/lib/env'
import { prisma } from '@/lib/prisma'
import { readIdList } from '@/lib/json-column'
import { archiveTicket } from '../ticket/close'
import { changeTicketMembers } from '../ticket/members'
import { toChannelName } from '../template'

const ephemeral = { flags: MessageFlags.Ephemeral } as const

/** คำสั่งเสริมปุ่ม — ทำงานในห้อง ticket เท่านั้น */
const COMMANDS = [
  new SlashCommandBuilder()
    .setName('close')
    .setDescription('ปิด ticket ในห้องนี้')
    .addStringOption((o) => o.setName('reason').setDescription('เหตุผลที่ปิด').setRequired(false)),

  new SlashCommandBuilder()
    .setName('add')
    .setDescription('เพิ่มคนเข้าห้อง ticket นี้')
    .addUserOption((o) => o.setName('user').setDescription('คนที่จะเพิ่ม').setRequired(true)),

  new SlashCommandBuilder()
    .setName('remove')
    .setDescription('นำคนออกจากห้อง ticket นี้')
    .addUserOption((o) => o.setName('user').setDescription('คนที่จะนำออก').setRequired(true)),

  new SlashCommandBuilder()
    .setName('rename')
    .setDescription('เปลี่ยนชื่อห้อง ticket นี้')
    .addStringOption((o) => o.setName('name').setDescription('ชื่อใหม่').setRequired(true)),
].map((c) => c.toJSON())

export async function registerSlashCommands(): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(env.BOT_TOKEN)
  try {
    // ลงทะเบียนแบบ guild — เห็นผลทันที ไม่ต้องรอ Discord กระจาย cache แบบ global
    await rest.put(Routes.applicationGuildCommands(env.CLIENT_ID, env.GUILD_ID), { body: COMMANDS })
    console.log(`[bot] ลงทะเบียน slash command ${COMMANDS.length} คำสั่งแล้ว`)
  } catch (err) {
    console.error('[bot] ลงทะเบียน slash command ไม่สำเร็จ:', err instanceof Error ? err.message : err)
  }
}

function staffOnly(member: GuildMember, staffRoleIds: string[]): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true
  return staffRoleIds.some((id) => member.roles.cache.has(id))
}

async function currentTicket(interaction: ChatInputCommandInteraction) {
  if (!interaction.channelId) return null
  return prisma.ticket.findUnique({
    where: { channelId: interaction.channelId },
    include: { ticketType: true },
  })
}

export function registerCommandHandlers(client: Client) {
  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand() || !interaction.guild) return

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null)
    if (!member) return

    const ticket = await currentTicket(interaction)
    if (!ticket) {
      await interaction.reply({ content: 'คำสั่งนี้ใช้ได้เฉพาะในห้อง ticket', ...ephemeral })
      return
    }

    const staffRoleIds = readIdList(ticket.ticketType.staffRoleIds)
    const isStaff = staffOnly(member, staffRoleIds)
    const isOwner = member.id === ticket.openerId

    try {
      switch (interaction.commandName) {
        case 'close': {
          if (!isStaff && !isOwner) {
            await interaction.reply({ content: 'เฉพาะเจ้าของ ticket และทีมงานเท่านั้นที่ปิดได้', ...ephemeral })
            return
          }
          await interaction.reply({ content: 'กำลังปิด ticket และเก็บบันทึกแชท...', ...ephemeral })
          const result = await archiveTicket({
            guild: interaction.guild,
            ticketId: ticket.id,
            closedById: member.id,
            closedByTag: member.user.tag,
            reason: interaction.options.getString('reason') ?? undefined,
          })
          await interaction.editReply(result.ok ? 'ปิด ticket เรียบร้อย' : result.message)
          return
        }

        case 'add':
        case 'remove': {
          if (!isStaff) {
            await interaction.reply({ content: 'เฉพาะทีมงานเท่านั้นที่จัดการสมาชิกในห้องได้', ...ephemeral })
            return
          }
          const user = interaction.options.getUser('user', true)
          await interaction.deferReply(ephemeral)
          const result = await changeTicketMembers({
            guild: interaction.guild,
            ticketId: ticket.id,
            userIds: [user.id],
            action: interaction.commandName === 'add' ? 'add' : 'remove',
          })
          await interaction.editReply(result.message)
          return
        }

        case 'rename': {
          if (!isStaff) {
            await interaction.reply({ content: 'เฉพาะทีมงานเท่านั้นที่เปลี่ยนชื่อห้องได้', ...ephemeral })
            return
          }
          const raw = interaction.options.getString('name', true)
          const name = toChannelName(raw)
          await interaction.deferReply(ephemeral)

          const channel = await interaction.guild.channels.fetch(ticket.channelId).catch(() => null)
          if (!channel) {
            await interaction.editReply('ไม่พบห้องนี้แล้ว')
            return
          }
          // Discord จำกัดเปลี่ยนชื่อห้อง 2 ครั้งต่อ 10 นาที — ถ้าติดลิมิตจะรอจนหมดเวลา
          await channel.setName(name)
          await interaction.editReply(`เปลี่ยนชื่อห้องเป็น \`${name}\` แล้ว`)
          return
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      const content = `ทำคำสั่งไม่สำเร็จ: ${message}`
      // editReply สืบทอด ephemeral จาก reply/defer เดิมอยู่แล้ว ใส่ flags ซ้ำไม่ได้
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content }).catch(() => {})
      } else {
        await interaction.reply({ content, ...ephemeral }).catch(() => {})
      }
    }
  })
}
