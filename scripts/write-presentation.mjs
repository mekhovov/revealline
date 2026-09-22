import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { LIMITS } from '../game/presentation/model.mjs';
import { verifyPresentationDependencies } from '../game/presentation/dependencies.mjs';

export const RETAINED_OUTPUT_LIMITS = Object.freeze({
  manifests: LIMITS.collections,
  bytes: LIMITS.bundleBytes,
});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export const retainedPresentationPath = (name) => /^runtime\.[a-f0-9]{64}\.json$/.test(name);
const allowed = (name) =>
  ['manifest.json', 'runtime.json', 'studio.json', 'theme.css'].includes(name) ||
  retainedPresentationPath(name) ||
  /^assets\/[a-f0-9]{64}\.(png|jpg|webp|ttf|otf|woff2|wav|ogg|mp3)$/.test(name);

async function inventory(directory) {
  const files = new Map();
  const visit = async (relative = '') => {
    for (const entry of await fs.readdir(path.join(directory, relative), { withFileTypes: true })) {
      const name = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory() && name === 'assets') await visit(name);
      else if (entry.isFile() && allowed(name))
        files.set(name, await fs.readFile(path.join(directory, name)));
      else
        throw new Error(`Unmanaged presentation output: ${name}. Preserve it before rebuilding.`);
    }
  };
  await visit();
  return files;
}

export async function verifyPresentationOutput(files) {
  const manifest = JSON.parse(files.get('manifest.json')?.toString('utf8') ?? 'null');
  if (manifest?.format !== 'revealline-presentation-build.v1' || !Array.isArray(manifest.files))
    throw new Error('Presentation output has no valid ownership manifest.');
  const seen = new Set(['manifest.json']);
  for (const entry of manifest.files) {
    const bytes = files.get(entry.path);
    if (
      seen.has(entry.path) ||
      !allowed(entry.path) ||
      !bytes ||
      bytes.length !== entry.bytes ||
      hash(bytes) !== entry.sha256
    )
      throw new Error(`Presentation output does not match its manifest: ${entry.path}.`);
    seen.add(entry.path);
  }
  if (seen.size !== files.size) throw new Error('Presentation output contains unlisted files.');
  const retained = [...files].filter(([name]) => retainedPresentationPath(name));
  if (retained.length > RETAINED_OUTPUT_LIMITS.manifests)
    throw new Error(
      'Retained presentation manifest capacity exceeded; preserve the current release.',
    );
  const retainedPaths = new Set();
  for (const [name, bytes] of retained) {
    retainedPaths.add(name);
    const pin = name.slice(8, -5);
    if (hash(bytes) !== pin) throw new Error(`Retained presentation filename differs: ${name}.`);
    const { inventory } = await verifyPresentationDependencies(bytes, {
      expectedManifestSha256: pin,
      read: async (file) => files.get(file.path),
    });
    for (const file of inventory.files) retainedPaths.add(file.path);
  }
  if (
    [...retainedPaths].reduce((sum, name) => sum + files.get(name).length, 0) >
    RETAINED_OUTPUT_LIMITS.bytes
  )
    throw new Error('Retained presentation byte capacity exceeded; preserve the current release.');
}

/** Replace only a complete compiler-owned directory. Unknown or edited files
 * are never deleted. The old tree remains available until the new tree is ready. */
export async function writePresentation(files, output, { check = false } = {}) {
  const candidate = new Map([...files].map(([name, bytes]) => [name, Buffer.from(bytes)]));
  await verifyPresentationOutput(candidate);
  let current = null;
  try {
    const stat = await fs.lstat(output);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error('Presentation output must be a real directory.');
    current = await inventory(output);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (current) {
    await verifyPresentationOutput(current);
    for (const [name, bytes] of current) {
      if (retainedPresentationPath(name) && !candidate.get(name)?.equals(bytes))
        throw new Error(`Retained presentation must be preserved: ${name}.`);
    }
  }
  if (check) {
    if (!current || candidate.size !== current.size)
      throw new Error('Stale presentation output inventory.');
    for (const [name, bytes] of candidate)
      if (!current.get(name)?.equals(bytes)) throw new Error(`Stale production artifact ${name}.`);
    return;
  }
  await fs.mkdir(path.dirname(output), { recursive: true });
  const stage = await fs.mkdtemp(path.join(path.dirname(output), '.presentation-stage-'));
  const previous = `${stage}-previous`;
  let moved = false;
  try {
    for (const [name, bytes] of candidate) {
      await fs.mkdir(path.dirname(path.join(stage, name)), { recursive: true });
      await fs.writeFile(path.join(stage, name), bytes);
    }
    if (current) {
      await fs.rename(output, previous);
      moved = true;
    }
    try {
      await fs.rename(stage, output);
    } catch (error) {
      if (moved) await fs.rename(previous, output);
      moved = false;
      throw error;
    }
    if (moved) await fs.rm(previous, { recursive: true });
  } finally {
    await fs.rm(stage, { recursive: true, force: true });
  }
}
