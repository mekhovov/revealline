import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  pursuitPilotCases,
  preparePursuitPilotPacket,
  verifyPursuitPilotRecording,
} from './qualify-pursuit-pilots.mjs';
import { createClassicSnakeMatch, exportClassicSnakeMatch } from '../game/snake/classic-match.mjs';
import { createRecorder, exportReplay } from '../game/replay.mjs';
import { createRun } from '../game/core/index.mjs';

const cases = pursuitPilotCases();
const snake = cases.find(
  (entry) => entry.family === 'snake' && entry.mode === 'solo' && entry.pace === 'normal',
);
function snakeSession(seed = snake.seed) {
  return {
    format: 'revealline-classic-snake-session.v2',
    activity: 'campaign',
    levelId: snake.pilot,
    mode: snake.mode,
    pace: snake.pace,
    targetRules: 'authored',
    preset: 'classic',
    duel: 'score',
    seed,
    style: 'cable',
    match: exportClassicSnakeMatch(
      createClassicSnakeMatch(snake.level, { mode: snake.mode, seed, policy: 'mission' }),
    ),
  };
}
const verifySnake = (recording, overrides = {}) =>
  verifyPursuitPilotRecording({ ...snake, recording, ...overrides });

test('packet pins six original pilots across all native modes/paces without a generated clear', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'pursuit-pilot-packet-'));
  try {
    const report = await preparePursuitPilotPacket(dir);
    assert.equal(report.pilots.length, 6);
    assert.equal(report.cases.length, 32);
    assert.equal(report.files.length, 5);
    for (const entry of report.cases) {
      assert.equal(entry.demonstratedCompletionRoute, null);
      assert.equal(entry.publicRelease, 'not-qualified');
      assert.equal(
        entry.seed,
        entry.family === 'capture'
          ? entry.mode === 'team'
            ? 17
            : 1
          : entry.family === 'snake'
            ? 17
            : 9601,
      );
      assert.match(entry.recipe.sha256, /^[a-f0-9]{64}$/);
    }
    for (const file of report.files)
      assert.equal((await readFile(path.join(dir, file.name))).length, file.bytes);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('Snake verifier rejects a replay with a valid different seed and an outer-only seed correction', async () => {
  await assert.rejects(verifySnake(snakeSession(18)), /metadata or seed/);
  const forged = snakeSession(18);
  forged.seed = 17;
  await assert.rejects(verifySnake(forged), /match rules differ/);
  await assert.rejects(verifySnake(snakeSession(), { pace: 'slow' }), /metadata or seed/);
});

test('unfinished exact Snake recording and forged checkpoint cannot qualify a completion', async () => {
  await assert.rejects(verifySnake(snakeSession()), /No board completed/);
  const changed = snakeSession();
  changed.match.checkpoint = '0'.repeat(16);
  await assert.rejects(verifySnake(changed), /timeline verification/);
});

test('Solo requires the pinned seed and a replay-verified completed mission', async () => {
  const entry = cases.find(
    (item) => item.family === 'capture' && item.mode === 'solo' && item.pace === 'standard',
  );
  for (const seed of [entry.seed, 17]) {
    const options = { ...entry.options, seed };
    const recording = exportReplay(
      createRecorder(entry.level, options),
      createRun(entry.level, options),
    );
    await assert.rejects(
      verifyPursuitPilotRecording({ ...entry, recording }),
      seed === entry.seed ? /completed mission/ : /seed, class or turn policy/,
    );
  }
});

test('local Team/Versus evidence cannot be treated as a native verified Solo clear', async () => {
  for (const entry of cases.filter((item) => item.family === 'capture' && item.mode !== 'solo'))
    await assert.rejects(
      verifyPursuitPilotRecording({ ...entry, recording: {} }),
      /terminal recording export is unavailable/,
    );
  await assert.rejects(verifySnake(snakeSession(), { pilot: 'unknown' }), /Unknown pilot/);
});
