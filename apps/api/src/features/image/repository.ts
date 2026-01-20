import { eq } from "drizzle-orm"
import type { Db } from "@cpa-study/db"
import { images } from "@cpa-study/db/schema"

export type Image = {
  id: string
  userId: string
  filename: string
  mimeType: string
  size: number
  r2Key: string
  ocrText: string | null
  createdAt: Date
}

export type ImageRepository = {
  create: (data: Omit<Image, "id" | "createdAt">) => Promise<Image>
  findById: (id: string) => Promise<Image | null>
  updateOcrText: (id: string, ocrText: string) => Promise<void>
}

export const createImageRepository = (db: Db): ImageRepository => ({
  create: async (data) => {
    const id = crypto.randomUUID()
    const now = new Date()

    await db.insert(images).values({
      id,
      userId: data.userId,
      filename: data.filename,
      mimeType: data.mimeType,
      size: data.size,
      r2Key: data.r2Key,
      ocrText: data.ocrText,
      createdAt: now,
    })

    return { id, ...data, createdAt: now }
  },

  findById: async (id) => {
    const result = await db
      .select()
      .from(images)
      .where(eq(images.id, id))
      .limit(1)
    return result[0] ?? null
  },

  updateOcrText: async (id, ocrText) => {
    await db.update(images).set({ ocrText }).where(eq(images.id, id))
  },
})
