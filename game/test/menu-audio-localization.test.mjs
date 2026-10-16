import test from 'node:test';
import assert from 'node:assert/strict';
import { attachMenuAudioSettings } from '../ui/menu-audio.mjs';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { Document, Events } from './helpers/couch-dom.mjs';

test('live language changes update audio slider names without changing focus or volume', (context) => {
  const previous = getLocale();
  context.after(() => setLocale(previous, { persist: false }));
  setLocale('en', { persist: false });
  const doc = new Document();
  const panel = doc.createElement('section');
  panel.id = 'settings-panel-audio';
  doc.body.append(panel);
  let writes = 0;
  const sound = {
    menuSettings: { enabled: true, volume: 0.35 },
    radioSettings: { enabled: true, volume: 0.4 },
    movementSettings: { enabled: false, volume: 0.5 },
    applyVolumes: () => writes++,
  };
  const dispose = attachMenuAudioSettings(sound, doc);
  context.after(dispose);
  const focused = doc.getElementById('radio-audio-volume');
  focused.focus();
  for (const language of ['uk', 'en', 'uk']) {
    setLocale(language, { persist: false });
    for (const prefix of ['menu', 'radio', 'movement']) {
      const slider = doc.getElementById(`${prefix}-audio-volume`);
      assert.equal(slider.getAttribute('aria-label'), t(`common:${prefix}Volume`));
      assert.equal(slider.value, String(Math.round(sound[`${prefix}Settings`].volume * 100)));
    }
    assert.equal(doc.activeElement, focused);
    assert.equal(writes, 0);
  }
});

test('another mode edits canonical cue preferences through its injected host without duplicate controls', (context) => {
  const doc = new Document(),
    win = new Events(),
    panel = doc.createElement('section'),
    saved = new Map(),
    sound = {
      menuSettings: { enabled: true, volume: 0.35 },
      radioSettings: { enabled: true, volume: 0.4 },
      movementSettings: { enabled: false, volume: 0.5 },
      applyVolumes() {
        this.applied = (this.applied || 0) + 1;
      },
    };
  doc.body.append(panel);
  const options = {
    target: panel,
    window: win,
    idPrefix: 'snake',
    getStorage: () => ({ setItem: (key, value) => saved.set(key, value) }),
  };
  const dispose = attachMenuAudioSettings(sound, doc, options);
  context.after(dispose);
  const duplicate = attachMenuAudioSettings(sound, doc, options);
  context.after(duplicate);
  assert.equal(panel.querySelectorAll('input').length, 6);
  const slider = doc.getElementById('snake-menu-audio-volume');
  slider.value = '67';
  slider.emit('input');
  assert.equal(sound.menuSettings.volume, 0.67);
  assert.equal(sound.applied, 1);
  assert.deepEqual(JSON.parse(saved.get('revealline.menu-audio.v1')), {
    enabled: true,
    volume: 0.67,
  });
  sound.menuSettings.volume = 0.21;
  win.emit('pageshow');
  assert.equal(slider.value, '21');
  sound.menuSettings.volume = 0.42;
  win.emit('storage', { key: 'revealline.menu-audio.v1' });
  assert.equal(slider.value, '42');
  dispose();
  assert.equal(panel.querySelectorAll('input').length, 0);
});
