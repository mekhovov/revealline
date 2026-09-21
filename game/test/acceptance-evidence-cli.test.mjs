import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import {
  missionEvidenceTarget,
  inspectMissionAcceptance,
  appendPlaytestEvidence,
  PLAYTEST_EVIDENCE_FORMAT,
} from '../content-design/acceptance-evidence.mjs';

const sourceCommit = 'a'.repeat(40);
const cli = (source, args) =>
  spawnSync(
    process.execPath,
    [new URL('../../scripts/compile-content-project.mjs', import.meta.url).pathname, '-', ...args],
    { input: JSON.stringify(source), encoding: 'utf8', maxBuffer: 1024 * 1024 },
  );

test('the existing compiler CLI and direct acceptance inspector produce identical reports for all modes and presets', () => {
  for (const [source, mode] of [
    [createStarterProject(), 'solo'],
    [createStarterProject(), 'versus'],
    [createTeamOpeningCandidates(), 'team'],
  ])
    for (const difficulty of ['gentle', 'standard', 'expert']) {
      const id = source.missions[0].id,
        output = cli(source, [
          '--acceptance',
          '--mission',
          id,
          '--source-commit',
          sourceCommit,
          '--mode',
          mode,
          '--difficulty',
          difficulty,
        ]);
      assert.equal(output.status, 0, output.stderr);
      assert.deepEqual(
        JSON.parse(output.stdout),
        inspectMissionAcceptance(source, id, { sourceCommit, mode, difficulty }),
      );
      assert.equal(
        JSON.parse(output.stdout).releaseEligible,
        false,
        'A successful read-only report is not release approval',
      );
    }
});

test('CLI reads an explicit bounded ledger without editing it, fetching artifacts or treating it as release approval', async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'revealline-evidence-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const source = createStarterProject(),
    id = source.missions[0].id,
    filename = path.join(directory, 'synthetic-ledger.json'),
    ledger = appendPlaytestEvidence(undefined, {
      format: PLAYTEST_EVIDENCE_FORMAT,
      id: 'synthetic-cli-test',
      target: missionEvidenceTarget(source, id, { sourceCommit }),
      kind: 'automated',
      observedAt: '2026-09-21T10:00:00.000Z',
      method: 'Synthetic CLI contract fixture; not real evidence.',
      checks: [
        { id: 'capture-contract', outcome: 'fail', detail: 'Synthetic failure remains visible.' },
      ],
      artifacts: [
        {
          sha256: 'f'.repeat(64),
          bytes: 1,
          mediaType: 'text/plain',
          label: 'Reference only; no artifact file exists or is fetched.',
        },
      ],
      supersedes: null,
    }),
    bytes = JSON.stringify(ledger);
  await writeFile(filename, bytes);
  const args = [
      '--acceptance',
      '--mission',
      id,
      '--source-commit',
      sourceCommit,
      '--evidence-ledger',
      filename,
    ],
    result = cli(source, args);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(
    JSON.parse(result.stdout),
    inspectMissionAcceptance(source, id, { sourceCommit, ledger }),
  );
  assert.equal(await readFile(filename, 'utf8'), bytes);
  const file = await open(filename, 'w');
  await file.truncate(8 * 1024 * 1024 + 1);
  await file.close();
  const oversized = cli(source, args);
  assert.equal(oversized.status, 1);
  assert.match(oversized.stderr, /Evidence ledger input exceeds 8 MiB/);
  assert.equal(oversized.stdout, '');
});

test('CLI rejects ambiguous selections, missing pins, duplicate flags and a second stdin consumer', () => {
  const source = createStarterProject(),
    id = source.missions[0].id,
    valid = ['--acceptance', '--mission', id, '--source-commit', sourceCommit];
  for (const args of [
    ['--acceptance'],
    ['--acceptance', '--mission', id],
    ['--mission', id, '--source-commit', sourceCommit],
    ['--check', '--evidence-ledger', 'ignored.json'],
    [...valid, '--journey'],
    [...valid, '--pacing'],
    [...valid, '--check'],
    [...valid, '--pack', 'some-pack'],
    [...valid, '--exclude-campaigns', 'one'],
    [...valid, '--acceptance'],
    [...valid, '--source-commit', sourceCommit],
    [...valid, '--evidence-ledger', '-'],
    ['--acceptance', '--mission', id, '--source-commit', 'HEAD'],
  ]) {
    const output = cli(source, args);
    assert.equal(output.status, 1, args.join(' '));
    assert.equal(output.stdout, '');
    assert(output.stderr.trim());
  }
});
