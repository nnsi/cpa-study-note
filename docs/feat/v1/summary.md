# 公認会計士学習サポートアプリ 設計サマリ

## 技術スタック

| 領域 | 技術 |
|-----|------|
| フロントエンド | Vite + React + Tanstack Router |
| バックエンド | Hono on Cloudflare Workers |
| DB | Cloudflare D1 + Drizzle ORM |
| ストレージ | Cloudflare R2 |
| 認証 | Google OAuth（マルチプロバイダー対応設計） |
| AI | OpenRouter経由（DeepSeek-V3, Vision OCR） |
| UI | Tailwind CSS（シンプル・ミニマル） |
| 構成 | モノレポ（pnpm workspace） |

---

## 設計方針

| 領域 | 方針 |
|-----|------|
| API | クリーンアーキテクチャ + Package by Feature + 関数型 |
| フロント | Logic / UI Hooks / Component の3層分離 |
| バリデーション | Zod スキーマを shared で一元管理（フロント・バック共用） |
| 認証 | プロバイダー抽象化（MVP: Google、将来: GitHub, Apple等） |

---

## ディレクトリ構造

```
cpa-study-note/
├── package.json
├── pnpm-workspace.yaml
├── packages/
│   ├── shared/              # 共有型定義 + バリデーション
│   │   └── src/
│   │       ├── schemas/     # Zodスキーマ（API I/O）
│   │       └── types/       # 型定義（スキーマから推論）
│   └── db/                  # Drizzle スキーマ
│       ├── src/schema/
│       ├── migrations/
│       └── seed/
├── apps/
│   ├── api/                 # Hono API (Workers)
│   │   └── src/
│   │       ├── shared/      # 横断的関心事
│   │       └── features/    # Package by Feature
│   │           ├── auth/
│   │           ├── topic/
│   │           ├── chat/
│   │           ├── note/
│   │           └── image/
│   └── web/                 # React SPA
│       └── src/
│           ├── routes/      # Tanstack Router ページ
│           ├── features/    # 機能別モジュール
│           ├── components/  # 共通UIコンポーネント
│           ├── lib/         # ユーティリティ
│           └── api/         # APIクライアント
└── docs/
    └── plan/
        ├── summary.md       # 本ファイル
        ├── backend.md       # バックエンド設計
        └── frontend.md      # フロントエンド設計
```

---

## 機能一覧

| 機能 | 説明 |
|-----|------|
| 論点マップ | 科目→大分類→論点の階層表示、理解済みチェック |
| 論点特化AIチャット | 1論点に固定、横断禁止、ストリーミング回答 |
| 問題画像対応 | OCR AI → 回答AI の2段階処理 |
| 質問の質評価 | リアルタイム評価（✔︎ / △） |
| ノート機能 | AI要約 + ユーザーメモ、全履歴保存 |

---

## 実装フェーズ

### Phase 1: 基盤
- [ ] モノレポセットアップ（pnpm workspace）
- [ ] DBスキーマ定義・マイグレーション
- [ ] Google OAuth + JWT認証
- [ ] 基本CRUD API

### Phase 2: コア機能
- [ ] フロントエンド基盤（ルーティング・レイアウト）
- [ ] 論点マップUI
- [ ] AIチャット（DeepSeek-V3連携、ストリーミング）
- [ ] チャットUI

### Phase 3: 拡張機能
- [ ] 画像アップロード + OCR
- [ ] 質問評価（リアルタイム）
- [ ] ノート機能（AI要約 + ユーザーメモ）
- [ ] 学習進捗表示

### Phase 4: 仕上げ
- [ ] エラーハンドリング
- [ ] パフォーマンス最適化
- [ ] デプロイ設定

---

## 検証方法

1. **認証**: Google OAuthでログイン → ユーザー情報取得確認
2. **論点マップ**: 科目→大分類→論点の階層表示確認
3. **AIチャット**: 論点画面でメッセージ送信 → ストリーミング回答確認
4. **質問評価**: 質問送信後に✔︎/△バッジ表示確認
5. **OCR**: 画像アップロード → テキスト抽出 → AI回答確認
6. **ノート**: チャットからノート生成 → 要約・ユーザーメモ確認

---

## Critical Files

**packages/shared**
- `src/schemas/` - Zodスキーマ（API I/O バリデーション）

**packages/db**
- `src/schema/` - 全テーブルスキーマ（Drizzle）

**apps/api**
- `src/shared/lib/result.ts` - Result型ユーティリティ
- `src/shared/lib/ai/` - AI Adapter（Vercel AI SDK / Mastra 切り替え可能）
- `src/features/chat/` - チャット機能（コア）
- `src/features/auth/` - 認証機能

**apps/web**
- `src/lib/api-client.ts` - Hono RPCクライアント（型安全API）
- `src/features/chat/` - チャットUI（Logic/Hooks/Components）
- `src/features/topic/` - 論点マップUI
- `src/routes/subjects/$subjectId/$categoryId/$topicId.tsx` - 論点詳細ページ

---

## 関連ドキュメント

- [バックエンド設計](./backend.md)
- [フロントエンド設計](./frontend.md)
- [要件定義](./require.md)
- [実装タスクリスト](./tasks.md)
- [シードデータフォーマット](./seed-format.md)
