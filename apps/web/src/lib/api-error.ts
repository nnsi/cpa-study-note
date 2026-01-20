import { toast } from "./toast"

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string
  ) {
    super(message)
    this.name = "ApiError"
  }
}

export const handleApiError = (error: unknown): never => {
  if (error instanceof ApiError) {
    switch (error.status) {
      case 401:
        toast.error("ログインが必要です")
        // 認証エラー時はログインページへリダイレクト
        window.location.href = "/login"
        break
      case 403:
        toast.error("アクセス権限がありません")
        break
      case 404:
        toast.error("リソースが見つかりません")
        break
      case 500:
        toast.error("サーバーエラーが発生しました")
        break
      default:
        toast.error(error.message || "エラーが発生しました")
    }
    throw error
  }

  if (error instanceof Error) {
    if (error.message.includes("Failed to fetch")) {
      toast.error("ネットワークエラーが発生しました")
    } else {
      toast.error(error.message || "エラーが発生しました")
    }
    throw error
  }

  toast.error("予期しないエラーが発生しました")
  throw new Error("Unknown error")
}

// API呼び出しのラッパー関数
export const withErrorHandling = async <T>(
  fn: () => Promise<T>,
  options?: {
    showError?: boolean
    onError?: (error: unknown) => void
  }
): Promise<T> => {
  try {
    return await fn()
  } catch (error) {
    if (options?.onError) {
      options.onError(error)
    }
    if (options?.showError !== false) {
      handleApiError(error)
    }
    throw error
  }
}
