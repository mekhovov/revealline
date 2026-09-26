BEGIN;

CREATE TABLE IF NOT EXISTS community_tus_uploads (
  upload_id text PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES community_submissions(id) ON DELETE CASCADE,
  owner_subject text NOT NULL,
  expires_at timestamptz NOT NULL,
  cleanup_owner text,
  cleanup_lease_expires_at timestamptz,
  cleanup_attempts integer NOT NULL DEFAULT 0 CHECK (cleanup_attempts >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CHECK (char_length(upload_id) BETWEEN 1 AND 200),
  CHECK (
    (cleanup_owner IS NULL AND cleanup_lease_expires_at IS NULL)
    OR (cleanup_owner IS NOT NULL AND cleanup_lease_expires_at IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS community_tus_expiry_idx
  ON community_tus_uploads (expires_at, upload_id);

CREATE INDEX IF NOT EXISTS community_tus_cleanup_lease_idx
  ON community_tus_uploads (cleanup_lease_expires_at)
  WHERE cleanup_owner IS NOT NULL;

COMMIT;
