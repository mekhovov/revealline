import { boundedJSON, canonicalJSON, required } from '../../game/data-json.mjs';
import { validateAssetRevision, freezePresentation } from '../../game/presentation/model.mjs';
import { imagePresentation } from '../../game/presentation/runtime.mjs';
import {
  FIELD_KIT_CANDIDATE_PIVOT,
  FIELD_KIT_CANDIDATE_RIGS,
} from '../../game/presentation/rotor-candidate-art.mjs';
import { decodeOwnedPicture } from '../../game/ui/presentation-image.mjs';
import { inspectImageDataUrl } from '../../game/content.mjs';

// Named source studies, never a caller-supplied path or a latest-release alias.
// V3 retains its four-entry manifest; only its Scout images are fetched here.
export const SCOUT_COMPARISON_COHORTS = freezePresentation({
  'reference-v3': {
    directory: 'authoring/library/fpv-body-detail-candidates',
    format: 'revealline.rotor-body-detail-candidates.v1',
    assetRevision: 1,
    roles: ['scout', 'carrier'],
    sources: [
      'game/presentation/rotor-body-detail-art.mjs',
      'game/presentation/rotor-candidate-art.mjs',
      'game/presentation/pixel-art.mjs',
    ],
  },
  'reference-v4': {
    directory: 'authoring/library/fpv-body-contrast-candidates',
    format: 'revealline.rotor-body-detail-candidates.v1',
    assetRevision: 1,
    roles: ['scout'],
    sources: [
      'game/presentation/rotor-body-contrast-art.mjs',
      'game/presentation/rotor-body-detail-art.mjs',
      'game/presentation/rotor-candidate-art.mjs',
      'game/presentation/pixel-art.mjs',
    ],
  },
});
const hash = async (bytes) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
const equal = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const releaseImage = (image) => {
  image?.removeAttribute?.('src');
  image?.close?.();
};

async function readBytes(path, limit, request, signal) {
  signal.throwIfAborted();
  const response = await request(new URL(path, new URL('../../', import.meta.url)), {
    signal,
    redirect: 'error',
    cache: 'no-cache',
  });
  signal.throwIfAborted();
  required(response.ok && !response.redirected, `Candidate file is unavailable: ${path}.`);
  required(response.body?.getReader, 'Candidate streaming is unavailable.');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      signal.throwIfAborted();
      if (done) break;
      size += value.byteLength;
      required(size <= limit, `Candidate file exceeds its byte budget: ${path}.`);
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function scoutAssets(manifest, construction, cohort) {
  required(
    manifest.format === cohort.format &&
      manifest.status === 'source-candidate-not-runtime-default' &&
      manifest.construction === construction,
    `Choose the source-only ${construction} manifest.`,
  );
  required(
    equal(Object.keys(manifest.sources ?? {}).sort(), [...cohort.sources].sort()),
    'Candidate source fingerprint list differs from the native study.',
  );
  const slots = cohort.roles.flatMap((role) =>
    ['compact', 'detailed'].map((treatment) => `player.${role}.${treatment}`),
  );
  required(
    Array.isArray(manifest.assets) &&
      manifest.assets.length === slots.length &&
      equal(manifest.assets.map((record) => record?.slot).sort(), [...slots].sort()),
    'Candidate manifest entries differ from the named cohort.',
  );
  return slots
    .map((slot) => {
      const [, role, treatment] = slot.split('.');
      const records = manifest.assets.filter((record) => record.slot === slot);
      required(records?.length === 1, `Candidate manifest needs exactly one ${slot}.`);
      const record = records[0];
      const asset = validateAssetRevision(record.assetRevision);
      const side = treatment === 'compact' ? 32 : 64;
      required(
        record.id === `candidate.${construction}.${role}.${treatment}` &&
          asset.id === record.id &&
          asset.revision === cohort.assetRevision &&
          asset.kind === 'image' &&
          asset.quality.stage === 'produced' &&
          record.treatment === treatment &&
          record.path === `${cohort.directory}/${role}.${treatment}.png`,
        'Candidate slot identity or source status differs.',
      );
      required(
        record.width === side &&
          record.height === side &&
          record.bytes > 0 &&
          record.bytes <= 16384 &&
          equal(asset.file, {
            sha256: record.sha256,
            bytes: record.bytes,
            mime: 'image/png',
            width: side,
            height: side,
          }),
        'Candidate image declaration differs from its native frame.',
      );
      required(
        equal(record.geometry, asset.geometry) &&
          equal(asset.geometry.frame, { x: 0, y: 0, width: side, height: side }) &&
          equal(asset.geometry.pivot, FIELD_KIT_CANDIDATE_PIVOT) &&
          equal(asset.geometry.rotorAnchors, FIELD_KIT_CANDIDATE_RIGS[role]) &&
          equal(asset.geometry.occupiedBounds, record.inspection?.occupiedBounds) &&
          asset.geometry.nineSlice === null,
        'Candidate geometry differs from the retained native frame, pivot or rotor anchors.',
      );
      return { record, asset };
    })
    .filter(({ record }) => record.slot.startsWith('player.scout.'));
}

/** A source-study image override, deliberately without resolved release or pin
 * authority. Every non-Scout slot delegates to the caller's approved lease. */
export async function acquireScoutComparison(
  approvedSnapshot,
  {
    signal,
    construction = 'reference-v3',
    treatment = 'auto',
    fetch: request = globalThis.fetch,
    decodeImage,
    timeoutMs = 15000,
  } = {},
) {
  required(
    typeof approvedSnapshot?.image === 'function',
    'An approved actor snapshot is required.',
  );
  required(['auto', 'compact', 'detailed'].includes(treatment), 'Unknown candidate treatment.');
  required(
    typeof construction === 'string' && Object.hasOwn(SCOUT_COMPARISON_COHORTS, construction),
    'Unknown candidate construction.',
  );
  const cohort = SCOUT_COMPARISON_COHORTS[construction];
  const manifestPath = `${cohort.directory}/manifest.json`;
  required(timeoutMs > 0 && timeoutMs <= 15000, 'Invalid candidate timeout.');
  const controller = new AbortController();
  const frames = new Map();
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    for (const frame of frames.values()) releaseImage(frame.image);
    frames.clear();
  };
  let timer, cancel;
  const stopped = new Promise((_, reject) => {
    cancel = () => {
      controller.abort();
      reject(new DOMException('Candidate comparison cancelled.', 'AbortError'));
    };
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Candidate comparison did not load in time.'));
    }, timeoutMs);
    if (signal?.aborted) cancel();
  });
  try {
    return await Promise.race([
      stopped,
      (async () => {
        const bytes = await readBytes(manifestPath, 98304, request, controller.signal);
        const manifest = boundedJSON(JSON.parse(new TextDecoder().decode(bytes)), {
          maxBytes: 98304,
        });
        const assets = scoutAssets(manifest, construction, cohort);
        for (const path of cohort.sources) {
          const source = await readBytes(path, 262144, request, controller.signal);
          required(
            (await hash(source)) === manifest.sources[path],
            `Candidate source fingerprint differs: ${path}.`,
          );
        }
        for (const { record, asset } of assets) {
          const png = await readBytes(record.path, record.bytes, request, controller.signal);
          required(
            png.byteLength === record.bytes && (await hash(png)) === record.sha256,
            'Candidate PNG byte length or SHA-256 differs from its manifest.',
          );
          const dataUrl = `data:image/png;base64,${btoa(String.fromCharCode(...png))}`;
          const header = inspectImageDataUrl(dataUrl);
          required(
            header.valid && header.width === record.width && header.height === record.height,
            'Candidate PNG dimensions differ from its native frame.',
          );
          const image = await decodeOwnedPicture(dataUrl, {
            signal: controller.signal,
            decodeImage,
          });
          if (controller.signal.aborted || released) {
            releaseImage(image);
            controller.signal.throwIfAborted();
            throw new Error('Candidate comparison was released.');
          }
          frames.set(
            record.slot,
            Object.freeze({ image, asset, geometry: imagePresentation(asset) }),
          );
          required(
            image.width === record.width &&
              image.height === record.height &&
              (image.naturalWidth ?? image.width) === record.width &&
              (image.naturalHeight ?? image.height) === record.height,
            'Decoded candidate dimensions differ from the manifest.',
          );
        }
        controller.signal.throwIfAborted();
        const provenance = freezePresentation({
          kind: 'source-only-actor-comparison',
          status: manifest.status,
          construction: manifest.construction,
          manifest: { path: manifestPath, bytes: bytes.byteLength, sha256: await hash(bytes) },
          sources: manifest.sources,
          treatment,
          referenceConcept: manifest.referenceConcept,
          referenceUse: manifest.referenceUse,
          productionRegistered: false,
          assets: assets.map(({ record, asset }) => ({
            slot: record.slot,
            path: record.path,
            assetRevision: asset,
          })),
        });
        controller.signal.throwIfAborted();
        const snapshot = Object.freeze({
          image(slot) {
            required(!released, 'Candidate comparison is released.');
            if (frames.has(slot))
              return frames.get(treatment === 'auto' ? slot : `player.scout.${treatment}`);
            return approvedSnapshot.image(slot);
          },
        });
        return Object.freeze({ snapshot, provenance, release });
      })(),
    ]);
  } catch (error) {
    release();
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
    controller.abort();
  }
}
