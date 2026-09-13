import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, realpath, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export const digest = (value) =>
  createHash('sha256')
    .update(
      typeof value === 'string' || value instanceof Uint8Array ? value : JSON.stringify(value),
    )
    .digest('hex');
async function ordinaryAncestors(destination, create = false) {
  const root = await realpath(ROOT),
    absolute = path.resolve(destination);
  const relative = path.relative(root, absolute);
  assert.ok(
    relative && !relative.startsWith('..') && !path.isAbsolute(relative),
    'Destination must remain inside this worktree.',
  );
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    let stat;
    try {
      stat = await lstat(current);
    } catch (error) {
      if (!create || error.code !== 'ENOENT') throw error;
      await mkdir(current);
      stat = await lstat(current);
    }
    assert.ok(
      stat.isDirectory() && !stat.isSymbolicLink(),
      'Symlink/non-directory ancestor refused.',
    );
    assert.equal(await realpath(current), current, 'Canonical ancestor changed.');
  }
  return absolute;
}
export async function ordinaryFile(file, limit) {
  const target = file instanceof URL ? fileURLToPath(file) : path.resolve(file);
  await ordinaryAncestors(path.dirname(target));
  const stat = await lstat(target);
  assert.ok(
    stat.isFile() && !stat.isSymbolicLink() && stat.size <= limit,
    'Bounded ordinary source file required.',
  );
  const bytes = await readFile(target);
  assert.ok(bytes.length <= limit);
  return bytes;
}
export async function writeProof(file, proof) {
  const target = fileURLToPath(file);
  assert.equal(
    target,
    fileURLToPath(new URL('./routes.json', import.meta.url)),
    'Only this new proof destination is writable.',
  );
  await ordinaryAncestors(path.dirname(target));
  await writeFile(target, JSON.stringify(proof, null, 2) + '\n', { flag: 'wx' });
}
/** Exclusive cache export; ordinary symlink refusal, not a hostile rename guarantee. */
export async function writeCandidateDirectory(output, files) {
  assert.equal(typeof output, 'string');
  assert.match(output, /^\.cache\/[a-zA-Z0-9][a-zA-Z0-9._/-]*$/);
  assert.ok(output.split('/').every((part) => part && !['.', '..'].includes(part)));
  const target = path.resolve(ROOT, output);
  await ordinaryAncestors(path.dirname(target), true);
  await mkdir(target);
  assert.equal(await realpath(target), target);
  const pins = [];
  for (const [name, value] of Object.entries(files)) {
    assert.match(name, /^[a-z0-9-]+\.json$/);
    const bytes = JSON.stringify(value, null, 2) + '\n';
    await writeFile(path.join(target, name), bytes, { flag: 'wx' });
    pins.push({ name, bytes: Buffer.byteLength(bytes), sha256: digest(bytes) });
  }
  return { directory: target, files: pins };
}
