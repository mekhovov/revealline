import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_SNAKE_V4_LEVELS } from '../snake/classic-catalogue-v4.mjs';
import {
  createClassicSnake,
  stepClassicSnake,
  queueClassicSnakeTurn,
  exportClassicSnakeReplay,
  restoreClassicSnakeReplay,
  classicSnakeSignalView,
} from '../snake/classic-core.mjs';
import { drawClassicBoard } from '../snake/classic-view.mjs';
import { createClassicSnakeMatch } from '../snake/classic-match.mjs';
import {
  captureClassicSignalTerrain,
  classicSignalBlend,
  classicSignalStrength,
  classicSignalPixels,
  drawClassicSignalInterference,
  drawClassicSignalSources,
  CLASSIC_SIGNAL_MAX_BLEND,
  CLASSIC_SIGNAL_MAX_TEAR_CELLS,
} from '../snake/classic-signal-view.mjs';

const level = CLASSIC_SNAKE_V4_LEVELS.find(
  (entry) => entry.id === 'classic-field-signal-check',
).level;
function advanceTo(run, phase) {
  for (let i = 0; i < 90 && run.targets[0].phase !== phase; i++) {
    const head = run.snakes[0].body[0];
    if (head.x === 20 && head.y === 2) queueClassicSnakeTurn(run, 0, 'down');
    if (head.x === 20 && head.y === 15) queueClassicSnakeTurn(run, 0, 'left');
    if (head.x === 3 && head.y === 15) queueClassicSnakeTurn(run, 0, 'up');
    if (head.x === 3 && head.y === 2) queueClassicSnakeTurn(run, 0, 'right');
    stepClassicSnake(run);
    assert.equal(run.status, 'running');
  }
  assert.equal(run.targets[0].phase, phase);
}
function render(run, options = {}) {
  const calls = [];
  let effectDraws = 0;
  const ctx = new Proxy(
    {},
    {
      get: (target, key) =>
        target[key] ??
        ((...args) => calls.push([key, ...args, target.fillStyle, target.globalAlpha])),
    },
  );
  const canvas = { width: 0, height: 0, style: {}, getContext: () => ctx };
  drawClassicBoard(canvas, run, { effects: { draw: () => effectDraws++ }, ...options });
  return { calls, effectDraws };
}
const pixels = (width, height, color) => {
  const image = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < image.length; i += 4) image.set([...color, 255], i);
  return image;
};

test('jammer conceals enemy effects while retaining live players and source/radius cues', () => {
  const run = createClassicSnake(level, { hazardSeed: 17 });
  advanceTo(run, 'warning');
  const warning = render(run);
  assert.equal(warning.effectDraws, 1);
  assert.ok(warning.calls.some(([method, , , radius]) => method === 'arc' && radius === 6 * 28));
  assert.ok(
    !warning.calls.some(([method]) => method === 'fillText'),
    'status text belongs outside the board',
  );
  advanceTo(run, 'jamming');
  const before = exportClassicSnakeReplay(run);
  for (const reduced of [false, true]) {
    const drawn = render(run, { reduced });
    assert.equal(drawn.effectDraws, 0, 'enemy effects cannot leak through the receiver');
    assert.ok(drawn.calls.some(([method, , , radius]) => method === 'arc' && radius === 6 * 28));
    assert.ok(
      !drawn.calls.some(([method, text]) => method === 'fillText' && text === 'SIGNAL LOST'),
    );
    const shifted = structuredClone(run);
    shifted.snakes[0].body[0].x -= 1;
    assert.notDeepEqual(
      drawn.calls,
      render(shifted, { reduced }).calls,
      'new head positions stay live',
    );
  }
  assert.deepEqual(
    exportClassicSnakeReplay(run),
    before,
    'rendering does not advance RNG, deadlines, or inputs',
  );
});

function hiddenActors(run) {
  const head = run.snakes[0].body[0];
  // These are render-only fixtures: deliberately cover nearby, distant, and
  // relay-linked actors without inventing a playable authored recipe.
  run.targets.push(
    { id: 900, kind: 'runner', x: head.x - 1, y: head.y, heading: 'left', policyIndex: 0 },
    { id: 901, kind: 'runner', x: 19, y: 13, heading: 'right', policyIndex: 0 },
    { id: 902, kind: 'relay', x: 9, y: 9, heading: 'up', policyIndex: 0, phase: 'open' },
  );
  run.relays.push({ ownerId: 902, x: 4, y: 10, collected: false });
  run.recentCatches.push({ kind: 'runner', x: 17, y: 13, tick: run.tick });
  return run;
}

test('every enemy, including nearby prey and the jammer body, disappears before receiver sampling', () => {
  const run = createClassicSnake(level, { hazardSeed: 17 });
  advanceTo(run, 'jamming');
  hiddenActors(run);
  assert.ok(classicSignalStrength(run, classicSnakeSignalView(run)) > 0);
  const changed = structuredClone(run);
  for (const target of changed.targets) {
    target.heading = target.heading === 'left' ? 'down' : 'left';
    if (target.kind !== 'jammer') {
      target.x = (target.x + 3) % level.width;
      target.y = (target.y + 5) % level.height;
    }
  }
  changed.recentCatches[0].x--;
  for (const boardStyle of ['theme', 'retro', 'living-circuit'])
    for (const reduced of [false, true])
      for (const signalTreatment of ['baseline', 'snow-only', 'contrast-loss']) {
        const options = { boardStyle, reduced, signalTreatment };
        assert.deepEqual(
          render(run, options),
          render(changed, options),
          `${boardStyle}/${reduced}/${signalTreatment}: invisible positions, headings, remains and relay links leave no paint commands`,
        );
        const diagnostic = { ...options, signalDiagnosticOriginal: true };
        assert.notDeepEqual(
          render(run, diagnostic),
          render(changed, diagnostic),
          'the original actor comparison requires an explicit fixture flag',
        );
      }
  const noPrey = structuredClone(run);
  noPrey.targets = noPrey.targets.filter((target) => target.kind === 'jammer');
  noPrey.relays = [];
  run.relays = [];
  assert.deepEqual(render(run), render(noPrey), 'all prey, badges and shadows are omitted');
});

test('the minimal source beacon survives concealment without exposing jammer sprite orientation', () => {
  const run = createClassicSnake(level, { hazardSeed: 17 });
  advanceTo(run, 'jamming');
  const source = run.targets[0];
  const drawn = render(run);
  source.heading = source.heading === 'down' ? 'left' : 'down';
  assert.deepEqual(drawn, render(run), 'jammer body/facing is not drawn');
  const x = (source.x + 0.5) * 28,
    y = (source.y + 0.5) * 28;
  assert.ok(
    drawn.calls.some(([method, cx, cy]) => method === 'lineTo' && cx === x && cy === y - 10),
    'one small radio antenna identifies the source',
  );
  assert.ok(
    !drawn.calls.some(
      ([method, cx, cy]) => method === 'translate' && cx === source.x * 28 && cy === source.y * 28,
    ),
    'the source actor and badge painter is never entered',
  );
});

test('Solo, Team, Versus, and restored replay use the same all-enemy concealment', () => {
  const accepted = createClassicSnake(level, { hazardSeed: 17 });
  advanceTo(accepted, 'jamming');
  assert.deepEqual(
    render(accepted),
    render(restoreClassicSnakeReplay(exportClassicSnakeReplay(accepted))),
  );
  for (const mode of ['solo', 'team', 'versus']) {
    const match = createClassicSnakeMatch(level, { mode, hazardSeed: 17 });
    for (const run of match.runs) {
      // Mode layouts exercise the shared painter. Engine replay equivalence is
      // checked above on the accepted run, before any render-fixture changes.
      run.targets = structuredClone(accepted.targets);
      run.tick = accepted.tick;
      run.elapsedMs = accepted.elapsedMs;
      run.snakes[0].body = structuredClone(accepted.snakes[0].body);
      const view = hiddenActors(structuredClone(run));
      if (mode === 'team') {
        const second = view.snakes[1].body[0];
        view.targets.push({
          id: 903,
          kind: 'runner',
          x: second.x + 1,
          y: second.y,
          policyIndex: 0,
        });
      }
      const empty = structuredClone(view);
      empty.targets = empty.targets.filter((target) => target.kind === 'jammer');
      view.relays = empty.relays = [];
      assert.deepEqual(render(view), render(empty), `${mode}: no near-head visibility exception`);
    }
  }
});

test('Pulse, radius exit, source capture and terminal outcomes immediately reveal actors', () => {
  const run = createClassicSnake(level, { hazardSeed: 17 });
  advanceTo(run, 'jamming');
  assert.equal(render(run).effectDraws, 0);
  const check = (label, change) => {
    const view = hiddenActors(structuredClone(run));
    change(view);
    assert.equal(classicSignalStrength(view, classicSnakeSignalView(view)), 0, label);
    assert.equal(render(view).effectDraws, 1, `${label}: enemy effects resume immediately`);
    assert.deepEqual(
      render(view),
      render(view, { signalDiagnosticOriginal: true }),
      `${label}: the full normal actor feed is restored`,
    );
    const moved = structuredClone(view);
    moved.targets.find((target) => target.id === 900).x--;
    assert.notDeepEqual(render(view), render(moved), `${label}: live target positions are visible`);
  };
  check('Pulse', (view) => (view.pulseTicks = 3));
  check('outside local radius', (view) => (view.snakes[0].body[0] = { x: 0, y: 0 }));
  check(
    'source captured',
    (view) => (view.targets = view.targets.filter((t) => t.kind !== 'jammer')),
  );
  check('burst ended', (view) => (view.targets[0].phase = 'rest'));
  for (const status of ['lost', 'won']) check(status, (view) => (view.status = status));
});

test('concealed moving prey continues turning with identical simulation and replay state', () => {
  const fixture = structuredClone(level);
  fixture.targets.maxActive = 2;
  fixture.targets.required = [
    { ...fixture.targets.required[0], at: { x: 18, y: 8 }, signalProfile: 'broadcast-burst-v1' },
    {
      kind: 'patroller',
      every: 4,
      path: [
        { x: 8, y: 10 },
        { x: 9, y: 10 },
        { x: 9, y: 11 },
        { x: 8, y: 11 },
      ],
    },
  ];
  const run = createClassicSnake(fixture, { hazardSeed: 17 });
  advanceTo(run, 'jamming');
  const expected = restoreClassicSnakeReplay(exportClassicSnakeReplay(run));
  const headings = new Set(),
    positions = new Set();
  for (let i = 0; i < 80; i++) {
    if (classicSignalStrength(run, classicSnakeSignalView(run)) > 0) {
      const prey = run.targets.find((target) => target.kind === 'patroller');
      headings.add(prey.heading);
      positions.add(`${prey.x},${prey.y}`);
      const withoutPrey = structuredClone(run);
      withoutPrey.targets = withoutPrey.targets.filter((target) => target.kind === 'jammer');
      assert.deepEqual(
        render(run),
        render(withoutPrey),
        'current moving prey leaves no visible trace',
      );
    }
    const before = exportClassicSnakeReplay(run);
    render(run, { reduced: true, flight: { timeMs: i * 100 } });
    assert.deepEqual(exportClassicSnakeReplay(run), before);
    for (const current of [run, expected]) {
      const head = current.snakes[0].body[0];
      if (head.x === 20 && head.y === 2) queueClassicSnakeTurn(current, 0, 'down');
      if (head.x === 20 && head.y === 15) queueClassicSnakeTurn(current, 0, 'left');
      if (head.x === 3 && head.y === 15) queueClassicSnakeTurn(current, 0, 'up');
      if (head.x === 3 && head.y === 2) queueClassicSnakeTurn(current, 0, 'right');
      stepClassicSnake(current);
      assert.equal(current.status, 'running');
    }
    assert.deepEqual(run, expected, 'rendering never freezes, turns, or advances an enemy');
  }
  assert.ok(positions.size > 1, 'hidden prey moved');
  assert.ok(headings.size > 1, 'hidden prey turned');
  assert.deepEqual(restoreClassicSnakeReplay(exportClassicSnakeReplay(run)), run);
});

test('receiver strength follows local radius, broadcast scope, Pulse, and terminal outcomes', () => {
  const run = createClassicSnake(level, { hazardSeed: 17 });
  const source = { id: 'radio', x: 10, y: 8, radius: 6, phase: 'jamming' };
  const signal = { active: true, suppressed: false, sources: [source] };
  run.snakes[0].body[0] = { x: 10, y: 9 };
  const near = classicSignalStrength(run, signal);
  run.snakes[0].body[0] = { x: 15, y: 8 };
  assert.ok(classicSignalStrength(run, signal) < near);
  run.snakes[0].body[0] = { x: 17, y: 8 };
  assert.equal(classicSignalStrength(run, signal), 0);
  source.radius = null;
  assert.equal(classicSignalStrength(run, signal), 1);
  assert.equal(classicSignalStrength(run, { ...signal, suppressed: true }), 0);
  run.status = 'lost';
  assert.equal(classicSignalStrength(run, signal), 0);
});

test('local reception and coverage markings cross the same wrap seams as the engine', () => {
  const run = createClassicSnake(level, { hazardSeed: 17 });
  const source = { x: 0, y: 0, radius: 6, phase: 'jamming' };
  const signal = { active: true, sources: [source] };
  run.snakes[0].body[0] = { x: run.level.width - 1, y: run.level.height - 1 };
  run.level = { ...run.level, wrap: false };
  assert.equal(classicSignalStrength(run, signal), 0);
  run.level.wrap = true;
  assert.ok(classicSignalStrength(run, signal) > 0.8);
  const arcs = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_, method) =>
        (...args) => {
          if (method === 'arc') arcs.push(args);
        },
    },
  );
  drawClassicSignalSources(ctx, run, signal);
  const radiusArcs = arcs.filter(([, , radius]) => radius === 6 * 28);
  assert.deepEqual(
    radiusArcs.map(([x, y]) => [x, y]).sort(),
    [
      [14, 14],
      [14 + run.level.width * 28, 14],
      [14, 14 + run.level.height * 28],
      [14 + run.level.width * 28, 14 + run.level.height * 28],
    ].sort(),
  );
});

test('broadcast source uses two antenna masts and terminal outcomes have no live warning frame', () => {
  const run = createClassicSnake(level, { hazardSeed: 17 });
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get:
        (_, method) =>
        (...args) =>
          calls.push([method, ...args]),
    },
  );
  const source = { x: 10, y: 8, radius: null, phase: 'jamming' };
  drawClassicSignalSources(ctx, run, { active: true, sources: [source] });
  const x = 10.5 * 28,
    y = 8.5 * 28;
  assert.ok(calls.some(([method, cx, cy]) => method === 'lineTo' && cx === x - 3 && cy === y - 10));
  assert.ok(calls.some(([method, cx, cy]) => method === 'lineTo' && cx === x + 3 && cy === y - 10));
  assert.ok(calls.some(([method]) => method === 'strokeRect'));
  calls.length = 0;
  drawClassicSignalSources(ctx, run, { active: false, warning: false, sources: [source] });
  assert.ok(!calls.some(([method]) => method === 'strokeRect' || method === 'arc'));
});

test('pixel interference is bounded and preserves heads, nearby collision geometry, and source cells', () => {
  const width = 160,
    height = 120;
  const base = pixels(width, height, [230, 120, 35]);
  const output = classicSignalPixels(base, width, height, {
    frame: 4,
    seed: 93,
    columns: 16,
    rows: 12,
    heads: [{ x: 3, y: 3 }],
    sources: [{ x: 12, y: 8 }],
  });
  assert.equal(CLASSIC_SIGNAL_MAX_BLEND, 0.65);
  assert.equal(CLASSIC_SIGNAL_MAX_TEAR_CELLS, 0.15);
  const pixel = (image, x, y) => [...image.subarray((y * width + x) * 4, (y * width + x) * 4 + 4)];
  for (const [x, y] of [
    [35, 35],
    [15, 15],
    [55, 55],
    [125, 85],
  ])
    assert.deepEqual(pixel(output, x, y), pixel(base, x, y));
  assert.notDeepEqual(pixel(output, 100, 35), pixel(base, 100, 35));
  for (let i = 0; i < output.length; i += 4) {
    assert.equal(output[i + 3], 255);
    for (let channel = 0; channel < 3; channel++)
      assert.ok(Math.abs(output[i + channel] - base[i + channel]) <= Math.ceil(255 * 0.65));
  }
  assert.deepEqual(base, pixels(width, height, [230, 120, 35]), 'source remains untouched');
});

test('reduced effects freezes noise while new live source pixels still appear on every simulation tick', () => {
  const width = 64,
    height = 48;
  const base = pixels(width, height, [30, 70, 90]);
  const changed = pixels(width, height, [170, 130, 60]);
  const options = { seed: 27, columns: 16, rows: 12, reduced: true };
  const first = classicSignalPixels(base, width, height, { ...options, frame: 1 });
  assert.deepEqual(first, classicSignalPixels(base, width, height, { ...options, frame: 7 }));
  assert.notDeepEqual(first, classicSignalPixels(changed, width, height, { ...options, frame: 7 }));
  assert.notDeepEqual(
    classicSignalPixels(base, width, height, { ...options, reduced: false, frame: 1 }),
    classicSignalPixels(base, width, height, { ...options, reduced: false, frame: 7 }),
  );
});

test('pixel work buffers stay bounded and reusable across live samples', () => {
  const scratch = {},
    base = pixels(64, 48, [120, 80, 40]);
  const first = classicSignalPixels(base, 64, 48, { scratch });
  const torn = scratch.torn;
  assert.equal(classicSignalPixels(base, 64, 48, { scratch, frame: 2 }), first);
  assert.equal(scratch.torn, torn);
  classicSignalPixels(pixels(32, 24, [80, 90, 100]), 32, 24, { scratch });
  assert.equal(scratch.torn.length, 32 * 24 * 4);
  assert.equal(scratch.noisy.length, 32 * 24 * 4);
});

test('the readable head neighbourhood crosses real wrap seams', () => {
  const width = 160,
    height = 120,
    base = pixels(width, height, [180, 100, 60]);
  const options = { columns: 16, rows: 12, heads: [{ x: 0, y: 0 }] };
  const wrapped = classicSignalPixels(base, width, height, { ...options, wrap: true });
  const closed = classicSignalPixels(base, width, height, options);
  for (const [x, y] of [
    [155, 5],
    [5, 115],
    [145, 105],
  ]) {
    const at = (y * width + x) * 4;
    assert.deepEqual(wrapped.subarray(at, at + 4), base.subarray(at, at + 4));
    assert.notDeepEqual(closed.subarray(at, at + 4), base.subarray(at, at + 4));
  }
});

test('receiver sampling cache refreshes the live board for changed ticks in reduced effects', () => {
  let sampled = 0,
    current = 30,
    output;
  const scratch = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage() {
        sampled++;
      },
      getImageData: (x, y, width, height) => ({ data: pixels(width, height, [current, 90, 150]) }),
      putImageData(image) {
        output = new Uint8ClampedArray(image.data);
      },
    }),
  };
  const canvas = { width: 672, height: 504, ownerDocument: { createElement: () => scratch } };
  const run = createClassicSnake(level, { hazardSeed: 17 });
  advanceTo(run, 'jamming');
  const signal = classicSnakeSignalView(run);
  signal.sources[0].radius = null;
  const ctx = new Proxy({}, { get: (target, key) => target[key] ?? (() => {}) });
  drawClassicSignalInterference(ctx, canvas, run, signal, { reduced: true });
  const first = output;
  current = 180;
  run.tick++;
  drawClassicSignalInterference(ctx, canvas, run, signal, { reduced: true });
  assert.equal(sampled, 2);
  assert.notDeepEqual(output, first);
  assert.ok(scratch.width <= 320 && scratch.height <= 320);
  const options = { reduced: true, visualKey: 'orchard/art-v1' };
  drawClassicSignalInterference(ctx, canvas, run, signal, options);
  assert.equal(sampled, 3);
  drawClassicSignalInterference(ctx, canvas, run, signal, options);
  assert.equal(sampled, 3, 'unchanged paused appearance reuses receiver sample');
  current = 75;
  drawClassicSignalInterference(ctx, canvas, run, signal, {
    ...options,
    visualKey: 'workshop/art-v2',
  });
  assert.equal(
    sampled,
    4,
    'changed scene or actor revision refreshes paused reduced-effects sample',
  );
});

test('Pulse stabilizes the live board and losses reveal their collision state', () => {
  const run = createClassicSnake(level, { hazardSeed: 17 });
  advanceTo(run, 'jamming');
  const before = exportClassicSnakeReplay(run);
  run.pulseTicks = 8;
  const pulse = render(run);
  assert.equal(pulse.effectDraws, 1);
  assert.equal(classicSnakeSignalView(run).suppressed, true);
  assert.ok(!pulse.calls.some(([method]) => method === 'fillText'));
  run.pulseTicks = 0;
  assert.deepEqual(exportClassicSnakeReplay(run), before);
  run.status = 'lost';
  assert.equal(render(run).effectDraws, 1);
  assert.equal(classicSignalStrength(run, classicSnakeSignalView(run)), 0);
});

test('danger destination outlines are painted at native resolution after receiver interference', () => {
  const run = createClassicSnake(level, { hazardSeed: 17 });
  advanceTo(run, 'jamming');
  run.snakes[0].body[0] = { x: run.targets[0].x + 2, y: run.targets[0].y };
  run.projectiles = [{ x: 2, y: 6, heading: 'right' }];
  const { calls } = render(run);
  const receiver = calls.findLastIndex(
    ([method, , , width, height]) => method === 'fillRect' && width === 14 && height === 7,
  );
  const destination = calls.findLastIndex(
    ([method, x, y, width, height]) =>
      method === 'strokeRect' &&
      x === 3 * 28 + 4 &&
      y === 6 * 28 + 4 &&
      width === 20 &&
      height === 20,
  );
  assert.ok(receiver > 0, 'a real active receiver treatment is present');
  assert.ok(destination > receiver, 'danger outline is crisp above the processed feed');
});

test('concealed contact hazards retain only truthful lethal edges above interference', () => {
  const run = createClassicSnake(level, { hazardSeed: 17 });
  advanceTo(run, 'jamming');
  const x = 8,
    y = 11;
  const cases = [
    ['relay', 'locked', 'right', ['top', 'right', 'bottom', 'left']],
    ['relay', 'open', 'right', []],
    ['shield', 'moving', 'right', ['right']],
    ['shield', 'moving', 'left', ['left']],
    ['brace', 'warning', 'up', ['top', 'right', 'bottom', 'left']],
    ['brace', 'burst', 'up', ['top', 'right', 'bottom', 'left']],
    ['brace', 'rest', 'up', []],
    ['guard', 'rest', 'up', []],
    ['lane', 'rest', 'up', []],
    ['runner', 'moving', 'up', []],
  ];
  const edges = {
    top: [x * 28 + 2, y * 28 + 2, x * 28 + 26, y * 28 + 2],
    right: [x * 28 + 26, y * 28 + 2, x * 28 + 26, y * 28 + 26],
    bottom: [x * 28 + 2, y * 28 + 26, x * 28 + 26, y * 28 + 26],
    left: [x * 28 + 2, y * 28 + 2, x * 28 + 2, y * 28 + 26],
  };
  for (const [kind, phase, heading, lethal] of cases) {
    const view = structuredClone(run);
    view.targets.push({ id: 999, kind, phase, heading, x, y, policyIndex: 0 });
    const { calls } = render(view);
    const receiver = calls.findLastIndex(
      ([method, , , width, height]) => method === 'fillRect' && width === 14 && height === 7,
    );
    for (const [edge, [left, top, right, bottom]] of Object.entries(edges)) {
      const index = calls.findIndex(
        ([method, cx, cy], i) =>
          method === 'moveTo' &&
          cx === left &&
          cy === top &&
          calls[i + 1]?.[0] === 'lineTo' &&
          calls[i + 1][1] === right &&
          calls[i + 1][2] === bottom,
      );
      assert.equal(index > receiver, lethal.includes(edge), `${kind}/${phase}/${heading}: ${edge}`);
    }
    assert.ok(
      !calls.some(([method, cx, cy]) => method === 'translate' && cx === x * 28 && cy === y * 28),
      `${kind}: hazard information does not restore actor art`,
    );
  }
});

function contrastGain({
  treatment,
  strength = 1,
  reduced = false,
  frame = 0,
  protectedTarget = false,
}) {
  const width = 160,
    height = 120;
  const terrain = pixels(width, height, [100, 100, 100]);
  const actor = new Uint8ClampedArray(terrain);
  const left = protectedTarget ? 25 : 100,
    top = protectedTarget ? 25 : 70;
  for (let y = top; y < top + 20; y++)
    for (let x = left; x < left + 20; x++) {
      const at = (y * width + x) * 4;
      actor[at] = actor[at + 1] = actor[at + 2] = 180;
    }
  const options = {
    terrain,
    treatment,
    strength,
    reduced,
    frame,
    seed: 93,
    columns: 16,
    rows: 12,
    heads: [{ x: 3, y: 3 }],
  };
  const empty = classicSignalPixels(terrain, width, height, options);
  const occupied = classicSignalPixels(actor, width, height, options);
  let delta = 0;
  for (let y = top; y < top + 20; y++)
    for (let x = left; x < left + 20; x++) {
      const at = (y * width + x) * 4;
      delta += Math.abs(occupied[at] - empty[at]);
    }
  return delta / (20 * 20 * 80);
}

test('diagnostic original filter comparison bounds the live terrain/player contrast fraction', () => {
  for (const reduced of [false, true])
    for (const strength of [0.25, 0.625, 1])
      for (const frame of [0, 3, 7, 11]) {
        const options = { strength, reduced, frame };
        const baseline = contrastGain({ ...options, treatment: 'baseline' });
        const snow = contrastGain({ ...options, treatment: 'snow-only' });
        const selected = contrastGain({ ...options, treatment: 'contrast-loss' });
        const liveFraction = 1 - classicSignalBlend(strength);
        assert.ok(
          Math.abs(selected - liveFraction) < 0.0125,
          `only live ${liveFraction} carries distant actor detail: ${selected}`,
        );
        assert.ok(selected < baseline - 0.3);
        assert.ok(selected < snow - 0.2, 'snow alone leaves substantially more actor structure');
        assert.equal(
          contrastGain({ ...options, treatment: 'contrast-loss', protectedTarget: true }),
          1,
        );
      }
  assert.ok(classicSignalBlend(0.25) >= 0.5, 'the coverage edge already changes distant tracking');
  assert.equal(classicSignalBlend(0), 0);
  assert.equal(classicSignalBlend(1), 0.65);
});

test('reduced effects retains the same terrain/player contrast limit with a stationary mask', () => {
  const terrain = pixels(64, 48, [30, 70, 90]);
  const live = pixels(64, 48, [180, 140, 80]);
  const options = { terrain, seed: 27, columns: 16, rows: 12, reduced: true };
  const first = classicSignalPixels(live, 64, 48, { ...options, frame: 1 });
  assert.deepEqual(first, classicSignalPixels(live, 64, 48, { ...options, frame: 7 }));
  assert.notDeepEqual(
    first,
    classicSignalPixels(terrain, 64, 48, options),
    'the untouched live fraction still updates inside the stationary mask',
  );
});

function canvasReceiver({ readFailure = false } = {}) {
  let current = 30,
    sampled = 0,
    output;
  const surface = {
    width: 0,
    height: 0,
    getContext: () => ({
      drawImage() {
        sampled++;
      },
      getImageData: (x, y, width, height) => {
        if (readFailure) throw new Error('Tainted custom skin');
        return { data: pixels(width, height, [current, current, current]) };
      },
      putImageData(image) {
        output = new Uint8ClampedArray(image.data);
      },
    }),
  };
  const canvas = { width: 2016, height: 1512, ownerDocument: { createElement: () => surface } };
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get: (target, key) =>
        target[key] ?? ((...args) => calls.push([key, ...args, target.globalAlpha])),
    },
  );
  return {
    canvas,
    ctx,
    calls,
    current(value) {
      current = value;
    },
    get sampled() {
      return sampled;
    },
    get output() {
      return output;
    },
  };
}

test('current terrain capture excludes actors and expires on tick, appearance, and run identity', () => {
  const receiver = canvasReceiver();
  const run = createClassicSnake(level, { hazardSeed: 17 });
  advanceTo(run, 'jamming');
  const signal = classicSnakeSignalView(run);
  signal.sources[0].radius = null;
  const options = { reduced: true, visualKey: 'workshop' };
  receiver.current(30);
  captureClassicSignalTerrain(receiver.canvas, run, options);
  receiver.current(180);
  drawClassicSignalInterference(receiver.ctx, receiver.canvas, run, signal, options);
  const first = receiver.output;
  assert.equal(receiver.sampled, 2);
  captureClassicSignalTerrain(receiver.canvas, run, options);
  drawClassicSignalInterference(receiver.ctx, receiver.canvas, run, signal, options);
  assert.equal(receiver.sampled, 2, 'an unchanged accepted tick reuses the current terrain');
  run.tick++;
  drawClassicSignalInterference(receiver.ctx, receiver.canvas, run, signal, options);
  assert.notDeepEqual(receiver.output, first, 'an expired terrain frame cannot be reused');
  receiver.current(70);
  captureClassicSignalTerrain(receiver.canvas, run, options);
  receiver.current(180);
  drawClassicSignalInterference(receiver.ctx, receiver.canvas, run, signal, options);
  const changed = receiver.output;
  assert.notDeepEqual(changed, first, 'terrain changes arrive in the next accepted tick');
  drawClassicSignalInterference(receiver.ctx, receiver.canvas, run, signal, {
    ...options,
    visualKey: 'orchard',
  });
  assert.notDeepEqual(receiver.output, changed, 'appearance changes invalidate the old terrain');
  const replacement = structuredClone(run);
  drawClassicSignalInterference(receiver.ctx, receiver.canvas, replacement, signal, options);
  assert.notDeepEqual(receiver.output, changed, 'a new run cannot inherit the old terrain');
});

test('native composition leaves overlapping Team neighbourhoods and wrap seams untouched', () => {
  const receiver = canvasReceiver();
  const run = createClassicSnake(level, { hazardSeed: 17 });
  run.level = { ...run.level, wrap: true };
  run.snakes = [
    { alive: true, body: [{ x: 0, y: 0 }] },
    { alive: true, body: [{ x: 1, y: 1 }] },
  ];
  const source = { x: 10, y: 8, phase: 'jamming', radius: null };
  drawClassicSignalInterference(receiver.ctx, receiver.canvas, run, {
    active: true,
    sources: [source],
  });
  const rectangles = receiver.calls.filter(([method]) => method === 'rect');
  const covered = (x, y) =>
    rectangles.some(
      ([, left, top, width, height]) =>
        (x + 0.5) * 28 >= left &&
        (x + 0.5) * 28 < left + width &&
        (y + 0.5) * 28 >= top &&
        (y + 0.5) * 28 < top + height,
    );
  for (const [x, y] of [
    [0, 0],
    [1, 1],
    [3, 3],
    [23, 17],
    [22, 16],
    [10, 8],
  ])
    assert.equal(covered(x, y), false, `native protected cell ${x},${y} stays sharp`);
  assert.equal(covered(12, 12), true);
  const draws = receiver.calls.filter(([method]) => method === 'drawImage');
  assert.equal(draws.length, 1, 'only the processed layer is drawn over the native live field');
  assert.equal(draws[0].at(-1), 0.65, 'the clean native feed retains its full 35% contribution');
});

test('readback failure uses equally bounded procedural interference without a weak stripe bypass', () => {
  for (const preCapture of [false, true]) {
    const receiver = canvasReceiver({ readFailure: true });
    const run = createClassicSnake(level, { hazardSeed: 17 });
    const signal = { active: true, sources: [{ x: 10, y: 8, phase: 'jamming', radius: null }] };
    if (preCapture) captureClassicSignalTerrain(receiver.canvas, run);
    assert.doesNotThrow(() =>
      drawClassicSignalInterference(receiver.ctx, receiver.canvas, run, signal),
    );
    const fills = receiver.calls.filter(([method]) => method === 'fillRect');
    assert.ok(fills.length > 0);
    assert.ok(fills.every((call) => call.at(-1) === 0.65));
    assert.equal(
      fills.reduce((area, [, , , width, height]) => area + width * height, 0),
      run.level.width * run.level.height * 28 * 28,
      'receiver rectangles cover the board once, so opacity cannot compound below the live floor',
    );
    assert.ok(
      receiver.calls.findIndex(([method]) => method === 'clip') <
        receiver.calls.findIndex(([method]) => method === 'fillRect'),
      'native safety clip applies to fallback',
    );
  }
});

test('paused receiver refreshes when asynchronous wall artwork becomes available', () => {
  const run = createClassicSnake(level, { hazardSeed: 17 });
  advanceTo(run, 'jamming');
  const receiver = canvasReceiver();
  receiver.canvas.getContext = () => receiver.ctx;
  receiver.canvas.style = {};
  let wall = null;
  const presentation = { image: () => wall };
  drawClassicBoard(receiver.canvas, run, { presentation, reduced: true });
  const sampled = receiver.sampled;
  drawClassicBoard(receiver.canvas, run, { presentation, reduced: true });
  assert.equal(receiver.sampled, sampled, 'same paused image reuses its receiver');
  wall = { width: 32, height: 32 };
  drawClassicBoard(receiver.canvas, run, { presentation, reduced: true });
  assert.equal(
    receiver.sampled,
    sampled + 2,
    'asset arrival refreshes both terrain and live receiver',
  );
});

test('leaving an explicit original-comparison fixture cannot reuse its enemy-bearing receiver', () => {
  const run = createClassicSnake(level, { hazardSeed: 17 });
  advanceTo(run, 'jamming');
  const receiver = canvasReceiver();
  receiver.canvas.getContext = () => receiver.ctx;
  receiver.canvas.style = {};
  drawClassicBoard(receiver.canvas, run, { reduced: true, signalDiagnosticOriginal: true });
  const originalSamples = receiver.sampled;
  drawClassicBoard(receiver.canvas, run, { reduced: true });
  assert.equal(
    receiver.sampled,
    originalSamples + 2,
    'terrain and receiver both discard the original fixture',
  );
  drawClassicBoard(receiver.canvas, run, { reduced: true });
  assert.equal(receiver.sampled, originalSamples + 2, 'unchanged concealed image is reusable');
});
