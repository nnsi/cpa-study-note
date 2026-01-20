import { create } from "zustand"
import { useEffect } from "react"

type Toast = {
  id: string
  type: "success" | "error" | "info"
  message: string
}

type ToastStore = {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, "id">) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = crypto.randomUUID()
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id }],
    }))
    // 5秒後に自動削除
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }))
    }, 5000)
  },
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),
}))

export const toast = {
  success: (message: string) =>
    useToastStore.getState().addToast({ type: "success", message }),
  error: (message: string) =>
    useToastStore.getState().addToast({ type: "error", message }),
  info: (message: string) =>
    useToastStore.getState().addToast({ type: "info", message }),
}

export const ToastContainer = () => {
  const { toasts, removeToast } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-20 lg:bottom-4 right-4 z-50 space-y-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg max-w-sm animate-slide-in ${
            t.type === "success"
              ? "bg-green-600 text-white"
              : t.type === "error"
                ? "bg-red-600 text-white"
                : "bg-blue-600 text-white"
          }`}
        >
          <span>
            {t.type === "success" && "✓"}
            {t.type === "error" && "✕"}
            {t.type === "info" && "ℹ"}
          </span>
          <span className="flex-1 text-sm">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="text-white/70 hover:text-white"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
