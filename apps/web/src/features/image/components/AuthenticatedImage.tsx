import { useEffect, useState, type ImgHTMLAttributes } from "react"
import { fetchWithRetry } from "@/lib/api-client"

const API_URL = import.meta.env.VITE_API_URL || ""

export const useAuthenticatedImageUrl = (imageId: string | null | undefined) => {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!imageId) {
      setUrl(null)
      return
    }

    const controller = new AbortController()
    let objectUrl: string | null = null

    void fetchWithRetry(`${API_URL}/api/images/${imageId}/file`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error("画像の取得に失敗しました")
        return response.blob()
      })
      .then((blob) => {
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setUrl(objectUrl)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setUrl(null)
      })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [imageId])

  return url
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  imageId: string
}

export const AuthenticatedImage = ({ imageId, alt, ...props }: Props) => {
  const url = useAuthenticatedImageUrl(imageId)
  if (!url) return <span role="img" aria-label={`${alt ?? "画像"}を読み込み中`} {...{ className: props.className }} />
  return <img src={url} alt={alt} {...props} />
}
