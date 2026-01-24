import type { ImageRepository } from "./repository"
import type { AIAdapter } from "@/shared/lib/ai"

// ファイル名サニタイズ: パストラバーサル防止
const sanitizeFilename = (filename: string): string => {
  // パス区切り文字を除去してベース名のみ取得
  const basename = filename.split(/[\\/]/).pop() || "file"
  // 許可文字（英数字、ドット、ハイフン、アンダースコア）のみ残し、100文字に制限
  return basename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100)
}

// マジックバイト検証: ファイル形式の実際の検証
const MAGIC_BYTES: Record<string, number[]> = {
  "image/jpeg": [0xff, 0xd8, 0xff],
  "image/png": [0x89, 0x50, 0x4e, 0x47],
  "image/gif": [0x47, 0x49, 0x46],
  "image/webp": [0x52, 0x49, 0x46, 0x46], // RIFF header
}

const validateMagicBytes = (buffer: ArrayBuffer, mimeType: string): boolean => {
  const bytes = new Uint8Array(buffer)
  const expected = MAGIC_BYTES[mimeType]
  if (!expected) return false
  if (bytes.length < expected.length) return false
  return expected.every((b, i) => bytes[i] === b)
}

type ImageDeps = {
  imageRepo: ImageRepository
  aiAdapter: AIAdapter
  r2: R2Bucket
  apiBaseUrl: string
}

type ImageResponse = {
  id: string
  userId: string
  filename: string
  mimeType: string
  size: number
  r2Key: string
  ocrText: string | null
  createdAt: string
}

type CreateUploadInput = {
  userId: string
  filename: string
  mimeType: string
}

// 画像をレスポンス形式に変換
const toImageResponse = (image: {
  id: string
  userId: string
  filename: string
  mimeType: string
  size: number
  r2Key: string
  ocrText: string | null
  createdAt: Date
}): ImageResponse => ({
  ...image,
  createdAt: image.createdAt.toISOString(),
})

// アップロードURL取得 + メタデータ作成
export const createUploadUrl = async (
  deps: Pick<ImageDeps, "imageRepo" | "apiBaseUrl">,
  input: CreateUploadInput
): Promise<{ uploadUrl: string; imageId: string }> => {
  const { imageRepo, apiBaseUrl } = deps
  const { userId, filename, mimeType } = input

  const imageId = crypto.randomUUID()
  const safeFilename = sanitizeFilename(filename)
  // R2キーからuserIdを除去（DBで関連付けを管理）
  const r2Key = `images/${imageId}/${safeFilename}`

  // R2への署名付きアップロードURLを生成
  const uploadUrl = `${apiBaseUrl}/api/images/${imageId}/upload`

  // メタデータを先に保存
  await imageRepo.create({
    id: imageId,
    userId,
    filename,
    mimeType,
    size: 0,
    r2Key,
    ocrText: null,
  })

  return { uploadUrl, imageId }
}

// 画像アップロード
export const uploadImage = async (
  deps: Pick<ImageDeps, "imageRepo" | "r2">,
  userId: string,
  imageId: string,
  body: ArrayBuffer
): Promise<
  { ok: true } | { ok: false; error: string; status: number }
> => {
  const { imageRepo, r2 } = deps

  const image = await imageRepo.findById(imageId)
  if (!image) {
    return { ok: false, error: "Image not found", status: 404 }
  }

  if (image.userId !== userId) {
    return { ok: false, error: "Unauthorized", status: 403 }
  }

  // マジックバイト検証: 宣言されたMIMEタイプと実際のファイル形式が一致するか確認
  if (!validateMagicBytes(body, image.mimeType)) {
    return { ok: false, error: "Invalid file format", status: 400 }
  }

  // R2にアップロード
  await r2.put(image.r2Key, body, {
    httpMetadata: {
      contentType: image.mimeType,
    },
  })

  return { ok: true }
}

// OCR実行
export const performOCR = async (
  deps: ImageDeps,
  userId: string,
  imageId: string
): Promise<
  { ok: true; imageId: string; ocrText: string } | { ok: false; error: string; status: number }
> => {
  const { imageRepo, aiAdapter, r2 } = deps

  const image = await imageRepo.findById(imageId)
  if (!image) {
    return { ok: false, error: "Image not found", status: 404 }
  }

  if (image.userId !== userId) {
    return { ok: false, error: "Unauthorized", status: 403 }
  }

  // R2から画像を取得
  const object = await r2.get(image.r2Key)
  if (!object) {
    return { ok: false, error: "Image file not found", status: 404 }
  }

  const arrayBuffer = await object.arrayBuffer()
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
  const imageUrl = `data:${image.mimeType};base64,${base64}`

  // OCR AI呼び出し
  const ocrPrompt = `この画像から全てのテキストを抽出してください。
表や数式がある場合は、構造を保持してテキスト形式で出力してください。
数値や計算式は正確に抽出してください。`

  const result = await aiAdapter.generateText({
    model: "openai/gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: ocrPrompt,
        imageUrl,
      },
    ],
    temperature: 0,
    maxTokens: 2000,
  })

  await imageRepo.updateOcrText(imageId, result.content)

  return { ok: true, imageId, ocrText: result.content }
}

// 画像取得
export const getImage = async (
  deps: Pick<ImageDeps, "imageRepo">,
  userId: string,
  imageId: string
): Promise<
  { ok: true; image: ImageResponse } | { ok: false; error: string; status: number }
> => {
  const image = await deps.imageRepo.findById(imageId)

  if (!image) {
    return { ok: false, error: "Image not found", status: 404 }
  }

  if (image.userId !== userId) {
    return { ok: false, error: "Unauthorized", status: 403 }
  }

  return { ok: true, image: toImageResponse(image) }
}
