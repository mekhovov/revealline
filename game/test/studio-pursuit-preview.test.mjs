import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Script } from 'node:vm';
import { parse } from 'acorn';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createPursuitPilotCandidates } from '../content-design/pursuit-pilot-candidates.mjs';
import { createSnakeHuntCandidates } from '../content-design/snake-hunt-candidates.mjs';
import { selectedMissionPursuitSource } from '../studio/pursuit-editor.mjs';
import { prepareRunningEnemyLevel } from '../hunt/running-enemies.mjs';
import { pursuitPopulation } from '../hunt/pursuit-goals.mjs';
import { scenarioFormatForLevel, validateScenario } from '../content.mjs';

const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
).themes;
function playable(source, missionId) {
  const initial = prepareContentPreview(source, missionId);
  return prepareContentPreview(source, missionId, {
    theme: themes.find((entry) => entry.id === initial.manifest.presentation.themeId),
  });
}

test('the actual Solo preview admits the pilot pursuit envelope and retains the exact authored policy', () => {
  const source = createPursuitPilotCandidates(),
    original = structuredClone(source),
    result = playable(source, 'crossing-post');
  assert.equal(result.scenario.format, 'xonix-playground.v12');
  assert.equal(result.scenario.level.version, 'xonix-level.v12');
  assert.deepEqual(result.scenario.level, result.manifest.level);
  assert.equal(validateScenario(result.scenario).valid, true);
  assert.equal(result.manifest.officialProgressEligible, false);
  assert.deepEqual(source, original);
  const mismatched = { ...result.scenario, format: 'xonix-playground.v6' };
  assert.equal(validateScenario(mismatched).valid, false);
});

test('Capture Snake and its authored pursuit successor preview preserve their separate transports', () => {
  const source = createSnakeHuntCandidates({ artwork: false }),
    missionId = source.missions[0].id,
    original = playable(source, missionId),
    varied = prepareRunningEnemyLevel(original.manifest.level, { style: 'varied' }),
    successor = selectedMissionPursuitSource(source, missionId, pursuitPopulation(varied)),
    result = playable(successor, missionId);
  assert.equal(original.scenario.format, 'xonix-playground.v11');
  assert.equal(result.scenario.format, 'xonix-playground.v15');
  assert.equal(validateScenario(result.scenario).valid, true);
  assert.deepEqual(result.scenario.level.snake, original.scenario.level.snake);
  assert.deepEqual(result.scenario.level.classic.hunt, original.scenario.level.classic.hunt);
  assert.equal(scenarioFormatForLevel('xonix-level.v10'), null);
  assert.equal(scenarioFormatForLevel('xonix-level.v99'), null);
});

test('Team preview remains native and cannot be passed off as a playable Solo scenario', () => {
  const source = createPursuitPilotCandidates({ team: true });
  for (const mission of source.missions) {
    const preview = prepareContentPreview(source, mission.id, { mode: 'team' });
    assert.equal(preview.scenario, null);
    assert.equal(preview.markers.spawns.length, 2);
    assert.throws(
      () =>
        prepareContentPreview(source, mission.id, {
          mode: 'team',
          theme: themes.find((entry) => entry.id === preview.manifest.presentation.themeId),
        }),
      /Only Solo has a Studio gameplay preview/,
    );
  }
});

test('standalone scenario picture ownership never searches an unrelated installed campaign', async () => {
  const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
  const tree = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
  let target;
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'FunctionDeclaration' && node.id?.name === 'pictureLevelForRun')
      target = node;
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  }
  visit(tree);
  assert.ok(target);
  const context = {
    practice: true,
    scenario: { level: { id: 'crossing-post' } },
    pictureExecutionForEntry: (entry) => entry,
    recoverGameplayTuning: () => ({ difficulty: 'standard' }),
    t: (key) => key,
  };
  const resolve = new Script(`(${source.slice(target.start, target.end)})`).runInNewContext(
    context,
  );
  const run = { levelId: 'crossing-post', level: { id: 'crossing-post', revision: 'pursuit-2' } };
  const installed = { campaign: { levels: [] } };
  assert.equal(resolve(run, installed), run.level);
  context.scenario = null;
  assert.throws(() => resolve(run, installed), /pictureMissionIsUnavailable/);
  const original = { id: 'crossing-post', revision: 'original-picture' };
  installed.campaign.levels.push(original);
  assert.equal(resolve(run, installed), original);
});
