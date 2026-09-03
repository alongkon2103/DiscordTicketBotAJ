import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Events,
  MessageFlags,
  PermissionFlagsBits,
  type ButtonInteraction,
  type Client,
  type Guild,
  type GuildMember,
  type Interaction,
  type RepliableInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js'
import { prisma } from '@/lib/prisma'
import { readIdList } from '@/lib/json-column'
import { CUSTOM_ID } from '../custom-id'
import { checkEligibility, createTicket } from '../ticket/create'
import { archiveTicket, deleteTicketChannel, reopenTicket } from '../ticket/close'
import { changeTicketMembers, memberPickerRows } from '../ticket/members'
import { buildTicketModal, extractAnswers } from '../ticket/modal'
import {
  collectMessages,
  renderTranscriptHtml,
  saveTranscript,
  transcriptAttachment,
} from '../ticket/transcript'

const ephemeral = { flags: MessageFlags.Ephemeral } as const

async function tell(interaction: RepliableInteraction, message: string) {
  if (interaction.replied || interaction.deferred) {
    await interaction.followUp({ content: message, ...ephemeral }).catch(() => {})
  } else {
    await interaction.reply({ content: message, ...ephemeral }).catch(() => {})
  }
}

/** customId เป็น "tk:<action>:<id>" — คืน id ส่วนท้าย */
function idFrom(customId: string): string {
  return customId.slice(customId.lastIndexOf(':') + 1)
}

async function loadTicketContext(ticketId: string) {
  return prisma.ticket.findUnique({
    where: { id: ticketId },
    include: { ticketType: true },
  })
}

/** เจ้าของ ticket หรือทีมงาน เท่านั้นที่สั่งงานในห้องได้ */
function canManage(member: GuildMember, openerId: string, staffRoleIds: string[]): boolean {
  if (member.id === openerId) return true
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true
  return staffRoleIds.some((id) => member.roles.cache.has(id))
}

function staffOnly(member: GuildMember, staffRoleIds: string[]): boolean {
  if (member.permissions.has(PermissionFlagsBits.ManageChannels)) return true
  return staffRoleIds.some((id) => member.roles.cache.has(id))
}

// ── เปิด ticket ────────────────────────────────────────────────────────

async function beginOpen(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  guild: Guild,
  member: GuildMember,
  ticketTypeId: string,
) {
  const type = await prisma.ticketType.findUnique({
    where: { id: ticketTypeId },
    include: { fields: { orderBy: { sortOrder: 'asc' } } },
  })

  if (!type) {
    await tell(interaction, 'ประเภท ticket นี้ถูกลบไปแล้ว — แจ้งทีมงานให้อัปเดต panel')
    return
  }

  const eligible = await checkEligibility(type, member)
  if (!eligible.ok) {
    await tell(interaction, eligible.message)
    return
  }

  // มีฟิลด์ให้กรอก → เด้ง modal, ไม่มี → สร้างห้องเลย
  if (type.fields.length > 0) {
    const modal = buildTicketModal(type, type.fields)
    await interaction.showModal(modal).catch(async (err: unknown) => {
      await tell(
        interaction,
        `เปิดฟอร์มไม่สำเร็จ: ${err instanceof Error ? err.message : String(err)}`,
      )
    })
    return
  }

  await interaction.deferReply(ephemeral)

  const result = await createTicket({ guild, member, type, answers: {} })
  await interaction.editReply(
    result.ok
      ? { content: `เปิด ticket ให้แล้ว → <#${result.channel.id}>` }
      : { content: result.message },
  )
}

// ── ตัวจัดการหลัก ──────────────────────────────────────────────────────

export function registerInteractionHandlers(client: Client) {
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    try {
      await route(interaction)
    } catch (err) {
      console.error('[interaction] จัดการไม่สำเร็จ:', err)
      if (interaction.isRepliable()) {
        await tell(interaction, 'เกิดข้อผิดพลาดภายในระบบ — ลองใหม่อีกครั้ง หรือแจ้งทีมงาน')
      }
    }
  })
}

async function route(interaction: Interaction) {
  if (!interaction.guild || !interaction.member) return

  const guild = interaction.guild
  const member = await guild.members.fetch(interaction.user.id).catch(() => null)
  if (!member) return

  // ── ปุ่มบน panel / ในห้อง ticket ────────────────────────────────────
  if (interaction.isButton() && interaction.customId.startsWith('tk:')) {
    const id = idFrom(interaction.customId)

    if (interaction.customId.startsWith('tk:open:')) {
      await beginOpen(interaction, guild, member, id)
      return
    }

    const ticket = await loadTicketContext(id)
    if (!ticket) {
      await tell(interaction, 'ไม่พบข้อมูล ticket นี้ในระบบแล้ว')
      return
    }
    const staffRoleIds = readIdList(ticket.ticketType.staffRoleIds)

    // ขอยืนยันก่อนปิด
    if (interaction.customId.startsWith('tk:close:')) {
      if (!canManage(member, ticket.openerId, staffRoleIds)) {
        await tell(interaction, 'เฉพาะเจ้าของ ticket และทีมงานเท่านั้นที่ปิดได้')
        return
      }
      await interaction.reply({
        content: 'ยืนยันปิด ticket นี้ไหม? ห้องจะถูกย้ายเข้าคลังและตัดสิทธิ์คนเปิด',
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
              .setCustomId(CUSTOM_ID.closeConfirm(ticket.id))
              .setLabel('ยืนยันปิด')
              .setStyle(ButtonStyle.Danger),
          ),
        ],
        ...ephemeral,
      })
      return
    }

    if (interaction.customId.startsWith('tk:close!:')) {
      if (!canManage(member, ticket.openerId, staffRoleIds)) {
        await tell(interaction, 'เฉพาะเจ้าของ ticket และทีมงานเท่านั้นที่ปิดได้')
        return
      }
      await interaction.update({ content: 'กำลังปิด ticket และเก็บบันทึกแชท...', components: [] })
      const result = await archiveTicket({
        guild,
        ticketId: ticket.id,
        closedById: member.id,
        closedByTag: member.user.tag,
      })
      await interaction.editReply({
        content: result.ok ? 'ปิด ticket เรียบร้อย' : result.message,
      })
      return
    }

    if (interaction.customId.startsWith('tk:members:')) {
      if (!staffOnly(member, staffRoleIds)) {
        await tell(interaction, 'เฉพาะทีมงานเท่านั้นที่จัดการสมาชิกในห้องได้')
        return
      }
      await interaction.reply({
        content: 'เลือกคนที่จะเพิ่มหรือนำออกจากห้องนี้',
        components: memberPickerRows(ticket.id),
        ...ephemeral,
      })
      return
    }

    if (interaction.customId.startsWith('tk:script:')) {
      if (!canManage(member, ticket.openerId, staffRoleIds)) {
        await tell(interaction, 'เฉพาะเจ้าของ ticket และทีมงานเท่านั้นที่ดึงบันทึกแชทได้')
        return
      }
      await interaction.deferReply(ephemeral)

      const channel = await guild.channels.fetch(ticket.channelId).catch(() => null)
      if (!channel?.isTextBased()) {
        await interaction.editReply('ไม่พบห้องของ ticket นี้แล้ว')
        return
      }

      const messages = await collectMessages(channel)
      await saveTranscript(ticket.id, messages)

      const html = renderTranscriptHtml({
        number: ticket.number,
        typeName: ticket.ticketType.name,
        openerTag: ticket.openerTag,
        openedAt: ticket.openedAt,
        closedAt: ticket.closedAt,
        closedByTag: ticket.closedByTag,
        messages,
      })

      await interaction.editReply({
        content: `บันทึกแชทถึงตอนนี้ ${messages.length} ข้อความ`,
        files: [transcriptAttachment(html, ticket.number)],
      })
      return
    }

    if (interaction.customId.startsWith('tk:reopen:')) {
      if (!staffOnly(member, staffRoleIds)) {
        await tell(interaction, 'เฉพาะทีมงานเท่านั้นที่เปิด ticket ใหม่ได้')
        return
      }
      await interaction.deferReply(ephemeral)
      const result = await reopenTicket({ guild, ticketId: ticket.id, actorTag: member.user.tag })
      await interaction.editReply(result.ok ? 'เปิด ticket ใหม่แล้ว' : result.message)
      return
    }

    if (interaction.customId.startsWith('tk:del:')) {
      if (!staffOnly(member, staffRoleIds)) {
        await tell(interaction, 'เฉพาะทีมงานเท่านั้นที่ลบห้องได้')
        return
      }
      await interaction.reply({ content: 'กำลังลบห้องนี้...', ...ephemeral })
      await deleteTicketChannel({ guild, ticketId: ticket.id, actorTag: member.user.tag })
      return
    }

    return
  }

  // ── dropdown เลือกประเภทบน panel ────────────────────────────────────
  if (interaction.isStringSelectMenu() && interaction.customId.startsWith('tk:pick:')) {
    const ticketTypeId = interaction.values[0]
    if (!ticketTypeId) return
    await beginOpen(interaction, guild, member, ticketTypeId)
    return
  }

  // ── เพิ่ม/นำออกสมาชิก ───────────────────────────────────────────────
  if (interaction.isUserSelectMenu()) {
    const isAdd = interaction.customId.startsWith('tk:add:')
    const isRemove = interaction.customId.startsWith('tk:rm:')
    if (!isAdd && !isRemove) return

    const ticketId = idFrom(interaction.customId)
    const ticket = await loadTicketContext(ticketId)
    if (!ticket) {
      await tell(interaction, 'ไม่พบข้อมูล ticket นี้แล้ว')
      return
    }
    if (!staffOnly(member, readIdList(ticket.ticketType.staffRoleIds))) {
      await tell(interaction, 'เฉพาะทีมงานเท่านั้นที่จัดการสมาชิกในห้องได้')
      return
    }

    await interaction.deferReply(ephemeral)
    const result = await changeTicketMembers({
      guild,
      ticketId,
      userIds: [...interaction.values],
      action: isAdd ? 'add' : 'remove',
    })
    await interaction.editReply(result.message)
    return
  }

  // ── ส่ง modal เปิด ticket ────────────────────────────────────────────
  if (interaction.isModalSubmit() && interaction.customId.startsWith('tk:modal:')) {
    const ticketTypeId = idFrom(interaction.customId)

    const type = await prisma.ticketType.findUnique({
      where: { id: ticketTypeId },
      include: { fields: { orderBy: { sortOrder: 'asc' } } },
    })
    if (!type) {
      await tell(interaction, 'ประเภท ticket นี้ถูกลบไปแล้ว')
      return
    }

    // เช็คซ้ำอีกรอบ — ระหว่างกรอกฟอร์มอาจมีคนเปิด ticket อีกห้องไปแล้ว
    const eligible = await checkEligibility(type, member)
    if (!eligible.ok) {
      await tell(interaction, eligible.message)
      return
    }

    await interaction.deferReply(ephemeral)

    const answers = extractAnswers(interaction, type.fields)
    const result = await createTicket({ guild, member, type, answers })

    await interaction.editReply(
      result.ok ? `เปิด ticket ให้แล้ว → <#${result.channel.id}>` : result.message,
    )
  }
}
