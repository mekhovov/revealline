import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const GYM_REPLAY_INPUTS = Object.freeze([
  'optional-practice/civilian-flight/model.mjs',
  'optional-practice/civilian-flight/catalogue.mjs',
  'game/data-json.mjs',
  'game/i18n/index.mjs',
  'game/i18n/bootstrap.mjs',
  'game/i18n/catalogs.mjs',
  'game/vendor/i18next-26.4.2.min.js',
]);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function assertGymReplayImports(name, bytes) {
  const tree = parse(bytes.toString(), { ecmaVersion: 'latest', sourceType: 'module' });
  const pending = [tree];
  while (pending.length) {
    const node = pending.pop();
    assert(node.type !== 'ImportExpression', 'Dynamic replay imports are not admitted.');
    assert(
      !(node.type === 'CallExpression' && node.callee?.name === 'require'),
      'CommonJS replay dependencies are not admitted.',
    );
    if (
      ['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type) &&
      node.source
    ) {
      const dependency = node.source.value;
      assert(dependency.startsWith('.'), 'Only explicit relative replay dependencies are allowed.');
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(name), dependency));
      assert(GYM_REPLAY_INPUTS.includes(resolved), `Unpinned replay dependency: ${resolved}`);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) pending.push(...value.filter((child) => child?.type));
      else if (value?.type) pending.push(value);
    }
  }
}

// The caller first admits the entire original package envelope. Execute only
// our fixed repository modules, and only when their complete dependency closure
// is byte-identical to that admitted Gym. This replay never drives the browser.
export async function verifyFrozenGymTranscript(files, json) {
  assert(files instanceof Map, 'Admitted runtime members are required.');
  assert(typeof json === 'string' && Buffer.byteLength(json) <= 131072);
  const transcript = JSON.parse(json);
  assert.equal(transcript.drillId, 'lift-and-land');
  const inputs = [];
  for (const name of GYM_REPLAY_INPUTS) {
    const frozen = files.get(name);
    assert(Buffer.isBuffer(frozen), `Missing replay dependency: ${name}`);
    const current = await readFile(path.join(ROOT, name));
    assert.equal(sha(current), sha(frozen), `Replay dependency differs: ${name}`);
    assertGymReplayImports(name, frozen);
    inputs.push({ path: name, bytes: frozen.length, sha256: sha(frozen) });
  }
  const { replayPractice } = await import('../optional-practice/civilian-flight/model.mjs');
  const { CIVILIAN_PRACTICE_CATALOGUE } = await import(
    '../optional-practice/civilian-flight/catalogue.mjs'
  );
  const snapshot = replayPractice(CIVILIAN_PRACTICE_CATALOGUE, json);
  assert.equal(snapshot.status, 'complete', 'Exported exercise did not replay to completion.');
  assert.equal(snapshot.checkpoint, 2);
  assert.equal(snapshot.total, 2);
  assert.equal(snapshot.altitude, 0);
  for (const item of inputs)
    assert.equal(sha(await readFile(path.join(ROOT, item.path))), item.sha256);
  return {
    verified: true,
    qualified: false,
    method: 'Independent off-browser native replay of the actual public-UI export',
    transcriptSha256: sha(Buffer.from(json)),
    inputs,
    snapshot,
  };
}
