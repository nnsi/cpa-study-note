# InkTopik コードベース改善計画

`docs/v2.1/feedback.md` に基づく拡張性・一貫性改善の実装計画。

---

## 概要

TopicFeatureとSubjectFeatureを統合し、userId/deletedAt対応も同時に行う。

| Phase | 内容 | 優先度 |
|-------|------|--------|
| 1 | TopicFeature + SubjectFeature 統合 | Critical |
| 2 | 共有スキーマの統合 | Medium |
| 3 | AI・パフォーマンス改善 | Lower |
| 4 | マルチユーザー境界テスト | Ongoing |

---

## Phase 1: TopicFeature + SubjectFeature 統合

### 背景
- TopicFeature (`/api/subjects`): 進捗・検索・フィルタ（認証なし、userId未対応）
- SubjectFeature (`/api`): CRUD・ツリー管理（認証あり、userId/deletedAt対応済み）
- 両者で `GET /api/subjects/:id` が衝突

### 方針
**SubjectFeatureをベースに統合**（userId/deletedAt対応済みなので）
1. TopicFeatureの機能をSubjectFeatureに移植
2. 移植時にuserId/deletedAtを必須化
3. TopicFeatureを削除
4. フロントエンドを更新

### Step 1: SubjectFeatureにルート追加

**移植するエンドポイント:**
| 旧パス (TopicFeature) | 新パス (SubjectFeature) |
|----------------------|------------------------|
| GET /api/subjects | GET /api/subjects（既存） |
| GET /api/subjects/filter | GET /api/subjects/filter |
| GET /api/subjects/search | GET /api/subjects/search |
| GET /api/subjects/:id/categories/:catId/topics | GET /api/subjects/:id/categories/:catId/topics |
| PUT /api/subjects/:id/topics/:topicId/progress | PUT /api/subjects/:id/topics/:topicId/progress |
| GET /api/subjects/:id/topics/:topicId/check-history | GET /api/subjects/:id/topics/:topicId/check-history |
| GET /api/subjects/progress/me | GET /api/subjects/progress/me |
| GET /api/subjects/progress/subjects | GET /api/subjects/progress/subjects |
| GET /api/subjects/progress/recent | GET /api/subjects/progress/recent |

**対象ファイル:**
```
apps/api/src/features/subject/
├── route.ts          # ルート追加
├── usecase.ts        # 進捗・検索・フィルタのusecase追加
└── repository.ts     # 必要なクエリ追加（userId/deletedAt対応で）
```

### Step 2: Repository関数の移植（userId/deletedAt対応）

TopicRepositoryから移植する関数（SubjectRepositoryパターンで実装）:

| 関数 | 対応内容 |
|------|----------|
| findCategoriesBySubjectId | userId必須、deletedAtフィルタ、親チェック |
| findTopicsByCategoryId | 同上 |
| findTopicById | 同上 |
| findTopicWithHierarchy | 同上 |
| getCategoryTopicCounts | 同上 |
| searchTopics | 同上 |
| findFilteredTopics | 同上 |
| findProgressByUser | userId必須（既存） |
| findRecentTopics | userId必須（既存） |
| findCheckHistoryByTopic | userId必須、deletedAtフィルタ |
| updateProgress | userId必須 |
| createCheckHistory | userId必須 |

**実装パターン:**
```typescript
// SubjectRepositoryに追加
findTopicsByCategoryId: async (categoryId: string, userId: string) => {
  return db.select()
    .from(topics)
    .innerJoin(categories, eq(topics.categoryId, categories.id))
    .innerJoin(subjects, eq(categories.subjectId, subjects.id))
    .where(and(
      eq(topics.categoryId, categoryId),
      eq(subjects.userId, userId),        // userId必須
      isNull(topics.deletedAt),            // 自身
      isNull(categories.deletedAt),        // 親
      isNull(subjects.deletedAt)           // 親の親
    ))
}
```

### Step 3: フロントエンド更新

**対象ファイル:**
| ファイル | 変更内容 |
|----------|----------|
| `apps/web/src/features/progress/api.ts` | APIクライアント更新（Hono RPCへ統一） |
| `apps/web/src/features/search/api.ts` | 同上 |
| `apps/web/src/features/review/api.ts` | 同上 |
| `apps/web/src/features/topic/api.ts` | 同上 |
| `apps/web/src/features/home/api.ts` | 同上 |

基本的にパスは変わらないが、Hono RPCクライアント経由に統一。

### Step 4: TopicFeature削除

**削除するファイル:**
```
apps/api/src/features/topic/
├── route.ts          # 削除
├── usecase.ts        # 削除（関数はSubjectUsecaseへ移動済み）
└── repository.ts     # 削除（関数はSubjectRepositoryへ移動済み）
```

**index.ts更新:**
```typescript
// Before
.route("/api/subjects", createTopicFeature(env, db))
.route("/api", createSubjectFeature(env, db))

// After
.route("/api", createSubjectFeature(env, db))  // 統合済み
```

### 検証
1. `pnpm check-types` - 型エラーゼロ
2. curl で全エンドポイント動作確認:
   - GET /api/subjects/:id → 認証必須、userId対応
   - GET /api/subjects/search → 認証必須
   - GET /api/subjects/filter → 認証必須
   - PUT /api/subjects/:id/topics/:topicId/progress → 認証必須
3. ブラウザでE2E確認（ログイン→科目一覧→論点→進捗更新）
4. 他ユーザーのデータにアクセスできないこと

---

## Phase 2: 共有スキーマの統合

### 問題
- Backend: 一部インラインZodスキーマ
- Frontend: 独自型定義が多数
- エラーパターンが4種類混在

### 対象ファイル
| ファイル | 変更内容 |
|----------|----------|
| `packages/shared/src/schemas/subject.ts` | 新規作成（Subject関連スキーマ） |
| `packages/shared/src/schemas/error.ts` | 新規作成（統一エラー形式） |
| `apps/web/src/features/subject/api.ts` | 独自型を`z.infer`へ置換 |
| `apps/web/src/features/study-domain/api.ts` | 同上 |
| `apps/api/src/features/note/route.ts` | インラインZodをsharedへ移動 |
| `apps/api/src/features/chat/route.ts` | 同上 |

### 統一エラー形式
```typescript
// packages/shared/src/schemas/error.ts
export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string().optional(),
  details: z.record(z.unknown()).optional(),
})
```

### 検証
- 型エラーゼロ
- Hono RPCクライアント生成が正常動作

---

## Phase 3: AI・パフォーマンス改善

### 3A: AI出力バリデーション共通化

**対象ファイル:**
- `packages/shared/src/lib/ai-utils.ts`（新規）
- `apps/api/src/features/chat/usecase.ts`
- `apps/api/src/features/note/usecase.ts`
- `apps/api/src/features/image/usecase.ts`

**共通ユーティリティ:**
```typescript
export const parseLLMJson = <T extends z.ZodTypeAny>(
  content: string,
  schema: T,
  fallback: z.infer<T>
): z.infer<T> => {
  try {
    const jsonStr = stripCodeBlock(content)
    const parsed = JSON.parse(jsonStr)
    const result = schema.safeParse(parsed)
    return result.success ? result.data : fallback
  } catch {
    return fallback
  }
}
```

### 3B: N+1クエリ削減

**新規エンドポイント:** `GET /api/chat/topics/:topicId/good-questions`

TopicNotes.tsxの並列API呼び出しを1回のバッチ取得に置換。

### 3C: ストリーミング最適化

`requestAnimationFrame`でバッファリングし、チャンクごとの再レンダリングを抑制。

---

## Phase 4: マルチユーザー境界テスト

### テストパターン
```typescript
it("should not return other user's topics", async () => {
  const userAToken = await createTestUser()
  const topic = await createTopicForUser(userAToken)

  const userBToken = await createTestUser()
  const res = await app.request(`/api/subjects/${topic.subjectId}/topics/${topic.id}`, {
    headers: { Authorization: `Bearer ${userBToken}` }
  })

  expect(res.status).toBe(404)
})
```

---

## 依存関係

```
Phase 1: 統合 ─────────────────────────────────┐
    └─ ルーティング衝突解消 + userId/deletedAt   │
                                               │
Phase 2: 共有スキーマ ──────────────────────────┤
    └─ Phase 1完了後（安定したAPI構造）          │
                                               │
Phase 3A: AI共通化 ─────────────────────────────┤ （独立）
Phase 3B: N+1削減 ──────────────────────────────┤ Phase 1に依存
Phase 3C: ストリーミング ────────────────────────┤ （独立）
                                               │
Phase 4: テスト ───────────────────────────────┘
    └─ Phase 1完了後
```

---

## 検証方法

各Phase完了時:
1. `pnpm check-types` - 型エラーゼロ
2. `pnpm test` - テスト通過
3. `pnpm --filter api dev` + curl - API動作確認
4. ブラウザでE2E確認（CORS、認証フロー）
