# 目次インポート（toc-import）設計書

テキスト（教科書）の目次を写真に撮り、AIで科目のツリー（カテゴリ/サブカテゴリ/論点）に変換して一括登録する機能。

## 要件（ユーザー決定済み）

- **複数枚対応**: 目次が複数ページにまたがる場合、複数写真を1回のインポートで処理する（上限5枚）
- **プレビュー必須**: AI抽出結果は編集可能なツリーで表示し、ユーザーが確認・選択・リネームしてから登録する（即時登録しない）

## 設計判断

| 論点 | 決定 | 理由 |
|------|------|------|
| 機能の置き場所 | 新規feature `toc-import`（api/web両方） | 入力が画像で、提案形状が3階層必要。`topicSuggestionSchema`（2階層）を変更すると topic-generator に波及するため触らない |
| 画像の受け渡し | 既存 image feature を再利用（R2にアップロード→imageIdsを渡す） | multipart+SSEの混在を避ける。既存のmagic-byte検証・所有権チェック・10MB上限をそのまま使える。写真が残るので**再解析が再アップロード不要** |
| マルチ画像AI呼び出し | 1画像=1 userメッセージで複数メッセージ（AI層は無変更） | `vercel-ai.ts` は `imageUrl` 付きメッセージを画像パートに変換済み。OCR→テキスト整形の2段方式は目次のインデント（階層のシグナル）が落ちるため不採用 |
| レスポンス | SSEストリーミング（topic-generatorと同形式） | マルチ画像Geminiは10-30秒かかる。Workersの無応答タイムアウト回避と進捗UX。チャンク形式は `topicGeneratorChunkSchema`（text/error/done）を再利用 |
| マージ | クライアント側で既存ツリーとマージして `PUT /api/subjects/:id/tree` | `useAddSuggestedTopics` と同アーキテクチャ。名前完全一致で既存ノード再利用、同名論点はスキップ（重複作成しない） |
| モデル | `google/gemini-2.5-flash`, temperature 0, maxTokens 8000 | 抽出タスクなのでtemp 0。目次全体はtopicGeneratorの3000tokでは不足しうる |

## API設計

### `POST /api/toc-import/subjects/:subjectId/suggest`

- 認証: `authMiddleware`（Bearer）
- レート制限: `/api/toc-import/*` に `limiter.moderate()`（20 req/min。他のAI系エンドポイントと同じ）
- Request (JSON): `{ imageIds: string[] }`（1〜5件、`tocSuggestRequestSchema`）
- Response: SSE（`streamToSSE`）。チャンクは `{type:"text",content}` / `{type:"error",error}` / `{type:"done"}`
- usecase `suggestFromToc` は async generator:
  1. `subjectRepo.findById` で科目確認（なければ error チャンク）
  2. 各imageId: `imageRepo.findById` + userId所有権チェック + `r2.get(image.r2Key)` → 32KBチャンクbase64で data URL 化（失敗時はどの画像かを明示して error）
  3. system プロンプト + 画像ごとの user メッセージ（"目次画像 i/N"）+ 締めの user メッセージを構築
  4. `aiAdapter.streamText`（`aiConfig.tocImport`）で text チャンクを yield し、最後に done

### 共有スキーマ `packages/shared/src/schemas/toc-import.ts`

```ts
export const tocSuggestRequestSchema = z.object({
  imageIds: z.array(z.string().min(1)).min(1).max(5),
})
export const tocSuggestionSchema = z.object({
  categories: z.array(z.object({
    name: z.string().min(1).max(200),
    subcategories: z.array(z.object({
      name: z.string().min(1).max(200),
      topics: z.array(z.object({ name: z.string().min(1).max(200) })),
    })),
  })),
})
```

（description は目次から得られないため持たない。登録時は `null`）

## AIプロンプト（systemメッセージ、usecase内）

```
あなたは教科書の目次を学習アプリのデータ構造に変換するアシスタントです。
与えられる複数の画像は、1冊のテキストの目次（連続するページ）です。

## コンテキスト
- 科目: {subjectName}
- 既存カテゴリ: {existingCategories（カンマ区切り） or （なし）}

## 変換ルール
- 章（第1章など）→ categories[].name、節（1-1など）→ subcategories[].name、項・小見出し → topics[].name
- 階層が2段しかない場合: 章をカテゴリとし、subcategories は同名を1つ作って項目を topics に入れる
- ページ番号・リーダー線（……123）・柱・ノンブルは全て除去する
- 「第1章」「1.2」等の番号プレフィックスは除去し、見出しテキストのみ残す
- 「はじめに」「索引」「付録」「凡例」など学習項目でないものは除外する
- ページをまたいで続く章は1つにまとめる。画像は与えられた順序がページ順である
- 目次の掲載順を維持する
- 既存カテゴリと同名の章はその名前をそのまま使う（表記ゆれを寄せる）

## 出力形式
説明文は不要。以下のJSONのみを ```json ``` で囲んで出力:
{"categories":[{"name":"...","subcategories":[{"name":"...","topics":[{"name":"..."}]}]}]}
```

※ ユーザー入力（科目名・既存カテゴリ名）は既存の sanitize 処理（chat feature の sanitize を参照）を通してから埋め込む。

## フロントエンド設計（`apps/web/src/features/toc-import/`）

3層分離（logic / hooks / components）。

### logic.ts（純関数・単体テスト対象）

- `parseTocSuggestionsFromText(text)`: topic-generator の `parseSuggestionsFromText` と同じ戦略（```json フェンス除去→brace走査フォールバック）で `tocSuggestionSchema` 検証。失敗は null
- 編集可能ツリー型（リネームがあるため名前キーのMapは不可。keyはindexパス "0-1-2" 形式で決定的に生成）:
  ```ts
  type EditableTopic = { key: string; name: string; selected: boolean }
  type EditableSubcategory = { key: string; name: string; selected: boolean; topics: EditableTopic[] }
  type EditableCategory = { key: string; name: string; selected: boolean; subcategories: EditableSubcategory[] }
  ```
- `toEditableTree(suggestions)`: 全選択で初期化
- `toggleNode(tree, key)`: 子孫にカスケード、親は「子がいずれか選択中」で再計算
- `renameNode(tree, key, name)` / `countSelectedTopics(tree)`
- `mergeIntoTree(currentTree, editable)`: マージ規則
  - カテゴリ: 既存と名前完全一致（trim後）→ 既存idを保持して再利用 / なければ displayOrder=max+1 で追加
  - サブカテゴリ: 一致したカテゴリ内で名前一致→再利用 / なければ追加
  - 論点: 対象サブカテゴリに同名があればスキップ（重複作成しない）/ なければ displayOrder=max+1 で追加
  - 未選択ノード・フィルタ後に空になった枝は出力しない。名前はtrim、空名は捨てる
  - Response型→Input型の変換は `useAddSuggestedTopics`（topic-generator/hooks.ts）の方式を踏襲

### hooks.ts

- `useTocImages()`: `{file, previewUrl, imageId|null, status}[]`。`addFiles`（下記downscale→既存 `image/api` の `getUploadUrl`+`uploadImage`。**OCRは呼ばない**）、`remove`、`move`（ページ順の並べ替え）
- `useTocSuggestion(subjectId)`: `useTopicSuggestion` のクローン（SSE async iterator + rAFバッファ + AbortController）。done時に parse→`toEditableTree`。`setTree` を公開
- `useApplyTocSuggestions(subjectId)`: `getSubjectTree`→`mergeIntoTree`→`updateSubjectTree`→クエリ無効化（`["subjects", subjectId, "tree"]` と `["subjects"]`）

### image-resize.ts

`downscaleImage(file, maxEdge=2048, quality=0.8)`: `createImageBitmap`+canvas→JPEG。失敗時は元ファイルを返す。単体テスト不要（jsdomにcanvasなし）

### components/TocImportModal.tsx

`TopicGeneratorModal` と `ImageUploader` のビジュアルパターンを踏襲した4ステップモーダル:
1. 写真選択: `<input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" multiple>`、サムネイル一覧（削除・並べ替え）、「解析を開始」
2. 解析中: ストリーミングテキスト表示 + 中断
3. プレビュー: 3階層チェックボックスツリー + インラインリネーム + 「再解析」（同じimageIdsで再実行）+ フッター「◯論点を登録」
4. 登録: mutation pending/success → onComplete

### 組み込み

`apps/web/src/routes/domains/$domainId/subjects/$subjectId/edit.tsx` の「AIで論点を追加」ボタンの隣に「目次から取り込み」を追加し、モーダルを同様にレンダリング。

## 変更ファイル一覧

- CREATE `packages/shared/src/schemas/toc-import.ts` / `toc-import.test.ts`、MODIFY `index.ts`（barrel）
- MODIFY `apps/api/src/shared/lib/ai/config.ts`（`tocImport` スロット追加: local/production両方）
- CREATE `apps/api/src/shared/lib/binary.ts`（`arrayBufferToBase64` を image/usecase.ts から抽出。既存2箇所の付け替えはスコープ外）
- CREATE `apps/api/src/features/toc-import/{usecase,route,index}.ts` + `{usecase,route}.test.ts`、MODIFY `apps/api/src/index.ts`（route登録）
- CREATE `apps/web/src/features/toc-import/{api,logic,hooks,image-resize,index}.ts`、`components/TocImportModal.tsx`、`logic.test.ts`
- MODIFY `apps/web/src/routes/domains/$domainId/subjects/$subjectId/edit.tsx`

## テスト戦略

- shared: スキーマのaccept/reject、imageIds件数境界（0件・6件はreject）
- api: mockアダプタ（`createMockAdapter`）+ インメモリrepo + R2スタブで、text→doneのチャンク列 / 科目なしerror / 他人の画像error / N枚でN個の画像メッセージ（アダプタ入力をspy）を検証。route: 401 / 400（空imageIds）/ SSE content-type
- web: logic.tsのparse（フェンスあり/なし/ゴミ→null）、toEditableTree、toggleカスケード両方向、rename、mergeIntoTree（既存id再利用・displayOrder採番・同名スキップ・未選択除外・2階層パス）
- 実行は必ず `pnpm --filter <pkg> test`（vitest直叩き禁止）。修正後は shared/api/web 全部回す

## 検証チェックリスト（実装後）

1. 3パッケージのテスト green + 型チェック
2. dev環境（AI_PROVIDER=mock）で curl: upload-url → upload → suggest のSSEが `text`…`done` で流れる
3. ブラウザ実機（AI_PROVIDER=vercel-ai、実写真・複数MB・2枚以上）: 取り込み→ストリーミング表示→プレビュー階層が正しい→一部解除+リネーム→登録→TreeEditorに反映。同じ写真で再インポート→重複しない。再解析が再アップロードなしで動く
4. エッジ: 6枚目は弾かれる、ストリーム中断からの復帰、既存カテゴリ同名は再利用される

## リスク

- **Workerメモリ**: 5×10MB原本のbase64化で数十MB。クライアント側downscaleで緩和。問題が出たら上限を3枚に
- **8000tokでも途切れる**目次はparse失敗→null。UIは「解析結果を読み取れませんでした。再解析してください」+ 生テキスト表示で復帰可能にする
- **階層の誤認識**（節を章と扱う等）は発生前提。プレビュー編集が緩和策
- **表記ゆれ**の完全一致デデュープ漏れは trim で軽減。fuzzyマッチはスコープ外
