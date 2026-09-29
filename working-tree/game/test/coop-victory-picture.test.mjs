import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createCoop, startCoop, pauseCoop } from '../coop/core.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createCoopPresentation } from '../couch/coop-presentation.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';
import { canvasPresentation, presentationCSSVariables } from '../presentation/runtime.mjs';
import { coverageClear, yardOpening } from './helpers/coop-route-search.mjs';

const compiled = validateCompiledPresentation(
  JSON.parse(await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url))),
);
const css = presentationCSSVariables(compiled.resolved);
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

// Actual approved bytes and real lease validation; image decode and canvas commands
// are finite observations, not browser rasterization or complete reward UX proof.
async function fixture(t, index) {
  const row = COOP_PICTURE_BINDINGS[index];
  const original = await readFile(
    new URL(`../presentation/compiled/${compiled.urls[row.picture.sha256]}`, import.meta.url),
  );
  const snapshot = {
    resolved: compiled.resolved,
    canvas: canvasPresentation(compiled.resolved),
    fonts: { ui: css['--fk-font-ui'], numeric: css['--fk-font-mono'] },
  };
  const counts = { reads: 0, decodes: 0, releases: 0 };
  const image = { width: 1152, height: 576, sha256: row.picture.sha256 };
  const lease = createCoopPresentation({
    bindings: COOP_PICTURE_BINDINGS,
    getSnapshot: () => snapshot,
    async readPicture(slot) {
      counts.reads++;
      assert.equal(slot, row.picture.slot);
      return {
        asset: compiled.resolved.assets[slot],
        blob: new Blob([original], { type: 'image/png' }),
      };
    },
    async decodeImage(blob) {
      counts.decodes++;
      assert.equal(
        createHash('sha256')
          .update(Buffer.from(await blob.arrayBuffer()))
          .digest('hex'),
        row.picture.sha256,
      );
      return { image, release: () => counts.releases++ };
    },
  });
  t.after(() => lease.dispose());
  const picture = await lease.select({
    pack: COOP_STARTER_PACK,
    levelId: row.levelId,
    themeId: 'fpv',
    attemptId: 'victory-picture',
  });
  const calls = [],
    stack = [];
  let state = { imageSmoothingEnabled: true, globalAlpha: 0.3 };
  const context = new Proxy(
    {},
    {
      get(_, key) {
        if (key in state) return state[key];
        return (...args) => {
          calls.push({ name: key, args, state: { ...state } });
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') state = stack.pop();
          if (key === 'measureText') return { width: String(args[0]).length * 0.7 };
        };
      },
      set(_, key, value) {
        state[key] = value;
        return true;
      },
    },
  );
  const painter = createCoopPainter({
    width: 1152,
    height: 576,
    clientWidth: 1152,
    getContext: () => context,
  });
  painter.setPresentation(snapshot);
  return { painter, picture, counts, image, calls, stack, context, lease };
}

for (const [index, name, route] of [
  [0, 'First Connection', coverageClear],
  [1, 'Relay Yard', yardOpening],
]) {
  test(`${name}: a real authored win shows the exact full picture without overwriting captured state`, async (t) => {
    const { run, events } = route('standard', { boost: true, cover: true });
    assert.equal(run.status, 'won');
    assert.ok(
      run.cells.some((cell) => cell === 0),
      'This win still has genuinely hidden cells.',
    );
    if (index === 1)
      assert.ok(
        run.cells.some((cell) => cell === 2),
        'Authored walls remain.',
      );
    assert.ok(run.coverage < 1);
    assert.equal(events.filter((event) => event.type === 'run.completed').length, 1);
    const before = structuredClone(run),
      beforeEvents = structuredClone(events);
    const f = await fixture(t, index);
    for (const reduced of [false, true, true, false]) {
      f.calls.length = 0;
      f.painter.paint(run, { picture: f.picture, reduced });
      const images = f.calls.filter((call) => call.name === 'drawImage');
      assert.equal(images.length, 1);
      assert.equal(images[0].args[0], f.image, 'The accepted decoded object is reused.');
      assert.deepEqual(images[0].args.slice(1), [0, 0, 1152, 576, 0, 0, 72, 36]);
      assert.equal(images[0].state.imageSmoothingEnabled, false);
      assert.equal(images[0].state.globalAlpha, 1);
      assert.equal(images[0].state.globalCompositeOperation, 'source-over');
      assert.deepEqual(
        f.calls.slice(f.calls.indexOf(images[0]) + 1).filter((call) => drawing.has(call.name)),
        [],
        'No black mask, walls, hazards, actors or labels cover the earned original.',
      );
      assert.equal(f.stack.length, 0);
      assert.equal(f.context.imageSmoothingEnabled, true);
      assert.equal(f.context.globalAlpha, 0.3);
      assert.deepEqual(run, before);
      assert.deepEqual(events, beforeEvents);
      assert.deepEqual(f.counts, { reads: 1, decodes: 1, releases: 0 });
    }
    f.painter.setPresentation(null);
    assert.equal(f.counts.releases, 0, 'The painter does not own the borrowed image.');
    f.lease.dispose();
    assert.equal(f.counts.releases, 1);
  });
}

test('running, paused and lost pictures retain opaque concealment, walls and gameplay cues', async (t) => {
  const f = await fixture(t, 1);
  const run = startCoop(createCoop(RELAY_YARD));
  for (const status of ['running', 'paused', 'lost']) {
    if (status === 'paused') pauseCoop(run);
    // The loss case is a painter-state fixture, not a claim of a played defeat.
    if (status === 'lost') run.status = 'lost';
    const before = structuredClone(run);
    f.calls.length = 0;
    f.painter.paint(run, { picture: f.picture });
    const draw = f.calls.findIndex((call) => call.name === 'drawImage');
    const after = f.calls.slice(draw + 1);
    assert.ok(after.some((call) => call.name === 'fillRect' && call.state.fillStyle === '#000000'));
    assert.ok(
      after.some(
        (call) =>
          call.name === 'fillRect' &&
          call.state.fillStyle === f.picture.snapshot.canvas.palette.muted,
      ),
    );
    assert.ok(after.some((call) => call.name === 'fillText'));
    assert.deepEqual(run, before);
  }
});

test('won runs without an approved image keep the existing procedural arena', async (t) => {
  const f = await fixture(t, 1);
  const { run } = yardOpening('standard', { boost: true, cover: true });
  assert.equal(run.status, 'won');
  const before = structuredClone(run);
  for (const picture of [
    null,
    {
      ...f.picture,
      image: null,
      choice: { ...f.picture.choice, kind: 'procedural' },
    },
  ]) {
    f.calls.length = 0;
    f.painter.paint(run, { picture });
    assert.equal(
      f.calls.some((call) => call.name === 'drawImage'),
      false,
    );
    assert.ok(
      f.calls.some(
        (call) =>
          call.name === 'fillRect' &&
          call.state.fillStyle === f.picture.snapshot.canvas.palette.land,
      ),
    );
    assert.ok(f.calls.some((call) => call.name === 'fillText'));
    assert.deepEqual(run, before);
  }
});

test('winning cannot bypass lease validation and failed drawing restores borrowed state', async (t) => {
  const f = await fixture(t, 1);
  const { run } = yardOpening('standard', { boost: true, cover: true });
  assert.equal(run.status, 'won');
  for (const change of [
    { snapshot: { ...f.picture.snapshot } },
    { image: { width: 768, height: 576 } },
    { image: null },
    { choice: { ...f.picture.choice, levelId: 'first-connection' } },
    { sampling: 'linear' },
  ]) {
    f.calls.length = 0;
    assert.throws(
      () => f.painter.paint(run, { picture: { ...f.picture, ...change } }),
      /Team picture/,
    );
    assert.equal(f.calls.length, 0);
  }
  const before = structuredClone(run);
  f.context.drawImage = () => {
    throw new Error('native draw refused');
  };
  assert.throws(() => f.painter.paint(run, { picture: f.picture }), /native draw refused/);
  assert.equal(f.stack.length, 0);
  assert.equal(f.context.imageSmoothingEnabled, true);
  assert.equal(f.context.globalAlpha, 0.3);
  assert.deepEqual(run, before);
  assert.deepEqual(f.counts, { reads: 1, decodes: 1, releases: 0 });
});
