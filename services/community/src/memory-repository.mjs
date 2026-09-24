import { randomUUID } from 'node:crypto';
import { CommunityError, createValidationIdempotencyKey } from './domain.mjs';

const copy = (value) => (value ? structuredClone(value) : value);

export class MemoryCommunityRepository {
  #submissions = new Map();
  #jobs = new Map();

  constructor({ clock = () => new Date() } = {}) {
    this.clock = clock;
  }

  #now() {
    return this.clock().toISOString();
  }

  async health() {
    return true;
  }

  async createSubmission(candidate) {
    for (const row of this.#submissions.values()) {
      if (row.editionId === candidate.editionId)
        throw new CommunityError(409, 'edition_exists', 'This immutable edition already exists.');
      if (
        row.ownerSubject === candidate.ownerSubject &&
        row.slug === candidate.slug &&
        row.editionVersion === candidate.editionVersion
      )
        throw new CommunityError(
          409,
          'version_exists',
          'This collection version already identifies another package.',
        );
    }
    const now = this.#now();
    const row = {
      ...candidate,
      actualSize: null,
      blobKey: null,
      status: 'draft',
      rejectionCode: null,
      validationReport: null,
      createdAt: now,
      updatedAt: now,
      publishedAt: null,
    };
    this.#submissions.set(row.id, row);
    return copy(row);
  }

  async getOwnerSubmission(id, ownerSubject) {
    const row = this.#submissions.get(id);
    return row?.ownerSubject === ownerSubject ? copy(row) : null;
  }

  async markUploaded({ id, ownerSubject, packageSha256, actualSize, blobKey }) {
    const row = this.#submissions.get(id);
    if (!row || row.ownerSubject !== ownerSubject) return null;
    if (row.packageSha256 !== packageSha256 || row.declaredSize !== actualSize)
      throw new CommunityError(409, 'identity_changed', 'The uploaded package identity changed.');
    if (row.status !== 'draft' && row.status !== 'uploaded')
      throw new CommunityError(
        409,
        'invalid_transition',
        'This submission can no longer be uploaded.',
      );
    row.actualSize = actualSize;
    row.blobKey = blobKey;
    row.status = 'uploaded';
    row.updatedAt = this.#now();
    return copy(row);
  }

  async enqueueValidation({ id, ownerSubject, validatorVersion }) {
    const row = this.#submissions.get(id);
    if (!row || row.ownerSubject !== ownerSubject) return null;
    const idempotencyKey = createValidationIdempotencyKey({
      submissionId: row.id,
      packageSha256: row.packageSha256,
      validatorVersion,
    });
    const existing = [...this.#jobs.values()].find((job) => job.idempotencyKey === idempotencyKey);
    if (existing) return { submission: copy(row), job: copy(existing), reused: true };
    if (row.status !== 'uploaded')
      throw new CommunityError(409, 'invalid_transition', 'Upload must finish before validation.');
    const now = this.#now();
    const job = {
      id: randomUUID(),
      submissionId: row.id,
      packageSha256: row.packageSha256,
      validatorVersion,
      idempotencyKey,
      status: 'queued',
      attempts: 0,
      workerId: null,
      availableAt: now,
      claimedAt: null,
      leaseExpiresAt: null,
      completedAt: null,
      result: null,
      createdAt: now,
      updatedAt: now,
    };
    this.#jobs.set(job.id, job);
    row.status = 'queued';
    row.updatedAt = now;
    return { submission: copy(row), job: copy(job), reused: false };
  }

  async claimValidationJob({ workerId, leaseMs = 5 * 60 * 1_000 }) {
    const now = this.#now();
    const job = [...this.#jobs.values()]
      .filter(
        (candidate) =>
          (candidate.status === 'queued' && candidate.availableAt <= now) ||
          (candidate.status === 'running' && candidate.leaseExpiresAt <= now),
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
    if (!job) return null;
    const submission = this.#submissions.get(job.submissionId);
    job.status = 'running';
    job.attempts += 1;
    job.workerId = workerId;
    job.claimedAt = now;
    job.leaseExpiresAt = new Date(this.clock().getTime() + leaseMs).toISOString();
    job.updatedAt = now;
    submission.status = 'validating';
    submission.updatedAt = now;
    return { job: copy(job), submission: copy(submission) };
  }

  async completeValidationJob({ jobId, workerId, accepted, result, rejectionCode = null }) {
    const job = this.#jobs.get(jobId);
    const now = this.#now();
    if (!job || job.status !== 'running' || job.workerId !== workerId || job.leaseExpiresAt <= now)
      throw new CommunityError(
        409,
        'job_lease_lost',
        'Validation job is not owned by this worker.',
      );
    const row = this.#submissions.get(job.submissionId);
    job.status = accepted ? 'accepted' : 'rejected';
    job.result = copy(result);
    job.completedAt = now;
    job.leaseExpiresAt = null;
    job.updatedAt = now;
    row.status = accepted ? 'published' : 'rejected';
    row.rejectionCode = accepted ? null : rejectionCode || 'validation_failed';
    row.validationReport = copy(result);
    row.publishedAt = accepted ? now : null;
    row.updatedAt = now;
    return { job: copy(job), submission: copy(row) };
  }

  async releaseValidationJob({ jobId, workerId, retryAt, result }) {
    const job = this.#jobs.get(jobId);
    const now = this.#now();
    if (!job || job.status !== 'running' || job.workerId !== workerId || job.leaseExpiresAt <= now)
      throw new CommunityError(
        409,
        'job_lease_lost',
        'Validation job is not owned by this worker.',
      );
    const row = this.#submissions.get(job.submissionId);
    job.status = 'queued';
    job.workerId = null;
    job.leaseExpiresAt = null;
    job.availableAt = retryAt;
    job.result = copy(result);
    job.updatedAt = now;
    row.status = 'queued';
    row.updatedAt = now;
  }

  async listPublished({ limit, cursor }) {
    const ordered = [...this.#submissions.values()]
      .filter((row) => row.status === 'published')
      .sort(
        (a, b) =>
          b.publishedAt.localeCompare(a.publishedAt) || b.editionId.localeCompare(a.editionId),
      );
    const filtered = cursor
      ? ordered.filter((row) => `${row.publishedAt}|${row.editionId}` < cursor)
      : ordered;
    const rows = filtered.slice(0, limit);
    const hasMore = filtered.length > rows.length;
    const last = rows.at(-1);
    return {
      rows: copy(rows),
      nextCursor: hasMore && last ? `${last.publishedAt}|${last.editionId}` : null,
    };
  }

  async getPublishedEdition(editionId) {
    const row = [...this.#submissions.values()].find(
      (candidate) => candidate.editionId === editionId && candidate.status === 'published',
    );
    return copy(row ?? null);
  }
}
