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

for (const operation of ['', 'riy'])
  test(`actual ${operation || 'Single Drone'} Settings owns the opt-in size without replacing a paused flight or native actions`, async (t) => {
    const page = await overflightNativePage(t, { operation, storage: saved() });
    assert.equal(page.document.documentElement.dataset.textScaling, 'overflight');
    assert.equal(page.document.body.dataset.textSize, 'extra-large');
    assert.ok(page.$('overflight-flight-details').closest('#overflight-pause-dialog'));
    for (const id of [
      'hud-cache',
      'hud-reward',
      'overflight-commentator',
      'overflight-review-controls',
    ])
      assert.ok(page.$(id).closest('#overflight-game'), `${id} remains live in its game shell.`);
    const noticeNodes = ['hud-cache', 'hud-reward', 'overflight-commentator'].map((id) =>
      page.$(id),
    );
    for (const node of noticeNodes) assert.ok(node.closest('#overflight-field-notices'));
    const arena = page.$('render-host'),
      touch = page.document.querySelector('.overflight-touch');
    assert.ok(arena.parentNode === page.$('overflight-game'));
    assert.ok(touch.parentNode === page.$('overflight-game'));
    await start(page);
    for (let n = 0; n < 30; n++) page.frame();
    page.$('overflight-action-pause').click();
    assert.equal(page.snapshot().phase, 'paused');
    assert.equal(page.$('overflight-pause-dialog').open, true);
    const details = page.$('overflight-flight-details');
    details.focus();
    assert.ok(page.document.activeElement === details);
    assert.ok(page.$('hud-build').closest('#overflight-pause-dialog'));
    page.$('overflight-action-pause-resume').click();
    assert.equal(page.snapshot().phase, 'playing');
    page.$('overflight-action-menu').click();
    assert.equal(page.snapshot().phase, 'paused');
    page.$('overflight-action-settings').click();
    page.$('overflight-menu-settings-tab-accessibility').click();
    const selector = page.$('text-size'),
      action = page.$('overflight-action-settings-back'),
      retry = page.$('overflight-action-home-retry'),
      checkpoint = page.snapshot(),
      writes = page.storage.writes.filter(([key]) => key !== DISPLAY_PREFERENCES_KEY);
    assert.equal(selector.querySelector('[data-text-size-retained]').disabled, false);
    assert.ok(
      retry?.closest('#overflight-menu-settings-panel-gameplay'),
      'Retain PR 1707’s actual Gameplay Retry action.',
    );
    for (const size of ['standard', 'large', 'extra-large']) {
      change(page, 'text-size', size);
      page.frame(0);
      assert.equal(page.document.body.dataset.textSize, size);
      assert.ok(page.$('text-size') === selector);
      assert.ok(page.$('overflight-action-settings-back') === action);
      assert.ok(page.$('overflight-action-home-retry') === retry);
      assert.ok(page.document.activeElement === selector);
      assert.ok(page.$('render-host') === arena);
      for (const node of noticeNodes) {
        assert.ok(page.$(node.id) === node);
        assert.ok(
          node.closest(size === 'extra-large' ? '#overflight-field-notices' : '#overflight-hud'),
        );
      }
      assert.ok(page.document.querySelector('.overflight-touch') === touch);
      assert.deepEqual(page.snapshot(), checkpoint);
      assert.deepEqual(
        page.storage.writes.filter(([key]) => key !== DISPLAY_PREFERENCES_KEY),
        writes,
      );
      assert.deepEqual(JSON.parse(page.storage.getItem(DISPLAY_PREFERENCES_KEY)), {
        ...record,
        textSize: size,
      });
    }
    page.$('overflight-menu-settings-tab-display').click();
    const language = change(page, 'language', 'uk');
    assert.ok(page.document.activeElement === language);
    assert.equal(selector.querySelector('[data-text-size-retained]').textContent, 'Дуже великий');
    assert.equal(page.$('overflight-flight-details-title').textContent, 'Подробиці польоту');
    assert.deepEqual(page.snapshot(), checkpoint);
    change(page, 'language', 'en');
    assert.equal(selector.querySelector('[data-text-size-retained]').textContent, 'Extra large');
    assert.deepEqual(page.snapshot(), checkpoint);
    page.storage.failWrites();
    page.$('overflight-menu-settings-tab-accessibility').click();
    change(page, 'text-size', 'standard');
    change(page, 'text-size', 'extra-large');
    assert.equal(page.document.body.dataset.textSize, 'extra-large');
    assert.deepEqual(page.snapshot(), checkpoint);
  });

for (const operation of ['', 'time-attack', 'marathon'])
  test(`actual ${operation || 'Raid'} host supports Extra large while retaining saved intent and accepted state`, async (t) => {
    const storage = saved(),
      page = await overflightNativePage(t, { operation, entry: 'raid', storage });
    const before = storage.getItem(DISPLAY_PREFERENCES_KEY),
      snapshot = page.snapshot();
    assert.equal(page.document.documentElement.dataset.textScaling, 'overflight');
    assert.equal(page.document.body.dataset.textSize, 'extra-large');
    assert.equal(page.$('text-size').value, 'extra-large');
    assert.equal(page.$('text-size').querySelector('[data-text-size-retained]').disabled, false);
    assert.ok(page.$('overflight-flight-details').closest('#overflight-pause-dialog'));
    const reader = page.document.querySelector('[data-reaction-reader]');
    assert.ok(reader.closest('#overflight-pause-dialog'));
    assert.equal(reader.hidden, true, 'No accepted caption is invented by opt-in.');
    assert.ok(page.$('overflight-touch-visibility').closest('[data-touch-visit]'));
    page.$('overflight-action-settings').click();
    page.$('overflight-menu-settings-tab-accessibility').click();
    change(page, 'text-face', 'pixel');
    assert.equal(JSON.parse(storage.getItem(DISPLAY_PREFERENCES_KEY)).textSize, 'extra-large');
    assert.equal(page.document.body.dataset.textSize, 'extra-large');
    assert.equal(JSON.parse(before).textSize, 'extra-large');
    assert.deepEqual(page.snapshot(), snapshot);
    const arena = page.$('render-host'),
      selector = page.$('text-size');
    for (const size of ['standard', 'large', 'extra-large']) {
      change(page, 'text-size', size);
      page.frame(0);
      assert.equal(page.document.body.dataset.textSize, size);
      assert.ok(page.$('text-size') === selector);
      assert.ok(page.$('render-host') === arena);
      assert.ok(page.document.activeElement === selector);
      assert.deepEqual(page.snapshot(), snapshot);
      assert.equal(JSON.parse(storage.getItem(DISPLAY_PREFERENCES_KEY)).textSize, size);
    }
    page.$('overflight-menu-settings-tab-display').click();
    for (const locale of ['uk', 'en']) {
      change(page, 'language', locale);
      assert.equal(page.document.body.dataset.textSize, 'extra-large');
      assert.equal(
        selector.querySelector('[data-text-size-retained]').textContent,
        locale === 'uk' ? 'Дуже великий' : 'Extra large',
      );
      assert.deepEqual(page.snapshot(), snapshot);
    }
  });

for (const operation of ['', 'riy'])
  test(`actual ${operation || 'Single Drone'} visit visibility uses native Controls without replacing the paused run or saved choices`, async (t) => {
    const page = await overflightNativePage(t, { operation, storage: saved() });
    await start(page);
    const root = page.document.querySelector('.overflight-touch'),
      arena = page.$('render-host'),
      boost = page.$('overflight-touch-action');
    assert.equal(root.hidden, true, 'Default auto remains hidden for keyboard/mouse play.');
    page.$('overflight-action-settings').click();
    page.$('overflight-menu-settings-tab-controls').click();
    const control = page.$('overflight-touch-visibility'),
      checkpoint = page.snapshot(),
      writes = [...page.storage.writes];
    assert.ok(control.closest('#overflight-menu-settings-panel-controls'));
    assert.ok(control.closest('[data-touch-visit]'));
    assert.equal(control.closest('[data-global-settings]'), null);
    assert.ok(
      page.document.querySelector('[data-touch-setting]').closest('[data-global-settings]'),
    );
    assert.equal(control.value, 'auto');
    change(page, control.id, 'always');
    assert.deepEqual(page.snapshot(), checkpoint);
    assert.equal(root.hidden, true, 'Settings remains an inactive input surface.');
    for (const locale of ['uk', 'en']) {
      setLocale(locale, { persist: false });
      assert.ok(page.document.activeElement === control);
      assert.equal(control.value, 'always');
      assert.equal(
        control.children[1].textContent,
        locale === 'uk' ? 'Завжди · дотик або миша' : 'Always · touch or mouse',
      );
      assert.match(
        page.document.getElementById(control.getAttribute('aria-describedby')).textContent,
        locale === 'uk' ? /відвідування/u : /this visit/,
      );
      assert.deepEqual(page.snapshot(), checkpoint);
    }
    assert.deepEqual(page.storage.writes, writes);
    for (let n = 0; n < 3 && page.$('overflight-settings-dialog').open; n++)
      page.$('overflight-action-settings-back').click();
    assert.equal(page.$('overflight-settings-dialog').open, false);
    assert.equal(page.$('overflight-home-dialog').open, true);
    assert.equal(page.snapshot().phase, 'paused');
    page.$('overflight-action-primary').click();
    assert.equal(page.snapshot().phase, 'playing');
    assert.equal(root.hidden, false);
    page.frame(0);
    assert.ok(page.$('hud-level').closest('#overflight-flight-details'));
    assert.ok(page.$('hud-kills').closest('#overflight-flight-details'));
    assert.equal(page.$('hud-hull').closest('#overflight-hud')?.id, 'overflight-hud');
    assert.ok(page.document.querySelector('.overflight-touch') === root);
    assert.ok(page.$('overflight-touch-action') === boost);
    assert.ok(page.$('render-host') === arena);
    assert.deepEqual(page.storage.writes, writes);
    page.$('overflight-action-settings').click();
    page.$('overflight-menu-settings-tab-controls').click();
    assert.ok(page.$(control.id) === control);
    assert.ok(
      page.$('hud-level').closest('#overflight-flight-details'),
      'Paused menus retain the exact facts in the existing reader.',
    );
    assert.ok(page.$('hud-kills').closest('#overflight-flight-details'));
    change(page, control.id, 'off');
    assert.equal(root.hidden, true);
    assert.ok(page.$('hud-level').closest('#overflight-hud'));
    assert.ok(page.$('hud-kills').closest('#overflight-hud'));
    assert.deepEqual(page.storage.writes, writes);
    for (let n = 0; n < 3 && page.$('overflight-settings-dialog').open; n++)
      page.$('overflight-action-settings-back').click();
    page.$('overflight-action-primary').click();
    arena.focus();
    for (let n = 0; n < 60; n++) page.frame();
    const boosts = page.snapshot().summary.stats.boostsUsed;
    page.document.emit('keydown', { code: 'Space', key: ' ', target: arena });
    page.frame();
    page.document.emit('keyup', { code: 'Space', key: ' ', target: arena });
    page.frame();
    assert.equal(page.snapshot().summary.stats.boostsUsed, boosts + 1);
    assert.equal(root.hidden, true, 'Off hides touch without disabling the native keyboard.');
    assert.deepEqual(page.storage.writes, writes);
  });

for (const operation of ['', 'riy'])
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
    if (!operation) {
      const beforeReading = page.snapshot();
      assert.equal(
        page.window.RevealLineOverflight.measurements().feedback.commentator.incidents,
        0,
      );
      // The existing danger policy uses wall time. A player can read the paused
      // earned cards for 13s before selecting; no core clock or rule is changed.
      await new Promise((resolve) => setTimeout(resolve, 13000));
      assert.deepEqual(page.snapshot(), beforeReading);
      assert.deepEqual(ids(), offers);
    }
    chosen.click();
    assert.equal(page.snapshot().phase, 'playing');
    assert.equal(page.snapshot().summary.upgrades.length, checkpoint.summary.upgrades.length + 1);
    assert.equal(page.snapshot().summary.upgrades.at(-1).id, focused);
    if (operation) return; // Original Riy offer/state coverage stays in this file.
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
