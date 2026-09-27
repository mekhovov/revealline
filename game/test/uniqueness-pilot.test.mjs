import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {
  createClassicUniquenessPilots,
  createHorizonVersusUniquenessPilot,
  createUniquenessPilotControls,
} from '../content-design/uniqueness-pilot.mjs';
import { CURRENT_ART_SOURCES } from '../presentation/current-art-sources.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { geometrySignature, normalizedGameplay } from '../../scripts/content-inventory.mjs';
import { probePilotOpening } from '../../scripts/uniqueness-pilot.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { AUTHORED_JOURNEY_ROUTE_IDS } from '../content-design/mode-href.mjs';
import {
  drawNeutralPilotBoard,
  resolveNeutralPilotRuntime,
} from '../content-design/uniqueness-pilot-player.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createCoop, startCoop } from '../coop/core.mjs';

test('pilot successors own new identities and leave current content and originals untouched', () => {
  const before = JSON.stringify(CURRENT_ART_SOURCES);
  const pilots = createClassicUniquenessPilots();
  assert.equal(pilots.length, 4);
  assert.equal(new Set(pilots.map(({ level }) => geometrySignature(level))).size, 4);
  for (const pilot of pilots) {
    assert.equal(pilot.classification, 'tooling');
    assert.equal(pilot.approval, 'pending-human-playtest');
    assert(pilot.level.id.startsWith('uniqueness-pilot-'));
    assert.equal(pilot.level.revision, 'greybox-1');
    assert(pilot.level.objectives.some((target) => target.required));
    assert(CURRENT_ART_SOURCES.some((row) => row.owner.levelId === pilot.brief.replaces));
    assert(!CURRENT_ART_SOURCES.some((row) => row.owner.levelId === pilot.level.id));
  }
  assert.equal(JSON.stringify(CURRENT_ART_SOURCES), before);
  assert.equal(DEFAULT_JOURNEY_ROUTES.solo, 'whole-spatial-v11');
  assert(!AUTHORED_JOURNEY_ROUTE_IDS.some((id) => id.includes('uniqueness-pilot')));
});

test('Horizon competitive pilot is a separate course with neutral art and exact unchanged controls', () => {
  const controls = createUniquenessPilotControls();
  const project = createHorizonVersusUniquenessPilot();
  assert.equal(project.assets.length, 0);
  assert.deepEqual(project.missions[0].modes, ['versus']);
  const candidate = resolveMission(compileContentProject(project), project.missions[0].id, {
    mode: 'versus',
  });
  assert.notDeepEqual(normalizedGameplay(candidate.level), normalizedGameplay(controls.solo.level));
  assert.notEqual(geometrySignature(candidate.level), geometrySignature(controls.solo.level));
  assert.equal(candidate.background, null);
  assert.equal(controls.solo.missionId, 'first-return');
  assert.equal(controls.team.missionId, 'twin-landings');
  assert.equal(controls.team.level.version, 'revealline-coop-level.v6');
});

test('every neutral pilot has repeatable recorded public-input first-return evidence without losses', async () => {
  const report = JSON.parse(
    await fs.readFile(new URL('../../docs/content-offline/pilot.json', import.meta.url)),
  );
  const source = createHorizonVersusUniquenessPilot();
  const levels = new Map(createClassicUniquenessPilots().map((row) => [row.id, row.level]));
  levels.set(
    source.missions[0].id,
    resolveMission(compileContentProject(source), source.missions[0].id, { mode: 'versus' }).level,
  );
  for (const pilot of report.pilots) {
    const proof = pilot.evidence.attempts.find((row) => row.closure && row.livesLost === 0);
    assert(proof, `${pilot.id} requires an actual first return before design review.`);
    const actual = probePilotOpening(levels.get(pilot.id), proof);
    assert.deepEqual(actual, proof);
    assert.equal(actual.replayVerified, true);
    assert(actual.coverage > 0);
    assert.match(pilot.evidence.scope, /full clear.*pending/);
  }
});

test('neutral player draws real pressure and cooperative state without mutating it', () => {
  const calls = [];
  const context = new Proxy(
    {},
    {
      get: (target, key) => target[key] ?? ((...args) => calls.push([key, ...args])),
      set: (target, key, value) => {
        target[key] = value;
        return true;
      },
    },
  );
  const classic = createRun(createClassicUniquenessPilots()[0].level, { seed: 17 });
  for (let tick = 0; tick < 90; tick++) stepRun(classic, { direction: 'down' }, FIXED_DT);
  const team = startCoop(createCoop(createUniquenessPilotControls().team.level, { seed: 17 }));
  for (const run of [classic, team]) {
    const before = JSON.stringify(run);
    drawNeutralPilotBoard(context, run);
    assert.equal(JSON.stringify(run), before);
  }
  assert(calls.some(([operation]) => operation === 'arc'));
  assert(
    calls.filter(([operation]) => operation === 'fillRect').length >=
      classic.cells.length + team.cells.length,
  );
});

test('neutral difficulty uses exact authored presets and historical Classic Gentle projection', () => {
  const classic = createClassicUniquenessPilots()[0];
  const baseline = JSON.stringify(classic.level);
  const gentle = resolveNeutralPilotRuntime(classic, 'gentle');
  const standard = resolveNeutralPilotRuntime(classic, 'standard');
  const expert = resolveNeutralPilotRuntime(classic, 'expert');
  assert(gentle.level.rules.lives > standard.level.rules.lives);
  assert(expert.level.enemies.length >= standard.level.enemies.length);
  assert.notDeepEqual(expert.level.enemies, standard.level.enemies);
  assert.equal(JSON.stringify(classic.level), baseline);
  const source = compileContentProject(createHorizonVersusUniquenessPilot());
  const id = source.source.missions[0].id;
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const resolved = resolveMission(source, id, { mode: 'versus', difficulty });
    const runtime = resolveNeutralPilotRuntime(
      {
        resolveLevel: (preset) =>
          resolveMission(source, id, { mode: 'versus', difficulty: preset }).level,
      },
      difficulty,
    );
    assert.deepEqual(runtime.sourceLevel, resolved.level);
    assert.equal(runtime.tuning.difficulty, difficulty);
  }
});
