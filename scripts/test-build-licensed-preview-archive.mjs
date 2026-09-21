import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  buildLicensedPreviewArchive,
  assertLicensedPreviewBudget,
} from './build-licensed-preview-archive.mjs';
import {
  resolveSoundtrackArchiveInventory,
  resolveSoundtrackArchives,
} from '../game/soundtrack-archive.mjs';
import { fixture as audioFixture } from '../game/test/helpers/soundtrack-fixtures.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const archiveId = 'licensed-preview-01';
const baseURL = 'https://mekhovov.github.io/revealline-soundtracks-01/';

async function fixture(t, { derivative = false, artist = 'Preview QA' } = {}) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'licensed-preview-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const folder = path.join(root, 'authoring/library/licensed-audio'),
    audio = await audioFixture('preview-only'),
    body = Buffer.from(await audio.blob.arrayBuffer()),
    originalBody = derivative
      ? Buffer.from('Synthetic OGG provenance fixture, not decoded audio.')
      : body,
    original = {
      path: derivative ? 'originals/test.ogg' : 'originals/test.mp3',
      bytes: originalBody.length,
      sha256: hash(originalBody),
    },
    runtime = derivative
      ? { path: 'derivatives/test.mp3', bytes: body.length, sha256: hash(body) }
      : { ...original },
    conversion = derivative
      ? {
          name: 'test.mp3',
          sourceName: 'test.ogg',
          sourceBytes: original.bytes,
          sourceSha256: original.sha256,
          bytes: runtime.bytes,
          sha256: runtime.sha256,
        }
      : null,
    track = {
      id: 'test.recording',
      title: 'A <synthetic> preview',
      artist,
      albumId: 'test.album',
      source: 'https://example.test/creator-recording',
      credit: 'Preview QA — fixture only.',
      license: 'CC BY 3.0 Unported',
      licenseURL: 'https://creativecommons.org/licenses/by/3.0/',
      original,
      runtime,
      derivative: conversion,
      fileName: 'test.mp3',
      tags: { genres: ['chiptune'], role: 'any', energy: 3, themes: [] },
    },
    source = {
      format: 'revealline-licensed-audio-source.v1',
      encoder: { fixture: true },
      tracks: [track],
      albums: [
        {
          id: 'test.album',
          title: 'Fixture album',
          description: 'Synthetic fixture; not approved music.',
          trackIds: [track.id],
        },
      ],
    },
    reviewed = {
      ...structuredClone(track),
      asset: { ...audio.track.asset },
      licenseReview: {
        status: 'verified-open-license',
        publicationEligible: true,
        evidence: 'provenance/license-revalidation.json',
      },
      policy: {
        id: track.id,
        sha256: runtime.sha256,
        webPlayback: 'allowed',
        offlineCache: 'allowed',
        redistribute: 'allowed',
        modify: 'allowed',
        gameplayVideo: 'unknown',
        contentId: 'unknown',
      },
      transform: derivative ? 'provenance/derivatives.json' : null,
    },
    register = { format: 'revealline-licensed-production-register.v1', tracks: [reviewed] },
    license = {
      format: 'revealline-music-license-review.v1',
      sources: [
        {
          source: track.source,
          selectedLicenseURL: track.licenseURL,
          status: 'primary creator submission license declaration verified',
        },
      ],
    },
    derivatives = { encoder: source.encoder, tracks: derivative ? [conversion] : [] },
    authorization = {
      format: 'revealline-licensed-preview-authorization.v1',
      scope: 'public-mp3-preview-only',
      archiveId,
      baseURL,
      sourcesSha256: '',
      productionRegisterSha256: '',
      authorizedBy: 'Synthetic test only',
      authorizationEvidence: 'This fixture grants no real music approval.',
      gameCatalogueAdmission: false,
      listeningApproval: false,
      tracks: [],
      artistLinks:
        artist === 'Zander Noriega' ? [{ artist, url: 'https://twitter.com/ZanderNoriega' }] : [],
    },
    put = async (name, bytes) => {
      const target = path.join(folder, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, bytes);
    },
    save = async ({ repin = true } = {}) => {
      if (repin) {
        authorization.sourcesSha256 = hash(json(source));
        authorization.productionRegisterSha256 = hash(json(register));
        authorization.tracks = source.tracks.map((entry) => ({
          id: entry.id,
          sha256: entry.runtime.sha256,
        }));
      }
      await put('sources.json', json(source));
      await put('production-register.json', json(register));
      await put('preview-authorization.json', json(authorization));
      await put('provenance/license-revalidation.json', json(license));
      await put('provenance/derivatives.json', json(derivatives));
      await put('provenance/additional-derivatives.json', json({ encoder: {}, tracks: [] }));
    };
  await put(original.path, originalBody);
  if (derivative) await put(runtime.path, body);
  await put(
    'publication.json',
    json({ format: 'revealline-licensed-publication.v1', approved: [] }),
  );
  await save();
  return {
    root,
    folder,
    source,
    register,
    track,
    reviewed,
    license,
    derivatives,
    authorization,
    put,
    save,
    body,
    options: { root, outputDirectory: '.cache/preview', archiveId, baseURL },
    target: path.join(root, '.cache/preview'),
  };
}

test('preview staging preserves exact bytes and credits without requiring or changing listening approvals', async (t) => {
  const f = await fixture(t),
    before = await fs.readFile(path.join(f.folder, 'publication.json')),
    result = await buildLicensedPreviewArchive(f.options),
    inventoryBytes = await fs.readFile(path.join(f.target, 'inventory.json')),
    catalogueBytes = await fs.readFile(path.join(f.target, 'preview-catalogue.json')),
    catalogue = JSON.parse(catalogueBytes),
    inventory = resolveSoundtrackArchiveInventory(inventoryBytes.toString(), result.archive);
  assert.equal(result.status, 'staged-preview-unpublished');
  assert.equal(result.tracks, 1);
  assert.equal(result.files, 1);
  assert.equal(result.bytes, f.body.length);
  resolveSoundtrackArchives([result.archive]);
  assert.equal(result.archive.inventorySha256, hash(inventoryBytes));
  assert.equal(result.catalogue.sha256, hash(catalogueBytes));
  assert.deepEqual(await fs.readFile(path.join(f.target, inventory.files[0].path)), f.body);
  assert.equal(catalogue.gameCatalogueAdmission, false);
  assert.equal(catalogue.listeningApproval, 'not-reviewed');
  assert.equal(catalogue.tracks[0].credit, f.track.credit);
  assert.equal(catalogue.tracks[0].fileName, 'test.mp3');
  assert.equal(catalogue.tracks[0].licenseURL, f.track.licenseURL);
  assert.equal(catalogue.tracks[0].conversion.kind, 'exact-creator-mp3');
  assert.equal(catalogue.tracks[0].policy, undefined);
  assert.equal(
    catalogue.source.authorizationSha256,
    hash(await fs.readFile(path.join(f.folder, 'preview-authorization.json'))),
  );
  assert.deepEqual((await fs.readdir(f.target)).sort(), [
    'inventory.json',
    'objects',
    'preview-catalogue.json',
  ]);
  assert.deepEqual(await fs.readFile(path.join(f.folder, 'publication.json')), before);
  const second = await buildLicensedPreviewArchive({
    ...f.options,
    outputDirectory: '.cache/second',
  });
  assert.equal(second.catalogue.sha256, result.catalogue.sha256);
  assert.equal(second.inventory.sha256, result.inventory.sha256);
});

test('identical MP3 aliases retain their metadata while storing one immutable object', async (t) => {
  const f = await fixture(t),
    alias = structuredClone(f.track),
    reviewed = structuredClone(f.reviewed);
  alias.id = 'test.alias';
  alias.title = 'Another title';
  reviewed.id = alias.id;
  reviewed.title = alias.title;
  reviewed.policy.id = alias.id;
  f.source.tracks.push(alias);
  f.source.albums[0].trackIds.push(alias.id);
  f.register.tracks.push(reviewed);
  await f.save();
  const result = await buildLicensedPreviewArchive(f.options),
    catalogue = JSON.parse(await fs.readFile(path.join(f.target, 'preview-catalogue.json')));
  assert.equal(result.tracks, 2);
  assert.equal(result.files, 1);
  assert.equal(result.bytes, f.body.length);
  assert.equal(catalogue.tracks[0].path, catalogue.tracks[1].path);
  assert.notEqual(catalogue.tracks[0].title, catalogue.tracks[1].title);
});

test('documented conversion preserves original identity and explicit attribution changes', async (t) => {
  const f = await fixture(t, { derivative: true, artist: 'Zander Noriega' });
  await buildLicensedPreviewArchive(f.options);
  const catalogue = JSON.parse(await fs.readFile(path.join(f.target, 'preview-catalogue.json'))),
    track = catalogue.tracks[0];
  assert.equal(track.artistURL, 'https://twitter.com/ZanderNoriega');
  assert.equal(track.changes, 'Converted OGG to MP3; no musical edits.');
  assert.equal(track.conversion.original.sha256, f.track.original.sha256);
  assert.equal(track.conversion.transform, 'provenance/derivatives.json');
});

test('a descriptive conversion statement remains separate from its exact encoder receipt', async (t) => {
  const f = await fixture(t, { derivative: true });
  f.track.derivative.encoderReceipt = 'provenance/derivatives.json';
  f.reviewed.transform =
    'CoreAudio Vorbis decode, then a documented MP3 encoding; no musical edits.';
  await f.save();
  await buildLicensedPreviewArchive(f.options);
  const catalogue = JSON.parse(await fs.readFile(path.join(f.target, 'preview-catalogue.json')));
  assert.equal(catalogue.tracks[0].conversion.transform, f.reviewed.transform);
  assert.equal(catalogue.tracks[0].conversion.evidence, 'provenance/derivatives.json');
});

const refusals = [
  [
    'missing license evidence',
    (f) => {
      f.license.sources = [];
    },
    /matching reviewed CC0 or CC BY/,
  ],
  [
    'standalone redistribution denied',
    (f) => {
      f.reviewed.policy.redistribute = 'denied';
    },
    /standalone redistribution/,
  ],
  [
    'web permission unknown',
    (f) => {
      f.reviewed.policy.webPlayback = 'unknown';
    },
    /web playback/,
  ],
  [
    'permission bound to another hash',
    (f) => {
      f.reviewed.policy.sha256 = '0'.repeat(64);
    },
    /exact track ID and audio hash/,
  ],
  [
    'invented licensing approval',
    (f) => {
      f.reviewed.licenseReview.publicationEligible = false;
    },
    /matching reviewed CC0 or CC BY/,
  ],
  [
    'mismatched credits',
    (f) => {
      f.reviewed.credit = 'Other credit';
    },
    /metadata differ/,
  ],
  [
    'incorrect MP3 frame facts',
    (f) => {
      f.reviewed.asset.durationSeconds += 1;
    },
    /MP3 inspection/,
  ],
  [
    'game admission flag',
    (f) => {
      f.authorization.gameCatalogueAdmission = true;
    },
    /preview-only authorization/,
  ],
  [
    'listening approval flag',
    (f) => {
      f.authorization.listeningApproval = true;
    },
    /preview-only authorization/,
  ],
  [
    'source traversal',
    (f) => {
      f.track.original.path = '../outside.mp3';
      f.reviewed.original.path = '../outside.mp3';
    },
    /ordinary relative path/,
  ],
  [
    'missing album member',
    (f) => {
      f.source.albums[0].trackIds = [];
    },
    /album ownership/,
  ],
];
for (const [name, mutate, error] of refusals)
  test(`refuses ${name} before creating output`, async (t) => {
    const f = await fixture(t);
    mutate(f);
    await f.save();
    await assert.rejects(buildLicensedPreviewArchive(f.options), error);
    await assert.rejects(fs.lstat(f.target), { code: 'ENOENT' });
  });

test('refuses stale authorization, changed originals and undeclared conversion receipts', async (t) => {
  const stale = await fixture(t);
  stale.track.title = 'Changed after authorization';
  stale.reviewed.title = stale.track.title;
  await stale.save({ repin: false });
  await assert.rejects(buildLicensedPreviewArchive(stale.options), /preview-only authorization/);
  const bytes = await fixture(t);
  await bytes.put(bytes.track.runtime.path, Buffer.from('changed'));
  await assert.rejects(buildLicensedPreviewArchive(bytes.options), /exact source pin/);
  const derivative = await fixture(t, { derivative: true });
  derivative.derivatives.tracks = [];
  await derivative.save();
  await assert.rejects(
    buildLicensedPreviewArchive(derivative.options),
    /derivative provenance differs/,
  );
  for (const f of [stale, bytes, derivative])
    await assert.rejects(fs.lstat(f.target), { code: 'ENOENT' });
});

test('Zander Noriega attribution cannot omit or substitute the creator-requested URL', async (t) => {
  const f = await fixture(t, { artist: 'Zander Noriega' });
  f.authorization.artistLinks = [];
  await f.save();
  await assert.rejects(buildLicensedPreviewArchive(f.options), /creator-requested attribution URL/);
  f.authorization.artistLinks = [{ artist: 'Zander Noriega', url: 'https://example.test/wrong' }];
  await f.save();
  await assert.rejects(buildLicensedPreviewArchive(f.options), /creator-requested attribution URL/);
});

test('rejects input/output symlinks, occupied output and non-project archive URLs', async (t) => {
  const f = await fixture(t);
  await fs.rename(path.join(f.folder, f.track.runtime.path), path.join(f.folder, 'real.mp3'));
  await fs.symlink('../real.mp3', path.join(f.folder, f.track.runtime.path));
  await assert.rejects(buildLicensedPreviewArchive(f.options), /symbolic links/);
  await fs.unlink(path.join(f.folder, f.track.runtime.path));
  await f.put(f.track.runtime.path, f.body);
  await fs.mkdir(path.join(f.root, '.cache'));
  await fs.symlink(f.folder, f.target);
  await assert.rejects(buildLicensedPreviewArchive(f.options), /symbolic links/);
  await fs.unlink(f.target);
  await fs.mkdir(f.target);
  await fs.writeFile(path.join(f.target, 'keep.txt'), 'keep');
  await assert.rejects(buildLicensedPreviewArchive(f.options), /already exists/);
  assert.equal(await fs.readFile(path.join(f.target, 'keep.txt'), 'utf8'), 'keep');
  await assert.rejects(
    buildLicensedPreviewArchive({ ...f.options, outputDirectory: 'outside' }),
    /inside the source .cache/,
  );
  await assert.rejects(
    buildLicensedPreviewArchive({
      ...f.options,
      outputDirectory: '.cache/fresh',
      baseURL: 'https://example.test/',
    }),
    /admitted GitHub Pages owner/,
  );
});

test('budget accounts for complete output, metadata and allocation overhead before the 1 GiB reserve', () => {
  const args = { files: 70, bytes: 354986122, metadataBytes: 150000 },
    required = args.bytes + args.metadataBytes + 74 * 4096 + 1024 * 1024 + 1024 ** 3;
  assert.doesNotThrow(() => assertLicensedPreviewBudget({ ...args, freeBytes: BigInt(required) }));
  assert.throws(
    () => assertLicensedPreviewBudget({ ...args, freeBytes: BigInt(required - 1) }),
    /1 GiB/,
  );
  assert.throws(
    () => assertLicensedPreviewBudget({ ...args, bytes: 800000001, freeBytes: 4n * 1024n ** 3n }),
    /800 MB/,
  );
  assert.throws(
    () => assertLicensedPreviewBudget({ ...args, files: 513, freeBytes: 4n * 1024n ** 3n }),
    /512/,
  );
});
