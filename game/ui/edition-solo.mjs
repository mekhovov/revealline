import { localizedText } from '../i18n/index.mjs';
import { mountEditionNavigation } from './edition-navigation.mjs';
import { mountEditionLessons } from './edition-lessons.mjs';
import { mountEditionPlayLayout } from './edition-play-layout.mjs';
import {
  prepareEditionOffline,
  verifyEditionOffline,
  selectPreparedEdition,
} from '../editions/offline-client.mjs';

/** Optional chrome around the ordinary Solo host. No simulation or mission
 * progression methods are exposed to this presentation owner. */
export async function mountEditionSoloUI({
  provider,
  document: doc,
  window: win,
  writer,
  version,
  pause,
  getRun,
  getRecorder,
  getPictureVisible,
  report,
  onMissions,
  onEditionChange,
}) {
  const { selection, theme } = provider;
  mountEditionNavigation({ provider, document: doc, href: win.location.href });
  const node = (tag, text) => {
    const value = doc.createElement(tag);
    if (text !== undefined) value.textContent = text;
    return value;
  };
  const root = doc.documentElement;
  doc.body.dataset.brandId = selection.brand.id;
  doc.body.dataset.editionId = provider.editionId;
  for (const [key, value] of Object.entries(theme.palette))
    root.style.setProperty(`--brand-${key}`, value);
  if (selection.brand.fontAssetId && typeof win.FontFace === 'function') {
    const font = new win.FontFace(
      'Company Brand',
      `url("${provider.assetURL(selection.brand.fontAssetId)}")`,
    );
    doc.fonts.add(await font.load());
    root.style.setProperty('--brand-font', '"Company Brand", system-ui, sans-serif');
  }
  doc.title =
    selection.edition.name === selection.brand.name
      ? selection.edition.name
      : `${selection.edition.name} · ${selection.brand.name}`;
  const color = doc.querySelector('meta[name="theme-color"]');
  if (color) color.content = theme.palette.ink;
  for (const id of ['shell-title', 'landing-title'])
    if (doc.getElementById(id)) localizedText(doc.getElementById(id), () => selection.edition.name);
  for (const id of ['shell-title-edition', 'shell-edition'])
    if (doc.getElementById(id)) localizedText(doc.getElementById(id), () => selection.brand.name);
  const home = doc.getElementById('shell-home');
  if (selection.brand.heroAssetId) {
    const hero = node('img');
    hero.id = 'edition-home-art';
    hero.className = 'edition-home-art';
    hero.src = provider.assetURL(selection.brand.heroAssetId);
    hero.alt = '';
    home.prepend(hero);
  }
  if (selection.brand.logoAssetId)
    for (const mark of doc.querySelectorAll('.brand-mark')) {
      const logo = node('img');
      logo.className = 'edition-brand-logo';
      logo.src = provider.assetURL(selection.brand.logoAssetId);
      logo.alt = selection.brand.name;
      mark.replaceChildren(logo);
    }
  if (selection.brand.logoAssetId) {
    const logo = node('img');
    logo.className = 'edition-home-logo';
    logo.src = provider.assetURL(selection.brand.logoAssetId);
    logo.alt = selection.brand.name;
    (home.querySelector('.home-content') ?? home).prepend(logo);
  }
  const picker = node('label', 'Company & campaign edition'),
    select = node('select');
  picker.className = 'field edition-switcher';
  select.id = 'edition-select';
  for (const edition of provider.catalog.editions) {
    const option = node('option', edition.name);
    option.value = edition.id;
    select.append(option);
  }
  select.value = provider.editionId;
  select.disabled = provider.catalog.editions.length === 1;
  picker.append(select);
  (home.querySelector('.home-content') ?? home).append(picker);
  select.onchange = () => {
    const requested = select.value;
    // This remains the active edition until the shared host has retained the
    // attempt and the player explicitly leaves. Stay/cancel needs no rollback.
    select.value = provider.editionId;
    if (requested === provider.editionId) return false;
    return onEditionChange(requested, select);
  };
  const about = node('details'),
    aboutTitle = node('summary', 'About this edition & artwork');
  about.className = 'edition-about';
  about.append(
    aboutTitle,
    node('p', selection.brand.description),
    node(
      'p',
      'Optional learning uses fictional records. It does not connect to company accounts or award a professional qualification.',
    ),
  );
  for (const source of new Map(
    [
      ...(selection.brand.sources ?? []),
      ...provider.lessons.flatMap((lesson) => lesson.sources),
    ].map((item) => [item.url, item]),
  ).values()) {
    const link = node('a', source.title);
    link.href = source.url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    const p = node('p');
    p.append(link);
    about.append(p);
  }
  (home.querySelector('.home-content') ?? home).append(about);
  // Mode controls stay on the common template, but this delivery contains only
  // Solo. The mission library itself derives availability from selected sources.
  for (const id of [
    'shell-title-modes',
    'shell-mode-choice',
    'shell-team',
    'shell-versus',
    'shell-title-team',
    'shell-title-versus',
  ])
    if (doc.getElementById(id)) doc.getElementById(id).hidden = true;
  const actorStyle = doc.getElementById('menu-actor-style');
  if (actorStyle) {
    actorStyle.value = 'campaign';
    for (const option of actorStyle.options) option.disabled = option.value !== 'campaign';
  }
  if (doc.getElementById('menu-actor-note'))
    localizedText(
      doc.getElementById('menu-actor-note'),
      () =>
        'This edition uses its campaign artwork. Gameplay and enemy behavior follow the shared Solo rules.',
    );
  const worlds = doc.getElementById('shell-worlds');
  if (worlds) {
    worlds.hidden = false;
    worlds.onclick = () => {
      pause();
      onMissions(worlds);
    };
  }
  // Keep the ordinary Solo actions reachable in the brief/pause/result area.
  // Move their existing nodes so their confirmation state and host handlers
  // remain canonical, without crowding the full-viewport flight HUD.
  if (!doc.body.classList.contains('first-flight-session')) {
    const flightActions = doc.getElementById('game-overlay').querySelector('.overlay-actions');
    for (const id of ['journey-skip', 'demo-button']) {
      const action = doc.getElementById(id);
      action.classList.add('button', 'secondary');
      flightActions.append(action);
    }
  }
  const layout = mountEditionPlayLayout({ document: doc, window: win });
  const lessons = await mountEditionLessons({
    provider,
    document: doc,
    window: win,
    writer,
    getRun,
    getRecorder,
    getPictureVisible,
    report,
  });
  const legacy = node('section');
  try {
    const raw = (win.localStorage ?? globalThis.localStorage).getItem(provider.legacySessionKey);
    if (raw) {
      legacy.append(
        node('h3', 'Earlier preview save retained'),
        node(
          'p',
          'This edition now uses the full Solo game. Its earlier preview save uses different pinned rules and remains untouched. Export it for recovery with the matching earlier preview.',
        ),
      );
      const exportOld = node('button', 'Export earlier preview save');
      exportOld.type = 'button';
      exportOld.className = 'button secondary';
      exportOld.onclick = () => {
        const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }));
        const link = node('a');
        link.href = url;
        link.download = `${provider.editionId}-earlier-preview.json`;
        link.click();
        win.setTimeout(() => URL.revokeObjectURL(url), 1000);
      };
      legacy.append(exportOld);
      doc.getElementById('settings-panel-data').append(legacy);
    }
  } catch {
    report(
      'Earlier preview storage could not be read. Existing saved records have not been changed.',
    );
  }
  let disposed = false;
  const offline = node('section');
  offline.className = 'edition-offline';
  if (root.dataset.editionId && version !== 'DEV') {
    const prepare = node('button', 'Prepare this edition for offline play'),
      install = node('button', 'Use this edition in the installed app'),
      status = node('p');
    prepare.type = install.type = 'button';
    prepare.className = install.className = 'button secondary';
    install.disabled = true;
    status.setAttribute('role', 'status');
    prepare.onclick = async () => {
      pause();
      prepare.disabled = true;
      install.disabled = true;
      try {
        const checked = await prepareEditionOffline({
          editionId: provider.editionId,
          version,
          onStatus: (value) => {
            if (!disposed)
              status.textContent =
                value.status === 'downloading'
                  ? 'Downloading and checking this edition…'
                  : 'Verifying the saved files…';
          },
        });
        if (disposed) return;
        if (checked.status === 'waiting') {
          status.textContent =
            'Close this edition’s tabs and reopen it to activate the checked update.';
          return;
        }
        await verifyEditionOffline({ editionId: provider.editionId, version });
        if (disposed) return;
        status.textContent = 'This edition is verified for offline play.';
        install.disabled = false;
      } catch (error) {
        if (!disposed) status.textContent = error.message;
      } finally {
        if (!disposed) prepare.disabled = false;
      }
    };
    install.onclick = async () => {
      install.disabled = true;
      try {
        await selectPreparedEdition({ editionId: provider.editionId, version });
        if (!disposed)
          status.textContent =
            'The installed launcher will open this edition. Its previous release is retained.';
      } catch (error) {
        if (!disposed) status.textContent = error.message;
      } finally {
        if (!disposed) install.disabled = false;
      }
    };
    offline.append(prepare, install, status);
    doc.getElementById('settings-panel-data').append(offline);
  }
  return {
    refresh: lessons.refresh,
    pictureReady: lessons.pictureReady,
    dispose() {
      disposed = true;
      lessons.dispose();
      typeof layout === 'function' ? layout() : layout.disconnect?.();
      picker.remove();
      about.remove();
      offline.remove();
      legacy.remove();
    },
  };
}
