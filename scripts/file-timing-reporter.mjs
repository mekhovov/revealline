/**
 * Raw Node test-file telemetry; use alongside the normal TAP reporter.
 *
 * --test-reporter=tap --test-reporter-destination=stdout
 * --test-reporter=./scripts/file-timing-reporter.mjs --test-reporter-destination=timings.jsonl
 *
 * Optional qualification bindings (never inferred from the current git checkout):
 * REVEALLINE_TIMING_SOURCE_REVISION: exact 40-character lowercase commit hash
 * REVEALLINE_TIMING_SELECTED_FILES: JSON array of all selected root-relative paths
 * REVEALLINE_TIMING_ROOT: explicit source root, otherwise process.cwd()
 *
 * This is not a shard weights manifest. Consumers must check the final usable
 * summary and independently verify source, inventory, runtime and runner identity.
 * Node20/22 file-container complete events include subprocess startup, imports,
 * tests and shutdown; named case durations and log arrival gaps are never summed.
 */
import path from 'node:path';
import { realpathSync } from 'node:fs';
import { availableParallelism } from 'node:os';

const line = (record) => `${JSON.stringify({ schemaVersion: 1, ...record })}\n`;
const relativeFile = (value) =>
  typeof value === 'string' &&
  value.length > 0 &&
  !value.includes('\\') &&
  !path.posix.isAbsolute(value) &&
  value.split('/').every((part) => part.length > 0 && part !== '.' && part !== '..');

export default async function* fileTimingReporter(source) {
  const errors = [];
  // Node20 names file containers absolutely; Node22 uses the runner-cwd-relative
  // path. Both retain an absolute data.file. Never resolve against a source root
  // override, which need not be the cwd from which Node dispatched the files.
  const runnerCwd = process.cwd();
  let root = null;
  try {
    root = realpathSync(process.env.REVEALLINE_TIMING_ROOT || process.cwd());
  } catch {
    errors.push('invalid-source-root');
  }
  const binding = process.env.REVEALLINE_TIMING_SOURCE_REVISION;
  const sourceRevision = /^[a-f0-9]{40}$/.test(binding ?? '') ? binding : null;
  if (!sourceRevision) errors.push('missing-or-invalid-source-revision');
  let selected = null;
  try {
    const parsed = JSON.parse(process.env.REVEALLINE_TIMING_SELECTED_FILES ?? 'null');
    if (
      !Array.isArray(parsed) ||
      !parsed.length ||
      !parsed.every(relativeFile) ||
      new Set(parsed).size !== parsed.length
    )
      throw new Error('Invalid selected inventory');
    selected = [...parsed].sort();
  } catch {
    errors.push('missing-or-invalid-selected-inventory');
  }
  yield line({
    type: 'metadata',
    sourceRevision,
    root,
    runnerCwd,
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    availableParallelism: availableParallelism(),
    runId: process.env.GITHUB_RUN_ID ?? null,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
    selectedFiles: selected,
    measurement: 'node-file-container-duration-ms',
  });
  const files = new Map();
  let incompleteCases = false;
  for await (const event of source) {
    const data = event.data;
    if (data?.skip || data?.todo) incompleteCases = true;
    if (
      !['test:enqueue', 'test:dequeue', 'test:complete'].includes(event.type) ||
      data?.nesting !== 0 ||
      data?.line !== 1 ||
      data?.column !== 1 ||
      typeof data.file !== 'string' ||
      !path.isAbsolute(data.file) ||
      typeof data.name !== 'string' ||
      path.resolve(runnerCwd, data.name) !== data.file
    )
      continue;
    let entry = files.get(data.file);
    if (!entry) {
      entry = { stages: [], completions: [] };
      files.set(data.file, entry);
    }
    entry.stages.push(event.type);
    if (event.type === 'test:complete') entry.completions.push(data.details);
  }
  const measured = [];
  for (const [absolute, entry] of files) {
    const file = root ? path.relative(root, absolute).split(path.sep).join('/') : null;
    const details = entry.completions[0];
    if (
      !relativeFile(file) ||
      entry.stages.join(',') !== 'test:enqueue,test:dequeue,test:complete' ||
      !Number.isFinite(details?.duration_ms) ||
      details.duration_ms <= 0 ||
      typeof details.passed !== 'boolean'
    ) {
      errors.push(`invalid-or-duplicate-file-container:${absolute}`);
      continue;
    }
    measured.push({ file, durationMs: details.duration_ms, passed: details.passed });
  }
  measured.sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0));
  const observed = new Set(measured.map((record) => record.file));
  if (observed.size !== measured.length) errors.push('duplicate-relative-file-durations');
  const expected = new Set(selected ?? []);
  const missingFiles = selected?.filter((file) => !observed.has(file)) ?? [];
  const extraFiles = selected ? [...observed].filter((file) => !expected.has(file)) : [];
  if (!files.size) errors.push('unsupported-no-file-container-events');
  if (missingFiles.length) errors.push('missing-file-durations');
  if (extraFiles.length) errors.push('unexpected-file-durations');
  if (measured.some((record) => !record.passed)) errors.push('failed-file');
  if (incompleteCases) errors.push('skipped-or-todo-cases');
  for (const record of measured) yield line({ type: 'file', ...record });
  yield line({
    type: 'summary',
    supported: files.size > 0 && measured.length === files.size,
    usable: errors.length === 0,
    expectedFileCount: selected?.length ?? null,
    measuredFileCount: measured.length,
    missingFiles,
    extraFiles,
    errors,
  });
}
