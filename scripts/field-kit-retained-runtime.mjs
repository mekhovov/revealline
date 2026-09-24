import { createHash } from 'node:crypto';
import { retainPresentationOutput } from './retain-presentation-output.mjs';
import { canonicalJSON, required } from '../game/data-json.mjs';
import { verifyPresentationDependencies } from '../game/presentation/dependencies.mjs';

// Original committed bytes, not a reserialization of the revision ledger.
// New retained revisions require explicit inputs and separately reviewed policy.
export const FIELD_KIT_RETAINED_RUNTIME = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.91a3d66966e1b1a3c2e9b5c68aebcc4be284edff4e7b9b272731a769a4f66ace.json',
  sha256: '91a3d66966e1b1a3c2e9b5c68aebcc4be284edff4e7b9b272731a769a4f66ace',
  bytes: 978694,
  commit: 'b810521a53af7be145acb8dedce0a01a747339cf',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_RUNTIME_58 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.ae9949a7c8c8a24775e68317e5825e9b4b2e5ae1dfb9bcffdd749a5adc4cce54.json',
  sha256: 'ae9949a7c8c8a24775e68317e5825e9b4b2e5ae1dfb9bcffdd749a5adc4cce54',
  bytes: 979746,
  commit: '6842203fbf24db198da21759e23d5c5c64d499dd',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_RUNTIME_60 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.38a3c4cc207ee9b136d1cada405f74385c44f3a4a20bc21d91e09c4fc386e39f.json',
  sha256: '38a3c4cc207ee9b136d1cada405f74385c44f3a4a20bc21d91e09c4fc386e39f',
  bytes: 1092838,
  commit: 'bc8b7565f2c4277145b4763d76d928c45e024f1c',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_RUNTIME_62 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.b4a7285520550e4cd04c7b9e80b4c6468c0a914faac77c05fa7f86a72c8a3c8f.json',
  sha256: 'b4a7285520550e4cd04c7b9e80b4c6468c0a914faac77c05fa7f86a72c8a3c8f',
  bytes: 1094096,
  commit: '2e64c130d219dfece5134ba9119b85a5bf34904d',
  originalPath: 'game/presentation/compiled/runtime.json',
});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Construct explicit compiler history from immutable authoring input and the
 * ledger's hash-addressed originals. Never consult the current output directory. */
async function readPinnedOutput({ read, assets }, pin, revision) {
  const source = await read(pin.path);
  required(
    source instanceof Uint8Array && source.byteLength === pin.bytes,
    'Retained Field Kit runtime byte count differs from its original input.',
  );
  const bytes = Buffer.from(source);
  required(hash(bytes) === pin.sha256, 'Retained Field Kit runtime input hash differs.');
  const files = new Map([['runtime.json', bytes]]);
  const { inventory } = await verifyPresentationDependencies(bytes, {
    expectedManifestSha256: pin.sha256,
    retainedManifestSha256: pin.sha256,
    read: async (file) => {
      const blob = assets.get(file.sha256);
      if (!blob) return undefined;
      required(
        blob.size === file.bytes,
        `Retained Field Kit dependency byte count differs: ${file.path}`,
      );
      const body = Buffer.from(await blob.arrayBuffer());
      files.set(file.path, body);
      return body;
    },
  });
  required(
    inventory.source.id === 'field-kit' &&
      inventory.source.revision === revision &&
      inventory.theme.id === 'fpv' &&
      inventory.theme.revision === revision &&
      inventory.collection === null,
    `Retained Field Kit runtime identity differs from revision ${revision}.`,
  );
  files.set(
    'manifest.json',
    Buffer.from(
      canonicalJSON({
        format: 'revealline-presentation-build.v1',
        source: inventory.source,
        files: [...files].map(([path, body]) => ({
          path,
          bytes: body.length,
          sha256: hash(body),
        })),
      }) + '\n',
    ),
  );
  return files;
}

/** Preserve exact committed54, accepted58 and retained60/62 runtime manifests and their complete lazy
 * dependencies. New ledger revisions never authorize implicit output-directory IO. */
export async function readFieldKitRetainedOutput(options) {
  const legacy = await readPinnedOutput(options, FIELD_KIT_RETAINED_RUNTIME, 54);
  const accepted = await readPinnedOutput(options, FIELD_KIT_RETAINED_RUNTIME_58, 58);
  const held = await readPinnedOutput(options, FIELD_KIT_RETAINED_RUNTIME_60, 60);
  const actors = await readPinnedOutput(options, FIELD_KIT_RETAINED_RUNTIME_62, 62);
  return retainPresentationOutput(
    actors,
    await retainPresentationOutput(held, await retainPresentationOutput(accepted, legacy)),
  );
}
