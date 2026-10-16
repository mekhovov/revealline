#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { summarizeOverflightTrials } from '../game/overflight/trial-report.mjs';
const args = process.argv.slice(2),
  outAt = args.indexOf('--out');
const output = outAt >= 0 ? args.splice(outAt, 2)[1] : null;
if (args.length !== 3)
  throw Error(
    'Usage: node scripts/report-overflight-trials.mjs trial-1.json[.gz] trial-2.json[.gz] trial-3.json[.gz] [--out report.json]',
  );
const inputs = args.map((path) => {
  const bytes = readFileSync(path);
  return {
    path,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    bytes: bytes.length,
    record: JSON.parse((path.endsWith('.gz') ? gunzipSync(bytes) : bytes).toString()),
  };
});
const report = {
  ...summarizeOverflightTrials(inputs.map((input) => input.record)),
  recordedAt: new Date().toISOString(),
  inputs: inputs.map(({ record: _record, ...input }) => input),
};
const json = `${JSON.stringify(report, null, 2)}\n`;
if (output) writeFileSync(output, json);
else process.stdout.write(json);
if (!report.passes) process.exitCode = 1;
