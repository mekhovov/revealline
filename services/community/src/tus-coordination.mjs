import { createHash, randomUUID } from 'node:crypto';
import { ERRORS } from '@tus/server';

const LOCK_RELEASE_CHANNEL = 'revealline_tus_lock_release';

const delay = (milliseconds, signal) =>
  new Promise((resolve) => {
    if (signal.aborted) return resolve();
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    const onAbort = () => {
      finish();
    };
    signal.addEventListener('abort', onAbort, { once: true });
  });

const lockIdentity = (namespace, id) => {
  const digest = createHash('sha256').update(`${namespace}\0${id}`, 'utf8').digest();
  return {
    first: digest.readInt32BE(0),
    second: digest.readInt32BE(4),
    notification: digest.subarray(0, 16).toString('hex'),
  };
};

export class PostgresTusLocker {
  constructor({ pool, acquireTimeoutMs = 30_000, retryDelayMs = 50, namespace = 'upload' }) {
    if (!pool?.connect) throw new Error('PostgreSQL tus locker requires a connection pool.');
    this.pool = pool;
    this.acquireTimeoutMs = acquireTimeoutMs;
    this.retryDelayMs = retryDelayMs;
    this.namespace = namespace;
  }

  newLock(id, { acquireTimeoutMs = this.acquireTimeoutMs } = {}) {
    return new PostgresTusLock({
      pool: this.pool,
      identity: lockIdentity(this.namespace, id),
      acquireTimeoutMs,
      retryDelayMs: this.retryDelayMs,
    });
  }
}

class PostgresTusLock {
  constructor({ pool, identity, acquireTimeoutMs, retryDelayMs }) {
    this.pool = pool;
    this.identity = identity;
    this.acquireTimeoutMs = acquireTimeoutMs;
    this.retryDelayMs = retryDelayMs;
    this.client = null;
    this.acquired = false;
    this.notificationHandler = null;
  }

  async lock(signal, requestRelease) {
    if (this.client) throw new Error('This tus lock instance has already been used.');
    if (signal.aborted) throw ERRORS.ABORTED;
    const deadline = Date.now() + this.acquireTimeoutMs;
    const client = await this.pool.connect();
    this.client = client;
    let releaseRequested = false;
    this.notificationHandler = (message) => {
      if (
        this.acquired &&
        message.channel === LOCK_RELEASE_CHANNEL &&
        message.payload === this.identity.notification &&
        !releaseRequested
      ) {
        releaseRequested = true;
        void Promise.resolve(requestRelease()).catch(() => {});
      }
    };
    client.on('notification', this.notificationHandler);
    try {
      await client.query(`LISTEN ${LOCK_RELEASE_CHANNEL}`);
      let notifiedHolder = false;
      while (!signal.aborted && Date.now() < deadline) {
        const result = await client.query(
          'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired',
          [this.identity.first, this.identity.second],
        );
        if (result.rows[0]?.acquired) {
          this.acquired = true;
          return;
        }
        if (!notifiedHolder) {
          await client.query(`SELECT pg_notify('${LOCK_RELEASE_CHANNEL}', $1)`, [
            this.identity.notification,
          ]);
          notifiedHolder = true;
        }
        await delay(Math.min(this.retryDelayMs, Math.max(1, deadline - Date.now())), signal);
      }
      throw signal.aborted ? ERRORS.ABORTED : ERRORS.ERR_LOCK_TIMEOUT;
    } catch (error) {
      await this.#releaseClient();
      throw error;
    }
  }

  async unlock() {
    if (!this.client || !this.acquired) throw new Error('Releasing an unlocked tus lock.');
    const client = this.client;
    try {
      const result = await client.query(
        'SELECT pg_advisory_unlock($1::integer, $2::integer) AS released',
        [this.identity.first, this.identity.second],
      );
      if (!result.rows[0]?.released) throw new Error('PostgreSQL did not release the tus lock.');
    } finally {
      this.acquired = false;
      await this.#releaseClient();
    }
  }

  async #releaseClient() {
    const client = this.client;
    if (!client) return;
    this.client = null;
    if (this.notificationHandler) client.off('notification', this.notificationHandler);
    this.notificationHandler = null;
    try {
      await client.query(`UNLISTEN ${LOCK_RELEASE_CHANNEL}`);
    } catch {
      client.release(true);
      return;
    }
    client.release();
  }
}

export class PostgresTusUploadRegistry {
  constructor({ pool }) {
    this.pool = pool;
  }

  async register({ uploadId, submissionId, ownerSubject, expirationMs }) {
    const result = await this.pool.query(
      `INSERT INTO community_tus_uploads (
         upload_id, submission_id, owner_subject, expires_at
       ) VALUES ($1, $2, $3, clock_timestamp() + ($4::bigint * interval '1 millisecond'))
       ON CONFLICT (upload_id) DO UPDATE SET upload_id=EXCLUDED.upload_id
       WHERE community_tus_uploads.submission_id=EXCLUDED.submission_id
         AND community_tus_uploads.owner_subject=EXCLUDED.owner_subject
       RETURNING upload_id`,
      [uploadId, submissionId, ownerSubject, expirationMs],
    );
    if (!result.rows[0]) throw new Error('Tus upload identity changed during registration.');
  }

  async forget(uploadId) {
    await this.pool.query('DELETE FROM community_tus_uploads WHERE upload_id=$1', [uploadId]);
  }

  async claimExpired({ workerId, limit, leaseMs }) {
    const result = await this.pool.query(
      `WITH candidates AS (
         SELECT upload_id
         FROM community_tus_uploads
         WHERE expires_at <= clock_timestamp()
           AND (cleanup_owner IS NULL OR cleanup_lease_expires_at <= clock_timestamp())
         ORDER BY expires_at, upload_id
         FOR UPDATE SKIP LOCKED
         LIMIT $2
       )
       UPDATE community_tus_uploads AS upload
       SET cleanup_owner=$1,
           cleanup_lease_expires_at=clock_timestamp() + ($3::bigint * interval '1 millisecond'),
           cleanup_attempts=cleanup_attempts + 1
       FROM candidates
       WHERE upload.upload_id=candidates.upload_id
       RETURNING upload.upload_id AS "uploadId"`,
      [workerId, limit, leaseMs],
    );
    return result.rows;
  }

  async completeCleanup({ uploadId, workerId }) {
    await this.pool.query(
      'DELETE FROM community_tus_uploads WHERE upload_id=$1 AND cleanup_owner=$2',
      [uploadId, workerId],
    );
  }

  async retryCleanup({ uploadId, workerId, retryAfterMs }) {
    await this.pool.query(
      `UPDATE community_tus_uploads
       SET cleanup_owner=NULL,
           cleanup_lease_expires_at=NULL,
           expires_at=clock_timestamp() + ($3::bigint * interval '1 millisecond')
       WHERE upload_id=$1 AND cleanup_owner=$2`,
      [uploadId, workerId, retryAfterMs],
    );
  }
}

export function createTusExpiryCleaner({
  registry,
  datastore,
  locker,
  batchSize = 32,
  leaseMs = 120_000,
  retryAfterMs = 300_000,
  cleanupConcurrency = 4,
  cleanupLockTimeoutMs = 5_000,
  workerId = randomUUID(),
}) {
  return async function cleanExpiredTusUploads() {
    const claims = await registry.claimExpired({ workerId, limit: batchSize, leaseMs });
    let removed = 0;
    let nextClaim = 0;
    const removeNext = async () => {
      const claim = claims[nextClaim];
      nextClaim += 1;
      if (!claim) return;
      const { uploadId } = claim;
      const lock = locker.newLock(uploadId, { acquireTimeoutMs: cleanupLockTimeoutMs });
      const controller = new AbortController();
      let locked = false;
      try {
        await lock.lock(controller.signal, () => controller.abort());
        locked = true;
        try {
          await datastore.remove(uploadId);
        } catch (error) {
          if (error !== ERRORS.FILE_NOT_FOUND && error !== ERRORS.FILE_NO_LONGER_EXISTS)
            throw error;
        }
        await registry.completeCleanup({ uploadId, workerId });
        removed += 1;
      } catch {
        await registry.retryCleanup({ uploadId, workerId, retryAfterMs });
      } finally {
        if (locked) await lock.unlock();
      }
      await removeNext();
    };
    await Promise.all(
      Array.from({ length: Math.min(cleanupConcurrency, claims.length) }, () => removeNext()),
    );
    return { claimed: claims.length, removed };
  };
}
