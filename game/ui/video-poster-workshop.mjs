import {
  formatNumber,
  localizedAttribute,
  localizedMessage,
  localizedText,
  t,
} from '../i18n/index.mjs';
import { createOperationStatus } from './operation-status.mjs';
import { openVideoPosterSource } from '../video-poster.mjs';
import {
  createOptionalPhysicalTrimBoundary,
  isCompletePlaybackRange,
  preparePlaybackRange,
  prepareVideoTransform,
  seekDistinctPresentedFrame,
} from '../video-editor.mjs';
import { attachControllerNavigation } from './controller-navigation.mjs';
import { createControllerRouter } from './controller-router.mjs';

/** Standalone local authoring preview. No storage, assignment, game or award API. */
export function attachVideoPosterWorkshop({
  document: doc = document,
  window: win = window,
  openSource = openVideoPosterSource,
  physicalTrim = createOptionalPhysicalTrimBoundary({
    loadAdapter: async () =>
      (await import('../mediabunny-trim-adapter.mjs')).createMediabunnyTrimAdapter(),
    inspectAudio: async (blob, options) =>
      (await import('../mediabunny-trim-adapter.mjs')).inspectMediabunnyAudioTracks(blob, options),
  }),
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
  setStatus(localizedMessage('interface:chooseALocalVideoToInspectNoGameOrMedia'));
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
      localizedText(hint, () => text);
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
    $('transform').disabled = !source || Boolean(task);
    $('check-trim').disabled = !source || Boolean(task);
    $('trim').disabled =
      !source ||
      !trimCapability?.supported ||
      !playbackRange ||
      (isCompletePlaybackRange(source.info, playbackRange) && $('transform').value === 'source') ||
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
    localizedText($('evidence'), () => '');
  }
  function discardTrim() {
    $('trim-download').hidden = true;
    $('trim-download').removeAttribute('href');
    if (trimURL) URLImpl.revokeObjectURL(trimURL);
    trimURL = null;
    localizedText($('trim-evidence'), () => t('tools:videoPoster.noPhysicalTrim'));
  }
  function updateTransformPlan() {
    if (!source) {
      localizedText($('transform-plan'), () => t('tools:videoPoster.chooseVideoFirst'));
      return null;
    }
    const planned = prepareVideoTransform(source.info, $('transform').value);
    localizedText($('transform-plan'), () =>
      planned.targetVideoBitrate === null
        ? t('tools:videoPoster.transformPlanSource', {
            width: formatNumber(planned.width),
            height: formatNumber(planned.height),
          })
        : t('tools:videoPoster.transformPlanBounded', {
            width: formatNumber(planned.width),
            height: formatNumber(planned.height),
            bitrate: formatNumber(planned.targetVideoBitrate / 1_000_000),
          }),
    );
    return planned;
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
        ? localizedMessage('interface:captureCancelledTheInspectedSourceAndAnyPreviousPosterRemain')
        : localizedMessage('interface:inspectionCancelledChooseTheSourceAgainWhenReady'),
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
    localizedText($('metadata'), () => t('interface:noVideoInspected'));
    $('time').value = $('range').value = '0';
    $('playback-start').value = '0';
    $('playback-end').value = '0';
    $('transform').value = 'source';
    updateTransformPlan();
    setStatus(localizedMessage('interface:sourceAndPreviewClearedNoGameDataOrMediaStorage'));
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
    localizedText($('metadata'), () => t('interface:inspectingALocalVideo'));
    const current = begin(
      localizedMessage('interface:inspectingVideoMetadataTheSourceIsMutedAndNeverPlayed'),
    );
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
      localizedText($('metadata'), () =>
        t('gameplay:sBytesOriginalSha256', {
          value1: info.mime,
          value2: info.width,
          value3: info.height,
          value4: info.durationSeconds,
          value5: info.bytes.toLocaleString(),
          value6: info.sha256,
        }),
      );
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
      updateTransformPlan();
      localizedText($('playback-evidence'), () =>
        t('tools:videoPoster.completePlaybackRangeEvidence', {
          duration: formatNumber(info.durationSeconds),
          bytes: formatNumber(info.bytes),
        }),
      );
      localizedText($('trim-support'), () => t('tools:videoPoster.trimSupportUnchecked'));
      const completed = localizedMessage(
        'interface:videoInspectedChooseATimeThenCapturePosterNothingIs',
      );
      setStatus(completed);
      activity?.finish({ message: completed });
      activity = null;
      task = null;
      controls();
      $('time').focus();
      return true;
    } catch (error) {
      staged?.dispose();
      if (!current.current()) return false;
      localizedText($('metadata'), () => t('interface:videoCouldNotBeInspected'));
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
      credit: t('interface:localVideoOwner'),
      source: t('interface:localAuthoringPreviewExactSourceHashAndTimeEvidenceAccompany'),
    },
  });
  function publishPoster(candidate, requested) {
    const url = URLImpl.createObjectURL(candidate.blob);
    discardPreview();
    previewURL = url;
    result = candidate;
    $('image').src = previewURL;
    localizedAttribute($('image'), 'alt', () =>
      t('tools:videoPoster.capturedPosterAt', {
        seconds: formatNumber(candidate.capture.requestedTime),
      }),
    );
    const observed = candidate.capture.observedMediaTime;
    localizedText($('evidence'), () =>
      [
        t('tools:videoPoster.requestedSeekEvidence', {
          seconds: formatNumber(candidate.capture.requestedTime),
        }),
        observed === null
          ? t('tools:videoPoster.approximateFrameEvidence', {
              seconds: formatNumber(candidate.capture.playheadTime),
            })
          : t('tools:videoPoster.observedFrameEvidence', {
              observed: formatNumber(observed),
              playhead: formatNumber(candidate.capture.playheadTime),
            }),
        t(
          candidate.capture.timingEvidence === 'presented-frame'
            ? 'tools:videoPoster.frameSteppingAvailable'
            : 'tools:videoPoster.frameSteppingUnavailable',
        ),
        t('tools:videoPoster.decimalNotFrameGuarantee'),
        t('tools:videoPoster.pngEvidence', {
          width: formatNumber(candidate.asset.width),
          height: formatNumber(candidate.asset.height),
          bytes: formatNumber(candidate.asset.bytes),
        }),
        t('tools:videoPoster.pngShaEvidence', { sha256: candidate.asset.sha256 }),
        t('tools:videoPoster.originalShaEvidence', {
          sha256: candidate.capture.sourceSha256,
        }),
      ].join('\n'),
    );
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
      setStatus(localizedMessage('interface:enterATimeWithinThisVideoSDurationValuesAre'));
      $('time').focus();
      return false;
    }
    const selectedSource = source,
      current = begin(localizedMessage('gameplay:capturingRequestedTimeS', { value1: requested }));
    try {
      const candidate = await selectedSource.capture(requested, posterMetadata(), {
        signal: current.controller.signal,
      });
      if (!current.current() || source !== selectedSource) return false;
      publishPoster(candidate, requested);
      const completed = localizedMessage(
        'interface:posterCapturedInspectItThenExplicitlyDownloadPngTheExact',
      );
      setStatus(completed);
      activity?.finish({ message: completed });
      activity = null;
      task = null;
      controls();
      $('download').focus();
      return true;
    } catch (error) {
      if (!current.current()) return false;
      const failed = () =>
        `${message(error)}${
          result ? ` ${t('interface:thePreviousCapturedPosterIsUnchanged')}` : ''
        }`;
      setStatus(failed);
      activity?.finish({ message: failed, state: 'error' });
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
        localizedMessage(
          direction < 0
            ? 'tools:videoPoster.seekingPreviousFrame'
            : 'tools:videoPoster.seekingNextFrame',
        ),
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
      const completed = localizedMessage('tools:videoPoster.frameMoved', {
        from: formatNumber(stepped.fromObservedTime),
        to: formatNumber(stepped.candidate.capture.observedMediaTime),
      });
      setStatus(completed);
      activity?.finish({ message: completed });
      activity = null;
      task = null;
      controls();
      (direction < 0 ? $('step-back') : $('step-forward')).focus();
      return true;
    } catch (error) {
      if (!current.current()) return false;
      const failed = () =>
        t('tools:videoPoster.frameStepFailed', {
          error: message(error),
        });
      setStatus(failed);
      activity?.finish({ message: failed, state: 'error' });
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
      localizedText($('playback-evidence'), () =>
        t('tools:videoPoster.selectedPlaybackRangeEvidence', {
          start: formatNumber(playbackRange.startSeconds),
          end: formatNumber(playbackRange.endSeconds),
          bytes: formatNumber(source.info.bytes),
        }),
      );
      setStatus(localizedMessage('tools:videoPoster.playbackRangeApplied'));
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
      current = begin(localizedMessage('tools:videoPoster.checkingPhysicalConverter'));
    try {
      const capability = await physicalTrim.support(selectedSource.info, {
        original: selectedSource.original,
        range: playbackRange,
        transform: $('transform').value,
        signal: current.controller.signal,
      });
      if (!current.current() || source !== selectedSource) return false;
      trimCapability = capability;
      localizedText($('trim-support'), () =>
        capability.supported
          ? t('tools:videoPoster.trimSupportedEvidence', {
              detail:
                capability.detail ||
                t('tools:videoPoster.trimAdapterAvailableFor', {
                  formats: capability.formats.join(', '),
                }),
            })
          : t('tools:videoPoster.trimUnsupportedEvidence', { reason: capability.reason }),
      );
      const completed = localizedMessage(
        capability.supported
          ? 'tools:videoPoster.trimAvailable'
          : 'tools:videoPoster.trimUnavailable',
      );
      setStatus(completed);
      activity?.finish({
        message: completed,
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
      current = begin(localizedMessage('tools:videoPoster.trimmingAndVerifying'));
    try {
      const transformed = await physicalTrim.trim(
        selectedSource.original,
        selectedSource.info,
        playbackRange,
        { transform: $('transform').value, signal: current.controller.signal },
      );
      if (!current.current() || source !== selectedSource) return false;
      const url = URLImpl.createObjectURL(transformed.blob);
      discardTrim();
      trimURL = url;
      $('trim-download').href = trimURL;
      $('trim-download').download =
        transformed.info.mime === 'video/webm'
          ? 'RevealLine-transformed.webm'
          : 'RevealLine-transformed.mp4';
      $('trim-download').hidden = false;
      localizedText($('trim-evidence'), () =>
        [
          t('tools:videoPoster.outputShaEvidence', {
            sha256: transformed.evidence.outputSha256,
          }),
          t('tools:videoPoster.decodedOutputEvidence', {
            width: formatNumber(transformed.info.width),
            height: formatNumber(transformed.info.height),
            duration: formatNumber(transformed.info.durationSeconds),
            bytes: formatNumber(transformed.info.bytes),
          }),
          t('tools:videoPoster.transformEvidence', {
            target:
              transformed.evidence.transform.targetVideoBitrate === null
                ? t('tools:videoPoster.encoderDefault')
                : t('tools:videoPoster.bitrateTarget', {
                    bitrate: formatNumber(
                      transformed.evidence.transform.targetVideoBitrate / 1_000_000,
                    ),
                  }),
            observed: formatNumber(transformed.evidence.transform.observedContainerBitsPerSecond),
          }),
          t('tools:videoPoster.visualBoundariesEvidence', {
            startError: formatNumber(transformed.evidence.visual.start.meanAbsoluteRgbError),
            endError: formatNumber(transformed.evidence.visual.end.meanAbsoluteRgbError),
            method: transformed.evidence.visual.method,
          }),
          t('tools:videoPoster.audioSyncEvidence', {
            status: transformed.evidence.audioSync.status,
            note: transformed.evidence.audioSync.note,
          }),
        ].join('\n'),
      );
      const completed = localizedMessage('tools:videoPoster.trimVerified');
      setStatus(completed);
      activity?.finish({ message: completed });
      activity = null;
      task = null;
      controls();
      $('trim-download').focus();
      return true;
    } catch (error) {
      if (!current.current()) return false;
      const failed = () => t('tools:videoPoster.trimFailed', { error: message(error) });
      setStatus(failed);
      activity?.finish({ message: failed, state: 'error' });
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
  $('transform').onchange = () => {
    discardTrim();
    trimCapability = null;
    updateTransformPlan();
    localizedText($('trim-support'), () => t('tools:videoPoster.transformPlanChanged'));
    controls();
  };
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
      localizedMessage('interface:pngDownloadRequestedConfirmTheDestinationInYourBrowserThe'),
    );
  };
  $('trim-download').onclick = () => {
    setStatus(localizedMessage('tools:videoPoster.trimDownloadRequested'));
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
      'transform',
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
