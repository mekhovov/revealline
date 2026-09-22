import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createStarterProject } from '../content-design/starter.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { validateScenario } from '../content.mjs';
import {
  validatePack,
  preparePack,
  scenarioFromPack,
  resolvePackCampaign,
  emptyPackLibrary,
} from '../packs.mjs';
import { CLASSES, createRun, CELL } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { foundationCompatibleView } from '../ui/foundation-view.mjs';
import { relayView } from '../ui/relay-view.mjs';
import { directionalView, drawDirectionalFields } from '../ui/directional-view.mjs';
import { flightInformationSnapshot } from '../ui/flight-information-source.mjs';
import { missionBriefing } from '../mission-brief.mjs';
import {
  entryScenario,
  expansionFromScenario,
  prepareDocument,
  paintLevel,
  withScenarioMastery,
  withScenarioEncounter,
} from '../playground/model.mjs';
import { paintContentMap } from '../content-design/map-view.mjs';
import { paintEditorMap } from '../playground/board-view.mjs';

function fixture() {
  const project = createStarterProject();
  Object.assign(project.maps[0], {
    format: 'MapDesignV3',
    gates: [{ id: 'shortcut', x: 40, y: 10, w: 2, h: 3 }],
    speedZones: [{ id: 'marked-lane', x: 10, y: 2, w: 5, h: 8, direction: 'down' }],
  });
  Object.assign(project.missions[0], {
    format: 'MissionDesignV3',
    objectives: [{ id: 'relay', x: 20.5, y: 10.5, required: true }],
    relayLinks: [{ gateId: 'shortcut', objectiveId: 'relay' }],
  });
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

test('shared preview/import/export preserve explicit directional scenario and pack editions', async () => {
  const { preview, scenario } = fixture();
  assert.equal(scenario.format, 'xonix-playground.v8');
  assert.deepEqual(validateScenario(scenario).errors, []);
  assert.equal(validateScenario({ ...scenario, format: 'xonix-playground.v7' }).valid, false);
  const pack = expansionFromScenario(scenario);
  assert.equal(pack.format, 'xonix-pack.v8');
  assert.equal(pack.engine, 'xonix-core.v8');
  assert.deepEqual(validatePack(pack).errors, []);
  assert.equal(validatePack({ ...pack, format: 'xonix-pack.v7' }).valid, false);
  const prepared = await preparePack(pack),
    imported = scenarioFromPack(prepared.pack, scenario.level.id, scenario.level.id);
  assert.equal(imported.format, scenario.format);
  assert.deepEqual(imported.level.directionalFields, preview.manifest.level.directionalFields);
  assert.deepEqual(imported.level.relayGates, preview.manifest.level.relayGates);
  const edited = entryScenario(resolvePackCampaign(prepared.pack, scenario.level.id));
  assert.deepEqual(expansionFromScenario(edited).campaigns[0].levels[0], imported.level);
  assert.equal(withScenarioMastery(edited, null).format, scenario.format);
  assert.throws(() => withScenarioMastery(edited, {}), /mastery/i);
  assert.equal(withScenarioEncounter(edited, null).level.version, 'xonix-level.v7');
  for (const input of [scenario.level, pack]) {
    const result = await prepareDocument(input, {
      current: scenario,
      packLibrary: emptyPackLibrary(),
    });
    assert.equal(result.scenario.format, scenario.format);
    assert.deepEqual(result.scenario.level.directionalFields, scenario.level.directionalFields);
  }
});

test('editor changes preserve fields and relay links while rejecting conflicting new walls', () => {
  const { scenario } = fixture();
  const moved = paintLevel(scenario.level, 'spawn', 31, 16);
  assert.deepEqual(moved.directionalFields, scenario.level.directionalFields);
  assert.deepEqual(moved.relayGates, scenario.level.relayGates);
  assert.throws(() => paintLevel(scenario.level, 'wall', 10, 2), /overlap/);
  assert.throws(() => paintLevel(scenario.level, 'erase', 20, 10), /objective.*missing/);
});

test('directional cues are detached, hide reclaimed cells and restore immediately on reopening', () => {
  const { preview, scenario } = fixture(),
    run = createRun(scenario.level),
    before = authoritativeCheckpoint(run);
  assert(foundationCompatibleView(run));
  assert(relayView(run));
  assert.deepEqual(flightInformationSnapshot(run, { started: true, paused: false }).issues, []);
  const view = directionalView(run);
  assert.equal(view.cells.length, 40);
  assert.equal(view.fields[0].activeCells, 40);
  assert.deepEqual(view, preview.markers.directionalFields);
  assert(Object.isFrozen(view.cells[0]));
  assert.deepEqual(authoritativeCheckpoint(run), before);
  const index = 2 * 72 + 10;
  run.cells[index] = CELL.SAFE;
  assert.equal(directionalView(run).cells.length, 39);
  assert.equal(view.cells.length, 40);
  run.cells[index] = CELL.FIELD;
  assert.deepEqual(directionalView(run), view);
  const brief = missionBriefing(run.level, { classRecipes: CLASSES });
  assert.match(JSON.stringify(brief), /Arrow fields.*never forced drift/);
});

test('all arrows use static shape and two-tone outlines without altering canvas or simulation state', () => {
  const { preview, scenario } = fixture(),
    run = createRun(scenario.level),
    before = authoritativeCheckpoint(run),
    calls = [];
  const ctx = new Proxy(
    {},
    {
      get(target, key) {
        if (key in target) return target[key];
        return (...args) => {
          calls.push([key, ...args]);
        };
      },
    },
  );
  const view = directionalView(run);
  drawDirectionalFields(ctx, view);
  assert.equal(calls.filter((call) => call[0] === 'stroke').length, 80);
  assert.equal(calls.filter((call) => call[0] === 'save').length, 1);
  assert.equal(calls.filter((call) => call[0] === 'restore').length, 1);
  assert(!calls.some((call) => ['fillRect', 'drawImage', 'fillText'].includes(call[0])));
  assert.deepEqual(authoritativeCheckpoint(run), before);
  assert.doesNotThrow(() => paintContentMap(ctx, preview));
  assert.doesNotThrow(() =>
    paintEditorMap({ width: 1152, height: 576, getContext: () => ctx }, scenario),
  );
});

test('malformed directional views and accessors fail closed without executing imported getters', () => {
  const { scenario } = fixture();
  let reads = 0;
  for (const path of ['ruleset', 'cells', 'definition', 'zone']) {
    const run = createRun(scenario.level);
    const [object, key] =
      path === 'definition'
        ? [run.level, 'directionalFields']
        : path === 'zone'
          ? [run.level.directionalFields.zones[0], 'direction']
          : [run, path];
    Object.defineProperty(object, key, {
      enumerable: true,
      get() {
        reads++;
        return null;
      },
    });
    assert.equal(directionalView(run), null);
  }
  assert.equal(reads, 0);
  for (const change of [
    (run) => {
      run.width = 48;
    },
    (run) => {
      run.cells = Array.from(run.cells);
    },
    (run) => {
      run.level.directionalFields.zones[0].direction = 'invalid';
    },
    (run) => {
      run.level.directionalFields.zones[0].force = 1;
    },
    (run) => {
      run.level.directionalFields.zones.push({
        ...run.level.directionalFields.zones[0],
        id: 'overlap',
      });
    },
  ]) {
    const run = createRun(scenario.level);
    change(run);
    assert.equal(directionalView(run), null);
  }
  assert.equal(directionalView(null), null);
});
