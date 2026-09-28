import { t, localizedText, localizedAttribute, onLocaleChange } from '../i18n/index.mjs';
import {
  fetchOnlineSoundtrackCatalogue,
  onlineSoundtrackRecordingAllowed,
} from '../online-soundtrack-catalogue.mjs';
import {
  ONLINE_SOUNDTRACK_STYLE_CHOICES,
  onlineSoundtrackMatchesStyles,
  soundtrackGenresForOnlineStyles,
} from '../online-soundtrack-styles.mjs';
import { SOUNDTRACK_GENRES } from '../soundtrack.mjs';
import { soundtrackErrorText } from './soundtrack-error-copy.mjs';

export const SOUNDTRACK_SETTINGS_KEY = 'revealline.audio-player.v1';

const STYLE_IDS = Object.freeze(ONLINE_SOUNDTRACK_STYLE_CHOICES.map(([id]) => id));
const DEFAULT_PREFERENCES = Object.freeze({
  local: true,
  archive: false,
  styles: STYLE_IDS,
  order: 'shuffle',
});

function readPreferences(storage) {
  try {
    const source = storage?.getItem(SOUNDTRACK_SETTINGS_KEY);
    if (!source || source.length > 4096) return DEFAULT_PREFERENCES;
    const value = JSON.parse(source);
    if (
      !value ||
      typeof value.local !== 'boolean' ||
      typeof value.archive !== 'boolean' ||
      !Array.isArray(value.styles) ||
      value.styles.length > STYLE_IDS.length ||
      new Set(value.styles).size !== value.styles.length ||
      !value.styles.every((style) => STYLE_IDS.includes(style)) ||
      !['ordered', 'shuffle'].includes(value.order)
    )
      return DEFAULT_PREFERENCES;
    return Object.freeze({
      local: value.local,
      archive: value.archive,
      styles: Object.freeze([...value.styles]),
      order: value.order,
    });
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function sourceURL(track) {
  for (const value of [
    ...(track?.websites ?? []).map((website) => website.url),
    track?.rights?.source,
  ]) {
    try {
      const url = new URL(value);
      if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url;
    } catch {
      // An unsafe or malformed source is displayed as unavailable.
    }
  }
  return null;
}

function localListening(styles, current = {}) {
  const genres = soundtrackGenresForOnlineStyles(styles);
  return {
    mode:
      styles.size === 1 && styles.has('fusion')
        ? 'fusion'
        : genres.length === SOUNDTRACK_GENRES.length
          ? 'mix'
          : 'mix',
    genres: genres.length ? genres : [...SOUNDTRACK_GENRES],
    installedOnly: current.installedOnly === true,
    recordingMode: current.recordingMode === true,
  };
}

/** Compact main-settings view over the existing soundtrack owner. */
export function attachSoundtrackSettingsPlayer({
  document: doc = globalThis.document,
  root,
  player,
  getLibrary = () => null,
  getMaster = () => ({ muted: false, volume: 1 }),
  activate = () => player.play(),
  beforeSelection = () => player.wake?.(),
  openLibrary = () => {},
  fetchCatalogue = fetchOnlineSoundtrackCatalogue,
  getStorage = () => globalThis.localStorage,
  onError = () => {},
} = {}) {
  if (!doc || !root || !player?.snapshot || !player?.playRemotePlaylist)
    throw new TypeError('Soundtrack settings player needs a document, root and soundtrack player.');

  let disposed = false,
    catalogue = null,
    cataloguePromise = null,
    catalogueController = null,
    message = '',
    error = '',
    operation = 0;
  const preferences = readPreferences(getStorage());
  const section = doc.createElement('section');
  section.className = 'settings-music-player';
  section.setAttribute('aria-labelledby', 'settings-music-player-heading');

  const heading = doc.createElement('h4');
  heading.id = 'settings-music-player-heading';
  const now = doc.createElement('p');
  now.id = 'settings-music-now';
  now.className = 'settings-music-now';
  now.setAttribute('role', 'status');
  now.setAttribute('aria-live', 'polite');
  const source = doc.createElement('a');
  source.id = 'settings-music-source';
  source.className = 'settings-music-source';
  source.target = '_blank';
  source.rel = 'noopener noreferrer';

  const transport = doc.createElement('div');
  transport.className = 'settings-music-transport';
  transport.setAttribute('role', 'group');
  const previous = doc.createElement('button');
  previous.id = 'settings-music-previous';
  previous.type = 'button';
  previous.className = 'button secondary';
  const toggle = doc.createElement('button');
  toggle.id = 'settings-music-toggle';
  toggle.type = 'button';
  toggle.className = 'button secondary';
  const next = doc.createElement('button');
  next.id = 'settings-music-next';
  next.type = 'button';
  next.className = 'button secondary';
  transport.append(previous, toggle, next);

  const sources = doc.createElement('fieldset');
  sources.className = 'settings-music-sources';
  const sourcesLegend = doc.createElement('legend');
  sources.append(sourcesLegend);
  const localInput = doc.createElement('input');
  localInput.id = 'settings-music-local';
  localInput.type = 'checkbox';
  localInput.checked = preferences.local;
  const localChoice = doc.createElement('label');
  localChoice.setAttribute('for', localInput.id);
  const localText = doc.createElement('span');
  localChoice.append(localInput, localText);
  const archiveInput = doc.createElement('input');
  archiveInput.id = 'settings-music-archive';
  archiveInput.type = 'checkbox';
  archiveInput.checked = preferences.archive;
  const archiveChoice = doc.createElement('label');
  archiveChoice.setAttribute('for', archiveInput.id);
  const archiveText = doc.createElement('span');
  archiveChoice.append(archiveInput, archiveText);
  sources.append(localChoice, archiveChoice);

  const styles = doc.createElement('fieldset');
  styles.className = 'settings-music-styles';
  const stylesLegend = doc.createElement('legend');
  styles.append(stylesLegend);
  const styleInputs = new Map();
  for (const [id, label] of ONLINE_SOUNDTRACK_STYLE_CHOICES) {
    const input = doc.createElement('input');
    input.id = `settings-music-style-${id}`;
    input.type = 'checkbox';
    input.checked = preferences.styles.includes(id);
    const choice = doc.createElement('label');
    choice.setAttribute('for', input.id);
    const text = doc.createElement('span');
    localizedText(text, () => label);
    choice.append(input, text);
    styles.append(choice);
    styleInputs.set(id, input);
  }
  const styleActions = doc.createElement('div');
  styleActions.className = 'settings-music-style-actions';
  const allStyles = doc.createElement('button');
  allStyles.id = 'settings-music-styles-all';
  allStyles.type = 'button';
  allStyles.className = 'button secondary';
  const clearStyles = doc.createElement('button');
  clearStyles.id = 'settings-music-styles-clear';
  clearStyles.type = 'button';
  clearStyles.className = 'button secondary';
  styleActions.append(allStyles, clearStyles);
  styles.append(styleActions);

  const selection = doc.createElement('div');
  selection.className = 'settings-music-selection';
  const orderLabel = doc.createElement('label');
  const orderText = doc.createElement('span');
  const order = doc.createElement('select');
  order.id = 'settings-music-order';
  for (const value of ['shuffle', 'ordered']) {
    const option = doc.createElement('option');
    option.value = value;
    order.append(option);
  }
  order.value = preferences.order;
  orderLabel.append(orderText, order);
  const playSelection = doc.createElement('button');
  playSelection.id = 'settings-music-play-selection';
  playSelection.type = 'button';
  playSelection.className = 'button primary';
  selection.append(orderLabel, playSelection);

  const status = doc.createElement('p');
  status.id = 'settings-music-status';
  status.className = 'micro-note settings-music-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const advanced = doc.createElement('button');
  advanced.id = 'settings-music-advanced';
  advanced.type = 'button';
  advanced.className = 'button secondary settings-music-advanced';

  section.append(heading, now, source, transport, sources, styles, selection, status, advanced);
  root.append(section);

  function selectedStyles() {
    return new Set([...styleInputs].filter(([, input]) => input.checked).map(([style]) => style));
  }

  function savePreferences() {
    try {
      getStorage()?.setItem(
        SOUNDTRACK_SETTINGS_KEY,
        JSON.stringify({
          local: localInput.checked,
          archive: archiveInput.checked,
          styles: [...selectedStyles()],
          order: order.value,
        }),
      );
    } catch {
      message = t('interface:audioPlayer.savedForSession');
    }
  }

  function archiveMatches() {
    const selected = selectedStyles();
    return (catalogue?.tracks ?? []).filter(
      (track) =>
        onlineSoundtrackMatchesStyles(track, selected) &&
        (!getLibrary()?.listening?.recordingMode || onlineSoundtrackRecordingAllowed(track)),
    );
  }

  function render(snapshot = player.snapshot()) {
    if (disposed) return;
    const master = getMaster() ?? {},
      muted = master.muted || master.volume === 0 || snapshot?.volume === 0,
      track = snapshot?.track,
      title = track?.title ?? t('interface:noTrackSelected'),
      artist = track?.artist ? ` · ${track.artist}` : '',
      statusText = !track
        ? t('interface:audioPlayer.ready')
        : muted
          ? t('interface:quickMusic.muted')
          : snapshot?.status === 'loading'
            ? t('interface:quickMusic.loading')
            : snapshot?.playing
              ? t('interface:quickMusic.playing')
              : t('interface:quickMusic.paused');
    localizedText(heading, () => t('interface:audioPlayer.heading'));
    localizedText(now, () => `${title}${artist} · ${statusText}`);
    const url = sourceURL(track);
    source.hidden = !url;
    if (url) source.setAttribute('href', url.href);
    else source.removeAttribute('href');
    localizedText(source, () => t('interface:audioPlayer.creatorSource'));
    localizedAttribute(transport, 'aria-label', () => t('interface:audioPlayer.transport'));
    localizedText(previous, () => t('interface:quickMusic.previous'));
    localizedText(toggle, () =>
      snapshot?.desired && !['blocked', 'error', 'ended'].includes(snapshot.status)
        ? t('interface:quickMusic.pause')
        : t('interface:quickMusic.play'),
    );
    localizedText(next, () => t('interface:quickMusic.next'));
    previous.disabled = next.disabled = !snapshot?.queue?.length;
    toggle.disabled = !snapshot;
    localizedText(sourcesLegend, () => t('interface:audioPlayer.playFrom'));
    localizedText(localText, () => t('interface:audioPlayer.gameAndUploads'));
    localizedText(archiveText, () => t('interface:audioPlayer.publicArchive'));
    localizedText(stylesLegend, () => t('interface:musicStylesChooseAnyMix'));
    localizedText(allStyles, () => t('interface:allStyles'));
    localizedText(clearStyles, () => t('interface:clear'));
    localizedText(orderText, () => t('interface:order'));
    localizedText(order.options[0], () => t('interface:shuffle'));
    localizedText(order.options[1], () => t('interface:oneAfterAnother'));
    localizedText(playSelection, () => t('interface:audioPlayer.playSelection'));
    localizedText(advanced, () => t('interface:audioPlayer.browseAdvanced'));

    const hasSource = localInput.checked || archiveInput.checked,
      hasStyle = selectedStyles().size > 0,
      archiveLoading = archiveInput.checked && cataloguePromise !== null && !catalogue;
    playSelection.disabled = !hasSource || !hasStyle || (archiveLoading && !localInput.checked);
    const archiveSummary =
      archiveInput.checked && catalogue
        ? t('interface:audioPlayer.archiveMatches', {
            count: archiveMatches().length,
            total: catalogue.tracks.length,
          })
        : archiveLoading
          ? t('interface:audioPlayer.loadingArchive')
          : '';
    localizedText(
      status,
      () =>
        error ||
        message ||
        (!hasSource
          ? t('interface:audioPlayer.chooseSource')
          : !hasStyle
            ? t('interface:audioPlayer.chooseStyle')
            : archiveSummary || t('interface:audioPlayer.changesApply')),
    );
  }

  async function ensureCatalogue() {
    if (catalogue) return catalogue;
    if (cataloguePromise) return cataloguePromise;
    const controller = new AbortController();
    catalogueController = controller;
    error = '';
    message = '';
    const token = ++operation;
    cataloguePromise = Promise.resolve(fetchCatalogue({ signal: controller.signal }))
      .then((value) => {
        if (!disposed && token === operation) catalogue = value;
        return value;
      })
      .catch((reason) => {
        if (!disposed && token === operation && reason?.name !== 'AbortError') {
          error = soundtrackErrorText(reason);
          onError(reason);
        }
        throw reason;
      })
      .finally(() => {
        if (!disposed && token === operation) {
          cataloguePromise = null;
          catalogueController = null;
          render();
        }
      });
    render();
    return cataloguePromise;
  }

  function preferenceChanged() {
    error = '';
    message = '';
    savePreferences();
    if (archiveInput.checked) void ensureCatalogue().catch(() => {});
    render();
  }

  async function run(action) {
    const token = ++operation;
    error = '';
    message = '';
    try {
      const result = await action();
      if (!disposed && token === operation) render();
      return result;
    } catch (reason) {
      if (!disposed && token === operation) {
        error = soundtrackErrorText(reason);
        onError(reason);
        render();
      }
      return false;
    }
  }

  previous.onclick = () => run(() => player.previous());
  toggle.onclick = () =>
    run(() =>
      player.snapshot().desired && !['blocked', 'error', 'ended'].includes(player.snapshot().status)
        ? player.pause()
        : activate(),
    );
  next.onclick = () => run(() => player.next());
  advanced.onclick = () => openLibrary();
  localInput.onchange = preferenceChanged;
  archiveInput.onchange = preferenceChanged;
  order.onchange = preferenceChanged;
  for (const input of styleInputs.values()) input.onchange = preferenceChanged;
  allStyles.onclick = () => {
    for (const input of styleInputs.values()) input.checked = true;
    preferenceChanged();
  };
  clearStyles.onclick = () => {
    for (const input of styleInputs.values()) input.checked = false;
    preferenceChanged();
  };
  playSelection.onclick = () => {
    const selected = selectedStyles(),
      includeLocal = localInput.checked,
      includeArchive = archiveInput.checked;
    if (!selected.size || (!includeLocal && !includeArchive)) return;
    beforeSelection();
    return run(async () => {
      if (includeLocal) {
        await player.selectListening(localListening(selected, getLibrary()?.listening));
      }
      if (includeArchive) {
        const currentCatalogue = catalogue ?? (await ensureCatalogue()),
          matches = currentCatalogue.tracks.filter(
            (track) =>
              onlineSoundtrackMatchesStyles(track, selected) &&
              (!getLibrary()?.listening?.recordingMode || onlineSoundtrackRecordingAllowed(track)),
          );
        if (!matches.length) {
          if (includeLocal) {
            message = t('interface:audioPlayer.noArchiveMatchesLocal');
            return true;
          }
          throw new Error(t('interface:audioPlayer.noArchiveMatches'));
        }
        return player.playRemotePlaylist(matches, {
          order: order.value,
          repeat: 'all',
          mixWithLibrary: includeLocal,
        });
      }
      return true;
    });
  };

  const stopLocale = onLocaleChange(() => render());
  if (archiveInput.checked) void ensureCatalogue().catch(() => {});
  render();
  return Object.freeze({
    element: section,
    update: render,
    refreshArchive() {
      catalogueController?.abort();
      catalogueController = null;
      cataloguePromise = null;
      catalogue = null;
      error = '';
      if (archiveInput.checked) void ensureCatalogue().catch(() => {});
      else render();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      operation++;
      catalogueController?.abort();
      stopLocale();
      section.remove();
    },
  });
}
