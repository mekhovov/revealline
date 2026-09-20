import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { acquireCandidatePicture } from '../content-design/picture.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { createContentAttemptPreparer } from '../content-design/attempt.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { decodeOwnedPicture } from '../ui/presentation-image.mjs';
import { createCandidateFlightPictures } from '../ui/candidate-flight-pictures.mjs';
import { drawResultPicture } from '../ui/result-picture.mjs';
import { stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint, recordInput } from '../replay.mjs';

const source = createOpeningCandidates({ artwork: true }),
  asset = source.assets[0];
const bytes = await readFile(new URL(`../${asset.path}`, import.meta.url));
const media = await loadPreviewArtwork(asset, {
  fetchAsset: async () => new Response(bytes),
  digest: (value) => webcrypto.subtle.digest('SHA-256', value),
});
const { themes } = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
);
const loadArtwork = async () => media;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const turn = () => new Promise((resolve) => setImmediate(resolve));
function image(width = asset.width, height = asset.height) {
  return {
    width,
    height,
    naturalWidth: width,
    naturalHeight: height,
    removed: 0,
    closed: 0,
    removeAttribute(name) {
      assert.equal(name, 'src');
      this.removed++;
    },
    close() {
      this.closed++;
    },
  };
}
const request = (host, difficulty = 'standard') => ({
  missionId: host.catalog.journey().missions[0].id,
  difficulty,
  seed: 1,
  turnPolicy: 'immediate',
});
const context = {
  runId: 'candidate-run',
  executionKey: 'opening/candidate-r1',
  levelId: 'first-return',
  levelRevision: '1',
  themeId: 'horizon',
};
const bindingFor = (drawable = image()) =>
  acquireCandidatePicture(asset, { loadArtwork, decodeImage: async () => drawable });

test('verified candidate image is an owned drawable, never an official media pin or award', async () => {
  const drawable = image();
  let decodes = 0;
  const binding = await acquireCandidatePicture(asset, {
    loadArtwork,
    decodeImage: async (dataUrl) => {
      decodes++;
      assert.equal(dataUrl, media.dataUrl);
      return drawable;
    },
  });
  assert.equal(decodes, 1);
  assert.equal(binding.image, drawable);
  assert.equal(binding.fit, 'cover');
  assert.equal(binding.name, asset.alt);
  assert.deepEqual(binding.assetRevision, asset);
  assert(Object.isFrozen(binding.assetRevision));
  assert.equal(binding.officialProgressEligible, false);
  assert.equal(binding.pin, undefined);
  binding.release();
  binding.release();
  assert.equal(drawable.removed, 1);
  assert.equal(drawable.closed, 1);
});

test('asset verification precedes decoding and refuses unbranded or mismatched originals', async () => {
  for (const [pin, loader] of [
    [asset, async () => ({ ...media })],
    [{ ...asset, revision: 'r2' }, loadArtwork],
    [source.assets[1], loadArtwork],
  ])
    await assert.rejects(
      acquireCandidatePicture(pin, {
        loadArtwork: loader,
        decodeImage: () => assert.fail('Unverified pixels must never reach the decoder.'),
      }),
      /verify/,
    );
});

test('wrong complete-decode dimensions release the image without becoming ready', async () => {
  for (const drawable of [image(1, 1), { ...image(), width: 0 }, { ...image(), naturalWidth: 1 }]) {
    await assert.rejects(
      acquireCandidatePicture(asset, { loadArtwork, decodeImage: async () => drawable }),
      /dimensions/,
    );
    assert.equal(drawable.closed, 1);
  }
});

test('browser path waits for decode(), not only onload, and owns the final drawable', async () => {
  const decode = deferred(),
    started = deferred();
  let drawable,
    ready = false;
  class ImageFixture {
    constructor() {
      Object.assign(this, image());
      drawable = this;
    }
    set src(value) {
      assert.equal(value, media.dataUrl);
      queueMicrotask(() => this.onload?.());
    }
    decode() {
      started.resolve();
      return decode.promise;
    }
  }
  const pending = acquireCandidatePicture(asset, { loadArtwork, ImageClass: ImageFixture }).then(
    (value) => {
      ready = true;
      return value;
    },
  );
  await started.promise;
  assert.equal(ready, false);
  assert.equal(drawable.closed, 0);
  decode.resolve();
  const binding = await pending;
  assert.equal(binding.image, drawable);
  assert.equal(drawable.onload, null);
  assert.equal(drawable.onerror, null);
  binding.release();
  assert.equal(drawable.closed, 1);
});

test('native decode failure and missing complete-decode support remain recoverable failures', async () => {
  for (const failure of ['error', 'unsupported']) {
    let drawable;
    class ImageFixture {
      constructor() {
        Object.assign(this, image());
        drawable = this;
      }
      set src(_value) {
        queueMicrotask(() => (failure === 'error' ? this.onerror?.() : this.onload?.()));
      }
    }
    await assert.rejects(
      acquireCandidatePicture(asset, { loadArtwork, ImageClass: ImageFixture }),
      /decode|decoding/,
    );
    assert.equal(drawable.closed, 1);
    assert.equal(drawable.onload, null);
    assert.equal(drawable.onerror, null);
  }
});

test('abort and deadline settle injected stalled decoders and release their later images exactly once', async () => {
  for (const reason of ['abort', 'deadline']) {
    const started = deferred(),
      late = deferred(),
      controller = new AbortController(),
      drawable = image();
    const pending = acquireCandidatePicture(asset, {
      loadArtwork,
      signal: controller.signal,
      decodeTimeoutMs: reason === 'deadline' ? 5 : 15000,
      decodeImage: () => {
        started.resolve();
        return late.promise;
      },
    });
    const rejection = assert.rejects(
      pending,
      reason === 'abort' ? { name: 'AbortError' } : /timed out/,
    );
    await started.promise;
    if (reason === 'abort') controller.abort();
    await rejection;
    late.resolve(drawable);
    await turn();
    assert.equal(drawable.closed, 1);
  }
});

test('already aborted acquisition never touches artwork or browser allocation', async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    acquireCandidatePicture(asset, {
      signal: controller.signal,
      loadArtwork: () => assert.fail('No fetch after cancellation'),
    }),
    { name: 'AbortError' },
  );
  for (const timeoutMs of [0, -1, Infinity, 15001]) {
    await assert.rejects(
      decodeOwnedPicture('verified-fixture', {
        timeoutMs,
        decodeImage: () => assert.fail('No decode with invalid deadline'),
      }),
      /timeout/,
    );
  }
});

test('candidate readiness requires decoded artwork and picture ownership transfers exactly once', async () => {
  const started = deferred(),
    decode = deferred(),
    drawable = image();
  const host = createContentAttemptPreparer(source, {
    themes,
    loadArtwork,
    decodeImage: () => {
      started.resolve();
      return decode.promise;
    },
  });
  let ready = false;
  const pending = host.prepare(request(host)).then((value) => {
    ready = true;
    return value;
  });
  await started.promise;
  assert.equal(ready, false);
  decode.resolve(drawable);
  const prepared = await pending;
  assert(host.current(prepared));
  assert.equal(prepared.picture.image, drawable);
  assert.equal(prepared.run.tick, 0);
  assert.throws(() => host.take({ ...prepared }), /no longer current/);
  assert.equal(host.take(prepared), prepared);
  assert(!host.current(prepared));
  assert.throws(() => host.take(prepared), /no longer current/);
  host.dispose();
  assert.equal(drawable.closed, 0, 'The accepting host owns the transferred image.');
  prepared.picture.release();
  assert.equal(drawable.closed, 1);
});

test('an unadopted prepared image is retired on cancellation but a taken current flight survives a failed replacement', async () => {
  const images = [],
    host = createContentAttemptPreparer(source, {
      themes,
      loadArtwork,
      decodeImage: async () => {
        const drawable = image();
        images.push(drawable);
        return drawable;
      },
    });
  const first = await host.prepare(request(host));
  host.cancel();
  assert.equal(images[0].closed, 1);
  assert(!host.current(first));
  const second = host.take(await host.prepare(request(host, 'expert')));
  await assert.rejects(
    host.prepare({ ...request(host), missionId: host.catalog.journey().missions[1].id }),
    /verify/,
  );
  assert.equal(images[1].closed, 0);
  assert.equal(second.run.lives, 2);
  assert.equal(second.run.tick, 0);
  host.dispose();
  assert.equal(images[1].closed, 0);
  second.picture.release();
  assert.equal(images[1].closed, 1);
});

test('a newer preset preparation cancels slow decode without leaking or adopting its late image', async () => {
  const started = deferred(),
    late = deferred(),
    oldImage = image(),
    newImage = image();
  let decodes = 0;
  const host = createContentAttemptPreparer(source, {
    themes,
    loadArtwork,
    decodeImage: async () => {
      if (++decodes === 1) {
        started.resolve();
        return late.promise;
      }
      return newImage;
    },
  });
  const first = host.prepare(request(host));
  const rejected = assert.rejects(first, { name: 'AbortError' });
  await started.promise;
  const newer = await host.prepare(request(host, 'gentle'));
  await rejected;
  late.resolve(oldImage);
  await turn();
  assert.equal(oldImage.closed, 1);
  assert.equal(newImage.closed, 0);
  assert(host.current(newer));
  assert.equal(newer.run.lives, 5);
  host.dispose();
  assert.equal(newImage.closed, 1);
});

test('candidate flight picture interface keeps exact context and readiness without managed pins', async () => {
  const drawable = image(),
    supplied = { ...context };
  let calls = 0;
  const owner = createCandidateFlightPictures({
    context: supplied,
    asset,
    acquire: async () => {
      calls++;
      return bindingFor(drawable);
    },
  });
  supplied.levelId = 'changed-outside';
  assert.equal(owner.context.levelId, 'first-return');
  assert.equal(owner.kind, 'candidate');
  assert.equal(owner.officialProgressEligible, false);
  assert.equal(owner.pins(), undefined);
  assert.equal(owner.identityCatalog, null);
  assert.equal(owner.current(), null);
  assert(!owner.ready('horizon'));
  await owner.ensure();
  assert(owner.ready('horizon'));
  assert(!owner.ready('retro'));
  assert.equal(owner.current().image, drawable);
  await owner.ensure();
  assert.equal(calls, 1, 'Warm readiness does not re-fetch or decode.');
  await assert.rejects(owner.ensure('retro'), /authored theme/);
  assert(owner.ready('horizon'));
  owner.cancel();
  assert(owner.ready('horizon'), 'Cancel retires preparation, not an existing picture.');
  owner.dispose();
  owner.dispose();
  assert.equal(drawable.closed, 1);
  assert.equal(owner.current(), null);
  assert(!owner.ready('horizon'));
});

test('a prepared image transfers into exactly one display owner without decoding twice', async () => {
  const drawable = image(),
    picture = await bindingFor(drawable);
  const owner = createCandidateFlightPictures({
    context,
    asset,
    picture,
    acquire: () => assert.fail('Already decoded'),
  });
  await owner.ensure();
  assert.equal(owner.current(), picture);
  assert.throws(
    () =>
      createCandidateFlightPictures({ context: { ...context, runId: 'other' }, asset, picture }),
    /another display owner/,
  );
  assert.equal(drawable.closed, 0);
  owner.dispose();
  assert.throws(() => createCandidateFlightPictures({ context, asset, picture }), /exact original/);
});

test('a failed or borrowed acquisition cannot dispose another active display’s original', async () => {
  const drawable = image(),
    picture = await bindingFor(drawable);
  const owner = createCandidateFlightPictures({ context, asset, picture });
  const other = createCandidateFlightPictures({
    context: { ...context, runId: 'other' },
    asset,
    acquire: async () => picture,
  });
  await assert.rejects(other.ensure(), /another display owner/);
  assert.equal(other.current(), null);
  assert(owner.ready('horizon'));
  assert.equal(drawable.closed, 0);
  other.dispose();
  assert.equal(drawable.closed, 0);
  owner.dispose();
  assert.equal(drawable.closed, 1);
});

test('cancel, close and timeout reject promptly and discard late acquired bindings', async () => {
  for (const action of ['cancel', 'dispose', 'timeout']) {
    const entered = deferred(),
      late = deferred(),
      drawable = image();
    const picture = await bindingFor(drawable);
    const owner = createCandidateFlightPictures({
      context,
      asset,
      timeoutMs: action === 'timeout' ? 5 : 20000,
      acquire: () => {
        entered.resolve();
        return late.promise;
      },
    });
    const pending = owner.ensure();
    const rejection = assert.rejects(
      pending,
      action === 'timeout' ? /in time/ : { name: 'AbortError' },
    );
    await entered.promise;
    if (action !== 'timeout') owner[action]();
    await rejection;
    late.resolve(picture);
    await turn();
    assert.equal(drawable.closed, 1);
    assert.equal(owner.current(), null);
    owner.dispose();
  }
});

test('ready observer cancellation cannot publish the newly acquired picture', async () => {
  const drawable = image();
  const owner = createCandidateFlightPictures({
    context,
    asset,
    acquire: () => bindingFor(drawable),
  });
  await assert.rejects(
    owner.ensure(undefined, {
      onStatus(status) {
        if (status.status === 'ready') owner.cancel();
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(owner.current(), null);
  assert.equal(drawable.closed, 1);
  owner.dispose();
});

test('externally released pixels never remain ready or drawable', async () => {
  const first = await bindingFor(),
    second = await bindingFor();
  const owner = createCandidateFlightPictures({
    context,
    asset,
    picture: first,
    acquire: async () => second,
  });
  first.release();
  assert(!owner.ready('horizon'));
  assert.equal(owner.current(), null);
  await owner.ensure();
  assert.equal(owner.current(), second);
  owner.dispose();
});

test('the existing result renderer displays candidate pixels without altering earned coverage or borrowing a replacement', async () => {
  const drawable = image();
  const host = createContentAttemptPreparer(source, {
    themes,
    loadArtwork,
    decodeImage: async () => drawable,
  });
  const attempt = host.take(await host.prepare(request(host)));
  const owner = createCandidateFlightPictures({
    context: {
      ...context,
      executionKey: attempt.entry.executionKey,
      levelRevision: attempt.run.level.revision,
    },
    asset: attempt.manifest.background,
    picture: attempt.picture,
  });
  for (let tick = 0; tick < 1000 && attempt.run.status === 'running'; tick++) {
    recordInput(attempt.recorder, { direction: 'down' });
    stepRun(attempt.run, { direction: 'down' }, FIXED_DT);
  }
  assert.equal(attempt.run.status, 'won');
  assert(attempt.run.coverage > 0.3 && attempt.run.coverage < 0.35);
  const before = authoritativeCheckpoint(attempt.run),
    calls = [];
  const canvas = { width: 0, height: 0, hidden: true, getContext: () => ({}) };
  const painter = {
    images: { background: { id: 'unrelated-last-image' } },
    drawGallery(_ctx, options) {
      calls.push(options);
    },
  };
  const options = {
    kind: 'won',
    run: attempt.run,
    theme: attempt.theme,
    seed: 1,
    painter,
    flightPictures: owner,
  };
  assert.equal(drawResultPicture(canvas, options), true);
  assert.equal(calls[0].image, drawable);
  assert.equal(calls[0].fit, 'cover');
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 320);
  assert.deepEqual(authoritativeCheckpoint(attempt.run), before);
  owner.dispose();
  assert.equal(drawResultPicture(canvas, options), false);
  assert.equal(calls.length, 1, 'A missing candidate cannot fall back to a different image.');
  assert.equal(canvas.hidden, true);
  host.dispose();
});
