import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  verifyReplayAsync,
  snapshotReplay,
  takeReplayMasteryObserver,
  authoritativeCheckpoint,
} from '../replay.mjs';
import { STEADY_SIGNAL, captureMasteryFacts } from '../mastery.mjs';
import {
  verifyMasteryRun,
  isVerifiedMasteryResult,
  verifiedMasteryRecord,
} from '../mastery-verification.mjs';
import { campaignKey, emptyLibrary, withMasteryRecords } from '../library.mjs';
import { createMasteryAwards } from '../mastery-awards.mjs';
import { masteryFor, masteryText, pictureMasteries } from '../ui/mastery-view.mjs';
import { stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const fixture = await json('./fixtures/compatibility-v060.json');
const reference = fixture.campaigns.find((item) => item.id === 'homeward-skies');
const pack = await json(`../../${reference.path}`);
const campaign = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
const key = campaignKey(campaign);
const entries = fixture.cases.filter(
  (item) => item.campaignId === campaign.id && item.level.id === 'homeward-01',
);
function replay(entry, part = entry) {
  return structuredClone({
    version: fixture.contracts.replayVersion,
    build: fixture.contracts.build,
    ruleset: fixture.contracts.ruleset,
    level: entry.level,
    options: { ...entry.options, classRecipes: fixture.roster.recipes },
    segments: part.segments,
    ticks: part.ticks,
    releaseAfter: part.releaseAfter,
    summary: part.summary,
    checkpoint: part.checkpoint,
  });
}
const request = (entry) => ({
  replay: replay(entry),
  campaign: structuredClone(campaign),
  definition: structuredClone(STEADY_SIGNAL),
  runId: 'mastery-test',
  earnedAt: '2026-09-12T12:00:00.000Z',
});
const observation = () => ({
  definition: STEADY_SIGNAL,
  campaignId: campaign.id,
  campaignKey: key,
  runId: 'mastery-test',
});

for (const entry of entries)
  test(`${entry.id}: optional observer preserves the old checkpoint and verified badge outcome`, async () => {
    const recorded = replay(entry),
      before = JSON.stringify(recorded);
    const plain = await verifyReplayAsync(recorded);
    assert.equal(Object.hasOwn(plain, 'masteryPreview'), false);
    assert.equal(takeReplayMasteryObserver(plain), null);
    const observed = await verifyReplayAsync(recorded, { mastery: observation() });
    assert.deepEqual(observed.actual, plain.actual);
    assert.deepEqual(authoritativeCheckpoint(observed.state), entry.checkpoint);
    assert.equal(observed.match, true);
    assert.equal(
      observed.masteryPreview.bestClosedCutCells,
      entry.options.classId === 'fiber' ? 22 : 0,
    );
    assert.equal(observed.masteryPreview.tick, entry.ticks);
    assert.equal(observed.masteryPreview.authority, 'preview-only');
    assert.equal(isVerifiedMasteryResult(observed), false);
    assert.throws(() => verifiedMasteryRecord(observed), /verification is required/);
    const result = await verifyMasteryRun(request(entry));
    assert.equal(isVerifiedMasteryResult(result), true);
    assert.ok(Object.isFrozen(result.preview.setup));
    assert.equal(result.qualified, entry.options.classId === 'fiber');
    const record = verifiedMasteryRecord(result);
    if (result.qualified) {
      assert.equal(record.campaignKey, key);
      assert.equal(record.setup.turnPolicy, entry.options.turnPolicy);
      assert.equal(record.definitionHash, 'mastery-v1-2e6aae3f42f3d3c2');
      assert.deepEqual(record.setup.classHistory, entry.summary.classHistory);
      record.runId = 'changed';
      assert.equal(verifiedMasteryRecord(result).runId, 'mastery-test');
    } else assert.equal(record, null);
    assert.equal(isVerifiedMasteryResult(structuredClone(result)), false);
    assert.throws(
      () => verifiedMasteryRecord(JSON.parse(JSON.stringify(result))),
      /verification is required/,
    );
    assert.equal(JSON.stringify(recorded), before);
  });

test('the award wrapper snapshots the replay, campaign and definition before yielding', async () => {
  const input = request(entries.find((entry) => entry.options.classId === 'fiber'));
  const pending = verifyMasteryRun(input, { chunkTicks: 1200 });
  input.replay.segments[0].input.direction = 'up';
  input.campaign.levels[0].name = 'changed';
  input.definition.all[1].minCells = 100;
  input.runId = 'changed';
  const result = await pending;
  assert.equal(result.qualified, true);
  assert.equal(result.runId, 'mastery-test');
  assert.equal(result.preview.definitionIdentity, 'mastery-v1-2e6aae3f42f3d3c2');
});

test('map, campaign, roster and definition mismatch cannot issue a verified record', async () => {
  const entry = entries.find((item) => item.options.classId === 'fiber');
  for (const alter of [
    (input) => {
      input.campaign.id = 'other';
    },
    (input) => {
      input.definition.levelId = 'homeward-02';
    },
    (input) => {
      input.campaign.levels[0].goal.coverage = 0.8;
    },
    (input) => {
      input.campaign.classRecipes[0].label = 'Changed recipe';
    },
    (input) => {
      input.replay.summary.score += 1;
    },
    (input) => {
      input.earnedAt = 'yesterday';
    },
  ]) {
    const input = request(entry);
    alter(input);
    await assert.rejects(verifyMasteryRun(input));
  }
  const input = request(entry);
  input.replay = replay(entry, entry.suspended);
  await assert.rejects(verifyMasteryRun(input), /completed winning attempt/);
});

test('cancellation before, during and on the final progress callback grants no result', async () => {
  const entry = entries.find((item) => item.options.classId === 'fiber');
  for (const at of ['before', 'during', 'final']) {
    const controller = new AbortController();
    if (at === 'before') controller.abort();
    let calls = 0;
    await assert.rejects(
      verifyMasteryRun(request(entry), {
        signal: controller.signal,
        chunkTicks: 120,
        onProgress: (value) => {
          calls++;
          if ((at === 'during' && value.ticks > 0) || (at === 'final' && value.fraction === 1))
            controller.abort();
        },
      }),
      { name: 'AbortError' },
    );
    if (at === 'before') assert.equal(calls, 0);
    else assert.ok(calls > 0);
  }
});

test('an unfinished old live cut reconstructs an observer that continues without changing its old result', async () => {
  const entry = entries.find(
    (item) => item.options.classId === 'fiber' && item.options.turnPolicy === 'grid-center',
  );
  const partial = await verifyReplayAsync(replay(entry, entry.suspended), {
    mastery: observation(),
  });
  assert.equal(partial.match, true);
  const observer = takeReplayMasteryObserver(partial);
  assert.ok(observer);
  assert.equal(takeReplayMasteryObserver(partial), null);
  assert.equal(takeReplayMasteryObserver(structuredClone(partial)), null);
  assert.ok(observer.snapshot().pendingCutCells > 0);
  let tick = 0;
  for (const segment of entry.segments) {
    if (segment.releaseBefore && tick >= entry.suspended.ticks) releaseInputs(partial.state);
    for (let n = 0; n < segment.ticks; n++) {
      if (tick++ < entry.suspended.ticks) continue;
      stepRun(partial.state, segment.input, FIXED_DT);
      observer.observe(captureMasteryFacts(partial.state, { runId: 'mastery-test' }));
    }
  }
  assert.equal(observer.snapshot().qualified, true);
  assert.deepEqual(authoritativeCheckpoint(partial.state), entry.checkpoint);
});

test('mismatched verification never releases a continuation observer', async () => {
  const recorded = replay(entries[0]);
  recorded.summary.score++;
  const result = await verifyReplayAsync(recorded, { mastery: observation() });
  assert.equal(result.match, false);
  assert.equal(takeReplayMasteryObserver(result), null);
});

test('the shared verifier honors cancellation on its final observation callback', async () => {
  const controller = new AbortController();
  await assert.rejects(
    verifyReplayAsync(replay(entries[0]), {
      mastery: observation(),
      signal: controller.signal,
      onProgress: ({ fraction }) => {
        if (fraction === 1) controller.abort();
      },
    }),
    { name: 'AbortError' },
  );
});

test('new structural snapshot is owned and cannot authorize an award', () => {
  const input = replay(entries[0]),
    copy = snapshotReplay(input);
  assert.deepEqual(copy, input);
  copy.summary.score++;
  assert.notDeepEqual(copy, input);
  assert.equal(isVerifiedMasteryResult(copy), false);
  let invoked = false;
  const invalid = { ...input };
  Object.defineProperty(invalid, 'summary', {
    enumerable: true,
    get() {
      invoked = true;
      return input.summary;
    },
  });
  assert.throws(() => snapshotReplay(invalid), /accessors/);
  assert.equal(invoked, false);
});

function host() {
  let library = emptyLibrary(),
    generation = 'profile-one',
    writes = 0,
    generationReads = 0;
  const statuses = [];
  const awards = createMasteryAwards({
    getGeneration: () => {
      generationReads++;
      return generation;
    },
    commit: (record) => {
      library = withMasteryRecords(library, [record]);
      writes++;
      return true;
    },
    onStatus: (status) => statuses.push(status),
  });
  return {
    awards,
    statuses,
    get library() {
      return library;
    },
    get writes() {
      return writes;
    },
    get generationReads() {
      return generationReads;
    },
    replace() {
      library = emptyLibrary();
      generation = 'profile-two';
    },
  };
}

test('host eligibility rejects practice and replay viewing without any write or check status', async () => {
  const app = host(),
    input = request(entries[0]);
  for (const eligibility of [undefined, false, 'true', 1]) {
    const result = await app.awards.submit(input, { eligible: eligibility });
    assert.equal(result.status, 'ineligible');
  }
  assert.equal(app.writes, 0);
  assert.deepEqual(app.statuses, []);
});

test('a verified live result persists independently of the next selected mission', async () => {
  const app = host();
  const result = await app.awards.submit(request(entries[0]), { eligible: true });
  assert.equal(result.status, 'earned');
  assert.equal(app.writes, 1);
  assert.equal(app.library.masteries.length, 1);
  assert.deepEqual(
    app.statuses.map((value) => value.status),
    ['checking', 'earned'],
  );
});

test('profile replacement and explicit import/Undo/page-exit cancellation prevent stale awards', async () => {
  for (const invalidate of [(app) => app.replace(), (app) => app.awards.cancelAll()]) {
    const app = host();
    const pending = app.awards.submit(request(entries[0]), { eligible: true });
    invalidate(app);
    assert.equal((await pending).status, 'cancelled');
    assert.equal(app.writes, 0);
    assert.equal(app.library.masteries.length, 0);
    assert.equal(app.statuses[0].status, 'checking');
    assert.ok(app.statuses.every((value) => ['checking', 'cancelled'].includes(value.status)));
  }
});

test('a nonqualifying clear and malformed recording cannot add a seal', async () => {
  const app = host(),
    input = request(entries.find((entry) => entry.options.classId === 'interceptor'));
  assert.equal((await app.awards.submit(input, { eligible: true })).status, 'unqualified');
  input.replay.summary.score++;
  assert.equal((await app.awards.submit(input, { eligible: true })).status, 'unavailable');
  assert.equal(app.writes, 0);
});

test('in-flight duplicate IDs and queue capacity cannot duplicate writes or start unbounded checks', async () => {
  const app = host(),
    input = request(entries[0]);
  const pending = [app.awards.submit(input, { eligible: true })];
  assert.equal((await app.awards.submit(input, { eligible: true })).status, 'pending');
  for (let n = 1; n < 4; n++)
    pending.push(app.awards.submit({ ...input, runId: `run-${n}` }, { eligible: true }));
  assert.equal(
    (await app.awards.submit({ ...input, runId: 'fifth' }, { eligible: true })).status,
    'unavailable',
  );
  app.awards.cancelAll();
  assert.ok((await Promise.all(pending)).every((value) => value.status === 'cancelled'));
  assert.equal(app.writes, 0);
});

test('storage failure retains an earned session seal and failed metadata commit reports unavailability', async () => {
  for (const fails of [false, true]) {
    const app = createMasteryAwards({
      getGeneration: () => 'same',
      commit: () => {
        if (fails) throw new Error('Collection is full');
        return false;
      },
    });
    const result = await app.submit(request(entries[0]), { eligible: true });
    assert.equal(result.status, fails ? 'unavailable' : 'session');
    assert.match(result.message, fails ? /Collection is full/ : /Export your library/);
  }
});

test('an accidental asynchronous persistence callback cannot announce a successful save', async () => {
  const statuses = [];
  const app = createMasteryAwards({
    getGeneration: () => 'same',
    commit: () => Promise.resolve(true),
    onStatus: (status) => statuses.push(status.status),
  });
  const result = await app.submit(request(entries[0]), { eligible: true });
  assert.equal(result.status, 'unavailable');
  assert.match(result.message, /synchronous boolean/);
  assert.deepEqual(statuses, ['checking', 'unavailable']);
});

test('optional goal text distinguishes open progress, safe credit, practice and lost-life attempts', async () => {
  assert.equal(masteryFor('other', STEADY_SIGNAL.levelId), null);
  const definition = masteryFor(key, 'homeward-01');
  assert.equal(definition, STEADY_SIGNAL);
  const text = masteryText(definition, {
    bestClosedCutCells: 3,
    pendingCutCells: 8,
    cleanSoFar: true,
  });
  assert.match(text, /3 \/ 8/);
  assert.match(text, /8 on your open line/);
  assert.match(masteryText(definition, { cleanSoFar: false }), /life lost; retry/);
  assert.match(masteryText(definition, { qualified: true }, { practice: true }), /^Practice goal/);
  const result = await verifyMasteryRun(request(entries[0]));
  const record = verifiedMasteryRecord(result);
  const seals = pictureMasteries(
    [record],
    { campaignKey: key, levelId: 'homeward-01' },
    definition,
  );
  assert.deepEqual(seals, [
    {
      name: 'Steady Signal',
      route: 'fiber',
      steering: 'Immediate',
      seed: 1,
      earnedAt: '2026-09-12T12:00:00.000Z',
    },
  ]);
  assert.equal(
    pictureMasteries([record], { campaignKey: 'other', levelId: 'homeward-01' }, definition).length,
    0,
  );
  assert.match(
    pictureMasteries(
      [record],
      { campaignKey: key, levelId: 'homeward-01' },
      { ...definition, revision: '2' },
    )[0].name,
    /^Archived seal/,
  );
});

async function verifiedWhileHeld(app) {
  const deadline = Date.now() + 10000;
  while (app.generationReads < 3 && Date.now() < deadline)
    await new Promise((resolve) => setTimeout(resolve, 5));
  assert.ok(app.generationReads >= 3, 'The genuine verifier reached the held commit boundary.');
  assert.equal(app.writes, 0);
}
for (const outcome of ['resume', 'cancel', 'generation changed'])
  test(`backup commit hold: ${outcome} preserves award ownership`, async () => {
    const app = host(),
      release = app.awards.holdCommits();
    const pending = app.awards.submit(request(entries[0]), { eligible: true });
    await verifiedWhileHeld(app);
    if (outcome === 'cancel') app.awards.cancelAll();
    if (outcome === 'generation changed') app.replace();
    release();
    release();
    assert.equal((await pending).status, outcome === 'resume' ? 'earned' : 'cancelled');
    assert.equal(app.writes, outcome === 'resume' ? 1 : 0);
  });
test('nested backup commit holds do not release another transaction or strand cancelled jobs', async () => {
  const app = host(),
    first = app.awards.holdCommits(),
    second = app.awards.holdCommits();
  const pending = app.awards.submit(request(entries[0]), { eligible: true });
  await verifiedWhileHeld(app);
  first();
  first();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(app.writes, 0);
  app.awards.cancelAll();
  assert.equal(
    (await pending).status,
    'cancelled',
    'Cancellation wakes a verifier even while another hold remains.',
  );
  second();
  assert.equal(app.writes, 0);
});
