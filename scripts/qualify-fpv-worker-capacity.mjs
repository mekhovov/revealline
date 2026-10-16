/** Manual identity receipt for the worker source-capacity prerequisite. */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
const baseline = 'ade4bfc2dd2934668889bf622e87a48cf1b52c03';
const original = execFileSync(
  'git',
  ['show', baseline + ':optional-practice/worker-template.mjs'],
  {
    encoding: 'utf8',
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
  },
);
const canonical = fs.readFileSync('optional-practice/worker-source.mjs', 'utf8');
const generated = fs.readFileSync('optional-practice/worker-template.mjs', 'utf8');
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
      format: 'FPVWorkerSourceProjection.v1',
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
      networkContract: 'Unchanged; no Library transport in this prerequisite.',
    },
    null,
    2,
  ),
);
