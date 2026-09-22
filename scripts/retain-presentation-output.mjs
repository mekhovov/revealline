import { createHash } from 'node:crypto';
import { canonicalJSON } from '../game/data-json.mjs';
import { verifyPresentationDependencies } from '../game/presentation/dependencies.mjs';
import { verifyPresentationOutput, retainedPresentationPath } from './write-presentation.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Explicit compiler input, never an upload-provided path or implicit disk read.
 * Old runtime bytes and their complete lazy dependency set remain immutable.
 * Only the new current runtime/studio/CSS replace the current presentation. */
export async function retainPresentationOutput(candidateFiles, previousFiles) {
  const own = (files) => new Map([...files].map(([name, bytes]) => [name, Buffer.from(bytes)]));
  const candidate = own(candidateFiles),
    previous = own(previousFiles);
  await verifyPresentationOutput(candidate);
  await verifyPresentationOutput(previous);
  const verifyRuntime = (bytes, files) =>
    verifyPresentationDependencies(bytes, {
      read: async (file) => files.get(file.path),
    });
  await verifyRuntime(candidate.get('runtime.json'), candidate);
  if (!previous.has('runtime.json'))
    throw new Error('Previous presentation output needs bounded original runtime bytes.');
  const retained = new Map();
  const add = (name, bytes) => {
    const existing = candidate.get(name);
    if (existing && !existing.equals(bytes))
      throw new Error(`Retained presentation byte conflict: ${name}.`);
    retained.set(name, bytes);
  };
  const oldRuntimes = [...previous].filter(
    ([name]) => name === 'runtime.json' || retainedPresentationPath(name),
  );
  for (const [name, bytes] of oldRuntimes) {
    const { inventory } = await verifyRuntime(bytes, previous);
    // An unchanged current manifest already resolves identically. Do not grow
    // history merely by reproducing the same collection. Existing pins remain.
    if (name === 'runtime.json' && bytes.equals(candidate.get('runtime.json'))) continue;
    const target = name === 'runtime.json' ? `runtime.${hash(bytes)}.json` : name;
    add(target, bytes);
    for (const file of inventory.files) add(file.path, previous.get(file.path));
  }
  for (const [name, bytes] of retained) candidate.set(name, bytes);
  const manifest = JSON.parse(candidate.get('manifest.json').toString('utf8'));
  manifest.files = [...candidate]
    .filter(([name]) => name !== 'manifest.json')
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: hash(bytes) }));
  candidate.set('manifest.json', Buffer.from(canonicalJSON(manifest) + '\n'));
  await verifyPresentationOutput(candidate);
  return candidate;
}
