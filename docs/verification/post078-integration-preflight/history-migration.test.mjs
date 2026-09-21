import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { importThemeBundle } from './candidate/game/presentation/bundle.mjs';
import { resolvePresentation } from './candidate/game/presentation/model.mjs';
import { reviseStudioTheme } from './candidate/game/presentation/studio-session.mjs';
import { retainProductionHistory } from './candidate/scripts/presentation-production-history.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const key = item => `${item.id}@${item.revision}`;
const load = async name => {
  const revision = name === 'music' ? 'e9434d03feb30bf8767051b2832a4ab987b2fa41' : '8cffb36b29a38013eb9213845efd675c4864c9d8';
  const bytes = execFileSync('git', ['show', `${revision}:authoring/library/fpv-field-kit/production.rltheme`], { maxBuffer: 16 * 1024 * 1024 });
  const bundle = await importThemeBundle(new Blob([bytes]), { decodeImage: null });
  return { ...bundle, sha256: hash(bytes), bytes: bytes.length };
};
const [music, team] = await Promise.all([load('music'), load('team')]);
const collisions = {};

test('divergent histories require preserved identity, not revision-number overwrite', () => {
  for (const group of ['assets', 'themes', 'collections']) {
    const indexed = new Map(music.document[group].map(item => [key(item), JSON.stringify(item)]));
    collisions[group] = team.document[group]
      .filter(item => indexed.has(key(item)) && indexed.get(key(item)) !== JSON.stringify(item))
      .map(key);
  }
  assert(collisions.themes.length > 0, 'The actual candidate histories have conflicting theme revisions');
  assert.notEqual(music.sha256, team.sha256);
});

test('optional Team slots can append without downgrading any accepted music slot or historical record', () => {
  const beforeMusic = JSON.stringify(music.document), beforeTeam = JSON.stringify(team.document);
  const prior = resolvePresentation(music.document), desiredTeam = resolvePresentation(team.document);
  const slots = team.document.slots.filter(slot => !music.document.slots.some(old => old.id === slot.id));
  assert.equal(slots.length, 6);
  assert(slots.every(slot => !slot.required && slot.revision === 1));
  const extended = structuredClone(music.document);
  extended.slots.push(...structuredClone(slots));
  const assets = slots.map(slot => desiredTeam.assets[slot.id]);
  assert(assets.every(asset => !extended.assets.some(old => old.id === asset.id)));
  const desired = reviseStudioTheme(extended, {
    assets,
    bindings: Object.fromEntries(slots.map((slot, index) => [slot.id, { id: assets[index].id, revision: assets[index].revision }])),
  });
  const migrated = retainProductionHistory(desired, music.document, { appendSlots: slots });
  const resolved = resolvePresentation(migrated);
  for (const group of ['assets', 'themes', 'collections'])
    assert.deepEqual(migrated[group].slice(0, music.document[group].length), music.document[group]);
  for (const [slotId, asset] of Object.entries(prior.assets))
    assert.deepEqual(resolved.assets[slotId], asset, `Preserve accepted ${slotId}`);
  for (const slot of slots)
    assert.deepEqual(resolved.assets[slot.id], desiredTeam.assets[slot.id]);
  assert.equal(JSON.stringify(music.document), beforeMusic);
  assert.equal(JSON.stringify(team.document), beforeTeam);
  assert.deepEqual(retainProductionHistory(desired, migrated, { appendSlots: slots }), migrated);
  // This is a pure schema/ledger rehearsal. No producer, default binding, compiler,
  // source tree or generated output is changed or represented as accepted.
});

test('report pins both original binary bundles and every overlapping revision', async () => {
  await writeFile(new URL(`./history-result-${process.version}.json`, import.meta.url), JSON.stringify({
    scope: 'Pure slot-migration rehearsal; not combined recipe production or release acceptance',
    music: { bytes: music.bytes, sha256: music.sha256, revision: music.document.revision, selection: music.document.selection },
    team: { bytes: team.bytes, sha256: team.sha256, revision: team.document.revision, selection: team.document.selection },
    collisions,
  }, null, 2) + '\n');
});
