import { boundedJSON, canonicalJSON, exactKeys, required } from '../data-json.mjs';
import { validateTheme } from '../content.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { creatorAbort, creatorSHA256, ownCreatorBlob } from './bytes.mjs';
import { validateCreatorProvenance, verifyCreatorRoutes } from './templates.mjs';

export const CREATOR_BUNDLE_FORMAT = 'revealline-content-bundle.v1';
export const CREATOR_BUNDLE_LIMITS = Object.freeze({
  bytes: 24 * 1024 * 1024,
  manifestBytes: 2 * 1024 * 1024,
});
export const CREATOR_COMPATIBILITY = freezeDesign({
  format: 'revealline-creator-runtime.v1',
  modes: ['solo'],
  gameplayPolicy: 'compiled-preset-v1',
});
const MAGIC = new TextEncoder().encode('RLCNB1\r\n');
const preparations = new WeakSet(),
  approvals = new WeakMap();
const hashValid = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const copy = (value) =>
  boundedJSON(value, {
    maxBytes: CREATOR_BUNDLE_LIMITS.manifestBytes,
    maxNodes: 100000,
    maxDepth: 26,
    maxArray: 4096,
  });

/** Export scope is determined from the selected pack, never from the browser's
 * media inventory. The first delivery deliberately accepts one complete mission. */
function scopedContent(source) {
  const input = copy(source);
  exactKeys(input, ['project', 'packId', 'themes', 'provenance', 'credits'], 'creator content');
  const compiled = compileContentProject(input.project),
    project = structuredClone(compiled.source);
  const pack = project.packs.find((p) => p.id === input.packId);
  required(pack, 'Select a pack from this project.');
  project.packs = [pack];
  project.campaigns = project.campaigns.filter((c) => pack.campaignIds.includes(c.id));
  const ids = new Set(project.campaigns.flatMap((c) => c.missionIds));
  project.missions = project.missions.filter((m) => ids.has(m.id));
  required(
    project.missions.length === 1 && project.campaigns.length === 1,
    'This creator version packages one image and one mission. Batch campaigns require the next format capability.',
  );
  project.maps = project.maps.filter((map) =>
    project.missions.some((m) => m.map.id === map.id && m.map.revision === map.revision),
  );
  const mission = project.missions[0];
  required(
    mission.modes.length === 1 && mission.modes[0] === 'solo',
    'This creator version supports Solo.',
  );
  project.assets = (project.assets ?? []).filter(
    (asset) => asset.id === mission.presentation.backgroundAssetId,
  );
  required(project.assets.length === 1, 'Attach one reveal picture before reviewing this mission.');
  required(Array.isArray(input.themes), 'Provide the selected presentation theme.');
  const themes = input.themes.filter((theme) => theme.id === mission.presentation.themeId);
  required(
    themes.length === 1 && validateTheme(themes[0]).valid,
    'The mission needs one valid presentation theme.',
  );
  const provenance = validateCreatorProvenance(input.provenance);
  required(
    provenance.missionId === mission.id,
    'Generation evidence belongs to a different mission.',
  );
  exactKeys(input.credits, ['creator', 'picture', 'license'], 'creator credits');
  required(
    Object.values(input.credits).length === 3 &&
      Object.values(input.credits).every(
        (v) => typeof v === 'string' && v.trim() && v.length <= 512,
      ),
    'Review creator, picture credit and sharing permission.',
  );
  return freezeDesign({
    project: compileContentProject(project).source,
    packId: pack.id,
    themes,
    provenance,
    credits: input.credits,
    compatibility: CREATOR_COMPATIBILITY,
  });
}
function scopedAssets(source, wanted) {
  required(
    Array.isArray(source) &&
      Object.getPrototypeOf(source) === Array.prototype &&
      source.length <= 512,
    'Invalid creator asset table.',
  );
  const found = new Map();
  const descriptors = Object.getOwnPropertyDescriptors(source);
  required(
    Reflect.ownKeys(descriptors).length === source.length + 1,
    'Creator asset table must be dense.',
  );
  for (let i = 0; i < source.length; i++) {
    const row = descriptors[i];
    required(
      row && Object.hasOwn(row, 'value') && row.enumerable,
      'Creator assets cannot use accessors.',
    );
    const fields = Object.getOwnPropertyDescriptors(row.value);
    required(
      Reflect.ownKeys(fields).length === 2 &&
        ['sha256', 'blob'].every(
          (key) => fields[key]?.enumerable && Object.hasOwn(fields[key], 'value'),
        ),
      'Creator assets need an owned hash and Blob.',
    );
    const hash = fields.sha256.value;
    required(hashValid(hash) && !found.has(hash), 'Invalid or duplicate creator asset hash.');
    // Unselected library objects are deliberately not read into an export.
    found.set(
      hash,
      wanted.has(hash)
        ? ownCreatorBlob(fields.blob.value, 4 * 1024 * 1024, 'Reveal picture')
        : null,
    );
  }
  required(
    [...wanted].every((hash) => found.get(hash)),
    'The reveal picture is missing. Select it again.',
  );
  return Object.freeze(
    [...wanted].sort().map((sha256) => Object.freeze({ sha256, blob: found.get(sha256) })),
  );
}

/** Only returned, frozen preparations may be approved. Imported approval flags
 * are not part of this format and cannot bypass media or gameplay verification. */
export async function prepareCreatorBundle(source, sourceAssets, { signal, decodeImage } = {}) {
  creatorAbort(signal);
  const content = scopedContent(source),
    asset = content.project.assets[0];
  const assets = scopedAssets(sourceAssets, new Set([asset.sha256]));
  const media = await prepareStillAsset(
    assets[0].blob,
    {
      id: asset.id,
      provenance: {
        kind: 'user-supplied',
        credit: content.credits.picture,
        source: 'Reviewed creator runtime derivative',
      },
    },
    { signal, decodeImage },
  );
  required(
    media.asset.sha256 === asset.sha256 &&
      media.asset.bytes === asset.bytes &&
      media.asset.mime === 'image/png' &&
      media.asset.width === asset.width &&
      media.asset.height === asset.height,
    'Reveal picture bytes differ from the project pin. Prepare and review the picture again.',
  );
  const evidence = await verifyCreatorRoutes(content.project, content.provenance, {
    signal,
    buildVersion: 'creator-route-v1',
  });
  creatorAbort(signal);
  const document = freezeDesign({
    format: CREATOR_BUNDLE_FORMAT,
    content,
    evidence,
    assets: assets.map(({ sha256, blob }) => ({ sha256, bytes: blob.size, mime: 'image/png' })),
  });
  const encoded = new TextEncoder().encode(canonicalJSON(document));
  required(
    encoded.length <= CREATOR_BUNDLE_LIMITS.manifestBytes,
    'Creator manifest exceeds its byte budget.',
  );
  const editionId = await creatorSHA256(encoded);
  creatorAbort(signal);
  const manifest = freezeDesign({ ...document, editionId });
  const manifestBytes = new TextEncoder().encode(canonicalJSON(manifest)).length;
  const bytes = 12 + manifestBytes + assets.reduce((n, a) => n + a.blob.size, 0);
  required(
    manifestBytes <= CREATOR_BUNDLE_LIMITS.manifestBytes && bytes <= CREATOR_BUNDLE_LIMITS.bytes,
    'The pack is too large. Reduce its picture size.',
  );
  const result = Object.freeze({
    manifest,
    assets,
    editionId,
    bytes,
    review: freezeDesign({
      name: content.project.name,
      missions: 1,
      picture: asset,
      credits: content.credits,
      validation:
        'Automated route verified for all Solo presets and steering modes. Visual review is still required.',
    }),
  });
  preparations.add(result);
  return result;
}
export const isPreparedCreatorBundle = (value) => preparations.has(value);

/** Metadata inspection is suitable for browsing, never proof of playable media
 * or a successful route. Deliberate launch still prepares the complete bundle. */
export async function inspectCreatorManifest(source) {
  const manifest = copy(source);
  exactKeys(manifest, ['format', 'content', 'evidence', 'assets', 'editionId'], 'content manifest');
  required(
    manifest.format === CREATOR_BUNDLE_FORMAT && hashValid(manifest.editionId),
    'Invalid content manifest identity.',
  );
  exactKeys(
    manifest.content,
    ['project', 'packId', 'themes', 'provenance', 'credits', 'compatibility'],
    'bundle content',
  );
  const { compatibility, ...content } = manifest.content;
  required(
    canonicalJSON(compatibility) === canonicalJSON(CREATOR_COMPATIBILITY) &&
      canonicalJSON(scopedContent(content)) === canonicalJSON(manifest.content),
    'Content manifest requires unsupported or unrelated content.',
  );
  const asset = manifest.content.project.assets[0];
  required(
    canonicalJSON(manifest.assets) ===
      canonicalJSON([{ sha256: asset.sha256, bytes: asset.bytes, mime: 'image/png' }]),
    'Manifest inventory differs from its required picture.',
  );
  required(
    Array.isArray(manifest.evidence) && manifest.evidence.length === 6,
    'Manifest needs completion evidence for all supported configurations.',
  );
  const { editionId, ...document } = manifest;
  required(
    (await creatorSHA256(new TextEncoder().encode(canonicalJSON(document)))) === editionId,
    'Manifest edition hash differs from its content.',
  );
  return freezeDesign(manifest);
}
export function approveCreatorBundle(prepared) {
  required(preparations.has(prepared), 'Prepare this exact pack before approving it.');
  const approval = Object.freeze({ editionId: prepared.editionId });
  approvals.set(approval, prepared);
  return approval;
}
export function assertCreatorApproval(prepared, approval) {
  required(
    preparations.has(prepared) && approvals.get(approval) === prepared,
    'This approval is stale or belongs to another draft. Review and approve the current pack.',
  );
}
export function exportCreatorBundle(prepared, approval) {
  assertCreatorApproval(prepared, approval);
  const manifest = new TextEncoder().encode(canonicalJSON(prepared.manifest));
  const header = new Uint8Array(12);
  header.set(MAGIC);
  new DataView(header.buffer).setUint32(8, manifest.length, false);
  return new Blob([header, manifest, ...prepared.assets.map((a) => a.blob)], {
    type: 'application/vnd.revealline.content',
  });
}
export async function importCreatorBundle(source, { signal, decodeImage } = {}) {
  creatorAbort(signal);
  const blob = ownCreatorBlob(source, CREATOR_BUNDLE_LIMITS.bytes, 'Content pack');
  required(blob.size >= 12, 'Truncated content pack header.');
  const header = new Uint8Array(await blob.slice(0, 12).arrayBuffer());
  creatorAbort(signal);
  required(
    MAGIC.every((byte, i) => header[i] === byte),
    'Unsupported content pack. Choose an .rlpack file.',
  );
  const length = new DataView(header.buffer).getUint32(8, false);
  required(
    length > 0 && length <= CREATOR_BUNDLE_LIMITS.manifestBytes && length + 12 <= blob.size,
    'Invalid content pack manifest length.',
  );
  const manifest = copy(
    new TextDecoder('utf-8', { fatal: true }).decode(
      await blob.slice(12, 12 + length).arrayBuffer(),
    ),
  );
  exactKeys(manifest, ['format', 'content', 'evidence', 'assets', 'editionId'], 'content bundle');
  required(
    manifest.format === CREATOR_BUNDLE_FORMAT && hashValid(manifest.editionId),
    'Unsupported content bundle identity.',
  );
  exactKeys(
    manifest.content,
    ['project', 'packId', 'themes', 'provenance', 'credits', 'compatibility'],
    'bundle content',
  );
  required(
    canonicalJSON(manifest.content.compatibility) === canonicalJSON(CREATOR_COMPATIBILITY),
    'This pack requires an unsupported creator runtime.',
  );
  required(
    Array.isArray(manifest.assets) && manifest.assets.length === 1,
    'Expected one reveal picture.',
  );
  const assets = [];
  let offset = 12 + length;
  for (const row of manifest.assets) {
    exactKeys(row, ['sha256', 'bytes', 'mime'], 'bundle asset');
    required(
      hashValid(row.sha256) &&
        Number.isSafeInteger(row.bytes) &&
        row.bytes > 0 &&
        row.bytes <= 4 * 1024 * 1024 &&
        offset + row.bytes <= blob.size &&
        row.mime === 'image/png',
      'Invalid or truncated content asset.',
    );
    assets.push({ sha256: row.sha256, blob: blob.slice(offset, offset + row.bytes, row.mime) });
    offset += row.bytes;
  }
  required(offset === blob.size, 'Content pack contains trailing or unrelated bytes.');
  const { compatibility: _compatibility, ...content } = manifest.content;
  const prepared = await prepareCreatorBundle(content, assets, { signal, decodeImage });
  required(
    canonicalJSON(prepared.manifest) === canonicalJSON(manifest),
    'Content identity or completion evidence differs from current verification. Regenerate and review the pack.',
  );
  return prepared;
}

/** Preserve the existing logical PNG path and private verified-artwork brand.
 * A path can only resolve to a dependency in this exact prepared edition. */
export function creatorArtworkLoader(prepared) {
  required(preparations.has(prepared), 'Prepare the content pack before resolving artwork.');
  return (asset, { signal } = {}) =>
    loadPreviewArtwork(asset, {
      signal,
      fetchAsset: async (path) => {
        const pin = prepared.manifest.content.project.assets.find((item) => item.path === path);
        required(
          pin && canonicalJSON(pin) === canonicalJSON(asset),
          'Artwork is outside this installed edition.',
        );
        const bytes = prepared.assets.find((item) => item.sha256 === pin.sha256);
        required(bytes, 'This edition’s picture bytes are missing. Reinstall its exact pack.');
        return new Response(bytes.blob, { headers: { 'Content-Type': 'image/png' } });
      },
    });
}
