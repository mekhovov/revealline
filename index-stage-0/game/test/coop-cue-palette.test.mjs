import test from 'node:test';
import assert from 'node:assert/strict';
import { coopCuePalette, coopCueContrast, coopCueOutline } from '../couch/coop-cue-palette.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';
const dark = {
  ink: '#f6f3e8',
  paper: '#071527',
  muted: '#a8b8cc',
  accent: '#ffd64a',
  safe: '#67aaff',
  danger: '#ff7169',
  field: '#10243e',
  grid: '#182b43',
  sky: '#233950',
  land: '#526e67',
};
const light = {
  ink: '#14213d',
  paper: '#fcf3e6',
  muted: '#4b5369',
  accent: '#133a95',
  safe: '#755400',
  danger: '#9b102a',
  field: '#eeeeee',
  grid: '#ccbbaa',
  sky: '#e3cda9',
  land: '#d1b779',
};
const gray = Object.fromEntries(Object.keys(dark).map((key) => [key, '#777777']));
const snap = (palette) => ({
  canvas: { palette, motionScale: 1 },
  fonts: { ui: 'Prepared UI', numeric: 'Prepared Mono' },
});
function surface(width = 390) {
  const calls = [],
    stack = [];
  let state = { globalAlpha: 1, lineWidth: 1 },
    path = [];
  const ctx = new Proxy(
    {},
    {
      get(_, name) {
        if (name in state) return state[name];
        return (...args) => {
          if (name === 'beginPath') path = [];
          if (['arc', 'moveTo', 'lineTo', 'closePath'].includes(name)) path.push([name, ...args]);
          calls.push({
            name,
            args,
            state: { ...state },
            path: ['stroke', 'fill'].includes(name) ? structuredClone(path) : null,
          });
          if (name === 'save') stack.push({ ...state });
          if (name === 'restore') state = stack.pop();
          if (name === 'measureText') return { width: String(args[0]).length * 0.7 };
        };
      },
      set(_, name, value) {
        state[name] = value;
        return true;
      },
    },
  );
  return {
    canvas: { width: 1152, height: 576, clientWidth: width, getContext: () => ctx },
    calls,
    stack,
    clear: () => {
      calls.length = 0;
    },
  };
}
test('contrast uses unrounded sRGB thresholds and keeps readable theme colours', () => {
  assert.equal(coopCueContrast('#000000', '#ffffff'), 21);
  assert.ok(coopCueContrast('#ffffff', '#777777') < 4.5);
  assert.ok(coopCueContrast('#000000', '#777777') > 4.5);
  const selected = coopCuePalette(dark);
  assert.equal(selected.warning, dark.accent);
  assert.equal(selected.slowed, dark.safe);
  assert.equal(selected.exposed, dark.danger);
  assert.equal(selected.text, dark.ink);
  assert.equal(selected.back, dark.paper);
  assert.equal(coopCuePalette(gray).text, '#000000');
  assert.equal(coopCuePalette(gray).warning, '#000000');
  assert.throws(() => coopCuePalette({ ...dark, paper: 'red' }), /six-digit/);
});
for (const [name, palette] of [
  ['dark', dark],
  ['light', light],
  ['low contrast', gray],
]) {
  test(`${name} theme provides legible labels and warning outlines`, () => {
    const selected = coopCuePalette(palette);
    for (const [role, color] of Object.entries(selected)) {
      if (
        ['back', 'anchorReadyFill', 'anchorCapturedFill', 'playerFill', 'enemyCenter'].includes(
          role,
        )
      )
        continue;
      assert.ok(coopCueContrast(color, selected.back) >= 4.5, role);
      assert.ok(coopCueContrast(color, coopCueOutline(color)) >= 4.5, role + ' outline');
    }
    const before = structuredClone(palette);
    assert.equal(Object.isFrozen(selected), true);
    assert.deepEqual(palette, before);
  });
  for (const width of [320, 390, 568, 1152]) {
    test(`${name} ${width}px actual Team painter retains warning targets and distinct labelled objectives`, () => {
      const view = surface(width),
        painter = createCoopPainter(view.canvas),
        run = createCoop(RELAY_YARD);
      run.status = 'paused';
      run.time = 2;
      const hunters = run.enemies.filter((enemy) => enemy.type === 'hunter');
      Object.assign(hunters[0], { phase: 'warning', target: 1, targetPoint: { x: 40, y: 20 } });
      Object.assign(hunters[1], { phase: 'recovery', speedScale: 0.5, slowUntil: 4 });
      run.strongholds[0].emitter = { phase: 'warning', cellIndex: 30 * run.width + 40 };
      run.strongholds[0].anchors[0].captured = true;
      run.players[0].status = 'downed';
      run.players[1].graceUntil = 4;
      run.supportEffects = [{ player: 0, x: 30, y: 20 }];
      run.impacts = [{ x: 25.5, y: 10.5 }];
      const before = structuredClone(run),
        presentation = snap(palette);
      const picture = {
        snapshot: presentation,
        image: { width: 1152, height: 576 },
        choice: { kind: 'image', levelId: run.level.id, levelRevision: run.level.revision },
        fit: 'contain',
        sampling: 'nearest',
      };
      painter.setPresentation(presentation);
      painter.paint(run, { reduced: true, picture });
      const selected = coopCuePalette(palette),
        labels = view.calls.filter((call) => call.name === 'fillText');
      for (const text of ['1', '2', '+', '✓', 'B', 'SHIELD', 'LOCK 2', 'RECOVER', 'SLOWED'])
        assert.ok(
          labels.some((call) => call.args[0] === text),
          text,
        );
      for (const call of labels)
        assert.ok(coopCueContrast(call.state.fillStyle, selected.back) >= 4.5, call.args[0]);
      const targetStrokes = view.calls.filter(
        (call) =>
          call.name === 'stroke' &&
          call.path.some((p) => p[0] === 'lineTo' && p[1] === 40 && p[2] === 20),
      );
      assert.equal(
        targetStrokes.length,
        2,
        'hunter target centerline has an outer and inner stroke',
      );
      assert.deepEqual(targetStrokes[0].path, targetStrokes[1].path);
      assert.ok(
        coopCueContrast(targetStrokes[0].state.strokeStyle, targetStrokes[1].state.strokeStyle) >=
          4.5,
      );
      assert.ok((targetStrokes[1].state.lineWidth * width) / 72 >= 1.5 - 1e-10);
      assert.ok(targetStrokes[0].state.lineWidth > targetStrokes[1].state.lineWidth);
      for (const [role, match] of [
        ['Support', (p) => p[0] === 'arc' && p[1] === 30 && p[2] === 20 && p[3] === 6],
        ['recovery', (p) => p[0] === 'arc' && p[3] === 0.95],
        ['slowed', (p) => p[0] === 'arc' && p[3] === 0.88],
        [
          'spawn',
          (p) =>
            p[0] === 'arc' &&
            p[1] === run.level.spawns[0].x &&
            p[2] === run.level.spawns[0].y &&
            p[3] === 0.9,
        ],
        [
          'core',
          (p) =>
            p[0] === 'moveTo' &&
            p[1] === run.strongholds[0].core.x + 1.2 &&
            p[2] === run.strongholds[0].core.y,
        ],
      ]) {
        const strokes = view.calls.filter(
          (call) => call.name === 'stroke' && call.path.some(match),
        );
        assert.equal(strokes.length, 2, role + ' has two functional strokes');
        assert.deepEqual(strokes[0].path, strokes[1].path, role + ' preserves geometry');
        for (const call of strokes) assert.equal(call.state.globalAlpha, 1, role + ' is opaque');
        assert.ok(
          coopCueContrast(strokes[0].state.strokeStyle, strokes[1].state.strokeStyle) >= 4.5,
          role + ' contrast',
        );
        assert.ok(
          (strokes[1].state.lineWidth * width) / 72 >= 1.5 - 1e-10,
          role + ' minimum width',
        );
        assert.ok(
          (strokes[0].state.lineWidth * width) / 72 >=
            (strokes[1].state.lineWidth * width) / 72 + 2 - 1e-10,
          role + ' outer edge',
        );
        for (const backdrop of ['#000000', '#ffffff', '#777777'])
          assert.ok(
            strokes.some((call) => coopCueContrast(call.state.strokeStyle, backdrop) >= 3),
            role + ' remains distinct on ' + backdrop,
          );
      }
      for (const player of run.players) {
        const head = view.calls.filter(
          (call) =>
            ['stroke', 'fill'].includes(call.name) &&
            call.path.some(
              (p) =>
                p[0] === 'arc' && p[1] === player.x && p[2] === player.y && p[3] === player.radius,
            ),
        );
        assert.deepEqual(
          head.map((call) => call.name),
          ['fill', 'stroke', 'stroke', 'fill'],
          'head center is restored after its halo',
        );
        assert.equal(
          head.at(-1).state.fillStyle,
          player.id === 0 ? selected.warning : selected.slowed,
        );
        assert.equal(head.at(-1).state.globalAlpha, 1);
      }
      assert.deepEqual(run, before);
      assert.equal(view.stack.length, 0);
      const held = structuredClone(view.calls);
      view.clear();
      painter.paint(run, { reduced: true, picture });
      assert.deepEqual(view.calls, held);
    });
  }
}

test('theme changes preserve public-command-earned Team state and restore exact legacy drawing', () => {
  for (const arena of ['first-connection', 'relay-yard']) {
    for (const scenario of ['initial', 'cutting', 'warning', 'charge', 'capture', 'victory']) {
      const { run } = createStudioTeamFixture({ arena, scenario }),
        before = structuredClone(run),
        view = surface(),
        painter = createCoopPainter(view.canvas);
      painter.paint(run, { reduced: true });
      const legacy = structuredClone(view.calls);
      for (const palette of [dark, light, gray]) {
        painter.setPresentation(snap(palette));
        view.clear();
        painter.paint(run, { reduced: true });
        assert.deepEqual(run, before);
      }
      painter.setPresentation(null);
      view.clear();
      painter.paint(run, { reduced: true });
      assert.deepEqual(view.calls, legacy);
    }
  }
});

test('prepared picture concealment stays opaque black and victory shows the clean original', () => {
  const run = createCoop(RELAY_YARD),
    view = surface(),
    painter = createCoopPainter(view.canvas),
    presentation = snap(light),
    image = { width: 1152, height: 576 };
  const picture = {
    snapshot: presentation,
    image,
    choice: { kind: 'image', levelId: run.level.id, levelRevision: run.level.revision },
    fit: 'contain',
    sampling: 'nearest',
  };
  painter.setPresentation(presentation);
  painter.paint(run, { picture });
  assert.ok(
    view.calls.some(
      (call) =>
        call.name === 'fillRect' &&
        call.state.fillStyle === '#000000' &&
        call.state.globalAlpha === 1,
    ),
  );
  run.status = 'won';
  view.clear();
  painter.paint(run, { picture });
  assert.equal(view.calls.filter((call) => call.name === 'drawImage').length, 1);
  assert.equal(view.calls.filter((call) => call.name === 'fillText').length, 0);
});

test('cosmetic cue themes leave 600 simulation ticks identical in both arenas', () => {
  for (const level of [FIRST_CONNECTION, RELAY_YARD]) {
    const run = startCoop(createCoop(level)),
      control = startCoop(createCoop(level)),
      view = surface(),
      painter = createCoopPainter(view.canvas);
    for (let tick = 0; tick < 600; tick++) {
      const commands = [
        { direction: tick < 120 ? 'right' : 'up', boost: true, support: tick % 60 === 0 },
        { direction: tick < 120 ? 'left' : 'up', boost: true, support: false },
      ];
      stepCoop(run, commands, 1 / 120);
      stepCoop(control, commands, 1 / 120);
      if (tick % 60 === 0) {
        painter.setPresentation(snap(tick % 120 === 0 ? light : dark));
        view.clear();
        painter.paint(run);
      }
    }
    assert.deepEqual(run, control);
  }
});
