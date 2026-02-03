# 学習支援アプリ API/ドメイン再編 設計書（Curriculum / Learning / View）

## 0. 概要

本設計書は、既存の `subject` feature に混在している責務（カリキュラム構造・学習ログ・横断検索/レビュー用クエリ）を分離し、拡張性・一貫性・安全性（user境界/soft delete）を強化するためのドメイン再編を定義する。

再編方針は次の通り。

- **Curriculum（/subjects）**: 教材構造（科目・カテゴリ・論点）を管理するコマンド中心のドメイン
- **Learning（/learning）**: ユーザーの学習状態・履歴・学習イベント（進捗、チェック履歴、アクセス、質問数）を管理するコマンド中心のドメイン
- **View（/view）**: 画面都合の合成ビュー（Read Model）を提供するクエリ専用ドメイン。原則として書き込み禁止

この分割は CQRS 的に「書き込みのドメイン（Curriculum/Learning）」と「読み取りの合成（View）」を分け、変更理由の分離と依存関係の単純化を狙う。

---

## 1. 背景と課題

### 1.1 現状課題（要点）
- `subject` が「構造」「学習ログ」「レビュー検索」「チャット集計」を同居させ、肥大化しやすい
- `chat` が `subject` の repository/usecase を呼び出すなど、概念的に不自然な依存が発生しやすい
- Read API が学習ログ更新（lastAccessedAt など）を内包し、キャッシュやリトライ時の挙動が複雑化しやすい
- userId / deletedAt の適用が feature 間で不均一になりやすい

### 1.2 設計目標
- 変更理由ごとに機能を分割し、機能追加の影響範囲を縮小する
- user境界とsoft delete境界をクエリで完結させ、越境漏洩を防ぐ
- 画面のための合成レスポンスを明示的に View に隔離し、ドメインを汚さない
- 既存の Hono + Drizzle(D1) 構成と shared schema（Zod）運用に整合させる

### 1.3 非目標
- マイクロサービス化（別デプロイ）への移行
- Event Sourcing の導入
- GraphQL など APIスタイルの抜本変更

---

## 2. 用語

- **Study Domain**: 学習領域（例: CPAなど）。ユーザーが所有するルートコンテナ
- **Subject**: 科目
- **Category**: カテゴリ（Subject配下の階層）
- **Topic**: 論点（最小の学習単位）
- **Progress**: ユーザーの学習状態（理解済み、質問数、アクセス日時など）
- **Check History**: 理解済み変更などの履歴
- **View / Read Model**: UI表示用に複数テーブル・複数ドメインを合成した読み取り専用DTO

---

## 3. 全体構成（モノレポ内の配置）

### 3.1 feature 構成（API）
- `apps/api/src/features/subjects/`（Curriculum）
  - `route.ts`
  - `usecase.ts`
  - `repository.ts`（subjects/categories/topics に限定）
- `apps/api/src/features/learning/`（Learning）
  - `route.ts`
  - `usecase.ts`
  - `repository.ts`（user_topic_progress/topic_check_history 中心）
- `apps/api/src/features/view/`（View）
  - `route.ts`
  - `usecase.ts`
  - `repositories/`
    - `topicViewRepo.ts`
    - `subjectDashboardViewRepo.ts`
    - `reviewListViewRepo.ts`

### 3.2 shared schema（DTOの唯一ソース）
- `packages/shared/src/schemas/`
  - `subjects/*`（Curriculum DTO）
  - `learning/*`（Learning DTO）
  - `view/*`（View DTO）
  - `error.ts`（統一エラー形式）

View のレスポンスは「画面の契約」なので shared に明示的に置く。フロントは `z.infer`（または型export）を参照して独自型を作らない。

---

## 4. ドメイン境界と責務

### 4.1 Curriculum（/subjects）
責務:
- Subject/Category/Topic の構造管理（CRUD、並び順、ツリー編集、CSV import）
- 構造にのみ依存する統計（topicCount、categoryCount など）

禁止:
- progress/history/chatSessions/note の更新
- user_topic_progress を前提にした振る舞いの内包

### 4.2 Learning（/learning）
責務:
- 学習イベントの記録（touch、質問記録、理解済み変更）
- progress（user_topic_progress）の更新と取得
- check history（topic_check_history）の記録・取得
- 学習統計（理解済み数、最近触った論点、レビューキューに必要な集計）

許可:
- 表示や検証に必要な範囲で Curriculum のテーブルを参照（JOIN）する

禁止:
- Curriculum 構造（subjects/categories/topics）の書き換え

### 4.3 View（/view）
責務:
- 画面描画に必要な「合成ビュー」を提供（topic画面、subjectダッシュボード、レビュー一覧など）
- 複数ドメインに跨る JOIN と集計をここに隔離

原則:
- 書き込み禁止（Read-only）
- 例外運用を作らない（touch は Learning 側で明示的に叩く）

---

## 5. 依存関係ルール

### 5.1 依存方向（原則）
- `subjects` は `learning` / `chat` / `note` に依存しない
- `learning` は `subjects` を参照してよい（検証と表示のためのJOIN）
- `view` は `subjects` / `learning` / `chat` / `note` を参照してよい（Read-only）
- `chat` / `note` は学習ログ更新を `learning` に集約する（`subjects` を呼ばない）

### 5.2 実装規約（循環依存の回避）
- View は「他featureの usecase/repository を呼び出さない」。DBから直接 DTO を組み立てる
- 共通のSQL断片（deletedAt/userId条件）は View 内でテンプレ化して重複を抑える
- Result/AppError は全featureで統一する

---

## 6. 認可・soft delete・境界ルール

### 6.1 userId ルール
- すべての repository 関数の引数に `userId` を必須化
- 認可は「対象レコードが userId に属するか」を DBクエリで完結させる（存在確認→別クエリの二段階を避ける）

### 6.2 deletedAt ルール（soft delete）
- `subjects/categories/topics` は soft delete を採用する前提
- View/Learning は JOIN の際に必ず `deleted_at IS NULL` を含め、親階層も同条件で守る
- `user_topic_progress` のように deletedAt が無いログテーブルは、読み取り時に `topics.deleted_at IS NULL` を条件に含める

### 6.3 越境防止（Bookmark など横断機能）
- `bookmark` の存在確認・詳細取得も userId + deletedAt を JOIN 条件に含める
- View が bookmark 状態を返す場合、bookmark側の条件も同様に userId を含める

---

## 7. エラー形式とレスポンス契約

### 7.1 統一エラー形式
すべての API は次の形式に統一する。

- 失敗: `{"error": {"code": string, "message": string, "details"?: unknown}}`
- 成功: エンドポイントごとの DTO（`{"ok": true}` のラップはしない）

`code` はアプリ内で安定した識別子とし、フロントは `code` と `message` を使い分けられる。

### 7.2 Result/AppError
UseCase は `Result<T, AppError>` を返し、Route で `handleResult` により HTTP へ変換する。

- 例: NotFound、Unauthorized、ValidationError、Conflict、InternalError

---

## 8. API設計

以下は推奨のエンドポイントセット。命名は REST を優先し、View は `/view/*` としてクエリ専用で区別する。

### 8.1 Curriculum: `/api/subjects`

#### 一覧・作成
- `GET /api/subjects?studyDomainId=:domainId`
  - Response: `SubjectSummary[]`
- `POST /api/subjects`
  - Body: `CreateSubjectRequest`
  - Response: `Subject`

#### 単体
- `GET /api/subjects/:subjectId`
  - Response: `Subject`
- `PATCH /api/subjects/:subjectId`
  - Body: `UpdateSubjectRequest`
  - Response: `Subject`
- `DELETE /api/subjects/:subjectId`
  - Response: `{"deleted": true}`

#### ツリー
- `GET /api/subjects/:subjectId/tree`
  - Response: `SubjectTree`（構造のみ）
- `PUT /api/subjects/:subjectId/tree`
  - Body: `UpdateSubjectTreeRequest`
  - Response: `SubjectTree`

#### インポート
- `POST /api/subjects/:subjectId/import-csv`
  - Body: `ImportCsvRequest`（テキストCSV or ファイル参照の方式は実装に合わせる）
  - Response: `ImportResult`

#### 構造検索（任意）
- `GET /api/subjects/search?q=:query&studyDomainId=:domainId`
  - Response: `CurriculumSearchResult[]`（構造のみ）

---

### 8.2 Learning: `/api/learning`

#### 学習イベント（副作用を明示）
- `POST /api/learning/topics/:topicId/touch`
  - 目的: lastAccessedAt の更新、必要なら当日メトリクスの追記
  - Body: `{"at"?: string}`（省略時はサーバ時刻）
  - Response: `{"touched": true, "lastAccessedAt": string}`

#### 進捗更新
- `PUT /api/learning/topics/:topicId/progress`
  - Body: `UpdateTopicProgressRequest`（understood、任意でメモ、など）
  - Side-effect: check history 記録
  - Response: `TopicProgress`

#### 進捗取得（単体）
- `GET /api/learning/topics/:topicId/progress`
  - Response: `TopicProgress`

#### チェック履歴
- `GET /api/learning/topics/:topicId/check-history`
  - Response: `TopicCheckHistory[]`

#### 最近触った論点
- `GET /api/learning/topics/recent?limit=10`
  - Response: `RecentTopic[]`（topicId + lastAccessedAt + 最小限の表示情報）

#### 科目別/領域別の学習統計
- `GET /api/learning/subjects/progress-stats?studyDomainId=:domainId`
  - Response: `SubjectLearningStats[]`

#### 学習ログ一覧（任意）
- `GET /api/learning/progress/me?studyDomainId=:domainId`
  - Response: `TopicProgressSummary[]`

---

### 8.3 View: `/api/view`

#### Topic 画面の合成ビュー
- `GET /api/view/topics/:topicId`
  - Response: `TopicView`
  - 内容例:
    - curriculum: topic + category + subject + domain の最小情報
    - learning: understood、lastAccessedAt、questionCount、goodQuestionCount
    - chatActivity: sessionCount、lastChatAt
    - note: 最新ノート要約（存在すれば）
    - bookmark: isBookmarked

View のレスポンスは画面の要求に合わせる。構造は変わりうるため shared schema で契約として固定する。

#### Subject ダッシュボード合成ビュー
- `GET /api/view/subjects/:subjectId/dashboard`
  - Response: `SubjectDashboardView`
  - 内容例:
    - tree（カテゴリ階層）
    - 各カテゴリの topicCount（構造）と understoodCount（学習）
    - 最近触った論点

#### レビュー一覧（フィルタ・検索）
- `GET /api/view/topics?studyDomainId=:domainId&understood=false&minSessionCount=...&daysSinceLastChat=...&q=...`
  - Response: `TopicReviewListView`
  - 内容例:
    - items: topic + パス + 学習状態 + chat集計 + 最終アクセス
    - paging: cursor/limit など

---

## 9. データアクセス設計

### 9.1 参照するテーブル（例）
- Curriculum: `study_domains`, `subjects`, `categories`, `topics`
- Learning: `user_topic_progress`, `topic_check_history`, （必要に応じて `topics` JOIN）
- View: 上記に加えて `chat_sessions`, `chat_messages`, `notes`, `bookmarks` など

### 9.2 Viewクエリの基本形（規約）
- 起点は必ず `topics` とし、`topics.user_id = :userId AND topics.deleted_at IS NULL` を含める
- 親JOIN（categories/subjects）にも `deleted_at IS NULL` を含める
- progress/history/bookmark は `user_id = :userId` を JOIN 条件に含める
- chat 集計は `chat_sessions.user_id = :userId` を条件に含める

### 9.3 集計の将来拡張（Projection）
`/view/topics` のレビュー一覧が重くなった場合、次を導入できる。

- `topic_activity`（ユーザー×topic の集計投影）
  - lastChatAt、sessionCount、lastNoteAt、など
- 更新主体:
  - chat/note/learning がイベント発生時に更新
- View は投影テーブルから参照してJOINコストを下げる

Projection は導入コストがあるため、計測結果に応じて段階導入とする。

---

## 10. フロントエンド呼び出しパターン

### 10.1 Topic 画面
1. `POST /api/learning/topics/:topicId/touch`
2. `GET /api/view/topics/:topicId`

並列実行でも成立するが、touch の完了を待つと lastAccessedAt 表示が一致しやすい。

### 10.2 Subject ダッシュボード
- `GET /api/view/subjects/:subjectId/dashboard`

構造の編集画面は Curriculum を使用する。
- 取得: `GET /api/subjects/:subjectId/tree`
- 更新: `PUT /api/subjects/:subjectId/tree`

### 10.3 レビュー一覧
- `GET /api/view/topics?...filters...`

フィルタ条件は shared schema で固定し、UIとAPIの解釈差を避ける（例: `daysSinceLastChat` の意味を「直近N日以内にチャットがある」などに定義して名前も合わせる）。

---

## 11. マイグレーション計画（段階移行）

### Phase 1: 下地作成
- `features/learning` と `features/view` を追加（ルートは未公開でもよい）
- shared schema に `learning/*` と `view/*` を追加
- API エラー形式を統一し、フロントのエラー表示も `error.message` を参照する形に寄せる

### Phase 2: Learning を先に移行
- `subject` にある progress/history 系の UseCase/Repository を `learning` に移動
- `chat` が呼んでいる progress 更新先を `learning` に変更
- `getTopicWithProgress` の副作用更新（lastAccessedAt）は `touch` に移す

### Phase 3: View を導入
- topic 画面合成を `GET /view/topics/:topicId` として実装
- subject ダッシュボード合成を `GET /view/subjects/:subjectId/dashboard` として実装
- レビュー/フィルタ検索を `GET /view/topics` に移行

### Phase 4: 既存APIの廃止
- 旧 `subject` 配下の progress/filter/view 相当エンドポイントを deprecated として整理
- フロントの呼び先を新APIへ切替後、削除

---

## 12. テスト方針

### 12.1 Contract テスト
- すべての route レスポンスを shared schema で parse するテストを追加
- View DTO は UI 契約なので必須

### 12.2 境界テスト（マルチユーザー）
- Learning/View/Bookmark を含め、他ユーザーの topicId を与えても情報が返らないことを E2E で固定
- soft delete された topic が View/Learning から見えないことを固定

### 12.3 回帰テスト（副作用の明示）
- View API が DB を更新しないことをテストで保証（touch が唯一のアクセス更新手段）

---

## 13. 監視・運用

- View のクエリ時間（p95/p99）を観測し、重い一覧は Projection 導入判断に使う
- エラーコード別の発生率を集計し、UI側のリトライ方針の判断材料にする
- 重要API（`/view/topics`）はページング必須とし、無制限取得を禁止する

---

## 14. セキュリティ指針

- ID の推測困難性に依存しない（必ず userId 条件で守る）
- Bookmark の `targetExists` と `details` は必ず userId + deletedAt で JOIN する
- View は read-only のため、CSRF などよりも越境読み取り防止を優先して設計する

---

## 15. 付録: DTOの例（概念）

- `TopicView`
  - `topic: { id, name, description, ... }`
  - `path: { studyDomain, subject, category }`
  - `learning: { understood, lastAccessedAt, questionCount, goodQuestionCount }`
  - `chatActivity: { sessionCount, lastChatAt }`
  - `note: { latestNoteId?, summary? }`
  - `bookmark: { isBookmarked }`

- `SubjectDashboardView`
  - `subject: { id, name }`
  - `tree: CategoryNode[]`
  - `stats: { topicCount, understoodCount, lastAccessedAt? }`
  - `recentTopics: RecentTopic[]`

これらの DTO は shared schema に置き、フロントとAPIで単一ソースにする。

---

## 16. 結論

`/learning` への切り出しと、画面都合の合成Read Modelを `/view` として独立させる構成により、`subject` の肥大化と依存の歪み（chat→subject、Read内副作用）を解消し、拡張性・一貫性・越境耐性を高める。成功条件は View の read-only 原則、userId/deletedAt 条件の徹底、shared schema による契約固定の3点に集約される。
