import { AttachmentBuilder, EmbedBuilder } from 'discord.js'
import { isEmbedEmpty, type MessagePayload } from '@/lib/schema/message'
import { isUploadRef, readUpload } from '@/lib/uploads'
import { render, type TemplateVars } from './template'

export type BuiltMessage = {
  content: string | undefined
  embeds: EmbedBuilder[]
  /** ไฟล์ที่ต้องแนบไปด้วยเมื่อ embed อ้างรูปแบบ attachment:// */
  files: AttachmentBuilder[]
}

/**
 * รวบรวมไฟล์ที่ต้องแนบและแปลงค่าในช่องรูปให้เป็น URL ที่ Discord ใช้ได้
 *
 * - "upload:xxx.png" → แนบไฟล์แล้วอ้าง "attachment://xxx.png"
 * - "https://..."    → ใช้ตรงๆ
 * - อย่างอื่น        → ทิ้ง เพราะ Discord ปฏิเสธทั้งข้อความถ้า URL ผิดรูป
 */
class ImageResolver {
  private readonly attached = new Map<string, AttachmentBuilder>()

  async resolve(raw: string, vars: TemplateVars): Promise<string | undefined> {
    const value = render(raw, vars).trim()
    if (!value) return undefined

    if (isUploadRef(value)) {
      const file = await readUpload(value)
      if (!file) return undefined
      if (!this.attached.has(file.name)) {
        this.attached.set(file.name, new AttachmentBuilder(file.data, { name: file.name }))
      }
      return `attachment://${file.name}`
    }

    return /^https?:\/\//i.test(value) ? value : undefined
  }

  get files(): AttachmentBuilder[] {
    return [...this.attached.values()]
  }
}

export async function buildMessage(
  payload: MessagePayload,
  vars: TemplateVars = {},
): Promise<BuiltMessage> {
  const content = render(payload.content, vars).trim()
  const embeds: EmbedBuilder[] = []
  const images = new ImageResolver()

  if (payload.useEmbed && !isEmbedEmpty(payload.embed)) {
    const e = payload.embed
    const embed = new EmbedBuilder()

    const title = render(e.title, vars).trim()
    const description = render(e.description, vars).trim()
    const footerText = render(e.footerText, vars).trim()
    const authorName = render(e.authorName, vars).trim()

    if (title) embed.setTitle(title.slice(0, 256))
    if (description) embed.setDescription(description.slice(0, 4096))
    if (e.color) embed.setColor(e.color as `#${string}`)

    const linkUrl = render(e.url, vars).trim()
    if (title && /^https?:\/\//i.test(linkUrl)) embed.setURL(linkUrl)

    if (authorName) {
      embed.setAuthor({
        name: authorName.slice(0, 256),
        iconURL: await images.resolve(e.authorIconUrl, vars),
      })
    }
    if (footerText) {
      embed.setFooter({
        text: footerText.slice(0, 2048),
        iconURL: await images.resolve(e.footerIconUrl, vars),
      })
    }

    const thumbnail = await images.resolve(e.thumbnailUrl, vars)
    if (thumbnail) embed.setThumbnail(thumbnail)

    const image = await images.resolve(e.imageUrl, vars)
    if (image) embed.setImage(image)

    if (e.showTimestamp) embed.setTimestamp(new Date())

    const fields = e.fields
      .map((f) => ({
        name: render(f.name, vars).trim().slice(0, 256),
        value: render(f.value, vars).trim().slice(0, 1024),
        inline: f.inline,
      }))
      .filter((f) => f.name && f.value)

    if (fields.length > 0) embed.addFields(fields)

    embeds.push(embed)
  }

  return { content: content || undefined, embeds, files: images.files }
}
