# 未実装機能タスクリスト

docs/design/app.md の要件に基づく未実装機能の実装タスク。

---

## 1. 日次メトリクススナップショット

**要件**: app.md 3.6 - 日ごとのチェック済み論点数・チャット活動量の推移を可視化

- [x] 1-1: `metricSnapshots` テーブル追加（date, userId, checkedTopicCount, sessionCount, messageCount, goodQuestionCount）
- [x] 1-2: 日次集計ロジック実装（当日分を集計する UseCase）
- [x] 1-3: 集計 API 実装（`GET /api/metrics/daily` で期間指定の日次データ取得）
- [x] 1-4: フロント：日次推移グラフ（折れ線グラフで2軸表示）

依存: 1-1 → 1-2 → 1-3 → 1-4

---

## 2. 論点フィルタ API

**要件**: app.md 3.7 - 条件で論点を抽出し、復習対象を見つけやすくする

- [x] 2-1: フィルタ API 実装（`GET /api/subjects/filter`）
- [x] 2-2: フィルタ条件対応（minSessionCount, daysSinceLastChat, understood, hasPostCheckChat, minGoodQuestionCount）
- [x] 2-3: フロント：フィルタUI（Review画面に条件選択フォーム）
- [x] 2-4: フロント：抽出結果表示（条件に合致した論点一覧）

依存: 2-1/2-2 → 2-3/2-4

---

## 3. 質問の質フィードバック UI

**要件**: app.md 3.5 - ✔/△ラベルをUIで表示

- [x] 3-1: ChatMessage に評価ラベル表示（メッセージ横に ✔/△ アイコン）
- [x] 3-2: 論点詳細：評価分布表示（フィルタ結果で良質質問数を表示）
- [x] 3-3: ノート反映（「深掘りした質問」セクションで評価済み質問を表示）

依存: なし（既存APIを使用）

---

## 4. Review 画面の実装

**要件**: app.md 6 - 振り返り専用画面

- [x] 4-1: `/review` ルート追加（Tanstack Router）← 2-3/2-4 で完了
- [x] 4-2: 日次推移グラフ配置（タスク1-4の成果）
- [x] 4-3: 条件抽出UI配置（タスク2-3, 2-4の成果）← 2-3/2-4 で完了

依存: 1-4, 2-3, 2-4 に依存

---

## 5. Home 画面の強化

**要件**: app.md 6 - 今日の活動、最近触った論点

- [x] 5-1: 今日の活動サマリ（当日のチャット数、チェック数を表示）
- [x] 5-2: 最近触った論点リスト（lastAccessedAt 順で上位N件表示）
- [x] 5-3: 日次折線（簡易版）（直近7日の推移を小さく表示）

依存: 5-3 は 1-3 に依存

---

## 6. TopicCheck 履歴

**要件**: app.md 3.2 - チェックの履歴（いつONにしたか）

- [x] 6-1: `topicCheckHistory` テーブル追加（topicId, userId, checkedAt, action）
- [x] 6-2: 進捗更新時に履歴記録（UseCase で履歴挿入）
- [x] 6-3: 履歴取得 API（`GET /api/subjects/:subjectId/topics/:topicId/check-history`）
- [x] 6-4: フロント：履歴表示（論点詳細でチェック履歴タイムライン）

依存: 6-1 → 6-2 → 6-3 → 6-4

---

## 並行開発フェーズ

### Phase 1（並行実行可能）

| Group | タスク | 内容 |
|-------|--------|------|
| A | 1-1, 1-2, 1-3 | 日次メトリクス バックエンド |
| B | 2-1, 2-2 | 論点フィルタ API |
| C | 3-1, 3-2, 3-3 | 質問評価 UI |
| D | 6-1, 6-2, 6-3 | TopicCheck履歴 バックエンド |

### Phase 2（Phase 1 完了後）

- 1-4: 日次推移グラフ
- 2-3, 2-4: フィルタ UI
- 6-4: 履歴表示 UI
- 5-1, 5-2: Home 強化

### Phase 3（Phase 2 完了後）

- 4-1, 4-2, 4-3: Review 画面
- 5-3: Home 日次折線
