import test from 'node:test';
import assert from 'node:assert/strict';
import { attachMenuAudioSettings } from '../ui/menu-audio.mjs';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { Document } from './helpers/couch-dom.mjs';

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
