terraform {
  required_version = ">= 1.0.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.1"
    }
  }

  # Cloudflare R2 backend (S3互換)
  # 事前に R2 バケット "terraform-state" を作成しておく必要あり
  backend "s3" {
    bucket = "terraform-state"
    key    = "cpa-study/terraform.tfstate"
    region = "auto"

    # R2はこれらの機能をサポートしていない
    skip_credentials_validation = true
    skip_metadata_api_check     = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
