#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { boundedJSON, canonicalJSON, exactKeys, required, stableId } from '../game/data-json.mjs';
import { inspectMP3 } from '../game/mp3.mjs';
import { resolveSoundtrackTags } from '../game/soundtrack.mjs';
import { resolveSoundtrackPolicy, resolveSoundtrackWebsites } from '../game/soundtrack-rights.mjs';
import {
  SOUNDTRACK_ARCHIVE_FORMAT,
  SOUNDTRACK_ARCHIVE_LIMITS,
  resolveSoundtrackArchives,
  resolveSoundtrackArchiveInventory,
} from '../game/soundtrack-archive.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const sourceFolder = 'authoring/library/licensed-audio';
const reserve = 1024 ** 3;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const same = (left, right) => canonicalJSON(left) === canonicalJSON(right);
const validHash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const text = (value, limit = 1024) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= limit;
const licenses = new Map([
  ['CC0 1.0 Universal', 'https://creativecommons.org/publicdomain/zero/1.0/'],
  ['CC BY 3.0 Unported', 'https://creativecommons.org/licenses/by/3.0/'],
  ['CC BY 4.0 International', 'https://creativecommons.org/licenses/by/4.0/'],
]);

async function ordinary(root, relative, limit = 32 * 1024 * 1024) {
  required(
    text(relative, 512) &&
      !path.isAbsolute(relative) &&
      relative
        .split('/')
        .every((part) => part && part !== '.' && part !== '..' && !part.includes('\\')),
    'Preview input requires an ordinary relative path.',
  );
  let target = root;
  for (const part of relative.split('/')) {
    target = path.join(target, part);
    required(
      !(await fs.lstat(target)).isSymbolicLink(),
      'Preview input cannot cross symbolic links.',
    );
  }
  const stat = await fs.lstat(target);
  required(stat.isFile() && stat.size <= limit, 'Preview input is not a bounded ordinary file.');
  return target;
}

async function readPinned(folder, pin) {
  required(
    pin && Number.isSafeInteger(pin.bytes) && pin.bytes > 0 && validHash(pin.sha256),
    'Invalid preview recording pin.',
  );
  const body = await fs.readFile(await ordinary(folder, pin.path));
  required(
    body.length === pin.bytes && hash(body) === pin.sha256,
    `Preview recording differs from its exact source pin: ${pin.path}`,
  );
  return body;
}

async function availableBytes(root) {
  const stat = await fs.statfs(root, { bigint: true });
  return stat.bavail * stat.bsize;
}

/** Includes all metadata, file-system allocation allowance and the full remaining write. */
export function assertLicensedPreviewBudget({ files, bytes, metadataBytes, freeBytes }) {
  required(
    Number.isSafeInteger(files) && files > 0 && files <= SOUNDTRACK_ARCHIVE_LIMITS.files,
    'Preview requires 1–512 unique MP3 objects.',
  );
  required(
    Number.isSafeInteger(bytes) && bytes > 0 && bytes <= SOUNDTRACK_ARCHIVE_LIMITS.bytes,
    'Preview audio exceeds the 800 MB archive budget.',
  );
  required(
    Number.isSafeInteger(metadataBytes) && metadataBytes >= 0 && metadataBytes <= 2 * 1024 * 1024,
    'Preview metadata exceeds its budget.',
  );
  const allocation = bytes + metadataBytes + (files + 4) * 4096 + 1024 * 1024;
  required(
    typeof freeBytes === 'bigint' && freeBytes >= BigInt(allocation + reserve),
    'Preview staging must leave at least 1 GiB free after the entire output.',
  );
  return allocation;
}

async function outputPath(root, requested) {
  required(text(requested, 512), 'Supply a fresh preview output directory.');
  const output = path.resolve(root, requested),
    relative = path.relative(root, output);
  required(
    relative.startsWith(`.cache${path.sep}`),
    'Preview output must be inside the source .cache.',
  );
  let current = root;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    let stat;
    try {
      stat = await fs.lstat(current);
    } catch (error) {
      if (error.code === 'ENOENT') break;
      throw error;
    }
    required(
      stat.isDirectory() && !stat.isSymbolicLink(),
      'Preview output cannot cross symbolic links or files.',
    );
    required(current !== output, 'Preview output already exists; choose a fresh directory.');
  }
  return output;
}

async function makeParents(root, output) {
  let current = root;
  for (const part of path.relative(root, path.dirname(output)).split(path.sep)) {
    current = path.join(current, part);
    try {
      await fs.mkdir(current);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
    }
    const stat = await fs.lstat(current);
    required(
      stat.isDirectory() && !stat.isSymbolicLink(),
      'Preview parent must be an ordinary directory.',
    );
  }
}

/** Separate preview authority: no listening approvals, runtime catalogue, bundles,
 * network activity, source writes, repository creation or deployment. */
export async function buildLicensedPreviewArchive({
  root = projectRoot,
  outputDirectory,
  archiveId,
  baseURL,
} = {}) {
  const sourceRoot = await fs.realpath(root),
    output = await outputPath(sourceRoot, outputDirectory),
    provisional = resolveSoundtrackArchives([
      { id: archiveId, baseURL, inventorySha256: '0'.repeat(64) },
    ])[0],
    folder = path.join(sourceRoot, sourceFolder),
    inputs = [];
  // Check every ancestor of the source folder before using it as a read boundary.
  await ordinary(sourceRoot, `${sourceFolder}/sources.json`, 1024 * 1024);
  async function readJSON(relative) {
    const bytes = await fs.readFile(await ordinary(folder, relative, 1024 * 1024));
    inputs.push({ path: relative, bytes: bytes.length, sha256: hash(bytes) });
    return boundedJSON(bytes.toString('utf8'), {
      maxBytes: 1024 * 1024,
      maxNodes: 50000,
      maxDepth: 16,
      maxArray: 1024,
      maxString: 8192,
    });
  }
  const source = await readJSON('sources.json'),
    register = await readJSON('production-register.json'),
    authorization = await readJSON('preview-authorization.json'),
    licenseEvidence = await readJSON('provenance/license-revalidation.json'),
    primaryDerivatives = await readJSON('provenance/derivatives.json'),
    additionalDerivatives = await readJSON('provenance/additional-derivatives.json');
  let expansionDerivatives;
  try {
    expansionDerivatives = await readJSON('provenance/expansion-derivatives.json');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  required(
    source.format === 'revealline-licensed-audio-source.v1' &&
      register.format === 'revealline-licensed-production-register.v1' &&
      licenseEvidence.format === 'revealline-music-license-review.v1',
    'Unsupported preview source registers.',
  );
  required(
    Array.isArray(source.tracks) &&
      source.tracks.length > 0 &&
      source.tracks.length <= 256 &&
      source.tracks.every((track) => stableId(track.id) && !track.id.startsWith('builtin.')) &&
      new Set(source.tracks.map((track) => track.id)).size === source.tracks.length &&
      Array.isArray(register.tracks) &&
      register.tracks.length === source.tracks.length &&
      new Set(register.tracks.map((track) => track.id)).size === register.tracks.length,
    'Preview requires the complete bounded, unique source collection.',
  );
  exactKeys(
    authorization,
    [
      'format',
      'scope',
      'archiveId',
      'baseURL',
      'sourcesSha256',
      'productionRegisterSha256',
      'authorizedBy',
      'authorizationEvidence',
      'gameCatalogueAdmission',
      'listeningApproval',
      'tracks',
      'artistLinks',
    ],
    'preview authorization',
  );
  required(
    authorization.format === 'revealline-licensed-preview-authorization.v1' &&
      authorization.scope === 'public-mp3-preview-only' &&
      authorization.archiveId === archiveId &&
      authorization.baseURL === baseURL &&
      authorization.sourcesSha256 === inputs[0].sha256 &&
      authorization.productionRegisterSha256 === inputs[1].sha256 &&
      text(authorization.authorizedBy) &&
      text(authorization.authorizationEvidence, 4096) &&
      authorization.gameCatalogueAdmission === false &&
      authorization.listeningApproval === false,
    'Exact preview-only authorization is required; it cannot grant game or listening approval.',
  );
  required(
    Array.isArray(authorization.tracks) &&
      authorization.tracks.length === source.tracks.length &&
      new Set(authorization.tracks.map((track) => track.id)).size === source.tracks.length &&
      authorization.tracks.every((pin) => {
        exactKeys(pin, ['id', 'sha256'], 'authorized preview recording');
        return source.tracks.some(
          (track) => track.id === pin.id && track.runtime.sha256 === pin.sha256,
        );
      }),
    'Preview authorization must pin every source recording, with no extras.',
  );
  required(
    Array.isArray(authorization.artistLinks) &&
      authorization.artistLinks.length <= 64 &&
      new Set(authorization.artistLinks.map((entry) => entry.artist)).size ===
        authorization.artistLinks.length,
    'Invalid preview artist attribution links.',
  );
  for (const entry of authorization.artistLinks) {
    exactKeys(entry, ['artist', 'url'], 'preview artist attribution');
    required(
      text(entry.artist, 256) && source.tracks.some((track) => track.artist === entry.artist),
      'Preview artist attribution must match a source artist.',
    );
    resolveSoundtrackWebsites([{ label: 'Creator attribution', url: entry.url }]);
  }
  required(
    same(source.encoder, primaryDerivatives.encoder) &&
      (!expansionDerivatives || same(expansionDerivatives.encoder, additionalDerivatives.encoder)),
    'Preview derivative encoder differs from retained source provenance.',
  );
  const derivativeGroups = [
    ['provenance/derivatives.json', primaryDerivatives],
    ['provenance/additional-derivatives.json', additionalDerivatives],
    ...(expansionDerivatives
      ? [['provenance/expansion-derivatives.json', expansionDerivatives]]
      : []),
  ];
  required(
    derivativeGroups.every(([, evidence]) => Array.isArray(evidence.tracks)),
    'Missing preview derivative provenance.',
  );
  const tracks = [],
    objects = new Map();
  for (const track of source.tracks) {
    const reviewed = register.tracks.find((entry) => entry.id === track.id),
      licenseURL = licenses.get(track.license);
    required(
      reviewed &&
        [
          'title',
          'artist',
          'albumId',
          'source',
          'license',
          'credit',
          'licenseURL',
          'original',
          'runtime',
          'fileName',
          'tags',
        ].every((key) => same(track[key], reviewed[key])),
      `Preview source and production metadata differ: ${track.id}`,
    );
    required(
      ['title', 'artist', 'credit', 'fileName'].every((key) => text(track[key])) &&
        !/[\\/]/.test(track.fileName) &&
        track.fileName.endsWith('.mp3'),
      'Invalid public preview display metadata.',
    );
    resolveSoundtrackWebsites([{ label: 'Recording source', url: track.source }]);
    if (track.websites) resolveSoundtrackWebsites(track.websites);
    required(
      licenseURL &&
        licenseURL === track.licenseURL &&
        licenseEvidence.sources.some(
          (entry) =>
            entry.source === track.source &&
            entry.selectedLicenseURL === licenseURL &&
            entry.status === 'primary creator submission license declaration verified',
        ) &&
        reviewed.licenseReview?.status === 'verified-open-license' &&
        reviewed.licenseReview.publicationEligible === true &&
        reviewed.licenseReview.evidence === 'provenance/license-revalidation.json',
      'Preview requires matching reviewed CC0 or CC BY recording permission.',
    );
    const policy = resolveSoundtrackPolicy(reviewed.policy, {
      id: track.id,
      sha256: track.runtime.sha256,
    });
    required(
      policy.webPlayback === 'allowed' && policy.redistribute === 'allowed',
      'Preview requires explicit web playback and standalone redistribution permission.',
    );
    const original = await readPinned(folder, track.original),
      unchanged = track.original.path === track.runtime.path;
    required(
      unchanged
        ? track.original.path.endsWith('.mp3') &&
            track.derivative === null &&
            same(track.original, track.runtime)
        : track.original.path.endsWith('.ogg') &&
            track.runtime.path.endsWith('.mp3') &&
            track.derivative?.sourceSha256 === track.original.sha256 &&
            track.derivative?.sourceBytes === track.original.bytes &&
            track.derivative?.sha256 === track.runtime.sha256 &&
            track.derivative?.bytes === track.runtime.bytes &&
            track.runtime.path === `derivatives/${track.derivative.name}` &&
            track.original.path.endsWith(`/${track.derivative.sourceName}`) &&
            policy.modify === 'allowed',
      'Preview requires an exact creator MP3 or its permitted, retained OGG conversion.',
    );
    const transform = unchanged ? null : reviewed.transform,
      conversionEvidence = unchanged
        ? null
        : derivativeGroups.find(
            ([name, evidence]) =>
              (!track.derivative.encoderReceipt || track.derivative.encoderReceipt === name) &&
              evidence.tracks.some((entry) => same(entry, track.derivative)),
          )?.[0];
    if (!unchanged)
      required(
        conversionEvidence && text(transform, 4096),
        'Preview derivative provenance differs.',
      );
    const bytes = unchanged ? original : await readPinned(folder, track.runtime),
      facts = await inspectMP3(new Blob([bytes], { type: 'audio/mpeg' }));
    required(
      same(facts, reviewed.asset),
      'Preview MP3 inspection differs from its production facts.',
    );
    const object = {
      path: `objects/${facts.sha256}.mp3`,
      bytes: facts.bytes,
      sha256: facts.sha256,
    };
    if (!objects.has(facts.sha256)) objects.set(facts.sha256, { ...object, source: track.runtime });
    const artistLink = authorization.artistLinks.find((entry) => entry.artist === track.artist);
    if (track.artist === 'Zander Noriega')
      required(
        artistLink?.url === 'https://twitter.com/ZanderNoriega',
        'Zander Noriega previews require the creator-requested attribution URL.',
      );
    tracks.push({
      id: track.id,
      albumId: track.albumId,
      title: track.title,
      artist: track.artist,
      ...(artistLink ? { artistURL: artistLink.url } : {}),
      source: track.source,
      license: track.license,
      licenseURL,
      credit: track.credit,
      changes: unchanged
        ? 'Exact creator MP3; audio bytes unchanged.'
        : 'Converted OGG to MP3; no musical edits.',
      conversion: {
        kind: unchanged ? 'exact-creator-mp3' : 'ogg-to-mp3',
        original: {
          fileName: path.basename(track.original.path),
          sha256: track.original.sha256,
          bytes: track.original.bytes,
        },
        transform,
        evidence: conversionEvidence,
      },
      tags: resolveSoundtrackTags(track.tags),
      durationSeconds: facts.durationSeconds,
      fileName: track.fileName,
      ...object,
    });
  }
  required(
    Array.isArray(source.albums) &&
      source.albums.length > 0 &&
      source.albums.length <= 32 &&
      new Set(source.albums.map((album) => album.id)).size === source.albums.length,
    'Invalid preview album collection.',
  );
  const assigned = new Set(),
    albums = source.albums.map((album) => {
      required(
        stableId(album.id) &&
          text(album.title) &&
          text(album.description, 4096) &&
          Array.isArray(album.trackIds) &&
          album.trackIds.length > 0 &&
          album.trackIds.length <= 128 &&
          new Set(album.trackIds).size === album.trackIds.length &&
          album.trackIds.every(
            (id) =>
              !assigned.has(id) &&
              tracks.some((track) => track.id === id && track.albumId === album.id),
          ),
        'Preview album ownership differs from the source register.',
      );
      album.trackIds.forEach((id) => assigned.add(id));
      return {
        id: album.id,
        title: album.title,
        description: album.description,
        trackIds: album.trackIds,
      };
    });
  required(assigned.size === tracks.length, 'Preview album collection omits source recordings.');
  const files = [...objects.values()]
      .map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }))
      .sort((a, b) => a.path.localeCompare(b.path, 'en')),
    inventory = resolveSoundtrackArchiveInventory(
      { format: SOUNDTRACK_ARCHIVE_FORMAT, id: archiveId, files },
      provisional,
    ),
    inventoryBytes = json(inventory),
    archive = resolveSoundtrackArchives([
      { id: archiveId, baseURL, inventorySha256: hash(inventoryBytes) },
    ])[0],
    catalogue = {
      format: 'revealline-licensed-preview-catalogue.v1',
      status: 'licensed-preview',
      gameCatalogueAdmission: false,
      listeningApproval: 'not-reviewed',
      archive,
      source: {
        sourcesSha256: inputs[0].sha256,
        productionRegisterSha256: inputs[1].sha256,
        authorizationSha256: inputs[2].sha256,
        evidence: inputs,
      },
      albums,
      tracks,
    },
    catalogueBytes = json(catalogue),
    payloadBytes = files.reduce((total, file) => total + file.bytes, 0),
    metadata = [
      ['inventory.json', inventoryBytes],
      ['preview-catalogue.json', catalogueBytes],
    ];
  let remaining = assertLicensedPreviewBudget({
    files: files.length,
    bytes: payloadBytes,
    metadataBytes: inventoryBytes.length + catalogueBytes.length,
    freeBytes: await availableBytes(sourceRoot),
  });
  await makeParents(sourceRoot, output);
  let created = false;
  try {
    await fs.mkdir(output);
    created = true;
    await fs.mkdir(path.join(output, 'objects'));
    async function write(name, bytes) {
      required(
        (await availableBytes(sourceRoot)) >= BigInt(reserve + remaining),
        'Preview staging stopped to preserve the 1 GiB reserve.',
      );
      const target = path.join(output, name);
      await fs.writeFile(target, bytes, { flag: 'wx' });
      required(hash(await fs.readFile(target)) === hash(bytes), 'Preview staged readback differs.');
      remaining -= bytes.length;
    }
    for (const object of objects.values())
      await write(object.path, await readPinned(folder, object.source));
    for (const [name, bytes] of metadata) await write(name, bytes);
    for (const input of inputs) {
      const bytes = await fs.readFile(await ordinary(folder, input.path, 1024 * 1024));
      required(
        bytes.length === input.bytes && hash(bytes) === input.sha256,
        'Preview source metadata changed during staging.',
      );
    }
    required(
      (await availableBytes(sourceRoot)) >= BigInt(reserve),
      'Preview output breached the free-space reserve.',
    );
    return {
      status: 'staged-preview-unpublished',
      outputDirectory: output,
      archive,
      tracks: tracks.length,
      files: files.length,
      bytes: payloadBytes,
      catalogue: {
        path: 'preview-catalogue.json',
        bytes: catalogueBytes.length,
        sha256: hash(catalogueBytes),
      },
      inventory: {
        path: 'inventory.json',
        bytes: inventoryBytes.length,
        sha256: hash(inventoryBytes),
      },
    };
  } catch (error) {
    if (created) await fs.rm(output, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const [outputDirectory, archiveId, baseURL, ...extra] = process.argv.slice(2);
    required(
      outputDirectory && archiveId && baseURL && extra.length === 0,
      'Usage: node scripts/build-licensed-preview-archive.mjs .cache/fresh-preview licensed-preview-01 https://mekhovov.github.io/revealline-soundtracks-01/',
    );
    console.log(
      JSON.stringify(
        await buildLicensedPreviewArchive({ outputDirectory, archiveId, baseURL }),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
