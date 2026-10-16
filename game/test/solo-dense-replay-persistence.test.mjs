import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  authoritativeCheckpoint,
  verifyReplayAsync,
  MAX_REPLAY_TICKS,
  MAX_REPLAY_BYTES,
} from '../replay.mjs';
import { campaignKey, emptyLibrary, exportLibrary } from '../library.mjs';
import { suspendSession, restoreSession, SESSION_STORAGE_BYTES } from '../sessions.mjs';
import {
  saveCaptureSession,
  snapshotCaptureSession,
  nativeCaptureSession,
  restoreCaptureSession,
} from '../capture-presentation-session.mjs';
import { memoryStorage, soloPage, settle } from './helpers/solo-dom.mjs';
import { activateHostAction } from './helpers/host-action.mjs';

// This is bounded Node correctness/stress evidence, not a native browser timing
// gate. Run each complete file serially under the qualification runner's outer
// 600-second/4-GiB process-group limits. No wall-time threshold is asserted.
const campaign = JSON.parse(await readFile(new URL('../content/campaign.json', import.meta.url)));
campaign.classRecipes = CLASSES;
const key = campaignKey(campaign);
const slot = 'revealline.suspended.dev.v1';
const profile = 'revealline.library.dev.v1';
const stamp = '2026-10-16T09:00:00.000Z';
const options = { seed: 1, turnPolicy: 'immediate', classId: 'scout', classRecipes: CLASSES };
const inputs = [{ direction: 'right' }, { direction: 'left' }];
const bytes = (text) => Buffer.byteLength(text, 'utf8');
const sha256 = (text) => createHash('sha256').update(text).digest('hex');

function flight() {
  const level = campaign.levels[0];
  return {
    run: createRun(level, options),
    recorder: createRecorder(level, options, 'dense-persistence-qualification'),
    campaignKey: key,
    themeId: 'fpv',
    bodyId: 'fpv-body',
    runId: 'dense-persistence-flight',
    savedAt: stamp,
    continuation: { direction: 'left' },
  };
}

function advanceDense(f, count) {
  const end = f.run.tick + count;
  assert(end <= MAX_REPLAY_TICKS, 'The fixture cannot exceed the real recording admission limit.');
  for (let index = 0; index < count; index++) {
    const input = inputs[f.run.tick % 2];
    stepRun(f.run, input, FIXED_DT);
    recordInput(f.recorder, input);
  }
  assert.equal(f.run.tick, end, 'Every bounded fixture step must advance the real simulation.');
  assert.equal(f.run.status, 'running');
  assert.equal(f.run.lives, 3);
  assert.equal(f.run.trail.length, 0, 'Alternating ordinary inputs remain on the safe top border.');
  assert.equal(
    f.recorder.segments.length,
    f.run.tick,
    'Every real tick has a distinct legal input.',
  );
}

function nearLocalLimit() {
  const f = flight();
  const base = bytes(JSON.stringify(suspendSession(f)));
  advanceDense(f, 2);
  // Derive a conservative size from the actual canonical segment shape. Leave
  // room for the current summary and the host's genuine presentation metadata.
  const pairBytes = f.recorder.segments.reduce(
    (sum, segment) => sum + bytes(JSON.stringify(segment)) + 1,
    0,
  );
  const target = 2 * Math.floor((SESSION_STORAGE_BYTES - base - 32 * 1024) / pairBytes);
  advanceDense(f, target - f.run.tick);
  return f;
}

function report(t, operation, started, detail = {}) {
  t.diagnostic(
    JSON.stringify({
      scope: 'node-correctness-and-stress-only',
      operation,
      elapsedMs: performance.now() - started,
      ...detail,
      memoryUsage: process.memoryUsage(),
    }),
  );
}

test(
  'dense valid local save survives the production serializer/readback/restore and refuses a larger valid save',
  { timeout: 180000 },
  async (t) => {
    const f = nearLocalLimit();
    const before = authoritativeCheckpoint(f.run);
    const started = performance.now();
    const session = suspendSession(f);
    const serialized = JSON.stringify(session);
    assert(bytes(serialized) > SESSION_STORAGE_BYTES * 0.95);
    assert(bytes(serialized) < SESSION_STORAGE_BYTES);
    const storage = memoryStorage();
    assert.equal(saveCaptureSession(storage, slot, session).ok, true);
    const readback = storage.getItem(slot);
    assert.equal(bytes(readback), bytes(serialized));
    assert.equal(
      sha256(readback),
      sha256(serialized),
      'The actual production save path writes the entire owned envelope.',
    );
    const checkedEnvelope = snapshotCaptureSession(readback);
    assert.deepEqual(nativeCaptureSession(checkedEnvelope).replay.checkpoint, before);
    const restored = await restoreCaptureSession(readback, { campaign, campaignKey: key });
    assert.deepEqual(authoritativeCheckpoint(restored.run), before);
    assert.equal(restored.recorder.segments.length, f.recorder.segments.length);
    assert.deepEqual(
      authoritativeCheckpoint(f.run),
      before,
      'Saving and verification cannot advance the live run.',
    );
    report(t, 'near-local-limit-save-readback-restore', started, {
      ticks: f.run.tick,
      segments: session.replay.segments.length,
      bytes: bytes(readback),
      sha256: sha256(readback),
    });

    advanceDense(f, 1024);
    const larger = suspendSession(f);
    assert(bytes(JSON.stringify(larger)) > SESSION_STORAGE_BYTES);
    const refused = saveCaptureSession(storage, slot, larger);
    assert.equal(refused.ok, false);
    assert.match(refused.warning, /local save budget/);
    assert.equal(
      sha256(storage.getItem(slot)),
      sha256(readback),
      'A valid oversized recording must preserve the previous full save.',
    );
    const after = authoritativeCheckpoint(f.run);
    const portable = await restoreSession(larger, { campaign, campaignKey: key });
    assert.deepEqual(
      authoritativeCheckpoint(portable.run),
      after,
      'Local refusal does not mean the portable recording is invalid.',
    );
    assert.deepEqual(authoritativeCheckpoint(f.run), after);
  },
);

test(
  'a maximally segmented admitted 216000-tick replay exports and verifies without invented padding',
  { timeout: 240000 },
  async (t) => {
    const f = flight();
    let started = performance.now();
    advanceDense(f, MAX_REPLAY_TICKS);
    report(t, 'construct-real-fixed-tick-inputs', started, { ticks: f.run.tick });
    const before = authoritativeCheckpoint(f.run);
    started = performance.now();
    const session = suspendSession(f);
    const replayText = JSON.stringify(session.replay);
    assert.equal(session.replay.ticks, MAX_REPLAY_TICKS);
    assert.equal(session.replay.segments.length, MAX_REPLAY_TICKS);
    assert(
      bytes(replayText) > SESSION_STORAGE_BYTES * 8,
      'This must exercise dense JSON, not a long single RLE segment.',
    );
    assert(bytes(replayText) <= MAX_REPLAY_BYTES, 'The unchanged native byte limit still applies.');
    report(t, 'max-segment-export-and-serialization', started, {
      ticks: session.replay.ticks,
      segments: session.replay.segments.length,
      replayBytes: bytes(replayText),
      replaySha256: sha256(replayText),
      byteLimit: MAX_REPLAY_BYTES,
    });
    let callbacks = 0,
      previous = 0,
      maxChunk = 0;
    started = performance.now();
    const restored = await restoreSession(JSON.stringify(session), {
      campaign,
      campaignKey: key,
      onProgress({ ticks }) {
        assert(ticks >= previous);
        maxChunk = Math.max(maxChunk, ticks - previous);
        previous = ticks;
        callbacks++;
      },
    });
    assert.equal(previous, MAX_REPLAY_TICKS);
    assert(callbacks >= Math.ceil(MAX_REPLAY_TICKS / 600));
    assert(maxChunk <= 600, 'Default verification must retain its existing per-chunk tick bound.');
    assert.deepEqual(authoritativeCheckpoint(restored.run), before);
    assert.deepEqual(authoritativeCheckpoint(f.run), before);
    assert.equal(restored.recorder.segments.length, MAX_REPLAY_TICKS);
    assert.throws(() => recordInput(f.recorder, inputs[0]), /30-minute recording budget/);
    assert.equal(
      f.recorder.ticks,
      MAX_REPLAY_TICKS,
      'Refusal cannot append an extra unrecorded tick.',
    );
    report(t, 'max-segment-portable-readback-and-verification', started, { callbacks, maxChunk });
  },
);

test(
  'public Continue and Save exercise the real host dense snapshot and post-write readback',
  { timeout: 180000 },
  async (t) => {
    const f = nearLocalLimit();
    const saved = suspendSession(f);
    const storage = memoryStorage({ [profile]: exportLibrary(emptyLibrary()) });
    assert.equal(saveCaptureSession(storage, slot, saved).ok, true);
    const page = await soloPage(t, { campaign, storage, titleScreen: true });
    await activateHostAction(page.$('shell-continue'));
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.frame(0); // Establish the actual monotonic resume clock, with no elapsed simulation.
    const checkpoint = authoritativeCheckpoint(page.rendered.run);
    assert.deepEqual(checkpoint, saved.replay.checkpoint);

    let writes = 0,
      readbacks = 0,
      latestWrite = null;
    const setItem = storage.setItem.bind(storage),
      getItem = storage.getItem.bind(storage);
    t.mock.method(storage, 'setItem', (name, value) => {
      setItem(name, value);
      if (name === slot) {
        writes++;
        latestWrite = String(value);
      }
    });
    t.mock.method(storage, 'getItem', (name) => {
      const value = getItem(name);
      if (name === slot && latestWrite !== null && value === latestWrite) readbacks++;
      return value;
    });
    const started = performance.now();
    await activateHostAction(page.$('save-attempt-button'));
    page.frame(0);
    assert(writes > 0, 'The public action must enter the actual app persistence path.');
    assert(
      readbacks >= writes,
      'Successful app writes must be read back, not inferred from setItem alone.',
    );
    assert.equal(page.rendered.paused, true);
    const raw = getItem(slot);
    const native = nativeCaptureSession(snapshotCaptureSession(raw));
    assert.equal(native.replay.segments.length, saved.replay.segments.length);
    assert.deepEqual(native.replay.checkpoint, checkpoint);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert(bytes(raw) > SESSION_STORAGE_BYTES * 0.95);
    assert(bytes(raw) <= SESSION_STORAGE_BYTES);
    report(t, 'public-host-save-and-readback', started, {
      writes,
      readbacks,
      bytes: bytes(raw),
      sha256: sha256(raw),
    });
    // The host adds genuine actor/picture pins. Their envelope is validated above;
    // replay proof does not pretend that this unit owns the installed media catalog.
    const restored = await verifyReplayAsync(native.replay);
    assert.equal(restored.match, true);
    assert.deepEqual(authoritativeCheckpoint(restored.state), checkpoint);
    assert.equal(
      page.errors.length,
      0,
      page.errors.map((error) => String(error).slice(0, 512)).join('\n'),
    );
  },
);
