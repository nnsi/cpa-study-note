# フロントエンド一貫性レビューレポート

**日付**: 2026-02-05
**対象**: `apps/web/src/` 配下の全フロントエンドコード
**概要**: 13のfeatureモジュール、約100ファイルを走査し、コードの一貫性を6つの観点で分析した。

---

## 総合評価

| 観点 | 評価 | 主な問題数 |
|------|------|-----------|
| コンポーネントパターン | B | 3件 |
| Hooks・状態管理 | C | 6件 |
| API統合・データ取得 | C | 5件 |
| 型安全性・エラーハンドリング | D | 4件 |
| スタイリング | B | 3件 |
| アーキテクチャ（3層分離） | B | 2件 |

---

## 1. コンポーネントパターンの一貫性

### 1-1. 関数宣言 vs アロー関数 [中]

**問題**: コンポーネントの定義方法が混在している。

- **アロー関数（多数派）**: `export const Header = (...) => {` — 18ファイル以上
- **関数宣言（少数派）**: `export function DomainSelector() {` — 1ファイル

| パターン | ファイル例 |
|----------|-----------|
| `export const X = () => {` | `Header.tsx`, `ChatInput.tsx`, `BookmarkButton.tsx` 他多数 |
| `export function X() {` | `features/study-domain/components/DomainSelector.tsx:10` |

### 1-2. Props型定義の有無 [中]

**問題**: propsを受け取らないコンポーネントは問題ないが、内部サブコンポーネントのprops定義方法が混在。

- **別途`type Props`を定義（推奨パターン）**: `ChatInput.tsx:4`, `BookmarkButton.tsx:4`
- **インラインで型定義**: `ChatMessage.tsx:68` — `({ imageUrl, onClose }: { imageUrl: string; onClose: () => void })`
- **インラインで型定義**: `TopicInfo.tsx:162` — `({ history }: { history: CheckHistoryItem[] })`

### 1-3. ファイル命名規則 [良好]

PascalCase + `.tsx` で完全に統一されている。問題なし。

---

## 2. Hooks・状態管理の一貫性

### 2-1. export構文の不統一 [中]

hooksファイルでも関数宣言とアロー関数が混在。

| パターン | ファイル |
|----------|---------|
| `export const useX = () => {` | `features/chat/hooks.ts`, `features/search/hooks.ts`, `features/exercise/hooks.ts` |
| `export function useX() {` | `features/subject/hooks/useSubjects.ts:7,24,41,56,72,86,104,119`, `features/study-domain/hooks/useStudyDomains.ts:7` |

### 2-2. useDebounceの重複実装 [高]

同一機能のhookが2箇所に存在する。

| 場所 | 使用箇所 |
|------|---------|
| `lib/hooks/useDebounce.ts:3` | `routes/domains/$domainId/subjects/index.tsx` |
| `features/search/hooks.ts:8`（ローカル複製） | `features/search/hooks.ts:25` |

**対応**: `features/search/hooks.ts`のローカル実装を削除し、`lib/hooks/useDebounce`をimportする。

### 2-3. hookの返り値パターンが不統一 [高]

5つの異なるパターンが存在する。

| パターン | 例 |
|----------|---|
| 名前付きオブジェクト | `useSpeechRecognition` → `{ isListening, startListening, ... }` |
| state展開 + 追加プロパティ | `useExerciseAnalyze` → `{ ...state, analyze, reset, isAnalyzing }` |
| React Queryの直接返却 | `useCreateSubject` → `return useMutation({...})` |
| Query結果の加工 | `useProgress` → `{ isLoading, stats: {...}, subjectProgress }` |
| Query展開 + 加工 | `useChatMessages` → `{ messages, displayMessages, ...query }` |

**課題**: 利用側が各hookの返却パターンを個別に覚える必要がある。

### 2-4. ミューテーションhookの返却が不統一 [中]

| パターン | 例 |
|----------|---|
| `return useMutation({...})` | `useCreateSubject`, `useUpdateSubject` 等 |
| カスタムオブジェクト | `useExerciseConfirm` → `{ confirm, confirmAsync, isConfirming, error }` |
| 複合ラッパー | `useToggleBookmark` → `{ toggle, isLoading }` |

### 2-5. キャッシュ無効化パターンの不統一 [中]

| パターン | 例 |
|----------|---|
| 単一キー | `bookmark/hooks.ts:24` → `["bookmarks"]` |
| 複数キー | `note/hooks.ts:18-21` → 3つのキーを個別に無効化 |
| 部分キー | `subject/hooks/useSubjects.ts:62-64` → `["subjects"]` と `["subject"]` を別々に |

### 2-6. 3層分離のロジック違反 [中]

`progress/hooks.ts:31-42`に統計計算ロジックが埋め込まれている。`logic.ts`に分離すべき。

```typescript
// hooks.ts に直接書かれている計算ロジック
const totalTopics = subjectStats.reduce((acc, s) => acc + s.totalTopics, 0)
const understoodTopics = subjectStats.reduce((acc, s) => acc + s.understoodTopics, 0)
const completionRate = totalTopics > 0 ? Math.round((understoodTopics / totalTopics) * 100) : 0
```

**関連**: `features/progress/`には`logic.ts`が存在しない。`chat/`, `review/`, `search/`, `metrics/`には存在する。

---

## 3. API統合・データ取得の一貫性

### 3-1. エラーメッセージの言語混在 [高]

英語と日本語が混在しており、ユーザーに表示される可能性のあるメッセージが統一されていない。

| 言語 | ファイル | メッセージ例 |
|------|---------|-------------|
| 英語 | `chat/api.ts:19` | `"Failed to fetch messages"` |
| 英語 | `study-domain/api.ts:21,30` | `"Failed to fetch study domains"` |
| 日本語 | `subject/api.ts:56` | `"科目の取得に失敗しました"` |
| 日本語 | `exercise/api.ts:58` | `"分析に失敗しました"` |
| 混在 | `study-domain/api.ts:87` | 英語の関数内で日本語 `"CSVインポートに失敗しました"` |

### 3-2. QueryKeyの命名規則不統一 [高]

| 形式 | 例 | ファイル |
|------|---|---------|
| フラット配列 | `["bookmarks"]` | `bookmark/hooks.ts:7` |
| エンティティ+ID | `["check-history", topicId]` | `topic/hooks.ts:6` |
| 階層型 | `["chat", sessionId, "messages"]` | `chat/hooks.ts:143` |
| オブジェクト含み | `["subjects", { studyDomainId }]` | `routes/edit/index.tsx:52` |
| 長い階層 | `["subjects", subjectId, "categories", categoryId, "topics"]` | `routes/domains/...` |

### 3-3. fetchラッパーの重複 [高]

`lib/api-client.ts`の`fetchWithRetry`と、`features/exercise/api.ts:19-44`の`fetchWithAuth`が同じ責務（認証ヘッダー付与、401リトライ）を持つ。

**対応**: `exercise/api.ts`のローカル実装を削除し、`lib/api-client.ts`の共有実装を利用する。

### 3-4. SSEストリーミングコードの重複 [中]

`chat/api.ts`の`streamMessage`（34-86行）と`streamMessageWithNewSession`（89-139行）のSSEパース処理がほぼ同一。

**重複コード**: buffer管理、`\n\n`分割、`data: `プレフィックス処理、JSONパース、エラーハンドリングの全てが重複。

### 3-5. コンポーネント内でのインラインクエリ [低]

一部のルートコンポーネントがhooksを使わず直接`useQuery`を記述している。

- `routes/notes/$noteId.tsx:24-34` — `useQuery`を直接使用
- `routes/edit/index.tsx:52` — `useQuery`を直接使用

---

## 4. 型安全性・エラーハンドリング

### 4-1. `as`型アサーションの多用 [高]

プロジェクトガイドラインで「型アサーションを避ける」と明記されているが、15箇所で使用。

**最も深刻なパターン**: エラーレスポンスのアサーション（9箇所で同一パターン）

```typescript
// subject/api.ts:84, 100, 112, 140, 156
// study-domain/api.ts:43, 59, 71, 87
// exercise/api.ts:77
const error = await res.json()
throw new Error((error as { error?: { message?: string } }).error?.message ?? "...")
```

**対応**: `packages/shared/schemas/`にエラーレスポンスのZodスキーマを定義し、`safeParse`で検証する。

**その他のアサーション**:

| 箇所 | 型アサーション | 対応案 |
|------|--------------|--------|
| `lib/api-client.ts:15,40` | `init.headers as HeadersInit` | Headers型ガードで検証 |
| `search/hooks.ts:28` | `useParams({ strict: false }) as { domainId?: string }` | ルート型パラメータを活用 |
| `review/hooks.ts:124` | `error as Error \| null` | 不要（React Queryの型で十分） |
| `bookmark/components/BookmarksList.tsx:27` | `{} as GroupedBookmarks` | reduce初期値を型付きオブジェクトで定義 |
| `search/components/GlobalSearchModal.tsx:46` | `children[i] as HTMLElement` | `instanceof HTMLElement`で型ガード |
| `DomainSelector.tsx:21` | `event.target as Node` | `instanceof Node`で型ガード |
| `TopicDetailEditor.tsx:49` | `value as TopicNodeInput["difficulty"]` | Zodで検証 |
| `image/hooks.ts:7` | `allowedMimeTypes as readonly string[]` | `.includes()`の型を修正 |
| `routes/exercises/index.tsx:47` | `res.json() as Promise<T>` | Zodスキーマで検証 |

### 4-2. エラーレスポンスの解析方法が不統一 [高]

| 方法 | ファイル |
|------|---------|
| パースしない | `chat/api.ts:19` → `throw new Error("...")` |
| `.catch()`でフォールバック | `exercise/api.ts:57` |
| `as`で型アサーション | `subject/api.ts:84` 等（9箇所） |
| 空配列を返却 | `note/components/TopicNotes.tsx:23` → `return []` |

### 4-3. Zodバリデーションの適用が不完全 [中]

成功レスポンスにはZodスキーマを適用しているが、エラーレスポンスにはスキーマがない。

### 4-4. import文の`type ... as`による型エイリアス [低]

`subject/api.ts:18-20`で`import { type TopicNode as TopicNodeInput }`という非標準パターンを使用。

---

## 5. スタイリングの一貫性

### 5-1. ボタンスタイルの不統一 [中]

`index.css`で`.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-accent`が定義されているが、一部コンポーネントが独自にスタイルを記述。

| ファイル | 問題 |
|---------|------|
| `exercise/components/ExerciseComplete.tsx` | `.btn-primary`を使わず`py-2.5 px-4 bg-indigo-600 text-white`を直接記述 |
| `review/components/TopicFilter.tsx:132` | リセットボタンがボタンクラスを未使用 |

### 5-2. フォーム入力のスタイル不統一 [中]

`index.css`で`.input-field`が定義されているが、未使用の箇所がある。

| ファイル | 問題 |
|---------|------|
| `review/components/TopicFilter.tsx` | `w-20 px-3 py-2 border border-ink-200 rounded-lg`を直接記述 |
| `subject/components/TreeNode.tsx` | `flex-1 px-2 py-0.5 rounded border border-indigo-300`を直接記述 |

### 5-3. border-radiusの値がバラバラ [低]

`rounded-lg`（74箇所）、`rounded-xl`（38箇所）、`rounded-2xl`（12箇所）、`rounded-md`（2箇所）、`rounded`（size指定なし、数箇所）が混在。同種のUI要素でも値が異なる。

---

## 6. 優先度別 改善項目

### Priority 1（高 — 品質・保守性に直結）

| # | 問題 | 影響範囲 | 対応 |
|---|------|---------|------|
| 1 | エラーレスポンスの`as`アサーション | 9箇所 | Zodスキーマ `apiErrorSchema` を定義し、`safeParse`で検証 |
| 2 | fetchラッパーの重複 | `exercise/api.ts` | `lib/api-client.ts`の共有実装に統一 |
| 3 | useDebounceの重複 | `search/hooks.ts` | ローカル実装を削除、`lib/hooks/useDebounce`をimport |
| 4 | エラーメッセージの言語混在 | 全api.tsファイル | 日本語に統一（ユーザー向けメッセージのため） |

### Priority 2（中 — 一貫性向上）

| # | 問題 | 影響範囲 | 対応 |
|---|------|---------|------|
| 5 | export構文の不統一 | 全feature | `export const`に統一（`ErrorBoundary`のclass除く） |
| 6 | SSEパースコードの重複 | `chat/api.ts` | ヘルパー関数`parseSSEStream`を抽出 |
| 7 | QueryKeyの命名規則 | 全hooks | `[entity, id?, relation?, params?]`形式に統一 |
| 8 | ボタン・フォームのスタイル | 数ファイル | `.btn-*`, `.input-field`クラスを一貫して使用 |
| 9 | progressにlogic.tsがない | `features/progress/` | 統計計算ロジックを`logic.ts`に分離 |

### Priority 3（低 — 改善推奨）

| # | 問題 | 影響範囲 | 対応 |
|---|------|---------|------|
| 10 | サブコンポーネントのprops型定義 | 数ファイル | インライン型 → 別途`type`定義に統一 |
| 11 | ミューテーションhookの返却パターン | 全hooks | 直接返却 or カスタムオブジェクトのどちらかに統一 |
| 12 | ルートコンポーネント内のインラインクエリ | 数ファイル | hooks層に移動 |
| 13 | border-radiusの値のバラつき | 全コンポーネント | 用途別のルールを策定 |

---

## 良い点

一貫性の観点で、以下は既に統一されている。

- **ファイル命名**: PascalCase（コンポーネント）、camelCase（hooks/logic/api）で統一
- **Feature構造**: api.ts / hooks.ts / components/ / index.ts の構成が全featureで統一
- **Zodバリデーション**: 成功レスポンスには全てZodスキーマを適用
- **import規則**: `@/`プレフィックスによる絶対パス、`import type`の使い分け
- **状態管理の選択**: グローバル状態はZustand、サーバー状態はReact Queryで完全に分離
- **Hono RPC**: SSE/multipart以外は全てHono RPCクライアントを使用
- **index.tsのバレルエクスポート**: 全featureで公開APIを制御
- **バッジスタイル**: `.badge-*`クラスは一貫して使用されている
