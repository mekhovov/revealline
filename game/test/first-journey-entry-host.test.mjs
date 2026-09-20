import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { journeyMissionId } from '../journey/catalog.mjs';
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
  await settle(() => p.doc.body.dataset.flightState === 'running');
  p.frame(0);
  assert.equal(p.rendered.run.levelId, level);
  assert.equal(p.$('shell-home').open, false);
  assert.equal(p.$('shell-missions').open, false);
  assert.deepEqual(p.errors, []);
}
for (const route of ['opening', 'authored'])
  test(`${route}: fresh Journey offers Start and starts the named mission directly`, async (t) => {
    const { p, backend, before } = await setup(t, { route });
    assert.equal(p.$('shell-featured').hidden, false);
    assert.equal(p.$('shell-continue').hidden, true);
    assert.match(p.$('shell-destination').textContent, /Start · First return/);
    assert.deepEqual(await backend.read(), before, 'Rendering a fresh title grants no progress.');
    await activate(p, 'shell-featured', 'first-return');
  });
for (const completed of [false, true])
  test(`known ${completed ? 'completed' : 'selected'} Solo progress remains Continue`, async (t) => {
    const events = [{ type: 'select', mode: 'solo', missionId: known }];
    if (completed)
      events.push({
        type: 'complete',
        mode: 'solo',
        missionId: known,
        runId: 'retained-run',
        gameplayId: 'retained-gameplay',
        difficulty: 'standard',
      });
    const { p, backend, before } = await setup(t, { events });
    assert.equal(p.$('shell-featured').hidden, true);
    assert.equal(p.$('shell-continue').hidden, false);
    assert.deepEqual(await backend.read(), before);
    await activate(p, 'shell-continue', completed ? 'choose-your-share' : 'first-return');
    if (completed) assert.equal((await backend.read()).clears.solo[known].runId, 'retained-run');
  });
test('unknown retained cursor is preserved without falsely presenting fallback as Continue', async (t) => {
  const { p, backend, before } = await setup(t, {
    events: [{ type: 'select', mode: 'solo', missionId: 'future/unknown/mission' }],
  });
  assert.equal(p.$('shell-featured').hidden, false);
  assert.equal(p.$('shell-continue').hidden, true);
  assert.deepEqual(await backend.read(), before);
  await activate(p, 'shell-featured', 'first-return');
});
test('Versus progress alone does not turn a first Solo visit into Continue', async (t) => {
  const { p, backend, before } = await setup(t, {
    events: [{ type: 'select', mode: 'versus', missionId: known }],
  });
  assert.equal(p.$('shell-featured').hidden, false);
  assert.equal(p.$('shell-continue').hidden, true);
  assert.deepEqual(await backend.read(), before);
  await activate(p, 'shell-featured', 'first-return');
  assert.equal((await backend.read()).cursors.versus, known);
});
test('denied Journey storage still offers truthful one-action Start', async (t) => {
  const { p } = await setup(t, { denied: true });
  assert.equal(p.$('shell-featured').hidden, false);
  assert.equal(p.$('shell-continue').hidden, true);
  assert.equal(p.$('journey-save-status').hidden, false);
  await activate(p, 'shell-featured', 'first-return');
});
