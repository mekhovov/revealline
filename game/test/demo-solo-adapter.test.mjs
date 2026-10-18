import test from 'node:test';
import assert from 'node:assert/strict';
import { createSoloDemoAdapter } from '../demo-modes/solo.mjs';
import { createDemoDirector } from '../demo-director.mjs';
import { BoardPainter } from '../ui/render.mjs';

const deferred = () => {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const flush = () => new Promise((resolve) => setImmediate(resolve));

function fixture(t, { playerDispose, actors, presentation, painterDispose } = {}) {
  const counts = { player: 0, actors: 0, presentation: 0, painter: 0 },
    barriers = [],
    owners = new WeakMap();
  t.mock.method(BoardPainter.prototype, 'setLook', async () => {});
  t.mock.method(BoardPainter.prototype, 'setLevel', () => {});
  t.mock.method(BoardPainter.prototype, 'dispose', () => {
    counts.painter++;
    return painterDispose?.();
  });
  const player = {
    phase: 'paused',
    state: { activeClassId: 'scout' },
    info: { seed: 17 },
    play() {},
    pause() {},
    advance() {},
    dispose() {
      counts.player++;
      return playerDispose?.();
    },
  };
  const source = {
    id: 'solo-cleanup',
    levelId: 'one',
    entry: { campaign: { id: 'cleanup', revision: 1 }, themes: [{ id: 'test' }] },
    level: { id: 'one' },
    create: async () => player,
  };
  const adapter = createSoloDemoAdapter({
    presets: {},
    getContext: () => ({ entries: [] }),
    getJourneyPictureContext: () => null,
    prepareActors: async () =>
      actors ?? {
        release() {
          counts.actors++;
        },
      },
    preparePresentation: async () =>
      presentation ?? {
        release() {
          counts.presentation++;
        },
      },
    onRetire: (promise) => barriers.push(promise),
    owners,
  });
  return { source, adapter, counts, barriers, owners };
}

test('Solo replacement waits for async disposal and repeated disposal shares its promise', async (t) => {
  const disposal = deferred();
  const f = fixture(t, { playerDispose: () => disposal.promise });
  let prepared = 0;
  const director = createDemoDirector({
    sources: [f.source, { ...f.source, id: 'next', levelId: 'two' }],
    random: () => 0,
    prepare: (...args) => {
      prepared++;
      return f.adapter.prepare(...args);
    },
  });
  try {
    await director.start();
    const first = director.player;
    const replacement = director.next();
    const retired = first.dispose();
    assert.equal(first.dispose(), retired);
    assert.equal(f.barriers[0], retired);
    assert.deepEqual(f.counts, { player: 1, painter: 1, actors: 1, presentation: 1 });
    await flush();
    assert.equal(prepared, 1, 'The next renderer cannot mount while this player is retiring.');
    disposal.resolve();
    assert.equal(await replacement, true);
    assert.equal(prepared, 2);
  } finally {
    disposal.resolve();
    await director.dispose();
  }
});

test('Solo independently releases every owner after synchronous and asynchronous cleanup failures', async (t) => {
  let actorReleases = 0,
    presentationReleases = 0;
  const f = fixture(t, {
    playerDispose() {
      throw new Error('Worker cleanup failed');
    },
    painterDispose: () => Promise.reject(new Error('Painter cleanup failed')),
    actors: { release: () => actorReleases++ },
    presentation: { release: () => presentationReleases++ },
  });
  const wrapper = await f.adapter.prepare(f.source, { signal: new AbortController().signal });
  const retired = wrapper.dispose();
  assert.equal(wrapper.dispose(), retired);
  assert.equal(f.counts.player, 1);
  assert.equal(f.counts.painter, 1);
  assert.equal(actorReleases, 1);
  assert.equal(presentationReleases, 1);
  await assert.doesNotReject(retired);
});

test('abort publishes immediate cleanup and joins a late asset release before preparation settles', async (t) => {
  const acquisition = deferred(),
    playerDisposal = deferred(),
    actorDisposal = deferred(),
    controller = new AbortController();
  let actorReleases = 0;
  const f = fixture(t, {
    playerDispose: () => playerDisposal.promise,
    actors: acquisition.promise,
  });
  let settled = false;
  const preparation = f.adapter.prepare(f.source, { signal: controller.signal });
  const rejected = assert.rejects(preparation, { name: 'AbortError' }).then(() => {
    settled = true;
  });
  await flush();
  controller.abort();
  assert.equal(f.counts.player, 1, 'Abort starts cleanup before the asset decoder returns.');
  assert.equal(f.barriers.length, 1, 'The host can block a replacement before a wrapper exists.');
  acquisition.resolve({
    release() {
      actorReleases++;
      return actorDisposal.promise;
    },
  });
  await flush();
  assert.equal(actorReleases, 1);
  assert.equal(f.barriers.length, 2, 'The host also sees late ownership retirement.');
  playerDisposal.resolve();
  await flush();
  assert.equal(settled, false, 'Preparation still owns the late actor cleanup.');
  actorDisposal.resolve();
  await rejected;
  await Promise.all(f.barriers);
  assert.equal(f.counts.player, 1);
  assert.equal(actorReleases, 1);
  assert.equal(f.counts.painter, 0, 'No renderer is constructed after cancellation.');
});
