# フィードバック対応タスクリスト

`docs/feedback.md` のレビュー結果に基づく改善タスク。

---

## Priority 0: バグ/未完で設計思想が崩れる

### 1. lastChatAt の正確化

**方針**: `lastChatAt` を `max(chatMessages.createdAt)` で算出する（事実ベースの思想に合致）

- [ ] `findFilteredTopics()` の `lastChatAt` を `max(chatMessages.createdAt)` に変更
  - 対象: `apps/api/src/features/topic/repository.ts`
- [ ] 変更後、復習フィルタの `daysSinceLastChat` / `hasPostCheckChat` が正しく動作することを確認

### 2. 日次メトリクスを表示可能にする

**方針**: スナップショットを廃止し、オンザフライ集計に変更（運用がシンプル、D1の性能で十分）

- [ ] `GET /metrics/daily` をオンザフライ集計に変更
  - 対象: `apps/api/src/features/metrics/usecase.ts`, `repository.ts`
- [ ] `checkedTopicCount` を `topicCheckHistory` から「日付時点の状態」を正確に復元する計算に修正
  - 対象: `apps/api/src/features/metrics/repository.ts`
  - 現状: `userTopicProgress.understood=true` の現在値を返している
  - 修正: その日の終わり時点で checked - unchecked を計算
- [ ] `metricSnapshots` テーブルの廃止を検討（または将来のキャッシュ用として残す）
- [ ] `DailyMetricsChart` で `goodQuestionCount`（軸B）を表示
  - 対象: `apps/web/src/features/metrics/components/DailyMetricsChart.tsx`

### 3. 日次集計のタイムゾーン対応

**方針**: ユーザーごとにタイムゾーンを保存（デフォルト: Asia/Tokyo）

- [ ] `users` テーブルに `timezone` カラムを追加（デフォルト: `"Asia/Tokyo"`）
  - 対象: `packages/db/src/schema/users.ts`
- [ ] マイグレーション作成・適用
- [ ] 初回ログイン時にブラウザの `Intl.DateTimeFormat().resolvedOptions().timeZone` を取得して保存
  - 対象: `apps/api/src/features/auth/usecase.ts`（Google OAuth コールバック）
- [ ] 集計時にユーザーの timezone を使って日付境界を計算
  - 対象: `apps/api/src/features/metrics/repository.ts`
- [ ] （将来）設定画面でタイムゾーン変更を可能に

---

## Priority 1: 設計思想のコアに沿った拡張性

### 4. 質問ラベルの内部メタを保存

- [ ] `chatMessages` テーブルに `questionQualityReason` カラムを追加
  - 対象: `packages/db/src/schema/chat.ts`
- [ ] マイグレーション作成・適用
- [ ] `evaluateQuestion()` で判定理由を保存
  - 対象: `apps/api/src/features/chat/usecase.ts`
- [ ] 分析・ノート生成での活用は後続タスクとして検討

### 5. OCR テキストの再閲覧導線

- [ ] 画像付きメッセージに「抽出テキスト」の折りたたみ表示を追加
  - 対象: `apps/web/src/features/chat/components/ChatMessage.tsx`
- [ ] `ocrResult` が存在する場合のみ表示

---

## Priority 2: 使い勝手と性能の底上げ

### 6. N+1 問題の解消

- [ ] `listSessionsByTopic` の集計を SQL に寄せる
  - 対象: `apps/api/src/features/chat/usecase.ts`
  - 現状: セッションごとに `getSessionMessageCount` + `getSessionQualityStats` を呼び出し
- [ ] Topic 単位の「深掘り質問一覧」を 1 発で返す API を検討
- [ ] ノート一覧の深掘り質問抽出を最適化
  - 対象: `apps/web/src/features/note/components/TopicNotes.tsx`

### 7. ノート編集の自由度を UI に反映

- [ ] ノート詳細画面で `keyPoints` / `stumbledPoints` の編集を可能にする
  - 対象: `apps/web/src/routes/notes/$noteId.tsx`
- [ ] API は既に対応済み（`apps/api/src/features/note/route.ts`）

### 8. 分野・試験非依存化（将来対応）

- [ ] 科目の絵文字/色を DB または設定ファイルに移動
  - 対象: `apps/web/src/routes/subjects/index.tsx`
- [ ] system prompt の「公認会計士試験」固定を環境設定または DB に移動
  - 対象: `apps/api/src/features/chat/usecase.ts`
- [ ] seed の `subjectSlugMap` を入力データ駆動に変更
  - 対象: `packages/db/scripts/seed.ts`

---

## 将来対応

### チャットの「必要最小限の履歴/要約」を実装

現状は全履歴送信で運用。トークン上限やコストが問題になった時点で対応。

- [ ] 履歴制限の方針を決定
  - 案1: 直近 N 往復のみ送信
  - 案2: セッション要約を DB に保存し、古い履歴は要約に置き換え
- [ ] `sendMessage()` の履歴取得ロジックを修正
  - 対象: `apps/api/src/features/chat/usecase.ts`

---

## 未実装の設計要件（参考）

以下は設計資料に記載があるが未実装のもの。優先度に応じて対応を検討。

- [ ] 論点のタグ/検索 UI
- [ ] 論点の作成・編集（管理者/ユーザー定義）
- [ ] タイムゾーン設定 UI
