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
import { CLASSES, createRun } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { foundationCompatibleView } from '../ui/foundation-view.mjs';
import { classicView } from '../ui/classic-view.mjs';
import { flightInformationSnapshot, flightEventKind } from '../ui/flight-information-source.mjs';
import { relayView, drawRelayGates } from '../ui/relay-view.mjs';
import { openCapturedRelays } from '../core/relay-gates.mjs';
import { captureOverlay } from '../content-design/capture-overlay.mjs';
import { missionBriefing } from '../mission-brief.mjs';
import {
  entryScenario,
  expansionFromScenario,
  prepareDocument,
  paintLevel,
  withScenarioMastery,
  withScenarioEncounter,
} from '../playground/model.mjs';

function fixture() {
  const project = createStarterProject();
  project.maps[0].format = 'MapDesignV2';
  project.maps[0].gates = [{ id: 'shortcut', x: 40, y: 10, w: 2, h: 3 }];
  project.missions[0].format = 'MissionDesignV2';
  project.missions[0].objectives = [{ id: 'relay', x: 20.5, y: 10.5, required: true }];
  project.missions[0].relayLinks = [{ gateId: 'shortcut', objectiveId: 'relay' }];
  const theme = JSON.parse(
    readFileSync(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
  ).themes[0];
  const preview = prepareContentPreview(project, 'nearby-shore', { theme });
  const scenario = { ...preview.scenario, classRecipes: structuredClone(CLASSES) };
  return { project, preview, scenario };
}

test('Studio preview and scenario/pack import preserve explicit relay editions and links', async () => {
  const { preview, scenario } = fixture();
  assert.equal(scenario.format, 'xonix-playground.v7');
  assert.equal(validateScenario(scenario).valid, true);
  assert.equal(validateScenario({ ...scenario, format: 'xonix-playground.v6' }).valid, false);
  const pack = expansionFromScenario(scenario);
  assert.equal(pack.format, 'xonix-pack.v7');
  assert.equal(pack.engine, 'xonix-core.v7');
  assert.deepEqual(validatePack(pack).errors, []);
  assert.equal(validatePack({ ...pack, format: 'xonix-pack.v6' }).valid, false);
  const prepared = await preparePack(pack);
  const imported = scenarioFromPack(prepared.pack, scenario.level.id, scenario.level.id);
  assert.equal(imported.format, scenario.format);
  assert.deepEqual(imported.level.relayGates, preview.manifest.level.relayGates);
  const edited = entryScenario(resolvePackCampaign(prepared.pack, scenario.level.id));
  assert.equal(edited.format, scenario.format);
  assert.deepEqual(expansionFromScenario(edited).campaigns[0].levels[0], imported.level);
  assert.equal(withScenarioMastery(edited, null).format, scenario.format);
  assert.equal(withScenarioEncounter(edited, null).level.version, 'xonix-level.v6');
});

test('validated map editing retains gate dependencies and refuses destructive objective erasure', async () => {
  const { scenario } = fixture();
  const moved = paintLevel(scenario.level, 'spawn', 31, 16);
  assert.deepEqual(moved.spawn, { x: 31.5, y: 16.5 });
  assert.deepEqual(moved.relayGates, scenario.level.relayGates);
  assert.throws(() => paintLevel(scenario.level, 'spawn', 40, 10), /permanent/);
  assert.throws(() => paintLevel(scenario.level, 'erase', 20, 10), /objective.*missing/);
  const imported = await prepareDocument(moved, { current: scenario });
  assert.equal(imported.scenario.format, scenario.format);
  assert.deepEqual(imported.scenario.level.relayGates, moved.relayGates);
  const fromPack = await prepareDocument(expansionFromScenario(scenario), {
    current: scenario,
    packLibrary: emptyPackLibrary(),
  });
  assert.equal(fromPack.kind, 'expansion');
  assert.deepEqual(fromPack.scenario.level.relayGates, moved.relayGates);
});

test('relay visual compatibility preserves authoritative identity and rejects hostile accessors', () => {
  const { scenario } = fixture(),
    run = createRun(scenario.level),
    before = authoritativeCheckpoint(run);
  assert.equal(classicView(run), null);
  assert(foundationCompatibleView(run));
  assert.equal(run.ruleset, 'xonix-core.v7');
  assert.deepEqual(flightInformationSnapshot(run, { started: true, paused: false }).issues, []);
  assert.equal(flightEventKind('relay.opened'), 'ordinary');
  assert.deepEqual(authoritativeCheckpoint(run), before);
  let reads = 0;
  const descriptors = Object.getOwnPropertyDescriptors(run);
  descriptors.ruleset = {
    enumerable: true,
    get() {
      reads++;
      throw new Error('No getter');
    },
  };
  assert.equal(foundationCompatibleView(Object.create(null, descriptors)), null);
  assert.equal(reads, 0);
});

test('relay projection is immutable and gate state changes the pattern, not collision or authority', () => {
  const { scenario, preview } = fixture(),
    run = createRun(scenario.level);
  const closed = relayView(run),
    before = authoritativeCheckpoint(run);
  assert.equal(closed.gates[0].opened, false);
  assert(Object.isFrozen(closed.gates[0]));
  assert.deepEqual(preview.markers.gates, closed.gates);
  assert.match(captureOverlay(preview).summary, /6 reserved gate cells never count/);
  assert.match(missionBriefing(scenario.level).copy, /Closed gates block cuts/);
  const draw = (view) => {
    const calls = [];
    const ctx = new Proxy(
      {},
      {
        get:
          (_target, op) =>
          (...args) =>
            calls.push({ op, args }),
      },
    );
    drawRelayGates(ctx, view, scenario.theme.palette);
    assert.equal(calls.filter((c) => c.op === 'save').length, 1);
    assert.equal(calls.filter((c) => c.op === 'restore').length, 1);
    assert(!calls.some((c) => c.op === 'fillRect' || c.op === 'fill'));
    return calls;
  };
  const closedCalls = draw(closed);
  assert.deepEqual(authoritativeCheckpoint(run), before);
  run.objectives[0].captured = true;
  openCapturedRelays(run);
  const after = authoritativeCheckpoint(run),
    opened = relayView(run);
  assert.equal(opened.gates[0].opened, true);
  assert.equal(closed.gates[0].opened, false);
  const openCalls = draw(opened);
  assert(
    closedCalls.filter((c) => c.op === 'lineTo').length >
      openCalls.filter((c) => c.op === 'lineTo').length,
  );
  assert.deepEqual(authoritativeCheckpoint(run), after);
});

test('malformed or getter-backed relay display state is rejected without evaluation', () => {
  const { scenario } = fixture();
  for (const change of [
    (run) => {
      run.relay.gates[0].cells[0]++;
    },
    (run) => {
      run.relay.gates[0].openedTick = -1;
    },
    (run) => {
      run.relay.gates.push(structuredClone(run.relay.gates[0]));
    },
    (run) => {
      run.level.relayGates.gates[0].w = 10000;
    },
    (run) => {
      run.level.relayGates.version = 'relay-gates.v2';
    },
  ]) {
    const run = createRun(scenario.level);
    change(run);
    assert.equal(relayView(run), null);
  }
  let reads = 0;
  const run = createRun(scenario.level);
  Object.defineProperty(run.relay.gates[0], 'openedTick', {
    get() {
      reads++;
      throw new Error('No getter');
    },
  });
  assert.equal(relayView(run), null);
  assert.equal(reads, 0);
  assert.equal(relayView(null), null);
});
