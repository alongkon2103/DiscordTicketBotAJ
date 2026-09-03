import {
  ChannelSelectMenuBuilder,
  ChannelType,
  CheckboxGroupBuilder,
  CheckboxGroupOptionBuilder,
  FileUploadBuilder,
  LabelBuilder,
  MentionableSelectMenuBuilder,
  ModalBuilder,
  RadioGroupBuilder,
  RadioGroupOptionBuilder,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  type ModalSubmitInteraction,
} from 'discord.js'
import type { ModalField } from '@prisma/client'
import {
  ChannelConfigSchema,
  CheckboxConfigSchema,
  FileConfigSchema,
  MentionConfigSchema,
  OptionsConfigSchema,
  TextConfigSchema,
  type FieldKind,
  type SelectOption,
} from '@/lib/schema/modal-field'
import { CUSTOM_ID } from '../custom-id'

export const fieldCustomId = (fieldId: string) => `f:${fieldId}`

function parseConfig(raw: string): unknown {
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

const CHANNEL_TYPE_MAP = {
  text: ChannelType.GuildText,
  voice: ChannelType.GuildVoice,
  category: ChannelType.GuildCategory,
  forum: ChannelType.GuildForum,
  announcement: ChannelType.GuildAnnouncement,
} as const

function toSelectOption(option: SelectOption) {
  const built = new StringSelectMenuOptionBuilder()
    .setLabel(option.label.slice(0, 100))
    .setValue(option.value.slice(0, 100))
  if (option.description) built.setDescription(option.description.slice(0, 100))
  if (option.emoji) {
    try {
      built.setEmoji(option.emoji)
    } catch {
      // emoji พิมพ์ผิดรูป — ข้ามไป ไม่ให้ทั้ง modal พัง
    }
  }
  return built
}

/** สร้าง Label หนึ่งอันต่อฟิลด์ — Discord นับ Label เป็น component ระดับบนสุด */
function buildLabel(field: ModalField): LabelBuilder | null {
  const kind = field.kind as FieldKind
  const id = fieldCustomId(field.id)
  const raw = parseConfig(field.config)

  const label = new LabelBuilder().setLabel(field.label.slice(0, 45))
  if (field.description) label.setDescription(field.description.slice(0, 100))

  switch (kind) {
    case 'text': {
      const cfg = TextConfigSchema.safeParse(raw)
      if (!cfg.success) return null
      const c = cfg.data
      return label.setTextInputComponent(() => {
        const input = new TextInputBuilder()
          .setCustomId(id)
          .setStyle(c.style === 'paragraph' ? TextInputStyle.Paragraph : TextInputStyle.Short)
          .setRequired(field.required)
          .setMaxLength(Math.max(1, c.maxLength))
        if (c.minLength > 0) input.setMinLength(Math.min(c.minLength, c.maxLength))
        if (c.placeholder) input.setPlaceholder(c.placeholder.slice(0, 100))
        if (c.prefill) input.setValue(c.prefill.slice(0, c.maxLength))
        return input
      })
    }

    case 'select': {
      const cfg = OptionsConfigSchema.safeParse(raw)
      if (!cfg.success) return null
      const c = cfg.data
      return label.setStringSelectMenuComponent(() => {
        const menu = new StringSelectMenuBuilder()
          .setCustomId(id)
          .setRequired(field.required)
          .setMinValues(field.required ? Math.max(1, c.minValues) : 0)
          .setMaxValues(Math.max(1, Math.min(c.maxValues, c.options.length)))
          .addOptions(c.options.map(toSelectOption))
        if (c.placeholder) menu.setPlaceholder(c.placeholder.slice(0, 150))
        return menu
      })
    }

    case 'radio': {
      const cfg = OptionsConfigSchema.safeParse(raw)
      if (!cfg.success) return null
      return label.setRadioGroupComponent(() =>
        new RadioGroupBuilder()
          .setCustomId(id)
          .setRequired(field.required)
          .setOptions(
            cfg.data.options.map((o) => {
              const option = new RadioGroupOptionBuilder()
                .setLabel(o.label.slice(0, 100))
                .setValue(o.value.slice(0, 100))
              if (o.description) option.setDescription(o.description.slice(0, 100))
              return option
            }),
          ),
      )
    }

    case 'checkbox': {
      const cfg = CheckboxConfigSchema.safeParse(raw)
      if (!cfg.success) return null
      const c = cfg.data
      return label.setCheckboxGroupComponent(() =>
        new CheckboxGroupBuilder()
          .setCustomId(id)
          .setRequired(field.required)
          .setMinValues(field.required ? Math.max(1, c.minValues) : 0)
          .setMaxValues(Math.max(1, Math.min(c.maxValues, c.options.length)))
          .setOptions(
            c.options.map((o) => {
              const option = new CheckboxGroupOptionBuilder()
                .setLabel(o.label.slice(0, 100))
                .setValue(o.value.slice(0, 100))
              if (o.description) option.setDescription(o.description.slice(0, 100))
              return option
            }),
          ),
      )
    }

    case 'user': {
      const c = MentionConfigSchema.parse(raw)
      return label.setUserSelectMenuComponent(() => {
        const menu = new UserSelectMenuBuilder()
          .setCustomId(id)
          .setRequired(field.required)
          .setMinValues(field.required ? Math.max(1, c.minValues) : 0)
          .setMaxValues(Math.max(1, c.maxValues))
        if (c.placeholder) menu.setPlaceholder(c.placeholder.slice(0, 150))
        return menu
      })
    }

    case 'role': {
      const c = MentionConfigSchema.parse(raw)
      return label.setRoleSelectMenuComponent(() => {
        const menu = new RoleSelectMenuBuilder()
          .setCustomId(id)
          .setRequired(field.required)
          .setMinValues(field.required ? Math.max(1, c.minValues) : 0)
          .setMaxValues(Math.max(1, c.maxValues))
        if (c.placeholder) menu.setPlaceholder(c.placeholder.slice(0, 150))
        return menu
      })
    }

    case 'mentionable': {
      const c = MentionConfigSchema.parse(raw)
      return label.setMentionableSelectMenuComponent(() => {
        const menu = new MentionableSelectMenuBuilder()
          .setCustomId(id)
          .setRequired(field.required)
          .setMinValues(field.required ? Math.max(1, c.minValues) : 0)
          .setMaxValues(Math.max(1, c.maxValues))
        if (c.placeholder) menu.setPlaceholder(c.placeholder.slice(0, 150))
        return menu
      })
    }

    case 'channel': {
      const c = ChannelConfigSchema.parse(raw)
      return label.setChannelSelectMenuComponent(() => {
        const menu = new ChannelSelectMenuBuilder()
          .setCustomId(id)
          .setRequired(field.required)
          .setMinValues(field.required ? Math.max(1, c.minValues) : 0)
          .setMaxValues(Math.max(1, c.maxValues))
        if (c.placeholder) menu.setPlaceholder(c.placeholder.slice(0, 150))
        if (c.channelTypes.length > 0) {
          menu.setChannelTypes(c.channelTypes.map((t) => CHANNEL_TYPE_MAP[t]))
        }
        return menu
      })
    }

    case 'file': {
      const c = FileConfigSchema.parse(raw)
      return label.setFileUploadComponent(() =>
        new FileUploadBuilder()
          .setCustomId(id)
          .setRequired(field.required)
          .setMinValues(field.required ? Math.max(1, c.minFiles) : 0)
          .setMaxValues(Math.max(1, c.maxFiles)),
      )
    }
  }
}

export function buildTicketModal(
  ticketType: { id: string; modalTitle: string },
  fields: ModalField[],
): ModalBuilder {
  const modal = new ModalBuilder()
    .setCustomId(CUSTOM_ID.modal(ticketType.id))
    .setTitle((ticketType.modalTitle || 'เปิด Ticket').slice(0, 45))

  // Discord รับ component ระดับบนสุดได้ 5 อัน — ตัดส่วนเกินทิ้งแทนที่จะให้ modal เด้งไม่ขึ้น
  const labels = fields
    .slice(0, 5)
    .map(buildLabel)
    .filter((l): l is LabelBuilder => l !== null)

  if (labels.length > 0) modal.addLabelComponents(labels)
  return modal
}

// ── อ่านคำตอบกลับมา ─────────────────────────────────────────────────────

export type TicketAnswer = {
  key: string
  label: string
  kind: FieldKind
  /** ข้อความที่เอาไปแสดงใน embed ได้เลย */
  display: string
  /** ลิงก์ไฟล์แนบ (เฉพาะ kind = file) — ต้องรีบโหลดซ้ำ ลิงก์มีอายุ */
  attachments?: { name: string; url: string; size: number }[]
}

export type TicketAnswers = Record<string, TicketAnswer>

function labelsFor(values: readonly string[], raw: unknown): string {
  const cfg = OptionsConfigSchema.safeParse(raw)
  const options = cfg.success ? cfg.data.options : []
  const names = values.map((v) => options.find((o) => o.value === v)?.label ?? v)
  return names.join(', ')
}

export function extractAnswers(
  interaction: ModalSubmitInteraction,
  fields: ModalField[],
): TicketAnswers {
  const answers: TicketAnswers = {}

  for (const field of fields) {
    const kind = field.kind as FieldKind
    const id = fieldCustomId(field.id)
    const raw = parseConfig(field.config)

    const answer: TicketAnswer = { key: field.key, label: field.label, kind, display: '' }

    try {
      switch (kind) {
        case 'text':
          answer.display = interaction.fields.getTextInputValue(id).trim()
          break
        case 'select':
          answer.display = labelsFor(interaction.fields.getStringSelectValues(id), raw)
          break
        case 'radio':
          answer.display = labelsFor([interaction.fields.getRadioGroup(id) ?? ''].filter(Boolean), raw)
          break
        case 'checkbox': {
          const cfg = CheckboxConfigSchema.safeParse(raw)
          const options = cfg.success ? cfg.data.options : []
          const values = interaction.fields.getCheckboxGroup(id)
          answer.display = values
            .map((v) => options.find((o) => o.value === v)?.label ?? v)
            .join(', ')
          break
        }
        case 'user': {
          const users = interaction.fields.getSelectedUsers(id)
          answer.display = users ? [...users.keys()].map((uid) => `<@${uid}>`).join(' ') : ''
          break
        }
        case 'role': {
          const roles = interaction.fields.getSelectedRoles(id)
          answer.display = roles ? [...roles.keys()].map((rid) => `<@&${rid}>`).join(' ') : ''
          break
        }
        case 'channel': {
          const channels = interaction.fields.getSelectedChannels(id)
          answer.display = channels ? [...channels.keys()].map((cid) => `<#${cid}>`).join(' ') : ''
          break
        }
        case 'mentionable': {
          const picked = interaction.fields.getSelectedMentionables(id)
          const users = picked?.users ? [...picked.users.keys()].map((uid) => `<@${uid}>`) : []
          const roles = picked?.roles ? [...picked.roles.keys()].map((rid) => `<@&${rid}>`) : []
          answer.display = [...users, ...roles].join(' ')
          break
        }
        case 'file': {
          const files = interaction.fields.getUploadedFiles(id)
          const list = files ? [...files.values()] : []
          answer.attachments = list.map((a) => ({
            name: a.name,
            url: a.url,
            size: a.size,
          }))
          answer.display = list.length > 0 ? `แนบมา ${list.length} ไฟล์` : ''
          break
        }
      }
    } catch {
      // ฟิลด์ไม่บังคับที่ผู้ใช้เว้นว่างไว้ — ปล่อยเป็นค่าว่าง
      answer.display = ''
    }

    answers[field.key] = answer
  }

  return answers
}
