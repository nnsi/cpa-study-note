-- 変遷の reason を任意項目に変更（自動記録対応）
-- SQLite では ALTER COLUMN がないため、テーブル再作成で対応

CREATE TABLE study_plan_revisions_new (
  id TEXT PRIMARY KEY,
  study_plan_id TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);

INSERT INTO study_plan_revisions_new (id, study_plan_id, summary, reason, created_at)
SELECT id, study_plan_id, summary, reason, created_at FROM study_plan_revisions;

DROP TABLE study_plan_revisions;
ALTER TABLE study_plan_revisions_new RENAME TO study_plan_revisions;

CREATE INDEX study_plan_revisions_plan_id_idx ON study_plan_revisions(study_plan_id);
