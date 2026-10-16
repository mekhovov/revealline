import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';
import { createTeamPressureOriginalCandidates } from '../content-design/team-pressure-originals.mjs';
import { createTeamRoamerSpatialCandidates } from '../content-design/team-roamer-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { readCoopPack } from '../coop/library.mjs';
import { assessTeamPressureRoute } from '../../scripts/lib/team-pressure-assessment.mjs';
import { page } from './helpers/coop-host.mjs';
import { playTeamSpatialRoute } from './helpers/team-spatial-host-route.mjs';

const source = createTeamSpatialOriginalCandidates(),
  old = createTeamPressureOriginalCandidates();
const project = compileContentProject(source),
  baseline = compileContentProject(old),
  donor = compileContentProject(createTeamRoamerSpatialCandidates());
const evidence = JSON.parse(
  await readFile(new URL('./fixtures/team-roamer-spatial-routes.json', import.meta.url)),
);
const changed = new Set(['shared-lookout', 'twin-depots']);
const resolve = (p, id, difficulty) => resolveMission(p, id, { mode: 'team', difficulty });

test('spatial route inventory covers both revised maps and every preset exactly once', () => {
  assert.deepEqual(
    evidence.rows.map((r) => `${r.missionId}/${r.difficulty}`).sort(),
    [...changed].flatMap((id) => ['gentle', 'standard', 'expert'].map((d) => `${id}/${d}`)).sort(),
  );
});

test('two spatial maps integrate without changing the other ten missions, pictures or historical pressure edition', () => {
  assert.notEqual(source.id, old.id);
  assert.equal(source.missions.length, 12);
  assert.equal(source.campaigns.length, 5);
  assert.deepEqual(source.assets, old.assets);
  assert.deepEqual(
    source.missions.map((m) => m.id),
    old.missions.map((m) => m.id),
  );
  assert.equal(
    source.maps.filter((m) => !old.maps.some((b) => JSON.stringify(b) === JSON.stringify(m)))
      .length,
    2,
  );
  assert.equal(
    source.campaigns.filter((c, i) => c.revision !== old.campaigns[i].revision).length,
    1,
  );
  assert.equal(source.packs.filter((p, i) => p.revision !== old.packs[i].revision).length, 1);
  for (const mission of source.missions) {
    assert.deepEqual(
      mission.presentation,
      old.missions.find((m) => m.id === mission.id).presentation,
    );
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const actual = resolve(project, mission.id, difficulty),
        expected = resolve(changed.has(mission.id) ? donor : baseline, mission.id, difficulty);
      assert.deepEqual(actual.level, expected.level);
      assert.equal(actual.simulationIdentity, expected.simulationIdentity);
      const pack = createTeamTestPack(source, mission.id, difficulty);
      assert.deepEqual(readCoopPack(JSON.stringify(pack)).levels, [actual.level]);
    }
  }
  const modified = createTeamSpatialOriginalCandidates();
  modified.maps[0].foundations[0].w = 1;
  assert.deepEqual(createTeamSpatialOriginalCandidates(), source);
  assert.deepEqual(createTeamPressureOriginalCandidates(), old);
});

for (const row of evidence.rows) {
  test(`${row.missionId}/${row.difficulty}: four original spatial routes retain exact outcomes`, () => {
    const manifest = resolve(project, row.missionId, row.difficulty);
    assert.equal(manifest.simulationIdentity, row.simulationIdentity);
    assert.deepEqual(row.outcomes.map((o) => `${o.jointCuts}/${o.swapped}`).sort(), [
      'false/false',
      'false/true',
      'true/false',
      'true/true',
    ]);
    for (const { jointCuts, swapped, ...expected } of row.outcomes)
      assert.deepEqual(
        assessTeamPressureRoute(manifest.level, row.log, { jointCuts, swapped }),
        expected,
      );
  });
  test(`${row.missionId}/${row.difficulty}: actual keyboard host completes the spatial map`, async (t) => {
    const f = await page(t, { nativeFocus: true, nativeVisibility: true });
    await f.selectFile(JSON.stringify(createTeamTestPack(source, row.missionId, row.difficulty)));
    assert.equal(f.$('coop-pack-status').dataset.state, 'ready');
    await f.choose('coop-difficulty', row.difficulty);
    f.$('coop-start').focus();
    f.tap('Enter');
    f.tick(2);
    const reference = playTeamSpatialRoute(f, source, row.missionId, row.difficulty);
    t.diagnostic(
      `current keyboard host: ${reference.run.tick} ticks, ${f.$('coop-coverage').textContent}; historical authored-rule checkpoints remain above`,
    );
  });
}
