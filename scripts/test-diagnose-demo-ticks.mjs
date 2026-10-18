import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { demoTickSHA256 } from './demo-tick-trace.mjs';

const exec = promisify(execFile);
const root = fileURLToPath(new URL('../', import.meta.url));
const cli = path.join(root, 'scripts/diagnose-demo-ticks.mjs');
const recording = path.join(
  root,
  'optional-practice/civilian-fpv/demo-data/flight-01-self-level-573db8b71fe99103.json',
);
const invoke = (args) =>
  exec(process.execPath, [cli, ...args], { cwd: root, timeout: 30000, maxBuffer: 1024 * 1024 });
const base = [
  `--mode=sim`,
  `--recording=${recording}`,
  '--runtime-implementation=cli-test-native-sim',
];

test('diagnostic CLI captures, compares, rejects damaged receipts, and reports exact mismatch with failing exit status', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'demo-tick-cli-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  const tracePath = path.join(directory, 'reference.json');
  const reportPath = path.join(directory, 'comparison.json');
  const captured = JSON.parse((await invoke([...base, `--capture=${tracePath}`])).stdout);
  assert.equal(captured.operation, 'capture');
  assert.equal(captured.observedTicks, 240);
  const compared = JSON.parse(
    (await invoke([...base, `--reference=${tracePath}`, `--report=${reportPath}`])).stdout,
  );
  assert.equal(compared.match, true);
  assert.equal(compared.nativeVerification.passed, true);
  assert.deepEqual(JSON.parse(await readFile(reportPath)), compared);
  await assert.rejects(invoke([...base, `--capture=${tracePath}`]), /overwrite/);
  await assert.rejects(
    invoke([...base, `--reference=${tracePath}`, `--report=${reportPath}`]),
    /EEXIST/,
  );

  const trace = JSON.parse(await readFile(tracePath));
  trace.hashes[13] = '0000000000000000';
  await writeFile(tracePath, JSON.stringify(trace));
  await assert.rejects(
    invoke([...base, `--reference=${tracePath}`]),
    /independently retained receipt/,
  );

  // Deliberate fault fixture: an independently supplied reference can disagree
  // at an intermediate tick while the candidate still passes native admission.
  const receiptPath = tracePath + '.receipt.json';
  const receipt = JSON.parse(await readFile(receiptPath));
  receipt.traceSha256 = await demoTickSHA256(trace);
  await writeFile(receiptPath, JSON.stringify(receipt));
  const mismatchReport = path.join(directory, 'mismatch.json');
  await assert.rejects(
    invoke([...base, `--reference=${tracePath}`, `--report=${mismatchReport}`]),
    (error) => {
      assert.equal(error.code, 1);
      const result = JSON.parse(error.stdout);
      assert.equal(result.kind, 'state-mismatch');
      assert.equal(result.firstDivergentTick, 13);
      assert.equal(result.lastMatchingTick, 12);
      assert.equal(result.nativeVerification.passed, true);
      return true;
    },
  );
  assert.equal(JSON.parse(await readFile(mismatchReport)).firstDivergentTick, 13);
});

test('diagnostic CLI rejects outputs in shipped roots, including through a symlink', async (context) => {
  const directory = await mkdtemp(path.join(tmpdir(), 'demo-tick-cli-'));
  context.after(() => rm(directory, { recursive: true, force: true }));
  await assert.rejects(
    invoke([...base, '--capture=game/demo-data/unpublished-trace.json']),
    /outside shipped/,
  );
  const alias = path.join(directory, 'alias');
  await symlink(path.join(root, 'optional-practice'), alias);
  await assert.rejects(
    invoke([...base, `--capture=${path.join(alias, 'trace.json')}`]),
    /outside shipped/,
  );
});

test('diagnostic CLI rejects ambiguous or misspelled commands before writing', async () => {
  for (const args of [
    [],
    [...base, '--capture=a', '--reference=b'],
    [...base, '--capture=a', '--receipt=b'],
    [...base, '--captuer=a'],
    [...base, '--capture=a', '--mode=snake'],
  ]) {
    await assert.rejects(invoke(args), /Provide|belongs|belong|Unknown|Repeated/);
  }
});
