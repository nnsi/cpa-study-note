# 独立ノート（User Note）UI/API設計

## 目的

- チャットに依存せず、論点単位でノートを作成・編集できるようにする
- 「痕跡を残す」思想に沿って、ユーザーの再構成メモを蓄積できる導線を用意する

## 前提・方針

- 評価・正誤判定は行わない（事実の記録に徹する）
- ノートは必ず Topic に紐づく
- 既存の「チャット由来ノート」と区別できるが、一覧/表示は一貫させる

## データモデル

### Note（既存拡張）

| フィールド | 型 | 説明 |
|---|---|---|
| id | string | ノートID |
| userId | string | 作成者 |
| topicId | string | 論点ID |
| sessionId | string \| null | チャット由来の場合のみセット |
| aiSummary | string \| null | AI要約（チャット由来のみ） |
| userMemo | string \| null | ユーザー本文（独立ノートは必須推奨） |
| keyPoints | string[] | 重要ポイント（任意） |
| stumbledPoints | string[] | つまずきポイント（任意） |
| createdAt / updatedAt | datetime | 作成/更新日時 |

### 追加の識別プロパティ（UI用）

- `source`: `"chat"` | `"manual"`
  - `sessionId` の有無で判定しても良いが、UIでは明示的に扱えると便利

## API設計

### ノート作成（独立）

`POST /api/notes`

リクエスト:

```
{
  "topicId": "string",
  "userMemo": "string",
  "keyPoints": ["string"],
  "stumbledPoints": ["string"]
}
```

レスポンス:

```
{
  "note": Note
}
```

バリデーション:

- `topicId`: 必須
- `userMemo`: 1文字以上（上限 10,000 文字程度）
- `keyPoints` / `stumbledPoints`: 任意、各要素は1文字以上

### ノート作成（セッション由来・既存）

`POST /api/notes` で `sessionId` を送る既存仕様を維持する場合:

- `sessionId` が送られた場合はチャット由来ノートとして扱う
- `topicId` と `sessionId` の同時送信は禁止（単一の作成パスに固定）

### ノート更新（既存）

`PUT /api/notes/:noteId`

- 独立ノートは `userMemo` を主に更新
- チャット由来ノートも `userMemo` と `keyPoints`/`stumbledPoints` を編集可能

### ノート一覧（論点別・既存）

`GET /api/notes/topic/:topicId`

- `source` を返す（または `sessionId` から判定）

## UI設計

### 導線

- Topic Detail の「ノート」タブ内に `+ 独立ノートを作成` を追加
- 既存の「チャットから生成」と並列の導線にする

### ノート作成モーダル（最小UI）

入力項目:

- 本文（必須）
- キーポイント（任意・複数）
- つまずきポイント（任意・複数）

アクション:

- 作成
- キャンセル

### ノート一覧表示

カードに `手動ノート`/`チャットノート` のラベルを表示

例:

- 手動ノート: `📝 手動`
- チャットノート: `💬 チャット`

### ノート詳細

- 既存の詳細ページを流用
- チャット由来の場合のみ「最新の会話を反映」ボタンを表示

## 例外・制約

- チャット由来ノートは `sessionId` を必須として従来通り
- 独立ノートは `sessionId` を常に `null`
- `topicId` のみで作成できるが、認可はユーザー所有の Topic アクセス権に準拠

## 受け入れ基準

- チャットなしで論点にノートを追加できる
- 同一論点内で「チャットノート」と「独立ノート」が混在して表示される
- ノート詳細/編集は既存の画面で完結する

## タスクリスト

- [x] API: `POST /api/notes` の独立ノート作成を実装
- [x] API: バリデーション（本文/配列/長さ制限）を追加
- [x] API: レスポンスに `source` を含める（または `sessionId` から判定）
- [x] UI: Topic Detail のノートタブに作成導線を追加
- [x] UI: 独立ノート作成モーダルを実装
- [x] UI: ノート一覧に「手動/チャット」ラベルを表示
- [x] UI: チャット由来のみ再生成ボタンを表示
- [x] テスト: ユニットテスト（usecase/logic）
- [x] テスト: 統合テスト（API/DB）
- [x] テスト: 独立ノート作成/表示/更新の最低限E2E
