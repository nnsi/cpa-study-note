-- Add subject_id column to study_plans for linking plans to specific subjects
ALTER TABLE study_plans ADD COLUMN subject_id TEXT REFERENCES subjects(id) ON DELETE SET NULL;

-- Index for querying plans by subject
CREATE INDEX study_plans_subject_id_idx ON study_plans(subject_id);
