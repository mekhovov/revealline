import test from 'node:test';
import assert from 'node:assert/strict';
import { acquireAuthoredPicture } from '../ui/presentation-image.mjs';
import { createFlightPictures } from '../ui/flight-pictures.mjs';
import { mediaFixture, pngBytes, deferred } from './helpers/media-fixtures.mjs';

const background = (fit = 'contain') => ({
  dataUrl: `data:image/png;base64,${pngBytes().toString('base64')}`,
  fit,
  name: 'Authored fixture',
  metadata: { author: 'Test fixture' },
});
const tick = () => new Promise((resolve) => setImmediate(resolve));
function image(width = 1, height = 1) {
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
function options() {
  const f = mediaFixture(true);
  return {
    context: { runId: 'authored-attempt', ...f.request('gentle') },
    level: f.catalog.entries[1].campaign.levels[0],
    themeIds: ['fpv', 'ukraine'],
    identityCatalog: f.identityCatalog,
    explicitLegacy: true,
    readMedia: () => assert.fail('Explicit authored artwork does not read managed media.'),
  };
}

test('authored acquisition owns exact embedded bytes and fit across delayed decode and later mutation', async () => {
  const source = background(),
    before = source.dataUrl,
    gate = deferred(),
    drawn = image();
  let seen;
  const pending = acquireAuthoredPicture(source, {
    decodeImage: async (url) => {
      seen = url;
      await gate.promise;
      return drawn;
    },
  });
  await tick();
  source.dataUrl = 'https://example.invalid/new.png';
  source.fit = 'cover';
  gate.resolve();
  const handle = await pending;
  assert.equal(seen, before);
  assert.equal(handle.fit, 'contain');
  assert.equal(handle.image, drawn);
  assert.equal(Object.isFrozen(handle), true);
  handle.dispose();
  handle.dispose();
  assert.equal(drawn.closed, 1);
  assert.equal(drawn.removed, 1);
  const defaultSource = background();
  delete defaultSource.fit;
  const defaults = await acquireAuthoredPicture(defaultSource, {
    decodeImage: async () => image(),
  });
  assert.equal(defaults.fit, 'cover');
  defaults.dispose();
});

test('unsafe, malformed, oversized and unsupported authored descriptors reject before decoding', async () => {
  let reads = 0;
  const accessor = {};
  Object.defineProperty(accessor, 'dataUrl', {
    enumerable: true,
    get() {
      reads++;
      return background().dataUrl;
    },
  });
  for (const source of [
    null,
    [],
    accessor,
    { dataUrl: 'https://example.invalid/original.png' },
    { dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+' },
    { dataUrl: 'data:image/png;base64,a' },
    { dataUrl: 'x'.repeat(6 * 1024 * 1024 + 1) },
    { ...background(), fit: 'stretch' },
    { ...background(), width: 1 },
  ])
    await assert.rejects(
      acquireAuthoredPicture(source, {
        decodeImage: () => assert.fail('Invalid input reached decoder.'),
      }),
    );
  assert.equal(reads, 0);
});

test('decoder failure and incorrect authored dimensions cannot produce an accepted handle', async () => {
  await assert.rejects(
    acquireAuthoredPicture(background(), {
      decodeImage: async () => {
        throw new Error('Authored decode failed.');
      },
    }),
    /Authored decode failed/,
  );
  for (const drawn of [image(2, 1), { ...image(), width: 0 }, { ...image(), naturalHeight: 2 }]) {
    await assert.rejects(
      acquireAuthoredPicture(background(), { decodeImage: async () => drawn }),
      /dimensions/,
    );
    assert.equal(drawn.closed, 1);
    assert.equal(drawn.removed, 1);
  }
});

test('authored browser adapter waits for full decode and disposes the completed image exactly once', async () => {
  const decoded = deferred();
  let drawn,
    decodeCalls = 0,
    settled = false;
  class BrowserImage {
    constructor() {
      Object.assign(this, image());
      drawn = this;
    }
    set src(value) {
      this.source = value;
      queueMicrotask(() => this.onload?.());
    }
    decode() {
      decodeCalls++;
      return decoded.promise;
    }
  }
  const pending = acquireAuthoredPicture(background(), { ImageClass: BrowserImage }).then(
    (handle) => {
      settled = true;
      return handle;
    },
  );
  await tick();
  assert.equal(decodeCalls, 1);
  assert.equal(settled, false);
  decoded.resolve();
  const handle = await pending;
  assert.equal(handle.image, drawn);
  assert.equal(drawn.source, background().dataUrl);
  handle.dispose();
  handle.dispose();
  assert.equal(drawn.closed, 1);
  assert.equal(drawn.removed, 1);
});

test('cancelled authored acquisition rejects promptly and releases a decoder image returned after abort', async () => {
  const controller = new AbortController(),
    gate = deferred(),
    drawn = image();
  let entered = false;
  const pending = acquireAuthoredPicture(background(), {
    signal: controller.signal,
    decodeImage: async () => {
      entered = true;
      await gate.promise;
      return drawn;
    },
  });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await tick();
  assert.equal(entered, true);
  controller.abort();
  await rejected;
  assert.equal(drawn.closed, 0);
  gate.resolve();
  await tick();
  assert.equal(drawn.closed, 1);
  assert.equal(drawn.removed, 1);
  await assert.rejects(
    acquireAuthoredPicture(background(), {
      signal: controller.signal,
      decodeImage: () => assert.fail('Pre-aborted decoder.'),
    }),
    { name: 'AbortError' },
  );
});

test('dimension access reentry cannot publish an authored image after cancellation', async () => {
  const controller = new AbortController(),
    drawn = image();
  Object.defineProperty(drawn, 'naturalWidth', {
    get() {
      controller.abort();
      return 1;
    },
  });
  await assert.rejects(
    acquireAuthoredPicture(background(), {
      signal: controller.signal,
      decodeImage: async () => drawn,
    }),
    { name: 'AbortError' },
  );
  assert.equal(drawn.closed, 1);
});

test('authored cleanup failure cannot conceal the original dimensions or cancellation error', async () => {
  for (const reason of ['dimensions', 'cancel']) {
    const controller = new AbortController(),
      drawn = image(reason === 'dimensions' ? 2 : 1);
    drawn.close = () => {
      throw new Error('Cleanup failed.');
    };
    if (reason === 'cancel')
      Object.defineProperty(drawn, 'naturalWidth', {
        get() {
          controller.abort();
          return 1;
        },
      });
    await assert.rejects(
      acquireAuthoredPicture(background(), {
        signal: controller.signal,
        decodeImage: async () => drawn,
      }),
      reason === 'dimensions' ? /dimensions/ : { name: 'AbortError' },
    );
    assert.equal(drawn.removed, 1);
  }
});

test('legacy pin with authored acquisition is not ready until its owned drawable is decoded', async () => {
  const gate = deferred(),
    drawn = image(),
    statuses = [];
  let calls = 0,
    request,
    ownSignal;
  const owner = createFlightPictures({
    ...options(),
    acquireLegacy: async (target, { signal }) => {
      calls++;
      request = target;
      ownSignal = signal;
      return acquireAuthoredPicture(background(), {
        signal,
        decodeImage: async () => {
          await gate.promise;
          return drawn;
        },
      });
    },
  });
  const pins = owner.pins();
  const pending = owner.ensure('fpv', { onStatus: (status) => statuses.push(status) });
  assert.equal(owner.ready('fpv'), false);
  assert.equal(owner.current(), null);
  assert.deepEqual(request.pin, pins.choices[0]);
  assert.equal(request.themeId, 'fpv');
  assert.equal(ownSignal.aborted, false);
  assert.equal(statuses.at(-1).stage, 'decoding');
  gate.resolve();
  await pending;
  assert.equal(owner.ready('fpv'), true);
  assert.equal(owner.current().image, drawn);
  assert.equal(owner.current().fit, 'contain');
  assert.equal(owner.pins(), pins);
  assert.equal(statuses.at(-1).status, 'ready');
  await owner.ensure('fpv');
  assert.equal(calls, 1);
  owner.dispose();
  owner.dispose();
  assert.equal(drawn.closed, 1);
});

test('failed authored replacement retains the old ready image and exact pins, then retry disposes it on success', async () => {
  const first = image(),
    second = image();
  let fail = true;
  const owner = createFlightPictures({
    ...options(),
    acquireLegacy: ({ themeId }, { signal }) =>
      acquireAuthoredPicture(background(themeId === 'fpv' ? 'contain' : 'cover'), {
        signal,
        decodeImage: async () => {
          if (themeId === 'ukraine' && fail) throw new Error('Candidate unavailable.');
          return themeId === 'fpv' ? first : second;
        },
      }),
  });
  await owner.ensure('fpv');
  const prior = owner.current(),
    pins = owner.pins();
  await assert.rejects(owner.ensure('ukraine'), /Candidate unavailable/);
  assert.equal(owner.current(), prior);
  assert.equal(first.closed, 0);
  assert.equal(owner.ready('fpv'), true);
  assert.equal(owner.ready('ukraine'), false);
  assert.equal(owner.pins(), pins);
  fail = false;
  await owner.ensure('ukraine');
  assert.equal(owner.current().image, second);
  assert.equal(owner.current().fit, 'cover');
  assert.equal(first.closed, 1);
  assert.equal(second.closed, 0);
  assert.equal(owner.pins(), pins);
  owner.dispose();
  assert.equal(second.closed, 1);
});

for (const retirement of ['cancel', 'dispose', 'return to ready'])
  test(`${retirement} releases a late acquired legacy candidate without replacing the prior picture`, async () => {
    const late = deferred(),
      first = image(),
      second = image();
    let entered = false;
    const owner = createFlightPictures({
      ...options(),
      acquireLegacy: async ({ themeId }) => {
        if (themeId === 'ukraine') {
          entered = true;
          await late.promise;
        }
        // Deliberately ignores the signal: owner still must retire this handle.
        return acquireAuthoredPicture(background(), {
          decodeImage: async () => (themeId === 'fpv' ? first : second),
        });
      },
    });
    await owner.ensure('fpv');
    const prior = owner.current();
    const pending = owner.ensure('ukraine');
    assert.equal(entered, true);
    assert.equal(owner.current(), prior);
    assert.equal(first.closed, 0);
    if (retirement === 'cancel') owner.cancel();
    else if (retirement === 'dispose') owner.dispose();
    else await owner.ensure('fpv');
    late.resolve();
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(second.closed, 1);
    assert.equal(owner.current(), retirement === 'dispose' ? null : prior);
    assert.equal(first.closed, retirement === 'dispose' ? 1 : 0);
    owner.dispose();
    assert.equal(first.closed, 1);
    assert.equal(second.closed, 1);
  });

test('a newer successful authored acquisition owns readiness when an older callback settles late', async () => {
  const late = deferred(),
    first = image(),
    second = image();
  let count = 0;
  const owner = createFlightPictures({
    ...options(),
    acquireLegacy: async () => {
      const index = ++count;
      if (index === 1) await late.promise;
      return acquireAuthoredPicture(background(), {
        decodeImage: async () => (index === 1 ? first : second),
      });
    },
  });
  const old = owner.ensure('fpv');
  await owner.ensure('ukraine');
  const current = owner.current();
  late.resolve();
  await assert.rejects(old, { name: 'AbortError' });
  assert.equal(owner.current(), current);
  assert.equal(owner.ready('ukraine'), true);
  assert.equal(first.closed, 1);
  assert.equal(second.closed, 0);
  owner.dispose();
  assert.equal(second.closed, 1);
});

test('decoding-status reentry retires preparation before it calls an authored acquisition', async () => {
  let owner;
  owner = createFlightPictures({
    ...options(),
    acquireLegacy: () => assert.fail('Cancelled status must not acquire.'),
  });
  await assert.rejects(
    owner.ensure('fpv', {
      onStatus: (status) => {
        if (status.stage === 'decoding') owner.cancel();
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(owner.current(), null);
  assert.equal(owner.ready('fpv'), false);
  owner.dispose();
});

test('legacy practice and explicit procedural choices retain their historical no-image contract', async () => {
  const practice = createFlightPictures({
    ...options(),
    explicitLegacy: false,
    legacy: true,
    acquireLegacy: () => assert.fail('Practice must not acquire authored artwork.'),
  });
  assert.equal(practice.ready('fpv'), true);
  await practice.ensure('ukraine');
  assert.equal(practice.pins(), undefined);
  assert.equal(practice.current(), null);
  practice.dispose();
  const procedural = createFlightPictures({ ...options() });
  await procedural.ensure();
  assert.equal(procedural.ready('fpv'), true);
  assert.equal(procedural.current(), null);
  procedural.dispose();
});
