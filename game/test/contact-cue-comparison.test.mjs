import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { contactCueUnderstroke } from '../ui/contact-cue.mjs';
import { drawPreparedPilotContact } from '../couch/coop-pilot-cues.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createCoop, startCoop } from '../coop/core.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';

const presets = JSON.parse(
    readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url)),
  ),
  compiled = JSON.parse(
    readFileSync(new URL('../presentation/compiled/runtime.json', import.meta.url)),
  ),
  theme = JSON.parse(readFileSync(new URL('../content/packs/fpv-arcade-r4.json', import.meta.url)))
    .themes[0],
  fine = Object.freeze({ contactStyle: 'fine-outline' });

// Real renderer command evidence with finite prepared-image stand-ins. These
// checks do not claim decoded raster contrast or physical-display readability.
function surface(width = 1152) {
  const calls = [],
    stack = [];
  let matrix = [1, 0, 0, 1, 0, 0],
    path = [];
  const multiply = ([a, b, c, d, e, f]) => {
    const [m, n, o, p, q, r] = matrix;
    matrix = [
      m * a + o * b,
      n * a + p * b,
      m * c + o * d,
      n * c + p * d,
      m * e + o * f + q,
      n * e + p * f + r,
    ];
  };
  let values = {
    fillStyle: '',
    strokeStyle: '',
    globalAlpha: 1,
    lineWidth: 1,
    imageSmoothingEnabled: true,
  };
  const canvas = { width: 1152, height: 576, clientWidth: width };
  const ctx = new Proxy(
    { canvas },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key in values) return values[key];
        return (...args) => {
          calls.push({
            op: key,
            args,
            state: { ...values },
            ...(['fill', 'stroke'].includes(key) ? { path: path.map((part) => [...part]) } : {}),
          });
          if (key === 'save') stack.push({ values: { ...values }, matrix: [...matrix] });
          if (key === 'restore') ({ values, matrix } = stack.pop());
          if (key === 'scale') multiply([args[0], 0, 0, args[1], 0, 0]);
          if (key === 'translate') multiply([1, 0, 0, 1, args[0], args[1]]);
          if (key === 'rotate') {
            const c = Math.cos(args[0]),
              s = Math.sin(args[0]);
            multiply([c, s, -s, c, 0, 0]);
          }
          if (key === 'beginPath') path = [];
          if (key === 'arc') {
            const [x, y, radius, start, end] = args,
              [a, b, c, d, e, f] = matrix;
            path.push([
              'arc',
              a * x + c * y + e,
              b * x + d * y + f,
              radius * Math.hypot(a, b),
              radius * Math.hypot(c, d),
              start,
              end,
            ]);
          }
          if (['moveTo', 'lineTo', 'rect', 'closePath'].includes(key)) path.push([key, ...args]);
        };
      },
      set(_target, key, value) {
        values[key] = value;
        return true;
      },
    },
  );
  canvas.getContext = () => ctx;
  return { canvas, ctx, calls, stack };
}
function snapshot() {
  const images = new Map();
  for (const [slot, asset] of Object.entries(compiled.resolved.assets))
    if (asset.kind === 'image')
      images.set(slot, {
        asset,
        image: { slot, width: asset.file.width, height: asset.file.height },
        geometry: imagePresentation(asset),
      });
  return {
    resolved: compiled.resolved,
    canvas: { palette: theme.palette, motionScale: 1 },
    fonts: { ui: 'Test UI', numeric: 'Test Numbers' },
    image: (slot) => images.get(slot) ?? null,
  };
}
function soloPainter(prepared, Constructor = BoardPainter) {
  const p = new Constructor(presets);
  p.theme = theme;
  p.bodyId = presets.characterPresentations.sets.find(
    (set) => set.themeId === 'fpv',
  ).classBodies.scout;
  p.body = presets.characters[p.bodyId];
  p.recipe = presets.animationRecipes[p.body.animationRecipe];
  p.background = { width: 1152, height: 576, id: 'retained-picture' };
  p.enemyBodies = { update() {}, current: () => null };
  if (prepared) p.setPresentation(snapshot());
  return p;
}
function soloRun(scenario = 'edge') {
  const run = createRun({
    version: 'xonix-level.v4',
    id: 'contact-comparison',
    revision: '1',
    name: 'Contact comparison',
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 36.5, y: 0.5 },
    goal: { coverage: 0.99 },
    classic: { version: 'classic.v1', terrain: [], powerups: [] },
    enemies: [{ id: 'hunter', type: 'bouncer', x: 20.5, y: 12.5, vx: 2, vy: 1, radius: 0.25 }],
    rules: { moveSpeed: 12, lives: 3, stopOnCapture: true },
  });
  if (scenario === 'trail')
    for (let n = 0; n < 24; n++) stepRun(run, { direction: 'down' }, FIXED_DT);
  if (scenario === 'recovery') {
    // A bounded visual-state fixture, not a claim of an earned game outcome.
    run.status = 'respawning';
    run.player.graceUntil = run.time + 2;
  }
  return run;
}
function teamRun(scenario = 'edge') {
  const run = startCoop(createCoop(RELAY_YARD));
  if (scenario === 'recovery') run.players[0].graceUntil = run.time + 2;
  if (scenario === 'downed') run.players[1].status = 'downed';
  return run;
}
function differences(a, b) {
  assert.equal(a.length, b.length, 'Every existing drawing command remains in the same order.');
  return a.flatMap((call, i) => (JSON.stringify(call) === JSON.stringify(b[i]) ? [] : [i]));
}
function assertOnlyUnderstrokeChanges(before, after, expected, units) {
  const indices = differences(before, after);
  assert.equal(indices.length, expected);
  for (const index of indices) {
    const a = before[index],
      b = after[index];
    assert.equal(a.op, 'stroke');
    assert.ok(Math.abs(a.state.lineWidth * units - 3) < 1e-12);
    assert.ok(Math.abs(b.state.lineWidth * units - 2) < 1e-12);
    assert.deepEqual({ ...b, state: { ...b.state, lineWidth: a.state.lineWidth } }, a);
    const circle = before.slice(0, index).findLast((call) => call.op === 'arc');
    assert.deepEqual(circle.args.slice(3), [0, Math.PI * 2], 'The full circle remains.');
    assert.deepEqual(after[index + 1], before[index + 1], 'The bright core is unchanged.');
    assert.equal(before[index + 1].op, 'stroke');
    assert.ok(Math.abs(before[index + 1].state.lineWidth * units - 1) < 1e-12);
  }
  return indices;
}

// Cases begin.
test('contact style accepts one exact opt-in token and always returns a bounded visible stroke', () => {
  assert.equal(contactCueUnderstroke('fine-outline'), 2);
  for (const input of [
    undefined,
    null,
    '',
    'default',
    'none',
    'fine',
    'FINE-OUTLINE',
    0,
    -1,
    Infinity,
    NaN,
    false,
    true,
    [],
    {},
    new String('fine-outline'),
  ])
    assert.equal(contactCueUnderstroke(input), 3);
});

test('Team prepared helper keeps exact circle, foreground colors and one CSS pixel core at all display sizes', () => {
  for (const width of [240, 390, 844, 1152])
    for (const color of ['#ffda77', '#8be0ed']) {
      const a = surface(width),
        b = surface(width),
        cell = width / 72;
      drawPreparedPilotContact(a.ctx, 0.25, color, cell);
      drawPreparedPilotContact(b.ctx, 0.25, color, cell, 'fine-outline');
      assertOnlyUnderstrokeChanges(a.calls, b.calls, 1, cell);
      assert.deepEqual(
        b.calls.filter((call) => call.op === 'arc').map((call) => call.args),
        [[0, 0, 0.25, 0, Math.PI * 2]],
      );
      assert.deepEqual(
        b.calls.filter((call) => call.op === 'stroke').map((call) => call.state.strokeStyle),
        ['#07111c', color],
      );
      assert.equal(
        b.calls.some((call) => ['fill', 'fillRect', 'translate', 'scale'].includes(call.op)),
        false,
      );
      assert.equal(b.stack.length, 0);
    }
});

for (const reduced of [false, true]) {
  test(`Solo/Versus defaults and unsupported contact styles preserve complete commands (reduced=${reduced})`, () => {
    const run = soloRun('trail'),
      checkpoint = authoritativeCheckpoint(run),
      baseline = surface(390);
    soloPainter(true).draw(baseline.ctx, run, 0.04, { reduced });
    for (const feedbackComparison of [
      null,
      {},
      { contactStyle: 'default' },
      { contactStyle: null },
      { contactStyle: 'none' },
      { contactStyle: 0 },
    ]) {
      const actual = surface(390);
      soloPainter(true).draw(actual.ctx, run, 0.04, { reduced, feedbackComparison });
      assert.deepEqual(actual.calls, baseline.calls);
    }
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  });
  for (const [scenario, width] of [
    ['edge', 390],
    ['trail', 1152],
    ['recovery', 844],
  ])
    test(`Solo/Versus fine contact preserves all other geometry, grace, hazards and checkpoint (${scenario}, reduced=${reduced})`, () => {
      const run = soloRun(scenario),
        checkpoint = authoritativeCheckpoint(run),
        a = surface(width),
        b = surface(width),
        first = soloPainter(true),
        second = soloPainter(true);
      const options = { reduced, paused: scenario === 'edge' };
      first.draw(a.ctx, run, 0.04, options);
      second.draw(b.ctx, run, 0.04, { ...options, feedbackComparison: fine });
      const indices = assertOnlyUnderstrokeChanges(a.calls, b.calls, 1, 1),
        index = indices[0];
      assert.deepEqual(a.calls.slice(0, index).findLast((call) => call.op === 'arc').args, [
        run.player.x * 16,
        run.player.y * 16,
        run.rules.playerRadius * 16,
        0,
        Math.PI * 2,
      ]);
      assert.ok(
        a.calls
          .slice(0, index)
          .some(
            (call) => call.op === 'drawImage' && call.args[0].slot?.startsWith('player.scout.'),
          ),
        'Contact still paints after the prepared body.',
      );
      assert.equal(b.calls[index].state.globalAlpha, scenario === 'recovery' ? 0.55 : 0.85);
      assert.deepEqual(second.animation, first.animation);
      assert.deepEqual(second.effects, first.effects);
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      assert.equal(b.stack.length, 0);
    });
  test(`Solo fallback bodies ignore fine contact (reduced=${reduced})`, () => {
    const run = soloRun('recovery'),
      a = surface(),
      b = surface();
    soloPainter(false).draw(a.ctx, run, 0.04, { reduced });
    soloPainter(false).draw(b.ctx, run, 0.04, { reduced, feedbackComparison: fine });
    assert.deepEqual(b.calls, a.calls);
  });
  test(`Team defaults and unsupported styles preserve the complete command stream (reduced=${reduced})`, () => {
    const run = teamRun(),
      before = structuredClone(run),
      a = surface(390),
      p = createCoopPainter(a.canvas);
    p.setPresentation(snapshot());
    p.paint(run, { reduced });
    for (const feedbackComparison of [
      null,
      {},
      { contactStyle: 'default' },
      { contactStyle: 'none' },
      { contactStyle: false },
    ]) {
      const b = surface(390),
        painter = createCoopPainter(b.canvas);
      painter.setPresentation(snapshot());
      painter.paint(run, { reduced, feedbackComparison });
      assert.deepEqual(b.calls, a.calls);
    }
    assert.deepEqual(run, before);
  });
  for (const [scenario, width] of [
    ['edge', 390],
    ['recovery', 844],
    ['downed', 1152],
  ])
    test(`Team only thins both prepared pilot backing strokes (${scenario}, reduced=${reduced})`, () => {
      const run = teamRun(scenario),
        before = structuredClone(run),
        a = surface(width),
        b = surface(width),
        first = createCoopPainter(a.canvas),
        second = createCoopPainter(b.canvas);
      first.setPresentation(snapshot());
      second.setPresentation(snapshot());
      first.paint(run, { reduced });
      second.paint(run, { reduced, feedbackComparison: fine });
      const indices = assertOnlyUnderstrokeChanges(a.calls, b.calls, 2, width / 72);
      for (const index of indices)
        assert.deepEqual(a.calls.slice(0, index).findLast((call) => call.op === 'arc').args, [
          0,
          0,
          run.players[0].radius,
          0,
          Math.PI * 2,
        ]);
      for (const seat of [0, 1])
        assert.deepEqual(second.actorFrame('pilot', seat), first.actorFrame('pilot', seat));
      assert.deepEqual(run, before);
      assert.equal(b.stack.length, 0);
    });
  test(`Team fallback pilot identities ignore the comparison (reduced=${reduced})`, () => {
    const run = teamRun(),
      a = surface(),
      b = surface();
    createCoopPainter(a.canvas).paint(run, { reduced });
    createCoopPainter(b.canvas).paint(run, { reduced, feedbackComparison: fine });
    assert.deepEqual(b.calls, a.calls);
  });
}

for (const reduced of [false, true])
  for (const contactStyle of ['standard', 'fine-outline'])
    test(`Team prepared contacts paint exactly two foreground strokes and no filled dot even with an overlapping enemy (${contactStyle}, reduced=${reduced})`, () => {
      const run = teamRun('recovery'),
        width = 390;
      // Rendering-only overlap fixture; no claim of a legally survived contact.
      run.enemies[0].x = run.players[0].x;
      run.enemies[0].y = run.players[0].y;
      const before = structuredClone(run),
        view = surface(width),
        painter = createCoopPainter(view.canvas);
      painter.setPresentation(snapshot());
      painter.paint(run, { reduced, feedbackComparison: { contactStyle } });
      const unit = view.canvas.width / run.width;
      const circleAt = (call, actor) =>
        call.path?.length === 1 &&
        call.path[0][0] === 'arc' &&
        call.path[0]
          .slice(1, 5)
          .every(
            (value, i) =>
              Math.abs(
                value -
                  [actor.x * unit, actor.y * unit, actor.radius * unit, actor.radius * unit][i],
              ) < 1e-8,
          ) &&
        call.path[0][5] === 0 &&
        call.path[0][6] === Math.PI * 2;
      for (const player of run.players) {
        const color = player.id === 0 ? theme.palette.accent : theme.palette.safe;
        const pilotPaint = view.calls.flatMap((call, index) =>
          circleAt(call, player) &&
          (call.state.strokeStyle === color || call.state.fillStyle === color) &&
          ['stroke', 'fill'].includes(call.op)
            ? [{ call, index }]
            : [],
        );
        assert.equal(
          pilotPaint.filter(({ call }) => call.op === 'fill').length,
          0,
          'No later filled contact disk may cover the battery/camera.',
        );
        const bright = pilotPaint.filter(
          ({ call }) => call.op === 'stroke' && call.state.strokeStyle === color,
        );
        assert.equal(bright.length, 1, 'Only one complete bright pilot contact ring.');
        const index = bright[0].index,
          backing = view.calls[index - 1];
        assert.equal(backing.op, 'stroke');
        assert.equal(backing.state.strokeStyle, '#07111c');
        assert.ok(circleAt(backing, player));
        assert.ok(
          Math.abs(
            (backing.state.lineWidth * width) / run.width -
              (contactStyle === 'fine-outline' ? 2 : 3),
          ) < 1e-8,
        );
        assert.ok(Math.abs((bright[0].call.state.lineWidth * width) / run.width - 1) < 1e-8);
        const lastActorImage = view.calls.findLastIndex(
          (call) =>
            call.op === 'drawImage' &&
            /^(team\.(pilot|enemy)|player\.|enemy\.)/.test(call.args[0].slot ?? ''),
        );
        assert.ok(index > lastActorImage, 'Contact remains above every actor image.');
        if (player.id === 0) {
          const enemyContact = view.calls.findLastIndex(
            (call) =>
              call.op === 'stroke' &&
              call.state.strokeStyle === '#f1f7ed' &&
              circleAt(call, run.enemies[0]),
          );
          assert.ok(
            enemyContact >= 0 && index > enemyContact,
            'Overlapping enemy contact decoration cannot cover the pilot ring.',
          );
        }
      }
      assert.deepEqual(run, before);
      assert.equal(view.stack.length, 0);
    });
