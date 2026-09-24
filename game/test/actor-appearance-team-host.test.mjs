import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { ACTOR_STYLE_PREFERENCES_KEY } from '../actor-style-preferences.mjs';

// Production Team selection/input/renderer and exact pinned asset bytes, with
// finite DOM/Canvas and modeled PNG decoding. No native visual-quality claim.
const ready = (f) =>
  waitFor(
    () => f.$('coop-picture-status').dataset.state === 'ready',
    () => f.$('coop-picture-status').textContent,
  );
function start(f) {
  f.$('coop-start').click();
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-overlay').hidden, true);
  f.tick(3);
}
const paintedActors = (f) =>
  f.drawImages.filter((image) => f.actorTransport.decoded.includes(image));
function stored(initial = 'fpv') {
  const values = new Map([[ACTOR_STYLE_PREFERENCES_KEY, JSON.stringify({ actorStyle: initial })]]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}
function publishChoice(f, storage, actorStyle) {
  const newValue = JSON.stringify({ actorStyle });
  storage.setItem(ACTOR_STYLE_PREFERENCES_KEY, newValue);
  f.win.emit('storage', { key: ACTOR_STYLE_PREFERENCES_KEY, newValue, storageArea: storage });
}

test('Team default FPV waits for pinned actors, paints after its original, and retires both resources', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await page(t, {
    waitPicture: false,
    beforeActorRequest: ({ relative }) => (relative === 'runtime.json' ? gate.promise : undefined),
  });
  await waitFor(() => f.actorTransport.requests.length > 0);
  assert.equal(f.$('coop-actor-style').value, 'fpv');
  assert.equal(f.$('coop-picture-status').dataset.state, 'preparing');
  assert.equal(f.$('coop-start').disabled, true);
  f.$('coop-start').click();
  assert.equal(f.$('coop-menu').hidden, false);
  gate.resolve();
  await ready(f);
  start(f);
  assert.equal(f.drawImages[0], f.artwork.calls.decodes[0], 'Original picture precedes actors.');
  assert.ok(paintedActors(f).length > 0);
  assert.ok(f.actorTransport.decoded.every((image) => image.closes === 0));
  f.win.emit('pagehide');
  assert.ok(f.actorTransport.decoded.every((image) => image.closes === 1));
  assert.deepEqual(f.artwork.calls.releases, f.artwork.calls.urls);
});

test('changing unstarted Team preference rejects late FPV preparation and uses Campaign without an actor fetch', async (t) => {
  const gate = deferred();
  t.after(() => gate.resolve());
  const f = await page(t, {
    waitPicture: false,
    beforeActorRequest: ({ relative }) => (relative === 'runtime.json' ? gate.promise : undefined),
  });
  await waitFor(() => f.actorTransport.requests.length > 0);
  f.choose('coop-actor-style', 'campaign');
  await ready(f);
  assert.match(f.$('coop-actor-style-note').textContent, /session.*could not be saved/);
  gate.resolve();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(f.$('coop-actor-style').value, 'campaign');
  assert.equal(f.actorTransport.requests.length, 1);
  assert.equal(f.actorTransport.decoded.length, 0);
  start(f);
  assert.equal(paintedActors(f).length, 0);
  assert.equal(f.drawImages[0], f.artwork.calls.decodes.at(-1));
});

test('cross-tab actor choice preserves live Team and Retry, while a fresh arena uses the new choice', async (t) => {
  const storage = stored();
  const f = await page(t, {
    beforeImport: ({ install }) => install('localStorage', { value: storage }),
  });
  start(f);
  const actors = [...new Set(paintedActors(f))],
    requests = f.actorTransport.requests.length;
  assert.ok(actors.length > 0);
  publishChoice(f, storage, 'campaign');
  assert.equal(f.$('coop-actor-style').value, 'campaign');
  f.drawImages.length = 0;
  f.tick(2);
  assert.ok(paintedActors(f).every((image) => actors.includes(image)));
  assert.ok(actors.every((image) => image.closes === 0));
  f.$('coop-pause').click();
  f.$('coop-retry').click();
  f.$('coop-discard-confirm').click();
  assert.equal(f.$('coop-overlay').hidden, true);
  f.drawImages.length = 0;
  f.tick(2);
  assert.ok(paintedActors(f).length > 0);
  assert.equal(
    f.actorTransport.requests.length,
    requests,
    'Retry reuses accepted actor resources.',
  );
  f.$('coop-pause').click();
  f.$('coop-lobby').click();
  f.$('coop-discard-confirm').click();
  await f.choose('coop-level', 'relay-yard');
  await ready(f);
  f.drawImages.length = 0;
  start(f);
  assert.equal(paintedActors(f).length, 0);
  assert.equal(f.actorTransport.requests.length, requests);
  assert.ok(actors.every((image) => image.closes === 1));
});

test('same-ID imported Team pack retains original actors instead of inheriting trusted FPV ownership', async (t) => {
  const f = await page(t);
  const requests = f.actorTransport.requests.length,
    actors = [...f.actorTransport.decoded];
  await f.selectFile(JSON.stringify(COOP_STARTER_PACK));
  await ready(f);
  f.drawImages.length = 0;
  start(f);
  assert.equal(f.actorTransport.requests.length, requests);
  assert.equal(paintedActors(f).length, 0);
  assert.ok(actors.every((image) => image.closes === 1));
});

test('failed Team actor bytes block Start and explicit picture Retry prepares the same mission', async (t) => {
  let fail = true;
  t.mock.method(console, 'error', () => {});
  const f = await page(t, {
    waitPicture: false,
    beforeActorRequest: ({ relative }) =>
      fail && relative === 'runtime.json'
        ? new Response('Unavailable', { status: 503 })
        : undefined,
  });
  await waitFor(() => f.$('coop-picture-status').dataset.state === 'error');
  assert.equal(f.$('coop-start').disabled, true);
  assert.equal(f.$('coop-level').value, 'first-connection');
  fail = false;
  await f.$('coop-picture-retry').onclick();
  await ready(f);
  start(f);
  assert.ok(paintedActors(f).length > 0);
});
