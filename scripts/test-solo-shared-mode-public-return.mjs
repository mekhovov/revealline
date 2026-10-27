import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { validateQualification } from './solo-qualification.mjs';
import {
  claimSharedModeInitialPage,
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

test('persistent shared page adoption keeps the one owned blank page and records its origin', async () => {
  const context = { pages: () => [page] };
  const page = {
    url: () => 'about:blank',
    isClosed: () => false,
    context: () => context,
    opener: async () => null,
  };
  const provenance = {};
  assert.equal(await claimSharedModeInitialPage(context, provenance), page);
  assert.deepEqual(provenance, {
    policy: 'fresh-persistent-single-blank-v1',
    status: 'adopted',
    initialPageCount: 1,
    initialPages: [{ url: 'about:blank', closed: false, belongsToContext: true }],
    omittedPages: 0,
    openerPresent: false,
  });
});
test('persistent adoption refuses foreign, extra, closed, navigated or popup pages without dismissing them', async () => {
  for (const kind of [
    'empty',
    'extra',
    'closed',
    'foreign-context',
    'nonblank',
    'opener',
    'opener-error',
    'late-extra',
    'late-replacement',
    'late-navigation',
    'late-close',
  ]) {
    let late = false,
      closeCalls = 0;
    const page = {
      url: () =>
        kind === 'nonblank' || (kind === 'late-navigation' && late)
          ? 'https://example.test/'
          : 'about:blank',
      isClosed: () => kind === 'closed' || (kind === 'late-close' && late),
      context: () => (kind === 'foreign-context' ? {} : context),
      opener: async () => {
        late = true;
        if (kind === 'opener-error') throw Error('opener unavailable');
        return kind === 'opener' ? {} : null;
      },
      close: async () => {
        closeCalls++;
      },
    };
    const context = {
      pages: () =>
        kind === 'empty'
          ? []
          : kind === 'extra' || (kind === 'late-extra' && late)
            ? [page, page]
            : kind === 'late-replacement' && late
              ? [{ ...page }]
              : [page],
    };
    const provenance = {};
    await assert.rejects(claimSharedModeInitialPage(context, provenance), kind);
    assert.equal(provenance.status, 'refused', kind);
    assert.equal(closeCalls, 0, 'Unexpected pages must remain visible to the owning cleanup');
    assert(provenance.initialPages.length <= 4);
  }
});
test('actual qualifier selects adoption only for the explicit persistent shared mode', async () => {
  const source = await readFile(new URL('./qualify-solo-runtime.mjs', import.meta.url), 'utf8');
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const find = (node) => {
    if (!node || typeof node !== 'object') return null;
    if (
      node.type === 'IfStatement' &&
      source.slice(node.test.start, node.test.end) ===
        "sharedModeOptions && contextMode === 'persistent'"
    )
      return node;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) {
          const found = find(child);
          if (found) return found;
        }
      } else if (value && typeof value === 'object') {
        const found = find(value);
        if (found) return found;
      }
    }
    return null;
  };
  const node = find(ast);
  assert(node, 'Actual qualifier must select the named shared initializer');
  const initialize = new Function(
    'sharedModeOptions',
    'contextMode',
    'context',
    'sharedModeModule',
    'report',
    'return (async () => { let page; ' +
      source.slice(node.start, node.end) +
      '; return page; })();',
  );
  for (const [selected, mode, adopted] of [
    [{}, 'persistent', true],
    [null, 'persistent', false],
    [{}, 'ephemeral', false],
    [null, 'ephemeral', false],
  ]) {
    let newPages = 0;
    const initial = {
      url: () => 'about:blank',
      isClosed: () => false,
      context: () => context,
      opener: async () => null,
    };
    const created = {};
    const context = {
      pages: () => [initial],
      newPage: async () => {
        newPages++;
        return created;
      },
    };
    const report = { environment: {} };
    const page = await initialize(selected, mode, context, { claimSharedModeInitialPage }, report);
    assert.equal(page, adopted ? initial : created);
    assert.equal(newPages, adopted ? 0 : 1);
    assert.equal(
      report.environment.sharedModePageInitialization?.status,
      adopted ? 'adopted' : undefined,
    );
  }
});
test('failed public readiness retains only the latest completed state and the exhausted action boundary', async () => {
  await assert.rejects(
    run(
      {
        mutate: (state) => {
          if (state.mode === 'team') {
            state.tool = 'loading';
            state.access = 'unlocked';
            state.loadingMessage = 'Loading selected route';
            state.controls['coop-start'].visible = false;
          }
        },
      },
      3000,
    ),
    (error) => {
      const { record, trace } = error.retained;
      assert.equal(record.status, 'failed');
      assert.deepEqual(trace, ['#shell-title-team']);
      assert(record.publicStateReads.completed > 2);
      assert.equal(record.publicStateReads.last.mode, 'team');
      assert.equal(record.publicStateReads.last.state.tool, 'loading');
      assert.equal(record.publicStateReads.last.state.loadingMessage, 'Loading selected route');
      assert.equal(record.publicStateReads.last.state.controls['coop-start'].visible, false);
      assert.equal(record.publicStateReads.last.overflow, false);
      assert(record.publicStateReads.last.bytes <= 16384);
      assert.equal(record.deadlineFailure.scope, 'action');
      assert.throws(() => assessSharedModePublicReturn(record));
      return true;
    },
  );
});
test('the extra-page refusal preserves the exact last observed count before failing', async () => {
  await assert.rejects(run({ extraPage: true }), (error) => {
    assert.equal(error.retained.record.publicStateReads.completed, 1);
    assert.equal(error.retained.record.publicStateReads.last.state.pageCount, 2);
    assert.equal(error.retained.record.publicStateReads.pending, null);
    assert.equal(error.retained.trace.length, 0);
    return true;
  });
});
test('oversized optional last-state evidence retains only its bounded identity', async () => {
  const { record } = await run({
    mutate: (state) => {
      state.extra = 'x'.repeat(20000);
    },
  });
  const last = record.publicStateReads.last;
  assert.equal(last.overflow, true);
  assert.equal(last.state, undefined);
  assert.match(last.sha256, /^[a-f0-9]{64}$/);
  assert(last.bytes > 16384);
  assert(Buffer.byteLength(JSON.stringify(last)) < 512);
});
test('actual executor distinguishes an individual read timeout from the remaining action timeout', async () => {
  const source = await readFile(
    new URL('./solo-qualification-shared-mode.mjs', import.meta.url),
    'utf8',
  );
  const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  const edits = ast.body.flatMap((node) =>
    node.type === 'ImportDeclaration'
      ? [[node.start, node.end, '']]
      : node.type === 'ExportNamedDeclaration'
        ? [[node.start, node.declaration.start, '']]
        : [],
  );
  let body = source;
  for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0]))
    body = body.slice(0, start) + text + body.slice(end);
  for (const [deadline, expectedScope, expectedBudget] of [
    [20000, 'operation', 10000],
    [20, 'action', 20],
  ]) {
    const timers = [];
    const actual = new Function(
      'assert',
      'createHash',
      'Buffer',
      'setTimeout',
      'clearTimeout',
      body + '; return executeSharedModePublicReturn;',
    )(
      assert,
      createHash,
      Buffer,
      (fn, ms) => {
        timers.push({ fn, ms });
        return timers.length;
      },
      () => {},
    );
    const record = {};
    const pending = actual({
      page: { evaluate: () => new Promise(() => {}) },
      record,
      deadline,
      now: () => 0,
    });
    const rejected = assert.rejects(pending, /Shared-mode operation expired: public state/);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].ms, expectedBudget);
    await Promise.resolve();
    timers[0].fn();
    await rejected;
    assert.equal(record.deadlineFailure.scope, expectedScope);
    assert.equal(record.deadlineFailure.operation, 'public state');
    assert.equal(record.publicStateReads.completed, 0);
    assert.equal(record.publicStateReads.last, null);
    assert.equal(record.publicStateReads.pending.mode, 'solo');
    assert.equal(record.status, 'failed');
  }
});
