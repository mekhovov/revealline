import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { createPresentationHost } from '../presentation/host.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalJSON } from '../data-json.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import {
  TEAM_THREAT_SLOTS,
  prepareTeamThreatSlots,
  teamThreatSlotSpecs,
} from '../presentation/team-threat-slots.mjs';
import { prepareTeamActorSlots } from '../presentation/team-actor-slots.mjs';
import {
  adoptStudioBundle,
  generateAssetPrompt,
  replaceStudioCollection,
} from '../presentation/studio-session.mjs';
import { exportThemeBundle, importThemeBundle } from '../presentation/bundle.mjs';
import { checkFieldKitReadiness } from '../../scripts/check-field-kit-readiness.mjs';
import { prepareCoopThreats, coopThreatMarkers } from '../couch/coop-threat-presentation.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createCoop, startCoop, stepCoop, pauseCoop } from '../coop/core.mjs';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';
import { teamPreviewBinding } from '../../authoring/asset-studio/cross-mode-preview.mjs';
const original = createDefaultThemeBundle(),
  prepared = prepareTeamThreatSlots(original),
  resolved = resolvePresentation(prepared);
test('threat registration adds three source recipes without altering historical records', () => {
  assert.equal(TEAM_THREAT_SLOTS.length, 3);
  assert.equal(prepared.revision, original.revision + 1);
  for (const field of ['slots', 'assets', 'themes', 'collections'])
    assert.deepEqual(prepared[field].slice(0, original[field].length), original[field]);
  for (const slot of teamThreatSlotSpecs()) {
    assert.equal(slot.required, false);
    assert.equal(
      slot.group,
      'effects',
      'must participate in the existing Field context preview family',
    );
    assert.deepEqual(slot.kinds, ['recipe', 'image']);
    assert.ok(
      generateAssetPrompt(slot, resolved).includes(
        `${slot.dimensions.width}×${slot.dimensions.height}`,
      ),
    );
    assert.equal(resolved.assets[slot.id].quality.stage, 'source');
  }
  assert.deepEqual(prepareTeamThreatSlots(prepared), prepared);
  const old = structuredClone(prepared);
  old.selection = original.selection;
  assert.deepEqual(resolvePresentation(old), resolvePresentation(original));
  const partial = structuredClone(original);
  partial.slots.push(teamThreatSlotSpecs()[0]);
  assert.throws(() => prepareTeamThreatSlots(partial), /all three slot contracts/);
});
test('threat import validates complete exact contracts, preserves history and export bytes', async () => {
  const bytes = await exportThemeBundle(prepared, new Map()),
    loaded = await importThemeBundle(bytes, { decodeImage: null });
  assert.deepEqual(loaded.document, prepared);
  assert.deepEqual(
    new Uint8Array(await (await exportThemeBundle(loaded.document, loaded.assets)).arrayBuffer()),
    new Uint8Array(await bytes.arrayBuffer()),
  );
  const adopted = adoptStudioBundle(original, loaded.document);
  assert.equal(
    resolvePresentation(adopted).assets['team.threat.emitter-warning'].recipe.id,
    'team.threat.v1',
  );
  const corrupt = structuredClone(prepared);
  corrupt.slots.at(-1).requirements[0] = 'Wrong meaning';
  const before = canonicalJSON(original);
  assert.throws(() => adoptStudioBundle(original, corrupt), /threat contract/);
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

function threatSnapshot() {
  const assets = {},
    images = new Map();
  for (const spec of teamThreatSlotSpecs()) {
    const { id } = spec,
      size = spec.dimensions.width;
    const asset = { id: id + '.test', revision: 1, kind: 'image' };
    assets[id] = asset;
    images.set(id, {
      asset,
      image: { id, width: size, height: size },
      geometry: { frame: { x: 0, y: 0, width: size, height: size }, pivot: { x: 0.5, y: 0.5 } },
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
test('all declared threats require exact centered images before adoption, including inactive slots', () => {
  const snapshot = threatSnapshot(),
    frames = prepareCoopThreats(snapshot);
  assert.equal(frames.size, 3);
  const target = surface(),
    painter = createCoopPainter(target.canvas);
  painter.setPresentation(snapshot);
  const invalid = threatSnapshot();
  invalid.images.delete('team.threat.spark');
  assert.throws(() => painter.setPresentation(invalid), /exact centered 16/);
  assert.equal(painter.presentation, snapshot);
  for (const change of [
    (frame) => (frame.asset = { id: 'wrong', revision: 1 }),
    (frame) => (frame.geometry.frame.width = 16),
    (frame) => (frame.geometry.pivot.x = 0.6),
  ]) {
    const bad = threatSnapshot();
    change(bad.images.get('team.threat.shield'));
    assert.throws(() => prepareCoopThreats(bad), /exact centered/);
  }
  assert.equal(prepareCoopThreats(null).size, 0);
  assert.equal(prepareCoopThreats({ resolved }).size, 0);
});
for (const [scenario, role, expectedCount] of [
  ['initial', 'shield', 1],
  ['emitter-warning', 'emitter-warning', 1],
  ['spark', 'spark', 1],
]) {
  test(`earned ${scenario} image stays at its exact position under functional cues`, () => {
    const run = createStudioTeamFixture({ arena: 'relay-yard', scenario }).run,
      before = structuredClone(run),
      markers = coopThreatMarkers(run).filter((marker) => marker.slot === `team.threat.${role}`);
    assert.equal(markers.length, expectedCount);
    if (role === 'spark') {
      assert.equal(markers[0].x, run.impacts[0].x);
      assert.notEqual(markers[0].x, (run.impacts[0].cellIndex % run.width) + 0.5);
    }
    for (const width of [238, 390, 1152])
      for (const reduced of [false, true]) {
        const view = surface(width),
          painter = createCoopPainter(view.canvas);
        painter.setPresentation(threatSnapshot());
        painter.paint(run, { reduced });
        const images = view.calls.filter(
          (call) => call.key === 'drawImage' && call.args[0].id === `team.threat.${role}`,
        );
        assert.equal(images.length, expectedCount);
        for (const [
          i,
          {
            args: [, x, y, w, h],
          },
        ] of images.entries()) {
          assert.ok(Math.abs(x + w / 2 - markers[i].x) < 1e-9);
          assert.ok(Math.abs(y + h / 2 - markers[i].y) < 1e-9);
        }
        const lastArt = view.calls.findLastIndex((call) => call.key === 'drawImage');
        assert.ok(lastArt < view.calls.findIndex((call) => call.key === 'fillText'));
        assert.ok(view.calls.some((call) => call.key === 'clip'));
        if (role === 'spark')
          assert.ok(
            view.calls.some(
              (call) =>
                call.key === 'arc' &&
                call.args[0] === markers[0].x &&
                call.args[1] === markers[0].y &&
                call.args[2] === 0.35,
            ),
          );
        if (role === 'emitter-warning')
          assert.ok(
            view.calls.some(
              (call) => call.key === 'setLineDash' && JSON.stringify(call.args[0]) === '[0.35,0.3]',
            ),
          );
        assert.deepEqual(run, before);
        assert.equal(view.stack.length, 0);
        const first = structuredClone(view.calls);
        view.calls.length = 0;
        painter.paint(run, { reduced });
        assert.deepEqual(view.calls, first);
      }
  });
}
test('First Connection, exposed/secured cores and paused warnings preserve their real state', () => {
  assert.deepEqual(coopThreatMarkers(createCoop(FIRST_CONNECTION)), []);
  const exposed = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'anchors' }).run;
  assert.equal(
    coopThreatMarkers(exposed).some((marker) => marker.slot.endsWith('.shield')),
    false,
  );
  const won = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'victory' }).run;
  assert.deepEqual(coopThreatMarkers(won), []);
  const warning = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'emitter-warning' }).run;
  const before = coopThreatMarkers(warning);
  pauseCoop(warning);
  assert.deepEqual(coopThreatMarkers(warning), before);
  warning.strongholds[0].emitter.phaseUntil = -1;
  assert.deepEqual(coopThreatMarkers(warning), before, 'only core can transition the phase');
  warning.strongholds[0].defeated = true;
  assert.deepEqual(coopThreatMarkers(warning), []);
});
test('malformed and cleared impacts cannot invent coordinates, ownership or live threats', () => {
  const original = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'spark' }).run;
  const visible = (run) =>
    coopThreatMarkers(run).filter((marker) => marker.slot.endsWith('.spark'));
  for (const change of [
    (run) => (run.impacts[0].x = NaN),
    (run) => (run.impacts[0].x = undefined),
    (run) => (run.impacts[0].y = Infinity),
    (run) => (run.impacts[0].x = -1),
    (run) => (run.impacts[0].y = run.height + 1),
    (run) => (run.impacts[0].cellIndex = -1),
    (run) => (run.impacts[0].owner = 'absent'),
    (run) => (run.strongholds[0].defeated = true),
    (run) => (run.players[run.impacts[0].player].cutting = false),
    (run) => (run.players[run.impacts[0].player].status = 'downed'),
    (run) => (run.players[run.impacts[0].player].trail = []),
    (run) => (run.cells[run.impacts[0].cellIndex] = 1),
    (run) => (run.impacts = []),
  ]) {
    const run = structuredClone(original);
    change(run);
    const before = structuredClone(run);
    assert.deepEqual(visible(run), []);
    assert.deepEqual(run, before);
  }
  const legacy = structuredClone(original);
  delete legacy.impacts[0].x;
  delete legacy.impacts[0].y;
  assert.equal(visible(legacy)[0].x, (legacy.impacts[0].cellIndex % legacy.width) + 0.5);
  assert.equal(visible(legacy)[0].y, Math.floor(legacy.impacts[0].cellIndex / legacy.width) + 0.5);
});
test('multi-core ownership and edge clipping never relocate the spark', () => {
  const run = createStudioTeamFixture({ arena: 'relay-yard', scenario: 'spark' }).run;
  const second = structuredClone(run.strongholds[0]);
  second.id = 'second';
  second.core = { x: 60, y: 10 };
  second.emitter.phase = 'idle';
  run.strongholds.push(second);
  run.impacts[0].owner = second.id;
  run.strongholds[0].defeated = true;
  // Synthetic coordinate stress only; earned sub-cell position is checked separately.
  run.impacts[0].x = 0.05;
  run.impacts[0].y = 0.1;
  const marker = coopThreatMarkers(run).find((item) => item.slot.endsWith('.spark'));
  assert.deepEqual(marker, { slot: 'team.threat.spark', x: 0.05, y: 0.1 });
  const view = surface(238),
    painter = createCoopPainter(view.canvas);
  painter.setPresentation(threatSnapshot());
  painter.paint(run);
  const call = view.calls.find(
    (call) => call.key === 'drawImage' && call.args[0].id === 'team.threat.spark',
  );
  const [, x, y, w, h] = call.args;
  assert.ok(x < 0 && y < 0);
  assert.ok(Math.abs(x + w / 2 - 0.05) < 1e-9 && Math.abs(y + h / 2 - 0.1) < 1e-9);
  assert.ok(
    view.calls.some((call) => call.key === 'rect' && JSON.stringify(call.args) === '[0,0,72,36]'),
  );
  second.defeated = true;
  assert.equal(
    coopThreatMarkers(run).some((item) => item.slot.endsWith('.spark')),
    false,
  );
});
test('threat family coexists with actor/effect contracts and blocks unreviewed publication', async () => {
  const published = await importThemeBundle(
    new Blob([
      await readFile(
        new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
      ),
    ]),
    { decodeImage: null },
  );
  const document = prepareTeamThreatSlots(published.document),
    view = resolvePresentation(document);
  for (const arena of ['first-connection', 'relay-yard'])
    for (const { id } of TEAM_THREAT_SLOTS) assert.ok(teamPreviewBinding(id, view, arena));
  const combined = prepareTeamActorSlots(document);
  assert.equal(combined.slots.length, published.document.slots.length + 35);
  assert.doesNotThrow(() => adoptStudioBundle(published.document, combined));
  await assert.rejects(
    checkFieldKitReadiness(await exportThemeBundle(document, published.assets)),
    (error) =>
      error.unresolved.length === 3 &&
      error.unresolved.every((row) => row.slotId.startsWith('team.threat.')),
  );
});
test('ordinary started play and threat transitions remain identical with overlays installed', () => {
  const actual = createCoop(RELAY_YARD),
    expected = createCoop(RELAY_YARD),
    view = surface(),
    painter = createCoopPainter(view.canvas);
  painter.setPresentation(threatSnapshot());
  startCoop(actual);
  startCoop(expected);
  const seen = new Set();
  for (let tick = 0; tick < 565; tick++) {
    const command = (direction) => ({ direction, boost: tick < 324, support: tick === 290 });
    const commands = [
      command(tick < 60 ? 'up' : tick < 324 ? 'right' : null),
      command(tick < 60 ? 'up' : tick < 324 ? 'left' : null),
    ];
    stepCoop(actual, commands, 1 / 120);
    stepCoop(expected, commands, 1 / 120);
    painter.paint(actual);
    for (const marker of coopThreatMarkers(actual)) seen.add(marker.slot);
  }
  assert.ok(actual.tick > 0 && actual.time > 0);
  assert.deepEqual([...seen].sort(), TEAM_THREAT_SLOTS.map((row) => row.id).sort());
  assert.deepEqual(actual, expected);
});

test('compiled host decodes all three exact threat images before returning a usable snapshot', async () => {
  const published = await importThemeBundle(
    new Blob([
      await readFile(
        new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
      ),
    ]),
    { decodeImage: null },
  );
  const source = prepareTeamThreatSlots(published.document),
    bindings = {},
    assets = [];
  for (const spec of teamThreatSlotSpecs()) {
    const original = published.document.assets.find(
      (asset) =>
        asset.kind === 'image' &&
        asset.file.width === spec.dimensions.width &&
        asset.file.height === spec.dimensions.height,
    );
    assert.ok(original, `existing test raster for ${spec.dimensions.width}px`);
    const asset = {
      ...structuredClone(original),
      id: spec.id + '.host-fixture',
      revision: 1,
      geometry: structuredClone(spec.geometry),
    };
    assets.push(asset);
    bindings[spec.id] = { id: asset.id, revision: 1 };
  }
  const document = replaceStudioCollection(source, {
    id: 'threat-host-fixture',
    name: 'Test only threat images',
    requiredSlots: source.slots.filter((slot) => slot.required).map((slot) => slot.id),
    bindings: { ...resolvePresentation(source).bindings, ...bindings },
    assets,
  });
  const compiled = await compilePresentation(document, published.assets),
    requests = [],
    baseURL = 'https://game.test/game/presentation/compiled/';
  const host = createPresentationHost({
    baseURL,
    fontFactory: () => ({ load: async () => ({}) }),
    fontSet: { add() {}, delete() {} },
    fetch: async (url) => {
      requests.push(url);
      const bytes = compiled.files.get(url.slice(baseURL.length));
      return bytes ? new Response(bytes) : new Response(null, { status: 404 });
    },
    decodeImage: async (blob) => {
      const bytes = new Uint8Array(await blob.arrayBuffer()),
        view = new DataView(bytes.buffer);
      return { width: view.getUint32(16), height: view.getUint32(20), close() {} };
    },
    createObjectURL: () => 'blob:threat-fixture',
    revokeObjectURL() {},
  });
  try {
    const snapshot = await host.load();
    for (const { id } of TEAM_THREAT_SLOTS) assert.ok(snapshot.image(id)?.image, id);
    assert.equal(prepareCoopThreats(snapshot).size, 3);
    assert.equal(new Set(requests).size, requests.length);
  } finally {
    host.close();
  }
});

test('shield stays behind prepared craft while warning and spark stay above every cosmetic body', async () => {
  const compiled = JSON.parse(
    await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
  );
  const actorIds = [
    'player.scout.compact',
    'player.scout.detailed',
    'enemy.bouncer',
    'enemy.border-patrol',
    'enemy.relay-sentinel',
  ];
  for (const scenario of ['emitter-warning', 'spark'])
    for (const width of [238, 1152])
      for (const reduced of [false, true]) {
        const snapshot = threatSnapshot();
        for (const id of actorIds) {
          const asset = compiled.resolved.assets[id];
          snapshot.resolved.assets[id] = asset;
          snapshot.images.set(id, {
            asset,
            image: { id, width: asset.file.width, height: asset.file.height },
            geometry: imagePresentation(asset),
          });
        }
        const run = createStudioTeamFixture({ arena: 'relay-yard', scenario }).run,
          before = structuredClone(run),
          view = surface(width),
          painter = createCoopPainter(view.canvas);
        painter.setPresentation(snapshot);
        painter.paint(run, { reduced });
        const indices = (predicate) =>
          view.calls.flatMap((call, index) =>
            call.key === 'drawImage' && predicate(call.args[0].id) ? [index] : [],
          );
        const shield = indices((id) => id === 'team.threat.shield'),
          bodies = indices((id) => actorIds.includes(id)),
          foreground = indices((id) => id === 'team.threat.' + scenario);
        assert.equal(shield.length, 1);
        assert.ok(bodies.length >= 3, 'real prepared core and pilot images must draw');
        assert.equal(foreground.length, 1);
        assert.ok(shield[0] < Math.min(...bodies), 'shield must not cover core artwork');
        assert.ok(
          foreground[0] > Math.max(...bodies),
          'decorative bodies must not hide uploaded threat artwork',
        );
        assert.ok(
          foreground[0] < view.calls.findIndex((call) => call.key === 'fillText'),
          'runtime labels stay above cosmetic artwork',
        );
        assert.deepEqual(run, before);
        assert.equal(view.stack.length, 0);
      }
});
