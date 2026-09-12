import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRun, stepRun, releaseInputs, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createRecorder, recordInput, recordRelease, authoritativeCheckpoint } from '../replay.mjs';
import { restoreSession, suspendSession } from '../sessions.mjs';
import { campaignKey } from '../library.mjs';
import { retainFlightForFirstFlight } from '../ui/first-flight-entry.mjs';

const source = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
function fixture(turnPolicy = 'immediate') {
  const campaign = { ...structuredClone(source), classRecipes: structuredClone(CLASSES) };
  const options = { seed: 1, turnPolicy, classId: 'scout', classRecipes: campaign.classRecipes };
  const run = createRun(campaign.levels[0], options);
  const recorder = createRecorder(campaign.levels[0], options, 'course-entry-test');
  for (let i = 0; i < 180; i++) {
    const command = { direction: 'down' };
    stepRun(run, command, FIXED_DT);
    recordInput(recorder, command);
  }
  releaseInputs(run);
  recordRelease(recorder);
  const bytes = new Map();
  let writes = 0;
  const request = {
    run,
    recorder,
    campaign,
    campaignKey: campaignKey(campaign),
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'real-attempt-1',
    sessionKey: 'attempt',
    storage: {
      getItem: (key) => bytes.get(key) ?? null,
      setItem: (key, value) => {
        writes++;
        bytes.set(key, value);
      },
    },
    withStorageLock: async (work) => work(),
    assertCurrent() {},
    assertWritable() {},
  };
  function oldSlot() {
    const session = suspendSession({ ...request, savedAt: '2020-01-01T00:00:00.000Z' });
    bytes.set('attempt', JSON.stringify(session));
    return bytes.get('attempt');
  }
  return { request, bytes, oldSlot, writes: () => writes };
}

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`${turnPolicy}: retained live cut reconstructs exactly and leaves the original run paused`, async () => {
    const f = fixture(turnPolicy);
    const before = authoritativeCheckpoint(f.request.run);
    const result = await retainFlightForFirstFlight(f.request);
    assert.equal(f.writes(), 1);
    assert.deepEqual(authoritativeCheckpoint(f.request.run), before);
    assert.deepEqual(JSON.parse(f.bytes.get('attempt')), result.session);
    const restored = await restoreSession(result.session, f.request);
    assert.deepEqual(authoritativeCheckpoint(restored.run), before);
    assert.equal(restored.run.player.cutting, true);
    assert.equal(restored.run.player.speed, 0);
    assert.equal(restored.run.tick, 180);
  });

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`${turnPolicy}: an actual recovery is retained without advancing its remaining recovery time`, async () => {
    const f = fixture(turnPolicy);
    const command = { direction: 'up' };
    stepRun(f.request.run, command, FIXED_DT);
    recordInput(f.request.recorder, command);
    assert.equal(f.request.run.status, 'respawning');
    assert.equal(
      f.request.run.events.find((event) => event.type === 'player.failed').cause,
      'self-contact',
    );
    releaseInputs(f.request.run);
    recordRelease(f.request.recorder);
    const before = authoritativeCheckpoint(f.request.run);
    const result = await retainFlightForFirstFlight(f.request);
    const restored = await restoreSession(result.session, f.request);
    assert.equal(restored.run.status, 'respawning');
    assert.deepEqual(authoritativeCheckpoint(restored.run), before);
    assert.deepEqual(authoritativeCheckpoint(f.request.run), before);
  });

test('an encounter-version flight uses the same checked handoff without dropping encounter authority', async () => {
  const pack = JSON.parse(
    await readFile(new URL('../content/packs/sentinel-relay.json', import.meta.url)),
  );
  const campaign = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
  const f = fixture();
  const options = {
    seed: 1,
    turnPolicy: 'grid-center',
    classId: 'scout',
    classRecipes: campaign.classRecipes,
  };
  f.request.campaign = campaign;
  f.request.campaignKey = campaignKey(campaign);
  f.request.run = createRun(campaign.levels[0], options);
  f.request.recorder = createRecorder(campaign.levels[0], options, 'course-entry-test');
  for (let tick = 0; tick < 180; tick++) {
    stepRun(f.request.run, {}, FIXED_DT);
    recordInput(f.request.recorder, {});
  }
  const before = authoritativeCheckpoint(f.request.run);
  assert.equal(before.algorithm, 'fnv1a64-state-v3');
  assert.ok(f.request.run.encounter);
  const result = await retainFlightForFirstFlight(f.request);
  const restored = await restoreSession(result.session, f.request);
  assert.deepEqual(restored.run.encounter, f.request.run.encounter);
  assert.deepEqual(authoritativeCheckpoint(restored.run), before);
});

test('malformed or unsupported previous envelope is kept before snapshot or write', async () => {
  for (const previous of ['{', '{}', '{"format":"future-session"}']) {
    const f = fixture();
    f.bytes.set('attempt', previous);
    const before = authoritativeCheckpoint(f.request.run);
    await assert.rejects(retainFlightForFirstFlight(f.request), /existing saved flight/);
    assert.equal(f.bytes.get('attempt'), previous);
    assert.equal(f.writes(), 0);
    assert.deepEqual(authoritativeCheckpoint(f.request.run), before);
  }
});

test('quota failure preserves the old slot and never reports a retained flight', async () => {
  const f = fixture(),
    previous = f.oldSlot();
  f.request.storage.setItem = () => {
    throw new Error('quota');
  };
  await assert.rejects(retainFlightForFirstFlight(f.request), /Storage|storage|saved/i);
  assert.equal(f.bytes.get('attempt'), previous);
  assert.equal(f.request.run.tick, 180);
});

test('silent non-write and damaged readback reject even though saveSession returned ok', async () => {
  for (const damage of ['silent', 'malformed', 'different']) {
    const f = fixture();
    const previous = f.oldSlot();
    f.request.storage.setItem = (key, value) => {
      if (damage === 'malformed') f.bytes.set(key, '{}');
      if (damage === 'different') {
        const session = JSON.parse(value);
        session.savedAt = '2021-01-01T00:00:00.000Z';
        f.bytes.set(key, JSON.stringify(session));
      }
    };
    await assert.rejects(retainFlightForFirstFlight(f.request), /readback|read back/);
    if (damage === 'silent') assert.equal(f.bytes.get('attempt'), previous);
    assert.equal(f.request.run.tick, 180);
  }
});

test('cancellation at the final storage boundary leaves the previous slot untouched', async () => {
  const f = fixture(),
    previous = f.oldSlot(),
    cancellation = new AbortController();
  let locks = 0;
  f.request.signal = cancellation.signal;
  f.request.withStorageLock = async (work) => {
    if (++locks === 2) cancellation.abort();
    return work();
  };
  await assert.rejects(retainFlightForFirstFlight(f.request), { name: 'AbortError' });
  assert.equal(f.bytes.get('attempt'), previous);
  assert.equal(f.writes(), 0);
});

test('cancelling from the verifier progress callback cannot proceed to a storage write', async () => {
  const f = fixture(),
    previous = f.oldSlot(),
    cancellation = new AbortController();
  f.request.signal = cancellation.signal;
  f.request.onProgress = ({ ticks, total }) => {
    if (ticks === total) cancellation.abort();
  };
  await assert.rejects(retainFlightForFirstFlight(f.request), { name: 'AbortError' });
  assert.equal(f.bytes.get('attempt'), previous);
  assert.equal(f.writes(), 0);
});

test('changed run or externally replaced slot cannot be overwritten after verification', async () => {
  for (const change of ['run', 'slot']) {
    const f = fixture();
    f.oldSlot();
    let locks = 0;
    f.request.withStorageLock = async (work) => {
      if (++locks === 2) {
        if (change === 'run') stepRun(f.request.run, {}, FIXED_DT);
        else f.bytes.set('attempt', 'external replacement');
      }
      return work();
    };
    await assert.rejects(retainFlightForFirstFlight(f.request), /changed/);
    assert.equal(f.writes(), 0);
    if (change === 'slot') assert.equal(f.bytes.get('attempt'), 'external replacement');
  }
});

test('writer and recovery checks run again after asynchronous verification', async () => {
  const f = fixture();
  let checks = 0;
  f.request.assertWritable = () => {
    if (++checks === 2) throw new Error('Profile ownership expired');
  };
  await assert.rejects(retainFlightForFirstFlight(f.request), /ownership expired/);
  assert.equal(f.writes(), 0);
});

test('an unavailable recorder and a tampered recording preserve the stored attempt', async () => {
  for (const missing of [true, false]) {
    const f = fixture(),
      previous = f.oldSlot();
    if (missing) f.request.recorder = null;
    else f.request.recorder.segments[0].input.direction = 'right';
    await assert.rejects(retainFlightForFirstFlight(f.request));
    assert.equal(f.bytes.get('attempt'), previous);
    assert.equal(f.writes(), 0);
  }
});
