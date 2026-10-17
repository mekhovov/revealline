import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
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
const execute = promisify(execFile);
const LOCALE_PREFIX =
  '// Selected optional-practice validator and settings messages.\nglobalThis.RevealLineTranslations=';

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

// The caller first admits the entire original envelope. Six executable modules
// must match our fixed repository sources; the seventh is the builder's JSON-only
// locale projection, not the full repository catalogue. Replay exact admitted
// bytes in a fresh, bounded Node child without inherited credentials or globals.
export async function verifyFrozenGymTranscript(files, json) {
  assert(files instanceof Map, 'Admitted runtime members are required.');
  assert(typeof json === 'string' && Buffer.byteLength(json) <= 131072);
  const transcript = JSON.parse(json);
  assert.equal(transcript.drillId, 'lift-and-land');
  const inputs = [];
  for (const name of GYM_REPLAY_INPUTS) {
    const frozen = files.get(name);
    assert(Buffer.isBuffer(frozen), `Missing replay dependency: ${name}`);
    if (name === 'game/i18n/catalogs.mjs') {
      const text = frozen.toString();
      assert(text.startsWith(LOCALE_PREFIX) && text.endsWith(';\n'), 'Invalid locale projection.');
      const payload = text.slice(LOCALE_PREFIX.length, -2);
      const locales = JSON.parse(payload);
      assert.equal(JSON.stringify(locales), payload, 'Locale projection must contain JSON only.');
      assert.deepEqual(Object.keys(locales).sort(), ['en', 'uk']);
    } else {
      const current = await readFile(path.join(ROOT, name));
      assert.equal(sha(current), sha(frozen), `Replay dependency differs: ${name}`);
    }
    assertGymReplayImports(name, frozen);
    inputs.push({ path: name, bytes: frozen.length, sha256: sha(frozen) });
  }
  const work = await mkdtemp(path.join(tmpdir(), 'practice-gym-replay-'));
  let snapshot;
  try {
    for (const item of inputs) {
      const target = path.join(work, item.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, files.get(item.path), { flag: 'wx' });
    }
    // Node loader fixture only; neither this file nor the transcript is served.
    await writeFile(path.join(work, 'package.json'), '{"type":"module"}', { flag: 'wx' });
    await writeFile(path.join(work, 'transcript.json'), json, { flag: 'wx' });
    const program = `
      import {readFile} from 'node:fs/promises';
      import {pathToFileURL} from 'node:url';
      const root=process.argv[1];
      const {replayPractice}=await import(pathToFileURL(root+'/optional-practice/civilian-flight/model.mjs'));
      const {CIVILIAN_PRACTICE_CATALOGUE}=await import(pathToFileURL(root+'/optional-practice/civilian-flight/catalogue.mjs'));
      const trace=await readFile(root+'/transcript.json','utf8');
      process.stdout.write(JSON.stringify(replayPractice(CIVILIAN_PRACTICE_CATALOGUE,trace)));
    `;
    const { stdout } = await execute(
      process.execPath,
      ['--input-type=module', '-e', program, work],
      {
        env: {},
        timeout: 10_000,
        killSignal: 'SIGKILL',
        maxBuffer: 65536,
      },
    );
    snapshot = JSON.parse(stdout);
    for (const item of inputs)
      assert.equal(sha(await readFile(path.join(work, item.path))), item.sha256);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  assert.equal(snapshot.status, 'complete', 'Exported exercise did not replay to completion.');
  assert.equal(snapshot.checkpoint, 2);
  assert.equal(snapshot.total, 2);
  assert.equal(snapshot.altitude, 0);
  return {
    verified: true,
    qualified: false,
    method: 'Independent off-browser native replay of the actual public-UI export',
    isolation:
      'Fresh Node process; exact admitted modules and JSON-only projected locales; no inherited environment',
    transcriptSha256: sha(Buffer.from(json)),
    inputs,
    snapshot,
  };
}
