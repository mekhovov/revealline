import { t, localizedText } from '../i18n/index.mjs';
import { createOperationStatus } from './operation-status.mjs';
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

  const feedback = createOperationStatus(status);
  let activity = null;
  function setStatus(message, state = 'ready') {
    if (activity) activity.update({ message, progress: null });
    else feedback.begin({ message }).finish({ message, state });
  }
  setStatus(t("interface:chooseALocalVideoToInspectNoGameOrMedia"));
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
      localizedText(hint, () =>text);
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
    localizedText($('evidence'), () =>'');
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
        ? t("interface:captureCancelledTheInspectedSourceAndAnyPreviousPosterRemain")
        : t("interface:inspectionCancelledChooseTheSourceAgainWhenReady"),
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
    $('file').value = '';
    localizedText($('metadata'), () =>t("interface:noVideoInspected"));
    $('time').value = $('range').value = '0';
    setStatus(t("interface:sourceAndPreviewClearedNoGameDataOrMediaStorage"));
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
    localizedText($('metadata'), () =>t("interface:inspectingALocalVideo"));
    const current = begin(t("interface:inspectingVideoMetadataTheSourceIsMutedAndNeverPlayed"));
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
      localizedText($('metadata'), () =>t("gameplay:sBytesOriginalSha256", { value1: info.mime, value2: info.width, value3: info.height, value4: info.durationSeconds, value5: info.bytes.toLocaleString(), value6: info.sha256 }));
      $('time').min = $('range').min = '0';
      $('time').max = $('range').max = String(info.durationSeconds);
      $('time').value = $('range').value = '0';
      setStatus(
        t("interface:videoInspectedChooseATimeThenCapturePosterNothingIs"),
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
      localizedText($('metadata'), () =>t("interface:videoCouldNotBeInspected"));
      activity?.finish({ message: message(error), state: 'error' });
      activity = null;
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
      setStatus(t("interface:enterATimeWithinThisVideoSDurationValuesAre"));
      $('time').focus();
      return false;
    }
    const selectedSource = source,
      current = begin(t("gameplay:capturingRequestedTimeS", { value1: requested }));
    let url = null;
    try {
      const candidate = await selectedSource.capture(
        requested,
        {
          id: 'video-poster-preview',
          provenance: {
            kind: 'original',
            credit: t("interface:localVideoOwner"),
            source:
              t("interface:localAuthoringPreviewExactSourceHashAndTimeEvidenceAccompany"),
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
        t("gameplay:capturedVideoPosterRequestedAtSeconds", { value1: candidate.capture.requestedTime });
      const observed = candidate.capture.observedMediaTime;
      localizedText($('evidence'), () =>[
        t("gameplay:requestedSeekS", { value1: candidate.capture.requestedTime }),
        observed === null
          ? t("gameplay:frameTimestampUnavailableApproximatePlayheadS", { value1: candidate.capture.playheadTime })
          : t("gameplay:observedFrameTimestampSPlayheadS", { value1: observed, value2: candidate.capture.playheadTime }),
        'The requested decimal is not a frame-accuracy guarantee.',
        t("gameplay:pngBytes", { value1: candidate.asset.width, value2: candidate.asset.height, value3: candidate.asset.bytes.toLocaleString() }),
        t("gameplay:pngSha256", { value1: candidate.asset.sha256 }),
        t("gameplay:originalSha256", { value1: candidate.capture.sourceSha256 }),
      ].join('\n'));
      $('download').href = previewURL;
      $('download').download = `RevealLine-poster-${String(requested).replace('.', '-')}.png`;
      $('download').hidden = false;
      $('preview').hidden = false;
      setStatus(
        t("interface:posterCapturedInspectItThenExplicitlyDownloadPngTheExact"),
      );
      activity?.finish({ message: status.textContent });
      activity = null;
      task = null;
      controls();
      $('download').focus();
      return true;
    } catch (error) {
      if (url) URLImpl.revokeObjectURL(url);
      if (!current.current()) return false;
      setStatus(`${message(error)}${result ? (" " + t("interface:thePreviousCapturedPosterIsUnchanged") + "") : ''}`);
      activity?.finish({ message: status.textContent, state: 'error' });
      activity = null;
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
    setStatus(
      t("interface:pngDownloadRequestedConfirmTheDestinationInYourBrowserThe"),
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
  if (!doc.hidden && doc.hasFocus() && (!doc.activeElement || doc.activeElement === doc.body))
    $('file').focus();
  return Object.freeze({ inspect, capture, cancel, clear, dispose, navigation, router });
}
