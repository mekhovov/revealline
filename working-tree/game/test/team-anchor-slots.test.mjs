import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalJSON } from '../data-json.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import {
  TEAM_ANCHOR_SLOTS,
  prepareTeamAnchorSlots,
  teamAnchorSlotSpecs,
} from '../presentation/team-anchor-slots.mjs';
import { prepareTeamActorSlots } from '../presentation/team-actor-slots.mjs';
import { adoptStudioBundle, generateAssetPrompt } from '../presentation/studio-session.mjs';
import { exportThemeBundle, importThemeBundle } from '../presentation/bundle.mjs';
import { checkFieldKitReadiness } from '../../scripts/check-field-kit-readiness.mjs';
import { prepareCoopAnchors, drawCoopAnchor } from '../couch/coop-anchor-presentation.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createCoop, validateCoopLevel } from '../coop/core.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { teamPreviewBinding } from '../../authoring/asset-studio/cross-mode-preview.mjs';
const original = createDefaultThemeBundle(),
  prepared = prepareTeamAnchorSlots(original),
  resolved = resolvePresentation(prepared);
test('anchor registration adds both source recipes without altering historical records', () => {
  assert.equal(TEAM_ANCHOR_SLOTS.length, 2);
  assert.equal(prepared.revision, original.revision + 1);
  for (const field of ['slots', 'assets', 'themes', 'collections'])
    assert.deepEqual(prepared[field].slice(0, original[field].length), original[field]);
  for (const slot of teamAnchorSlotSpecs()) {
    assert.equal(slot.required, false);
    assert.deepEqual(slot.kinds, ['recipe', 'image']);
    assert.match(generateAssetPrompt(slot, resolved), /24/);
    assert.equal(resolved.assets[slot.id].quality.stage, 'source');
  }
  assert.deepEqual(prepareTeamAnchorSlots(prepared), prepared);
  const old = structuredClone(prepared);
  old.selection = original.selection;
  assert.deepEqual(resolvePresentation(old), resolvePresentation(original));
  const partial = structuredClone(original);
  partial.slots.push(teamAnchorSlotSpecs()[0]);
  assert.throws(() => prepareTeamAnchorSlots(partial), /both slot contracts/);
});
test('anchor import validates complete exact contracts, preserves history and export bytes', async () => {
  const bytes = await exportThemeBundle(prepared, new Map()),
    loaded = await importThemeBundle(bytes, { decodeImage: null });
  assert.deepEqual(loaded.document, prepared);
  assert.deepEqual(
    new Uint8Array(await (await exportThemeBundle(loaded.document, loaded.assets)).arrayBuffer()),
    new Uint8Array(await bytes.arrayBuffer()),
  );
  const adopted = adoptStudioBundle(original, loaded.document);
  assert.equal(
    resolvePresentation(adopted).assets['team.anchor.available'].recipe.id,
    'team.anchor.v1',
  );
  const corrupt = structuredClone(prepared);
  corrupt.slots.at(-1).requirements[0] = 'Wrong meaning';
  const before = canonicalJSON(original);
  assert.throws(() => adoptStudioBundle(original, corrupt), /anchor contract/);
  assert.equal(canonicalJSON(original), before);
  const partial = structuredClone(prepared);
  partial.slots.pop();
  assert.throws(() => adoptStudioBundle(original, partial));
});
function anchorSnapshot() {
  const assets = {},
    images = new Map();
  for (const { id } of TEAM_ANCHOR_SLOTS) {
    const asset = { id: id + '.test', revision: 1, kind: 'image' };
    assets[id] = asset;
    images.set(id, {
      asset,
      image: { id, width: 24, height: 24 },
      geometry: { frame: { x: 0, y: 0, width: 24, height: 24 }, pivot: { x: 0.5, y: 0.5 } },
    });
  }
  return { resolved: { assets }, image: (id) => images.get(id), images };
}
test('anchor image preparation fails atomically for missing inactive states and never closes borrowed frames', () => {
  const snapshot = anchorSnapshot(),
    frames = prepareCoopAnchors(snapshot);
  assert.equal(frames.size, 2);
  snapshot.images.delete('team.anchor.captured');
  assert.throws(() => prepareCoopAnchors(snapshot), /exact prepared/);
  assert.equal(frames.size, 2);
  const wrong = anchorSnapshot();
  wrong.images.get('team.anchor.available').asset = { id: 'wrong', revision: 1 };
  assert.throws(() => prepareCoopAnchors(wrong), /exact prepared/);
  const cropped = anchorSnapshot();
  cropped.images.get('team.anchor.available').geometry.frame.width = 12;
  assert.throws(() => prepareCoopAnchors(cropped), /24/);
  const old = prepareCoopAnchors({ resolved });
  assert.equal(old.size, 0);
  assert.equal(prepareCoopAnchors(null).size, 0);
});
function surface() {
  const calls = [],
    stack = [];
  let state = { globalAlpha: 1 };
  const ctx = new Proxy(
    {},
    {
      get(_, key) {
        if (key in state) return state[key];
        return (...args) => {
          calls.push({ key, args, state: { ...state } });
          if (key === 'save') stack.push({ ...state });
          if (key === 'restore') state = stack.pop();
          if (key === 'measureText')
            return {
              width: parseFloat(state.font.match(/([\d.]+)px/)[1]) * String(args[0]).length * 0.6,
            };
        };
      },
      set(_, key, value) {
        state[key] = value;
        return true;
      },
    },
  );
  return {
    ctx,
    calls,
    stack,
    canvas: { width: 1152, height: 576, clientWidth: 390, getContext: () => ctx },
  };
}
const palette = {
  ink: '#ffffff',
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
test('real Team painter selects captured/available artwork without replacing label, border or state', () => {
  const view = surface(),
    painter = createCoopPainter(view.canvas),
    snapshot = anchorSnapshot();
  snapshot.canvas = { palette, motionScale: 0 };
  snapshot.fonts = { ui: 'Test', numeric: 'Test' };
  const run = createCoop(RELAY_YARD);
  run.strongholds[0].anchors[0].captured = true;
  const before = structuredClone(run);
  painter.setPresentation(snapshot);
  painter.paint(run);
  const ids = view.calls.filter((call) => call.key === 'drawImage').map((call) => call.args[0].id);
  assert.ok(ids.includes('team.anchor.captured'));
  assert.ok(ids.includes('team.anchor.available'));
  for (const text of ['✓', 'B'])
    assert.ok(view.calls.some((call) => call.key === 'fillText' && call.args[0] === text));
  assert.deepEqual(run, before);
  assert.equal(view.stack.length, 0);
  const invalid = anchorSnapshot();
  invalid.canvas = snapshot.canvas;
  invalid.fonts = snapshot.fonts;
  invalid.images.delete('team.anchor.captured');
  assert.throws(() => painter.setPresentation(invalid));
  assert.equal(painter.presentation, snapshot);
  view.calls.length = 0;
  painter.paint(createCoop(FIRST_CONNECTION));
  assert.equal(
    view.calls.filter((call) => call.key === 'drawImage').length,
    0,
    'no invented anchors in First Connection',
  );
  const separate = surface(),
    frames = prepareCoopAnchors(snapshot);
  assert.ok(drawCoopAnchor(separate.ctx, frames, { x: 12, y: 15, captured: true }));
  assert.equal(separate.stack.length, 0);
});
test('production anchors require reviewed pair and coexist with actor contracts and real preview bindings', async () => {
  const published = await importThemeBundle(
    new Blob([
      await readFile(
        new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
      ),
    ]),
    { decodeImage: null },
  );
  const document = prepareTeamAnchorSlots(published.document),
    view = resolvePresentation(document);
  for (const arena of ['first-connection', 'relay-yard'])
    assert.ok(teamPreviewBinding('team.anchor.available', view, arena));
  const combined = prepareTeamActorSlots(document);
  assert.equal(combined.slots.length, published.document.slots.length + 34);
  assert.doesNotThrow(() => adoptStudioBundle(published.document, combined));
  await assert.rejects(
    checkFieldKitReadiness(await exportThemeBundle(document, published.assets)),
    (error) =>
      error.unresolved.length === 2 &&
      error.unresolved.every((row) => row.slotId.startsWith('team.anchor.')),
  );
});

test('phone anchor artwork keeps minimum size, stays in the arena and is painted before labels', () => {
  for (const width of [238, 320, 390, 1152]) {
    const view = surface(),
      frames = prepareCoopAnchors(anchorSnapshot()),
      cssCell = width / 72;
    for (const point of [
      { x: 0.5, y: 0.5 },
      { x: 71.5, y: 35.5 },
    ]) {
      const drawn = drawCoopAnchor(
        view.ctx,
        frames,
        { ...point, captured: false },
        { cssCell, width: 72, height: 36 },
      );
      assert.ok(drawn.size * cssCell >= 24 - 1e-10);
      assert.ok(drawn.x - drawn.size / 2 >= 0);
      assert.ok(drawn.y - drawn.size / 2 >= 0);
      assert.ok(drawn.x + drawn.size / 2 <= 72);
      assert.ok(drawn.y + drawn.size / 2 <= 36);
    }
    const snapshot = anchorSnapshot();
    snapshot.canvas = { palette, motionScale: 0 };
    snapshot.fonts = { ui: 'Test', numeric: 'Test' };
    view.canvas.clientWidth = width;
    const painter = createCoopPainter(view.canvas);
    painter.setPresentation(snapshot);
    view.calls.length = 0;
    painter.paint(createCoop(RELAY_YARD));
    const images = view.calls.filter((call) => call.key === 'drawImage');
    const labelPlates = view.calls.filter(
      (call) => call.key === 'fillRect' && call.state.fillStyle === palette.paper,
    );
    for (const art of images)
      for (const plate of labelPlates) {
        const [, ax, ay, aw, ah] = art.args,
          [bx, by, bw, bh] = plate.args;
        assert.ok(
          ax + aw <= bx || bx + bw <= ax || ay + ah <= by || by + bh <= ay,
          'label plate must not cover anchor artwork',
        );
      }
    const lastImage = view.calls.findLastIndex((call) => call.key === 'drawImage');
    const firstLabel = view.calls.findIndex((call) => call.key === 'fillText');
    assert.ok(lastImage < firstLabel);
  }
});

test('custom anchor pivots retain full bounds at every corner', () => {
  for (const pivot of [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
    { x: 0.2, y: 0.8 },
  ])
    for (const anchor of [
      { x: 0.5, y: 0.5 },
      { x: 71.5, y: 35.5 },
    ]) {
      const snapshot = anchorSnapshot();
      snapshot.images.get('team.anchor.available').geometry.pivot = pivot;
      const view = surface();
      drawCoopAnchor(
        view.ctx,
        prepareCoopAnchors(snapshot),
        { ...anchor, captured: false },
        { cssCell: 238 / 72, width: 72, height: 36 },
      );
      const [, x, y, w, h] = view.calls.find((call) => call.key === 'drawImage').args;
      assert.ok(x >= -1e-10 && y >= -1e-10 && x + w <= 72 + 1e-10 && y + h <= 36 + 1e-10);
    }
});

test('dense imported anchors retain distinct targets instead of covering each other with artwork', () => {
  for (const width of [238, 390, 1152]) {
    for (const scenario of ['separate', 'dense', 'mixed-dense', 'near-core']) {
      const dense = scenario.includes('dense');
      const level = structuredClone(RELAY_YARD);
      level.id = 'imported-adjacent-anchors';
      level.walls = [];
      level.enemies = [];
      level.strongholds = [
        {
          id: 'imported-relay',
          core: scenario === 'near-core' ? { x: 3.5, y: 1.5 } : { x: 35.5, y: 18.5 },
          anchors: [
            { x: 1.5, y: 1.5 },
            { x: dense ? 2.5 : 70.5, y: 1.5 },
          ],
        },
      ];
      level.goal = { cores: ['imported-relay'] };
      assert.equal(validateCoopLevel(level).valid, true);
      const view = surface(),
        painter = createCoopPainter(view.canvas),
        run = createCoop(level);
      view.canvas.clientWidth = width;
      const snapshot = anchorSnapshot();
      if (scenario === 'mixed-dense')
        snapshot.resolved.assets['team.anchor.available'] = {
          kind: 'recipe',
          recipe: { id: 'team.anchor.v1' },
        };
      snapshot.canvas = { palette, motionScale: 0 };
      snapshot.fonts = { ui: 'Test', numeric: 'Test' };
      painter.setPresentation(snapshot);
      run.strongholds[0].anchors[1].captured = true;
      const before = structuredClone(run);
      painter.paint(run, { reduced: true });
      const images = view.calls.filter((call) => call.key === 'drawImage');
      assert.equal(
        images.length,
        dense ? 0 : scenario === 'near-core' && width < 1152 ? 1 : 2,
        `${width}px / ${scenario}`,
      );
      for (const label of ['A', '✓'])
        assert.ok(view.calls.some((call) => call.key === 'fillText' && call.args[0] === label));
      for (const anchor of run.strongholds[0].anchors)
        assert.ok(
          view.calls.some(
            (call) =>
              call.key === 'strokeRect' &&
              call.args[0] === anchor.x - 0.7 &&
              call.args[1] === anchor.y - 0.7 &&
              call.args[2] === 1.4,
          ),
        );
      assert.deepEqual(run, before);
      assert.equal(view.stack.length, 0);
    }
  }
});
