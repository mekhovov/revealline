import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createFieldKitProduction,
  fieldKitRecipeSources,
} from '../../scripts/produce-field-kit-theme.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { TEAM_EQUIPMENT_IDS } from '../presentation/team-equipment-art.mjs';

test('Team recipes stay source-stage and original equipment stays produced until its own review', async () => {
  const production = await createFieldKitProduction();
  const resolved = resolvePresentation(production.document);
  const roles = production.document.slots.filter((slot) => slot.id.startsWith('team.'));
  assert.equal(roles.length, 42);
  assert.equal(
    resolved.assets['team.support.pulse'].quality.stage,
    'source',
    'Team Support cannot borrow the reviewed Solo effects declaration',
  );
  const fingerprints = await fieldKitRecipeSources((name) =>
    readFile(new URL(`../../${name}`, import.meta.url)),
  );
  for (const slot of roles) {
    const asset = resolved.assets[slot.id];
    if (TEAM_EQUIPMENT_IDS.includes(slot.id)) {
      assert.equal(asset.kind, 'image', slot.id);
      assert.equal(asset.quality.stage, 'produced', slot.id);
      assert.match(
        asset.provenance.source,
        /^game\/presentation\/team-equipment-art\.mjs sha256:[a-f0-9]{64}$/,
      );
      continue;
    }
    assert.equal(asset.kind, 'recipe', slot.id);
    assert.equal(asset.quality.stage, 'source', `${slot.id} cannot borrow a Solo review`);
    assert.equal(asset.provenance.source, fingerprints.team, slot.id);
    assert.ok(!asset.quality.evidence.some((line) => line.includes('Scoped v0.76')), slot.id);
  }
  // Existing Solo effect approval remains scoped to its unchanged source group.
  assert.equal(resolved.assets['trail.active'].quality.stage, 'reviewed');
});

test('each declared Team recipe dependency changes its fingerprint independently', async () => {
  const read = (name) => readFile(new URL(`../../${name}`, import.meta.url));
  const original = await fieldKitRecipeSources(read);
  assert.ok(original.team, 'separate Team review fingerprint');
  assert.ok(
    original.ui
      .split(' sha256:')[0]
      .split('; ')
      .includes('game/presentation/team-runtime-slots.mjs'),
    'UI admission fingerprints its shared slot leaf',
  );
  const paths = original.team.split(' sha256:')[0].split('; ');
  assert.equal(new Set(paths).size, paths.length);
  for (const required of [
    'game/couch/coop-view.mjs',
    'game/couch/coop-pilot-slots.mjs',
    'game/couch/coop-outcome-presentation.mjs',
    'game/presentation/team-runtime-slots.mjs',
    'game/couch/coop-actor-layout.mjs',
    'game/couch/coop-terrain-trail.mjs',
    'game/couch/coop-bonus-view.mjs',
    'game/couch/candidate-team-pictures.mjs',
    'game/content-design/material-markers.mjs',
    'game/presentation/journey-actor-materials.mjs',
    'authoring/motion-lab/render-character.mjs',
    'game/ui/classic-view.mjs',
    'game/ui/presentation-draw-image.mjs',
    'game/ui/enemy-body-motion.mjs',
    'authoring/motion-lab/animation.mjs',
    'game/content-design/actor-marker.mjs',
    'game/enemy-catalog.mjs',
  ])
    assert.ok(paths.includes(required), required);
  const inputs = await Promise.all(paths.map(read));
  const digest = createHash('sha256').update(Buffer.concat(inputs)).digest('hex');
  assert.ok(original.team.endsWith(`sha256:${digest}`));
  for (const changed of paths) {
    const altered = await fieldKitRecipeSources(async (name) => {
      const bytes = await read(name);
      return name === changed ? Buffer.concat([bytes, Buffer.from('\n// changed\n')]) : bytes;
    });
    assert.notEqual(altered.team, original.team, changed);
    if (changed === 'game/presentation/team-runtime-slots.mjs')
      assert.notEqual(
        altered.ui,
        original.ui,
        'shared slot-contract changes reopen UI admission review',
      );
    if (changed.startsWith('game/couch/'))
      assert.equal(
        altered.ui,
        original.ui,
        'Team drawing changes do not change the shared slot contract',
      );
    if (changed.startsWith('game/couch/') || changed === 'game/presentation/team-runtime-slots.mjs')
      for (const group of ['effects', 'motion', 'screens', 'audio'])
        assert.equal(
          altered[group],
          original[group],
          `${changed} must not rewrite ${group} history`,
        );
  }
});
