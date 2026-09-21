import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { albumFixture } from '../game/test/helpers/soundtrack-albums.mjs';
import { applySoundtrackArchiveAdmissions } from './soundtrack-archive-admissions.mjs';

const manifestPath = 'authoring/library/soundtrack-archive-admissions.json';
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
const sha = (value) => createHash('sha256').update(value).digest('hex');
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'archive-admission-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const album = await albumFixture(),
    id = 'builtin.catalog.approved';
  const track = {
    ...album.track,
    id,
    edition: 'qa',
    path: `optional/soundtracks/${album.track.asset.sha256}.mp3`,
    tags: { genres: ['synth90s'], role: 'gameplay', energy: 4, themes: ['retro'] },
    policy: {
      id,
      sha256: album.track.asset.sha256,
      webPlayback: 'allowed',
      offlineCache: 'allowed',
      redistribute: 'allowed',
      modify: 'allowed',
      gameplayVideo: 'allowed',
      contentId: 'unknown',
    },
  };
  const body = Buffer.from(await album.prepared.assets[0].blob.arrayBuffer());
  const built = {
    catalogue: { format: 'revealline-soundtrack-catalogue.v2', edition: 'qa', tracks: [track] },
    files: [{ name: track.path, bytes: body }],
    albums: { format: 'revealline-soundtrack-albums.v1', albums: [] },
    archives: [],
  };
  const inventory = {
    format: 'revealline-soundtrack-archive.v1',
    id: 'soundtracks.1',
    files: [{ path: `objects/${track.asset.sha256}.mp3`, bytes: body.length, sha256: sha(body) }],
  };
  const admission = {
    id: inventory.id,
    baseURL: 'https://mekhovov.github.io/revealline-soundtracks-1/',
    inventorySha256: sha(json(inventory)),
  };
  const verification = {
    format: 'revealline-soundtrack-host-verification.v1',
    checkedAt: '2026-09-21T00:00:00Z',
    baseURL: admission.baseURL,
    inventorySha256: admission.inventorySha256,
    objects: inventory.files,
  };
  const entry = {
    admission,
    inventory: 'authoring/library/archives/one/inventory.json',
    verification: 'authoring/library/archives/one/verification.json',
    trackIds: [id],
  };
  const manifest = { format: 'revealline-soundtrack-archive-admissions.v1', archives: [entry] };
  const put = async (relative, value) => {
    const file = path.join(root, relative);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, Buffer.isBuffer(value) ? value : json(value));
  };
  const save = async () => {
    await put(entry.inventory, inventory);
    await put(entry.verification, verification);
    await put(manifestPath, manifest);
  };
  await save();
  return { root, built, manifest, entry, inventory, verification, put, save, track };
}
test('admitted exact hosted recordings are mapped to streaming objects and leave game payload', async (t) => {
  const f = await fixture(t),
    result = await applySoundtrackArchiveAdmissions(f.root, f.built);
  assert.equal(result.files.length, 0);
  assert.equal(result.catalogue.tracks[0].archiveId, 'soundtracks.1');
  assert.equal(result.catalogue.tracks[0].path, f.inventory.files[0].path);
  assert.deepEqual(result.archives, [f.entry.admission]);
  assert.equal(f.built.catalogue.tracks[0].archiveId, undefined);
});
test('empty or absent admissions keep reviewed local delivery unchanged', async (t) => {
  const f = await fixture(t);
  f.manifest.archives = [];
  await f.save();
  assert.deepEqual(await applySoundtrackArchiveAdmissions(f.root, f.built), f.built);
  await rm(path.join(f.root, manifestPath));
  assert.deepEqual(await applySoundtrackArchiveAdmissions(f.root, f.built), f.built);
});
for (const [label, mutate] of [
  [
    'wrong hosted hash',
    (f) => {
      f.verification.inventorySha256 = '0'.repeat(64);
    },
  ],
  [
    'unverified objects',
    (f) => {
      f.verification.objects = [];
    },
  ],
  [
    'unpublished identity',
    (f) => {
      f.entry.trackIds = ['builtin.catalog.unreviewed'];
    },
  ],
  [
    'restricted rights',
    (f) => {
      f.track.policy.redistribute = 'denied';
    },
  ],
  [
    'changed inventory bytes',
    (f) => {
      f.inventory.files[0].bytes++;
    },
  ],
  [
    'remote host',
    (f) => {
      f.entry.admission.baseURL = 'https://artist.example/preview/';
    },
  ],
  [
    'repeated track identity',
    (f) => {
      f.entry.trackIds.push(f.track.id);
    },
  ],
  [
    'evidence traversal',
    (f) => {
      f.entry.verification = 'authoring/library/../outside.json';
    },
  ],
])
  test(`archive admission rejects ${label}`, async (t) => {
    const f = await fixture(t);
    mutate(f);
    // Deliberately write the trusted file locations even when a declared path is invalid.
    await f.put('authoring/library/archives/one/inventory.json', f.inventory);
    await f.put('authoring/library/archives/one/verification.json', f.verification);
    await f.put(manifestPath, f.manifest);
    await assert.rejects(applySoundtrackArchiveAdmissions(f.root, f.built));
  });
test('archive admission rejects extra objects even if inventory and verification agree', async (t) => {
  const f = await fixture(t);
  f.inventory.files.push({
    path: `objects/${'1'.repeat(64)}.mp3`,
    bytes: 100,
    sha256: '1'.repeat(64),
  });
  f.entry.admission.inventorySha256 = sha(json(f.inventory));
  f.verification.inventorySha256 = f.entry.admission.inventorySha256;
  await f.save();
  await assert.rejects(applySoundtrackArchiveAdmissions(f.root, f.built), /exactly the admitted/);
});
test('archive evidence cannot resolve through a symlink', async (t) => {
  const f = await fixture(t),
    file = path.join(f.root, f.entry.verification);
  await rm(file);
  await symlink(path.join(f.root, f.entry.inventory), file);
  await assert.rejects(applySoundtrackArchiveAdmissions(f.root, f.built), /symbolic links/);
});

test('distinct archive IDs cannot remove local audio behind conflicting inventory pins at the same hosted URL', async (t) => {
  const f = await fixture(t),
    alias = {
      ...f.track,
      id: 'builtin.catalog.second-alias',
      policy: { ...f.track.policy, id: 'builtin.catalog.second-alias' },
    },
    inventory = { ...f.inventory, id: 'soundtracks.2' },
    admission = { ...f.entry.admission, id: inventory.id, inventorySha256: sha(json(inventory)) },
    entry = {
      admission,
      inventory: 'authoring/library/archives/two/inventory.json',
      verification: 'authoring/library/archives/two/verification.json',
      trackIds: [alias.id],
    };
  f.built.catalogue.tracks.push(alias);
  f.manifest.archives.push(entry);
  await f.put(entry.inventory, inventory);
  await f.put(entry.verification, {
    ...f.verification,
    inventorySha256: admission.inventorySha256,
  });
  await f.save();
  assert.notEqual(admission.inventorySha256, f.entry.admission.inventorySha256);
  await assert.rejects(applySoundtrackArchiveAdmissions(f.root, f.built), /one admitted inventory/);
  assert.equal(f.built.files.length, 1);
  assert(f.built.catalogue.tracks.every((track) => !track.archiveId));
});

for (const permission of ['redistribute', 'webPlayback'])
  test(`an allowed alias cannot bypass another trusted same-hash ${permission} restriction`, async (t) => {
    const f = await fixture(t),
      id = 'builtin.catalog.restricted-alias';
    f.built.catalogue.tracks.push({
      ...f.track,
      id,
      policy: { ...f.track.policy, id, [permission]: 'denied' },
    });
    await assert.rejects(applySoundtrackArchiveAdmissions(f.root, f.built), /restricted recording/);
    assert.equal(f.built.files.length, 1);
  });

test('mapping one alias keeps shared local delivery needed by an unmapped alias', async (t) => {
  const f = await fixture(t),
    id = 'builtin.catalog.local-alias';
  f.built.catalogue.tracks.push({ ...f.track, id, policy: { ...f.track.policy, id } });
  const result = await applySoundtrackArchiveAdmissions(f.root, f.built);
  assert.equal(result.catalogue.tracks[0].archiveId, f.entry.admission.id);
  assert.equal(result.catalogue.tracks[1].archiveId, undefined);
  assert.equal(result.files.length, 1);
  assert.deepEqual(result.files[0].bytes, f.built.files[0].bytes);
  f.entry.trackIds.push(id);
  await f.save();
  const complete = await applySoundtrackArchiveAdmissions(f.root, f.built);
  assert(complete.catalogue.tracks.every((track) => track.archiveId === f.entry.admission.id));
  assert.equal(complete.files.length, 0);
});
