/**
 * プロンプトインジェクション対策のための入力サニタイズ
 */

const MAX_NAME_LENGTH = 100
const MAX_CUSTOM_PROMPT_LENGTH = 2000

/**
 * ユーザー入力をプロンプト用にサニタイズ（短い名前向け）
 * - Unicode正規化（NFC）
 * - 改行をスペースに置換
 * - 制御文字を除去
 * - 前後の空白をトリム
 * - 長さを100文字に制限
 */
export function sanitizeForPrompt(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[\r\n]/g, " ")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .trim()
    .slice(0, MAX_NAME_LENGTH)
}

/**
 * カスタムプロンプト用サニタイズ（長めのテキスト向け）
 * - Unicode正規化（NFC）
 * - 制御文字を除去（改行は保持）
 * - 前後の空白をトリム
 * - 長さを2000文字に制限
 */
export function sanitizeCustomPrompt(input: string): string {
  return input
    .normalize("NFC")
    .replace(/[\x00-\x1F\x7F]/g, (char) => (char === "\n" || char === "\r" ? char : ""))
    .trim()
    .slice(0, MAX_CUSTOM_PROMPT_LENGTH)
}
