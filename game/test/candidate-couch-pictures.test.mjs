import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { createCandidateCouchPictures } from '../couch/candidate-pictures.mjs';
import { acquireCandidatePicture, claimCandidatePicture } from '../content-design/picture.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';

const asset = createOpeningCandidates({ artwork: true }).assets[0];
const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
const media = await loadPreviewArtwork(asset, {
  fetchAsset: async () => new Response(bytes),
  digest: (value) => webcrypto.subtle.digest('SHA-256', value),
});
const row = Object.freeze({ asset, defaultThemeId: 'horizon' });
const options = (raceId, extra = {}) => ({ themeId: 'horizon', raceId, ...extra });
async function picture() {
  const image = {
    width: asset.width,
    height: asset.height,
    releases: 0,
    removeAttribute() {
      this.releases++;
    },
  };
  return acquireCandidatePicture(asset, {
    loadArtwork: async () => media,
    decodeImage: async () => image,
  });
}
const host = (acquire = picture) =>
  createCandidateCouchPictures({ owns: (value) => value === row, acquire });

test('candidate race lease keeps the accepted original until explicit commit retirement', async () => {
  const h = host();
  const first = await h.select(row, options(1));
  const second = await h.stage(row, options(2));
  assert.throws(() => second.commit(), /Confirm/);
  await second.confirm();
  h.confirm(row, { raceId: 1 });
  assert.equal(first.image.releases, 0);
  const retire = second.commit();
  h.confirm(row, { raceId: 2 });
  assert.equal(first.image.releases, 0);
  second.cancel();
  assert.equal(second.picture.image.releases, 0);
  retire();
  retire();
  assert.equal(first.image.releases, 1);
  h.dispose();
  h.dispose();
  assert.equal(second.picture.image.releases, 1);
});

for (const action of ['cancel', 'abort', 'dispose'])
  test(`candidate staged ${action} releases only the intended owners exactly once`, async () => {
    const h = host(),
      signal = new AbortController();
    const first = await h.select(row, options(1));
    const next = await h.stage(row, options(2, { signal: signal.signal }));
    if (action === 'abort') signal.abort();
    else if (action === 'dispose') h.dispose();
    else next.cancel();
    await assert.rejects(next.confirm(), { name: 'AbortError' });
    assert.equal(next.picture.image.releases, 1);
    assert.equal(first.image.releases, action === 'dispose' ? 1 : 0);
    h.dispose();
    assert.equal(first.image.releases, 1);
  });

test('candidate disposal retires a committed previous owner even when host handoff is interrupted', async () => {
  const h = host(),
    first = await h.select(row, options(1));
  const next = await h.stage(row, options(2));
  await next.confirm();
  const retire = next.commit();
  h.dispose();
  retire();
  assert.equal(first.image.releases, 1);
  assert.equal(next.picture.image.releases, 1);
});

test('cancelled late acquisition cannot replace or release the newer accepted original', async () => {
  let resolve;
  const old = await picture(),
    newer = await picture();
  let calls = 0;
  const h = host(() =>
    ++calls === 1
      ? new Promise((done) => {
          resolve = done;
        })
      : newer,
  );
  const pending = h.stage(row, options(1));
  h.cancel();
  await h.select(row, options(2));
  resolve(old);
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(old.image.releases, 1);
  assert.equal(newer.image.releases, 0);
  h.confirm(row, { raceId: 2 });
  h.dispose();
});

test('foreign row identity and already claimed bindings cannot steal another display owner', async () => {
  const foreign = await picture();
  claimCandidatePicture(asset, foreign);
  const h = host(async () => foreign);
  await assert.rejects(h.stage({ ...row }, options(1)), /exact authored/);
  await assert.rejects(h.stage(row, options(1)), /another display owner/);
  h.dispose();
  assert.equal(foreign.image.releases, 0);
  foreign.release();
});

test('reentrant preparation status cancellation cannot acquire or publish a picture', async () => {
  let acquisitions = 0;
  const h = host(() => {
    acquisitions++;
    return picture();
  });
  await assert.rejects(h.stage(row, options(1, { onStatus: () => h.cancel() })), {
    name: 'AbortError',
  });
  assert.equal(acquisitions, 0);
  h.dispose();
});
