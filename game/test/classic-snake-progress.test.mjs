// Authored under the repository's test waiver; not executed as a test suite.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dataIdentity } from '../data-json.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { JOURNEY_PROFILE_DATABASE } from '../profile-database.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import { classicSnakeUsesVariableHazards } from '../snake/classic-core.mjs';
import {
  createClassicSnakeMatch,
  exportClassicSnakeMatch,
  restoreClassicSnakeLegacyMatch,
} from '../snake/classic-match.mjs';
import { classicRecordKey, createClassicSnakeRecords } from '../snake/classic-records.mjs';

import { CLASSIC_SNAKE_OFFICIAL_RECORDS_KEY as key } from '../snake/classic-campaign.mjs';
const first = CLASSIC_SNAKE_LEVELS[0];
const replay = JSON.parse(
  await readFile(
    new URL(
      '../../docs/verification/classic-snake/authored-open-loop.replay.json',
      import.meta.url,
    ),
    'utf8',
  ),
);
const wonMatch = () =>
  restoreClassicSnakeLegacyMatch(
    { replays: [replay], mode: 'solo', elapsedMs: 18600 },
    { level: first.level },
  );
const context = (match, entry = first) => ({
  mode: match.options.mode,
  policy: match.options.policy,
  chapterId: entry.chapterId,
  level: entry.level,
  match: exportClassicSnakeMatch(match),
});
function recordsFor(t, model, options = {}) {
  const records = createClassicSnakeRecords({ indexedDB: model.indexedDB, ...options });
  t.after(() => records.close());
  return records;
}
async function seed(model, value, storageKey = key) {
  await new Promise((resolve, reject) => {
    const request = model.indexedDB.open(JOURNEY_PROFILE_DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore('profiles');
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction('profiles', 'readwrite');
      tx.objectStore('profiles').put(value, storageKey);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error);
      };
    };
  });
}

test('fresh official campaign leaves old and unrelated progress bytes untouched', async (t) => {
  const model = managedIndexedDB();
  const oldKey = 'classic-snake-progress.proof.v2';
  const old = { format: 'old-campaign', keep: ['original proof bytes'] };
  const other = { keep: ['another game mode'] };
  await seed(model, old, oldKey);
  await seed(model, other, 'another-mode');
  const records = recordsFor(t, model);
  await records.read();
  assert.equal(records.ratingScope, key);
  assert.deepEqual(records.snapshot().rows, {});
  const match = wonMatch();
  await records.remember(match.runs[0], context(match));
  const stored = model.contents().get('profiles');
  assert.deepEqual(stored.get(oldKey), old);
  assert.deepEqual(stored.get('another-mode'), other);
  assert.ok(Object.keys(stored.get(key).rows).length > 0);
});

test('score and survival duels never share their best-score bucket', () => {
  const level = prepareClassicSnakeLevel(first, { format: 'endless' });
  const score = createClassicSnakeMatch(level, { mode: 'versus', policy: 'score' });
  const survival = createClassicSnakeMatch(level, { mode: 'versus', policy: 'survival' });
  assert.equal(score.runs[0].levelIdentity, survival.runs[0].levelIdentity);
  assert.notEqual(
    classicRecordKey(score.runs[0], 'versus', 'score'),
    classicRecordKey(survival.runs[0], 'versus', 'survival'),
  );
});

test('a verified completed catalogue match restores clear and mastery with one shared witness', async (t) => {
  const model = managedIndexedDB(),
    records = recordsFor(t, model),
    match = wonMatch();
  await records.remember(match.runs[0], context(match));
  const row = records.get(match.runs[0], 'solo');
  assert.equal(row.clear, true);
  assert.equal(row.score, 800);
  assert.equal(row.fastest.value, 18600);
  assert.equal(row.fewest.value, 93);
  assert.equal(row.teamwork, false);
  assert.equal(Object.keys(Object.values(records.snapshot().rows)[0].proofs).length, 1);
  assert.equal('proofs' in row, false, 'per-frame HUD reads must not copy archived journals');
  const reload = recordsFor(t, model);
  await reload.read();
  assert.equal(reload.cleared(first.id), true);
  assert.equal(reload.chapter([first]), 1);
});

test('a caller cannot relabel a replay, forge its score, or substitute an easier same-ID recipe', async (t) => {
  const records = recordsFor(t, managedIndexedDB()),
    match = wonMatch(),
    forged = structuredClone(match.runs[0]);
  forged.score++;
  await assert.rejects(records.remember(forged, context(match)));
  await assert.rejects(records.remember(match.runs[0], { ...context(match), mode: 'team' }));
  await assert.rejects(
    records.remember(match.runs[0], {
      ...context(match),
      chapterId: CLASSIC_SNAKE_LEVELS[6].chapterId,
    }),
  );
  const easier = { ...structuredClone(first.level), goal: 1 };
  const different = createClassicSnakeMatch(easier, { mode: 'solo' });
  await assert.rejects(
    records.remember(different.runs[0], { ...context(different), level: easier }),
  );
  assert.deepEqual(records.snapshot().rows, {});
});

test('corrupt metrics and future records are preserved on disk instead of granting clears or being replaced', async (t) => {
  const sourceModel = managedIndexedDB(),
    source = recordsFor(t, sourceModel),
    match = wonMatch();
  await source.remember(match.runs[0], context(match));
  const corrupt = source.snapshot();
  Object.values(corrupt.rows)[0].score += 1000;
  for (const value of [
    corrupt,
    { format: 'classic-snake-progress.future', future: ['keep these bytes'] },
  ]) {
    const model = managedIndexedDB();
    await seed(model, value);
    model.allPuts.length = 0;
    let warnings = 0;
    const records = recordsFor(t, model, { onWarning: () => warnings++ });
    await records.read();
    assert.equal(records.cleared(first.id), false);
    await records.visit(first.id);
    assert.equal(model.allPuts.length, 0);
    assert.deepEqual(model.contents().get('profiles').get(key), value);
    assert.ok(warnings >= 1);
  }
});

test('independent tabs merge records, and a queued older read cannot erase a verified clear', async (t) => {
  const model = managedIndexedDB(),
    a = recordsFor(t, model),
    b = recordsFor(t, model);
  const firstMatch = wonMatch(),
    otherEntry = CLASSIC_SNAKE_LEVELS[1],
    other = createClassicSnakeMatch(otherEntry.level, { mode: 'solo' });
  const olderRead = a.read();
  await Promise.all([
    a.remember(firstMatch.runs[0], context(firstMatch)),
    b.remember(other.runs[0], context(other, otherEntry)),
    olderRead,
  ]);
  await a.read();
  assert.equal(Object.keys(a.snapshot().rows).length, 2);
  assert.equal(a.cleared(first.id), true);
  assert.equal(a.cleared(otherEntry.id), false);
});

test('a failed disk write remains visible and is retried before a later read can replace it', async (t) => {
  const model = managedIndexedDB(),
    records = recordsFor(t, model),
    match = wonMatch();
  model.failAnyPutAt = 1;
  await records.remember(match.runs[0], context(match));
  assert.equal(records.cleared(first.id), true);
  model.failAnyPutAt = null;
  await records.read();
  const reopened = recordsFor(t, model);
  await reopened.read();
  assert.equal(reopened.cleared(first.id), true);
  assert.equal(reopened.get(match.runs[0], 'solo').score, 800);
});

test('a delayed ordinary result retains its proof while demo ownership blocks writes and read retries', async (t) => {
  const model = managedIndexedDB(),
    pendingOpens = [];
  let ordinaryOwnsWrites = true;
  const records = recordsFor(t, model, {
    canWrite: () => ordinaryOwnsWrites,
    indexedDB: {
      open(...args) {
        return new Proxy(model.indexedDB.open(...args), {
          set(request, key, value) {
            request[key] =
              key === 'onsuccess' ? (event) => pendingOpens.push(() => value(event)) : value;
            return true;
          },
        });
      },
    },
  });
  const match = wonMatch();
  const saving = records.remember(match.runs[0], context(match));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pendingOpens.length, 1, 'The ordinary result was accepted before storage opened.');
  ordinaryOwnsWrites = false;
  pendingOpens.shift()();
  assert.equal((await saving).saved, false);
  assert.equal(records.cleared(first.id), true, 'The accepted result remains visible in memory.');
  const accepted = records.snapshot();
  await records.read();
  assert.equal(model.allPuts.length, 0, 'A focused demo cannot flush an older pending result.');
  assert.deepEqual(records.snapshot(), accepted);
  ordinaryOwnsWrites = true;
  await records.read();
  assert.deepEqual(model.allPuts, [['profiles', key]]);
  const reopened = recordsFor(t, model);
  await reopened.read();
  assert.deepEqual(
    reopened.snapshot(),
    accepted,
    'Ordinary ownership saves the exact retained proof.',
  );
});

test('a full catalogue profile stays verified across reads and updates, and discarded witnesses leave the cache', async (t) => {
  const model = managedIndexedDB(),
    source = recordsFor(t, model);
  for (const entry of CLASSIC_SNAKE_LEVELS) {
    const match = createClassicSnakeMatch(entry.level, {
      mode: 'solo',
      ...(classicSnakeUsesVariableHazards(entry.level) ? { hazardSeed: 17 } : {}),
    });
    await source.remember(match.runs[0], context(match, entry));
  }
  const notifications = [],
    reopened = recordsFor(t, model, { onChange: (value) => notifications.push(value) });
  await reopened.read();
  const cold = reopened.diagnostics();
  assert.equal(cold.verified, CLASSIC_SNAKE_LEVELS.length);
  assert.equal(cold.cachedProofs, CLASSIC_SNAKE_LEVELS.length);
  await reopened.read();
  await reopened.visit(first.id);
  assert.equal(reopened.diagnostics().verified, cold.verified);
  assert.ok(cold.cachedCharacters <= JSON.stringify(reopened.snapshot()).length);
  assert.deepEqual(Object.keys(notifications.at(-1)).sort(), ['lastPlayed', 'recordCount']);
  assert.equal(notifications.at(-1).recordCount, CLASSIC_SNAKE_LEVELS.length);
  notifications.at(-1).lastPlayed.levelId = 'foreign';
  assert.equal(reopened.recent().levelId, first.id);

  const reduced = reopened.snapshot();
  reduced.rows = Object.fromEntries(Object.entries(reduced.rows).slice(0, 2));
  await seed(model, reduced);
  await reopened.read();
  assert.equal(reopened.diagnostics().cachedProofs, 2);
  assert.equal(reopened.diagnostics().verified, cold.verified);
});

// Build independent valid zero-move witnesses without performing 2,048 growing
// database writes. read() below still verifies every resulting witness normally.
async function fullRowProfile(t, model) {
  const source = recordsFor(t, model),
    initial = createClassicSnakeMatch(first.level, { seed: 1 });
  await source.remember(initial.runs[0], context(initial));
  const template = Object.values(source.snapshot().rows)[0],
    profile = source.snapshot();
  profile.rows = {};
  for (let seed = 1000; seed < 3048; seed++) {
    const match = createClassicSnakeMatch(first.level, { seed }),
      witness = { match: exportClassicSnakeMatch(match), board: 0 },
      id = dataIdentity(witness),
      row = { ...template, seed, proofs: { [id]: witness }, scoreProof: id, catchesProof: id };
    profile.rows[classicRecordKey(match.runs[0], 'solo')] = row;
  }
  await seed(model, profile);
  return profile;
}

test('the actual 2048-row ceiling preserves existing proofs and returns a verified unsaved result without poisoning later reads', async (t) => {
  const model = managedIndexedDB(),
    before = await fullRowProfile(t, model),
    warnings = [],
    records = recordsFor(t, model, { onWarning: (error) => warnings.push(error.message) });
  await records.read();
  assert.equal(Object.keys(records.snapshot().rows).length, 2048);
  model.failAnyPutAt = 1;
  assert.deepEqual(await records.visit(first.id), { saved: false });
  const optimistic = records.snapshot();
  // The historic winning seed is outside the filled seed range.
  const match = wonMatch();
  assert.ok(!before.rows[classicRecordKey(match.runs[0], 'solo')]);
  const receipt = await records.remember(match.runs[0], context(match));
  assert.deepEqual(receipt, { verified: true, saved: false });
  assert.match(warnings.at(-1), /capacity/);
  assert.deepEqual(records.snapshot(), optimistic);
  // A full merge must also preserve the earlier failed-write queue.
  model.failAnyPutAt = null;
  await records.read();
  assert.deepEqual(records.snapshot(), optimistic);
  const reopened = recordsFor(t, model);
  await reopened.read();
  assert.deepEqual(reopened.snapshot().rows, before.rows);
  assert.equal(reopened.recent().levelId, first.id);
});

test('the actual 24 MiB serialized-profile boundary remains untouched while a new clear is verified for this session', async (t) => {
  const model = managedIndexedDB(),
    source = recordsFor(t, model),
    match = wonMatch();
  await source.remember(match.runs[0], context(match));
  // Valid JSON at the exact byte limit remains readable. Padding exercises the
  // real external byte boundary without synthesizing unverified proof content.
  const json = JSON.stringify(source.snapshot()),
    budget = 24 * 1024 * 1024,
    boundary = json + ' '.repeat(budget - Buffer.byteLength(json));
  await seed(model, boundary);
  const records = recordsFor(t, model);
  await records.read();
  assert.equal(records.cleared(first.id), true);
  const oversized = boundary + ' ';
  await seed(model, oversized);
  const writes = model.allPuts.length;
  const receipt = await records.remember(match.runs[0], context(match));
  assert.deepEqual(receipt, { verified: true, saved: false });
  assert.equal(records.cleared(first.id), true);
  assert.equal(model.allPuts.length, writes, 'oversized disk bytes were not replaced');
  // Restoring an ordinary valid snapshot permits the retained write to retry.
  await seed(model, source.snapshot());
  await records.read();
  const reopened = recordsFor(t, model);
  await reopened.read();
  assert.equal(reopened.cleared(first.id), true);
});

test('unavailable IndexedDB reports a verified unsaved clear and keeps the session record', async (t) => {
  const records = createClassicSnakeRecords({ indexedDB: null }),
    match = wonMatch();
  t.after(() => records.close());
  assert.deepEqual(await records.remember(match.runs[0], context(match)), {
    verified: true,
    saved: false,
  });
  assert.equal(records.cleared(first.id), true);
  await records.read();
  assert.equal(records.cleared(first.id), true);
});
