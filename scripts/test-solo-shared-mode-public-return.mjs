import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';
import { validateQualification } from './solo-qualification.mjs';
import {
  SHARED_MODE_SOURCE,
  SHARED_MODE_PROTOCOL,
  qualificationSharedModeOptions,
  readSharedModePublicState,
  executeSharedModePublicReturn,
  assessSharedModePublicReturn,
} from './solo-qualification-shared-mode.mjs';
const fixture = new URL(
  '../docs/performance/fixtures/solo-shared-mode/public-return.qualification.fixture',
  import.meta.url,
);
const bytes = await readFile(fixture),
  scenario = JSON.parse(bytes);
const flags = [
  `--shared-mode-public-return=${SHARED_MODE_PROTOCOL}`,
  `--source-revision=${SHARED_MODE_SOURCE}`,
  '--cpu=1',
];
const control = (visible = false) => ({
  present: true,
  visible,
  enabled: true,
});
function model(options = {}) {
  let mode = 'solo',
    phase = 'home',
    origin = 1,
    tick = 0,
    elapsed = 0;
  const trace = [],
    pendingURLs = [],
    keyHeld = new Set();
  const url = () =>
    new URL(
      `https://example.test/game/${mode === 'team' ? 'couch/relay-rescue.html' : mode === 'versus' ? 'couch/' : ''}?journey=legacy`,
    );
  const state = () => {
    const clock = mode === 'team' ? Math.floor(tick / 1000) : 90 - Math.floor(tick / 1000);
    const ids =
      mode === 'team'
        ? [
            'coop-start',
            'coop-pause',
            'coop-resume',
            'coop-menu',
            'coop-overlay',
            'coop-home-paused',
            'coop-discard-dialog',
            'coop-discard-confirm',
          ]
        : mode === 'versus'
          ? ['race-start', 'race-pause', 'race-home', 'race-leave-panel', 'race-leave']
          : [
              'shell-home',
              'shell-title-team',
              'shell-title-versus',
              'shell-featured',
              'start-button',
              'pause-button',
            ];
    const controls = Object.fromEntries(ids.map((id) => [id, control()]));
    const show = (...names) => names.forEach((name) => (controls[name].visible = true));
    if (mode === 'solo')
      show('shell-home', 'shell-title-team', 'shell-title-versus', 'shell-featured');
    else if (mode === 'team') {
      if (phase === 'ready') show('coop-start', 'coop-menu');
      if (phase === 'running') show('coop-pause');
      if (['paused', 'confirm'].includes(phase)) show('coop-resume', 'coop-home-paused');
      if (phase === 'confirm') show('coop-discard-dialog', 'coop-discard-confirm');
    } else {
      if (['ready', 'paused', 'confirm'].includes(phase)) show('race-start');
      if (phase === 'running') show('race-pause');
      if (['paused', 'confirm'].includes(phase)) show('race-home');
      if (phase === 'confirm') show('race-leave-panel', 'race-leave');
    }
    const value = {
      mode,
      href: url().href,
      timeOrigin: origin,
      hidden: false,
      focused: true,
      boot: mode === 'solo' ? 'ready' : null,
      tool: mode === 'solo' ? null : 'ready',
      phase:
        mode === 'solo'
          ? 'briefing'
          : mode === 'team'
            ? String(['paused', 'confirm'].includes(phase))
            : phase === 'confirm'
              ? 'paused'
              : phase,
      clock: `${Math.floor(clock / 60)}:${String(clock % 60).padStart(2, '0')}`,
      players: mode === 'solo' ? [] : ['Active', 'Active'],
      controls,
      canvases:
        mode === 'solo'
          ? []
          : Array.from({ length: mode === 'team' ? 1 : 2 }, () => ({
              visible: true,
              width: 100,
              height: 100,
            })),
      otherModePresent: false,
    };
    options.mutate?.(value, { mode, phase, trace });
    return value;
  };
  const page = {
    evaluate: async (fn, selected) => {
      assert.equal(fn, readSharedModePublicState);
      if (options.stallRead) return new Promise(() => {});
      return { ...state(), mode: selected };
    },
    context: () => ({
      pages: () => Array(options.extraPage ? 2 : 1).fill(page),
    }),
    waitForTimeout: async (ms) => {
      elapsed += ms;
      if (phase === 'running' && !options.frozenClock) tick += ms;
      if (options.pausedClock && ['paused', 'confirm'].includes(phase)) tick += 2000;
      if (options.lateWait) elapsed += 200000;
    },
    waitForURL: async (predicate) =>
      new Promise((resolve, reject) =>
        pendingURLs.push(() => {
          try {
            assert(predicate(url()));
            resolve();
          } catch (error) {
            reject(error);
          }
        }),
      ),
    locator: (selector) => ({
      click: async () => {
        trace.push(selector);
        if (selector === '#shell-title-team' || selector === '#shell-title-versus') {
          mode = selector.endsWith('team') ? 'team' : 'versus';
          phase = 'ready';
          tick = 0;
          if (!options.sameDocument) origin++;
        } else if (['#coop-start', '#race-start'].includes(selector)) phase = 'running';
        else if (['#coop-pause', '#race-pause'].includes(selector)) phase = 'paused';
        else if (['#coop-home-paused', '#race-home'].includes(selector)) phase = 'confirm';
        else if (['#coop-discard-confirm', '#race-leave'].includes(selector)) {
          mode = 'solo';
          phase = 'home';
          origin++;
          tick = 0;
        } else assert.fail('Unexpected click ' + selector);
        pendingURLs.splice(0).forEach((settle) => settle());
      },
    }),
    keyboard: {
      down: async (key) => {
        trace.push('down:' + key);
        keyHeld.add(key);
      },
      up: async (key) => {
        trace.push('up:' + key);
        if (options.failUp) throw Error('key release failed');
        keyHeld.delete(key);
      },
    },
  };
  return { page, trace, now: () => elapsed, keyHeld };
}
async function run(options = {}, deadline = 120000) {
  const fixture = model(options),
    record = {};
  try {
    await executeSharedModePublicReturn({
      page: fixture.page,
      deadline,
      record,
      now: fixture.now,
    });
    return { record, ...fixture };
  } catch (error) {
    error.retained = { record, ...fixture };
    throw error;
  }
}

test('only exact declared source/bytes and CPU1 opt-in; unchanged generic qualification', () => {
  validateQualification(scenario);
  assert.equal(
    qualificationSharedModeOptions(flags, scenario, bytes).sourceRevision,
    SHARED_MODE_SOURCE,
  );
  for (const altered of [
    [...flags, '--cpu=1'],
    flags.map((x) => x.replace(SHARED_MODE_SOURCE, '0'.repeat(40))),
    [...flags, '--work-probe'],
    flags.map((x) => x.replace('--cpu=1', '--cpu=2')),
  ])
    assert.throws(() => qualificationSharedModeOptions(altered, scenario, bytes));
  assert.throws(() =>
    qualificationSharedModeOptions(flags, scenario, Buffer.concat([bytes, Buffer.from(' ')])),
  );
  const legacy = { ...scenario };
  delete legacy.sharedModeProtocol;
  legacy.actions = scenario.actions.slice(1);
  validateQualification(legacy);
  assert.equal(qualificationSharedModeOptions([], legacy, bytes), null);
  assert.throws(() => qualificationSharedModeOptions(flags, legacy, bytes));
  for (const alter of [
    (x) => (x.kind = 'performance'),
    (x) => (x.timeoutMs = 180001),
    (x) => (x.actions[0].timeoutMs = 120001),
    (x) => (x.sharedModeProtocol = 'unknown'),
    (x) => x.actions.push(x.actions[0]),
  ]) {
    const x = structuredClone(scenario);
    alter(x);
    assert.throws(() => validateQualification(x));
  }
});

test('actual executor uses guarded native controls for both routes and returns explicit unobserved scopes', async () => {
  const result = await run();
  assert.equal(result.record.status, 'passed-public-route');
  assert.equal(result.keyHeld.size, 0);
  assert.deepEqual(
    result.trace.filter((x) => x.startsWith('down:')),
    ['down:KeyD', 'down:ArrowLeft', 'down:KeyS', 'down:ArrowDown'],
  );
  const assessed = assessSharedModePublicReturn(result.record);
  assert.equal(assessed.documentCount, 5);
  assert.equal(assessed.intermediateReplay, 'unobserved');
  assert.equal(assessed.performanceExcluded, true);
  assert.equal(
    result.trace.filter((x) => x === '#coop-home-paused' || x === '#race-home').length,
    2,
  );
});

test('independent assessor rejects missing controls, clocks, source, mode and invented evidence', async () => {
  const { record } = await run();
  const mutations = [
    (x) => (x.rows[0].samples[2].state.clock = x.rows[0].samples[1].state.clock),
    (x) => (x.rows[1].samples[4].state.clock = '0:01'),
    (x) => (x.rows[0].samples[6].state.timeOrigin = x.initial.timeOrigin),
    (x) => (x.rows[0].samples[1].state.hidden = true),
    (x) => (x.rows[0].samples[1].state.pageCount = 2),
    (x) => x.rows[1].inputs.pop(),
    (x) => (x.rows[1].samples[2].state.href = 'https://evil.test/game/couch/?journey=legacy'),
    (x) => x.rows[1].samples[1].state.canvases.pop(),
    (x) => (x.rows[1].samples[0].state.phase = 'running'),
    (x) => (x.rows[0].checkpoint = {}),
    (x) => (x.publicActions[0].kind = 'goto'),
    (x) => (x.rows[0].samples[5].state.controls['coop-discard-confirm'].enabled = false),
  ];
  for (const [index, mutate] of mutations.entries()) {
    const changed = structuredClone(record);
    mutate(changed);
    assert.throws(() => assessSharedModePublicReturn(changed), `mutation ${index}`);
  }
});

for (const [name, options, pattern] of [
  ['frozen clock', { frozenClock: true }, /deadline/],
  ['same document', { sameDocument: true }, /deadline/],
  ['unexpected page', { extraPage: true }, /page/],
  ['hidden document', { mutate: (state) => (state.hidden = true) }, /hidden/],
  ['paused clock continues', { pausedClock: true }, /clock advanced/],
  ['keyup failure', { failUp: true }, /key release/],
  ['late wait cannot continue', { lateWait: true }, /deadline/],
])
  test(name + ' remains a failed partial and cannot continue to Versus', async () => {
    await assert.rejects(run(options, 3000), (error) => {
      assert.match(error.message, pattern);
      assert.equal(error.retained.record.status, 'failed');
      assert(!error.retained.trace.includes('#shell-title-versus'));
      return true;
    });
  });

test('stalled evaluation is bounded by the same nonrenewing deadline', async () => {
  await assert.rejects(run({ stallRead: true }, 20), (error) => {
    assert.match(error.message, /expired/);
    assert.equal(error.retained.record.status, 'failed');
    assert.equal(error.retained.trace.length, 0);
    return true;
  });
});

test('serialized read only reads public DOM and never calls diagnostics/export', () => {
  let exports = 0;
  const element = {
    isConnected: true,
    tagName: 'BUTTON',
    parentElement: null,
    disabled: false,
    closest: () => null,
    getAttribute: () => null,
    getClientRects: () => [{}],
    textContent: '0:01',
    width: 72,
    height: 36,
  };
  const context = {
    document: {
      hidden: false,
      hasFocus: () => true,
      documentElement: { dataset: { toolState: 'ready' } },
      body: { dataset: { coopPaused: 'false' } },
      getElementById: () => element,
    },
    location: {
      href: 'https://example.test/game/couch/relay-rescue.html?journey=legacy',
    },
    performance: { timeOrigin: 123 },
    getComputedStyle: () => ({ display: 'block', visibility: 'visible' }),
    window: {
      RevealLineSoloPerformance: {
        export() {
          exports++;
          throw Error('must not export');
        },
      },
    },
  };
  const result = vm.runInNewContext(`(${readSharedModePublicState.toString()})('team')`, context);
  assert.equal(result.clock, '0:01');
  assert.equal(result.players.length, 2);
  assert.equal(exports, 0);
  assert.equal(result.controls['coop-start'].visible, true);
});

test('actual qualifier integration isolates evidence from action status and preserves final replay', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  assert(source.includes('report.sharedModeObservation = observation;'));
  assert(source.includes('record: observation,'));
  assert(source.includes('assessSharedModePublicReturn(observation)'));
  assert.equal(scenario.actions.at(-1).type, 'exportReplay');
  assert.equal(scenario.replayRequirements.movingTicks, 120);
});
