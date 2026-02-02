# コードベースの拡張性評価と思想の一貫性レビュー

以下は、リポジトリ全体（`apps/api` / `apps/web` / `packages/db` / `packages/shared` / `docs`）を通読して見えた、拡張性のボトルネックと、プロダクト思想（「判断しない」「論点中心」「痕跡を残す」「気づきの材料」）の一貫性評価です。

---

## コードベースの骨格（前提整理）

- **モノレポ構成**
  - `apps/api`: Cloudflare Workers + Hono。feature単位で `Route → UseCase → Repository` が基本形。
  - `apps/web`: React + TanStack Router/Query。APIは `hono/client` で型付き呼び出し。
  - `packages/db`: Drizzle + D1(SQLite) スキーマ・マイグレーション。
  - `packages/shared`: Zodスキーマと共通型（API入出力の意図）。
- **思想の明文化**
  - `docs/design/app.md`, `docs/design/idea.md`, `docs/v2.1/design.md` で、思想とそれを支える機能（論点紐づけ、チェック履歴、質問の質フィードバック、統計）をかなり明確に規定。

この土台自体は拡張に向いた形です。ただし、移行期の"二重構造"と、スコープ（所有権/削除/型）の一貫性が崩れている箇所が、拡張性を大きく削っています。

---

## 拡張性の問題点（優先度が高い順）

### 1) APIルーティングの衝突と「旧API＋新API」同居が、将来の拡張を詰まらせる
**該当**: `apps/api/src/index.ts`
- `createTopicFeature` を `"/api/subjects"` にマウント
- `createSubjectFeature` を `"/api"` にマウント（この中に `GET /subjects/:id` 等がある）
→ 結果として **`GET /api/subjects/:id` が機能的に二重定義**になり得ます。
（Topic側は `topicRoutes.get("/:subjectId")`、Subject側は `subjectRoutes.get("/subjects/:id")`）

**拡張に与える影響**
- エンドポイント追加・改修時に「どちらの`/api/subjects/:id`が当たるか」問題が発生しやすく、機能増加で事故率が上がります。
- フロント側も `apps/web/src/features/subject/api.ts` の一部は新API（`/api/study-domains/:domainId/subjects`）を使いつつ、検索は旧API（`/api/subjects/search`）を叩くなど、依存が分散しています。

**改善方向**
- **APIバージョニング**（例: `/api/v1/...` と `/api/v2/...`）か、最低でもプレフィックスの再設計で衝突をなくす。
- 「論点閲覧＋進捗」系と「学習領域/科目/ツリー編集」系の責務を分け、旧APIを段階的に閉じる。

---

### 2) "ユーザー所有権（userId）＋論理削除（deletedAt）" の一貫性が feature 間で崩れている
**該当**
- 設計側の要求: `docs/v2.1/design.md` に「全Repository関数で userId を必須にする」と明記
- 実装側のズレ例:
  - `apps/api/src/features/topic/repository.ts` の多くの取得が **userId非考慮**（`findTopicWithHierarchy`, `findCategoriesBySubjectId`, `findSubjectById`, `findAllSubjects`…）かつ **deletedAt非考慮**
  - 一方 `apps/api/src/features/subject/repository.ts` / `study-domain` は userId と deletedAt を前提に設計されている

**拡張に与える影響**
- 「複数ユーザー」「複数学習領域」「共有領域」「組織向け」などに拡張するほど、**"取得系のうっかり漏洩"**が起きやすくなります。
- 論理削除導入後に、旧Repo経由の画面や検索が **削除済みの科目/論点を復活表示**しやすくなります。

**改善方向**
- `topic`系Repoも含めて、**取得関数の引数に userId を必須化**し、常に `(user_id, deleted_at is null)` と親のdeletedAtもJOINで確認する設計に寄せる。
- `TopicRepository` と `SubjectRepository` が同じテーブル群（subjects/categories/topics）を別思想で触っている状態は、長期的に破綻しやすいので統合方針を決める。

---

### 3) 旧v2の「公開ドメイン＋シード」資産が残り、思想・実装・運用が二重化している
**該当**
- `packages/db/data/study-domains/cpa/...`（公認会計士試験の領域データ）
- `packages/db/scripts/seed.ts`（`is_public` や `user_study_domains` 前提の古い型が残っている）
- v2.1では `apps/api/src/features/auth/sample-data.ts` によるサンプル生成へシフトしている

**拡張に与える影響**
- 「今の正はどれか」が不明瞭になり、機能追加時に古い仕組みに触れて壊すリスクが上がります。
- v2.1の目的（ユーザー定義コンテンツへ移行）と、リポジトリ同梱の"公開コンテンツ前提の資産"が混在し、開発・運用判断がぶれます。

**改善方向**
- 旧v2のデータ/seed/ドキュメントを **deprecated扱いに明示**、あるいはディレクトリを分ける（`docs/v2/`は残すにしても、現行は`docs/v2.1/`が正と明文化）。
- seedスクリプトは現行スキーマに合わせて更新するか、撤去して"サンプル生成"に一本化する。

---

### 4) 共有スキーマ（`packages/shared`）があるのに、型・入出力が局所実装で分裂している
**該当例**
- `packages/shared/src/schemas/*` が充実している一方で、
  - API側: featureによってはローカルZodを使う（例: `apps/api/src/features/note/route.ts` の更新リクエスト、`topic`の一部など）
  - Web側: 重要な型を独自定義している（例: `apps/web/src/features/subject/api.ts` の Subject/Tree型、`apps/web/src/features/note/components/TopicNotes.tsx` の Note型 など）

**拡張に与える影響**
- APIレスポンス変更が、フロントの"独自型"に刺さらず静かに壊れます。
- すでに `docs/diary/20260202.md` にある通り、バックエンドとフロントでレスポンス形状の認識ズレが起きています（発生しやすい構造のまま）。

**改善方向**
- "APIの入出力は shared のZodを唯一のソースにする"を徹底し、フロントは `z.infer`（あるいは型エクスポート）に寄せる。
- 最低ラインとして、**レスポンススキーマ**も shared 側に揃え、フロントで勝手な簡略型を作らない運用にする。

---

### 5) Result / Error の流儀が feature ごとに違い、横断的な拡張（共通エラーハンドリング等）が難しい
**該当例**
- `apps/api/src/shared/lib/result.ts` の `Result<T,E>` があるのに、
  - `study-domain` は `{ ok: true, value }` 型
  - `note` は `{ ok: true, note } | { ok:false, error, status }` 型
  - `chat` はストリームで `error` chunk を流す
- エラーメッセージも英日が混在（例: `"Topic not found"` と `"学習領域が見つかりません"`）

**拡張に与える影響**
- フロントで「共通のAPIエラー処理」を作りづらく、機能が増えるほど例外分岐が増えます。
- APIの振る舞いが揃っていないと、後から観測/分析（メトリクス、失敗率、リトライ方針）も揃いません。

**改善方向**
- "APIは共通エラー形式（code/message/details）を返す"を決め、Route層で統一変換する。
- `Result` を使うなら全UseCaseで統一し、ストリーム系だけ別扱いでもよいので境界を明確化する。

---

### 6) AIまわりのロジック重複と、出力の「型保証」が弱い
**該当例**
- 重複:
  - `apps/api/src/features/chat/usecase.ts` の `evaluateQuestion` JSONパース
  - `apps/api/src/features/note/usecase.ts` の要約JSONパース
  どちらも「コードブロック除去→JSON.parse→失敗時フォールバック」が似た形で散らばっています。
- 設定の不統一:
  - `apps/api/src/features/image/usecase.ts` だけOCRモデルが `openai/gpt-4o-mini` にハードコードされ、`resolveAIConfig` を迂回

**拡張に与える影響**
- モデル変更・プロバイダ変更・出力形式変更が入ると、修正箇所が増殖します。
- JSON出力が崩れた時に "とりあえず文字列保存" になっており、後段（UI/検索/統計）で扱いづらい不定形データが増えます。

**改善方向**
- AI出力は **Zodでバリデーション**し、失敗時のフォールバックも「壊れない構造（空配列＋短文）」に寄せる。
- `ai`ユーティリティ（`parseLLMJson(schema)`、`stripCodeBlock()`、`retryWithBackoff()`等）を shared にまとめ、featureから呼ぶ形にする。

---

### 7) パフォーマンス面で「小規模前提」の実装があり、機能追加で破綻しやすい
**該当例**
- `apps/api/src/features/topic/repository.ts` の `findFilteredTopics` は一度広く取ってアプリ側でフィルタする構造があり、条件追加ほど重くなります。
- `apps/web/src/features/note/components/TopicNotes.tsx` はセッションID配列に対し `getMessagesBySession` を並列実行しており、ノート/セッションが増えるとN+1が顕在化します。
- `apps/web/src/features/chat/hooks.ts` はストリーミングをチャンクごとに state 更新し続けるので、長文応答で再レンダリング負荷が増えます。

**拡張に与える影響**
- ノート・チャット履歴・論点数が増えるほど体感が落ち、新機能以前に"使い続けられない"が起きやすいです。

**改善方向**
- APIに「論点単位で必要な集計（良質質問数、代表質問、最終チャット日時など）をまとめて返す」エンドポイントを作り、フロントの並列GETを減らす。
- ストリーム表示はバッファリング（一定間隔でまとめて反映）に寄せる。

---

## 思想の一貫性評価

### 一貫している点（コードとUIが同じ方向を向いている）
1) **論点中心**がデータ構造で担保されている
- Chat session/message は topic に紐づく（`packages/db/src/schema/chat.ts`）。
- Note も topic に紐づく（`packages/db/src/schema/notes.ts`）。
- 進捗・チェック履歴も topic に紐づく（`packages/db/src/schema/topics.ts`, `topicCheckHistory.ts`）。
→ "活動が論点に吸着する"という思想がDB設計に落ちています。

2) **判断しない**が、UI/機能分解として守られている
- 理解度はAI判定ではなくユーザーが `理解済みとしてマーク`（`apps/web/src/features/topic/components/TopicInfo.tsx`）。
- AIがやっているのは「質問の性質（深掘り）」ラベルで、理解度の採点ではない（`docs/design/app.md` と `apps/api/src/features/chat/usecase.ts:evaluateQuestion`）。
- 統計も「事実量（回数・日時）」寄り（メトリクス、質問数、アクセス日時）。

3) **痕跡を残す**が、イベントとして蓄積されている
- `lastAccessedAt` 更新、チェック履歴、日次メトリクス、ブックマークなど、行動が残る設計になっています。
- ランディングコピー（`apps/web/src/routes/index.tsx`）も機能と整合しています。

---

### 揺れている点（思想が崩れやすい/解釈が混ざる）
1) **「事実を見せる」思想に対して、AI要約の `stumbledPoints` は解釈が混入しやすい**
**該当**: `apps/api/src/features/note/usecase.ts` の要約プロンプト
- つまずきポイントは会話からの推定になりやすく、外れると"評価された感"が出ます。
- 思想としては「気づきの材料」なので成立しますが、"観測可能な事実"への寄せ方がまだ弱いです。
**揺れを減らす方向**: `stumbledPoints` を「会話内で未解決だった点」「ユーザーが明示的に困ったと言った点」など、根拠を会話に限定する指示・スキーマに寄せる。

2) v2.1の移行思想（ユーザー定義コンテンツ）と、リポジトリ同梱の旧v2資産（公開ドメインデータ）が混在
- `packages/db/data/study-domains/cpa/...` が残ることで、方針が"実装の外側"でぶれた状態に見えます。
- 実運用で使っていないとしても、コードベースの思想の一貫性という観点ではノイズになります。

3) 「論点中心」と言い切るには、ブックマークが全階層対応になっている
- `packages/db/src/schema/bookmark.ts` は `subject|category|topic` を許容。
- これはUXとして合理的ですが、「すべての活動は論点に紐づく」を厳密に採ると例外です。
- ただし"活動"ではなく"ナビゲーション補助"と位置付けるなら整合します。UI上の語り（何を"痕跡"と呼ぶか）次第で一貫性が決まります。

---

## まとめ評価（思想 × 実装）
- **思想の表明（docs/UI）と、主要機能（論点紐づけ・痕跡・非採点）の整合は高い**です。
- 一方で、**移行期の二重構造（旧API/新API・旧データ/新方針）**と、**所有権/論理削除/型の一貫性不足**が、拡張性と思想の両方を同時に削っています。ここが最大のボトルネックです。

---

## 優先度付きの改善方針（実装の手戻りを減らす順）
1) **APIの衝突解消**（バージョニング or ルート再設計）
2) **topic系Repo/UseCaseを userId + deletedAt 前提に全面改修**（設計ドキュメントの方針へ揃える）
3) **sharedスキーマを唯一のソース化**（Webの独自型を減らし、入出力のズレを構造的に防ぐ）
4) **AI出力のスキーマ検証・共通化**（JSONパース分散を撤去、モデル設定も統一）
5) **N+1削減・集計API整備**（ノート/質問統計/検索をまとめて返す）
6) **マルチユーザー境界のテスト追加**（他ユーザーのtopic/subjectが取れないこと、deletedAtが反映されることを統合テストで固定）

この6点を押さえると、機能追加（検索拡張、共有領域、教材画像のOCR連携強化、学習領域テンプレ、組織向け等）をしても壊れにくい土台になります。
