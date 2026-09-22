import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createWholeJourneyCandidates,
  WHOLE_JOURNEY_CHAPTERS,
  WHOLE_JOURNEY_CORE_PACK_IDS,
  WHOLE_JOURNEY_REMIX_PACK_IDS,
} from '../content-design/whole-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { createCandidateSequence, createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { createJourneyCatalog } from '../journey/catalog.mjs';
import { inspectContentPacing } from '../content-design/pacing.mjs';

const source = createWholeJourneyCandidates();
const project = compileContentProject(source);
const originals = await Promise.all(
  WHOLE_JOURNEY_CHAPTERS.map(async (chapter) => {
    const module = await import(`../content-design/${chapter.id}-candidates.mjs`);
    const factory =
      chapter.id === 'horizon'
        ? 'createOpeningCandidates'
        : `create${chapter.id[0].toUpperCase()}${chapter.id.slice(1)}Candidates`;
    const arcs = Object.entries(module).find(([name]) => name.endsWith('_ARCS'))[1];
    return { ...chapter, source: module[factory](), arcs };
  }),
);

test('whole Journey is an independent 83-mission review draft, not public enrollment or an implicit upgrade', () => {
  assert.equal(project.missions.length, 83);
  assert.equal(project.campaigns.length, 25);
  assert.equal(project.packs.length, 24);
  assert.equal(project.assets.length, 0);
  assert.deepEqual(
    project.packs.map((pack) => pack.id),
    [...WHOLE_JOURNEY_CORE_PACK_IDS, ...WHOLE_JOURNEY_REMIX_PACK_IDS],
  );
  const second = createWholeJourneyCandidates();
  second.maps[0].foundations.push({ x: 1, y: 1, w: 1, h: 1 });
  assert.notDeepEqual(second, source);
  assert.deepEqual(createWholeJourneyCandidates(), source);
  assert.equal(createAuthoredJourneyRoute('whole-journey'), null);
  assert.deepEqual(createAuthoredJourneyRoute('authored').corePackIds, [
    'journey-opening',
    'journey-border',
  ]);
  assert.throws(() => resolveContentJourney(source, { mode: 'team' }), /no missions for this mode/);
});

for (const mode of ['solo', 'versus'])
  test(`every composed ${mode} manifest and execution remains identical to its standalone edition`, () => {
    const catalog = createContentExecutionCatalog(source, { mode });
    for (const original of originals) {
      const previousProject = compileContentProject(original.source);
      const previousCatalog = createContentExecutionCatalog(original.source, { mode });
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        for (const mission of original.source.missions) {
          const previous = resolveMission(previousProject, mission.id, { difficulty, mode });
          const combined = resolveMission(project, mission.id, { difficulty, mode });
          assert.deepEqual(combined, previous, `${mission.id}/${difficulty}`);
          assert.equal(combined.officialProgressEligible, false);
        }
        for (const pack of original.source.packs)
          for (const campaignId of pack.campaignIds) {
            const previous = previousCatalog.select(pack.id, campaignId, difficulty);
            const combined = catalog.select(pack.id, campaignId, difficulty);
            assert.deepEqual(combined.campaign, previous.campaign);
            assert.equal(combined.executionKey, previous.executionKey);
            assert.equal(combined.baseCampaignKey, previous.baseCampaignKey);
            assert.equal(catalog.find(pack.id, campaignId, previous.executionKey), combined);
          }
      }
    }
  });

for (const mode of ['solo', 'versus'])
  test(`${mode} sequence crosses every core boundary, ignores search filters and ends before optional Remixes`, () => {
    const journey = resolveContentJourney(source, { mode });
    const catalog = createJourneyCatalog(
      journey.campaigns.map((campaign) => ({
        source: 'candidate',
        packId: campaign.packId,
        id: campaign.campaignId,
        title: campaign.runtime.title,
        modes: [mode],
        levels: campaign.manifests.map((manifest) => ({
          id: manifest.missionId,
          name: manifest.level.name,
          hook: manifest.design.routeDecision,
        })),
      })),
    );
    assert.deepEqual(
      catalog.missions.map((m) => m.id),
      journey.missions.map((m) => m.id),
    );
    const sequence = createCandidateSequence(catalog, WHOLE_JOURNEY_CORE_PACK_IDS);
    const core = catalog.missions.filter((m) => sequence.isCore(m.id));
    const remixes = catalog.missions.filter((m) => !sequence.isCore(m.id));
    assert.equal(core.length, 71);
    assert.equal(remixes.length, 12);
    const visits = [],
      boundaries = [];
    for (let mission = core[0]; mission; mission = sequence.next(mission.id)) {
      visits.push(mission.id);
      assert(visits.length <= 71, 'sequence cycle');
      const next = sequence.next(mission.id);
      if (next && next.campaignId !== mission.campaignId)
        boundaries.push([mission.campaignId, next.campaignId]);
      assert.equal(catalog.find(mission.id), mission);
      assert(catalog.search(mission.levelId, { mode }).some((hit) => hit.id === mission.id));
      catalog.search('no matching mission', { mode, campaignId: 'prologue' });
      assert.equal(sequence.next(mission.id), next, 'search changed continuation');
    }
    assert.deepEqual(
      visits,
      core.map((m) => m.id),
    );
    assert.equal(boundaries.length, 12);
    assert.equal(core.at(-1).levelId, 'home-signal');
    assert.equal(sequence.next(core.at(-1).id), null);
    for (const remix of remixes) {
      assert.equal(sequence.next(remix.id), null);
      assert.equal(catalog.search(remix.levelId, { mode })[0].id, remix.id);
    }
  });

test('declared progression has practice-sized arcs, no band reset and fewer than15% timed core missions', () => {
  const report = inspectContentPacing(source, { packIds: WHOLE_JOURNEY_CORE_PACK_IDS });
  assert.equal(report.rows.length, 71);
  assert(report.timedFraction < 0.15);
  assert.equal(report.qualification, 'authored-ratings-only-not-playtest-or-release-qualification');
  assert(
    !report.diagnostics.some((d) =>
      ['challenge-band-regression', 'challenge-band-jump'].includes(d.code),
    ),
  );
  for (const original of originals) {
    const pack = original.source.packs.find((p) => p.id === original.corePackId);
    const coreIds = pack.campaignIds.flatMap(
      (id) => original.source.campaigns.find((c) => c.id === id).missionIds,
    );
    assert.deepEqual(
      original.arcs.flatMap((arc) => arc.missionIds),
      coreIds,
    );
    for (const arc of original.arcs) {
      assert(arc.missionIds.length >= 3 && arc.missionIds.length <= 5, arc.id);
      const introduced = new Set(
        arc.missionIds.flatMap(
          (id) => original.source.missions.find((m) => m.id === id).design.introduces,
        ),
      );
      assert(introduced.size <= 1, arc.id);
    }
  }
});

test('whole-library Studio action inspects a candidate source and does not bypass explicit Apply', async () => {
  const studio = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  assert.match(html, /id="whole-journey">Inspect whole Journey picture candidates/);
  const handler = studio.match(
    /\$\('whole-journey'\)\.onclick = guarded\(\(\) => \{([\s\S]*?)\n\}\);/,
  )[1];
  assert.match(handler, /discardSource\(\)/);
  assert.match(
    handler,
    /createWholeJourneyCandidates\(\{\s*artwork: true,\s*roverTeaching: true,\s*campaignPresentation: true,/,
  );
  assert.match(html, /href="\.\.\/\?journey=whole-originals-v3"/);
  assert.match(html, /href="\.\.\/couch\/\?journey=whole-originals-v3"/);
  assert.match(handler, /inspectSource\(\)/);
  assert.doesNotMatch(handler, /session\.(?:apply|replace|transact)|location\.|publish/i);
});
