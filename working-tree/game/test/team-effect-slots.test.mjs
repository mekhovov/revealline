import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalJSON } from '../data-json.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import {
  TEAM_EFFECT_SLOTS,
  prepareTeamEffectSlots,
  teamEffectSlotSpecs,
} from '../presentation/team-effect-slots.mjs';
import { prepareTeamActorSlots } from '../presentation/team-actor-slots.mjs';
import { adoptStudioBundle, generateAssetPrompt } from '../presentation/studio-session.mjs';
import { exportThemeBundle, importThemeBundle } from '../presentation/bundle.mjs';
import { checkFieldKitReadiness } from '../../scripts/check-field-kit-readiness.mjs';
import { prepareCoopEffects, coopEffectMarkers } from '../couch/coop-effect-presentation.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createCoop, startCoop, stepCoop, pauseCoop } from '../coop/core.mjs';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { teamPreviewBinding } from '../../authoring/asset-studio/cross-mode-preview.mjs';
const original = createDefaultThemeBundle(),
  prepared = prepareTeamEffectSlots(original),
  resolved = resolvePresentation(prepared);
test('effect registration adds four source recipes without altering historical records', () => {
  assert.equal(TEAM_EFFECT_SLOTS.length, 4);
  assert.equal(prepared.revision, original.revision + 1);
  for (const field of ['slots', 'assets', 'themes', 'collections'])
    assert.deepEqual(prepared[field].slice(0, original[field].length), original[field]);
  for (const slot of teamEffectSlotSpecs()) {
    assert.equal(slot.required, false);
    assert.deepEqual(slot.kinds, ['recipe', 'image']);
    assert.match(generateAssetPrompt(slot, resolved), /32/);
    assert.equal(resolved.assets[slot.id].quality.stage, 'source');
  }
  assert.deepEqual(prepareTeamEffectSlots(prepared), prepared);
  const old = structuredClone(prepared);
  old.selection = original.selection;
  assert.deepEqual(resolvePresentation(old), resolvePresentation(original));
  const partial = structuredClone(original);
  partial.slots.push(teamEffectSlotSpecs()[0]);
  assert.throws(() => prepareTeamEffectSlots(partial), /all four slot contracts/);
});
test('effect import validates complete exact contracts, preserves history and export bytes', async () => {
  const bytes = await exportThemeBundle(prepared, new Map()),
    loaded = await importThemeBundle(bytes, { decodeImage: null });
  assert.deepEqual(loaded.document, prepared);
  assert.deepEqual(
    new Uint8Array(await (await exportThemeBundle(loaded.document, loaded.assets)).arrayBuffer()),
    new Uint8Array(await bytes.arrayBuffer()),
  );
  const adopted = adoptStudioBundle(original, loaded.document);
  assert.equal(
    resolvePresentation(adopted).assets['team.effect.support'].recipe.id,
    'team.effect.v1',
  );
  const corrupt = structuredClone(prepared);
  corrupt.slots.at(-1).requirements[0] = 'Wrong meaning';
  const before = canonicalJSON(original);
  assert.throws(() => adoptStudioBundle(original, corrupt), /effect contract/);
  assert.equal(canonicalJSON(original), before);
  const partial = structuredClone(prepared);
  partial.slots.pop();
  assert.throws(() => adoptStudioBundle(original, partial));
});
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

function effectSnapshot() {
  const assets = {},
    images = new Map();
  for (const { id } of TEAM_EFFECT_SLOTS) {
    const asset = { id: id + '.test', revision: 1, kind: 'image' };
    assets[id] = asset;
    images.set(id, {
      asset,
      image: { id, width: 32, height: 32 },
      geometry: { frame: { x: 0, y: 0, width: 32, height: 32 }, pivot: { x: 0.5, y: 0.5 } },
    });
  }
  return {
    resolved: { assets },
    image: (id) => images.get(id),
    images,
    canvas: { palette, motionScale: 0 },
    fonts: { ui: 'Test', numeric: 'Test' },
  };
}
function surface(width = 390) {
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
          if (key === 'measureText') return { width: String(args[0]).length * 0.7 };
        };
      },
      set(_, key, value) {
        state[key] = value;
        return true;
      },
    },
  );
  return {
    calls,
    stack,
    canvas: { width: 1152, height: 576, clientWidth: width, getContext: () => ctx },
  };
}
test('effect preparation checks every declared image before atomic adoption, including inactive roles', () => {
  const snapshot = effectSnapshot(),
    frames = prepareCoopEffects(snapshot);
  assert.equal(frames.size, 4);
  const target = surface(),
    painter = createCoopPainter(target.canvas);
  painter.setPresentation(snapshot);
  const invalid = effectSnapshot();
  invalid.images.delete('team.effect.rescue');
  assert.throws(() => painter.setPresentation(invalid), /exact prepared 32/);
  assert.equal(painter.presentation, snapshot);
  for (const change of [
    (frame) => (frame.asset = { id: 'wrong', revision: 1 }),
    (frame) => (frame.geometry.frame.width = 16),
    (frame) => (frame.geometry.pivot.x = NaN),
  ]) {
    const bad = effectSnapshot();
    change(bad.images.get('team.effect.recovery'));
    assert.throws(() => prepareCoopEffects(bad), /exact prepared/);
  }
  assert.equal(prepareCoopEffects(null).size, 0);
  assert.equal(prepareCoopEffects({ resolved }).size, 0);
});
const scenes = [
  ['support', 'support', 2],
  ['slowed', 'slowed', 2],
  ['rescue-p1', 'rescue', 1],
  ['rescue-p2', 'rescue', 1],
  ['recovered-p1', 'recovery', 1],
  ['recovered-p2', 'recovery', 1],
];
for (const [scenario, role, count] of scenes) {
  test(`earned ${scenario} selects ${role} images without mutating timing or simulation`, () => {
    const fixture = createStudioTeamFixture({ arena: 'relay-yard', scenario });
    const before = structuredClone(fixture.run),
      markers = coopEffectMarkers(fixture.run);
    assert.equal(markers.filter((marker) => marker.slot === `team.effect.${role}`).length, count);
    for (const width of [238, 390, 1152])
      for (const reduced of [false, true]) {
        const view = surface(width),
          painter = createCoopPainter(view.canvas);
        painter.setPresentation(effectSnapshot());
        painter.paint(fixture.run, { reduced });
        const images = view.calls.filter((call) => call.key === 'drawImage');
        assert.ok(
          images.some((call) => call.args[0].id === `team.effect.${role}`),
          `${scenario} at ${width}`,
        );
        for (const {
          args: [, x, y, w, h],
        } of images) {
          assert.ok(x >= 0 && y >= 0 && x + w <= 72 && y + h <= 36);
          assert.ok(Math.abs((w * width) / 72 - 24) < 1e-8);
        }
        assert.equal(view.stack.length, 0);
        assert.deepEqual(fixture.run, before);
        const first = structuredClone(view.calls);
        view.calls.length = 0;
        painter.paint(fixture.run, { reduced });
        assert.deepEqual(view.calls, first, 'held preview never uses a wall-clock timer');
      }
  });
}
test('inactive, expired, downed, paused and hunter-recovery states never invent player feedback', () => {
  assert.deepEqual(coopEffectMarkers(createCoop(FIRST_CONNECTION)), []);
  assert.deepEqual(
    coopEffectMarkers(
      createStudioTeamFixture({ arena: 'relay-yard', scenario: 'hunter-recovery' }).run,
    ),
    [],
  );
  const pulse = createStudioTeamFixture({ arena: 'first-connection', scenario: 'support' }).run;
  assert.equal(
    coopEffectMarkers(pulse).filter((marker) => marker.slot.endsWith('.support')).length,
    2,
  );
  pulse.time = Math.max(...pulse.supportEffects.map((effect) => effect.until));
  assert.equal(
    coopEffectMarkers(pulse).some((marker) => marker.slot.endsWith('.support')),
    false,
  );
  const slowed = createStudioTeamFixture({ arena: 'first-connection', scenario: 'slowed' }).run;
  assert.equal(
    coopEffectMarkers(slowed).some((marker) => marker.slot.endsWith('.support')),
    false,
  );
  for (const enemy of slowed.enemies) enemy.active = false;
  assert.equal(
    coopEffectMarkers(slowed).some((marker) => marker.slot.endsWith('.slowed')),
    false,
  );
  const rescuing = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'rescue-p1' }).run;
  pauseCoop(rescuing);
  assert.equal(
    coopEffectMarkers(rescuing).some((marker) => marker.slot.endsWith('.rescue')),
    false,
  );
  const recovery = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'recovered-p1' }).run;
  recovery.time = Math.max(...recovery.players.map((player) => player.graceUntil));
  assert.equal(
    coopEffectMarkers(recovery).some((marker) => marker.slot.endsWith('.recovery')),
    false,
  );
});
test('effect registration coexists with actor contracts and production rejects unreviewed feedback', async () => {
  const published = await importThemeBundle(
    new Blob([
      await readFile(
        new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
      ),
    ]),
    { decodeImage: null },
  );
  const document = prepareTeamEffectSlots(published.document),
    view = resolvePresentation(document);
  for (const arena of ['first-connection', 'relay-yard'])
    for (const { id } of TEAM_EFFECT_SLOTS) assert.ok(teamPreviewBinding(id, view, arena));
  const combined = prepareTeamActorSlots(document);
  assert.equal(combined.slots.length, published.document.slots.length + 36);
  assert.doesNotThrow(() => adoptStudioBundle(published.document, combined));
  await assert.rejects(
    checkFieldKitReadiness(await exportThemeBundle(document, published.assets)),
    (error) =>
      error.unresolved.length === 4 &&
      error.unresolved.every((row) => row.slotId.startsWith('team.effect.')),
  );
});
test('painting feedback throughout ordinary commands leaves historical simulation exactly unchanged', () => {
  const expected = createCoop(RELAY_YARD),
    actual = createCoop(RELAY_YARD),
    painter = createCoopPainter(surface().canvas);
  painter.setPresentation(effectSnapshot());
  startCoop(expected);
  startCoop(actual);
  let activeFrames = 0;
  for (let tick = 0; tick < 600; tick++) {
    const commands = [
      { direction: tick < 60 ? 'up' : 'right', boost: true, support: tick === 290 },
      { direction: tick < 60 ? 'up' : 'left', boost: true, support: tick === 290 },
    ];
    stepCoop(expected, commands, 1 / 120);
    stepCoop(actual, commands, 1 / 120);
    painter.paint(actual);
    if (coopEffectMarkers(actual).length) activeFrames++;
  }
  assert.ok(actual.tick > 0 && actual.time > 0);
  assert.ok(activeFrames > 0);
  assert.deepEqual(actual, expected);
});

test('feedback near a relay core respects its nested position and cosmetic bounds', () => {
  for (const width of [238, 390, 1152]) {
    const run = createCoop(RELAY_YARD),
      view = surface(width),
      painter = createCoopPainter(view.canvas);
    const core = run.strongholds[0].core;
    // A synthetic placement stress case, separate from command-earned state tests.
    run.supportEffects = [{ x: core.x, y: core.y + 3, player: 0, until: 1 }];
    painter.setPresentation(effectSnapshot());
    painter.paint(run);
    const radius = Math.max(12, width / 72 + 3),
      cx = (core.x * width) / 72,
      cy = (core.y * width) / 72;
    for (const {
      args: [, x, y, w, h],
    } of view.calls.filter((call) => call.key === 'drawImage')) {
      const left = (x * width) / 72,
        top = (y * width) / 72,
        size = (w * width) / 72;
      assert.ok(
        left + size <= cx - radius ||
          left >= cx + radius ||
          top + (h * width) / 72 <= cy - radius ||
          top >= cy + radius,
      );
    }
  }
});
