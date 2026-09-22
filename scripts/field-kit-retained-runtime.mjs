import { createHash } from 'node:crypto';
import { retainPresentationOutput } from './retain-presentation-output.mjs';
import { canonicalJSON, required } from '../game/data-json.mjs';
import { verifyPresentationDependencies } from '../game/presentation/dependencies.mjs';

// Original committed bytes, not a reserialization of the revision ledger.
// New retained revisions require explicit inputs and separately reviewed policy.
export const FIELD_KIT_RETAINED_RUNTIME = Object.freeze({
  path: "authoring/library/fpv-field-kit/retained/runtime.8ea2d74576591eaba4bdf67ed506d2ed766a10e1cd3ce972ec14861a4d097501.json",
  sha256: "8ea2d74576591eaba4bdf67ed506d2ed766a10e1cd3ce972ec14861a4d097501",
  bytes: 819016,
  commit: 'b810521a53af7be145acb8dedce0a01a747339cf',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_RUNTIME_60 = Object.freeze({
  path: "authoring/library/fpv-field-kit/retained/runtime.3d1cfb93d141f08b1f9cee06a3a528e10aab688634a36eed665a7d4e7e912b9b.json",
  sha256: "3d1cfb93d141f08b1f9cee06a3a528e10aab688634a36eed665a7d4e7e912b9b",
  bytes: 921580,
  commit: 'bc8b7565f2c4277145b4763d76d928c45e024f1c',
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

/** Preserve exact committed54 and60 runtime manifests and their complete lazy
 * dependencies. New ledger revisions never authorize implicit output-directory IO. */
export async function readFieldKitRetainedOutput(options) {
  const legacy = await readPinnedOutput(options, FIELD_KIT_RETAINED_RUNTIME, 54);
  const current = await readPinnedOutput(options, FIELD_KIT_RETAINED_RUNTIME_60, 60);
  return retainPresentationOutput(current, legacy);
}
