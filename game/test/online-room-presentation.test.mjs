// Authored regressions; automated suites remain waived and unrun.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';
import { attachRoomSupport } from '../online/room-controls.mjs';
import {
  createRoomAudioActivation,
  createRoomBoardPresentation,
  reconcileRoomPresentationRuns,
} from '../online/room-events.mjs';
import { createCoopCaptureFeedback } from '../couch/coop-terrain-trail.mjs';
import { createTeamOutcomeFeedback } from '../couch/coop-outcome-presentation.mjs';
import { createHuntDestruction } from '../hunt/destruction.mjs';
import { createDestructionBudget } from '../hunt/destruction-budget.mjs';
import { createAudioMaster } from '../ui/audio-master.mjs';
import { mountModePlayShell } from '../ui/mode-play-shell.mjs';
import { Document } from './helpers/couch-dom.mjs';

test('private-room title shows the stored mute before joining and follows later shared changes', async () => {
  // Execute the actual host mount/subscription ordering with the real shared
  // title and audio master. Transport and unrelated page services stay outside
  // this boundary; no AudioContext is created by reading a saved preference.
  const source = await readFile(new URL('../online/room-ui.mjs', import.meta.url), 'utf8'),
    host = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }).body.find(
      (node) =>
        node.type === 'ExportNamedDeclaration' && node.declaration?.id?.name === 'mountRoomUI',
    ).declaration,
    statements = host.body.body.filter(
      (node) =>
        (node.type === 'ExpressionStatement' &&
          node.expression.type === 'AssignmentExpression' &&
          node.expression.left.name === 'shell') ||
        (node.type === 'VariableDeclaration' &&
          node.declarations.some((declaration) => declaration.id.name === 'stopAudio')),
    );
  assert.equal(statements.length, 2);
  const mountSource = statements
    .map((node) => source.slice(node.start, node.end))
    .join('\n')
    .replaceAll(
      'import.meta.url',
      JSON.stringify(new URL('../online/room-ui.mjs', import.meta.url).href),
    );
  for (const locale of ['en', 'uk']) {
    const doc = new Document(),
      audioMaster = createAudioMaster({ muted: true, volume: 0.35 }),
      nodes = new Map(),
      $ = (id) => {
        if (!nodes.has(id)) {
          const node = doc.createElement(id === 'room-master' ? 'input' : 'section');
          node.id = id;
          doc.body.append(node);
          nodes.set(id, node);
        }
        return nodes.get(id);
      };
    doc.documentElement.lang = locale;
    const mounted = runInNewContext(
      `(function () { let shell; ${mountSource}\nreturn {shell, stopAudio}; })()`,
      {
        doc,
        $,
        audioMaster,
        getLocale: () => locale,
        say: (en, uk) => (locale === 'uk' ? uk : en),
        modes: $('modes'),
        briefing: $('briefing'),
        ready() {},
        getState: () => null,
        canPlay: () => false,
        mountModePlayShell: (options) => mountModePlayShell({ ...options, document: doc }),
        attachModalNavigation: undefined,
        attachFullscreen: undefined,
        setMenuIcon: undefined,
        URL,
      },
    );
    const button = doc.getElementById('room-action-sound');
    assert.equal(button.textContent, locale === 'uk' ? 'Звук: вимкнено' : 'Sound: off');
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.equal($('room-master').value, '0.35');
    assert.equal(audioMaster.snapshot().muted, true, 'Presentation does not rewrite saved intent');
    audioMaster.setMuted(false);
    assert.equal(button.textContent, locale === 'uk' ? 'Звук: увімкнено' : 'Sound: on');
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    audioMaster.setVolume(0.8);
    assert.equal($('room-master').value, '0.8');
    mounted.stopAudio();
    audioMaster.setMuted(true);
    assert.equal(button.getAttribute('aria-pressed'), 'true', 'Disposal retires the observer');
    mounted.shell.dispose();
    audioMaster.dispose();
  }
});

function eventTarget() {
  const listeners = new Map(),
    captures = new Set();
  return {
    addEventListener(type, handler) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(handler);
    },
    removeEventListener(type, handler) {
      listeners.get(type)?.delete(handler);
    },
    fire(type, values = {}) {
      const event = {
        code: 'Space',
        button: 0,
        repeat: false,
        defaultPrevented: false,
        target: { closest: () => null },
        preventDefault() {
          this.defaultPrevented = true;
        },
        ...values,
      };
      for (const handler of listeners.get(type) ?? []) handler(event);
      return event;
    },
    setPointerCapture(id) {
      captures.add(id);
    },
    hasPointerCapture(id) {
      return captures.has(id);
    },
    releasePointerCapture(id) {
      captures.delete(id);
      this.fire('lostpointercapture', { pointerId: id });
    },
  };
}
function supportHarness() {
  const document = eventTarget(),
    button = eventTarget(),
    state = { active: true, team: true, pauses: 0 };
  const support = attachRoomSupport({
    document,
    button,
    active: () => state.active,
    isTeam: () => state.team,
    pause: () => state.pauses++,
  });
  return { document, button, state, support };
}

test('overlapping room Support sources release independently, including pointer cancellation', () => {
  const { document, button, support } = supportHarness();
  document.fire('keydown');
  button.fire('pointerdown', { pointerId: 7 });
  button.fire('pointerdown', { pointerId: 9 });
  button.fire('pointercancel', { pointerId: 7 });
  assert.equal(support.held(), true, 'keyboard and second pointer still own their holds');
  document.fire('keyup');
  assert.equal(support.held(), true, 'releasing Space cannot clear the held touch');
  button.fire('lostpointercapture', { pointerId: 9 });
  assert.equal(support.held(), false);
  support.dispose();
});

test('background/menu recovery needs a fresh Support edge and releases captured pointers', () => {
  const { document, button, state, support } = supportHarness();
  document.fire('keydown');
  button.fire('pointerdown', { pointerId: 3 });
  state.active = false;
  support.clear();
  assert.equal(button.hasPointerCapture(3), false);
  assert.equal(support.held(), false);
  document.fire('keydown', { repeat: true });
  state.active = true;
  document.fire('keydown', { repeat: true });
  assert.equal(support.held(), false, 'held Space cannot rearm after Ready');
  document.fire('keyup');
  document.fire('keydown');
  assert.equal(support.held(), true);
  support.dispose();
  document.fire('keydown');
  button.fire('pointerdown', { pointerId: 4 });
  assert.equal(support.held(), false, 'disposed menus cannot retain input listeners');
});

test('room Support respects native menu editing and non-Team Space pause ownership', () => {
  const { document, button, state, support } = supportHarness();
  document.fire('keydown', { target: { closest: () => ({}) } });
  document.fire('keydown', { defaultPrevented: true });
  assert.equal(support.held(), false);
  state.team = false;
  button.fire('pointerdown', { pointerId: 3 });
  assert.equal(support.held(), false);
  document.fire('keydown');
  document.fire('keydown', { repeat: true });
  assert.equal(state.pauses, 1);
  support.dispose();
});

test('a delayed room audio unlock cannot silence a newer Ready activation', async () => {
  const pending = [],
    calls = [];
  let active = true;
  const activation = createRoomAudioActivation({
    sound: {
      enable: () => new Promise((resolve) => pending.push(resolve)),
      pause: () => calls.push('pause'),
      suspend: () => calls.push('suspend'),
    },
    active: () => active,
    onEnabled: () => calls.push('enabled'),
  });
  const previous = activation.enable();
  active = false;
  activation.suspend();
  active = true;
  const current = activation.enable();
  pending[1](true);
  await current;
  pending[0](true);
  await previous;
  assert.deepEqual(calls, ['suspend', 'enabled']);
  const abandoned = activation.enable();
  active = false;
  activation.suspend();
  pending[2](true);
  await abandoned;
  assert.deepEqual(calls, ['suspend', 'enabled', 'suspend']);
});

test('room activation keeps audio paused while the second Ready is pending', async () => {
  const calls = [];
  const activation = createRoomAudioActivation({
    sound: {
      enable: async () => true,
      pause: () => calls.push('pause'),
      suspend: () => calls.push('suspend'),
    },
    active: () => false,
    onEnabled: () => calls.push('enabled'),
  });
  await activation.enable();
  assert.deepEqual(calls, ['pause']);
});

test('reconnected paired boards discard frozen destruction while keeping settled remains and future catches', () => {
  const budget = createDestructionBudget({ now: () => 0 }),
    painters = [0, 1].map(() => createHuntDestruction({ budget, now: () => 0 })),
    view = (run) => ({ valid: true, eliminations: run.eliminations }),
    mark = (id) => ({
      id,
      family: 'runner',
      kind: 'runner',
      tick: 11,
      x: 3,
      y: 4,
      cause: 'contact',
    });
  let runs = [0, 1].map(() => ({ tick: 10, eliminations: [], cells: new Uint8Array([0, 1]) }));
  for (const [board, run] of runs.entries()) painters[board].advance(view(run), 0, { key: run });

  const firstOwners = [...runs];
  runs = reconcileRoomPresentationRuns(
    runs,
    runs.map((run, board) => ({ ...run, tick: 11, eliminations: [mark(`before-${board}`)] })),
  );
  for (const [board, run] of runs.entries()) {
    assert.strictEqual(
      run,
      firstOwners[board],
      'Ordinary polls retain live presentation continuity',
    );
    painters[board].advance(view(run), 0, { key: run });
    assert.equal(painters[board].snapshot().bursts, 1);
    painters[board].advance(view(run), 0.1, { key: run, paused: true });
    assert.equal(
      painters[board].snapshot().bursts,
      1,
      'A paused frame alone freezes its old burst',
    );
  }

  const restored = structuredClone(runs),
    beforeRecovery = structuredClone(runs);
  runs = reconcileRoomPresentationRuns(runs, restored, { recovering: true });
  for (const [board, run] of runs.entries()) {
    assert.notStrictEqual(run, firstOwners[board]);
    assert.strictEqual(run, restored[board], 'Recovery adopts the exact received board');
    assert.deepEqual(
      firstOwners[board],
      beforeRecovery[board],
      'Retirement does not mutate the old board',
    );
    assert.equal(run.eliminations.length, 1, 'Settled remains remain authoritative');
    assert.deepEqual([...run.cells], [0, 1]);
    painters[board].advance(view(run), 0, { key: run, paused: true });
    assert.equal(
      painters[board].snapshot().bursts,
      0,
      'Old bursts are retired while waiting for Ready',
    );
    painters[board].advance(view(run), 0, { key: run });
    assert.equal(painters[board].snapshot().bursts, 0, 'Ready cannot replay a restored catch');
  }
  assert.equal(budget.snapshot().owners, 0);

  runs = reconcileRoomPresentationRuns(
    runs,
    runs.map((run, board) => ({
      ...run,
      tick: 12,
      eliminations: [...run.eliminations, { ...mark(`after-${board}`), tick: 12 }],
    })),
  );
  for (const [board, run] of runs.entries()) {
    painters[board].advance(view(run), 0, { key: run });
    painters[board].advance(view(run), 0, { key: run });
    assert.equal(
      painters[board].snapshot().bursts,
      1,
      'A fresh live catch emits once on each board',
    );
    painters[board].reset();
  }
  assert.equal(budget.snapshot().owners, 0);
});

test('initial and rematched presentation runs receive independent ownership even at identical ticks', () => {
  const first = [{ tick: 0, eliminations: [] }],
    rematch = [{ tick: 0, eliminations: [] }];
  assert.strictEqual(reconcileRoomPresentationRuns(null, first), first);
  const next = reconcileRoomPresentationRuns(first, rematch, { replacement: true });
  assert.strictEqual(next, rematch);
  assert.notStrictEqual(next[0], first[0]);
});

const teamRun = () => ({
  status: 'running',
  tick: 10,
  time: 1,
  totalClaimable: 4,
  cells: new Uint8Array([1, 0, 0, 0]),
  events: [
    { type: 'cells.claimed', tick: 10, time: 1, indices: [0] },
    { type: 'cut.joint', tick: 10, time: 1, players: [0, 1] },
  ],
  eliminations: [{ id: 'caught-before-recovery' }],
});

test('Team room recovery primes native capture/outcome feedback silently without altering authoritative state', () => {
  const projection = createRoomBoardPresentation(),
    run = teamRun(),
    captures = createCoopCaptureFeedback(),
    outcomes = createTeamOutcomeFeedback(),
    before = structuredClone(run);
  const recovered = projection.project(run, { paused: true });
  assert.equal(recovered.status, 'paused');
  assert.deepEqual(run, before);
  assert.strictEqual(recovered.cells, run.cells, 'settled topology remains exact');
  assert.strictEqual(recovered.eliminations, run.eliminations, 'settled remains remain available');
  assert.deepEqual(captures.observe(recovered), []);
  assert.deepEqual(outcomes.observe(recovered), []);
  const resumed = projection.project(run);
  assert.strictEqual(resumed, recovered);
  assert.equal(resumed.status, 'running');
  assert.deepEqual(captures.observe(resumed), []);
  assert.deepEqual(outcomes.observe(resumed), []);
  run.tick++;
  run.time += 0.1;
  run.events = run.events.map((event) => ({ ...event, tick: run.tick, time: run.time }));
  const next = projection.project(run);
  assert.equal(captures.observe(next).length, 1, 'new live capture remains visible');
  assert.equal(outcomes.observe(next).length, 1, 'new live joint cut remains visible');
});

test('a new room presentation owner clears old effects while paused snapshots cannot leak on resume', () => {
  const projection = createRoomBoardPresentation(),
    run = teamRun();
  const initial = projection.project(run);
  run.tick++;
  projection.project(run, { paused: true });
  assert.deepEqual(projection.project(run).events, []);
  assert.strictEqual(projection.project(run), initial);
  projection.reset();
  const recovered = projection.project(run);
  assert.notStrictEqual(recovered, initial, 'native painter gets a fresh owner after recovery');
  assert.deepEqual(recovered.events, []);
  run.status = 'won';
  assert.equal(
    projection.project(run, { paused: true }).status,
    'won',
    'native terminal state wins',
  );
});
