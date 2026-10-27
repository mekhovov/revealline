import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSimDemoAdapter, resolveSimDemoLaunch } from '../demo-modes/sim.mjs';
import { simDemoInventory } from '../../optional-practice/civilian-fpv/demo-inventory.mjs';
import {
  createSimDemoPlayer,
  createSimDemoPractice,
  verifySimDemo,
  simDemoMeaningfulProgress,
} from '../../optional-practice/civilian-fpv/demo-player.mjs';
import { decodeSimDemoPayload } from '../../optional-practice/civilian-fpv/demo-payload.mjs';
import { worldStateIdentity } from '../../optional-practice/civilian-fpv/world-model.mjs';

const dataRoot = new URL('../../optional-practice/civilian-fpv/demo-data/', import.meta.url);
const index = JSON.parse(await readFile(new URL('index.json', dataRoot), 'utf8'));
const inventory = simDemoInventory();
const readPayload = async (id, mode = 'self-level') => {
  const row = index.entries.find((item) => item.levelId === id && item.variantId === mode);
  return JSON.parse(await readFile(new URL(row.file, dataRoot), 'utf8'));
};
const beginner = inventory.find(
  (item) => item.levelId === 'beginner-01' && item.variantId === 'self-level',
);

test('SIM required inventory distinguishes exact revisions and covers every authored allowed variant', () => {
  assert.equal(new Set(inventory.map((item) => item.id)).size, inventory.length);
  for (const item of inventory)
    assert.ok(
      index.entries.some(
        (row) =>
          row.levelId === item.levelId &&
          row.variantId === item.variantId &&
          row.sourceIdentity === item.sourceIdentity,
      ),
      item.id,
    );
  const sameName = inventory.filter(
    (item) => item.levelId === 'native-pursuit-refuge-return' && item.variantId === 'acro',
  );
  assert.equal(new Set(sameName.map((item) => item.levelKey)).size, sameName.length);
  assert.ok(sameName.length > 1);
  for (const flag of ['freeFlight', 'regional', 'projectId', 'prototype'])
    assert.deepEqual(simDemoInventory([{ ...beginner.entry, [flag]: true }]), []);
});

test('SIM enumeration loads metadata only and identities match the native resolver', async () => {
  const reads = [];
  const adapter = createSimDemoAdapter({
    fetch: async (url) => {
      reads.push(url.pathname);
      return { ok: true, text: () => readFile(url, 'utf8') };
    },
  });
  const sources = await adapter.enumerateSources();
  assert.equal(reads.length, 1);
  assert.ok(reads[0].endsWith('/index.json'));
  assert.equal(new Set(sources.map((source) => source.id)).size, sources.length);
  assert.equal(sources.length, inventory.length);
  const source = sources.find(
    (source) => source.levelId === 'beginner-01' && source.variantId === 'self-level',
  );
  assert.ok(source.launchURL.includes('demo-course-identity='));
  const player = await source.create();
  try {
    assert.equal(reads.length, 2);
    assert.equal(player.phase, 'paused');
    assert.equal(player.state.ticks, 0);
  } finally {
    player.dispose();
  }
});

test('SIM Fresh URL resolves only an exact authored source and its admitted response', async () => {
  const options = { fetch: async (url) => ({ ok: true, text: () => readFile(url, 'utf8') }) };
  const sources = await createSimDemoAdapter(options).enumerateSources();
  const identities = new Set();
  for (const source of sources) {
    if (identities.has(source.responseIdentity)) continue;
    identities.add(source.responseIdentity);
    const resolved = await resolveSimDemoLaunch(source.launchURL, options);
    assert.equal(resolved.id, source.id);
    assert.deepEqual(resolved.demonstratedResponse, source.demonstratedResponse);
  }
  for (const key of [
    'demo-source',
    'demo-course',
    'demo-course-identity',
    'demo-flight-mode',
    'demo-response-identity',
  ]) {
    const url = new URL(sources[0].launchURL);
    url.searchParams.set(key, 'untrusted-or-stale');
    assert.equal(await resolveSimDemoLaunch(url, options), null, key);
  }
  assert.equal(await resolveSimDemoLaunch('https://example.test/', options), null);
});

test('SIM complete playback and takeover use the same exact native prefix without persistence', async () => {
  const payload = await readPayload('beginner-01');
  const player = await createSimDemoPlayer(beginner.entry, payload, {
    yieldControl: async () => {},
  });
  let practice;
  try {
    player.play();
    player.advance(0.2);
    player.pause();
    assert.equal(player.state.ticks, 10);
    const before = worldStateIdentity(player.state);
    const fork = await player.forkForPractice();
    practice = createSimDemoPractice(fork);
    assert.equal(worldStateIdentity(practice.state), before);
    const fresh = { roll: 0.1, pitch: 0.2, yaw: 0, throttle: 0.65, actions: 0 };
    practice.start({ input: fresh });
    practice.advance(0.02);
    assert.equal(practice.state.ticks, 11);
    assert.equal(practice.state.lastInput.throttle, 650);
    assert.equal(worldStateIdentity(player.state), before);
    practice.pause();
    practice.advance(0.1);
    assert.equal(practice.state.ticks, 11);
    player.play();
    while (player.phase !== 'complete') player.advance(0.25);
    assert.equal(player.state.status, 'complete');
    assert.equal(player.state.ticks, decodeSimDemoPayload(payload).frames.length);
  } finally {
    practice?.dispose();
    player.dispose();
  }
});

test('SIM admission rejects stale identity, invalid bodies and non-progressing performances', async () => {
  const payload = await readPayload('beginner-01');
  const stale = structuredClone(payload);
  stale.proof.courseIdentity = '0000000000000000';
  await assert.rejects(
    () => verifySimDemo(beginner.entry, stale),
    (error) => error.code === 'demo-content-mismatch' && /identity/.test(error.message),
  );
  assert.throws(
    () => decodeSimDemoPayload({ ...payload, framePack: { ...payload.framePack, count: 36001 } }),
    /frame pack/,
  );
  assert.throws(
    () => decodeSimDemoPayload({ ...payload, framePack: { ...payload.framePack, data: '' } }),
    /Truncated/,
  );
  assert.equal(simDemoMeaningfulProgress({ step: 0, hold: 1, actors: [] }), false);
  assert.equal(simDemoMeaningfulProgress({ step: 0, hunt: { caught: ['target'] } }), true);
});

test('SIM reports its first divergent diagnostic checkpoint without weakening full verification', async () => {
  const payload = await readPayload('beginner-01');
  payload.checkpoints = [{ tick: 1, stateIdentity: 'bad-checkpoint' }];
  const player = await createSimDemoPlayer(beginner.entry, payload, {
    yieldControl: async () => {},
  });
  try {
    player.play();
    assert.throws(
      () => player.advance(0.02),
      (error) => error.code === 'demo-content-mismatch' && error.tick === 1,
    );
  } finally {
    player.dispose();
  }
});

test('legacy Academy practice forwards only the four native axes', async () => {
  const required = inventory.find(
    (item) => item.levelId === 'flight-05' && item.variantId === 'self-level',
  );
  const player = await createSimDemoPlayer(required.entry, await readPayload('flight-05'));
  let practice;
  try {
    player.play();
    player.advance(0.2);
    player.pause();
    practice = createSimDemoPractice(await player.forkForPractice());
    practice.start({ input: { roll: 0.1, pitch: 0.2, yaw: 0, throttle: 0.65, actions: 1 } });
    practice.advance(0.02);
    assert.equal(practice.state.ticks, 11);
    assert.equal(practice.state.lastInput.throttle, 650);
    assert.equal(Object.hasOwn(practice.state.lastInput, 'actions'), false);
  } finally {
    practice?.dispose();
    player.dispose();
  }
});

test('missing SIM metadata is classified as unavailable without probing individual recordings', async () => {
  let reads = 0;
  const adapter = createSimDemoAdapter({
    fetch: async () => {
      reads++;
      return { ok: false, status: 404 };
    },
  });
  await assert.rejects(
    adapter.enumerateSources(),
    (error) => error.code === 'demo-mode-unavailable' && error.modeId === 'sim',
  );
  assert.equal(reads, 1);
});

test('SIM semantic captions retain identity while current and historical text follow locale', () => {
  let locale = 'en';
  const adapter = createSimDemoAdapter({ locale: () => locale });
  const [objective, target] = adapter.semanticEvents([
    { type: 'objective.completed', step: 2, total: 3 },
    { type: 'target.caught' },
  ]);
  assert.equal(objective.captionKey, 'sim:objective:2:3');
  assert.match(objective.captionText(), /Objective completed/);
  assert.equal(target.caption, target.captionText());
  locale = 'uk';
  assert.equal(objective.captionKey, 'sim:objective:2:3');
  assert.match(objective.captionText(), /Ціль виконано/);
  assert.match(target.captionText(), /Ціль спіймано/);
});

test('SIM full verification failures diagnose the first mismatching checkpoint and remain rejected', async () => {
  const payload = await readPayload('beginner-01');
  const packed = Buffer.from(payload.framePack.data, 'base64');
  assert.equal(packed[0], 0);
  packed[0] = 80; // A real changed roll input, with the original native proof untouched.
  payload.framePack.data = packed.toString('base64');
  await assert.rejects(
    () => verifySimDemo(beginner.entry, payload, { yieldControl: async () => {} }),
    (error) =>
      error.code === 'demo-content-mismatch' &&
      error.firstMismatchingCheckpointTick === payload.checkpoints[0].tick &&
      /first mismatching checkpoint/.test(error.message),
  );
});
