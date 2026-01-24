# ===========================================
# D1 Databases
# ===========================================

resource "cloudflare_d1_database" "db_stg" {
  account_id = var.cloudflare_account_id
  name       = "cpa-study-db-stg"

  lifecycle {
    ignore_changes = all
  }
}

resource "cloudflare_d1_database" "db_prod" {
  account_id = var.cloudflare_account_id
  name       = "cpa-study-db-prod"

  lifecycle {
    ignore_changes = all
  }
}

# ===========================================
# R2 Buckets (Image Storage)
# ===========================================

resource "cloudflare_r2_bucket" "images_stg" {
  account_id = var.cloudflare_account_id
  name       = "cpa-study-images-stg"
  location   = "APAC"
}

resource "cloudflare_r2_bucket" "images_prod" {
  account_id = var.cloudflare_account_id
  name       = "cpa-study-images-prod"
  location   = "APAC"
}
