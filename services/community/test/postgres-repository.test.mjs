import assert from 'node:assert/strict';
import test from 'node:test';
import { PostgresCommunityRepository } from '../src/postgres-repository.mjs';

const editionId = `ed_${'a'.repeat(64)}`;
const createdAt = new Date('2026-09-25T12:00:00.000Z');

function concurrentReportPool() {
  let nextClient = 0,
    committed = false,
    releaseSecondInsert;
  const secondInsert = new Promise((resolve) => {
    releaseSecondInsert = resolve;
  });
  const row = {
    id: '7280fbd2-2e42-4665-aa4b-01cb36fc27f2',
    edition_id: editionId,
    reporter_subject: 'anonymous/reporter',
    reason: 'broken',
    details: 'The package cannot be opened.',
    status: 'open',
    created_at: createdAt,
    resolved_at: null,
    resolved_by: null,
    resolution: null,
  };
  return {
    async connect() {
      const clientId = nextClient++;
      return {
        async query(sql) {
          if (sql === 'BEGIN' || sql === 'ROLLBACK') return { rows: [] };
          if (sql === 'COMMIT') {
            if (clientId === 0) {
              committed = true;
              releaseSecondInsert();
            }
            return { rows: [] };
          }
          if (sql.includes('FROM community_submissions'))
            return { rows: [{ edition_id: editionId }] };
          if (sql.includes('INSERT INTO community_reports')) {
            assert.match(sql, /ON CONFLICT \(edition_id, reporter_subject\) DO NOTHING/u);
            if (clientId === 0) return { rows: [row] };
            await secondInsert;
            assert.equal(committed, true);
            return { rows: [] };
          }
          if (sql.includes('SELECT * FROM community_reports')) {
            assert.equal(committed, true);
            return { rows: [row] };
          }
          throw new Error(`Unexpected query: ${sql}`);
        },
        release() {},
      };
    },
  };
}

test('concurrent PostgreSQL report duplicates return one creation and one reused row', async () => {
  const repository = new PostgresCommunityRepository({
    pool: concurrentReportPool(),
    clock: () => createdAt,
  });
  const input = {
    editionId,
    reporterSubject: 'anonymous/reporter',
    reason: 'broken',
    details: 'The package cannot be opened.',
  };
  const [first, second] = await Promise.all([
    repository.createReport(input),
    repository.createReport(input),
  ]);
  assert.equal(first.reused, false);
  assert.equal(second.reused, true);
  assert.deepEqual(second.report, first.report);
});

test('idempotent PostgreSQL admission uses a text-safe advisory lock identity', async () => {
  const subjectHash = 'a'.repeat(64);
  const idempotencyHash = 'b'.repeat(64);
  let released = false;
  const pool = {
    async connect() {
      return {
        async query(sql, parameters = []) {
          if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [] };
          if (sql === 'SELECT clock_timestamp() AS now') return { rows: [{ now: createdAt }] };
          if (sql.includes('pg_advisory_xact_lock')) {
            assert.equal(
              parameters[0],
              JSON.stringify(['uploadBytes', subjectHash, idempotencyHash]),
            );
            assert.doesNotMatch(parameters[0], /\0/u);
            return { rows: [] };
          }
          if (sql.includes('SELECT w.used_count')) return { rows: [] };
          if (sql.includes('INSERT INTO community_admission_windows'))
            return { rows: [{ used_count: 12 }] };
          return { rows: [] };
        },
        release() {
          released = true;
        },
      };
    },
  };
  const repository = new PostgresCommunityRepository({ pool });
  const result = await repository.consumeAdmission({
    action: 'uploadBytes',
    subjectHash,
    idempotencyHash,
    cost: 12,
    limit: 20,
    windowMs: 60_000,
  });
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 8);
  assert.equal(released, true);
});
