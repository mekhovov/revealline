import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../game/data-json.mjs';
import { verifyPresentationDependencies } from '../game/presentation/dependencies.mjs';
import { presentationManifestPath } from '../game/presentation/manifest-path.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const retained = (name) => /^runtime\.([a-f0-9]{64})\.json$/.exec(name);
const allowed = (name) =>
  ['manifest.json', 'runtime.json', 'studio.json', 'theme.css'].includes(name) ||
  retained(name) ||
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

async function verifyManifest(files) {
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
  for (const [name, bytes] of files) {
    const match = retained(name);
    if (!match) continue;
    await verifyPresentationDependencies(new Uint8Array(bytes), {
      retainedManifestSha256: match[1],
      read: async (file) => files.get(file.path),
    });
  }
}

/** Read only a real compiler-owned tree; return detached, authenticated bytes.
 * Missing output is permitted only when explicitly requested. An incomplete,
 * edited, linked or unmanaged existing tree is never treated as absent. */
export async function readPresentation(output, { allowMissing = false } = {}) {
  let stat;
  try {
    stat = await fs.lstat(output);
  } catch (error) {
    if (allowMissing && error.code === 'ENOENT') return null;
    throw error;
  }
  if (!stat.isDirectory() || stat.isSymbolicLink())
    throw new Error('Presentation output must be a real directory.');
  const files = await inventory(output);
  await verifyManifest(files);
  return files;
}

/** Replace only a complete compiler-owned directory. Unknown or edited files
 * are never deleted. The old tree remains available until the new tree is ready. */
export async function writePresentation(files, output, { check = false } = {}) {
  const candidate = new Map([...files].map(([name, bytes]) => [name, Buffer.from(bytes)]));
  await verifyManifest(candidate);
  const current = await readPresentation(output, { allowMissing: true });
  if (current) {
    for (const [name, bytes] of current)
      if (retained(name) && !candidate.get(name)?.equals(bytes))
        throw new Error(`Retained presentation must be preserved exactly: ${name}.`);
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

/** Preserve original runtime bytes and dependencies before changing a default.
 * Both inputs are complete, authenticated compiler-owned file maps. This pure
 * assembly step never reads uploaded paths or modifies either input map. */
export async function retainPresentationManifests(files, previous) {
  const candidate = new Map([...files].map(([name, bytes]) => [name, Buffer.from(bytes)]));
  const prior = new Map([...previous].map(([name, bytes]) => [name, Buffer.from(bytes)]));
  await verifyManifest(candidate);
  await verifyManifest(prior);
  const original = prior.get('runtime.json');
  const next = candidate.get('runtime.json');
  if (!original || !next)
    throw new Error('Presentation retention requires both original runtime manifests.');
  for (const files of [candidate, prior])
    await verifyPresentationDependencies(new Uint8Array(files.get('runtime.json')), {
      read: async (file) => files.get(file.path),
    });
  const originals = new Map([...prior].filter(([name]) => retained(name)));
  if (!candidate.get('runtime.json')?.equals(original))
    originals.set(presentationManifestPath(hash(original)), original);
  const preserve = (name, bytes) => {
    const existing = candidate.get(name);
    if (existing && !existing.equals(bytes))
      throw new Error(`Conflicting retained presentation bytes: ${name}.`);
    candidate.set(name, Buffer.from(bytes));
  };
  for (const [name, bytes] of originals) {
    const verified = await verifyPresentationDependencies(new Uint8Array(bytes), {
      retainedManifestSha256: retained(name)[1],
      read: async (file) => prior.get(file.path),
    });
    preserve(name, bytes);
    for (const file of verified.inventory.files) preserve(file.path, prior.get(file.path));
  }
  if (
    candidate.size === files.size &&
    [...candidate].every(([name, bytes]) => bytes.equals(Buffer.from(files.get(name))))
  )
    return candidate;
  candidate.set(
    'manifest.json',
    Buffer.from(
      canonicalJSON({
        ...JSON.parse(candidate.get('manifest.json').toString('utf8')),
        files: [...candidate]
          .filter(([name]) => name !== 'manifest.json')
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: hash(bytes) })),
      }) + '\n',
    ),
  );
  await verifyManifest(candidate);
  return candidate;
}
