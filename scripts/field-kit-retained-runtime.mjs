import { createHash } from 'node:crypto';
import { retainPresentationOutput } from './retain-presentation-output.mjs';
import { canonicalJSON, required } from '../game/data-json.mjs';
import { verifyPresentationDependencies } from '../game/presentation/dependencies.mjs';

// Original committed bytes, not a reserialization of the revision ledger.
// New retained revisions require explicit inputs and separately reviewed policy.
export const FIELD_KIT_RETAINED_RUNTIME_38 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.a0ad21cd1412fed07b73dbf0e1ec31ded747a8210a97ccc1efeb1e2c26b24584.json',
  sha256: 'a0ad21cd1412fed07b73dbf0e1ec31ded747a8210a97ccc1efeb1e2c26b24584',
  bytes: 968465,
  commit: '432110b51c570b838cdae390790b67dfa76f0785',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_RUNTIME_50 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.29298673ed6cc49222b1d52d77efc4f8968abe42a29df5c29b2861bd8f9ce1ed.json',
  sha256: '29298673ed6cc49222b1d52d77efc4f8968abe42a29df5c29b2861bd8f9ce1ed',
  bytes: 977958,
  commit: 'e9434d03feb30bf8767051b2832a4ab987b2fa41',
  originalPath: 'game/presentation/compiled/runtime.json',
});
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
// Independent release/candidate lineages use exact runtime hashes. Numeric
// theme revisions alone cannot distinguish their immutable promises.
export const FIELD_KIT_RETAINED_DISCOVERY101 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.ca5f264f6a62c10a4e51c6a0296866edbb340f6db75118d8aa11f92a8c9a9f93.json',
  sha256: 'ca5f264f6a62c10a4e51c6a0296866edbb340f6db75118d8aa11f92a8c9a9f93',
  bytes: 1178803,
  commit: 'd541946f4e9d49e97cfcb2b0ce4054f3dac7d2cf',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_DISCOVERY102 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.2706697f90141845bad18c9d47bac82ef0648ceb0bf12834e7ee7c07e1e42262.json',
  sha256: '2706697f90141845bad18c9d47bac82ef0648ceb0bf12834e7ee7c07e1e42262',
  bytes: 1247371,
  commit: 'db8e45e0e4dcfb9c57a4d942c424ae04ee147b16',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_DISCOVERY103 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.813ce5598736109011290a38ce3bbf257375d1e45f496ba60237bf4725bc81ca.json',
  sha256: '813ce5598736109011290a38ce3bbf257375d1e45f496ba60237bf4725bc81ca',
  bytes: 1252907,
  commit: 'db4b2c8e89f3c9a3c0b67d6e7e5f64f08ea3c6ef',
  originalPath: 'game/presentation/compiled/runtime.json',
});
export const FIELD_KIT_RETAINED_MAIN101 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.7e8db95cec2eaab6b031e12bb44e036173611539393d44bbdfc50ff784d098b8.json',
  sha256: '7e8db95cec2eaab6b031e12bb44e036173611539393d44bbdfc50ff784d098b8',
  bytes: 1221603,
  commit: '321408a3cfd75ae230d760f39fb692503652601a',
  originalPath: 'game/presentation/compiled/runtime.json',
});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
// The pre-radio canonical 102 is a separate promise from discovery 102.
export const FIELD_KIT_RETAINED_RADIO_PREDECESSOR102 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.92f09d9eb867989438991f116ee8a192cee6ac8c2e3f286297aa184257c96f78.json',
  sha256: '92f09d9eb867989438991f116ee8a192cee6ac8c2e3f286297aa184257c96f78',
  bytes: 1249035,
  commit: '280321ca77eef81d1bce9de8c23247548ae9dd03',
  originalPath: 'game/presentation/compiled/runtime.json',
});

// The accepted radio canonical103 remains distinct from discovery103.
export const FIELD_KIT_RETAINED_NATIVE_PREDECESSOR103 = Object.freeze({
  path: 'authoring/library/fpv-field-kit/retained/runtime.3663f75cfc922f63f99e2e57ac4fc82ce65a45e25af1624c29178c69f7f7af44.json',
  sha256: '3663f75cfc922f63f99e2e57ac4fc82ce65a45e25af1624c29178c69f7f7af44',
  bytes: 1250579,
  commit: '1b99d2ea791074ff79f6be9b8176594b0733874f',
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

/** Preserve published38/50 imports, committed54, accepted58, retained60/62 and both101–103 lineages
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
  ])
    previous = await retainPresentationOutput(
      await readPinnedOutput(options, pin, revision),
      previous,
    );
  return previous;
}
