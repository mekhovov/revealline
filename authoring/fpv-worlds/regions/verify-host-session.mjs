import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  loadRegionalReview,
  regionalReviewEntry,
  regionalLibraryEntry,
  regionalStartingPoint,
  createRegionalSession,
  regionalPreparationFeedback,
} from '../../../optional-practice/civilian-fpv/regional-session.mjs';

const root = path.resolve(
  process.argv[2] ?? '/Volumes/alex/CodexMigrationStaging/fpv-large-worlds-20261014/urban-mixed-r2',
);
let failures = false;
const fetchImpl = async (url, { signal } = {}) => {
  signal?.throwIfAborted();
  if (failures && !String(url).endsWith('region.json')) throw new Error('Injected source outage');
  const file = path.resolve(root, '.' + new URL(url).pathname);
  assert.ok(file.startsWith(root + path.sep));
  return new Response(await readFile(file));
};
const options = {
  manifestURL: '/terrain/region.json',
  sceneryURL: '/scenery/region.json',
  pageURL: 'https://review.example/sim',
  fetchImpl,
};
const configuration = await loadRegionalReview(options);
const entry = regionalReviewEntry(configuration);
const installedEntry = regionalLibraryEntry(configuration, { sha256: 'a'.repeat(64) });
assert.equal(installedEntry.regionalReview, false);
assert.equal(installedEntry.packIdentity, `regional-installed:${'a'.repeat(64)}`);
assert.equal(installedEntry.course.steps.acro.length, 0);
assert.match(installedEntry.course.locales.en.brief, /saved on this device/);
assert.throws(() => regionalLibraryEntry(configuration), /identity is required/);
assert.equal(entry.course.format, 'FPVRegionalFlightPresentation.v1');
assert.equal(entry.course.locales.en.title, configuration.manifest.title.en);
assert.equal(entry.freeFlight, true);
assert.equal(entry.course.steps.acro.length, 0);
await assert.rejects(
  loadRegionalReview({ ...options, manifestURL: 'https://elsewhere.example/region.json' }),
  /on this site/,
);
await assert.rejects(
  loadRegionalReview({ ...options, manifestURL: 'file:///region.json' }),
  /on this site/,
);
const abort = new AbortController();
abort.abort();
await assert.rejects(loadRegionalReview({ ...options, signal: abort.signal }), {
  name: 'AbortError',
});
const failedSession = createRegionalSession(configuration);
failures = true;
await assert.rejects(failedSession.prepare(), /outage/);
assert.equal(failedSession.arm(), false);
assert.equal(failedSession.snapshot().ticks, 0);
failures = false;
await failedSession.prepare();
assert.equal(failedSession.snapshot().status, 'paused');
assert.equal(failedSession.snapshot().ticks, 0);
await failedSession.dispose();
for (const mode of ['self-level', 'acro']) {
  const session = createRegionalSession({
    ...configuration,
    mode,
    initialHeading: 'region-centre',
  });
  assert.equal(session.arm(), false);
  assert.equal(session.snapshot().ticks, 0);
  await session.prepare();
  assert.equal(session.snapshot().status, 'paused');
  assert.equal(session.snapshot().unscored, true);
  assert.equal(session.snapshot().playerReady, false);
  assert.equal(session.identity, undefined);
  assert.equal(session.arm(), true);
  for (let i = 0; i < 80; i++)
    session.step({ roll: 0, pitch: 0, yaw: 0, throttle: 0.6, actions: 1 });
  assert.equal(session.snapshot().ticks, 80);
  assert.equal(session.snapshot().lastInput.throttle, 600);
  assert.deepEqual(session.snapshot().events, []);
  assert.equal(session.snapshot().attitude.roll, 0);
  session.pause();
  const held = session.snapshot();
  session.step({ roll: 1, pitch: 1, yaw: 1, throttle: 1 });
  assert.deepEqual(session.snapshot(), held);
  session.cancelPreparation();
  assert.equal(session.arm(), false);
  failures = true;
  // An unchanged verified window can reuse its bytes; cancellation must still keep it paused.
  await session.prepare().catch(() => {});
  assert.equal(session.snapshot().status, 'paused');
  failures = false;
  await session.prepare();
  assert.deepEqual(session.snapshot().position, held.position);
  assert.deepEqual(session.snapshot().velocity, held.velocity);
  assert.deepEqual(session.snapshot().orientation, held.orientation);
  assert.equal(session.snapshot().ticks, 80);
  await session.dispose();
  assert.equal(session.root.children.length, 0);
}
assert.throws(() => regionalStartingPoint(installedEntry, 'not-an-authored-start'), /Unknown/);
assert.throws(
  () => regionalStartingPoint({ ...installedEntry, regional: false }, 'mill-court'),
  /regional/,
);
for (const spawn of configuration.manifest.spawns) {
  const selected = regionalStartingPoint(installedEntry, spawn.id);
  assert.equal(installedEntry.configuration.spawnId, undefined);
  assert.equal(selected.packIdentity, installedEntry.packIdentity);
  assert.equal(selected.configuration.spawnId, spawn.id);
  const session = createRegionalSession({ ...selected.configuration, mode: 'acro' });
  await session.prepare();
  assert.deepEqual(session.snapshot().position, spawn.position);
  assert.equal(session.snapshot().status, 'paused');
  assert.equal(session.snapshot().ticks, 0);
  assert.equal(session.snapshot().lastInput.throttle, 0);
  await session.dispose();
}
console.log(
  'PASS regional production session: real mixed assets; both modes; paused launch/retry/cancel; input adapter; disposal; source boundary; authored starting points and invalid-ID rejection',
);

// A verified source can still fail during rendering. Keep it disarmed and
// distinguish this from source loss or an invalid saved restore location.
let graphicsFailure = true;
const graphicsSession = createRegionalSession({
  ...configuration,
  prepareFrame: async () => {
    if (graphicsFailure) throw new DOMException('Fixture graphics deadline', 'TimeoutError');
  },
});
await assert.rejects(graphicsSession.prepare(), { name: 'TimeoutError' });
assert.equal(graphicsSession.snapshot().status, 'paused');
assert.equal(graphicsSession.snapshot().ticks, 0);
assert.equal(graphicsSession.arm(), false);
const graphicsFeedback = regionalPreparationFeedback({
  stage: 'graphics',
  error: new DOMException('Driver detail', 'TimeoutError'),
  savedStart: true,
});
assert.equal(graphicsFeedback.kind, 'graphics-timeout');
assert.equal(graphicsFeedback.restoreUnavailable, false);
assert.match(graphicsFeedback.en, /Performance graphics and Retry/);
assert.match(graphicsFeedback.uk, /Швидкодія/);
assert.doesNotMatch(graphicsFeedback.en, /Driver detail|place unavailable|Area unavailable/);
assert.equal(
  regionalPreparationFeedback({
    stage: 'graphics',
    timedOut: true,
    error: new DOMException('Generic cancellation', 'AbortError'),
  }).kind,
  'graphics-timeout',
);
assert.equal(
  regionalPreparationFeedback({ stage: 'source', timedOut: true }).kind,
  'source-timeout',
);
assert.equal(
  regionalPreparationFeedback({
    stage: 'graphics',
    error: new DOMException('Player cancelled', 'AbortError'),
  }).kind,
  'cancelled',
);
assert.equal(
  regionalPreparationFeedback({
    stage: 'graphics',
    savedStart: true,
    error: new Error('Shader link failure'),
  }).kind,
  'graphics-failed',
);
assert.equal(
  regionalPreparationFeedback({ savedStart: true, error: new Error('Invalid restore support') })
    .restoreUnavailable,
  true,
);
assert.equal(
  regionalPreparationFeedback({ error: new Error('Missing source') }).kind,
  'source-failed',
);
graphicsFailure = false;
await graphicsSession.prepare();
assert.equal(graphicsSession.snapshot().reason, 'prepared');
assert.equal(graphicsSession.snapshot().status, 'paused');
assert.equal(graphicsSession.snapshot().ticks, 0);
assert.equal(graphicsSession.arm(), true);
graphicsSession.pause();
await graphicsSession.dispose();
console.log('PASS regional graphics deadline, localized feedback, disarmed retry and disposal');

assert.equal(
  regionalPreparationFeedback({ contextLost: true, timedOut: true, stage: 'graphics' }).kind,
  'context-lost',
);
