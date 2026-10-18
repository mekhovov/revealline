// Test-only historical reader. Execution admission continues to hash current files.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
export const RETIRED_SOLO_SOURCE = 'docs/performance/fixtures/solo-retired-diagnostics/source.json';
const retirement = `# Retired after the single admitted PR #1544 release edge was merged.
# Keep the diagnostic definition and exact execution guard for historical review.
# No automatic event starts this workflow; no repository workflow calls it.
on:
  workflow_call:
`;

export function retiredSoloDiagnosticSource(path, current, witnessBytes) {
  assert.equal(
    createHash('sha256').update(witnessBytes).digest('hex'),
    '4c0ba98e10b89dc19f338b22d76bc69bd1ee62cb4ded71837410b604aad17c28',
  );
  const witness = JSON.parse(witnessBytes);
  assert.equal(witness.format, 'RetiredSoloOneShotDiagnosticSourceV1');
  const record = witness.workflows.find((entry) => entry.path === path);
  if (!record) return current;
  const start = record.source.indexOf('on:\n');
  const end = record.source.indexOf('\npermissions:', start);
  assert(start > 0 && end > start, path);
  const expected = record.source.slice(0, start) + retirement + record.source.slice(end);
  assert.equal(
    current.toString(),
    expected,
    `Retired workflow changed outside its trigger: ${path}`,
  );
  return Buffer.from(record.source);
}

export async function readSoloDiagnosticSource(path) {
  const current = await readFile(new URL(path, root));
  if (!path.startsWith('.github/workflows/')) return current;
  return retiredSoloDiagnosticSource(
    path,
    current,
    await readFile(new URL(RETIRED_SOLO_SOURCE, root)),
  );
}
