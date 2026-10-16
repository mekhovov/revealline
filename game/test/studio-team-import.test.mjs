import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { validateThemeBundle, resolvePresentation } from '../presentation/model.mjs';
import { adoptStudioBundle } from '../presentation/studio-session.mjs';
import { addTeamPresentationSlots } from '../presentation/team-anchor-upgrade.mjs';
import { TEAM_RUNTIME_IMAGE_SLOTS } from '../presentation/team-runtime-slots.mjs';

function historicalWorkspace() {
  const doc = structuredClone(createDefaultThemeBundle());
  doc.slots = doc.slots.filter((slot) => !TEAM_RUNTIME_IMAGE_SLOTS.includes(slot.id));
  doc.assets = doc.assets.filter((asset) => !asset.id.startsWith('team.'));
  for (const theme of doc.themes)
    for (const id of TEAM_RUNTIME_IMAGE_SLOTS) delete theme.bindings[id];
  return validateThemeBundle(doc);
}

test('fresh historical Studio imports supported Team slots in one immutable transition', () => {
  const old = historicalWorkspace(),
    incoming = addTeamPresentationSlots(old);
  const before = JSON.stringify(old),
    input = JSON.stringify(incoming);
  const next = adoptStudioBundle(old, incoming);
  assert.equal(next.revision, old.revision + 1);
  assert.equal(next.slots.length, old.slots.length + 42);
  for (const field of ['slots', 'assets', 'themes', 'collections'])
    assert.deepEqual(next[field].slice(0, old[field].length), old[field]);
  for (const id of TEAM_RUNTIME_IMAGE_SLOTS) {
    const imported = resolvePresentation(next).assets[id];
    const original = resolvePresentation(incoming).assets[id];
    assert.match(imported.id, /^import-2-/);
    assert.deepEqual({ ...imported, id: original.id, revision: original.revision }, original);
  }
  assert.equal(JSON.stringify(old), before);
  assert.equal(JSON.stringify(incoming), input);
});

test('already upgraded imports reuse supported contracts without duplicating slots', () => {
  const old = addTeamPresentationSlots(historicalWorkspace());
  const next = adoptStudioBundle(old, old);
  assert.deepEqual(next.slots, old.slots);
  assert.deepEqual(next.assets, old.assets);
  assert.deepEqual(resolvePresentation(next).assets, resolvePresentation(old).assets);
});

test('unknown Team prefix is not authority and failure leaves the fresh workspace unchanged', () => {
  const old = historicalWorkspace(),
    incoming = structuredClone(addTeamPresentationSlots(old));
  const body = incoming.slots.find((slot) => slot.id === 'team.enemy.drifter');
  incoming.slots.push({ ...structuredClone(body), id: 'team.enemy.unsupported' });
  incoming.themes.at(-1).bindings['team.enemy.unsupported'] =
    incoming.themes.at(-1).bindings[body.id];
  validateThemeBundle(incoming);
  const before = JSON.stringify(old);
  assert.throws(
    () => adoptStudioBundle(old, incoming),
    /Unsupported imported slot contract: team.enemy.unsupported/,
  );
  assert.equal(JSON.stringify(old), before);
});

test('changed new Team contracts fail rather than silently adopting different requirements', () => {
  const old = historicalWorkspace(),
    incoming = structuredClone(addTeamPresentationSlots(old));
  incoming.slots
    .find((slot) => slot.id === 'team.enemy.drifter')
    .requirements.push('Different imported role meaning');
  validateThemeBundle(incoming);
  const before = JSON.stringify(old);
  assert.throws(
    () => adoptStudioBundle(old, incoming),
    /Unsupported imported slot contract: team.enemy.drifter/,
  );
  assert.equal(JSON.stringify(old), before);
});
