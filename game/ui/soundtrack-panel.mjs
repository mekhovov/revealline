import {
  BUILTIN_SOUNDTRACK_PLAYLISTS,
  BUILTIN_SOUNDTRACK_TRACKS,
  SOUNDTRACK_LIMITS,
  emptySoundtrackLibrary,
  resolveSoundtrackLibrary,
} from '../soundtrack.mjs';
import { prepareMP3Import, probeMP3Media, throwIfSoundtrackAborted } from '../mp3.mjs';
import {
  exportSoundtrackBundle,
  importSoundtrackBundle,
  prepareSoundtrackLibrary,
} from '../soundtrack-bundle.mjs';

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
} = {}) {
  if (!doc?.body || !store?.read || !store?.commit || !player?.snapshot)
    throw new Error('Soundtrack panel requires a document, store and player.');
  const bindings = [],
    ownedURLs = new Set();
  let disposed = false,
    busy = false,
    controller = null,
    saved = null;
  let draft = emptySoundtrackLibrary(),
    assets = [],
    dirty = false,
    returnFocus = null;
  let auditionURL = null,
    auditionToken = 0,
    restoreMusic = false;
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
    draft = saved.library;
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
      await beforeAudio();
      await player.selectPlaylist(draft.selection.playlistId);
      await notifyPlayback();
      status.textContent =
        committed.warning || 'Playlist selected. Choose Play music if it is paused.';
    });
  });
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
    row(applyTrack, deleteTrack),
    row(auditionButton, stopAuditionButton),
    audition,
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
      draft = prepared.library;
      assets = [...prepared.assets];
      dirty = true;
      render();
      status.textContent = `Backup verified: ${draft.tracks.length} custom tracks, ${draft.playlists.length} custom playlists. Save all changes replaces the local library; Undo keeps the saved library.`;
      bundleInput.element.value = '';
    }),
  );
  const bundleExport = button('export-bundle', 'Download saved library (.rlsound)', () =>
    task('Verifying a complete binary soundtrack backup…', async (signal) => {
      if (!saved) throw new Error('Load the saved music library first.');
      const blob = await exportSoundtrackBundle(saved.library, saved.assets, { signal });
      throwIfSoundtrackAborted(signal);
      await downloadBlob(blob, 'RevealLine-soundtrack.rlsound');
      status.textContent = `Complete backup prepared (${bytes(blob.size)}). It contains saved metadata and every referenced original MP3. Confirm the download in your browser. Unsaved draft changes are excluded.`;
    }),
  );
  const transferSection = section(
    'Local files & backup',
    node(
      'p',
      null,
      'This separate soundtrack file contains original MP3 bytes. A normal game JSON backup does not include this audio. Local storage availability is not a guarantee that this browser retains files indefinitely.',
      { class: 'micro-note' },
    ),
    row(bundleExport),
    bundleInput.field,
    bundleImport,
  );
  const columns = node('div', null, null, { class: 'soundtrack-columns' });
  columns.append(tracksSection, playlistSection, assignmentSection, transferSection);
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
    return [...BUILTIN_SOUNDTRACK_TRACKS, ...draft.tracks];
  }
  function playlists() {
    return [...BUILTIN_SOUNDTRACK_PLAYLISTS, ...draft.playlists];
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
    const needed = new Set(draft.tracks.map((track) => track.asset.sha256));
    assets = assets.filter((asset) => needed.has(asset.sha256));
  }
  function dirtyState() {
    stateLine.textContent = saved
      ? `${dirty ? 'Unsaved draft' : 'Saved'} · generation ${saved.generation} · ${draft.tracks.length} custom tracks · ${draft.playlists.length} custom playlists · ${bytes(assets.reduce((total, asset) => total + asset.blob.size, 0))} original audio`
      : 'Local library is unavailable. Built-in playback remains separate.';
    saveButton.disabled = busy || !saved || !dirty;
    undoButton.disabled = busy || !saved || !dirty;
  }
  function renderTrack() {
    const track = tracks().find((item) => item.id === tracksSelect.element.value);
    const custom = track?.kind === 'mp3';
    trackTitle.element.value = track?.title ?? '';
    trackArtist.element.value = track?.artist ?? '';
    rightsKind.element.value = track?.rights?.kind ?? 'original';
    rightsCredit.element.value = track?.rights?.credit ?? 'RevealLine';
    rightsLicense.element.value = track?.rights?.license ?? '';
    rightsSource.element.value = track?.rights?.source ?? '';
    for (const control of [
      trackTitle.element,
      trackArtist.element,
      rightsKind.element,
      rightsCredit.element,
      rightsLicense.element,
      rightsSource.element,
      applyTrack,
      deleteTrack,
      auditionButton,
    ])
      control.disabled = busy || !saved || !custom;
    trackInfo.textContent = custom
      ? `${seconds(track.asset.durationSeconds)} · ${bytes(track.asset.bytes)} · ${track.asset.sampleRate} Hz · original bytes ${assets.some((asset) => asset.sha256 === track.asset.sha256) ? 'present locally' : 'MISSING — restore a complete backup'}`
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
    cancelButton.hidden = !busy;
    closeButton.disabled = busy;
    reloadButton.disabled = busy;
    renderTrack();
    renderPlaylist();
    renderAssignments();
    dirtyState();
    update();
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
      report(error);
      return false;
    } finally {
      busy = false;
      controller = null;
      if (!disposed) render();
    }
  }
  async function reload() {
    return task('Loading saved music and local audio…', async (signal) => {
      const value = await store.read({ signal });
      throwIfSoundtrackAborted(signal);
      saved = value;
      draft = value.library;
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
      draft = verified;
      assets = [...added].map(([sha256, blob]) => ({ sha256, blob }));
      dirty = true;
      render({ trackId: latest });
      fileInput.element.value = '';
      status.textContent = `${files.length} MP3 file${files.length === 1 ? '' : 's'} verified and added to the draft. Edit details or audition, then Save all changes.`;
    });
  }
  async function downloadBlob(blob, filename) {
    if (download) return download(blob, filename);
    // A new explicit download releases the prior download handle. The browser
    // has already received that handle; do not retain unlimited backup Blobs.
    for (const previous of ownedURLs) URLImpl.revokeObjectURL(previous);
    ownedURLs.clear();
    const url = URLImpl.createObjectURL(blob);
    ownedURLs.add(url);
    const anchor = doc.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.hidden = true;
    doc.body.append(anchor);
    try {
      anchor.click();
    } finally {
      anchor.remove();
    }
    // Keep the URL until disposal so delayed browser download consumers can read it.
  }
  async function stopAudition(restore = false) {
    auditionToken++;
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
    const track = draft.tracks.find((item) => item.id === tracksSelect.element.value);
    if (!track) throw new Error('Choose an imported MP3 to audition.');
    const asset = assets.find((item) => item.sha256 === track.asset.sha256);
    if (!asset)
      throw new Error('This MP3 is missing locally. Restore its complete soundtrack backup.');
    const state = player.snapshot();
    const previous = restoreMusic || (state.desired ?? state.playing);
    await stopAudition(false);
    await beforeAudio();
    restoreMusic = previous;
    player.pause();
    const token = ++auditionToken;
    try {
      auditionURL = URLImpl.createObjectURL(asset.blob);
      audition.src = auditionURL;
      audition.hidden = false;
      audition.load();
      await audition.play();
      if (token === auditionToken) {
        await onAudioEnabled();
        status.textContent = `Auditioning ${track.title}. Finish audition returns to the previous music state.`;
      }
    } catch (error) {
      if (token === auditionToken) await stopAudition(true);
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
      await stopAudition(false);
      if (enable) await beforeAudio();
      await work();
      await notifyPlayback();
    });
  }
  async function notifyPlayback() {
    const state = player.snapshot();
    await onPlayback({ playing: state.playing, desired: state.desired ?? state.playing });
    if (state.playing) await onAudioEnabled();
  }
  function update(snapshot = player.snapshot()) {
    if (disposed) return;
    now.textContent = `${snapshot.track?.title ?? 'No track selected'}${snapshot.track?.artist ? ` · ${snapshot.track.artist}` : ''} · ${snapshot.status} · ${seconds(snapshot.positionSeconds)} / ${seconds(snapshot.durationSeconds)}${snapshot.pendingPlaylistId ? ' · playlist update queued' : ''}${snapshot.notice ? ` · ${snapshot.notice}` : ''}${snapshot.error ? ` · ${snapshot.error}` : ''}`;
    seek.element.max = String(snapshot.durationSeconds || 0);
    if (doc.activeElement !== seek.element)
      seek.element.value = String(snapshot.positionSeconds || 0);
    seek.element.disabled = !snapshot.track || !(snapshot.durationSeconds > 0);
    if (doc.activeElement !== volume.element) volume.element.value = String(snapshot.volume ?? 0.5);
    stopAuditionButton.disabled = auditionURL === null;
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
      status.textContent = dirty ? 'Your unsaved draft is still here.' : 'Music library ready.';
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
      event.target?.tagName?.toLowerCase() !== 'button'
    )
      return;
    const controls = [...dialog.querySelectorAll('button,input,select,audio')].filter(
      (element) => !element.disabled && !element.hidden,
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
    for (const url of ownedURLs) URLImpl.revokeObjectURL(url);
    ownedURLs.clear();
    dialog.remove();
    style.remove();
  }
  render();
  return Object.freeze({ open, close, update, dispose });
}
