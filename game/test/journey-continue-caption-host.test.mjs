import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { journeyMissionId } from '../journey/catalog.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
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
const known = journeyMissionId({
  source: 'candidate',
  packId: 'journey-opening',
  campaignId: 'prologue',
  levelId: 'first-return',
});
async function setup(t, { route = 'opening', events = [], denied = false } = {}) {
  const memory = managedIndexedDB(),
    backend = createJourneyBackend(memory);
  if (events.length) await backend.commit(events);
  const before = await backend.read();
  const p = await soloPage(t, {
    search: `?journey=${route}`,
    titleScreen: true,
    storage: memoryStorage(),
    journeyIndexedDB: denied
      ? {
          open() {
            throw Error('Storage denied');
          },
        }
      : memory.indexedDB,
    pictures: { Image: CandidateImage },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
    },
  });
  return { p, backend, before };
}
async function activate(p, id, level) {
  assert.equal(p.$(id).hidden, false, 'The primary action must actually be visible.');
  p.$(id).focus();
  p.$(id).click();
  await waitFor(() => p.doc.body.dataset.flightState === 'running', { timeoutMs: 15_000 });
  p.frame(0);
  assert.equal(p.rendered.run.levelId, level);
  assert.equal(p.$('shell-home').open, false);
  assert.equal(p.$('shell-missions').open, false);
  assert.deepEqual(p.errors, []);
}
for (const completed of [false, true])
  test(`title names the actual ${completed ? 'successor' : 'selected'} Journey destination`, async (t) => {
    const selected = completed
      ? known
      : journeyMissionId({
          source: 'candidate',
          packId: 'journey-opening',
          campaignId: 'prologue',
          levelId: 'choose-your-share',
        });
    const events = [{ type: 'select', mode: 'solo', missionId: selected }];
    if (completed)
      events.push({
        type: 'complete',
        mode: 'solo',
        missionId: selected,
        runId: 'old-clear',
        gameplayId: 'old-gameplay',
        difficulty: 'standard',
      });
    const { p, backend, before } = await setup(t, { events });
    assert.equal(p.$('shell-destination').textContent, 'Continue · Choose your share');
    assert.deepEqual(await backend.read(), before);
    await activate(p, 'shell-continue', 'choose-your-share');
  });

test('completed Prologue names the successor in Horizon School', async (t) => {
  const last = journeyMissionId({
    source: 'candidate',
    packId: 'journey-opening',
    campaignId: 'prologue',
    levelId: 'two-keepers',
  });
  const { p } = await setup(t, {
    events: [
      { type: 'select', mode: 'solo', missionId: last },
      {
        type: 'complete',
        mode: 'solo',
        missionId: last,
        runId: 'old-last',
        gameplayId: 'old-gameplay',
        difficulty: 'standard',
      },
    ],
  });
  assert.equal(p.$('shell-destination').textContent, 'Continue · Nearby shore');
  await activate(p, 'shell-continue', 'nearby-shore');
});

test('an active Journey caption continues to name its paused flight', async (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const { p } = await setup(t, { route: 'whole-spatial-v11' });
  const primary = p.$('shell-continue').hidden ? 'shell-featured' : 'shell-continue';
  await activate(p, primary, 'first-return');
  p.$('pause-button').click();
  p.$('overlay-menu').click();
  assert.equal(p.$('shell-home').open, true);
  assert.equal(p.$('shell-destination').textContent, 'Continue · First return');
  setLocale('uk', { persist: false });
  assert.equal(p.$('shell-continue').textContent.trim(), 'Продовжити→');
  assert.equal(p.$('mission-brief-title').textContent, 'Перше повернення');
  assert.equal(p.$('shell-destination').textContent, 'Продовжити · Перше повернення');
  setLocale('en', { persist: false });
  assert.equal(p.$('shell-continue').textContent.trim(), 'Continue→');
  assert.equal(p.$('shell-destination').textContent, 'Continue · First return');
  assert.equal(p.rendered.run.levelId, 'first-return');
  assert.deepEqual(p.errors, []);
});
