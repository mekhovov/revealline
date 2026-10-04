/** Manual identity qualification; no runtime or test-coverage changes. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { projectEditionModuleIndentation } from './edition-code-indentation.mjs';

const [baseline, inventoryPath] = process.argv.slice(2);
assert.match(baseline ?? '', /^[a-f0-9]{40}$/);
assert.ok(inventoryPath, 'Pass the baseline revision and retained input inventory path.');
const target = 'optional-practice/civilian-fpv/world-reaction-runtime.mjs';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const gitFile = (file) =>
  execFileSync('git', ['show', `${baseline}:${file}`], { maxBuffer: 16 * 1024 * 1024 });
const before = gitFile(target);
const after = await readFile(target);
const inspect = (bytes) => {
  const source = bytes.toString('utf8');
  const tokens = [],
    comments = [];
  const ast = parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    onToken: tokens,
    onComment: comments,
  });
  const clean = (value) => {
    if (Array.isArray(value)) return value.map(clean);
    if (value instanceof RegExp) return { source: value.source, flags: value.flags };
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .filter(([key]) => key !== 'start' && key !== 'end')
          .map(([key, child]) => [key, clean(child)]),
      );
    return value;
  };
  const literal = (node) => {
    if (node.type === 'Literal') return node.value;
    assert.equal(node.type, 'ObjectExpression');
    return Object.fromEntries(
      node.properties.map((property) => [
        property.key.name ?? property.key.value,
        literal(property.value),
      ]),
    );
  };
  const binding = (name) =>
    literal(
      ast.body.flatMap((node) => node.declarations ?? []).find((node) => node.id.name === name)
        .init,
    );
  return {
    ast: clean(ast),
    tokens: tokens.map((item) => source.slice(item.start, item.end)),
    comments: comments.map((item) => source.slice(item.start, item.end)),
    lines: source.match(/[\r\n\u2028\u2029]/g) ?? [],
    packed: binding('packedClips'),
    sources: binding('sourceHashes'),
  };
};
const original = inspect(before),
  current = inspect(after);
assert.deepEqual(current, original, 'Only whitespace outside lexical content may change.');
assert.deepEqual(projectEditionModuleIndentation(target, before), after);
assert.deepEqual(projectEditionModuleIndentation(target, after), after);
for (const [file, sha256] of Object.entries(current.sources)) {
  const bytes = await readFile(file);
  assert.equal(hash(bytes), sha256, `Canonical source pin: ${file}`);
  assert.deepEqual(bytes, gitFile(file), `Canonical source unchanged: ${file}`);
}
const clips = Object.entries(current.packed).map(([file, clip]) => {
  const bytes = Buffer.from(clip.base64, 'base64');
  assert.deepEqual(bytes, gitFile(`game/audio/reactions/${file}`));
  return { file, bytes: bytes.length, sha256: hash(bytes), mime: clip.mime };
});
assert.equal(clips.length, 24);
const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
assert.equal(inventory.packageId, 'fpv-worlds');
assert.equal(inventory.inputs.length, 95);
const inputs = [];
for (const { path } of inventory.inputs) {
  const oldBytes = gitFile(path),
    bytes = await readFile(path);
  inputs.push({
    path,
    beforeBytes: oldBytes.length,
    bytes: bytes.length,
    beforeSha256: hash(oldBytes),
    sha256: hash(bytes),
  });
}
const changed = inputs.filter((row) => row.beforeSha256 !== row.sha256);
assert.deepEqual(
  changed.map((row) => row.path),
  [target],
);
for (const file of [
  'publishing/optional-package-policy.mjs',
  'game/test/fpv-hunt-reactions.test.mjs',
  'optional-practice/civilian-fpv/world-hunt-reactions.mjs',
  'optional-practice/civilian-fpv/world-audio.mjs',
  'game/ui/dialogue-channel.mjs',
])
  assert.deepEqual(await readFile(file), gitFile(file), `Unchanged scope: ${file}`);
const beforeInputBytes = inputs.reduce((sum, row) => sum + row.beforeBytes, 0);
const inputBytes = inputs.reduce((sum, row) => sum + row.bytes, 0);
console.log(
  JSON.stringify(
    {
      format: 'FPVReactionSourceCapacity.v1',
      baseline,
      inputInventorySource: inventory.sourceRevision,
      beforeBytes: before.length,
      afterBytes: after.length,
      savedBytes: before.length - after.length,
      beforeSha256: hash(before),
      afterSha256: hash(after),
      astTokensCommentsLinesExact: true,
      projectionExact: true,
      idempotent: true,
      tokenCount: current.tokens.length,
      commentCount: current.comments.length,
      lineTerminators: current.lines.length,
      canonicalPinnedFiles: Object.keys(current.sources).length,
      packedRecordings: clips,
      inputFiles: inputs.length,
      beforeInputBytes,
      inputBytes,
      headroom: 16777216 - inputBytes,
      changedInputs: changed,
      inputs,
      policyUnchanged: true,
      knownAudioFailureSourceUnchanged: true,
      browserQualified: false,
      admissionQualified: false,
    },
    null,
    2,
  ),
);
