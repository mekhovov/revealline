import { t, localizedText } from '../i18n/index.mjs';
export const MENU_AUDIO_KEY = 'revealline.menu-audio.v1';
export function readMenuAudio(storage) {
  try {
    storage ??= globalThis.localStorage;
    const value = JSON.parse(storage?.getItem(MENU_AUDIO_KEY) ?? 'null');
    return {
      enabled: typeof value?.enabled === 'boolean' ? value.enabled : true,
      volume:
        Number.isFinite(value?.volume) && value.volume >= 0 && value.volume <= 1
          ? value.volume
          : 0.35,
    };
  } catch {
    return { enabled: true, volume: 0.35 };
  }
}
export function saveMenuAudio(value) {
  try {
    globalThis.localStorage?.setItem(MENU_AUDIO_KEY, JSON.stringify(value));
  } catch {
    /* Session intent stays on Soundscape. */
  }
}
export function attachMenuAudioSettings(sound, doc = globalThis.document) {
  if (!sound.menuSettings || !doc?.createElement) return () => {};
  const target =
    doc.getElementById('sfx-volume')?.parentElement?.parentElement ??
    doc.getElementById('race-settings-panel-audio') ??
    doc.getElementById('coop-settings-panel-audio') ??
    doc.getElementById('settings-panel-audio') ??
    doc.getElementById('settings-dialog');
  if (!target || target.querySelector('[data-menu-audio]')) return () => {};
  const group = doc.createElement('div');
  group.dataset.menuAudio = '';
  group.style.display = 'grid';
  group.style.gap = '0.75rem';
  const enabledLabel = doc.createElement('label'),
    enabled = doc.createElement('input');
  enabled.id = 'menu-audio-enabled';
  enabled.type = 'checkbox';
  enabled.style.width = 'auto';
  enabled.style.margin = '0';
  enabledLabel.style.display = 'flex';
  enabledLabel.style.alignItems = 'center';
  enabledLabel.style.gap = '0.6rem';
  enabled.checked = sound.menuSettings.enabled;
  const enabledText = doc.createElement('span');
  localizedText(enabledText, () => t('common:menuSounds'));
  enabledLabel.append(enabled, enabledText);
  const volumeLabel = doc.createElement('label'),
    volume = doc.createElement('input');
  volume.id = 'menu-audio-volume';
  volume.type = 'range';
  volumeLabel.style.display = 'grid';
  volumeLabel.style.gap = '0.35rem';
  volume.min = '0';
  volume.max = '100';
  volume.step = '1';
  volume.value = String(Math.round(sound.menuSettings.volume * 100));
  volume.setAttribute('aria-label', t('common:menuVolume'));
  const volumeText = doc.createElement('span');
  volumeText.id = 'menu-audio-volume-label';
  const volumeCaption = () =>
    `${t('common:menuVolume')} · ${Math.round(sound.menuSettings.volume * 100)}%`;
  localizedText(volumeText, volumeCaption);
  volumeLabel.append(volumeText, volume);
  const change = () => {
    sound.menuSettings = { enabled: enabled.checked, volume: Number(volume.value) / 100 };
    saveMenuAudio(sound.menuSettings);
    sound.applyVolumes();
    volumeText.textContent = volumeCaption();
  };
  enabled.addEventListener('change', change);
  volume.addEventListener('input', change);
  group.append(enabledLabel, volumeLabel);
  target.append(group);
  const restore = () => {
    enabled.checked = sound.menuSettings.enabled;
    volume.value = String(Math.round(sound.menuSettings.volume * 100));
    volumeText.textContent = volumeCaption();
  };
  globalThis.addEventListener?.('pageshow', restore);
  return () => {
    globalThis.removeEventListener?.('pageshow', restore);
    enabled.removeEventListener('change', change);
    volume.removeEventListener('input', change);
    group.remove();
  };
}
