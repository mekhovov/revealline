import test from 'node:test';
import assert from 'node:assert/strict';
import { createCoop, startCoop, pauseCoop, stepCoop } from '../coop/core.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { mountPresentationPage } from '../presentation/page.mjs';

// Canvas command observation exercises the real Team painter; it does not
// qualify pixel contrast, browser image decode, or physical display readability.
function canvasRecorder() {
  const calls = [],
    stack = [];
  let state = { imageSmoothingEnabled: true };
  const context = new Proxy(
    {},
    {
      get(_, name) {
        if (name in state) return state[name];
        return (...args) => {
          calls.push({ name, args, state: { ...state } });
          if (name === 'save') stack.push({ ...state });
          if (name === 'restore') state = stack.pop();
        };
      },
      set(_, name, value) {
        state[name] = value;
        return true;
      },
    },
  );
  return {
    canvas: { width: 1152, height: 576, getContext: () => context },
    context,
    calls,
    stack,
    reset: () => (calls.length = 0),
  };
}
function snapshot(motionScale = 1) {
  return Object.freeze({
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
      motionScale,
    },
    fonts: { ui: 'Prepared Team UI, sans-serif', numeric: 'Prepared Team Mono, monospace' },
  });
}
function binding(run, presentation, image = { width: 1152, height: 576 }) {
  return Object.freeze({
    snapshot: presentation,
    image,
    choice: Object.freeze({
      kind: image ? 'image' : 'procedural',
      levelId: run.level.id,
      levelRevision: run.level.revision,
    }),
    fit: 'contain',
    sampling: 'nearest',
  });
}
const commands = (calls) => calls.map(({ name, args }) => [name, ...args]);
const labels = (calls) =>
  calls.filter((call) => call.name === 'fillText').map((call) => call.args[0]);

test('legacy callers retain procedural painting and restoring the page snapshot restores that look', () => {
  const view = canvasRecorder(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(FIRST_CONNECTION);
  const before = structuredClone(run);
  painter.paint(run);
  const legacy = structuredClone(view.calls);
  assert.equal(painter.presentation, null);
  assert.equal(
    legacy.some((call) => call.name === 'drawImage'),
    false,
  );
  painter.setPresentation(snapshot());
  painter.paint(run);
  painter.setPresentation(null);
  view.reset();
  painter.paint(run);
  assert.deepEqual(view.calls, legacy);
  assert.deepEqual(run, before);
});

test('the prepared original is drawn once with nearest sampling and only claimed land exposes it', () => {
  const view = canvasRecorder(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(RELAY_YARD),
    presentation = snapshot(),
    picture = binding(run, presentation);
  // These cells avoid actors and authored structures; a third sample is a real wall.
  run.cells[20 * run.width + 30] = 1;
  painter.setPresentation(presentation);
  painter.paint(run, { picture });
  const draws = view.calls.filter((call) => call.name === 'drawImage');
  assert.equal(draws.length, 1);
  assert.equal(draws[0].args[0], picture.image);
  assert.deepEqual(draws[0].args.slice(1), [0, 0, 1152, 576, 0, 0, 72, 36]);
  assert.equal(draws[0].state.imageSmoothingEnabled, false);
  const afterImage = view.calls.slice(view.calls.indexOf(draws[0]) + 1);
  const coverAt = (x, y) =>
    afterImage.filter(
      ({ name, args: [left, top, width, height] }) =>
        name === 'fillRect' && left <= x && top <= y && left + width > x && top + height > y,
    );
  assert.equal(coverAt(30.2, 20.2).length, 0, 'Claimed land keeps the selected original visible.');
  const hidden = coverAt(31.2, 20.2)[0];
  assert.notEqual(presentation.canvas.palette.field, '#000000');
  assert.equal(hidden.state.fillStyle, '#000000');
  assert.equal(hidden.state.globalAlpha, 1);
  assert.equal(hidden.state.globalCompositeOperation, 'source-over');
  assert.equal(coverAt(16.2, 15.2)[0].state.fillStyle, presentation.canvas.palette.muted);
  assert.equal(view.context.imageSmoothingEnabled, true, 'Caller canvas state is restored.');
});

test('an explicit procedural binding uses the selected palette without pretending an image exists', () => {
  const view = canvasRecorder(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(FIRST_CONNECTION),
    presentation = snapshot();
  painter.setPresentation(presentation);
  painter.paint(run, { picture: binding(run, presentation, null) });
  assert.equal(
    view.calls.some((call) => call.name === 'drawImage'),
    false,
  );
  assert.ok(view.calls.some((call) => call.state.fillStyle === presentation.canvas.palette.land));
});

test('wrong arena, stale presentation, cropped dimensions and non-nearest bindings refuse before drawing', () => {
  const view = canvasRecorder(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(RELAY_YARD),
    presentation = snapshot(),
    picture = binding(run, presentation);
  painter.setPresentation(presentation);
  for (const changed of [
    { snapshot: snapshot() },
    { choice: { ...picture.choice, levelId: FIRST_CONNECTION.id } },
    { choice: { ...picture.choice, levelRevision: 999 } },
    { choice: { ...picture.choice, kind: 'procedural' } },
    { image: { width: 768, height: 576 } },
    { image: null },
    { fit: 'cover' },
    { sampling: 'linear' },
  ]) {
    view.reset();
    assert.throws(
      () => painter.paint(run, { picture: { ...picture, ...changed } }),
      /Team picture/,
    );
    assert.equal(view.calls.length, 0, 'An invalid binding cannot partially change the canvas.');
  }
  painter.setPresentation(null);
  assert.throws(() => painter.paint(run, { picture }), /Team picture/);
});

test('snapshot validation is atomic and plain text keeps its existing system-font roles', () => {
  const view = canvasRecorder(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(FIRST_CONNECTION),
    presentation = snapshot();
  painter.setPresentation(presentation);
  for (const bad of [
    { ...presentation, canvas: { ...presentation.canvas, motionScale: 2 } },
    { ...presentation, canvas: { ...presentation.canvas, palette: {} } },
    { ...presentation, fonts: { ui: '', numeric: 'mono' } },
  ]) {
    assert.throws(() => painter.setPresentation(bad), /Team presentation/);
    assert.equal(painter.presentation, presentation);
  }
  painter.paint(run);
  assert.ok(
    view.calls.some(
      (call) => call.name === 'fillText' && call.state.font.includes('Prepared Team'),
    ),
  );
  view.reset();
  painter.paint(run, { textFace: 'plain' });
  assert.ok(
    view.calls.some((call) => call.name === 'fillText' && call.state.font.includes('ui-monospace')),
  );
  assert.equal(
    view.calls.some((call) => call.state.font?.includes('Prepared Team')),
    false,
  );
});

test('existing Team non-trail cues and geometry remain above the picture in reduced paused paint', () => {
  const view = canvasRecorder(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(RELAY_YARD),
    presentation = snapshot(0);
  run.time = 2;
  run.status = 'paused';
  run.supportEffects = [{ player: 0, x: 30, y: 20 }];
  run.players[0].status = 'downed';
  run.players[1].cutting = true;
  // Shared trails intentionally differ from legacy strokes. Real simultaneous
  // cuts and their exact head geometry are covered by coop-terrain-trail.test.
  run.players[1].graceUntil = 4;
  const hunters = run.enemies.filter((enemy) => enemy.type === 'hunter');
  Object.assign(hunters[0], { phase: 'warning', target: 1, targetPoint: { x: 40, y: 20 } });
  Object.assign(hunters[1], { phase: 'recovery', speedScale: 0.5, slowUntil: 4 });
  const stronghold = run.strongholds[0];
  stronghold.anchors[0].captured = true;
  stronghold.emitter = { phase: 'warning', cellIndex: 30 * 72 + 40 };
  run.impacts = [{ x: 25.5, y: 10.5 }];
  const before = structuredClone(run);
  const semantic = () => {
    const start = view.calls.findIndex((call) => call.name === 'arc' && call.args[2] === 6);
    assert.ok(start >= 0, 'Support radius is still represented.');
    return commands(view.calls.slice(start));
  };
  painter.paint(run, { reduced: true });
  const legacy = semantic(),
    legacyLabels = labels(view.calls);
  painter.setPresentation(presentation);
  view.reset();
  painter.paint(run, { picture: binding(run, presentation) });
  assert.deepEqual(semantic(), legacy);
  assert.deepEqual(labels(view.calls), legacyLabels);
  for (const label of ['+', '2', '✓', 'B', 'SHIELD', 'LOCK 2', 'RECOVER', 'SLOWED'])
    assert.ok(legacyLabels.includes(label), `Retained semantic label: ${label}`);
  assert.deepEqual(run, before);
});

test('motion scale affects only optional pulse while paused repetition and real simulation remain identical', () => {
  const view = canvasRecorder(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(FIRST_CONNECTION),
    control = createCoop(FIRST_CONNECTION),
    neutral = Array.from({ length: 2 }, () => ({ direction: null, boost: false, support: false }));
  startCoop(run);
  startCoop(control);
  for (let i = 0; i < 20; i++) {
    painter.setPresentation(snapshot(i % 2 ? 0 : 0.5));
    painter.paint(run);
    stepCoop(run, neutral, 1 / 120);
    stepCoop(control, neutral, 1 / 120);
  }
  assert.deepEqual(run, control);
  pauseCoop(run);
  run.players[0].cutting = true;
  run.players[0].trail = [{ x: 2, y: 1 }];
  painter.setPresentation(snapshot(0.5));
  view.reset();
  painter.paint(run);
  const once = structuredClone(view.calls);
  view.reset();
  painter.paint(run);
  assert.deepEqual(view.calls, once);
  const pulse = once.find((call) => call.name === 'arc' && call.state.globalAlpha === 0.18);
  assert.ok(pulse);
  assert.equal(pulse.args[2], 0.85 + Math.sin(run.time * 5 * 0.5) * 0.08);
  view.reset();
  painter.paint(run, { reduced: true });
  assert.equal(
    view.calls.some((call) => call.name === 'arc' && call.state.globalAlpha === 0.18),
    false,
  );
});

test('drawing errors restore the borrowed canvas state without closing the supplied image', () => {
  const view = canvasRecorder(),
    painter = createCoopPainter(view.canvas),
    run = createCoop(FIRST_CONNECTION),
    presentation = snapshot();
  let closes = 0;
  const picture = binding(run, presentation, { width: 1152, height: 576, close: () => closes++ });
  view.context.drawImage = () => {
    throw new Error('native draw refused');
  };
  painter.setPresentation(presentation);
  assert.throws(() => painter.paint(run, { picture }), /native draw refused/);
  assert.equal(view.stack.length, 0);
  assert.equal(view.context.imageSmoothingEnabled, true);
  painter.setPresentation(null);
  assert.equal(closes, 0, 'Only the prepared-picture lease owns decoded image disposal.');
});

test('the existing page lease applies/restores the Team snapshot without overriding a newer owner', async () => {
  const view = canvasRecorder(),
    painter = createCoopPainter(view.canvas),
    first = snapshot(),
    later = snapshot(0),
    doc = { documentElement: {} };
  let closes = 0;
  const createHost = () => ({ load: async () => first, apply: () => {}, close: () => closes++ });
  const one = mountPresentationPage({ document: doc, window: null, createHost }),
    two = mountPresentationPage({ document: doc, window: null, createHost });
  one.bindPainter(painter);
  two.bindPainter(painter);
  await one.ready;
  assert.equal(painter.presentation, first);
  one.close();
  assert.equal(painter.presentation, first);
  painter.setPresentation(later);
  two.close();
  assert.equal(painter.presentation, later, 'Closing the old page lease cannot undo a later look.');
  assert.equal(closes, 1);
});
