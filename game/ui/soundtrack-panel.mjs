import { contentText } from '../i18n/content.mjs';
import { t, localizedText, localizedAttribute, localizedMessage } from '../i18n/index.mjs';
import { soundtrackDownloadVolumes } from '../soundtrack-download-volumes.mjs';
import {
  createOfficialDownloads,
  localOfficialRecordingIds,
  withOptionalMusicDownload,
} from '../official-downloads.mjs';
import { createOperationStatus } from './operation-status.mjs';
import { bindAudioMasterMedia } from './audio-master.mjs';
import {
  BUILTIN_SOUNDTRACK_PLAYLISTS,
  BUILTIN_SOUNDTRACK_TRACKS,
  SOUNDTRACK_LIMITS,
  SOUNDTRACK_GENRES,
  emptySoundtrackLibrary,
  resolveSoundtrackLibrary,
  resolveSoundtrackCatalogue,
  upgradeSoundtrackLibrary,
  setCatalogueTracks,
  soundtrackTracks,
  soundtrackPlaylists,
  soundtrackAlbumPlaylists,
  soundtrackStoredTracks,
  soundtrackOffloadedBonusTrackIds,
  soundtrackRights,
} from '../soundtrack.mjs';
import { soundtrackPortableRecoveryPlan } from '../soundtrack-portable.mjs';
import { inspectMP3, prepareMP3Import, probeMP3Media, throwIfSoundtrackAborted } from '../mp3.mjs';
import { preparePrivateSoundtrackCollection } from '../soundtrack-private-intake.mjs';
import {
  exportSoundtrackBundle,
  importSoundtrackBundle,
  prepareSoundtrackLibrary,
} from '../soundtrack-bundle.mjs';
import {
  mergeSoundtrackAlbum,
  offloadSoundtrackAlbum,
  restoreSoundtrackAlbum,
} from '../soundtrack-albums.mjs';
import { mergeSoundtrackShare, soundtrackPlaylistShare } from '../soundtrack-share.mjs';
import {
  fetchSoundtrackAlbum,
  fetchSoundtrackAlbumCatalog,
} from '../soundtrack-album-download.mjs';
import {
  fetchOnlineSoundtrackCatalogue,
  onlineSoundtrackRecordingAllowed,
} from '../online-soundtrack-catalogue.mjs';

const copy = (value) => structuredClone(value);
const message = (error) => error?.message || String(error);
const seconds = (value = 0) =>
  `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
const bytes = (value) => `${(value / 1024 / 1024).toFixed(1)} MiB`;
const ONLINE_STYLE_CHOICES = Object.freeze([
  ['synth', localizedMessage('interface:synthElectronic')],
  ['metal', localizedMessage('interface:metal')],
  ['ukrainian', localizedMessage('interface:ukrainian')],
  ['chiptune', localizedMessage('interface:chiptune8Bit')],
  ['rock', localizedMessage('interface:rock')],
  ['ambient', localizedMessage('interface:ambient')],
  ['fusion', localizedMessage('interface:fusion')],
  ['other', localizedMessage('interface:otherStyles')],
]);

/** Local music authoring. Draft changes become authoritative only after one verified store commit. */
export function attachSoundtrackPanel({
  document: doc = globalThis.document,
  store,
  player,
  onLibrary = () => {},
  adoptLibrary = null,
  musicSession = null,
  onError = () => {},
  getContext = () => ({}),
  otherManagedBytes = () => 0,
  probeMedia = probeMP3Media,
  URLImpl = globalThis.URL,
  makeId = (kind) => `${kind}.${globalThis.crypto.randomUUID()}`,
  download,
  onOpen = () => {},
  onClose = () => {},
  canRestoreFocus = () => true,
  onVolume = () => {},
  onPlayback = () => {},
  onAudioEnabled = () => {},
  audioMaster = null,
  onMasterMuted = null,
  onMasterVolume = null,
  beforeAudio = async () => {},
  albumDownload = {},
  onlineCatalogueDownload = {},
  catalogue = null,
  readAsset,
} = {}) {
  if (!doc?.body || !store?.read || !store?.commit || !player?.snapshot)
    throw new Error(t('interface:soundtrackPanelRequiresADocumentStoreAndPlayer'));
  if (adoptLibrary !== null && typeof adoptLibrary !== 'function')
    throw new TypeError(t('errors:soundtrack.adoptLibraryFunction'));
  if (
    musicSession &&
    (typeof musicSession.play !== 'function' || typeof musicSession.pause !== 'function')
  )
    throw new TypeError(t('interface:soundtrackMusicSessionRequiresPlayAndPauseControls'));
  catalogue = catalogue ? resolveSoundtrackCatalogue(catalogue) : null;
  const bindings = [];
  const adopt = (library) =>
    catalogue ? setCatalogueTracks(upgradeSoundtrackLibrary(library), catalogue.tracks) : library;
  let disposed = false,
    busy = false,
    controller = null,
    saved = null,
    preparedBackup = null;
  let draft = adopt(emptySoundtrackLibrary()),
    assets = [],
    dirty = false,
    returnFocus = null;
  let privateCollectionPlaylistId = null;
  let auditionURL = null,
    auditionToken = 0,
    auditionController = null,
    restoreMusic = false;
  let albumCatalog = null,
    albumEditors = null,
    albumGeneration = 0;
  let onlineCatalogue = null,
    onlineCatalogueController = null,
    onlineCatalogueGeneration = 0;
  const albumControls = new Map();
  const node = (tag, id, text, attrs = {}) => {
    const element = doc.createElement(tag);
    if (id) {
      element.id = `soundtrack-${id}`;
    }
    if (text !== undefined && text !== null) localizedText(element, () => text);
    for (const [key, value] of Object.entries(attrs)) {
      if (['aria-label', 'title', 'placeholder', 'alt'].includes(key))
        localizedAttribute(element, key, value);
      else element.setAttribute(key, value);
    }
    return element;
  };
  const listen = (element, type, handler) => {
    element.addEventListener(type, handler);
    bindings.push(() => element.removeEventListener(type, handler));
  };
  const button = (id, label, handler) => {
    const element = node('button', id, label, { type: 'button', class: 'button secondary' });
    element.onclick = handler;
    return element;
  };
  const input = (id, label, { tag = 'input', ...attrs } = {}) => {
    const field = node('label', null, null, { class: 'soundtrack-field' });
    const element = node(tag, id, null, attrs);
    field.append(node('span', null, label), element);
    return { field, element };
  };
  const options = (select, entries, preferred = select.value) => {
    select.replaceChildren(
      ...entries.map(([value, label]) => {
        const option = node('option', null, label);
        option.value = value;
        return option;
      }),
    );
    select.value = entries.some(([value]) => value === preferred)
      ? preferred
      : (entries[0]?.[0] ?? '');
  };
  const row = (...children) => {
    const element = node('div', null, null, { class: 'soundtrack-actions' });
    element.append(...children);
    return element;
  };
  const section = (title, ...children) => {
    const element = node('section', null, null, { class: 'soundtrack-section' });
    element.append(node('h3', null, title), ...children);
    return element;
  };
  const advancedSection = (id, title, description, ...children) => {
    const element = node('section', `advanced-${id}`, null, { class: 'soundtrack-advanced' });
    const toggle = node('button', `advanced-${id}-toggle`, null, {
      type: 'button',
      class: 'soundtrack-advanced-summary',
      'aria-expanded': 'false',
      'aria-controls': `soundtrack-advanced-${id}-body`,
    });
    toggle.append(
      node('span', null, title, { class: 'soundtrack-advanced-title' }),
      node('span', null, description, { class: 'soundtrack-advanced-description' }),
    );
    const body = node('div', `advanced-${id}-body`, null, { class: 'soundtrack-advanced-body' });
    body.hidden = true;
    body.append(...children);
    toggle.onclick = () => {
      const open = toggle.getAttribute('aria-expanded') !== 'true';
      toggle.setAttribute('aria-expanded', String(open));
      body.hidden = !open;
      if (open) element.setAttribute('data-open', 'true');
      else element.removeAttribute('data-open');
    };
    element.append(toggle, body);
    return element;
  };
  const dialog = node('dialog', 'dialog', null, {
    class: 'soundtrack-dialog',
    'aria-labelledby': 'soundtrack-title',
  });
  const heading = node('h2', 'title', localizedMessage('interface:musicPlayer'));
  const status = node(
    'p',
    'status',
    localizedMessage('interface:openTheStudioToLoadYourLocalMusic'),
    {
      role: 'status',
      'aria-live': 'polite',
    },
  );

  const initialStatus = status.textContent;
  const feedback = createOperationStatus(status);
  let activity = null;
  function setStatus(message, state = 'ready') {
    if (activity) activity.update({ message, progress: null });
    else feedback.begin({ message }).finish({ message, state });
  }
  setStatus(initialStatus);
  const availability = node(
    'p',
    'availability',
    localizedMessage('interface:customMusicStaysInThisBrowserExportARlsoundFile'),
    { class: 'micro-note' },
  );
  const closeButton = button('close', localizedMessage('interface:closeStudio'), () => close());
  const cancelButton = button('cancel', localizedMessage('interface:cancelOperation'), () => {
    controller?.abort();
    setStatus(t('interface:cancellationRequested'));
  });
  cancelButton.hidden = true;
  const saveButton = button('save', localizedMessage('interface:saveAllChanges'), () =>
    task(t('interface:verifyingAndSavingTheMusicLibrary'), (signal) => commitDraft(signal)),
  );
  const undoButton = button('undo', localizedMessage('interface:undoUnsavedChanges'), () => {
    if (!saved || busy) return;
    invalidateBackup();
    draft = adopt(saved.library);
    assets = [...saved.assets];
    dirty = false;
    privateCollectionPlaylistId = null;
    collectionSummary.textContent = '';
    render();
    setStatus(t('interface:restoredTheSavedLibraryPlaybackIsUnchanged'));
  });
  const reloadButton = button('reload', localizedMessage('interface:reloadLatestSaved'), () =>
    reload(),
  );
  const stateLine = node('p', 'draft-state', '', { class: 'micro-note' });
  const now = node('p', 'now', localizedMessage('interface:musicIsReady'), {
    role: 'status',
    'aria-live': 'off',
  });
  const nowSources = node('div', 'now-sources');
  const transportStatus = node('p', 'loading');
  const transportFeedback = createOperationStatus(transportStatus);
  let transportActivity = null,
    auditionActivity = null;
  const seek = input('seek', localizedMessage('interface:trackPosition'), {
    type: 'range',
    min: '0',
    max: '0',
    step: '0.1',
  });
  const volume = input('volume', localizedMessage('interface:musicVolume'), {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.01',
  });
  const selection = input('selection', localizedMessage('interface:playbackPlaylist'), {
    tag: 'select',
  });
  const masterStatus = node('p', 'master-status', '', { role: 'status', 'aria-live': 'polite' });
  const masterToggle = button('master-mute', localizedMessage('interface:unmuteMasterSound'), () =>
    changeMaster('muted', !audioMaster.snapshot().muted),
  );
  const masterVolume = input('master-volume', localizedMessage('common:audio.masterVolume'), {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.01',
  });
  const masterControls = advancedSection(
    'sound',
    t('interface:soundControls'),
    t('interface:masterVolumeAndMute'),
    row(masterToggle),
    masterVolume.field,
    masterStatus,
  );
  masterControls.hidden = !audioMaster;
  function updateMaster() {
    if (!audioMaster || disposed) return;
    const state = audioMaster.snapshot();
    localizedText(masterToggle, () =>
      state.muted ? t('interface:unmuteMasterSound') : t('interface:muteMasterSound'),
    );
    masterVolume.element.value = String(state.volume);
    localizedText(masterStatus, () =>
      state.muted || state.volume === 0
        ? t('interface:masterSoundIsMutedPlayAndAuditionKeepTheirOwn')
        : t('interface:masterSoundAppliesToMusicEffectsAndAuditionsPlaybackControls'),
    );
  }
  function changeMaster(kind, value) {
    if (!audioMaster || disposed) return;
    try {
      const callback = kind === 'muted' ? onMasterMuted : onMasterVolume;
      const result = callback
        ? callback(value)
        : kind === 'muted'
          ? audioMaster.setMuted(value)
          : audioMaster.setVolume(value);
      updateMaster();
      if (result?.ok === false)
        masterStatus.textContent += ` ${result.warning || t('interface:theSettingIsActiveForThisSessionButCouldNot')}`;
    } catch (error) {
      updateMaster();
      report(error);
    }
  }
  // Native/assistive range controls may publish only their committed change.
  masterVolume.element.oninput = masterVolume.element.onchange = () =>
    changeMaster('volume', Number(masterVolume.element.value));
  if (audioMaster) bindings.push(audioMaster.subscribe(updateMaster));
  function usePlaylist(chosen, { start = false } = {}) {
    return task(t('interface:savingYourPlaylistChoice'), async (signal) => {
      edit((value) => {
        value.selection.playlistId = chosen;
      });
      const committed = await commitDraft(signal);
      if (!committed.adopted || disposed) return;
      await stopAudition(false);
      wakeAudio();
      await player.selectPlaylist(draft.selection.playlistId);
      if (start) await (musicSession ? musicSession.play() : player.play());
      await notifyPlayback();
      setStatus(
        committed.warning ||
          (start
            ? t('interface:playlistSelectedAndPlaying')
            : t('interface:playlistSelectedPlaybackIsUnchanged')),
      );
    });
  }
  const useSelection = button('use-selection', localizedMessage('interface:playThisPlaylist'), () =>
    usePlaylist(selection.element.value || null, { start: true }),
  );
  const genreNames = SOUNDTRACK_GENRES.map((id) => [
    id,
    localizedMessage(`interface:soundtrack.genre.${id}`),
  ]);
  const listeningMode = input('listening-mode', localizedMessage('interface:musicSelection'), {
    tag: 'select',
  });
  options(listeningMode.element, [
    ['auto', t('interface:automaticMatchThisWorld')],
    ...genreNames,
    ['fusion', t('interface:fusion')],
    ['mix', t('interface:myMix')],
  ]);
  const mixGenres = genreNames.map(([id, label]) => ({
    id,
    ...input(`mix-${id}`, label, { type: 'checkbox' }),
  }));
  const installedOnly = input(
    'installed-only',
    localizedMessage('interface:installedOnlyUseDownloadedMusic'),
    {
      type: 'checkbox',
    },
  );
  const recordingMode = input(
    'recording-mode',
    localizedMessage('interface:recordingModeVerifiedGameplayVideoPermissions'),
    { type: 'checkbox' },
  );
  const recordingStatus = node('p', 'recording-status', '', { class: 'micro-note' });
  const useListening = (chosen, { start = false } = {}) => {
    return task(t('interface:savingYourMusicSelection'), async (signal) => {
      edit((value) => {
        value.selection.playlistId = null;
        value.listening = chosen;
      });
      const committed = await commitDraft(signal);
      if (!committed.adopted || disposed) return;
      await stopAudition(false);
      wakeAudio();
      await player.selectListening(draft.listening);
      if (start) await (musicSession ? musicSession.play() : player.play());
      if (onlineCatalogue) renderOnlineCatalogue();
      await notifyPlayback();
      setStatus(
        committed.warning ||
          (start
            ? t('interface:musicSelectionSavedAndPlayingUnavailableStylesRemainSilent')
            : t('interface:musicSelectionSavedPlaybackIsUnchangedUnavailableStylesRemainSilent')),
      );
    });
  };
  const applyListening = button(
    'apply-listening',
    localizedMessage('interface:saveListeningPreferences'),
    () => {
      const chosen = {
        mode: listeningMode.element.value,
        genres: mixGenres.filter(({ element }) => element.checked).map(({ id }) => id),
        installedOnly: installedOnly.element.checked,
        recordingMode: recordingMode.element.checked,
      };
      return useListening(chosen);
    },
  );
  const listeningSection = advancedSection(
    'listening',
    t('interface:filtersCustomMix'),
    t('interface:installedMusicRecordingModeAndGenreCombinations'),
    listeningMode.field,
    row(...mixGenres.map(({ field }) => field)),
    installedOnly.field,
    recordingMode.field,
    recordingStatus,
    applyListening,
  );
  listeningSection.hidden = !catalogue;
  const quickStyle = input('quick-style', localizedMessage('interface:musicStyle'), {
    tag: 'select',
  });
  options(quickStyle.element, [
    ...genreNames,
    ['fusion', t('interface:fusion')],
    ['auto', t('interface:automaticMatchThisWorld')],
    ['mix', t('interface:myMix')],
  ]);
  const quickStatus = node('p', 'quick-status', '', {
    class: 'soundtrack-quick-status',
    role: 'status',
    'aria-live': 'polite',
  });
  const playAll = button('play-all', localizedMessage('interface:shuffleAllMusic'), () =>
    useListening(
      {
        ...draft.listening,
        mode: 'mix',
        genres: [...SOUNDTRACK_GENRES],
      },
      { start: true },
    ),
  );
  playAll.classList.add('soundtrack-primary-action');
  const playStyle = button('play-style', localizedMessage('interface:playThisStyle'), () =>
    useListening(
      {
        ...draft.listening,
        mode: quickStyle.element.value,
      },
      { start: true },
    ),
  );
  const quickGrid = node('div', 'quick-grid', null, { class: 'soundtrack-quick-grid' });
  const quickListen = section(
    t('interface:pickTheMusic'),
    node('p', null, localizedMessage('interface:startEverySongOnShuffleChooseAStyleOrJump'), {
      class: 'soundtrack-lede',
    }),
    quickStatus,
    quickGrid,
  );
  quickListen.classList.add('soundtrack-listen-card');
  quickListen.hidden = !catalogue;
  const allCard = node('div', null, null, { class: 'soundtrack-choice soundtrack-choice-all' });
  allCard.append(
    node('span', null, localizedMessage('interface:allTracks'), {
      class: 'soundtrack-choice-kicker',
    }),
    node('strong', null, localizedMessage('interface:everythingShuffled')),
    node('p', null, localizedMessage('interface:aNoRepeatMixAcrossEveryAvailableStyle')),
    playAll,
  );
  const styleCard = node('div', null, null, { class: 'soundtrack-choice' });
  styleCard.append(
    node('span', null, localizedMessage('interface:style'), { class: 'soundtrack-choice-kicker' }),
    quickStyle.field,
    playStyle,
  );
  const playlistCard = node('div', null, null, { class: 'soundtrack-choice' });
  playlistCard.append(
    node('span', null, localizedMessage('interface:playlist'), {
      class: 'soundtrack-choice-kicker',
    }),
    selection.field,
    useSelection,
  );
  quickGrid.append(allCard, styleCard, playlistCard);
  const onlineSearch = input(
    'online-search',
    localizedMessage('interface:searchThePublicArchive'),
    {
      type: 'search',
      placeholder: t('interface:titleArtistCollectionOrStyle'),
      autocomplete: 'off',
    },
  );
  const onlineStyles = node('fieldset', 'online-styles', null, {
    class: 'soundtrack-online-styles',
  });
  onlineStyles.append(node('legend', null, localizedMessage('interface:musicStylesChooseAnyMix')));
  const onlineStyleInputs = new Map();
  for (const [value, label] of ONLINE_STYLE_CHOICES) {
    const checkbox = node('input', `online-style-${value}`, null, {
      type: 'checkbox',
      value,
    });
    checkbox.checked = true;
    const choice = node('label', null, null, { class: 'soundtrack-online-style' });
    choice.append(checkbox, node('span', null, label));
    onlineStyles.append(choice);
    onlineStyleInputs.set(value, checkbox);
  }
  const selectAllOnlineStyles = button(
    'online-styles-all',
    localizedMessage('interface:allStyles'),
    () => {
      for (const checkbox of onlineStyleInputs.values()) checkbox.checked = true;
      renderOnlineCatalogue();
    },
  );
  const clearOnlineStyles = button(
    'online-styles-none',
    localizedMessage('interface:clear'),
    () => {
      for (const checkbox of onlineStyleInputs.values()) checkbox.checked = false;
      renderOnlineCatalogue();
    },
  );
  onlineStyles.append(row(selectAllOnlineStyles, clearOnlineStyles));
  const onlineOrder = input('online-order', localizedMessage('interface:order'), { tag: 'select' });
  options(onlineOrder.element, [
    ['shuffle', t('interface:shuffle')],
    ['ordered', t('interface:oneAfterAnother')],
  ]);
  const onlineRepeat = input('online-repeat', localizedMessage('interface:repeat'), {
    tag: 'select',
  });
  options(onlineRepeat.element, [
    ['all', t('interface:allSelectedSongs')],
    ['one', t('interface:currentSong')],
    ['off', t('interface:stopAtTheEnd')],
  ]);
  const onlineCollection = input('online-collection', localizedMessage('interface:collection'), {
    tag: 'select',
  });
  options(onlineCollection.element, [['', t('interface:allCollections')]]);
  const onlineMixLibrary = node('input', 'online-mix-library', null, { type: 'checkbox' });
  onlineMixLibrary.checked = true;
  const onlineMixLibraryChoice = node('label', null, null, {
    class: 'soundtrack-online-style',
  });
  onlineMixLibraryChoice.append(
    onlineMixLibrary,
    node('span', null, localizedMessage('interface:mixWithCurrentGameAndUploadedMusicSelection')),
  );
  const onlineStatus = node(
    'p',
    'online-status',
    localizedMessage('interface:thePublicCatalogueLoadsWhenTheMusicPlayerOpens'),
    { class: 'soundtrack-online-status', role: 'status', 'aria-live': 'polite' },
  );
  const onlineResults = node('div', 'online-results', null, {
    class: 'soundtrack-online-results',
  });
  const onlinePlaybackOptions = (startTrackId = null) => ({
    order: onlineOrder.element.value,
    repeat: onlineRepeat.element.value,
    startTrackId,
    mixWithLibrary: onlineMixLibrary.checked,
  });
  const playOnlineResults = button(
    'online-play-all',
    localizedMessage('interface:playSelectedSongs'),
    () => {
      const matches = onlineMatches();
      if (matches.length)
        return controlMusic(
          () => player.playRemotePlaylist(matches, onlinePlaybackOptions()),
          true,
        );
    },
  );
  playOnlineResults.classList.add('soundtrack-primary-action');
  playOnlineResults.disabled = true;
  const reloadOnline = button('online-reload', localizedMessage('interface:refreshCatalogue'), () =>
    loadOnlineCatalogue(true),
  );
  const onlineArchive = section(
    t('interface:playThePublicSoundtrackArchive'),
    node(
      'p',
      null,
      localizedMessage('interface:searchEveryPublishedRecordingAndPlayItHereSongsStream'),
      { class: 'soundtrack-lede' },
    ),
    row(onlineSearch.field, onlineCollection.field),
    onlineStyles,
    onlineMixLibraryChoice,
    row(onlineOrder.field, onlineRepeat.field),
    row(playOnlineResults, reloadOnline),
    onlineStatus,
    onlineResults,
    node(
      'p',
      null,
      localizedMessage('interface:archiveAvailabilityAndAPublishedLicenceDoNotMeanA'),
      { class: 'micro-note' },
    ),
  );
  onlineArchive.classList.add('soundtrack-online-card');
  const transport = section(
    localizedMessage('interface:nowPlaying'),
    now,
    nowSources,
    transportStatus,
    row(
      button('previous', localizedMessage('common:actions.previous'), () =>
        controlMusic(() => player.previous()),
      ),
      button('play', localizedMessage('interface:playMusic2'), () =>
        controlMusic(() => (musicSession ? musicSession.play() : player.play()), true),
      ),
      button('pause', localizedMessage('interface:pauseMusic'), () =>
        controlMusic(() => (musicSession ? musicSession.pause() : player.pause())),
      ),
      button('next', localizedMessage('common:actions.next'), () =>
        controlMusic(() => player.next()),
      ),
    ),
    seek.field,
    volume.field,
  );
  transport.classList.add('soundtrack-now-card');
  // Hosts without the catalogue still expose built-in and imported playlists.
  if (!catalogue) transport.append(selection.field, useSelection);
  const tracksSelect = input('tracks', localizedMessage('interface:tracks'), {
    tag: 'select',
    size: '7',
  });
  const fileInput = input('mp3-files', localizedMessage('interface:addMp3Files'), {
    type: 'file',
    accept: '.mp3,audio/mpeg',
    multiple: '',
  });
  const importButton = button('import-mp3', localizedMessage('interface:importSelectedMp3s'), () =>
    importMP3Files(),
  );
  const collectionTitle = input('collection-title', localizedMessage('interface:playlistTitle'), {
    maxlength: '120',
  });
  const collectionGenre = input(
    'collection-genre',
    localizedMessage('interface:primaryMusicFamily'),
    { tag: 'select' },
  );
  options(collectionGenre.element, [['', t('interface:unclassified')], ...genreNames]);
  const collectionFiles = input('collection-files', localizedMessage('interface:addMp3Files'), {
    type: 'file',
    accept: '.mp3,audio/mpeg',
    multiple: '',
  });
  const collectionFolder = input(
    'collection-folder',
    localizedMessage('interface:chooseMp3Folder'),
    {
      type: 'file',
      accept: '.mp3,audio/mpeg',
      multiple: '',
      webkitdirectory: '',
      directory: '',
    },
  );
  const collectionSummary = node('p', 'collection-summary', '', {
    class: 'micro-note',
    role: 'status',
    'aria-live': 'polite',
  });
  const reviewCollection = button(
    'review-collection',
    localizedMessage('interface:reviewAsPlaylist'),
    () => importPrivateCollection(),
  );
  const savePlayCollection = button(
    'save-play-collection',
    localizedMessage('interface:saveCollectionAndPlay'),
    async () => {
      const playlist = draft.playlists.find((item) => item.id === privateCollectionPlaylistId);
      if (!playlist) return;
      const completed = await usePlaylist(playlist.id, { start: true });
      if (completed && !dirty)
        localizedText(collectionSummary, () =>
          t('interface:soundtrack.privateCollectionSaved', { title: playlist.title }),
        );
    },
  );
  const trackTitle = input('track-title', localizedMessage('interface:trackTitle'), {
    maxlength: '120',
  });
  const trackArtist = input('track-artist', localizedMessage('interface:artist'), {
    maxlength: '160',
  });
  const rightsKind = input('rights-kind', localizedMessage('interface:sourceDeclaration'), {
    tag: 'select',
  });
  options(rightsKind.element, [
    ['personal', t('interface:personalLocalUpload')],
    ['original', t('interface:originalWork')],
    ['licensed', t('interface:licensedWork')],
  ]);
  const rightsCredit = input('rights-credit', localizedMessage('interface:credit'), {
    maxlength: '280',
  });
  const rightsLicense = input('rights-license', localizedMessage('interface:licensePermission'), {
    maxlength: '280',
  });
  const rightsSource = input('rights-source', localizedMessage('interface:sourceProvenance'), {
    maxlength: '1024',
  });
  const trackGenre = input('track-genre', localizedMessage('interface:primaryMusicFamily'), {
    tag: 'select',
  });
  const trackFusion = input('track-fusion', localizedMessage('interface:fusionWith'), {
    tag: 'select',
  });
  options(trackGenre.element, [['', t('interface:unclassified')], ...genreNames]);
  options(trackFusion.element, [['', t('interface:noSecondFamily')], ...genreNames]);
  const trackRole = input('track-role', localizedMessage('interface:useIn'), { tag: 'select' });
  options(trackRole.element, [
    ['any', t('interface:anyScene')],
    ['menu', t('interface:menus')],
    ['gameplay', t('interface:gameplay')],
    ['intense', t('interface:finalesHighIntensity')],
  ]);
  const trackEnergy = input('track-energy', localizedMessage('interface:energy1Calm5Intense'), {
    type: 'number',
    min: '1',
    max: '5',
  });
  const trackThemes = input(
    'track-themes',
    localizedMessage('interface:worldsCommaSeparatedRetroFpvUkraineCoupa'),
    { maxlength: '160' },
  );
  const tagFields = section(
    t('interface:musicalCharacter'),
    trackGenre.field,
    trackFusion.field,
    trackRole.field,
    trackEnergy.field,
    trackThemes.field,
  );
  tagFields.hidden = !catalogue;
  const trackInfo = node('p', 'track-info', '', { class: 'micro-note' });
  const trackSources = node('div', 'track-sources');
  const downloadTrack = button(
    'download-track',
    localizedMessage('interface:prepareOriginalMp3Download'),
    () =>
      task(t('interface:verifyingOriginalMp3ForDownload'), async (signal) => {
        const track = tracks().find((item) => item.id === tracksSelect.element.value);
        if (
          track?.kind !== 'mp3' ||
          soundtrackRights(track, { catalogue: catalogue ?? undefined }).redistribute !== 'allowed'
        )
          throw new Error(t('interface:thisRecordingIsAvailableForInGamePlaybackOnlyStandalone'));
        const blob =
          assets.find((asset) => asset.sha256 === track.asset.sha256)?.blob ??
          (await readAsset?.(track.asset.sha256, { signal, purpose: 'export' }));
        if (!blob)
          throw new Error(t('interface:theOriginalRecordingIsUnavailableRestoreItOrGoOnline'));
        const actual = await inspectMP3(blob, { signal });
        if (actual.sha256 !== track.asset.sha256 || actual.bytes !== track.asset.bytes)
          throw new Error(t('interface:theRecordingDiffersFromItsCatalogue'));
        throwIfSoundtrackAborted(signal);
        invalidateBackup();
        preparedBackup = {
          blob,
          recording: true,
          filename:
            track.fileName ??
            `${track.title.replace(/[^a-z0-9 -]/gi, '').trim() || 'soundtrack'}.mp3`,
          url: typeof download === 'function' ? null : URLImpl.createObjectURL(blob),
        };
        setStatus(t('interface:originalMp3VerifiedChooseDownloadPreparedMp3BelowToSave'));
      }),
  );
  const applyTrack = button(
    'apply-track',
    localizedMessage('interface:applyTrackDetailsToDraft'),
    () =>
      attempt(() => {
        const id = tracksSelect.element.value;
        edit((value) => {
          const track = value.tracks.find((item) => item.id === id);
          if (!track) throw new Error(t('interface:builtInTracksCannotBeEdited'));
          Object.assign(track, {
            title: trackTitle.element.value,
            artist: trackArtist.element.value,
            rights: {
              kind: rightsKind.element.value,
              credit: rightsCredit.element.value,
              license: rightsLicense.element.value,
              source: rightsSource.element.value,
            },
          });
          if (catalogue) {
            const genres = [
              ...new Set([trackGenre.element.value, trackFusion.element.value].filter(Boolean)),
            ];
            value.tags[id] = {
              genres,
              role: trackRole.element.value,
              energy: Number(trackEnergy.element.value),
              themes: [
                ...new Set(
                  trackThemes.element.value
                    .split(',')
                    .map((part) => part.trim())
                    .filter(Boolean),
                ),
              ],
            };
          }
        });
        render();
        setStatus(t('interface:trackDetailsAddedToTheDraftSaveAllChangesTo'));
      }),
  );
  const deleteTrack = button(
    'delete-track',
    localizedMessage('interface:removeTrackFromDraft'),
    () =>
      attempt(() => {
        const id = tracksSelect.element.value;
        edit((value) => {
          if (!value.tracks.some((item) => item.id === id))
            throw new Error(t('interface:builtInTracksAreRetained'));
          const references = value.playlists.filter((item) => item.trackIds.includes(id));
          if (references.length)
            throw new Error(
              t('gameplay:removeThisTrackFromItsPlaylistsFirst', {
                value1: references.map((item) => contentText(item, 'title')).join(', '),
              }),
            );
          value.tracks = value.tracks.filter((item) => item.id !== id);
          if (value.tags) delete value.tags[id];
          if (value.bonusAlbums)
            value.bonusAlbums = value.bonusAlbums
              .map((album) => ({
                ...album,
                trackIds: album.trackIds.filter((trackId) => trackId !== id),
              }))
              .filter((album) => album.trackIds.length);
        });
        pruneAssets();
        render();
        setStatus(t('interface:trackRemovedFromTheDraftTheSavedLibraryIsUnchanged'));
      }),
  );
  const audition = node('audio', 'audition', null, {
    controls: '',
    preload: 'metadata',
    'aria-label': localizedMessage('interface:importedTrackAudition'),
  });
  let auditionLocalVolume = 1;
  const auditionMaster = audioMaster
    ? bindAudioMasterMedia({
        audioMaster,
        element: audition,
        volume: auditionLocalVolume,
        muted: true,
      })
    : null;
  audition.hidden = true;
  const auditionButton = button('audition-track', localizedMessage('interface:auditionMp3'), () =>
    playback(() => startAudition()),
  );
  const stopAuditionButton = button(
    'stop-audition',
    localizedMessage('interface:finishAudition'),
    () => playback(() => stopAudition(true)),
  );
  const auditionSeek = input('audition-seek', localizedMessage('interface:auditionPosition'), {
    type: 'range',
    min: '0',
    max: '0',
    step: '0.5',
  });
  const auditionVolume = input('audition-volume', localizedMessage('interface:auditionVolume'), {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.05',
  });
  const toggleAudition = button(
    'toggle-audition',
    localizedMessage('interface:pauseAudition'),
    () =>
      playback(async () => {
        if (!auditionURL || disposed || busy) return;
        const token = auditionToken;
        if (!audition.paused) {
          auditionActivity?.clear();
          auditionActivity = null;
          audition.pause();
          auditionMaster?.setLocal({ muted: true });
        } else {
          wakeAudio();
          if (disposed || token !== auditionToken || !auditionURL) return;
          const lease = auditionFeedback.begin({
            message: t('interface:resumingAudition'),
            stage: 'playing',
            isCurrent: () => !disposed && dialog.open && token === auditionToken,
          });
          auditionActivity = lease;
          try {
            auditionMaster?.setLocal({ muted: false });
            await audition.play();
            lease.finish({ message: t('interface:auditionPlaying') });
          } catch (error) {
            lease.finish({ message: message(error), state: 'error' });
            if (token === auditionToken) throw error;
          }
        }
      }),
  );
  const auditionStatus = node('p', 'audition-status');
  const auditionFeedback = createOperationStatus(auditionStatus);
  const auditionControls = section(
    localizedMessage('interface:auditionControls'),
    row(toggleAudition),
    auditionSeek.field,
    auditionVolume.field,
  );
  auditionControls.hidden = true;
  const tracksSection = advancedSection(
    'library',
    t('interface:addEditMusic'),
    t('interface:uploadMp3sEditCreditsAndAuditionTracks'),
    node('p', null, localizedMessage('interface:batchImportKeepsOriginalMp3BytesEachFileMustBe'), {
      class: 'micro-note',
    }),
    section(
      t('interface:privateCollectionQuickAdd'),
      node('p', null, localizedMessage('interface:privateCollectionQuickAddDescription'), {
        class: 'micro-note',
      }),
      collectionTitle.field,
      collectionGenre.field,
      collectionFiles.field,
      collectionFolder.field,
      row(reviewCollection, savePlayCollection),
      collectionSummary,
    ),
    fileInput.field,
    importButton,
    tracksSelect.field,
    trackInfo,
    trackSources,
    downloadTrack,
    trackTitle.field,
    trackArtist.field,
    rightsKind.field,
    rightsCredit.field,
    rightsLicense.field,
    rightsSource.field,
    tagFields,
    row(applyTrack, deleteTrack),
    auditionStatus,
    row(auditionButton, stopAuditionButton),
    audition,
    auditionControls,
  );
  const playlistsSelect = input('playlists', localizedMessage('interface:playlists'), {
    tag: 'select',
    size: '5',
  });
  const playlistTitle = input('playlist-title', localizedMessage('interface:playlistTitle'), {
    maxlength: '120',
  });
  const order = input('order', localizedMessage('interface:playbackOrder'), { tag: 'select' });
  options(order.element, [
    ['ordered', t('interface:inOrder')],
    ['shuffle', t('interface:shuffleWithoutRepeatsUntilEveryEntryPlayed')],
  ]);
  const repeat = input('repeat', localizedMessage('interface:repeat'), { tag: 'select' });
  options(repeat.element, [
    ['all', t('interface:repeatAll')],
    ['one', t('interface:repeatOne')],
    ['off', t('interface:stopAtTheEnd')],
  ]);
  const entries = input('entries', localizedMessage('interface:playlistEntries'), {
    tag: 'select',
    size: '7',
  });
  const addTrack = input('add-track', localizedMessage('interface:trackToAdd'), { tag: 'select' });
  const createPlaylist = button(
    'create-playlist',
    localizedMessage('interface:newPlaylistWithSelectedTrack'),
    () =>
      attempt(() => {
        const id = makeId('playlist');
        edit((value) =>
          value.playlists.push({
            id,
            title: t('interface:newPlaylist'),
            trackIds: [tracksSelect.element.value],
            order: 'ordered',
            repeat: 'all',
          }),
        );
        render({ playlistId: id });
        setStatus(t('interface:newPlaylistAddedToTheDraftEditItsTitleOrder'));
      }),
  );
  const clonePlaylist = button(
    'clone-playlist',
    localizedMessage('interface:cloneSelectedPlaylist'),
    () =>
      attempt(() => {
        const source = playlists().find((item) => item.id === playlistsSelect.element.value);
        const id = makeId('playlist');
        edit((value) =>
          value.playlists.push({
            ...copy(source),
            id,
            title: t('gameplay:copy', { value1: contentText(source, 'title').slice(0, 113) }),
          }),
        );
        render({ playlistId: id });
        setStatus(t('interface:playlistClonedTheDraftCopyIsEditable'));
      }),
  );
  const applyPlaylist = button(
    'apply-playlist',
    localizedMessage('interface:applyPlaylistDetailsToDraft'),
    () =>
      attempt(() => {
        changePlaylist((item) =>
          Object.assign(item, {
            title: playlistTitle.element.value,
            order: order.element.value,
            repeat: repeat.element.value,
          }),
        );
        render();
        setStatus(t('interface:playlistDetailsAddedToTheDraftTheCurrentSongWill'));
      }),
  );
  const appendEntry = button('add-entry', localizedMessage('interface:addSelectedTrack'), () =>
    attempt(() => {
      changePlaylist((item) => item.trackIds.push(addTrack.element.value));
      renderPlaylist();
      dirtyState();
    }),
  );
  const moveEntry = (delta) =>
    attempt(() => {
      const at = Number(entries.element.value);
      changePlaylist((item) => {
        if (!Number.isInteger(at) || at < 0 || at + delta < 0 || at + delta >= item.trackIds.length)
          throw new Error(t('interface:chooseAnEntryThatCanMoveInThatDirection'));
        [item.trackIds[at], item.trackIds[at + delta]] = [
          item.trackIds[at + delta],
          item.trackIds[at],
        ];
      });
      renderPlaylist(String(at + delta));
      dirtyState();
    });
  const up = button('entry-up', localizedMessage('interface:moveEntryUp'), () => moveEntry(-1));
  const down = button('entry-down', localizedMessage('interface:moveEntryDown'), () =>
    moveEntry(1),
  );
  const removeEntry = button(
    'remove-entry',
    localizedMessage('interface:removeSelectedEntry'),
    () =>
      attempt(() => {
        const at = Number(entries.element.value);
        changePlaylist((item) => {
          if (item.trackIds.length === 1)
            throw new Error(t('interface:aPlaylistNeedsAtLeastOneTrackRemoveThePlaylist'));
          if (!Number.isInteger(at) || at < 0 || at >= item.trackIds.length)
            throw new Error(t('interface:selectAPlaylistEntry'));
          item.trackIds.splice(at, 1);
        });
        renderPlaylist();
        dirtyState();
      }),
  );
  const deletePlaylist = button(
    'delete-playlist',
    localizedMessage('interface:removePlaylistFromDraft'),
    () =>
      attempt(() => {
        const id = playlistsSelect.element.value;
        edit((value) => {
          if (!value.playlists.some((item) => item.id === id))
            throw new Error(t('interface:cloneBuiltInPlaylistsToEditThem'));
          if (
            value.selection.playlistId === id ||
            value.assignments.some((item) => item.playlistId === id)
          )
            throw new Error(
              t('interface:chooseAnotherPlaybackPlaylistAndRemoveAssignmentsBeforeDeletingThis'),
            );
          value.playlists = value.playlists.filter((item) => item.id !== id);
        });
        render();
        setStatus(t('interface:playlistRemovedFromTheDraft'));
      }),
  );
  const playlistSection = advancedSection(
    'playlists',
    t('interface:createPlaylists'),
    t('interface:orderShuffleAndRepeatYourOwnSelections'),
    playlistsSelect.field,
    row(createPlaylist, clonePlaylist),
    playlistTitle.field,
    order.field,
    repeat.field,
    applyPlaylist,
    entries.field,
    row(up, down, removeEntry),
    addTrack.field,
    appendEntry,
    deletePlaylist,
  );
  const scope = input('scope', localizedMessage('interface:assignSelectedPlaylistTo'), {
    tag: 'select',
  });
  options(scope.element, [
    ['global', t('interface:wholeGame')],
    ['theme', t('interface:currentTheme')],
    ['campaign', t('interface:currentCampaignEdition')],
    ['map', t('interface:currentMapEdition')],
  ]);
  const key = node('p', 'context-key', '', { class: 'micro-note' });
  const assignments = input('assignments', localizedMessage('interface:savedDraftedAssignments'), {
    tag: 'select',
    size: '4',
  });
  const assign = button('assign', localizedMessage('interface:assignPlaylistToThisContext'), () =>
    attempt(() => {
      const current = assignmentContext();
      edit((value) => {
        value.assignments = value.assignments.filter(
          (item) => item.scope !== current.scope || item.key !== current.key,
        );
        value.assignments.push({ ...current, playlistId: playlistsSelect.element.value });
      });
      renderAssignments();
      dirtyState();
      setStatus(t('interface:assignmentAddedToTheDraftAutomaticPlaybackUsesMapCampaign'));
    }),
  );
  const unassign = button('unassign', localizedMessage('interface:removeSelectedAssignment'), () =>
    attempt(() => {
      const at = Number(assignments.element.value);
      edit((value) => {
        if (!Number.isInteger(at) || at < 0 || at >= value.assignments.length)
          throw new Error(t('interface:selectAnAssignmentToRemove'));
        value.assignments.splice(at, 1);
      });
      renderAssignments();
      dirtyState();
    }),
  );
  const assignmentSection = advancedSection(
    'assignments',
    t('interface:matchMusicToWorlds'),
    t('interface:mapCampaignAndThemeAssignments'),
    node(
      'p',
      null,
      localizedMessage('interface:theseExactEditionKeysComeFromTheGameChooseAutomatic'),
      { class: 'micro-note' },
    ),
    scope.field,
    key,
    assign,
    assignments.field,
    unassign,
  );
  const bundleInput = input(
    'bundle-file',
    localizedMessage('interface:soundtrackRecoveryOrAlbumFileRlsound'),
    {
      type: 'file',
      accept: '.rlsound,application/octet-stream',
    },
  );
  const bundleImport = button(
    'import-bundle',
    localizedMessage('interface:reviewBackupAsReplacementDraft'),
    () =>
      task(t('interface:checkingSoundtrackBackupAndOriginalAudio'), async (signal) => {
        const source = bundleInput.element.files?.[0];
        if (!source) throw new Error(t('interface:chooseARlsoundBackupFirst'));
        const prepared = await importSoundtrackBundle(source, {
          signal,
          probeMedia,
          catalogue: catalogue ?? undefined,
        });
        throwIfSoundtrackAborted(signal);
        invalidateBackup();
        draft = adopt(prepared.library);
        assets = [...prepared.assets];
        dirty = true;
        render();
        setStatus(() =>
          t('interface:soundtrack.backupVerified', {
            tracks: draft.tracks.length,
            playlists: draft.playlists.length,
            notice: recoveryNotice(draft),
          }),
        );
        bundleInput.element.value = '';
      }),
  );
  const bundleExport = button(
    'export-bundle',
    localizedMessage('interface:prepareSavedLibraryBackupRlsound'),
    async () => {
      const complete = await task(
        t('interface:verifyingSoundtrackRecoveryDataAndPermittedOriginals'),
        async (signal) => {
          if (!saved) throw new Error(t('interface:loadTheSavedMusicLibraryFirst'));
          invalidateBackup();
          activity?.update({
            message: t('interface:verifyingAndPackingSoundtrackOriginals'),
            stage: 'exporting',
          });
          const completeAssets = await originalsFor(saved.library, saved.assets, signal);
          const blob = await exportSoundtrackBundle(saved.library, completeAssets, {
            signal,
            catalogue: catalogue ?? undefined,
          });
          throwIfSoundtrackAborted(signal);
          if (disposed) return;
          preparedBackup = {
            blob,
            filename: 'RevealLine-soundtrack.rlsound',
            generation: saved.generation,
            recoveryLibrary: saved.library,
            url: typeof download === 'function' ? null : URLImpl.createObjectURL(blob),
          };
          setStatus(() =>
            t('interface:soundtrack.backupPrepared', {
              notice: recoveryNotice(preparedBackup.recoveryLibrary),
            }),
          );
        },
      );
      if (complete && preparedBackup && dialog.open && !disposed) bundleDownload.focus();
      return complete;
    },
  );
  const shareImport = button('add-share', localizedMessage('interface:addAlbumFileToDraft'), () =>
    task(t('interface:checkingAndAddingTheSharedAlbum'), async (signal) => {
      const source = bundleInput.element.files?.[0];
      if (!source) throw new Error(t('interface:chooseAnAlbumRlsoundFileFirst'));
      const incoming = await importSoundtrackBundle(source, {
        signal,
        probeMedia,
        catalogue: catalogue ?? undefined,
      });
      const merged = mergeSoundtrackShare(draft, assets, incoming);
      throwIfSoundtrackAborted(signal);
      invalidateBackup();
      draft = adopt(merged.library);
      assets = merged.assets;
      dirty = true;
      setStatus(t('interface:albumAddedToTheDraftYourSelectedMusicAndAssignments'));
    }),
  );
  const shareExport = button(
    'export-share',
    localizedMessage('interface:prepareSelectedPlaylistAsAlbum'),
    () =>
      task(t('interface:preparingAShareableAlbum'), async (signal) => {
        const playlist = draft.playlists.find((item) => item.id === playlistsSelect.element.value);
        const library = soundtrackPlaylistShare(draft, playlist, {
          catalogue: catalogue ?? undefined,
        });
        const completeAssets = await originalsFor(
          library,
          assets,
          signal,
          SOUNDTRACK_LIMITS.optionalBundleTargetBytes,
        );
        const blob = await exportSoundtrackBundle(library, completeAssets, {
          signal,
          catalogue: catalogue ?? undefined,
        });
        if (blob.size > SOUNDTRACK_LIMITS.optionalBundleTargetBytes)
          throw new Error(t('interface:thisAlbumExceeds64MibSplitItsPlaylistIntoSmaller'));
        throwIfSoundtrackAborted(signal);
        invalidateBackup();
        preparedBackup = {
          blob,
          filename: 'RevealLine-album.rlsound',
          generation: saved.generation,
          share: true,
          recoveryLibrary: library,
          url: typeof download === 'function' ? null : URLImpl.createObjectURL(blob),
        };
        setStatus(() =>
          t('interface:soundtrack.albumPrepared', {
            notice: recoveryNotice(preparedBackup.recoveryLibrary),
          }),
        );
      }),
  );
  shareImport.hidden = !catalogue;
  shareExport.hidden = !catalogue;
  // A real link allows the browser's native keyboard/touch download behavior.
  // Injected native adapters receive their own button, invoked before any await.
  const bundleDownload = node(
    typeof download === 'function' ? 'button' : 'a',
    'download-prepared',
    localizedMessage('interface:downloadPreparedBackup'),
    { class: 'button secondary', ...(typeof download === 'function' ? { type: 'button' } : {}) },
  );
  bundleDownload.onclick = (event) => {
    const prepared = preparedBackup;
    if (!prepared || busy || disposed || !dialog.open) {
      event?.preventDefault();
      return false;
    }
    if (typeof download === 'function') {
      event?.preventDefault();
      return task(
        t('interface:requestingThePreparedBackupFromTheDownloadAdapter'),
        async (signal) => {
          await download(prepared.blob, prepared.filename, { signal });
          if (!disposed && preparedBackup === prepared)
            setStatus(t('interface:downloadRequestHandedToTheHostConfirmTheDestinationThere'));
        },
      );
    }
    setStatus(t('interface:downloadRequestedConfirmItInYourBrowserIfNoFile'));
    // No async work, synthetic click or automatic navigation here. The visible
    // anchor's default action uses the already prepared, retained Blob URL.
    return true;
  };
  const discardBackup = button(
    'discard-backup',
    localizedMessage('interface:discardPreparedCopy'),
    () => {
      if (busy || disposed) return;
      invalidateBackup();
      setStatus(t('interface:preparedCopyDiscardedSavedMusicIsUnchangedTheBrowserControls'));
    },
  );
  const backupInfo = node('p', 'backup-info', '', { class: 'micro-note' });
  const backupReady = node('div', 'backup-ready', null, { class: 'soundtrack-backup-ready' });
  backupReady.append(backupInfo, row(bundleDownload, discardBackup));
  const transferSection = advancedSection(
    'backup',
    t('interface:backupsAlbumFiles'),
    t('interface:importExportAndRestoreRlsoundFiles'),
    node(
      'p',
      null,
      localizedMessage(
        'interface:thisSeparateSoundtrackFileContainsPermittedPersonalInstalledAndExplicitly',
      ),
      { class: 'micro-note' },
    ),
    row(bundleExport),
    backupReady,
    bundleInput.field,
    bundleImport,
    shareImport,
    shareExport,
  );
  const albumList = node('div', 'album-list');
  const albumBrowse = button(
    'browse-albums',
    localizedMessage('interface:browseOptionalAlbums'),
    () =>
      albumTask(albumBrowse, t('interface:loadingAlbumDescriptions'), async (signal) => {
        const catalog = await fetchSoundtrackAlbumCatalog({ ...albumDownload, signal });
        throwIfSoundtrackAborted(signal);
        albumCatalog = catalog;
        renderAlbums();
        setStatus(
          catalog.albums.length
            ? localizedMessage('interface:soundtrack.optionalAlbums', {
                count: catalog.albums.length,
              })
            : localizedMessage(
                'interface:noOptionalAlbumsArePublishedForInstallationInThisEdition',
              ),
        );
      }),
  );
  const albumSection = advancedSection(
    'community',
    t('interface:communityDownloads'),
    t('interface:creatorAlbumsCreditsAndOptionalOfflineCopies'),
    node('p', null, localizedMessage('interface:browseAlbumsAndCreditsThenAddToDraftToDownload'), {
      class: 'micro-note',
    }),
    node('a', 'licensed-previews', localizedMessage('interface:openThePublicArchiveWebsite'), {
      href: 'https://mekhovov.github.io/revealline-soundtracks-01/',
      target: '_blank',
      rel: 'noopener noreferrer',
      class: 'button secondary',
    }),
    node(
      'p',
      'licensed-previews-info',
      catalogue?.tracks.some((track) => track.archiveId)
        ? t('interface:theArchiveWebsiteProvidesCreditsLicenceEvidenceAndMp3Downloads')
        : t('interface:theArchiveWebsiteProvidesCreditsLicenceEvidenceAndMp3Downloads2'),
      { class: 'micro-note' },
    ),
    albumBrowse,
    albumList,
  );
  const originalAlbums = node('div', 'original-albums');
  const originalSection = advancedSection(
    'offline',
    t('interface:offlineAlbumDownloads'),
    t('interface:installOrRemoveVerifiedRecordingsForOfflinePlay'),
    node(
      'p',
      'original-status',
      catalogue?.tracks.length
        ? localizedMessage('interface:soundtrack.recordingsAvailable', {
            count: catalogue.tracks.length,
          })
        : localizedMessage('interface:noOnlineRecordingsArePublishedInThisEditionImportMp3s'),
      { class: 'micro-note' },
    ),
    originalAlbums,
  );
  originalSection.hidden = !catalogue;
  const builtInAlbums = catalogue ? soundtrackAlbumPlaylists(draft) : [];
  const catalogueControls = [];
  const officialDownloads =
    globalThis.caches && globalThis.navigator?.locks ? createOfficialDownloads() : null;
  let officialPresent = new Set();
  async function refreshOfficialDownloads() {
    if (!officialDownloads || !catalogue) return;
    const ids = await localOfficialRecordingIds(catalogue);
    officialPresent = new Set(
      catalogue.tracks.filter((track) => ids.includes(track.id)).map((track) => track.asset.sha256),
    );
    player?.setLocalRecordingIds?.(ids);
  }
  const volumes = soundtrackDownloadVolumes(catalogue, builtInAlbums);
  for (const volume of volumes) {
    const offlineTracks = volume.tracks.filter(
      (track) => soundtrackRights(track, { catalogue }).offlineCache === 'allowed',
    );
    const ids = new Set(offlineTracks.map((track) => track.id));
    const availability = node('p', `availability-${volume.id}`, '', { class: 'micro-note' });
    const select = volume.playlistId
      ? button(`select-${volume.id}`, localizedMessage('interface:saveUseAlbum'), () =>
          usePlaylist(volume.playlistId),
        )
      : null;
    const install = button(
      `download-${volume.id}`,
      localizedMessage('interface:downloadForOffline'),
      () =>
        task(t('interface:downloadingAndSavingRecordings'), async (signal) => {
          if (officialDownloads) {
            await withOptionalMusicDownload(signal, (downloadSignal) =>
              officialDownloads.download({
                edition: 'soundtracks',
                group: `music:${volume.playlistId || volume.id}`,
                files: offlineTracks.map((track) => ({ ...track.asset, path: track.path })),
                signal: downloadSignal,
                acquire: (file, options) =>
                  readAsset(file.sha256, { ...options, download: true, purpose: 'offline' }),
                onProgress: (report) =>
                  setStatus(
                    t('interface:recordingDownloadProgress', {
                      ready: bytes(report.readyBytes),
                      remaining: bytes(report.remainingBytes),
                    }),
                  ),
              }),
            );
            await refreshOfficialDownloads();
            refreshCatalogueControls();
            setStatus(t('interface:recordingsSavedOfflinePreferencesUnchanged'));
            return;
          }
          if (!readAsset) throw new Error(t('interface:recordingDownloadsAreUnavailable'));
          if (
            offlineTracks.reduce((sum, track) => sum + track.asset.bytes, 0) >
            SOUNDTRACK_LIMITS.optionalBundleTargetBytes
          )
            throw new Error(t('interface:thisVolumeExceedsThe64MibDownloadBudgetItsPublisher'));
          const additions = new Map(assets.map((asset) => [asset.sha256, asset]));
          const expected = new Map(assets.map((asset) => [asset.sha256, asset.blob.size]));
          for (const track of offlineTracks) expected.set(track.asset.sha256, track.asset.bytes);
          if (
            [...expected.values()].reduce((sum, size) => sum + size, 0) >
            SOUNDTRACK_LIMITS.managedBytes
          )
            throw new Error(t('interface:thisDownloadExceedsThe256MibAudioBudgetRemoveAn'));
          for (const track of offlineTracks) {
            if (!additions.has(track.asset.sha256))
              additions.set(track.asset.sha256, {
                sha256: track.asset.sha256,
                blob: await readAsset(track.asset.sha256, {
                  signal,
                  download: true,
                  purpose: 'offline',
                }),
              });
            throwIfSoundtrackAborted(signal);
          }
          const next = copy(draft);
          next.installedTrackIds = [...new Set([...next.installedTrackIds, ...ids])];
          // A recovery bundle omitted these recordings for redistribution only.
          // A separately permitted offline fetch now supplies actual owned bytes.
          next.referenceOnlyTrackIds = next.referenceOnlyTrackIds.filter((id) => !ids.has(id));
          const prepared = await prepareSoundtrackLibrary(next, [...additions.values()], {
            signal,
            probeMedia,
            catalogue: catalogue ?? undefined,
          });
          invalidateBackup();
          draft = prepared.library;
          assets = [...prepared.assets];
          dirty = true;
          setStatus(t('interface:volumeDownloadedAndCheckedSaveAllChangesToInstallIt'));
        }),
    );
    const remove = button(
      `offload-${volume.id}`,
      localizedMessage('interface:removeOfflineDownload'),
      () =>
        attempt(async () => {
          if (officialDownloads) {
            await officialDownloads.remove(
              'soundtracks',
              `music:${volume.playlistId || volume.id}`,
            );
            await refreshOfficialDownloads();
            refreshCatalogueControls();
            setStatus(t('interface:officialDownloadRemovedReferencedFilesKept'));
            return;
          }
          edit((value) => {
            value.installedTrackIds = value.installedTrackIds.filter((id) => !ids.has(id));
          });
          pruneAssets();
          render();
          setStatus(t('interface:offlineCopiesRemovedFromTheDraftPlaylistsAreRetainedSave'));
        }),
    );
    originalAlbums.append(
      section(
        volume.title,
        node(
          'p',
          null,
          localizedMessage('interface:soundtrack.trackSize', {
            count: volume.tracks.length,
            size: bytes(volume.tracks.reduce((sum, track) => sum + track.asset.bytes, 0)),
          }),
        ),
        availability,
        ...(select
          ? [
              node(
                'p',
                null,
                localizedMessage('interface:albumSelectionSavesYourDraftAndKeepsPausedMusicPaused'),
                { class: 'micro-note' },
              ),
            ]
          : []),
        row(...(select ? [select] : []), install, remove),
      ),
    );
    catalogueControls.push({ volume, offlineTracks, ids, availability, install, remove });
  }
  function refreshCatalogueControls() {
    const present = new Set([...assets.map((asset) => asset.sha256), ...officialPresent]);
    for (const { volume, offlineTracks, ids, availability, install, remove } of catalogueControls) {
      const local = volume.tracks.filter((track) => present.has(track.asset.sha256)).length;
      localizedText(availability, () => {
        const location = t(
          dirty
            ? 'interface:soundtrack.localAvailabilityDraft'
            : 'interface:soundtrack.localAvailability',
          { available: local, total: volume.tracks.length },
        );
        const state =
          local === volume.tracks.length
            ? t('interface:readyForOfflineListening')
            : draft.listening.installedOnly
              ? t('interface:installedOnlyIsOnOtherRecordingsStaySilentUntilDownloaded')
              : t('interface:downloadMissingRecordingsOrChoosePublicArchiveStream');
        const rights =
          offlineTracks.length !== volume.tracks.length
            ? ' ' + t('interface:someRecordingsDoNotAllowOfflineStorage')
            : '';
        return `${location} ${state}${rights}`;
      });
      install.disabled =
        busy ||
        !saved ||
        !readAsset ||
        !offlineTracks.length ||
        offlineTracks.every((track) => present.has(track.asset.sha256));
      remove.disabled =
        busy ||
        !saved ||
        (officialDownloads
          ? !offlineTracks.some((track) => officialPresent.has(track.asset.sha256))
          : !draft.installedTrackIds.some((id) => ids.has(id)));
    }
  }
  void refreshOfficialDownloads()
    .then(() => refreshCatalogueControls())
    .catch(() => {});
  originalAlbums.append(
    node('a', null, localizedMessage('interface:gameAndSoundtrackDownloads'), {
      href: new URL('../downloads.html', import.meta.url).href,
    }),
  );
  const columns = node('div', null, null, { class: 'soundtrack-columns' });
  columns.append(
    listeningSection,
    originalSection,
    tracksSection,
    playlistSection,
    assignmentSection,
    transferSection,
    albumSection,
  );
  const operationRow = node('div', 'operation');
  operationRow.append(status, cancelButton);
  dialog.append(
    row(heading, closeButton),
    availability,
    operationRow,
    transport,
    quickListen,
    onlineArchive,
    masterControls,
    columns,
    node('div', null, null, { class: 'soundtrack-footer' }),
  );
  dialog.lastElementChild.append(stateLine, row(saveButton, undoButton, reloadButton));
  const style = doc.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('./soundtrack-panel.css', import.meta.url).href;
  (doc.head || doc.body).append(style);
  doc.body.append(dialog);

  function tracks() {
    return soundtrackTracks(draft);
  }
  function matchesOnlineStyle(track, style) {
    const tags = track.tags.map((tag) => tag.toLowerCase()),
      has = (...values) => values.some((value) => tags.some((tag) => tag.includes(value)));
    if (style === 'ukrainian') return has('ukrain');
    if (style === 'metal') return has('metal');
    if (style === 'synth') return has('synth', 'electro', 'tracker', 'fm', 'dance', 'techno');
    if (style === 'chiptune') return has('chiptune', '8-bit', 'fakebit');
    if (style === 'rock') return has('rock', 'punk');
    if (style === 'ambient') return has('ambient', 'atmospher');
    if (style === 'fusion') {
      const families = [
        has('ukrain'),
        has('metal'),
        has('synth', 'electro', 'tracker', 'fm', 'dance', 'techno'),
        has('chiptune', '8-bit', 'fakebit'),
        has('rock', 'punk'),
        has('ambient', 'atmospher'),
      ];
      return has('fusion') || families.filter(Boolean).length > 1;
    }
    return !['ukrainian', 'metal', 'synth', 'chiptune', 'rock', 'ambient', 'fusion'].some(
      (family) => matchesOnlineStyle(track, family),
    );
  }
  function selectedOnlineStyles() {
    return new Set(
      [...onlineStyleInputs].filter(([, checkbox]) => checkbox.checked).map(([style]) => style),
    );
  }
  function onlineMatches() {
    const query = onlineSearch.element.value.trim().toLowerCase(),
      collection = onlineCollection.element.value,
      styles = selectedOnlineStyles();
    return (onlineCatalogue?.tracks ?? []).filter((track) => {
      const searchable = [
        track.title,
        track.artist,
        track.collection,
        track.fileName,
        ...track.tags,
      ]
        .join(' ')
        .toLowerCase();
      return (
        (!draft.listening?.recordingMode || onlineSoundtrackRecordingAllowed(track)) &&
        (!query || searchable.includes(query)) &&
        (!collection || track.collection === collection) &&
        [...styles].some((style) => matchesOnlineStyle(track, style))
      );
    });
  }
  function renderOnlineCatalogue() {
    const matches = onlineMatches(),
      excluded = draft.listening?.recordingMode
        ? (onlineCatalogue?.tracks ?? []).filter(
            (track) => !onlineSoundtrackRecordingAllowed(track),
          ).length
        : 0;
    playOnlineResults.disabled = !matches.length;
    onlineResults.replaceChildren(
      ...matches.map((track) => {
        const play = button(
          `online-play-${track.sha256}`,
          localizedMessage('common:actions.playback'),
          () => {
            return controlMusic(
              () => player.playRemotePlaylist(matches, onlinePlaybackOptions(track.id)),
              true,
            );
          },
        );
        localizedAttribute(play, 'aria-label', () =>
          t('interface:soundtrack.playRecording', {
            title: track.title,
            artist: track.artist,
          }),
        );
        const details = node('div', null, null, { class: 'soundtrack-online-details' });
        details.append(
          node('strong', null, track.title),
          node('span', null, track.artist),
          node('small', null, `${track.collection} · ${track.tags.join(' · ')}`),
        );
        const source = node('a', null, localizedMessage('interface:source'), {
          href: track.websites[0].url,
          target: '_blank',
          rel: 'noopener noreferrer',
          class: 'soundtrack-online-source',
        });
        const item = node('article', null, null, { class: 'soundtrack-online-track' });
        item.append(play, details, source);
        return item;
      }),
    );
    if (onlineCatalogue)
      localizedText(onlineStatus, () => {
        const shown = t('interface:soundtrack.publishedShown', {
          count: matches.length,
          total: onlineCatalogue.tracks.length,
        });
        const recording = excluded
          ? ' ' + t('interface:soundtrack.recordingModeExcluded', { count: excluded })
          : '';
        return `${shown}${recording} ${t('interface:soundtrack.publicPlaybackHint')}`;
      });
  }
  async function loadOnlineCatalogue(force = false) {
    if (disposed || (onlineCatalogueController && !force)) return;
    onlineCatalogueController?.abort();
    const generation = ++onlineCatalogueGeneration,
      current = new AbortController();
    onlineCatalogueController = current;
    reloadOnline.disabled = true;
    localizedText(onlineStatus, () => t('interface:loadingThePublicSoundtrackCatalogue'));
    try {
      const loaded = await fetchOnlineSoundtrackCatalogue({
        ...onlineCatalogueDownload,
        signal: current.signal,
      });
      if (disposed || !dialog.open || generation !== onlineCatalogueGeneration) return;
      onlineCatalogue = loaded;
      options(onlineCollection.element, [
        ['', t('interface:allCollections')],
        ...[...new Set(loaded.tracks.map((track) => track.collection))]
          .sort((a, b) => a.localeCompare(b))
          .map((collection) => [collection, collection]),
      ]);
      renderOnlineCatalogue();
    } catch (error) {
      if (error?.name !== 'AbortError' && !disposed && generation === onlineCatalogueGeneration) {
        localizedText(onlineStatus, () =>
          t('interface:soundtrack.publicUnavailable', { error: message(error) }),
        );
        onlineResults.replaceChildren();
        playOnlineResults.disabled = true;
      }
    } finally {
      if (generation === onlineCatalogueGeneration) {
        onlineCatalogueController = null;
        reloadOnline.disabled = disposed;
      }
    }
  }
  function renderAlbums() {
    if (!albumCatalog) return;
    albumControls.clear();
    albumList.replaceChildren(
      ...albumCatalog.albums.map((album) => {
        const add = button(`album-add-${album.id}`, localizedMessage('interface:addToDraft'), () =>
          albumTask(
            add,
            localizedMessage('interface:soundtrack.downloadingAlbum', { album: album.title }),
            async (signal) => {
              // Applied draft edits and its generation are captured before download.
              const currentDraft = draft,
                currentAssets = [...assets],
                generation = saved.generation;
              const imported = await fetchSoundtrackAlbum(album, {
                ...albumDownload,
                signal,
                probeMedia,
                catalogue: catalogue ?? undefined,
              });
              throwIfSoundtrackAborted(signal);
              const restoring = albumState(album).known;
              const merged = restoring
                ? restoreSoundtrackAlbum(currentDraft, currentAssets, imported, album)
                : mergeSoundtrackAlbum(currentDraft, currentAssets, imported, album);
              const prepared = await prepareSoundtrackLibrary(merged.library, merged.assets, {
                signal,
                probeMedia,
                catalogue: catalogue ?? undefined,
              });
              throwIfSoundtrackAborted(signal);
              if (
                disposed ||
                !dialog.open ||
                saved.generation !== generation ||
                draft !== currentDraft
              )
                throw new Error(t('interface:theMusicDraftChangedWhileCheckingThisAlbumReviewIt'));
              invalidateBackup();
              draft = prepared.library;
              assets = [...prepared.assets];
              dirty = true;
              setStatus(
                restoring
                  ? localizedMessage('interface:soundtrack.albumRestored', {
                      album: album.title,
                    })
                  : localizedMessage('interface:soundtrack.albumVerified', {
                      album: album.title,
                      tracks: merged.addedTracks,
                      playlists: merged.addedPlaylists,
                    }),
              );
            },
            () => saveButton,
          ),
        );
        const remove = button(
          `album-offload-${album.id}`,
          localizedMessage('interface:removeOfflineDownload'),
          () =>
            albumTask(
              remove,
              localizedMessage('interface:soundtrack.removingAlbum', { album: album.title }),
              async (signal) => {
                const removed = offloadSoundtrackAlbum(draft, assets, album);
                const prepared = await prepareSoundtrackLibrary(removed.library, removed.assets, {
                  signal,
                  probeMedia,
                  catalogue: catalogue ?? undefined,
                });
                throwIfSoundtrackAborted(signal);
                invalidateBackup();
                draft = prepared.library;
                assets = [...prepared.assets];
                dirty = true;
                setStatus(() =>
                  t('interface:soundtrack.albumRemovedFromDraft', {
                    album: album.title,
                    size: bytes(removed.removedBytes),
                    retained: removed.retainedSharedBytes
                      ? ' ' +
                        t('interface:soundtrack.sharedAudioRetained', {
                          size: bytes(removed.retainedSharedBytes),
                        })
                      : '',
                  }),
                );
              },
              () => saveButton,
            ),
        );
        const availability = node('p', `album-status-${album.id}`, '', { class: 'micro-note' });
        albumControls.set(album.id, { album, add, remove, availability });
        const list = node('ol');
        for (const track of album.library.tracks)
          list.append(
            node(
              'li',
              null,
              `${track.title} · ${track.artist} · ${seconds(track.asset.durationSeconds)}`,
            ),
          );
        const source = node('a', null, localizedMessage('interface:creatorAndLicenseSource'), {
          href: album.source,
          target: '_blank',
          rel: 'noopener noreferrer',
        });
        return section(
          album.title,
          node(
            'p',
            null,
            localizedMessage('interface:soundtrack.albumSummary', {
              genre: album.genre,
              count: album.library.tracks.length,
              size: bytes(album.bytes),
            }),
          ),
          node('p', null, album.description),
          node('p', null, album.credit),
          source,
          list,
          availability,
          row(add, remove),
        );
      }),
    );
    refreshAlbumControls();
  }
  function albumState(album) {
    const pin = draft.bonusAlbums?.find((item) => item.id === album.id);
    const retained = album.library.tracks.flatMap((declared) =>
      draft.tracks.filter(
        (track) => track.id === declared.id && track.asset.sha256 === declared.asset.sha256,
      ),
    );
    const known = !!pin || retained.length === album.library.tracks.length;
    const localCount = retained.filter((track) =>
      assets.some((asset) => asset.sha256 === track.asset.sha256),
    ).length;
    return {
      known,
      localCount,
      retainedCount: retained.length,
      downloaded: known && localCount === retained.length,
      // A partial creator-share import restores its track as ordinary local ownership.
      // A false pin covering only the missing siblings must not hide that restored audio.
      offloaded:
        pin?.downloaded === false && retained.every((track) => pin.trackIds.includes(track.id)),
    };
  }
  function refreshAlbumControls() {
    for (const { album, add, remove, availability } of albumControls.values()) {
      const state = albumState(album);
      localizedText(add, () =>
        state.known ? t('interface:downloadAgain') : t('interface:addToDraft'),
      );
      add.disabled = busy || !saved;
      remove.disabled = busy || !saved || !state.known || state.offloaded;
      localizedText(availability, () =>
        !state.known
          ? t('interface:notAddedToThisLibrary')
          : state.offloaded
            ? `${t(
                dirty
                  ? 'interface:soundtrack.offlineAlbumRemovedDraft'
                  : 'interface:soundtrack.offlineAlbumRemoved',
              )}${state.localCount ? ' ' + t('interface:sharedAudioRequiredByOtherInstalledTracksIsStillAvailable') : ''}`
            : state.downloaded
              ? t(
                  dirty
                    ? 'interface:soundtrack.audioOfflineDraft'
                    : 'interface:soundtrack.audioOffline',
                )
              : state.localCount
                ? t(
                    dirty
                      ? 'interface:soundtrack.partialOfflineDraft'
                      : 'interface:soundtrack.partialOffline',
                    { available: state.localCount, total: state.retainedCount },
                  )
                : t('interface:localAudioIsUnavailableChooseDownloadAgainToRestoreThis'),
      );
    }
  }
  async function albumTask(opener, label, work, destination = () => opener) {
    if (busy || !saved || disposed || !dialog.open) return false;
    const token = ++albumGeneration,
      focused = doc.activeElement === opener;
    let moved = false;
    const followFocus = (event) => {
      if (![opener, cancelButton, doc.body].includes(event.target)) moved = true;
    };
    // Preserve unapplied editor values too: task's full render normally refreshes them.
    const controls = [
      tracksSelect,
      trackTitle,
      trackArtist,
      rightsKind,
      rightsCredit,
      rightsLicense,
      rightsSource,
      trackGenre,
      trackFusion,
      trackRole,
      trackEnergy,
      trackThemes,
      collectionTitle,
      collectionGenre,
      listeningMode,
      installedOnly,
      recordingMode,
      ...mixGenres,
      playlistsSelect,
      playlistTitle,
      order,
      repeat,
      entries,
      addTrack,
      scope,
      assignments,
      selection,
    ];
    albumEditors = controls.map(({ element }) => [element, element.value, element.checked]);
    doc.addEventListener('focusin', followFocus);
    let complete = false;
    try {
      complete = await task(label, work);
      return complete;
    } finally {
      doc.removeEventListener('focusin', followFocus);
      albumEditors = null;
      if (
        !disposed &&
        dialog.open &&
        albumGeneration === token &&
        focused &&
        !moved &&
        [opener, cancelButton, doc.body].includes(doc.activeElement)
      ) {
        const target = complete ? destination() : opener;
        if (target?.isConnected && !target.disabled) target.focus();
      }
    }
  }
  function playlists() {
    return soundtrackPlaylists(draft);
  }
  function report(error) {
    setStatus(
      error?.name === 'AbortError'
        ? t('interface:operationCancelledTheSavedLibraryWasNotChangedByThis')
        : message(error),
    );
    if (error?.name !== 'AbortError') {
      try {
        onError(error);
      } catch {}
    }
  }
  function attempt(work) {
    if (busy || !saved || disposed) return;
    try {
      return work();
    } catch (error) {
      report(error);
    }
  }
  function edit(work) {
    const value = copy(draft);
    work(value);
    draft = resolveSoundtrackLibrary(value);
    invalidateBackup();
    dirty = true;
  }
  function changePlaylist(work) {
    edit((value) => {
      const item = value.playlists.find((entry) => entry.id === playlistsSelect.element.value);
      if (!item) throw new Error(t('interface:cloneThisBuiltInPlaylistBeforeEditingIt'));
      work(item);
    });
  }
  function pruneAssets() {
    const needed = new Set(soundtrackStoredTracks(draft).map((track) => track.asset.sha256));
    assets = assets.filter((asset) => needed.has(asset.sha256));
  }
  async function originalsFor(library, available, signal, limit = SOUNDTRACK_LIMITS.bundleBytes) {
    const { requiredTracks: tracks } = soundtrackPortableRecoveryPlan(library, {
      catalogue: catalogue ?? undefined,
    });
    const declared = new Map(tracks.map((track) => [track.asset.sha256, track.asset.bytes]));
    if ([...declared.values()].reduce((total, size) => total + size, 0) > limit)
      throw new Error(t('errors:soundtrack.completeFileTooLarge', { size: bytes(limit) }));
    const originals = new Map(available.map((asset) => [asset.sha256, asset.blob]));
    const offloaded = new Set(soundtrackOffloadedBonusTrackIds(library));
    if (tracks.some((track) => offloaded.has(track.id) && !originals.has(track.asset.sha256)))
      throw new Error(t('interface:anAlbumWasRemovedFromOfflineStorageChooseDownloadAgain'));
    const result = new Map();
    let total = 0;
    for (const track of tracks) {
      const hash = track.asset.sha256;
      if (result.has(hash)) continue;
      let blob = originals.get(hash);
      if (!blob && readAsset) blob = await readAsset(hash, { signal, purpose: 'export' });
      if (!blob)
        throw new Error(t('errors:soundtrack.originalUnavailable', { track: track.title }));
      throwIfSoundtrackAborted(signal);
      total += blob.size;
      if (blob.size !== track.asset.bytes || total > limit)
        throw new Error(t('interface:theRecordingSizeDiffersFromItsCatalogueOrExceedsThe'));
      result.set(hash, { sha256: hash, blob });
    }
    return [...result.values()];
  }
  function dirtyState() {
    localizedText(stateLine, () =>
      saved
        ? t('gameplay:generationCustomTracksCustomPlaylistsOriginalAudio', {
            value1: dirty ? t('interface:unsavedDraft') : t('interface:saved'),
            value2: saved.generation,
            value3: draft.tracks.length,
            value4: draft.playlists.length,
            value5: bytes(assets.reduce((total, asset) => total + asset.blob.size, 0)),
          })
        : t('interface:localLibraryIsUnavailableBuiltInPlaybackRemainsSeparate'),
    );
    saveButton.disabled = busy || !saved || !dirty;
    undoButton.disabled = busy || !saved || !dirty;
  }
  function invalidateBackup() {
    if (!disposed && (doc.activeElement === bundleDownload || doc.activeElement === discardBackup))
      bundleExport.focus();
    if (preparedBackup?.url) URLImpl.revokeObjectURL(preparedBackup.url);
    preparedBackup = null;
    bundleDownload.removeAttribute('href');
    bundleDownload.removeAttribute('download');
    backupReady.hidden = true;
  }
  function recoveryNotice(library) {
    const plan = soundtrackPortableRecoveryPlan(library, { catalogue: catalogue ?? undefined });
    const notices = [];
    if (!plan.referenceOnlyTrackIds.length)
      notices.push(
        t('interface:containsEveryPermittedPersonalInstalledAndExplicitlyReferencedRecording'),
      );
    const names = new Map(soundtrackTracks(library).map((track) => [track.id, track.title]));
    if (plan.referenceOnlyTrackIds.length)
      notices.push(
        t('interface:soundtrack.requiresOnlineRestoration', {
          tracks: plan.referenceOnlyTrackIds.map((id) => names.get(id) ?? id).join(', '),
        }),
        t('interface:soundtrack.referenceOnlyNotice', {
          count: plan.referenceOnlyTrackIds.length,
        }),
      );
    if (plan.omittedCatalogueTrackIds.length)
      notices.push(
        t('interface:soundtrack.omittedCatalogueNotice', {
          count: plan.omittedCatalogueTrackIds.length,
        }),
      );
    return notices.join(' ');
  }
  function renderBackup() {
    backupReady.hidden = preparedBackup === null;
    bundleDownload.disabled = busy || !preparedBackup;
    bundleDownload.setAttribute('aria-disabled', String(bundleDownload.disabled));
    discardBackup.disabled = busy || !preparedBackup;
    if (!preparedBackup) return;
    localizedText(backupInfo, () =>
      preparedBackup.recording
        ? t('interface:soundtrack.preparedRecordingInfo', {
            size: bytes(preparedBackup.blob.size),
          })
        : preparedBackup.share
          ? t('interface:soundtrack.preparedAlbumInfo', {
              size: bytes(preparedBackup.blob.size),
              notice: recoveryNotice(preparedBackup.recoveryLibrary),
            })
          : t('interface:soundtrack.preparedBackupInfo', {
              size: bytes(preparedBackup.blob.size),
              generation: preparedBackup.generation,
              notice: recoveryNotice(preparedBackup.recoveryLibrary),
            }),
    );
    localizedText(bundleDownload, () =>
      preparedBackup.recording
        ? t('interface:downloadPreparedMp3')
        : preparedBackup.share
          ? t('interface:downloadPreparedFile')
          : t('interface:downloadPreparedBackup'),
    );
    if (preparedBackup.url) {
      if (busy) bundleDownload.removeAttribute('href');
      else bundleDownload.setAttribute('href', preparedBackup.url);
      bundleDownload.setAttribute('download', preparedBackup.filename);
    }
  }
  function recordingAllowed(track) {
    const policy = soundtrackRights(track, { catalogue: catalogue ?? undefined });
    return policy.gameplayVideo === 'allowed' && policy.contentId === 'not-registered';
  }
  function renderTrack() {
    const track = tracks().find((item) => item.id === tracksSelect.element.value);
    const custom = track?.kind === 'mp3' && !track.id.startsWith('builtin.');
    trackTitle.element.value = track?.title ?? '';
    trackArtist.element.value = track?.artist ?? '';
    rightsKind.element.value = track?.rights?.kind ?? 'original';
    rightsCredit.element.value = track?.rights?.credit ?? 'RevealLine';
    rightsLicense.element.value = track?.rights?.license ?? '';
    rightsSource.element.value = track?.rights?.source ?? '';
    const tags = track?.tags ?? draft.tags?.[track?.id];
    trackGenre.element.value = tags?.genres[0] ?? '';
    trackFusion.element.value = tags?.genres[1] ?? '';
    trackRole.element.value = tags?.role ?? 'any';
    trackEnergy.element.value = String(tags?.energy ?? 3);
    trackThemes.element.value = tags?.themes.join(', ') ?? '';
    for (const control of [
      trackTitle.element,
      trackArtist.element,
      rightsKind.element,
      rightsCredit.element,
      rightsLicense.element,
      rightsSource.element,
      applyTrack,
      deleteTrack,
      trackGenre.element,
      trackFusion.element,
      trackRole.element,
      trackEnergy.element,
      trackThemes.element,
    ])
      control.disabled = busy || !saved || !custom;
    auditionButton.disabled =
      busy ||
      !saved ||
      track?.kind !== 'mp3' ||
      soundtrackRights(track, { catalogue: catalogue ?? undefined }).webPlayback !== 'allowed' ||
      (draft.listening?.recordingMode && !recordingAllowed(track));
    const policy =
      track?.kind === 'mp3' ? soundtrackRights(track, { catalogue: catalogue ?? undefined }) : null;
    downloadTrack.disabled = busy || !saved || policy?.redistribute !== 'allowed';
    sourceLinks(trackSources, track);
    const online = catalogue?.tracks.some((item) => item.id === track?.id);
    const offloaded = soundtrackOffloadedBonusTrackIds(draft).includes(track?.id);
    localizedText(trackInfo, () => {
      if (track?.kind !== 'mp3')
        return t('interface:builtInProceduralSynthRecipeUseThePlaybackPlaylistTo');
      const availability = assets.some((asset) => asset.sha256 === track.asset.sha256)
        ? t('interface:soundtrack.presentLocally')
        : offloaded
          ? t('interface:removedOfflineChooseDownloadAgainInCommunitySoundtracks')
          : online
            ? t('interface:soundtrack.availableOnline')
            : t('interface:missingRestoreACompleteBackup');
      const file = track.fileName
        ? ' ' + t('interface:soundtrack.fileName', { file: track.fileName })
        : '';
      const download =
        policy?.redistribute !== 'allowed'
          ? ' ' + t('interface:standaloneDownloadIsNotPermitted')
          : '';
      const offline =
        policy?.offlineCache !== 'allowed'
          ? ' ' + t('interface:offlineInstallationIsNotPermitted')
          : '';
      const recording =
        policy && draft.listening?.recordingMode && !recordingAllowed(track)
          ? ' ' + t('interface:recordingModeExcludesThisAuditionGameplayVideoPermissionOrContent')
          : '';
      return t('interface:soundtrack.trackInfo', {
        duration: seconds(track.asset.durationSeconds),
        size: bytes(track.asset.bytes),
        rate: track.asset.sampleRate,
        availability,
        file,
        download,
        offline,
        recording,
      });
    });
  }
  function renderPlaylist(entryIndex) {
    const item = playlists().find((entry) => entry.id === playlistsSelect.element.value);
    const custom = !!item && !item.id.startsWith('builtin.');
    playlistTitle.element.value = item?.title ?? '';
    order.element.value = item?.order ?? 'ordered';
    repeat.element.value = item?.repeat ?? 'all';
    const names = new Map(tracks().map((track) => [track.id, track.title]));
    options(
      entries.element,
      (item?.trackIds ?? []).map((id, index) => [
        String(index),
        `${index + 1}. ${names.get(id) ?? id}`,
      ]),
      entryIndex ?? entries.element.value,
    );
    for (const control of [
      playlistTitle.element,
      order.element,
      repeat.element,
      applyPlaylist,
      appendEntry,
      up,
      down,
      removeEntry,
      deletePlaylist,
    ])
      control.disabled = busy || !saved || !custom;
  }
  function assignmentContext() {
    const selectedScope = scope.element.value,
      context = getContext();
    const contextKey =
      selectedScope === 'global'
        ? null
        : context[{ theme: 'themeId', campaign: 'campaignKey', map: 'mapKey' }[selectedScope]];
    if (contextKey === undefined || (selectedScope !== 'global' && !contextKey))
      throw new Error(t('gameplay:chooseAGameBeforeAssigningItsMusic', { value1: selectedScope }));
    return { scope: selectedScope, key: contextKey };
  }
  function renderAssignments() {
    const names = new Map(playlists().map((item) => [item.id, item.title]));
    options(
      assignments.element,
      draft.assignments.map((item, index) => [
        String(index),
        `${item.scope}: ${item.key ?? 'whole game'} → ${names.get(item.playlistId)}`,
      ]),
    );
    try {
      const context = assignmentContext();
      localizedText(key, () => context.key ?? t('interface:globalFallbackForTheWholeGame'));
      assign.disabled = busy || !saved;
    } catch (error) {
      localizedText(key, () => message(error));
      assign.disabled = true;
    }
    unassign.disabled = busy || !saved || !draft.assignments.length;
  }
  function render({ playlistId, trackId } = {}) {
    options(
      tracksSelect.element,
      tracks().map((item) => [
        item.id,
        `${item.kind === 'synth' ? '' + t('interface:builtIn') + ' ' : ''}${contentText(item, 'title')}`,
      ]),
      trackId ?? tracksSelect.element.value,
    );
    options(
      addTrack.element,
      tracks().map((item) => [item.id, item.title]),
    );
    options(
      playlistsSelect.element,
      playlists().map((item) => [
        item.id,
        `${item.id.startsWith('builtin.') ? '' + t('interface:builtIn') + ' ' : ''}${contentText(item, 'title')}`,
      ]),
      playlistId ?? playlistsSelect.element.value,
    );
    options(
      selection.element,
      [
        [
          '',
          catalogue
            ? t('interface:useSelectedStyle')
            : t('interface:automaticFollowMapCampaignTheme'),
        ],
        ...playlists().map((item) => [item.id, item.title]),
      ],
      draft.selection.playlistId ?? '',
    );
    for (const control of columns.querySelectorAll('button,input,select'))
      control.disabled = busy || !saved;
    const hasPrivateCollection =
      privateCollectionPlaylistId &&
      draft.playlists.some((playlist) => playlist.id === privateCollectionPlaylistId);
    savePlayCollection.disabled = busy || !saved || !dirty || !hasPrivateCollection;
    useSelection.disabled = busy || !saved;
    if (catalogue) {
      listeningMode.element.value = draft.listening.mode;
      quickStyle.element.value = draft.listening.mode;
      installedOnly.element.checked = draft.listening.installedOnly;
      recordingMode.element.checked = draft.listening.recordingMode;
      const excluded = (catalogue.tracks ?? []).filter((track) => !recordingAllowed(track)).length;
      localizedText(recordingStatus, () =>
        draft.listening.recordingMode
          ? t('interface:soundtrack.recordingModeStatus', { count: excluded })
          : t('interface:recordingModeAlsoFiltersAuditionsUnknownGameplayVideoOrContent'),
      );
      for (const { id, element } of mixGenres)
        element.checked = draft.listening.genres.includes(id);
      for (const control of listeningSection.querySelectorAll('button,input,select'))
        control.disabled = busy || !saved;
      for (const control of quickListen.querySelectorAll('button,input,select'))
        control.disabled = busy || !saved;
      const explicitPlaylist = playlists().find((item) => item.id === draft.selection.playlistId);
      const modeLabel =
        [
          ['fusion', t('interface:fusion')],
          ['mix', t('interface:allStyles')],
          ['auto', t('interface:automatic')],
          ...genreNames,
        ].find(([id]) => id === draft.listening.mode)?.[1] ?? t('interface:music');
      localizedText(quickStatus, () =>
        explicitPlaylist
          ? t('interface:soundtrack.selectedPlaylist', {
              playlist: contentText(explicitPlaylist, 'title'),
            })
          : t('interface:soundtrack.selectedStyle', { style: modeLabel }),
      );
    }
    cancelButton.hidden = !busy;
    closeButton.disabled = busy;
    reloadButton.disabled = busy;
    renderTrack();
    renderPlaylist();
    renderAssignments();
    refreshAlbumControls();
    refreshCatalogueControls();
    if (onlineCatalogue) renderOnlineCatalogue();
    renderBackup();
    dirtyState();
    update();
    if (albumEditors)
      for (const [element, value, checked] of albumEditors) {
        element.value = value;
        if (checked !== undefined) element.checked = checked;
      }
  }
  async function task(label, work) {
    if (busy || disposed) return false;
    const opener = saved && dialog.contains(doc.activeElement) ? doc.activeElement : null;
    const foregroundVisit = () =>
      !disposed &&
      dialog.open &&
      !doc.hidden &&
      doc.hasFocus?.() !== false &&
      canRestoreFocus(returnFocus);
    busy = true;
    controller = new AbortController();
    const signal = controller.signal;
    const lease = feedback.begin({
      message: label,
      isCurrent: () => !disposed && controller?.signal === signal,
    });
    activity = lease;
    render();
    // Disabling the active action otherwise strands native focus on BODY.
    // The cancel button is an explicit temporary owner, never a live-status focus target.
    if (
      opener?.disabled &&
      foregroundVisit() &&
      (doc.activeElement === opener || doc.activeElement === doc.body)
    )
      cancelButton.focus({ preventScroll: true });
    try {
      await work(signal, lease);
      lease.finish({ message: status.textContent });
      return true;
    } catch (error) {
      if (!disposed) {
        report(error);
        lease.finish({
          message: status.textContent,
          state: error?.name === 'AbortError' ? 'cancelled' : 'error',
        });
      }
      return false;
    } finally {
      if (activity === lease) activity = null;
      const ownsFocus = doc.activeElement === cancelButton;
      busy = false;
      controller = null;
      if (!disposed) render();
      if (
        ownsFocus &&
        foregroundVisit() &&
        (doc.activeElement === cancelButton || doc.activeElement === doc.body)
      ) {
        const target =
          opener?.isConnected && !opener.disabled && !opener.closest?.('[hidden],[inert]')
            ? opener
            : closeButton;
        target.focus({ preventScroll: true });
      }
    }
  }
  async function adoptSavedLibrary(value) {
    // A Couch owner installs verified bytes and metadata together. The default
    // remains compatible with Solo; onLibrary is still a later notification.
    if (adoptLibrary) await adoptLibrary(value);
    else player.setLibrary(adopt(value.library));
  }
  function refreshWarning(error) {
    try {
      onError(error);
    } catch {}
    return t('interface:soundtrack.refreshFailed', { error: message(error) });
  }
  async function reload() {
    return task(t('interface:loadingSavedMusicAndLocalAudio'), async (signal) => {
      invalidateBackup();
      const value = await store.read({ signal });
      throwIfSoundtrackAborted(signal);
      await adoptSavedLibrary(value);
      throwIfSoundtrackAborted(signal);
      saved = value;
      draft = adopt(value.library);
      assets = [...value.assets];
      dirty = false;
      privateCollectionPlaylistId = null;
      collectionSummary.textContent = '';
      const warning = await notifyLibrary(value);
      setStatus(warning || t('interface:savedLibraryLoadedImportsAndEditsRemainDraftsUntilSave'));
    });
  }
  async function notifyLibrary(value) {
    try {
      await onLibrary(adopt(value.library), value);
      return null;
    } catch (error) {
      return refreshWarning(error);
    }
  }
  async function commitDraft(signal) {
    if (!saved) throw new Error(t('interface:loadTheLocalLibraryBeforeSaving'));
    invalidateBackup();
    pruneAssets();
    activity?.update({
      message: t('interface:decodingAndVerifyingTheMusicLibrary'),
      stage: 'verifying',
    });
    const prepared = await prepareSoundtrackLibrary(draft, assets, {
      signal,
      probeMedia,
      catalogue: catalogue ?? undefined,
    });
    const usage =
      typeof otherManagedBytes === 'function' ? await otherManagedBytes() : otherManagedBytes;
    activity?.update({ message: t('interface:savingTheVerifiedMusicLibrary'), stage: 'saving' });
    const result = await store.commit(prepared, {
      signal,
      expectedGeneration: saved.generation,
      otherManagedBytes: usage,
    });
    // Store completion is authoritative even if a cancellation arrived too late.
    saved = { ...result, assets: [...prepared.assets] };
    draft = result.library;
    assets = [...prepared.assets];
    dirty = false;
    if (disposed)
      return {
        ...saved,
        adopted: false,
        warning: t('interface:librarySavedThePanelClosedBeforeRefresh'),
      };
    let adopted = false,
      warning;
    try {
      await adoptSavedLibrary(saved);
      adopted = true;
    } catch (error) {
      warning = refreshWarning(error);
    }
    if (adopted && !disposed) warning = await notifyLibrary(saved);
    setStatus(
      warning || t('interface:musicLibrarySavedAtomicallyTheCurrentSongContinuesEditedQueues'),
    );
    return { ...saved, warning, adopted };
  }
  async function importMP3Files() {
    return task(t('interface:inspectingSelectedMp3Files'), async (signal, progress) => {
      if (!saved) throw new Error(t('interface:loadTheLocalLibraryBeforeImporting'));
      const files = [...(fileInput.element.files ?? [])];
      if (!files.length) throw new Error(t('interface:chooseOneOrMoreMp3FilesFirst'));
      if (
        files.length + draft.tracks.length + BUILTIN_SOUNDTRACK_TRACKS.length >
        SOUNDTRACK_LIMITS.tracks
      )
        throw new Error(t('interface:thisBatchWouldExceedThe128TrackLibraryLimitIncluding'));
      const next = copy(draft),
        added = new Map(assets.map((asset) => [asset.sha256, asset.blob]));
      let latest;
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        progress.update({
          message: localizedMessage('interface:soundtrack.inspectingFile', {
            file: file.name || t('interface:mp3Audio'),
          }),
          stage: 'verifying',
          progress: { completed: index, total: files.length, unit: 'tracks' },
        });
        const imported = await prepareMP3Import(
          file,
          {
            id: makeId('track'),
            ...(next.format === 'revealline-soundtrack.v3' ? { fileName: file.name } : {}),
            title:
              (file.name || t('interface:importedMp3')).replace(/\.mp3$/i, '').slice(0, 120) ||
              t('interface:importedMp3'),
            artist: '',
            rights: {
              kind: 'personal',
              credit: t('interface:personalLocalUpload'),
              license: '',
              source: (file.name || '').slice(0, 1024),
            },
          },
          { signal, probeMedia, catalogue: catalogue ?? undefined },
        );
        next.tracks.push(imported.track);
        added.set(imported.track.asset.sha256, imported.blob);
        if (
          [...added.values()].reduce((total, blob) => total + blob.size, 0) >
          SOUNDTRACK_LIMITS.managedBytes
        )
          throw new Error(t('interface:thisDraftExceedsThe256MibAudioBudgetImportFewer'));
        latest = imported.track.id;
        resolveSoundtrackLibrary(next);
        throwIfSoundtrackAborted(signal);
      }
      const verified = resolveSoundtrackLibrary(next);
      throwIfSoundtrackAborted(signal);
      invalidateBackup();
      draft = verified;
      assets = [...added].map(([sha256, blob]) => ({ sha256, blob }));
      dirty = true;
      render({ trackId: latest });
      fileInput.element.value = '';
      setStatus(localizedMessage('interface:soundtrack.filesImported', { count: files.length }));
    });
  }
  function privateCollectionFiles() {
    const picked = [...(collectionFiles.element.files ?? [])];
    const folder = [...(collectionFolder.element.files ?? [])];
    if (picked.length && folder.length) throw new Error(t('interface:chooseFilesOrAFolderNotBoth'));
    return folder.length ? folder : picked;
  }
  function suggestedCollectionTitle(files) {
    const relative = files[0]?.webkitRelativePath;
    if (relative?.includes('/')) return relative.split('/')[0].slice(0, 120);
    return (files[0]?.name || t('interface:myMusic')).replace(/\.mp3$/i, '').slice(0, 120);
  }
  async function importPrivateCollection() {
    return task(t('interface:inspectingSelectedMp3Files'), async (signal, progress) => {
      if (!saved) throw new Error(t('interface:loadTheLocalLibraryBeforeImporting'));
      const files = privateCollectionFiles();
      const title = collectionTitle.element.value.trim() || suggestedCollectionTitle(files);
      const prepared = await preparePrivateSoundtrackCollection(draft, assets, files, {
        title,
        genre: collectionGenre.element.value,
        signal,
        probeMedia,
        catalogue: catalogue ?? undefined,
        makeId,
        credit: t('interface:personalLocalUpload'),
        onProgress: ({ file, completed, total }) =>
          progress.update({
            message: localizedMessage('interface:soundtrack.inspectingFile', {
              file: file.name || t('interface:mp3Audio'),
            }),
            stage: 'verifying',
            progress: { completed, total, unit: 'tracks' },
          }),
      });
      invalidateBackup();
      draft = prepared.library;
      assets = prepared.assets;
      dirty = true;
      privateCollectionPlaylistId = prepared.playlistId;
      collectionTitle.element.value = title;
      collectionFiles.element.value = '';
      collectionFolder.element.value = '';
      render({
        playlistId: prepared.playlistId,
        trackId: prepared.trackIds.at(-1),
      });
      localizedText(collectionSummary, () =>
        t('interface:soundtrack.privateCollectionReviewed', {
          tracks: prepared.trackIds.length,
          recordings: prepared.uniqueRecordings,
          title,
        }),
      );
      setStatus(
        t('interface:soundtrack.privateCollectionReviewed', {
          tracks: prepared.trackIds.length,
          recordings: prepared.uniqueRecordings,
          title,
        }),
      );
    });
  }
  async function stopAudition(restore = false) {
    auditionActivity?.clear();
    auditionActivity = null;
    auditionToken++;
    auditionMaster?.setLocal({ muted: true });
    auditionController?.abort();
    auditionController = null;
    audition.pause();
    audition.removeAttribute('src');
    try {
      audition.load();
    } catch {}
    if (auditionURL) {
      URLImpl.revokeObjectURL(auditionURL);
      auditionURL = null;
    }
    audition.hidden = true;
    const shouldResume = restore && restoreMusic;
    restoreMusic = false;
    if (shouldResume && !disposed) await player.play();
    update();
  }
  async function startAudition() {
    const track = tracks().find((item) => item.id === tracksSelect.element.value);
    if (track?.kind !== 'mp3') throw new Error(t('interface:chooseAnMp3ToAudition'));
    if (draft.listening?.recordingMode && !recordingAllowed(track))
      throw new Error(
        t('interface:recordingModeExcludesThisAuditionUntilGameplayVideoPermissionAnd'),
      );
    if (soundtrackRights(track, { catalogue: catalogue ?? undefined }).webPlayback !== 'allowed')
      throw new Error(t('interface:thisRecordingIsNotApprovedForPlaybackInThisEdition'));
    if (soundtrackOffloadedBonusTrackIds(draft).includes(track.id))
      throw new Error(t('interface:chooseDownloadAgainInCommunitySoundtracksToAuditionThisAlbum'));
    const state = player.snapshot();
    const previous = restoreMusic || (state.desired ?? state.playing);
    const stopping = stopAudition(false);
    wakeAudio();
    restoreMusic = previous;
    player.pause();
    const token = ++auditionToken;
    const lease = auditionFeedback.begin({
      message: () => t('interface:soundtrack.startingAudition', { track: track.title }),
      stage: 'playing',
      isCurrent: () => !disposed && dialog.open && token === auditionToken,
    });
    auditionActivity = lease;
    auditionController = new AbortController();
    const signal = auditionController.signal;
    update();
    try {
      const blob =
        assets.find((item) => item.sha256 === track.asset.sha256)?.blob ??
        (await readAsset?.(track.asset.sha256, { signal }));
      throwIfSoundtrackAborted(signal);
      if (disposed || token !== auditionToken) return;
      if (!blob) throw new Error(t('interface:thisMp3IsUnavailableDownloadItsAlbumOrRestoreA'));
      auditionURL = URLImpl.createObjectURL(blob);
      audition.src = auditionURL;
      audition.hidden = false;
      audition.load();
      auditionMaster?.setLocal({ muted: false });
      const playing = audition.play();
      // Keep playback in the activation turn, but expose its status and Finish
      // before waiting; media events may not arrive while playback is pending.
      update();
      await playing;
      await stopping;
      if (token === auditionToken) {
        if (!audioMaster) await onAudioEnabled();
        lease.finish({
          message: () => t('interface:soundtrack.auditioning', { track: track.title }),
        });
      }
    } catch (error) {
      if (token !== auditionToken || disposed) return false;
      await stopAudition(true);
      throw error;
    }
  }
  async function playback(work) {
    try {
      await work();
      update();
    } catch (error) {
      report(error);
      update();
    }
  }
  async function controlMusic(work, enable = false) {
    return playback(async () => {
      // Invoke play in the same task as the button activation. In particular,
      // iOS Safari can reject media.play() after an await, even when the await
      // was only a local pause or audio-context resume.
      const stopping = stopAudition(false);
      if (enable) wakeAudio();
      const playing = work();
      await stopping;
      await playing;
      await notifyPlayback();
    });
  }
  function wakeAudio() {
    try {
      const pending = beforeAudio();
      if (pending?.catch) void pending.catch(report);
    } catch (error) {
      report(error);
    }
  }
  async function notifyPlayback() {
    const state = player.snapshot();
    await onPlayback({ playing: state.playing, desired: state.desired ?? state.playing });
    if (state.playing && !audioMaster) await onAudioEnabled();
  }
  function updateAudition() {
    const available = auditionURL !== null && !disposed;
    auditionControls.hidden = !available;
    toggleAudition.disabled = !available || busy;
    localizedText(toggleAudition, () =>
      audition.paused ? t('interface:resumeAudition') : t('interface:pauseAudition'),
    );
    const duration =
      Number.isFinite(audition.duration) && audition.duration > 0 ? audition.duration : 0;
    auditionSeek.element.max = String(duration);
    auditionSeek.element.disabled = !available || busy || !duration;
    auditionVolume.element.disabled = !available || busy;
    if (doc.activeElement !== auditionSeek.element)
      auditionSeek.element.value = String(
        Number.isFinite(audition.currentTime) ? audition.currentTime : 0,
      );
    if (doc.activeElement !== auditionVolume.element)
      auditionVolume.element.value = String(
        auditionMaster
          ? auditionLocalVolume
          : Number.isFinite(audition.volume)
            ? audition.volume
            : 1,
      );
  }
  const sourceSignatures = new WeakMap();
  function sourceLinks(container, track) {
    const sites = [...(track?.websites ?? [])];
    if (!sites.length && track?.rights?.source)
      sites.push({ label: t('interface:sourceWebsite'), url: track.rights.source });
    const signature = JSON.stringify(sites);
    if (sourceSignatures.get(container) === signature) return;
    sourceSignatures.set(container, signature);
    container.replaceChildren();
    for (const site of sites) {
      let url;
      try {
        url = new URL(site.url);
      } catch {
        continue;
      }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue;
      const link = doc.createElement('a');
      localizedText(link, () => site.label || t('interface:sourceWebsite'));
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      container.append(link);
    }
  }
  const playbackStatusKeys = Object.freeze({
    idle: 'interface:soundtrack.playback.idle',
    loading: 'interface:soundtrack.playback.loading',
    playing: 'interface:soundtrack.playback.playing',
    blocked: 'interface:soundtrack.playback.blocked',
    paused: 'interface:soundtrack.playback.paused',
    error: 'interface:soundtrack.playback.error',
    ended: 'interface:soundtrack.playback.ended',
    suspended: 'interface:soundtrack.playback.suspended',
    disposed: 'interface:soundtrack.playback.disposed',
  });
  function update(snapshot = player.snapshot()) {
    if (disposed) return;
    localizedText(now, () =>
      t('interface:soundtrack.nowPlaying', {
        track: snapshot.track?.title ?? t('interface:noTrackSelected'),
        artist: snapshot.track?.artist ? ` · ${snapshot.track.artist}` : '',
        status: playbackStatusKeys[snapshot.status]
          ? t(playbackStatusKeys[snapshot.status])
          : snapshot.status,
        position: seconds(snapshot.positionSeconds),
        duration: seconds(snapshot.durationSeconds),
        queued: snapshot.pendingPlaylistId
          ? ` · ${t('interface:soundtrack.playlistUpdateQueued')}`
          : '',
        notice: snapshot.notice ? ` · ${snapshot.notice}` : '',
        error: snapshot.error ? ` · ${snapshot.error}` : '',
        file: snapshot.track?.fileName
          ? ` · ${t('interface:soundtrack.fileName', { file: snapshot.track.fileName })}`
          : '',
      }),
    );
    sourceLinks(nowSources, snapshot.track);
    if (snapshot.preparation) {
      transportActivity ??= transportFeedback.begin(snapshot.preparation);
      transportActivity.update(snapshot.preparation);
    } else {
      transportActivity?.finish();
      transportActivity = null;
    }
    seek.element.max = String(snapshot.durationSeconds || 0);
    if (doc.activeElement !== seek.element)
      seek.element.value = String(snapshot.positionSeconds || 0);
    seek.element.disabled = !snapshot.track || !(snapshot.durationSeconds > 0);
    if (doc.activeElement !== volume.element) volume.element.value = String(snapshot.volume ?? 0.5);
    stopAuditionButton.disabled = auditionURL === null && auditionController === null;
    updateAudition();
  }
  async function open() {
    if (disposed || dialog.open) return;
    onOpen();
    returnFocus = doc.activeElement;
    if (!dialog.open) dialog.showModal();
    if (!onlineCatalogue && !onlineCatalogueController) void loadOnlineCatalogue();
    closeButton.focus();
    if (!saved) {
      const focusIsEmpty = () => doc.activeElement === doc.body || doc.activeElement === dialog;
      // Remember the initial target; native blur may arrive later during the read.
      let restoreOpeningFocus = doc.activeElement === closeButton;
      const relinquish = () => {
        restoreOpeningFocus = false;
      };
      const focusChanged = (event) => {
        if (event.target !== doc.body && event.target !== dialog) relinquish();
      };
      const stopObserving = () => {
        doc.removeEventListener('focusin', focusChanged);
        dialog.removeEventListener('close', relinquish);
      };
      doc.addEventListener('focusin', focusChanged);
      dialog.addEventListener('close', relinquish);
      bindings.push(stopObserving);
      try {
        const loading = reload();
        restoreOpeningFocus = restoreOpeningFocus && closeButton.disabled;
        await loading;
      } finally {
        stopObserving();
        const bindingIndex = bindings.indexOf(stopObserving);
        if (bindingIndex >= 0) bindings.splice(bindingIndex, 1);
        if (
          restoreOpeningFocus &&
          !disposed &&
          !doc.hidden &&
          dialog.isConnected &&
          dialog.open &&
          !closeButton.disabled &&
          focusIsEmpty()
        )
          closeButton.focus({ preventScroll: true });
      }
    } else {
      render();
      setStatus(
        preparedBackup
          ? t('interface:yourPreparedSavedLibraryBackupIsStillAvailableToDownload')
          : dirty
            ? t('interface:yourUnsavedDraftIsStillHere')
            : t('interface:musicLibraryReady'),
      );
    }
  }
  function close({ restoreFocus = true, restoreMusic = true } = {}) {
    if (busy || disposed || !dialog.open) return false;
    onlineCatalogueController?.abort();
    onlineCatalogueController = null;
    onlineCatalogueGeneration++;
    void playback(() => stopAudition(restoreMusic));
    dialog.close();
    if (
      restoreFocus &&
      !doc.hidden &&
      returnFocus?.isConnected &&
      !returnFocus.disabled &&
      !returnFocus.closest?.('[hidden],[inert]') &&
      canRestoreFocus(returnFocus)
    )
      returnFocus.focus({ preventScroll: true });
    onClose();
    return true;
  }
  listen(dialog, 'cancel', (event) => {
    if (event.target !== dialog) return;
    event.preventDefault();
    if (busy) {
      controller?.abort();
      setStatus(t('interface:cancellationRequestedWaitForTheOperationToFinishBeforeLeaving'));
    } else close();
  });
  listen(dialog, 'keydown', (event) => {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      !['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key) ||
      !['button', 'a'].includes(event.target?.tagName?.toLowerCase())
    )
      return;
    const controls = [...dialog.querySelectorAll('button,input,select,audio,a')].filter(
      (element) =>
        !element.disabled &&
        !element.hidden &&
        !element.closest?.('[hidden],[inert]') &&
        (typeof element.getClientRects !== 'function' || element.getClientRects().length > 0),
    );
    const at = controls.indexOf(doc.activeElement);
    const delta = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
    controls[(at + delta + controls.length) % controls.length]?.focus();
    event.preventDefault();
  });
  tracksSelect.element.onchange = () => renderTrack();
  playlistsSelect.element.onchange = () => renderPlaylist();
  scope.element.onchange = () => renderAssignments();
  onlineSearch.element.oninput = () => renderOnlineCatalogue();
  for (const checkbox of onlineStyleInputs.values())
    checkbox.onchange = () => renderOnlineCatalogue();
  onlineCollection.element.onchange = () => renderOnlineCatalogue();
  seek.element.onchange = () => playback(() => player.seek(Number(seek.element.value)));
  volume.element.oninput = () =>
    playback(async () => {
      const value = Number(volume.element.value);
      player.setVolume(value);
      await onVolume(value);
    });
  auditionSeek.element.onchange = () =>
    playback(() => {
      const value = Number(auditionSeek.element.value),
        duration = audition.duration;
      if (
        !auditionURL ||
        busy ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        !Number.isFinite(value)
      )
        return;
      audition.currentTime = Math.max(0, Math.min(duration, value));
    });
  auditionVolume.element.oninput = () => {
    const value = Number(auditionVolume.element.value);
    if (auditionURL && !busy && Number.isFinite(value)) {
      const local = Math.max(0, Math.min(1, value));
      if (auditionMaster) {
        auditionLocalVolume = local;
        auditionMaster.setLocal({ volume: local });
      } else audition.volume = local;
    }
  };
  if (auditionMaster)
    listen(audition, 'play', () => {
      const active = !disposed && dialog.open && auditionURL !== null;
      auditionMaster.setLocal({ muted: !active });
      if (!active) audition.pause();
    });
  for (const type of [
    'loadedmetadata',
    'durationchange',
    'timeupdate',
    'play',
    'pause',
    'volumechange',
  ])
    listen(audition, type, updateAudition);
  listen(audition, 'ended', () => {
    void playback(() => stopAudition(true));
  });
  listen(audition, 'error', () => {
    if (!auditionURL) return;
    void playback(async () => {
      await stopAudition(true);
      throw new Error(t('interface:theAuditionCouldNotDecodeThisTrackRestoreOrReplace'));
    });
  });
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) {
      const intended = restoreMusic;
      void playback(async () => {
        await stopAudition(false);
        // Restore only remembered intent. The host's focus/lifecycle handler
        // decides when actual listening may resume; never play a hidden page.
        if (intended && !disposed) player.setIntent(true);
      });
    }
  });
  function dispose() {
    if (disposed) return;
    controller?.abort();
    onlineCatalogueController?.abort();
    onlineCatalogueController = null;
    onlineCatalogueGeneration++;
    disposed = true;
    feedback.dispose();
    transportFeedback.dispose();
    auditionFeedback.dispose();
    void stopAudition(false);
    auditionMaster?.dispose();
    for (const unbind of bindings) unbind();
    invalidateBackup();
    dialog.remove();
    style.remove();
  }
  render();
  return Object.freeze({
    open,
    close,
    update,
    dispose,
    element: dialog,
    isOpen: () => !disposed && dialog.open,
  });
}
