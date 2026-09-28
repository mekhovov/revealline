import { localizedText, t } from '../i18n/index.mjs';
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
  getSavedPresentation = () => null,
  onPresentationChange,
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
  const picker = node('label'),
    pickerLabel = node('span'),
    select = node('select');
  localizedText(pickerLabel, () => t('interface:editionSolo.switcherLabel'));
  picker.className = 'field edition-switcher';
  select.id = 'edition-select';
  const availableEditions = (provider.currentCatalog ?? provider.catalog).editions;
  for (const edition of availableEditions) {
    const option = node('option', edition.name);
    option.value = edition.id;
    select.append(option);
  }
  select.value = provider.editionId;
  select.disabled = availableEditions.length === 1;
  picker.append(pickerLabel, select);
  (home.querySelector('.home-content') ?? home).append(picker);
  select.onchange = () => {
    const requested = select.value;
    // This remains the active edition until the shared host has retained the
    // attempt and the player explicitly leaves. Stay/cancel needs no rollback.
    select.value = provider.editionId;
    if (requested === provider.editionId) return false;
    return onEditionChange(requested, select);
  };
  if (provider.presentationHistory?.length) {
    const retained = node('details'),
      title = node('summary'),
      choice = node('select'),
      label = node('label'),
      labelText = node('span');
    localizedText(title, () => t('interface:editionSolo.originalArtworkRecovery'));
    localizedText(labelText, () => t('interface:editionSolo.artworkSnapshot'));
    retained.className = 'edition-about';
    choice.id = 'edition-presentation-select';
    const current = node('option');
    localizedText(current, () => t('interface:soloDeparture.currentArtwork'));
    current.value = '';
    choice.append(current);
    for (const record of provider.presentationHistory) {
      const option = node('option');
      localizedText(option, () =>
        t('interface:editionSolo.retainedOriginal', { id: record.id.slice(0, 12) }),
      );
      option.value = record.id;
      choice.append(option);
    }
    choice.value = provider.retainedPresentationId ?? '';
    choice.onchange = () => {
      const requested = choice.value || null;
      choice.value = provider.retainedPresentationId ?? '';
      return onPresentationChange(requested, choice);
    };
    label.append(labelText, choice);
    const recoveryExplanation = node('p');
    localizedText(recoveryExplanation, () => t('interface:editionSolo.recoveryExplanation'));
    retained.append(title, recoveryExplanation, label);
    const saved = getSavedPresentation();
    if (
      saved !== provider.authoredPresentationSha256 &&
      provider.presentationHistory.some((item) => item.id === saved)
    ) {
      const recover = node('button');
      localizedText(recover, () => t('interface:editionSolo.openSavedArtwork'));
      recover.type = 'button';
      recover.id = 'edition-recover-presentation';
      recover.className = 'button secondary';
      recover.onclick = () => onPresentationChange(saved, recover);
      retained.append(recover);
      retained.open = true;
    }
    if (provider.retainedPresentationId) {
      const retainedNotice = node('p');
      localizedText(retainedNotice, () =>
        t('interface:editionSolo.retainedNotice', {
          id: provider.retainedPresentationId.slice(0, 12),
        }),
      );
      retained.append(retainedNotice);
    }
    (home.querySelector('.home-content') ?? home).append(retained);
  }
  const about = node('details'),
    aboutTitle = node('summary'),
    learningDisclaimer = node('p');
  localizedText(aboutTitle, () => t('interface:editionSolo.about'));
  localizedText(learningDisclaimer, () => t('interface:editionSolo.learningDisclaimer'));
  about.className = 'edition-about';
  about.append(aboutTitle, node('p', selection.brand.description), learningDisclaimer);
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
    localizedText(doc.getElementById('menu-actor-note'), () =>
      t('interface:editionSolo.campaignArtworkNote'),
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
      const legacyHeading = node('h3'),
        legacyExplanation = node('p');
      localizedText(legacyHeading, () => t('interface:editionSolo.legacyHeading'));
      localizedText(legacyExplanation, () => t('interface:editionSolo.legacyExplanation'));
      legacy.append(legacyHeading, legacyExplanation);
      const exportOld = node('button');
      localizedText(exportOld, () => t('interface:editionSolo.exportLegacy'));
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
    report(t('errors:editionSolo.legacyStorageUnreadable'));
  }
  let disposed = false;
  const offline = node('section');
  offline.className = 'edition-offline';
  if (root.dataset.editionId && version !== 'DEV') {
    const prepare = node('button'),
      install = node('button'),
      status = node('p');
    localizedText(prepare, () => t('interface:editionSolo.prepareOffline'));
    localizedText(install, () => t('interface:downloads.useEdition'));
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
              localizedText(status, () =>
                value.status === 'downloading'
                  ? t('interface:editionSolo.downloading')
                  : t('interface:editionSolo.verifying'),
              );
          },
        });
        if (disposed) return;
        if (checked.status === 'waiting') {
          localizedText(status, () => t('interface:editionSolo.activateCheckedUpdate'));
          return;
        }
        await verifyEditionOffline({ editionId: provider.editionId, version });
        if (disposed) return;
        localizedText(status, () => t('interface:editionSolo.offlineVerified'));
        install.disabled = false;
      } catch (error) {
        if (!disposed) localizedText(status, error.message);
      } finally {
        if (!disposed) prepare.disabled = false;
      }
    };
    install.onclick = async () => {
      install.disabled = true;
      try {
        await selectPreparedEdition({ editionId: provider.editionId, version });
        if (!disposed) localizedText(status, () => t('interface:downloads.activationReady'));
      } catch (error) {
        if (!disposed) localizedText(status, error.message);
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
