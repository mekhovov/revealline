import assert from 'node:assert/strict';
import test from 'node:test';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  MAX_REPLAY_BYTES,
} from '../replay.mjs';
import { demoDescriptor } from '../demo-catalog.mjs';
import {
  createDemoIndexedDBStorage,
  createDemoLibrary,
  demoRecordingQuality,
  DEMO_LIBRARY_LIMITS,
} from '../demo-library.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const FORMAT = 'revealline-local-demos.v1';
const CREATED_AT = '2026-09-29T00:00:00.000Z';
const document = (items) => ({ format: FORMAT, items });
const bytes = (value) => Buffer.byteLength(JSON.stringify(value), 'utf8');

// A real winning run, without a downloaded fixture or simulated terminal state.
// The slow border circuit provides a legal, quality-eligible 179-second trace.
// Splitting RLE segments preserves every actual input/release and checkpoint;
// it adds no metadata, whitespace padding, post-terminal ticks, or fake inputs.
function winningRecording() {
  const level = {
    version: 'xonix-level.v1',
    id: 'cache-boundary',
    revision: '1',
    name: 'Рубеж — безпечний маршрут 🛰',
    width: 48,
    height: 36,
    spawn: { x: 24.5, y: 0.5 },
    goal: { coverage: 0.45 },
    rules: { moveSpeed: 1.11 },
    enemies: [{ id: 'sentinel', type: 'bouncer', x: 38.5, y: 25.5, vx: 0, vy: 0 }],
  };
  const run = createRun(level),
    recorder = createRecorder(level);
  for (const [direction, axis, destination, increasing] of [
    ['right', 'x', 47.5, true],
    ['down', 'y', 35.5, true],
    ['left', 'x', 0.5, false],
    ['up', 'y', 0.5, false],
    ['right', 'x', 24.5, true],
    ['down', 'y', 35.5, true],
  ]) {
    while (
      run.status === 'running' &&
      (increasing ? run.player[axis] < destination : run.player[axis] > destination)
    ) {
      assert.ok(run.tick < 180 * 120, 'The real route must complete within the quality budget.');
      const input = { direction };
      stepRun(run, input, FIXED_DT);
      recordInput(recorder, input);
    }
  }
  assert.equal(run.status, 'won');
  assert.equal(run.lives, 3);
  const replay = exportReplay(recorder, run);
  assert.equal(demoRecordingQuality(replay).eligible, true);
  return replay;
}

function expand(replay, splitTicks = replay.ticks) {
  const segments = [];
  for (const segment of replay.segments) {
    const split = Math.min(segment.ticks, splitTicks);
    for (let tick = 0; tick < split; tick++)
      segments.push({ ...segment, ticks: 1, releaseBefore: tick === 0 && segment.releaseBefore });
    if (split < segment.ticks)
      segments.push({
        ...segment,
        ticks: segment.ticks - split,
        releaseBefore: split === 0 && segment.releaseBefore,
      });
    splitTicks -= split;
  }
  return { ...replay, segments };
}

let fixture;
function recordings() {
  if (fixture) return fixture;
  const compact = winningRecording(),
    expanded = expand(compact),
    owners = Array.from({ length: 13 }, (_, index) => ({
      campaign: {
        id: `cache-owner-${String(index).padStart(2, '0')}`,
        revision: '1',
        levels: [compact.level],
        classRecipes: compact.options.classRecipes,
      },
    }));
  assert.equal(
    verifyReplay(expanded).match,
    true,
    'The expanded trace strictly reproduces the win.',
  );
  assert.ok(bytes(expanded) < MAX_REPLAY_BYTES);
  const expandedText = JSON.stringify(expanded),
    expandedIdentity = demoDescriptor(expanded, owners[0]).inputTraceIdentity;
  function item(owner, replayText = expandedText, inputTraceIdentity = expandedIdentity) {
    // Owner-specific identity is independent of RLE representation. Compute its
    // short descriptor once and substitute the separately verified trace ID.
    const descriptor = { ...demoDescriptor(compact, owner), inputTraceIdentity };
    return { id: descriptor.id, descriptor, replayText, createdAt: CREATED_AT };
  }
  const fullItems = owners.map((owner) => item(owner)),
    incoming = item(
      owners[11],
      JSON.stringify(compact),
      demoDescriptor(compact, owners[11]).inputTraceIdentity,
    ),
    // Eleven entries leave a slot free: the byte cap must cause the eviction.
    fixedItems = fullItems.slice(1, 11),
    fixedBytes = bytes(document(fixedItems)) + 1,
    target = DEMO_LIBRARY_LIMITS.bytes - bytes(incoming) - 1 + 128;
  let lower = 0,
    upper = compact.ticks;
  const withSplit = (ticks) => item(owners[0], JSON.stringify(expand(compact, ticks)));
  while (lower < upper) {
    const midpoint = Math.ceil((lower + upper) / 2);
    if (fixedBytes + bytes(withSplit(midpoint)) <= target) lower = midpoint;
    else upper = midpoint - 1;
  }
  const trimmed = expand(compact, lower);
  assert.equal(verifyReplay(trimmed).match, true);
  const nearBoundary = document([
    item(owners[0], JSON.stringify(trimmed), demoDescriptor(trimmed, owners[0]).inputTraceIdentity),
    ...fixedItems,
  ]);
  const candidate = document([incoming, ...nearBoundary.items]),
    candidateText = JSON.stringify(candidate);
  assert.equal(nearBoundary.items.length, DEMO_LIBRARY_LIMITS.recordings - 1);
  assert.ok(bytes(nearBoundary) <= DEMO_LIBRARY_LIMITS.bytes);
  assert.ok(DEMO_LIBRARY_LIMITS.bytes - bytes(nearBoundary) < 8192);
  assert.ok(Buffer.byteLength(candidateText, 'utf8') > DEMO_LIBRARY_LIMITS.bytes);
  assert.ok(
    candidateText.length < DEMO_LIBRARY_LIMITS.bytes,
    'This boundary distinguishes real UTF-8 bytes from JavaScript string length.',
  );
  fixture = {
    compact,
    expanded,
    owners,
    nearBoundary,
    fullItems,
    incoming,
    boundary: {
      limit: DEMO_LIBRARY_LIMITS.bytes,
      ticks: compact.ticks,
      replayBytes: bytes(expanded),
      initialBytes: bytes(nearBoundary),
      candidateBytes: Buffer.byteLength(candidateText, 'utf8'),
      candidateCodeUnits: candidateText.length,
    },
  };
  return fixture;
}

// Production adapter and admission, with only IndexedDB ordering/rollback modeled.
// This is not a browser disk-quota or physical-device durability qualification.
function environment() {
  const model = managedIndexedDB();
  const open = () => createDemoIndexedDBStorage({ indexedDB: model.indexedDB });
  return { model, open };
}

test('real UTF-8 bytes evict the oldest valid replay before the twelve-recording limit', async (t) => {
  const { compact, owners, nearBoundary, incoming, boundary } = recordings(),
    env = environment(),
    storage = env.open(),
    library = createDemoLibrary({ storage, now: () => CREATED_AT });
  try {
    await storage.update(() => nearBoundary);
    const result = await library.keep(compact, {
      entry: owners[11],
      practice: false,
      manual: true,
    });
    assert.deepEqual(result, { saved: true, count: 11 });
    const retained = await storage.read();
    assert.deepEqual(retained, document([incoming, ...nearBoundary.items.slice(0, -1)]));
    assert.ok(bytes(retained) <= DEMO_LIBRARY_LIMITS.bytes);
    assert.equal(env.model.allPuts.length, 2);
    t.diagnostic(JSON.stringify(boundary));
  } finally {
    library.dispose();
  }
});

test('one oversized library document of valid replays is rejected without any storage mutation', async () => {
  const { nearBoundary, fullItems, expanded } = recordings(),
    env = environment(),
    storage = env.open(),
    oversized = document(fullItems.slice(0, DEMO_LIBRARY_LIMITS.recordings));
  // Each real replay is below MAX_REPLAY_BYTES; the aggregate alone exceeds
  // 32 MiB. A padded/invalid oversized replay would only test its parser guard.
  assert.ok(bytes(expanded) < MAX_REPLAY_BYTES);
  assert.ok(bytes(oversized) > DEMO_LIBRARY_LIMITS.bytes);
  try {
    await storage.update(() => nearBoundary);
    const puts = env.model.allPuts.length;
    await assert.rejects(
      storage.update(() => oversized),
      /byte budget/i,
    );
    assert.equal(env.model.allPuts.length, puts, 'Rejected data never reaches objectStore.put.');
    assert.deepEqual(await storage.read(), nearBoundary, 'All previous replay bytes survive.');
  } finally {
    storage.close();
  }
});

test('concurrent production-library writers both survive and every commit obeys the byte cap', async () => {
  const { expanded, owners, nearBoundary, fullItems } = recordings(),
    env = environment(),
    firstStorage = env.open(),
    secondStorage = env.open(),
    first = createDemoLibrary({ storage: firstStorage, now: () => CREATED_AT }),
    second = createDemoLibrary({ storage: secondStorage, now: () => CREATED_AT }),
    commits = [];
  try {
    await firstStorage.update(() => nearBoundary);
    await secondStorage.read();
    env.model.afterAnyCommit = () => {
      const value = env.model.contents().get('library').get('current');
      commits.push({ bytes: bytes(value), ids: value.items.map((item) => item.id) });
    };
    const results = await Promise.all([
      first.keep(expanded, { entry: owners[11], practice: false, manual: true }),
      second.keep(expanded, { entry: owners[12], practice: false, manual: true }),
    ]);
    assert.deepEqual(results, [
      { saved: true, count: 11 },
      { saved: true, count: 11 },
    ]);
    assert.equal(commits.length, 2);
    assert.ok(commits.every((commit) => commit.bytes <= DEMO_LIBRARY_LIMITS.bytes));
    const retained = await secondStorage.read(),
      newIds = fullItems.slice(11).map((item) => item.id);
    assert.deepEqual(new Set(retained.items.slice(0, 2).map((item) => item.id)), new Set(newIds));
    assert.deepEqual(retained.items.slice(2), nearBoundary.items.slice(0, -2));
    assert.ok(commits[1].ids.includes(commits[0].ids[0]), 'The second writer preserves the first.');
    assert.ok(bytes(retained) <= DEMO_LIBRARY_LIMITS.bytes);
  } finally {
    first.dispose();
    second.dispose();
  }
  assert.equal(env.model.openCount, env.model.closed);
});
