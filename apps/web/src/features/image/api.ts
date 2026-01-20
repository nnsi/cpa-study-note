import { api } from "@/lib/api-client"

export const getUploadUrl = async (filename: string, mimeType: string) => {
  const res = await api.api.images["upload-url"].$post({
    json: { filename, mimeType },
  })
  if (!res.ok) throw new Error("Failed to get upload URL")
  return res.json()
}

export const uploadImage = async (
  imageId: string,
  file: File
): Promise<void> => {
  // Hono RPCはArrayBuffer bodyに対応していないため直接fetchを使用
  const apiUrl = import.meta.env.VITE_API_URL || ""
  const res = await fetch(`${apiUrl}/api/images/${imageId}/upload`, {
    method: "POST",
    headers: {
      "Content-Type": file.type,
    },
    body: await file.arrayBuffer(),
    credentials: "include",
  })
  if (!res.ok) throw new Error("Failed to upload image")
}

export const performOCR = async (imageId: string) => {
  const res = await api.api.images[":imageId"].ocr.$post({
    param: { imageId },
  })
  if (!res.ok) throw new Error("Failed to perform OCR")
  return res.json()
}

export const getImage = async (imageId: string) => {
  const res = await api.api.images[":imageId"].$get({
    param: { imageId },
  })
  if (!res.ok) throw new Error("Failed to get image")
  return res.json()
}
