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

async function openMissions(page, activate) {
  const missions = page.$('race-library-switch'),
    listeners = missions.listeners.get('click');
  assert.equal(listeners.size, 1);
  const [open] = listeners;
  let opening;
  // Observe the real shell listener's operation without changing the input
  // gesture or its focus. Cold catalogue preparation is not a five-second poll.
  missions.listeners.set('click', new Set([(event) => (opening = open(event))]));
  try {
    activate();
    assert.ok(opening instanceof Promise, 'The public action must own Missions preparation.');
    assert.equal(page.$('race-message').getAttribute('role'), 'status');
    assert.equal(
      page.$('race-message').textContent,
      'Preparing missions… Your current race is kept.',
    );
  } finally {
    missions.listeners.set('click', listeners);
  }
  await opening;
  assert.equal(page.$('journey-chooser')?.open, true);
}

// Actual host, catalogue, profile and authored picture preparation; the finite
// DOM/Image boundary models input and decoding, not physical-device or browser layout.
test(
  'queryless Versus exposes all 91 current missions and starts from its focused primary action',
  { timeout: 60000 },
  async (t) => {
    const p = await page(t, '', { nativeKeyboard: true, pads: [pad()] });
    assert.equal(p.doc.body.classList.contains('candidate-journey'), true);
    assert.equal(p.$('race-level').children.length, 91);
    assert.equal(p.$('race-journey-note').textContent, 'New Journey · 91 missions');
    assert.doesNotMatch(p.$('race-journey-note').textContent, /unvalidated|test build/i);
    assert.equal(p.$('race-summary').textContent, 'One race · First return');
    assert.doesNotMatch(p.$('race-summary').textContent, /material review/);
    assert.equal(
      p.$('race-installed-status').textContent,
      'Open All missions for Journey, earlier missions and installed chapters.',
    );
    assert.equal(
      p.$('race-coop').querySelector('.game-mode-description').textContent,
      '12 Team missions',
    );
    assert.equal(p.$('race-solo-return').getAttribute('href'), '../?journey=whole-spatial-v16');
    assert.equal(
      p.$('race-coop').getAttribute('href'),
      'relay-rescue.html?return=versus&journey-return=whole-spatial-v16',
    );
    assert.equal(p.$('race-library-switch').getAttribute('href'), '?journey=legacy');
    assert.equal(p.$('race-library-switch').textContent, 'All missions');
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
    await openMissions(p, () => p.pulse(0, 0));
    assert.equal(p.$('race-leave-panel').hidden, true);
    assert.equal(p.$('journey-mode').value, 'versus');
    assert.equal(p.$('journey-collection').value, '');
    assert.equal(p.$('journey-cards').children.length, 300);
    const identities = [...p.$('journey-cards').children].map((card) =>
      JSON.parse(card.dataset.missionId),
    );
    assert.equal(identities.filter((identity) => identity[1] === 'whole-spatial-v16').length, 91);
    assert.equal(identities.filter((identity) => identity[1] === 'whole-spatial-v12').length, 3);
    assert.equal(identities.filter((identity) => identity[1] === 'whole-spatial-v13').length, 3);
    assert.equal(identities.filter((identity) => identity[1] === 'whole-spatial-v11').length, 3);
    assert.equal(identities.filter((identity) => identity[1] === 'whole-spatial-v10').length, 3);
    assert.equal(identities.filter((identity) => identity[1] === 'whole-spatial-v9').length, 3);
    p.frame(0); // The newly opened dialog observes neutral before accepting Back.
    p.pulse(0, 1);
    assert.equal(p.$('journey-chooser').open, false);
    assert.equal(p.doc.activeElement.id, 'race-library-switch');
    assert.deepEqual(p.checkpoint(), checkpoint);
    assert.equal(
      p.renders.every((run, i) => run === runs[i]),
      true,
    );
    assert.equal(p.state(), 'paused');
    // Mode departure still uses the retained guarded link. Browsing does not.
    p.$('race-solo-return').click();
    assert.equal(p.$('race-leave-panel').hidden, false);
    p.$('race-leave').setAttribute('href', 'https://untrusted.invalid/');
    assert.equal(p.$('race-leave').emit('click').defaultPrevented, false);
    assert.equal(p.$('race-leave').getAttribute('href'), '../?journey=whole-spatial-v16');
    assert.deepEqual(p.checkpoint(), checkpoint);
  },
);

test(
  'explicit Legacy Versus keeps its mode links and guards an exact New Journey library selection',
  { timeout: 60000 },
  async (t) => {
    const p = await page(t, '?journey=legacy');
    assert.equal(p.doc.body.classList.contains('candidate-journey'), false);
    assert.equal(p.$('race-level').children.length, 15);
    assert.equal(p.$('race-solo-return').getAttribute('href'), '../?journey=legacy');
    assert.equal(
      p.$('race-coop').getAttribute('href'),
      'relay-rescue.html?journey=legacy&return=versus',
    );
    assert.equal(p.$('race-library-switch').textContent, 'All missions');
    assert.equal(p.$('race-library-switch').getAttribute('href'), '?journey=whole-spatial-v16');
    await openMissions(p, () =>
      assert.equal(p.$('race-library-switch').emit('click').defaultPrevented, true),
    );
    p.$('journey-back').click();
    p.$('race-start').click();
    await settle(() => {
      p.frame(0);
      return !p.$('race-pause').disabled;
    });
    assert.equal(p.state(), 'running');
    p.$('race-pause').click();
    p.frame(0);
    const checkpoint = p.checkpoint();
    await openMissions(p, () => p.$('race-library-switch').click());
    const target = [...p.$('journey-cards').children].find((card) =>
      JSON.parse(card.dataset.missionId)[3].endsWith('/choose-your-share'),
    );
    assert(target, 'An exact New Journey mission is available alongside Classic.');
    target.click();
    await settle(() => p.$('race-library-replace')?.open);
    assert.match(p.$('race-library-replace-title').textContent, /Choose your share/i);
    assert.deepEqual(p.checkpoint(), checkpoint);
    p.$('race-library-stay').click();
    await settle(() => p.$('journey-chooser')?.open);
    assert.equal(p.doc.activeElement, target);
    p.$('journey-back').click();
    assert.equal(p.doc.activeElement.id, 'race-library-switch');
    assert.deepEqual(p.checkpoint(), checkpoint);
    assert.equal(p.state(), 'paused');
  },
);

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
    assert.equal(p.$('race-library-switch').textContent, 'All missions');
    assert.equal(p.$('race-library-switch').getAttribute('href'), '?journey=whole-spatial-v16');
    assert.equal(p.$('race-journey-note').hidden, true);
  });

test('Playground installed-map preview keeps the Legacy catalogue and chapter access', async (t) => {
  const p = await page(t, '?journey=legacy&focus=1');
  assert.equal(p.doc.body.classList.contains('candidate-journey'), false);
  assert.equal(p.$('race-level').children.length, 15);
  assert.equal(p.$('race-chapters').disabled, false);
  assert.equal(p.$('race-journey-note').hidden, true);
  assert.equal(p.$('race-solo-return').getAttribute('href'), '../?journey=legacy');
  p.$('race-start').click();
  await settle(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  assert.equal(p.state(), 'running');
  assert.equal(p.renders[0].levelId, 'orchard-crossing');
  assert.equal(p.renders[1].levelId, 'orchard-crossing');
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
