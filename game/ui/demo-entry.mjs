import { attachDemoHost } from './demo-host.mjs';
import { DEMO_SHELL } from './demo-shell.mjs';
import { DEFAULT_PREFERENCES } from '../library.mjs';
import { loadDemoSettingsKey, readDemoPreferences } from '../demo-settings.mjs';
import { readStoredTouchControls } from '../touch-preferences.mjs';
import { t, translateDOM } from '../i18n/index.mjs';
export { demoLaunchURL } from '../demo-launch.mjs';
export { resolveSimDemoLaunch } from '../demo-modes/sim.mjs';

/** Installs the same controls in a native mode without booting any other app.
 * The caller owns ordinary pause/departure and supplies its existing frame/input. */
export async function installDemoEntry({
  document: doc = globalThis.document,
  modeId,
  parent = doc.body,
  getContext = () => ({}),
  canOpen = () => !doc.hidden,
  canAutoStart = () => false,
  onEnter = () => {},
  onExit = () => {},
  onFreshStart = async () => false,
  clearInput = () => {},
  registerActions = () => {},
  ...options
}) {
  if (!doc.getElementById('demo-dialog')) {
    const template = doc.createElement('template');
    template.innerHTML = DEMO_SHELL;
    doc.body.append(template.content.cloneNode(true));
    const style = doc.createElement('link');
    style.rel = 'stylesheet';
    style.href = new URL('./demo.css', import.meta.url).href;
    doc.head.append(style);
    const settings = doc.createElement('div');
    settings.hidden = true;
    for (const id of ['demo-auto', 'demo-collect', 'demo-hide-pictures']) {
      const input = doc.createElement('input');
      input.id = id;
      input.type = 'checkbox';
      settings.append(input);
    }
    for (const id of ['demo-clear', 'demo-settings-status', 'demo-availability']) {
      const element = doc.createElement('span');
      element.id = id;
      settings.append(element);
    }
    doc.body.append(settings);
    translateDOM(doc.getElementById('demo-dialog'));
  }
  const actions = [];
  for (const [id, key] of [
    ['demo-button', 'demo:watch'],
    ['demo-all-button', 'demo:watchAll'],
  ]) {
    if (doc.getElementById(id)) continue;
    const button = doc.createElement('button');
    button.id = id;
    button.type = 'button';
    button.className = 'button secondary';
    button.dataset.i18n = key;
    button.textContent = t(key);
    parent.append(button);
    translateDOM(button);
    actions.push(button);
  }
  registerActions(actions);
  const settingsKey = options.settingsKey ?? (await loadDemoSettingsKey({ document: doc }));
  let preferences = DEFAULT_PREFERENCES,
    touchSettings = preferences.touchControls;
  return attachDemoHost({
    ...options,
    document: doc,
    modeId,
    canOpen,
    canAutoStart,
    onEnter() {
      // A native page can watch any mode. Honor the current edition's saved
      // shared controls, while native adapters retain their own input mapping.
      let storage;
      try {
        storage = options.storage ?? doc.defaultView?.localStorage;
      } catch {
        // Private/blocked storage uses the same safe defaults as ordinary Solo.
      }
      preferences = readDemoPreferences(storage, settingsKey);
      touchSettings = readStoredTouchControls(storage) ?? preferences.touchControls;
      onEnter();
    },
    onExit,
    onFreshStart,
    clearInput,
    getContext: () => ({
      preferences,
      touchSettings,
      tapSteering: preferences.tapSteering,
      library: {},
      entries: [],
      reduced: doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true,
      ...getContext(),
    }),
    loadSources: options.loadSources,
    readMedia: options.readMedia ?? (async () => null),
    settingsKey,
    canWrite: options.canWrite ?? (() => true),
  });
}
