import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadRuntimeContentProvider } from '../runtime-content-provider.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { prepareScenario } from '../imports.mjs';
import {
  editionPracticeChoices,
  createEditionPracticeScenario,
  editionPracticePreviewURL,
} from '../ui/edition-controller-practice.mjs';

async function providerFor(editionId) {
  const requests = [];
  const provider = await loadRuntimeContentProvider({
    locationRef: { href: `http://localhost/game/index.html?edition=${editionId}` },
    documentRef: { documentElement: { dataset: {} } },
    // Asset admission has its own byte-level tests; this suite checks the exact
    // selected source and normal scenario import path without decoding artwork.
    verifyAssets: async () => {},
    fetcher: async (href) => {
      const url = new URL(href);
      assert.equal(url.origin, 'http://localhost');
      requests.push(url.pathname);
      return new Response(await readFile(new URL(`../..${url.pathname}`, import.meta.url)));
    },
  });
  return { provider, requests };
}

test('controller choices contain all and only admitted company missions, with campaign cosmetics', async () => {
  for (const [editionId, count, prefix] of [
    ['coupa-all', 30, 'coupa-'],
    ['droneaid-nl-community', 36, 'droneaid-nl-'],
  ]) {
    const { provider, requests } = await providerFor(editionId);
    const before = JSON.stringify(provider.route.source);
    const choices = editionPracticeChoices(provider);
    assert.equal(choices.length, count);
    assert.equal(new Set(choices.map((choice) => choice.missionId)).size, count);
    assert.equal(new Set(choices.map((choice) => choice.entry.themes[0].id)).size, count / 6);
    for (const choice of choices) {
      assert.ok(choice.missionId.startsWith(prefix));
      assert.equal(choice.entry.classRecipes, provider.boot[3]);
      const mission = provider.route.source.missions.find((item) => item.id === choice.missionId);
      assert.equal(choice.entry.themes[0].id, mission.presentation.themeId);
    }
    assert.equal(JSON.stringify(provider.route.source), before);
    assert.ok(!requests.some((path) => /fieldcraft|sentinel-relay|reading-practice/.test(path)));
  }
});

test('company practice reconstructs the canonical difficulty once and honors class and steering', async () => {
  const { provider } = await providerFor('coupa-adventure');
  const project = compileContentProject(provider.route.source);
  const missionId = project.missions[0].id;
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const candidate = createEditionPracticeScenario(provider, {
        missionId,
        classId: 'carrier',
        turnPolicy,
        difficulty,
      });
      const { scenario } = await prepareScenario(candidate);
      const manifest = resolveMission(project, missionId, { difficulty });
      assert.deepEqual(
        scenario.level,
        applyGameplayTuning(manifest.level, resolveGameplayTuning(difficulty)),
      );
      assert.deepEqual(scenario.settings, { classId: 'carrier', turnPolicy, seed: 1 });
      assert.equal(scenario.theme.id, manifest.presentation.themeId);
      assert.notEqual(scenario.level, manifest.level);
    }
  }
});

test('practice links preserve the installed audience and reject foreign mission or input claims', async () => {
  const { provider } = await providerFor('droneaid-nl-workshop-lights');
  const missionId = editionPracticeChoices(provider)[0].missionId;
  const session = '0123456789abcdef0123456789abcdef';
  const options = {
    missionId,
    classId: 'fiber',
    turnPolicy: 'grid-center',
    difficulty: 'gentle',
    controllerSession: session,
    revision: 3,
  };
  const url = new URL(editionPracticePreviewURL(provider, options));
  assert.equal(url.pathname, '/game/index.html');
  assert.equal(url.searchParams.get('edition'), provider.editionId);
  assert.equal(url.searchParams.get('edition-mission'), missionId);
  assert.equal(url.searchParams.get('class'), 'fiber');
  assert.equal(url.searchParams.get('difficulty'), 'gentle');
  assert.equal(url.searchParams.get('turn-policy'), 'grid-center');
  assert.equal(url.searchParams.get('controller-session'), session);
  assert.equal(url.searchParams.get('practice'), '1');
  for (const change of [
    { missionId: 'coupa-spend-in-motion-01' },
    { missionId: 'droneaid-nl-shared-horizon-01' },
    { classId: '__proto__' },
    { turnPolicy: 'script' },
    { difficulty: 'custom' },
    { controllerSession: `${session}&edition=foreign` },
    { revision: -1 },
  ])
    assert.throws(() => editionPracticePreviewURL(provider, { ...options, ...change }));
});

test('advanced relay, flow and sentinel missions pass the real Controller Practice import boundary', async () => {
  for (const editionId of ['coupa-all', 'droneaid-nl-community']) {
    const { provider } = await providerFor(editionId);
    const project = compileContentProject(provider.route.source);
    const byVersion = new Map();
    for (const mission of project.missions) byVersion.set(mission.format, mission);
    for (const mission of byVersion.values()) {
      const candidate = createEditionPracticeScenario(provider, { missionId: mission.id });
      const { scenario } = await prepareScenario(candidate);
      const manifest = resolveMission(project, mission.id);
      assert.deepEqual(
        scenario.level,
        applyGameplayTuning(manifest.level, resolveGameplayTuning()),
      );
      assert.equal(scenario.theme.id, mission.presentation.themeId);
      assert.deepEqual(scenario.level.encounter ?? null, candidate.level.encounter ?? null);
    }
    assert(byVersion.has('MissionDesignV4'));
  }
});
