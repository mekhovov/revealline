import { boundedJSON, canonicalJSON } from '../../game/data-json.mjs';
import { getLocale, setLocale } from '../../game/i18n/index.mjs';
import {
  createFlight,
  createFlightRecorder,
  replayFlightCooperatively,
  FLIGHT_HZ,
} from './model.mjs';
import { FLIGHT_COURSES } from './catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from './demonstrations.mjs';
import {
  createFlightProfileStore,
  DEFAULT_RESPONSE,
  FLIGHT_CONTROLS,
  neutralFlightInput,
} from './radio-profile.mjs';
import { createRadioRuntime } from './radio-runtime.mjs';
import { mountRadioSetup } from './radio-setup.mjs';
import { createFlightInput } from './input.mjs';
import { createFlightRenderer } from './renderer.mjs';
import { COPY } from './copy.mjs';
import { mountFlightNotebook } from './notebook.mjs';
import { mountFlightStudio } from './studio.mjs';
import { preparePracticeOffline, removePracticeOffline } from './offline.mjs';

export function mountFlightApp({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  courses = FLIGHT_COURSES,
  demonstrations = FLIGHT_DEMONSTRATIONS,
  rendererFactory = createFlightRenderer,
  notebookFactory = mountFlightNotebook,
  studioFactory = mountFlightStudio,
  reviewYieldControl,
  onAttempt = () => {},
} = {}) {
  const $ = (id) => doc.getElementById(id),
    listeners = [];
  const listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  };
  const requestedLocale = new URL(win.location.href).searchParams.get('lang');
  let locale = ['en', 'uk'].includes(requestedLocale) ? requestedLocale : getLocale(),
    selected = 0,
    mode = 'self-level',
    response = DEFAULT_RESPONSE;
  try {
    response = createFlightProfileStore({ storage: win.localStorage }).snapshot().response;
  } catch {
    /* default response remains available */
  }
  let flight,
    recorder,
    lastProof = null,
    authoringCourse = null,
    replay = null,
    setup = null,
    frameId = null,
    lastTime = null,
    lastExecutionTime = null,
    accumulator = 0,
    lastHUD = -Infinity,
    terminalHandled = false,
    disposed = false,
    graphicsLost = false,
    focused = typeof doc.hasFocus === 'function' ? doc.hasFocus() : true,
    epoch = 0,
    message = null;
  const c = () => COPY[locale],
    say = (value) => {
      if ($('status').textContent !== value) $('status').textContent = value;
    };
  let notebook = null,
    studio = null,
    pendingAttempt = Promise.resolve(),
    pendingReview = Promise.resolve(),
    reviewAbort = null,
    courseButtons = [];
  const cancelReview = () => {
    reviewAbort?.abort();
    reviewAbort = null;
  };
  const currentCourse = () => authoringCourse ?? courses[selected];
  const dialogIds = [
    'course-dialog',
    'setup-dialog',
    'help-dialog',
    'notebook-dialog',
    'studio-dialog',
  ];
  const modalOpen = () => dialogIds.some((id) => $(id).open);
  const inputAvailable = () => focused && doc.visibilityState !== 'hidden';
  const input = createFlightInput({
    window: win,
    document: doc,
    onPause: (reason) => pause(reason),
  });
  const radio = createRadioRuntime({
    getGamepads:
      typeof win.navigator?.getGamepads === 'function'
        ? () => win.navigator.getGamepads()
        : undefined,
    onFreeze(reason) {
      flight?.pause();
      input.enable(false);
      accumulator = 0;
      lastTime = null;
      lastExecutionTime = null;
      message = reason;
    },
    onReset() {
      reset();
    },
  });
  const renderer = rendererFactory({
    canvas: $('flight-canvas'),
    window: win,
    reducedMotion: !!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    onContextLost() {
      graphicsLost = true;
      pause('contextLost');
      $('fallback').hidden = false;
      $('fallback').textContent = c().contextLost;
    },
  });
  function reset(index = selected, nextMode = mode, previewCourse = authoringCourse) {
    const nextFlight = createFlight({
      course: previewCourse ?? courses[index],
      mode: nextMode,
      response,
    });
    cancelReview();
    epoch++;
    radio.reset({ notify: false });
    input.enable(false);
    accumulator = 0;
    lastTime = null;
    lastExecutionTime = null;
    replay = null;
    terminalHandled = false;
    message = null;
    selected = index;
    mode = nextMode;
    authoringCourse = previewCourse ? nextFlight.course() : null;
    flight = nextFlight;
    recorder = createFlightRecorder(flight, {
      session: authoringCourse ? 'authoring' : 'practice',
    });
    $('mode').value = mode;
    $('complete').hidden = true;
    $('try').hidden = !authoringCourse;
    $('arm').disabled = !renderer.available || graphicsLost;
    $('watch').disabled = !renderer.available || graphicsLost || !!authoringCourse;
    renderer.setCourse?.(flight.course(), mode);
    renderer.setPath?.([]);
    paint(true);
  }
  function pause(reason = 'paused') {
    if (disposed) return;
    cancelReview();
    flight?.pause();
    if (replay) replay.paused = true;
    input.enable(false);
    radio.freeze(reason);
    accumulator = 0;
    lastTime = null;
    lastExecutionTime = null;
    message = reason === 'focus-lost' ? 'focusLost' : c()[reason] ? reason : 'paused';
    paint(true);
  }
  function arm() {
    if (
      disposed ||
      !renderer.available ||
      graphicsLost ||
      modalOpen() ||
      !inputAvailable() ||
      reviewAbort
    )
      return false;
    if (replay) {
      replay.paused = false;
      replay.flight.arm();
      accumulator = 0;
      lastTime = null;
      lastExecutionTime = null;
      message = null;
      paint(true);
      return true;
    }
    if (!['disarmed', 'paused'].includes(flight.snapshot().status)) return false;
    if (input.owner() === 'radio') {
      radio.poll();
      if (!radio.requestArm()) {
        message = radio.status().reason;
        paint(true);
        return false;
      }
    }
    input.enable(true);
    flight.arm();
    accumulator = 0;
    lastTime = null;
    lastExecutionTime = null;
    message = null;
    $('viewport').focus();
    paint(true);
    return true;
  }
  function closeDialog(id) {
    cancelReview();
    $(id).close();
    if (id === 'setup-dialog') {
      setup?.dispose();
      setup = null;
    }
    $('arm').focus();
  }
  function openDialog(id) {
    pause('paused');
    for (const other of dialogIds) if (other !== id && $(other).open) closeDialog(other);
    if (id === 'setup-dialog') {
      setup?.dispose();
      setup = mountRadioSetup({
        container: $('radio-setup'),
        window: win,
        runtime: radio,
        locale,
        onProfile() {
          message = 'radioReady';
        },
        onResponse(value) {
          response = value;
          reset();
        },
      });
    }
    $(id).showModal();
  }
  const copyProof = (inputProof) =>
    boundedJSON(inputProof, {
      maxBytes: 1024 * 1024,
      maxNodes: 216500,
      maxArray: 36000,
      maxDepth: 8,
    });
  function review(inputProof, kind = 'review') {
    // Copy caller-owned data before the first asynchronous boundary.
    const proof = copyProof(inputProof);
    return startReview(() => proof, kind);
  }
  function startReview(readProof, kind = 'review', closeAfter = null) {
    if (disposed || !renderer.available || graphicsLost) throw new Error(c().fallback);
    pause();
    const owner = ++epoch,
      controller = new AbortController();
    reviewAbort = controller;
    message = 'verifying';
    paint(true);
    const operation = (async () => {
      try {
        const raw = await readProof();
        controller.signal.throwIfAborted();
        // Objects arrive only through review(), which already owns its clone.
        const proof = typeof raw === 'string' ? copyProof(raw) : raw;
        const index = courses.findIndex((course) => course.id === proof.course);
        if (index < 0) throw new TypeError(c().invalid);
        const checked = await replayFlightCooperatively(courses[index], proof, {
          sampleEvery: 5,
          signal: controller.signal,
          yieldControl: reviewYieldControl,
        });
        controller.signal.throwIfAborted();
        if (disposed || owner !== epoch) return null;
        reviewAbort = null;
        if (closeAfter) closeDialog(closeAfter);
        showReview(proof, kind, index, checked);
        return checked;
      } catch (error) {
        if (controller.signal.aborted || disposed || owner !== epoch) return null;
        if (reviewAbort === controller) reviewAbort = null;
        message = error.message;
        paint(true);
        throw error;
      } finally {
        if (reviewAbort === controller) reviewAbort = null;
      }
    })();
    // The UI owns errors; API callers can still await the original rejection.
    pendingReview = operation.catch(() => {});
    return operation;
  }
  function showReview(proof, kind, index, checked) {
    selected = index;
    mode = proof.mode;
    authoringCourse = null;
    const playback = createFlight({ course: courses[index], mode, response: proof.response });
    playback.arm();
    replay = { proof, kind, flight: playback, at: 0, paused: false };
    $('mode').value = mode;
    $('complete').hidden = true;
    $('try').hidden = false;
    message = null;
    accumulator = 0;
    lastTime = null;
    lastExecutionTime = null;
    renderer.setCourse?.(courses[index], mode);
    renderer.setPath?.(checked.path);
    paint(true);
  }
  function translated() {
    doc.documentElement.lang = locale;
    $('language').value = locale;
    for (const node of doc.querySelectorAll('[data-copy]'))
      if (c()[node.dataset.copy]) node.textContent = c()[node.dataset.copy];
    for (const button of courseButtons) button.onclick = null;
    courseButtons = courses.map((course, index) => {
      const button = doc.createElement('button'),
        title = doc.createElement('strong'),
        brief = doc.createElement('span');
      title.textContent = `${String(index + 1).padStart(2, '0')} · ${course.locales[locale].title}`;
      brief.textContent = course.locales[locale].brief;
      button.type = 'button';
      button.setAttribute('data-course', course.id);
      button.append(title, brief);
      button.onclick = () => {
        reset(index, mode, null);
        closeDialog('course-dialog');
      };
      return button;
    });
    $('course-list').replaceChildren(...courseButtons);
    $('fallback').textContent = c()[graphicsLost ? 'contextLost' : 'fallback'];
    $('viewport').setAttribute('aria-label', c().title);
    $('sticks').setAttribute('aria-label', c().inputLabel);
    $('left-stick').setAttribute('aria-label', c().leftStick);
    $('right-stick').setAttribute('aria-label', c().rightStick);
    $('complete-title').textContent = currentCourse().locales[locale].title;
    $('lesson').textContent = currentCourse().locales[locale].lesson;
    paint(true);
  }
  function targetText(state) {
    const target = state.target;
    if (!target) return c().complete;
    const ordinal = `${c().progress} ${Math.min(state.step + 1, state.total)} / ${state.total}`;
    if (target.type === 'gate') return `${ordinal} · ${c().gate}`;
    return `${ordinal} · ${c()[target.type]} · ${c().steady} ${(state.hold / FLIGHT_HZ).toFixed(1)} / ${(target.ticks / FLIGHT_HZ).toFixed(1)} s · ≤${(target.maxSpeed / 1000).toFixed(1)} m/s · ${target.minTilt ? `${target.minTilt / 100}–` : '≤'}${target.maxTilt / 100}°${target.heading !== null ? ` · ${c().heading} ${target.heading / 100}°` : ''}${target.centred ? ` · ${c().centre}` : ''}`;
  }
  function paint(force = false, now = 0) {
    if (!flight || disposed) return;
    const state = replay ? replay.flight.snapshot() : flight.snapshot();
    renderer.draw?.(state, {
      cameraMode: $('camera').value || 'fpv',
      cameraFov: Number($('camera-fov').value) || 82,
      cameraTilt: Number($('camera-tilt').value) || 0,
    });
    if (!force && now - lastHUD < 100) return;
    lastHUD = now;
    const course = currentCourse().locales[locale];
    $('course-number').textContent =
      `${authoringCourse ? c().authoring : `${String(selected + 1).padStart(2, '0')} / ${courses.length}`} · ${c()[mode]}`;
    $('course-title').textContent = course.title;
    $('brief').textContent = course.brief;
    $('height').textContent = `${c().altitude} ${(state.position.y / 1000).toFixed(1)} m`;
    $('speed').textContent =
      `${c().speed} ${(Math.hypot(state.velocity.x, state.velocity.y, state.velocity.z) / 1000).toFixed(1)} m/s`;
    $('power').textContent = `${c().throttle} ${Math.round(state.lastInput.throttle / 10)}%`;
    $('contact-count').textContent = `${c().contacts} ${state.contacts}`;
    $('target').textContent = targetText(state);
    $('step-progress').max = state.total;
    $('step-progress').value = state.step;
    $('step-progress').setAttribute('aria-label', `${c().progress} ${state.step} / ${state.total}`);
    const values = state.lastInput;
    $('left-dot').style.transform =
      `translate(${(values.yaw / 1000) * 22}px, ${(1 - values.throttle / 500) * 22}px)`;
    $('right-dot').style.transform =
      `translate(${(values.roll / 1000) * 22}px, ${(-values.pitch / 1000) * 22}px)`;
    if (input.owner() === 'touch') {
      $('touch-throttle').value = String(Math.round(values.throttle / 10));
      $('left-stick').querySelector('i').style.transform =
        `translate(${(values.yaw / 1000) * 35}px, ${(1 - values.throttle / 500) * 35}px)`;
      $('right-stick').querySelector('i').style.transform =
        `translate(${(values.roll / 1000) * 35}px, ${(-values.pitch / 1000) * 35}px)`;
    }
    say(
      reviewAbort
        ? c().verifying
        : message
          ? (c()[message] ?? message)
          : replay
            ? replay.at >= replay.proof.frames.length
              ? c().endReplay
              : c()[replay.kind === 'demonstration' ? 'demo' : 'reviewing']
            : authoringCourse
              ? c().authoring
              : (c()[state.status] ?? state.status),
    );
  }
  function completed() {
    if (terminalHandled || replay) return;
    const state = flight.snapshot();
    if (!['complete', 'expired'].includes(state.status)) return;
    terminalHandled = true;
    input.enable(false);
    radio.freeze('paused');
    message = null;
    lastProof = recorder.export();
    if (state.status !== 'complete') return;
    $('complete-title').textContent = currentCourse().locales[locale].title;
    $('lesson').textContent = currentCourse().locales[locale].lesson;
    $('complete').hidden = false;
    $('next').hidden = !!authoringCourse || selected === courses.length - 1;
    $('review').hidden = !!authoringCourse;
    $('retry').focus();
    if (lastProof.session !== 'practice') return;
    const owner = epoch,
      delivery = { course: courses[selected], attempt: lastProof },
      previous = pendingAttempt;
    // Notebook admission already replays cooperatively. Retain this exact win
    // independently of the next visible run; Next/Retry need not wait for it.
    const admission = notebook?.accept
      ? Promise.resolve(notebook.accept(delivery.attempt)).then((verification) => ({
          ...delivery,
          verification,
        }))
      : replayFlightCooperatively(delivery.course, delivery.attempt).then((result) => {
          if (result.state.status !== 'complete') throw new Error('Completion did not replay.');
          return { ...delivery, result };
        });
    const operation = admission
      .then((accepted) => onAttempt(accepted))
      .catch((error) => {
        if (!disposed && owner === epoch) {
          message = error.message;
          paint(true);
        }
      });
    pendingAttempt = Promise.all([previous, operation]).then(() => {});
  }
  function frame(now) {
    if (disposed) return;
    const delta = lastTime === null ? 0 : now - lastTime,
      executedAt = win.performance?.now?.() ?? now,
      executionDelta = lastExecutionTime === null ? 0 : executedAt - lastExecutionTime;
    lastTime = now;
    lastExecutionTime = executedAt;
    // A queued rAF can carry a pre-stall timestamp. Check the actual callback
    // gap too, before accepting another input or advancing the fixed-step model.
    if (delta > 250 || executionDelta > 250) pause('focusLost');
    if (!reviewAbort && inputAvailable() && !modalOpen() && renderer.available && !graphicsLost) {
      let radioInput = neutralFlightInput();
      if (!replay && input.owner() === 'radio') {
        radioInput = radio.poll();
        if (!radio.status().active && ['paused', 'disarmed'].includes(flight.snapshot().status))
          message = radio.status().reason === 'ready' ? 'radioReady' : radio.status().reason;
        if (radio.status().active && ['paused', 'disarmed'].includes(flight.snapshot().status)) {
          flight.arm();
          input.enable(true);
          message = null;
        }
      }
      const active = replay
        ? !replay.paused && replay.at < replay.proof.frames.length
        : flight.snapshot().status === 'active';
      if (active && delta <= 250) accumulator += Math.max(0, delta);
      while (active && accumulator >= 1000 / FLIGHT_HZ) {
        accumulator -= 1000 / FLIGHT_HZ;
        if (replay) {
          if (replay.at >= replay.proof.frames.length) {
            accumulator = 0;
            break;
          }
          replay.flight.step(
            Object.fromEntries(
              FLIGHT_CONTROLS.map((key, i) => [key, replay.proof.frames[replay.at][i]]),
            ),
            { quantized: true },
          );
          replay.at++;
        } else {
          if (flight.snapshot().status !== 'active') {
            accumulator = 0;
            break;
          }
          const command = input.owner() === 'radio' ? radioInput : input.sample(1 / FLIGHT_HZ);
          const before = flight.snapshot().ticks;
          flight.step(command);
          if (flight.snapshot().ticks !== before) recorder.record(command);
          completed();
        }
      }
    }
    paint(false, now);
    frameId = win.requestAnimationFrame(frame);
  }
  input.bindStick($('left-stick'), 'left');
  input.bindStick($('right-stick'), 'right');
  listen($('touch-throttle'), 'input', () =>
    input.throttle(Number($('touch-throttle').value) / 100),
  );
  listen($('arm'), 'click', arm);
  listen(win, 'blur', () => {
    focused = false;
    pause('focusLost');
  });
  listen(win, 'focus', () => {
    focused = true;
  });
  listen(doc, 'visibilitychange', () => {
    if (doc.visibilityState === 'hidden') pause('focusLost');
  });
  for (const id of ['camera', 'camera-help'])
    listen($(id), 'change', () => {
      const value = $(id).value;
      if (!['fpv', 'chase', 'overview'].includes(value)) return;
      $('camera').value = value;
      $('camera-help').value = value;
      paint(true);
    });
  listen($('pause'), 'click', () => pause());
  listen($('reset'), 'click', () => reset());
  listen($('retry'), 'click', () => reset(selected, mode, null));
  listen($('try'), 'click', () => reset(selected, mode, null));
  listen($('next'), 'click', () => reset(Math.min(courses.length - 1, selected + 1), mode, null));
  listen($('mode'), 'change', () => reset(selected, $('mode').value));
  listen($('input-source'), 'change', () => {
    input.select($('input-source').value);
    if (input.owner() === 'radio' && !radio.status().profile) {
      try {
        const saved = createFlightProfileStore({ storage: win.localStorage }).snapshot().radio;
        const matches = saved?.verified
          ? radio
              .devices()
              .devices.filter(
                ({ index, ...identity }) => canonicalJSON(identity) === canonicalJSON(saved.device),
              )
          : [];
        if (matches.length === 1 && radio.select(matches[0].index)) {
          radio.setProfile(saved);
          radio.verify();
        }
      } catch {
        // Unavailable storage or unmatched hardware requires explicit setup.
      }
    }
    reset();
    $('touch-controls').hidden = input.owner() !== 'touch';
    doc.body.classList.toggle('touch-mode', input.owner() === 'touch');
  });
  listen($('language'), 'change', () => {
    pause();
    locale = $('language').value === 'uk' ? 'uk' : 'en';
    setLocale(locale);
    notebook?.setLocale?.(locale);
    studio?.setLocale?.(locale);
    translated();
  });
  for (const [button, dialog] of [
    ['courses', 'course-dialog'],
    ['setup', 'setup-dialog'],
    ['help', 'help-dialog'],
    ['notebook-button', 'notebook-dialog'],
    ['studio-button', 'studio-dialog'],
  ])
    listen($(button), 'click', () => openDialog(dialog));
  for (const button of doc.querySelectorAll('[data-close]'))
    listen(button, 'click', () => closeDialog(button.dataset.close));
  for (const id of dialogIds)
    listen($(id), 'cancel', () => {
      setup?.dispose();
      setup = null;
      pause();
    });
  listen(win, 'gamepaddisconnected', (event) => radio.disconnect(event.gamepad.index));
  listen($('fullscreen'), 'click', async () => {
    try {
      if (doc.fullscreenElement) await doc.exitFullscreen();
      else await $('flight-app').requestFullscreen();
    } catch {
      /* browser keeps the normal full-width surface */
    }
  });
  listen($('watch'), 'click', () => {
    const proof = demonstrations.find(
      (item) => item.course === courses[selected].id && item.mode === mode,
    );
    if (proof) void review(proof, 'demonstration').catch(() => {});
  });
  listen($('review'), 'click', () => {
    if (lastProof) void review(lastProof).catch(() => {});
  });
  listen($('export-attempt'), 'click', () => {
    pause();
    const proof = replay?.proof ?? recorder.export();
    const url = win.URL.createObjectURL(
        new Blob([JSON.stringify(proof)], { type: 'application/json' }),
      ),
      link = doc.createElement('a');
    link.href = url;
    link.download = `${proof.course}-${proof.mode}-attempt.json`;
    link.click();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 0);
  });
  listen($('import-attempt'), 'change', async () => {
    const file = $('import-attempt').files?.[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024) throw new Error('Flight proof exceeds 1 MiB.');
      const checked = await startReview(() => file.text(), 'review', 'help-dialog');
      if (checked && !disposed) $('transfer-status').textContent = c().imported;
    } catch (error) {
      if (!disposed) $('transfer-status').textContent = error.message;
    }
    $('import-attempt').value = '';
  });
  notebook = notebookFactory?.({
    container: $('flight-notebook'),
    window: win,
    courses,
    locale,
    onReview(proof) {
      closeDialog('notebook-dialog');
      void review(proof).catch(() => {});
    },
    onPractice(id) {
      const index = courses.findIndex((course) => course.id === id);
      if (index >= 0) {
        closeDialog('notebook-dialog');
        reset(index, mode, null);
      }
    },
    onCosmetic(recipe) {
      if (/^#[a-fA-F0-9]{6}$/.test(recipe.color)) {
        doc.documentElement.style.setProperty('--accent', recipe.color);
        renderer.setCosmetic?.(recipe);
      }
    },
  });
  studio = studioFactory?.({
    container: $('flight-studio'),
    courses,
    locale,
    onPreview(course) {
      closeDialog('studio-dialog');
      reset(selected, mode, course);
    },
  });
  for (const [id, operation] of [
    ['install-offline', preparePracticeOffline],
    ['remove-offline', removePracticeOffline],
  ])
    listen($(id), 'click', async () => {
      pause();
      try {
        let storage;
        try {
          storage = win.localStorage;
        } catch {
          /* installation status may be session-only */
        }
        await operation({
          navigator: win.navigator,
          location: win.location,
          caches: win.caches,
          storage,
        });
        if (!disposed)
          $('transfer-status').textContent =
            c()[id === 'install-offline' ? 'offlineReady' : 'offlineRemoved'];
      } catch (error) {
        if (!disposed) $('transfer-status').textContent = error.message;
      }
    });
  reset();
  translated();
  $('fallback').hidden = !!renderer.available;
  frameId = win.requestAnimationFrame(frame);
  const api = {
    arm,
    pause,
    reset,
    review,
    radio,
    resources: () => renderer.resources?.() ?? { available: renderer.available },
    settled: async () => {
      await notebook?.ready;
      await pendingAttempt;
      await pendingReview;
    },
    snapshot: () => flight.snapshot(),
    exportAttempt: () => recorder.export(),
    dispose() {
      if (disposed) return;
      pause();
      disposed = true;
      epoch++;
      if (frameId !== null) win.cancelAnimationFrame(frameId);
      setup?.dispose();
      void notebook?.dispose();
      studio?.dispose();
      input.dispose();
      renderer.dispose();
      for (const remove of listeners) remove();
      for (const button of courseButtons) {
        button.onclick = null;
        button.remove();
      }
      courseButtons = [];
    },
  };
  listen(win, 'pagehide', () => api.dispose());
  return api;
}

if (globalThis.document?.documentElement?.dataset?.civilianFpv === 'true') mountFlightApp();
