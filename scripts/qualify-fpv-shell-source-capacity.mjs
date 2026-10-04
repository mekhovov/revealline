/** Manual source identity audit; does not add unit coverage or run a player. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { projectEditionModuleIndentation } from './edition-code-indentation.mjs';

const [baseline, inventoryPath, output] = process.argv.slice(2);
assert.match(baseline ?? '', /^[a-f0-9]{40}$/);
assert(inventoryPath && output, 'Pass BASELINE INPUT_INVENTORY NEW_RECEIPT');
const target = 'optional-practice/civilian-fpv/flight-fullscreen.mjs',
  canonical = 'game/ui/mode-play-shell.mjs',
  begin = '// BEGIN GENERATED SHARED MODE SHELL',
  end = '// END GENERATED SHARED MODE SHELL',
  hash = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  git = (file) =>
    execFileSync('git', ['show', `${baseline}:${file}`], { maxBuffer: 16 * 1024 * 1024 }),
  before = git(target).toString(),
  after = await readFile(target, 'utf8');
function split(source) {
  const first = source.indexOf(begin),
    last = source.indexOf(end) + end.length;
  assert(first >= 0 && last > first && source.indexOf(begin, first + 1) < 0);
  return [source.slice(0, first), source.slice(first, last), source.slice(last)];
}
function inspect(source) {
  const tokens = [],
    comments = [];
  const ast = parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    onToken: tokens,
    onComment: comments,
  });
  const normalize = (value) => {
    if (Array.isArray(value)) return value.map(normalize);
    if (value instanceof RegExp) return { source: value.source, flags: value.flags };
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== 'start' && key !== 'end')
          .map(([key, child]) => [key, normalize(child)]),
      );
    return value;
  };
  return {
    ast: normalize(ast),
    tokens: tokens.map((row) => source.slice(row.start, row.end)),
    comments: comments.map((row) => source.slice(row.start, row.end)),
    lines: source.match(/[\r\n\u2028\u2029]/g) ?? [],
  };
}
const oldParts = split(before),
  newParts = split(after),
  syntax = inspect(after);
assert.deepEqual(
  syntax,
  inspect(before),
  'Whole module AST/tokens/comments/line terminators unchanged',
);
assert.equal(oldParts[0], newParts[0]);
assert.equal(oldParts[2], newParts[2]);
assert.equal(
  projectEditionModuleIndentation(target, Buffer.from(oldParts[1])).toString(),
  newParts[1],
);
assert.equal(
  projectEditionModuleIndentation(target, Buffer.from(newParts[1])).toString(),
  newParts[1],
);
const source = await readFile(canonical);
assert.deepEqual(source, git(canonical));
assert(after.includes(`// Canonical source sha256: ${hash(source)}`));
for (const file of [
  'publishing/optional-package-policy.mjs',
  'optional-practice/civilian-fpv/flight-fullscreen.css',
  'scripts/edition-code-indentation.mjs',
  'game/ui/mode-play-shell.css',
])
  assert.deepEqual(await readFile(file), git(file));
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
assert.equal(inventory.packageId, 'fpv-worlds');
assert.equal(inventory.inputs.length, 95);
const inputs = [];
for (const { path } of inventory.inputs) {
  const old = git(path),
    current = await readFile(path);
  inputs.push({
    path,
    beforeBytes: old.length,
    bytes: current.length,
    beforeSha256: hash(old),
    sha256: hash(current),
  });
}
const changed = inputs.filter((row) => row.beforeSha256 !== row.sha256);
assert.deepEqual(
  changed.map((row) => row.path),
  [target],
);
const inputBytes = inputs.reduce((sum, row) => sum + row.bytes, 0);
const receipt = {
  format: 'FPVGeneratedShellSourceCapacity.v1',
  baseline,
  historicalInventorySource: inventory.sourceRevision,
  inventoryPathsReboundToBaseline: true,
  beforeBytes: Buffer.byteLength(before),
  afterBytes: Buffer.byteLength(after),
  beforeSha256: hash(before),
  afterSha256: hash(after),
  savedBytes: Buffer.byteLength(before) - Buffer.byteLength(after),
  generatedBeforeBytes: Buffer.byteLength(oldParts[1]),
  generatedAfterBytes: Buffer.byteLength(newParts[1]),
  canonicalSha256: hash(source),
  astTokensCommentsLinesExact: true,
  surroundingBytesExact: true,
  projectionExact: true,
  idempotent: true,
  tokenCount: syntax.tokens.length,
  commentCount: syntax.comments.length,
  lineTerminators: syntax.lines.length,
  inputFiles: inputs.length,
  inputBytes,
  headroom: 16777216 - inputBytes,
  changedInputs: changed,
  inputs,
  policyAndLicensesUnchanged: true,
  browserQualified: false,
  admissionQualified: false,
};
await writeFile(output, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(
  JSON.stringify({
    output,
    savedBytes: receipt.savedBytes,
    inputFiles: inputs.length,
    headroom: receipt.headroom,
    astTokensCommentsLinesExact: true,
    surroundingBytesExact: true,
  }),
);
