import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import {
  prepareCombatAuthoring,
  setMissionCombatEnabled,
} from '../content-design/combat-authoring.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { journeyActors, compileActor, journeyCombatTiming } from '../content-design/catalogs.mjs';
import { inspectPressureDifficulty } from '../content-design/pressure-candidates.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { createMissionCard } from '../content-design/mission-card.mjs';
import { contentActorDescription, traceContentActor } from '../content-design/actor-marker.mjs';
import { captureOverlay } from '../content-design/capture-overlay.mjs';
import { createRun } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

function fixture(enabled = true) {
  const p = prepareCombatAuthoring(createStarterProject(), 'nearby-shore');
  p.difficultyCatalogId = 'journey-difficulty-v2';
  p.missions[0].combat.enabled = enabled;
  p.missions[0].actors.push(
    {
      id: 'scout-npc',
      role: 'optional-scout',
      tier: 'measured',
      x: 12.5,
      y: 10.5,
      heading: [1, 1],
    },
    {
      id: 'sentry-npc',
      role: 'optional-sentry',
      tier: 'standard',
      x: 45.5,
      y: 22.5,
      heading: [-1, 0],
    },
  );
  return p;
}

test('v8 inherits every historical recipe exactly and resolves optional speed/rest once', () => {
  const catalog = journeyActors('journey-actors-v8');
  for (let n = 1; n <= 7; n++) {
    const old = journeyActors(`journey-actors-v${n}`);
    for (const [id, role] of Object.entries(old.roles)) assert.deepEqual(catalog.roles[id], role);
    assert.equal(old.roles['optional-scout'], undefined);
  }
  for (const [difficulty, speedFactor, restFactor] of [
    ['gentle', 1, 1.25],
    ['standard', 1.4, 0.85],
    ['expert', 1.75, 0.65],
  ])
    for (const [tier, base] of [
      ['measured', 1.8],
      ['standard', 2.2],
      ['brisk', 2.6],
    ])
      for (const role of ['optional-scout', 'optional-sentry']) {
        const actor = compileActor(
          { id: 'npc', role, tier, x: 10.5, y: 10.5, heading: [1, -1] },
          difficulty,
          catalog.id,
          'journey-difficulty-v2',
        );
        assert.equal(actor.speed, base * speedFactor);
        assert.equal(actor.turnTicks, 120);
        assert.equal(actor.type, undefined);
        assert.equal(actor.headingY, -1);
        if (role === 'optional-sentry') {
          assert.equal(actor.restTicks, Math.round(1200 * restFactor));
          assert.equal(actor.warningTicks, 180);
          assert.equal(actor.openingTicks, 480);
          assert.equal(actor.recoveryTicks, 180);
          assert.equal(actor.shotSpeed, 8);
          assert.equal(actor.shotLifeTicks, 360);
        } else assert.equal(actor.restTicks, undefined);
      }
  assert.throws(() => journeyCombatTiming('field-keeper'), /registered optional/);
});

test('compiler separates explicit combat population, preserves ordinary identity and matches paired race', () => {
  const p = fixture(),
    before = structuredClone(p),
    project = compileContentProject(p);
  for (const difficulty of ['gentle', 'standard', 'expert']) {
    const a = resolveMission(project, 'nearby-shore', { difficulty });
    const b = resolveMission(project, 'nearby-shore', { difficulty, mode: 'versus' });
    assert.deepEqual(a.level, b.level);
    assert.equal(a.simulationIdentity, b.simulationIdentity);
    assert.deepEqual(
      a.level.enemies.map((e) => e.id),
      ['keeper'],
    );
    assert.deepEqual(
      a.level.classic.combatPatrols.actors.map((e) => e.id),
      ['scout-npc', 'sentry-npc'],
    );
    assert.equal(a.level.classic.enemyPressure, undefined);
    assert.equal(a.level.classic.lineImpact, undefined);
    assert.equal(a.officialProgressEligible, false);
    assert(a.diagnostics.some((d) => d.code === 'candidate-combat-not-presentation-qualified'));
    const off = resolveMission(
      compileContentProject(setMissionCombatEnabled(p, 'nearby-shore', false)),
      'nearby-shore',
      { difficulty },
    );
    assert.deepEqual(off.level.classic.combatPatrols.actors, a.level.classic.combatPatrols.actors);
    assert.deepEqual(off.level.enemies, a.level.enemies);
    assert.notEqual(off.simulationIdentity, a.simulationIdentity);
  }
  assert.deepEqual(p, before);
});

test('combat is additive across mission geometry editions and the total actor budget remains shared', () => {
  for (const version of [1, 2, 3, 4]) {
    const p = fixture();
    p.missions[0].format = `MissionDesignV${version}`;
    if (version >= 2) {
      p.maps[0].format = version === 2 ? 'MapDesignV2' : 'MapDesignV3';
      p.maps[0].gates = [];
      p.missions[0].relayLinks = [];
    }
    if (version >= 3) p.maps[0].speedZones = [];
    if (version === 4) p.missions[0].encounter = null;
    const level = resolveMission(compileContentProject(p), 'nearby-shore').level;
    assert.equal(level.version, `xonix-level.v${version + 4}`);
    assert.equal(level.enemies.length, 1);
    assert.equal(level.classic.combatPatrols.actors.length, 2);
  }
  const p = fixture(false);
  for (let i = 0; i < 22; i++)
    p.missions[0].actors.push({
      id: `extra-${i}`,
      role: 'optional-scout',
      tier: 'measured',
      x: 3.5 + i * 2,
      y: 3.5,
      heading: [1, 0],
    });
  assert.throws(() => compileContentProject(p), /actors exceeds/);
});

test('missing flags, unknown fields, arbitrary physics, invalid disabled placement and Team combat fail closed', () => {
  for (const change of [
    (p) => {
      delete p.missions[0].combat;
    },
    (p) => {
      p.missions[0].combat = null;
    },
    (p) => {
      p.missions[0].combat.version = 'later';
    },
    (p) => {
      delete p.missions[0].combat.enabled;
    },
    (p) => {
      p.missions[0].combat.enabled = 'false';
    },
    (p) => {
      p.missions[0].combat.extra = true;
    },
    (p) => {
      p.actorCatalogId = 'journey-actors-v7';
    },
    (p) => {
      p.missions[0].actors[1].speed = 1;
    },
    (p) => {
      p.missions[0].actors[2].warningTicks = 1;
    },
    (p) => {
      p.missions[0].actors[1].x = 32.5;
      p.missions[0].actors[1].y = 17.5;
    },
    (p) => {
      p.missions[0].actors[1].role = 'optional-unknown';
    },
  ]) {
    const p = fixture(false);
    change(p);
    assert.throws(() => compileContentProject(p), undefined, change.toString());
  }
  for (const enabled of [true, false]) {
    const team = createTeamOpeningCandidates();
    team.actorCatalogId = 'journey-actors-v8';
    team.missions[0].combat = { version: 'mission-combat.v1', enabled };
    assert.throws(() => compileContentProject(team), /not qualified for Team/);
  }
});

test('pressure report keeps disabled authored speeds explicit without reporting active combat pressure', () => {
  const source = fixture(false),
    report = inspectPressureDifficulty(source);
  assert.equal(report.rows.length, 6);
  for (const row of report.rows) {
    const npc = row.actors.find((a) => a.id === 'sentry-npc');
    assert.equal(npc.combatEnabled, false);
    assert.equal(npc.activeSpeed, 0);
    assert(npc.speed > 0);
    assert.equal(npc.retainsField, false);
    assert.equal(npc.combatTiming.warningTicks, 180);
    assert.equal(npc.laneTiming, null);
    assert.equal(row.actors[0].combatTiming, undefined);
  }
  const on = inspectPressureDifficulty(setMissionCombatEnabled(source, 'nearby-shore', true));
  assert(
    on.rows.every((r) =>
      r.actors.filter((a) => a.combatEnabled).every((a) => a.activeSpeed === a.speed),
    ),
  );
});

test('frozen capture overlay removes non-retaining scout without changing state; disabled actors remain authored', () => {
  const p = fixture(),
    preview = prepareContentPreview(p, 'nearby-shore', {
      trailCells: Array.from({ length: 34 }, (_, n) => (n + 1) * 72 + 40),
    });
  assert.deepEqual(preview.capture.affectedCombatIds, ['scout-npc']);
  assert(!preview.capture.components.some((c) => c.enemyIds.some((id) => id.endsWith('-npc'))));
  assert.match(captureOverlay(preview).summary, /Would-remove optional actors: scout-npc/);
  assert.deepEqual(
    preview.markers.actors.map((a) => a.type),
    ['bouncer', 'optional-scout', 'optional-sentry'],
  );
  const run = createRun(preview.manifest.level),
    before = authoritativeCheckpoint(run);
  inspectCaptureSnapshot(run, { trailCells: preview.capture.securedTrail });
  assert.deepEqual(authoritativeCheckpoint(run), before);
  const off = prepareContentPreview(fixture(false), 'nearby-shore');
  assert.deepEqual(off.capture.affectedCombatIds, []);
  assert(off.markers.actors.slice(1).every((a) => a.inactive));
  assert.match(
    contentActorDescription(off.manifest.level, off.markers.actors[2]),
    /inactive authored optional sentry/,
  );
  const card = createMissionCard(off.manifest);
  assert.equal(card.actors.length, 3);
  assert(card.actors.slice(1).every((a) => a.inactive));
});

test('active optional actors in initially empty chambers get honest auto-fill diagnostics', () => {
  const p = fixture();
  p.maps[0].foundations.push({ x: 40, y: 1, w: 1, h: 34 });
  const m = resolveMission(compileContentProject(p), 'nearby-shore');
  const warning = m.topology.diagnostics.find((d) => d.code === 'combat-auto-fill-removal');
  assert.deepEqual(warning.actorIds, ['scout-npc']);
  assert.equal(warning.severity, 'warning');
});

test('enabled gameplay preview cannot launch invisible hazards; static preview remains exact', () => {
  const p = fixture();
  assert.throws(
    () => prepareContentPreview(p, 'nearby-shore', { theme: { id: 'horizon' } }),
    /qualified actor\/projectile presentation/,
  );
  assert.equal(
    prepareContentPreview(p, 'nearby-shore').manifest.level.classic.combatPatrols.enabled,
    true,
  );
  const off = fixture(false);
  // This deliberately incomplete theme reaches ordinary theme validation, not the combat guard.
  assert.throws(
    () => prepareContentPreview(off, 'nearby-shore', { theme: { id: 'horizon' } }),
    (e) => !/qualified actor\/projectile presentation/.test(e.message),
  );
});

test('authoring silhouettes distinguish scout, sentry and retaining keeper without colour', () => {
  const paths = {};
  for (const type of ['optional-scout', 'optional-sentry', 'bouncer']) {
    const calls = [];
    const ctx = new Proxy(
      {},
      {
        get:
          (_, key) =>
          (...args) =>
            calls.push([key, ...args]),
      },
    );
    traceContentActor(ctx, type, 20, 20, 5);
    paths[type] = calls;
  }
  assert.notDeepEqual(paths['optional-scout'], paths['optional-sentry']);
  assert.notDeepEqual(paths['optional-scout'], paths.bouncer);
  assert(paths.bouncer.some(([name]) => name === 'arc'));
  assert(paths['optional-sentry'].every(([name]) => name === 'rect'));
});
