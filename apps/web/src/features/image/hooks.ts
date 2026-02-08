import { useState, useCallback } from "react"
import { useMutation } from "@tanstack/react-query"
import { allowedMimeTypes, type AllowedMimeType } from "@cpa-study/shared/schemas"
import * as api from "./api"

const isAllowedMimeType = (type: string): type is AllowedMimeType =>
  Array.from<string>(allowedMimeTypes).includes(type)

type UploadState = {
  status: "idle" | "uploading" | "processing" | "done" | "error"
  imageId: string | null
  ocrText: string | null
  error: string | null
  previewUrl: string | null
}

export const useImageUpload = () => {
  const [state, setState] = useState<UploadState>({
    status: "idle",
    imageId: null,
    ocrText: null,
    error: null,
    previewUrl: null,
  })

  const reset = useCallback(() => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl)
    }
    setState({
      status: "idle",
      imageId: null,
      ocrText: null,
      error: null,
      previewUrl: null,
    })
  }, [state.previewUrl])

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!isAllowedMimeType(file.type)) {
        throw new Error(`サポートされていないファイル形式です: ${file.type}`)
      }

      setState((prev) => ({
        ...prev,
        status: "uploading",
        previewUrl: URL.createObjectURL(file),
      }))

      // 1. アップロードURL取得
      const { imageId } = await api.getUploadUrl(
        file.name,
        file.type
      )

      // 2. 画像アップロード
      await api.uploadImage(imageId, file)

      setState((prev) => ({
        ...prev,
        status: "processing",
        imageId,
      }))

      // 3. OCR実行
      const { ocrText } = await api.performOCR(imageId)

      setState((prev) => ({
        ...prev,
        status: "done",
        ocrText,
      }))

      return { imageId, ocrText }
    },
    onError: (error: Error) => {
      setState((prev) => ({
        ...prev,
        status: "error",
        error: error.message,
      }))
    },
  })

  const upload = useCallback(
    (file: File) => {
      uploadMutation.mutate(file)
    },
    [uploadMutation]
  )

  return {
    ...state,
    upload,
    reset,
    isUploading: state.status === "uploading" || state.status === "processing",
  }
}
