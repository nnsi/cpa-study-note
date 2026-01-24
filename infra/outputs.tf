# ===========================================
# Staging Outputs
# ===========================================

output "d1_database_id_stg" {
  description = "D1 Database ID (staging)"
  value       = cloudflare_d1_database.db_stg.id
}

output "r2_bucket_name_stg" {
  description = "R2 Bucket name (staging)"
  value       = cloudflare_r2_bucket.images_stg.name
}

# ===========================================
# Production Outputs
# ===========================================

output "d1_database_id_prod" {
  description = "D1 Database ID (production)"
  value       = cloudflare_d1_database.db_prod.id
}

output "r2_bucket_name_prod" {
  description = "R2 Bucket name (production)"
  value       = cloudflare_r2_bucket.images_prod.name
}
