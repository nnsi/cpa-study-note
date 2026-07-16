import { useCallback, useEffect, useRef, useState } from "react"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { uploadImageRequestSchema } from "@cpa-study/shared/schemas"
import { getUploadUrl, uploadImage } from "@/features/image/api"
import { getSubjectTree, updateSubjectTree } from "@/features/subject/api"
import * as api from "./api"
import { downscaleImage } from "./image-resize"
import {
  countSelectedTopics,
  mergeIntoTree,
  parseTocSuggestionsFromText,
  toEditableTree,
  type EditableCategory,
} from "./logic"

export type TocImageStatus = "uploading" | "done" | "error"

export type TocImage = {
  key: number
  file: File
  previewUrl: string
  imageId: string | null
  status: TocImageStatus
  error: string | null
}

/** 目次画像の縮小、アップロード、削除、ページ順の並べ替えを管理する。 */
export const useTocImages = () => {
  const [images, setImages] = useState<TocImage[]>([])
  const [error, setError] = useState<string | null>(null)
  const nextKeyRef = useRef(0)
  const imagesRef = useRef<TocImage[]>([])

  useEffect(() => {
    imagesRef.current = images
  }, [images])

  useEffect(
    () => () => {
      for (const image of imagesRef.current) {
        URL.revokeObjectURL(image.previewUrl)
      }
    },
    []
  )

  const updateImage = useCallback(
    (key: number, update: (image: TocImage) => TocImage) => {
      setImages((current) =>
        current.map((image) => (image.key === key ? update(image) : image))
      )
    },
    []
  )

  const upload = useCallback(
    async (key: number, sourceFile: File) => {
      try {
        const file = await downscaleImage(sourceFile)
        const mimeType = uploadImageRequestSchema.shape.mimeType.safeParse(file.type)
        if (!mimeType.success) {
          throw new Error(`サポートされていないファイル形式です: ${file.type}`)
        }

        if (file !== sourceFile) {
          const previewUrl = URL.createObjectURL(file)
          updateImage(key, (image) => {
            URL.revokeObjectURL(image.previewUrl)
            return { ...image, file, previewUrl }
          })
        }

        const { imageId } = await getUploadUrl(file.name, mimeType.data)
        await uploadImage(imageId, file)
        updateImage(key, (image) => ({
          ...image,
          file,
          imageId,
          status: "done",
          error: null,
        }))
      } catch (uploadError) {
        const message =
          uploadError instanceof Error
            ? uploadError.message
            : "画像のアップロードに失敗しました"
        updateImage(key, (image) => ({
          ...image,
          status: "error",
          error: message,
        }))
      }
    },
    [updateImage]
  )

  const addFiles = useCallback(
    (files: File[]) => {
      const remaining = Math.max(0, 5 - images.length)
      const accepted = files.slice(0, remaining)

      if (files.length > remaining) {
        setError("目次画像は5枚まで選択できます")
      } else {
        setError(null)
      }

      const additions: TocImage[] = accepted.map((file) => ({
        key: nextKeyRef.current++,
        file,
        previewUrl: URL.createObjectURL(file),
        imageId: null,
        status: "uploading",
        error: null,
      }))
      if (additions.length === 0) return

      setImages((current) => [...current, ...additions])
      for (const image of additions) {
        void upload(image.key, image.file)
      }
    },
    [images.length, upload]
  )

  const remove = useCallback((index: number) => {
    setImages((current) => {
      const target = current[index]
      if (!target) return current
      URL.revokeObjectURL(target.previewUrl)
      return current.filter((_, currentIndex) => currentIndex !== index)
    })
    setError(null)
  }, [])

  const move = useCallback((from: number, to: number) => {
    setImages((current) => {
      if (
        from < 0 ||
        from >= current.length ||
        to < 0 ||
        to >= current.length ||
        from === to
      ) {
        return current
      }

      const reordered = [...current]
      const [target] = reordered.splice(from, 1)
      reordered.splice(to, 0, target)
      return reordered
    })
  }, [])

  return { images, error, addFiles, remove, move }
}

/** 目次提案のストリーミングと編集可能ツリーを管理する。 */
export const useTocSuggestion = (subjectId: string) => {
  const [streamingText, setStreamingText] = useState("")
  const [isStreaming, setIsStreaming] = useState(false)
  const [tree, setTree] = useState<EditableCategory[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const abort = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  useEffect(() => abort, [abort])

  const suggest = useCallback(
    async (imageIds: string[]) => {
      abort()
      const controller = new AbortController()
      abortRef.current = controller
      setStreamingText("")
      setIsStreaming(true)
      setTree(null)
      setError(null)

      let fullText = ""
      let textBuffer = ""
      let animationFrame: number | null = null

      const flushBuffer = () => {
        const text = textBuffer
        textBuffer = ""
        animationFrame = null
        if (text && abortRef.current === controller) {
          setStreamingText((current) => current + text)
        }
      }

      try {
        for await (const chunk of api.suggestToc(
          subjectId,
          imageIds,
          controller.signal
        )) {
          if (chunk.type === "text" && chunk.content) {
            fullText += chunk.content
            textBuffer += chunk.content
            if (animationFrame === null) {
              animationFrame = requestAnimationFrame(flushBuffer)
            }
          } else if (chunk.type === "done") {
            if (animationFrame !== null) cancelAnimationFrame(animationFrame)
            flushBuffer()
            const parsed = parseTocSuggestionsFromText(fullText)
            if (parsed) {
              setTree(toEditableTree(parsed))
            } else {
              setError("解析結果を読み取れませんでした。再解析してください")
            }
          } else if (chunk.type === "error") {
            setError(chunk.error ?? "目次の解析中にエラーが発生しました")
          }
        }
      } catch (suggestionError) {
        if (
          suggestionError instanceof DOMException &&
          suggestionError.name === "AbortError"
        ) {
          return
        }
        setError(
          suggestionError instanceof Error
            ? suggestionError.message
            : "目次の解析中にエラーが発生しました"
        )
      } finally {
        if (animationFrame !== null) cancelAnimationFrame(animationFrame)
        if (abortRef.current === controller) {
          flushBuffer()
          setIsStreaming(false)
          abortRef.current = null
        }
      }
    },
    [abort, subjectId]
  )

  return {
    streamingText,
    isStreaming,
    tree,
    setTree,
    error,
    suggest,
    abort,
    selectedCount: tree ? countSelectedTopics(tree) : 0,
  }
}

/** 編集済みの目次提案を現在の科目ツリーへ一括登録する。 */
export const useApplyTocSuggestions = (subjectId: string) => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (tree: EditableCategory[]) => {
      const current = await getSubjectTree(subjectId)
      const categories = mergeIntoTree(current.tree, tree)
      await updateSubjectTree(subjectId, { categories })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["subjects", subjectId, "tree"],
      })
      queryClient.invalidateQueries({ queryKey: ["subjects"] })
    },
  })
}
