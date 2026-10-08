import { localizedText } from '../i18n/index.mjs';
import { createDestructionPreferences } from '../hunt/preferences.mjs';
import { huntText } from '../hunt/copy.mjs';

/** The sound style is shared by modes and independent of visual destruction.
 * A host may supply its existing preference owner so live audio sees the change. */
export function attachDefeatSoundControls({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  container,
  prefix = '',
  preferences: suppliedPreferences,
  getStorage,
  writable,
} = {}) {
  const preferences =
    suppliedPreferences ??
    createDestructionPreferences({
      window: win,
      ...(getStorage ? { getStorage } : {}),
      ...(writable ? { writable } : {}),
    });
  const root = doc.createElement('div');
  root.className = 'defeat-sound-controls';
  const label = doc.createElement('label');
  label.className = 'field';
  const title = doc.createElement('span');
  localizedText(title, () => huntText('defeatSounds'));
  const select = doc.createElement('select');
  select.id = `${prefix}defeat-sounds`;
  for (const [value, key] of [
    ['classic', 'classicSounds'],
    ['reactions', 'humanoidReactions'],
  ]) {
    const option = doc.createElement('option');
    option.value = value;
    localizedText(option, () => huntText(key));
    select.append(option);
  }
  label.append(title, select);
  const help = doc.createElement('p');
  help.id = `${prefix}defeat-sounds-help`;
  help.className = 'micro-note';
  localizedText(help, () => huntText('defeatSoundsHelp'));
  select.setAttribute('aria-describedby', help.id);
  const status = doc.createElement('p');
  status.className = 'micro-note';
  status.setAttribute('role', 'status');
  const retry = doc.createElement('button');
  retry.type = 'button';
  localizedText(retry, () => huntText('retry'));
  root.append(label, help, status, retry);
  container?.append(root);
  const unsubscribe = preferences.subscribe((choice) => {
    select.value = choice.vocals === false ? 'classic' : 'reactions';
    status.hidden = retry.hidden = choice.durable;
    localizedText(status, () => (choice.durable ? '' : huntText('saving')));
  });
  const choose = () => preferences.set({ vocals: select.value === 'reactions' });
  const save = () => preferences.retry();
  select.addEventListener('change', choose);
  retry.addEventListener('click', save);
  let disposed = false;
  return Object.freeze({
    element: root,
    snapshot: preferences.snapshot,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      select.removeEventListener('change', choose);
      retry.removeEventListener('click', save);
      if (!suppliedPreferences) preferences.dispose();
      root.remove();
    },
  });
}
