import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightRecords,
  OVERFLIGHT_RECORDS_FORMAT,
  validateOverflightRecords,
  overflightRecordContext,
} from '../overflight/records.mjs';
import { dataIdentity } from '../data-json.mjs';
const run = (patch = {}) => ({
  compiled: {
    format: 'OverflightCompiledV3',
    projectIdentity: '1234567890abcdef',
    balanceRevision: 'overflight-balance.v3',
  },
  seed: 17,
  difficulty: 'standard',
  airframes: 3,
  slowResume: true,
  phase: 'won',
  time: 320,
  stats: {
    kills: 1300,
    damageTaken: 60,
    airframesLost: 0,
    damageCauses: { contact: 20, lane: 40, fan: 0, ground: 0 },
  },
  progression: { history: [{ id: 'primary:double:4' }] },
  ...patch,
});
function memory() {
  let state = { format: OVERFLIGHT_RECORDS_FORMAT, entries: {} };
  return {
    fail: false,
    read: async function () {
      if (this.fail) throw new Error('Offline storage unavailable');
      return structuredClone(state);
    },
    update: async function (fn) {
      if (this.fail) throw new Error('Offline storage unavailable');
      state = fn(structuredClone(state));
      return structuredClone(state);
    },
  };
}

test('record retention preserves the current result within the existing aggregate byte budget', async () => {
  const backend = memory(),
    records = createOverflightRecords({ backend });
  const large = run({
    progression: {
      history: Array.from({ length: 32 }, (_, index) => ({ id: `${index}:${'x'.repeat(96)}` })),
    },
  });
  const template = await records.record(large);
  const entries = {};
  let count = 0;
  for (let seed = 1000; seed < 1256; seed++) {
    const context = overflightRecordContext({ ...large, seed }),
      key = dataIdentity(context);
    entries[key] = {
      context,
      last: template.last,
      bestScore: template.bestScore,
      fastestClear: template.fastestClear,
    };
    try {
      validateOverflightRecords({ format: OVERFLIGHT_RECORDS_FORMAT, entries });
      count++;
    } catch {
      delete entries[key];
      break;
    }
  }
  assert.ok(
    count > 10 && count < 256,
    'This profile reaches the byte budget before the count limit.',
  );
  await backend.update(() => ({ format: OVERFLIGHT_RECORDS_FORMAT, entries }));
  const saved = await records.record(large);
  assert.equal(saved.durable, true);
  assert.equal(saved.last.outcome, 'won');
  const state = validateOverflightRecords(await backend.read());
  assert.equal(Object.keys(state.entries).length, count);
  assert.deepEqual(state.entries[dataIdentity(overflightRecordContext(large))].last, template.last);
  records.dispose();
});
test('Survivor records separate fastest victories, most cleared, failure details and chosen branches', async () => {
  const records = createOverflightRecords({ backend: memory() });
  await records.record(run());
  await records.record(run({ time: 280, stats: { ...run().stats, kills: 800 } }));
  const result = await records.record(
    run({ phase: 'lost', time: 340, stats: { ...run().stats, kills: 2000 } }),
  );
  assert.equal(result.fastestClear.time, 280);
  assert.equal(result.bestScore.kills, 2000);
  assert.equal(result.last.outcome, 'lost');
  assert.deepEqual(result.last.upgrades, ['primary:double:4']);
  assert.deepEqual(result.last.damageCauses, run().stats.damageCauses);
  assert.equal(result.durable, true);
});
test('mode, authored identity, balance, seed, difficulty, flight and assistance partition records; cosmetics do not', async () => {
  const records = createOverflightRecords({ backend: memory() });
  await records.record(run());
  const base = run();
  for (const patch of [
    { compiled: { ...base.compiled, riy: {} } },
    { compiled: { ...base.compiled, projectIdentity: 'abcdef1234567890' } },
    {
      compiled: {
        ...base.compiled,
        format: 'OverflightCompiledV2',
        balanceRevision: 'overflight-balance.v2',
      },
    },
    { seed: 18 },
    { difficulty: 'relaxed' },
    { difficulty: 'veteran' },
    { airframes: 1 },
    { slowResume: false },
    { flight: { id: 'swift', speed: 210 } },
  ])
    assert.equal((await records.read(run(patch))).bestScore, null, JSON.stringify(patch));
  assert.equal(
    (await records.read(run({ quality: 'reduced', characterId: 'racer', gore: false }))).bestScore
      .kills,
    1300,
  );
});
test('storage failures retain session achievements and recover without dropping a stronger record', async () => {
  const backend = memory(),
    records = createOverflightRecords({ backend });
  await records.record(run());
  backend.fail = true;
  const next = run({ time: 280, stats: { ...run().stats, kills: 800 } });
  assert.equal((await records.record(next)).durable, false);
  const session = await records.read(next);
  assert.equal(session.fastestClear.time, 280);
  assert.equal(session.bestScore.kills, 1300);
  backend.fail = false;
  const saved = await records.record(next);
  assert.equal(saved.durable, true);
  assert.equal(saved.bestScore.kills, 1300);
  assert.equal(saved.fastestClear.time, 280);
});
test('record captures result before asynchronous profile access or retry changes the run', async () => {
  const backend = memory();
  const read = backend.read.bind(backend);
  let release;
  backend.read = async () => {
    await new Promise((resolve) => {
      release = resolve;
    });
    return read();
  };
  const records = createOverflightRecords({ backend });
  const current = run(),
    saving = records.record(current);
  current.time = 0;
  current.stats.kills = 0;
  current.progression.history.length = 0;
  release();
  const result = await saving;
  assert.equal(result.last.time, 320);
  assert.equal(result.last.kills, 1300);
  assert.deepEqual(result.last.upgrades, ['primary:double:4']);
});
test('invalid and review results cannot overwrite records; disposal closes access', async () => {
  const records = createOverflightRecords({ backend: memory() });
  for (const patch of [
    { phase: 'playing' },
    { time: NaN },
    { fixture: 'reference' },
    { review: true },
  ])
    await assert.rejects(records.record(run(patch)));
  assert.equal((await records.read(run())).last, null);
  assert.throws(() =>
    validateOverflightRecords({
      format: OVERFLIGHT_RECORDS_FORMAT,
      entries: { malicious: {} },
    }),
  );
  records.dispose();
  await assert.rejects(records.read(run()), /closed/);
});
