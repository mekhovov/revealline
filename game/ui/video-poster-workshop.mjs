import { mountRewardVideoExport } from '../studio/reward-video-export.mjs';
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
import { attachControllerConfirmGuard } from './controller-confirm-guard.mjs';
import { createControllerConfirmLifecycle } from './controller-confirm-lifecycle.mjs';
import { createAuthoringSourcePicker, attachAuthoringSourceButtons } from './authoring-sources.mjs';

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

  const rewardExport = mountRewardVideoExport({
    container: $('reward-export'),
    URLImpl,
    getOriginal() {
      if (disposed || doc.hidden || task || !source || !result)
        throw new TypeError(t('tools:studio.videoHandoff.chooseSource'));
      return { source, poster: result };
    },
  });
  const feedback = createOperationStatus(status);
  let activity = null;
  function setStatus(message, state = 'ready') {
    if (activity) activity.update({ message, progress: null });
    else feedback.begin({ message }).finish({ message, state });
  }
  setStatus(localizedMessage('interface:chooseALocalVideoToInspectNoGameOrMedia'));
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
  const menuRoot = () => (sourcePicker?.dialog.open ? sourcePicker.dialog : $('main'));
  const menuScope = () =>
    sourcePicker?.dialog.open ? 'video-poster-sources' : 'video-poster-workshop';
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
    getDefaultFocus: () => $('file'),
    activateControl: (element) => guard.activate(element),
    onNativeInput: (event) => {
      lifecycle?.nativeInput(event);
      router.clear();
    },
    activateFileInput: (input) => sourcePicker?.open(input),
    onBack: () => {
      if (sourcePicker?.dialog.open) sourcePicker.close();
      else if (task) cancel();
      else $('back').click();
    },
    onHint: (text) => {
      localizedText(hint, () => text);
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
  const message = (error) => (error instanceof Error ? error.message : String(error));
  function controls({ syncNavigation = true } = {}) {
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
    if (syncNavigation && foreground()) navigation.sync();
  }
  // A page operation owns only its explicit opener and Cancel. Losing that
  // ownership permanently vetoes its eventual focus handoff, even after return.
  function captureFocus(opener) {
    const owned = new Set([opener, $('cancel')]),
      removers = [];
    let active = !!(opener && doc.activeElement === opener && foreground());
    const empty = (element) => !element || element === doc.body || element === doc.documentElement;
    const retire = () => {
      active = false;
      for (const remove of removers.splice(0)) remove();
    };
    const listen = (node, type, callback) => {
      node.addEventListener(type, callback, true);
      removers.push(() => node.removeEventListener(type, callback, true));
    };
    if (active) {
      listen(doc, 'focusin', (event) => {
        if (!empty(event.target) && !owned.has(event.target)) retire();
      });
      for (const type of ['pointerdown', 'keydown'])
        listen(doc, type, (event) => {
          if (![...owned].some((element) => element?.contains(event.target))) retire();
        });
      listen(win, 'blur', (event) => {
        if (event.target === win) retire();
      });
      listen(win, 'pagehide', retire);
      listen(win, 'gamepaddisconnected', retire);
      listen(doc, 'visibilitychange', () => {
        if (doc.hidden) retire();
      });
      listen(doc, 'beforetoggle', (event) => {
        if (event.target?.tagName === 'DIALOG' && event.newState === 'open') retire();
      });
    }
    const move = (target, final) => {
      const allowed =
        active &&
        foreground() &&
        (empty(doc.activeElement) || owned.has(doc.activeElement)) &&
        target?.isConnected &&
        $('main').contains(target) &&
        !target.disabled &&
        !target.closest('[hidden],[inert],dialog:not([open]),details:not([open])');
      if (final) retire();
      if (allowed && doc.activeElement !== target) target.focus();
    };
    return {
      retire,
      hold: () => move($('cancel'), false),
      restore: (target) => move(target, true),
    };
  }
  function finish(current, target) {
    if (!current.current()) return current.focus.retire();
    task = null;
    controls({ syncNavigation: false });
    if (disposed || serial !== current.id) current.focus.retire();
    else current.focus.restore(target);
    if (foreground()) navigation.sync();
  }
  function discardPreview() {
    rewardExport.reset();
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
    task?.focus.retire();
    task?.controller.abort();
    task = null;
    router.clear();
  }
  function cancel() {
    if (!task) return false;
    const focus = captureFocus(doc.activeElement === $('cancel') ? $('cancel') : task.opener);
    stopTask();
    setStatus(
      source
        ? localizedMessage('interface:captureCancelledTheInspectedSourceAndAnyPreviousPosterRemain')
        : localizedMessage('interface:inspectionCancelledChooseTheSourceAgainWhenReady'),
      'cancelled',
    );
    controls({ syncNavigation: false });
    focus.restore(source ? $('capture') : $('file'));
    if (foreground()) navigation.sync();
    return true;
  }
  function clear({ focus = true } = {}) {
    const owner = focus ? captureFocus($('clear')) : null;
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
    controls({ syncNavigation: false });
    owner?.restore($('file'));
    if (foreground()) navigation.sync();
  }
  function begin(label, opener) {
    rewardExport.reset();
    stopTask();
    const current = {
      id: serial,
      controller: new AbortController(),
      opener,
      focus: captureFocus(opener),
    };
    task = current;
    activity = feedback.begin({
      message: label,
      stage: source ? 'decoding' : 'reading',
      isCurrent: () => !disposed && task?.id === current.id,
    });
    controls({ syncNavigation: false });
    current.focus.hold();
    if (foreground()) navigation.sync();
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
      $('file'),
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
      finish(current, $('time'));
      return true;
    } catch (error) {
      staged?.dispose();
      if (!current.current()) return false;
      localizedText($('metadata'), () => t('interface:videoCouldNotBeInspected'));
      activity?.finish({ message: message(error), state: 'error' });
      activity = null;
      finish(current, $('file'));
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
    $('download').download = `fpv-line-poster-${String(requested).replace('.', '-')}.png`;
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
      captureFocus($('capture')).restore($('time'));
      return false;
    }
    const selectedSource = source,
      current = begin(
        localizedMessage('gameplay:capturingRequestedTimeS', { value1: requested }),
        $('capture'),
      );
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
      finish(current, $('download'));
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
      finish(current, $('capture'));
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
        direction < 0 ? $('step-back') : $('step-forward'),
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
      finish(current, direction < 0 ? $('step-back') : $('step-forward'));
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
      finish(current, direction < 0 ? $('step-back') : $('step-forward'));
      return false;
    }
  }
  function applyPlaybackRange(opener = $('apply-range')) {
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
      captureFocus(opener).restore($('playback-start'));
      return false;
    }
  }
  async function checkPhysicalTrim() {
    if (!source || task) return false;
    const selectedSource = source,
      current = begin(
        localizedMessage('tools:videoPoster.checkingPhysicalConverter'),
        $('check-trim'),
      );
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
      finish(current, $('check-trim'));
      return capability.supported;
    } catch (error) {
      if (!current.current()) return false;
      trimCapability = null;
      $('trim-support').textContent = message(error);
      activity?.finish({ message: message(error), state: 'error' });
      activity = null;
      finish(current, $('check-trim'));
      return false;
    }
  }
  async function trimVideo() {
    if (!source || task || !trimCapability?.supported) return false;
    if (!applyPlaybackRange($('trim'))) return false;
    const selectedSource = source,
      current = begin(localizedMessage('tools:videoPoster.trimmingAndVerifying'), $('trim'));
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
          ? 'fpv-line-transformed.webm'
          : 'fpv-line-transformed.mp4';
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
      finish(current, $('trim-download'));
      return true;
    } catch (error) {
      if (!current.current()) return false;
      const failed = () => t('tools:videoPoster.trimFailed', { error: message(error) });
      setStatus(failed);
      activity?.finish({ message: failed, state: 'error' });
      activity = null;
      finish(current, $('trim'));
      return false;
    }
  }
  $('file').onchange = inspect;
  $('capture').onclick = capture;
  $('step-back').onclick = () => stepFrame(-1);
  $('step-forward').onclick = () => stepFrame(1);
  $('apply-range').onclick = () => applyPlaybackRange();
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
  const blur = clearMenuInput;
  const visibility = () => {
    if (doc.hidden) {
      rewardExport.reset();
      cancel();
      clearMenuInput();
    }
  };
  const hide = (event) => {
    clear({ focus: false });
    win.cancelAnimationFrame(frame);
    if (!event.persisted) dispose();
  };
  const show = (event) => {
    if (event.persisted && !disposed) {
      clearMenuInput();
      frame = win.requestAnimationFrame(poll);
    }
  };
  function dispose() {
    if (disposed) return;
    disposed = true;
    clear({ focus: false });
    feedback.dispose();
    rewardExport.dispose();
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
