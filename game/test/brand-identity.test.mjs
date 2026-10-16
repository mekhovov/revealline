import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document } from './helpers/couch-dom.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import {
  GAME_BRAND_NAME,
  GAME_WORDMARK_URL,
  editionDisplayName,
  mountLandingBrand,
} from '../ui/brand-identity.mjs';

test('edition display names gain one shared suffix without changing stable identifiers', () => {
  assert.equal(
    editionDisplayName('DroneAid Netherlands', 'droneaid-nl-community'),
    'DroneAid / LINE',
  );
  assert.equal(editionDisplayName('DroneAid / LINE', 'droneaid'), 'DroneAid / LINE');
  assert.equal(editionDisplayName('Coupa Village / LINE', 'coupa-all'), 'Coupa Village / LINE');
  assert.equal(
    editionDisplayName('Workshop Lights', 'droneaid-nl-workshop-lights'),
    'Workshop Lights / LINE',
  );
});

test('wordmark has a real text fallback, preserves focus and survives a locale change', (t) => {
  const doc = new Document();
  const title = doc.createElement('h1');
  const button = doc.createElement('button');
  doc.body.append(title, button);
  button.focus();
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  const dispose = mountLandingBrand(title);
  const art = title.querySelector('img');
  assert.equal(title.textContent, GAME_BRAND_NAME);
  assert.equal(art.src, GAME_WORDMARK_URL);
  assert.equal(art.alt, '');
  assert.equal(art.getAttribute('aria-hidden'), 'true');
  art.emit('load');
  assert.equal(title.dataset.logoLoaded, 'true');
  setLocale('uk', { persist: false });
  assert.equal(title.textContent, GAME_BRAND_NAME);
  assert.equal(title.querySelector('img'), art);
  art.emit('error');
  assert.equal(title.dataset.logoLoaded, 'false');
  assert.equal(doc.activeElement, button);
  dispose();
  assert.equal(art.listeners.get('load').size, 0);
});

test('an edition replaces the default wordmark and releases its stale image callbacks', () => {
  const doc = new Document();
  const title = doc.createElement('h1');
  doc.body.append(title);
  const disposeDefault = mountLandingBrand(title);
  const art = title.querySelector('img');
  const disposeEdition = mountLandingBrand(title, { name: 'DroneAid / LINE', edition: true });
  assert.equal(title.textContent, 'DroneAid / LINE');
  assert.equal(title.querySelector('img'), null);
  assert.ok(title.classList.contains('native-edition-title'));
  assert.equal(art.listeners.get('load').size, 0);
  disposeDefault();
  assert.ok(title.classList.contains('native-edition-title'));
  disposeEdition();
  assert.ok(!title.classList.contains('native-edition-title'));
});

test('the generated wordmark is an alpha PNG packaged within the active image budget', async () => {
  const bytes = await readFile(new URL(GAME_WORDMARK_URL));
  assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.equal(bytes[25], 6, 'The logo retains the generated RGBA transparency.');
  assert.ok(bytes.length < 1024 * 1024);
  assert.ok(bytes.readUInt32BE(16) > bytes.readUInt32BE(20));
});
