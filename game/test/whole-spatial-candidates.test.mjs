import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createWholeSpatialCandidates,
  WHOLE_SPATIAL_SELECTIONS,
} from '../content-design/whole-spatial-candidates.mjs';
import {
  createWholeJourneyCandidates,
  WHOLE_JOURNEY_CORE_PACK_IDS,
} from '../content-design/whole-journey-candidates.mjs';
import { withPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { createOutpostSpatialCandidates } from '../content-design/outpost-spatial-candidates.mjs';
import { createFractureSpatialCandidates } from '../content-design/fracture-spatial-candidates.mjs';
import { createPhaseSpatialCandidates } from '../content-design/phase-spatial-candidates.mjs';
import { createLivewireSpatialCandidates } from '../content-design/livewire-spatial-candidates.mjs';
import { createSentinelSpatialCandidates } from '../content-design/sentinel-spatial-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import {
  authoredJourneyModeHref,
  authoredJourneyUsesActorMaterials,
} from '../content-design/mode-href.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { journeyActorThemeCandidates } from '../presentation/journey-actor-materials.mjs';

const studies = new Map(
  [
    ['horizon', createOutpostSpatialCandidates()],
    ['fracture', createFractureSpatialCandidates()],
    ['phase', createPhaseSpatialCandidates()],
    ['livewire', createLivewireSpatialCandidates({ edition: 'routing' })],
    ['sentinel', createSentinelSpatialCandidates()],
  ].map(([id, source]) => [id, compileContentProject(source)]),
);
const selected = new Map(
  WHOLE_SPATIAL_SELECTIONS.flatMap(({ id, missionIds }) =>
    missionIds.map((missionId) => [missionId, studies.get(id)]),
  ),
);

for (const artwork of [false, true])
  test(`combined source preserves all exact reviewed gameplay and base presentation: artwork=${artwork}`, () => {
    const before = createWholeJourneyCandidates({
      artwork,
      roverTeaching: true,
      campaignActors: true,
    });
    const base = compileContentProject(withPressureDifficulty(before));
    const source = createWholeSpatialCandidates({ artwork });
    const project = compileContentProject(source);
    assert.equal(project.missions.length, 83);
    assert.equal(selected.size, 9);
    assert.equal(source.difficultyCatalogId, 'journey-difficulty-v2');
    assert.equal(source.maps.length, 83);
    assert.deepEqual(source.assets, base.source.assets);
    for (const mission of project.missions) {
      const reference = selected.get(mission.id) ?? base;
      assert.deepEqual(
        mission.presentation,
        base.missions.find((m) => m.id === mission.id).presentation,
      );
      for (const difficulty of ['gentle', 'standard', 'expert'])
        for (const mode of ['solo', 'versus']) {
          const actual = resolveMission(project, mission.id, { difficulty, mode });
          const expected = resolveMission(reference, mission.id, { difficulty, mode });
          assert.deepEqual(actual.level, expected.level, `${mission.id}/${difficulty}/${mode}`);
          assert.equal(actual.simulationIdentity, expected.simulationIdentity);
          assert.equal(actual.officialProgressEligible, false);
        }
    }
    assert.deepEqual(
      createWholeJourneyCandidates({ artwork, roverTeaching: true, campaignActors: true }),
      before,
    );
    source.maps[0].name = 'caller mutation';
    source.missions[0].name = 'caller mutation';
    const fresh = createWholeSpatialCandidates({ artwork });
    assert.notEqual(fresh.maps[0].name, 'caller mutation');
    assert.notEqual(fresh.missions[0].name, 'caller mutation');
  });

test('new route shares one 71-core sequence across hosts, isolates progress and preserves historical routes', async () => {
  const route = createAuthoredJourneyRoute('whole-spatial-v1');
  assert.equal(route.profileKey, 'journey-whole-spatial-v1');
  assert.equal(route.sessionKey, 'revealline.suspended.journey-whole-spatial.v1');
  assert(Object.isFrozen(route.source.missions[0]));
  assert(Object.isFrozen(WHOLE_SPATIAL_SELECTIONS[0].missionIds));
  assert.deepEqual(route.corePackIds, WHOLE_JOURNEY_CORE_PACK_IDS);
  assert(authoredJourneyUsesActorMaterials(route.id));
  assert(authoredJourneyUsesActorMaterials('whole-originals-v4'));
  assert.equal(authoredJourneyUsesActorMaterials('whole-originals-v3'), false);
  assert.match(authoredJourneyModeHref(route.id, 'versus'), /journey=whole-spatial-v1/);
  const themes = journeyActorThemeCandidates(
    JSON.parse(await readFile(new URL('../content-design/themes.json', import.meta.url))).themes,
  );
  let prior;
  for (const createHost of [createCandidateSoloHost, createCandidateVersusHost]) {
    const host = createHost(route.source, { themes, corePackIds: route.corePackIds });
    const core = [];
    for (let mission = host.catalog.missions[0]; mission; mission = host.next(mission.id)) {
      assert(!core.includes(mission.id));
      core.push(mission.id);
    }
    assert.equal(core.length, 71);
    assert.match(core.at(-1), /home-signal$/);
    assert.equal(host.catalog.missions.filter((m) => !host.isCore(m.id)).length, 12);
    assert(
      host.catalog.missions
        .filter((m) => !host.isCore(m.id))
        .every((m) => host.next(m.id) === null),
    );
    if (prior) assert.deepEqual(core, prior);
    prior = core;
  }
  for (const id of [
    'opening',
    'authored',
    'whole-originals',
    'whole-originals-v2',
    'whole-originals-v3',
    'whole-originals-v4',
  ]) {
    const historical = createAuthoredJourneyRoute(id);
    assert.equal(historical.profileKey, undefined);
    assert.notEqual(historical.sessionKey, route.sessionKey);
  }
});

test('Studio exposes explicit Inspect and mode links without making review content the default', async () => {
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  const script = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  assert.match(html, /id="whole-spatial"/);
  assert.match(html, /\.\.\/\?journey=whole-spatial-v1/);
  assert.match(html, /\.\.\/couch\/\?journey=whole-spatial-v1/);
  assert.match(html.replace(/\s+/g, ' '), /Unvalidated candidates with separate/);
  assert.match(
    script,
    /\$\('whole-spatial'\)\.onclick = guarded\(\(\) => \{\s+if \(!discardSource\(\)\) return;/,
  );
});
