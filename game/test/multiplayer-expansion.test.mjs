import test from 'node:test';
import assert from 'node:assert/strict';
import { createMultiplayerExpansionCandidates } from '../content-design/multiplayer-expansion.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import {
  auditMultiplayerVariety,
  inspectMultiplayerChapter,
  multiplayerGeometryFingerprint,
} from '../content-design/multiplayer-chapters.mjs';
import { readCoopPack } from '../coop/library.mjs';
import { readFile } from 'node:fs/promises';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import {
  prepareCreatorTeamSourceCampaign,
  exportCreatorTeamCampaign,
  importCreatorTeamCampaign,
} from '../creator/team.mjs';
import { multiplayerChapterSource } from '../content-design/multiplayer-chapters.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import { retainedJourneyFromExpeditions } from '../mission-library/multiplayer-expeditions.mjs';
import { editTeamEnvironment } from '../content-design/team-environment-edit.mjs';
import { dataIdentity } from '../data-json.mjs';
import { classifyContent } from '../content-design/content-lifecycle.mjs';
import { duelExpeditionLibrarySources } from '../mission-library/multiplayer-expeditions.mjs';

test('new expeditions appear in Current editions without changing historical classification', async () => {
  assert.equal(classifyContent({ family: 'journey', id: 'duel-expedition-v1' }), 'current');
  assert.equal(classifyContent({ family: 'team', id: 'team-expedition-v1' }), 'current');
  assert.equal(classifyContent({ family: 'journey', id: 'whole-spatial-v24' }), 'archived');
  const { themes } = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  );
  const source = duelExpeditionLibrarySources({ themes, launch: () => {} }).find(
    (row) => row.editionId === 'duel-expedition-v1',
  );
  assert.equal(source.lifecycle, 'current');
  assert.equal(source.entries.length, 72);
});

test('environment edits are qualified, atomic and reject stale mission or map snapshots', () => {
  const source = createMultiplayerExpansionCandidates();
  const mission = source.missions.find((row) => row.id === 'team-partner-first-link');
  const map = source.maps.find((row) => row.id === mission.map.id);
  const before = structuredClone(source);
  const environment = structuredClone(mission.team.environment);
  environment.relays[0].objective.x += 1;
  const command = {
    expectedMission: dataIdentity(mission),
    expectedMap: dataIdentity(map),
    environment,
  };
  const edited = editTeamEnvironment(source, mission.id, command);
  assert.deepEqual(source, before);
  assert.deepEqual(edited.maps, source.maps);
  assert.deepEqual(edited.assets, source.assets);
  assert.notEqual(edited.revision, source.revision);
  assert.equal(
    edited.missions.find((row) => row.id === mission.id).team.environment.relays[0].objective.x,
    environment.relays[0].objective.x,
  );
  assert.throws(() => editTeamEnvironment(edited, mission.id, command), /changed/);
  const changedMap = structuredClone(source);
  changedMap.maps.find((row) => row.id === map.id).name += ' changed';
  assert.throws(() => editTeamEnvironment(changedMap, mission.id, command), /changed/);
  command.environment.relays[0].gate.x = -1;
  assert.throws(() => editTeamEnvironment(source, mission.id, command));
  assert.throws(
    () => editTeamEnvironment(source, source.missions[0].id, command),
    /environment first/,
  );
  assert.deepEqual(source, before);
});

test('dedicated Duel discovery retains all 91 default Journey missions in both qualified modes', async () => {
  const { themes } = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  );
  const [source] = await retainedJourneyFromExpeditions({
    activeRouteId: 'duel-expedition-v1',
    themes,
    launch: () => {},
  });
  assert.equal(source.lifecycle, 'current');
  assert.equal(source.entries.length, 91);
  for (const entry of source.entries)
    assert.deepEqual(source.describe(entry).modes, ['solo', 'versus']);
  assert.deepEqual(
    await retainedJourneyFromExpeditions({
      activeRouteId: 'whole-spatial-v25',
      themes,
      launch: () => {},
    }),
    [],
  );
});

test('Studio presents every Team environment family with owned finite markers', () => {
  const source = createMultiplayerExpansionCandidates();
  const seen = new Set();
  for (const mission of source.missions) {
    if (!mission.team?.environment) continue;
    const types = Object.entries(mission.team.environment)
      .filter(([, v]) => Array.isArray(v) && v.length)
      .map(([k]) => k);
    if (types.every((type) => seen.has(type))) continue;
    const preview = prepareContentPreview(source, mission.id, { mode: 'team' });
    assert(preview.markers.expedition, mission.id);
    const before = structuredClone(preview);
    const calls = [];
    const ctx = new Proxy(
      {},
      {
        get:
          (_target, method) =>
          (...args) => {
            assert(
              args.every((value) => typeof value !== 'number' || Number.isFinite(value)),
              method,
            );
            calls.push(method);
          },
      },
    );
    paintContentMap(ctx, preview);
    assert(calls.includes('stroke'));
    assert.deepEqual(preview, before);
    types.forEach((type) => seen.add(type));
  }
  assert.deepEqual([...seen].sort(), [
    'currents',
    'emitters',
    'erosion',
    'patrols',
    'relays',
    'stages',
  ]);
});

test('all twelve Team chapters survive the real editable-source portable export and import', async () => {
  const source = compileContentProject(createMultiplayerExpansionCandidates());
  for (const campaign of source.source.campaigns) {
    const chapter = multiplayerChapterSource(source, campaign.id, 'team');
    const selection = {
      sourcePackId: chapter.packs[0].id,
      campaignId: campaign.id,
      difficulty: 'standard',
    };
    const prepared = await prepareCreatorTeamSourceCampaign(chapter, selection);
    const portable = exportCreatorTeamCampaign(prepared);
    const imported = await importCreatorTeamCampaign(portable);
    assert.deepEqual(imported.pack, prepared.pack);
    assert.deepEqual(imported.provenance.sourceProject, chapter);
    assert(imported.evidence.every((row) => row.qualification === 'structural-only'));
    assert(portable.size < 1024 * 1024);
  }
});

test('Duel route loads identically in both hosts with its actual authored themes', async () => {
  const route = createAuthoredJourneyRoute('duel-expedition-v1');
  assert.deepEqual(await loadAuthoredJourneyRoute(route.id), route);
  const { themes } = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  );
  const host = createCandidateVersusHost(route.source, { themes, corePackIds: route.corePackIds });
  assert.equal(host.catalog.missions.length, route.source.missions.length);
  const authoredOrder = route.source.packs.flatMap((pack) =>
    pack.campaignIds.flatMap(
      (id) => route.source.campaigns.find((campaign) => campaign.id === id).missionIds,
    ),
  );
  assert.deepEqual(
    host.catalog.missions.map((mission) => mission.levelId),
    authoredOrder,
  );
  for (let index = 0; index < host.catalog.missions.length; index++)
    assert.equal(
      host.next(host.catalog.missions[index].id),
      host.catalog.missions[index + 1] ?? null,
      'Next preserves authored order across native-edition campaign parts',
    );
  for (const row of host.rows)
    assert(row.asset && row.themes.some((t) => t.id === row.defaultThemeId));
});

test('every expansion recipe survives serialization and all three real mode projections', () => {
  for (const mode of ['team', 'versus']) {
    const source = createMultiplayerExpansionCandidates({ mode });
    const compiled = compileContentProject(JSON.parse(JSON.stringify(source)));
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      for (const mission of compiled.missions) {
        const result = resolveMission(compiled, mission.id, { mode, difficulty });
        assert.deepEqual(
          result.diagnostics.filter((d) => d.severity === 'error'),
          [],
          mission.id,
        );
        assert.throws(() =>
          resolveMission(compiled, mission.id, { mode: mode === 'team' ? 'versus' : 'team' }),
        );
      }
      for (const campaign of source.campaigns) {
        const chapter = inspectMultiplayerChapter(compiled, campaign.id, mode, difficulty);
        assert.equal(chapter.source.missions.length, campaign.missionIds.length);
        assert(chapter.assets.length > 0);
        if (mode === 'team')
          assert.deepEqual(readCoopPack(JSON.stringify(chapter.gameplay)), chapter.gameplay);
        else assert.equal(chapter.gameplay.protocol, 'xonix-duel.untimed.v1');
      }
    }
    assert.deepEqual(source, compiled.source);
  }
});

test('variety audit rejects copied topology even when names, rectangles and orientation change', () => {
  const sources = ['team', 'versus'].map((mode) => createMultiplayerExpansionCandidates({ mode }));
  const audit = auditMultiplayerVariety(sources);
  assert.equal(
    audit.distinctGeometry,
    sources.reduce((n, p) => n + p.missions.length, 0),
  );
  assert.deepEqual(audit.duplicates, []);
  assert.deepEqual(audit.repeatedDecisions, []);
  const map = sources[0].maps[0],
    reflected = structuredClone(map);
  for (const key of ['walls', 'foundations', 'terrain'])
    reflected[key] = reflected[key].map((r) => ({ ...r, x: map.width - r.x - r.w }));
  assert.equal(multiplayerGeometryFingerprint(map), multiplayerGeometryFingerprint(reflected));
  assert.equal(
    auditMultiplayerVariety([sources[0], sources[0]]).duplicates.length,
    sources[0].missions.length,
  );
});

test('chapter projection refuses missing, archived and mixed-mode recipes', () => {
  const source = createMultiplayerExpansionCandidates();
  assert.throws(() => inspectMultiplayerChapter(source, 'missing', 'team'));
  source.campaigns[0].archived = true;
  assert.throws(() => inspectMultiplayerChapter(source, source.campaigns[0].id, 'team'));
  const duel = createMultiplayerExpansionCandidates({ mode: 'versus' });
  duel.missions[0].modes.push('solo');
  assert.throws(
    () => inspectMultiplayerChapter(duel, duel.campaigns[0].id, 'versus'),
    /exactly one mode/,
  );
});
