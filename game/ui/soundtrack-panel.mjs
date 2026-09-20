import {
  BUILTIN_SOUNDTRACK_PLAYLISTS,
  BUILTIN_SOUNDTRACK_TRACKS,
  SOUNDTRACK_LIMITS,
  emptySoundtrackLibrary,
  resolveSoundtrackLibrary,
  upgradeSoundtrackLibrary,
  setCatalogueTracks,
  soundtrackTracks,
  soundtrackPlaylists,
  soundtrackStoredTracks,
  soundtrackOffloadedBonusTrackIds,
} from '../soundtrack.mjs';
import { prepareMP3Import, probeMP3Media, throwIfSoundtrackAborted } from '../mp3.mjs';
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
  onError = () => {},
  getContext = () => ({}),
  otherManagedBytes = () => 0,
  probeMedia = probeMP3Media,
  URLImpl = globalThis.URL,
  makeId = (kind) => `${kind}.${globalThis.crypto.randomUUID()}`,
  download,
  onOpen = () => {},
  onClose = () => {},
  onVolume = () => {},
  onPlayback = () => {},
  onAudioEnabled = () => {},
  beforeAudio = async () => {},
  albumDownload = {},
  catalogue = null,
  readAsset,
} = {}) {
  if (!doc?.body || !store?.read || !store?.commit || !player?.snapshot)
    throw new Error('Soundtrack panel requires a document, store and player.');
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
  const dialog = node('dialog', 'dialog', null, {
    class: 'soundtrack-dialog',
    'aria-labelledby': 'soundtrack-title',
  });
  const heading = node('h2', 'title', 'SOUND / STUDIO');
  const status = node('p', 'status', 'Open the studio to load your local music.', {
    role: 'status',
    'aria-live': 'polite',
  });
  const availability = node(
    'p',
    'availability',
    'Custom music stays in this browser. Export a .rlsound file to keep its original bytes.',
    { class: 'micro-note' },
  );
  const closeButton = button('close', 'Back to game', () => close());
  const cancelButton = button('cancel', 'Cancel operation', () => {
    controller?.abort();
    status.textContent = 'Cancellation requested…';
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
    status.textContent = 'Restored the saved library. Playback is unchanged.';
  });
  const reloadButton = button('reload', 'Reload latest saved', () => reload());
  const stateLine = node('p', 'draft-state', '', { class: 'micro-note' });
  const now = node('p', 'now', 'Music is ready.', { role: 'status', 'aria-live': 'off' });
  const seek = input('seek', 'Track position', { type: 'range', min: '0', max: '0', step: '0.1' });
  const volume = input('volume', 'Music volume', {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.01',
  });
  const selection = input('selection', 'Playback playlist', { tag: 'select' });
  const useSelection = button('use-selection', 'Save & use playlist', () => {
    const chosen = selection.element.value || null;
    return task('Saving your playlist choice…', async (signal) => {
      edit((value) => {
        value.selection.playlistId = chosen;
      });
      const committed = await commitDraft(signal);
      await stopAudition(false);
      wakeAudio();
      await player.selectPlaylist(draft.selection.playlistId);
      await notifyPlayback();
      status.textContent =
        committed.warning || 'Playlist selected. Choose Play music if it is paused.';
    });
  });
  const genreNames = [
    ['synth90s', '90s Synth'],
    ['metal', 'Metal'],
    ['ukrainian', 'Ukrainian'],
  ];
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
  const applyListening = button('apply-listening', 'Save & use music selection', () => {
    const chosen = {
      mode: listeningMode.element.value,
      genres: mixGenres.filter(({ element }) => element.checked).map(({ id }) => id),
      installedOnly: installedOnly.element.checked,
    };
    return task('Saving your music selection…', async (signal) => {
      edit((value) => {
        value.selection.playlistId = null;
        value.listening = chosen;
      });
      const committed = await commitDraft(signal);
      await stopAudition(false);
      wakeAudio();
      await player.selectListening(draft.listening);
      await notifyPlayback();
      status.textContent =
        committed.warning ||
        'Music selection saved. Play music to start; unavailable styles remain silent.';
    });
  });
  const listeningSection = section(
    'Choose your music',
    listeningMode.field,
    row(...mixGenres.map(({ field }) => field)),
    installedOnly.field,
    applyListening,
  );
  listeningSection.hidden = !catalogue;
  const transport = section(
    'Now playing',
    now,
    row(
      button('previous', 'Previous', () => controlMusic(() => player.previous())),
      button('play', 'Play music', () => controlMusic(() => player.play(), true)),
      button('pause', 'Pause music', () => controlMusic(() => player.pause())),
      button('next', 'Next', () => controlMusic(() => player.next())),
    ),
    seek.field,
    volume.field,
    selection.field,
    useSelection,
    listeningSection,
  );
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
      status.textContent = 'Track details added to the draft. Save all changes to keep them.';
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
      status.textContent =
        'Track removed from the draft; the saved library is unchanged until Save.';
    }),
  );
  const audition = node('audio', 'audition', null, {
    controls: '',
    preload: 'metadata',
    'aria-label': 'Imported track audition',
  });
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
      if (!audition.paused) audition.pause();
      else {
        wakeAudio();
        if (disposed || token !== auditionToken || !auditionURL) return;
        try {
          await audition.play();
        } catch (error) {
          if (token === auditionToken) throw error;
        }
      }
    }),
  );
  const auditionControls = section(
    'Audition controls',
    row(toggleAudition),
    auditionSeek.field,
    auditionVolume.field,
  );
  auditionControls.hidden = true;
  const tracksSection = section(
    'Music library',
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
    trackTitle.field,
    trackArtist.field,
    rightsKind.field,
    rightsCredit.field,
    rightsLicense.field,
    rightsSource.field,
    tagFields,
    row(applyTrack, deleteTrack),
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
      status.textContent =
        'New playlist added to the draft. Edit its title, order and entries, then Save.';
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
      status.textContent = 'Playlist cloned. The draft copy is editable.';
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
      status.textContent =
        'Playlist details added to the draft. The current song will finish normally after Save.';
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
      status.textContent = 'Playlist removed from the draft.';
    }),
  );
  const playlistSection = section(
    'Playlist editor',
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
      status.textContent =
        'Assignment added to the draft. Automatic playback uses map, campaign, theme, then global; explicit selection overrides these.';
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
  const assignmentSection = section(
    'Authored music',
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
  const bundleInput = input('bundle-file', 'Complete soundtrack backup (.rlsound)', {
    type: 'file',
    accept: '.rlsound,application/octet-stream',
  });
  const bundleImport = button('import-bundle', 'Review backup as replacement draft', () =>
    task('Checking soundtrack backup and original audio…', async (signal) => {
      const source = bundleInput.element.files?.[0];
      if (!source) throw new Error('Choose a .rlsound backup first.');
      const prepared = await importSoundtrackBundle(source, { signal, probeMedia });
      throwIfSoundtrackAborted(signal);
      invalidateBackup();
      draft = adopt(prepared.library);
      assets = [...prepared.assets];
      dirty = true;
      render();
      status.textContent = `Backup verified: ${draft.tracks.length} custom tracks, ${draft.playlists.length} custom playlists. Save all changes replaces the local library; Undo keeps the saved library.`;
      bundleInput.element.value = '';
    }),
  );
  const bundleExport = button(
    'export-bundle',
    'Prepare saved-library backup (.rlsound)',
    async () => {
      const complete = await task(
        'Verifying a complete binary soundtrack backup…',
        async (signal) => {
          if (!saved) throw new Error('Load the saved music library first.');
          invalidateBackup();
          const completeAssets = await originalsFor(saved.library, saved.assets, signal);
          const blob = await exportSoundtrackBundle(saved.library, completeAssets, { signal });
          throwIfSoundtrackAborted(signal);
          if (disposed) return;
          preparedBackup = {
            blob,
            filename: 'RevealLine-soundtrack.rlsound',
            generation: saved.generation,
            url: typeof download === 'function' ? null : URLImpl.createObjectURL(blob),
          };
          status.textContent =
            'Backup prepared. Choose Download prepared backup to request the file. Unsaved draft changes are excluded.';
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
      const incoming = await importSoundtrackBundle(source, { signal, probeMedia });
      const merged = mergeSoundtrackShare(draft, assets, incoming);
      throwIfSoundtrackAborted(signal);
      invalidateBackup();
      draft = adopt(merged.library);
      assets = merged.assets;
      dirty = true;
      status.textContent =
        'Album added to the draft. Your selected music and assignments are retained. Save all changes to keep it.';
    }),
  );
  const shareExport = button('export-share', 'Prepare selected playlist as album', () =>
    task('Preparing a shareable album…', async (signal) => {
      const playlist = draft.playlists.find((item) => item.id === playlistsSelect.element.value);
      const library = soundtrackPlaylistShare(draft, playlist);
      const completeAssets = await originalsFor(
        library,
        assets,
        signal,
        SOUNDTRACK_LIMITS.optionalBundleTargetBytes,
      );
      const blob = await exportSoundtrackBundle(library, completeAssets, { signal });
      if (blob.size > SOUNDTRACK_LIMITS.optionalBundleTargetBytes)
        throw new Error('This album exceeds 64 MiB. Split its playlist into smaller volumes.');
      throwIfSoundtrackAborted(signal);
      invalidateBackup();
      preparedBackup = {
        blob,
        filename: 'RevealLine-album.rlsound',
        generation: saved.generation,
        share: true,
        url: typeof download === 'function' ? null : URLImpl.createObjectURL(blob),
      };
      status.textContent =
        'Album prepared from the current playlist draft. Use Download prepared file to save it. Your library is unchanged.';
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
          status.textContent =
            'Download request handed to the host. Confirm the destination there; the prepared backup is available to retry.';
      });
    }
    status.textContent =
      'Download requested. Confirm it in your browser. If no file appears, choose Download prepared backup again.';
    // No async work, synthetic click or automatic navigation here. The visible
    // anchor's default action uses the already prepared, retained Blob URL.
    return true;
  };
  const discardBackup = button('discard-backup', 'Discard prepared copy', () => {
    if (busy || disposed) return;
    invalidateBackup();
    status.textContent =
      'Prepared copy discarded. Saved music is unchanged; the browser controls any download already requested.';
  });
  const backupInfo = node('p', 'backup-info', '', { class: 'micro-note' });
  const backupReady = node('div', 'backup-ready', null, { class: 'soundtrack-backup-ready' });
  backupReady.append(backupInfo, row(bundleDownload, discardBackup));
  const transferSection = section(
    'Local files & backup',
    node(
      'p',
      null,
      'This separate soundtrack file contains original MP3 bytes. A normal game JSON backup does not include this audio. Local storage availability is not a guarantee that this browser retains files indefinitely.',
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
      status.textContent = `${catalog.albums.length} optional albums. Review an addition before saving; your current song and draft are kept.`;
    }),
  );
  const albumSection = section(
    'Community soundtracks',
    node(
      'p',
      null,
      'Browse albums and credits, then Add to draft to download and preview individual tracks. Remove offline download keeps track details and playlists; Download again restores the album. Save all changes confirms the draft. Your current playlist stays selected.',
      { class: 'micro-note' },
    ),
    albumBrowse,
    albumList,
  );
  const originalAlbums = node('div', 'original-albums');
  const originalSection = section(
    'RevealLine originals',
    node(
      'p',
      'original-status',
      catalogue?.tracks.length
        ? `${catalogue.tracks.length} published recordings. Listen online or download a volume for offline play.`
        : '36 original compositions are in production. Recordings will appear after production and listening review. Community albums and your MP3 uploads are available below.',
      { class: 'micro-note' },
    ),
    originalAlbums,
  );
  originalSection.hidden = !catalogue;
  const volumes = genreNames.flatMap(([genre, title]) => {
    const list = (catalogue?.tracks ?? []).filter((track) => track.tags.genres[0] === genre);
    return Array.from({ length: Math.ceil(list.length / 6) }, (_, i) => ({
      id: `${genre}-${i + 1}`,
      title: `${title} · Volume ${i + 1}`,
      tracks: list.slice(i * 6, (i + 1) * 6),
    }));
  });
  for (const volume of volumes) {
    const ids = new Set(volume.tracks.map((track) => track.id));
    const install = button(`download-${volume.id}`, 'Download for offline', () =>
      task('Downloading original recordings into the draft…', async (signal) => {
        if (!readAsset) throw new Error('Recording downloads are unavailable.');
        if (
          volume.tracks.reduce((sum, track) => sum + track.asset.bytes, 0) >
          SOUNDTRACK_LIMITS.optionalBundleTargetBytes
        )
          throw new Error(
            'This volume exceeds the 64 MiB download budget. Its publisher must split it.',
          );
        const additions = new Map(assets.map((asset) => [asset.sha256, asset]));
        const expected = new Map(assets.map((asset) => [asset.sha256, asset.blob.size]));
        for (const track of volume.tracks) expected.set(track.asset.sha256, track.asset.bytes);
        if (
          [...expected.values()].reduce((sum, size) => sum + size, 0) >
          SOUNDTRACK_LIMITS.managedBytes
        )
          throw new Error(
            'This download exceeds the 256 MiB audio budget. Remove an offline volume first.',
          );
        for (const track of volume.tracks) {
          if (!additions.has(track.asset.sha256))
            additions.set(track.asset.sha256, {
              sha256: track.asset.sha256,
              blob: await readAsset(track.asset.sha256, { signal, download: true }),
            });
          throwIfSoundtrackAborted(signal);
        }
        const next = copy(draft);
        next.installedTrackIds = [...new Set([...next.installedTrackIds, ...ids])];
        const prepared = await prepareSoundtrackLibrary(next, [...additions.values()], {
          signal,
          probeMedia,
        });
        invalidateBackup();
        draft = prepared.library;
        assets = [...prepared.assets];
        dirty = true;
        status.textContent =
          'Volume downloaded and checked. Save all changes to install it offline.';
      }),
    );
    const remove = button(`offload-${volume.id}`, 'Remove offline download', () =>
      attempt(() => {
        edit((value) => {
          value.installedTrackIds = value.installedTrackIds.filter((id) => !ids.has(id));
        });
        pruneAssets();
        render();
        status.textContent =
          'Offline copies removed from the draft. Playlists are retained; Save all changes confirms removal.';
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
        row(install, remove),
      ),
    );
  }
  const columns = node('div', null, null, { class: 'soundtrack-columns' });
  columns.append(
    originalSection,
    tracksSection,
    playlistSection,
    assignmentSection,
    transferSection,
    albumSection,
  );
  dialog.append(
    row(heading, closeButton),
    availability,
    transport,
    columns,
    node('div', null, null, { class: 'soundtrack-footer' }),
  );
  dialog.lastElementChild.append(
    stateLine,
    status,
    row(saveButton, undoButton, reloadButton, cancelButton),
  );
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
              });
              throwIfSoundtrackAborted(signal);
              const restoring = albumState(album).known;
              const merged = restoring
                ? restoreSoundtrackAlbum(currentDraft, currentAssets, imported, album)
                : mergeSoundtrackAlbum(currentDraft, currentAssets, imported, album);
              const prepared = await prepareSoundtrackLibrary(merged.library, merged.assets, {
                signal,
                probeMedia,
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
              status.textContent = restoring
                ? `${album.title} downloaded and verified. Save all changes restores offline audio; track details, playlists and playback are kept.`
                : `${album.title} verified: ${merged.addedTracks} new tracks, ${merged.addedPlaylists} new playlist. Save all changes adds this album; Undo keeps the saved library. Playback is unchanged.`;
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
              });
              throwIfSoundtrackAborted(signal);
              invalidateBackup();
              draft = prepared.library;
              assets = [...prepared.assets];
              dirty = true;
              status.textContent = `${album.title}: ${bytes(removed.removedBytes)} removed from the draft. Track details, credits and playlist references are kept. ${removed.retainedSharedBytes ? `${bytes(removed.retainedSharedBytes)} shared with other installed tracks is retained. ` : ''}Save all changes confirms removal; Undo restores the saved library.`;
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
    status.textContent =
      error?.name === 'AbortError'
        ? 'Operation cancelled. The saved library was not changed by this cancelled operation.'
        : message(error);
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
    const tracks = soundtrackTracks(library).filter((item) => item.kind === 'mp3');
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
      if (!blob && readAsset) blob = await readAsset(hash, { signal });
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
  function renderBackup() {
    backupReady.hidden = preparedBackup === null;
    bundleDownload.disabled = busy || !preparedBackup;
    bundleDownload.setAttribute('aria-disabled', String(bundleDownload.disabled));
    discardBackup.disabled = busy || !preparedBackup;
    if (!preparedBackup) return;
    backupInfo.textContent = preparedBackup.share
      ? `${bytes(preparedBackup.blob.size)} · selected draft playlist and every referenced original MP3. Preparing an album does not save your library or write a file.`
      : `${bytes(preparedBackup.blob.size)} · saved generation ${preparedBackup.generation} · metadata and every referenced original MP3. Unsaved draft edits are excluded. Preparation does not save a file to disk.`;
    bundleDownload.textContent = preparedBackup.share
      ? 'Download prepared file'
      : 'Download prepared backup';
    if (preparedBackup.url) {
      if (busy) bundleDownload.removeAttribute('href');
      else bundleDownload.setAttribute('href', preparedBackup.url);
      bundleDownload.setAttribute('download', preparedBackup.filename);
    }
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
    auditionButton.disabled = busy || !saved || track?.kind !== 'mp3';
    const online = catalogue?.tracks.some((item) => item.id === track?.id);
    const offloaded = soundtrackOffloadedBonusTrackIds(draft).includes(track?.id);
    trackInfo.textContent =
      track?.kind === 'mp3'
        ? `${seconds(track.asset.durationSeconds)} · ${bytes(track.asset.bytes)} · ${track.asset.sampleRate} Hz · original bytes ${assets.some((asset) => asset.sha256 === track.asset.sha256) ? 'present locally' : offloaded ? 'removed offline — choose Download again in Community soundtracks' : online ? 'available online · not downloaded' : 'MISSING — restore a complete backup'}`
        : 'Built-in procedural synth recipe. Use the playback playlist to listen; original finished albums are a separate content milestone.';
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
        ['', 'Automatic — follow map / campaign / theme'],
        ...playlists().map((item) => [item.id, item.title]),
      ],
      draft.selection.playlistId ?? '',
    );
    for (const control of columns.querySelectorAll('button,input,select'))
      control.disabled = busy || !saved;
    useSelection.disabled = busy || !saved;
    if (catalogue) {
      listeningMode.element.value = draft.listening.mode;
      installedOnly.element.checked = draft.listening.installedOnly;
      for (const { id, element } of mixGenres)
        element.checked = draft.listening.genres.includes(id);
      for (const control of listeningSection.querySelectorAll('button,input,select'))
        control.disabled = busy || !saved;
    }
    cancelButton.hidden = !busy;
    closeButton.disabled = busy;
    reloadButton.disabled = busy;
    renderTrack();
    renderPlaylist();
    renderAssignments();
    refreshAlbumControls();
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
    busy = true;
    controller = new AbortController();
    const signal = controller.signal;
    status.textContent = label;
    render();
    try {
      await work(signal);
      return true;
    } catch (error) {
      if (!disposed) report(error);
      return false;
    } finally {
      busy = false;
      controller = null;
      if (!disposed) render();
    }
  }
  async function reload() {
    return task('Loading saved music and local audio…', async (signal) => {
      invalidateBackup();
      const value = await store.read({ signal });
      throwIfSoundtrackAborted(signal);
      saved = value;
      draft = adopt(value.library);
      assets = [...value.assets];
      dirty = false;
      player.setLibrary(draft);
      const warning = await notifyLibrary(value);
      status.textContent =
        warning || 'Saved library loaded. Imports and edits remain drafts until Save all changes.';
    });
  }
  async function notifyLibrary(value) {
    try {
      await onLibrary(value.library, value);
      return null;
    } catch (error) {
      try {
        onError(error);
      } catch {}
      return `Library is saved, but the game refresh failed: ${message(error)}. Reload the studio to refresh it.`;
    }
  }
  async function commitDraft(signal) {
    if (!saved) throw new Error('Load the local library before saving.');
    invalidateBackup();
    pruneAssets();
    const prepared = await prepareSoundtrackLibrary(draft, assets, { signal, probeMedia });
    const usage =
      typeof otherManagedBytes === 'function' ? await otherManagedBytes() : otherManagedBytes;
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
    player.setLibrary(draft);
    const warning = await notifyLibrary(saved);
    status.textContent =
      warning ||
      'Music library saved atomically. The current song continues; edited queues and automatic assignments apply at a song boundary.';
    return { ...saved, warning };
  }
  async function importMP3Files() {
    return task('Inspecting selected MP3 files…', async (signal) => {
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
        status.textContent = `Inspecting ${index + 1}/${files.length}: ${file.name || 'MP3 audio'}…`;
        const imported = await prepareMP3Import(
          file,
          {
            id: makeId('track'),
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
          { signal, probeMedia },
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
      status.textContent = `${files.length} MP3 file${files.length === 1 ? '' : 's'} verified and added to the draft. Edit details or audition, then Save all changes.`;
    });
  }
  async function stopAudition(restore = false) {
    auditionToken++;
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
    if (soundtrackOffloadedBonusTrackIds(draft).includes(track.id))
      throw new Error('Choose Download again in Community soundtracks to audition this album.');
    const state = player.snapshot();
    const previous = restoreMusic || (state.desired ?? state.playing);
    const stopping = stopAudition(false);
    wakeAudio();
    restoreMusic = previous;
    player.pause();
    const token = ++auditionToken;
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
      await audition.play();
      await stopping;
      if (token === auditionToken) {
        await onAudioEnabled();
        status.textContent = `Auditioning ${track.title}. Finish audition returns to the previous music state.`;
      }
    } catch (error) {
      if (disposed || token !== auditionToken) return;
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
    if (state.playing) await onAudioEnabled();
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
      auditionVolume.element.value = String(Number.isFinite(audition.volume) ? audition.volume : 1);
  }
  function update(snapshot = player.snapshot()) {
    if (disposed) return;
    now.textContent = `${snapshot.track?.title ?? 'No track selected'}${snapshot.track?.artist ? ` · ${snapshot.track.artist}` : ''} · ${snapshot.status} · ${seconds(snapshot.positionSeconds)} / ${seconds(snapshot.durationSeconds)}${snapshot.pendingPlaylistId ? ' · playlist update queued' : ''}${snapshot.notice ? ` · ${snapshot.notice}` : ''}${snapshot.error ? ` · ${snapshot.error}` : ''}`;
    seek.element.max = String(snapshot.durationSeconds || 0);
    if (doc.activeElement !== seek.element)
      seek.element.value = String(snapshot.positionSeconds || 0);
    seek.element.disabled = !snapshot.track || !(snapshot.durationSeconds > 0);
    if (doc.activeElement !== volume.element) volume.element.value = String(snapshot.volume ?? 0.5);
    stopAuditionButton.disabled = auditionURL === null && auditionController === null;
    updateAudition();
  }
  async function open() {
    if (disposed) return;
    onOpen();
    returnFocus = doc.activeElement;
    if (!dialog.open) dialog.showModal();
    closeButton.focus();
    if (!saved) await reload();
    else {
      render();
      status.textContent = preparedBackup
        ? 'Your prepared saved-library backup is still available to download. Unsaved draft changes are excluded.'
        : dirty
          ? 'Your unsaved draft is still here.'
          : 'Music library ready.';
    }
  }
  function close() {
    if (busy || disposed) return false;
    void playback(() => stopAudition(true));
    if (dialog.open) dialog.close();
    if (returnFocus?.isConnected && !returnFocus.disabled) returnFocus.focus();
    onClose();
    return true;
  }
  listen(dialog, 'cancel', (event) => {
    event.preventDefault();
    if (busy) {
      controller?.abort();
      status.textContent =
        'Cancellation requested. Wait for the operation to finish before leaving.';
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
    if (auditionURL && !busy && Number.isFinite(value))
      audition.volume = Math.max(0, Math.min(1, value));
  };
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
    void stopAudition(false);
    for (const unbind of bindings) unbind();
    invalidateBackup();
    dialog.remove();
    style.remove();
  }
  render();
  return Object.freeze({ open, close, update, dispose });
}
