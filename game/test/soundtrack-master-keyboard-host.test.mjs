import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const campaign = {
  version: 'xonix-campaign.v1',
  id: 'master-keyboard-host',
  revision: '1',
  title: 'Master keyboard host',
  classRecipes: JSON.parse(readFileSync(new URL('../content/classes.json', import.meta.url))),
  levels: [retryFixture('self-contact').level],
};

// The finite DOM does not reflect dynamic input attributes or implement native
// key defaults. Reflect only actual markup; dispatch through the real host's
// capture/bubble handlers before applying a browser default that they may stop.
function nativeInput(element) {
  for (const name of ['type', 'min', 'max', 'step']) {
    const value = element.attributes.get(name);
    if (value !== undefined) element[name] = value;
  }
  return element;
}
function nativeRangeValue(element) {
  nativeInput(element);
  let value = '';
  const initial = element.value;
  // A native range sanitizes programmatic writes to its step grid, including
  // writes to Settings while the Studio dialog is above it. The production
  // subscription still performs every write; only the browser setter is modeled.
  Object.defineProperty(element, 'value', {
    configurable: true,
    get: () => value,
    set(next) {
      const min = Number(element.min),
        max = Number(element.max),
        step = Number(element.step);
      const bounded = Math.max(min, Math.min(max, Number(next)));
      value = String(Number((min + Math.round((bounded - min) / step) * step).toFixed(8)));
    },
  });
  element.value = initial;
  return element;
}
function keyboard(page, { changeOnly = false } = {}) {
  return {
    press(key) {
      const target = nativeInput(page.doc.activeElement);
      const event = target.emit('keydown', { key, code: key, repeat: false });
      let changed = false;
      if (!event.defaultPrevented) {
        if (key === 'Enter' && target.tagName === 'BUTTON') target.click();
        if (target.tagName === 'INPUT' && target.type === 'range' && /^Arrow/.test(key)) {
          const delta = ['ArrowRight', 'ArrowUp'].includes(key) ? 1 : -1;
          target.value = String(
            Number(
              Math.max(
                Number(target.min),
                Math.min(Number(target.max), Number(target.value) + delta * Number(target.step)),
              ).toFixed(8),
            ),
          );
          if (!changeOnly) target.emit('input');
          changed = true;
        }
        if (key === 'Escape') {
          const dialog = target.closest('dialog[open]');
          if (dialog?.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
        }
      }
      target.emit('keyup', { key, code: key });
      if (changed) target.emit('change');
      return event;
    },
  };
}

async function setup(t, keyboardOptions, volume = 0) {
  const storage = memoryStorage({
    [AUDIO_PREFERENCES_KEY]: JSON.stringify({ muted: true, volume }),
  });
  const audio = audioHarness();
  const page = await soloPage(t, { campaign, storage, audio, titleScreen: true });
  await settle(() => !page.$('soundtrack-open').disabled, 'Actual music host initialized');
  nativeRangeValue(page.$('master-volume'));
  return { page: Object.assign(page, keyboard(page, keyboardOptions)), audio };
}

test('a Studio 13% master commit remains exactly 13% in native-sanitized Settings and on reopening', async (t) => {
  const { page, audio } = await setup(t, {}, 0.12);
  enter(page, 'shell-options');
  enter(page, 'settings-tab-audio');
  await studio(page);
  const slider = nativeRangeValue(page.$('soundtrack-master-volume'));
  slider.focus();
  page.press('Enter');
  page.press('ArrowRight');
  page.press('Enter');
  assert.deepEqual(record(page), { muted: true, volume: 0.13 });
  assert.equal(Number(slider.value), 0.13);
  assert.equal(
    Number(page.$('master-volume').value),
    0.13,
    'The native Settings range must not snap a stored 13% master value to 15%.',
  );
  enter(page, 'soundtrack-close');
  assert.equal(Number(page.$('master-volume').value), 0.13);
  await studio(page);
  assert.equal(Number(page.$('soundtrack-master-volume').value), 0.13);
  assert.equal(audio.sources.length, 0);
  assert.ok(page.audioElements.every((media) => !media.plays));
  assert.deepEqual(page.errors, []);
});
function enter(page, id) {
  page.$(id).focus();
  assert.equal(page.doc.activeElement, page.$(id));
  page.press('Enter');
}
async function studio(page) {
  enter(page, 'soundtrack-open');
  await settle(
    () =>
      page.$('soundtrack-dialog')?.open &&
      /Saved library loaded|Music library ready/.test(page.$('soundtrack-status').textContent),
  );
}
const record = (page) => JSON.parse(page.storage.getItem(AUDIO_PREFERENCES_KEY));

for (const changeOnly of [false, true]) {
  test(`actual Solo Settings and Studio ${changeOnly ? 'change-only assistive' : 'input-and-change keyboard'} range edits persist through close/reopen without playback or flight advance`, async (t) => {
    const { page, audio } = await setup(t, { changeOnly });
    enter(page, 'shell-options');
    assert.equal(page.$('settings-dialog').open, true);
    enter(page, 'settings-tab-audio');
    const checkpoint = authoritativeCheckpoint(page.rendered.run);
    page.$('master-volume').focus();
    page.press('Enter');
    assert.equal(page.press('ArrowRight').defaultPrevented, false);
    page.press('Enter');
    assert.deepEqual(record(page), { muted: true, volume: 0.01 });
    await studio(page);
    const slider = nativeInput(page.$('soundtrack-master-volume'));
    assert.equal(Number(slider.value), 0.01);
    slider.focus();
    page.press('Enter');
    assert.equal(page.press('ArrowRight').defaultPrevented, false);
    page.press('Enter');
    assert.equal(Number(slider.value), 0.02);
    assert.deepEqual(record(page), { muted: true, volume: 0.02 });
    assert.equal(Number(page.$('master-volume').value), 0.02);
    page.press('ArrowRight');
    page.press('Enter');
    assert.deepEqual(record(page), { muted: true, volume: 0.03 });
    enter(page, 'soundtrack-close');
    assert.equal(page.$('settings-dialog').open, true);
    assert.equal(Number(page.$('master-volume').value), 0.03);
    await studio(page);
    assert.equal(Number(page.$('soundtrack-master-volume').value), 0.03);
    page.frame(0);
    assert.equal(page.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.equal(audio.sources.length, 0);
    assert.ok(page.audioElements.every((media) => !media.plays));
    assert.deepEqual(page.errors, []);
  });
}
