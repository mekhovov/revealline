import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { canonicalJSON, required } from '../game/data-json.mjs';
import { LIMITS } from '../game/presentation/model.mjs';
import { verifyPresentationDependencies } from '../game/presentation/dependencies.mjs';
import { presentationManifestPath } from '../game/presentation/manifest-path.mjs';
import { RETAINED_FPV38_PRESENTATION } from '../game/couch/coop-retained-presentation.mjs';

const prefix = 'game/presentation/compiled/';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const supported = [RETAINED_FPV38_PRESENTATION];

/** Build-only code-owned associations. Files must also belong to the core offline
 * inventory; a worker cannot detect a required file omitted from its CONFIG. */
export async function readRetainedTeamPresentation(root, included, { excluded = [] } = {}) {
  if (!included.includes('game/couch/coop-owned-presentation.mjs')) return null;
  const shipped = new Set(included),
    optional = new Set(excluded),
    pins = new Map();
  const read = async (relative, maximum) => {
    const name = prefix + relative;
    required(
      shipped.has(name) && !optional.has(name),
      `Retained Team presentation requires a core offline file: ${name}.`,
    );
    let target = root;
    for (const component of name.split('/')) {
      target = path.join(target, component);
      required(
        !(await lstat(target)).isSymbolicLink(),
        'Team presentation cannot use symbolic links.',
      );
    }
    const stat = await lstat(target);
    required(
      stat.isFile() && stat.size > 0 && stat.size <= maximum,
      `Invalid Team presentation file size: ${name}.`,
    );
    const bytes = await readFile(target);
    required(
      bytes.length > 0 && bytes.length <= maximum,
      `Team presentation grew during reading: ${name}.`,
    );
    return bytes;
  };
  const verify = async (bytes, retainedManifestSha256 = null) => {
    const result = await verifyPresentationDependencies(bytes, {
      retainedManifestSha256,
      read: (file) => read(file.path, file.bytes),
    });
    for (const file of [result.inventory.manifest, ...result.inventory.files]) {
      const descriptor = { path: prefix + file.path, bytes: file.bytes, sha256: file.sha256 };
      const before = pins.get(descriptor.path);
      required(
        !before || canonicalJSON(before) === canonicalJSON(descriptor),
        'Conflicting Team presentation dependency.',
      );
      pins.set(descriptor.path, Object.freeze(descriptor));
    }
    return result.inventory;
  };
  const current = await verify(await read('runtime.json', LIMITS.manifestBytes));
  for (const association of supported) {
    const inventory =
      current.manifest.sha256 === association.sha256
        ? current
        : await verify(
            await read(presentationManifestPath(association.sha256), LIMITS.manifestBytes),
            association.sha256,
          );
    required(
      canonicalJSON({
        source: inventory.source,
        theme: inventory.theme,
        collection: inventory.collection,
      }) ===
        canonicalJSON({
          source: association.source,
          theme: association.theme,
          collection: association.collection,
        }),
      'Retained Team presentation differs from its code-owned association.',
    );
  }
  return Object.freeze({ files: Object.freeze([...pins.values()]) });
}

/** The packager rereads source files. Compare those exact packaged bytes too. */
export function verifyRetainedTeamPresentationEntries(prepared, entries) {
  if (!prepared) return;
  for (const pin of prepared.files) {
    const matches = entries.filter((entry) => entry.name === pin.path);
    required(
      matches.length === 1 &&
        matches[0].bytes.length === pin.bytes &&
        hash(matches[0].bytes) === pin.sha256,
      `Retained Team presentation changed between validation and packaging: ${pin.path}.`,
    );
  }
}
