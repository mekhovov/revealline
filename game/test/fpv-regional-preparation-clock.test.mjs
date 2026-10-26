import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';

const source = await readFile(
  new URL('../../optional-practice/civilian-fpv/world-app.mjs', import.meta.url),
  'utf8',
);
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
let frame, pause, stopFeedback, readState;
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration' && node.id.name === 'advanceFrame') frame = node;
  if (node.type === 'FunctionDeclaration' && node.id.name === 'pauseFlight') pause = node;
  if (node.type === 'FunctionDeclaration' && node.id.name === 'regionalStopFeedback')
    stopFeedback = node;
  if (node.type === 'FunctionDeclaration' && node.id.name === 'readFlightState') readState = node;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value?.type) visit(value);
  }
}
visit(ast);
assert(frame, 'Execute the production callback, not a copied timing policy');
const advance = new Function(
  'state',
  `with (state) { ${source.slice(readState.start, readState.end)} return (${source.slice(frame.start, frame.end)})(now); }`,
);
const explicitPause = new Function(
  'state',
  `with (state) { ${source.slice(readState.start, readState.end)} ${source.slice(stopFeedback.start, stopFeedback.end)} return (${source.slice(pause.start, pause.end)})(); }`,
);

function fixture({
  regional = true,
  preparing = true,
  status = 'paused',
  execution = 420,
  frameTime = 420,
} = {}) {
  const events = [],
    state = {
      now: frameTime,
      win: { performance: { now: () => execution } },
      lastExecutionTime: 20,
      lastTime: 20,
      lastDemoTime: 20,
      demoHost: null,
      accumulator: 17,
      current: { regional },
      regionalPreparing: preparing ? Promise.resolve() : null,
      flight: { snapshot: () => ({ status }) },
      $: (id) => {
        assert.equal(id, 'flight-dialog');
        return { open: true };
      },
      pauseFlight: () => {
        events.push('pause');
        if (state.regionalPreparing) events.push('cancel-preparation');
      },
      pollGamepad: () => {
        throw new Error('Stalled callback must not poll flight input');
      },
    };
  return { state, events };
}

test('a cold preparation callback resets timing without cancelling disarmed regional work', () => {
  for (const status of ['paused', 'disarmed']) {
    const f = fixture({ status });
    const pending = f.state.regionalPreparing;
    advance(f.state);
    assert.deepEqual(f.events, []);
    assert.equal(f.state.regionalPreparing, pending);
    assert.equal(f.state.lastTime, null);
    assert.equal(f.state.accumulator, 0);
    assert.equal(f.state.lastExecutionTime, 420);
  }
});

test('active flight still freezes before input, including an inconsistent active/preparing state', () => {
  for (const preparing of [false, true]) {
    const f = fixture({ status: 'active', preparing });
    advance(f.state);
    assert.deepEqual(f.events, preparing ? ['pause', 'cancel-preparation'] : ['pause']);
  }
});

test('paused World and Regional callbacks discard stale time without cancelling recovery', () => {
  for (const options of [{ regional: false }, { preparing: false }]) {
    const f = fixture(options);
    advance(f.state);
    assert.deepEqual(f.events, []);
    assert.equal(f.state.lastTime, null);
    assert.equal(f.state.accumulator, 0);
    assert.equal(f.state.lastExecutionTime, 420);
  }
});

test('queued stale rAF timestamps and long frame gaps use the same preparation boundary', () => {
  for (const options of [
    { execution: 420, frameTime: 40 },
    { execution: 40, frameTime: 420 },
  ]) {
    const f = fixture(options);
    advance(f.state);
    assert.deepEqual(f.events, []);
    assert.equal(f.state.lastTime, null);
    assert.equal(f.state.accumulator, 0);
  }
});

test('explicit shared pause still cancels an already-disarmed preparation and clears ownership', () => {
  const events = [],
    status = {},
    noop = () => {},
    state = {
      continuousPlay: { cancel: noop },
      regionalManifestRequest: null,
      pausing: false,
      pauseRevision: 0,
      gamepad: { reset: noop },
      stickTraces: [],
      beginnerCoach: { pausePreview: noop },
      fire: false,
      fireReleaseRequired: false,
      huntReactions: { suspend: noop },
      audio: { pause: noop },
      presentation: { resume: noop },
      replayProof: null,
      combatPlayback: null,
      combatReplaySource: null,
      input: {
        enable: (value) => events.push(['input', value]),
        clear: () => events.push('clear'),
        pause: ({ session, retainKeyboardThrottle }) => {
          assert.equal(session, state.flight);
          events.push(['input-pause', retainKeyboardThrottle]);
        },
      },
      radio: { freeze: () => events.push('freeze-radio') },
      regionalPreparing: Promise.resolve(),
      regionalPreparationIssue: null,
      current: { regional: true },
      flight: {
        snapshot: () => ({ status: 'paused' }),
        cancelPreparation: () => events.push('cancel'),
        pause: () => events.push('pause'),
      },
      lastTime: 20,
      lastExecutionTime: 20,
      accumulator: 17,
      win: { performance: { now: () => 420 } },
      $: () => status,
      txt: (en) => en,
      disposed: true,
    };
  explicitPause(state);
  assert.deepEqual(events, [['input-pause', false], 'freeze-radio', 'cancel', 'pause']);
  assert.equal(state.lastTime, null);
  assert.equal(state.accumulator, 0);
  assert.equal(state.pausing, false);
  assert.equal(status.textContent, 'Unscored · Paused');
  state.regionalPreparationIssue = {
    en: 'Graphics preparation took too long. Retry.',
    uk: 'Підготовка графіки триває надто довго. Повторіть.',
  };
  state.regionalPreparing = null;
  explicitPause(state);
  assert.equal(status.textContent, state.regionalPreparationIssue.en);
  assert.equal(state.pausing, false);
});
