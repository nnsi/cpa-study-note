# ADR: ドメイン管理方針

**日付**: 2026-02-02
**ステータス**: 承認済み

## コンテキスト

本番環境へのデプロイに向けて、カスタムドメインの取得・設定方法を決定する必要がある。
現在、D1/R2/WorkersはTerraformで管理している。

## 検討した選択肢

### 方針A: ドメインもTerraform管理

```hcl
resource "cloudflare_zone" "main" { ... }
resource "cloudflare_record" "api" { ... }
resource "cloudflare_worker_domain" "api" { ... }
```

**長所**:
- インフラ全体をコードで一元管理
- 変更履歴がGitで追跡可能
- 複数環境の再現が容易

**短所**:
- Cloudflare Registrarでのドメイン購入自体はTerraformで自動化不可
- ゾーン追加にはネームサーバー変更という手動ステップが必要
- 設定変更が稀なリソースに対してオーバーエンジニアリング

### 方針B: ドメインはGUI管理（採用）

Cloudflareダッシュボードで手動設定:
- ドメイン購入（Cloudflare Registrar）
- DNSレコード設定
- Workersカスタムドメイン紐付け

**長所**:
- シンプル、追加の学習コスト不要
- 設定変更が稀なので手動で十分
- ドメイン購入からDNS設定まで一貫してGUIで完結

**短所**:
- 変更履歴がGitに残らない
- 複数環境を作る場合は手動で再現が必要

## 決定

**方針Bを採用する。**

理由:
- ドメインは1つ、環境もproductionのみ
- DNSレコードは少数（API、Web程度）
- 設定変更は稀（年に数回あるかどうか）
- Terraformでドメイン購入自体を自動化できない以上、GUIで完結させる方がシンプル

## IaC管理との境界

| リソース | 管理方法 |
|----------|----------|
| D1 Database | Terraform |
| R2 Bucket | Terraform |
| Workers Script | Terraform |
| Workers KV | Terraform |
| ドメイン/DNS | GUI（Cloudflareダッシュボード） |

## 将来の見直し条件

以下の場合はTerraform管理への移行を検討:
- staging環境を追加し、同じDNS構成を再現する必要が出た
- DNSレコードが10個以上に増えた
- チームメンバーが増え、変更履歴の追跡が重要になった
