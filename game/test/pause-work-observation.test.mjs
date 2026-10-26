import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { createPerformanceSession } from '../ui/performance-session.mjs';
// Include the complete existing real-host Pause controls in this selected CI command.
import './controller-practice-pause-host.test.mjs';

const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
const nodes = [];
function visit(value) {
  if (!value || typeof value !== 'object') return;
  if (value.type === 'FunctionDeclaration') nodes.push(value);
  for (const child of Object.values(value)) {
    if (Array.isArray(child)) child.forEach(visit);
    else if (child && typeof child === 'object') visit(child);
  }
}
visit(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
const actual = (name) => {
  const matches = nodes.filter((node) => node.id?.name === name);
  assert.equal(matches.length, 1, name);
  return source.slice(matches[0].start, matches[0].end);
};
const bind = new Function(
  'env',
  'with (env) {' +
    ['markPauseWork', 'persistAttempt', 'pause'].map(actual).join('\n') +
    '; return { pause, persistAttempt }; }',
);
function fixture(options = {}) {
  let clock = 0,
    reads = 0,
    writes = 0;
  const calls = [],
    session = { saved: true };
  const stage = (name, ms = 1) => {
    calls.push(name);
    clock += ms;
  };
  const performanceSession = options.absent
    ? null
    : createPerformanceSession({
        enabled: options.enabled !== false,
        now: () => {
          reads++;
          return clock;
        },
      });
  if (options.markThrows)
    performanceSession.markEvent = () => {
      throw new Error('diagnostic only');
    };
  const env = {
    performanceSession,
    performanceRunGeneration: 3,
    document: { hidden: false, hasFocus: () => true },
    run: { status: 'running', tick: 123, player: { cutting: false } },
    practiceRenderFailure: { failed: false },
    courseBlocked: () => false,
    defeatActive: false,
    defeatPaused: false,
    celebrationActive: false,
    started: true,
    paused: false,
    practice: !!options.practice,
    courseEntryHold: false,
    modeDepartureHold: false,
    titleFlightHold: false,
    recorder: {},
    sessionBusy: false,
    runMessageCue: 'resumed',
    journeyProfile: {
      flush() {
        stage('flush');
        return Promise.resolve(true);
      },
    },
    journeyRewardsDurable: false,
    lastOwnedAttempt: null,
    sessionKey: 'owned',
    setMediaPreparationPhase() {
      stage('phase');
    },
    cancelPictureStart() {
      stage('cancel');
    },
    clearInput() {
      stage('input', 2);
    },
    sound: {
      pause() {
        stage('audio', 4);
      },
    },
    warning() {
      stage('warning');
    },
    localizedMessage: (value) => value,
    t: (value) => value,
    assertWriter() {
      stage('writer');
      if (options.writerThrows) throw new Error('writer');
    },
    snapshotAttempt() {
      stage('snapshot', 7);
      if (options.snapshotThrows) throw new Error('snapshot');
      return session;
    },
    profileStorage: () => ({
      getItem(key) {
        assert.equal(key, 'owned');
        stage('readback', 5);
        if (options.readbackThrows) throw new Error('readback');
        return options.mismatch ? 'changed' : 'serialized';
      },
    }),
    saveSession(storage, key, value) {
      assert.equal(key, 'owned');
      assert.equal(value, session);
      stage('save', 11);
      writes++;
      if (options.saveThrows) throw new Error('save');
      return { ok: !options.saveFails, serialized: 'serialized', warning: 'unavailable' };
    },
    attemptReadbackMatches(raw, value) {
      assert.equal(value, session);
      stage('semantic-readback');
      return false;
    },
    overlay(value) {
      assert.equal(value, 'pause');
      stage('overlay', 3);
      if (options.overlayThrows) throw new Error('overlay');
    },
    localizedText() {
      stage('button');
    },
    $: () => ({}),
    refreshHUD() {
      stage('hud', 6);
      if (options.hudThrows) throw new Error('hud');
    },
    updatePlayedLevelLink(request) {
      assert.equal(request.discoverClassic, true);
      stage('link', 2);
      if (options.linkThrows) throw new Error('link');
      return Promise.resolve();
    },
    resume() {
      stage('resume');
    },
  };
  const bound = bind(env);
  return {
    env,
    calls,
    bound,
    session,
    get writes() {
      return writes;
    },
    get reads() {
      return reads;
    },
    events: () => performanceSession?.export({ paused: true }).eventWitnesses ?? null,
  };
}
const successful = [
  'pause-begin',
  'pause-phase',
  'pause-input',
  'pause-audio',
  'pause-snapshot-begin',
  'pause-snapshot-end',
  'pause-save-begin',
  'pause-save-end',
  'pause-readback-begin',
  'pause-readback-end',
  'pause-overlay',
  'pause-hud',
  'pause-link',
  'pause-end',
];
test('actual pause/persist path stamps synchronous substages without deferring save or changing ownership', () => {
  const f = fixture();
  assert.equal(f.bound.pause(true), undefined);
  assert.equal(f.writes, 1, 'Save finished synchronously before pause returns.');
  assert.equal(f.env.lastOwnedAttempt, 'serialized');
  assert.equal(f.env.paused, true);
  assert.deepEqual(f.calls, [
    'phase',
    'cancel',
    'input',
    'flush',
    'audio',
    'warning',
    'writer',
    'snapshot',
    'save',
    'readback',
    'overlay',
    'button',
    'hud',
    'link',
  ]);
  const events = f.events().recent;
  assert.deepEqual(
    events.map((e) => e.kind),
    successful,
  );
  assert(events.every((e) => e.runGeneration === 3 && e.tick === 123));
  const at = Object.fromEntries(events.map((e) => [e.kind, e.atMs]));
  assert.equal(at['pause-snapshot-end'] - at['pause-snapshot-begin'], 7);
  assert.equal(at['pause-save-end'] - at['pause-save-begin'], 11);
  assert.equal(at['pause-readback-end'] - at['pause-readback-begin'], 5);
  assert.equal(at['pause-end'], at['pause-link']);
});
for (const [option, failed, forbidden] of [
  ['writerThrows', 'pause-persist-failed', 'pause-snapshot-begin'],
  ['snapshotThrows', 'pause-snapshot-failed', 'pause-snapshot-end'],
  ['saveThrows', 'pause-save-failed', 'pause-save-end'],
  ['saveFails', 'pause-save-failed', 'pause-save-end'],
  ['readbackThrows', 'pause-readback-failed', 'pause-readback-end'],
  ['mismatch', 'pause-readback-failed', 'pause-readback-end'],
])
  test(
    'actual pause preserves failed ' + option + ' as an incomplete span without suppressing UI',
    () => {
      const f = fixture({ [option]: true });
      assert.doesNotThrow(() => f.bound.pause(true));
      const kinds = f.events().recent.map((e) => e.kind);
      assert(kinds.includes(failed));
      assert(!kinds.includes(forbidden));
      assert(!kinds.includes('pause-end'));
      assert(
        kinds.includes('pause-overlay') &&
          kinds.includes('pause-hud') &&
          kinds.includes('pause-link'),
      );
      assert.equal(f.env.lastOwnedAttempt, null);
      assert.equal(f.env.paused, true);
    },
  );
for (const [option, stage, last] of [
  ['overlayThrows', 'overlay', 'pause-readback-end'],
  ['hudThrows', 'hud', 'pause-overlay'],
  ['linkThrows', 'link', 'pause-hud'],
])
  test('actual ' + stage + ' exception propagates and cannot gain a fabricated end', () => {
    const f = fixture({ [option]: true });
    assert.throws(() => f.bound.pause(true), new RegExp(stage));
    assert.equal(f.env.lastOwnedAttempt, 'serialized');
    const kinds = f.events().recent.map((e) => e.kind);
    assert.equal(kinds.at(-1), last);
    assert(!kinds.includes('pause-' + stage));
    assert(!kinds.includes('pause-end'));
  });
test('no current run with a prior generation preserves the original early return', () => {
  const f = fixture();
  f.env.run = null;
  f.env.started = false;
  assert.equal(f.env.performanceRunGeneration, 3);
  assert.doesNotThrow(() => f.bound.pause(true));
  assert.deepEqual(f.calls, ['phase', 'cancel', 'flush', 'link']);
  assert.equal(f.writes, 0);
  assert.equal(f.env.lastOwnedAttempt, null);
  assert.equal(f.events().total, 0, 'Missing tick cannot become an accepted event.');
});
test('skipped persistence is explicit; earlier return branches stay incomplete prefixes', () => {
  const f = fixture({ practice: true });
  f.bound.pause(true);
  assert.equal(f.writes, 0);
  const kinds = f.events().recent.map((e) => e.kind);
  assert(kinds.includes('pause-save-skipped'));
  assert(kinds.includes('pause-end'));
  assert(!kinds.includes('pause-snapshot-begin'));
  const early = fixture();
  early.env.celebrationActive = true;
  early.bound.pause(true);
  assert.deepEqual(
    early.events().recent.map((e) => e.kind),
    ['pause-begin', 'pause-phase'],
  );
  assert.equal(early.writes, 0);
});
test('default persistence emits no pause row and retains its synchronous return value', () => {
  const f = fixture();
  assert.equal(f.bound.persistAttempt(false), f.session);
  assert.equal(f.writes, 1);
  assert.equal(f.events().total, 0);
});
test('absent, disabled and throwing optional markers never change pause side effects', () => {
  const reference = fixture({ absent: true });
  reference.bound.pause(true);
  for (const options of [{ enabled: false }, { markThrows: true }]) {
    const f = fixture(options),
      before = f.reads;
    assert.doesNotThrow(() => f.bound.pause(true));
    if (options.enabled === false)
      assert.equal(
        f.reads - before,
        1,
        'Only the existing setPhase clock read remains; markers add none.',
      );
    assert.deepEqual(f.calls, reference.calls);
    assert.equal(f.writes, 1);
    assert.equal(f.env.lastOwnedAttempt, 'serialized');
    assert.equal(f.events().total, 0);
  }
});
