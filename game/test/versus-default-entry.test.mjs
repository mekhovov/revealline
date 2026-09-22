import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { couchPage } from './helpers/couch-host.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { memoryStorage, settle } from './helpers/solo-dom.mjs';

const fetchResponse = async (path) =>
  String(path).includes('/content-design/assets/') ? new Response(await readFile(path)) : undefined;
const pad = () => ({
  index: 0,
  id: 'Default Journey pad',
  connected: true,
  mapping: 'standard',
  axes: [0, 0, 0, 0],
  buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })),
});
const page = (t, search = '', options = {}) =>
  couchPage(t, {
    href: `http://localhost/game/couch/${search}`,
    initialLevel: null,
    assetDatabase: managedIndexedDB().indexedDB,
    storage: memoryStorage(),
    fetchResponse,
    ...options,
  });

// Actual host, catalogue, profile and authored picture preparation; the finite
// DOM/Image boundary models input and decoding, not physical-device or browser layout.
test('queryless Versus exposes all 91 current missions and starts from its focused primary action', async (t) => {
  const p = await page(t, '', { nativeKeyboard: true, pads: [pad()] });
  assert.equal(p.doc.body.classList.contains('candidate-journey'), true);
  assert.equal(p.$('race-level').children.length, 91);
  assert.equal(
    p.$('race-journey-note').textContent,
    'New Journey / 91 missions. Original pictures need a connection; core offline preparation does not save them.',
  );
  assert.doesNotMatch(p.$('race-journey-note').textContent, /unvalidated|test build/i);
  assert.match(p.$('race-summary').textContent, /Horizon School/);
  assert.doesNotMatch(p.$('race-summary').textContent, /material review/);
  assert.equal(
    p.$('race-installed-status').textContent,
    'Open Legacy library for earlier missions and installed chapters.',
  );
  assert.equal(
    p.$('race-coop').querySelector('.game-mode-description').textContent,
    '12 Team missions',
  );
  assert.equal(p.$('race-solo-return').getAttribute('href'), '../?journey=whole-spatial-v5');
  assert.equal(
    p.$('race-coop').getAttribute('href'),
    'relay-rescue.html?return=versus&journey-return=whole-spatial-v5',
  );
  assert.equal(p.$('race-library-switch').getAttribute('href'), '?journey=legacy');
  assert.equal(p.$('race-library-switch').textContent, 'Legacy library');
  assert.equal(p.doc.activeElement.id, 'race-start');
  assert.equal(p.$('race-setup').hidden, true);
  p.key('Enter', true, p.doc.activeElement);
  p.key('Enter', false, p.$('race-start'));
  await settle(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  assert.equal(p.state(), 'running');
  assert.equal(p.renders[0].levelId, 'first-return');
  assert.equal(p.renders[1].levelId, 'first-return');
  p.$('race-pause').click();
  p.frame(0);
  const checkpoint = p.checkpoint();
  const runs = [...p.renders];
  p.join(0);
  p.focus('race-library-switch');
  p.pulse(0, 0);
  assert.equal(p.$('race-leave-panel').hidden, false);
  assert.equal(p.$('race-leave').getAttribute('href'), '?journey=legacy');
  assert.match(p.$('race-leave-title').textContent, /Legacy library/);
  assert.equal(p.doc.activeElement.id, 'race-leave-back');
  p.pulse(0, 1);
  assert.equal(p.$('race-leave-panel').hidden, true);
  assert.equal(p.doc.activeElement.id, 'race-library-switch');
  assert.deepEqual(p.checkpoint(), checkpoint);
  assert.equal(
    p.renders.every((run, i) => run === runs[i]),
    true,
  );
  assert.equal(p.state(), 'paused');
  p.$('race-library-switch').click();
  p.$('race-leave').setAttribute('href', 'https://untrusted.invalid/');
  assert.equal(p.$('race-leave').emit('click').defaultPrevented, false);
  assert.equal(p.$('race-leave').getAttribute('href'), '?journey=legacy');
  assert.deepEqual(p.checkpoint(), checkpoint);
});

test('explicit Legacy Versus keeps its own mode links and offers a guarded return to New Journey', async (t) => {
  const p = await page(t, '?journey=legacy');
  assert.equal(p.doc.body.classList.contains('candidate-journey'), false);
  assert.equal(p.$('race-level').children.length, 15);
  assert.equal(p.$('race-solo-return').getAttribute('href'), '../?journey=legacy');
  assert.equal(
    p.$('race-coop').getAttribute('href'),
    'relay-rescue.html?journey=legacy&return=versus',
  );
  assert.equal(p.$('race-library-switch').textContent, 'New Journey');
  assert.equal(p.$('race-library-switch').getAttribute('href'), '?journey=whole-spatial-v5');
  assert.equal(p.$('race-library-switch').emit('click').defaultPrevented, false);
  p.$('race-start').click();
  await settle(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  assert.equal(p.state(), 'running');
  p.$('race-pause').click();
  p.frame(0);
  const checkpoint = p.checkpoint();
  p.$('race-library-switch').click();
  assert.equal(p.$('race-leave-panel').hidden, false);
  assert.match(p.$('race-leave-title').textContent, /New Journey/);
  assert.equal(p.$('race-leave').getAttribute('href'), '?journey=whole-spatial-v5');
  p.$('race-leave-back').click();
  assert.equal(p.doc.activeElement.id, 'race-library-switch');
  assert.deepEqual(p.checkpoint(), checkpoint);
  assert.equal(p.state(), 'paused');
});

for (const query of [
  '?journey=',
  '?journey=unknown',
  '?pack=',
  '?campaign=old-campaign',
  '?level=old-level&play=1',
  '?return=solo&return-token-v2=invalid',
])
  test(`Versus preserves explicit historical entry intent ${query}`, async (t) => {
    const p = await page(t, query);
    assert.equal(p.doc.body.classList.contains('candidate-journey'), false);
    assert.equal(p.$('race-level').children.length, 15);
    assert.equal(p.$('race-library-switch').textContent, 'New Journey');
    assert.equal(p.$('race-library-switch').getAttribute('href'), '?journey=whole-spatial-v5');
    assert.equal(p.$('race-journey-note').hidden, true);
  });

test('an explicit prior Journey remains its exact edition with Legacy access', async (t) => {
  const p = await page(t, '?journey=opening');
  assert.equal(p.doc.body.classList.contains('candidate-journey'), true);
  assert.equal(p.$('race-solo-return').getAttribute('href'), '../?journey=opening');
  assert.match(p.$('race-journey-note').textContent, /UNVALIDATED VERSUS TEST BUILD/);
  assert.match(
    p.$('race-installed-status').textContent,
    /test route; Legacy chapters stay in the ordinary race/,
  );
  assert.equal(
    p.$('race-coop').querySelector('.game-mode-description').textContent,
    'Separate Team arenas',
  );
  assert.equal(
    p.$('race-coop').getAttribute('href'),
    'relay-rescue.html?return=versus&journey-return=opening',
  );
  assert.equal(p.$('race-library-switch').getAttribute('href'), '?journey=legacy');
});
