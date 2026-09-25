import assert from 'node:assert/strict';
import test from 'node:test';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compileCoreSoundtrack,
  OPENING_THEME_PLAYLIST_ID,
  OPENING_THEME_TRACK_ID,
} from './core-soundtrack-publication.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));

test('core Shchedryk publication compiles reproducibly from exact checked-in bytes', async () => {
  const first = await compileCoreSoundtrack(root, 'originals-1');
  const second = await compileCoreSoundtrack(root, 'originals-1');
  assert.deepEqual(first, second);
  assert.equal(first.track.id, OPENING_THEME_TRACK_ID);
  assert.equal(first.collection.id, OPENING_THEME_PLAYLIST_ID);
  assert.equal(first.collection.trackIds[0], OPENING_THEME_TRACK_ID);
  assert.equal(first.collection.order, 'ordered');
  assert.equal(first.bundled.bytes, 8_641_768);
  assert.equal(first.track.policy.contentId, 'registered');
});

test('core publication rejects changed audio and invented completion evidence', async (t) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'shchedryk-core-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  for (const relative of [
    'authoring/library/licensed-audio/core-publication.json',
    'game/audio/soundtracks/d4147214e221be28f19d6c6c38afc8d3cf0289a0dc6ac579b26574a0c571bc58.mp3',
  ]) {
    const target = path.join(fixture, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(root, relative), target, { recursive: true });
  }
  const manifestPath = path.join(fixture, 'authoring/library/licensed-audio/core-publication.json');
  const manifest = JSON.parse(await readFile(manifestPath));
  manifest.review.device = true;
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(compileCoreSoundtrack(fixture, 'test'), /pending qualification/);
  manifest.review.device = false;
  await writeFile(manifestPath, JSON.stringify(manifest));
  const audioPath = path.join(fixture, manifest.track.path);
  const body = await readFile(audioPath);
  body[body.length - 1] ^= 1;
  await writeFile(audioPath, body);
  await assert.rejects(compileCoreSoundtrack(fixture, 'test'), /bytes differ/);
});

test('core publication rejects unrecognized authorization and qualification claims', async (t) => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'shchedryk-core-schema-'));
  t.after(() => rm(fixture, { recursive: true, force: true }));
  for (const relative of [
    'authoring/library/licensed-audio/core-publication.json',
    'game/audio/soundtracks/d4147214e221be28f19d6c6c38afc8d3cf0289a0dc6ac579b26574a0c571bc58.mp3',
  ]) {
    const target = path.join(fixture, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await cp(path.join(root, relative), target, { recursive: true });
  }
  const manifestPath = path.join(fixture, 'authoring/library/licensed-audio/core-publication.json');
  const manifest = JSON.parse(await readFile(manifestPath));
  manifest.review.browser = true;
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(compileCoreSoundtrack(fixture, 'test'), /review\.browser is not supported/);

  delete manifest.review.browser;
  manifest.authorization.releaseApproved = true;
  await writeFile(manifestPath, JSON.stringify(manifest));
  await assert.rejects(
    compileCoreSoundtrack(fixture, 'test'),
    /authorization\.releaseApproved is not supported/,
  );
});
