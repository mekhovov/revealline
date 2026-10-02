import { attachSettingsPanels, settingsPanelBack } from '../../ui/settings-panels.mjs';
import { setMenuIcon } from '../../ui/native-menu-icons.mjs';
import { prepareNativeMenus } from '../../ui/native-menus.mjs';

const { document, location, DOMParser, fetch, HTMLDialogElement, requestAnimationFrame, window } =
  globalThis;

// Manual layout fixture only: production markup, stylesheet order and category
// navigation, without starting gameplay or changing its password/access policy.
const params = new URL(location.href).searchParams;
const mode = params.get('mode') || 'solo';
const host = {
  solo: ['../../index.html', 'settings-dialog'],
  versus: ['../../couch/index.html', 'race-options-panel'],
  team: ['../../couch/relay-rescue.html', 'coop-options'],
  sim: ['../../../optional-practice/civilian-fpv/index.html', 'help-dialog'],
  worlds: ['../../../optional-practice/fpv-worlds/index.html', 'sim-settings'],
}[mode];
if (!host) throw new Error('Choose solo, versus, team, sim or worlds.');
const surface = params.get('surface') || host[1];
const settings = surface === host[1] && ['solo', 'versus', 'team'].includes(mode);
const sourceURL = new URL(host[0], import.meta.url);
const source = new DOMParser().parseFromString(await (await fetch(sourceURL)).text(), 'text/html');
const styles = [...source.querySelectorAll('link[rel="stylesheet"]')].map((original) => {
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL(
    original.getAttribute('data-boot-href') || original.getAttribute('href'),
    sourceURL,
  );
  return new Promise((resolve, reject) => {
    link.onload = resolve;
    link.onerror = reject;
    document.head.append(link);
  });
});
await Promise.all(styles);
document.body.className = source.body.className;
if (['solo', 'versus', 'team'].includes(mode)) document.body.classList.add('field-kit');
if (mode === 'solo') document.body.classList.add('game-shell');
const presets = { portrait: [59, 0, 34, 0], landscape: [0, 59, 21, 59], plain: [0, 0, 0, 0] };
const insets = presets[params.get('insets')] || presets.plain;
['top', 'right', 'bottom', 'left'].forEach((side, i) =>
  document.documentElement.style.setProperty(`--safe-${side}`, `${insets[i]}px`),
);
let root;
if (surface === 'journey-chooser') {
  const { attachMissionLibraryChooser } = await import('../../ui/mission-library-chooser.mjs');
  // Exercise the real responsive header/filter/footer with an empty fixture
  // library. No game profile, download or mission launch is attached.
  const chooser = attachMissionLibraryChooser({
    library: {
      missions: [],
      forMode: () => [],
      find: () => null,
      search: () => [],
      subscribe: () => () => {},
    },
  });
  chooser.open();
  root = document.getElementById(surface);
} else if (surface === 'install-offline-dialog') {
  const { attachInstallOfflinePanel } = await import('../../ui/install-offline-panel.mjs');
  const panel = attachInstallOfflinePanel();
  panel.open();
  root = panel.root();
} else root = document.importNode(source.getElementById(surface), true);
if (settings) root.classList.add('native-settings');
if (surface === 'shell-missions') root.dataset.view = 'brief';
root.hidden = root.inert = false;
root.querySelector('[data-language-control]')?.remove();
const back =
  root.querySelector('#install-offline-close, #journey-back') ||
  root.querySelector(
    '.dialog-close, #race-options-back, #coop-settings-close, [data-close], header button, button',
  );
back.textContent = 'Back';
back.setAttribute('aria-label', 'Back');
setMenuIcon(back, 'back');
if (!root.isConnected) document.body.append(root);
const landingId = { solo: 'shell-home', versus: 'race-main', team: 'coop-menu' }[mode];
if (landingId && surface !== landingId) {
  const landing = document.importNode(source.getElementById(landingId), true);
  landing.hidden = true;
  document.body.append(landing);
}
if (settings) {
  prepareNativeMenus({ mode });
  attachSettingsPanels({ root });
}
const result = document.createElement('pre');
result.id = 'layout-result';
document.body.append(result);
const reopen = document.createElement('button');
reopen.textContent = 'Open surface';
document.body.append(reopen);
function open() {
  if (root instanceof HTMLDialogElement) {
    if (!root.open) root.showModal();
  } else root.hidden = false;
}
back.onclick = () => {
  if (settings && settingsPanelBack(root)) return;
  if (root instanceof HTMLDialogElement) root.close();
  else root.hidden = true;
};
reopen.onclick = open;
function measure() {
  const rect = (node) => {
    const { x, y, width, height } = node.getBoundingClientRect();
    return { x, y, width, height };
  };
  result.textContent = JSON.stringify(
    {
      mode,
      surface,
      insets,
      viewport: [window.innerWidth, window.innerHeight],
      frame: rect(root),
      back: rect(back),
      view: root.dataset.settingsView,
      frameScroll: [root.scrollHeight, root.clientHeight],
    },
    null,
    2,
  );
}
document.addEventListener('click', () => requestAnimationFrame(measure));
window.addEventListener('resize', () => requestAnimationFrame(measure));
open();
await Promise.all(
  [...document.querySelectorAll('link[rel="stylesheet"]')]
    .filter((link) => !link.sheet)
    .map(
      (link) => new Promise((resolve) => link.addEventListener('load', resolve, { once: true })),
    ),
);
await document.fonts.ready;
requestAnimationFrame(measure);
