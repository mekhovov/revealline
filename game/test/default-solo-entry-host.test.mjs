import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { workshopReturnLinks } from '../ui/workshop-return.mjs';

// Browser decoder boundary only. The host still reads and verifies the real
// registered originals; this fixture makes no native image/layout claim.
class Picture {
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

// Match the existing Workshop host fixture's native dialog focus/queued close
// boundary. The return handlers and restoration owner remain the real code.
function nativeDialogs(t) {
  const open = SoloElement.prototype.showModal;
  const origins = new WeakMap();
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    if (this.open) return;
    origins.set(this, this.ownerDocument.activeElement);
    this.emit('beforetoggle', { newState: 'open', oldState: 'closed' });
    open.call(this);
    this.querySelector('button:not(:disabled),select:not(:disabled),input:not(:disabled)')?.focus();
  });
  t.mock.method(SoloElement.prototype, 'close', function () {
    if (!this.open) return;
    this.open = false;
    this.removeAttribute('open');
    origins.get(this)?.focus();
    queueMicrotask(() => this.emit('close', { bubbles: false }));
  });
}

async function page(t, options = {}) {
  return soloPage(t, {
    // Deliberately bypass the historical helper's explicit Legacy default.
    search: '',
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: Picture },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
    },
    ...options,
  });
}
async function running(p, levelId) {
  await settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === levelId;
  });
}

test('ordinary Solo entry offers all 91 missions and direct Start, Retry and Next', async (t) => {
  const p = await page(t);
  assert.equal(p.$('shell-featured').hidden, false);
  assert.equal(p.$('shell-continue').hidden, true);
  assert.equal(p.$('shell-title-edition').textContent, 'NEW JOURNEY / 91 MISSIONS');
  assert.match(p.$('shell-destination').textContent, /Start · First return/);
  assert.equal(new URL(p.$('shell-playground').href).search, '?journey=whole-spatial-v5');
  assert.equal(p.$('shell-catalogue').textContent, 'Legacy missions');
  assert.equal(p.$('shell-catalogue').getAttribute('href'), './?journey=legacy');
  assert.equal(
    p.$('shell-title-versus').getAttribute('href'),
    'couch/?journey=whole-spatial-v5&return=solo',
  );
  assert.equal(
    p.$('shell-title-team').querySelector('.game-mode-description').textContent,
    '12 Team missions',
  );
  assert.match(
    p.$('journey-artwork-availability').textContent,
    /^Mission pictures need an internet connection/,
  );
  p.$('shell-play').click();
  assert.equal(p.$('journey-chooser').open, true);
  assert.equal(p.$('journey-cards').children.length, 91);
  assert.equal(p.$('journey-chooser').contains(p.$('missions-catalogue')), true);
  assert.equal(p.$('missions-catalogue').hidden, false);
  const ids = [...p.$('journey-cards').children].map((card) => card.dataset.missionId);
  for (const id of ['sorting-yard', 'home-signal', 'cross-stitch-crossings', 'four-motor-landings'])
    assert(
      ids.some((candidate) => candidate.endsWith(`/${id}`)),
      id,
    );
  p.$('journey-back').click();
  p.$('shell-featured').click();
  await running(p, 'first-return');
  assert.equal(p.$('shell-home').open, false);
  assert.equal(p.$('journey-chooser').open, false);
  const complete = () => {
    p.key('ArrowDown');
    for (let i = 0; i < 1800 && p.rendered.run.status === 'running'; i++) p.frame();
    p.key('ArrowDown', false);
    p.frame(0);
    assert.equal(p.rendered.run.status, 'won');
  };
  complete();
  assert.match(p.$('overlay-copy').textContent, /Journey mission complete/);
  assert.doesNotMatch(p.$('overlay-copy').textContent, /test clear/);
  await settle(() => !p.$('retry-button').disabled);
  p.$('retry-button').click();
  await running(p, 'first-return');
  complete();
  await settle(() => !p.$('next-button').disabled);
  p.$('next-button').click();
  await running(p, 'choose-your-share');
  assert.equal(p.$('journey-chooser').open, false);
  assert.deepEqual(p.errors, []);
});

test('ordinary Solo Continue uses its current Journey bookmark without converting old records', async (t) => {
  const memory = managedIndexedDB();
  const current = createJourneyBackend({ ...memory, profileKey: 'journey-whole-spatial-v5' });
  const previous = createJourneyBackend(memory);
  await previous.commit([{ type: 'select', mode: 'solo', missionId: 'official/old/mission' }]);
  const old = await previous.read();
  await current.commit([
    {
      type: 'select',
      mode: 'solo',
      missionId: 'candidate/journey-opening/prologue/choose-your-share',
    },
  ]);
  const p = await page(t, { journeyIndexedDB: memory.indexedDB });
  assert.equal(p.$('shell-featured').hidden, true);
  assert.equal(p.$('shell-continue').hidden, false);
  p.$('shell-continue').click();
  await running(p, 'choose-your-share');
  assert.deepEqual(await previous.read(), old);
  assert.deepEqual(p.errors, []);
});

test('Legacy is explicitly accessible and its New Journey action returns to the ordinary default', async (t) => {
  const p = await page(t, { search: '?journey=legacy' });
  assert.equal(p.doc.body.classList.contains('journey-preview'), false);
  assert.equal(p.$('shell-catalogue').textContent, 'New Journey');
  assert.equal(p.$('shell-catalogue').getAttribute('href'), './');
  for (const id of ['shell-title-versus', 'shell-title-team'])
    assert.match(p.$(id).getAttribute('href'), /journey=legacy/);
  p.$('shell-play').click();
  assert.equal(p.$('shell-missions').open, true);
  assert.equal(p.$('shell-missions').contains(p.$('missions-catalogue')), true);
  assert.equal(p.$('pack-select').options.length > 1, true);
  p.$('missions-catalogue').click();
  assert.equal(globalThis.location.href, 'http://localhost/game/');
  assert.deepEqual(p.errors, []);
});

test('switching from a running default Journey to Legacy has an explicit Stay or Leave boundary', async (t) => {
  const storage = memoryStorage();
  const p = await page(t, { storage });
  p.$('shell-featured').click();
  await running(p, 'first-return');
  p.key('ArrowDown');
  for (let i = 0; i < 12; i++) p.frame();
  p.key('ArrowDown', false);
  p.$('shell-menu').click();
  p.frame(0);
  const checkpoint = authoritativeCheckpoint(p.rendered.run);
  p.$('shell-catalogue').focus();
  p.$('shell-catalogue').click();
  await settle(() => !p.$('mode-leave-confirm').disabled);
  assert.equal(p.$('mode-leave-dialog').open, true);
  assert.match(p.$('mode-leave-title').textContent, /Legacy missions/);
  assert.match(p.$('mode-leave-status').textContent, /saved and verified/);
  p.$('mode-leave-stay').click();
  assert.equal(p.$('mode-leave-dialog').open, false);
  p.frame(0);
  assert.deepEqual(authoritativeCheckpoint(p.rendered.run), checkpoint);
  assert.equal(globalThis.location.href, 'http://localhost/game/');
  p.$('shell-catalogue').click();
  await settle(() => !p.$('mode-leave-confirm').disabled);
  p.$('mode-leave-confirm').click();
  assert.equal(globalThis.location.href, 'http://localhost/game/?journey=legacy');
  assert(storage.getItem('revealline.suspended.journey-whole-spatial.v5'));
  assert.deepEqual(p.errors, []);
});

for (const search of ['?journey=', '?journey=unknown', '?mode-return=unknown'])
  test(`explicit historical or unknown Solo request keeps Legacy behavior: ${search}`, async (t) => {
    const p = await page(t, { search });
    assert.equal(p.doc.body.classList.contains('journey-preview'), false);
    assert.equal(p.$('shell-catalogue').textContent, 'New Journey');
    p.$('shell-play').click();
    assert.equal(p.$('shell-missions').open, true);
    assert.deepEqual(p.errors, []);
  });

test('a queryless legacy pack handoff still resolves the requested pack', async (t) => {
  const p = await page(t, { search: '?pack=fieldcraft' });
  assert.equal(p.doc.body.classList.contains('journey-preview'), false);
  assert.equal(p.$('pack-select').value, 'fieldcraft');
  assert.equal(p.rendered.run.levelId, 'fieldcraft-01');
  assert.deepEqual(p.errors, []);
});

test('First Flight remains isolated and cannot expose catalogue departure controls', async (t) => {
  const p = await page(t, { search: '?course=first-flight&lesson=close-line' });
  assert.equal(p.doc.body.classList.contains('journey-preview'), false);
  assert.equal(p.$('shell-catalogue').hidden, true);
  assert.equal(p.$('missions-catalogue').hidden, true);
  assert.equal(p.rendered.run.levelId, 'first-flight-close-line');
  assert.deepEqual(p.errors, []);
});

test('a Legacy pack entry retains its catalogue through the actual Workshop tool links', async (t) => {
  let back;
  await t.test('requested pack opens a fixed tool with resolved Legacy context', async (t) => {
    const p = await page(t, { search: '?pack=fieldcraft' });
    p.$('shell-menu').click();
    p.$('shell-workshop').click();
    assert.equal(p.$('shell-workshop-dialog').open, true);
    assert.equal(p.$('shell-playground').href, 'http://localhost/game/playground/?journey=legacy');
    back = workshopReturnLinks(p.$('shell-playground').href, 'playground').workshop;
    assert.equal(back, 'http://localhost/game/?journey=legacy&workshop=playground');
    assert.deepEqual(p.errors, []);
  });
  await t.test(
    'the fixed tool return opens Legacy Workshop without starting a mission',
    async (t) => {
      nativeDialogs(t);
      const p = await page(t, { search: new URL(back).search });
      assert.equal(p.doc.body.classList.contains('journey-preview'), false);
      assert.equal(p.$('shell-workshop-dialog').open, true);
      assert.equal(p.doc.activeElement.id, 'shell-playground');
      assert.equal(p.rendered.run.tick, 0);
      assert.equal(p.rendered.paused, true);
      assert.deepEqual(p.errors, []);
    },
  );
});

test('the explicit Legacy-backed Journey preview retains its supported Workshop context', async (t) => {
  const p = await page(t, { search: '?journey=1' });
  assert.equal(p.doc.body.classList.contains('journey-preview'), true);
  assert.equal(p.$('shell-playground').href, 'http://localhost/game/playground/?journey=1');
  assert.equal(
    workshopReturnLinks(p.$('shell-playground').href, 'playground').game,
    'http://localhost/game/?journey=1',
  );
  assert.deepEqual(p.errors, []);
});
