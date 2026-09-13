import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { authoritativeCheckpoint } from '../replay.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';

const load = async (name) =>
  JSON.parse(await readFile(new URL(`../content/packs/${name}.json`, import.meta.url), 'utf8'));
const original = await load('fpv-arcade');
const featured = await load('fpv-arcade-r5');

function chapterFetch(t, intercept) {
  const actual = globalThis.fetch;
  globalThis.fetch = (url, ...args) => intercept(url, () => actual(url, ...args));
  t.after(() => {
    globalThis.fetch = actual;
  });
}

function originalImageBoundary(t) {
  const sizes = new Map(
    original.levelVisuals.map(({ visualOverrides }) => {
      const url = visualOverrides.background.dataUrl;
      const bytes = Buffer.from(url.split(',')[1], 'base64');
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      return [url, [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]];
    }),
  );
  const previous = globalThis.Image;
  globalThis.Image = class {
    set src(url) {
      const size = sizes.get(url);
      assert.ok(size, 'Only the exact existing First Light originals may decode');
      [this.naturalWidth, this.naturalHeight] = size;
      queueMicrotask(() => this.onload());
    }
  };
  t.after(() => {
    if (previous === undefined) delete globalThis.Image;
    else globalThis.Image = previous;
  });
}

test('uncached optional chapter failure preserves the real cut; explicit retry installs it and later offline selection uses stored content', async (t) => {
  originalImageBoundary(t);
  const page = await soloPage(t);
  let available = false,
    requests = 0;
  chapterFetch(t, async (url, request) => {
    if (url === 'content/packs/fpv-arcade.json') {
      requests++;
      if (!available) throw new TypeError('Failed to fetch');
    }
    return request();
  });
  page.$('start-button').click();
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let i = 0; i < 13; i++) page.frame();
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    selected = page.$('pack-select').value;
  assert.equal(run.player.cutting, true);
  page.$('shell-packs').click();
  page.frame(0);
  assert.equal(page.rendered.paused, true);
  // Opening Missions has its existing synchronous pause/autosave boundary.
  // The subsequent chapter request must perform no additional storage writes.
  const pausedStorage = new Map(page.storage.map),
    pausedWrites = page.storage.writes.length;
  page.change('pack-select', original.id);
  await settle(() => !page.$('pack-select').disabled);
  page.frame(0);
  assert.equal(page.rendered.run, run);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(page.$('pack-select').value, selected);
  assert.deepEqual(page.storage.map, pausedStorage);
  assert.equal(page.storage.writes.length, pausedWrites);
  assert.match(page.$('content-select-status').textContent, /First Light/);
  assert.match(page.$('content-select-status').textContent, /Connect to the internet/);
  assert.match(page.$('content-select-status').textContent, /choose this chapter again/);
  assert.equal(requests, 1);

  available = true;
  page.change('pack-select', original.id);
  await settle(() => !page.$('pack-select').disabled);
  page.frame(0);
  assert.equal(page.$('pack-select').value, original.id);
  assert.deepEqual(page.rendered.run.level, normalizedLevel(original.campaigns[0].levels[0]));
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(requests, 2);
  page.change('pack-select', '');
  await settle(() => !page.$('pack-select').disabled);
  available = false;
  page.change('pack-select', original.id);
  await settle(() => !page.$('pack-select').disabled);
  page.frame(0);
  assert.equal(page.$('pack-select').value, original.id);
  assert.deepEqual(page.rendered.run.level, normalizedLevel(original.campaigns[0].levels[0]));
  assert.equal(requests, 2, 'Already-installed chapter selection does not require another fetch');
  assert.deepEqual(page.errors, []);
});

test('featured download failure is visible inside the retained title and its button can deliberately retry', async (t) => {
  originalImageBoundary(t);
  const page = await soloPage(t, { titleScreen: true });
  let available = false,
    requests = 0;
  chapterFetch(t, async (url, request) => {
    if (url === 'content/packs/fpv-arcade-r5.json') {
      requests++;
      if (!available) throw new TypeError('Failed to fetch');
    }
    return request();
  });
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    stored = new Map(page.storage.map);
  page.$('shell-featured').click();
  await settle(() => !page.$('shell-featured').disabled);
  page.frame(0);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual(page.storage.map, stored);
  assert.equal(page.$('shell-home').open, true);
  const status = page.$('shell-featured-status');
  assert.ok(page.$('shell-home').contains(status));
  assert.equal(status.hidden, false);
  assert.equal(status.getAttribute('role'), 'status');
  assert.match(status.textContent, /Pressure Lines/);
  assert.match(status.textContent, /choose this chapter again/);
  assert.equal(requests, 1);
  available = true;
  page.$('shell-featured').click();
  await settle(() => !page.$('shell-featured').disabled);
  page.frame(0);
  assert.equal(requests, 2);
  assert.equal(page.$('shell-home').open, false);
  assert.equal(page.$('pack-select').value, featured.id);
  assert.deepEqual(page.rendered.run.level, normalizedLevel(featured.campaigns[0].levels[0]));
  assert.deepEqual(page.errors, []);
});

test('a late failed chapter request cannot replace the status or run from a newer explicit action', async (t) => {
  const page = await soloPage(t);
  let rejectRequest;
  chapterFetch(t, (url, request) =>
    url === 'content/packs/fpv-arcade.json'
      ? new Promise((resolve, reject) => {
          rejectRequest = reject;
        })
      : request(),
  );
  page.change('pack-select', original.id);
  assert.equal(page.$('pack-select').disabled, true);
  page.$('restart-button').click();
  page.frame(0);
  const newerRun = page.rendered.run,
    checkpoint = authoritativeCheckpoint(newerRun),
    message = page.$('content-select-status').textContent,
    titleMessage = page.$('shell-featured-status').textContent,
    titleHidden = page.$('shell-featured-status').hidden;
  assert.equal(page.$('pack-select').disabled, false);
  rejectRequest(new TypeError('Failed to fetch'));
  await new Promise((resolve) => setImmediate(resolve));
  page.frame(0);
  assert.equal(page.rendered.run, newerRun);
  assert.deepEqual(authoritativeCheckpoint(newerRun), checkpoint);
  assert.equal(page.$('content-select-status').textContent, message);
  assert.equal(page.$('shell-featured-status').textContent, titleMessage);
  assert.equal(page.$('shell-featured-status').hidden, titleHidden);
  assert.doesNotMatch(message, /Chapter download unavailable/);
  assert.deepEqual(page.errors, []);
});
