import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { createJourneyArtworkView } from '../ui/journey-artwork.mjs';
import { acquireCandidatePicture } from '../content-design/picture.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';

const asset = createOpeningCandidates({ artwork: true }).assets[0];
const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
const media = await loadPreviewArtwork(asset, {
  fetchAsset: async () => new Response(bytes),
  digest: (value) => webcrypto.subtle.digest('SHA-256', value),
});
async function picture() {
  const image = {
    width: asset.width,
    height: asset.height,
    closed: 0,
    close() {
      this.closed++;
    },
  };
  return {
    image,
    binding: await acquireCandidatePicture(asset, {
      loadArtwork: async () => media,
      decodeImage: async () => image,
    }),
  };
}
function view(acquire) {
  const draws = [],
    canvas = {
      width: 288,
      height: 144,
      getContext: () => ({ drawImage: (...args) => draws.push(args) }),
    },
    status = { textContent: '' };
  return { canvas, status, draws, view: createJourneyArtworkView({ canvas, status, acquire }) };
}

test('earned display requires verified exact bytes and decode; release discards owned image', async () => {
  const p = await picture(),
    f = view(async () => p.binding);
  const pending = f.view.show({ asset });
  assert.equal(f.status.textContent, 'Opening earned original…');
  assert.equal(await pending, true);
  assert.equal(f.draws[0][0], p.image);
  assert.equal(f.canvas.height, 144);
  assert.equal(f.status.textContent, 'Earned original');
  f.view.release();
  assert.equal(p.image.closed, 1);
  assert.equal(f.canvas.hidden, true);
});

test('release during acquisition cancels its signal; a late decoded image never paints', async () => {
  let finish, signal;
  const f = view((_asset, options) => {
    signal = options.signal;
    return new Promise((resolve) => {
      finish = resolve;
    });
  });
  const pending = f.view.show({ asset });
  f.view.release();
  assert.equal(signal.aborted, true);
  const p = await picture();
  finish(p.binding);
  assert.equal(await pending, false);
  assert.equal(p.image.closed, 1);
  assert.equal(f.draws.length, 0);
});

test('newer request owns its status and picture; old completion cannot replace it', async () => {
  let finish,
    calls = 0;
  const a = await picture(),
    b = await picture();
  const f = view(() =>
    ++calls === 1
      ? new Promise((resolve) => {
          finish = resolve;
        })
      : Promise.resolve(b.binding),
  );
  const old = f.view.show({ asset });
  assert.equal(await f.view.show({ asset }), true);
  finish(a.binding);
  assert.equal(await old, false);
  assert.equal(f.draws.length, 1);
  assert.equal(f.draws[0][0], b.image);
  assert.equal(f.status.textContent, 'Earned original');
  assert.equal(a.image.closed, 1);
  f.view.release();
  assert.equal(b.image.closed, 1);
});

test('missing bytes and unverified candidates expose repair without substituting another image', async () => {
  const fail = view(async () => {
    throw new Error('Unavailable original');
  });
  assert.equal(await fail.view.show({ asset }), false);
  assert.match(fail.status.textContent, /Original unavailable.*retry download/);
  assert.equal(fail.draws.length, 0);
  let released = false;
  const mismatch = view(async () => ({
    image: {},
    release() {
      released = true;
    },
  }));
  assert.equal(await mismatch.view.show({ asset }), false);
  assert.equal(released, true);
  assert.equal(mismatch.draws.length, 0);
  assert.match(mismatch.status.textContent, /identity does not match/);
});
