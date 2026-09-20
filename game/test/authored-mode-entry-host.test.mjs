import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { JOURNEY_PREFERENCES_KEY } from '../journey/preferences.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { authoredModeDestinations, authoredTeamReturn } from '../ui/authored-mode-routes.mjs';

class CandidateImage {
  width = 1774;
  height = 887;
  naturalWidth = 1774;
  naturalHeight = 887;
  set src(value) {
    this.source = value;
    queueMicrotask(() => this.onload?.());
  }
  async decode() {}
  removeAttribute() {
    this.source = '';
  }
}
const storage = () =>
  memoryStorage({
    [JOURNEY_PREFERENCES_KEY]: JSON.stringify({
      format: 'JourneyPreferencesV1',
      difficulty: 'standard',
    }),
    'revealline.suspended.dev.v1': 'untouched Legacy attempt',
  });
const assets = async (path) =>
  String(path).includes('/content-design/assets/') ? new Response(await readFile(path)) : undefined;
const solo = (t, route, options = {}) =>
  soloPage(t, {
    search: `?journey=${route}`,
    titleScreen: true,
    storage: storage(),
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: CandidateImage },
    fetchResponse: assets,
    ...options,
  });
const versus = (t, route) =>
  couchPage(t, {
    href: `http://localhost/game/couch/?journey=${route}`,
    initialLevel: null,
    assetDatabase: managedIndexedDB().indexedDB,
    seconds: '90',
    storage: storage(),
    fetchResponse: assets,
  });
async function action(element) {
  element.focus();
  const handler = element.onclick;
  let pending;
  if (handler)
    element.onclick = function (event) {
      return (pending = handler.call(this, event));
    };
  try {
    element.click();
    await pending;
  } finally {
    if (handler) element.onclick = handler;
  }
}
const checkpoint = (p) => {
  p.frame(0);
  return authoritativeCheckpoint(p.rendered.run);
};
async function flight(t, options = {}) {
  const p = await solo(t, 'opening', options);
  await action(p.$('shell-featured'));
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.key('ArrowDown');
  for (let i = 0; i < 12; i++) p.frame();
  p.key('ArrowDown', false);
  await action(p.$('shell-menu'));
  return p;
}
for (const route of ['opening', 'authored']) {
  test(`${route}: ready Solo opens the corresponding Versus library without save/hint conversion`, async (t) => {
    const previewStorage = memoryStorage(),
      p = await solo(t, route, { previewStorage });
    const before = checkpoint(p);
    assert.equal(
      p.$('shell-title-versus').getAttribute('href'),
      `couch/?journey=${route}&return=solo`,
    );
    assert.match(p.$('shell-title-team').textContent, /Separate Team arenas/);
    await action(p.$('shell-title-versus'));
    assert.equal(
      globalThis.location.href,
      `http://localhost/game/couch/?journey=${route}&return=solo`,
    );
    assert.equal(p.storage.getItem(`revealline.suspended.journey-${route}.v1`), null);
    assert.equal(p.storage.getItem('revealline.suspended.dev.v1'), 'untouched Legacy attempt');
    assert.equal(previewStorage.getItem('revealline.mode-return.v2:/game/'), null);
    assert.deepEqual(checkpoint(p), before);
    assert.deepEqual(p.errors, []);
  });
  test(`${route}: ready Versus keeps authored Solo entry and explicitly separates Team`, async (t) => {
    const p = await versus(t, route),
      before = p.checkpoint();
    assert.equal(p.$('race-journey-note').hidden, false);
    assert.match(p.$('race-coop').textContent, /Separate Team arenas/);
    assert.equal(
      p.$('race-coop').getAttribute('href'),
      `relay-rescue.html?return=versus&journey-return=${route}`,
    );
    await action(p.$('race-solo-return'));
    assert.equal(p.$('race-solo-return').getAttribute('href'), `../?journey=${route}`);
    assert.deepEqual(p.checkpoint(), before);
  });
}
test('unfinished Solo Stay retains the exact paused attempt; Leave uses its own verified save', async (t) => {
  const p = await flight(t),
    before = checkpoint(p);
  await action(p.$('shell-title-versus'));
  assert.equal(p.$('mode-leave-dialog').open, true);
  assert.match(p.$('mode-leave-status').textContent, /saved and verified/);
  assert.match(p.$('mode-leave-status').textContent, /own Journey progress/);
  const saved = p.storage.getItem('revealline.suspended.journey-opening.v1');
  assert(saved);
  assert.equal(p.doc.activeElement.id, 'mode-leave-stay');
  await action(p.$('mode-leave-stay'));
  assert.equal(p.doc.activeElement.id, 'shell-title-versus');
  assert.deepEqual(checkpoint(p), before);
  assert.equal(p.rendered.paused, true);
  await action(p.$('shell-title-versus'));
  await action(p.$('mode-leave-confirm'));
  assert.equal(
    globalThis.location.href,
    'http://localhost/game/couch/?journey=opening&return=solo',
  );
  assert.equal(p.storage.getItem('revealline.suspended.dev.v1'), 'untouched Legacy attempt');
  assert.deepEqual(checkpoint(p), before);
  assert.deepEqual(p.errors, []);
});
test('held Solo retention can be cancelled without a late save or departure', async (t) => {
  const p = await flight(t),
    before = checkpoint(p),
    saved = p.storage.getItem('revealline.suspended.journey-opening.v1');
  let release;
  navigator.locks.request = async (_name, _options, work) => {
    if (!release)
      await new Promise((resolve) => {
        release = resolve;
      });
    return work();
  };
  const pending = action(p.$('shell-title-versus'));
  await settle(() => !!release);
  assert.equal(p.$('mode-leave-confirm').disabled, true);
  await action(p.$('mode-leave-stay'));
  release();
  await pending;
  assert.equal(globalThis.location.href, 'http://localhost/game/?journey=opening');
  assert.equal(p.storage.getItem('revealline.suspended.journey-opening.v1'), saved);
  assert.deepEqual(checkpoint(p), before);
  assert.equal(p.rendered.paused, true);
});
test('denied Solo retention stays explicit and never claims a safe save', async (t) => {
  const p = await flight(t),
    before = checkpoint(p);
  const original = p.storage.setItem.bind(p.storage);
  p.storage.setItem = (key, value) => {
    if (key === 'revealline.suspended.journey-opening.v1') throw Error('Denied');
    return original(key, value);
  };
  await action(p.$('shell-title-versus'));
  assert.match(p.$('mode-leave-status').textContent, /not verified as safely saved/);
  assert.equal(globalThis.location.href, 'http://localhost/game/?journey=opening');
  await action(p.$('mode-leave-stay'));
  assert.deepEqual(checkpoint(p), before);
});
test('unfinished Versus stays paused through Stay and requires deliberate discard for Solo', async (t) => {
  const p = await versus(t, 'opening');
  await action(p.$('race-start'));
  await settle(() => {
    p.frame();
    return p.renders[0].status === 'running';
  });
  p.key('Escape');
  p.key('Escape', false);
  const before = p.checkpoint();
  await action(p.$('race-solo-return'));
  assert.equal(p.$('race-leave-panel').hidden, false);
  assert.equal(p.$('race-leave').getAttribute('href'), '../?journey=opening');
  assert.match(p.$('race-leave-copy').textContent, /Solo opens its own Journey progress/);
  await action(p.$('race-leave-back'));
  assert.equal(p.doc.activeElement.id, 'race-solo-return');
  p.frames(10);
  assert.deepEqual(p.checkpoint(), before);
  await action(p.$('race-solo-return'));
  assert.equal(p.$('race-leave').emit('click').defaultPrevented, false);
  assert.deepEqual(p.checkpoint(), before);
});
for (const origin of ['solo', 'versus'])
  test(`separate Team retains only bounded ${origin} navigation, with unchanged arenas`, async (t) => {
    const p = await teamPage(t, {
      href: `http://localhost/game/couch/relay-rescue.html?return=${origin}&journey-return=opening`,
      nativeFocus: true,
      capturePaint: true,
    });
    assert.equal(
      p.$('coop-race').getAttribute('href'),
      origin === 'solo' ? '../?journey=opening' : './?journey=opening',
    );
    assert.equal(p.$('coop-solo').getAttribute('href'), '../?journey=opening');
    assert.equal(p.$('coop-versus').getAttribute('href'), './?journey=opening');
    assert.match(p.$('coop-stage').textContent, /FIRST CONNECTION/i);
  });
test('route hints reject unknown, ambiguous and competing launch owners', () => {
  assert.equal(authoredModeDestinations('solo', 'https://other.invalid/'), null);
  assert.equal(authoredModeDestinations('team', 'opening'), null);
  const base =
    'https://example.invalid/releases/v0.1/site/game/couch/relay-rescue.html?return=solo&journey-return=authored';
  assert.deepEqual(authoredTeamReturn(base), {
    solo: '../?journey=authored',
    versus: './?journey=authored',
    origin: 'solo',
  });
  for (const suffix of [
    '&return=solo',
    '&journey-return=opening',
    '&journey=opening',
    '&return-token=bad',
    '&return-token-v2=bad',
    '&mode-return=bad',
    '&practice=1',
  ])
    assert.equal(authoredTeamReturn(base + suffix), null);
  assert.equal(
    authoredTeamReturn(
      base.replace('journey-return=authored', 'journey-return=https://other.invalid'),
    ),
    null,
  );
});

test('returning Solo retains the authored checkpoint and picture until deliberate Continue', async (t) => {
  const shared = storage();
  let before, originalAsset;
  await t.test('leave the checked Solo attempt', async (t) => {
    const p = await flight(t, { storage: shared });
    before = checkpoint(p);
    originalAsset = p.rendered.backdrop.assetRevision;
    await action(p.$('shell-title-versus'));
    await action(p.$('mode-leave-confirm'));
    assert(shared.getItem('revealline.suspended.journey-opening.v1'));
  });
  await t.test('return to title, then Continue explicitly', async (t) => {
    const p = await solo(t, 'opening', { storage: shared });
    assert.equal(p.$('shell-home').open, true);
    assert.equal(p.doc.body.dataset.flightState, 'briefing');
    assert.equal(p.$('shell-continue').hidden, false);
    await action(p.$('shell-continue'));
    await settle(() => p.doc.body.dataset.flightState === 'running');
    assert.deepEqual(checkpoint(p), before);
    assert.deepEqual(p.rendered.backdrop.assetRevision, originalAsset);
    assert.equal(shared.getItem('revealline.suspended.dev.v1'), 'untouched Legacy attempt');
  });
});
for (const origin of ['solo', 'versus'])
  test(`active separate Team ${origin} return retains Stay and deliberate discard`, async (t) => {
    const p = await teamPage(t, {
      href: `http://localhost/game/couch/relay-rescue.html?return=${origin}&journey-return=authored`,
      nativeFocus: true,
      capturePaint: true,
    });
    p.$('coop-start').click();
    p.tick();
    p.$('coop-pause').click();
    p.tick();
    const before = p.lastPaint,
      clock = p.$('coop-clock').textContent;
    p.$('coop-race').focus();
    p.$('coop-race').click();
    assert.equal(p.$('coop-discard-dialog').open, true);
    p.$('coop-discard-stay').click();
    p.tick(10);
    assert.equal(p.$('coop-overlay-kicker').textContent, 'PAUSED');
    assert.equal(p.lastPaint, before);
    assert.equal(p.$('coop-clock').textContent, clock);
    assert.deepEqual(p.visits, []);
    p.$('coop-race').focus();
    p.$('coop-race').click();
    p.$('coop-discard-confirm').click();
    assert.equal(
      p.visits.at(-1),
      origin === 'solo'
        ? 'http://localhost/game/?journey=authored'
        : 'http://localhost/game/couch/?journey=authored',
    );
  });
