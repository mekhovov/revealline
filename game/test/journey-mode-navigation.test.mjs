import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  AUTHORED_JOURNEY_ROUTE_IDS,
  authoredJourneyModeHref,
} from '../content-design/mode-href.mjs';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { PNGImage } from './helpers/png-image.mjs';

const fetchResponse = async (path) => {
  if (String(path).includes('/content-design/assets/')) return new Response(await readFile(path));
};
async function solo(t, options = {}) {
  return soloPage(t, {
    search: '?journey=opening',
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: PNGImage },
    fetchResponse,
    ...options,
  });
}
async function activate(element) {
  const fn = element.onclick;
  let result;
  element.onclick = function (event) {
    return (result = fn.call(this, event));
  };
  try {
    element.click();
    await result;
  } finally {
    element.onclick = fn;
  }
}

test('only explicit known Journey editions produce fixed Solo/Versus links, never Team or arbitrary URLs', () => {
  for (const id of AUTHORED_JOURNEY_ROUTE_IDS) {
    assert.equal(authoredJourneyModeHref(id, 'versus'), `couch/?journey=${id}&return=solo`);
    assert.equal(authoredJourneyModeHref(id, 'solo'), `../?journey=${id}`);
    assert.equal(authoredJourneyModeHref(id, 'team'), null);
  }
  for (const id of [null, undefined, '1', '', 'https://example.com', 'opening&redirect=bad'])
    assert.equal(authoredJourneyModeHref(id, 'versus'), null);
});

test('authored Solo Title and Missions links retain the edition for ordinary and modified activation', async (t) => {
  const p = await solo(t);
  for (const id of ['shell-title-versus', 'shell-versus'])
    assert.equal(p.$(id).getAttribute('href'), 'couch/?journey=opening&return=solo');
  const event = p.$('shell-title-versus').emit('click', { ctrlKey: true, button: 0 });
  assert.equal(event.defaultPrevented, false);
  assert.equal(p.$('mode-leave-dialog').open, false);
  await activate(p.$('shell-title-versus'));
  assert.equal(
    globalThis.location.href,
    'http://localhost/game/couch/?journey=opening&return=solo',
  );
  assert.deepEqual(p.errors, []);
});

test('unfinished authored Solo departure verifies its scoped save; Stay preserves the cut, Leave keeps its edition', async (t) => {
  const storage = memoryStorage(),
    previewStorage = memoryStorage();
  const p = await solo(t, { storage, previewStorage });
  p.$('shell-featured').click();
  await settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running';
  });
  p.key('ArrowDown');
  for (let i = 0; i < 12; i++) p.frame();
  p.key('ArrowDown', false);
  p.$('shell-menu').click();
  p.frame(0);
  const before = authoritativeCheckpoint(p.rendered.run);
  await activate(p.$('shell-title-versus'));
  assert.equal(p.$('mode-leave-dialog').open, true);
  assert.match(p.$('mode-leave-status').textContent, /saved and verified/);
  assert.match(p.$('mode-leave-status').textContent, /opens this Solo Journey title/);
  assert(storage.getItem('revealline.suspended.journey-opening.v1'));
  assert.equal(storage.getItem('revealline.suspended.dev.v1'), null);
  p.$('mode-leave-stay').click();
  p.frame(0);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), before);
  await activate(p.$('shell-title-versus'));
  await activate(p.$('mode-leave-confirm'));
  assert.equal(
    globalThis.location.href,
    'http://localhost/game/couch/?journey=opening&return=solo',
  );
  for (const key of ['revealline.mode-return.v1:/game/', 'revealline.mode-return.v2:/game/'])
    assert.equal(previewStorage.getItem(key), null);
  assert.deepEqual(p.errors, []);
});

test('actual authored Versus advertises its Solo edition and preserves explicit discard/Stay semantics', async (t) => {
  const p = await couchPage(t, {
    href: 'http://localhost/game/couch/?journey=opening',
    initialLevel: null,
    assetDatabase: managedIndexedDB().indexedDB,
    storage: memoryStorage(),
    fetchResponse,
  });
  assert.equal(p.$('race-solo-return').getAttribute('href'), '../?journey=opening');
  assert.equal(
    p.$('race-coop').getAttribute('href'),
    'relay-rescue.html?return=versus&journey-return=opening',
  );
  p.$('race-start').click();
  await settle(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  p.$('race-pause').click();
  p.frame(0);
  const before = p.renders.map(authoritativeCheckpoint);
  p.$('race-solo-return').click();
  assert.equal(p.$('race-leave-panel').hidden, false);
  assert.match(p.$('race-leave-copy').textContent, /not saved/);
  assert.equal(p.$('race-leave').getAttribute('href'), '../?journey=opening');
  p.$('race-leave-back').click();
  p.frame(0);
  assert.deepEqual(p.renders.map(authoritativeCheckpoint), before);
  p.$('race-solo-return').click();
  const leave = p.$('race-leave').emit('click', { button: 0 });
  assert.equal(leave.defaultPrevented, false);
  assert.equal(p.$('race-leave').getAttribute('href'), '../?journey=opening');
});

test('returning to authored Solo opens Title and Continue restores the verified cut without auto-play', async (t) => {
  const storage = memoryStorage();
  let checkpoint, saved;
  await t.test('depart', async (t) => {
    const p = await solo(t, { storage });
    p.$('shell-featured').click();
    await settle(() => {
      p.frame(0);
      return p.doc.body.dataset.flightState === 'running';
    });
    p.key('ArrowDown');
    for (let i = 0; i < 12; i++) p.frame();
    p.key('ArrowDown', false);
    p.$('shell-menu').click();
    p.frame(0);
    checkpoint = authoritativeCheckpoint(p.rendered.run);
    await activate(p.$('shell-title-versus'));
    assert.match(p.$('mode-leave-status').textContent, /saved and verified/);
    saved = storage.getItem('revealline.suspended.journey-opening.v1');
    await activate(p.$('mode-leave-confirm'));
  });
  await t.test('return and deliberately Continue', async (t) => {
    const p = await solo(t, { storage });
    assert.equal(p.$('shell-home').open, true);
    assert.equal(storage.getItem('revealline.suspended.journey-opening.v1'), saved);
    assert.match(p.$('shell-continue').textContent, /Continue/);
    p.$('shell-continue').click();
    await settle(() => {
      p.frame(0);
      return p.rendered.run.player.cutting;
    });
    assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
    assert.equal(p.rendered.backdrop.assetRevision.id, 'horizon-first-return');
    assert.deepEqual(p.errors, []);
  });
});

test('authored departure reports refused saving truthfully and still requires deliberate Leave', async (t) => {
  const storage = memoryStorage();
  const p = await solo(t, { storage });
  p.$('shell-featured').click();
  await settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running';
  });
  p.$('shell-menu').click();
  const setItem = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (key === 'revealline.suspended.journey-opening.v1') throw new Error('Storage full');
    return setItem(key, value);
  };
  await activate(p.$('shell-title-versus'));
  assert.match(p.$('mode-leave-status').textContent, /session-only/);
  assert.doesNotMatch(p.$('mode-leave-status').textContent, /saved and verified/);
  assert.equal(p.$('mode-leave-dialog').open, true);
  assert.equal(globalThis.location.href, 'http://localhost/game/?journey=opening');
  await activate(p.$('mode-leave-confirm'));
  assert.equal(
    globalThis.location.href,
    'http://localhost/game/couch/?journey=opening&return=solo',
  );
});

for (const route of [
  'authored',
  'whole-originals',
  'whole-originals-v2',
  'whole-originals-v3',
  'whole-originals-v4',
])
  test(`${route} owns its native Solo mode link without changing the frozen route`, async (t) => {
    const p = await solo(t, { search: `?journey=${route}` });
    assert.equal(
      p.$('shell-title-versus').getAttribute('href'),
      `couch/?journey=${route}&return=solo`,
    );
    assert.deepEqual(p.errors, []);
  });

test('the Legacy-backed Journey preview does not acquire authored navigation authority', async (t) => {
  const p = await solo(t, { search: '?journey=1' });
  assert.equal(p.$('shell-title-versus').getAttribute('href'), 'couch/?journey=legacy&return=solo');
  await activate(p.$('shell-title-versus'));
  assert.equal(globalThis.location.href, 'http://localhost/game/couch/?journey=legacy&return=solo');
});
