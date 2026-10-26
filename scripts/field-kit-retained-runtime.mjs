import { createHash } from 'node:crypto';
import { retainPresentationOutput } from './retain-presentation-output.mjs';
import { canonicalJSON, required } from '../game/data-json.mjs';
import { verifyPresentationDependencies } from '../game/presentation/dependencies.mjs';

// Sanitized successors of retained releases; exact predecessor hashes are in the migration ledger.
// New retained revisions require explicit inputs and separately reviewed policy.
export const FIELD_KIT_RETAINED_RUNTIME_38 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.e4d16e7b206f50023a1f67249c9be63f9968975071cf16ea0802891ca122e3b3.json',
  sha256: 'e4d16e7b206f50023a1f67249c9be63f9968975071cf16ea0802891ca122e3b3',
  bytes: 808787,
  predecessorCommit: '432110b51c570b838cdae390790b67dfa76f0785',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_RUNTIME_50 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.666e68e92f7472368ed915fdf434dff25958553121bc504c8a9b71724386bcae.json',
  sha256: '666e68e92f7472368ed915fdf434dff25958553121bc504c8a9b71724386bcae',
  bytes: 818280,
  predecessorCommit: 'e9434d03feb30bf8767051b2832a4ab987b2fa41',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_RUNTIME = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.8ea2d74576591eaba4bdf67ed506d2ed766a10e1cd3ce972ec14861a4d097501.json',
  sha256: '8ea2d74576591eaba4bdf67ed506d2ed766a10e1cd3ce972ec14861a4d097501',
  bytes: 819016,
  predecessorCommit: 'b810521a53af7be145acb8dedce0a01a747339cf',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_RUNTIME_58 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.b3a79b85a00b8bc8b70a12fcc7aedfe6667ea8d3da64ea4baab85fb28b52e12c.json',
  sha256: 'b3a79b85a00b8bc8b70a12fcc7aedfe6667ea8d3da64ea4baab85fb28b52e12c',
  bytes: 820068,
  predecessorCommit: '6842203fbf24db198da21759e23d5c5c64d499dd',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_RUNTIME_60 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.3d1cfb93d141f08b1f9cee06a3a528e10aab688634a36eed665a7d4e7e912b9b.json',
  sha256: '3d1cfb93d141f08b1f9cee06a3a528e10aab688634a36eed665a7d4e7e912b9b',
  bytes: 921580,
  predecessorCommit: 'bc8b7565f2c4277145b4763d76d928c45e024f1c',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_RUNTIME_62 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.af2d1d398ca56ec365899940d27f790c2b406d385461e89a1dc8fcbbcede6972.json',
  sha256: 'af2d1d398ca56ec365899940d27f790c2b406d385461e89a1dc8fcbbcede6972',
  bytes: 921950,
  predecessorCommit: '2e64c130d219dfece5134ba9119b85a5bf34904d',
  originalPath: 'game/presentation/compiled/runtime.json',
});
// Independent release/candidate lineages use exact runtime hashes. Numeric
// theme revisions alone cannot distinguish their immutable promises.
export const FIELD_KIT_RETAINED_DISCOVERY101 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.ebeb38f511c01b48daa84eb824e1521b43bddbfb0e16345c952b7b822b19db5b.json',
  sha256: 'ebeb38f511c01b48daa84eb824e1521b43bddbfb0e16345c952b7b822b19db5b',
  bytes: 1005846,
  predecessorCommit: 'd541946f4e9d49e97cfcb2b0ce4054f3dac7d2cf',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_DISCOVERY102 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.911a111fb2cfd2fdbae9da95ae13602800cfdccb8a3b7e3545ffce61579b38f5.json',
  sha256: '911a111fb2cfd2fdbae9da95ae13602800cfdccb8a3b7e3545ffce61579b38f5',
  bytes: 1072278,
  predecessorCommit: 'db8e45e0e4dcfb9c57a4d942c424ae04ee147b16',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_DISCOVERY103 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.3074a0964b6f451500b7f104c62d17d876ee2058488a830365ad5ed23ff3cfaa.json',
  sha256: '3074a0964b6f451500b7f104c62d17d876ee2058488a830365ad5ed23ff3cfaa',
  bytes: 1077814,
  predecessorCommit: 'db4b2c8e89f3c9a3c0b67d6e7e5f64f08ea3c6ef',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_MAIN101 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.a78a35c1f86b8192cd10f4582eac7bcbbc3411f6a78b9746cfbfc72da3384dc0.json',
  sha256: 'a78a35c1f86b8192cd10f4582eac7bcbbc3411f6a78b9746cfbfc72da3384dc0',
  bytes: 1046822,
  predecessorCommit: '321408a3cfd75ae230d760f39fb692503652601a',
  originalPath: 'game/presentation/compiled/runtime.json',
});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
// The pre-radio canonical 102 is a separate promise from discovery 102.
export const FIELD_KIT_RETAINED_RADIO_PREDECESSOR102 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.649a6f8b94cac1fd2f81e05c5647e0e85e16cd7858c592ae5bdbdc85481b384f.json',
  sha256: '649a6f8b94cac1fd2f81e05c5647e0e85e16cd7858c592ae5bdbdc85481b384f',
  bytes: 1073942,
  predecessorCommit: '280321ca77eef81d1bce9de8c23247548ae9dd03',
  originalPath: 'game/presentation/compiled/runtime.json',
});

// The accepted radio canonical103 remains distinct from discovery103.
export const FIELD_KIT_RETAINED_NATIVE_PREDECESSOR103 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.7acb0bb2793781d0d5bbb774eeda05f38bfa30dcf71dc6a600a652bb7718f589.json',
  sha256: '7acb0bb2793781d0d5bbb774eeda05f38bfa30dcf71dc6a600a652bb7718f589',
  bytes: 1075486,
  predecessorCommit: '1b99d2ea791074ff79f6be9b8176594b0733874f',
  originalPath: 'game/presentation/compiled/runtime.json',
});

// This retained successor preserves shared payloads from canonical104.
// Its new digest does not claim byte identity with the original release.
export const FIELD_KIT_RETAINED_CANONICAL104 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.087e920b6c20d5f8adb64b4824a954c998799a18becd5dbe1030fd007de69ce8.json',
  sha256: '087e920b6c20d5f8adb64b4824a954c998799a18becd5dbe1030fd007de69ce8',
  bytes: 1089502,
  predecessorCommit: 'c5e22bc860e9021d42ce326761d0f4decba3fc40',
  predecessorBlob: 'c27b56d8195b0675d2657dbdb7f284b7955571f2',
  originalPath: 'game/presentation/compiled/runtime.json',
});

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

/** Preserve published38/50 imports, committed54, accepted58, retained60/62, both101–103 lineages and canonical104
 * by manifest identity, with their complete lazy
 * dependencies. New ledger revisions never authorize implicit output-directory IO. */
export async function readFieldKitRetainedOutput(options) {
  const historical38 = await readPinnedOutput(options, FIELD_KIT_RETAINED_RUNTIME_38, 38);
  const historical50 = await readPinnedOutput(options, FIELD_KIT_RETAINED_RUNTIME_50, 50);
  const legacy = await retainPresentationOutput(
    await readPinnedOutput(options, FIELD_KIT_RETAINED_RUNTIME, 54),
    await retainPresentationOutput(historical50, historical38),
  );
  const accepted = await readPinnedOutput(options, FIELD_KIT_RETAINED_RUNTIME_58, 58);
  const held = await readPinnedOutput(options, FIELD_KIT_RETAINED_RUNTIME_60, 60);
  const actors = await readPinnedOutput(options, FIELD_KIT_RETAINED_RUNTIME_62, 62);
  let previous = await retainPresentationOutput(
    actors,
    await retainPresentationOutput(held, await retainPresentationOutput(accepted, legacy)),
  );
  for (const [pin, revision] of [
    [FIELD_KIT_RETAINED_DISCOVERY101, 101],
    [FIELD_KIT_RETAINED_DISCOVERY102, 102],
    [FIELD_KIT_RETAINED_DISCOVERY103, 103],
    [FIELD_KIT_RETAINED_MAIN101, 101],
    [FIELD_KIT_RETAINED_RADIO_PREDECESSOR102, 102],
    [FIELD_KIT_RETAINED_NATIVE_PREDECESSOR103, 103],
    [FIELD_KIT_RETAINED_CANONICAL104, 104],
  ])
    previous = await retainPresentationOutput(
      await readPinnedOutput(options, pin, revision),
      previous,
    );
  return previous;
}
