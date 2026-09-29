import { createOperationStatus } from './operation-status.mjs';
import { bindAudioMasterMedia } from './audio-master.mjs';
import { required } from '../data-json.mjs';
import { requirePreparedVictoryStory, VICTORY_STORY_LIMITS } from '../victory-story.mjs';

/** Temporary multiplicative gain leases; never owns base volume, song or listening intent.
 * applyGain must target a dedicated session-mixer factor, not a saved preference.
 */
export function createStoryMusicDucker(applyGain) {
  required(typeof applyGain === 'function', 'A temporary music-gain adapter is required.');
  const leases = new Map();
  const apply = () => applyGain(Math.min(1, ...leases.values()));
  return Object.freeze({
    acquire(gain = 0.2) {
      required(Number.isFinite(gain) && gain >= 0 && gain <= 1, 'Invalid music duck factor.');
      const token = {};
      leases.set(token, gain);
      try {
        apply();
      } catch (error) {
        leases.delete(token);
        try {
          apply();
        } catch {
          /* The caller reports an unavailable mixer. */
        }
        throw error;
      }
      let released = false;
      return () => {
        if (!released) {
          released = true;
          leases.delete(token);
          apply();
        }
      };
    },
  });
}

/** Standalone optional presentation. Caller supplies an already decoded exact poster
 * element and its verified pin. No simulation, award, storage or assignment callback exists.
 */
export function createVictoryStoryPresentation({
  container,
  posterElement,
  picturePin,
  prepared,
  document = container?.ownerDocument,
  window = document?.defaultView,
  createVideo = () => document.createElement('video'),
  URLImpl = globalThis.URL,
  timers = globalThis,
  musicDucker = null,
  audioMaster = null,
  volume = 0.7,
  masterVolume = 1,
  muted = false,
  reducedMotion = false,
  timeoutMs = VICTORY_STORY_LIMITS.timeoutMs,
  onChange = () => {},
  signal,
} = {}) {
  const story = requirePreparedVictoryStory(prepared, picturePin).descriptor;
  required(
    container?.append && posterElement && document?.createElement,
    'A native poster presentation container is required.',
  );
  required(
    container.contains(posterElement),
    'The exact poster must already belong to this container.',
  );
  required(
    typeof onChange === 'function' &&
      typeof createVideo === 'function' &&
      typeof URLImpl?.createObjectURL === 'function' &&
      typeof URLImpl?.revokeObjectURL === 'function',
    'Story presentation adapters are unavailable.',
  );
  required(
    !musicDucker || typeof musicDucker.acquire === 'function',
    'Invalid temporary music duck adapter.',
  );
  required(
    Number.isFinite(timeoutMs) && timeoutMs > 0 && timeoutMs <= 60000,
    'Invalid story timeout.',
  );
  const preferences = (v, reduced) =>
    required(
      Number.isFinite(v) && v >= 0 && v <= 1 && typeof reduced === 'boolean',
      'Invalid cinematic volume or reduced-motion preference.',
    );
  const masterPreferences = (value, silent) =>
    required(
      Number.isFinite(value) && value >= 0 && value <= 1 && typeof silent === 'boolean',
      'Invalid cinematic master volume or mute.',
    );
  masterPreferences(masterVolume, muted);
  preferences(volume, reducedMotion);
  const element = document.createElement('section');
  element.className = 'victory-story';
  element.setAttribute('aria-label', 'Optional victory story');
  const description = document.createElement('p');
  description.textContent = story.description;
  const notice = document.createElement('p');
  const feedback = createOperationStatus(notice);
  let activity = null;
  notice.tabIndex = -1;
  const controls = document.createElement('div');
  const buttons = {};
  for (const label of ['Play', 'Pause', 'Skip', 'Replay']) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    controls.append(button);
    buttons[label.toLowerCase()] = button;
  }
  const volumeLabel = document.createElement('label');
  volumeLabel.textContent = 'Cinematic volume';
  const volumeInput = document.createElement('input');
  volumeInput.type = 'range';
  volumeInput.min = '0';
  volumeInput.max = '1';
  volumeInput.step = '0.05';
  volumeInput.value = String(volume);
  volumeInput.setAttribute('aria-label', 'Cinematic volume');
  volumeLabel.append(volumeInput);
  controls.append(volumeLabel);
  element.append(description, notice, controls);
  container.append(element);
  const posterHidden = posterElement.hidden;
  let media = null,
    url = null,
    disposed = false,
    state = 'preparing',
    reason = null;
  let desired = false,
    ready = false,
    hasPlayed = false,
    generation = 0,
    playEpoch = 0;
  let metadataSeen = false,
    seekingStart = false,
    keepPoster = false;
  let deadline = null,
    pulse = null,
    frame = null,
    releaseDuck = null,
    cancelPlay = null;
  let audioWarning = null;
  let masterBinding = null,
    releaseMasterStatus = null;
  const applyAudio = () => {
    if (!media) return;
    if (masterBinding) masterBinding.setLocal({ volume, muted: !desired || volume === 0 });
    else {
      media.volume = volume * masterVolume;
      media.muted = !desired || muted || volume === 0 || masterVolume === 0;
    }
  };
  const listeners = [];
  const listen = (target, name, fn) => {
    target?.addEventListener(name, fn);
    listeners.push(() => target?.removeEventListener(name, fn));
  };
  const activePage = () => !document.hidden && (!document.hasFocus || document.hasFocus());
  const snapshot = () =>
    Object.freeze({
      state,
      reason,
      audioWarning,
      volume,
      reducedMotion,
      startSeconds: story.segment.startSeconds,
      endSeconds: story.segment.endSeconds,
      positionSeconds: Number.isFinite(media?.currentTime) ? media.currentTime : null,
    });
  const emit = () => {
    if (!disposed) onChange(snapshot());
  };
  const render = () => {
    if (disposed) return;
    const showing = state === 'playing' || state === 'paused' || state === 'starting';
    posterElement.hidden = showing;
    if (media) media.hidden = !showing;
    buttons.play.hidden = hasPlayed && state === 'poster';
    buttons.play.textContent = state === 'paused' ? 'Resume story' : 'Play';
    buttons.play.disabled = !ready || ['playing', 'starting', 'preparing', 'error'].includes(state);
    buttons.pause.hidden = !['playing', 'starting'].includes(state);
    buttons.skip.hidden = state === 'poster' || state === 'error';
    buttons.replay.hidden = !hasPlayed || !['poster', 'blocked', 'paused'].includes(state);
    let message =
      reason ||
      (state === 'preparing'
        ? 'Preparing optional story. Your picture is unchanged.'
        : state === 'starting'
          ? 'Starting story playback…'
          : state === 'playing'
            ? 'Story playing.'
            : state === 'paused'
              ? 'Story paused. Resume explicitly.'
              : reducedMotion
                ? 'Reduced motion: the earned picture stays available. Play is optional.'
                : 'Your picture. Story playback is optional.');
    const master = audioMaster?.snapshot();
    if (master ? master.muted || master.volume === 0 : muted || masterVolume === 0)
      message += ' Master sound is muted; cinematic volume does not unmute it.';
    if (audioWarning) message += ` ${audioWarning}`;
    if (state === 'preparing' || state === 'starting') {
      activity ??= feedback.begin({ message, isCurrent: () => !disposed });
      activity.update({ message, stage: state === 'starting' ? 'playing' : 'decoding' });
    } else {
      (activity ?? feedback.begin({ message })).finish({
        message,
        state: state === 'error' || state === 'blocked' ? 'error' : 'ready',
      });
      activity = null;
    }
    const focused = document.activeElement;
    if (Object.values(buttons).includes(focused) && (focused.hidden || focused.disabled)) {
      (
        Object.values(buttons).find((button) => !button.hidden && !button.disabled) ?? notice
      ).focus();
    }
    emit();
  };
  const stopDeadline = () => {
    if (deadline !== null) timers.clearTimeout(deadline);
    deadline = null;
  };
  const stopPulses = () => {
    if (pulse !== null) timers.clearInterval(pulse);
    pulse = null;
    if (frame !== null) media?.cancelVideoFrameCallback?.(frame);
    frame = null;
  };
  const releaseLease = (release) => {
    try {
      release?.();
    } catch {
      audioWarning = 'Music gain could not be restored. Check the music controls.';
    }
  };
  const unduck = () => {
    const release = releaseDuck;
    releaseDuck = null;
    releaseLease(release);
  };
  const halt = () => {
    desired = false;
    playEpoch++;
    stopDeadline();
    stopPulses();
    const cancel = cancelPlay;
    cancelPlay = null;
    cancel?.(false);
    if (media) {
      applyAudio();
      media.pause();
    }
    unduck();
  };
  const fail = (message) => {
    if (disposed) return;
    halt();
    if (disposed) return;
    state = 'error';
    reason = message;
    render();
  };
  const armDeadline = (message) => {
    if (disposed) return;
    stopDeadline();
    deadline = timers.setTimeout(() => fail(message), timeoutMs);
  };
  const finish = (why) => {
    halt();
    if (disposed) return;
    state = 'poster';
    reason = why;
    render();
  };
  function pause() {
    if (disposed) return false;
    const inFlight = ['playing', 'starting', 'preparing'].includes(state);
    halt();
    if (disposed) return false;
    if (inFlight) {
      keepPoster = !ready;
      state = ready && hasPlayed ? 'paused' : 'poster';
      reason = 'Story paused. Play again explicitly.';
      if (!ready) armDeadline('Story preparation timed out. Your picture is unchanged.');
      render();
    }
    return inFlight;
  }
  function skip() {
    if (disposed) return false;
    keepPoster = true;
    finish('Story skipped. Your exact picture is unchanged.');
    if (disposed) return false;
    if (!ready) armDeadline('Story preparation timed out. Your picture is unchanged.');
    return true;
  }
  function observe() {
    if (disposed || !desired || !['playing', 'starting'].includes(state)) return;
    if (!activePage()) {
      pause();
      return;
    }
    const time = media.currentTime;
    if (
      media.videoWidth !== story.source.width ||
      media.videoHeight !== story.source.height ||
      media.duration !== story.source.durationSeconds
    ) {
      fail('Playback metadata changed. Your picture is unchanged.');
      return;
    }
    if (!Number.isFinite(time) || time < story.segment.startSeconds - 0.001) {
      fail('Story left its selected segment.');
      return;
    }
    if (time >= story.segment.endSeconds) finish('Story ended. Your exact picture is unchanged.');
    else if (media.ended)
      fail('The video ended before the selected segment finished. Your picture is unchanged.');
  }
  function scheduleFrames(token) {
    if (typeof media?.requestVideoFrameCallback !== 'function') return;
    const video = media;
    const handle = video.requestVideoFrameCallback(() => {
      if (disposed || video !== media || token !== playEpoch || !desired) return;
      if (frame === handle) frame = null;
      observe();
      if (desired) scheduleFrames(token);
    });
    frame = handle;
  }
  function play() {
    if (
      disposed ||
      !ready ||
      !activePage() ||
      ['playing', 'starting', 'error', 'preparing'].includes(state)
    )
      return Promise.resolve(false);
    if (media.currentTime >= story.segment.endSeconds) return replay();
    const video = media,
      token = ++playEpoch;
    const cancelled = new Promise((resolve) => {
      cancelPlay = resolve;
    });
    desired = true;
    state = 'starting';
    reason = null;
    try {
      const allocatedDuck = musicDucker?.acquire(0.2) ?? null;
      if (disposed || token !== playEpoch || !desired) {
        releaseLease(allocatedDuck);
        return Promise.resolve(false);
      }
      releaseDuck = allocatedDuck;
      applyAudio();
      armDeadline('Story playback did not begin. Skip or close the story.');
      // Invoke play within this call, before any await, preserving native user activation.
      const started = video.play();
      render();
      const completion = Promise.resolve(started).then(
        () => {
          if (disposed || token !== playEpoch || video !== media || !desired) {
            if (video !== media || !desired) video.pause();
            return false;
          }
          stopDeadline();
          cancelPlay = null;
          state = 'playing';
          hasPlayed = true;
          pulse = timers.setInterval(observe, 25);
          scheduleFrames(token);
          render();
          observe();
          return state === 'playing';
        },
        (error) => {
          if (disposed || token !== playEpoch || video !== media) return false;
          halt();
          if (disposed) return false;
          state = error?.name === 'NotAllowedError' ? 'blocked' : 'error';
          reason =
            state === 'blocked'
              ? 'Your browser blocked playback. Use Play again or keep the picture.'
              : 'This video could not play. Your picture remains available.';
          render();
          return false;
        },
      );
      return Promise.race([completion, cancelled]);
    } catch (error) {
      halt();
      if (disposed) return Promise.resolve(false);
      state = error?.name === 'NotAllowedError' ? 'blocked' : 'error';
      reason =
        state === 'blocked'
          ? 'Your browser needs an explicit Play action.'
          : 'Story playback is unavailable. Your picture remains available.';
      render();
      return Promise.resolve(false);
    }
  }
  function seekStart(autoplay = false) {
    halt();
    if (disposed) return;
    ready = false;
    seekingStart = true;
    desired = autoplay;
    state = keepPoster ? 'poster' : 'preparing';
    if (!keepPoster) reason = null;
    armDeadline('The selected story start could not be reached. Your picture is unchanged.');
    try {
      media.currentTime = story.segment.startSeconds;
      render();
      if (disposed) return;
      if (!media.seeking && Math.abs(media.currentTime - story.segment.startSeconds) <= 0.001)
        finishSeek();
    } catch {
      fail('The selected story start could not be reached.');
    }
  }
  function finishSeek() {
    if (
      disposed ||
      ready ||
      !seekingStart ||
      !['preparing', 'poster'].includes(state) ||
      media.seeking ||
      media.readyState < 2
    )
      return;
    if (Math.abs(media.currentTime - story.segment.startSeconds) > 0.001) {
      fail('The requested story seek was not honored.');
      return;
    }
    const autoplay = desired;
    stopDeadline();
    seekingStart = false;
    ready = true;
    desired = false;
    state = 'poster';
    if (!keepPoster) reason = null;
    render();
    if (autoplay && activePage()) void play();
  }
  function replay() {
    if (disposed || !activePage() || !ready || state === 'error') return Promise.resolve(false);
    keepPoster = false;
    seekStart(true);
    return Promise.resolve(true);
  }
  function setPreferences(next) {
    if (disposed) return;
    const v = next.volume ?? volume,
      reduced = next.reducedMotion ?? reducedMotion;
    const master = next.masterVolume ?? masterVolume,
      silent = next.muted ?? muted;
    masterPreferences(master, silent);
    preferences(v, reduced);
    masterVolume = master;
    muted = silent;
    volume = v;
    volumeInput.value = String(v);
    const changed = !reducedMotion && reduced;
    reducedMotion = reduced;
    applyAudio();
    if (changed) skip();
    else render();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    feedback.dispose();
    halt();
    releaseMasterStatus?.();
    releaseMasterStatus = null;
    masterBinding?.dispose();
    masterBinding = null;
    generation++;
    for (const remove of listeners.splice(0)) remove();
    if (media) {
      media.muted = true;
      media.removeAttribute('src');
      media.load();
      media.remove();
      media = null;
    }
    if (url) URLImpl.revokeObjectURL(url);
    url = null;
    posterElement.hidden = posterHidden;
    element.remove();
    state = 'disposed';
  }
  listen(buttons.play, 'click', () => void play());
  listen(buttons.pause, 'click', pause);
  listen(buttons.skip, 'click', skip);
  listen(buttons.replay, 'click', () => void replay());
  listen(volumeInput, 'input', () => setPreferences({ volume: Number(volumeInput.value) }));
  listen(window, 'blur', pause);
  listen(document, 'visibilitychange', () => {
    if (document.hidden) pause();
  });
  listen(window, 'pagehide', dispose);
  listen(signal, 'abort', dispose);
  const api = Object.freeze({
    element,
    play,
    pause,
    skip,
    replay,
    setPreferences,
    dispose,
    snapshot,
  });
  try {
    const allocatedVideo = createVideo();
    if (disposed || signal?.aborted) {
      // A trusted adapter can synchronously cancel before returning its allocation.
      if (allocatedVideo) {
        allocatedVideo.muted = true;
        allocatedVideo.pause?.();
        allocatedVideo.removeAttribute?.('src');
        allocatedVideo.load?.();
        allocatedVideo.remove?.();
      }
      dispose();
      return api;
    }
    required(
      allocatedVideo?.addEventListener && allocatedVideo?.play && allocatedVideo?.pause,
      'Native video playback is unavailable.',
    );
    media = allocatedVideo;
    media.controls = false;
    media.autoplay = false;
    media.loop = false;
    media.muted = true;
    media.playsInline = true;
    media.preload = 'auto';
    if (audioMaster)
      masterBinding = bindAudioMasterMedia({
        audioMaster,
        element: media,
        volume,
        muted: true,
      });
    else media.volume = volume * masterVolume;
    media.style.maxWidth = '100%';
    media.style.maxHeight = '100%';
    media.style.objectFit = 'contain';
    element.insertBefore(media, description);
    const video = media,
      token = ++generation;
    const current = (fn) => () => {
      if (!disposed && video === media && token === generation) fn();
    };
    listen(
      video,
      'loadedmetadata',
      current(() => {
        if (metadataSeen || state === 'error') return;
        metadataSeen = true;
        const expected = story.source;
        if (
          video.videoWidth !== expected.width ||
          video.videoHeight !== expected.height ||
          video.duration !== expected.durationSeconds
        ) {
          fail('Playback metadata differs from the verified original.');
          return;
        }
        seekStart(false);
      }),
    );
    listen(video, 'loadeddata', current(finishSeek));
    listen(video, 'seeked', current(finishSeek));
    listen(video, 'timeupdate', current(observe));
    listen(
      video,
      'pause',
      current(() => {
        if (!desired || !video.paused) return;
        if (video.ended) observe();
        else pause();
      }),
    );
    listen(
      video,
      'ended',
      current(() => {
        if (!desired) return;
        if (video.currentTime >= story.segment.endSeconds)
          finish('Story ended. Your exact picture is unchanged.');
        else
          fail('The video ended before the selected segment finished. Your picture is unchanged.');
      }),
    );
    listen(
      video,
      'error',
      current(() => fail('Video decoding failed. Your picture remains available.')),
    );
    const allocatedURL = URLImpl.createObjectURL(prepared.original);
    if (disposed || signal?.aborted) {
      URLImpl.revokeObjectURL(allocatedURL);
      dispose();
      return api;
    }
    url = allocatedURL;
    media.src = url;
    armDeadline('Video loading timed out. Your picture remains available.');
    media.load();
    render();
    if (audioMaster && !disposed) {
      const unsubscribe = audioMaster.subscribe(() => render());
      if (disposed) unsubscribe();
      else releaseMasterStatus = unsubscribe;
    }
    if (signal?.aborted) dispose();
  } catch {
    if (!disposed) fail('Native video playback is unavailable. Your picture remains available.');
  }
  return api;
}
