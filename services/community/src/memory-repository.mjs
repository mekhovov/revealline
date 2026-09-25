import { randomUUID } from 'node:crypto';
import { CommunityError, createValidationIdempotencyKey } from './domain.mjs';

const copy = (value) => (value ? structuredClone(value) : value);

export class MemoryCommunityRepository {
  #submissions = new Map();
  #jobs = new Map();
  #reports = new Map();
  #audit = [];
  #admissionWindows = new Map();
  #admissionEvents = new Map();

  constructor({ clock = () => new Date() } = {}) {
    this.clock = clock;
  }

  #now() {
    return this.clock().toISOString();
  }

  async health() {
    return true;
  }

  async consumeAdmission({ action, subjectHash, idempotencyHash = null, cost, limit, windowMs }) {
    const nowMs = this.clock().getTime();
    const windowStartMs = Math.floor(nowMs / windowMs) * windowMs;
    const windowStartedAt = new Date(windowStartMs).toISOString();
    const retryAt = new Date(windowStartMs + windowMs).toISOString();
    const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + windowMs - nowMs) / 1_000));
    const now = new Date(nowMs).toISOString();
    let removed = 0;
    for (const [key, event] of this.#admissionEvents) {
      if (removed >= 64) break;
      if (event.expiresAt <= now) {
        this.#admissionEvents.delete(key);
        removed += 1;
      }
    }
    removed = 0;
    for (const [key, window] of this.#admissionWindows) {
      if (removed >= 64) break;
      if (window.expiresAt <= now) {
        this.#admissionWindows.delete(key);
        removed += 1;
      }
    }
    const eventKey = idempotencyHash ? `${action}\0${subjectHash}\0${idempotencyHash}` : null;
    const previous = eventKey ? this.#admissionEvents.get(eventKey) : null;
    if (previous && previous.expiresAt > now) {
      const previousWindow = this.#admissionWindows.get(previous.windowKey);
      return {
        allowed: true,
        reused: true,
        remaining: Math.max(0, limit - (previousWindow?.used ?? previous.cost)),
        retryAt: previous.retryAt,
        retryAfterSeconds: Math.max(1, Math.ceil((Date.parse(previous.retryAt) - nowMs) / 1_000)),
      };
    }
    const windowKey = `${action}\0${subjectHash}\0${windowStartedAt}`;
    const window = this.#admissionWindows.get(windowKey) ?? {
      used: 0,
      expiresAt: retryAt,
    };
    if (window.used + cost > limit)
      return { allowed: false, reused: false, remaining: 0, retryAt, retryAfterSeconds };
    window.used += cost;
    this.#admissionWindows.set(windowKey, window);
    if (eventKey)
      this.#admissionEvents.set(eventKey, {
        windowKey,
        cost,
        expiresAt: retryAt,
        retryAt,
      });
    return {
      allowed: true,
      reused: false,
      remaining: limit - window.used,
      retryAt,
      retryAfterSeconds,
    };
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

  async listPublished({ limit, cursor, search = '' }) {
    const query = search.toLocaleLowerCase('en-US');
    const ordered = [...this.#submissions.values()]
      .filter(
        (row) =>
          row.status === 'published' &&
          (!query ||
            [row.slug, row.title, row.description].some((value) =>
              value.toLocaleLowerCase('en-US').includes(query),
            )),
      )
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
      rows: copy(rows.map((row) => this.#withLatestEdition(row))),
      nextCursor: hasMore && last ? `${last.publishedAt}|${last.editionId}` : null,
    };
  }

  async getPublishedEdition(editionId) {
    const row = [...this.#submissions.values()].find(
      (candidate) => candidate.editionId === editionId && candidate.status === 'published',
    );
    return copy(row ? this.#withLatestEdition(row) : null);
  }

  #withLatestEdition(row) {
    const latest = [...this.#submissions.values()]
      .filter(
        (candidate) =>
          candidate.status === 'published' && candidate.collectionId === row.collectionId,
      )
      .sort(
        (a, b) =>
          b.publishedAt.localeCompare(a.publishedAt) || b.editionId.localeCompare(a.editionId),
      )[0];
    return {
      ...row,
      latestEditionId: latest?.editionId ?? row.editionId,
      latestVersion: latest?.editionVersion ?? row.editionVersion,
    };
  }

  async createReport({ editionId, reporterSubject, reason, details }) {
    const edition = await this.getPublishedEdition(editionId);
    if (!edition) return null;
    const key = `${editionId}\0${reporterSubject}`;
    const existing = this.#reports.get(key);
    if (existing) return { report: copy(existing), reused: true };
    const now = this.#now();
    const report = {
      id: randomUUID(),
      editionId,
      reporterSubject,
      reason,
      details,
      status: 'open',
      createdAt: now,
      resolvedAt: null,
      resolvedBy: null,
      resolution: null,
    };
    this.#reports.set(key, report);
    return { report: copy(report), reused: false };
  }

  async listReports({ status, limit, cursor }) {
    const ordered = [...this.#reports.values()]
      .filter((report) => report.status === status)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const filtered = cursor
      ? ordered.filter((report) => `${report.createdAt}|${report.id}` > cursor)
      : ordered;
    const rows = filtered.slice(0, limit);
    const last = rows.at(-1);
    return {
      rows: copy(rows),
      nextCursor: filtered.length > rows.length && last ? `${last.createdAt}|${last.id}` : null,
    };
  }

  async resolveReport({ id, actorSubject, resolution }) {
    const report = [...this.#reports.values()].find((candidate) => candidate.id === id);
    if (!report) return null;
    if (report.status === 'resolved') return { report: copy(report), reused: true };
    report.status = 'resolved';
    report.resolvedAt = this.#now();
    report.resolvedBy = actorSubject;
    report.resolution = resolution;
    this.#audit.push({
      id: randomUUID(),
      action: 'report.resolved',
      editionId: report.editionId,
      reportId: report.id,
      actorSubject,
      reason: resolution,
      createdAt: report.resolvedAt,
    });
    return { report: copy(report), reused: false };
  }

  async unlistPublishedEdition({ editionId, actorSubject, administrator = false, reason }) {
    const row = [...this.#submissions.values()].find(
      (candidate) =>
        candidate.editionId === editionId &&
        candidate.status === 'published' &&
        (administrator || candidate.ownerSubject === actorSubject),
    );
    if (!row) return null;
    row.status = 'unlisted';
    row.updatedAt = this.#now();
    this.#audit.push({
      id: randomUUID(),
      action: 'edition.unlisted',
      editionId,
      actorSubject,
      reason,
      createdAt: row.updatedAt,
    });
    return copy(row);
  }
}
