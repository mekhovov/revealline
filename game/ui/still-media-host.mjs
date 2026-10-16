import { loadBaseArtwork } from '../base-artwork.mjs';
import { t, localizedText } from '../i18n/index.mjs';
import { createOperationStatus } from './operation-status.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createStoryMediaStore } from '../story-media-store.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { exportSoundtrackBundle } from '../soundtrack-bundle.mjs';
import { resolveSoundtrackCatalogue, soundtrackTracks } from '../soundtrack.mjs';
import { soundtrackPortableRecoveryPlan } from '../soundtrack-portable.mjs';
import { SOUNDTRACK_CATALOGUE } from '../content/soundtrack-catalogue.mjs';
import { readAssetStore } from '../storage.mjs';
import { createStillAuthoringCatalog, stillAuthoringKeys } from './still-media-catalog.mjs';
import { attachStillMediaPanel } from './still-media-panel.mjs';
import { createStillMediaPreview } from './still-media-preview.mjs';
import { createControllerRouter } from './controller-router.mjs';
import { attachControllerConfirmGuard } from './controller-confirm-guard.mjs';
import { createControllerConfirmLifecycle } from './controller-confirm-lifecycle.mjs';
import { attachControllerNavigation } from './controller-navigation.mjs';
import { createAuthoringSourcePicker, attachAuthoringSourceButtons } from './authoring-sources.mjs';

export async function readStillWorkshopChannel({ signal, fetchImpl = globalThis.fetch } = {}) {
  const check = () => {
    if (signal?.aborted)
      throw new DOMException(t('interface:workshopChannelLoadCancelled'), 'AbortError');
  };
  check();
  const response = await fetchImpl(new URL('../build-info.json', import.meta.url), { signal });
  check();
  if (response.status === 404) return 'dev';
  if (!response.ok)
    throw new Error(t('interface:workshopBuildInformationCouldNotLoadRetryTheCompleteEdition'));
  const info = await response.json();
  check();
  if (!info || typeof info.version !== 'string')
    throw new Error(t('interface:workshopBuildVersionIsInvalidNoGameChannelWasSelected'));
  const channel = `release-${info.version}`;
  stillAuthoringKeys(channel);
  return channel;
}
async function readSource({ signal } = {}) {
  const get = async (path) => {
    const response = await fetch(new URL(path, import.meta.url), { signal });
    if (!response.ok)
      throw new Error(t('interface:sourceGameContentCouldNotLoadServeThisRepositoryOver'));
    return response.json();
  };
  const [campaign, themes, classes, presets, channel] = await Promise.all([
    get('../content/campaign.json'),
    get('../content/themes.json'),
    get('../content/classes.json'),
    get('../../authoring/motion-lab/presets.json'),
    readStillWorkshopChannel({ signal }),
  ]);
  return {
    baseEntry: {
      campaign: { ...campaign, classRecipes: classes },
      classRecipes: classes,
      themes: themes.themes,
      sourcePackId: null,
      ...(await loadBaseArtwork({ ...campaign, classRecipes: classes }, { signal })),
    },
    presets,
    channel,
  };
}

/** Source-only, explicit real-origin v5 entry. No manager opens on page load. */
export function attachStillMediaHost({
  document: doc = document,
  window: win = window,
  readBase = readSource,
  readAsset = readAssetStore,
  externalCatalog = readAsset === readAssetStore,
  indexedDB = globalThis.indexedDB,
  storage,
  lockManager = globalThis.navigator?.locks,
  createManager = createManagedMediaStore,
  createStills = createStillMediaStore,
  createAudio = createSoundtrackStore,
  createStories = createStoryMediaStore,
  storyInspection,
  createPreview = createStillMediaPreview,
  URLImpl = globalThis.URL,
  decodeImage,
  readPads,
  channel,
  catalogue = SOUNDTRACK_CATALOGUE,
} = {}) {
  if (channel !== undefined) stillAuthoringKeys(channel);
  const trustedCatalogue = resolveSoundtrackCatalogue(catalogue);
  const $ = (id) => doc.getElementById(id),
    status = $('still-host-status');
  let manager = null,
    stills = null,
    audio = null,
    stories = null,
    panel = null,
    opening = false,
    disposed = false,
    audioTask = null,
    audioURL = null,
    audioNotice = '',
    frame = null,
    sourceChannel = channel ?? 'dev',
    openSerial = 0,
    openController = null;

  const audioCancel = doc.createElement('button');
  audioCancel.id = 'still-host-cancel-audio';
  audioCancel.type = 'button';
  audioCancel.hidden = true;
  localizedText(audioCancel, () => t('common:actions.cancelPreparation'));
  $('still-host-export-audio').after(audioCancel);

  const feedback = createOperationStatus(status);
  let activity = null,
    failedOpening = null;
  function setStatus(message, state = 'ready') {
    if (activity) activity.update({ message, progress: null });
    else feedback.begin({ message }).finish({ message, state });
  }
  setStatus(t('interface:chooseOpenLocalMediaToReadThisEditionSPictures'));
  const now = () => win.performance?.now?.() ?? Date.now();
  const foreground = () => !disposed && !doc.hidden && doc.hasFocus();
  let lifecycle;
  const router = createControllerRouter({
    now,
    eventTarget: win,
    navigationAliases: true,
    ...(readPads ? { readPads } : {}),
  });
  let sourcePicker = null,
    stopSourceButtons = null;
  const scope = () =>
    sourcePicker?.dialog.open
      ? 'still-media-sources'
      : panel?.dialog.open
        ? 'still-media'
        : 'still-media-page';
  const menuRoot = () =>
    sourcePicker?.dialog.open ? sourcePicker.dialog : panel?.dialog.open ? panel.dialog : doc.body;
  const menuScope = () => scope();
  const guard = attachControllerConfirmGuard({
    document: doc,
    now,
    confirmPressed: () => foreground() && router.menuConfirmPressed(),
    beforeNativeActivation: (event) => {
      if (foreground()) lifecycle?.beforeNativeActivation(event);
    },
  });
  const navigation = attachControllerNavigation({
    document: doc,
    keyboard: true,
    getScope: menuScope,
    getRoot: menuRoot,
    getDefaultFocus: () => (panel?.dialog.open ? $('still-media-reload') : $('still-host-open')),
    onBack: () => {
      if (sourcePicker?.dialog.open) sourcePicker.close();
      else if (panel?.dialog.open) panel.back();
      else if (audioTask) cancelAudio();
    },
    activateFileInput: (input) => sourcePicker?.open(input),
    activateControl: (element) => guard.activate(element),
    onNativeInput: (event) => {
      lifecycle?.nativeInput(event);
      router.clear();
    },
    onHint: (text) => {
      setStatus(text);
    },
  });
  lifecycle = createControllerConfirmLifecycle({
    document: doc,
    readConfirm: (options) => router.readMenuConfirm(options),
    getContext: () => ({
      scope: menuScope(),
      root: menuRoot(),
      focused: doc.activeElement,
      active: foreground(),
    }),
    navigation,
    guard,
    now,
  });
  function clearMenuInput() {
    router.clear();
    lifecycle.cancel('workshop-input-clear');
    navigation.clear();
  }
  if (doc.head && typeof win.MutationObserver === 'function') {
    sourcePicker = createAuthoringSourcePicker({
      document: doc,
      window: win,
      onOpen: () => navigation.sync(),
      onClose: clearMenuInput,
    });
    stopSourceButtons = attachAuthoringSourceButtons({
      document: doc,
      window: win,
      picker: sourcePicker,
    });
  }
  const readyMessage = () =>
    `Real local media opened for ${channel ?? sourceChannel}. Picture assignments are ready for fresh flights in this edition.`;
  const explain = (error) =>
    error?.name === 'VersionError'
      ? t('interface:thisDatabaseNeedsANewerCompatibleMediaWorkshopOpenThat')
      : error instanceof Error
        ? error.message
        : String(error);
  function discardAudio() {
    if (audioTask) {
      activity?.clear();
      activity = null;
    }
    audioTask?.abort();
    audioTask = null;
    audioCancel.hidden = true;
    if (audioURL) URLImpl.revokeObjectURL(audioURL);
    audioURL = null;
    audioNotice = '';
    $('still-host-download-audio').hidden = true;
    $('still-host-download-audio').removeAttribute('href');
  }
  function cancelOpen() {
    ++openSerial;
    openController?.abort();
    openController = null;
    opening = false;
    feedback.clear();
    activity = null;
    failedOpening = null;
    if (!disposed) $('still-host-open').disabled = false;
  }
  function closeStorage() {
    cancelOpen();
    discardAudio();
    panel?.dispose();
    panel = null;
    stills?.close();
    audio?.close();
    stories?.close();
    manager?.close();
    stills = audio = stories = manager = null;
    $('still-host-export-audio').disabled = true;
    router.clear();
  }
  function captureAudioFocus(opener, signal) {
    const empty = (target) => !target || target === doc.body || target === doc.documentElement,
      owned = new Set([opener, audioCancel]),
      removers = [];
    let current = foreground() && scope() === 'still-media-page' && doc.activeElement === opener;
    const cancel = () => {
      current = false;
      for (const remove of removers.splice(0)) remove();
    };
    const listen = (target, type, callback) => {
      target.addEventListener(type, callback, true);
      removers.push(() => target.removeEventListener(type, callback, true));
    };
    if (current) {
      listen(doc, 'focusin', (event) => {
        if (!empty(event.target) && !owned.has(event.target)) cancel();
      });
      for (const type of ['pointerdown', 'keydown'])
        listen(doc, type, (event) => {
          if (![...owned].some((element) => element.contains(event.target))) cancel();
        });
      listen(doc, 'beforetoggle', (event) => {
        if (event.target?.tagName === 'DIALOG' && event.newState === 'open') cancel();
      });
      listen(doc, 'visibilitychange', () => {
        if (doc.hidden) cancel();
      });
      listen(win, 'blur', (event) => {
        if (event.target === win) cancel();
      });
      listen(win, 'pagehide', cancel);
      listen(signal, 'abort', cancel);
    }
    const move = (target, final) => {
      const allowed =
        current &&
        !signal.aborted &&
        foreground() &&
        scope() === 'still-media-page' &&
        !doc.querySelector('dialog[open]') &&
        (empty(doc.activeElement) || owned.has(doc.activeElement)) &&
        target?.isConnected &&
        !target.disabled &&
        !target.closest('[hidden],[inert]') &&
        target.getClientRects().length;
      if (final) cancel();
      if (allowed) target.focus();
    };
    return {
      cancel,
      hold: () => move(audioCancel, false),
      restore: (target) => move(target, true),
    };
  }
  function cancelAudio() {
    if (!audioTask) return false;
    const opener = $('still-host-export-audio'),
      focus = captureAudioFocus(
        doc.activeElement === audioCancel ? audioCancel : opener,
        new AbortController().signal,
      );
    discardAudio();
    opener.disabled = !audio;
    setStatus(t('interface:operationCancelledTheSavedLibraryWasNotChangedByThis'), 'cancelled');
    focus.restore(opener);
    return true;
  }
  async function open() {
    if (disposed || opening) return false;
    if (!['http:', 'https:'].includes(win.location.protocol)) {
      setStatus(t('interface:useLocalhostOrHttpsFileUrlsCannotSafelyOpenThis'));
      return false;
    }
    const returnFocus = doc.activeElement;
    opening = true;
    $('still-host-open').disabled = true;
    const ticket = ++openSerial;
    openController = new AbortController();
    const lease = feedback.begin({
      message: t('interface:openingThePictureWorkshopAndInstalledMapCatalogue'),
      stage: 'reading',
      isCurrent: () => !disposed && ticket === openSerial,
    });
    activity = lease;
    try {
      if (!panel) {
        const source = await readBase({ signal: openController.signal });
        if (disposed || ticket !== openSerial) return false;
        const catalog = createStillAuthoringCatalog({
          baseEntry: source.baseEntry,
          storage: storage ?? win.localStorage,
          readAsset,
          lockManager,
          decodeImage,
          channel: channel ?? source.channel ?? 'dev',
          getManagedStore: externalCatalog ? () => manager : undefined,
          indexedDB,
        });
        sourceChannel = catalog.channel;
        // Current authoring must read the same shared audio/catalogue version as the game.
        manager = createManager({ storyMedia: true, soundtrackCatalogue: true });
        stills = createStills({ managedStore: manager, decodeImage });
        audio = createAudio({ managedStore: manager });
        stories = createStories({ managedStore: manager, decodeImage });
        panel = attachStillMediaPanel({
          document: doc,
          store: stills,
          storyStore: stories,
          storyInspection,
          catalog,
          preview: createPreview({ canvas: doc.createElement('canvas'), presets: source.presets }),
          decodeImage,
          URLImpl,
          onLoaded: () => {
            // Reconcile only the failed opening that still owns the host status.
            // Newer host messages and lifecycle cancellation revoke that lease.
            failedOpening?.finish({ message: readyMessage() });
            failedOpening = null;
          },
          onClose: () => {
            if (opening) cancelOpen();
            router.clear();
            navigation.sync();
          },
        });
        $('still-host-export-audio').disabled = false;
      }
      lease.update({
        message: t('interface:openingAndVerifyingLocalPictureAndStoryOriginals'),
        stage: 'verifying',
      });
      const result = await panel.open({ returnFocus });
      if (!disposed && ticket === openSerial) {
        router.clear();
        navigation.sync();
        setStatus(
          result ? readyMessage() : t('interface:workshopOpenFailedReadItsErrorSavedDataWasNot'),
        );
        failedOpening = result ? null : lease;
      }
      lease.finish({ message: status.textContent, state: result ? 'ready' : 'error' });
      return result;
    } catch (error) {
      if (ticket !== openSerial) return false;
      closeStorage();
      if (!disposed) setStatus(explain(error), 'error');
      return false;
    } finally {
      if (activity === lease) activity = null;
      if (ticket === openSerial) {
        opening = false;
        openController = null;
        if (!disposed) $('still-host-open').disabled = false;
      }
    }
  }
  async function prepareAudio() {
    if (!audio || audioTask || disposed) return false;
    discardAudio();
    const own = new AbortController(),
      opener = $('still-host-export-audio'),
      focus = captureAudioFocus(opener, own.signal),
      ownerAudio = audio,
      ticket = openSerial;
    let completed = false;
    audioTask = own;
    opener.disabled = true;
    audioCancel.hidden = false;
    focus.hold();
    if (disposed || own.signal.aborted || audioTask !== own) {
      focus.cancel();
      return false;
    }
    const lease = feedback.begin({
      message: t('interface:readingSavedMusicAndCheckingBackupPermissions'),
      stage: 'reading',
      isCurrent: () => !disposed && audioTask === own,
    });
    activity = lease;
    try {
      const saved = await audio.read({ signal: own.signal });
      if (disposed || own.signal.aborted || audioTask !== own) return false;
      const plan = soundtrackPortableRecoveryPlan(saved.library, { catalogue: trustedCatalogue });
      const names = new Map(
        soundtrackTracks(saved.library).map((track) => [track.id, track.title]),
      );
      const notice = [
        plan.referenceOnlyTrackIds.length
          ? `Requires online restoration for listed music: ${plan.referenceOnlyTrackIds.map((id) => names.get(id) ?? id).join(', ')}.`
          : '',
        plan.notice,
      ]
        .filter(Boolean)
        .join(' ');
      lease.update({
        message: [t('interface:preparingTheVerifiedSoundtrackBackup'), notice]
          .filter(Boolean)
          .join(' '),
        stage: 'exporting',
      });
      const available = new Set(saved.assets.map((asset) => asset.sha256));
      const missing = plan.requiredTracks.filter((track) => !available.has(track.asset.sha256));
      if (missing.length)
        throw new Error(
          `Soundtrack backup needs these missing permitted originals: ${missing.map((track) => track.title).join(', ')}. Restore or download them in Music library & playlists, then retry. No backup was prepared.`,
        );
      const blob = await exportSoundtrackBundle(saved.library, saved.assets, {
        signal: own.signal,
        catalogue: trustedCatalogue,
      });
      if (disposed || own.signal.aborted || audioTask !== own) return false;
      audioURL = URLImpl.createObjectURL(blob);
      audioNotice = notice;
      const link = $('still-host-download-audio');
      link.href = audioURL;
      link.download = 'fpv-line-soundtrack.rlsound';
      link.hidden = false;
      setStatus(
        [
          `Soundtrack backup prepared (${blob.size} bytes). Choose Download soundtrack; this file does not contain still images.`,
          audioNotice,
        ]
          .filter(Boolean)
          .join(' '),
      );
      lease.finish({ message: status.textContent });
      completed = true;
      return true;
    } catch (error) {
      if (!disposed && audioTask === own) lease.finish({ message: explain(error), state: 'error' });
      return false;
    } finally {
      try {
        if (activity === lease) activity = null;
        if (audioTask === own) {
          audioTask = null;
          opener.disabled = !audio;
          audioCancel.hidden = true;
          // Re-enabling can itself start a newer operation or close this owner.
          if (!disposed && audio === ownerAudio && openSerial === ticket && audioTask === null)
            focus.restore(completed ? $('still-host-download-audio') : opener);
        }
      } finally {
        focus.cancel();
      }
    }
  }
  $('still-host-open').onclick = open;
  $('still-host-export-audio').onclick = prepareAudio;
  audioCancel.onclick = cancelAudio;
  $('still-host-export-audio').disabled = true;
  $('still-host-download-audio').onclick = () => {
    setStatus(
      [t('interface:downloadRequestedConfirmTheDestinationInYourBrowserThePrepared'), audioNotice]
        .filter(Boolean)
        .join(' '),
    );
  };
  $('still-host-close').onclick = () => {
    closeStorage();
    setStatus(t('interface:localConnectionsClosedSavedOriginalsRemainTheDatabaseVersionWas'));
    $('still-host-open').focus();
  };
  function poll(timeMs) {
    if (disposed) return;
    if (!foreground()) clearMenuInput();
    else {
      const scope = menuScope(),
        state = router.sample({ scope, timeMs });
      if (state.status.code === 'joined') navigation.engage();
      lifecycle.sample(state.confirmSnapshot);
      if (foreground() && scope === menuScope()) navigation.handle({ ...state.ui, confirm: false });
    }
    frame = win.requestAnimationFrame(poll);
  }
  // Native file dialogs may blur the page without changing its catalog. Do not
  // discard their selection; the locked save path rechecks the exact catalog.
  const blur = clearMenuInput;
  const visibility = () => {
    if (doc.hidden) {
      cancelOpen();
      clearMenuInput();
      panel?.invalidateContext();
    }
  };
  const hide = (event) => {
    cancelOpen();
    clearMenuInput();
    panel?.close();
    discardAudio();
    win.cancelAnimationFrame(frame);
    if (!event.persisted) dispose();
  };
  const show = (event) => {
    if (event.persisted && !disposed) {
      $('still-host-export-audio').disabled = !audio || Boolean(audioTask);
      frame = win.requestAnimationFrame(poll);
    }
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    closeStorage();
    feedback.dispose();
    audioCancel.onclick = null;
    audioCancel.remove();
    win.cancelAnimationFrame(frame);
    lifecycle.destroy();
    navigation.destroy();
    guard.destroy();
    stopSourceButtons?.();
    sourcePicker?.destroy();
    router.destroy();
    win.removeEventListener('blur', blur);
    win.removeEventListener('pagehide', hide);
    win.removeEventListener('pageshow', show);
    doc.removeEventListener('visibilitychange', visibility);
  }
  win.addEventListener('blur', blur);
  win.addEventListener('pagehide', hide);
  win.addEventListener('pageshow', show);
  doc.addEventListener('visibilitychange', visibility);
  frame = win.requestAnimationFrame(poll);
  return Object.freeze({
    open,
    dispose,
    get panel() {
      return panel;
    },
    navigation,
    router,
  });
}
