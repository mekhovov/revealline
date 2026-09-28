import { contentText } from '../i18n/content.mjs';
import { localizedMessage, localizedText, t, localizedAttribute } from '../i18n/index.mjs';
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
const bytes = (value) => t("gameplay:mib", { value1: (value / 1024 / 1024).toFixed(1) });

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
    throw new Error(t("interface:soundtrackPanelRequiresADocumentStoreAndPlayer"));
  const bindings = [];
  let disposed = false,
    busy = false,
    controller = null,
    saved = null,
    preparedBackup = null;
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
    if (text !== undefined && text !== null) localizedText(element, () =>text);
    for (const [key, value] of Object.entries(attrs)) {
      if (['aria-label', 'title', 'placeholder', 'alt'].includes(key)) localizedAttribute(element, key, value);
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
  const dialog = node('dialog', 'dialog', null, {
    class: 'soundtrack-dialog',
    'aria-labelledby': 'soundtrack-title',
  });
  const heading = node('h2', 'title', localizedMessage("interface:soundStudio"));
  const status = node('p', 'status', localizedMessage("interface:openTheStudioToLoadYourLocalMusic"), {
    role: 'status',
    'aria-live': 'polite',
  });
  const availability = node(
    'p',
    'availability',
    localizedMessage("interface:customMusicStaysInThisBrowserExportARlsoundFile"),
    { class: 'micro-note' },
  );
  const closeButton = button('close', localizedMessage("common:navigation.backToGame"), () => close());
  const cancelButton = button('cancel', localizedMessage("interface:cancelOperation"), () => {
    controller?.abort();
    localizedText(status, () =>t("interface:cancellationRequested"));
  });
  cancelButton.hidden = true;
  const saveButton = button('save', localizedMessage("interface:saveAllChanges"), () =>
    task(t("interface:verifyingAndSavingTheMusicLibrary"), (signal) => commitDraft(signal)),
  );
  const undoButton = button('undo', localizedMessage("interface:undoUnsavedChanges"), () => {
    if (!saved || busy) return;
    invalidateBackup();
    draft = saved.library;
    assets = [...saved.assets];
    dirty = false;
    render();
    localizedText(status, () =>t("interface:restoredTheSavedLibraryPlaybackIsUnchanged"));
  });
  const reloadButton = button('reload', localizedMessage("interface:reloadLatestSaved"), () => reload());
  const stateLine = node('p', 'draft-state', '', { class: 'micro-note' });
  const now = node('p', 'now', localizedMessage("interface:musicIsReady"), { role: 'status', 'aria-live': 'off' });
  const seek = input('seek', localizedMessage("interface:trackPosition"), { type: 'range', min: '0', max: '0', step: '0.1' });
  const volume = input('volume', localizedMessage("interface:musicVolume"), {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.01',
  });
  const selection = input('selection', localizedMessage("interface:playbackPlaylist"), { tag: 'select' });
  const useSelection = button('use-selection', localizedMessage("interface:saveUsePlaylist"), () => {
    const chosen = selection.element.value || null;
    return task(t("interface:savingYourPlaylistChoice"), async (signal) => {
      edit((value) => {
        value.selection.playlistId = chosen;
      });
      const committed = await commitDraft(signal);
      await stopAudition(false);
      await beforeAudio();
      await player.selectPlaylist(draft.selection.playlistId);
      await notifyPlayback();
      localizedText(status, () =>committed.warning || t("interface:playlistSelectedChoosePlayMusicIfItIsPaused"));
    });
  });
  const transport = section(
    localizedMessage("interface:nowPlaying"),
    now,
    row(
      button('previous', localizedMessage("common:actions.previous"), () => controlMusic(() => player.previous())),
      button('play', localizedMessage("interface:playMusic2"), () => controlMusic(() => player.play(), true)),
      button('pause', localizedMessage("interface:pauseMusic"), () => controlMusic(() => player.pause())),
      button('next', localizedMessage("common:actions.next"), () => controlMusic(() => player.next())),
    ),
    seek.field,
    volume.field,
    selection.field,
    useSelection,
  );
  const tracksSelect = input('tracks', localizedMessage("interface:tracks"), { tag: 'select', size: '7' });
  const fileInput = input('mp3-files', localizedMessage("interface:addMp3Files"), {
    type: 'file',
    accept: '.mp3,audio/mpeg',
    multiple: '',
  });
  const importButton = button('import-mp3', localizedMessage("interface:importSelectedMp3s"), () => importMP3Files());
  const trackTitle = input('track-title', localizedMessage("interface:trackTitle"), { maxlength: '120' });
  const trackArtist = input('track-artist', localizedMessage("interface:artist"), { maxlength: '160' });
  const rightsKind = input('rights-kind', localizedMessage("interface:sourceDeclaration"), { tag: 'select' });
  options(rightsKind.element, [
    ['personal', t("interface:personalLocalUpload")],
    ['original', t("interface:originalWork")],
    ['licensed', t("interface:licensedWork")],
  ]);
  const rightsCredit = input('rights-credit', localizedMessage("interface:credit"), { maxlength: '280' });
  const rightsLicense = input('rights-license', localizedMessage("interface:licensePermission"), { maxlength: '280' });
  const rightsSource = input('rights-source', localizedMessage("interface:sourceProvenance"), { maxlength: '1024' });
  const trackInfo = node('p', 'track-info', '', { class: 'micro-note' });
  const applyTrack = button('apply-track', localizedMessage("interface:applyTrackDetailsToDraft"), () =>
    attempt(() => {
      const id = tracksSelect.element.value;
      edit((value) => {
        const track = value.tracks.find((item) => item.id === id);
        if (!track) throw new Error(t("interface:builtInTracksCannotBeEdited"));
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
      localizedText(status, () =>t("interface:trackDetailsAddedToTheDraftSaveAllChangesTo"));
    }),
  );
  const deleteTrack = button('delete-track', localizedMessage("interface:removeTrackFromDraft"), () =>
    attempt(() => {
      const id = tracksSelect.element.value;
      edit((value) => {
        if (!value.tracks.some((item) => item.id === id))
          throw new Error(t("interface:builtInTracksAreRetained"));
        const references = value.playlists.filter((item) => item.trackIds.includes(id));
        if (references.length)
          throw new Error(
            t("gameplay:removeThisTrackFromItsPlaylistsFirst", { value1: references.map((item) => contentText(item, 'title')).join(', ') }),
          );
        value.tracks = value.tracks.filter((item) => item.id !== id);
      });
      pruneAssets();
      render();
      localizedText(status, () =>t("interface:trackRemovedFromTheDraftTheSavedLibraryIsUnchanged"));
    }),
  );
  const audition = node('audio', 'audition', null, {
    controls: '',
    preload: 'metadata',
    'aria-label': localizedMessage("interface:importedTrackAudition"),
  });
  audition.hidden = true;
  const auditionButton = button('audition-track', localizedMessage("interface:auditionMp3"), () =>
    playback(() => startAudition()),
  );
  const stopAuditionButton = button('stop-audition', localizedMessage("interface:finishAudition"), () =>
    playback(() => stopAudition(true)),
  );
  const auditionSeek = input('audition-seek', localizedMessage("interface:auditionPosition"), {
    type: 'range',
    min: '0',
    max: '0',
    step: '0.5',
  });
  const auditionVolume = input('audition-volume', localizedMessage("interface:auditionVolume"), {
    type: 'range',
    min: '0',
    max: '1',
    step: '0.05',
  });
  const toggleAudition = button('toggle-audition', localizedMessage("interface:pauseAudition"), () =>
    playback(async () => {
      if (!auditionURL || disposed || busy) return;
      const token = auditionToken;
      if (!audition.paused) audition.pause();
      else {
        await beforeAudio();
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
    localizedMessage("interface:auditionControls"),
    row(toggleAudition),
    auditionSeek.field,
    auditionVolume.field,
  );
  auditionControls.hidden = true;
  const tracksSection = section(
    localizedMessage("interface:musicLibrary"),
    node(
      'p',
      null,
      localizedMessage("interface:batchImportKeepsOriginalMp3BytesEachFileMustBe"),
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
    auditionControls,
  );
  const playlistsSelect = input('playlists', localizedMessage("interface:playlists"), { tag: 'select', size: '5' });
  const playlistTitle = input('playlist-title', localizedMessage("interface:playlistTitle"), { maxlength: '120' });
  const order = input('order', localizedMessage("interface:playbackOrder"), { tag: 'select' });
  options(order.element, [
    ['ordered', t("interface:inOrder")],
    ['shuffle', t("interface:shuffleWithoutRepeatsUntilEveryEntryPlayed")],
  ]);
  const repeat = input('repeat', localizedMessage("interface:repeat"), { tag: 'select' });
  options(repeat.element, [
    ['all', t("interface:repeatAll")],
    ['one', t("interface:repeatOne")],
    ['off', t("interface:stopAtTheEnd")],
  ]);
  const entries = input('entries', localizedMessage("interface:playlistEntries"), { tag: 'select', size: '7' });
  const addTrack = input('add-track', localizedMessage("interface:trackToAdd"), { tag: 'select' });
  const createPlaylist = button('create-playlist', localizedMessage("interface:newPlaylistWithSelectedTrack"), () =>
    attempt(() => {
      const id = makeId('playlist');
      edit((value) =>
        value.playlists.push({
          id,
          title: localizedMessage("interface:newPlaylist"),
          trackIds: [tracksSelect.element.value],
          order: 'ordered',
          repeat: 'all',
        }),
      );
      render({ playlistId: id });
      localizedText(status, () =>t("interface:newPlaylistAddedToTheDraftEditItsTitleOrder"));
    }),
  );
  const clonePlaylist = button('clone-playlist', localizedMessage("interface:cloneSelectedPlaylist"), () =>
    attempt(() => {
      const source = playlists().find((item) => item.id === playlistsSelect.element.value);
      const id = makeId('playlist');
      edit((value) =>
        value.playlists.push({ ...copy(source), id, title: localizedMessage("gameplay:copy", { value1: contentText(source, 'title').slice(0, 113) }) }),
      );
      render({ playlistId: id });
      localizedText(status, () =>t("interface:playlistClonedTheDraftCopyIsEditable"));
    }),
  );
  const applyPlaylist = button('apply-playlist', localizedMessage("interface:applyPlaylistDetailsToDraft"), () =>
    attempt(() => {
      changePlaylist((item) =>
        Object.assign(item, {
          title: playlistTitle.element.value,
          order: order.element.value,
          repeat: repeat.element.value,
        }),
      );
      render();
      localizedText(status, () =>t("interface:playlistDetailsAddedToTheDraftTheCurrentSongWill"));
    }),
  );
  const appendEntry = button('add-entry', localizedMessage("interface:addSelectedTrack"), () =>
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
          throw new Error(t("interface:chooseAnEntryThatCanMoveInThatDirection"));
        [item.trackIds[at], item.trackIds[at + delta]] = [
          item.trackIds[at + delta],
          item.trackIds[at],
        ];
      });
      renderPlaylist(String(at + delta));
      dirtyState();
    });
  const up = button('entry-up', localizedMessage("interface:moveEntryUp"), () => moveEntry(-1));
  const down = button('entry-down', localizedMessage("interface:moveEntryDown"), () => moveEntry(1));
  const removeEntry = button('remove-entry', localizedMessage("interface:removeSelectedEntry"), () =>
    attempt(() => {
      const at = Number(entries.element.value);
      changePlaylist((item) => {
        if (item.trackIds.length === 1)
          throw new Error(t("interface:aPlaylistNeedsAtLeastOneTrackRemoveThePlaylist"));
        if (!Number.isInteger(at) || at < 0 || at >= item.trackIds.length)
          throw new Error(t("interface:selectAPlaylistEntry"));
        item.trackIds.splice(at, 1);
      });
      renderPlaylist();
      dirtyState();
    }),
  );
  const deletePlaylist = button('delete-playlist', localizedMessage("interface:removePlaylistFromDraft"), () =>
    attempt(() => {
      const id = playlistsSelect.element.value;
      edit((value) => {
        if (!value.playlists.some((item) => item.id === id))
          throw new Error(t("interface:cloneBuiltInPlaylistsToEditThem"));
        if (
          value.selection.playlistId === id ||
          value.assignments.some((item) => item.playlistId === id)
        )
          throw new Error(
            t("interface:chooseAnotherPlaybackPlaylistAndRemoveAssignmentsBeforeDeletingThis"),
          );
        value.playlists = value.playlists.filter((item) => item.id !== id);
      });
      render();
      localizedText(status, () =>t("interface:playlistRemovedFromTheDraft"));
    }),
  );
  const playlistSection = section(
    localizedMessage("interface:playlistEditor"),
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
  const scope = input('scope', localizedMessage("interface:assignSelectedPlaylistTo"), { tag: 'select' });
  options(scope.element, [
    ['global', t("interface:wholeGame")],
    ['theme', t("interface:currentTheme")],
    ['campaign', t("interface:currentCampaignEdition")],
    ['map', t("interface:currentMapEdition")],
  ]);
  const key = node('p', 'context-key', '', { class: 'micro-note' });
  const assignments = input('assignments', localizedMessage("interface:savedDraftedAssignments"), {
    tag: 'select',
    size: '4',
  });
  const assign = button('assign', localizedMessage("interface:assignPlaylistToThisContext"), () =>
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
      localizedText(status, () =>t("interface:assignmentAddedToTheDraftAutomaticPlaybackUsesMapCampaign"));
    }),
  );
  const unassign = button('unassign', localizedMessage("interface:removeSelectedAssignment"), () =>
    attempt(() => {
      const at = Number(assignments.element.value);
      edit((value) => {
        if (!Number.isInteger(at) || at < 0 || at >= value.assignments.length)
          throw new Error(t("interface:selectAnAssignmentToRemove"));
        value.assignments.splice(at, 1);
      });
      renderAssignments();
      dirtyState();
    }),
  );
  const assignmentSection = section(
    localizedMessage("interface:authoredMusic"),
    node(
      'p',
      null,
      localizedMessage("interface:theseExactEditionKeysComeFromTheGameChooseAutomatic"),
      { class: 'micro-note' },
    ),
    scope.field,
    key,
    assign,
    assignments.field,
    unassign,
  );
  const bundleInput = input('bundle-file', localizedMessage("interface:completeSoundtrackBackupRlsound"), {
    type: 'file',
    accept: '.rlsound,application/octet-stream',
  });
  const bundleImport = button('import-bundle', localizedMessage("interface:reviewBackupAsReplacementDraft"), () =>
    task(t("interface:checkingSoundtrackBackupAndOriginalAudio"), async (signal) => {
      const source = bundleInput.element.files?.[0];
      if (!source) throw new Error(t("interface:chooseARlsoundBackupFirst"));
      const prepared = await importSoundtrackBundle(source, { signal, probeMedia });
      throwIfSoundtrackAborted(signal);
      invalidateBackup();
      draft = prepared.library;
      assets = [...prepared.assets];
      dirty = true;
      render();
      localizedText(status, () =>t("gameplay:backupVerifiedCustomTracksCustomPlaylistsSaveAllChangesReplaces", { value1: draft.tracks.length, value2: draft.playlists.length }));
      bundleInput.element.value = '';
    }),
  );
  const bundleExport = button(
    'export-bundle',
    localizedMessage("interface:prepareSavedLibraryBackupRlsound"),
    async () => {
      const complete = await task(
        t("interface:verifyingACompleteBinarySoundtrackBackup"),
        async (signal) => {
          if (!saved) throw new Error(t("interface:loadTheSavedMusicLibraryFirst"));
          invalidateBackup();
          const blob = await exportSoundtrackBundle(saved.library, saved.assets, { signal });
          throwIfSoundtrackAborted(signal);
          if (disposed) return;
          preparedBackup = {
            blob,
            filename: 'RevealLine-soundtrack.rlsound',
            generation: saved.generation,
            url: typeof download === 'function' ? null : URLImpl.createObjectURL(blob),
          };
          localizedText(status, () =>t("interface:backupPreparedChooseDownloadPreparedBackupToRequestTheFile"));
        },
      );
      if (complete && preparedBackup && dialog.open && !disposed) bundleDownload.focus();
      return complete;
    },
  );
  // A real link allows the browser's native keyboard/touch download behavior.
  // Injected native adapters receive their own button, invoked before any await.
  const bundleDownload = node(
    typeof download === 'function' ? 'button' : 'a',
    'download-prepared',
    localizedMessage("interface:downloadPreparedBackup"),
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
      return task(t("interface:requestingThePreparedBackupFromTheDownloadAdapter"), async (signal) => {
        await download(prepared.blob, prepared.filename, { signal });
        if (!disposed && preparedBackup === prepared)
          localizedText(status, () =>t("interface:downloadRequestHandedToTheHostConfirmTheDestinationThere"));
      });
    }
    localizedText(status, () =>t("interface:downloadRequestedConfirmItInYourBrowserIfNoFile"));
    // No async work, synthetic click or automatic navigation here. The visible
    // anchor's default action uses the already prepared, retained Blob URL.
    return true;
  };
  const discardBackup = button('discard-backup', localizedMessage("interface:discardPreparedCopy"), () => {
    if (busy || disposed) return;
    invalidateBackup();
    localizedText(status, () =>t("interface:preparedCopyDiscardedSavedMusicIsUnchangedTheBrowserControls"));
  });
  const backupInfo = node('p', 'backup-info', '', { class: 'micro-note' });
  const backupReady = node('div', 'backup-ready', null, { class: 'soundtrack-backup-ready' });
  backupReady.append(backupInfo, row(bundleDownload, discardBackup));
  const transferSection = section(
    localizedMessage("interface:localFilesBackup"),
    node(
      'p',
      null,
      localizedMessage("interface:thisSeparateSoundtrackFileContainsOriginalMp3BytesANormal"),
      { class: 'micro-note' },
    ),
    row(bundleExport),
    backupReady,
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
    localizedText(status, () =>error?.name === 'AbortError'
        ? t("interface:operationCancelledTheSavedLibraryWasNotChangedByThis")
        : message(error));
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
      if (!item) throw new Error(t("interface:cloneThisBuiltInPlaylistBeforeEditingIt"));
      work(item);
    });
  }
  function pruneAssets() {
    const needed = new Set(draft.tracks.map((track) => track.asset.sha256));
    assets = assets.filter((asset) => needed.has(asset.sha256));
  }
  function dirtyState() {
    localizedText(stateLine, () =>saved
      ? t("gameplay:generationCustomTracksCustomPlaylistsOriginalAudio", { value1: dirty ? t("interface:unsavedDraft") : t("interface:saved"), value2: saved.generation, value3: draft.tracks.length, value4: draft.playlists.length, value5: bytes(assets.reduce((total, asset) => total + asset.blob.size, 0)) })
      : t("interface:localLibraryIsUnavailableBuiltInPlaybackRemainsSeparate"));
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
    localizedText(backupInfo, () =>t("gameplay:savedGenerationMetadataAndEveryReferencedOriginalMp3UnsavedDraft", { value1: bytes(preparedBackup.blob.size), value2: preparedBackup.generation }));
    if (preparedBackup.url) {
      if (busy) bundleDownload.removeAttribute('href');
      else bundleDownload.setAttribute('href', preparedBackup.url);
      bundleDownload.setAttribute('download', preparedBackup.filename);
    }
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
    localizedText(trackInfo, () =>custom
      ? t("gameplay:hzOriginalBytes", { value1: seconds(track.asset.durationSeconds), value2: bytes(track.asset.bytes), value3: track.asset.sampleRate, value4: assets.some((asset) => asset.sha256 === track.asset.sha256) ? 'present locally' : t("interface:missingRestoreACompleteBackup") })
      : t("interface:builtInProceduralSynthRecipeUseThePlaybackPlaylistTo"));
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
      throw new Error(t("gameplay:chooseAGameBeforeAssigningItsMusic", { value1: selectedScope }));
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
      localizedText(key, () =>context.key ?? t("interface:globalFallbackForTheWholeGame"));
      assign.disabled = busy || !saved;
    } catch (error) {
      localizedText(key, () =>message(error));
      assign.disabled = true;
    }
    unassign.disabled = busy || !saved || !draft.assignments.length;
  }
  function render({ playlistId, trackId } = {}) {
    options(
      tracksSelect.element,
      tracks().map((item) => [
        item.id,
        `${item.kind === 'synth' ? ("" + t("interface:builtIn") + " ") : ''}${contentText(item, 'title')}`,
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
        `${item.id.startsWith('builtin.') ? ("" + t("interface:builtIn") + " ") : ''}${contentText(item, 'title')}`,
      ]),
      playlistId ?? playlistsSelect.element.value,
    );
    options(
      selection.element,
      [
        ['', t("interface:automaticFollowMapCampaignTheme")],
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
    renderBackup();
    dirtyState();
    update();
  }
  async function task(label, work) {
    if (busy || disposed) return false;
    busy = true;
    controller = new AbortController();
    const signal = controller.signal;
    localizedText(status, () =>label);
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
    return task(t("interface:loadingSavedMusicAndLocalAudio"), async (signal) => {
      invalidateBackup();
      const value = await store.read({ signal });
      throwIfSoundtrackAborted(signal);
      saved = value;
      draft = value.library;
      assets = [...value.assets];
      dirty = false;
      player.setLibrary(draft);
      const warning = await notifyLibrary(value);
      localizedText(status, () =>warning || t("interface:savedLibraryLoadedImportsAndEditsRemainDraftsUntilSave"));
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
      return t("gameplay:libraryIsSavedButTheGameRefreshFailedReloadThe", { value1: message(error) });
    }
  }
  async function commitDraft(signal) {
    if (!saved) throw new Error(t("interface:loadTheLocalLibraryBeforeSaving"));
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
    localizedText(status, () =>warning ||
      t("interface:musicLibrarySavedAtomicallyTheCurrentSongContinuesEditedQueues"));
    return { ...saved, warning };
  }
  async function importMP3Files() {
    return task(t("interface:inspectingSelectedMp3Files"), async (signal) => {
      if (!saved) throw new Error(t("interface:loadTheLocalLibraryBeforeImporting"));
      const files = [...(fileInput.element.files ?? [])];
      if (!files.length) throw new Error(t("interface:chooseOneOrMoreMp3FilesFirst"));
      if (
        files.length + draft.tracks.length + BUILTIN_SOUNDTRACK_TRACKS.length >
        SOUNDTRACK_LIMITS.tracks
      )
        throw new Error(
          t("interface:thisBatchWouldExceedThe128TrackLibraryLimitIncluding"),
        );
      const next = copy(draft),
        added = new Map(assets.map((asset) => [asset.sha256, asset.blob]));
      let latest;
      for (let index = 0; index < files.length; index++) {
        const file = files[index];
        localizedText(status, () =>t("gameplay:inspecting", { value1: index + 1, value2: files.length, value3: file.name || t("interface:mp3Audio") }));
        const imported = await prepareMP3Import(
          file,
          {
            id: makeId('track'),
            title:
              (file.name || 'Imported MP3').replace(/\.mp3$/i, '').slice(0, 120) || t("interface:importedMp3"),
            artist: '',
            rights: {
              kind: 'personal',
              credit: t("interface:personalLocalUpload"),
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
          throw new Error(t("interface:thisDraftExceedsThe256MibAudioBudgetImportFewer"));
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
      localizedText(status, () =>t("gameplay:mp3FileVerifiedAndAddedToTheDraftEditDetails", { value1: files.length, value2: files.length === 1 ? '' : 's' }));
    });
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
    if (!track) throw new Error(t("interface:chooseAnImportedMp3ToAudition"));
    const asset = assets.find((item) => item.sha256 === track.asset.sha256);
    if (!asset)
      throw new Error(t("interface:thisMp3IsMissingLocallyRestoreItsCompleteSoundtrackBackup"));
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
        localizedText(status, () =>t("gameplay:auditioningFinishAuditionReturnsToThePreviousMusicState", { value1: contentText(track, 'title') }));
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
  function updateAudition() {
    const available = auditionURL !== null && !disposed;
    auditionControls.hidden = !available;
    toggleAudition.disabled = !available || busy;
    localizedText(toggleAudition, () =>audition.paused ? t("interface:resumeAudition") : t("interface:pauseAudition"));
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
    localizedText(now, () =>`${contentText(snapshot.track, 'title') ?? t("interface:noTrackSelected")}${snapshot.track?.artist ? ` · ${snapshot.track.artist}` : ''} · ${snapshot.status} · ${seconds(snapshot.positionSeconds)} / ${seconds(snapshot.durationSeconds)}${snapshot.pendingPlaylistId ? ' · playlist update queued' : ''}${snapshot.notice ? ` · ${snapshot.notice}` : ''}${snapshot.error ? ` · ${snapshot.error}` : ''}`);
    seek.element.max = String(snapshot.durationSeconds || 0);
    if (doc.activeElement !== seek.element)
      seek.element.value = String(snapshot.positionSeconds || 0);
    seek.element.disabled = !snapshot.track || !(snapshot.durationSeconds > 0);
    if (doc.activeElement !== volume.element) volume.element.value = String(snapshot.volume ?? 0.5);
    stopAuditionButton.disabled = auditionURL === null;
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
      localizedText(status, () =>preparedBackup
        ? t("interface:yourPreparedSavedLibraryBackupIsStillAvailableToDownload")
        : dirty
          ? t("interface:yourUnsavedDraftIsStillHere")
          : t("interface:musicLibraryReady"));
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
      localizedText(status, () =>t("interface:cancellationRequestedWaitForTheOperationToFinishBeforeLeaving"));
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
        t("interface:theAuditionCouldNotDecodeThisTrackRestoreOrReplace"),
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
