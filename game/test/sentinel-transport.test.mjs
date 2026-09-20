import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sentinelProjectFixture } from './helpers/sentinel-project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { validateScenario } from '../content.mjs';
import {
  validatePack,
  preparePack,
  scenarioFromPack,
  resolvePackCampaign,
  emptyPackLibrary,
} from '../packs.mjs';
import { CLASSES, createRun } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { foundationCompatibleView } from '../ui/foundation-view.mjs';
import { relayView } from '../ui/relay-view.mjs';
import { directionalView } from '../ui/directional-view.mjs';
import { encounterView } from '../ui/encounter-view.mjs';
import { flightInformationSnapshot } from '../ui/flight-information-source.mjs';
import { missionBriefing } from '../mission-brief.mjs';
import { contentActorDescription, traceContentActor } from '../content-design/actor-marker.mjs';
import {
  entryScenario,
  expansionFromScenario,
  prepareDocument,
  paintLevel,
  withScenarioMastery,
  withScenarioEncounter,
  withoutScenarioEncounter,
} from '../playground/model.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import { paintEditorMap } from '../playground/board-view.mjs';
import { editContentDirectional } from '../content-design/directional.mjs';
import { editContentRelay } from '../content-design/relays.mjs';
import { dataIdentity } from '../data-json.mjs';

function fixture() {
  const project = sentinelProjectFixture();
  project.maps[0].gates = [{ id: 'shortcut', x: 40, y: 10, w: 2, h: 3 }];
  project.maps[0].speedZones = [{ id: 'marked', x: 10, y: 2, w: 5, h: 5, direction: 'down' }];
  project.missions[0].relayLinks = [{ gateId: 'shortcut', objectiveId: 'west' }];
  const theme = JSON.parse(
    readFileSync(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
  ).themes[0];
  const preview = prepareContentPreview(project, 'nearby-shore', { theme });
  return {
    project,
    preview,
    scenario: { ...preview.scenario, classRecipes: structuredClone(CLASSES) },
  };
}

test('Sentinel preview, import, editor model and pack round-trip retain the exact successor', async () => {
  const { scenario } = fixture();
  assert.equal(scenario.format, 'xonix-playground.v9');
  assert.deepEqual(validateScenario(scenario).errors, []);
  assert.equal(validateScenario({ ...scenario, format: 'xonix-playground.v8' }).valid, false);
  const pack = expansionFromScenario(scenario);
  assert.equal(pack.format, 'xonix-pack.v9');
  assert.equal(pack.engine, 'xonix-core.v9');
  assert.deepEqual(validatePack(pack).errors, []);
  assert.equal(validatePack({ ...pack, format: 'xonix-pack.v8' }).valid, false);
  const prepared = await preparePack(pack);
  const imported = scenarioFromPack(prepared.pack, scenario.level.id, scenario.level.id);
  assert.equal(imported.format, scenario.format);
  assert.deepEqual(imported.level, scenario.level);
  const edited = entryScenario(resolvePackCampaign(prepared.pack, scenario.level.id));
  assert.deepEqual(expansionFromScenario(edited).campaigns[0].levels[0], imported.level);
  assert.equal(withScenarioMastery(edited, null).format, scenario.format);
  assert.throws(() => withScenarioMastery(edited, {}), /mastery/i);
  assert.deepEqual(withScenarioEncounter(edited, edited.level.encounter).level, edited.level);
  const without = withoutScenarioEncounter(edited);
  assert.equal(without.format, scenario.format);
  assert.equal(without.level.version, 'xonix-level.v8');
  assert.equal(without.level.encounter, null);
  assert.equal(without.level.enemies.length, 0);
  assert.equal(without.level.objectives.length, 3);
  for (const input of [scenario.level, pack]) {
    const result = await prepareDocument(input, {
      current: scenario,
      packLibrary: emptyPackLibrary(),
    });
    assert.equal(result.scenario.format, scenario.format);
    assert.deepEqual(result.scenario.level, scenario.level);
  }
});

test('all inherited surfaces remain visible and the shield count is a detached read-only cue', () => {
  const { scenario, preview } = fixture(),
    run = createRun(scenario.level),
    before = authoritativeCheckpoint(run);
  assert(foundationCompatibleView(run));
  assert.equal(relayView(run).gates.length, 1);
  assert.equal(directionalView(run).cells.length, 25);
  assert.deepEqual(flightInformationSnapshot(run, { started: true, paused: false }).issues, []);
  const view = encounterView(run);
  assert.deepEqual(view.shields, { total: 2, captured: 0, remainingIds: ['west', 'east'] });
  assert(Object.isFrozen(view.shields.remainingIds));
  assert.match(view.instruction, /Shield relays 0 \/ 2/);
  assert.match(missionBriefing(run.level).copy, /all 2 shield relays/);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  run.objectives.find((o) => o.id === 'west').captured = true;
  assert.deepEqual(encounterView(run).shields, { total: 2, captured: 1, remainingIds: ['east'] });
  assert.equal(view.shields.captured, 0);
  const marker = preview.markers.actors.find((a) => a.id === 'sentinel');
  assert.match(
    contentActorDescription(preview.manifest.level, marker),
    /2 shield relays; 2s lane warning/,
  );
  const paths = ['relay-sentinel', 'lane-boss', 'contour-patrol', 'border-patrol'].map((type) => {
    const calls = [],
      ctx = new Proxy(
        {},
        {
          get:
            (_, method) =>
            (...args) =>
              calls.push([method, ...args]),
        },
      );
    traceContentActor(ctx, type, 0, 0, 5);
    return JSON.stringify(calls);
  });
  assert.equal(new Set(paths).size, 4);
  const ctx = new Proxy({}, { get: () => () => {} });
  assert.doesNotThrow(() => paintContentMap(ctx, preview));
  assert.doesNotThrow(() =>
    paintEditorMap({ width: 1152, height: 576, getContext: () => ctx }, scenario),
  );
});

test('geometry commands preserve the encounter edition and bindings; invalid dependency edits fail closed', () => {
  const { project, scenario } = fixture();
  const command = {
    expectedMap: dataIdentity(project.maps[0]),
    expectedMission: dataIdentity(project.missions[0]),
  };
  const arrow = editContentDirectional(project, 'nearby-shore', {
    ...command,
    action: 'replace',
    id: 'marked',
    zone: { x: 10, y: 2, w: 5, h: 5, direction: 'up' },
  });
  assert.equal(arrow.missions[0].format, 'MissionDesignV4');
  assert.deepEqual(arrow.missions[0].encounter, project.missions[0].encounter);
  assert.throws(
    () => editContentDirectional(project, 'nearby-shore', { ...command, action: 'enable' }),
    /already uses/,
  );
  const gate = editContentRelay(project, 'nearby-shore', {
    ...command,
    action: 'replace',
    id: 'shortcut',
    gate: { x: 40, y: 10, w: 2, h: 3, objectiveId: 'east' },
  });
  assert.equal(gate.missions[0].format, 'MissionDesignV4');
  assert.deepEqual(gate.missions[0].encounter, project.missions[0].encounter);
  assert.deepEqual(paintLevel(scenario.level, 'spawn', 31, 16).encounter, scenario.level.encounter);
  assert.throws(() => paintLevel(scenario.level, 'erase', 8, 8), /objective|missing/);
  assert.throws(() => paintLevel(scenario.level, 'wall', 10, 2), /overlap/);
});
