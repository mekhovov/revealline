import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { createPresentationHost } from '../presentation/host.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalJSON } from '../data-json.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import {
  TEAM_EVENT_SLOTS,
  prepareTeamEventSlots,
  teamEventSlotSpecs,
} from '../presentation/team-event-slots.mjs';
import { prepareTeamActorSlots } from '../presentation/team-actor-slots.mjs';
import {
  adoptStudioBundle,
  generateAssetPrompt,
  replaceStudioCollection,
} from '../presentation/studio-session.mjs';
import { exportThemeBundle, importThemeBundle } from '../presentation/bundle.mjs';
import { checkFieldKitReadiness } from '../../scripts/check-field-kit-readiness.mjs';
import {
  prepareCoopEvents,
  coopEventCaption,
  drawCoopEventIcon,
} from '../couch/coop-event-presentation.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';
import { teamPreviewBinding } from '../../authoring/asset-studio/cross-mode-preview.mjs';
const original = createDefaultThemeBundle(),
  prepared = prepareTeamEventSlots(original),
  resolved = resolvePresentation(prepared);
test('event registration adds two source recipes without altering historical records', () => {
  assert.equal(TEAM_EVENT_SLOTS.length, 2);
  assert.equal(prepared.revision, original.revision + 1);
  for (const field of ['slots', 'assets', 'themes', 'collections'])
    assert.deepEqual(prepared[field].slice(0, original[field].length), original[field]);
  for (const slot of teamEventSlotSpecs()) {
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
  assert.deepEqual(prepareTeamEventSlots(prepared), prepared);
  const old = structuredClone(prepared);
  old.selection = original.selection;
  assert.deepEqual(resolvePresentation(old), resolvePresentation(original));
  const partial = structuredClone(original);
  partial.slots.push(teamEventSlotSpecs()[0]);
  assert.throws(() => prepareTeamEventSlots(partial), /both slot contracts/);
});
test('event import validates complete exact contracts, preserves history and export bytes', async () => {
  const bytes = await exportThemeBundle(prepared, new Map()),
    loaded = await importThemeBundle(bytes, { decodeImage: null });
  assert.deepEqual(loaded.document, prepared);
  assert.deepEqual(
    new Uint8Array(await (await exportThemeBundle(loaded.document, loaded.assets)).arrayBuffer()),
    new Uint8Array(await bytes.arrayBuffer()),
  );
  const adopted = adoptStudioBundle(original, loaded.document);
  assert.equal(
    resolvePresentation(adopted).assets['team.event.joint-capture'].recipe.id,
    'team.event.v1',
  );
  const corrupt = structuredClone(prepared);
  corrupt.slots.at(-1).requirements[0] = 'Wrong meaning';
  const before = canonicalJSON(original);
  assert.throws(() => adoptStudioBundle(original, corrupt), /event contract/);
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

function eventSnapshot() {
  const assets = {},
    images = new Map();
  for (const spec of teamEventSlotSpecs()) {
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

test('exact event revisions prepare atomically before an inactive role can enter play', () => {
  const snapshot = eventSnapshot(),
    painter = createCoopPainter(surface().canvas);
  assert.equal(prepareCoopEvents(snapshot).size, 2);
  painter.setPresentation(snapshot);
  assert.equal(
    painter.eventFrame('joint-capture'),
    snapshot.images.get('team.event.joint-capture'),
  );
  for (const change of [
    (value) => value.images.delete('team.event.team-recovery'),
    (value) => (value.images.get('team.event.team-recovery').asset = { id: 'wrong', revision: 1 }),
    (value) =>
      (value.images.get('team.event.team-recovery').asset = {
        ...value.images.get('team.event.team-recovery').asset,
        revision: 2,
      }),
    (value) => (value.images.get('team.event.team-recovery').geometry.frame.width = 64),
    (value) => (value.images.get('team.event.team-recovery').geometry.pivot.x = 0),
  ]) {
    const bad = eventSnapshot();
    change(bad);
    assert.throws(() => painter.setPresentation(bad), /exact centered 32/);
    assert.equal(painter.presentation, snapshot);
    assert.equal(
      painter.eventFrame('team-recovery'),
      snapshot.images.get('team.event.team-recovery'),
    );
  }
  assert.equal(painter.eventFrame('invented'), null);
  assert.equal(prepareCoopEvents(null).size, 0);
  assert.equal(prepareCoopEvents({ resolved }).size, 0);
});
test('event icon uses its exact image outside the arena, integer entrance and reduced stillness', () => {
  const snapshot = eventSnapshot(),
    frame = snapshot.images.get('team.event.joint-capture');
  const run = createStudioTeamFixture({ scenario: 'capture' }).run,
    before = structuredClone(run);
  const receipt = { kind: 'joint-capture', time: run.time, until: run.time + 1.25 };
  for (const [elapsed, reduced, size] of [
    [0, false, 26],
    [0.14, false, 32],
    [0, true, 32],
    [0.6, true, 32],
  ]) {
    const target = surface();
    assert.equal(
      drawCoopEventIcon(target.canvas, frame, receipt, { time: run.time + elapsed, reduced }),
      true,
    );
    assert.equal(target.canvas.width, 32);
    assert.equal(target.canvas.height, 32);
    assert.equal(target.canvas.hidden, false);
    const image = target.calls.find((call) => call.key === 'drawImage');
    assert.deepEqual(image.args, [frame.image, 16 - size / 2, 16 - size / 2, size, size]);
    assert.equal(image.state.globalAlpha, 1);
    assert.equal(image.state.imageSmoothingEnabled, false);
    assert.equal(target.stack.length, 0);
    const first = structuredClone(target.calls);
    target.calls.length = 0;
    drawCoopEventIcon(target.canvas, frame, receipt, { time: run.time + elapsed, reduced });
    assert.deepEqual(target.calls, first, 'unchanged paused simulation time cannot animate');
  }
  assert.deepEqual(run, before);
});
test('expired, absent and not-yet-earned icons do not acquire a drawing context', () => {
  const frame = eventSnapshot().images.get('team.event.team-recovery'),
    receipt = { time: 2, until: 3.25 };
  for (const time of [1.9, 3.25, 4, NaN, Infinity]) {
    const canvas = {
      hidden: false,
      getContext: () => assert.fail('inactive icon requested a context'),
    };
    assert.equal(drawCoopEventIcon(canvas, frame, receipt, { time }), false);
    assert.equal(canvas.hidden, true);
  }
  for (const [image, event] of [
    [null, receipt],
    [frame, null],
  ]) {
    const canvas = { getContext: () => assert.fail('missing artwork/event requested a context') };
    assert.equal(drawCoopEventIcon(canvas, image, event, { time: 2 }), false);
  }
});
test('joint and reserve captions never invent credit, rewards or personal rescue semantics', () => {
  assert.match(coopEventCaption({ kind: 'joint-capture', meaningful: true }), /^Joint Cut!/);
  assert.match(coopEventCaption({ kind: 'joint-capture', meaningful: false }), /^Lines joined\./);
  assert.doesNotMatch(
    coopEventCaption({ kind: 'joint-capture', meaningful: false }),
    /Joint Cut|credit|medal|reward/,
  );
  assert.match(coopEventCaption({ kind: 'team-recovery' }), /Both craft.*One team reserve used/);
  assert.equal(coopEventCaption({ kind: 'player-revived' }), '');
});
test('event family coexists with actor/effect contracts and blocks unreviewed publication', async () => {
  const published = await importThemeBundle(
    new Blob([
      await readFile(
        new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
      ),
    ]),
    { decodeImage: null },
  );
  const document = prepareTeamEventSlots(published.document),
    view = resolvePresentation(document);
  for (const arena of ['first-connection', 'relay-yard'])
    for (const { id } of TEAM_EVENT_SLOTS) assert.ok(teamPreviewBinding(id, view, arena));
  const combined = prepareTeamActorSlots(document);
  assert.equal(combined.slots.length, published.document.slots.length + 34);
  assert.doesNotThrow(() => adoptStudioBundle(published.document, combined));
  await assert.rejects(
    checkFieldKitReadiness(await exportThemeBundle(document, published.assets)),
    (error) =>
      error.unresolved.length === 2 &&
      error.unresolved.every((row) => row.slotId.startsWith('team.event.')),
  );
});
test('compiled host decodes all two exact event images before returning a usable snapshot', async () => {
  const published = await importThemeBundle(
    new Blob([
      await readFile(
        new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
      ),
    ]),
    { decodeImage: null },
  );
  const source = prepareTeamEventSlots(published.document),
    bindings = {},
    assets = [];
  for (const spec of teamEventSlotSpecs()) {
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
    id: 'event-host-fixture',
    name: 'Test only event images',
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
    createObjectURL: () => 'blob:event-fixture',
    revokeObjectURL() {},
  });
  try {
    const snapshot = await host.load();
    for (const { id } of TEAM_EVENT_SLOTS) assert.ok(snapshot.image(id)?.image, id);
    assert.equal(prepareCoopEvents(snapshot).size, 2);
    assert.equal(new Set(requests).size, requests.length);
  } finally {
    host.close();
  }
});
