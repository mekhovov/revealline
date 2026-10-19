import test from 'node:test';
import assert from 'node:assert/strict';
import { captureFlightLimits, createFlightLimitNotices } from '../capture-flight-limits.mjs';
import { MAX_REPLAY_TICKS } from '../replay.mjs';
import { MAX_COLLECTION_TIME_SECONDS } from '../library.mjs';
import { FIXED_DT } from '../core/registry.mjs';

const view = (overrides = {}) =>
  captureFlightLimits({
    recordingTicks: 0,
    recordingStopped: false,
    elapsedSeconds: 0,
    collectionLimited: true,
    ...overrides,
  });

test('recording notices use the unchanged 30-minute budget and warn five minutes before it', () => {
  assert.equal(MAX_REPLAY_TICKS * FIXED_DT, 1800);
  const warningTick = MAX_REPLAY_TICKS - 300 / FIXED_DT;
  assert.equal(view({ recordingTicks: warningTick - 1 }).recording, 'available');
  assert.equal(view({ recordingTicks: warningTick }).recording, 'near');
  assert.equal(view({ recordingTicks: warningTick }).minutes, 5);
  assert.equal(view({ recordingTicks: MAX_REPLAY_TICKS - 1 }).minutes, 1);
  assert.equal(view({ recordingTicks: MAX_REPLAY_TICKS }).recording, 'full');
  assert.equal(view({ recordingTicks: MAX_REPLAY_TICKS }).minutes, 0);
});

test('missing or failed recording never advertises a current recoverable save', () => {
  for (const recordingTicks of [undefined, null, -1, NaN])
    assert.equal(view({ recordingTicks }).recording, 'unavailable');
  assert.equal(view({ recordingStopped: true }).recording, 'unavailable');
  assert.equal(view({ recordingTicks: undefined, elapsedSeconds: 1900 }).collection, 'within');
});

test('Classic collection remains within its existing boundary at exactly two hours', () => {
  assert.equal(MAX_COLLECTION_TIME_SECONDS, 7200);
  assert.equal(view({ elapsedSeconds: 6899 }).collection, 'within');
  assert.equal(view({ elapsedSeconds: 6900 }).collection, 'near');
  assert.equal(view({ elapsedSeconds: 7200 }).collection, 'near');
  assert.equal(view({ elapsedSeconds: 7200 + FIXED_DT }).collection, 'expired');
});

test('authored Journey progress does not inherit the Classic collection restriction', () => {
  const journey = view({
    collectionLimited: false,
    recordingStopped: true,
    recordingTicks: undefined,
    elapsedSeconds: 8000,
  });
  assert.equal(journey.collection, 'journey');
  assert.equal(journey.recording, 'unavailable');
});

test('advance and expiry notices repeat only for a different actual run', () => {
  const next = createFlightLimitNotices(),
    run = {},
    near = view({ recordingTicks: MAX_REPLAY_TICKS - 1 });
  assert.deepEqual(next(run, view()), []);
  assert.deepEqual(next(run, near), ['recordingWarning']);
  assert.deepEqual(next(run, near), []);
  assert.deepEqual(next(run, view({ recordingTicks: MAX_REPLAY_TICKS })), []);
  assert.deepEqual(next(run, view({ recordingStopped: true, elapsedSeconds: 6900 })), [
    'collectionWarning',
  ]);
  assert.deepEqual(next(run, view({ recordingStopped: true, elapsedSeconds: 7300 })), [
    'collectionExpired',
  ]);
  assert.deepEqual(next(run, view({ recordingStopped: true, elapsedSeconds: 7301 })), []);
  assert.deepEqual(next({}, near), ['recordingWarning']);
});
