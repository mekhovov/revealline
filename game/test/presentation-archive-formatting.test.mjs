import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

const run = promisify(execFile);
const prettierCLI = fileURLToPath(new URL('./bin/prettier.cjs', import.meta.resolve('prettier')));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('repository-wide formatting leaves pinned runtime bytes untouched while current JSON still formats and checks', async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'rl-archive-format-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const compiled = path.join(root, 'game/presentation/compiled');
  await fs.mkdir(compiled, { recursive: true });
  await fs.writeFile(
    path.join(root, '.prettierignore'),
    await fs.readFile(new URL('../../.prettierignore', import.meta.url)),
  );
  await fs.writeFile(path.join(root, '.prettierrc.json'), '{"tabWidth":4,"printWidth":20}');
  // A formatting sentinel, not an authenticated compiled presentation fixture.
  const original = Buffer.from('{"retained":{"exact":true}}\n');
  const pinned = path.join(compiled, `runtime.${hash(original)}.json`);
  const current = path.join(compiled, 'runtime.json');
  await fs.writeFile(pinned, original);
  await fs.writeFile(current, '{"current":{"editable":true}}');
  await run(process.execPath, [prettierCLI, '--write', 'game/**/*.json'], { cwd: root });
  assert.deepEqual(await fs.readFile(pinned), original);
  const formatted = await fs.readFile(current, 'utf8');
  assert(formatted.includes('\n    "current":'));
  assert.deepEqual(JSON.parse(formatted), { current: { editable: true } });
  await run(process.execPath, [prettierCLI, '--check', 'game/**/*.json'], { cwd: root });
  // Changing current formatting policy still cannot mutate the retained pin.
  await fs.writeFile(path.join(root, '.prettierrc.json'), '{"useTabs":true,"printWidth":20}');
  await run(process.execPath, [prettierCLI, '--write', 'game/**/*.json'], { cwd: root });
  assert.equal(hash(await fs.readFile(pinned)), hash(original));
  assert((await fs.readFile(current, 'utf8')).includes('\n\t"current":'));
  await run(process.execPath, [prettierCLI, '--check', 'game/**/*.json'], { cwd: root });
  // Control: the former repository policy allows this same command to break the pin.
  await fs.writeFile(path.join(root, '.prettierignore'), 'game/vendor/\n');
  await run(process.execPath, [prettierCLI, '--write', 'game/**/*.json'], { cwd: root });
  assert.notEqual(hash(await fs.readFile(pinned)), hash(original));
});
