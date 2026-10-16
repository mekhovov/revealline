import { setLocale, translateDOM, t } from '../../../i18n/index.mjs';
import { setMenuIcon } from '../../../ui/native-menu-icons.mjs';
import { attachCreatorPlayerMenu } from '../../../creator/player-menu.mjs';
import { attachCreatorPlayerNavigation } from '../../../creator/player-navigation.mjs';
import { mountSupportInput } from '../../../ui/support-input.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../../../display-preferences.mjs';
import { measureMenuAccessibility } from './measure.mjs';

const { document: doc, location, navigator } = globalThis;
const params = new URL(location.href).searchParams;
const host = params.get('host') || 'creator';
const locale = params.get('lang') === 'uk' ? 'uk' : 'en';
const preferences = {
  textFace: params.get('face') === 'plain' ? 'plain' : 'pixel',
  textSize: params.get('size') === 'large' ? 'large' : 'standard',
  reducedEffects: true,
};
const fontResponses = [];
navigator.serviceWorker?.addEventListener('message', (event) => {
  if (event.data?.type === 'fixture-font-response') fontResponses.push(event.data);
});
setLocale(locale, { persist: false });
doc.documentElement.lang = locale;
doc.documentElement.dataset.buildVersion = 'TEST FIXTURE';
doc.body.dataset.textFace = preferences.textFace;
doc.body.dataset.textSize = preferences.textSize;
const memory = new Map([[DISPLAY_PREFERENCES_KEY, JSON.stringify(preferences)]]);
const fixtureWindow = new Proxy(globalThis.window, {
  get(target, key) {
    if (key === 'localStorage')
      return {
        getItem: (name) => memory.get(name) ?? null,
        setItem: (name, value) => memory.set(name, value),
        removeItem: (name) => memory.delete(name),
      };
    const value = Reflect.get(target, key);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});
const styles = [];
function stylesheet(href) {
  const link = doc.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  const ready = new Promise((resolve, reject) => {
    link.onload = resolve;
    link.onerror = () => reject(new Error(`Stylesheet failed: ${href}`));
  });
  doc.head.append(link);
  styles.push(ready);
}
async function sourceTemplate(path) {
  const url = new URL(path, location.href);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Template failed: ${response.status}`);
  const source = new globalThis.DOMParser().parseFromString(await response.text(), 'text/html');
  for (const link of source.querySelectorAll('link[rel="stylesheet"]'))
    stylesheet(new URL(link.getAttribute('href'), url).href);
  source.querySelectorAll('script').forEach((node) => node.remove());
  // Support preview belongs to its real session bridge, outside this style fixture.
  source.querySelectorAll('iframe').forEach((node) => node.removeAttribute('src'));
  for (const node of source.body.querySelectorAll('[src],[href]')) {
    for (const attribute of ['src', 'href'])
      if (node.hasAttribute(attribute))
        node.setAttribute(attribute, new URL(node.getAttribute(attribute), url).href);
  }
  doc.body.className = source.body.className;
  doc.body.replaceChildren(
    ...[...source.body.childNodes].map((node) => doc.importNode(node, true)),
  );
  translateDOM(doc);
}
let cleanup = () => {};
if (host === 'creator') {
  await sourceTemplate('../../../creator/player.html');
  const pack = {
    editionId: 'accessibility-fixture',
    manifest: {
      content: {
        compatibility: { modes: ['solo', 'versus'] },
        project: {
          missions: [
            {
              id: 'first',
              revision: '1',
              name:
                locale === 'uk'
                  ? 'Ґанок: їжак і єнот — початок подорожі'
                  : 'Courtyard — the first journey',
            },
            {
              id: 'second',
              revision: '1',
              name:
                locale === 'uk'
                  ? 'Наступна місія: перевірка читабельності'
                  : 'The next mission: readability check',
            },
          ],
          campaigns: [{ id: 'fixture', missionIds: ['first', 'second'] }],
        },
      },
    },
  };
  const state = {
    ready: true,
    busy: false,
    paused: true,
    ended: false,
    savedRaw: null,
    attempt: null,
    pack,
    missionId: 'first',
    missionOrder: ['first', 'second'],
  };
  doc.getElementById('title').removeAttribute('data-i18n');
  doc.getElementById('title').textContent = pack.manifest.content.project.missions[0].name;
  doc.getElementById('start').disabled = false;
  let navigation;
  const menu = attachCreatorPlayerMenu({
    document: doc,
    window: fixtureWindow,
    getState: () => state,
    onChooseMission: (id) => {
      state.missionId = id;
      menu.refresh();
    },
    onInputReset: () => navigation?.refresh(),
    navigate: () => {},
    createScene: () => ({ update() {}, dispose() {} }),
  });
  navigation = attachCreatorPlayerNavigation({
    document: doc,
    window: fixtureWindow,
    getScope: () => 'menu',
    getDefaultFocus: menu.primary,
    getRoot: menu.root,
    onBack: menu.back,
    readPads: () => [],
  });
  doc.getElementById('start').onclick = () => {
    doc.getElementById('status').textContent =
      'Fixture action only; no runtime or save is created.';
  };
  cleanup = () => {
    navigation.destroy();
    menu.destroy();
  };
} else if (host === 'support') {
  await sourceTemplate('../../../controller-lab/index.html');
  const owner = mountSupportInput({ document: doc, window: fixtureWindow, readPads: () => [] });
  cleanup = owner.destroy;
} else {
  const id = { solo: 'shell-home', versus: 'race-main', team: 'coop-menu' }[host] || 'shell-home';
  doc.body.className = 'field-kit';
  for (const css of ['field-kit-fonts', 'field-kit-tokens', 'field-kit-components', 'native-menu'])
    stylesheet(new URL(`../../../ui/${css}.css`, location.href).href);
  const root = doc.createElement('section');
  root.id = id;
  root.className = 'native-landing';
  root.innerHTML =
    '<h1 class="native-brand-fallback">FPV / LINE</h1><div class="game-mode-choice"></div><div class="native-menu-actions"></div>';
  for (const mode of ['solo', 'versus', 'team']) {
    const button = doc.createElement('button');
    button.textContent = t(`interface:nativeMenu.${mode}`);
    if (mode === host) button.setAttribute('aria-current', 'page');
    setMenuIcon(button, mode);
    root.querySelector('.game-mode-choice').append(button);
  }
  for (const [key, icon] of [
    ['start', 'play'],
    ['missions', 'missions'],
    ['settings', 'settings'],
  ]) {
    const button = doc.createElement('button');
    button.textContent =
      key === 'settings'
        ? t('common:navigation.settings')
        : key === 'start'
          ? t('interface:startMission')
          : t('interface:nativeMenu.missions');
    button.id = `fixture-${key}`;
    if (key === 'start') button.className = 'primary race-primary field-kit-primary';
    setMenuIcon(button, icon);
    root.querySelector('.native-menu-actions').append(button);
  }
  const disabled = root.querySelector('#fixture-start').cloneNode(true);
  disabled.id = 'fixture-disabled';
  disabled.disabled = true;
  root.querySelector('.native-menu-actions').append(disabled);
  doc.body.replaceChildren(root);
}
// Fixture links cannot navigate into real saves, previews, downloads or support services.
doc.addEventListener('click', (event) => {
  if (event.target.closest('a[href]')) event.preventDefault();
});
await Promise.all(styles);
await new Promise((resolve) =>
  globalThis.requestAnimationFrame(() => globalThis.requestAnimationFrame(resolve)),
);
function measure(stage = 'manual') {
  const report = {
    stage,
    surface: host,
    scope:
      'Production markup/styles/adapters with fixture data; not full runtime or physical controller qualification.',
    fontResponseMode: params.get('fonts') || 'normal',
    fontResponses: [...fontResponses],
    fontFaultQualification: !['delayed', 'blocked'].includes(params.get('fonts'))
      ? 'not requested'
      : fontResponses.length
        ? `${fontResponses.length} local font responses intercepted`
        : 'not qualified: no intercepted font response',
    workerControlled: !!navigator.serviceWorker?.controller,
    ...measureMenuAccessibility(doc),
  };
  doc.documentElement.dataset.accessibilityPassed = String(report.passed);
  let output = doc.getElementById('accessibility-report');
  if (!output) {
    output = doc.createElement('script');
    output.type = 'application/json';
    output.id = 'accessibility-report';
    doc.body.append(output);
  }
  output.textContent = JSON.stringify(report);
  globalThis.menuAccessibilityReport = report;
  globalThis.parent.postMessage({ type: 'menu-accessibility-report', report }, location.origin);
  return report;
}
measure('first rendered frame');
doc.fonts.ready.then(() => measure('font loading settled'));
globalThis.addEventListener('message', (event) => {
  if (
    event.source === globalThis.parent &&
    event.origin === location.origin &&
    event.data?.type === 'measure-accessibility'
  )
    measure();
});
globalThis
  .matchMedia('(forced-colors: active)')
  .addEventListener('change', () => measure('forced colors changed'));
globalThis.addEventListener('resize', () => measure('viewport changed'));
doc.addEventListener('focusin', () => measure('focus changed'));
globalThis.addEventListener('pagehide', cleanup, { once: true });
