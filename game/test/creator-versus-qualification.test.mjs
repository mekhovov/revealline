import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileContentProject } from '../content-design/project.mjs';
import { createCandidateVersusHost } from '../content-design/versus-host.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createDuel, resumeDuel, stepDuel, UNTIMED_DUEL_PROTOCOL } from '../multiplayer.mjs';
import {
  CREATOR_TEMPLATE_REGISTRY_VERSION,
  generateCreatorProject,
  verifyCreatorRoutes,
} from '../creator/templates.mjs';
import {
  CREATOR_VERSUS_QUALIFICATIONS,
  creatorVersusCompatibility,
  verifyCreatorVersusRoutes,
} from '../creator/versus.mjs';

const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;

function replayCommands(replay) {
  return replay.segments.flatMap((segment) =>
    Array.from({ length: segment.ticks }, () => {
      const { switchClass: _switchClass, ...command } = segment.input;
      return command;
    }),
  );
}

test('all twelve creator-layouts.v3 variants pass every equal-board Versus configuration', async () => {
  assert.equal(CREATOR_VERSUS_QUALIFICATIONS.length, 12);
  for (let seed = 0; seed < 12; seed++) {
    const made = generateCreatorProject({ id: `versus-${seed}`, name: 'Versus pictures', seed });
    assert.deepEqual(made.project.missions[0].modes, ['solo', 'versus']);
    assert.deepEqual(creatorVersusCompatibility(made.provenance), ['versus']);
    const evidence = await verifyCreatorVersusRoutes(made.project, made.provenance);
    assert.equal(evidence.length, 6);
    assert.ok(
      evidence.every(
        (row) =>
          row.mode === 'versus' &&
          row.outcome === 'draw' &&
          row.templateVersion === CREATOR_TEMPLATE_REGISTRY_VERSION &&
          row.checkpoint.hash,
      ),
    );
  }
});

test('legacy v1/v2 provenance stays Solo-only and cannot borrow v3 qualification', async () => {
  const made = generateCreatorProject({ id: 'legacy-check', name: 'Legacy', seed: 1 });
  for (const templateVersion of ['creator-crossing.v1', 'creator-layouts.v2']) {
    const provenance = {
      ...made.provenance,
      templateVersion,
      ...(templateVersion === 'creator-crossing.v1'
        ? { templateId: 'first-crossing', variantId: 'west' }
        : {}),
    };
    assert.deepEqual(creatorVersusCompatibility(provenance), []);
    await assert.rejects(
      verifyCreatorVersusRoutes(made.project, provenance),
      /not qualified for Versus/,
    );
  }
});

test('qualified project drives real winner, Retry and Next contracts', async () => {
  const first = generateCreatorProject({ id: 'versus-campaign', name: 'Versus campaign', seed: 0 });
  const second = generateCreatorProject({ id: 'versus-second', name: 'Versus campaign', seed: 1 });
  const project = structuredClone(first.project);
  const secondMap = structuredClone(second.project.maps[0]);
  secondMap.id = 'second-map';
  const secondMission = structuredClone(second.project.missions[0]);
  secondMission.id = 'picture-2';
  secondMission.map.id = secondMap.id;
  secondMission.name = 'Second picture';
  const assets = [
    ['picture-one', 'a'],
    ['picture-two', 'b'],
  ].map(([id, byte]) => ({
    format: 'AssetRevisionV1',
    id,
    revision: '1',
    kind: 'reveal-background',
    path: `content-design/assets/creator/${id}.png`,
    sha256: byte.repeat(64),
    bytes: 100,
    width: 72,
    height: 36,
    alt: id,
    review: 'candidate',
  }));
  project.maps.push(secondMap);
  project.missions.push(secondMission);
  project.assets = assets;
  project.missions[0].presentation.backgroundAssetId = assets[0].id;
  project.missions[1].presentation.backgroundAssetId = assets[1].id;
  project.campaigns[0].missionIds = ['picture-1', 'picture-2'];
  const host = createCandidateVersusHost(compileContentProject(project).source, {
    themes,
    corePackIds: ['collection'],
  });
  const opening = host.catalog.missions[0];
  const next = host.next(opening.id);
  assert.equal(opening.levelId, 'picture-1');
  assert.equal(next.levelId, 'picture-2');
  assert.equal(host.next(next.id), null);

  const route = (await verifyCreatorRoutes(first.project, first.provenance)).find(
    (row) => row.difficulty === 'standard' && row.turnPolicy === 'immediate',
  );
  const manifest = host.manifest(opening, 'standard');
  const options = { seed: route.seed, classId: 'scout', turnPolicy: route.turnPolicy };
  const original = createDuel(manifest.level, options, {
    protocol: UNTIMED_DUEL_PROTOCOL,
    seconds: 0,
  });
  const retry = createDuel(manifest.level, options, {
    protocol: UNTIMED_DUEL_PROTOCOL,
    seconds: 0,
  });
  assert.deepEqual(
    authoritativeCheckpoint(retry.runs[0]),
    authoritativeCheckpoint(original.runs[0]),
    'Retry restarts the exact selected mission, rules and seed.',
  );
  resumeDuel(original);
  for (const command of replayCommands(route.replay)) stepDuel(original, [command, {}]);
  assert.equal(original.status, 'finished');
  assert.equal(original.winner, 0);
  assert.equal(original.reason, 'First clear');
  assert.equal(original.runs[0].status, 'won');
});
