import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { compileHostedSoundtracks, hostedSoundtrackId } from './hosted-soundtrack-publication.mjs';
import {
  compilePublishedSoundtracks,
  soundtrackCatalogueModule,
} from './soundtrack-distribution.mjs';
import {
  SOUNDTRACK_CATALOGUE,
  SOUNDTRACK_ARCHIVES,
  SOUNDTRACK_COLLECTIONS,
} from '../game/content/soundtrack-catalogue.mjs';
import { stableId } from '../game/data-json.mjs';

const source = fileURLToPath(new URL('../', import.meta.url));
const manifestPath = 'authoring/library/licensed-audio/hosted-publication.json';
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'hosted-music-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const manifest = JSON.parse(await readFile(path.join(source, manifestPath)));
  for (const name of [
    manifestPath,
    ...manifest.provenance.pins.map((pin) => pin.path),
    ...manifest.provenance.remoteMetadata.map((pin) => pin.path),
  ]) {
    const target = path.join(root, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, await readFile(path.join(source, name)));
  }
  const save = () => writeFile(path.join(root, manifestPath), JSON.stringify(manifest));
  return { root, manifest, save };
}
test('70 exact hosted recordings and15 albums compile reproducibly without local MP3s', async (t) => {
  const f = await fixture(t);
  const a = await compileHostedSoundtracks(f.root, 'originals-1');
  const b = await compileHostedSoundtracks(f.root, 'originals-1');
  assert.deepEqual(a, b);
  assert.equal(a.tracks.length, 70);
  assert.equal(a.collections.length, 15);
  assert.equal(a.archives.length, 1);
  assert.equal(
    a.tracks.reduce((total, track) => total + track.asset.bytes, 0),
    354986122,
  );
  assert.deepEqual(a.tracks, SOUNDTRACK_CATALOGUE.tracks);
  assert.deepEqual(a.archives, SOUNDTRACK_ARCHIVES);
  assert.deepEqual(a.collections, SOUNDTRACK_COLLECTIONS);
  assert.equal(
    (await readdir(f.root, { recursive: true })).some((name) => name.endsWith('.mp3')),
    false,
  );
  assert.ok(
    a.tracks.every(
      (track) => track.policy.contentId === 'unknown' && !track.tags.genres.includes('ukrainian'),
    ),
  );
  assert.equal(new Set(a.collections.flatMap((album) => album.trackIds)).size, 70);
  const id = hostedSoundtrackId(
    '3xblast.if-you-re-thinking-about-giving-up-think-again-beause-i-believe-in-you',
  );
  assert.ok(stableId(id));
  assert.equal(id.length, 80);
  assert.ok(a.tracks.some((track) => track.id === id));
  assert.ok(
    a.tracks
      .filter((track) => track.id.includes('zander-noriega'))
      .every((track) =>
        track.websites.some((site) => site.url === 'https://twitter.com/ZanderNoriega'),
      ),
  );
  assert.equal(
    soundtrackCatalogueModule(SOUNDTRACK_CATALOGUE, a.archives, a.collections),
    soundtrackCatalogueModule(SOUNDTRACK_CATALOGUE, b.archives, b.collections),
  );
});
for (const [label, mutate] of [
  [
    'invented listening approval',
    (p) => {
      p.listeningApproval = true;
    },
  ],
  [
    'changed hash',
    (p) => {
      p.tracks[0].asset.sha256 = 'a'.repeat(64);
    },
  ],
  [
    'forged policy',
    (p) => {
      p.tracks[0].policy.contentId = 'not-registered';
    },
  ],
  [
    'removed attribution',
    (p) => {
      p.tracks.find((track) => track.artistURL).websites.pop();
    },
  ],
  [
    'foreign URL',
    (p) => {
      p.archive.baseURL = 'https://example.com/';
    },
  ],
  [
    'missing source evidence',
    (p) => {
      p.provenance.pins.pop();
    },
  ],
  [
    'stale inventory',
    (p) => {
      p.archive.inventorySha256 = 'b'.repeat(64);
    },
  ],
  [
    'duplicate album membership',
    (p) => {
      p.collections[1].trackIds[0] = p.collections[0].trackIds[0];
    },
  ],
  [
    'unapproved extra recording',
    (p) => {
      p.tracks.push({ ...p.tracks[0], id: 'ua-fpv.unapproved' });
    },
  ],
]) {
  test(`hosted admission rejects ${label}`, async (t) => {
    const f = await fixture(t);
    mutate(f.manifest);
    await f.save();
    await assert.rejects(compileHostedSoundtracks(f.root, 'originals-1'));
  });
}
test('changed evidence bytes fail the pinned source check', async (t) => {
  const f = await fixture(t);
  await writeFile(path.join(f.root, f.manifest.provenance.pins[1].path), '{}');
  await assert.rejects(compileHostedSoundtracks(f.root, 'originals-1'), /pin differs/);
});
test('runtime includes hosted metadata while source production never fabricates absent audio', async () => {
  const runtime = await compilePublishedSoundtracks(source);
  const local = await compilePublishedSoundtracks(source, { delivery: 'source' });
  assert.equal(runtime.catalogue.tracks.length, 70);
  assert.equal(runtime.files.length, 0);
  assert.equal(local.catalogue.tracks.length, 0);
  assert.equal(local.files.length, 0);
});
