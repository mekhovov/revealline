import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as core from '../game/core/index.mjs';
import * as replay from '../game/replay.mjs';
import { createActorPresentation } from '../game/ui/actor-presentation.mjs';
import { BoardPainter } from '../game/ui/render.mjs';
import { createFractureCandidates } from '../game/content-design/fracture-candidates.mjs';
import { compileContentProject, resolveMission } from '../game/content-design/project.mjs';
import { earnedRasterProtocol } from './solo-earned-raster-protocol.mjs';
import {
  bindRasterJob,
  validateRasterPlan,
  earnedRasterAssessment,
  EARNED_RASTER_PROTOCOL,
  EARNED_RASTER_CASES,
  EARNED_RASTER_STAGES,
  EARNED_RASTER_CHECKPOINTS,
} from './solo-remote-raster.mjs';
const fixturePath =
  'docs/performance/fixtures/solo-representative/first-fracture-earned-raster.fixture';
const fixtureBytes = await readFile(new URL('../' + fixturePath, import.meta.url));
const fixture = JSON.parse(fixtureBytes);
const source = 'cce49c81d82b79aefc24898f32eeebc609e569fb';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('earned fixture is the accepted standard First Fracture level and exact existing legal route', async () => {
  const accepted = JSON.parse(
    await readFile(
      new URL(
        '../docs/performance/fixtures/solo-representative/first-fracture.xonix.fixture',
        import.meta.url,
      ),
    ),
  );
  const routes = JSON.parse(
    await readFile(new URL('../game/test/fixtures/fracture-clear-routes.json', import.meta.url)),
  );
  const route = routes.sets
    .find((r) => r.difficulty === 'standard' && r.turnPolicy === 'immediate')
    .rows.find((r) => r[0] === 'first-fracture');
  const manifest = resolveMission(
    compileContentProject(createFractureCandidates()),
    'first-fracture',
    { difficulty: 'standard' },
  );
  assert.deepEqual(fixture.level, accepted.level);
  assert.deepEqual(fixture.level, manifest.level);
  assert.equal(fixture.simulationIdentity, manifest.simulationIdentity);
  assert.deepEqual(
    [fixture.level.id, fixture.simulationIdentity, fixture.checkpoint, fixture.segments],
    route,
  );
  assert.equal(fixtureBytes.length, 3425);
  assert.equal(
    hash(fixtureBytes),
    'f645e2f2d07571e0a5423ab15ec72f365e5658fea6dc844bb30934411daf119d',
  );
  assert.deepEqual(
    fixture.stages.map((r) => r.name),
    EARNED_RASTER_STAGES,
  );
  assert.deepEqual(
    fixture.stages.map((r) => [r.tick, r.checkpoint]),
    EARNED_RASTER_CHECKPOINTS,
  );
});

test('same protocol body proves all seven legal states and strict native-core replay without repair invention', async () => {
  const proof = await earnedRasterProtocol({ fixture, modelOnly: true }, { core, replay });
  assert.equal(proof.ticks, 3570);
  assert.equal(proof.finalCheckpoint.hash, '4e10c76cdb1ad249');
  assert.equal(proof.replay.match, true);
  assert.deepEqual(proof.mechanics, { closures: 5, erosions: 3, warnings: 4, repairedCells: [] });
  assert.equal(proof.repair, 'unobserved-no-eroded-cell-recapture-on-this-route');
  assert.equal(
    proof.stages
      .find((r) => r.name === 'post-erosion')
      .events.find((e) => e.type === 'cells.eroded').indices[0],
    611,
  );
  assert.equal(
    proof.stages.find((r) => r.name === 'post-capture').events.find((e) => e.type === 'cut.closed')
      .cells,
    520,
  );
  const native = replay.verifyReplay(proof.recording);
  assert.equal(native.match, true);
  assert.equal(replay.authoritativeCheckpoint(native.state).hash, fixture.checkpoint);
});

test('changed source state, checkpoint, input, count or tick bounds cannot reuse the earned proof', async () => {
  for (const mutate of [
    (f) => {
      f.stages[1].checkpoint = '0'.repeat(16);
    },
    (f) => {
      f.level.spawn.x++;
    },
    (f) => {
      f.segments[0][0] = 'patch-cell';
    },
    (f) => {
      f.segments[0][1] = 1001;
    },
    (f) => {
      f.ticks = 3600;
    },
  ]) {
    const changed = structuredClone(fixture);
    mutate(changed);
    await assert.rejects(
      earnedRasterProtocol({ fixture: changed, modelOnly: true }, { core, replay }),
    );
  }
});

test('rebuilt-cache controls require the same paused actor history as populated subjects', () => {
  const state = core.createRun(fixture.level, fixture.options),
    subject = createActorPresentation(),
    control = createActorPresentation();
  const samples = [];
  const draw = (owner) =>
    owner.sample(state.enemies, {
      tick: state.tick,
      time: state.time,
      paused: true,
      dt: 0,
      themeId: 'ukraine',
    });
  const capture = () => {
    if (!fixture.stages.some((stage) => stage.tick === state.tick)) return;
    const checkpoint = replay.authoritativeCheckpoint(state);
    draw(subject);
    const a = draw(subject);
    const owner = {
      paintRevision: 0,
      layers: new Map(),
      actorPresentation: control,
      cellSnapshot: new Uint8Array([1]),
      cellRuns: [1],
      preparedPicture: {},
    };
    BoardPainter.prototype.invalidate.call(owner);
    assert.equal(
      owner.actorPresentation,
      control,
      'Cache rebuild preserves cosmetic history owner',
    );
    assert.equal(owner.cellSnapshot, null);
    assert.equal(owner.preparedPicture, null);
    draw(control);
    const b = draw(control);
    assert.deepEqual([...a], [...b], 'Matched legal draw history must preserve every actor frame');
    assert.deepEqual(replay.authoritativeCheckpoint(state), checkpoint);
    const unmatched = draw(createActorPresentation());
    samples.push({
      tick: state.tick,
      mismatch: [...a].some(([id, frame]) => frame.heading !== unmatched.get(id).heading),
    });
  };
  capture();
  for (const [direction, count] of fixture.segments)
    for (let i = 0; i < count; i++) {
      core.stepRun(state, { direction }, core.FIXED_DT);
      capture();
    }
  assert.equal(
    samples.find((row) => row.tick === 1213).mismatch,
    true,
    'The rejected fresh-painter proposal really differs before any cache claim',
  );
  assert.equal(replay.authoritativeCheckpoint(state).hash, fixture.checkpoint);
});

async function manifest() {
  const value = JSON.parse(
    await readFile(new URL('../docs/performance/solo-remote-raster-plan.json', import.meta.url)),
  );
  value.candidate.revision = source;
  value.candidate.tree = '71f7e4cb3b0a39c1d281635774371a693794dd22';
  value.release.candidateRevision = source;
  value.raster.protocol = EARNED_RASTER_PROTOCOL;
  value.raster.cases = EARNED_RASTER_CASES;
  value.raster.conditionalLocalization = false;
  value.raster.primitiveInputs = {};
  value.raster.fixture = {
    path: fixturePath,
    bytes: fixtureBytes.length,
    sha256: hash(fixtureBytes),
  };
  const path = 'scripts/solo-earned-raster-protocol.mjs',
    bytes = await readFile(new URL('../' + path, import.meta.url));
  value.frozenTools.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  return value;
}
test('earned admission is explicit and retains historical diagnostic exclusion, exact source and all old caps', async () => {
  const plan = bindRasterJob(await manifest(), 'raster-chromium');
  assert.equal(plan.release.firstEightAllCorrectnessPassed, false);
  assert.equal(plan.raster.observationTimeoutMs, 120000);
  assert.equal(plan.rowEvidenceBytes, 128 * 1024 ** 2);
  for (const mutate of [
    (p) => {
      p.raster.protocol = 'other';
    },
    (p) => {
      delete p.raster.protocol;
    },
    (p) => {
      p.candidate.revision = '3adcd53792043ef02459e86168c6b33a66d6ef00';
      p.release.candidateRevision = p.candidate.revision;
    },
    (p) => {
      p.candidate.tree = 'a'.repeat(40);
    },
    (p) => {
      p.raster.fixture.sha256 = 'a'.repeat(64);
    },
    (p) => {
      p.raster.primitiveInputs = { atlasUploads: [] };
    },
    (p) => {
      p.raster.cases.pop();
    },
    (p) => {
      p.raster.pixelTolerance = 1;
    },
    (p) => {
      p.raster.retryCount = 1;
    },
    (p) => {
      p.raster.observationTimeoutMs++;
    },
    (p) => {
      p.frozenTools = p.frozenTools.filter(
        (r) => !r.path.endsWith('solo-earned-raster-protocol.mjs'),
      );
    },
  ]) {
    const changed = structuredClone(plan);
    mutate(changed);
    assert.throws(() => validateRasterPlan(changed));
  }
});

const closed = { status: 'closed', exitCode: 0, survivors: [], ambiguous: [] };
function observed() {
  return {
    format: 'SoloHostedEarnedNativeRasterV1',
    protocol: EARNED_RASTER_PROTOCOL,
    sourceRevision: source,
    engine: 'webkit',
    status: 'automated-invariants-pass-visual-review-pending',
    primary: {
      clean: true,
      notObserved: [],
      invariantFailures: [],
      earnedProof: {
        ticks: 3570,
        finalCheckpoint: { hash: fixture.checkpoint },
        replay: { match: true, status: 'won', checkpoint: { hash: fixture.checkpoint } },
        mechanics: { closures: 5, erosions: 3, warnings: 4, repairedCells: [] },
        repair: 'unobserved-no-eroded-cell-recapture-on-this-route',
      },
      cases: EARNED_RASTER_CASES.map((row, index) => ({
        ...row,
        tick: EARNED_RASTER_CHECKPOINTS[index % 7][0],
        checkpoint: { hash: EARNED_RASTER_CHECKPOINTS[index % 7][1] },
        owners: [Math.floor(index / 7) * 10 + 1, Math.floor(index / 7) * 10 + 2],
        controls: Object.fromEntries(
          ['stableA', 'deterministicA', 'populatedMatchesRebuiltA', 'populatedMatchesRebuiltB'].map(
            (key) => [key, { equal: true, changedChannels: 0 }],
          ),
        ),
        concealmentStatus: 'observed',
        hidden: { samples: 2000, changed: 0 },
        exposed: { samples: 2000, changed: 1900 },
        exposedRequired: index % 7 !== 0,
        presentationSeconds: 0,
        manualInvalidation: false,
        controlHistory: {
          precedingDraws: (index % 7) * 2,
          independentRepeats: [(index % 7) * 2, (index % 7) * 2],
          controlOnlyInvalidation: true,
        },
      })),
    },
  };
}
test('earned verdict rejects inaccurate strict pixels, ownership, replay or stage labels without weakening the old Mac failure', () => {
  assert.equal(earnedRasterAssessment(observed(), closed, source, 'webkit').status, 'passed');
  for (const mutate of [
    (r) => {
      r.primary.earnedProof.replay.match = false;
    },
    (r) => {
      r.primary.earnedProof.finalCheckpoint.hash = 'a'.repeat(16);
    },
    (r) => {
      r.primary.earnedProof.mechanics.erosions = 0;
    },
    (r) => {
      r.primary.earnedProof.repair = 'passed';
    },
    (r) => {
      r.primary.cases[4].tick++;
    },
    (r) => {
      r.primary.cases[4].controls.populatedMatchesRebuiltA.equal = false;
    },
    (r) => {
      r.primary.cases[4].hidden.changed = 1;
    },
    (r) => {
      r.primary.cases[4].exposed.changed = 0;
    },
    (r) => {
      r.primary.cases[4].owners[0]++;
    },
    (r) => {
      r.primary.cases[4].manualInvalidation = true;
    },
    (r) => {
      r.primary.cases[4].controlHistory.precedingDraws = 0;
    },
    (r) => {
      r.primary.cases[4].controlHistory.controlOnlyInvalidation = false;
    },
    (r) => {
      r.primary.cases[4].presentationSeconds = 0.1;
    },
    (r) => {
      r.primary.cases.pop();
      r.primary.notObserved.push({});
    },
  ]) {
    const raw = observed();
    mutate(raw);
    const verdict = earnedRasterAssessment(raw, closed, source, 'webkit');
    assert.equal(verdict.status, 'failed');
    assert.equal(verdict.historicalMacFailure, 'retained-unresolved');
    assert.equal(verdict.performanceQualification, 'excluded');
  }
  assert.equal(
    earnedRasterAssessment(observed(), { ...closed, forcedCleanup: true }, source, 'webkit').status,
    'failed',
  );
});
