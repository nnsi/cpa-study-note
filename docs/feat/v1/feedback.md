# コードベースレビュー: 設計思想と拡張性の評価

以下、リポジトリ全体（monorepo）を前提に、設計資料（`docs/design`）で定義されている思想・要件が実装に反映されているか、あわせて拡張性（保守性・スケール・将来の機能追加）に問題がないかを、コードから観測できる事実ベースで評価します。

---

## 1. コードベース全体像

### 技術スタックと構成
- **monorepo（pnpm）**
  - `apps/api`: Cloudflare Workers + Hono + Drizzle（D1/SQLite）+ R2、OpenRouter 経由で AI 呼び出し
  - `apps/web`: React + TanStack Router + React Query + Vite
  - `packages/db`: Drizzle スキーマ + migrations + seed
  - `packages/shared`: zod schema / shared types（APIとWebの型整合に寄与）

### ドメイン実装（DBスキーマ）対応
設計資料のエンティティは概ねDBに落ちています。
- Subject/Category/Topic: `packages/db/src/schema/topics.ts`
- TopicCheck（自己判断）: `userTopicProgress.understood` + `topicCheckHistory`
- ChatSession/ChatMessage: `packages/db/src/schema/chat.ts`
- Note: `packages/db/src/schema/notes.ts`
- Attachment（画像）: `packages/db/src/schema/images.ts`（R2格納 + ocrText保持）
- MetricSnapshot: `packages/db/src/schema/metrics.ts`

この時点で「思想がDBの形として固定されている」度合いは高いです。

---

## 2. 設計思想・要件がプロダクトに反映されているか

`docs/design/app.md` の要件番号に沿って、実装状況を整理します。

### 3.1 論点マップ（Topic Browser）
**評価: 概ね実装済み（ただし拡張要件は未実装）**
- 科目一覧: `apps/web/src/routes/subjects/index.tsx`
- 科目→カテゴリ階層: `apps/web/src/routes/subjects/$subjectId/index.tsx`
- カテゴリ→論点一覧: `apps/web/src/routes/subjects/$subjectId/$categoryId/index.tsx`
- 論点詳細（チャット/ノート/履歴への導線）: `apps/web/src/routes/subjects/$subjectId/$categoryId/$topicId.tsx`

ギャップ
- 「階層/タグ/フィルタ対応」のうち、**タグや検索UI**は未実装（復習フィルタは別画面にあり）
- 「論点の編集（管理者・将来的なユーザー定義）」は **API/画面とも未実装**（作成・編集系のエンドポイントが見当たらない）

---

### 3.2 論点チェック（ユーザー自己判断）
**評価: 実装済み（思想の中核を満たしている）**
- チェックON/OFFはユーザー操作で `understood` を更新:
  - Web: `apps/web/.../$categoryId/index.tsx` のトグル
  - API: `apps/api/src/features/topic/usecase.ts`（`updateProgress`）
- チェック履歴の保持: `topicCheckHistory` + `GET /check-history`
  - API: `apps/api/src/features/topic/route.ts` / `usecase.ts`

「AIが理解度判定しない」は、データフロー上も守られています（チェック履歴生成は understood の変更イベントでのみ発生）。

---

### 3.3 論点特化チャット（中核）
**評価: 強く実装されている**
- ChatSession が Topic に必ず紐づく: `chatSessions.topicId`
- 汎用チャット画面がない（論点詳細内のみ）:
  - ルーティング上、独立 `/chat` が存在しない
  - UIは `TopicDetailPage` 右ペインに `ChatContainer`

良い点
- **プロンプトインジェクション対策**のセキュリティ指示を system prompt 先頭に固定:
  `apps/api/src/features/chat/usecase.ts`（`SECURITY_INSTRUCTIONS` → `buildSystemPrompt`）

設計資料とのズレ（重要）
- **「必要最小限の履歴/要約」**という方針に対し、現実装は **セッションの全履歴を毎回投入**しています。
  `apps/api/src/features/chat/usecase.ts` の `history.slice(0, -1)` が実質無制限
  → セッションが長くなるとトークン上限・コスト・応答劣化のリスクが増える構造です（拡張性の項で詳述）。

---

### 3.4 ノート機能（学習痕跡の整理）
**評価: 実装済み。ただし「編集の自由度」はUIが追いついていない**
- セッションからノート生成: `POST /api/notes`（`createNoteFromSession`）
- 論点ごと一覧: `GET /api/notes/topic/:topicId`
- ノート詳細と編集: `apps/web/src/routes/notes/$noteId.tsx`

ギャップ
- 設計資料の「自分用に再構成（編集の自由度）」に対し、Web UI では **ユーザーメモのみ編集**。
  一方、APIは `keyPoints` / `stumbledPoints` 更新も受け付けています（`apps/api/src/features/note/route.ts`）。
  → "思想はAPIにあり、UIが抑制されている"状態です。

---

### 3.5 質問の質フィードバック（✔/△）
**評価: 実装済み（ただし内部メタ保持は未実装）**
- メッセージ単位のラベル: `chatMessages.questionQuality`
- UI表示（深掘り/確認のバッジ）: `apps/web/src/features/chat/components/ChatMessage.tsx`
- ラベルはノート/振り返りに利用:
  - Topic詳細でカウント表示: `TopicDetailPage` の `qualityStats`
  - ノート画面で深掘り質問の抽出: `TopicNotes.tsx`

ギャップ（設計資料の「根拠を内部保持」）
- 現状は **ラベルのみ保存**で、根拠や分類理由は保存していません。
  DB/型にも reason 的なフィールドがありません。
  → 将来「なぜ△なのか」などを分析・再学習に使う拡張はやりにくい形です。

---

### 3.6 振り返り・復習の可視化（2軸）
**評価: UIはあるが、データ生成の設計が未完（実運用で空になる可能性が高い）**
- 画面: `apps/web/src/routes/review.tsx`
- 日次チャート: `apps/web/src/features/metrics/components/DailyMetricsChart.tsx`

重大なギャップ（機能として成立しない可能性）
1) **日次メトリクスがスナップショット前提なのに、Webからスナップショット作成が呼ばれていない**
   - APIに `POST /api/metrics/snapshot` はある
   - Web側に snapshot 作成呼び出しが見当たらない（コード検索上）
   → 結果として `GET /api/metrics/daily` が空配列になり、チャートが常に「データなし」になり得ます。

2) **チェック済み論点数の「日次推移」が、過去日に対して正確にならない実装**
   - `apps/api/src/features/metrics/repository.ts` の `aggregateForDate()` で
     「本当は topicCheckHistory から計算すべき」とコメントしつつ、実際は `userTopicProgress.understood=true` の総数を返しています。
   → これは"その日"ではなく"現在"の状態で、時系列としての事実性が崩れます。

3) チャートが設計資料の軸B（✔質問数）を持っているのに、表示していない
   - フロントのデータ型は `goodQuestionCount` を保持（`metrics/logic.ts`）
   - `DailyMetricsChart.tsx` は `checkedTopicCount/sessionCount/messageCount` のみ描画
   → 設計の観測軸がUIに反映されきっていません。

---

### 3.7 事実ベースの論点フィルタ（復習導線）
**評価: 実装済み。ただし "事実" の時刻が壊れるバグがある**
- UI: `apps/web/src/features/review/components/TopicFilter.tsx`
- API: `GET /subjects/filter` → `TopicRepository.findFilteredTopics()`

重大なギャップ（時刻の事実性）
- `findFilteredTopics` で `lastChatAt = max(chatSessions.updatedAt)` を使っていますが、
  **chatSessions.updatedAt がメッセージ送信で更新されていない**ため、lastChatAt が実質 "セッション作成時刻" のままになります。
  - `apps/api/src/features/chat/repository.ts`: `createMessage()` が `chatSessions.updatedAt` を更新しない
  - `apps/api/src/features/topic/repository.ts`: lastChatAt が updatedAt ベース
  → `daysSinceLastChat` や `hasPostCheckChat` の判定が誤る可能性が高いです。

---

### 3.8 問題画像対応（OCR→解法分離）
**評価: 実装済み（設計意図を満たしている）**
- 画像アップロード（R2）: `apps/api/src/features/image/usecase.ts`
- OCR実行（Visionモデル呼び出し）: `performOCR`
- OCR結果の保存: `images.ocrText` + `chatMessages.ocrResult` に保持
- 推論はテキストとしてLLMに渡す: `sendMessage()` が `[画像から抽出されたテキスト] ...` をプロンプトに混ぜる

ギャップ
- 「抽出テキストを後から振り返れる」観点では、UI上で **OCRテキストそのものを再表示する導線が薄い**（チャット表示は画像中心）。

---

## 3. 拡張性（将来の追加・保守・スケール）評価

### 拡張しやすい点（良い設計）
1) **feature単位でAPIが分割**され、route/usecase/repositoryの責務が明確
   - 追加機能を "新feature" として差し込みやすい構造です。
2) **shared schema（zod）でAPIとWebの境界が型で固定**
   - 壊れる変更がコンパイルで検出しやすいです。
3) AI呼び出しが `AIAdapter` に抽象化されている
   - provider追加、モック差し替え、モデル変更が局所化します。
4) DBが Drizzle migrations 前提で、seedも用意
   - データモデル拡張の作業導線が揃っています。
5) レート制限（Durable Objects）を導入している
   - AI系エンドポイントの乱用に耐性があります。

---

### 拡張性を落とすリスク（優先度順）

#### A. 時系列メトリクスが未完（機能拡張の土台として弱い）
- 日次スナップショットが自動生成されない
- 過去日の checkedTopicCount が "当日値" にならない
- UTC集計で「1日の区切り」が利用者の体感とズレる（日本なら9時間ズレやすい）

この状態だと、可視化を増やすほど「観測可能な事実」が揺らぎ、設計思想（事実ベース）と衝突します。

#### B. "最後にチャットした日時" が壊れている（復習導線の精度が落ちる）
- `chatSessions.updatedAt` が更新されない設計は、今後 "復習の抽出条件" を増やすほど致命傷になります。
  （「◯日放置」「チェック後に会話した」などが根本から信用できなくなる）

#### C. チャットのコンテキスト制御がない（長期運用で破綻しやすい）
- 履歴が伸びると token / latency / cost が増え、ある時点でモデルがエラー・劣化しやすい
- 設計資料は "必要最小限の履歴/要約" を明確に要求しているため、思想面でもギャップが大きい

#### D. N+1 取得が複数箇所にある（データ増で遅くなる）
例
- セッション一覧で、各セッションごとに messageCount/qualityStats を別クエリで取得（`listSessionsByTopic`）
- ノート一覧の「深掘り質問」抽出で、セッション数分だけメッセージ取得（`TopicNotes.tsx`）

論点数・セッション数が増えるほど体感が重くなります。

#### E. 試験・分野非依存化が一部ハードコードで阻害される
- Webの科目絵文字/色が科目名にハードコード: `apps/web/src/routes/subjects/index.tsx`
- seedの `subjectSlugMap` が固定: `packages/db/scripts/seed.ts`
- system prompt が「公認会計士試験」固定: `apps/api/src/features/chat/usecase.ts`

設計資料（idea.md）の「分野・資格に依存しない再利用」を狙うなら、ここがボトルネックになります。

---

## 4. 改善の優先度（設計思想と拡張性を両立させる最短ルート）

### Priority 0（バグ/未完で思想が崩れる）
1) **lastChatAt の正確化**
   - 方向性:
     - (案1) `createMessage()` のたびに `chatSessions.updatedAt = now` を更新
     - (案2) lastChatAt を `max(chatMessages.createdAt)` に置き換え（より事実に近い）
   - 影響箇所: `apps/api/src/features/topic/repository.ts`（filterの核）

2) **日次メトリクスを「表示できる」状態にする**
   - (案1) `GET /metrics/daily` 取得時に不足日の snapshot を生成（キャッシュとして保存）
   - (案2) snapshotテーブルを廃してオンザフライ集計（90日程度なら現実的）
   - checkedTopicCount は **topicCheckHistory から "日付時点の状態" を復元**する計算に寄せる

3) **日次集計の区切り（UTC）を見直す**
   - 日本ユーザー前提なら JST の日付境界で集計するのが自然です。
   - 「日付はユーザー体感の1日」を守るほど、設計思想（事実ベース）が強くなります。

---

### Priority 1（思想のコアに沿った拡張性）
4) **チャットの"必要最小限の履歴/要約" を実装**
   - 方向性例
     - 直近N往復 + セッション要約（サマリをDBに保存）
     - Topicのノート要約（aiSummary/keyPoints）を system prompt かコンテキストに混ぜる
   - これで長期運用時の破綻リスクが大幅に下がります。

5) **質問ラベルの内部メタを保存**
   - `questionQuality` に加えて、`reason` や `category` を保存できる余地を作る
   - UIには出し過ぎず、分析・ノート生成の品質向上に使える形になります。

6) **OCRテキストの再閲覧導線**
   - 画像付きメッセージに「抽出テキスト」を折りたたみ表示するだけでも、痕跡としての価値が上がります。

---

### Priority 2（使い勝手と性能の底上げ）
7) N+1 を解消する集約APIの追加
   - Topic単位の「深掘り質問一覧」を1発で返すAPIなど
   - セッション一覧も集計をSQLに寄せるとレスポンスが安定します。

8) ノート編集の自由度をUIに反映
   - すでにAPIは `keyPoints/stumbledPoints` 更新可能なので、UIを追従させる作業は比較的軽いです。
   - 「自分用に再構成」をUIで実現できます。

9) 分野・試験非依存化（将来狙う場合）
   - subjectに icon/color/prompt を持たせる（DB or 設定）
   - system prompt の "試験名/役割文" を環境設定 or DBに逃がす
   - seedも "科目名固定" から "入力データ駆動" に寄せる

---

## 5. 総合評価

- **設計思想の反映度（コア思想）**: 高い
  - 「論点中心」「自己判断チェック」「痕跡の保存」は、DB・API・画面構成まで一貫して実装されています。
- **設計思想の反映度（可視化と事実性）**: 要改善
  - 日次メトリクスの生成導線が未完で、時系列の事実性も崩れています。ここは思想（評価ではなく観測可能な事実）と直結します。
- **拡張性（構造）**: 高い
  - feature分割・型共有・AI抽象化・migrations・テストが揃っていて、追加開発の土台は強いです。
- **拡張性（長期運用/スケール）**: 主要なボトルネックが複数ある
  - チャット文脈の肥大化、lastChatAtの不整合、N+1、日次集計の未完が、利用が積み上がるほど効いてきます。

上の Priority 0〜1 を潰すと、設計資料が目指す「学習の痕跡が時系列で信頼できる形で残る」という価値が安定し、そこから先の機能追加（復習導線や可視化の拡張）を安心して増やせる状態になります。
