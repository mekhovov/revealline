/* global document, location, performance, getComputedStyle */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const SHARED_MODE_PROTOCOL = 'shared-mode-public-return-v1';
export const SHARED_MODE_SOURCE = 'de3324607c82787c1a1fec9c13d4f8b5cb74cee4';
export const SHARED_MODE_RUNTIME73_SOURCE = '73a345cec696d7789198cf295ca5c37b17ca0e71';
export const SHARED_MODE_RUNTIME797_SOURCE = '797e03f28743921842df6aa57520a72016ba3dfc';
export const SHARED_MODE_FIXTURE = Object.freeze({
  bytes: 2685,
  sha256: '805b2793d4613aa67fd8e6f373c9268dd919b6cf857222bdf143cbe8fcd6311d',
});

/** This is a held source-specific observer, not remote package admission. */
export function qualificationSharedModeOptions(flags, scenario, bytes) {
  const selected = flags.filter((flag) => flag.startsWith('--shared-mode-public-return'));
  if (scenario.sharedModeProtocol === undefined) {
    assert.equal(selected.length, 0, 'Shared mode requires its exact declared recipe');
    assert(!scenario.actions.some((action) => action.type === 'shared-mode-public-return'));
    return null;
  }
  assert.equal(scenario.sharedModeProtocol, SHARED_MODE_PROTOCOL);
  assert.deepEqual(selected, [`--shared-mode-public-return=${SHARED_MODE_PROTOCOL}`]);
  const sourceFlags = flags.filter((flag) => flag.startsWith('--source-revision'));
  assert.equal(sourceFlags.length, 1);
  const sourceRevision = sourceFlags[0].slice('--source-revision='.length);
  assert(
    [SHARED_MODE_SOURCE, SHARED_MODE_RUNTIME73_SOURCE, SHARED_MODE_RUNTIME797_SOURCE].includes(
      sourceRevision,
    ),
  );
  assert.equal(sourceFlags[0], `--source-revision=${sourceRevision}`);
  assert.deepEqual(
    flags.filter((flag) => flag.startsWith('--cpu')),
    ['--cpu=1'],
  );
  assert.equal(scenario.kind, 'recovery');
  assert.equal(scenario.timeoutMs, 180000);
  assert.deepEqual(scenario.query, { journey: 'legacy' });
  assert.equal(bytes.length, SHARED_MODE_FIXTURE.bytes);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), SHARED_MODE_FIXTURE.sha256);
  assert.deepEqual(scenario, JSON.parse(bytes));
  assert(
    !flags.some((flag) =>
      /^--(?:work-probe|hitch-journal|baseline-runtime|cpu-profile|memory-profile|audio-proof|readiness|journal-cost|authored-next|snapshot-chunks)(?:=|-|$)/.test(
        flag,
      ),
    ),
    'Shared-mode diagnostic cannot share another observation mode',
  );
  return { protocol: SHARED_MODE_PROTOCOL, sourceRevision };
}

/** Serialized as an ordinary page.evaluate read. No application globals, event
 * injection, storage, style, attributes, clocks or run state are written. */
export function readSharedModePublicState(mode) {
  const visible = (element) => {
    if (!element?.isConnected || element.closest('[hidden], [inert], [aria-hidden="true"]'))
      return false;
    for (let node = element; node; node = node.parentElement) {
      if (node.tagName === 'DIALOG' && !node.open) return false;
      const style = getComputedStyle(node);
      if (
        style.display === 'none' ||
        style.visibility === 'hidden' ||
        style.visibility === 'collapse'
      )
        return false;
    }
    return element.getClientRects().length > 0;
  };
  const control = (id) => {
    const element = document.getElementById(id);
    return {
      present: Boolean(element),
      visible: visible(element),
      enabled: Boolean(
        element &&
          !element.disabled &&
          element.getAttribute('aria-disabled') !== 'true' &&
          !element.closest('[aria-busy="true"]'),
      ),
    };
  };
  const text = (id) => document.getElementById(id)?.textContent?.trim().slice(0, 512) ?? null;
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
  const canvasIds =
    mode === 'team' ? ['coop-canvas'] : mode === 'versus' ? ['race-canvas-0', 'race-canvas-1'] : [];
  return {
    mode,
    href: location.href,
    timeOrigin: performance.timeOrigin,
    hidden: document.hidden,
    focused: document.hasFocus(),
    boot: document.documentElement.dataset.bootState ?? null,
    tool: document.documentElement.dataset.toolState ?? null,
    phase:
      mode === 'team'
        ? (document.body.dataset.coopPaused ?? null)
        : mode === 'versus'
          ? (document.body.dataset.couchStatus ?? null)
          : (document.body.dataset.flightState ?? null),
    clock:
      mode === 'team' ? text('coop-clock') : mode === 'versus' ? text('race-clock') : text('time'),
    players:
      mode === 'solo'
        ? []
        : [0, 1].map((index) => text(`${mode === 'team' ? 'coop-state' : 'racer-state'}-${index}`)),
    preparation:
      mode === 'team'
        ? text('coop-picture-status')
        : mode === 'versus'
          ? text('race-preparation-status')
          : text('presentation-preparation-status'),
    controls: Object.fromEntries(ids.map((id) => [id, control(id)])),
    canvases: canvasIds.map((id) => {
      const element = document.getElementById(id);
      return {
        id,
        visible: visible(element),
        width: element?.width ?? null,
        height: element?.height ?? null,
      };
    }),
    otherModePresent:
      mode === 'solo' &&
      Boolean(document.getElementById('coop-start') || document.getElementById('race-start')),
  };
}

const usable = (state, id) => state.controls[id]?.visible && state.controls[id]?.enabled;
const clockSeconds = (value) => {
  assert.equal(typeof value, 'string', 'Public clock missing');
  assert(/^\d{1,3}:\d{2}$/.test(value), 'Public numeric clock required');
  const [minutes, seconds] = value.split(':').map(Number);
  assert(seconds < 60);
  return minutes * 60 + seconds;
};
function assertForeground(state) {
  assert.equal(state.hidden, false, 'Document became hidden');
  assert.equal(state.focused, true, 'Document lost focus');
  assert(Number.isFinite(state.timeOrigin) && state.timeOrigin > 0);
  assert.equal(state.pageCount, 1, 'Unexpected extra browser page');
}
function active(state) {
  return state.mode === 'team'
    ? state.phase === 'false' &&
        usable(state, 'coop-pause') &&
        !state.controls['coop-menu'].visible &&
        !state.controls['coop-overlay'].visible
    : state.phase === 'running' && usable(state, 'race-pause');
}
function paused(state) {
  return state.mode === 'team'
    ? state.phase === 'true' && usable(state, 'coop-resume') && usable(state, 'coop-home-paused')
    : state.phase === 'paused' && usable(state, 'race-start') && usable(state, 'race-home');
}
function readySolo(state) {
  return (
    state.boot === 'ready' &&
    state.phase !== 'running' &&
    state.controls['shell-home'].visible &&
    usable(state, 'shell-title-team') &&
    usable(state, 'shell-title-versus') &&
    !state.otherModePresent
  );
}
const modeRows = Object.freeze([
  {
    mode: 'team',
    path: 'couch/relay-rescue.html',
    enter: 'shell-title-team',
    start: 'coop-start',
    pause: 'coop-pause',
    home: 'coop-home-paused',
    confirm: 'coop-discard-confirm',
    dialog: 'coop-discard-dialog',
    keys: ['KeyD', 'ArrowLeft'],
  },
  {
    mode: 'versus',
    path: 'couch/',
    enter: 'shell-title-versus',
    start: 'race-start',
    pause: 'race-pause',
    home: 'race-home',
    confirm: 'race-leave',
    dialog: 'race-leave-panel',
    keys: ['KeyS', 'ArrowDown'],
  },
]);

/** Public actions only. The existing scenario/browser owner retains cleanup.
 * Every operation shares the original nonrenewing deadline; a late operation
 * cannot authorize another action. Partial evidence survives in `record`. */
export async function executeSharedModePublicReturn({
  page,
  deadline,
  record,
  now = () => performance.now(),
}) {
  assert(Number.isFinite(deadline) && deadline > now());
  let stopped = false;
  const remaining = () => {
    const value = deadline - now();
    assert(!stopped && value > 0, 'Shared-mode deadline expired');
    return value;
  };
  const step = async (label, work, cap = 10000) => {
    const budget = Math.min(cap, remaining());
    let timer;
    try {
      const value = await Promise.race([
        Promise.resolve().then(() => {
          remaining();
          return work(budget);
        }),
        new Promise((_, reject) => {
          timer = setTimeout(() => {
            stopped = true;
            reject(new Error(`Shared-mode operation expired: ${label}`));
          }, budget);
        }),
      ]);
      remaining();
      return value;
    } catch (error) {
      stopped = true;
      throw error;
    } finally {
      clearTimeout(timer);
    }
  };
  const read = async (mode) => {
    const state = await step('public state', () => page.evaluate(readSharedModePublicState, mode));
    state.pageCount = page.context().pages().length;
    assertForeground(state);
    return state;
  };
  const wait = (ms) => step('native elapsed wait', () => page.waitForTimeout(ms), ms + 1000);
  const until = async (mode, accept) => {
    for (;;) {
      const state = await read(mode);
      if (accept(state)) return state;
      await wait(100);
    }
  };
  const click = async (id) => {
    await step(`public click ${id}`, (timeout) => page.locator(`#${id}`).click({ timeout }));
    record.publicActions.push({ kind: 'click', selector: `#${id}` });
  };
  const navigate = async (id, pathname, origin) => {
    await step(
      `public navigation ${id}`,
      async (timeout) => {
        await Promise.all([
          page.waitForURL(
            (url) =>
              url.origin === origin &&
              url.pathname === pathname &&
              url.searchParams.get('journey') === 'legacy',
            { timeout, waitUntil: 'domcontentloaded' },
          ),
          page.locator(`#${id}`).click({ timeout }),
        ]);
      },
      30000,
    );
    record.publicActions.push({ kind: 'click', selector: `#${id}` });
  };
  record.protocol = SHARED_MODE_PROTOCOL;
  record.status = 'running';
  record.rows = [];
  record.publicActions = [];
  record.scope =
    'Public mode navigation, two delivered native player key sets, public clocks/paused controls, and return to Solo. No unfinished Team/Versus replay, internal checkpoint, resource-release, independent per-player motion or raster correctness claim.';
  try {
    let solo = await until('solo', readySolo);
    const base = new URL(solo.href);
    assert.equal(base.searchParams.get('journey'), 'legacy');
    assert(base.pathname.endsWith('/'));
    const soloPath = base.pathname;
    record.initial = solo;
    for (const spec of modeRows) {
      const row = {
        mode: spec.mode,
        status: 'running',
        checkpoint: null,
        resources: null,
        replay: null,
        inputs: [],
        samples: [],
      };
      record.rows.push(row);
      const priorOrigin = solo.timeOrigin;
      const path = new URL(spec.path, base).pathname;
      await navigate(spec.enter, path, base.origin);
      const checkPath = (state, expectedPath) => {
        const url = new URL(state.href);
        return (
          url.origin === base.origin &&
          url.pathname === expectedPath &&
          url.searchParams.get('journey') === 'legacy'
        );
      };
      const ready = await until(
        spec.mode,
        (state) =>
          checkPath(state, path) &&
          state.timeOrigin !== priorOrigin &&
          state.tool === 'ready' &&
          usable(state, spec.start),
      );
      assert.equal(
        spec.mode === 'team' ? active(ready) : ready.phase === 'running',
        false,
        'Mode auto-started',
      );
      row.samples.push({ label: 'ready', state: ready });
      await click(spec.start);
      const started = await until(spec.mode, active);
      assert(
        started.canvases.length === (spec.mode === 'team' ? 1 : 2) &&
          started.canvases.every(
            (canvas) => canvas.visible && canvas.width > 0 && canvas.height > 0,
          ),
        'Public playfield unavailable',
      );
      assert(
        started.players.length === 2 &&
          started.players.every((value) => typeof value === 'string' && value.length > 0),
        'Both public player states required',
      );
      const before = clockSeconds(started.clock);
      row.samples.push({ label: 'running', state: started });
      for (let player = 0; player < 2; player++) {
        const key = spec.keys[player];
        await step('native key down', () => page.keyboard.down(key), 1000);
        try {
          await wait(300);
        } finally {
          // Best-effort release belongs to the existing browser cleanup owner if
          // the scenario is already stopped. Do not grant any later action.
          if (!stopped && deadline > now())
            await step('native key up', () => page.keyboard.up(key), 1000);
        }
        row.inputs.push({ player, key, downAndUpCompleted: true, holdMs: 300 });
        record.publicActions.push({ kind: 'key', player, key, holdMs: 300 });
      }
      const advanced = await until(spec.mode, (state) => {
        assert(active(state), 'Mode stopped before public clock advanced');
        const value = clockSeconds(state.clock);
        return spec.mode === 'team' ? value >= before + 1 : value <= before - 1;
      });
      row.samples.push({ label: 'advanced', state: advanced });
      await click(spec.pause);
      const pause = await until(spec.mode, paused);
      row.samples.push({ label: 'paused', state: pause });
      await wait(500);
      const still = await read(spec.mode);
      assert(paused(still), 'Paused mode resumed without activation');
      assert.equal(still.clock, pause.clock, 'Public clock advanced while paused');
      row.samples.push({ label: 'still-paused', state: still });
      await click(spec.home);
      const decision = await until(
        spec.mode,
        (state) => state.controls[spec.dialog].visible && usable(state, spec.confirm),
      );
      assert.equal(decision.clock, pause.clock, 'Leave decision advanced retained mode');
      row.samples.push({ label: 'confirm-home', state: decision });
      await navigate(spec.confirm, soloPath, base.origin);
      solo = await until(
        'solo',
        (state) =>
          checkPath(state, soloPath) && state.timeOrigin !== ready.timeOrigin && readySolo(state),
      );
      row.samples.push({ label: 'solo-returned', state: solo });
      row.status = 'passed-public-route';
    }
    record.final = solo;
    record.status = 'passed-public-route';
    return record;
  } catch (error) {
    stopped = true;
    record.status = 'failed';
    record.failure = String(error?.message ?? error).slice(0, 4096);
    throw error;
  } finally {
    stopped = true;
  }
}

/** Recheck the retained public observations independently of the driver's return.
 * Package identity, native replay and final process closure remain separate gates. */
export function assessSharedModePublicReturn(evidence) {
  assert.equal(evidence.protocol, SHARED_MODE_PROTOCOL);
  assert.equal(evidence.status, 'passed-public-route');
  assertForeground(evidence.initial);
  assert(readySolo(evidence.initial));
  assert.equal(evidence.rows.length, 2);
  const base = new URL(evidence.initial.href);
  const documents = new Set([evidence.initial.timeOrigin]);
  const expectedActions = [];
  let previousSolo = evidence.initial;
  for (const [index, spec] of modeRows.entries()) {
    const row = evidence.rows[index];
    assert.equal(row.mode, spec.mode);
    assert.equal(row.status, 'passed-public-route');
    for (const name of ['checkpoint', 'resources', 'replay']) assert.equal(row[name], null);
    assert.deepEqual(
      row.samples.map((sample) => sample.label),
      ['ready', 'running', 'advanced', 'paused', 'still-paused', 'confirm-home', 'solo-returned'],
    );
    const [ready, running, advanced, pause, still, decision, solo] = row.samples.map(
      (sample) => sample.state,
    );
    for (const state of [ready, running, advanced, pause, still, decision, solo])
      assertForeground(state);
    for (const state of [ready, running, advanced, pause, still, decision]) {
      const url = new URL(state.href);
      assert.equal(url.origin, base.origin);
      assert.equal(url.pathname, new URL(spec.path, base).pathname);
      assert.equal(url.searchParams.get('journey'), 'legacy');
      assert.equal(state.timeOrigin, ready.timeOrigin);
      assert.equal(state.mode, spec.mode);
    }
    assert.equal(ready.tool, 'ready');
    assert(usable(ready, spec.start));
    assert(!active(ready));
    assert(
      spec.mode === 'team'
        ? ready.phase === 'false' && ready.controls['coop-menu'].visible
        : ready.phase === 'ready',
    );
    assert.notEqual(ready.timeOrigin, previousSolo.timeOrigin);
    assert(!documents.has(ready.timeOrigin));
    documents.add(ready.timeOrigin);
    assert(active(running) && active(advanced));
    for (const state of [running, advanced]) {
      assert.equal(state.canvases.length, spec.mode === 'team' ? 1 : 2);
      assert(
        state.canvases.every((canvas) => canvas.visible && canvas.width > 0 && canvas.height > 0),
      );
      assert.equal(state.players.length, 2);
      assert(state.players.every((value) => typeof value === 'string' && value.length > 0));
    }
    const before = clockSeconds(running.clock),
      after = clockSeconds(advanced.clock);
    assert(spec.mode === 'team' ? after >= before + 1 : after <= before - 1);
    assert.deepEqual(
      row.inputs,
      spec.keys.map((key, player) => ({
        player,
        key,
        downAndUpCompleted: true,
        holdMs: 300,
      })),
    );
    assert(paused(pause) && paused(still));
    assert.equal(still.clock, pause.clock);
    assert.equal(decision.clock, pause.clock);
    assert(decision.controls[spec.dialog].visible && usable(decision, spec.confirm));
    assert(readySolo(solo));
    const returned = new URL(solo.href);
    assert.equal(returned.origin, base.origin);
    assert.equal(returned.pathname, base.pathname);
    assert.equal(returned.searchParams.get('journey'), 'legacy');
    assert(!documents.has(solo.timeOrigin));
    documents.add(solo.timeOrigin);
    previousSolo = solo;
    expectedActions.push(
      { kind: 'click', selector: `#${spec.enter}` },
      { kind: 'click', selector: `#${spec.start}` },
      ...spec.keys.map((key, player) => ({
        kind: 'key',
        player,
        key,
        holdMs: 300,
      })),
      ...[spec.pause, spec.home, spec.confirm].map((id) => ({
        kind: 'click',
        selector: `#${id}`,
      })),
    );
  }
  assert.deepEqual(evidence.publicActions, expectedActions);
  assert.deepEqual(evidence.final, previousSolo);
  return {
    format: 'SoloSharedModePublicReturnAssessmentV1',
    status: 'passed-public-state',
    modes: ['team', 'versus'],
    documentCount: documents.size,
    intermediateCheckpoint: 'unobserved',
    intermediateReplay: 'unobserved',
    intermediateResourceClosure: 'unobserved',
    perPlayerMotion: 'unobserved',
    raster: 'unobserved',
    performanceExcluded: true,
    finalSoloNativeReplay: 'separate-required-gate',
    processOwnerClosure: 'separate-required-gate',
  };
}
