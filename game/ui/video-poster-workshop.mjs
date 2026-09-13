import { openVideoPosterSource } from '../video-poster.mjs';
import { attachControllerNavigation } from './controller-navigation.mjs';
import { createControllerRouter } from './controller-router.mjs';

/** Standalone local authoring preview. No storage, assignment, game or award API. */
export function attachVideoPosterWorkshop({
  document: doc = document,
  window: win = window,
  openSource = openVideoPosterSource,
  URLImpl = globalThis.URL,
  readPads,
} = {}) {
  const $ = (id) => doc.getElementById(`video-poster-${id}`);
  const status = $('status'),
    hint = $('hint');
  let source = null,
    task = null,
    serial = 0,
    disposed = false,
    previewURL = null,
    result = null,
    frame = null;
  const router = createControllerRouter({ eventTarget: win, ...(readPads ? { readPads } : {}) });
  const navigation = attachControllerNavigation({
    document: doc,
    keyboard: true,
    getScope: () => 'video-poster-workshop',
    getRoot: () => $('main'),
    getDefaultFocus: () => $('file'),
    onNativeInput: () => router.clear(),
    onBack: () => {
      if (task) cancel();
      else $('back').click();
    },
    onHint: (text) => {
      hint.textContent = text;
    },
  });
  const message = (error) => (error instanceof Error ? error.message : String(error));
  function controls() {
    $('capture').disabled = !source || Boolean(task);
    $('time').disabled = $('range').disabled = !source || Boolean(task);
    $('cancel').disabled = !task;
    $('clear').disabled = !source && !task && !previewURL;
    navigation.sync();
  }
  function discardPreview() {
    $('preview').hidden = true;
    $('image').removeAttribute('src');
    $('download').hidden = true;
    $('download').removeAttribute('href');
    if (previewURL) URLImpl.revokeObjectURL(previewURL);
    previewURL = null;
    result = null;
    $('evidence').textContent = '';
  }
  function stopTask() {
    serial++;
    task?.controller.abort();
    task = null;
    router.clear();
  }
  function cancel() {
    if (!task) return false;
    stopTask();
    status.textContent = source
      ? 'Capture cancelled. The inspected source and any previous poster remain available.'
      : 'Inspection cancelled. Choose the source again when ready.';
    controls();
    (source ? $('capture') : $('file')).focus();
    return true;
  }
  function clear({ focus = true } = {}) {
    stopTask();
    source?.dispose();
    source = null;
    discardPreview();
    $('file').value = '';
    $('metadata').textContent = 'No video inspected.';
    $('time').value = $('range').value = '0';
    status.textContent = 'Source and preview cleared. No game data or media storage was changed.';
    controls();
    if (focus && !disposed) $('file').focus();
  }
  function begin(label) {
    stopTask();
    const current = { id: serial, controller: new AbortController() };
    task = current;
    status.textContent = label;
    controls();
    return {
      ...current,
      current: () => !disposed && task?.id === current.id && !current.controller.signal.aborted,
    };
  }
  async function inspect() {
    if (disposed) return false;
    const file = $('file').files?.[0];
    if (!file) return false; // Cancelling the OS chooser preserves the previous source.
    source?.dispose();
    source = null;
    discardPreview();
    $('metadata').textContent = 'Inspecting a local video…';
    const current = begin('Inspecting video metadata. The source is muted and never played.');
    let staged = null;
    try {
      staged = await openSource(file, { signal: current.controller.signal });
      if (!current.current()) {
        staged.dispose();
        return false;
      }
      source = staged;
      staged = null;
      const info = source.info;
      $('metadata').textContent =
        `${info.mime} · ${info.width} × ${info.height} · ${info.durationSeconds} s · ${info.bytes.toLocaleString()} bytes\nOriginal SHA-256: ${info.sha256}`;
      $('time').min = $('range').min = '0';
      $('time').max = $('range').max = String(info.durationSeconds);
      $('time').value = $('range').value = '0';
      status.textContent =
        'Video inspected. Choose a time, then Capture poster. Nothing is saved to the game.';
      task = null;
      controls();
      $('time').focus();
      return true;
    } catch (error) {
      staged?.dispose();
      if (!current.current()) return false;
      $('metadata').textContent = 'Video could not be inspected.';
      status.textContent = message(error);
      task = null;
      controls();
      $('file').focus();
      return false;
    }
  }
  async function capture() {
    if (disposed || task || !source) return false;
    const text = $('time').value.trim(),
      requested = Number(text);
    if (
      !text ||
      !Number.isFinite(requested) ||
      requested < 0 ||
      requested > source.info.durationSeconds
    ) {
      status.textContent = 'Enter a time within this video’s duration. Values are never clamped.';
      $('time').focus();
      return false;
    }
    const selectedSource = source,
      current = begin(`Capturing requested time ${requested} s…`);
    let url = null;
    try {
      const candidate = await selectedSource.capture(
        requested,
        {
          id: 'video-poster-preview',
          provenance: {
            kind: 'original',
            credit: 'Local video owner',
            source:
              'Local authoring preview; exact source hash and time evidence accompany the PNG.',
          },
        },
        { signal: current.controller.signal },
      );
      if (!current.current() || source !== selectedSource) return false;
      url = URLImpl.createObjectURL(candidate.blob);
      if (!current.current()) {
        URLImpl.revokeObjectURL(url);
        return false;
      }
      discardPreview();
      previewURL = url;
      url = null;
      result = candidate;
      $('image').src = previewURL;
      $('image').alt =
        `Captured video poster requested at ${candidate.capture.requestedTime} seconds`;
      const observed = candidate.capture.observedMediaTime;
      $('evidence').textContent = [
        `Requested seek: ${candidate.capture.requestedTime} s`,
        observed === null
          ? `Frame timestamp unavailable. Approximate playhead: ${candidate.capture.playheadTime} s.`
          : `Observed frame timestamp: ${observed} s · playhead: ${candidate.capture.playheadTime} s.`,
        'The requested decimal is not a frame-accuracy guarantee.',
        `PNG: ${candidate.asset.width} × ${candidate.asset.height} · ${candidate.asset.bytes.toLocaleString()} bytes`,
        `PNG SHA-256: ${candidate.asset.sha256}`,
        `Original SHA-256: ${candidate.capture.sourceSha256}`,
      ].join('\n');
      $('download').href = previewURL;
      $('download').download = `RevealLine-poster-${String(requested).replace('.', '-')}.png`;
      $('download').hidden = false;
      $('preview').hidden = false;
      status.textContent =
        'Poster captured. Inspect it, then explicitly Download PNG. The exact prepared bytes remain available to retry.';
      task = null;
      controls();
      $('download').focus();
      return true;
    } catch (error) {
      if (url) URLImpl.revokeObjectURL(url);
      if (!current.current()) return false;
      status.textContent = `${message(error)}${result ? ' The previous captured poster is unchanged.' : ''}`;
      task = null;
      controls();
      $('capture').focus();
      return false;
    }
  }
  $('file').onchange = inspect;
  $('capture').onclick = capture;
  $('cancel').onclick = cancel;
  $('clear').onclick = () => clear();
  $('range').oninput = () => {
    $('time').value = $('range').value;
  };
  $('time').oninput = () => {
    const value = Number($('time').value);
    if (source && Number.isFinite(value) && value >= 0 && value <= source.info.durationSeconds)
      $('range').value = String(value);
  };
  $('download').onclick = () => {
    status.textContent =
      'PNG download requested. Confirm the destination in your browser; the prepared bytes remain available to retry.';
  };
  function poll(now) {
    if (disposed) return;
    if (doc.hidden || !doc.hasFocus()) router.clear();
    else navigation.handle(router.sample({ scope: 'video-poster-workshop', timeMs: now }).ui);
    frame = win.requestAnimationFrame(poll);
  }
  const blur = () => router.clear();
  const visibility = () => {
    if (doc.hidden) {
      cancel();
      router.clear();
    }
  };
  const hide = (event) => {
    clear({ focus: false });
    win.cancelAnimationFrame(frame);
    if (!event.persisted) dispose();
  };
  const show = (event) => {
    if (event.persisted && !disposed) {
      router.clear();
      frame = win.requestAnimationFrame(poll);
    }
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    clear({ focus: false });
    win.cancelAnimationFrame(frame);
    navigation.destroy();
    router.destroy();
    win.removeEventListener('blur', blur);
    win.removeEventListener('pagehide', hide);
    win.removeEventListener('pageshow', show);
    doc.removeEventListener('visibilitychange', visibility);
    for (const id of ['file', 'capture', 'cancel', 'clear', 'range', 'time', 'download']) {
      $(id).onclick = $(id).onchange = $(id).oninput = null;
    }
  }
  win.addEventListener('blur', blur);
  win.addEventListener('pagehide', hide);
  win.addEventListener('pageshow', show);
  doc.addEventListener('visibilitychange', visibility);
  controls();
  frame = win.requestAnimationFrame(poll);
  $('file').focus();
  return Object.freeze({ inspect, capture, cancel, clear, dispose, navigation, router });
}
