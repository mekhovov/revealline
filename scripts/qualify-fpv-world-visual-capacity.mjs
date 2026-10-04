/** Manual identity receipt for the world visual source-capacity prerequisite. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
const baseline = '0a1548fd29bd4f4fce741c2917d2c07d8bdbb63b';
const original = execFileSync(
  'git',
  ['show', baseline + ':optional-practice/civilian-fpv/world-visuals.mjs'],
  {
    encoding: 'utf8',
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
  },
);
const canonical = fs.readFileSync(
  'optional-practice/civilian-fpv/world-visuals-source.mjs',
  'utf8',
);
const generated = fs.readFileSync('optional-practice/civilian-fpv/world-visuals.mjs', 'utf8');
assert.equal(canonical, original);
function inspect(source) {
  const tokens = [],
    comments = [];
  const ast = parse(source, {
    sourceType: 'module',
    ecmaVersion: 'latest',
    onToken: tokens,
    onComment: comments,
  });
  return {
    ast: JSON.stringify(ast, (key, value) =>
      key === 'start' || key === 'end'
        ? undefined
        : value instanceof RegExp
          ? { source: value.source, flags: value.flags }
          : value,
    ),
    tokens: tokens.map((item) => source.slice(item.start, item.end)),
    comments: comments.map((item) => source.slice(item.start, item.end)),
    lines: (source.match(/[\r\n\u2028\u2029]/g) ?? []).join(''),
  };
}
const before = inspect(original),
  after = inspect(generated);
assert.deepEqual(before, after);
const hash = (value) => createHash('sha256').update(value).digest('hex');
console.log(
  JSON.stringify(
    {
      format: 'FPVWorldVisualSourceProjection.v1',
      baseline,
      canonicalExact: true,
      normalizedASTEqual: true,
      tokens: before.tokens.length,
      comments: before.comments.length,
      lineTerminators: before.lines.length,
      baselineBytes: Buffer.byteLength(original),
      generatedBytes: Buffer.byteLength(generated),
      recoveredBytes: Buffer.byteLength(original) - Buffer.byteLength(generated),
      canonicalSHA256: hash(canonical),
      generatedSHA256: hash(generated),
      runtimeContract: 'Unchanged; no new material or coating behavior in this prerequisite.',
    },
    null,
    2,
  ),
);
