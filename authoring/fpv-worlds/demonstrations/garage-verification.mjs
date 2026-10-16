#!/usr/bin/env node
/** Explicit offline functional qualification, outside the unit suite.
 * Baseline and candidate are trusted local source modules prepared for review.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  closeSync,
  ftruncateSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const options = { root: process.cwd() },
  args = process.argv.slice(2);
for (let index = 0; index < args.length; index++) {
  const key = {
    '--root': 'root',
    '--recordings': 'recordings',
    '--baseline': 'baseline',
    '--candidate': 'candidate',
    '--out': 'out',
  }[args[index]];
  if (!key || !args[index + 1] || args[index + 1].startsWith('--'))
    throw new Error(
      'Use --root REPOSITORY --recordings DIRECTORY --baseline MODULE --candidate MODULE --out NEW_DIRECTORY',
    );
  options[key] = resolve(args[++index]);
}
for (const key of ['recordings', 'baseline', 'candidate', 'out'])
  assert(options[key], 'Missing --' + key);
mkdirSync(options.out);
const tool = (name) => resolve(options.root, 'authoring/fpv-worlds/demonstrations', name),
  scratch = (name) => resolve(options.out, name),
  artifact = (name) => resolve(options.recordings, name);
const digest = (value) => createHash('sha256').update(value).digest('hex'),
  sha = (file) => digest(readFileSync(file));
const checks = [],
  pass = (name) => checks.push({ name, passed: true });
function fails(script, argv, pattern) {
  let result;
  try {
    execFileSync(process.execPath, [tool(script), ...argv], {
      cwd: options.root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
  } catch (error) {
    result = error;
  }
  assert(result && result.status !== 0, 'Expected a rejected command');
  assert.match(result.stderr, pattern);
}
const report = JSON.parse(readFileSync(artifact('report.json'))),
  provenance = JSON.parse(readFileSync(tool('garage-provenance.json')));
assert.equal(report.generatorSha256, sha(tool('generate-garage.mjs')));
assert.equal(provenance.generatorSha256, report.generatorSha256);
assert.equal(provenance.installerSha256, sha(tool('append-packed.mjs')));
pass('Generation report and provenance record final portable tool hashes');
assert.equal(report.results.length, 16);
for (const row of report.results) {
  const prior = provenance.records.find((r) => r.id === row.id && r.mode === row.mode);
  assert(prior);
  assert.equal(sha(artifact(row.file)), prior.originalArtifactSha256);
  assert.equal(row.proofSha256, prior.proofSha256);
  assert.equal(row.sourceIdentity, prior.sourceIdentity);
}
pass('All16 artifacts and proof hashes reproduce retained originals byte-for-byte');
fails('generate-garage.mjs', [], /explicit --out/);
pass('Generator requires an explicit output');
const beforeReport = sha(artifact('report.json'));
fails(
  'generate-garage.mjs',
  ['--root', options.root, '--out', options.recordings],
  /already exists/,
);
assert.equal(sha(artifact('report.json')), beforeReport);
pass('Generator refuses an existing output directory without changing its report');
const baseline = (await import(pathToFileURL(options.baseline))).WORLD_DEMONSTRATIONS,
  candidate = (await import(pathToFileURL(options.candidate))).WORLD_DEMONSTRATIONS;
assert.equal(baseline.length, 138);
assert.equal(candidate.length, 154);
assert.deepEqual(candidate.slice(0, baseline.length), baseline);
pass('All138 existing decoded rows are exactly unchanged');
for (const [index, row] of report.results.entries()) {
  const proof = JSON.parse(readFileSync(artifact(row.file))).proof;
  assert.deepEqual(candidate[baseline.length + index], {
    sourceIdentity: row.sourceIdentity,
    proof,
  });
}
pass('All16 appended rows decode to exact source proof envelopes');
assert.equal(
  new Set(candidate.map((row) => row.proof.course + ':' + row.proof.mode)).size,
  candidate.length,
);
pass('All154 course/mode keys are unique');
assert.equal(sha(options.candidate), provenance.preparedRegistry.candidateSha256);
pass('Candidate module reproduces reviewed scratch bytes');
const before = readFileSync(options.baseline, 'utf8'),
  after = readFileSync(options.candidate, 'utf8'),
  token = 'function decodeFrames';
assert.equal(before.slice(before.indexOf(token)), after.slice(after.indexOf(token)));
pass('Runtime decoder and export bytes preserved');
const inputArgs = [
  '--root',
  options.root,
  '--registry',
  options.baseline,
  '--recordings',
  options.recordings,
];
const preserve = sha(options.candidate);
fails('append-packed.mjs', [...inputArgs, '--out', options.candidate], /Output already exists/);
assert.equal(sha(options.candidate), preserve);
pass('Installer refuses existing output without mutation');
fails(
  'append-packed.mjs',
  [
    '--root',
    options.root,
    '--recordings',
    options.recordings,
    '--registry',
    options.candidate,
    '--out',
    scratch('rejected-duplicate.mjs'),
  ],
  /Duplicate course\/mode/,
);
assert(!existsSync(scratch('rejected-duplicate.mjs')));
pass('Installer rejects already-installed course/mode keys');
const first = report.results[0];
mkdirSync(scratch('duplicate-batch'));
copyFileSync(artifact(first.file), scratch('duplicate-batch/' + first.file));
writeFileSync(
  scratch('duplicate-batch/report.json'),
  JSON.stringify({ ...report, results: [first, first] }),
);
fails(
  'append-packed.mjs',
  [
    '--root',
    options.root,
    '--registry',
    options.baseline,
    '--recordings',
    scratch('duplicate-batch'),
    '--out',
    scratch('rejected-internal.mjs'),
  ],
  /Duplicate course\/mode/,
);
assert(!existsSync(scratch('rejected-internal.mjs')));
pass('Installer rejects duplicate keys within one batch');
mkdirSync(scratch('tampered-batch'));
writeFileSync(
  scratch('tampered-batch/' + first.file),
  readFileSync(artifact(first.file), 'utf8') + ' ',
);
writeFileSync(
  scratch('tampered-batch/report.json'),
  JSON.stringify({ ...report, results: [first] }),
);
fails(
  'append-packed.mjs',
  [
    '--root',
    options.root,
    '--registry',
    options.baseline,
    '--recordings',
    scratch('tampered-batch'),
    '--out',
    scratch('rejected-tamper.mjs'),
  ],
  /Artifact hash differs/,
);
assert(!existsSync(scratch('rejected-tamper.mjs')));
pass('Installer rejects mutated artifact before publication');
const fd = openSync(scratch('oversize.mjs'), 'wx');
ftruncateSync(fd, 8 * 1024 * 1024 + 1);
closeSync(fd);
fails(
  'append-packed.mjs',
  [
    '--root',
    options.root,
    '--recordings',
    options.recordings,
    '--registry',
    scratch('oversize.mjs'),
    '--out',
    scratch('rejected-budget.mjs'),
  ],
  /byte budget/,
);
assert(!existsSync(scratch('rejected-budget.mjs')));
pass('Installer enforces registry byte ceiling before parsing');
writeFileSync(
  scratch('not-json.mjs'),
  'const PACKED_WORLD_DEMONSTRATIONS = (() => { throw new Error("EVALUATED"); })();\n',
);
fails(
  'append-packed.mjs',
  [
    '--root',
    options.root,
    '--recordings',
    options.recordings,
    '--registry',
    scratch('not-json.mjs'),
    '--out',
    scratch('rejected-expression.mjs'),
  ],
  /exactly one packed JSON array/,
);
assert(!existsSync(scratch('rejected-expression.mjs')));
pass('Installer rejects executable packed expressions without evaluating them');
const result = {
  format: 'FPVGaragePackagingEvidence.v1',
  createdAt: new Date().toISOString(),
  passed: true,
  checks,
  summary: {
    checks: checks.length,
    priorRecordsUnchanged: 138,
    newRecordsExact: 16,
    totalRecords: 154,
    regeneratedTicks: report.summary.totalTicks,
    oldDecoderBytesUnchanged: true,
    byteIdenticalScratch: true,
  },
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: options.root,
    encoding: 'utf8',
  }).trim(),
  verificationSha256: sha(new URL(import.meta.url)),
  generatorSha256: sha(tool('generate-garage.mjs')),
  installerSha256: sha(tool('append-packed.mjs')),
  provenanceSha256: sha(tool('garage-provenance.json')),
  archiveSha256: sha(tool('garage-recordings.zip')),
  registryBeforeSha256: sha(options.baseline),
  registryCandidateSha256: sha(options.candidate),
  generationReportSha256: sha(artifact('report.json')),
  limits: [
    'Offline functional qualification; no new unit coverage',
    'Actual installed-package browser and frozen-package admission remain separate gates',
    'No physical-device or public live qualification claim',
  ],
};
writeFileSync(scratch('verification.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result.summary));
