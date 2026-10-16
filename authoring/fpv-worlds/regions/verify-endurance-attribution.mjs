import assert from 'node:assert/strict';
import { createEnduranceAttribution } from './endurance-attribution.mjs';
import { createEnduranceClock } from './endurance-clock.mjs';
let at = 1000,
  callback,
  pending = [],
  disconnected = 0;
class Observer {
  static supportedEntryTypes = ['long-animation-frame'];
  constructor(fn) {
    callback = fn;
  }
  observe(options) {
    assert.deepEqual(options, { type: 'long-animation-frame', buffered: false });
  }
  takeRecords() {
    const result = pending;
    pending = [];
    return result;
  }
  disconnect() {
    disconnected++;
  }
}
const trace = createEnduranceAttribution({
  startedAt: 1000,
  now: () => at,
  pageURL: 'https://review.invalid/authoring/fpv-worlds/regions/authored-endurance.html',
  PerformanceObserver: Observer,
});
const script = (changes = {}) => ({
  startTime: 1020,
  duration: 80,
  executionStart: 1021,
  forcedStyleAndLayoutDuration: 12,
  pauseDuration: 0,
  invoker: 'Window.requestAnimationFrame',
  invokerType: 'user-callback',
  sourceURL:
    'https://review.invalid/authoring/fpv-worlds/regions/endurance.mjs?token=secret#private',
  sourceFunctionName: 'frame',
  sourceCharPosition: 200,
  ...changes,
});
const entry = (changes = {}) => ({
  entryType: 'long-animation-frame',
  startTime: 1020,
  duration: 100,
  blockingDuration: 50,
  renderStart: 1040,
  styleAndLayoutStart: 1100,
  scripts: [script()],
  ...changes,
});
const send = (entries) => callback({ getEntries: () => entries });
const checks = [];
trace.frame();
at = 1020;
const before = trace.begin('snapshot-before-step');
at = 1032;
assert(trace.end(before));
at = 1035;
const step = trace.begin('flight-step');
at = 1100;
assert(trace.end(step));
at = 1200;
send([entry()]);
let view = trace.snapshot();
const frame = view.lastLongAnimationFrames[0];
assert.equal(frame.elapsedMs, 20);
assert.equal(frame.scripts[0].durationMs, 80);
assert.deepEqual(frame.scripts[0].source, {
  path: '/authoring/fpv-worlds/regions/endurance.mjs',
  functionName: 'frame',
  characterPosition: 200,
});
assert.equal(frame.scripts[0].invoker, 'requestAnimationFrame');
assert.deepEqual(
  frame.overlappingSpans.map((row) => [row.phase, row.overlapMs]),
  [
    ['flight-step', 65],
    ['snapshot-before-step', 12],
  ],
);
assert.equal(view.phases.find((row) => row.phase === 'flight-step').count, 1);
assert.equal(view.phases.find((row) => row.phase === 'flight-step').maxMs, 65);
checks.push(
  'Injected API-shaped entry times join synchronous snapshot/step spans without treating caller source or overlap as causal attribution.',
);

send([
  entry({
    scripts: [
      script({
        sourceURL: 'https://foreign.invalid/private-file?secret=hidden',
        sourceFunctionName: 'privateFunction',
        invoker: 'IMG#private-name.onload',
        invokerType: 'event-listener',
      }),
      script({ sourceURL: 'https://user:password@review.invalid/game/private.mjs' }),
      script({ sourceURL: 'https://review.invalid/not-admitted/private.mjs' }),
      script({ sourceFunctionName: 'not a source name / private@example.com' }),
    ],
  }),
]);
const privacy = trace.snapshot().lastLongAnimationFrames.at(-1);
assert(privacy.scripts.slice(0, 3).every((row) => row.source === null));
assert.equal(privacy.scripts[3].source.functionName, null);
const encoded = JSON.stringify(trace.snapshot());
for (const secret of [
  'token=',
  'private-name',
  'private-file',
  'foreign.invalid',
  'password',
  'private@example.com',
  'privateFunction',
])
  assert(!encoded.includes(secret), secret);
checks.push(
  'Foreign/credentialled/unowned sources, query/hash, raw DOM invoker and invalid names are excluded; only bounded owned source metadata remains.',
);

const count = trace.snapshot().entries;
send([
  entry({ startTime: 999 }),
  entry({ duration: 49 }),
  entry({ duration: NaN }),
  entry({ entryType: 'longtask' }),
]);
assert.equal(trace.snapshot().entries, count);
assert.equal(trace.snapshot().malformed, 4);
assert.equal(trace.begin('unknown-production-phase'), null);
assert.equal(trace.end(before), false);
checks.push(
  'Old/malformed/wrong-kind entries and unknown/duplicate phase marks cannot masquerade as fresh measurements.',
);

for (let index = 0; index < 180; index++) {
  trace.frame();
  at++;
  const token = trace.begin('renderer-draw');
  at += 0.2;
  trace.end(token);
  send([
    entry({
      startTime: at,
      duration: 150,
      scripts: Array.from({ length: 70 }, (_, number) =>
        script({
          startTime: at,
          duration: number + 1,
          sourceURL: 'https://review.invalid/game/' + 'x'.repeat(160) + '.mjs',
          sourceFunctionName: 'f'.repeat(80),
        }),
      ),
    }),
  ]);
}
view = trace.snapshot();
assert.equal(view.lastSpans.length, 128);
assert.equal(view.lastLongAnimationFrames.length, 16);
assert(
  view.lastLongAnimationFrames.every(
    (row) => row.scripts.length === 8 && row.overlappingSpans.length <= 12,
  ),
);
assert.equal(view.lastLongAnimationFrames.at(-1).scripts[0].durationMs, 64);
assert(
  view.dropped.spans > 0 &&
    view.dropped.longAnimationFrames > 0 &&
    view.dropped.scripts > 0 &&
    view.dropped.unscannedScripts > 0,
);
assert(
  JSON.stringify(view).length < 128 * 1024,
  'Diagnostic snapshot remains bounded, including overlap examples and source names.',
);
const oldFirst = view.lastSpans[0].id;
view.lastSpans[0].phase = 'mutated';
view.lastLongAnimationFrames[0].scripts[0].source.path = 'mutated';
assert.notEqual(trace.snapshot().lastSpans[0].phase, 'mutated');
assert.notEqual(trace.snapshot().lastLongAnimationFrames[0].scripts[0].source.path, 'mutated');
assert.equal(trace.end(oldFirst - 1), false);
checks.push(
  'Preallocated phase slots, frame/script scan caps and overlap-example caps bound retained payload; overwritten marks and snapshot mutation cannot alter evidence.',
);

at++;
const incomplete = trace.begin('prepare-renderer-submit');
pending = [entry({ startTime: at, scripts: [] })];
const oldCount = trace.snapshot().entries;
trace.stop();
const final = trace.snapshot();
assert.equal(final.entries, oldCount + 1);
assert(final.stopped);
assert.equal(disconnected, 1);
assert.equal(final.lastSpans.at(-1).completed, false);
assert.equal(final.lastSpans.at(-1).durationMs, null);
assert.equal(trace.end(incomplete), false);
send([entry()]);
trace.frame();
trace.stop();
assert.deepEqual(trace.snapshot(), final);
checks.push(
  'Stop drains only available pending entries once, disconnects and freezes evidence; incomplete spans stay unknown rather than zero.',
);

const unsupported = createEnduranceAttribution({
  startedAt: at,
  now: () => at,
  pageURL: 'https://review.invalid/',
  PerformanceObserver: null,
});
assert.equal(unsupported.snapshot().capability, 'unsupported');
unsupported.stop();
class Broken extends Observer {
  observe() {
    throw Error('Unavailable');
  }
}
const broken = createEnduranceAttribution({
  startedAt: at,
  now: () => at,
  pageURL: 'https://review.invalid/',
  PerformanceObserver: Broken,
});
assert.equal(broken.snapshot().capability, 'unavailable');
broken.stop();
const clock = createEnduranceClock({ startedAt: 0, startedWallAt: 0, targetMs: 1000 });
clock.advance(20, () => true, 20);
clock.advance(428.5, () => true, 428.5);
assert.equal(clock.snapshot().status, 'invalid');
assert.equal(clock.snapshot().reason, 'Frame gap exceeded 250 ms');
checks.push(
  'Unsupported/unavailable APIs remain explicit and the unchanged acceptance clock still rejects a 408.5 ms gap.',
);
class Unreadable extends Observer {
  takeRecords() {
    throw Error('Unavailable records');
  }
  disconnect() {
    throw Error('Unavailable disconnect');
  }
}
const unreadable = createEnduranceAttribution({
  startedAt: at,
  now: () => at,
  pageURL: 'https://review.invalid/',
  PerformanceObserver: Unreadable,
});
callback({
  getEntries() {
    throw Error('Unavailable callback entries');
  },
});
unreadable.stop();
assert(unreadable.snapshot().stopped);
assert.equal(unreadable.snapshot().readFailures, 3);
unreadable.stop();
assert.equal(unreadable.snapshot().readFailures, 3);
checks.push(
  'Observer callback/drain/disconnect failures stay bounded diagnostic failures and cannot abort finalization or retry teardown.',
);
console.log(
  JSON.stringify(
    {
      passed: true,
      checks,
      scope:
        'Deterministic authoring attribution and real clock contract only. No browser long-frame, GC cause, performance or elapsed endurance acceptance.',
    },
    null,
    2,
  ),
);
