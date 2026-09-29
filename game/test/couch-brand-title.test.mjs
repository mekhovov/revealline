import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCouchShell } from '../couch/couch-shell.mjs';
import { createDuel, pauseDuel, resumeDuel } from '../multiplayer.mjs';
import { getLocale, setLocale, t as message } from '../i18n/index.mjs';
import { GAME_BRAND_NAME } from '../ui/brand-identity.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { couchPage, mountCouch } from './helpers/couch-host.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';

test('real Versus ready renders and locale changes keep one wordmark; pause owns its localized status', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const page = await couchPage(t);
  const title = page.$('race-title');
  const art = title.querySelector('.fpv-line-wordmark');
  assert.ok(art, 'The initial ready render must retain the mounted image.');
  const ready = page.checkpoint();
  for (const locale of ['uk', 'en', 'uk']) {
    setLocale(locale, { persist: false });
    page.frames(3, 0);
    assert.equal(title.querySelector('.fpv-line-wordmark'), art);
    assert.equal(title.textContent, GAME_BRAND_NAME);
    assert.deepEqual(page.checkpoint(), ready);
  }
  page.$('race-start').click();
  page.frame(0);
  assert.equal(title.querySelector('img'), null, 'Running does not retain hidden brand owners.');
  page.$('race-pause').click();
  page.frame(0);
  const paused = page.checkpoint();
  for (const locale of ['en', 'uk']) {
    setLocale(locale, { persist: false });
    page.frames(3, 0);
    assert.equal(title.textContent, message('interface:bothBoardsPaused'));
    assert.equal(title.querySelector('img'), null);
    assert.equal(title.classList.contains('native-game-title'), false);
    assert.deepEqual(page.checkpoint(), paused);
  }
});

test('Versus busy/ready transitions replace only retired brand owners and destroy releases the latest image', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const doc = new Document();
  mountCouch(doc, await readFile(new URL('../couch/index.html', import.meta.url), 'utf8'));
  const shell = createCouchShell({ document: doc });
  t.after(() => shell.destroy());
  let match = createDuel(retryFixture('enemy-player').level);
  const update = (contentBusy = false) =>
    shell.update({ match, summary: 'Brand lifecycle fixture', won: [0, 0], contentBusy });
  const title = doc.getElementById('race-title');
  update();
  const first = title.querySelector('img');
  first.emit('load');
  assert.equal(title.dataset.logoLoaded, 'true');
  update(true);
  assert.equal(title.textContent, message('interface:loadingTheSharedPicture'));
  assert.equal(title.querySelector('img'), null);
  assert.equal(first.listeners.get('load').size, 0);
  assert.equal(first.listeners.get('error').size, 0);
  first.emit('load');
  assert.equal(title.dataset.logoLoaded, undefined);
  setLocale('uk', { persist: false });
  assert.equal(title.textContent, message('interface:loadingTheSharedPicture'));
  update();
  const second = title.querySelector('img');
  assert.ok(second);
  assert.notEqual(second, first);
  for (let i = 0; i < 5; i++) update();
  assert.equal(title.querySelector('img'), second, 'Ready frames do not remount the image.');
  assert.equal(second.listeners.get('load').size, 1);
  resumeDuel(match);
  pauseDuel(match);
  update();
  assert.equal(title.textContent, message('interface:bothBoardsPaused'));
  assert.equal(title.querySelector('img'), null);
  assert.equal(second.listeners.get('load').size, 0);
  match = createDuel(retryFixture('enemy-player').level);
  update();
  const final = title.querySelector('img');
  assert.ok(final, 'Returning to ready restores the wordmark after a status.');
  shell.destroy();
  assert.equal(final.listeners.get('load').size, 0);
  assert.equal(final.listeners.get('error').size, 0);
  update();
  assert.equal(title.querySelector('img'), null, 'Destroyed shells cannot remount branding.');
});
