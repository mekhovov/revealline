BEGIN;

CREATE TABLE IF NOT EXISTS community_admission_windows (
  action text NOT NULL CHECK (action IN ('auth', 'report', 'submission', 'uploadBytes')),
  subject_hash char(64) NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL,
  used_count bigint NOT NULL CHECK (used_count > 0),
  expires_at timestamptz NOT NULL CHECK (expires_at > window_started_at),
  PRIMARY KEY (action, subject_hash, window_started_at)
);

CREATE TABLE IF NOT EXISTS community_admission_events (
  action text NOT NULL,
  subject_hash char(64) NOT NULL,
  idempotency_hash char(64) NOT NULL CHECK (idempotency_hash ~ '^[0-9a-f]{64}$'),
  window_started_at timestamptz NOT NULL,
  cost bigint NOT NULL CHECK (cost > 0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (action, subject_hash, idempotency_hash),
  FOREIGN KEY (action, subject_hash, window_started_at)
    REFERENCES community_admission_windows(action, subject_hash, window_started_at)
    ON DELETE CASCADE
);

ALTER TABLE community_reports
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by text,
  ADD COLUMN IF NOT EXISTS resolution text;

UPDATE community_reports
SET resolved_at = COALESCE(resolved_at, created_at),
    resolved_by = COALESCE(resolved_by, 'migration/legacy-report'),
    resolution = COALESCE(resolution, 'Resolved before report triage audit fields were introduced.')
WHERE status = 'resolved'
  AND (resolved_at IS NULL OR resolved_by IS NULL OR resolution IS NULL);

ALTER TABLE community_reports
  DROP CONSTRAINT IF EXISTS community_reports_resolution_state;
ALTER TABLE community_reports
  ADD CONSTRAINT community_reports_resolution_state CHECK (
    (status = 'open' AND resolved_at IS NULL AND resolved_by IS NULL AND resolution IS NULL)
    OR (
      status = 'resolved'
      AND resolved_at IS NOT NULL
      AND resolved_by IS NOT NULL
      AND char_length(resolution) BETWEEN 1 AND 1000
    )
  );

ALTER TABLE community_audit_log
  ADD COLUMN IF NOT EXISTS report_id uuid REFERENCES community_reports(id) ON DELETE RESTRICT;
ALTER TABLE community_audit_log
  DROP CONSTRAINT IF EXISTS community_audit_log_action_check;
ALTER TABLE community_audit_log
  ADD CONSTRAINT community_audit_log_action_check
  CHECK (action IN ('edition.unlisted', 'report.resolved'));

CREATE INDEX IF NOT EXISTS community_admission_window_expiry_idx
  ON community_admission_windows (expires_at);

CREATE INDEX IF NOT EXISTS community_admission_event_expiry_idx
  ON community_admission_events (expires_at);

CREATE INDEX IF NOT EXISTS community_report_triage_idx
  ON community_reports (status, created_at, id);

COMMIT;
