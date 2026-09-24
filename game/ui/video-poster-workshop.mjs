import { createOperationStatus } from './operation-status.mjs';
import { openVideoPosterSource } from '../video-poster.mjs';
import {
  createOptionalPhysicalTrimBoundary,
  isCompletePlaybackRange,
  preparePlaybackRange,
  seekDistinctPresentedFrame,
} from '../video-editor.mjs';
import { attachControllerNavigation } from './controller-navigation.mjs';
import { createControllerRouter } from './controller-router.mjs';

/** Standalone local authoring preview. No storage, assignment, game or award API. */
export function attachVideoPosterWorkshop({
  document: doc = document,
  window: win = window,
  openSource = openVideoPosterSource,
  physicalTrim = createOptionalPhysicalTrimBoundary(),
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
    trimURL = null,
    result = null,
    playbackRange = null,
    trimCapability = null,
    frame = null;

  const feedback = createOperationStatus(status);
  let activity = null;
  function setStatus(message, state = 'ready') {
    if (activity) activity.update({ message, progress: null });
    else feedback.begin({ message }).finish({ message, state });
  }
  setStatus('Choose a local video to inspect. No game or media storage is opened by this page.');
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
    const frameStep = result?.capture?.timingEvidence === 'presented-frame';
    $('step-back').disabled = $('step-forward').disabled = !source || !frameStep || Boolean(task);
    $('playback-start').disabled = $('playback-end').disabled = !source || Boolean(task);
    $('apply-range').disabled = !source || Boolean(task);
    $('check-trim').disabled = !source || Boolean(task);
    $('trim').disabled =
      !source ||
      !trimCapability?.supported ||
      !playbackRange ||
      isCompletePlaybackRange(source.info, playbackRange) ||
      Boolean(task);
    $('cancel').disabled = !task;
    $('clear').disabled = !source && !task && !previewURL && !trimURL;
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
  function discardTrim() {
    $('trim-download').hidden = true;
    $('trim-download').removeAttribute('href');
    if (trimURL) URLImpl.revokeObjectURL(trimURL);
    trimURL = null;
    $('trim-evidence').textContent =
      'No physical trim has been produced. Playback range keeps the complete original video.';
  }
  function stopTask() {
    feedback.clear();
    activity = null;
    serial++;
    task?.controller.abort();
    task = null;
    router.clear();
  }
  function cancel() {
    if (!task) return false;
    stopTask();
    setStatus(
      source
        ? 'Capture cancelled. The inspected source and any previous poster remain available.'
        : 'Inspection cancelled. Choose the source again when ready.',
      'cancelled',
    );
    controls();
    (source ? $('capture') : $('file')).focus();
    return true;
  }
  function clear({ focus = true } = {}) {
    stopTask();
    source?.dispose();
    source = null;
    discardPreview();
    discardTrim();
    playbackRange = null;
    trimCapability = null;
    $('file').value = '';
    $('metadata').textContent = 'No video inspected.';
    $('time').value = $('range').value = '0';
    $('playback-start').value = '0';
    $('playback-end').value = '0';
    setStatus('Source and preview cleared. No game data or media storage was changed.');
    controls();
    if (focus && !disposed) $('file').focus();
  }
  function begin(label) {
    stopTask();
    const current = { id: serial, controller: new AbortController() };
    task = current;
    activity = feedback.begin({
      message: label,
      stage: source ? 'decoding' : 'reading',
      isCurrent: () => !disposed && task?.id === current.id,
    });
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
    discardTrim();
    playbackRange = null;
    trimCapability = null;
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
      $('playback-start').min = $('playback-end').min = '0';
      $('playback-start').max = $('playback-end').max = String(info.durationSeconds);
      $('playback-start').value = '0';
      $('playback-end').value = String(info.durationSeconds);
      playbackRange = preparePlaybackRange(info, {
        startSeconds: 0,
        endSeconds: info.durationSeconds,
      });
      trimCapability = null;
      $('playback-evidence').textContent =
        `Playback range: 0–${info.durationSeconds} s. The complete ${info.bytes.toLocaleString()}-byte original remains the export source.`;
      $('trim-support').textContent =
        'Physical trim support has not been checked. This does not change the selected video.';
      setStatus(
        'Video inspected. Choose a time, then Capture poster. Nothing is saved to the game.',
      );
      activity?.finish({ message: status.textContent });
      activity = null;
      task = null;
      controls();
      $('time').focus();
      return true;
    } catch (error) {
      staged?.dispose();
      if (!current.current()) return false;
      $('metadata').textContent = 'Video could not be inspected.';
      activity?.finish({ message: message(error), state: 'error' });
      activity = null;
      task = null;
      controls();
      $('file').focus();
      return false;
    }
  }
  const posterMetadata = () => ({
    id: 'video-poster-preview',
    provenance: {
      kind: 'original',
      credit: 'Local video owner',
      source: 'Local authoring preview; exact source hash and time evidence accompany the PNG.',
    },
  });
  function publishPoster(candidate, requested) {
    const url = URLImpl.createObjectURL(candidate.blob);
    discardPreview();
    previewURL = url;
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
      candidate.capture.timingEvidence === 'presented-frame'
        ? 'Decoded-frame stepping is available because the browser reported a presented frame.'
        : 'Decoded-frame stepping is unavailable because this browser did not report a presented-frame timestamp.',
      'The requested decimal is not a frame-accuracy guarantee.',
      `PNG: ${candidate.asset.width} × ${candidate.asset.height} · ${candidate.asset.bytes.toLocaleString()} bytes`,
      `PNG SHA-256: ${candidate.asset.sha256}`,
      `Original SHA-256: ${candidate.capture.sourceSha256}`,
    ].join('\n');
    $('download').href = previewURL;
    $('download').download = `RevealLine-poster-${String(requested).replace('.', '-')}.png`;
    $('download').hidden = false;
    $('preview').hidden = false;
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
      setStatus('Enter a time within this video’s duration. Values are never clamped.');
      $('time').focus();
      return false;
    }
    const selectedSource = source,
      current = begin(`Capturing requested time ${requested} s…`);
    try {
      const candidate = await selectedSource.capture(requested, posterMetadata(), {
        signal: current.controller.signal,
      });
      if (!current.current() || source !== selectedSource) return false;
      publishPoster(candidate, requested);
      setStatus(
        'Poster captured. Inspect it, then explicitly Download PNG. The exact prepared bytes remain available to retry.',
      );
      activity?.finish({ message: status.textContent });
      activity = null;
      task = null;
      controls();
      $('download').focus();
      return true;
    } catch (error) {
      if (!current.current()) return false;
      setStatus(`${message(error)}${result ? ' The previous captured poster is unchanged.' : ''}`);
      activity?.finish({ message: status.textContent, state: 'error' });
      activity = null;
      task = null;
      controls();
      $('capture').focus();
      return false;
    }
  }
  async function stepFrame(direction) {
    if (disposed || task || !source || !result) return false;
    const selectedSource = source,
      current = begin(
        direction < 0 ? 'Seeking the previous decoded frame…' : 'Seeking the next decoded frame…',
      );
    try {
      const stepped = await seekDistinctPresentedFrame(
        selectedSource,
        result,
        direction,
        posterMetadata(),
        { signal: current.controller.signal },
      );
      if (!current.current() || source !== selectedSource) return false;
      publishPoster(stepped.candidate, stepped.requested);
      $('time').value = String(stepped.candidate.capture.observedMediaTime);
      $('range').value = $('time').value;
      setStatus(
        `Decoded frame moved from ${stepped.fromObservedTime} s to ${stepped.candidate.capture.observedMediaTime} s. Review the actual captured PNG.`,
      );
      activity?.finish({ message: status.textContent });
      activity = null;
      task = null;
      controls();
      (direction < 0 ? $('step-back') : $('step-forward')).focus();
      return true;
    } catch (error) {
      if (!current.current()) return false;
      setStatus(`${message(error)} The previous captured poster is unchanged.`);
      activity?.finish({ message: status.textContent, state: 'error' });
      activity = null;
      task = null;
      controls();
      return false;
    }
  }
  function applyPlaybackRange() {
    if (!source || task) return false;
    try {
      playbackRange = preparePlaybackRange(source.info, {
        startSeconds: Number($('playback-start').value),
        endSeconds: Number($('playback-end').value),
      });
      discardTrim();
      $('playback-evidence').textContent =
        `Playback range: ${playbackRange.startSeconds}–${playbackRange.endSeconds} s. ` +
        `The complete ${source.info.bytes.toLocaleString()}-byte original remains unchanged and would stay in a campaign package.`;
      setStatus('Playback range applied for review. No video bytes were trimmed or rewritten.');
      controls();
      return true;
    } catch (error) {
      setStatus(message(error));
      $('playback-start').focus();
      return false;
    }
  }
  async function checkPhysicalTrim() {
    if (!source || task) return false;
    const selectedSource = source,
      current = begin('Checking the optional physical video converter…');
    try {
      const capability = await physicalTrim.support(selectedSource.info);
      if (!current.current() || source !== selectedSource) return false;
      trimCapability = capability;
      $('trim-support').textContent = capability.supported
        ? `Physical trim adapter available for ${capability.formats.join(', ')}. Output is downloadable only after changed-byte and decoded-output verification.`
        : `${capability.reason} Playback range remains available and keeps the complete original.`;
      setStatus(
        capability.supported
          ? 'Physical trim adapter is available for this source.'
          : 'Physical trim is unavailable in this build. The selected source was not changed.',
      );
      activity?.finish({
        message: status.textContent,
        state: capability.supported ? 'ready' : 'cancelled',
      });
      activity = null;
      task = null;
      controls();
      return capability.supported;
    } catch (error) {
      if (!current.current()) return false;
      trimCapability = null;
      $('trim-support').textContent = message(error);
      activity?.finish({ message: message(error), state: 'error' });
      activity = null;
      task = null;
      controls();
      return false;
    }
  }
  async function trimVideo() {
    if (!source || task || !trimCapability?.supported) return false;
    if (!applyPlaybackRange()) return false;
    const selectedSource = source,
      current = begin('Physically trimming and verifying exported video bytes…');
    try {
      const transformed = await physicalTrim.trim(
        selectedSource.original,
        selectedSource.info,
        playbackRange,
        { signal: current.controller.signal },
      );
      if (!current.current() || source !== selectedSource) return false;
      const url = URLImpl.createObjectURL(transformed.blob);
      discardTrim();
      trimURL = url;
      $('trim-download').href = trimURL;
      $('trim-download').download =
        transformed.info.mime === 'video/webm'
          ? 'RevealLine-trimmed.webm'
          : 'RevealLine-trimmed.mp4';
      $('trim-download').hidden = false;
      $('trim-evidence').textContent = [
        `Output SHA-256: ${transformed.evidence.outputSha256}`,
        `Decoded output: ${transformed.info.width} × ${transformed.info.height} · ${transformed.info.durationSeconds} s · ${transformed.info.bytes.toLocaleString()} bytes`,
        `Audio synchronization: ${transformed.evidence.audioSync.status}. ${transformed.evidence.audioSync.note}`,
      ].join('\n');
      setStatus('Physical trim produced different bytes and passed decoded output verification.');
      activity?.finish({ message: status.textContent });
      activity = null;
      task = null;
      controls();
      $('trim-download').focus();
      return true;
    } catch (error) {
      if (!current.current()) return false;
      setStatus(`${message(error)} No trimmed download was published.`);
      activity?.finish({ message: status.textContent, state: 'error' });
      activity = null;
      task = null;
      controls();
      return false;
    }
  }
  $('file').onchange = inspect;
  $('capture').onclick = capture;
  $('step-back').onclick = () => stepFrame(-1);
  $('step-forward').onclick = () => stepFrame(1);
  $('apply-range').onclick = applyPlaybackRange;
  $('check-trim').onclick = checkPhysicalTrim;
  $('trim').onclick = trimVideo;
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
    setStatus(
      'PNG download requested. Confirm the destination in your browser; the prepared bytes remain available to retry.',
    );
  };
  $('trim-download').onclick = () => {
    setStatus(
      'Verified physical trim download requested. Confirm the destination in your browser.',
    );
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
    feedback.dispose();
    win.cancelAnimationFrame(frame);
    navigation.destroy();
    router.destroy();
    win.removeEventListener('blur', blur);
    win.removeEventListener('pagehide', hide);
    win.removeEventListener('pageshow', show);
    doc.removeEventListener('visibilitychange', visibility);
    for (const id of [
      'file',
      'capture',
      'cancel',
      'clear',
      'range',
      'time',
      'step-back',
      'step-forward',
      'playback-start',
      'playback-end',
      'apply-range',
      'check-trim',
      'trim',
      'download',
      'trim-download',
    ]) {
      $(id).onclick = $(id).onchange = $(id).oninput = null;
    }
  }
  win.addEventListener('blur', blur);
  win.addEventListener('pagehide', hide);
  win.addEventListener('pageshow', show);
  doc.addEventListener('visibilitychange', visibility);
  controls();
  frame = win.requestAnimationFrame(poll);
  if (!doc.hidden && doc.hasFocus() && (!doc.activeElement || doc.activeElement === doc.body))
    $('file').focus();
  return Object.freeze({
    inspect,
    capture,
    stepFrame,
    applyPlaybackRange,
    checkPhysicalTrim,
    trimVideo,
    cancel,
    clear,
    dispose,
    navigation,
    router,
  });
}
