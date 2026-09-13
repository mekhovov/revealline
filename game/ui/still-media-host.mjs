import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { exportSoundtrackBundle } from '../soundtrack-bundle.mjs';
import { readAssetStore } from '../storage.mjs';
import { createStillAuthoringCatalog } from './still-media-catalog.mjs';
import { attachStillMediaPanel } from './still-media-panel.mjs';
import { createStillMediaPreview } from './still-media-preview.mjs';
import { createControllerRouter } from './controller-router.mjs';
import { attachControllerNavigation } from './controller-navigation.mjs';

async function readSource({ signal } = {}) {
  const get = async (path) => {
    const response = await fetch(new URL(path, import.meta.url), { signal });
    if (!response.ok)
      throw new Error('Source game content could not load. Serve this repository over HTTP.');
    return response.json();
  };
  const [campaign, themes, classes, presets] = await Promise.all([
    get('../content/campaign.json'),
    get('../content/themes.json'),
    get('../content/classes.json'),
    get('../../authoring/motion-lab/presets.json'),
  ]);
  return {
    baseEntry: {
      campaign: { ...campaign, classRecipes: classes },
      classRecipes: classes,
      themes: themes.themes,
      sourcePackId: null,
      visualOverrides: {},
      levelVisuals: [],
    },
    presets,
  };
}

/** Source-only, explicit real-origin v3 entry. No manager opens on page load. */
export function attachStillMediaHost({
  document: doc = document,
  window: win = window,
  readBase = readSource,
  readAsset = readAssetStore,
  storage,
  lockManager = globalThis.navigator?.locks,
  createManager = createManagedMediaStore,
  createStills = createStillMediaStore,
  createAudio = createSoundtrackStore,
  createPreview = createStillMediaPreview,
  URLImpl = globalThis.URL,
  decodeImage,
  readPads,
} = {}) {
  const $ = (id) => doc.getElementById(id),
    status = $('still-host-status');
  let manager = null,
    stills = null,
    audio = null,
    panel = null,
    opening = false,
    disposed = false,
    audioTask = null,
    audioURL = null,
    frame = null,
    openSerial = 0,
    openController = null;
  const router = createControllerRouter({ eventTarget: win, ...(readPads ? { readPads } : {}) });
  const navigation = attachControllerNavigation({
    document: doc,
    keyboard: true,
    getScope: () => (panel?.dialog.open ? 'still-media' : 'still-media-page'),
    getRoot: () => (panel?.dialog.open ? panel.dialog : doc),
    getDefaultFocus: () => (panel?.dialog.open ? $('still-media-reload') : $('still-host-open')),
    onBack: () => panel?.close(),
    onNativeInput: () => router.clear(),
    onHint: (text) => {
      status.textContent = text;
    },
  });
  const explain = (error) =>
    error?.name === 'VersionError'
      ? 'This database needs a newer compatible media workshop. Open that version to recover/export it. No downgrade or deletion was attempted.'
      : error instanceof Error
        ? error.message
        : String(error);
  function discardAudio() {
    audioTask?.abort();
    audioTask = null;
    if (audioURL) URLImpl.revokeObjectURL(audioURL);
    audioURL = null;
    $('still-host-download-audio').hidden = true;
    $('still-host-download-audio').removeAttribute('href');
  }
  function cancelOpen() {
    ++openSerial;
    openController?.abort();
    openController = null;
    opening = false;
    if (!disposed) $('still-host-open').disabled = false;
  }
  function closeStorage() {
    cancelOpen();
    discardAudio();
    panel?.dispose();
    panel = null;
    stills?.close();
    audio?.close();
    manager?.close();
    stills = audio = manager = null;
    $('still-host-export-audio').disabled = true;
    router.clear();
  }
  async function open() {
    if (disposed || opening) return false;
    if (!['http:', 'https:'].includes(win.location.protocol)) {
      status.textContent =
        'Use localhost or HTTPS. File URLs cannot safely open this same-origin workshop.';
      return false;
    }
    opening = true;
    $('still-host-open').disabled = true;
    const ticket = ++openSerial;
    openController = new AbortController();
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
        });
        manager = createManager({ richStillMedia: true });
        stills = createStills({ managedStore: manager, decodeImage });
        audio = createAudio({ managedStore: manager });
        panel = attachStillMediaPanel({
          document: doc,
          store: stills,
          catalog,
          preview: createPreview({ canvas: doc.createElement('canvas'), presets: source.presets }),
          decodeImage,
          onClose: () => {
            router.clear();
            navigation.sync();
          },
        });
        $('still-host-export-audio').disabled = false;
      }
      const result = await panel.open();
      if (!disposed && ticket === openSerial) {
        router.clear();
        navigation.sync();
        status.textContent = result
          ? 'Real local media opened. Workshop assignments are separate from game artwork.'
          : 'Workshop open failed. Read its error; saved data was not replaced. Audio recovery can be attempted after closing the dialog.';
      }
      return result;
    } catch (error) {
      if (ticket !== openSerial) return false;
      closeStorage();
      if (!disposed) status.textContent = explain(error);
      return false;
    } finally {
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
    const own = new AbortController();
    audioTask = own;
    $('still-host-export-audio').disabled = true;
    status.textContent = 'Reading and verifying the complete saved soundtrack…';
    try {
      const saved = await audio.read({ signal: own.signal });
      const blob = await exportSoundtrackBundle(saved.library, saved.assets, {
        signal: own.signal,
      });
      if (disposed || own.signal.aborted || audioTask !== own) return false;
      audioURL = URLImpl.createObjectURL(blob);
      const link = $('still-host-download-audio');
      link.href = audioURL;
      link.download = 'RevealLine-soundtrack.rlsound';
      link.hidden = false;
      status.textContent = `Soundtrack backup prepared (${blob.size} bytes). Choose Download soundtrack; this file does not contain still images.`;
      link.focus();
      return true;
    } catch (error) {
      if (!disposed && audioTask === own) status.textContent = explain(error);
      return false;
    } finally {
      if (audioTask === own) {
        audioTask = null;
        $('still-host-export-audio').disabled = !audio;
      }
    }
  }
  $('still-host-open').onclick = open;
  $('still-host-export-audio').onclick = prepareAudio;
  $('still-host-export-audio').disabled = true;
  $('still-host-download-audio').onclick = () => {
    status.textContent =
      'Download requested. Confirm the destination in your browser; the prepared copy remains available to retry.';
  };
  $('still-host-close').onclick = () => {
    closeStorage();
    status.textContent =
      'Local connections closed. Saved originals remain; the database version was not downgraded.';
    $('still-host-open').focus();
  };
  function poll(now) {
    if (disposed) return;
    if (doc.hidden || !doc.hasFocus()) router.clear();
    else
      navigation.handle(
        router.sample({
          scope: panel?.dialog.open ? 'still-media' : 'still-media-page',
          timeMs: now,
        }).ui,
      );
    frame = win.requestAnimationFrame(poll);
  }
  // Native file dialogs may blur the page without changing its catalog. Do not
  // discard their selection; the locked save path rechecks the exact catalog.
  const blur = () => router.clear();
  const visibility = () => {
    if (doc.hidden) {
      cancelOpen();
      router.clear();
      panel?.invalidateContext();
    }
  };
  const hide = (event) => {
    cancelOpen();
    router.clear();
    panel?.close();
    discardAudio();
    win.cancelAnimationFrame(frame);
    if (!event.persisted) dispose();
  };
  const show = (event) => {
    if (event.persisted && !disposed) frame = win.requestAnimationFrame(poll);
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    closeStorage();
    win.cancelAnimationFrame(frame);
    navigation.destroy();
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
