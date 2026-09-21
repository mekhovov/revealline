import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { boundedJSON, canonicalJSON, exactKeys, required } from '../game/data-json.mjs';
import {
  resolveSoundtrackArchives,
  resolveSoundtrackArchiveInventory,
} from '../game/soundtrack-archive.mjs';
import { resolveSoundtrackCatalogue, resolveSoundtrackCollections } from '../game/soundtrack.mjs';

const folder = 'authoring/library/licensed-audio/';
const digest = (body) => createHash('sha256').update(body).digest('hex');
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
export const hostedSoundtrackId = (id) =>
  `builtin.catalog.${id.length <= 64 ? id : `${id.slice(0, 47)}-${digest(id).slice(0, 16)}`}`;
const sourcePaths = [
  `${folder}sources.json`,
  `${folder}production-register.json`,
  `${folder}provenance/license-revalidation.json`,
  `${folder}preview-authorization.json`,
  'docs/verification/music-publication-2026-09-21/rights-audit.json',
  'docs/verification/music-publication-2026-09-21/public-delivery.json',
];
const snapshotPaths = [
  'hosted-preview-catalogue.json',
  'hosted-inventory.json',
  'hosted-public-albums.json',
].map((name) => folder + name);
async function read(root, relative) {
  required(
    typeof relative === 'string' &&
      !path.isAbsolute(relative) &&
      !relative.includes('\\') &&
      relative.split('/').every((part) => part && part !== '.' && part !== '..'),
    'Invalid hosted music evidence path.',
  );
  let target = root;
  for (const part of relative.split('/')) {
    target = path.join(target, part);
    required(
      !(await lstat(target)).isSymbolicLink(),
      'Hosted music evidence cannot use symbolic links.',
    );
  }
  const stat = await lstat(target);
  required(
    stat.isFile() && stat.size <= 512 * 1024,
    'Hosted music evidence is missing or oversized.',
  );
  return readFile(target);
}
const parse = (body) =>
  boundedJSON(body.toString('utf8'), { maxBytes: 512 * 1024, maxArray: 512, maxNodes: 40000 });

/** Admission of already published, rights-audited recordings. No audio reads,
 * downloads, listening assertions or imported URL authority occur in a build. */
export async function compileHostedSoundtracks(root, edition) {
  let publication;
  try {
    publication = parse(await read(root, `${folder}hosted-publication.json`));
  } catch (error) {
    if (error.code === 'ENOENT') return { tracks: [], archives: [], collections: [] };
    throw error;
  }
  exactKeys(
    publication,
    [
      'format',
      'edition',
      'status',
      'gameCatalogueAdmission',
      'listeningApproval',
      'authorization',
      'archive',
      'provenance',
      'tracks',
      'collections',
    ],
    'hosted publication',
  );
  required(
    publication.format === 'revealline-hosted-licensed-publication.v1' &&
      publication.status === 'rights-audited-listening-pending' &&
      publication.gameCatalogueAdmission === true &&
      publication.listeningApproval === false &&
      publication.authorization?.kind === 'explicit-project-owner-request',
    'Hosted publication needs explicit game admission distinct from listening approval.',
  );
  const provenance = publication.provenance;
  required(
    Array.isArray(provenance?.pins) &&
      Array.isArray(provenance.remoteMetadata) &&
      same(
        provenance.pins.map((pin) => pin.path),
        sourcePaths,
      ) &&
      same(
        provenance.remoteMetadata.map((pin) => pin.path),
        snapshotPaths,
      ),
    'Hosted publication needs the complete pinned source and delivery evidence.',
  );
  const documents = new Map();
  for (const pin of [...provenance.pins, ...provenance.remoteMetadata]) {
    const body = await read(root, pin.path);
    required(
      body.length === pin.bytes && digest(body) === pin.sha256,
      'Hosted soundtrack evidence pin differs.',
    );
    documents.set(pin.path, parse(body));
  }
  const register = documents.get(sourcePaths[1]);
  const preview = documents.get(snapshotPaths[0]);
  const publicAlbums = documents.get(snapshotPaths[2]);
  const audit = documents.get(sourcePaths[4]);
  const delivery = documents.get(sourcePaths[5]);
  const archive = resolveSoundtrackArchives([publication.archive])[0];
  required(
    archive.inventorySha256 === provenance.remoteMetadata[1].sha256,
    'Hosted inventory pin differs.',
  );
  const inventory = resolveSoundtrackArchiveInventory(documents.get(snapshotPaths[1]), archive);
  required(
    delivery.verified === true &&
      delivery.baseURL === archive.baseURL &&
      Array.isArray(publication.tracks) &&
      publication.tracks.length > 0 &&
      publication.tracks.length <= 256 &&
      publication.tracks.length === audit.decision?.rightsEligibleTracks &&
      publication.tracks.length === inventory.files.length &&
      publication.tracks.length === preview.tracks.length &&
      publication.tracks.length === register.tracks.length,
    'Hosted publication inventory or rights audit differs.',
  );
  const ids = new Set(),
    hashes = new Set();
  const tracks = publication.tracks.map((entry) => {
    exactKeys(
      entry,
      [
        'id',
        'albumId',
        'title',
        'artist',
        'fileName',
        'source',
        'license',
        'licenseURL',
        'credit',
        'changes',
        'artistURL',
        'asset',
        'websites',
        'policy',
        'tags',
        'archivePath',
        'conversion',
        'listeningStatus',
      ],
      'hosted recording',
    );
    const source = register.tracks.find((track) => track.id === entry.id);
    const published = preview.tracks.find((track) => track.id === entry.id);
    required(
      source && published && !ids.has(entry.id) && !hashes.has(entry.asset?.sha256),
      'Hosted recording is unknown or duplicated.',
    );
    ids.add(entry.id);
    hashes.add(entry.asset.sha256);
    const websites = [...source.websites];
    if (published.artistURL && !websites.some((website) => website.url === published.artistURL))
      websites.push({ label: 'Artist attribution website', url: published.artistURL });
    required(
      [
        'id',
        'albumId',
        'title',
        'artist',
        'fileName',
        'source',
        'license',
        'licenseURL',
        'credit',
        'asset',
        'policy',
        'tags',
      ].every((key) => same(entry[key], source[key])) &&
        same(entry.websites, websites) &&
        ['changes', 'conversion', 'artistURL'].every((key) => same(entry[key], published[key])) &&
        entry.listeningStatus === 'pending' &&
        source.licenseReview.publicationEligible === true &&
        source.policy.webPlayback === 'allowed' &&
        source.policy.offlineCache === 'allowed' &&
        source.policy.redistribute === 'allowed' &&
        ['CC0 1.0 Universal', 'CC BY 3.0 Unported', 'CC BY 4.0 International'].includes(
          entry.license,
        ),
      'Hosted recording attribution, rights, classification or review status differs from the audited source.',
    );
    const object = {
      path: entry.archivePath,
      bytes: entry.asset.bytes,
      sha256: entry.asset.sha256,
    };
    required(
      inventory.files.some((file) => same(file, object)) &&
        delivery.files.some(
          (file) =>
            file.path === object.path &&
            file.bytes === object.bytes &&
            file.sha256 === object.sha256 &&
            file.verified === true,
        ),
      'Hosted recording is not covered by exact public delivery verification.',
    );
    const id = hostedSoundtrackId(entry.id);
    return {
      format: 'revealline-audio-track.v1',
      id,
      kind: 'mp3',
      title: entry.title,
      artist: entry.artist,
      asset: entry.asset,
      rights: {
        kind: 'licensed',
        credit: entry.credit,
        license: entry.license,
        source: entry.source,
      },
      edition,
      path: entry.archivePath,
      archiveId: archive.id,
      tags: entry.tags,
      policy: { ...entry.policy, id },
      fileName: entry.fileName,
      websites: entry.websites,
    };
  });
  required(
    Array.isArray(publication.collections) &&
      publication.collections.length === publicAlbums.albums.length,
    'Hosted collection inventory differs.',
  );
  const members = new Set();
  const collections = resolveSoundtrackCollections(
    publication.collections.map((entry) => {
      exactKeys(
        entry,
        ['id', 'title', 'genre', 'description', 'trackIds', 'order', 'repeat', 'download'],
        'hosted collection',
      );
      const album = publicAlbums.albums.find((item) => item.id === entry.id);
      required(
        album &&
          ['id', 'title', 'genre', 'description', 'trackIds'].every((key) =>
            same(entry[key], album[key]),
          ) &&
          same(entry.download, {
            url: album.downloadURL,
            fileName: album.fileName,
            bytes: album.bytes,
            sha256: album.sha256,
          }),
        'Hosted collection differs from the published album.',
      );
      for (const id of entry.trackIds) {
        required(
          ids.has(id) && !members.has(id),
          'Hosted album membership is missing or duplicated.',
        );
        members.add(id);
      }
      return {
        id: `builtin.album.${entry.id}`,
        title: entry.title,
        description: entry.description,
        genre: tracks.find((track) => track.id === hostedSoundtrackId(entry.trackIds[0])).tags
          .genres[0],
        trackIds: entry.trackIds.map(hostedSoundtrackId),
        order: entry.order,
        repeat: entry.repeat,
      };
    }),
  );
  required(members.size === tracks.length, 'Every hosted recording needs exactly one album.');
  resolveSoundtrackCatalogue({ format: 'revealline-soundtrack-catalogue.v2', edition, tracks });
  return { tracks, archives: [archive], collections };
}
