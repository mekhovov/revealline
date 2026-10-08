import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createOverflightHuntRecords,
  OVERFLIGHT_HUNT_RECORDS_FORMAT,
} from '../overflight/raid-records.mjs';
import { overflightHuntLaunchURL } from '../fpv-entry.mjs';
import { createOverflightAudio } from '../overflight/audio.mjs';
import { createOverflightCommentator } from '../overflight/commentator.mjs';

const run = (patch = {}) => ({
  compiled: { format: 'OverflightHuntCompiledV1', projectIdentity: '1234567890abcdef' },
  seed: 41,
  airframes: 3,
  slowResume: true,
  phase: 'won',
  time: 200,
  hunt: { score: 1000, bestChain: 20, couriersCaught: 1, couriersEscaped: 0 },
  stats: { kills: 70, damageTaken: 20 },
  ...patch,
});
function memory() {
  let state = { format: OVERFLIGHT_HUNT_RECORDS_FORMAT, entries: {} };
  return {
    fail: false,
    async read() {
      if (this.fail) throw new Error('Unavailable');
      return structuredClone(state);
    },
    async update(fn) {
      if (this.fail) throw new Error('Unavailable');
      state = fn(structuredClone(state));
      return structuredClone(state);
    },
    close() {},
  };
}
test('Raid records keep score and fastest successful clear independent', async () => {
  const records = createOverflightHuntRecords({ backend: memory() });
  await records.record(run());
  const fast = run({ time: 120 });
  fast.hunt.score = 300;
  await records.record(fast);
  const failed = run({ phase: 'lost', time: 80 });
  failed.hunt.score = 1500;
  const result = await records.record(failed);
  assert.equal(result.fastestClear.time, 120);
  assert.equal(result.bestScore.score, 1500);
  assert.equal(result.bestScore.outcome, 'lost');
  assert.equal(result.last.outcome, 'lost');
  assert.equal(result.durable, true);
});
test('record identity separates content, seed and gameplay settings but shares cosmetics', async () => {
  const records = createOverflightHuntRecords({ backend: memory() });
  await records.record(run());
  for (const patch of [
    { seed: 42 },
    { airframes: 1 },
    { slowResume: false },
    { compiled: { format: 'OverflightHuntCompiledV1', projectIdentity: 'abcdef1234567890' } },
  ])
    assert.equal((await records.read(run(patch))).bestScore, null);
  assert.equal(
    (await records.read(run({ characterId: 'different', quality: 'reduced' }))).bestScore.score,
    1000,
  );
});
test('storage failure is session-only and can recover without losing the previous record', async () => {
  const backend = memory(),
    records = createOverflightHuntRecords({ backend });
  await records.record(run());
  backend.fail = true;
  const fast = run({ time: 120 });
  fast.hunt.score = 200;
  const failedSave = await records.record(fast);
  assert.equal(failedSave.durable, false);
  assert.match(failedSave.error, /Unavailable/);
  backend.fail = false;
  const saved = await records.record(fast);
  assert.equal(saved.fastestClear.time, 120);
  assert.equal(saved.bestScore.score, 1000);
  assert.equal(saved.durable, true);
});
test('nonterminal, nonfinite and review attempts cannot set records', async () => {
  const records = createOverflightHuntRecords({ backend: memory() });
  for (const patch of [
    { phase: 'playing' },
    { time: NaN },
    { fixture: 'reference' },
    { review: true },
  ])
    await assert.rejects(records.record(run(patch)));
  assert.equal((await records.read(run())).bestScore, null);
  records.dispose();
  await assert.rejects(records.read(run()), /closed/);
});
test('failed writes preserve stronger durable records in session results and later reads', async () => {
  const backend = memory();
  await createOverflightHuntRecords({ backend }).record(run({ time: 100 }));
  const records = createOverflightHuntRecords({ backend });
  backend.update = async (fn) => {
    fn(await backend.read());
    throw new Error('Quota');
  };
  const slower = run({ time: 120 });
  slower.hunt.score = 200;
  for (const result of [await records.record(slower), await records.read(slower)]) {
    assert.equal(result.bestScore.score, 1000);
    assert.equal(result.fastestClear.time, 100);
    assert.equal(result.last.score, 200);
    assert.equal(result.durable, false);
  }
  backend.fail = true;
  const unavailable = await records.read(slower);
  assert.equal(unavailable.bestScore.score, 1000);
  assert.equal(unavailable.fastestClear.time, 100);
});
test('Raid launch preserves same-build locale and artwork, rejects unknown paths', () => {
  const href = overflightHuntLaunchURL(
    'https://example.test/build/game/overflight/play.html?seed=2',
    'uk',
  );
  assert.equal(href, 'https://example.test/build/game/overflight/raid.html?lang=uk');
  assert.equal(overflightHuntLaunchURL('javascript:alert(1)'), null);
  assert.equal(overflightHuntLaunchURL('https://example.test/unrelated/'), null);
  assert.ok(overflightHuntLaunchURL('https://example.test/game/studio/raid.html'));
});
test('Raid cues are distinct, spatial, bounded per tick and use shared destruction setting', () => {
  const heard = [];
  const audio = createOverflightAudio(
    { encounter: (cue, options) => heard.push({ cue, options }) },
    { getDestruction: () => ({ brutal: true }) },
  );
  const state = {
    tick: 1,
    phase: 'playing',
    player: { x: 100 },
    events: ['hunt-kill', 'hunt-kill', 'hunt-blocked', 'armor-break', 'rush-ready', 'rush'].map(
      (type) => ({ type, x: 200 }),
    ),
  };
  audio.update(state);
  audio.update(state);
  assert.deepEqual(
    heard.map((entry) => entry.cue),
    ['catch', 'blocked', 'reel', 'notice', 'pulse'],
  );
  assert.ok(heard.every((entry) => entry.options.brutal && entry.options.pan > 0));
});
test('Raid commentator never promises salvage on the ground and only announces first earned Rush', () => {
  const events = [];
  const commentator = createOverflightCommentator({
    reactions: {
      reset() {},
      events: (rows) => events.push(...rows),
      result() {},
    },
  });
  const state = run({ tick: 1, phase: 'playing', player: { hull: 100, maxHull: 100 }, events: [] });
  commentator.reset(state);
  state.tick++;
  state.stats.kills += 18;
  state.events = [{ type: 'rush-ready' }];
  commentator.update(state);
  state.tick++;
  commentator.update(state);
  assert.deepEqual(
    events.map((event) => event.type),
    ['overflight.hunt-cleared', 'overflight.hunt-rush'],
  );
});
