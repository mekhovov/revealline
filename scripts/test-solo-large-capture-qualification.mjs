import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import vm from 'node:vm';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../game/core/index.mjs';
import {
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
  authoritativeCheckpoint,
} from '../game/replay.mjs';
import { jammerPictureStrength } from '../game/ui/jammer-picture.mjs';
import { combatView } from '../game/ui/combat-view.mjs';
import { inspectReplayMechanics } from './solo-qualification-replay-core.mjs';
import { validateQualification } from './solo-qualification.mjs';

const root = new URL('../docs/performance/fixtures/solo-representative/', import.meta.url);
const read = async (name) => JSON.parse(await readFile(new URL(name, root)));
const fixture = await read('first-fracture-large-capture.qualification.fixture');
const original = await read('first-fracture.qualification.fixture');
const upload = await read('first-fracture.xonix.fixture');
const witness = await read('replay-core-before-large-capture.fixture');
const dependencies = {
  createRun,
  stepRun,
  releaseInputs,
  FIXED_DT,
  verifyReplay,
  authoritativeCheckpoint,
  jammerPictureStrength,
  combatView,
};
const definition = fixture.expectedReplayDefinition;
const keys = fixture.actions.filter(({ type }) => type === 'key');
function record(actions = keys, delta = () => 0) {
  const options = { ...definition.options, seed: 1 };
  const run = createRun(definition.level, options);
  const recorder = createRecorder(definition.level, options);
  for (const [index, action] of actions.entries()) {
    const input = { direction: action.key.slice(5).toLowerCase() };
    const ticks = Math.round((action.ms * 120) / 1000) + delta(index);
    for (let tick = 0; tick < ticks; tick++) {
      assert.equal(run.status, 'running');
      recordInput(recorder, input);
      stepRun(run, input, FIXED_DT);
      assert.equal(run.lives, 3, 'A recovery teleport must not substitute for steering');
    }
  }
  assert.equal(run.status, 'running');
  return exportReplay(recorder, run);
}
const nominal = record();
const inspect = (replay, requirements = fixture.replayRequirements, deps = dependencies) =>
  inspectReplayMechanics(replay, requirements, deps, definition);

test('large-capture timing uses the existing public upload and a distinct complete workload', () => {
  validateQualification(fixture);
  assert.equal(fixture.timeoutMs, original.timeoutMs);
  assert.deepEqual(definition, original.expectedReplayDefinition);
  assert.deepEqual(definition.level, upload.level);
  assert.equal(upload.settings.seed, 1);
  assert.equal(keys.length, 30);
  assert.deepEqual(fixture.replayRequirements, {
    closures: 3,
    eroded: 1,
    directionChangesWithMovement: 20,
    maximumCaptureCells: 600,
  });
  const restored = structuredClone(fixture.actions);
  restored.splice(
    restored.indexOf(restored.find(({ type }) => type === 'key')),
    keys.length,
    ...original.actions.filter(({ type, ms }) => type === 'key' || (type === 'wait' && ms)),
  );
  assert.deepEqual(restored, original.actions);
  for (const invalid of [-1, 0, 0.1, NaN, Infinity, 1000001]) {
    const changed = structuredClone(fixture);
    changed.replayRequirements.maximumCaptureCells = invalid;
    assert.throws(() => validateQualification(changed));
  }
});

test('single-capture evidence cannot be replaced by cumulative coverage from two smaller closures', () => {
  const two = record(keys.slice(0, 2));
  const result = inspect(two, { closures: 2, maximumCaptureCells: 500 });
  assert.equal(result.match, true);
  assert.equal(result.features.maximumClaimedCells, 504);
  assert.equal(result.features.maximumCaptureCells, 492);
  assert.equal(result.status, 'fail');
  const full = inspect(nominal);
  assert.equal(full.features.maximumCaptureCells, 748);
  assert.equal(full.status, 'pass');
});

test('undeclared inspection remains byte-equivalent to the exact executed 2c function', () => {
  assert.equal(witness.revision, '2c519bfe94b6364a57c71ba40b7212c71f0994ab');
  assert.equal(witness.path, 'scripts/solo-qualification-replay-core.mjs');
  assert.equal(witness.bytes, Buffer.byteLength(witness.utf8));
  assert.equal(witness.sha256, '1e96e592ee289685607515bbe14c8845f2c03dc81191a0772071fd9995ceb3ea');
  assert.equal(createHash('sha256').update(witness.utf8).digest('hex'), witness.sha256);
  const old = vm.runInNewContext(
    witness.utf8.replace(
      'export function inspectReplayMechanics',
      'function inspectReplayMechanics',
    ) + '\ninspectReplayMechanics;',
  );
  for (const requirements of [{}, { closures: 3, eroded: 1 }, { maximumClaimedCells: 1200 }]) {
    assert.equal(
      JSON.stringify(inspect(nominal, requirements)),
      JSON.stringify(old(nominal, requirements, dependencies, definition)),
    );
    assert.equal(
      Object.hasOwn(inspect(nominal, requirements).features, 'maximumCaptureCells'),
      false,
    );
  }
});

test('serialized native inspector shares the exact declared feature and strict replay boundary', () => {
  const native = vm.runInNewContext(`(${inspectReplayMechanics.toString()})`);
  assert.equal(
    JSON.stringify(native(nominal, fixture.replayRequirements, dependencies, definition)),
    JSON.stringify(inspect(nominal)),
  );
  const altered = structuredClone(nominal);
  altered.segments[0].ticks++;
  assert.throws(() => inspect(altered));
  const rejected = inspect(nominal, fixture.replayRequirements, {
    ...dependencies,
    verifyReplay: () => ({ match: false, diagnostics: [], actual: { checkpoint: null } }),
    createRun: () => assert.fail('Rejected replay must not be reconstructed'),
  });
  assert.equal(rejected.features, null);
  assert.equal(rejected.status, 'fail');
});

test('declared capture observation fails closed for invalid event counts and accepts zero without credit', () => {
  const withCount = (count) => ({
    ...dependencies,
    stepRun(run, input, dt) {
      stepRun(run, input, dt);
      for (const event of run.events) if (event.type === 'cut.closed') event.cells = count;
    },
  });
  for (const invalid of [undefined, null, -1, 0.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])
    assert.throws(
      () => inspect(nominal, fixture.replayRequirements, withCount(invalid)),
      /Capture event has no valid individual cell count/,
    );
  const zero = inspect(nominal, fixture.replayRequirements, withCount(0));
  assert.equal(zero.match, true);
  assert.equal(zero.features.maximumCaptureCells, 0);
  assert.equal(zero.status, 'fail');
});

const patterns = [
  ['nominal', () => 0],
  ...[-12, -6, -3, -2, -1, 1, 2, 3, 6, 12].map((value) => [`uniform ${value}`, () => value]),
  ...[1, 2, 3, 6, 12].flatMap((value) => [
    [`alternating ${value}`, (index) => (index % 2 ? -value : value)],
    [`reverse alternating ${value}`, (index) => (index % 2 ? value : -value)],
  ]),
  ...Array.from({ length: 64 }, (_, seed) => {
    let value = seed + 1;
    return [
      `independent seeded ${seed + 1}`,
      () => {
        value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
        return (value % 13) - 6;
      },
    ];
  }),
];
for (const [name, delta] of patterns)
  test(`earned large capture, erosion and meaningful steering survive modeled timing: ${name}`, () => {
    const result = inspect(record(keys, delta));
    assert.equal(result.match, true);
    assert.equal(result.status, 'pass');
    assert(result.checks.every(({ pass }) => pass));
    assert.equal(result.outcome, 'running');
  });
