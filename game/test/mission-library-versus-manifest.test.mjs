import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { journeyMissionDetails } from '../mission-library/journey-presentation.mjs';

test('Versus lightweight manifest access preserves exact catalog authority and resolved preset identity', async () => {
  const themes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes;
  const host = createCandidateVersusHost(createOpeningCandidates({ artwork: true }), { themes });
  const mission = host.catalog.missions[0];
  const standard = host.manifest(mission, 'standard');
  assert.equal(standard, host.manifest(mission));
  assert.equal(standard.missionId, mission.levelId);
  assert.equal(standard.level, host.row(mission, 'standard').level);
  assert(Object.isFrozen(standard));
  assert.match(journeyMissionDetails(standard).challenge, /Band 1\/12 · Standard/);
  const expert = host.manifest(mission, 'expert');
  assert.notEqual(expert, standard);
  assert.equal(expert.level, host.row(mission, 'expert').level);
  assert.match(journeyMissionDetails(expert).challenge, /Expert/);
  assert.equal(host.manifest({ ...mission }), null);
  assert.equal(host.manifest({ id: mission.id }), null);
  assert.equal(host.manifest(null), null);
  assert.throws(() => host.manifest(mission, 'invented'));
});
