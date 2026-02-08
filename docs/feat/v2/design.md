# v2 汎用勉強サポートアプリ 設計ドキュメント

> **Note**: このドキュメントは v2 時点の設計です。現行バージョンは v2.1 です。
> v2.1 では「ユーザー定義コンテンツ」機能が追加され、DBスキーマが大幅に変更されました。
> 最新の設計は [../v2.1/design.md](../v2.1/design.md) を参照してください。

> 具体的な実装コード例は [implementation-guide.md](./implementation-guide.md) を参照

---

## 0. エグゼクティブサマリ

### 背景
現在の「公認会計士試験サポートアプリ」を「汎用勉強サポートアプリ」に進化させる。
既存ユーザー（公認会計士試験学習者）のデータと体験を維持しながら、
他の資格試験・教科・学習分野にも対応できる構造へ移行する。

### 変更規模の評価
**中規模**。現在のスキーマ・アーキテクチャは既に汎用的に設計されているが、
以下の変更が必要：
- DBスキーマ変更（SQLite制約によりテーブル再作成が必要）
- AIプロンプト（セキュリティ指示・システムプロンプト）の動的化
- UIの科目表示（絵文字・色のハードコード削除）
- シードデータ（科目定義）の形式変更

### コア思想の維持
v2でも以下の思想は**不変**として維持する：
1. **判断しない** - 理解度・正誤・達成を評価しない
2. **論点（Topic）中心** - すべての活動は論点に紐づく
3. **痕跡を残す** - 後から振り返れることを最優先
4. **気づきの材料** - 解釈を押し付けず、事実を見せる

---

## 1. 現状分析

### 1.1 公認会計士に特化している箇所

| 箇所 | ファイル | 内容 | 変更難易度 |
|------|----------|------|-----------|
| セキュリティ指示 | `apps/api/src/features/chat/domain/prompts.ts` | 「公認会計士試験の学習サポートに話題を戻して」 | 低 |
| システムプロンプト | 同上 | 「公認会計士試験の学習をサポートするAIアシスタント」 | 低 |
| 科目の絵文字 | `apps/web/src/routes/subjects/index.tsx` | ハードコードされた絵文字マッピング | 低 |
| 科目の背景色 | 同上 | ハードコードされた色マッピング | 低 |
| シードデータ | `packages/db/scripts/seed.ts` | 公認会計士科目定義 | 中 |

### 1.2 既に汎用的な設計

| 領域 | 設計 | 汎用性 |
|------|------|--------|
| DBスキーマ | Subject → Category → Topic の3階層 | ★★★★★ |
| 論点管理 | difficulty, topicType は試験非依存 | ★★★★★ |
| チャット | topicId + aiSystemPrompt でカスタマイズ可能 | ★★★★☆ |
| ノート | 論点に紐づく汎用構造 | ★★★★★ |
| 進捗追跡 | questionCount, goodQuestionCount | ★★★★★ |
| 認証 | マルチプロバイダー対応設計 | ★★★★★ |

### 1.3 設計上の欠落

- **Exam（試験/学習領域）テーブルがない**
  - 設計ドキュメント（summary.md）には `Exam` の概念があったが未実装
  - 複数の学習領域を同時サポートするにはこのレイヤーが必要

---

## 2. v2 データモデル

### 2.1 新規テーブル: `studyDomains`

「試験」に限らず「学習領域」全般を表現するため、`exams` ではなく `studyDomains` と命名。

**カラム:**
- `id` (PK), `name`, `description`, `emoji`, `color`, `isPublic`, `createdAt`, `updatedAt`

### 2.2 既存テーブルの拡張

#### `subjects` テーブル
- `studyDomainId` を追加（NOT NULL, FK → studyDomains）
- `emoji`, `color` を追加
- `name` の UNIQUE 制約を `(studyDomainId, name)` の複合ユニーク制約に変更
- `onDelete: "restrict"` で誤削除を防止

#### `users` テーブル
- `defaultStudyDomainId` を追加（オプション）

### 2.3 ER図（概念）

```
StudyDomain (学習領域)
    │
    ├── Subject (科目) ※ Category は Subject 経由で StudyDomain に属する
    │       │
    │       └── Category (大分類/中分類/小分類)
    │               │
    │               └── Topic (論点)
    │                       │
    │                       ├── ChatSession → ChatMessage
    │                       ├── Note
    │                       ├── Image
    │                       └── TopicCheckHistory
    │
    └── User (多対多: user_study_domains)
            │
            └── UserTopicProgress
```

### 2.4 ユーザーと学習領域の関係

- `user_study_domains` テーブルで多対多リレーション
- `(userId, studyDomainId)` に一意制約
- インデックス: `user_id`, `study_domain_id`

**学習領域離脱時のデータ保持ポリシー:**
- `user_study_domains` レコードのみ削除
- `userTopicProgress`, `chatSessions`, `notes` 等の学習履歴は**保持**
  - 理由: コア思想「痕跡を残す」に基づき、学習履歴は削除しない
- 学習領域自体の削除時は `onDelete: "restrict"` により、関連データがある場合は削除拒否

---

## 3. データマイグレーション計画

### 3.1 既存ユーザーへの影響

| データ | 対応方針 | 影響 |
|--------|---------|------|
| users | defaultStudyDomainId を追加 | なし |
| subjects | studyDomainId, emoji, color を追加 | なし |
| topics | 変更なし | なし |
| chatSessions | 変更なし | なし |
| notes | 変更なし | なし |
| userTopicProgress | 変更なし | なし |

### 3.2 マイグレーション手順

**重要: SQLite/D1 の制約**
- `ALTER TABLE` で NOT NULL 制約を後から追加できない → テーブル再作成が必要
- 外部キー制約はデフォルト無効 → アプリケーション層で参照整合性を担保

**手順概要:**
1. `study_domains` テーブル作成
2. `user_study_domains` テーブル作成（インデックス含む）
3. デフォルト学習領域 `cpa`（公認会計士試験）を作成
4. `subjects` テーブルを再作成（新スキーマ + データ移行）
5. `users` テーブルに `defaultStudyDomainId` を追加
6. 既存ユーザーを `cpa` に紐付け

> 詳細なSQLは [implementation-guide.md](./implementation-guide.md) を参照

### 3.3 ロールバック計画

**マイグレーション失敗時:**
1. `subjects` テーブルを元の構造に戻す
2. `user_study_domains`, `study_domains` テーブルを削除

**本番適用前の必須検証:**
1. staging 環境でマイグレーション実行
2. 全 API エンドポイントの動作確認
3. 既存ユーザーのデータ整合性確認
4. パフォーマンステスト（インデックス効果確認）

---

## 4. API変更

### 4.0 Feature 分割方針

**決定: `study-domain` feature を独立して作成**

```
apps/api/src/features/
├── auth/           # 認証（既存）
├── topic/          # 科目・カテゴリ・論点（既存）
├── study-domain/   # 学習領域（新規）★
├── chat/           # チャット（既存・修正あり）
├── note/           # ノート（既存）
├── image/          # 画像（既存）
└── metrics/        # メトリクス（既存）
```

**責務分離:**
- `study-domain`: 学習領域 CRUD、ユーザー参加/離脱
- `topic`: 科目/カテゴリ/論点の CRUD（studyDomainId でフィルタ）
- `chat`: 学習領域情報を取得して prompt 生成

### 4.1 新規エンドポイント

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/study-domains` | 公開学習領域一覧 |
| GET | `/api/study-domains/:id` | 学習領域詳細 |
| POST | `/api/study-domains` | 学習領域作成 |
| PATCH | `/api/study-domains/:id` | 学習領域更新 |
| DELETE | `/api/study-domains/:id` | 学習領域削除 |
| GET | `/api/me/study-domains` | 参加中の学習領域一覧 |
| POST | `/api/me/study-domains/:id/join` | 学習領域に参加 |
| DELETE | `/api/me/study-domains/:id/leave` | 学習領域から離脱 |

### 4.2 既存エンドポイントの変更

| 変更前 | 変更後 |
|--------|--------|
| `GET /api/subjects` | デフォルト学習領域の科目一覧 |
| - | `GET /api/subjects?studyDomainId=xxx` で指定可能 |
| - | `GET /api/study-domains/:id/subjects` を推奨 |

**`studyDomainId` 省略時の挙動:**
1. 認証済みユーザー: `users.defaultStudyDomainId` を使用
2. 未設定: `DEFAULT_STUDY_DOMAIN_ID`（定数: `cpa`）をフォールバック

### 4.3 レスポンス拡張

`Subject` のレスポンスに追加:
- `studyDomainId`, `emoji`, `color`

---

## 5. フロントエンド変更

### 5.1 科目表示の動的化

- ハードコードされた `getSubjectEmoji()`, `getSubjectColor()` を削除
- API レスポンスの `emoji`, `color` を使用
- Tailwind の動的クラス生成問題は `colorClasses.ts` のマッピングで対応

### 5.2 学習領域選択UI

- ヘッダーに学習領域セレクタを追加
- 「他の学習領域を追加」導線

### 5.3 学習領域選択状態の管理戦略

**決定: URL-driven state を採用**

| 方式 | メリット | デメリット |
|------|----------|-----------|
| URL-driven | ブックマーク可能、共有可能、リロード耐性 | URL が長くなる |
| Store-driven | URL がシンプル | リロードで状態消失、共有不可 |

**ルーティング設計:**
- `/domains/:domainId/subjects/...`
- 下位互換: `/subjects/...` → `/domains/cpa/subjects/...` にリダイレクト

**リダイレクト対象パス:**
| 旧パス | 新パス |
|--------|--------|
| `/subjects` | `/domains/cpa/subjects` |
| `/subjects/:subjectId` | `/domains/cpa/subjects/:subjectId` |
| `/subjects/:subjectId/:categoryId` | `/domains/cpa/subjects/:subjectId/:categoryId` |
| `/subjects/:subjectId/:categoryId/:topicId` | `/domains/cpa/subjects/:subjectId/:categoryId/:topicId` |

---

## 6. プロンプト汎用化

### 6.1 方針

- `SECURITY_INSTRUCTIONS` を `buildSecurityInstructions(studyDomainName, subjectName)` に変更
- `buildSystemPrompt()` のシグネチャを変更: `{ studyDomainName, subjectName, topicName, customPrompt }`
- `sanitizeForPrompt()` で入力値をサニタイズ（改行除去、長さ制限、Unicode正規化）

### 6.2 データ取得パターン

`topics` → `categories` → `subjects` → `studyDomains` の JOIN が必要。
`getTopicWithHierarchy()` 関数を追加。

**パフォーマンス考慮:**
- v2初期リリースではシンプルに毎回取得
- **対策発動の閾値:**
  - JOIN クエリが 20ms を超えた場合
  - チャット開始のレイテンシが 500ms を超えた場合
- 対策: セッション作成時にスナップショット保存 or キャッシュ

### 6.3 呼び出し元の修正箇所

| ファイル | 変更内容 |
|----------|---------|
| `apps/api/src/features/chat/usecase.ts` | 階層情報取得、prompt生成修正（2箇所） |

---

## 7. シードデータ設計

### 7.1 データ構造

シードデータは `packages/db/data/` 配下に配置:

```
packages/db/data/study-domains/
├── cpa/
│   ├── domain.json
│   └── subjects/
│       ├── financial.json
│       └── ...
├── bookkeeping-2/
└── aws-saa/
```

### 7.2 形式

- `domain.json`: 学習領域メタデータ
- `subject.json`: 科目 → カテゴリ → 論点の階層構造

---

## 8. 実装フェーズ

### Phase 1: 基盤構築

| 順序 | タスク | 優先度 |
|------|--------|--------|
| 1 | DBスキーマ追加 | P0 |
| 2 | マイグレーション作成・適用 | P0 |
| 3 | Zodスキーマ更新 | P0 |
| 4 | 定数定義 | P0 |

### Phase 2: API実装

| タスク | 優先度 |
|--------|--------|
| study-domain feature 作成 | P1 |
| 既存API拡張 | P1 |
| プロンプト汎用化 | P1 |

### Phase 3: フロントエンド対応

| タスク | 優先度 |
|--------|--------|
| 科目表示の動的化 | P1 |
| 学習領域選択UI | P2 |
| 学習領域一覧ページ | P2 |

**並列実行可能なタスク:**
- `colorClasses.ts` の作成（Phase 1 と並行可能）
- ルーティング設計・実装（Phase 2 API完了を待たず開始可能）

### Phase 4: シードデータ・テスト

| タスク | 優先度 |
|--------|--------|
| シードデータ形式変更 | P1 |
| E2Eテスト | P0 |
| マイグレーションテスト | P0 |

---

## 9. リスクと対策

### 9.1 技術的リスク

| リスク | 影響 | 対策 |
|--------|------|------|
| マイグレーション失敗 | 既存データ破損 | staging検証、ロールバック手順準備 |
| APIコントラクト破壊 | クライアント動作不能 | 下位互換性維持、オプショナルフィールド |
| パフォーマンス劣化 | UX悪化 | インデックス追加、N+1対策 |

### 9.2 運用リスク

| リスク | 影響 | 対策 |
|--------|------|------|
| 既存ユーザーの混乱 | 離脱 | 公認会計士試験をデフォルトに |
| 学習領域の乱立 | 品質低下 | 当面は管理者のみ作成可能 |
| プロンプト品質のばらつき | 学習体験劣化 | 学習領域ごとのテンプレート |

### 9.3 ビジネスリスク

| リスク | 影響 | 対策 |
|--------|------|------|
| 「何でもアプリ」化 | ブランド希薄化 | コア思想（判断しない、痕跡を残す）を維持 |
| 対象拡大による分散 | リソース不足 | 優先する学習領域を絞る |

---

## 10. 修正影響範囲

### 10.1 バックエンド修正箇所

| ファイル | 変更内容 | 影響度 |
|----------|---------|--------|
| `packages/db/src/schema/topics.ts` | subjects に studyDomainId, emoji, color 追加 | 高 |
| `packages/db/src/schema/studyDomain.ts` | 新規作成 | - |
| `packages/db/src/schema/userStudyDomain.ts` | 新規作成 | - |
| `apps/api/src/features/study-domain/*` | 新規 feature 作成 | - |
| `apps/api/src/features/chat/domain/prompts.ts` | 関数シグネチャ変更 | 高 |
| `apps/api/src/features/chat/usecase.ts` | 階層情報取得、prompt生成修正 | 高 |

### 10.2 フロントエンド修正箇所

| ファイル | 変更内容 | 影響度 |
|----------|---------|--------|
| `apps/web/src/routes/subjects/index.tsx` | getSubjectEmoji/Color 削除 | 中 |
| `apps/web/src/routes/__root.tsx` | 学習領域セレクタ追加 | 高 |
| `apps/web/src/routes/domains/$domainId/*` | 新規ルート作成 | 高 |
| `apps/web/src/lib/colorClasses.ts` | 新規作成 | - |

### 10.3 テスト修正箇所

| ファイル | 変更内容 |
|----------|---------|
| `apps/api/src/features/chat/usecase.test.ts` | buildSystemPrompt シグネチャ変更対応 |
| `apps/api/src/features/chat/route.test.ts` | モックデータに studyDomain 追加 |
| 新規: `apps/api/src/features/study-domain/*.test.ts` | 学習領域 CRUD テスト |

### 10.4 Zodスキーマ修正

| ファイル | 変更内容 |
|----------|---------|
| `packages/shared/src/schemas/studyDomain.ts` | 新規作成 |
| `packages/shared/src/schemas/topic.ts` | subjectSchema に studyDomainId, emoji, color 追加 |

---

## 11. 成功基準

### 11.1 技術的成功基準

- [ ] 既存ユーザーのデータが完全に維持されている
- [ ] 既存の全機能が正常に動作する
- [ ] 新規学習領域（簿記2級など）を追加できる
- [ ] 型エラーがゼロ
- [ ] E2Eテストが全パス

### 11.2 ユーザー体験の成功基準

- [ ] 既存ユーザーが違和感なく使い続けられる
- [ ] 新規ユーザーが任意の学習領域を選択できる
- [ ] 学習領域の切り替えがスムーズ

### 11.3 思想の維持（チェックリスト）

- [ ] 「判断しない」: 理解度評価を追加していない
- [ ] 「論点中心」: 新構造でも論点が中心にある
- [ ] 「痕跡を残す」: 学習履歴が学習領域を跨いでも保持される
- [ ] 「気づきの材料」: 事実ベースの表示を維持

---

## 12. 将来の拡張可能性

v2の構造により、以下が容易になる：

| 機能 | 説明 |
|------|------|
| **ユーザー定義学習領域** | 個人で論点マップを作成 |
| **学習領域のフォーク** | 公開学習領域をベースにカスタマイズ |
| **組織向け機能** | 企業・学校が独自の学習領域を管理 |
| **学習領域間の連携** | 関連論点のリンク（簿記→公認会計士） |
| **多言語対応** | 学習領域単位でのローカライズ |

---

## 13. 参考資料

- `/docs/design/app.md` - コア思想・設計要件
- `/docs/design/idea.md` - 価値整理・ロードマップ
- `/docs/first-release/summary.md` - v1設計サマリ
- `/docs/first-release/backend.md` - バックエンド設計詳細
- `/docs/v2/implementation-guide.md` - 実装コード例
