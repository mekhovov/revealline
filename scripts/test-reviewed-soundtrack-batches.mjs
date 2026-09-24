import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { compileReviewedSoundtrackBatches } from './reviewed-soundtrack-batches.mjs';
import { compilePublishedSoundtracks } from './soundtrack-distribution.mjs';
import {
  SOUNDTRACK_CATALOGUE,
  SOUNDTRACK_ARCHIVES,
  SOUNDTRACK_COLLECTIONS,
} from '../game/content/soundtrack-catalogue.mjs';

const source = fileURLToPath(new URL('../', import.meta.url));
const digest = (value) => createHash('sha256').update(value).digest('hex');
const manifestPath = 'authoring/library/soundtrack-batches.json';
const empty = { tracks: [], archives: [], collections: [] };
async function temporary(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'reviewed-music-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}
async function fixture(t) {
  const root = await temporary(t);
  const id = 'synthetic-fixture',
    folder = `authoring/library/soundtrack-batches/${id}/`;
  const write = async (name, body) => {
    const relative = folder + name,
      bytes = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true });
    await writeFile(path.join(root, relative), bytes);
    return { path: relative, bytes: bytes.length, sha256: digest(bytes) };
  };
  // Synthetic evidence only; no production approval or real audio is created.
  const evidence = await write(
    'synthetic-evidence.txt',
    'Synthetic fixture evidence, never a real listening approval.',
  );
  const track = structuredClone(SOUNDTRACK_CATALOGUE.tracks[0]);
  track.id = 'builtin.catalog.synthetic-fixture';
  track.asset.sha256 = digest('distinct synthetic recording');
  track.archiveId = 'reviewed-fixture';
  track.path = `objects/${track.asset.sha256}.mp3`;
  track.policy.id = track.id;
  track.policy.sha256 = track.asset.sha256;
  track.tags = { genres: ['synth90s'], role: 'gameplay', energy: 4, themes: ['retro'] };
  const identity = { id: track.id, sha256: track.asset.sha256, bytes: track.asset.bytes };
  const row = { path: track.path, bytes: track.asset.bytes, sha256: track.asset.sha256 };
  const docs = {
    inventory: { format: 'revealline-soundtrack-archive.v1', id: track.archiveId, files: [row] },
    metadata: {
      format: 'revealline-soundtrack-batch-metadata.v1',
      id,
      catalogue: {
        format: 'revealline-soundtrack-catalogue.v2',
        edition: 'originals-1',
        tracks: [track],
      },
      archive: {
        id: track.archiveId,
        baseURL: 'https://mekhovov.github.io/revealline-soundtracks-02/',
        inventorySha256: '',
      },
      collections: [
        {
          id: 'builtin.album.synthetic-fixture',
          title: 'Synthetic album',
          description: 'Fixture only',
          genre: 'synth90s',
          trackIds: [track.id],
          order: 'shuffle',
          repeat: 'all',
        },
      ],
    },
    rights: {
      format: 'revealline-soundtrack-batch-rights.v1',
      batchId: id,
      tracks: [
        {
          ...identity,
          license: track.rights.license,
          licenseURL: 'https://creativecommons.org/publicdomain/zero/1.0/',
          sourceURL: track.rights.source,
          credit: track.rights.credit,
          reviewedBy: 'Synthetic reviewer',
          reviewedAt: '2026-09-24T00:00:00Z',
          evidence,
          contentId: 'unknown',
          contentIdEvidence: null,
        },
      ],
    },
    technical: {
      format: 'revealline-soundtrack-batch-technical.v1',
      batchId: id,
      tracks: [
        {
          ...identity,
          decoder: 'Synthetic native decoder',
          decoderVersion: 'fixture-1',
          fullFileDecoded: true,
          integratedLUFS: -16,
          truePeakDbTP: -1.2,
          evidence,
        },
      ],
    },
    review: {
      format: 'revealline-soundtrack-batch-review.v1',
      batchId: id,
      tracks: [
        {
          ...identity,
          approval: 'approved',
          reviewedBy: 'Synthetic listener',
          reviewedAt: '2026-09-24T00:00:00Z',
          fullTrack: true,
          repeatedSession: true,
          inGameTransition: true,
          warningAudibility: true,
          mono: true,
          smallSpeakers: true,
          notes: 'Synthetic checks only.',
          evidence,
          ukrainianReview: null,
        },
      ],
    },
    delivery: {
      format: 'revealline-soundtrack-batch-delivery.v1',
      batchId: id,
      baseURL: 'https://mekhovov.github.io/revealline-soundtracks-02/',
      inventorySha256: '',
      verified: true,
      verifiedAt: '2026-09-24T00:00:00Z',
      deployRunURL: 'https://github.com/mekhovov/revealline-soundtracks-02/actions/runs/123456',
      files: [
        {
          ...row,
          url: `https://mekhovov.github.io/revealline-soundtracks-02/${track.path}`,
          status: 200,
          verified: true,
        },
      ],
    },
  };
  const entry = { id, status: 'approved' };
  const manifest = { format: 'revealline-reviewed-soundtrack-batches.v1', batches: [entry] };
  const save = async () => {
    entry.inventory = await write('inventory.json', docs.inventory);
    docs.metadata.archive.inventorySha256 = entry.inventory.sha256;
    docs.delivery.inventorySha256 = entry.inventory.sha256;
    for (const key of ['metadata', 'rights', 'technical', 'review', 'delivery'])
      entry[key] = await write(`${key}.json`, docs[key]);
    await writeFile(path.join(root, manifestPath), JSON.stringify(manifest));
  };
  await save();
  return { root, docs, entry, manifest, save, evidence, write, track };
}
test('missing, empty and pending manifests admit no recordings or audio', async (t) => {
  const root = await temporary(t);
  assert.deepEqual(await compileReviewedSoundtrackBatches(root, 'originals-1'), empty);
  await mkdir(path.join(root, 'authoring/library'), { recursive: true });
  for (const batches of [[], [{ id: 'not-reviewed', status: 'pending' }]]) {
    await writeFile(
      path.join(root, manifestPath),
      JSON.stringify({ format: 'revealline-reviewed-soundtrack-batches.v1', batches }),
    );
    assert.deepEqual(await compileReviewedSoundtrackBatches(root, 'originals-1'), empty);
  }
});
test('approved synthetic batch is additive, reproducible and network-free', async (t) => {
  const f = await fixture(t);
  const existing = {
    tracks: SOUNDTRACK_CATALOGUE.tracks,
    archives: SOUNDTRACK_ARCHIVES,
    collections: SOUNDTRACK_COLLECTIONS,
  };
  const before = structuredClone(existing);
  const compiled = await compileReviewedSoundtrackBatches(f.root, 'originals-1', existing);
  assert.deepEqual(compiled.tracks, [f.track]);
  assert.deepEqual(compiled.archives, [f.docs.metadata.archive]);
  assert.deepEqual(compiled.collections, f.docs.metadata.collections);
  assert.deepEqual(
    await compileReviewedSoundtrackBatches(f.root, 'originals-1', existing),
    compiled,
  );
  assert.deepEqual(existing, before);
  assert.equal(Object.hasOwn(compiled, 'files'), false);
});
test('only the reviewed subset is admitted from an immutable archive shared with a previous batch', async (t) => {
  const f = await fixture(t);
  const otherHash = digest('unreviewed archived recording');
  const other = { path: `objects/${otherHash}.mp3`, sha256: otherHash, bytes: 4000 };
  f.docs.inventory.files.push(other);
  f.docs.delivery.files.push({
    ...other,
    url: new URL(other.path, f.docs.delivery.baseURL).href,
    status: 200,
    verified: true,
  });
  await f.save();
  const result = await compileReviewedSoundtrackBatches(f.root, 'originals-1', {
    ...empty,
    archives: [f.docs.metadata.archive],
  });
  assert.deepEqual(
    result.tracks.map((track) => track.id),
    [f.track.id],
  );
  assert.deepEqual(result.archives, []);
  f.docs.delivery.files.pop();
  await f.save();
  await assert.rejects(compileReviewedSoundtrackBatches(f.root, 'originals-1'), /delivery/);
});
test('approved status cannot bypass the required listening document pin', async (t) => {
  const f = await fixture(t);
  delete f.entry.review;
  await writeFile(path.join(f.root, manifestPath), JSON.stringify(f.manifest));
  await assert.rejects(compileReviewedSoundtrackBatches(f.root, 'originals-1'), /missing fields/);
});
for (const [label, mutate] of [
  [
    'missing listening row',
    (f) => {
      f.docs.review.tracks = [];
    },
  ],
  [
    'pending listening decision',
    (f) => {
      f.docs.review.tracks[0].approval = 'pending';
    },
  ],
  [
    'unheard complete track',
    (f) => {
      f.docs.review.tracks[0].fullTrack = false;
    },
  ],
  [
    'unheard transition',
    (f) => {
      f.docs.review.tracks[0].inGameTransition = false;
    },
  ],
  [
    'missing warning review',
    (f) => {
      f.docs.review.tracks[0].warningAudibility = false;
    },
  ],
  [
    'anonymous review',
    (f) => {
      f.docs.review.tracks[0].reviewedBy = '';
    },
  ],
  [
    'renamed review hash',
    (f) => {
      f.docs.review.tracks[0].sha256 = 'a'.repeat(64);
    },
  ],
  [
    'mismatched review bytes',
    (f) => {
      f.docs.review.tracks[0].bytes++;
    },
  ],
  [
    'missing Ukrainian reviewer',
    (f) => {
      f.track.tags.genres = ['ukrainian'];
    },
  ],
  [
    'non-game license',
    (f) => {
      f.docs.rights.tracks[0].license = 'CC BY-NC 4.0';
    },
  ],
  [
    'forged public permission',
    (f) => {
      f.track.policy.redistribute = 'denied';
    },
  ],
  [
    'forged Content ID clearance',
    (f) => {
      f.track.policy.contentId = 'not-registered';
    },
  ],
  [
    'omitted credit',
    (f) => {
      f.track.rights.credit = 'Changed attribution';
    },
  ],
  [
    'source mismatch',
    (f) => {
      f.docs.rights.tracks[0].sourceURL = 'https://example.com/';
    },
  ],
  [
    'missing full decode',
    (f) => {
      f.docs.technical.tracks[0].fullFileDecoded = false;
    },
  ],
  [
    'too-loud encode',
    (f) => {
      f.docs.technical.tracks[0].integratedLUFS = -14;
    },
  ],
  [
    'encoded true-peak failure',
    (f) => {
      f.docs.technical.tracks[0].truePeakDbTP = -0.1;
    },
  ],
  [
    'unverified public receipt',
    (f) => {
      f.docs.delivery.verified = false;
    },
  ],
  [
    'unverified recording',
    (f) => {
      f.docs.delivery.files[0].verified = false;
    },
  ],
  [
    'public object size mismatch',
    (f) => {
      f.docs.delivery.files[0].bytes++;
    },
  ],
  [
    'public object redirected elsewhere',
    (f) => {
      f.docs.delivery.files[0].url = 'https://example.com/audio.mp3';
    },
  ],
  [
    'deployment from another repository',
    (f) => {
      f.docs.delivery.deployRunURL =
        'https://github.com/mekhovov/revealline-soundtracks-03/actions/runs/1';
    },
  ],
  [
    'unknown album member',
    (f) => {
      f.docs.metadata.collections[0].trackIds = ['builtin.catalog.unknown'];
    },
  ],
  [
    'uncollected recording',
    (f) => {
      f.docs.metadata.collections = [];
    },
  ],
])
  test(`reviewed admission rejects ${label} even when document hashes are refreshed`, async (t) => {
    const f = await fixture(t);
    mutate(f);
    await f.save();
    await assert.rejects(compileReviewedSoundtrackBatches(f.root, 'originals-1'));
  });
test('Ukrainian admission requires pinned named musical review', async (t) => {
  const f = await fixture(t);
  f.track.tags.genres = ['ukrainian'];
  f.docs.metadata.collections[0].genre = 'ukrainian';
  f.docs.review.tracks[0].ukrainianReview = {
    reviewedBy: 'Synthetic musical reviewer',
    reviewedAt: '2026-09-24T00:00:00Z',
    notes: 'Synthetic regional review only.',
    evidence: f.evidence,
  };
  await f.save();
  assert.equal((await compileReviewedSoundtrackBatches(f.root, 'originals-1')).tracks.length, 1);
});
test('tampered pinned evidence cannot be substituted', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, f.evidence.path), 'altered');
  await assert.rejects(compileReviewedSoundtrackBatches(f.root, 'originals-1'), /pin differs/);
});
test('evidence cannot escape the batch or use a symbolic link', async (t) => {
  const f = await fixture(t);
  const original = f.docs.review.tracks[0].evidence;
  f.docs.review.tracks[0].evidence = { ...original, path: 'authoring/library/elsewhere.txt' };
  await f.save();
  await assert.rejects(compileReviewedSoundtrackBatches(f.root, 'originals-1'), /batch-local/);
  f.docs.review.tracks[0].evidence = {
    ...original,
    path: `authoring/library/soundtrack-batches/${f.entry.id}/../escape.txt`,
  };
  await f.save();
  await assert.rejects(compileReviewedSoundtrackBatches(f.root, 'originals-1'), /path/);
  f.docs.review.tracks[0].evidence = original;
  await f.save();
  const target = path.join(f.root, original.path);
  await rm(target);
  await symlink(path.join(source, 'package.json'), target);
  await assert.rejects(compileReviewedSoundtrackBatches(f.root, 'originals-1'), /symbolic links/);
});
test('combined validation refuses existing identities, hash aliases, archives and catalogue overflow', async (t) => {
  const f = await fixture(t);
  await assert.rejects(
    compileReviewedSoundtrackBatches(f.root, 'originals-1', { ...empty, tracks: [f.track] }),
    /duplicate.*hash/,
  );
  await assert.rejects(
    compileReviewedSoundtrackBatches(f.root, 'originals-1', {
      ...empty,
      archives: [{ ...f.docs.metadata.archive, inventorySha256: 'f'.repeat(64) }],
    }),
    /existing archive/,
  );
  await assert.rejects(
    compileReviewedSoundtrackBatches(f.root, 'originals-1', {
      ...empty,
      collections: f.docs.metadata.collections,
    }),
    /duplicate.*collection/,
  );
  const many = Array.from({ length: 256 }, (_, i) => ({
    ...f.track,
    id: `builtin.catalog.existing-${i}`,
    asset: { ...f.track.asset, sha256: digest(String(i)) },
    policy: { ...f.track.policy, id: `builtin.catalog.existing-${i}`, sha256: digest(String(i)) },
    path: `objects/${digest(String(i))}.mp3`,
  }));
  await assert.rejects(
    compileReviewedSoundtrackBatches(f.root, 'originals-1', { ...empty, tracks: many }),
    /catalogue/,
  );
});
test('existing 70 recordings and15 albums compile byte-for-value unchanged without new approvals', async () => {
  const compiled = await compilePublishedSoundtracks(source);
  assert.deepEqual(compiled.catalogue, SOUNDTRACK_CATALOGUE);
  assert.deepEqual(compiled.archives, SOUNDTRACK_ARCHIVES);
  assert.deepEqual(compiled.collections, SOUNDTRACK_COLLECTIONS);
  assert.equal(compiled.catalogue.tracks.length, 70);
  assert.equal(compiled.files.length, 0);
  const local = await compilePublishedSoundtracks(source, { delivery: 'source' });
  assert.equal(local.catalogue.tracks.length, 0);
  assert.equal(local.files.length, 0);
  assert.equal(
    JSON.parse(await readFile(path.join(source, 'game/content/soundtrack-catalogue.json'))).tracks
      .length,
    70,
  );
});
