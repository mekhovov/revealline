import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { canonicalJSON } from '../data-json.mjs';
import * as current from '../gameplay-tuning.mjs';
import * as v1 from '../gameplay-tuning-v1.mjs';
import * as v2 from '../gameplay-tuning-v2.mjs';
import * as v3 from '../gameplay-tuning-v3.mjs';
import { createCoop, stepCoop, validateCoopLevel } from '../coop/core.mjs';
import { journeyTeamPackEdition } from '../coop/foundations.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import {
  createInstalledTeamAttempt,
  createInstalledTeamAttemptSnapshot,
  installedTeamGameplayId,
  validateInstalledTeamAttempt,
} from '../creator/team-installed.mjs';

function source(version, difficulty, authored = false) {
  return {
    version: `revealline-coop-level.v${version}`,
    id: 'hunter-compatibility',
    revision: 'hunter-compatibility-1',
    name: 'Hunter compatibility',
    width: 72,
    height: 36,
    spawns: [
      { x: 20.5, y: 0.5 },
      { x: 20.5, y: 35.5 },
    ],
    walls: [],
    safeRects: [],
    enemies: [
      { id: 'keeper', type: 'drifter', x: 60.5, y: 28.5, vx: 2, vy: 1, radius: 0.2 },
      { id: 'hunter', type: 'hunter', x: 45.5, y: 20.5, vx: 2, vy: 1, radius: 0.2 },
    ],
    goal: { coverage: 0.99 },
    ...(version >= 2 ? { journeyDifficulty: difficulty } : {}),
    ...(version >= 3 ? { terrain: [] } : {}),
    ...(version >= 6 ? { lineImpact: { version: 'team-line-impact.v2', speed: 24 } } : {}),
    ...(version >= 7 ? { supportRoles: ['interceptor', 'disruptor'] } : {}),
    ...(authored
      ? { encounter: { hunterAttackSpeed: 10, hunterRecovery: 1.4, hunterWakeStep: 0.25 } }
      : {}),
  };
}

const settings = [
  ['gentle', {}],
  ['standard', {}],
  ['expert', {}],
  ['expert', { enemySpeed: 1.234567890123456, playerSpeed: 1.1, enemyDensity: 1.5 }],
];
const canonicalSHA256 = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');

// Captured before the current gp4 guard changed on base 321408a3. Each row pins
// all fields of eight prepared levels: the three presets and fractional admin
// overrides, each with an absent or authored encounter. These are not new
// post-fix expectations inferred from the implementation under test.
const currentGoldens = [
  '026a34419e31413b7b4115a67bc2537ea61ab90a1e69e6f2e0df1422fea6e90e',
  '8421f2d490f50a6ba19673b8dc1892f46df8f494b02262b1222ae688d0b84ef7',
  'e2bbb92b037fc4c5f898ed998cb4c9ccd991d64e2302d105250ff07ce4c2fb21',
  'de8e8270934c7eb4ac54a5d37ddcc732b9fa6a3d46d119857b5140826a2cbb95',
];
const historical = [
  {
    name: 'v1',
    implementation: v1,
    blob: '17af134756974c6482a416d9235d7d1a06316719',
    matrix: '1c92c1498fe7ad4a6b0579ae0f544b85f6e3c6ce7e4771470aae43eb32438d4c',
  },
  {
    name: 'v2',
    implementation: v2,
    blob: 'f961327ac7bf463ddc6d8e9e0b167102bcac14a1',
    matrix: 'c8e6ed721410fc547860cbbf80ba44462205c44478cc5b88084d4154641bafe9',
  },
  {
    name: 'v3',
    implementation: v3,
    blob: '82f990cbbaba7d13757d1d7b2f59ae2d4e67f233',
    matrix: '283ea6479607011ce08b5b301e4ad009ddb0bf01dcba89148647c4de1e33ca6b',
  },
];

function preparedMatrix(implementation, version, inspect = () => {}) {
  return settings.flatMap(([difficulty, overrides]) =>
    [false, true].map((authored) => {
      const input = source(version, difficulty, authored),
        before = structuredClone(input),
        tuning = implementation.resolveGameplayTuning(difficulty, overrides),
        level = implementation.applyGameplayTuning(input, tuning);
      assert.deepEqual(validateCoopLevel(input), { valid: true, errors: [] });
      assert.deepEqual(validateCoopLevel(level), { valid: true, errors: [] });
      assert.deepEqual(input, before, 'Preparation cannot mutate the installed source');
      inspect(input, tuning, level);
      return level;
    }),
  );
}

for (let version = 1; version <= 4; version++) {
  test(`current gp4 preserves pre-fix complete Team v${version} hunter outputs`, () => {
    const levels = preparedMatrix(current, version, (input, tuning, level) => {
      assert.equal(current.recoverGameplayTuning(level).version, 'gameplay-pressure.v4');
      assert.deepEqual(current.recoverGameplayTuning(level), tuning);
      assert.deepEqual(current.applyGameplayTuning(input, tuning), level);
      assert(Object.isFrozen(level.enemies[0]));
    });
    assert.equal(canonicalSHA256(levels), currentGoldens[version - 1]);
  });
}

for (const { name, implementation, blob, matrix } of historical) {
  test(`frozen ${name} source and Team hunter dispatch retain pre-fix byte and behavior receipts`, async () => {
    const bytes = await readFile(new URL(`../gameplay-tuning-${name}.mjs`, import.meta.url)),
      actualBlob = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
    assert.equal(actualBlob, blob);
    const levels = [1, 2, 3, 4].map((version) =>
      preparedMatrix(implementation, version, (input, tuning, level) => {
        assert.deepEqual(current.applyGameplayTuning(input, tuning), level);
        assert.deepEqual(current.recoverGameplayTuning(level), tuning);
      }),
    );
    assert.equal(canonicalSHA256(levels), matrix);
    for (const version of [6, 7])
      assert.throws(
        () =>
          current.applyGameplayTuning(
            source(version, 'standard'),
            implementation.resolveGameplayTuning('standard'),
          ),
        /Invalid tuned Team level/,
        'Frozen failed recipes must not silently gain a different preparation contract',
      );
  });
}

test('current preparation preserves v6/v7 schema defaults rather than admitting encounter overrides', () => {
  for (const version of [6, 7]) {
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const input = source(version, difficulty),
        before = structuredClone(input),
        tuning = current.resolveGameplayTuning(difficulty),
        level = current.applyGameplayTuning(input, tuning),
        run = createCoop(level),
        hunter = run.enemies.find((enemy) => enemy.id === 'hunter');
      assert.deepEqual(validateCoopLevel(level), { valid: true, errors: [] });
      assert.equal(Object.hasOwn(level, 'encounter'), false);
      assert.equal(
        hunter.baseSpeed,
        8,
        'Historical committed attack speed remains the core default',
      );
      assert.equal(hunter.phase, 'patrol');
      assert.deepEqual(level.lineImpact, input.lineImpact);
      assert.deepEqual(level.supportRoles, input.supportRoles);
      assert.deepEqual(input, before);
      assert.throws(() => current.applyGameplayTuning(level, tuning), /exactly once/);
    }
    for (const forbidden of [
      { encounter: {} },
      { encounter: { hunterAttackSpeed: 10 } },
      { strongholds: [] },
    ]) {
      const input = { ...source(version, 'standard'), ...forbidden };
      assert.equal(validateCoopLevel(input).valid, false);
      assert.throws(
        () => current.applyGameplayTuning(input, current.resolveGameplayTuning('standard')),
        /Invalid Team tuning source/,
      );
    }
  }
  assert.equal(validateCoopLevel(source(5, 'standard')).valid, false, 'v5 still excludes hunters');
});

function packFor(level) {
  return {
    ...journeyTeamPackEdition(level),
    id: 'hunter-compatibility-pack',
    revision: 'hunter-compatibility-1',
    name: 'Hunter compatibility',
    levels: [level],
  };
}

for (const version of [6, 7]) {
  test(`installed Team v${version} hunter configuration reconstructs a saved recipe and exact checkpoint`, () => {
    // Exercise the exported installed configuration/snapshot path with real
    // engine ticks. This is not an IndexedDB or browser Resume acceptance test.
    const input = source(version, 'standard'),
      pack = packFor(input),
      before = structuredClone(pack),
      tuning = current.resolveGameplayTuning('standard'),
      run = createInstalledTeamAttempt(pack, input.id, 'standard', 'full', tuning),
      gameplayId = installedTeamGameplayId(pack, input.id, 'standard', 'full', tuning),
      editionId = 'a'.repeat(64),
      segments = [
        {
          ticks: 120,
          commands: [
            { direction: 'down', boost: false, support: false },
            { direction: null, boost: false, support: false },
          ],
        },
        {
          ticks: 90,
          commands: [
            { direction: 'right', boost: false, support: false },
            { direction: null, boost: false, support: false },
          ],
        },
      ];
    assert.deepEqual(validateCoopPack(pack), { valid: true, errors: [] });
    for (const segment of segments)
      for (let tick = 0; tick < segment.ticks; tick++) stepCoop(run, segment.commands);
    assert.equal(run.status, 'running');
    assert.equal(run.tick, 210);
    assert.notEqual(run.players[0].y, input.spawns[0].y);
    const saved = createInstalledTeamAttemptSnapshot({
        editionId,
        attemptId: `hunter-v${version}-attempt`,
        gameplayId,
        presetId: 'full',
        run,
        tuning,
        segments,
      }),
      checked = validateInstalledTeamAttempt(saved, editionId, input.id),
      restored = createInstalledTeamAttempt(
        pack,
        checked.levelId,
        checked.difficulty,
        checked.presetId,
        checked.tuning,
      );
    assert.deepEqual(checked.tuning, current.recoverGameplayTuning(run.level));
    assert.equal(
      installedTeamGameplayId(
        pack,
        checked.levelId,
        checked.difficulty,
        checked.presetId,
        checked.tuning,
      ),
      checked.gameplayId,
    );
    for (const segment of checked.segments)
      for (let tick = 0; tick < segment.ticks; tick++) stepCoop(restored, segment.commands);
    const reconstructed = createInstalledTeamAttemptSnapshot({
      editionId,
      attemptId: checked.attemptId,
      gameplayId: checked.gameplayId,
      presetId: checked.presetId,
      run: restored,
      tuning: checked.tuning,
      segments: checked.segments,
    });
    assert.deepEqual(reconstructed, saved);
    assert.deepEqual(restored, run);
    assert.deepEqual(pack, before);
  });
}
