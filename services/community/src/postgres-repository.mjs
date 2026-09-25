import { randomUUID } from 'node:crypto';
import { CommunityError, createValidationIdempotencyKey } from './domain.mjs';

const mapSubmission = (row) =>
  row && {
    id: row.id,
    editionId: row.edition_id,
    collectionId: row.collection_id,
    ownerSubject: row.owner_subject,
    slug: row.slug,
    title: row.title,
    description: row.description,
    editionVersion: row.edition_version,
    packageSha256: row.package_sha256,
    declaredSize: Number(row.declared_size),
    actualSize: row.actual_size === null ? null : Number(row.actual_size),
    blobKey: row.blob_key,
    status: row.status,
    rejectionCode: row.rejection_code,
    validationReport: row.validation_report,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    latestEditionId: row.latest_edition_id ?? undefined,
    latestVersion: row.latest_version ?? undefined,
  };

const mapJob = (row) =>
  row && {
    id: row.id,
    submissionId: row.submission_id,
    packageSha256: row.package_sha256,
    validatorVersion: row.validator_version,
    idempotencyKey: row.idempotency_key,
    status: row.status,
    attempts: row.attempts,
    workerId: row.worker_id,
    availableAt: new Date(row.available_at).toISOString(),
    claimedAt: row.claimed_at ? new Date(row.claimed_at).toISOString() : null,
    leaseExpiresAt: row.lease_expires_at ? new Date(row.lease_expires_at).toISOString() : null,
    completedAt: row.completed_at ? new Date(row.completed_at).toISOString() : null,
    result: row.result,
  };

export class PostgresCommunityRepository {
  constructor({ pool, clock = () => new Date() }) {
    this.pool = pool;
    this.clock = clock;
  }

  async #transaction(operation) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async health() {
    await this.pool.query('SELECT 1');
    return true;
  }

  async createSubmission(candidate) {
    const now = this.clock();
    try {
      const result = await this.pool.query(
        `INSERT INTO community_submissions (
          id, edition_id, collection_id, owner_subject, slug, title, description, edition_version,
          package_sha256, declared_size, status, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,$11) RETURNING *`,
        [
          candidate.id,
          candidate.editionId,
          candidate.collectionId,
          candidate.ownerSubject,
          candidate.slug,
          candidate.title,
          candidate.description,
          candidate.editionVersion,
          candidate.packageSha256,
          candidate.declaredSize,
          now,
        ],
      );
      return mapSubmission(result.rows[0]);
    } catch (error) {
      if (error?.code === '23505')
        throw new CommunityError(409, 'version_exists', 'This immutable edition already exists.');
      throw error;
    }
  }

  async getOwnerSubmission(id, ownerSubject) {
    const result = await this.pool.query(
      'SELECT * FROM community_submissions WHERE id=$1 AND owner_subject=$2',
      [id, ownerSubject],
    );
    return mapSubmission(result.rows[0]);
  }

  async markUploaded({ id, ownerSubject, packageSha256, actualSize, blobKey }) {
    const result = await this.pool.query(
      `UPDATE community_submissions
       SET actual_size=$4, blob_key=$5, status='uploaded', updated_at=$6
       WHERE id=$1 AND owner_subject=$2 AND package_sha256=$3 AND declared_size=$4
         AND status IN ('draft','uploaded')
       RETURNING *`,
      [id, ownerSubject, packageSha256, actualSize, blobKey, this.clock()],
    );
    if (result.rows[0]) return mapSubmission(result.rows[0]);
    const existing = await this.getOwnerSubmission(id, ownerSubject);
    if (!existing) return null;
    throw new CommunityError(
      409,
      'invalid_transition',
      'This submission can no longer be uploaded.',
    );
  }

  async enqueueValidation({ id, ownerSubject, validatorVersion }) {
    return this.#transaction(async (client) => {
      const selected = await client.query(
        'SELECT * FROM community_submissions WHERE id=$1 AND owner_subject=$2 FOR UPDATE',
        [id, ownerSubject],
      );
      const submission = mapSubmission(selected.rows[0]);
      if (!submission) return null;
      const idempotencyKey = createValidationIdempotencyKey({
        submissionId: submission.id,
        packageSha256: submission.packageSha256,
        validatorVersion,
      });
      const found = await client.query(
        'SELECT * FROM community_validation_jobs WHERE idempotency_key=$1',
        [idempotencyKey],
      );
      if (found.rows[0]) return { submission, job: mapJob(found.rows[0]), reused: true };
      if (submission.status !== 'uploaded')
        throw new CommunityError(
          409,
          'invalid_transition',
          'Upload must finish before validation.',
        );
      const now = this.clock();
      const inserted = await client.query(
        `INSERT INTO community_validation_jobs (
          id, submission_id, package_sha256, validator_version, idempotency_key,
          status, available_at, created_at, updated_at
        ) VALUES ($1,$2,$3,$4,$5,'queued',$6,$6,$6) RETURNING *`,
        [
          randomUUID(),
          submission.id,
          submission.packageSha256,
          validatorVersion,
          idempotencyKey,
          now,
        ],
      );
      const updated = await client.query(
        `UPDATE community_submissions SET status='queued', updated_at=$2 WHERE id=$1 RETURNING *`,
        [submission.id, now],
      );
      return {
        submission: mapSubmission(updated.rows[0]),
        job: mapJob(inserted.rows[0]),
        reused: false,
      };
    });
  }

  async claimValidationJob({ workerId, leaseMs = 5 * 60 * 1_000 }) {
    return this.#transaction(async (client) => {
      const now = this.clock();
      const selected = await client.query(
        `SELECT * FROM community_validation_jobs
         WHERE (status='queued' AND available_at <= $1)
            OR (status='running' AND lease_expires_at <= $1)
         ORDER BY COALESCE(lease_expires_at, available_at), created_at
         FOR UPDATE SKIP LOCKED LIMIT 1`,
        [now],
      );
      if (!selected.rows[0]) return null;
      const leaseExpiresAt = new Date(now.getTime() + leaseMs);
      const updatedJob = await client.query(
        `UPDATE community_validation_jobs
         SET status='running', attempts=attempts+1, worker_id=$2, claimed_at=$3,
             lease_expires_at=$4, updated_at=$3
         WHERE id=$1 RETURNING *`,
        [selected.rows[0].id, workerId, now, leaseExpiresAt],
      );
      const updatedSubmission = await client.query(
        `UPDATE community_submissions SET status='validating', updated_at=$2
         WHERE id=$1 RETURNING *`,
        [selected.rows[0].submission_id, now],
      );
      return {
        job: mapJob(updatedJob.rows[0]),
        submission: mapSubmission(updatedSubmission.rows[0]),
      };
    });
  }

  async completeValidationJob({ jobId, workerId, accepted, result, rejectionCode = null }) {
    return this.#transaction(async (client) => {
      const now = this.clock();
      const updatedJob = await client.query(
        `UPDATE community_validation_jobs
         SET status=$3, result=$4, completed_at=$5, updated_at=$5, lease_expires_at=NULL
         WHERE id=$1 AND worker_id=$2 AND status='running' AND lease_expires_at > $5
         RETURNING *`,
        [jobId, workerId, accepted ? 'accepted' : 'rejected', result, now],
      );
      if (!updatedJob.rows[0])
        throw new CommunityError(
          409,
          'job_lease_lost',
          'Validation job is not owned by this worker.',
        );
      const job = mapJob(updatedJob.rows[0]);
      const updatedSubmission = await client.query(
        `UPDATE community_submissions
         SET status=$2, rejection_code=$3, validation_report=$4,
             published_at=$5, updated_at=$6
         WHERE id=$1 RETURNING *`,
        [
          job.submissionId,
          accepted ? 'published' : 'rejected',
          accepted ? null : rejectionCode || 'validation_failed',
          result,
          accepted ? now : null,
          now,
        ],
      );
      return { job, submission: mapSubmission(updatedSubmission.rows[0]) };
    });
  }

  async releaseValidationJob({ jobId, workerId, retryAt, result }) {
    return this.#transaction(async (client) => {
      const now = this.clock();
      const updated = await client.query(
        `UPDATE community_validation_jobs
         SET status='queued', worker_id=NULL, available_at=$3, result=$4,
             updated_at=$5, lease_expires_at=NULL
         WHERE id=$1 AND worker_id=$2 AND status='running' AND lease_expires_at > $5
         RETURNING *`,
        [jobId, workerId, retryAt, result, now],
      );
      if (!updated.rows[0])
        throw new CommunityError(
          409,
          'job_lease_lost',
          'Validation job is not owned by this worker.',
        );
      await client.query(
        `UPDATE community_submissions SET status='queued', updated_at=$2 WHERE id=$1`,
        [updated.rows[0].submission_id, now],
      );
    });
  }

  async listPublished({ limit, cursor, search = '' }) {
    const values = [limit + 1];
    let searchClause = '';
    if (search) {
      values.push(
        `%${search.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`,
      );
      searchClause = `AND (s.slug ILIKE $${values.length} ESCAPE '\\'
        OR s.title ILIKE $${values.length} ESCAPE '\\'
        OR s.description ILIKE $${values.length} ESCAPE '\\')`;
    }
    let cursorClause = '';
    if (cursor) {
      const separator = cursor.lastIndexOf('|');
      values.push(cursor.slice(0, separator), cursor.slice(separator + 1));
      const first = values.length - 1;
      cursorClause = `AND (s.published_at, s.edition_id) < ($${first}::timestamptz, $${first + 1}::text)`;
    }
    const result = await this.pool.query(
      `SELECT s.*, latest.edition_id AS latest_edition_id,
              latest.edition_version AS latest_version
       FROM community_submissions s
       JOIN LATERAL (
         SELECT edition_id, edition_version
         FROM community_submissions candidate
         WHERE candidate.collection_id=s.collection_id AND candidate.status='published'
         ORDER BY candidate.published_at DESC, candidate.edition_id DESC LIMIT 1
       ) latest ON true
       WHERE s.status='published' ${searchClause} ${cursorClause}
       ORDER BY s.published_at DESC, s.edition_id DESC LIMIT $1`,
      values,
    );
    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit).map(mapSubmission);
    const last = rows.at(-1);
    return {
      rows,
      nextCursor: hasMore && last ? `${last.publishedAt}|${last.editionId}` : null,
    };
  }

  async getPublishedEdition(editionId) {
    const result = await this.pool.query(
      `SELECT s.*,
              (SELECT candidate.edition_id
               FROM community_submissions candidate
               WHERE candidate.collection_id=s.collection_id AND candidate.status='published'
               ORDER BY candidate.published_at DESC, candidate.edition_id DESC LIMIT 1)
                AS latest_edition_id,
              (SELECT candidate.edition_version
               FROM community_submissions candidate
               WHERE candidate.collection_id=s.collection_id AND candidate.status='published'
               ORDER BY candidate.published_at DESC, candidate.edition_id DESC LIMIT 1)
                AS latest_version
       FROM community_submissions s WHERE s.edition_id=$1 AND s.status='published'`,
      [editionId],
    );
    return mapSubmission(result.rows[0]);
  }

  async createReport({ editionId, reporterSubject, reason, details }) {
    return this.#transaction(async (client) => {
      const edition = await client.query(
        `SELECT edition_id FROM community_submissions
         WHERE edition_id=$1 AND status='published'`,
        [editionId],
      );
      if (!edition.rows[0]) return null;
      const existing = await client.query(
        `SELECT * FROM community_reports WHERE edition_id=$1 AND reporter_subject=$2`,
        [editionId, reporterSubject],
      );
      if (existing.rows[0]) return { report: existing.rows[0], reused: true };
      const inserted = await client.query(
        `INSERT INTO community_reports (
           id, edition_id, reporter_subject, reason, details, status, created_at
         ) VALUES ($1,$2,$3,$4,$5,'open',$6) RETURNING *`,
        [randomUUID(), editionId, reporterSubject, reason, details, this.clock()],
      );
      return { report: inserted.rows[0], reused: false };
    });
  }

  async unlistPublishedEdition({ editionId, actorSubject, administrator = false, reason }) {
    return this.#transaction(async (client) => {
      const now = this.clock();
      const updated = await client.query(
        `UPDATE community_submissions SET status='unlisted', updated_at=$2
         WHERE edition_id=$1 AND status='published'
           AND ($3::boolean OR owner_subject=$4) RETURNING *`,
        [editionId, now, administrator, actorSubject],
      );
      if (!updated.rows[0]) return null;
      await client.query(
        `INSERT INTO community_audit_log (
           id, actor_subject, action, edition_id, reason, created_at
         ) VALUES ($1,$2,'edition.unlisted',$3,$4,$5)`,
        [randomUUID(), actorSubject, editionId, reason, now],
      );
      return mapSubmission(updated.rows[0]);
    });
  }
}
