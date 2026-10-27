import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';
import { readFlightInformation } from '../ui/flight-information-host.mjs';
import { Soundscape } from '../ui/audio.mjs';
import { getLocale, setLocale, t as translate } from '../i18n/index.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'audio-save-warning-host',
  revision: '1',
  title: 'Audio save warning ownership',
  classRecipes: JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url))),
  levels: [retryFixture('self-contact').level],
};
const information = (page) => readFlightInformation(page.$('run-message'));
const volume = (page, value) => {
  const input = page.$('master-volume');
  input.value = String(value);
  input.onchange({ target: input });
};
async function setup(t) {
  const storage = memoryStorage({
    [AUDIO_PREFERENCES_KEY]: JSON.stringify({ muted: true, volume: 0.3 }),
  });
  const page = await soloPage(t, { campaign, storage });
  let failing = true,
    afterWrite = null;
  const write = storage.setItem.bind(storage);
  storage.setItem = (key, value) => {
    if (failing && key === AUDIO_PREFERENCES_KEY) throw new Error('Modeled storage failure');
    write(key, value);
    if (key === AUDIO_PREFERENCES_KEY && afterWrite) {
      const callback = afterWrite;
      afterWrite = null;
      callback();
    }
  };
  return {
    page,
    recover: () => (failing = false),
    duringNextWrite: (callback) => (afterWrite = callback),
  };
}

for (const locale of ['en', 'uk'])
  test(`actual Solo host clears only its recovered audio save warning in ${locale}`, async (t) => {
    const original = getLocale();
    t.after(() => setLocale(original));
    const { page, recover } = await setup(t);
    setLocale(locale);
    page.$('master-volume').focus();
    volume(page, 0.4);
    const failed = information(page).lastWarning;
    assert.equal(
      page.$('run-message').textContent,
      translate('common:preferences.audioSaveFailed'),
    );
    assert.equal(information(page).snapshot.started, false);
    assert.equal(information(page).snapshot.paused, true);
    recover();
    volume(page, 0.5);
    assert.equal(page.$('run-message').textContent, '');
    assert.equal(failed.role, 'host.audio-preferences');
    assert.equal(information(page).lastWarning.fullText, '');
    assert.equal(page.doc.activeElement, page.$('master-volume'));
    assert.deepEqual(JSON.parse(page.storage.getItem(AUDIO_PREFERENCES_KEY)), {
      muted: true,
      volume: 0.5,
    });
    assert.deepEqual(page.errors, []);
  });

for (const replacement of ['new-warning', 'new-attempt'])
  test(`actual Solo audio recovery preserves ${replacement} ownership`, async (t) => {
    const { page, recover } = await setup(t);
    volume(page, 0.4);
    const failed = information(page);
    if (replacement === 'new-warning') {
      // Identical words belong to a different operation: text equality is not ownership.
      t.mock.method(Soundscape.prototype, 'preview', async () => {
        throw new Error(failed.lastWarning.fullText);
      });
      await page.$('music-preview').onclick();
      assert.equal(information(page).lastWarning.role, 'host.music');
    } else if (replacement === 'new-attempt') {
      page.$('retry-button').onclick();
      await settle(() => information(page).owner.generation > failed.owner.generation);
      assert.notEqual(information(page).lastWarning.role, 'host.audio-preferences');
    }
    const before = information(page).lastWarning,
      text = page.$('run-message').textContent;
    recover();
    volume(page, 0.5);
    assert.equal(page.$('run-message').textContent, text);
    assert.deepEqual(information(page).lastWarning, before);
    assert.deepEqual(page.errors, []);
  });

for (const restore of [false, true])
  test(`audio persistence completed across ${restore ? 'restoration' : 'pagehide'} cannot dismiss the old caption`, async (t) => {
    const { page, recover, duringNextWrite } = await setup(t);
    volume(page, 0.4);
    let notice, text;
    // Model the lifecycle boundary inside the storage adapter; the real host
    // still owns suspension, restoration and whether the notice may be cleared.
    duringNextWrite(() => {
      page.win.emit('pagehide', { persisted: true });
      if (restore) page.win.emit('pageshow', { persisted: true });
      notice = information(page).lastWarning;
      text = page.$('run-message').textContent;
    });
    recover();
    volume(page, 0.5);
    assert.equal(page.$('run-message').textContent, text);
    assert.deepEqual(information(page).lastWarning, notice);
    assert.deepEqual(page.errors, []);
  });
