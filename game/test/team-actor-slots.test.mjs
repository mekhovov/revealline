import { checkFieldKitReadiness } from '../../scripts/check-field-kit-readiness.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalJSON } from '../data-json.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import { importThemeBundle, exportThemeBundle } from '../presentation/bundle.mjs';
import { adoptStudioBundle, generateAssetPrompt } from '../presentation/studio-session.mjs';
import {
  TEAM_ACTOR_SLOTS,
  prepareTeamActorSlots,
  teamActorSlotId,
  mergeTeamActorSlotContracts,
} from '../presentation/team-actor-slots.mjs';
import { imagePresentation } from '../presentation/runtime.mjs';
import { createPresentationHost } from '../presentation/host.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { createCoopActorPresentation } from '../couch/coop-actor-presentation.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { RELAY_YARD } from '../coop/relay-yard.mjs';
import { FIRST_CONNECTION } from '../coop/first-connection.mjs';

// Verify published payload hashes/headers; native browser decoding is separate evidence.
const published = await importThemeBundle(
  new Blob([
    await readFile(
      new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
    ),
  ]),
  { decodeImage: null },
);
const original = published.document;
const prepared = prepareTeamActorSlots(original);
const resolved = resolvePresentation(prepared);

test('prepare appends 32 optional source-stage Team bodies and preserves immutable history and older selections', () => {
  assert.equal(TEAM_ACTOR_SLOTS.length, 32);
  assert.equal(new Set(TEAM_ACTOR_SLOTS.map((r) => r.id)).size, 32);
  assert.equal(prepared.revision, original.revision + 1);
  assert.equal(prepared.slots.length, original.slots.length + 32);
  for (const field of ['assets', 'slots', 'themes', 'collections'])
    assert.deepEqual(prepared[field].slice(0, original[field].length), original[field]);
  const priorSelection = structuredClone(prepared);
  priorSelection.selection = original.selection;
  assert.deepEqual(resolvePresentation(priorSelection), resolvePresentation(original));
  for (const row of TEAM_ACTOR_SLOTS) {
    const slot = prepared.slots.find((s) => s.id === row.id),
      asset = resolved.assets[row.id],
      parent = resolvePresentation(original).assets[row.source];
    assert.equal(slot.required, false);
    assert.deepEqual(slot.screens, ['couch', 'studio']);
    assert.equal(asset.quality.stage, 'source');
    assert.deepEqual(asset.provenance.parent, { id: parent.id, revision: parent.revision });
    assert.deepEqual(asset.file, parent.file);
    assert.deepEqual(asset.geometry, parent.geometry);
    const prompt = generateAssetPrompt(slot, resolved);
    assert.match(prompt, /Team|team/);
    assert.match(prompt, /pixel/);
    assert.match(prompt, /gameplay|mechanical/);
  }
  assert.deepEqual(prepareTeamActorSlots(prepared), prepared);
});

test('missing real source bodies and partial contracts fail atomically; existing template history is retained', () => {
  const defaults = createDefaultThemeBundle(),
    before = canonicalJSON(defaults);
  assert.throws(() => prepareTeamActorSlots(defaults), /Prepare a real/);
  assert.equal(canonicalJSON(defaults), before);
  const partial = structuredClone(original);
  partial.slots.push(prepared.slots.at(-1));
  assert.throws(() => prepareTeamActorSlots(partial), /incomplete/);
  const conflict = structuredClone(original);
  conflict.assets.push(prepared.assets.at(-1));
  const prior = canonicalJSON(conflict);
  const continued = prepareTeamActorSlots(conflict);
  assert.equal(resolvePresentation(continued).assets['team.core.secured'].revision, 2);
  assert.deepEqual(continued.assets.slice(0, conflict.assets.length), conflict.assets);
  assert.equal(canonicalJSON(conflict), prior);
});

test('import admits known additive contracts, rejects changed and unknown contracts', () => {
  const incoming = structuredClone(prepared);
  incoming.slots.at(-1).prompt = 'Changed immutable contract';
  assert.throws(() => mergeTeamActorSlotContracts(original, incoming), /Unsupported imported slot/);
  assert.throws(() => mergeTeamActorSlotContracts(prepared, incoming), /Conflicting Team slot/);
  assert.throws(
    () => mergeTeamActorSlotContracts(original, { slots: [prepared.slots.at(-1)] }),
    /all 32/,
  );
  const foreign = structuredClone(prepared.slots.at(-1));
  foreign.id = 'unrelated.foreign.slot';
  assert.throws(
    () => mergeTeamActorSlotContracts(original, { slots: [foreign] }),
    /Unsupported imported slot/,
  );
});

test('bundle export/import preserves payload bytes and adoption into the original workspace preserves old records', async () => {
  const exported = await exportThemeBundle(prepared, published.assets);
  const incoming = await importThemeBundle(exported, { decodeImage: null });
  assert.deepEqual(incoming.document, prepared);
  assert.equal(incoming.assets.size, published.assets.size);
  for (const [hash, blob] of published.assets)
    assert.deepEqual(
      new Uint8Array(await incoming.assets.get(hash).arrayBuffer()),
      new Uint8Array(await blob.arrayBuffer()),
    );
  const adopted = adoptStudioBundle(original, incoming.document);
  validateThemeBundle(adopted, { previous: original, expectedRevision: original.revision });
  const adoptedView = resolvePresentation(adopted);
  for (const row of TEAM_ACTOR_SLOTS)
    assert.equal(adoptedView.assets[row.id].file.sha256, resolved.assets[row.id].file.sha256);
  const second = await exportThemeBundle(incoming.document, incoming.assets);
  assert.deepEqual(
    new Uint8Array(await second.arrayBuffer()),
    new Uint8Array(await exported.arrayBuffer()),
  );
});

function snapshot() {
  const images = new Map(
    Object.entries(resolved.assets)
      .filter(([, a]) => a.kind === 'image')
      .map(([id, asset]) => [
        id,
        {
          image: { id, width: asset.file.width, height: asset.file.height },
          asset,
          geometry: imagePresentation(asset),
        },
      ]),
  );
  return { resolved, image: (id) => images.get(id) ?? null };
}

test('all 24 player state and size combinations resolve distinct slots without simulation writes', () => {
  for (const [width, treatment] of [
    [390, 'compact'],
    [1152, 'detailed'],
  ])
    for (const seat of [0, 1])
      for (const state of ['normal', 'cutting', 'downed', 'crawling', 'rescuing', 'recovery']) {
        const adapter = createCoopActorPresentation(),
          run = startCoop(createCoop(RELAY_YARD));
        adapter.setPresentation(snapshot());
        const player = run.players[seat],
          partner = run.players[1 - seat];
        player.graceUntil = 0;
        if (['downed', 'crawling'].includes(state)) player.status = 'downed';
        if (state === 'rescuing') {
          partner.status = 'downed';
          player.rescue = { target: partner.id };
        }
        if (state === 'cutting') player.cutting = true;
        if (state === 'recovery') player.graceUntil = 3;
        adapter.update(run, { canvasCSSWidth: width });
        if (state === 'crawling') {
          run.tick++;
          run.time += 1 / 120;
          player.x += 0.1;
        }
        const before = structuredClone(run);
        adapter.update(run, { canvasCSSWidth: width });
        assert.equal(
          adapter.frame('pilot', seat).sourceSlot,
          `team.player.${seat + 1}.${state}.${treatment}`,
        );
        assert.deepEqual(run, before);
      }
});

test('hunter, drifter and core slots retain actual phase and objective semantics', () => {
  const adapter = createCoopActorPresentation(),
    run = createCoop(RELAY_YARD);
  adapter.setPresentation(snapshot());
  const hunter = run.enemies.find((e) => e.type === 'hunter');
  for (const phase of ['patrol', 'warning', 'commit', 'recovery']) {
    hunter.phase = phase;
    const before = structuredClone(run);
    adapter.update(run);
    assert.equal(
      adapter.frame('enemy', hunter.id).sourceSlot,
      `team.hunter.${phase === 'commit' ? 'charge' : phase}`,
    );
    assert.deepEqual(run, before);
  }
  const drifter = run.enemies.find((e) => e.type === 'drifter');
  assert.equal(adapter.frame('enemy', drifter.id).sourceSlot, 'team.drifter.normal');
  for (const [state, shielded, defeated] of [
    ['shielded', true, false],
    ['exposed', false, false],
    ['secured', false, true],
  ]) {
    Object.assign(run.strongholds[0], { shielded, defeated });
    adapter.update(run);
    assert.equal(adapter.frame('core', run.strongholds[0].id).sourceSlot, `team.core.${state}`);
  }
  assert.equal(teamActorSlotId('enemy', { type: 'hunter', phase: 'unknown' }), null);
});

test('missing declared Team images fail atomically while historical themes retain shared bodies', () => {
  const adapter = createCoopActorPresentation(),
    run = createCoop(FIRST_CONNECTION),
    valid = snapshot();
  adapter.setPresentation(valid);
  adapter.update(run);
  const before = adapter.frame('pilot', 0);
  for (const invalid of [{ resolved }, { ...valid, image: () => null }]) {
    assert.throws(() => adapter.setPresentation(invalid), /needs its prepared image/);
    assert.deepEqual(adapter.frame('pilot', 0), before);
  }
  adapter.setPresentation({ ...valid, resolved: resolvePresentation(original) });
  adapter.update(run);
  assert.equal(adapter.frame('pilot', 0).sourceSlot, 'player.scout.detailed');
});

test('600 real simulation ticks remain identical with all Team body states installed', () => {
  const adapter = createCoopActorPresentation();
  adapter.setPresentation(snapshot());
  const run = startCoop(createCoop(RELAY_YARD)),
    control = startCoop(createCoop(RELAY_YARD));
  for (let tick = 0; tick < 600; tick++) {
    const input = [
      { direction: tick < 140 ? 'right' : 'up', boost: true, support: tick % 20 === 0 },
      { direction: tick < 140 ? 'left' : 'up', boost: true, support: false },
    ];
    stepCoop(run, input, 1 / 120);
    stepCoop(control, input, 1 / 120);
    adapter.update(run);
  }
  assert.deepEqual(run, control);
});

test('real compiled host prepares all Team images and deduplicates exact shared bytes', async () => {
  const compiled = await compilePresentation(prepared, published.assets),
    requests = [];
  const baseURL = 'https://game.test/game/presentation/compiled/';
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
    createObjectURL: () => 'blob:team-fixture',
    revokeObjectURL() {},
  });
  try {
    const loaded = await host.load();
    for (const row of TEAM_ACTOR_SLOTS) {
      assert.ok(loaded.image(row.id)?.image, row.id);
      assert.equal(
        loaded.image(row.id).image,
        loaded.image(row.source).image,
        'same bytes decode once',
      );
    }
    assert.equal(new Set(requests).size, requests.length);
  } finally {
    host.close();
  }
});

test('existing global contracts can seed another selected theme without changing the first theme', () => {
  const alternate = structuredClone(prepared);
  alternate.themes.push({
    ...structuredClone(original.themes.at(-1)),
    id: 'team-authoring-example',
    revision: 1,
    parent: original.selection.theme,
    tokens: {},
    bindings: {},
  });
  alternate.selection = {
    ...original.selection,
    theme: { id: 'team-authoring-example', revision: 1 },
  };
  const next = prepareTeamActorSlots(alternate);
  assert.equal(next.slots.length, prepared.slots.length);
  assert.equal(next.assets.length, prepared.assets.length + 32);
  assert.deepEqual(next.themes.slice(0, prepared.themes.length), prepared.themes);
  assert.equal(resolvePresentation(next).assets['team.player.1.normal.compact'].revision, 2);
});

test('publication rejects seeded states and partial Team collections while preserving legacy readiness', async () => {
  const legacy = await checkFieldKitReadiness(await exportThemeBundle(original, published.assets));
  assert.equal(legacy.requiredReviewed, 194);
  await assert.rejects(
    checkFieldKitReadiness(await exportThemeBundle(prepared, published.assets)),
    (error) => {
      assert.equal(error.unresolved.length, 32);
      assert.ok(
        error.unresolved.every((row) => row.stage === 'source' && row.slotId.startsWith('team.')),
      );
      return true;
    },
  );
  // Synthetic declarations test the gate, not artistic approval.
  const reviewed = structuredClone(prepared);
  for (const row of TEAM_ACTOR_SLOTS) {
    const chosen = resolved.assets[row.id];
    reviewed.assets.find(
      (asset) => asset.id === chosen.id && asset.revision === chosen.revision,
    ).quality = { stage: 'reviewed', evidence: ['Synthetic gate declaration only.'] };
  }
  const full = await checkFieldKitReadiness(await exportThemeBundle(reviewed, published.assets));
  assert.equal(full.requiredReviewed, 226);
  delete reviewed.themes.at(-1).bindings['team.core.secured'];
  await assert.rejects(
    checkFieldKitReadiness(await exportThemeBundle(reviewed, published.assets)),
    (error) => {
      assert.equal(error.unresolved.length, 1);
      assert.equal(error.unresolved[0].slotId, 'team.core.secured');
      assert.equal(error.unresolved[0].stage, 'missing');
      return true;
    },
  );
});
