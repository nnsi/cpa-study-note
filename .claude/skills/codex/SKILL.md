---
name: codex
description: OpenAI Codex CLIを使ってコードレビュー・分析・質問・実装を実行する。トリガー: "codex", "/codex", "codexで〜", "codexに聞いて"
user_invocable: true
---

# Codex CLI Skill

Codex CLI をBashから呼び出し、結果を検収して報告するスキル。
作法の正は `../cb-rpg/CLAUDE.md`「作業の委譲」節（このファイルはその要約。乖離したらあちらを優先）。

## 基本方針

- **メインは判断・検収に専念し、手を動かす作業（実装・修正・テスト実行・大規模探索）はCodexに委譲する**
- 結果は `-o`（`--output-last-message`）でファイルに書き出し、Readツールで読み取って報告する
- デフォルトは `--sandbox read-only`（分析・調査）。実装タスクのみ `--sandbox workspace-write`
- **run_in_background で実行する**（長時間タスクでセッションをブロックしない）
- 成果物はメインが必ずレビューしてから完了報告する

## コマンドテンプレート

### 実装タスク（ファイル書き込みあり）

```bash
codex exec --sandbox workspace-write -o /tmp/codex-last.md \
  -c model_reasoning_effort="low" "<自己完結の指示>" < /dev/null
```

### 分析・調査（読み取りのみ）

```bash
codex exec --sandbox read-only -o /tmp/codex-last.md \
  -c model_reasoning_effort="high" "<自己完結の指示>" < /dev/null
```

### コードレビュー（未コミット変更 / ブランチ差分）

```bash
codex exec review --uncommitted -o /tmp/codex-review.md < /dev/null
codex exec review --base master -o /tmp/codex-review.md < /dev/null
```

### 続きの指示

```bash
codex exec resume --last "<追加指示>" < /dev/null
```

※ `resume` は `--sandbox` 等のフラグ併用不可（実行前にCLIエラーになる）

## 必須の注意事項

- **`< /dev/null` を必ず付ける**: `codex exec` は起動時に stdin を読み、run_in_background 等で stdin が EOF にならないと「Reading additional input from stdin...」で無出力のまま無限ハングする実例あり（cb-rpg 2026-07-06）
- **effort は常に明示する**: config 既定（`xhigh`）に依存すると大幅に遅くなる。難課題=`high` / 通常実装・機械的作業=`low`
- **指示は自己完結で書く**: Codexは会話コンテキストを持たない。対象パス・検収条件・参照してよいファイルを明記する（長い仕様はリポジトリ内のdocsに書いてパスを渡す）
- **委譲前に反証可能な検収条件を決める**（テストがgreenになる・出力diffが一致する等）。数値は出どころを1個ずつ問う
- Codex 不調時は Agent ツールで代替（haiku=機械的 / sonnet=通常 / opus=難課題。fork はモデル指定が効かないため不可）

## 実行手順

1. タスク種別を判定（分析/レビュー/実装）し、反証可能な検収条件を決める
2. 自己完結の指示文を組み立て、テンプレートを選択して run_in_background で実行
3. 完了通知後、`-o` の出力ファイルと実際のdiff（`git diff`）をReadツールで検収
4. テスト（`pnpm --filter <pkg> test`）等で検収条件を確認し、結果を日本語で要約して報告
