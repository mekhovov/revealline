BEGIN;

CREATE TABLE IF NOT EXISTS community_submissions (
  id uuid PRIMARY KEY,
  edition_id text NOT NULL UNIQUE,
  owner_subject text NOT NULL,
  slug text NOT NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  edition_version text NOT NULL,
  package_sha256 char(64) NOT NULL,
  declared_size bigint NOT NULL CHECK (declared_size > 0),
  actual_size bigint,
  blob_key text,
  status text NOT NULL CHECK (
    status IN ('draft', 'uploaded', 'queued', 'validating', 'published', 'rejected')
  ),
  rejection_code text,
  validation_report jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  published_at timestamptz,
  UNIQUE (owner_subject, slug, edition_version),
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CHECK (char_length(title) BETWEEN 1 AND 120),
  CHECK (char_length(description) <= 2000),
  CHECK (char_length(edition_version) BETWEEN 1 AND 64),
  CHECK (package_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK (
    (actual_size IS NULL AND blob_key IS NULL)
    OR (actual_size > 0 AND blob_key IS NOT NULL)
  ),
  CHECK (status = 'draft' OR (actual_size > 0 AND blob_key IS NOT NULL)),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS community_validation_jobs (
  id uuid PRIMARY KEY,
  submission_id uuid NOT NULL REFERENCES community_submissions(id) ON DELETE RESTRICT,
  package_sha256 char(64) NOT NULL,
  validator_version text NOT NULL,
  idempotency_key char(64) NOT NULL UNIQUE,
  status text NOT NULL CHECK (status IN ('queued', 'running', 'accepted', 'rejected')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  worker_id text,
  available_at timestamptz NOT NULL,
  claimed_at timestamptz,
  lease_expires_at timestamptz,
  completed_at timestamptz,
  result jsonb,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (submission_id, package_sha256, validator_version),
  CHECK (package_sha256 ~ '^[0-9a-f]{64}$'),
  CHECK (
    status <> 'running'
    OR (worker_id IS NOT NULL AND claimed_at IS NOT NULL AND lease_expires_at IS NOT NULL)
  ),
  CHECK (status NOT IN ('accepted', 'rejected') OR completed_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS community_catalog_published_idx
  ON community_submissions (published_at DESC, edition_id DESC)
  WHERE status = 'published';

CREATE INDEX IF NOT EXISTS community_validation_claim_idx
  ON community_validation_jobs (available_at, lease_expires_at, created_at)
  WHERE status IN ('queued', 'running');

COMMIT;
