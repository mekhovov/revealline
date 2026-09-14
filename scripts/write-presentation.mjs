import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const allowed = (name) =>
  ['manifest.json', 'runtime.json', 'studio.json', 'theme.css'].includes(name) ||
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

function verifyManifest(files) {
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
}

/** Replace only a complete compiler-owned directory. Unknown or edited files
 * are never deleted. The old tree remains available until the new tree is ready. */
export async function writePresentation(files, output, { check = false } = {}) {
  const candidate = new Map([...files].map(([name, bytes]) => [name, Buffer.from(bytes)]));
  verifyManifest(candidate);
  let current = null;
  try {
    const stat = await fs.lstat(output);
    if (!stat.isDirectory() || stat.isSymbolicLink())
      throw new Error('Presentation output must be a real directory.');
    current = await inventory(output);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  if (current) verifyManifest(current);
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
