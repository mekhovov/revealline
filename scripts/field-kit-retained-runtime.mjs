import { createHash } from 'node:crypto';
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
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Construct explicit compiler history from immutable authoring input and the
 * ledger's hash-addressed originals. Never consult the current output directory. */
export async function readFieldKitRetainedOutput({ read, assets }) {
  const pin = FIELD_KIT_RETAINED_RUNTIME;
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
      inventory.source.revision === 54 &&
      inventory.theme.id === 'fpv' &&
      inventory.theme.revision === 54 &&
      inventory.collection === null,
    'Retained Field Kit runtime identity differs from revision 54.',
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
