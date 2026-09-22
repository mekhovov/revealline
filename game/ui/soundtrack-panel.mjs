import { createOperationStatus } from './operation-status.mjs';
import { bindAudioMasterMedia } from './audio-master.mjs';
import {
  BUILTIN_SOUNDTRACK_PLAYLISTS,
  BUILTIN_SOUNDTRACK_TRACKS,
  SOUNDTRACK_LIMITS,
  SOUNDTRACK_GENRES,
  SOUNDTRACK_GENRE_LABELS,
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

const copy = (value) => structuredClone(value);
const message = (error) => error?.message || String(error);
const seconds = (value = 0) =>
  `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
const bytes = (value) => `${(value / 1024 / 1024).toFixed(1)} MiB`;

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
  catalogue = null,
  readAsset,
} = {}) {
  if (!doc?.body || !store?.read || !store?.commit || !player?.snapshot)
    throw new Error('Soundtrack panel requires a document, store and player.');
  if (adoptLibrary !== null && typeof adoptLibrary !== 'function')
    throw new TypeError('Soundtrack library adoption must be a host function.');
  if (
    musicSession &&
    (typeof musicSession.play !== 'function' || typeof musicSession.pause !== 'function')
  )
    throw new TypeError('Soundtrack music session requires Play and Pause controls.');
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
  let auditionURL = null,
    auditionToken = 0,
    auditionController = null,
    restoreMusic = false;
  let albumCatalog = null,
    albumEditors = null,
    albumGeneration = 0;
  const albumControls = new Map();
  const node = (tag, id, text, attrs = {}) => {
    const element = doc.createElement(tag);
    if (id) {
      element.id = `soundtrack-${id}`;
    }
    if (text !== undefined && text !== null) element.textContent = text;
    for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
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
  const heading = node('h2', 'title', 'MUSIC PLAYER');
  const status = node('p', 'status', 'Open the studio to load your local music.', {
    role: 'status',
    'aria-live': 'polite',
  });

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
    'Custom music stays in this browser. Export a .rlsound file to keep its original bytes.',
    { class: 'micro-note' },
  );
  const closeButton = button('close', 'Close studio', () => close());
  const cancelButton = button('cancel', 'Cancel operation', () => {
    controller?.abort();
    setStatus('Cancellation requested…');
  });
  cancelButton.hidden = true;
  const saveButton = button('save', 'Save all changes', () =>
    task('Verifying and saving the music library…', (signal) => commitDraft(signal)),
  );
  const undoButton = button('undo', 'Undo unsaved changes', () => {
    if (!saved || busy) return;
    invalidateBackup();
    draft = adopt(saved.library);
    assets = [...saved.assets];
    dirty = false;
    render();
    setStatus('Restored the saved library. Playback is unchanged.');
  });
  const reloadButton = button('reload', 'Reload latest saved', () => reload());
  const stateLine = node('p', 'draft-state', '', { class: 'micro-note' });
  const now = node('p', 'now', 'Music is ready.', { role: 'status', 'aria-live': 'off' });
  const nowSources = node('div', 'now-sources');
  const transportStatus = node('p', 'loading');
  const transportFeedback = createOperationStatus(transportStatus);
  let transportActivity = null,
    auditionActivity = null;
  const seek = input('seek', 'Track position', { type: 'range', min: '0', max: '0', step: '0.1' });
  const volume = input('volume', 'Music volume', {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.01',
  });
  const selection = input('selection', 'Playback playlist', { tag: 'select' });
  const masterStatus = node('p', 'master-status', '', { role: 'status', 'aria-live': 'polite' });
  const masterToggle = button('master-mute', 'Unmute master sound', () =>
    changeMaster('muted', !audioMaster.snapshot().muted),
  );
  const masterVolume = input('master-volume', 'Master sound volume', {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.01',
  });
  const masterControls = advancedSection(
    'sound',
    'Sound controls',
    'Master volume and mute',
    row(masterToggle),
    masterVolume.field,
    masterStatus,
  );
  masterControls.hidden = !audioMaster;
  function updateMaster() {
    if (!audioMaster || disposed) return;
    const state = audioMaster.snapshot();
    masterToggle.textContent = state.muted ? 'Unmute master sound' : 'Mute master sound';
    masterVolume.element.value = String(state.volume);
    masterStatus.textContent =
      state.muted || state.volume === 0
        ? 'Master sound is muted. Play and audition keep their own playback state.'
        : 'Master sound applies to music, effects and auditions. Playback controls stay independent.';
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
        masterStatus.textContent += ` ${result.warning || 'The setting is active for this session but could not be saved.'}`;
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
    return task('Saving your playlist choice…', async (signal) => {
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
          (start ? 'Playlist selected and playing.' : 'Playlist selected. Playback is unchanged.'),
      );
    });
  }
  const useSelection = button('use-selection', 'Play this playlist', () =>
    usePlaylist(selection.element.value || null, { start: true }),
  );
  const genreNames = Object.entries(SOUNDTRACK_GENRE_LABELS);
  const listeningMode = input('listening-mode', 'Music selection', { tag: 'select' });
  options(listeningMode.element, [
    ['auto', 'Automatic — match this world'],
    ...genreNames,
    ['fusion', 'Fusion'],
    ['mix', 'My Mix'],
  ]);
  const mixGenres = genreNames.map(([id, label]) => ({
    id,
    ...input(`mix-${id}`, label, { type: 'checkbox' }),
  }));
  const installedOnly = input('installed-only', 'Installed only — use downloaded music', {
    type: 'checkbox',
  });
  const recordingMode = input(
    'recording-mode',
    'Recording mode — verified gameplay-video permissions',
    { type: 'checkbox' },
  );
  const recordingStatus = node('p', 'recording-status', '', { class: 'micro-note' });
  const useListening = (chosen, { start = false } = {}) => {
    return task('Saving your music selection…', async (signal) => {
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
      await notifyPlayback();
      setStatus(
        committed.warning ||
          (start
            ? 'Music selection saved and playing. Unavailable styles remain silent.'
            : 'Music selection saved. Playback is unchanged; unavailable styles remain silent.'),
      );
    });
  };
  const applyListening = button('apply-listening', 'Save listening preferences', () => {
    const chosen = {
      mode: listeningMode.element.value,
      genres: mixGenres.filter(({ element }) => element.checked).map(({ id }) => id),
      installedOnly: installedOnly.element.checked,
      recordingMode: recordingMode.element.checked,
    };
    return useListening(chosen);
  });
  const listeningSection = advancedSection(
    'listening',
    'Filters & custom mix',
    'Installed music, recording mode and genre combinations',
    listeningMode.field,
    row(...mixGenres.map(({ field }) => field)),
    installedOnly.field,
    recordingMode.field,
    recordingStatus,
    applyListening,
  );
  listeningSection.hidden = !catalogue;
  const quickStyle = input('quick-style', 'Music style', { tag: 'select' });
  options(quickStyle.element, [
    ...genreNames,
    ['fusion', 'Fusion'],
    ['auto', 'Automatic — match this world'],
    ['mix', 'My Mix'],
  ]);
  const quickStatus = node('p', 'quick-status', '', {
    class: 'soundtrack-quick-status',
    role: 'status',
    'aria-live': 'polite',
  });
  const playAll = button('play-all', 'Shuffle all music', () =>
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
  const playStyle = button('play-style', 'Play this style', () =>
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
    'Pick the music',
    node('p', null, 'Start every song on shuffle, choose a style, or jump to a playlist.', {
      class: 'soundtrack-lede',
    }),
    quickStatus,
    quickGrid,
  );
  quickListen.classList.add('soundtrack-listen-card');
  quickListen.hidden = !catalogue;
  const allCard = node('div', null, null, { class: 'soundtrack-choice soundtrack-choice-all' });
  allCard.append(
    node('span', null, 'ALL TRACKS', { class: 'soundtrack-choice-kicker' }),
    node('strong', null, 'Everything, shuffled'),
    node('p', null, 'A no-repeat mix across every available style.'),
    playAll,
  );
  const styleCard = node('div', null, null, { class: 'soundtrack-choice' });
  styleCard.append(
    node('span', null, 'STYLE', { class: 'soundtrack-choice-kicker' }),
    quickStyle.field,
    playStyle,
  );
  const playlistCard = node('div', null, null, { class: 'soundtrack-choice' });
  playlistCard.append(
    node('span', null, 'PLAYLIST', { class: 'soundtrack-choice-kicker' }),
    selection.field,
    useSelection,
  );
  quickGrid.append(allCard, styleCard, playlistCard);
  const transport = section(
    'Now playing',
    now,
    nowSources,
    transportStatus,
    row(
      button('previous', 'Previous', () => controlMusic(() => player.previous())),
      button('play', 'Play music', () =>
        controlMusic(() => (musicSession ? musicSession.play() : player.play()), true),
      ),
      button('pause', 'Pause music', () =>
        controlMusic(() => (musicSession ? musicSession.pause() : player.pause())),
      ),
      button('next', 'Next', () => controlMusic(() => player.next())),
    ),
    seek.field,
    volume.field,
  );
  transport.classList.add('soundtrack-now-card');
  // Hosts without the catalogue still expose built-in and imported playlists.
  if (!catalogue) transport.append(selection.field, useSelection);
  const tracksSelect = input('tracks', 'Tracks', { tag: 'select', size: '7' });
  const fileInput = input('mp3-files', 'Add MP3 files', {
    type: 'file',
    accept: '.mp3,audio/mpeg',
    multiple: '',
  });
  const importButton = button('import-mp3', 'Import selected MP3s', () => importMP3Files());
  const trackTitle = input('track-title', 'Track title', { maxlength: '120' });
  const trackArtist = input('track-artist', 'Artist', { maxlength: '160' });
  const rightsKind = input('rights-kind', 'Source declaration', { tag: 'select' });
  options(rightsKind.element, [
    ['personal', 'Personal local upload'],
    ['original', 'Original work'],
    ['licensed', 'Licensed work'],
  ]);
  const rightsCredit = input('rights-credit', 'Credit', { maxlength: '280' });
  const rightsLicense = input('rights-license', 'License / permission', { maxlength: '280' });
  const rightsSource = input('rights-source', 'Source / provenance', { maxlength: '1024' });
  const trackGenre = input('track-genre', 'Primary music family', { tag: 'select' });
  const trackFusion = input('track-fusion', 'Fusion with', { tag: 'select' });
  options(trackGenre.element, [['', 'Unclassified'], ...genreNames]);
  options(trackFusion.element, [['', 'No second family'], ...genreNames]);
  const trackRole = input('track-role', 'Use in', { tag: 'select' });
  options(trackRole.element, [
    ['any', 'Any scene'],
    ['menu', 'Menus'],
    ['gameplay', 'Gameplay'],
    ['intense', 'Finales / high intensity'],
  ]);
  const trackEnergy = input('track-energy', 'Energy (1 calm — 5 intense)', {
    type: 'number',
    min: '1',
    max: '5',
  });
  const trackThemes = input(
    'track-themes',
    'Worlds (comma separated: retro, fpv, ukraine, coupa)',
    { maxlength: '160' },
  );
  const tagFields = section(
    'Musical character',
    trackGenre.field,
    trackFusion.field,
    trackRole.field,
    trackEnergy.field,
    trackThemes.field,
  );
  tagFields.hidden = !catalogue;
  const trackInfo = node('p', 'track-info', '', { class: 'micro-note' });
  const trackSources = node('div', 'track-sources');
  const downloadTrack = button('download-track', 'Prepare original MP3 download', () =>
    task('Verifying original MP3 for download…', async (signal) => {
      const track = tracks().find((item) => item.id === tracksSelect.element.value);
      if (
        track?.kind !== 'mp3' ||
        soundtrackRights(track, { catalogue: catalogue ?? undefined }).redistribute !== 'allowed'
      )
        throw new Error(
          'This recording is available for in-game playback only; standalone download is not permitted.',
        );
      const blob =
        assets.find((asset) => asset.sha256 === track.asset.sha256)?.blob ??
        (await readAsset?.(track.asset.sha256, { signal, purpose: 'export' }));
      if (!blob) throw new Error('The original recording is unavailable. Restore it or go online.');
      const actual = await inspectMP3(blob, { signal });
      if (actual.sha256 !== track.asset.sha256 || actual.bytes !== track.asset.bytes)
        throw new Error('The recording differs from its catalogue.');
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
      setStatus('Original MP3 verified. Choose Download prepared MP3 below to save it.');
    }),
  );
  const applyTrack = button('apply-track', 'Apply track details to draft', () =>
    attempt(() => {
      const id = tracksSelect.element.value;
      edit((value) => {
        const track = value.tracks.find((item) => item.id === id);
        if (!track) throw new Error('Built-in tracks cannot be edited.');
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
      setStatus('Track details added to the draft. Save all changes to keep them.');
    }),
  );
  const deleteTrack = button('delete-track', 'Remove track from draft', () =>
    attempt(() => {
      const id = tracksSelect.element.value;
      edit((value) => {
        if (!value.tracks.some((item) => item.id === id))
          throw new Error('Built-in tracks are retained.');
        const references = value.playlists.filter((item) => item.trackIds.includes(id));
        if (references.length)
          throw new Error(
            `Remove this track from its playlists first: ${references.map((item) => item.title).join(', ')}.`,
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
      setStatus('Track removed from the draft; the saved library is unchanged until Save.');
    }),
  );
  const audition = node('audio', 'audition', null, {
    controls: '',
    preload: 'metadata',
    'aria-label': 'Imported track audition',
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
  const auditionButton = button('audition-track', 'Audition MP3', () =>
    playback(() => startAudition()),
  );
  const stopAuditionButton = button('stop-audition', 'Finish audition', () =>
    playback(() => stopAudition(true)),
  );
  const auditionSeek = input('audition-seek', 'Audition position', {
    type: 'range',
    min: '0',
    max: '0',
    step: '0.5',
  });
  const auditionVolume = input('audition-volume', 'Audition volume', {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.05',
  });
  const toggleAudition = button('toggle-audition', 'Pause audition', () =>
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
          message: 'Resuming audition…',
          stage: 'playing',
          isCurrent: () => !disposed && dialog.open && token === auditionToken,
        });
        auditionActivity = lease;
        try {
          auditionMaster?.setLocal({ muted: false });
          await audition.play();
          lease.finish({ message: 'Audition playing.' });
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
    'Audition controls',
    row(toggleAudition),
    auditionSeek.field,
    auditionVolume.field,
  );
  auditionControls.hidden = true;
  const tracksSection = advancedSection(
    'library',
    'Add & edit music',
    'Upload MP3s, edit credits and audition tracks',
    node(
      'p',
      null,
      'Batch import keeps original MP3 bytes. Each file must be at most 32 MiB and 12 minutes. New imports start as personal local uploads; edit the declaration before publishing.',
      { class: 'micro-note' },
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
  const playlistsSelect = input('playlists', 'Playlists', { tag: 'select', size: '5' });
  const playlistTitle = input('playlist-title', 'Playlist title', { maxlength: '120' });
  const order = input('order', 'Playback order', { tag: 'select' });
  options(order.element, [
    ['ordered', 'In order'],
    ['shuffle', 'Shuffle without repeats until every entry played'],
  ]);
  const repeat = input('repeat', 'Repeat', { tag: 'select' });
  options(repeat.element, [
    ['all', 'Repeat all'],
    ['one', 'Repeat one'],
    ['off', 'Stop at the end'],
  ]);
  const entries = input('entries', 'Playlist entries', { tag: 'select', size: '7' });
  const addTrack = input('add-track', 'Track to add', { tag: 'select' });
  const createPlaylist = button('create-playlist', 'New playlist with selected track', () =>
    attempt(() => {
      const id = makeId('playlist');
      edit((value) =>
        value.playlists.push({
          id,
          title: 'New playlist',
          trackIds: [tracksSelect.element.value],
          order: 'ordered',
          repeat: 'all',
        }),
      );
      render({ playlistId: id });
      setStatus('New playlist added to the draft. Edit its title, order and entries, then Save.');
    }),
  );
  const clonePlaylist = button('clone-playlist', 'Clone selected playlist', () =>
    attempt(() => {
      const source = playlists().find((item) => item.id === playlistsSelect.element.value);
      const id = makeId('playlist');
      edit((value) =>
        value.playlists.push({ ...copy(source), id, title: `${source.title.slice(0, 113)} copy` }),
      );
      render({ playlistId: id });
      setStatus('Playlist cloned. The draft copy is editable.');
    }),
  );
  const applyPlaylist = button('apply-playlist', 'Apply playlist details to draft', () =>
    attempt(() => {
      changePlaylist((item) =>
        Object.assign(item, {
          title: playlistTitle.element.value,
          order: order.element.value,
          repeat: repeat.element.value,
        }),
      );
      render();
      setStatus(
        'Playlist details added to the draft. The current song will finish normally after Save.',
      );
    }),
  );
  const appendEntry = button('add-entry', 'Add selected track', () =>
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
          throw new Error('Choose an entry that can move in that direction.');
        [item.trackIds[at], item.trackIds[at + delta]] = [
          item.trackIds[at + delta],
          item.trackIds[at],
        ];
      });
      renderPlaylist(String(at + delta));
      dirtyState();
    });
  const up = button('entry-up', 'Move entry up', () => moveEntry(-1));
  const down = button('entry-down', 'Move entry down', () => moveEntry(1));
  const removeEntry = button('remove-entry', 'Remove selected entry', () =>
    attempt(() => {
      const at = Number(entries.element.value);
      changePlaylist((item) => {
        if (item.trackIds.length === 1)
          throw new Error('A playlist needs at least one track. Remove the playlist instead.');
        if (!Number.isInteger(at) || at < 0 || at >= item.trackIds.length)
          throw new Error('Select a playlist entry.');
        item.trackIds.splice(at, 1);
      });
      renderPlaylist();
      dirtyState();
    }),
  );
  const deletePlaylist = button('delete-playlist', 'Remove playlist from draft', () =>
    attempt(() => {
      const id = playlistsSelect.element.value;
      edit((value) => {
        if (!value.playlists.some((item) => item.id === id))
          throw new Error('Clone built-in playlists to edit them.');
        if (
          value.selection.playlistId === id ||
          value.assignments.some((item) => item.playlistId === id)
        )
          throw new Error(
            'Choose another playback playlist and remove assignments before deleting this playlist.',
          );
        value.playlists = value.playlists.filter((item) => item.id !== id);
      });
      render();
      setStatus('Playlist removed from the draft.');
    }),
  );
  const playlistSection = advancedSection(
    'playlists',
    'Create playlists',
    'Order, shuffle and repeat your own selections',
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
  const scope = input('scope', 'Assign selected playlist to', { tag: 'select' });
  options(scope.element, [
    ['global', 'Whole game'],
    ['theme', 'Current theme'],
    ['campaign', 'Current campaign edition'],
    ['map', 'Current map edition'],
  ]);
  const key = node('p', 'context-key', '', { class: 'micro-note' });
  const assignments = input('assignments', 'Saved / drafted assignments', {
    tag: 'select',
    size: '4',
  });
  const assign = button('assign', 'Assign playlist to this context', () =>
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
      setStatus(
        'Assignment added to the draft. Automatic playback uses map, campaign, theme, then global; explicit selection overrides these.',
      );
    }),
  );
  const unassign = button('unassign', 'Remove selected assignment', () =>
    attempt(() => {
      const at = Number(assignments.element.value);
      edit((value) => {
        if (!Number.isInteger(at) || at < 0 || at >= value.assignments.length)
          throw new Error('Select an assignment to remove.');
        value.assignments.splice(at, 1);
      });
      renderAssignments();
      dirtyState();
    }),
  );
  const assignmentSection = advancedSection(
    'assignments',
    'Match music to worlds',
    'Map, campaign and theme assignments',
    node(
      'p',
      null,
      'These exact edition keys come from the game. Choose Automatic in Playback playlist to follow authored assignments.',
      { class: 'micro-note' },
    ),
    scope.field,
    key,
    assign,
    assignments.field,
    unassign,
  );
  const bundleInput = input('bundle-file', 'Soundtrack recovery or album file (.rlsound)', {
    type: 'file',
    accept: '.rlsound,application/octet-stream',
  });
  const bundleImport = button('import-bundle', 'Review backup as replacement draft', () =>
    task('Checking soundtrack backup and original audio…', async (signal) => {
      const source = bundleInput.element.files?.[0];
      if (!source) throw new Error('Choose a .rlsound backup first.');
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
      setStatus(
        `Backup verified: ${draft.tracks.length} custom tracks, ${draft.playlists.length} custom playlists. ${recoveryNotice(draft)} Save all changes replaces the local library; Undo keeps the saved library.`,
      );
      bundleInput.element.value = '';
    }),
  );
  const bundleExport = button(
    'export-bundle',
    'Prepare saved-library backup (.rlsound)',
    async () => {
      const complete = await task(
        'Verifying soundtrack recovery data and permitted originals…',
        async (signal) => {
          if (!saved) throw new Error('Load the saved music library first.');
          invalidateBackup();
          activity?.update({
            message: 'Verifying and packing soundtrack originals…',
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
            recoveryNotice: recoveryNotice(saved.library),
            url: typeof download === 'function' ? null : URLImpl.createObjectURL(blob),
          };
          setStatus(
            `Backup prepared. ${preparedBackup.recoveryNotice} Choose Download prepared backup to request the file. Unsaved draft changes are excluded.`,
          );
        },
      );
      if (complete && preparedBackup && dialog.open && !disposed) bundleDownload.focus();
      return complete;
    },
  );
  const shareImport = button('add-share', 'Add album file to draft', () =>
    task('Checking and adding the shared album…', async (signal) => {
      const source = bundleInput.element.files?.[0];
      if (!source) throw new Error('Choose an album .rlsound file first.');
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
      setStatus(
        'Album added to the draft. Your selected music and assignments are retained. Save all changes to keep it.',
      );
    }),
  );
  const shareExport = button('export-share', 'Prepare selected playlist as album', () =>
    task('Preparing a shareable album…', async (signal) => {
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
        throw new Error('This album exceeds 64 MiB. Split its playlist into smaller volumes.');
      throwIfSoundtrackAborted(signal);
      invalidateBackup();
      preparedBackup = {
        blob,
        filename: 'RevealLine-album.rlsound',
        generation: saved.generation,
        share: true,
        recoveryNotice: recoveryNotice(library),
        url: typeof download === 'function' ? null : URLImpl.createObjectURL(blob),
      };
      setStatus(
        `Album prepared from the current playlist draft. ${preparedBackup.recoveryNotice} Use Download prepared file to save it. Your library is unchanged.`,
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
    'Download prepared backup',
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
      return task('Requesting the prepared backup from the download adapter…', async (signal) => {
        await download(prepared.blob, prepared.filename, { signal });
        if (!disposed && preparedBackup === prepared)
          setStatus(
            'Download request handed to the host. Confirm the destination there; the prepared backup is available to retry.',
          );
      });
    }
    setStatus(
      'Download requested. Confirm it in your browser. If no file appears, choose Download prepared backup again.',
    );
    // No async work, synthetic click or automatic navigation here. The visible
    // anchor's default action uses the already prepared, retained Blob URL.
    return true;
  };
  const discardBackup = button('discard-backup', 'Discard prepared copy', () => {
    if (busy || disposed) return;
    invalidateBackup();
    setStatus(
      'Prepared copy discarded. Saved music is unchanged; the browser controls any download already requested.',
    );
  });
  const backupInfo = node('p', 'backup-info', '', { class: 'micro-note' });
  const backupReady = node('div', 'backup-ready', null, { class: 'soundtrack-backup-ready' });
  backupReady.append(backupInfo, row(bundleDownload, discardBackup));
  const transferSection = advancedSection(
    'backup',
    'Backups & album files',
    'Import, export and restore .rlsound files',
    node(
      'p',
      null,
      'This separate soundtrack file contains permitted personal, installed and explicitly referenced MP3 originals, and lists songs requiring online restoration. Unused online catalogue recordings are rediscovered from the game catalogue without downloading their audio for backup. A normal game JSON backup does not include this audio. Local storage availability is not a guarantee that this browser retains files indefinitely.',
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
  const albumBrowse = button('browse-albums', 'Browse optional albums', () =>
    albumTask(albumBrowse, 'Loading album descriptions…', async (signal) => {
      const catalog = await fetchSoundtrackAlbumCatalog({ ...albumDownload, signal });
      throwIfSoundtrackAborted(signal);
      albumCatalog = catalog;
      renderAlbums();
      setStatus(
        catalog.albums.length
          ? `${catalog.albums.length} optional albums. Review an addition before saving; your current song and draft are kept.`
          : 'No optional albums are published for installation in this edition. You can import MP3s and album files now.',
      );
    }),
  );
  const albumSection = advancedSection(
    'community',
    'Community downloads',
    'Creator albums, credits and optional offline copies',
    node(
      'p',
      null,
      'Browse albums and credits, then Add to draft to download and preview individual tracks. Remove offline download keeps track details and playlists; Download again restores the album. Save all changes confirms the draft. Your current playlist stays selected.',
      { class: 'micro-note' },
    ),
    node('a', 'licensed-previews', 'Browse licensed MP3 previews (opens a new tab)', {
      href: 'https://mekhovov.github.io/revealline-soundtracks-01/',
      target: '_blank',
      rel: 'noopener noreferrer',
      class: 'button secondary',
    }),
    node(
      'p',
      'licensed-previews-info',
      catalogue?.tracks.some((track) => track.archiveId)
        ? 'The separate archive hosts these licensed recordings and their creator credits. Choose a built-in album or music style here to listen online. MP3 and album-file downloads remain available for manual import. Full musical suitability review is still pending.'
        : 'The separate archive has 70 creator-licensed previews with credits and license notices. Download selected MP3s, then import them through Add MP3 files. They are not installed automatically; musical suitability has not been reviewed.',
      { class: 'micro-note' },
    ),
    albumBrowse,
    albumList,
  );
  const originalAlbums = node('div', 'original-albums');
  const originalSection = advancedSection(
    'offline',
    'Offline album downloads',
    'Install or remove verified recordings for offline play',
    node(
      'p',
      'original-status',
      catalogue?.tracks.length
        ? `${catalogue.tracks.length} recordings available. Choose an album or music style, then Play music. Songs are downloaded and checked individually before playback; offline downloads are optional.`
        : 'No online recordings are published in this edition. Import MP3s or an album file to build your playlist.',
      { class: 'micro-note' },
    ),
    originalAlbums,
  );
  originalSection.hidden = !catalogue;
  const builtInAlbums = catalogue ? soundtrackAlbumPlaylists(draft) : [];
  const albumTrackIds = new Set(builtInAlbums.flatMap((album) => album.trackIds));
  const catalogueControls = [];
  const collections = [
    ...genreNames.map(([genre, title]) => ({
      id: genre,
      title,
      accepts: (track) =>
        track.tags.genres[0] === genre && !track.id.startsWith('builtin.catalog.ua-fpv.'),
    })),
    {
      id: 'ua-fpv',
      title: 'UA-FPV',
      accepts: (track) => track.id.startsWith('builtin.catalog.ua-fpv.'),
    },
  ];
  const volumes = [
    ...builtInAlbums.map((album) => ({
      id: `album-${album.id.slice('builtin.album.'.length)}`,
      title: album.title,
      playlistId: album.id,
      tracks: album.trackIds.map((id) => catalogue.tracks.find((track) => track.id === id)),
    })),
    ...collections.flatMap(({ id, title, accepts }) => {
      const list = (catalogue?.tracks ?? []).filter(
        (track) =>
          !albumTrackIds.has(track.id) &&
          accepts(track) &&
          soundtrackRights(track, { catalogue }).offlineCache === 'allowed',
      );
      return Array.from({ length: Math.ceil(list.length / 6) }, (_, i) => ({
        id: `${id}-${i + 1}`,
        title: `${title} · Volume ${i + 1}`,
        tracks: list.slice(i * 6, (i + 1) * 6),
      }));
    }),
  ];
  for (const volume of volumes) {
    const offlineTracks = volume.tracks.filter(
      (track) => soundtrackRights(track, { catalogue }).offlineCache === 'allowed',
    );
    const ids = new Set(offlineTracks.map((track) => track.id));
    const availability = node('p', `availability-${volume.id}`, '', { class: 'micro-note' });
    const select = volume.playlistId
      ? button(`select-${volume.id}`, 'Save & use album', () => usePlaylist(volume.playlistId))
      : null;
    const install = button(`download-${volume.id}`, 'Download for offline', () =>
      task('Downloading recordings into the draft…', async (signal) => {
        if (!readAsset) throw new Error('Recording downloads are unavailable.');
        if (
          offlineTracks.reduce((sum, track) => sum + track.asset.bytes, 0) >
          SOUNDTRACK_LIMITS.optionalBundleTargetBytes
        )
          throw new Error(
            'This volume exceeds the 64 MiB download budget. Its publisher must split it.',
          );
        const additions = new Map(assets.map((asset) => [asset.sha256, asset]));
        const expected = new Map(assets.map((asset) => [asset.sha256, asset.blob.size]));
        for (const track of offlineTracks) expected.set(track.asset.sha256, track.asset.bytes);
        if (
          [...expected.values()].reduce((sum, size) => sum + size, 0) >
          SOUNDTRACK_LIMITS.managedBytes
        )
          throw new Error(
            'This download exceeds the 256 MiB audio budget. Remove an offline volume first.',
          );
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
        setStatus('Volume downloaded and checked. Save all changes to install it offline.');
      }),
    );
    const remove = button(`offload-${volume.id}`, 'Remove offline download', () =>
      attempt(() => {
        edit((value) => {
          value.installedTrackIds = value.installedTrackIds.filter((id) => !ids.has(id));
        });
        pruneAssets();
        render();
        setStatus(
          'Offline copies removed from the draft. Playlists are retained; Save all changes confirms removal.',
        );
      }),
    );
    originalAlbums.append(
      section(
        volume.title,
        node(
          'p',
          null,
          `${volume.tracks.length} tracks · ${bytes(volume.tracks.reduce((sum, track) => sum + track.asset.bytes, 0))}`,
        ),
        availability,
        ...(select
          ? [
              node(
                'p',
                null,
                'Album selection saves your draft and keeps paused music paused. Use Play music to start listening.',
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
    const present = new Set(assets.map((asset) => asset.sha256));
    for (const { volume, offlineTracks, ids, availability, install, remove } of catalogueControls) {
      const local = volume.tracks.filter((track) => present.has(track.asset.sha256)).length;
      availability.textContent = `${local} of ${volume.tracks.length} recordings available locally${dirty ? ' in the draft' : ''}. ${local === volume.tracks.length ? 'Ready for offline listening.' : draft.listening.installedOnly ? 'Installed only is on; other recordings stay silent until downloaded.' : 'Other recordings are available online without installing this album.'}${offlineTracks.length !== volume.tracks.length ? ' Some recordings do not allow offline storage.' : ''}`;
      install.disabled =
        busy ||
        !saved ||
        !readAsset ||
        !offlineTracks.length ||
        offlineTracks.every((track) => present.has(track.asset.sha256));
      remove.disabled = busy || !saved || !draft.installedTrackIds.some((id) => ids.has(id));
    }
  }
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
  function renderAlbums() {
    if (!albumCatalog) return;
    albumControls.clear();
    albumList.replaceChildren(
      ...albumCatalog.albums.map((album) => {
        const add = button(`album-add-${album.id}`, 'Add to draft', () =>
          albumTask(
            add,
            `Downloading and checking ${album.title}…`,
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
                throw new Error(
                  'The music draft changed while checking this album. Review it again.',
                );
              invalidateBackup();
              draft = prepared.library;
              assets = [...prepared.assets];
              dirty = true;
              setStatus(
                restoring
                  ? `${album.title} downloaded and verified. Save all changes restores offline audio; track details, playlists and playback are kept.`
                  : `${album.title} verified: ${merged.addedTracks} new tracks, ${merged.addedPlaylists} new playlist. Save all changes adds this album; Undo keeps the saved library. Playback is unchanged.`,
              );
            },
            () => saveButton,
          ),
        );
        const remove = button(`album-offload-${album.id}`, 'Remove offline download', () =>
          albumTask(
            remove,
            `Removing ${album.title} offline copies from the draft…`,
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
              setStatus(
                `${album.title}: ${bytes(removed.removedBytes)} removed from the draft. Track details, credits and playlist references are kept. ${removed.retainedSharedBytes ? `${bytes(removed.retainedSharedBytes)} shared with other installed tracks is retained. ` : ''}Save all changes confirms removal; Undo restores the saved library.`,
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
        const source = node('a', null, 'Creator and license source', {
          href: album.source,
          target: '_blank',
          rel: 'noopener noreferrer',
        });
        return section(
          album.title,
          node(
            'p',
            null,
            `${album.genre} · ${album.library.tracks.length} tracks · ${bytes(album.bytes)}`,
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
      add.textContent = state.known ? 'Download again' : 'Add to draft';
      add.disabled = busy || !saved;
      remove.disabled = busy || !saved || !state.known || state.offloaded;
      availability.textContent = !state.known
        ? 'Not added to this library.'
        : state.offloaded
          ? `Offline album removed${dirty ? ' in the draft' : ''}. Track details and playlists are retained. Choose Download again to restore its audio.${state.localCount ? ' Shared audio required by other installed tracks is still available.' : ''}`
          : state.downloaded
            ? `Audio available offline${dirty ? ' in the draft' : ''}.`
            : state.localCount
              ? `${state.localCount} of ${state.retainedCount} recordings available offline${dirty ? ' in the draft' : ''}. Choose Download again to restore the missing audio, or Remove offline download to remove the remaining copies.`
              : 'Local audio is unavailable. Choose Download again to restore this album.';
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
        ? 'Operation cancelled. The saved library was not changed by this cancelled operation.'
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
      if (!item) throw new Error('Clone this built-in playlist before editing it.');
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
      throw new Error(`This complete file exceeds ${bytes(limit)}. Use smaller albums.`);
    const originals = new Map(available.map((asset) => [asset.sha256, asset.blob]));
    const offloaded = new Set(soundtrackOffloadedBonusTrackIds(library));
    if (tracks.some((track) => offloaded.has(track.id) && !originals.has(track.asset.sha256)))
      throw new Error(
        'An album was removed from offline storage. Choose Download again in Community soundtracks and save it before preparing a complete file.',
      );
    const result = new Map();
    let total = 0;
    for (const track of tracks) {
      const hash = track.asset.sha256;
      if (result.has(hash)) continue;
      let blob = originals.get(hash);
      if (!blob && readAsset) blob = await readAsset(hash, { signal, purpose: 'export' });
      if (!blob)
        throw new Error(
          `The original recording for ${track.title} is unavailable. Restore it or go online before preparing a complete file.`,
        );
      throwIfSoundtrackAborted(signal);
      total += blob.size;
      if (blob.size !== track.asset.bytes || total > limit)
        throw new Error(
          'The recording size differs from its catalogue or exceeds the complete-file budget.',
        );
      result.set(hash, { sha256: hash, blob });
    }
    return [...result.values()];
  }
  function dirtyState() {
    stateLine.textContent = saved
      ? `${dirty ? 'Unsaved draft' : 'Saved'} · generation ${saved.generation} · ${draft.tracks.length} custom tracks · ${draft.playlists.length} custom playlists · ${bytes(assets.reduce((total, asset) => total + asset.blob.size, 0))} original audio`
      : 'Local library is unavailable. Built-in playback remains separate.';
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
    if (!plan.referenceOnlyTrackIds.length)
      return [
        'Contains every permitted personal, installed and explicitly referenced recording.',
        plan.notice,
      ]
        .filter(Boolean)
        .join(' ');
    const names = new Map(soundtrackTracks(library).map((track) => [track.id, track.title]));
    return `Requires online restoration for listed music: ${plan.referenceOnlyTrackIds.map((id) => names.get(id) ?? id).join(', ')}. ${plan.notice}`;
  }
  function renderBackup() {
    backupReady.hidden = preparedBackup === null;
    bundleDownload.disabled = busy || !preparedBackup;
    bundleDownload.setAttribute('aria-disabled', String(bundleDownload.disabled));
    discardBackup.disabled = busy || !preparedBackup;
    if (!preparedBackup) return;
    backupInfo.textContent = preparedBackup.recording
      ? `${bytes(preparedBackup.blob.size)} · exact original MP3 bytes, verified against the recording hash.`
      : preparedBackup.share
        ? `${bytes(preparedBackup.blob.size)} · selected draft playlist and every permitted referenced recording. ${preparedBackup.recoveryNotice ?? ''} Preparing an album does not save your library or write a file.`
        : `${bytes(preparedBackup.blob.size)} · saved generation ${preparedBackup.generation} · metadata and every permitted referenced recording. ${preparedBackup.recoveryNotice ?? ''} Unsaved draft edits are excluded. Preparation does not save a file to disk.`;
    bundleDownload.textContent = preparedBackup.recording
      ? 'Download prepared MP3'
      : preparedBackup.share
        ? 'Download prepared file'
        : 'Download prepared backup';
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
    trackInfo.textContent =
      track?.kind === 'mp3'
        ? `${seconds(track.asset.durationSeconds)} · ${bytes(track.asset.bytes)} · ${track.asset.sampleRate} Hz · original bytes ${assets.some((asset) => asset.sha256 === track.asset.sha256) ? 'present locally' : offloaded ? 'removed offline — choose Download again in Community soundtracks' : online ? 'available online · not downloaded' : 'MISSING — restore a complete backup'}`
        : 'Built-in procedural synth recipe. Use the playback playlist to listen; original finished albums are a separate content milestone.';
    if (track?.fileName) trackInfo.textContent += ` · File: ${track.fileName}`;
    if (policy && policy.redistribute !== 'allowed')
      trackInfo.textContent += ' · Standalone download is not permitted.';
    if (policy && policy.offlineCache !== 'allowed')
      trackInfo.textContent += ' · Offline installation is not permitted.';
    if (policy && draft.listening?.recordingMode && !recordingAllowed(track))
      trackInfo.textContent +=
        ' · Recording mode excludes this audition: gameplay-video permission or Content ID status is not verified.';
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
      throw new Error(`Choose a game ${selectedScope} before assigning its music.`);
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
      key.textContent = context.key ?? 'Global fallback for the whole game';
      assign.disabled = busy || !saved;
    } catch (error) {
      key.textContent = message(error);
      assign.disabled = true;
    }
    unassign.disabled = busy || !saved || !draft.assignments.length;
  }
  function render({ playlistId, trackId } = {}) {
    options(
      tracksSelect.element,
      tracks().map((item) => [
        item.id,
        `${item.kind === 'synth' ? 'Built-in · ' : ''}${item.title}`,
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
        `${item.id.startsWith('builtin.') ? 'Built-in · ' : ''}${item.title}`,
      ]),
      playlistId ?? playlistsSelect.element.value,
    );
    options(
      selection.element,
      [
        ['', catalogue ? 'Use selected style' : 'Automatic — follow map / campaign / theme'],
        ...playlists().map((item) => [item.id, item.title]),
      ],
      draft.selection.playlistId ?? '',
    );
    for (const control of columns.querySelectorAll('button,input,select'))
      control.disabled = busy || !saved;
    useSelection.disabled = busy || !saved;
    if (catalogue) {
      listeningMode.element.value = draft.listening.mode;
      quickStyle.element.value = draft.listening.mode;
      installedOnly.element.checked = draft.listening.installedOnly;
      recordingMode.element.checked = draft.listening.recordingMode;
      const excluded = (catalogue.tracks ?? []).filter((track) => !recordingAllowed(track)).length;
      recordingStatus.textContent = draft.listening.recordingMode
        ? `Recording mode is on. ${excluded} catalogue recording${excluded === 1 ? '' : 's'} excluded until gameplay-video permission and unregistered Content ID are verified. The same filter applies to auditions.`
        : 'Recording mode also filters auditions. Unknown gameplay-video or Content ID status is excluded; a game-use license alone is not recording clearance.';
      for (const { id, element } of mixGenres)
        element.checked = draft.listening.genres.includes(id);
      for (const control of listeningSection.querySelectorAll('button,input,select'))
        control.disabled = busy || !saved;
      for (const control of quickListen.querySelectorAll('button,input,select'))
        control.disabled = busy || !saved;
      const explicitPlaylist = playlists().find((item) => item.id === draft.selection.playlistId);
      const modeLabel =
        [['fusion', 'Fusion'], ['mix', 'All styles'], ['auto', 'Automatic'], ...genreNames].find(
          ([id]) => id === draft.listening.mode,
        )?.[1] ?? 'Music';
      quickStatus.textContent = explicitPlaylist
        ? `Selected playlist: ${explicitPlaylist.title}`
        : `Selected style: ${modeLabel} · shuffle · repeat all`;
    }
    cancelButton.hidden = !busy;
    closeButton.disabled = busy;
    reloadButton.disabled = busy;
    renderTrack();
    renderPlaylist();
    renderAssignments();
    refreshAlbumControls();
    refreshCatalogueControls();
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
    return `Library is saved, but the game refresh failed: ${message(error)}. Reload the studio to refresh it.`;
  }
  async function reload() {
    return task('Loading saved music and local audio…', async (signal) => {
      invalidateBackup();
      const value = await store.read({ signal });
      throwIfSoundtrackAborted(signal);
      await adoptSavedLibrary(value);
      throwIfSoundtrackAborted(signal);
      saved = value;
      draft = adopt(value.library);
      assets = [...value.assets];
      dirty = false;
      const warning = await notifyLibrary(value);
      setStatus(
        warning || 'Saved library loaded. Imports and edits remain drafts until Save all changes.',
      );
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
    if (!saved) throw new Error('Load the local library before saving.');
    invalidateBackup();
    pruneAssets();
    activity?.update({ message: 'Decoding and verifying the music library…', stage: 'verifying' });
    const prepared = await prepareSoundtrackLibrary(draft, assets, {
      signal,
      probeMedia,
      catalogue: catalogue ?? undefined,
    });
    const usage =
      typeof otherManagedBytes === 'function' ? await otherManagedBytes() : otherManagedBytes;
    activity?.update({ message: 'Saving the verified music library…', stage: 'saving' });
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
        warning: 'Library saved; the panel closed before refresh.',
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
      warning ||
        'Music library saved atomically. The current song continues; edited queues and automatic assignments apply at a song boundary.',
    );
    return { ...saved, warning, adopted };
  }
  async function importMP3Files() {
    return task('Inspecting selected MP3 files…', async (signal, progress) => {
      if (!saved) throw new Error('Load the local library before importing.');
      const files = [...(fileInput.element.files ?? [])];
      if (!files.length) throw new Error('Choose one or more MP3 files first.');
      if (
        files.length + draft.tracks.length + BUILTIN_SOUNDTRACK_TRACKS.length >
        SOUNDTRACK_LIMITS.tracks
      )
        throw new Error(
          'This batch would exceed the 128-track library limit, including built-in tracks.',
        );
      const next = copy(draft),
        added = new Map(assets.map((asset) => [asset.sha256, asset.blob]));
      let latest;
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        progress.update({
          message: `Inspecting ${file.name || 'MP3 audio'}…`,
          stage: 'verifying',
          progress: { completed: index, total: files.length, unit: 'tracks' },
        });
        const imported = await prepareMP3Import(
          file,
          {
            id: makeId('track'),
            ...(next.format === 'revealline-soundtrack.v3' ? { fileName: file.name } : {}),
            title:
              (file.name || 'Imported MP3').replace(/\.mp3$/i, '').slice(0, 120) || 'Imported MP3',
            artist: '',
            rights: {
              kind: 'personal',
              credit: 'Personal local upload',
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
          throw new Error('This draft exceeds the 256 MiB audio budget. Import fewer tracks.');
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
      setStatus(
        `${files.length} MP3 file${files.length === 1 ? '' : 's'} verified and added to the draft. Edit details or audition, then Save all changes.`,
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
    if (track?.kind !== 'mp3') throw new Error('Choose an MP3 to audition.');
    if (draft.listening?.recordingMode && !recordingAllowed(track))
      throw new Error(
        'Recording mode excludes this audition until gameplay-video permission and unregistered Content ID are verified.',
      );
    if (soundtrackRights(track, { catalogue: catalogue ?? undefined }).webPlayback !== 'allowed')
      throw new Error('This recording is not approved for playback in this edition.');
    if (soundtrackOffloadedBonusTrackIds(draft).includes(track.id))
      throw new Error('Choose Download again in Community soundtracks to audition this album.');
    const state = player.snapshot();
    const previous = restoreMusic || (state.desired ?? state.playing);
    const stopping = stopAudition(false);
    wakeAudio();
    restoreMusic = previous;
    player.pause();
    const token = ++auditionToken;
    const lease = auditionFeedback.begin({
      message: `Starting audition: ${track.title}…`,
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
      if (!blob)
        throw new Error(
          'This MP3 is unavailable. Download its album or restore a complete backup.',
        );
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
          message: `Auditioning ${track.title}. Finish audition returns to the previous music state.`,
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
    toggleAudition.textContent = audition.paused ? 'Resume audition' : 'Pause audition';
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
      sites.push({ label: 'Source website', url: track.rights.source });
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
      link.textContent = site.label || 'Source website';
      link.href = url.href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      container.append(link);
    }
  }
  function update(snapshot = player.snapshot()) {
    if (disposed) return;
    now.textContent = `${snapshot.track?.title ?? 'No track selected'}${snapshot.track?.artist ? ` · ${snapshot.track.artist}` : ''} · ${snapshot.status} · ${seconds(snapshot.positionSeconds)} / ${seconds(snapshot.durationSeconds)}${snapshot.pendingPlaylistId ? ' · playlist update queued' : ''}${snapshot.notice ? ` · ${snapshot.notice}` : ''}${snapshot.error ? ` · ${snapshot.error}` : ''}`;
    sourceLinks(nowSources, snapshot.track);
    if (snapshot.track?.fileName) now.textContent += ` · File: ${snapshot.track.fileName}`;
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
          ? 'Your prepared saved-library backup is still available to download. Unsaved draft changes are excluded.'
          : dirty
            ? 'Your unsaved draft is still here.'
            : 'Music library ready.',
      );
    }
  }
  function close({ restoreFocus = true, restoreMusic = true } = {}) {
    if (busy || disposed || !dialog.open) return false;
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
      setStatus('Cancellation requested. Wait for the operation to finish before leaving.');
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
      throw new Error(
        'The audition could not decode this track. Restore or replace the original MP3.',
      );
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
