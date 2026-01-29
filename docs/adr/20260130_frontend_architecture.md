# ADR: モバイルチャット画面のレイアウト設計

**日付**: 2026-01-30
**ステータス**: 承認済み（実装待ち）

## コンテキスト

iPhoneでチャット画面（TopicDetailPage）を使用した際、以下の問題が発生していた：

1. チャット入力欄とBottomNavの間に不要な余白が発生
2. 外側のスクロールが発生し、Pull to Refreshが誤作動
3. 横幅がはみ出してタブが見切れる
4. **Safariのアドレスバーがスクロールしても縮小しない**（他の画面では縮小する）

## 調査結果

### 問題4の原因

iOS Safariのアドレスバー縮小は**ルート（body/document）スクロール時のみ**発火する。
現在のTopicDetailPageは以下の構造のため、アドレスバーが縮小しない：

```
Layout (h-dvh, flex)
└── main
    └── TopicDetailPage (h-[calc(...)], overflow-hidden)
        └── ChatContainer (flex-1, overflow-y-auto) ← ここだけスクロール
```

内部要素（ChatContainer）のスクロールではSafariはルートスクロールと認識しない。

### 検討した選択肢

#### 方針A: ルートスクロール + sticky/fixed（推奨）

- bodyをスクロール可能にし、ヘッダー・入力欄は`position: sticky`または`fixed`で固定
- メッセージエリアは通常フローで高さが伸びる構造に変更
- **長所**: 確実にアドレスバー縮小が機能、JS不要
- **短所**: DOM構造の大幅な見直しが必要

#### 方針B: JSハック

- メッセージエリアのスクロール時に`window.scrollBy(0, 1)`等でルートを微小に動かす
- Safariに「ルートスクロールが起きた」と誤認させる
- **長所**: 既存構造を維持
- **短所**: 不安定、慣性スクロールとの相性が悪い、ハック的

#### 方針C: 現状維持

- アドレスバー縮小をあきらめる
- ヘッダー・入力欄固定は維持
- **長所**: 変更不要
- **短所**: 他の画面との挙動の一貫性がない

## 決定

**方針Aを採用する。**

理由：
- ハックに頼らず、Safariの仕様に沿った正攻法
- 他の画面との挙動の一貫性を保てる
- `100dvh`/`100svh`等の新しいビューポート単位を活用できる

## 今回のセッションで解決した問題

方針Aの実装は次回以降とし、今回は以下の問題を解決した：

### 1. Pull to Refresh無効化
```css
html, body {
  overscroll-behavior: none;
}
```

### 2. CSS変数によるBottomNav高さ管理
```css
:root {
  --bottom-nav-height: 70px;
  --safe-area-bottom: env(safe-area-inset-bottom, 0px);
}
```

### 3. 横幅はみ出し問題
flexboxの子要素に`min-w-0`を追加して、親の幅に収まるようにした：
- Layout.tsx の main
- TopicDetailPage
- ChatContainer
- ChatMessage

`overflow-hidden`ではなく`min-w-0`を使う理由：
- `overflow-hidden`は「隠す」、`min-w-0`は「収める」
- `overflow-hidden`をLayout全体に適用すると、他の画面のスクロールも効かなくなる

### 4. 各画面のBottomNav対応

| 画面 | 方式 |
|------|------|
| ホーム、ノート等 | Layout.tsxのmainに`pb-[calc(var(--bottom-nav-height)+var(--safe-area-bottom))]` |
| TopicDetailPage | 独自に`h-[calc(100dvh-var(--bottom-nav-height)-var(--safe-area-bottom))]` |

TopicDetailPageは固定高さ+内部スクロールの構造を維持（方針A実装までの暫定）。

## 次のアクション

1. 方針Aの詳細設計
   - TopicDetailPageのDOM構造を見直し
   - ヘッダー（論点名）を`position: sticky`に
   - ChatInputを`position: sticky`または`fixed`に
   - メッセージエリアを通常フローに変更

2. 影響範囲の確認
   - PC版のレイアウトへの影響
   - 他の画面への影響

## 参考

- [web.dev - viewport units](https://web.dev/blog/viewport-units)
- [Stack Overflow - Hide address bar on fixed positioned views](https://stackoverflow.com/questions/72405239/hide-address-bar-on-fixed-positioned-views-in-safari-ios-15)
