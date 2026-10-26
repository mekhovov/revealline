import test from 'node:test';
import assert from 'node:assert/strict';
import {
  overflightNativePage,
  overflightMemoryStorage,
} from './helpers/overflight-native-host.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { setLocale } from '../i18n/index.mjs';

const record = { textFace: 'plain', textSize: 'extra-large', reducedEffects: false };
const saved = () => overflightMemoryStorage({ [DISPLAY_PREFERENCES_KEY]: JSON.stringify(record) });
function change(page, id, value) {
  const control = page.$(id);
  control.focus();
  control.value = value;
  control.emit('change');
  return control;
}
async function start(page) {
  page.frame();
  page.frame();
  page.$('overflight-action-primary').click();
  await waitFor(() => page.snapshot().phase === 'playing');
}
function peerSize(page, size) {
  const raw = JSON.stringify({ ...record, textSize: size });
  page.storage.values.set(DISPLAY_PREFERENCES_KEY, raw);
  page.window.emit('storage', {
    key: DISPLAY_PREFERENCES_KEY,
    storageArea: page.storage,
    newValue: raw,
  });
}

// A fresh process preserves the shared five-minute anti-repeat contract.
for (const operation of ['riy'])
  test(`actual ${operation || 'Single Drone'} earned draft preserves offer IDs, rerolls, accepted state and focused choice across size/locale`, async (t) => {
    const page = await overflightNativePage(t, { operation, storage: saved() });
    await start(page);
    let direction = '';
    const directions = ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'];
    for (let n = 0; n < 1800 && page.snapshot().phase === 'playing'; n++) {
      const next = directions[Math.floor(n / 150) % directions.length];
      if (next !== direction) {
        if (direction)
          page.window.emit('keyup', {
            key: direction,
            code: direction,
            target: page.$('render-host'),
          });
        direction = next;
        page.window.emit('keydown', {
          key: direction,
          code: direction,
          target: page.$('render-host'),
        });
      }
      page.frame();
    }
    if (direction)
      page.window.emit('keyup', { key: direction, code: direction, target: page.$('render-host') });
    assert.equal(
      page.snapshot().phase,
      'upgrade',
      'The actual native clock/core must earn this draft.',
    );
    const ids = () => [...page.$('upgrade-cards').children].map((card) => card.dataset.upgradeId);
    const offers = ids(),
      checkpoint = page.snapshot(),
      rerolls = page.$('rerolls-left').textContent;
    const focused = offers[1] ?? offers[0];
    page
      .$('upgrade-cards')
      .children.find((card) => card.dataset.upgradeId === focused)
      .focus();
    for (const size of ['large', 'extra-large']) {
      peerSize(page, size);
      assert.deepEqual(ids(), offers);
      assert.equal(page.document.activeElement.dataset.upgradeId, focused);
      assert.deepEqual(page.snapshot(), checkpoint);
      assert.equal(page.$('rerolls-left').textContent, rerolls);
      assert.equal(
        page.$('upgrade-cards').querySelectorAll('.upgrade-comparison').length,
        size === 'extra-large' ? offers.length : 0,
      );
    }
    const remaining = page.$('rerolls-left').textContent.match(/\d+/)?.[0];
    for (const locale of ['uk', 'en']) {
      setLocale(locale, { persist: false });
      assert.deepEqual(ids(), offers);
      assert.equal(page.document.activeElement.dataset.upgradeId, focused);
      assert.deepEqual(page.snapshot(), checkpoint);
      assert.equal(page.$('rerolls-left').textContent.match(/\d+/)?.[0], remaining);
      assert.equal(
        page.$('upgrade-cards').querySelector('.upgrade-comparison-state strong').textContent,
        locale === 'uk' ? 'ЗАРАЗ' : 'NOW',
      );
    }
    const chosen = page.document.activeElement;
    const beforeReading = page.snapshot();
    assert.equal(page.window.RevealLineOverflight.measurements().feedback.commentator.incidents, 0);
    // The existing danger policy uses wall time. A player can read the paused
    // earned cards for 13s before selecting; no core clock or rule is changed.
    await new Promise((resolve) => setTimeout(resolve, 13000));
    assert.deepEqual(page.snapshot(), beforeReading);
    assert.deepEqual(ids(), offers);
    chosen.click();
    assert.equal(page.snapshot().phase, 'playing');
    assert.equal(page.snapshot().summary.upgrades.length, checkpoint.summary.upgrades.length + 1);
    assert.equal(page.snapshot().summary.upgrades.at(-1).id, focused);
    assert.equal(page.window.RevealLineOverflight.measurements().feedback.commentator.incidents, 1);
    const reader = page.document.querySelector('[data-reaction-reader]'),
      pause = page.$('overflight-action-pause'),
      arena = page.$('render-host');
    assert.ok(reader.closest('#overflight-pause-dialog'));
    assert.equal(reader.hidden, false, 'The actual accepted upgrade reaction owns this message.');
    const accepted = page.snapshot();
    page.frame(0); // Flush the accepted reward's existing presentation notification.
    assert.deepEqual(page.snapshot(), accepted);
    assert.equal(pause.dataset.captionReadLabel, 'Read');
    const paragraph = reader.querySelector('p'),
      message = paragraph.textContent;
    assert.ok(message.includes('—'));
    const writes = [...page.storage.writes];
    pause.click();
    assert.equal(page.snapshot().phase, 'paused');
    assert.equal(page.$('overflight-pause-dialog').open, true);
    assert.equal(pause.dataset.captionReadLabel, undefined);
    reader.focus();
    const paused = page.snapshot();
    for (const locale of ['uk', 'en']) {
      setLocale(locale, { persist: false });
      assert.ok(page.document.activeElement === reader);
      assert.ok(reader.querySelector('p') === paragraph);
      assert.equal(
        reader.querySelector('h3').textContent,
        locale === 'uk' ? 'Останнє повідомлення' : 'Last message',
      );
      assert.deepEqual(page.snapshot(), paused);
    }
    assert.equal(paragraph.textContent, message);
    assert.ok(page.$('overflight-action-pause') === pause);
    assert.ok(page.$('render-host') === arena);
    assert.deepEqual(page.storage.writes, writes);
    page.$('overflight-action-pause-resume').click();
    assert.equal(page.snapshot().phase, 'playing');
    assert.equal(paragraph.textContent, message);
  });
