import test from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareTeamAnchors,
  drawTeamAnchor,
  TEAM_ANCHOR_SLOTS,
} from '../couch/coop-anchor-presentation.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';

const palette = {
  ink: '#f3f0db',
  paper: '#070b12',
  muted: '#a5b2bb',
  accent: '#f4bf62',
  safe: '#78dce8',
  danger: '#f07879',
  field: '#070b12',
  grid: '#182631',
  sky: '#dfb781',
  land: '#687c55',
};
function snapshot() {
  const images = Object.fromEntries(
    TEAM_ANCHOR_SLOTS.map((id) => [
      id,
      { image: { width: 24, height: 24, id }, geometry: { pivot: { x: 0.5, y: 0.5 } } },
    ]),
  );
  const assets = Object.fromEntries(TEAM_ANCHOR_SLOTS.map((id) => [id, { kind: 'image' }]));
  return {
    images,
    resolved: { assets },
    canvas: { palette, motionScale: 1, assets },
    fonts: { ui: 'Exo 2', numeric: 'IBM Plex Mono' },
    image: (id) => images[id] ?? null,
  };
}
function surface() {
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get(t, k) {
        if (k in t) return t[k];
        return (...args) => {
          calls.push({ method: k, args });
          return k === 'measureText' ? { width: String(args[0]).length * 0.5 } : undefined;
        };
      },
      set(t, k, v) {
        t[k] = v;
        return true;
      },
    },
  );
  return {
    calls,
    ctx,
    canvas: { width: 1152, height: 576, clientWidth: 1152, getContext: () => ctx },
  };
}
test('new anchor slots are explicit and historical bundles remain valid without them', () => {
  const next = createDefaultThemeBundle();
  for (const id of TEAM_ANCHOR_SLOTS) {
    const slot = next.slots.find((s) => s.id === id);
    assert.deepEqual(slot.dimensions, { width: 24, height: 24 });
    assert.equal(slot.required, false);
    assert.equal(resolvePresentation(next).assets[id].recipe.id, 'team.anchor.v1');
    assert(slot.requirements.some((s) => /collision/.test(s)));
  }
  const old = structuredClone(next);
  old.slots = old.slots.filter((s) => !TEAM_ANCHOR_SLOTS.includes(s.id));
  old.assets = old.assets.filter((a) => !TEAM_ANCHOR_SLOTS.some((id) => a.id === `${id}.default`));
  for (const t of old.themes) for (const id of TEAM_ANCHOR_SLOTS) delete t.bindings[id];
  assert(validateThemeBundle(old));
  assert.deepEqual(prepareTeamAnchors(null), {});
});
test('advertised malformed frames fail visibly, while unsupported old snapshots stay readable', () => {
  for (const mutate of [
    (s) => delete s.images[TEAM_ANCHOR_SLOTS[0]],
    (s) => (s.images[TEAM_ANCHOR_SLOTS[0]].image.width = 32),
    (s) => (s.images[TEAM_ANCHOR_SLOTS[0]].geometry.pivot.x = 0),
    (s) =>
      (s.resolved.assets[TEAM_ANCHOR_SLOTS[0]] = {
        kind: 'recipe',
        recipe: { id: 'pickup.icon.v1' },
      }),
  ]) {
    const s = snapshot();
    mutate(s);
    assert.throws(() => prepareTeamAnchors(s), /Team anchor/);
  }
  const s = snapshot(),
    frames = prepareTeamAnchors(s);
  s.images[TEAM_ANCHOR_SLOTS[0]].geometry.pivot.x = 0;
  assert.equal(frames[TEAM_ANCHOR_SLOTS[0]].geometry.pivot.x, 0.5);
});
test('replacement decoration is bounded and the functional square remains above it', () => {
  const s = snapshot(),
    { ctx, calls } = surface();
  drawTeamAnchor(ctx, prepareTeamAnchors(s), { x: 12, y: 8, captured: false }, palette);
  const image = calls.find((c) => c.method === 'drawImage');
  assert.deepEqual(image.args.slice(1), [11.3, 7.3, 1.4, 1.4]);
  assert(calls.findIndex((c) => c.method === 'strokeRect') > calls.indexOf(image));
  assert.equal(calls[0].method, 'save');
  assert.equal(calls.at(-1).method, 'restore');
});
for (const scenario of ['initial', 'anchors', 'victory'])
  test(`real Team painter selects actual anchor states in ${scenario} without changing the run`, () => {
    const fixture = createStudioTeamFixture({ arena: 'relay-yard', scenario }),
      run = fixture.run,
      before = structuredClone(run),
      s = snapshot(),
      { canvas, calls } = surface(),
      painter = createCoopPainter(canvas);
    painter.setPresentation(s);
    painter.paint(run, { reduced: true });
    const expected = run.strongholds
      .flatMap((h) => h.anchors)
      .map((a) => s.images[TEAM_ANCHOR_SLOTS[a.captured ? 1 : 0]].image);
    const drawn = calls.filter((c) => c.method === 'drawImage').map((c) => c.args[0]);
    assert.deepEqual(drawn, expected);
    const labels = calls.filter((c) => c.method === 'fillText').map((c) => c.args[0]);
    assert(expected.length > 0);
    assert(labels.some((x) => ['A', 'B', '✓'].includes(x)));
    const anchorRows = run.strongholds.flatMap((item) => item.anchors);
    for (const call of calls.filter(
      (call) => call.method === 'fillText' && ['A', 'B', '✓'].includes(call.args[0]),
    ))
      assert(
        !anchorRows.some((anchor) => call.args[1] === anchor.x && call.args[2] === anchor.y),
        'Registered decoration stays visible beside its readable label.',
      );
    assert.deepEqual(run, before);
    const broken = snapshot();
    broken.images[TEAM_ANCHOR_SLOTS[1]].image.width = 25;
    assert.throws(() => painter.setPresentation(broken), /Team anchor/);
    calls.length = 0;
    painter.paint(run, { reduced: true });
    assert.deepEqual(
      calls.filter((c) => c.method === 'drawImage').map((c) => c.args[0]),
      expected,
    );
  });
