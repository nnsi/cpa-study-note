# 差分レビュー結果（(1)→(2)）と再評価

## 1. 今回の差分で「明確に良くなった」点（拡張性への効きが大きい順）

### 1) ルーティング設計が整理され、衝突しにくい構造になった
- `apps/api/src/index.ts` で `/api/subjects` 配下に subject 機能を集約しており、URL空間の責務が読みやすくなっています。
- subject配下に「論点（topic）」「進捗」「検索」「フィルタ」まで集めたことで、「論点がどこに属するか（科目→カテゴリ→論点）」が API の見た目から推測しやすくなりました。

評価: **拡張時の事故（似たパスの増殖・衝突）をかなり抑えられる方向**です。

---

### 2) バリデーションと共有スキーマの採用範囲が広がり、契約が強くなった
- `packages/shared/src/schemas/*` の拡充（subject/topic/chat/note/metrics 等）に合わせて、API・Web が同じ型・同じZodに寄る箇所が増えています。
- `apps/api` 側でも `zValidator` の適用が増え、入力の「ゆらぎ」が減る方向です。

評価: **機能追加時に"どこを直すべきか"が型とスキーマから辿りやすくなった**のは強いです。

---

### 3) Result / AppError / ルート共通ハンドリングが導入され、横断的な実装規約ができた
- `apps/api/src/shared/lib/errors.ts`（`AppError` とコード）、`apps/api/src/shared/lib/result.ts`（Result）、
  `apps/api/src/shared/lib/route-helpers.ts`（`handleResult` / `handleResultWith`）が入りました。
- `auth / note / metrics / image / chat` などが徐々にこの方式へ移行しています。

評価: **拡張性（横展開のしやすさ）に直結する土台**ができています。

---

### 4) AIまわりの共通化が進み、機能追加の分岐点が減った
- `packages/shared/src/lib/ai-utils.ts` の `parseLLMJson` で「モデル出力のJSON解釈」を共通化。
- `apps/api/src/shared/lib/ai/config.ts` に `ocr` 設定が追加され、`apps/api/src/features/image/usecase.ts` で利用。

評価: **AIを使う機能を増やすときの"同じ罠"を踏みにくくなった**のはプラスです。

---

### 5) パフォーマンス面での改善がいくつか入っている
- "良い質問"取得が `apps/api/src/features/chat/repository.ts` に集約され、Web側も `apps/web/src/features/note/components/TopicNotes.tsx` で単発呼び出しに置き換え（N+1回避の方向）。
- topicフィルタが `apps/api/src/features/subject/repository.ts` でSQL寄りに再実装されており、アプリ側フィルタよりスケールしやすい。

評価: **今後データが増えた時の"遅さの壁"を越えやすい構造**になっています。

---

### 6) マルチユーザー境界・論理削除を意識したテストが増えた
- `apps/api/src/test/e2e/multi-user-boundary.test.ts` が追加され、deletedAtや越境アクセスの検証が増えています。
- subjectのルートテストも `apps/api/src/features/subject/route.test.ts` がかなり厚い。

評価: **拡張しても壊しにくい"安全柵"が増えた**のは良いです。


---

## 2. それでも残っている（または新しく目立つようになった）拡張性の問題点

ここからが重要で、現状だと"次の機能追加"で再びバラつきが出やすい箇所です。

---

### A) エラーレスポンス仕様が、コード・ドキュメント・共有スキーマ・フロントで不整合
現状、少なくとも **3種類**の形が混在しています。

1. `handleResult` 系の形（例: `{ error: { code, message, details? } }`）
2. 旧来の形（例: `{ error: "Subject not found" }`）
3. グローバル `onError`（`apps/api/src/index.ts`）は `{ error: "Internal Server Error" }`

さらに、
- `packages/shared/src/schemas/error.ts` の `apiErrorSchema` は `{ error: string }` を想定しており、`handleResult` の形と一致していません。
- Web側は `apps/web/src/features/*/api.ts` で `(error as { error?: string }).error` のように文字列前提で投げている箇所が多く、サーバ側がオブジェクトを返すと `Error: [object Object]` 系になりやすいです（UXが崩れます）。

影響（拡張性の観点）:
- 新しいAPIを増やすほど「どの形式で返すべきか」がブレ、フロントの例外処理も都度書き分けになりがちです。
- 共有スキーマを使っているのに、肝心の"失敗系契約"が合っていないため、契約駆動が成立しません。

改善の方向（設計として1本化）:
- **APIの標準エラー形式を1つに決める**（`{ error: { code, message, details? } }` に寄せるならそれで統一）。
- `packages/shared/src/schemas/error.ts` をその形に合わせて更新し、Web側はそれを parse して `message` を使う。
- `apps/api/src/features/subject/route.ts` の後半（detail/categories/topics/progress/check-history）も `handleResult` に寄せて統一。

---

### B) subject 機能が "巨大なモジュール" になり、変更の影響範囲が肥大化しやすい
`apps/api/src/features/subject/` が以下を同居させています:
- 科目CRUD
- ツリー（カテゴリ/論点）更新
- CSV import（subject単体 + domain一括）
- 検索・フィルタ
- 進捗・チェック履歴
- 統計情報（セッション数・良い質問数など、chat領域に近い集計）

評価:
- 「集約」自体は一貫性を作りやすい一方、今のままだと **"subjectが全部知っている"構造**になりやすいです。
- 拡張するときに "repo/usecase/route がどんどん太る" 形になり、読み替えコストが増えます。

具体的に起きやすい問題:
- 進捗の要件変更が tree 更新や import に波及しやすい
- chat側の集計仕様変更が subject 側のSQLに影響する
- レビュー機能追加が subject repo をさらに増やす

改善の方向:
- subject配下でも **用途別にファイル分割（少なくとも usecase を分割）**した方がスケールします。
  - 例: `usecase.subject.ts / usecase.tree.ts / usecase.progress.ts / usecase.search.ts` など
- repositoryも "巨大SQL置き場" になりやすいので、`subjectRepo` と `topicQueryRepo` のようにクエリ責務で分けると見通しが保てます。

---

### C) ブックマーク機能がユーザー境界を破っている（越境情報の漏れ）
これは拡張性というより **設計上の重大な欠陥（セキュリティ/整合性）**です。

- `apps/api/src/features/bookmark/repository.ts`
  - `targetExists()` が `userId` も `deletedAt` も見ていません
  - `getBookmarkDetails()` も `userId` / `deletedAt` を見ていない join です
- `apps/api/src/features/bookmark/usecase.ts`
  - 追加時に `targetExists` が true なら登録できる
  - 一覧で `getBookmarkDetails` から `name/path/domainId` が引けてしまう

結果:
- あるユーザーが、別ユーザーの `subjectId/categoryId/topicId` を知っている場合、**その名前・階層パスを自分のブックマーク一覧で参照できる**状態です。
- UUIDの推測困難性に依存した保護になっており、プロダクトの思想（学習データはユーザーごとに閉じる）と矛盾します。

改善の方向:
- ブックマークの "存在確認" と "詳細取得" は必ず `userId` + `deletedAt is null` を含める。
- subject側に既に `verifyTopicBelongsToSubject` 等があるので、同様の検証関数を bookmark 側でも使う/共有化するのが筋です。
- テストも `multi-user-boundary` に bookmarks を入れておくと、将来の拡張で再発しにくいです。

---

### D) subject route の後半だけ旧スタイルが残り、一貫性が途切れている
`apps/api/src/features/subject/route.ts` では、
- CRUD/Tree/Import は `handleResult` 系
- detail/categories/topics/progress/check-history は手書き `return c.json({ error: "..." }, 404)` が混在

影響:
- 実装規約が途中で切れ、API追加時に「どっちで書くか」が揺れます。
- エラー形式の不整合（A）を増幅します。

---

### E) "フィルタ条件の意味" が曖昧な箇所がある（将来の追加で破綻しやすい）
- `packages/shared/src/schemas/topic.ts` に `hasPostCheckChat` が型として存在するのに、
  `apps/api/src/features/subject/repository.ts` の `findFilteredTopics` では実際に使われていません。
- `daysSinceLastChat` の解釈が実装からは「直近N日以内にチャットがある」に見える（`lastChatAt >= cutoff`）。
  変数名の直感は「最後のチャットからN日以上経過」になりやすく、将来仕様変更時に誤解が出ます。

影響:
- UI側が条件を増やすほど「効いていないフィルタ」が混ざり、バグに見えます。
- 名前と実装がズレると、拡張時の修正が怖くなります。

---

### F) トランザクションまわりに設計上の揺れがある
- `apps/api/src/shared/lib/transaction/drizzle.ts` のコメントは
  - `createDrizzleTransactionRunner` は "D1でもOK" と書いてあり
  - `createSimpleTransactionRunner` は "D1では動かない" と書いてあり
  - subjectは `createNoTransactionRunner` を採用
  という具合に、前提が読み手に伝わりにくい状態です。
- `updateSubjectTree` には dynamic import（`await import("./repository")`）が入っており、Workers環境では避けたい類の複雑性（コールドスタート/バンドル/実行経路の追跡のしにくさ）を持ち込みます。

影響:
- 将来「部分失敗を許容しない更新」が増えると、設計判断が毎回必要になります。

---

### G) ドキュメントがコードに追随していない箇所がある
- `README.md` に `apps/api/src/features/topic/` が載っていますが、現状 `features/topic` は存在しません。
- docsに `v2` と `v2.1` が併存し、どれが現行かが読み手に伝わりにくい構造です。

影響:
- 拡張時に "ドキュメントを信じて実装して事故る" リスクが増えます。


---

## 3. 「思想（プロダクトとしての一貫性）」の再評価

READMEのコピー（「論点に残す、あとから効く」）を軸に見たとき、思想はかなりはっきりしています。

### 一貫している点
- 学習の中心概念が「論点（topic）」で、以下がすべて論点に紐づく
  - チャット（理解を深掘り）
  - ノート（あとから効く形に圧縮）
  - 進捗（理解済み/未理解、最近触った）
  - レビュー（フィルタ・検索）
  - メトリクス（学習量の可視化）
- 科目→カテゴリ→論点の階層を"編集できる"ことが、インポート・ツリー編集・検索にまで通っている

→ **学習ループ（触る→会話→要点化→再訪）を支える設計思想は揃っています。**

---

### ぶれている点（思想というより"実装規約の思想"が揃っていない）
- 「失敗の返し方」がAPI内で統一されていない（エラー形式/言語/ステータス）
- 「ユーザーデータは閉じる」という思想が、bookmarkで破れている
- 「論理削除はユーザーから見えない」という前提が、機能によって徹底度が違う（subject周りは強いが、bookmarkは弱い。noteは join に deletedAt が無い）

→ **プロダクト思想（学習体験）は揃っているが、実装思想（契約・境界・一貫性）の統一が未完**という評価になります。

---

## 4. 総合評価（今回の改善込み）

- 拡張性: **改善している**
  - 共有スキーマ、Result/AppError、subject集約、SQL寄りフィルタ、テスト増強は拡張に効く
- 拡張のボトルネック: **エラー契約の不整合**と**bookmarkの越境**
  - この2点が残ったまま機能追加を続けると、フロントの例外処理が分岐だらけになり、越境の穴が増えやすい

次の段階としては、主観抜きに「壊れにくい拡張」を優先するなら、
1) エラー形式を1本化（shared schema + web の取り回しまで含めて）
2) bookmark の userId/deletedAt 境界を塞ぐ
3) subject配下の usecase/repo を用途別に割って肥大化を止める
この順で効きが大きいです。
