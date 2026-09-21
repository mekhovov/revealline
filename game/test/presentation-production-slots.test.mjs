import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation, validateThemeBundle } from '../presentation/model.mjs';
import { prepareTeamAnchorSlots, teamAnchorSlotSpecs } from '../presentation/team-anchor-slots.mjs';
import { prepareTeamEffectSlots, teamEffectSlotSpecs } from '../presentation/team-effect-slots.mjs';
import { retainProductionHistory } from '../../scripts/presentation-production-history.mjs';
import { exportThemeBundle, importThemeBundle } from '../presentation/bundle.mjs';

const specs = () => structuredClone([...teamAnchorSlotSpecs(), ...teamEffectSlotSpecs()]);
const prepare = (prior) => prepareTeamEffectSlots(prepareTeamAnchorSlots(prior));

test('explicit Team slot migration appends one successor and preserves exact historical selection', async () => {
  const prior = createDefaultThemeBundle(),
    desired = prepare(prior);
  const before = structuredClone(prior),
    wanted = structuredClone(desired);
  const next = retainProductionHistory(desired, prior, { appendSlots: specs() });
  validateThemeBundle(next, { previous: prior, expectedRevision: prior.revision });
  assert.equal(next.revision, prior.revision + 1);
  assert.deepEqual(next.slots, [...prior.slots, ...specs()]);
  for (const field of ['assets', 'themes', 'collections'])
    assert.deepEqual(next[field].slice(0, prior[field].length), prior[field], field);
  assert.equal(next.themes.length, prior.themes.length + 1);
  for (const spec of specs())
    assert.deepEqual(
      resolvePresentation(next).assets[spec.id],
      resolvePresentation(desired).assets[spec.id],
    );
  const retained = structuredClone(next);
  retained.selection = structuredClone(prior.selection);
  assert.deepEqual(resolvePresentation(retained).assets, resolvePresentation(prior).assets);
  assert.deepEqual(prior, before);
  assert.deepEqual(desired, wanted);
  assert.deepEqual(retainProductionHistory(desired, next, { appendSlots: specs() }), next);
  const exported = await exportThemeBundle(next, new Map());
  const imported = await importThemeBundle(exported, { decodeImage: null });
  assert.deepEqual(imported.document, next);
  assert.deepEqual(
    new Uint8Array(
      await (await exportThemeBundle(imported.document, imported.assets)).arrayBuffer(),
    ),
    new Uint8Array(await exported.arrayBuffer()),
  );
});

test('implicit, incomplete and altered slot migrations fail without changing inputs', () => {
  const prior = createDefaultThemeBundle(),
    desired = prepare(prior);
  const before = structuredClone(prior),
    wanted = structuredClone(desired);
  assert.throws(() => retainProductionHistory(desired, prior), /explicit compatible migration/);
  assert.throws(
    () => retainProductionHistory(desired, prior, { appendSlots: teamAnchorSlotSpecs() }),
    /explicit compatible migration/,
  );
  const altered = specs();
  altered[0].prompt += ' changed';
  assert.throws(
    () => retainProductionHistory(desired, prior, { appendSlots: altered }),
    /explicit compatible migration/,
  );
  assert.throws(
    () => retainProductionHistory(desired, prior, { appendSlots: [...specs(), specs()[0]] }),
    /explicit compatible migration/,
  );
  assert.throws(
    () => retainProductionHistory(desired, prior, { appendSlots: null }),
    /must be an array/,
  );
  assert.throws(
    () => retainProductionHistory(desired, prior, { appendSlots: specs(), relax: true }),
    /relax is not supported/,
  );
  const extraField = specs();
  extraField[0].relax = true;
  assert.throws(
    () => retainProductionHistory(desired, prior, { appendSlots: extraField }),
    /relax is not supported/,
  );
  assert.deepEqual(prior, before);
  assert.deepEqual(desired, wanted);
});

test('explicit migration cannot change, remove or reorder any historical slot', () => {
  const prior = createDefaultThemeBundle();
  for (const mutate of [
    (doc) => {
      doc.slots[0].prompt += ' changed';
    },
    (doc) => {
      [doc.slots[0], doc.slots[1]] = [doc.slots[1], doc.slots[0]];
    },
    (doc) => {
      doc.slots.push(doc.slots.shift());
    },
    (doc) => {
      const removed = doc.slots.shift();
      for (const theme of doc.themes) delete theme.bindings[removed.id];
    },
  ]) {
    const desired = structuredClone(prepare(prior));
    mutate(desired);
    assert.throws(
      () => retainProductionHistory(desired, prior, { appendSlots: specs() }),
      /explicit compatible migration/,
    );
  }
});

test('a no-op rerun still rejects conflicting or duplicate migration specifications', () => {
  const prior = createDefaultThemeBundle(),
    desired = prepare(prior);
  const next = retainProductionHistory(desired, prior, { appendSlots: specs() });
  const conflicting = specs();
  conflicting[0].prompt += ' changed';
  assert.throws(
    () => retainProductionHistory(desired, next, { appendSlots: conflicting }),
    /explicit compatible migration/,
  );
  assert.throws(
    () => retainProductionHistory(desired, next, { appendSlots: [...specs(), specs()[0]] }),
    /explicit compatible migration/,
  );
  const unknown = specs();
  unknown[0].id = 'team.anchor.unknown';
  assert.throws(
    () => retainProductionHistory(desired, next, { appendSlots: unknown }),
    /explicit compatible migration/,
  );
  const revision = specs();
  revision[0].revision = 2;
  assert.throws(
    () => retainProductionHistory(desired, next, { appendSlots: revision }),
    /explicit compatible migration/,
  );
});

test('new required slots and unbound optional slots cannot silently change old-theme behavior', () => {
  const prior = createDefaultThemeBundle();
  const required = structuredClone(prepare(prior));
  required.slots.find((slot) => slot.id === specs()[0].id).required = true;
  const requiredSpecs = specs();
  requiredSpecs[0].required = true;
  assert.throws(
    () => retainProductionHistory(required, prior, { appendSlots: requiredSpecs }),
    /explicit compatible migration/,
  );
  const unbound = structuredClone(prepare(prior));
  for (const theme of unbound.themes) delete theme.bindings[specs()[0].id];
  assert.throws(
    () => retainProductionHistory(unbound, prior, { appendSlots: specs() }),
    /bound production asset/,
  );
});

test('ordinary asset review and explicit migration share one immutable successor', () => {
  const prior = createDefaultThemeBundle();
  const desired = structuredClone(prepare(prior));
  const selected = resolvePresentation(desired).assets['ui.button.primary'];
  const asset = desired.assets.find(
    (item) => item.id === selected.id && item.revision === selected.revision,
  );
  asset.description += ' revised';
  const next = retainProductionHistory(desired, prior, { appendSlots: specs() });
  assert.equal(next.revision, prior.revision + 1);
  const changed = resolvePresentation(next).assets['ui.button.primary'];
  assert.equal(changed.revision, 2);
  assert.deepEqual(changed.provenance.parent, { id: selected.id, revision: 1 });
  assert.deepEqual(next.assets.slice(0, prior.assets.length), prior.assets);
  assert.deepEqual(retainProductionHistory(desired, next, { appendSlots: specs() }), next);
});
