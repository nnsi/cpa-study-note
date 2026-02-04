# APIコード一貫性精査レポート

10個のfeature（auth, bookmark, chat, image, learning, metrics, note, study-domain, subject, view）を精査した結果。

---

## 高優先度（デザインパターンの破れ）

### 1. env パラメータの型定義と実装が不一致

型定義には `env: Env` があるが、実装では使用していないfeatureが存在。

| Feature | 問題のファイル | 状況 |
|---------|---------------|------|
| bookmark | `apps/api/src/features/bookmark/route.ts:19` | 型に env があるが未使用 |
| learning | `apps/api/src/features/learning/route.ts:34` | 型に env があるが未使用 |
| subject | `apps/api/src/features/subject/route.ts:34` | 型に env があるが未使用 |
| view | `apps/api/src/features/view/route.ts:37` | 型に env があるが未使用 |

**対策**: 未使用なら型定義からも削除、将来使う予定なら `_env` としてコメント追加

---

### 2. 複数の Deps型が混在

UseCase内で複数の異なるDeps型を定義しているfeatureがある。

| Feature | ファイル | 問題点 |
|---------|---------|--------|
| auth | `apps/api/src/features/auth/usecase.ts:10-18` | AuthDeps, RefreshDeps, DevLoginDeps の3型 |
| subject | `apps/api/src/features/subject/usecase.ts` | SubjectUseCaseDeps, TreeUseCaseDeps の2型 |

**対策**: 単一の Deps型に統合するか、機能ごとにusecase分割を検討

---

### 3. エラーハンドリングの戦略が混在

`errorResponse()` で手動処理するfeatureと `handleResult*()`でラッパー処理するfeatureが混在。

| パターン | Feature | ファイル例 |
|----------|---------|-----------|
| errorResponse() のみ | bookmark, learning, metrics | `bookmark/route.ts:28,40,62` |
| handleResult*() のみ | image, note, study-domain, subject, view | `note/route.ts:25,58,82` |
| 混合 | auth | `auth/route.ts:85,109` |

**対策**: `handleResult*()` に統一（route-helpers.ts に定義済み）

---

### 4. Zodスキーマの配置が不統一

| 配置 | Feature | ファイル |
|------|---------|---------|
| `@cpa-study/shared/schemas` からインポート | chat, note, bookmark, image, metrics, subject | 正しい |
| route.ts 内でローカル定義 | learning | `learning/route.ts:20-27` |
| route.ts 内でローカル定義 | view | `view/route.ts:21-35` |

**対策**: learning, view のスキーマを `packages/shared/src/schemas/` に移動

---

## 中優先度（命名・構造の一貫性）

### 5. Deps型の命名規則が不統一

| Feature | UseCase Deps型 | 問題 |
|---------|----------------|------|
| learning | `LearningUseCaseDeps` | `UseCaseDeps` 接尾辞 |
| view | `ViewUseCaseDeps` | `UseCaseDeps` 接尾辞 |
| 他のfeature | `XxxDeps` | 接尾辞なし |

**対策**: `XxxDeps` に統一

---

### 6. domain.ts の有無が不統一

| Feature | domain.ts | 備考 |
|---------|-----------|------|
| auth | あり | `auth/domain.ts` |
| chat | サブディレクトリ | `chat/domain/prompts.ts, sanitize.ts` |
| view | サブディレクトリ | `view/repositories/` に複数ファイル |
| 他 | なし | repository内に型定義 |

**対策**: ドメインロジックがないfeatureはrepository内の型定義で統一、domain.tsは削除検討

---

### 7. テストカバレッジが不均等

| Feature | テストファイル数 | 状況 |
|---------|-----------------|------|
| auth, chat, note, subject, image | 4-5 | 充実 |
| study-domain | 3 | 概ね良好 |
| learning, metrics, view | 1 | route.test.ts のみ |
| bookmark | 0 | テストなし |

**対策**: bookmark, learning, metrics, view のテスト追加

---

### 8. 201ステータスコードとレスポンス形式が不統一

| Feature | レスポンス形式 | ファイル |
|---------|---------------|---------|
| bookmark | `{ message: "Bookmark added" }` | `bookmark/route.ts:47` |
| chat | `{ session: result.value }` | `chat/route.ts:50` |
| note | `{ note: result.value }` | `note/route.ts:58` |
| metrics | `{ snapshot: result.value }` | `metrics/route.ts:51` |

**対策**: 作成系は `{ <resourceName>: data }` 形式に統一

---

## 低優先度（軽微）

### 9. JSDoc の不足

多くのusecase関数にドキュメントがない。

**対策**: 公開APIとなる関数には最低限の説明を追加

---

### 10. DI構築パターンが複数存在

```typescript
// パターン1: 単一deps（study-domain, bookmark）
const deps = { repo }

// パターン2: 複数deps（subject）
const deps = { subjectRepo }
const treeDeps = { subjectRepo, db, txRunner }

// パターン3: inline（chat, note, image）
// route内で直接渡す

// パターン4: 展開型（view）
const deps = { topicViewRepo, subjectDashboardViewRepo, ... }
```

**対策**: パターン1に統一を検討

---

## 対象ファイル一覧

### 要修正（高優先度）

- `apps/api/src/features/bookmark/route.ts` - env未使用、errorResponse()使用
- `apps/api/src/features/learning/route.ts` - env未使用、スキーマローカル定義、errorResponse()使用
- `apps/api/src/features/view/route.ts` - env未使用、スキーマローカル定義
- `apps/api/src/features/auth/usecase.ts` - 複数Deps型
- `apps/api/src/features/subject/usecase.ts` - 複数Deps型

### 要検討（中優先度）

- `apps/api/src/features/learning/usecase.ts` - Deps型命名
- `apps/api/src/features/view/usecase.ts` - Deps型命名
- `apps/api/src/features/auth/domain.ts` - 他featureと構造が異なる
- `apps/api/src/features/chat/domain/` - サブディレクトリ構造
- `apps/api/src/features/view/repositories/` - サブディレクトリ構造

### テスト追加対象

- `apps/api/src/features/bookmark/` - テストなし
- `apps/api/src/features/learning/` - route.test.ts のみ
- `apps/api/src/features/metrics/` - route.test.ts のみ
- `apps/api/src/features/view/` - route.test.ts のみ

---

## 推奨アクション

1. **即時対応**: Zodスキーマを shared に移動（learning, view）
2. **即時対応**: エラーハンドリングを handleResult*() に統一
3. **計画的対応**: 未使用 env パラメータの整理
4. **計画的対応**: Deps型の命名統一
5. **長期対応**: テストカバレッジ向上
