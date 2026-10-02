import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BoardPainter } from '../ui/render.mjs';
import { createRun } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const presets = read('../../authoring/motion-lab/presets.json');
const theme = read('../content/themes.json').themes[0];
const level = read('../content/campaign.json').levels[0];
function canvasFactory(created) {
  return () => {
    const canvas = { width: 0, height: 0, writes: 0 };
    canvas.getContext = () => ({
      drawImage(source) {
        canvas.original = source;
      },
      getImageData() {
        return {
          data:
            canvas.original.pixels?.slice() ??
            new Uint8ClampedArray(canvas.width * canvas.height * 4).fill(128),
        };
      },
      putImageData(pixels) {
        canvas.pixels = pixels.data.slice();
        canvas.writes++;
      },
    });
    created.push(canvas);
    return canvas;
  };
}
function surface() {
  const calls = [],
    stack = [],
    values = { globalAlpha: 1 };
  return {
    calls,
    ctx: new Proxy(
      { canvas: { width: 768, height: 576, clientWidth: 768 } },
      {
        get(target, key) {
          if (key in target) return target[key];
          if (key in values) return values[key];
          return (...args) => {
            calls.push({ key, args, ...values });
            if (key === 'save') stack.push({ ...values });
            if (key === 'restore') Object.assign(values, stack.pop());
          };
        },
        set(_, key, value) {
          values[key] = value;
          return true;
        },
      },
    ),
  };
}
function painter(options = {}) {
  const concealed = [],
    transition = [],
    painter = new BoardPainter(presets, {
      pictureCanvasFactory: canvasFactory(concealed),
      jammerCanvasFactory: canvasFactory(transition),
      ...options,
    });
  painter.theme = theme;
  painter.body = presets.characters['neutral-marker'];
  painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
  painter.background = { width: 64, height: 32 };
  painter.image = { width: 32, height: 32 };
  return { painter, concealed, transition };
}
const pictureCall = (drawing) => drawing.calls.find((call) => call.key === 'drawImage');

test('scene transition modifies only the already concealed picture and releases its bounded cache', () => {
  const run = createRun(level),
    before = authoritativeCheckpoint(run),
    f = painter();
  const a = surface(),
    b = surface();
  f.painter.draw(a.ctx, run, 0, { paused: true, pictureVisibility: 'blurred' });
  f.painter.draw(b.ctx, run, 0, { paused: true, pictureVisibility: 'blurred', demoTransition: 1 });
  assert.equal(f.concealed.length, 1);
  assert.equal(f.transition.length, 1);
  assert.equal(
    f.transition[0].original,
    f.concealed[0],
    'The transition only receives protected pixels.',
  );
  assert.equal(pictureCall(a).args[0], f.concealed[0]);
  assert.equal(pictureCall(b).args[0], f.transition[0]);
  assert.deepEqual(
    b.calls.filter((call) => call !== pictureCall(b)),
    a.calls.filter((call) => call !== pictureCall(a)),
  );
  assert.ok(
    !b.calls.some((call) => call.key === 'drawImage' && call.args[0] === f.painter.background),
  );
  assert.deepEqual(authoritativeCheckpoint(run), before);
  const end = surface();
  f.painter.draw(end.ctx, run, 0, {
    paused: true,
    pictureVisibility: 'blurred',
    demoTransition: 0,
  });
  assert.equal(pictureCall(end).args[0], f.concealed[0]);
  f.painter.dispose();
  assert.equal(f.concealed[0].width, 0);
  assert.equal(f.transition[0].width, 0);
});

test('reduced effects and invalid transition inputs skip transition work, and failed filtering cannot expose raw art', () => {
  const run = createRun(level);
  for (const options of [
    { demoTransition: 1, reduced: true },
    { demoTransition: -1 },
    { demoTransition: NaN },
    { demoTransition: Infinity },
  ]) {
    const f = painter();
    f.painter.draw(surface().ctx, run, 0, { pictureVisibility: 'blurred', ...options });
    assert.equal(f.transition.length, 0);
    f.painter.dispose();
  }
  let attempts = 0;
  const f = painter({
    jammerCanvasFactory() {
      attempts++;
      throw new Error('Unavailable transition canvas');
    },
  });
  const drawing = surface();
  f.painter.draw(drawing.ctx, run, 0, { pictureVisibility: 'blurred', demoTransition: 1 });
  assert.equal(pictureCall(drawing).args[0], f.concealed[0]);
  assert.notEqual(pictureCall(drawing).args[0], f.painter.background);
  f.painter.draw(surface().ctx, run, 0, { pictureVisibility: 'blurred', demoTransition: 0.5 });
  assert.equal(attempts, 1, 'An unavailable transition canvas is not retried every frame.');
  f.painter.dispose();
});

test('clear demo previews bypass transition and jammer noise without altering simulation or ordinary rendering', () => {
  const run = createRun(level),
    f = painter();
  run.signal = { zoneIds: ['jammer'], speedFactor: 0.5, boostBlocked: true };
  const before = authoritativeCheckpoint(run);
  const clear = surface();
  f.painter.draw(clear.ctx, run, 0, {
    paused: true,
    pictureVisibility: 'clear',
    pictureInterference: false,
    demoTransition: 1,
  });
  assert.equal(pictureCall(clear).args[0], f.painter.background);
  assert.equal(f.transition.length, 0, 'No noisy bitmap is prepared for the clear preview.');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  const ordinary = surface();
  f.painter.draw(ordinary.ctx, run, 0, { paused: true });
  assert.equal(
    pictureCall(ordinary).args[0],
    f.transition[0],
    'Ordinary gameplay still shows jammer interference.',
  );
  const concealed = surface();
  f.painter.draw(concealed.ctx, run, 0, {
    paused: true,
    pictureVisibility: 'blurred',
    pictureInterference: false,
  });
  assert.equal(
    pictureCall(concealed).args[0],
    f.concealed[0],
    'The noise preference cannot override picture eligibility.',
  );
  f.painter.dispose();
});
