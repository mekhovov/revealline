import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { boundedJSON, canonicalJSON, exactKeys, required, stableId } from '../game/data-json.mjs';
import { resolveSoundtrackCatalogue, resolveSoundtrackCollections } from '../game/soundtrack.mjs';
import {
  resolveSoundtrackArchives,
  resolveSoundtrackArchiveInventory,
} from '../game/soundtrack-archive.mjs';

const manifestPath = 'authoring/library/soundtrack-batches.json';
const pinKeys = ['metadata', 'inventory', 'rights', 'technical', 'review', 'delivery'];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const text = (value) => typeof value === 'string' && value.trim().length > 0;
const timestamp = (value) => text(value) && Number.isFinite(Date.parse(value));
const licenses = new Map([
  ['CC0 1.0 Universal', 'https://creativecommons.org/publicdomain/zero/1.0/'],
  ['CC BY 3.0 Unported', 'https://creativecommons.org/licenses/by/3.0/'],
  ['CC BY 4.0 International', 'https://creativecommons.org/licenses/by/4.0/'],
]);
function fields(value, keys, label) {
  exactKeys(value, keys, label);
  required(
    keys.every((key) => Object.hasOwn(value, key)),
    `${label} has missing fields.`,
  );
}
async function read(root, relative) {
  required(
    typeof relative === 'string' &&
      !path.isAbsolute(relative) &&
      !relative.includes('\\') &&
      relative.split('/').every((part) => part && part !== '.' && part !== '..'),
    'Invalid reviewed soundtrack evidence path.',
  );
  let target = root;
  for (const part of relative.split('/')) {
    target = path.join(target, part);
    required(
      !(await lstat(target)).isSymbolicLink(),
      'Reviewed soundtrack evidence cannot use symbolic links.',
    );
  }
  const stat = await lstat(target);
  required(
    stat.isFile() && stat.size > 0 && stat.size <= 512 * 1024,
    'Reviewed soundtrack evidence is empty or oversized.',
  );
  const body = await readFile(target);
  required(
    body.length > 0 && body.length <= 512 * 1024,
    'Reviewed soundtrack evidence exceeds its byte budget.',
  );
  return body;
}
const parse = (body) =>
  boundedJSON(body.toString('utf8'), { maxBytes: 512 * 1024, maxArray: 512, maxNodes: 40000 });
async function pinned(root, id, pin) {
  fields(pin, ['path', 'bytes', 'sha256'], 'reviewed soundtrack evidence pin');
  required(
    typeof pin.path === 'string' &&
      pin.path.startsWith(`authoring/library/soundtrack-batches/${id}/`) &&
      Number.isSafeInteger(pin.bytes) &&
      pin.bytes > 0 &&
      pin.bytes <= 512 * 1024 &&
      /^[a-f0-9]{64}$/.test(pin.sha256),
    'Reviewed soundtrack pins must name bounded batch-local evidence.',
  );
  const body = await read(root, pin.path);
  required(
    body.length === pin.bytes && hash(body) === pin.sha256,
    'Reviewed soundtrack evidence pin differs.',
  );
  return body;
}
function rows(document, kind, id, tracks, extra = []) {
  fields(document, ['format', 'batchId', 'tracks', ...extra], `${kind} evidence`);
  required(
    document.format === `revealline-soundtrack-batch-${kind}.v1` &&
      document.batchId === id &&
      Array.isArray(document.tracks) &&
      document.tracks.length === tracks.length,
    `${kind} evidence inventory differs.`,
  );
  const result = new Map();
  for (const row of document.tracks) {
    const track = tracks.find((entry) => entry.id === row.id);
    required(
      track &&
        !result.has(row.id) &&
        row.sha256 === track.asset.sha256 &&
        row.bytes === track.asset.bytes,
      `${kind} evidence does not bind the exact recording.`,
    );
    result.set(row.id, row);
  }
  return result;
}
async function compileBatch(root, entry, edition) {
  fields(entry, ['id', 'status', ...pinKeys], 'approved soundtrack batch');
  const documents = {};
  for (const key of pinKeys) documents[key] = parse(await pinned(root, entry.id, entry[key]));
  const metadata = documents.metadata;
  fields(
    metadata,
    ['format', 'id', 'catalogue', 'archive', 'collections'],
    'soundtrack batch metadata',
  );
  required(
    metadata.format === 'revealline-soundtrack-batch-metadata.v1' && metadata.id === entry.id,
    'Soundtrack batch metadata identity differs.',
  );
  const catalogue = resolveSoundtrackCatalogue(metadata.catalogue);
  required(
    catalogue.format === 'revealline-soundtrack-catalogue.v2' &&
      catalogue.edition === edition &&
      catalogue.tracks.length > 0,
    'Reviewed soundtrack batch catalogue edition or format differs.',
  );
  const tracks = catalogue.tracks;
  const archive = resolveSoundtrackArchives([metadata.archive])[0];
  required(
    archive.inventorySha256 === entry.inventory.sha256,
    'Reviewed soundtrack inventory pin differs.',
  );
  const inventory = resolveSoundtrackArchiveInventory(documents.inventory, archive);
  required(
    inventory.files.length >= tracks.length &&
      tracks.every(
        (track) =>
          track.archiveId === archive.id &&
          inventory.files.some((file) =>
            same(file, { path: track.path, bytes: track.asset.bytes, sha256: track.asset.sha256 }),
          ),
      ),
    'Reviewed soundtrack catalogue differs from its archive inventory.',
  );
  const rights = rows(documents.rights, 'rights', entry.id, tracks);
  const technical = rows(documents.technical, 'technical', entry.id, tracks);
  const review = rows(documents.review, 'review', entry.id, tracks);
  for (const track of tracks) {
    const grant = rights.get(track.id);
    fields(
      grant,
      [
        'id',
        'sha256',
        'bytes',
        'license',
        'licenseURL',
        'sourceURL',
        'credit',
        'reviewedBy',
        'reviewedAt',
        'evidence',
        'contentId',
        'contentIdEvidence',
      ],
      'recording rights evidence',
    );
    required(
      track.rights.kind === 'licensed' &&
        licenses.has(grant.license) &&
        grant.licenseURL === licenses.get(grant.license) &&
        grant.license === track.rights.license &&
        grant.sourceURL === track.rights.source &&
        grant.credit === track.rights.credit &&
        text(grant.reviewedBy) &&
        timestamp(grant.reviewedAt) &&
        text(track.artist) &&
        text(track.fileName) &&
        track.websites?.some((site) => site.url === grant.sourceURL) &&
        track.websites.some((site) => site.url === grant.licenseURL) &&
        ['webPlayback', 'offlineCache', 'redistribute', 'modify', 'gameplayVideo'].every(
          (key) => track.policy[key] === 'allowed',
        ) &&
        grant.contentId === track.policy.contentId,
      'Reviewed soundtrack rights or attribution differ from the exact licence evidence.',
    );
    await pinned(root, entry.id, grant.evidence);
    if (grant.contentId === 'unknown')
      required(grant.contentIdEvidence === null, 'Unknown Content ID cannot claim verification.');
    else await pinned(root, entry.id, grant.contentIdEvidence);
    const measured = technical.get(track.id);
    fields(
      measured,
      [
        'id',
        'sha256',
        'bytes',
        'decoder',
        'decoderVersion',
        'fullFileDecoded',
        'integratedLUFS',
        'truePeakDbTP',
        'evidence',
      ],
      'recording technical evidence',
    );
    required(
      text(measured.decoder) &&
        text(measured.decoderVersion) &&
        measured.fullFileDecoded === true &&
        Number.isFinite(measured.integratedLUFS) &&
        measured.integratedLUFS >= -17 &&
        measured.integratedLUFS <= -15 &&
        Number.isFinite(measured.truePeakDbTP) &&
        measured.truePeakDbTP <= -1,
      'Reviewed soundtracks require a full native decode and accepted encoded loudness/true peaks.',
    );
    await pinned(root, entry.id, measured.evidence);
    const heard = review.get(track.id);
    fields(
      heard,
      [
        'id',
        'sha256',
        'bytes',
        'approval',
        'reviewedBy',
        'reviewedAt',
        'fullTrack',
        'repeatedSession',
        'inGameTransition',
        'warningAudibility',
        'mono',
        'smallSpeakers',
        'notes',
        'evidence',
        'ukrainianReview',
      ],
      'recording listening evidence',
    );
    required(
      heard.approval === 'approved' &&
        text(heard.reviewedBy) &&
        timestamp(heard.reviewedAt) &&
        text(heard.notes) &&
        [
          'fullTrack',
          'repeatedSession',
          'inGameTransition',
          'warningAudibility',
          'mono',
          'smallSpeakers',
        ].every((key) => heard[key] === true),
      'Reviewed soundtracks require actual complete listening approval.',
    );
    await pinned(root, entry.id, heard.evidence);
    if (track.tags.genres.includes('ukrainian')) {
      fields(
        heard.ukrainianReview,
        ['reviewedBy', 'reviewedAt', 'notes', 'evidence'],
        'Ukrainian musical review',
      );
      required(
        text(heard.ukrainianReview.reviewedBy) &&
          timestamp(heard.ukrainianReview.reviewedAt) &&
          text(heard.ukrainianReview.notes),
        'Ukrainian recordings require a named musical reviewer and regional-context notes.',
      );
      await pinned(root, entry.id, heard.ukrainianReview.evidence);
    } else
      required(
        heard.ukrainianReview === null,
        'Unexpected Ukrainian review for an unclassified recording.',
      );
  }
  const delivery = documents.delivery;
  fields(
    delivery,
    [
      'format',
      'batchId',
      'baseURL',
      'inventorySha256',
      'verified',
      'verifiedAt',
      'deployRunURL',
      'files',
    ],
    'reviewed soundtrack delivery',
  );
  required(
    delivery.format === 'revealline-soundtrack-batch-delivery.v1' &&
      delivery.batchId === entry.id &&
      delivery.baseURL === archive.baseURL &&
      delivery.inventorySha256 === archive.inventorySha256 &&
      delivery.verified === true &&
      timestamp(delivery.verifiedAt) &&
      /^https:\/\/github\.com\/mekhovov\/revealline-soundtracks-[0-9]+\/actions\/runs\/[0-9]+$/.test(
        delivery.deployRunURL,
      ) &&
      new URL(delivery.deployRunURL).pathname.split('/')[2] ===
        new URL(archive.baseURL).pathname.split('/')[1] &&
      Array.isArray(delivery.files) &&
      delivery.files.length === inventory.files.length,
    'Reviewed soundtrack delivery does not identify its verified public deployment.',
  );
  const delivered = new Set();
  for (const file of delivery.files) {
    fields(
      file,
      ['path', 'bytes', 'sha256', 'url', 'status', 'verified'],
      'reviewed public recording',
    );
    required(
      !delivered.has(file.path) &&
        file.status === 200 &&
        file.verified === true &&
        file.url === new URL(file.path, archive.baseURL).href &&
        inventory.files.some((object) =>
          same(object, { path: file.path, bytes: file.bytes, sha256: file.sha256 }),
        ),
      'Reviewed soundtrack public bytes differ from the exact inventory.',
    );
    delivered.add(file.path);
  }
  const collections = resolveSoundtrackCollections(metadata.collections);
  const members = new Set();
  for (const collection of collections)
    for (const id of collection.trackIds) {
      required(
        tracks.some((track) => track.id === id) && !members.has(id),
        'Reviewed soundtrack album membership is unknown or duplicated.',
      );
      members.add(id);
    }
  required(members.size === tracks.length, 'Every reviewed recording requires exactly one album.');
  return { tracks, archives: [archive], collections };
}

/** Code-owned, pinned admission only. Pending work never changes runtime output.
 * This compiler verifies recorded evidence; it does not perform or invent listening. */
export async function compileReviewedSoundtrackBatches(
  root,
  edition,
  existing = { tracks: [], archives: [], collections: [] },
) {
  let manifest;
  try {
    manifest = parse(await read(root, manifestPath));
  } catch (error) {
    if (error.code === 'ENOENT') return { tracks: [], archives: [], collections: [] };
    throw error;
  }
  fields(manifest, ['format', 'batches'], 'reviewed soundtrack batches');
  required(
    manifest.format === 'revealline-reviewed-soundtrack-batches.v1' &&
      Array.isArray(manifest.batches) &&
      manifest.batches.length <= 64,
    'Invalid reviewed soundtrack batches.',
  );
  const result = { tracks: [], archives: [], collections: [] },
    ids = new Set();
  for (const entry of manifest.batches) {
    exactKeys(entry, ['id', 'status', ...pinKeys], 'reviewed soundtrack batch');
    required(
      stableId(entry.id) && !ids.has(entry.id) && ['pending', 'approved'].includes(entry.status),
      'Invalid or duplicate reviewed soundtrack batch.',
    );
    ids.add(entry.id);
    if (entry.status === 'pending') continue;
    const batch = await compileBatch(root, entry, edition);
    for (const key of ['tracks', 'archives', 'collections']) result[key].push(...batch[key]);
  }
  const allTracks = [...existing.tracks, ...result.tracks],
    hashes = new Set(existing.tracks.map((track) => track.asset.sha256)),
    allArchives = [...existing.archives],
    newArchives = [];
  for (const track of result.tracks) {
    required(
      !hashes.has(track.asset.sha256),
      'Reviewed batches cannot duplicate an existing recording hash.',
    );
    hashes.add(track.asset.sha256);
  }
  for (const archive of result.archives) {
    const prior = allArchives.find(
      (other) => other.id === archive.id || other.baseURL === archive.baseURL,
    );
    required(
      !prior || same(prior, archive),
      'Reviewed batches cannot replace an existing archive identity, origin or inventory pin.',
    );
    if (!prior) {
      allArchives.push(archive);
      newArchives.push(archive);
    }
  }
  result.archives = newArchives;
  resolveSoundtrackCatalogue({
    format: 'revealline-soundtrack-catalogue.v2',
    edition,
    tracks: allTracks,
  });
  resolveSoundtrackArchives(allArchives);
  resolveSoundtrackCollections([...existing.collections, ...result.collections]);
  return result;
}
