import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BoardPainter } from '../ui/render.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createRun, stepRun, geometryForRun } from '../core/index.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { coverageClear } from './helpers/coop-route-search.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const presets = read('../../authoring/motion-lab/presets.json');
const theme = read('../content/themes.json').themes[0];
const level = read('../content/campaign.json').levels[0];
const drawing = new Set([
  'clearRect',
  'fillRect',
  'strokeRect',
  'drawImage',
  'fill',
  'stroke',
  'fillText',
  'strokeText',
]);

// These observations exercise real painters and legal simulations. Canvas
// command order is not browser rasterization or physical display qualification.
function surface(width = 768, height = 576) {
  const calls = [],
    stack = [];
  let state = {
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    imageSmoothingEnabled: true,
  };
  const canvas = { width, height, clientWidth: width, observedCalls: calls };
  const ctx = new Proxy(
    { canvas },
    {
      get(target, key) {
        if (key in target) return target[key];
        if (key in state) return state[key];
        if (key === 'getImageData')
          return () => assert.fail('Read pixels only from the bounded private scratch.');
        return (...args) => {
          calls.push({ key, args, ...state });
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') {
            assert.ok(stack.length, 'Every restore has an owning save.');
            state = stack.pop();
          }
          if (key === 'measureText') return { width: String(args[0]).length * 0.7 };
        };
      },
      set(_, key, value) {
        state[key] = value;
        return true;
      },
    },
  );
  canvas.getContext = () => ctx;
  return {
    canvas,
    ctx,
    calls,
    stack,
    clear: () => {
      calls.length = 0;
    },
  };
}
function noiseFactory(created) {
  return () => {
    const canvas = { width: 0, height: 0, writes: 0, captures: [], reads: 0 };
    canvas.getContext = () => ({
      fillRect() {},
      createImageData(width, height) {
        return { width, height, data: new Uint8ClampedArray(width * height * 4) };
      },
      putImageData(image) {
        canvas.pixels = image.data.slice();
        canvas.writes++;
      },
      drawImage(source, ...args) {
        assert.ok(
          Array.isArray(source.observedCalls),
          'Sample the composed canvas, never raw art.',
        );
        const marker = { key: 'receptionSnapshot', args: [canvas] };
        source.observedCalls.push(marker);
        canvas.captures.push({ source, args, marker });
      },
      getImageData() {
        canvas.reads++;
        // A coloured private-scratch fixture exercises actual grading/noise.
        // Reveal masking is proved by capture order, not simulated rasterization.
        const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
        for (let at = 0; at < data.length; at += 4) data.set([96, 128, 160, 255], at);
        return { data };
      },
    });
    created.push(canvas);
    return canvas;
  };
}
function solo() {
  const created = [],
    painter = new BoardPainter(presets, { signalCanvasFactory: noiseFactory(created) });
  painter.theme = theme;
  painter.body = presets.characters['neutral-marker'];
  painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
  painter.background = { width: 64, height: 32, label: 'original picture' };
  painter.image = { width: 32, height: 32, label: 'sharp player' };
  return { painter, created };
}
function team(run) {
  const view = surface(1152, 576),
    created = [];
  const painter = createCoopPainter(view.canvas, { signalCanvasFactory: noiseFactory(created) });
  const snapshot = {
    canvas: {
      palette: {
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
      },
      motionScale: 1,
    },
    fonts: { ui: 'Team UI, sans-serif', numeric: 'Team Mono, monospace' },
  };
  const picture = {
    snapshot,
    image: { width: 1152, height: 576, label: 'original Team picture' },
    choice: { kind: 'image', levelId: run.level.id, levelRevision: run.level.revision },
    fit: 'contain',
    sampling: 'nearest',
  };
  painter.setPresentation(snapshot);
  return { ...view, created, painter, picture };
}
const imageIndex = (calls, image) =>
  calls.findIndex((call) => call.key === 'drawImage' && call.args[0] === image);
const noiseCall = (calls, created) =>
  calls.find((call) => call.key === 'drawImage' && created.includes(call.args[0]));
function assertProtectedAcquisition(calls, run, width, unit, picture, noise, coverColor) {
  const originalAt = imageIndex(calls, picture),
    noiseAt = calls.indexOf(noise),
    snapshotAt = calls.findIndex((call) => call.key === 'receptionSnapshot');
  assert.ok(originalAt >= 0 && snapshotAt > originalAt && noiseAt > snapshotAt);
  const covers = calls
    .slice(originalAt + 1, snapshotAt)
    .filter(
      (call) =>
        call.key === 'fillRect' &&
        call.fillStyle === coverColor &&
        call.globalAlpha === 1 &&
        call.globalCompositeOperation === 'source-over',
    );
  let covered = 0;
  for (let cell = 0; cell < run.cells.length; cell++) {
    if (run.cells[cell] !== 0) continue;
    const x = ((cell % width) + 0.5) * unit,
      y = (Math.floor(cell / width) + 0.5) * unit;
    assert.ok(
      covers.some(
        ({ args: [left, top, w, h] }) => left <= x && x < left + w && top <= y && y < top + h,
      ),
      `Unclaimed cell ${cell} is masked before the composed feed is captured.`,
    );
    covered++;
  }
  assert.ok(covered > 100, 'The fixture includes substantial genuinely unclaimed picture area.');
  assert.equal(
    calls.filter((call) => call.key === 'drawImage' && call.args[0] === picture).length,
    1,
    'No later raw-art draw can undo the mask.',
  );
  assert.ok(
    calls.slice(noiseAt + 1).some((call) => drawing.has(call.key)),
    'Actionable board cues are drawn after reception.',
  );
}
function assertTerminalLast(calls, created) {
  const noise = noiseCall(calls, created);
  assert.ok(noise);
  const snapshotAt = calls.findIndex((call) => call.key === 'receptionSnapshot');
  if (snapshotAt >= 0) {
    assert.ok(
      calls.slice(0, snapshotAt).some((call) => call.key === 'stroke' || call.key === 'fillText'),
      'Terminal capture includes the already-painted arena cues.',
    );
    assert.deepEqual(
      calls.slice(snapshotAt + 1).filter((call) => drawing.has(call.key)),
      [noise],
      'Nothing redraws the arena between terminal capture and its degraded presentation.',
    );
  }
  assert.equal(
    calls.filter((call) => drawing.has(call.key)).at(-1),
    noise,
    'Terminal reception composites after the complete arena.',
  );
  return noise;
}
function lostSolo() {
  const run = createRun(level),
    recorder = createRecorder(level, {}, 'signal-renderer-test');
  for (let cycle = 0; cycle < 15 && !['lost', 'won'].includes(run.status); cycle++)
    for (const [direction, ticks] of [
      ['down', 120],
      ['right', 40],
      ['up', 30],
      ['left', 50],
      [null, 120],
    ])
      for (let tick = 0; tick < ticks && !['lost', 'won'].includes(run.status); tick++) {
        const input = { direction };
        stepRun(run, input);
        recordInput(recorder, input);
      }
  assert.equal(run.status, 'lost');
  assert.equal(run.lives, 0);
  return { run, recorder };
}
function lostTeam() {
  const run = startCoop(createCoop(FIRST_CONNECTION, { difficulty: 'expert', seed: 17 }));
  for (let cycle = 0; cycle < 30 && run.status === 'running'; cycle++)
    for (const [a, b, ticks] of [
      ['right', 'left', 120],
      ['up', 'up', 60],
      ['right', 'left', 60],
      ['down', 'down', 60],
      ['left', 'right', 60],
      [null, null, 120],
    ])
      for (let tick = 0; tick < ticks && run.status === 'running'; tick++)
        stepCoop(
          run,
          [a, b].map((direction) => ({ direction, boost: false, support: false })),
        );
  assert.equal(run.status, 'lost');
  return run;
}

test('Solo reception opts in after the opaque mask and before the sharp player, without changing the run', () => {
  const run = createRun(level),
    { painter, created } = solo(),
    view = surface();
  painter.draw(view.ctx, run, 0.1);
  painter.draw(view.ctx, run, 0, { signalReception: 'ready' });
  assert.equal(created.length, 0, 'Default/replay and ready paints do not acquire.');
  stepRun(run, { direction: 'down' });
  const before = structuredClone(run),
    checkpoint = authoritativeCheckpoint(run);
  view.clear();
  painter.draw(view.ctx, run, 0.05, { signalReception: 'playing', signalEffectsRunning: true });
  const noise = noiseCall(view.calls, created);
  assert.ok(noise?.globalAlpha > 0);
  assertProtectedAcquisition(
    view.calls,
    run,
    geometryForRun(run).width,
    16,
    painter.background,
    noise,
    theme.coverColor ?? '#000000',
  );
  assert.ok(imageIndex(view.calls, painter.image) > view.calls.indexOf(noise));
  assert.deepEqual(structuredClone(run), before);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(view.stack.length, 0);
  assert.equal(created.length, 1);
  assert.equal(created[0].captures.length, 1);
  assert.equal(created[0].captures[0].source, view.canvas);
  assert.equal(created[0].reads, 1);
  assert.ok(Math.max(created[0].width, created[0].height) <= 512);
  painter.dispose();
  painter.dispose();
  assert.equal(created[0].width, 0);
  assert.equal(created[0].height, 0);
  painter.draw(view.ctx, run, 0.1, { signalReception: 'playing', signalEffectsRunning: true });
  assert.equal(created.length, 1, 'Disposal cannot restart a reception canvas.');
});

test('Team acquisition masks every hidden cell before noise and paints live geometry afterward', () => {
  const run = createCoop(FIRST_CONNECTION),
    f = team(run);
  f.painter.paint(run, { picture: f.picture });
  f.painter.paint(run, { picture: f.picture, signalReception: 'ready' });
  assert.equal(f.created.length, 0);
  startCoop(run);
  stepCoop(
    run,
    [null, null].map((direction) => ({ direction, boost: false, support: false })),
  );
  const before = structuredClone(run);
  f.clear();
  f.painter.paint(run, {
    picture: f.picture,
    signalReception: 'playing',
    signalEffectsRunning: true,
    signalDelta: 0.05,
  });
  const noise = noiseCall(f.calls, f.created);
  assert.ok(noise?.globalAlpha > 0);
  assert.equal(f.created[0].captures.length, 1);
  assert.equal(f.created[0].captures[0].source, f.canvas);
  assertProtectedAcquisition(f.calls, run, run.width, 1, f.picture.image, noise, '#000000');
  assert.ok(
    f.calls.slice(f.calls.indexOf(noise) + 1).some((call) => call.key === 'arc'),
    'Team actors remain above acquisition.',
  );
  assert.deepEqual(structuredClone(run), before);
  assert.equal(f.stack.length, 0);
  assert.equal(f.ctx.imageSmoothingEnabled, true);
  f.painter.dispose();
  f.painter.dispose();
  assert.equal(f.created[0].width, 0);
  assert.equal(f.created[0].height, 0);
  f.clear();
  f.painter.paint(run, {
    picture: f.picture,
    signalReception: 'playing',
    signalEffectsRunning: true,
    signalDelta: 0.05,
  });
  assert.equal(noiseCall(f.calls, f.created), undefined);
  assert.equal(f.created.length, 1);
});

test('Solo terminal reception advances over a paused real loss, freezes explicitly, and preserves exact replay', () => {
  const { run, recorder } = lostSolo(),
    f = solo(),
    view = surface();
  const before = structuredClone(run),
    checkpoint = authoritativeCheckpoint(run);
  const recording = exportReplay(recorder, run);
  assert.equal(verifyReplay(recording).match, true);
  f.painter.draw(view.ctx, run, 0.3, { paused: true });
  assert.equal(f.created.length, 0, 'Ordinary replay/paused viewers opt out by default.');
  const paint = (dt, running) => {
    view.clear();
    f.painter.draw(view.ctx, run, dt, {
      paused: true,
      signalReception: 'lost',
      signalEffectsRunning: running,
    });
    return assertTerminalLast(view.calls, f.created);
  };
  const first = paint(0.3, true),
    writes = f.created[0].writes;
  assert.equal(f.created[0].captures[0].source, view.canvas);
  const captures = f.created[0].captures.length;
  assert.ok(first.globalAlpha > 0 && first.globalAlpha < 0.8);
  assert.equal(
    paint(60, false).globalAlpha,
    first.globalAlpha,
    'Host freeze preserves the loss envelope.',
  );
  assert.equal(f.created[0].writes, writes, 'Frozen loss reuses the same generated noise.');
  assert.equal(
    f.created[0].captures.length,
    captures,
    'A frozen envelope retains its safe captured feed.',
  );
  assert.equal(
    paint(0.4, true).globalAlpha,
    0.8,
    'Presentation finishes even though simulation is paused.',
  );
  const settled = f.created[0].writes;
  const settledCaptures = f.created[0].captures.length;
  assert.equal(paint(60, true).globalAlpha, 0.8);
  assert.equal(
    f.created[0].writes,
    settled,
    'Terminal reception settles instead of flickering indefinitely.',
  );
  assert.equal(f.created[0].captures.length, settledCaptures);
  assert.deepEqual(structuredClone(run), before);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(exportReplay(recorder, run), recording);
  assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  f.painter.dispose();
});

test('Team terminal reception is last, respects presentation freeze, and never changes a legal loss', () => {
  const run = lostTeam(),
    f = team(run),
    before = structuredClone(run);
  f.painter.paint(run, { picture: f.picture });
  assert.equal(f.created.length, 0);
  const paint = (dt, running) => {
    f.clear();
    f.painter.paint(run, {
      picture: f.picture,
      signalReception: 'lost',
      signalEffectsRunning: running,
      signalDelta: dt,
    });
    assert.equal(f.stack.length, 0);
    return assertTerminalLast(f.calls, f.created);
  };
  const first = paint(0.3, true),
    writes = f.created[0].writes;
  assert.equal(f.created[0].captures[0].source, f.canvas);
  const captures = f.created[0].captures.length;
  assert.equal(paint(60, false).globalAlpha, first.globalAlpha);
  assert.equal(f.created[0].writes, writes);
  assert.equal(f.created[0].captures.length, captures);
  assert.equal(paint(0.4, true).globalAlpha, 0.8);
  const settled = f.created[0].writes;
  paint(60, true);
  assert.equal(f.created[0].writes, settled);
  assert.deepEqual(structuredClone(run), before);
  f.painter.dispose();
});

test('genuine Solo and Team victories keep the original reward and do not allocate reception', () => {
  const verified = verifyReplay(read('../demo-data/first-signal-left.replay.json'));
  assert.equal(verified.match, true);
  const run = verified.state,
    f = solo(),
    view = surface(),
    before = structuredClone(run);
  assert.equal(run.status, 'won');
  f.painter.draw(view.ctx, run, 1, {
    fullReveal: true,
    signalReception: 'lost',
    signalEffectsRunning: true,
  });
  assert.equal(f.created.length, 0);
  assert.ok(imageIndex(view.calls, f.painter.background) >= 0);
  assert.deepEqual(structuredClone(run), before);
  f.painter.dispose();

  const { run: coop } = coverageClear('standard', { boost: true, cover: true });
  assert.equal(coop.status, 'won');
  assert.ok(coop.cells.some((cell) => cell === 0));
  const g = team(coop),
    coopBefore = structuredClone(coop);
  g.painter.paint(coop, {
    picture: g.picture,
    signalReception: 'lost',
    signalEffectsRunning: true,
    signalDelta: 1,
  });
  assert.equal(g.created.length, 0);
  const pictureAt = imageIndex(g.calls, g.picture.image);
  assert.ok(pictureAt >= 0);
  assert.ok(
    !g.calls.slice(pictureAt + 1).some((call) => drawing.has(call.key)),
    'Team victory leaves the original reward unobscured.',
  );
  assert.deepEqual(structuredClone(coop), coopBefore);
  g.painter.dispose();
});

test('both painters pass reduced motion through: no acquisition and a still, bounded terminal feed', () => {
  const soloStart = createRun(level),
    soloLoss = lostSolo().run,
    f = solo(),
    view = surface();
  f.painter.draw(view.ctx, soloStart, 0.1, {
    signalReception: 'playing',
    signalEffectsRunning: true,
    reduced: true,
  });
  assert.equal(f.created.length, 0);
  const soloBefore = authoritativeCheckpoint(soloLoss);
  const soloPaint = () => {
    view.clear();
    f.painter.draw(view.ctx, soloLoss, 60, {
      paused: true,
      signalReception: 'lost',
      signalEffectsRunning: true,
      reduced: true,
    });
    assert.equal(assertTerminalLast(view.calls, f.created).globalAlpha, 0.22);
  };
  soloPaint();
  const soloPixels = f.created[0].pixels.slice();
  soloPaint();
  assert.equal(f.created[0].captures.length, 1);
  assert.equal(f.created[0].writes, 1);
  assert.deepEqual(f.created[0].pixels, soloPixels);
  assert.deepEqual(authoritativeCheckpoint(soloLoss), soloBefore);
  f.painter.dispose();

  const teamStart = startCoop(createCoop(FIRST_CONNECTION)),
    teamLoss = lostTeam(),
    g = team(teamStart);
  g.painter.paint(teamStart, {
    picture: g.picture,
    signalReception: 'playing',
    signalEffectsRunning: true,
    signalDelta: 0.1,
    reduced: true,
  });
  assert.equal(g.created.length, 0);
  const teamBefore = structuredClone(teamLoss);
  const teamPaint = () => {
    g.clear();
    g.painter.paint(teamLoss, {
      picture: g.picture,
      signalReception: 'lost',
      signalEffectsRunning: true,
      signalDelta: 60,
      reduced: true,
    });
    assert.equal(assertTerminalLast(g.calls, g.created).globalAlpha, 0.22);
  };
  teamPaint();
  const teamPixels = g.created[0].pixels.slice();
  teamPaint();
  assert.equal(g.created[0].captures.length, 1);
  assert.equal(g.created[0].writes, 1);
  assert.deepEqual(g.created[0].pixels, teamPixels);
  assert.deepEqual(structuredClone(teamLoss), teamBefore);
  g.painter.dispose();
});
