import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../game/data-json.mjs';
import {
  pursuitPilotCases,
  preparePursuitPilotPacket,
  verifyPursuitPilotRecording,
} from './qualify-pursuit-pilots.mjs';
import { createClassicSnakeMatch, exportClassicSnakeMatch } from '../game/snake/classic-match.mjs';
import { createRecorder, exportReplay } from '../game/replay.mjs';
import { createRun } from '../game/core/index.mjs';
import { createCoop, startCoop } from '../game/coop/core.mjs';
import { createDuel, resumeDuel } from '../game/multiplayer.mjs';
import {
  createLocalMatchRecorder,
  verifyLocalMatchRecordingAsync,
} from '../game/multiplayer-recording.mjs';

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
      /Unsupported local recording format/,
    );
  await assert.rejects(verifySnake(snakeSession(), { pilot: 'unknown' }), /Unknown pilot/);
});

test('native multiplayer cases require reconstructed completion, not a self-attested terminal state', async () => {
  for (const mode of ['versus', 'team']) {
    const entry = cases.find(
      (item) => item.family === 'capture' && item.mode === mode && item.pace === 'standard',
    );
    assert.equal(entry.recording, 'native-local-capture-terminal');
    const state =
      mode === 'team'
        ? startCoop(createCoop(entry.level, entry.options))
        : createDuel(entry.level, entry.options, entry.duel);
    if (mode === 'versus') resumeDuel(state, { preserveContinuation: true });
    const recorder = createLocalMatchRecorder({
      mode,
      level: entry.level,
      options: entry.options,
      duel: entry.duel ?? null,
      provenance: entry.recordingProvenance,
    });
    // Deliberately forged result: there is no movement or completed native objective.
    state.status = mode === 'team' ? 'won' : 'finished';
    const recording = await recorder.snapshot(state);
    await assert.rejects(
      verifyPursuitPilotRecording({ ...entry, recording }),
      /does not match its full native terminal state/,
    );
    const changed = structuredClone(recording);
    changed.recipe.options.seed++;
    await assert.rejects(
      verifyPursuitPilotRecording({ ...entry, recording: changed }),
      /seed, cooperation or race rules differ/,
    );
  }
});

test('a reconstructed native clear with a changed digest reports integrity failure, not a missing completion', async () => {
  const recording = JSON.parse(
    await readFile(
      new URL(
        '../docs/qualification/industrial-art/native-play-2026-10-04/versus-crossing-post.json',
        import.meta.url,
      ),
      'utf8',
    ),
  );
  // Keep the genuine consumed commands and accepted recipe. A clear alone must
  // not make an altered full-state checkpoint qualify on any browser/runtime.
  recording.final.stateSha256 = '0'.repeat(64);
  const reconstructed = await verifyLocalMatchRecordingAsync(recording);
  assert.equal(reconstructed.match, false);
  assert.equal(reconstructed.state.runs[0].status, 'won');
  assert.equal(reconstructed.state.reason, 'First clear');
  await assert.rejects(
    verifyPursuitPilotRecording({
      pilot: 'crossing-post',
      mode: 'versus',
      pace: 'standard',
      recording,
    }),
    /does not match its full native terminal state/,
  );
});

test('pilot evidence rejects different source pins and imported ownership even for the exact runtime recipe', async () => {
  for (const mode of ['versus', 'team']) {
    const entry = cases.find(
      (item) => item.family === 'capture' && item.mode === mode && item.pace === 'standard',
    );
    const state =
      mode === 'team'
        ? startCoop(createCoop(entry.level, entry.options))
        : createDuel(entry.level, entry.options, entry.duel);
    if (mode === 'versus') resumeDuel(state, { preserveContinuation: true });
    const recorder = createLocalMatchRecorder({
      mode,
      level: entry.level,
      options: entry.options,
      duel: entry.duel ?? null,
      provenance: entry.recordingProvenance,
    });
    // An intentionally unplayed checkpoint exercises admission, not a route.
    state.status = mode === 'team' ? 'won' : 'finished';
    const recording = await recorder.snapshot(state);
    assert.deepEqual(recording.recipe.provenance, entry.recordingProvenance);
    for (const patch of [
      { sourceLevelId: 'copied-pilot' },
      { sourceRevision: 'another-revision' },
      { sourceIdentity: '0'.repeat(16) },
      { editionId: 'installed-community-copy' },
      { packageIdentity: 'f'.repeat(64) },
    ]) {
      const changed = structuredClone(recording);
      Object.assign(changed.recipe.provenance, patch);
      changed.recipeSha256 = createHash('sha256')
        .update(canonicalJSON(changed.recipe))
        .digest('hex');
      await assert.rejects(
        verifyPursuitPilotRecording({ ...entry, recording: changed }),
        /source ownership or revision differs/,
      );
    }
    await assert.rejects(
      verifyPursuitPilotRecording({ ...entry, recording }),
      /does not match its full native terminal state/,
      'matching source metadata still cannot prove a clear',
    );
  }
});
