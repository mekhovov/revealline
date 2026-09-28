import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createDemoLibrary,
  createDemoIndexedDBStorage,
  demoRecordingQuality,
  DEMO_LIBRARY_LIMITS,
} from '../demo-library.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../replay.mjs';

const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const recording = await json('../demo-data/first-signal-left.replay.json'),
  campaign = await json('../content/campaign.json'),
  classRecipes = await json('../content/classes.json');
campaign.classRecipes = classRecipes;
const entry = { campaign, classRecipes };
function storage() {
  let document = null,
    writes = 0,
    failure = null;
  return {
    read: async () => structuredClone(document),
    update: async (transform) => {
      if (failure) throw failure;
      const next = transform(structuredClone(document));
      document = structuredClone(next);
      writes++;
      return structuredClone(document);
    },
    get writes() {
      return writes;
    },
    fail(error) {
      failure = error;
    },
  };
}
function withSeed(seed) {
  const options = { ...recording.options, seed },
    run = createRun(recording.level, options),
    recorder = createRecorder(recording.level, options);
  for (const segment of recording.segments)
    for (let tick = 0; tick < segment.ticks; tick++) {
      stepRun(run, segment.input, FIXED_DT);
      recordInput(recorder, segment.input);
    }
  return exportReplay(recorder, run);
}

test('manual retention does not opt into automatic collection; saved clips remain available after disabling', async () => {
  const adapter = storage(),
    library = createDemoLibrary({ storage: adapter });
  assert.deepEqual(await library.keep(recording, { entry, practice: false }), {
    saved: false,
    reason: 'disabled',
  });
  assert.equal(adapter.writes, 0);
  assert.equal(
    (await library.keep(recording, { entry, practice: false, manual: true })).saved,
    true,
  );
  assert.equal(library.enabled, false);
  assert.equal((await library.list([entry])).length, 1);
  library.setEnabled(true);
  assert.equal((await library.keep(recording, { entry, practice: false })).saved, true);
  library.setEnabled(false);
  assert.equal((await library.list([entry])).length, 1);
  assert.equal((await library.keep(recording, { entry, practice: false })).reason, 'disabled');
  await library.clear();
  assert.deepEqual(await library.list([entry]), []);
});

test('practice, incomplete, tampered and stale runs never enter the demo cache', async () => {
  const adapter = storage(),
    library = createDemoLibrary({ storage: adapter, enabled: true });
  assert.equal((await library.keep(recording, { entry })).reason, 'practice');
  assert.equal(
    (await library.keep(recording, { entry, practice: true, manual: true })).reason,
    'practice',
  );
  const unfinished = exportReplay(
    createRecorder(recording.level, recording.options),
    createRun(recording.level, recording.options),
  );
  assert.equal((await library.keep(unfinished, { entry, practice: false })).reason, 'unfinished');
  const tampered = structuredClone(recording);
  tampered.segments[0].input.direction = 'left';
  assert.equal((await library.keep(tampered, { entry, practice: false })).reason, 'verification');
  const stale = structuredClone(entry);
  stale.campaign.levels[0].rules.moveSpeed++;
  assert.equal(
    (await library.keep(recording, { entry: stale, practice: false })).reason,
    'incompatible',
  );
  assert.equal(adapter.writes, 0);
});

test('verified local recordings deduplicate, evict oldest beyond twelve, and are owned snapshots', async () => {
  const adapter = storage(),
    library = createDemoLibrary({ storage: adapter, enabled: true });
  for (let seed = 1; seed <= 13; seed++)
    assert.equal((await library.keep(withSeed(seed), { entry, practice: false })).saved, true);
  const records = await library.list([entry]);
  assert.equal(records.length, DEMO_LIBRARY_LIMITS.recordings);
  assert.equal(records[0].replay.options.seed, 13);
  assert.equal(records.at(-1).replay.options.seed, 2);
  records[0].replay.options.seed = 100;
  assert.equal((await library.list([entry]))[0].replay.options.seed, 13);
  await library.keep(withSeed(13), { entry, practice: false });
  assert.equal((await library.list([entry])).length, 12);
  const raw = await adapter.read();
  assert.ok(new TextEncoder().encode(JSON.stringify(raw)).byteLength <= DEMO_LIBRARY_LIMITS.bytes);
  assert.deepEqual(await library.list([]), []);
});

test('retention cancellation, opt-out during verification, and storage failure preserve prior bytes', async () => {
  const adapter = storage(),
    library = createDemoLibrary({ storage: adapter, enabled: true });
  await library.keep(recording, { entry, practice: false });
  const before = await adapter.read(),
    controller = new AbortController();
  const cancelled = library.keep(withSeed(2), {
    entry,
    practice: false,
    signal: controller.signal,
  });
  controller.abort();
  await assert.rejects(cancelled, { name: 'AbortError' });
  const pending = library.keep(withSeed(2), { entry, practice: false });
  library.setEnabled(false);
  await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual(await adapter.read(), before);
  adapter.fail(new Error('Quota exceeded'));
  await assert.rejects(
    library.keep(withSeed(2), { entry, practice: false, manual: true }),
    /Quota/,
  );
  assert.deepEqual(await adapter.read(), before);
});

test('quality filtering rejects long idle and short straight-line performances', () => {
  assert.equal(demoRecordingQuality(recording).eligible, true);
  const idle = structuredClone(recording);
  idle.segments.unshift({ ticks: 600, input: { direction: null } });
  idle.ticks += 600;
  assert.equal(demoRecordingQuality(idle).eligible, false);
  const straight = structuredClone(recording);
  straight.segments = [{ ticks: straight.ticks, input: { direction: 'down' } }];
  assert.equal(demoRecordingQuality(straight).eligible, false);
});

test('missing IndexedDB reports unavailable instead of touching another storage system', async () => {
  const adapter = createDemoIndexedDBStorage({ indexedDB: null });
  await assert.rejects(adapter.read(), /unavailable/);
  adapter.close();
  await assert.rejects(adapter.read(), /closed/);
});
