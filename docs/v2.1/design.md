# v2.1 ユーザー定義コンテンツ 設計ドキュメント

> **開発手法**: TDD（テスト駆動開発）で進める
> **実装コード例**: [implementation-guide.md](./implementation-guide.md) を参照

---

## 0. エグゼクティブサマリ

### 背景
v2で導入した「学習領域」の構造を維持しつつ、**ユーザー自身がコンテンツ（科目・単元・論点）を作成・管理できる形式**に変更する。

**変更理由**: 公認会計士試験の試験範囲リストをアプリが提供する形式は著作権上の懸念があるため、ユーザーが自分で入力する形式に変更。

### コア思想の維持
v2.1でも以下の思想は**不変**:
1. **判断しない** - 理解度・正誤・達成を評価しない
2. **論点（Topic）中心** - すべての活動は論点に紐づく
3. **痕跡を残す** - 後から振り返れることを最優先
4. **気づきの材料** - 解釈を押し付けず、事実を見せる

### 変更規模
**大規模**。以下の変更が必要：
- DBスキーマ変更（全コンテンツテーブルに`userId`追加、論理削除対応）
- コンテンツCRUD APIの新規作成
- ツリーエディタUIの新規作成
- 既存テストの大規模修正
- シードデータの廃止（サンプルデータに置換）

---

## 1. 設計決定事項

| 項目 | 決定 | 理由 |
|------|------|------|
| ユーザー削除 | 論理削除 | 「痕跡を残す」思想を維持 |
| 既存データ | クリーンスタート | 著作権懸念のあるデータを残さない |
| 新規ユーザー | サンプル自動作成 | すぐに使い始められる |
| D&Dライブラリ | 自前実装 | 依存を減らす、要件に合わせやすい |
| インポート形式 | CSV | 表計算ソフトとの連携が容易 |
| user_study_domains | 削除 | 学習領域に`userId`があるため不要 |
| 親削除時の配下 | JOINで親の`deleted_at`を見て不可視 | カスケード削除不要、シンプル |
| ツリー更新方式 | 差分更新 | 原子性確保、パフォーマンス向上 |
| topicの追加フィールド | ツリー更新APIに含める | 一括編集で完結 |

---

## 2. 現状（v2）からの変更点

### 2.1 所有権モデルの変更

| 項目 | v2（現状） | v2.1（変更後） |
|------|-----------|-------------|
| 学習領域 | アプリ提供（公開） | ユーザー作成（個人所有） |
| 科目 | アプリ提供 | ユーザー作成 |
| 単元 | アプリ提供 | ユーザー作成 |
| 論点 | アプリ提供 | ユーザー作成 |
| シードデータ | 試験範囲を投入 | サンプルのみ |

### 2.2 維持する構造

```
StudyDomain (学習領域) ← userId追加
    │
    └── Subject (科目) ← userId追加
            │
            └── Category (単元: 大/中カテゴリ) ← userId追加
                    │
                    └── Topic (論点) ← userId追加
```

階層構造（4層）は維持。各層に`userId`を追加して所有権を明確化。

---

## 3. データモデル変更

### 3.1 スキーマ変更

#### 全テーブル共通
```diff
+ user_id TEXT NOT NULL REFERENCES users(id)
+ deleted_at INTEGER  -- 論理削除用（NULL = 有効）
```

#### `study_domains` テーブル
```diff
+ user_id TEXT NOT NULL REFERENCES users(id)
+ deleted_at INTEGER
- is_public INTEGER DEFAULT 1 NOT NULL
```

#### `subjects` テーブル
```diff
+ user_id TEXT NOT NULL REFERENCES users(id)
+ deleted_at INTEGER
```

#### `categories` テーブル
```diff
+ user_id TEXT NOT NULL REFERENCES users(id)
+ deleted_at INTEGER
```

#### `topics` テーブル
```diff
+ user_id TEXT NOT NULL REFERENCES users(id)
+ deleted_at INTEGER
```

#### `users` テーブル
```diff
+ deleted_at INTEGER  -- 論理削除用
```

### 3.2 削除されるテーブル

- `user_study_domains` - 学習領域に`userId`があるため不要

### 3.3 インデックス追加

各テーブルに以下のインデックスを追加：
- `user_id` 単独インデックス
- `(user_id, deleted_at)` 複合インデックス（有効データ取得用）

### 3.4 論理削除の挙動

#### 基本ルール
- `deleted_at` が NULL → 有効
- `deleted_at` に日時 → 削除済み
- 物理削除は別途バッチ処理で実施（当面は実装しない）

#### 親削除時の配下の扱い
**決定: カスケードソフト削除しない。JOINで親の`deleted_at`を見て実質不可視にする。**

理由:
- シンプルな実装
- 親を復活させた場合に配下も自動的に復活
- 個別のソフト削除管理が不要

#### 階層取得時のフィルタリング
全ての一覧取得クエリで以下を検証:
1. 自身の`deleted_at IS NULL`
2. 親の`deleted_at IS NULL`（JOINで確認）

→ 実装例は [implementation-guide.md §3.2](./implementation-guide.md#32-科目一覧取得親の削除状態をjoinで確認) を参照

### 3.5 認可とフィルタリングの方針

**全てのRepository関数で`userId`を必須パラメータとする。**

理由:
- 権限漏洩を防ぐ
- UseCase層での追加チェックが不要
- 一貫したパターン

→ 実装例は [implementation-guide.md §3.1](./implementation-guide.md#31-学習領域-repository) を参照

---

## 4. API設計

### 4.1 学習領域 CRUD

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/study-domains` | 自分の学習領域一覧 |
| GET | `/api/study-domains/:id` | 学習領域詳細 |
| POST | `/api/study-domains` | 学習領域作成 |
| PATCH | `/api/study-domains/:id` | 学習領域更新 |
| DELETE | `/api/study-domains/:id` | 学習領域削除（論理削除） |

### 4.2 科目 CRUD

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/study-domains/:domainId/subjects` | 科目一覧 |
| GET | `/api/subjects/:id` | 科目詳細 |
| POST | `/api/study-domains/:domainId/subjects` | 科目作成 |
| PATCH | `/api/subjects/:id` | 科目更新 |
| DELETE | `/api/subjects/:id` | 科目削除（論理削除） |

### 4.3 ツリー一括操作 API

単元・論点は個別CRUDではなく、ツリーエディタ用の一括操作APIを提供：

| メソッド | パス | 説明 |
|----------|------|------|
| GET | `/api/subjects/:id/tree` | 科目配下のツリー構造取得 |
| PUT | `/api/subjects/:id/tree` | 科目配下のツリー構造一括更新 |

#### ツリー更新の方式: 差分更新

**処理フロー:**
1. リクエストのノードIDを収集
2. 科目の所有権確認
3. **リクエストで指定されたIDの所有権検証**（他ユーザーのID上書き防止）
   - 全ての`id`が現在のユーザーかつ対象科目に属することを確認
   - 不正なIDが含まれている場合は`INVALID_ID`エラーを返す
4. 既存ノードでリクエストに含まれないものをソフト削除
5. リクエストの各ノードを処理:
   - `id`あり → 更新（`deleted_at`をNULLにリセット）
   - `id`なし → 新規作成
6. 全操作を`db.batch()`でatomicに実行

**原子性の確保:**
D1には従来のトランザクションがないため、`db.batch()`を使用して全操作をatomicに実行する。

> **Note:** Cloudflare D1の`batch()`はアトミック実行を保証している。
> [Cloudflare D1 Docs](https://developers.cloudflare.com/d1/build-with-d1/d1-client-api/#batch-statements):
> "Batched statements are SQL transactions. If a statement in the sequence fails, then an error is returned for that specific statement, and it aborts or rolls back the entire sequence."

→ 実装例は [implementation-guide.md §3.3](./implementation-guide.md#33-ツリー一括更新差分更新方式) を参照

#### ツリー更新リクエストスキーマ

topicの全フィールド（description, difficulty, topicType, aiSystemPrompt）を含める。
`id`が`null`なら新規作成、値があれば更新。

→ 実装例は [implementation-guide.md §2.2](./implementation-guide.md#22-ツリー更新リクエスト) を参照

### 4.4 CSVインポート API

| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/api/subjects/:id/import` | CSVから単元・論点を一括インポート |

#### CSV形式（RFC 4180準拠）

**パース仕様:**
- RFC 4180準拠（ダブルクォートでエスケープ）
- ヘッダー行必須（1行目はスキップ）
- 空行は無視
- 重複行は1つにマージ（同じ大単元/中単元/論点の組み合わせ）

**既存データとの関係:**
- インポートは**追加モード**（既存データは保持）
- 同名のカテゴリが既に存在する場合はそこに追加
- 完全上書きしたい場合はツリー更新APIを使用

→ CSV形式例・パーサー実装は [implementation-guide.md §4](./implementation-guide.md#4-csvインポートrfc-4180準拠) を参照

#### エラーハンドリング

- パースエラーは行番号とメッセージを返す
- 部分的成功を許容（エラー行をスキップして残りを処理）

→ レスポンス型は [implementation-guide.md §4.3](./implementation-guide.md#43-インポートusecase) を参照

### 4.5 認可ルール

全てのCRUD操作で以下を検証：
- 認証済みであること
- 対象リソースの`userId`がリクエストユーザーと一致すること

Repository層で`userId`を必須にすることで、存在しないか他ユーザーのデータの場合は`NOT_FOUND`を返す。

→ 実装例は [implementation-guide.md §3.1](./implementation-guide.md#31-学習領域-repository) を参照

---

## 5. フロントエンド設計

### 5.1 ツリーエディタUI

**要件**:
- 科目配下の単元・論点を階層表示
- インライン編集（クリックで編集モード）
- ドラッグ&ドロップで並び替え（自前実装）
- 追加/削除ボタン
- 一括保存
- 論点の追加フィールド（description, difficulty等）の編集

**コンポーネント構成**:
```
TreeEditor/
├── TreeEditor.tsx          # コンテナ
├── TreeNode.tsx            # 再帰的ノード表示
├── TreeNodeEditor.tsx      # 編集モード
├── TopicDetailEditor.tsx   # 論点詳細編集（description等）
├── AddNodeButton.tsx       # 追加ボタン
├── useTreeState.ts         # 状態管理
└── useTreeDragDrop.ts      # D&Dロジック（自前実装）
```

### 5.2 画面遷移

```
/domains
  └── 学習領域一覧（自分の領域）
      ├── [+ 新規作成] → 作成モーダル
      └── [領域カード] → /domains/:id/subjects

/domains/:id/subjects
  └── 科目一覧
      ├── [+ 新規作成] → 作成モーダル
      └── [科目カード] → /domains/:id/subjects/:subjectId

/domains/:id/subjects/:subjectId
  └── 科目詳細（ツリーエディタ表示）
      ├── 単元・論点の階層表示
      ├── インライン編集
      ├── [論点クリック] → 詳細編集パネル
      ├── [CSVインポート] → ファイル選択
      └── [保存] → API呼び出し
```

### 5.3 新規ユーザーフロー

**タイミング**: `handleOAuthCallback`で`isNewUser: true`の場合に呼び出し

1. OAuth認証完了、新規ユーザー判定
2. `createSampleDataForNewUser(userId)`を呼び出し
3. ホーム画面にリダイレクト
4. サンプルデータを確認・編集可能

**サンプルデータ**:
- 学習領域: 「サンプル学習領域」
- 科目: 「サンプル科目」
- 単元: 「サンプル大単元」>「サンプル中単元」
- 論点: 「サンプル論点1」「サンプル論点2」

---

## 6. TDD実装計画

### 6.1 フェーズ構成

```
Phase 1: 基盤（スキーマ・テストヘルパー）
Phase 2: 学習領域 CRUD（TDD）
Phase 3: 科目 CRUD（TDD）
Phase 4: ツリー一括操作 API（TDD）
Phase 5: CSVインポート API（TDD）
Phase 6: フロントエンド
Phase 7: E2E統合テスト
```

### 6.2 テスト方針

各機能で以下の順序でテストを書く：
1. Repository層テスト → 実装
2. UseCase層テスト → 実装
3. Route層テスト → 実装

**Repository テストの必須ケース:**
- 自分のデータのみ取得できること
- 他ユーザーのデータは取得できないこと（NOT_FOUND）
- 論理削除されたデータは取得できないこと
- 親が論理削除されたデータは取得できないこと

---

## 7. マイグレーション計画

### 7.1 既存データの扱い

**決定: クリーンスタート**
- 既存の`study_domains`, `subjects`, `categories`, `topics`データは削除
- 理由: 著作権懸念のあるデータを残さない
- 既存ユーザーの`chatSessions`, `notes`等は保持（orphanedになる）

### 7.2 マイグレーションステップ

1. `users`テーブルに`deletedAt`追加
2. 新スキーマのテーブル作成（`userId`, `deletedAt`追加）
3. 既存コンテンツデータ削除（topics → categories → subjects → study_domains の順）
4. `user_study_domains`テーブル削除
5. インデックス作成

**削除順序の理由**: FK制約によるエラーを避けるため、子から親の順で削除。

---

## 8. 削除される機能

| 機能 | 理由 |
|------|------|
| 公開学習領域 | 当面は個人所有のみ |
| 学習領域への参加/離脱 | 所有権モデルに変更 |
| `user_study_domains`テーブル | 不要 |
| シードデータ（試験範囲） | 著作権対策 |
| `isPublic`フラグ | 当面不使用 |
| 単元・論点の個別CRUD API | ツリー一括操作に統合 |

---

## 9. 将来の拡張可能性

v2.1の構造により、以下が将来可能：

| 機能 | 説明 |
|------|------|
| **テンプレート共有** | ユーザーが作成した構造を公開・共有 |
| **エクスポート** | CSV/JSON形式でのバックアップ |
| **組織向け機能** | 企業・学校が共有学習領域を管理 |

---

## 10. 成功基準

### 10.1 技術的成功基準

- [ ] 全テストがパス（TDDで実装）
- [ ] ユーザーが学習領域を作成できる
- [ ] ユーザーが科目を追加・編集・削除できる
- [ ] ツリーエディタで単元・論点を編集できる
- [ ] 論点の追加フィールド（description等）を編集できる
- [ ] CSVインポートが動作する
- [ ] 新規ユーザーにサンプルデータが作成される
- [ ] 論理削除が正しく動作する
- [ ] 親削除時に配下が不可視になる
- [ ] 型エラーがゼロ

### 10.2 ユーザー体験の成功基準

- [ ] 5分以内に最初の論点を作成できる
- [ ] 既存のチャット・ノート機能が正常に動作する
- [ ] データが他のユーザーに見えない（プライバシー）

### 10.3 思想の維持

- [ ] 「判断しない」: 理解度評価を追加していない
- [ ] 「論点中心」: 新構造でも論点が中心にある
- [ ] 「痕跡を残す」: 論理削除でデータ保持
- [ ] 「気づきの材料」: 事実ベースの表示を維持

---

## 11. リスクと対策

| リスク | 影響 | 対策 |
|--------|------|------|
| 既存ユーザーのコンテンツ消失 | 高 | 本番適用前に十分な告知 |
| ツリーエディタの複雑さ | 中 | 段階的実装（まず単純なリスト、後でD&D） |
| テスト修正の工数 | 高 | TDDで新しいテストを先に書く |
| パフォーマンス劣化 | 中 | userId + deletedAt の複合インデックス |
| ツリー更新の原子性 | 高 | db.batch()で全操作をatomicに実行 |

---

## 12. 実装順序

### Phase 1: 基盤（テスト先行）
1. DBスキーマ変更（userId, deletedAt追加）
2. マイグレーション作成
3. Zodスキーマ更新
4. テストヘルパー更新

### Phase 2: 学習領域CRUD（TDD）
1. Repository テスト → 実装
2. UseCase テスト → 実装
3. Route テスト → 実装

### Phase 3: 科目CRUD（TDD）
1. Repository テスト → 実装
2. UseCase テスト → 実装
3. Route テスト → 実装

### Phase 4: ツリー一括操作（TDD）
1. Repository テスト → 実装（差分更新ロジック）
2. UseCase テスト → 実装
3. Route テスト → 実装

### Phase 5: CSVインポート（TDD）
1. パーサー テスト → 実装（RFC 4180準拠）
2. UseCase テスト → 実装
3. Route テスト → 実装

### Phase 6: フロントエンド
1. 学習領域一覧・作成UI
2. 科目一覧・作成UI
3. ツリーエディタUI
4. 論点詳細編集パネル
5. CSVインポートUI
6. 新規ユーザーサンプル作成

### Phase 7: 統合・E2E
1. E2Eテスト
2. 本番マイグレーション検証
3. リリース
