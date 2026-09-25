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
