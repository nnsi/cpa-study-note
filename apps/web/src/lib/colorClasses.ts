/**
 * Tailwind 動的クラス対応
 *
 * Tailwindはビルド時にクラス名を静的解析するため、
 * 動的に生成されるクラス名（`bg-${color}-50`）は認識されない。
 * このマッピングを使って、DBに保存された色名から
 * 完全なTailwindクラス名に変換する。
 */

const bgColorClasses: Record<string, string> = {
  blue: "bg-blue-50",
  emerald: "bg-emerald-50",
  amber: "bg-amber-50",
  rose: "bg-rose-50",
  violet: "bg-violet-50",
  yellow: "bg-yellow-50",
  orange: "bg-orange-50",
  slate: "bg-slate-50",
  indigo: "bg-indigo-50",
}

/**
 * 色名からTailwindの背景色クラスを取得する
 * @param color - DBに保存された色名（blue, emerald, amber など）
 * @returns Tailwindの背景色クラス（bg-blue-50 など）、null/未知の色の場合はデフォルト
 */
export function getColorClass(color: string | null): string {
  return color ? bgColorClasses[color] ?? "bg-ink-100" : "bg-ink-100"
}
