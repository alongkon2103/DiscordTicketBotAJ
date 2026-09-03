import { randomUUID } from 'node:crypto'
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  PermissionFlagsBits,
  type CategoryChannel,
  type Guild,
  type GuildMember,
  type TextChannel,
} from 'discord.js'
import type { ModalField, TicketType } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { readIdList, readJson } from '@/lib/json-column'
import { MessagePayloadSchema, emptyPayload } from '@/lib/schema/message'
import { buildMessage } from '../message'
import { CUSTOM_ID } from '../custom-id'
import { render, toChannelName } from '../template'
import type { TicketAnswers } from './modal'

/** Discord ให้ category มีห้องได้สูงสุด 50 ห้อง */
const CATEGORY_LIMIT = 50
/** และทั้งเซิร์ฟเวอร์ได้ 500 ห้อง */
const GUILD_CHANNEL_LIMIT = 500

export type TicketTypeWithFields = TicketType & { fields: ModalField[] }

export type EligibilityResult = { ok: true } | { ok: false; message: string }

/** เช็คว่าสมาชิกคนนี้เปิด ticket ประเภทนี้ได้ไหม — เรียกก่อนเด้ง modal */
export async function checkEligibility(
  type: TicketType,
  member: GuildMember,
): Promise<EligibilityResult> {
  if (!type.enabled) {
    return { ok: false, message: type.disabledMessage || 'ตอนนี้ปิดรับ ticket ประเภทนี้ชั่วคราว' }
  }

  const memberRoles = new Set(member.roles.cache.keys())

  const denied = readIdList(type.deniedRoleIds)
  if (denied.some((id) => memberRoles.has(id))) {
    return { ok: false, message: 'บัญชีของคุณไม่มีสิทธิ์เปิด ticket ประเภทนี้' }
  }

  const allowed = readIdList(type.allowedRoleIds)
  if (allowed.length > 0 && !allowed.some((id) => memberRoles.has(id))) {
    return { ok: false, message: 'ticket ประเภทนี้เปิดให้เฉพาะสมาชิกบาง role เท่านั้น' }
  }

  if (type.maxOpenPerUser > 0) {
    const open = await prisma.ticket.count({
      where: { ticketTypeId: type.id, openerId: member.id, status: 'open' },
    })
    if (open >= type.maxOpenPerUser) {
      const existing = await prisma.ticket.findFirst({
        where: { ticketTypeId: type.id, openerId: member.id, status: 'open' },
        orderBy: { openedAt: 'desc' },
        select: { channelId: true },
      })
      const where = existing ? ` — ไปต่อที่ <#${existing.channelId}>` : ''
      return {
        ok: false,
        message:
          type.maxOpenPerUser === 1
            ? `คุณมี ticket ประเภทนี้เปิดค้างอยู่แล้ว${where}`
            : `คุณเปิด ticket ประเภทนี้ได้สูงสุด ${type.maxOpenPerUser} ห้องพร้อมกัน${where}`,
      }
    }
  }

  if (type.cooldownSeconds > 0) {
    const last = await prisma.ticket.findFirst({
      where: { ticketTypeId: type.id, openerId: member.id, closedAt: { not: null } },
      orderBy: { closedAt: 'desc' },
      select: { closedAt: true },
    })
    if (last?.closedAt) {
      const readyAt = last.closedAt.getTime() + type.cooldownSeconds * 1000
      if (Date.now() < readyAt) {
        const unix = Math.floor(readyAt / 1000)
        return { ok: false, message: `เพิ่งปิด ticket ไป เปิดใหม่ได้อีกครั้ง <t:${unix}:R>` }
      }
    }
  }

  return { ok: true }
}

/** หา category แรกที่ยังมีที่ว่าง — รองรับ category สำรองตามลำดับที่ตั้งไว้ */
async function pickCategory(
  guild: Guild,
  categoryIds: string[],
): Promise<{ ok: true; category: CategoryChannel } | { ok: false; message: string }> {
  if (guild.channels.cache.size >= GUILD_CHANNEL_LIMIT) {
    return {
      ok: false,
      message: 'เซิร์ฟเวอร์มีห้องครบ 500 ห้องแล้ว สร้างห้องใหม่ไม่ได้ — แจ้งทีมงานให้ลบห้องเก่าก่อน',
    }
  }

  const missing: string[] = []
  for (const id of categoryIds) {
    const channel = await guild.channels.fetch(id).catch(() => null)
    if (!channel || channel.type !== ChannelType.GuildCategory) {
      missing.push(id)
      continue
    }
    const used = guild.channels.cache.filter((c) => c?.parentId === id).size
    if (used < CATEGORY_LIMIT) return { ok: true, category: channel }
  }

  if (categoryIds.length === 0 || missing.length === categoryIds.length) {
    return { ok: false, message: 'ยังไม่ได้ตั้ง category ปลายทาง หรือ category ที่ตั้งไว้ถูกลบไปแล้ว' }
  }
  return {
    ok: false,
    message: 'category ที่ตั้งไว้เต็มหมดแล้ว (ห้องละ 50 ห้อง) — แจ้งทีมงานให้เพิ่ม category สำรอง',
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'P2002'
}

/**
 * จองเลข ticket พร้อมสร้างแถวในฐานข้อมูลไปเลย
 *
 * อ่านเลขล่าสุดแล้วค่อยเขียนมีช่องว่างให้ชนกันได้ถ้าสองคนกดพร้อมกัน
 * จึงกันด้วย unique constraint บน number แล้ววนลองเลขถัดไปแทน
 *
 * channelId ยังไม่มีตอนนี้ (ต้องรู้เลขก่อนถึงตั้งชื่อห้องได้) จึงใส่ค่าชั่วคราวที่ไม่ซ้ำใครไว้
 * แล้วอัปเดตเป็นไอดีจริงหลังสร้างห้องสำเร็จ
 */
async function reserveTicket(params: {
  ticketTypeId: string
  openerId: string
  openerTag: string
}): Promise<{ id: string; number: number }> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const latest = await prisma.ticket.findFirst({
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    const number = (latest?.number ?? 0) + 1

    try {
      const created = await prisma.ticket.create({
        data: {
          number,
          ticketTypeId: params.ticketTypeId,
          channelId: `pending:${randomUUID()}`,
          openerId: params.openerId,
          openerTag: params.openerTag,
        },
        select: { id: true, number: true },
      })
      return created
    } catch (err) {
      if (isUniqueViolation(err)) continue // มีคนคว้าเลขนี้ไปก่อน — ลองเลขถัดไป
      throw err
    }
  }
  throw new Error('จองเลข ticket ไม่สำเร็จ มีคนเปิดพร้อมกันมากเกินไป')
}

function answersEmbed(answers: TicketAnswers, fields: ModalField[]): EmbedBuilder | null {
  const rows = fields
    .map((f) => answers[f.key])
    .filter((a): a is NonNullable<typeof a> => Boolean(a?.display))

  if (rows.length === 0) return null

  return new EmbedBuilder().setColor('#2b2d31').addFields(
    rows.slice(0, 25).map((a) => ({
      name: a.label.slice(0, 256),
      value: a.display.slice(0, 1024),
      inline: false,
    })),
  )
}

function ticketButtons(ticketId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.close(ticketId))
      .setLabel('ปิด Ticket')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.members(ticketId))
      .setLabel('เพิ่ม / นำออกสมาชิก')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.transcript(ticketId))
      .setLabel('บันทึกแชท')
      .setStyle(ButtonStyle.Secondary),
  )
}

/** ไฟล์ที่แนบมาใน modal มีลิงก์อายุสั้น — ต้องโหลดมาโพสต์ซ้ำทันที ไม่งั้นลิงก์ตาย */
async function repostAttachments(answers: TicketAnswers): Promise<AttachmentBuilder[]> {
  const files: AttachmentBuilder[] = []

  for (const answer of Object.values(answers)) {
    for (const file of answer.attachments ?? []) {
      // Discord จำกัดไฟล์แนบ 25MB สำหรับเซิร์ฟเวอร์ที่ไม่ได้ boost
      if (file.size > 25 * 1024 * 1024) continue
      try {
        const res = await fetch(file.url)
        if (!res.ok) continue
        const buffer = Buffer.from(await res.arrayBuffer())
        files.push(new AttachmentBuilder(buffer, { name: file.name }))
      } catch {
        // โหลดไม่ได้ก็ข้าม ไม่ให้ทั้ง ticket ล้มเพราะไฟล์เดียว
      }
      if (files.length >= 10) return files
    }
  }

  return files
}

export type CreateResult =
  | { ok: true; channel: TextChannel; ticketId: string; number: number }
  | { ok: false; message: string }

export async function createTicket(params: {
  guild: Guild
  member: GuildMember
  type: TicketTypeWithFields
  answers: TicketAnswers
}): Promise<CreateResult> {
  const { guild, member, type, answers } = params

  const categoryIds = readIdList(type.categoryIds)
  const picked = await pickCategory(guild, categoryIds)
  if (!picked.ok) return { ok: false, message: picked.message }

  const staffRoleIds = readIdList(type.staffRoleIds).filter((id) => guild.roles.cache.has(id))

  const reserved = await reserveTicket({
    ticketTypeId: type.id,
    openerId: member.id,
    openerTag: member.user.tag,
  })
  const number = reserved.number

  const nameVars = {
    number: String(number).padStart(4, '0'),
    username: member.user.username,
    displayname: member.displayName,
    userid: member.id,
    type: type.name,
    date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }).replace('/', '-'),
  }

  const memberPerms = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.ReadMessageHistory,
    PermissionFlagsBits.AttachFiles,
    PermissionFlagsBits.EmbedLinks,
    PermissionFlagsBits.AddReactions,
  ]

  let channel: TextChannel
  try {
    channel = await guild.channels.create({
      name: toChannelName(render(type.channelNameTemplate, nameVars)),
      type: ChannelType.GuildText,
      parent: picked.category.id,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        { id: member.id, allow: memberPerms },
        ...staffRoleIds.map((id) => ({
          id,
          allow: [...memberPerms, PermissionFlagsBits.ManageMessages],
        })),
      ],
      reason: `Ticket #${number} เปิดโดย ${member.user.tag}`,
    })
  } catch (err) {
    // สร้างห้องไม่ได้ — คืนเลขที่จองไว้ ไม่ให้เหลือแถวค้างที่ไม่มีห้องจริง
    await prisma.ticket.delete({ where: { id: reserved.id } }).catch(() => {})

    const message = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      message: `สร้างห้องไม่สำเร็จ: ${message} — ตรวจว่าบอทมีสิทธิ์ Manage Channels และ role ของบอทอยู่สูงกว่า role ทีมงาน`,
    }
  }

  const ticket = await prisma.ticket.update({
    where: { id: reserved.id },
    data: { channelId: channel.id, answers: JSON.stringify(answers) },
  })

  // ── ข้อความแรกในห้อง ───────────────────────────────────────────────
  const payload = readJson(type.openPayload, MessagePayloadSchema, emptyPayload())

  const fieldVars: Record<string, string> = {}
  for (const [key, answer] of Object.entries(answers)) {
    fieldVars[`field.${key}`] = answer.display
  }

  const built = await buildMessage(payload, {
    user: `<@${member.id}>`,
    'user.name': member.user.username,
    'user.display': member.displayName,
    'user.id': member.id,
    'user.avatar': member.user.displayAvatarURL(),
    server: guild.name,
    'server.membercount': String(guild.memberCount),
    'server.icon': guild.iconURL() ?? '',
    'ticket.number': nameVars.number,
    'ticket.type': type.name,
    'ticket.channel': `<#${channel.id}>`,
    date: new Date().toLocaleDateString('th-TH'),
    time: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
    ...fieldVars,
  })

  const embeds = [...built.embeds]
  if (type.showAnswers) {
    const extra = answersEmbed(answers, type.fields)
    if (extra) embeds.push(extra)
  }

  const pings: string[] = []
  if (type.pingOpener) pings.push(`<@${member.id}>`)
  for (const roleId of readIdList(type.pingRoleIds)) {
    if (guild.roles.cache.has(roleId)) pings.push(`<@&${roleId}>`)
  }

  const content = [pings.join(' '), built.content].filter(Boolean).join('\n')
  // รูปใน embed ที่อัปโหลดไว้ + ไฟล์ที่ผู้ใช้แนบมาในฟอร์ม
  const files = [...built.files, ...(await repostAttachments(answers))]

  try {
    const message = await channel.send({
      content: content || undefined,
      embeds: embeds.length > 0 ? embeds : undefined,
      components: [ticketButtons(ticket.id)],
      files: files.length > 0 ? files : undefined,
      allowedMentions: {
        users: type.pingOpener ? [member.id] : [],
        roles: readIdList(type.pingRoleIds),
      },
    })
    await message.pin().catch(() => {
      // ปักหมุดไม่ได้ไม่ใช่เรื่องใหญ่ ข้ามไป
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await channel.send(`สร้างห้องสำเร็จ แต่ส่งข้อความแรกไม่ได้: ${message}`).catch(() => {})
  }

  return { ok: true, channel, ticketId: ticket.id, number }
}

/**
 * ลบแถวที่จองเลขไว้แต่ยังไม่ได้ผูกกับห้องจริง
 *
 * เกิดได้เมื่อโปรเซสดับระหว่างจองเลขกับสร้างห้อง
 * ถ้าไม่เก็บกวาด แถวพวกนี้จะถูกนับเป็น ticket ที่เปิดค้าง ทำให้เจ้าตัวเปิดใหม่ไม่ได้
 */
export async function cleanupPendingTickets(): Promise<number> {
  const { count } = await prisma.ticket.deleteMany({
    where: { channelId: { startsWith: 'pending:' } },
  })
  if (count > 0) console.log(`[bot] เก็บกวาด ticket ที่ค้างไว้ ${count} รายการ`)
  return count
}
