import { fpvReturnURL } from '../../game/fpv-entry.mjs';
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
  STICK_LAYOUTS,
  neutralFlightInput,
} from './radio-profile.mjs';
import { createRadioRuntime } from './radio-runtime.mjs';
import { restoreVerifiedRadio } from './radio-session.mjs';
import { mountRadioSetup } from './radio-setup.mjs';
import {
  mountFlightFullscreen,
  createSimContinuousPlayController,
  createSimEnemyStatsHost,
  mountSimEnemyStats,
  mountSimContinuousPlayControls,
  mountSimContinuousCelebration,
  mountSimPlayShell,
  mountSimModeSettings,
  mountSimGlobalSettings,
  attachSimMenuAudioSettings,
  readSimRadioAudio,
  SIM_RADIO_AUDIO_KEY,
  createSimDisplayPreferences,
  attachSimThemeFamilyControls,
  getSimMenuAnimation,
  setSimMenuAnimation,
  subscribeSimMenuAnimation,
  simAttachSettingsPanels,
  simSettingsPanelBack,
  simSettingsTabOwnsKey,
  createSimModeLinks,
} from './flight-fullscreen.mjs';
import {
  mountSimPresentation,
  mountSimGlobalTools,
  createSimFlightAudio,
  mountSimAppearanceControls,
  mountDroneResponse,
  mountSimAudioControls,
  paintStickDirections,
  mountStickTrace,
} from './sim-presentation.mjs';
import {
  createFlightInput,
  createFlightMenuNavigation,
  createFlightGamepad,
  keyboardFlightPreset,
  keyboardFlightHelp,
  KEYBOARD_PRESET_KEY,
} from './input.mjs';
import { createFlightRenderer } from './renderer.mjs';
import { COPY } from './copy.mjs';
import { mountFlightNotebook } from './notebook.mjs';
import { mountFlightStudio } from './studio.mjs';
import { preparePracticeOffline, removePracticeOffline } from './offline.mjs';
import {
  academyRecording,
  createSimAppearanceSession,
  playableSimAppearance,
  readAcademyRecording,
} from './world-themes.mjs';

export function mountFlightApp({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  courses = FLIGHT_COURSES,
  demonstrations = FLIGHT_DEMONSTRATIONS,
  rendererFactory = createFlightRenderer,
  globalToolsFactory = mountSimGlobalTools,
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
  const pageURL = new URL(win.location.href);
  // The source server hosts both simulators. A standalone Academy package does
  // not contain World Studio; its explicit game-return link remains the exit.
  const sourceWorlds =
    ['localhost', '127.0.0.1', '[::1]'].includes(pageURL.hostname) &&
    pageURL.pathname === '/optional-practice/civilian-fpv/index.html';
  if ($('worlds-button') && sourceWorlds) {
    const target = new URL('../fpv-worlds/index.html', pageURL);
    $('worlds-button').href = target.href;
    $('worlds-button').hidden = false;
    listen($('worlds-button'), 'click', (event) => {
      event.preventDefault();
      pause();
      target.searchParams.set('lang', $('language').value);
      win.location.href = target.href;
    });
  }
  const gameReturn = fpvReturnURL(win.location.href);
  if (gameReturn && $('game-return')) {
    $('game-return').href = gameReturn;
    $('game-return').hidden = false;
  }
  const offlineAvailable =
    /^https?:$/.test(new URL(win.location.href).protocol) &&
    win.isSecureContext !== false &&
    !!win.navigator?.serviceWorker;
  let offlineBusy = false;
  const refreshOfflineControls = () => {
    for (const id of ['install-offline', 'remove-offline'])
      $(id).disabled = !offlineAvailable || offlineBusy;
    $('offline-unavailable').hidden = offlineAvailable;
  };
  refreshOfflineControls();
  const requestedLocale = new URL(win.location.href).searchParams.get('lang');
  let locale = ['en', 'uk'].includes(requestedLocale) ? requestedLocale : getLocale(),
    selected = 0,
    mode = 'self-level',
    response = DEFAULT_RESPONSE;
  setLocale(locale, { persist: false });
  try {
    response = createFlightProfileStore({ storage: win.localStorage }).snapshot().response;
  } catch {
    /* default response remains available */
  }
  let flight,
    recorder,
    lastProof = null,
    lastPresentation = null,
    authoringCourse = null,
    replay = null,
    replayRate = 1,
    setup = null,
    frameId = null,
    lastTime = null,
    lastExecutionTime = null,
    accumulator = 0,
    lastHUD = -Infinity,
    terminalHandled = false,
    disposed = false,
    suspended = false,
    graphicsLost = false,
    sceneReady = false,
    sceneGeneration = 0,
    scenePreparation = null,
    pendingScene = Promise.resolve(false),
    pauseGeneration = 0,
    focused = typeof doc.hasFocus === 'function' ? doc.hasFocus() : true,
    epoch = 0,
    lastRadioDiscovery = -Infinity,
    message = null,
    playShell = null,
    modeSettingsView = null,
    globalSettingsView = null,
    globalTools = null;
  const c = () => COPY[locale],
    messageText = (key) =>
      key === 'preparingGraphics'
        ? locale === 'uk'
          ? 'Підготовка графіки…'
          : 'Preparing graphics…'
        : key === 'arm-switch-off'
          ? locale === 'uk'
            ? 'Перемкніть озброєння в УВІМК, щоб почати.'
            : 'Move the arm switch ON to start.'
          : (c()[key] ?? key),
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
  const modalOpen = () =>
    dialogIds.some((id) => $(id).open) ||
    Boolean($('academy-flight-options')?.open) ||
    Boolean(playShell?.blocksPlay());
  const shellCopy = {
    academyBrand: ['SIM · ACADEMY', 'SIM · АКАДЕМІЯ'],
    worlds: ['World Studio', 'Студія світів'],
    drills: ['Drills', 'Вправи'],
    notebook: ['Notebook', 'Записник'],
    help: ['Flight guide', 'Довідник польоту'],
    controls: ['Controls', 'Керування'],
    flightMenu: ['Menu', 'Меню'],
    returnToFlight: ['Back to flight', 'До польоту'],
    controller: ['Controller / Steam Deck', 'Контролер / Steam Deck'],
    radioSetup: ['Radio setup', 'Налаштувати пульт'],
    flightOptions: ['Flight options', 'Параметри польоту'],
    viewAndSound: ['View & sound', 'Вигляд і звук'],
    audioMixHelp: [
      'Volume is shared with World Studio. Muting keeps your chosen level.',
      'Гучність спільна зі Студією світів. Вимкнення звуку зберігає вибраний рівень.',
    ],
    optionsPause: [
      'Your flight pauses while you adjust the view.',
      'Поки ви змінюєте вигляд, політ на паузі.',
    ],
    stickDisplay: ['Live sticks', 'Стіки керування'],
    compact: ['Compact', 'Компактні'],
    droneResponse: ['Drone response', 'Реакція дрона'],
    learning: ['Learning', 'Навчальна'],
    off: ['Off', 'Вимкнено'],
    guideScale: ['Guide text', 'Текст схеми'],
    standard: ['Standard', 'Стандартний'],
    large: ['Large', 'Збільшений'],
    expanded: ['Expanded', 'Збільшені'],
    done: ['Done', 'Готово'],
    keyboardGuide: ['Keyboard controls', 'Клавіатура'],
    keyboardPreset: ['Keyboard layout', 'Розкладка клавіатури'],
    keyboardTwoStick: ['Two-stick · WASD + arrows', 'Два стіки · WASD + стрілки'],
    keyboardClassic: ['Classic · W/S pitch', 'Класична · W/S — тангаж'],
    touchGuide: ['Touch controls', 'Сенсорне керування'],
    touchResponse: ['Touch response', 'Чутливість дотику'],
    touchPrecise: ['Precise — small corrections', 'Точна — малі корекції'],
    touchDirect: ['Direct — linear response', 'Пряма — лінійна реакція'],
    flyingBasics: ['Flying basics', 'Основи польоту'],
    yourFlights: ['Your flights', 'Ваші польоти'],
    workshopAndOffline: ['Workshop & offline', 'Майстерня й автономний запуск'],
    aboutModel: ['About this training model', 'Про навчальну модель'],
  };
  const updateSoundLabel = (enabled) => {
    const button = $('academy-sound');
    if (!button) return;
    button.textContent =
      locale === 'uk'
        ? enabled
          ? 'Звук увімкнено'
          : 'Звук вимкнено'
        : enabled
          ? 'Sound on'
          : 'Sound off';
    button.setAttribute('aria-pressed', String(enabled));
    playShell?.update({ muted: !enabled });
  };
  const audio = createSimFlightAudio({ window: win });
  const presentation = mountSimPresentation({
    root: doc,
    window: win,
    enabled: audio.enabled(),
    audioHost: audio,
    onSoundChange: updateSoundLabel,
  });
  listeners.push(
    audio.subscribe((enabled) => {
      updateSoundLabel(enabled);
      presentation.setSoundPreference(enabled);
    }),
  );
  const audioControls = mountSimAudioControls({
    root: $('academy-audio-mix'),
    window: win,
    locale: () => locale,
    onChange: (levels) => {
      audio.setVolumes(levels);
    },
  });
  updateSoundLabel(presentation.soundEnabled());
  const droneResponse = mountDroneResponse({
    root: $('academy-drone-response'),
    window: win,
    onHide: () => {
      $('academy-drone-guide').value = 'off';
      saveGuidePreferences();
      paint(true);
    },
  });
  const stickTraces = ['left-dot', 'right-dot'].map((id) =>
    mountStickTrace($(id).parentElement, { travel: 180 * 0.3 }),
  );
  const touchTraces = ['left-stick', 'right-stick'].map((id) =>
    mountStickTrace($(id), { travel: 180 * 0.34 }),
  );
  const resetStickTraces = () => [...stickTraces, ...touchTraces].forEach((trace) => trace.reset());
  let stickTraceLayout = '';
  const saveGuidePreferences = () => {
    try {
      win.localStorage?.setItem(
        'revealline.fpv.academy-guide.v1',
        JSON.stringify({
          display: $('academy-drone-guide').value,
          scale: $('academy-guide-scale').value,
        }),
      );
    } catch {
      /* The guide is usable without storage. */
    }
  };
  try {
    $('keyboard-preset').value = keyboardFlightPreset(
      win.localStorage?.getItem(KEYBOARD_PRESET_KEY),
    ).id;
    const touchResponse = win.localStorage?.getItem('revealline.fpv.touch-response.v1');
    if (['precise', 'direct'].includes(touchResponse)) $('touch-response').value = touchResponse;
    const saved = win.localStorage?.getItem('revealline.fpv.academy-sticks.v1');
    if (['compact', 'expanded'].includes(saved) && $('academy-stick-display'))
      $('academy-stick-display').value = saved;
    const guide = JSON.parse(win.localStorage?.getItem('revealline.fpv.academy-guide.v1') ?? '{}');
    if (['compact', 'learning', 'off'].includes(guide.display))
      $('academy-drone-guide').value = guide.display;
    if (['standard', 'large'].includes(guide.scale)) $('academy-guide-scale').value = guide.scale;
  } catch {
    /* Display preferences remain available for this session. */
  }
  const inputAvailable = () => focused && doc.visibilityState !== 'hidden';
  const input = createFlightInput({
    window: win,
    document: doc,
    onPause: (reason) => (reason === 'paused' ? setFlightMenu(true) : pause(reason)),
  });
  input.touchResponse($('touch-response').value);
  input.keyboardPreset($('keyboard-preset').value);
  const controllerHint = doc.createElement('p');
  controllerHint.id = 'academy-controller-hint';
  controllerHint.hidden = true;
  $('academy-flight-options').append(controllerHint);
  const gamepad = createFlightGamepad({ window: win, document: doc });
  const flightMenuOpen = () => $('flight-app').dataset.flightMenuOpen === 'true';
  function setFlightMenu(open) {
    if (open && playShell) {
      pause();
      playShell.open('pause');
      return;
    }
    if (open) pause();
    $('flight-app').dataset.flightMenuOpen = String(open);
    if (!open) $('academy-flight-options').open = false;
    paint(true);
    (open ? $('academy-flight-close-menu') : $('academy-flight-resume'))?.focus({
      preventScroll: true,
    });
  }
  const gamepadHelp = () =>
    locale === 'uk'
      ? 'A — увімкнути / продовжити · Y — скинути · Menu / B — пауза. Лівий стік: поворот і зміна газу; правий: нахил. Відпустіть лівий стік, щоб утримувати газ. D-pad — нахил, LB/RB — поворот, LT/RT — менше/більше газу.'
      : 'A / Cross: arm · Y / Triangle: reset · Menu / B: pause. Left stick: yaw and throttle adjustment; right: tilt. Release the left stick to hold throttle. D-pad: tilt, LB/RB: yaw, LT/RT: less/more throttle. Steam Input: use a Gamepad layout.';
  function gamepadScope() {
    if (
      replay ||
      !flight ||
      !sceneReady ||
      !inputAvailable() ||
      modalOpen() ||
      flightMenuOpen() ||
      immersive.snapshot().toolsOpen
    )
      return 'blocked';
    if (flight.snapshot().status === 'active')
      return input.owner() === 'controller' ? 'flight' : 'blocked';
    return ['disarmed', 'paused'].includes(flight.snapshot().status) &&
      (input.owner() !== 'radio' || !radio.status().verified)
      ? 'ready'
      : 'blocked';
  }
  function readGamepad(now, scope = gamepadScope()) {
    let pads = [];
    try {
      pads = win.navigator.getGamepads?.() ?? [];
    } catch {
      /* Touch and keyboard remain usable. */
    }
    return gamepad.poll({
      gamepads: pads,
      now,
      scope,
      excludeIndex: radio.status().verified ? radio.status().selected?.index : null,
    });
  }
  function pollGamepad(now) {
    const sampled = readGamepad(now);
    for (const action of sampled.actions) {
      if (action === 'arm') {
        if (input.owner() !== 'controller') {
          input.select('controller');
          $('input-source').value = 'controller';
          $('touch-controls').hidden = true;
          doc.body.classList.remove('touch-mode');
        }
        arm();
      } else if (action === 'reset') {
        setFlightMenu(false);
        reset();
      } else if (action === 'pause' || action === 'back') setFlightMenu(true);
    }
  }
  const radio = createRadioRuntime({
    getGamepads:
      typeof win.navigator?.getGamepads === 'function'
        ? () => win.navigator.getGamepads()
        : undefined,
    onFreeze(reason) {
      flight?.pause();
      audio.pause();
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
  const restoreRadio = () => {
    if (input.owner() !== 'radio') return;
    let store;
    try {
      store = createFlightProfileStore({ storage: win.localStorage });
    } catch {
      // The tested built-in mapping remains usable when storage is unavailable.
    }
    return restoreVerifiedRadio(radio, store);
  };
  const renderer = rendererFactory({
    canvas: $('flight-canvas'),
    window: win,
    reducedMotion: !!win.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    onContextLost() {
      graphicsLost = true;
      sceneReady = false;
      scenePreparation?.abort();
      pause('contextLost');
      $('fallback').hidden = false;
      $('fallback').textContent = c().contextLost;
    },
  });
  const displayPreferences = createSimDisplayPreferences({
    window: win,
    getStorage: () => win.localStorage,
  });
  listeners.push(
    displayPreferences.subscribe((state) => {
      doc.body.dataset.textFace = state.textFace;
      doc.body.dataset.textSize = state.textSize;
      doc.body.dataset.effects = state.effectiveReducedEffects ? 'reduced' : 'full';
    }),
  );
  listeners.push(
    subscribeSimMenuAnimation((enabled) => {
      doc.documentElement.dataset.menuAnimation = enabled ? 'on' : 'off';
    }, win),
  );
  const appearanceSession = createSimAppearanceSession();
  const appearanceControls = mountSimAppearanceControls({
    displayPreferences,
    document: doc,
    window: win,
    container: $('camera').closest('div'),
    locale: () => locale,
    pending: () => appearanceSession.pending(),
    accepted: () => appearanceSession.current(),
    onChange(appearance) {
      if (!appearanceSession.select(appearance) || !flight || replay) return;
      renderer.setPresentation?.(appearance);
      renderer.setCourse?.(flight.course(), mode);
      void prepareScene();
    },
  });
  function prepareScene() {
    scenePreparation?.abort();
    const controller = new AbortController(),
      generation = ++sceneGeneration;
    scenePreparation = controller;
    sceneReady = false;
    $('arm').disabled = true;
    $('watch').disabled = true;
    message = 'preparingGraphics';
    pendingScene = (async () => {
      try {
        const result = await renderer.prepare?.({ signal: controller.signal });
        if (
          result === false ||
          controller.signal.aborted ||
          disposed ||
          generation !== sceneGeneration ||
          graphicsLost
        )
          return false;
        sceneReady = !!renderer.available;
        $('arm').disabled = !sceneReady;
        $('watch').disabled = !sceneReady || !!authoringCourse;
        if (message === 'preparingGraphics') message = null;
        paint(true);
        return sceneReady;
      } catch (error) {
        if (!disposed && generation === sceneGeneration && !controller.signal.aborted) {
          message = `${locale === 'uk' ? 'Не вдалося підготувати графіку. Повторіть спробу.' : 'Graphics preparation failed. Retry the flight.'} ${error.message}`;
          paint(true);
        }
        return false;
      }
    })();
    return pendingScene;
  }
  const enemyStatistics = createSimEnemyStatsHost({ gameType: 'academy' });
  void enemyStatistics.stats.read();
  const enemyStatsViews = [
    mountSimEnemyStats({
      document: doc,
      container: $('flight-app'),
      stats: enemyStatistics.stats,
      variant: 'hud',
      locale: () => locale,
      spritePortraits: false,
    }),
  ];
  let launchIntent = null;
  const continuousPlay = createSimContinuousPlayController({
    isCurrent: (identity) => identity === flight && !disposed && !replay,
    isActive: () => !doc.hidden && (doc.hasFocus?.() ?? true) && !suspended && !modalOpen(),
    onNext: () => $('next').click(),
    onRetry: () => $('retry').click(),
  });
  const resultMissionActions = doc.createElement('div');
  resultMissionActions.className = 'button-row continuous-result-actions';
  resultMissionActions.append($('next'), $('retry'), $('review'));
  const resultChoices = [
    ['random', ['Random level', 'Випадковий рівень']],
    ['missions', ['Choose mission', 'Вибрати місію']],
    ['home', ['Home', 'Додому']],
  ];
  for (const [action, labels] of resultChoices) {
    const node = doc.createElement('button');
    node.id = `academy-result-${action}`;
    node.type = 'button';
    node.className = 'button secondary';
    node.textContent = labels[locale === 'uk' ? 1 : 0];
    node.onclick = () => {
      continuousPlay.cancel('result-action');
      if (action === 'random') playShell.activate('random');
      else playShell.open(action);
    };
    resultMissionActions.append(node);
  }
  $('complete').append(resultMissionActions);
  const flowControls = mountSimContinuousPlayControls({
    document: doc,
    parent: resultMissionActions,
    primaryAction: $('next'),
    controller: continuousPlay,
    locale: () => locale,
  });
  const flowCelebration = mountSimContinuousCelebration({
    document: doc,
    controller: continuousPlay,
    reduced: () => displayPreferences.snapshot().effectiveReducedEffects,
  });
  const cancelFlow = () => {
    continuousPlay.cancel('interaction');
    launchIntent = null;
  };
  listen(doc, 'pointerdown', cancelFlow);
  listen(doc, 'keydown', cancelFlow);
  listen(win, 'blur', cancelFlow);
  listen(win, 'gamepaddisconnected', cancelFlow);
  async function startPrepared() {
    playShell?.enterPlay();
    const intent = { epoch, pauseGeneration };
    launchIntent = intent;
    if (sceneReady && arm()) {
      launchIntent = null;
      return true;
    }
    await pendingScene;
    if (
      launchIntent !== intent ||
      epoch !== intent.epoch ||
      pauseGeneration !== intent.pauseGeneration ||
      disposed
    )
      return false;
    if (arm()) {
      launchIntent = null;
      return true;
    }
    return false;
  }
  function reset(index = selected, nextMode = mode, previewCourse = authoringCourse) {
    continuousPlay.cancel('new-attempt');
    launchIntent = null;
    const nextFlight = createFlight({
      course: previewCourse ?? courses[index],
      mode: nextMode,
      response,
    });
    cancelReview();
    epoch++;
    gamepad.reset();
    radio.reset({ notify: false });
    input.enable(false);
    accumulator = 0;
    lastTime = null;
    lastExecutionTime = null;
    replay = null;
    if (doc.activeElement === $('replay-rate')) $('viewport').focus();
    $('replay-controls').hidden = true;
    terminalHandled = false;
    message = null;
    selected = index;
    mode = nextMode;
    authoringCourse = previewCourse ? nextFlight.course() : null;
    audio.pause();
    flight = nextFlight;
    audio.setCourse(flight.course());
    recorder = createFlightRecorder(flight, {
      session: authoringCourse ? 'authoring' : 'practice',
    });
    $('mode').value = mode;
    $('complete').hidden = true;
    $('try').hidden = !authoringCourse;
    const acceptedAppearance = appearanceSession.begin(appearanceControls.resolve().appearance);
    renderer.setPresentation?.(acceptedAppearance);
    renderer.setCourse?.(flight.course(), mode);
    appearanceControls.refresh();
    renderer.setPath?.([]);
    void prepareScene();
    paint(true);
  }
  function pause(reason = 'paused') {
    continuousPlay.cancel('paused');
    launchIntent = null;
    if (disposed) return;
    pauseGeneration++;
    gamepad.reset();
    resetStickTraces();
    cancelReview();
    flight?.pause();
    audio.pause();
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
    $('academy-flight-options').open = false;
    if (
      disposed ||
      suspended ||
      !renderer.available ||
      !sceneReady ||
      graphicsLost ||
      modalOpen() ||
      !inputAvailable() ||
      reviewAbort ||
      (replay && replay.at >= replay.proof.frames.length)
    )
      return false;
    immersive.closeControls();
    $('flight-app').dataset.flightMenuOpen = 'false';
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
      restoreRadio();
      radio.poll();
      if (!radio.requestArm()) {
        message = radio.status().reason;
        paint(true);
        return false;
      }
    }
    if (input.owner() === 'controller') readGamepad(win.performance.now(), 'ready');
    if (input.owner() === 'controller' && !gamepad.status().canArm) {
      message =
        locale === 'uk'
          ? 'Під’єднайте контролер і відпустіть стіки та кнопки.'
          : 'Connect a controller, then centre the sticks and release all buttons.';
      paint(true);
      return false;
    }
    input.enable(true);
    flight.arm();
    void audio.resume();
    appearanceSession.arm(flight.snapshot().status);
    accumulator = 0;
    lastTime = null;
    lastExecutionTime = null;
    message = null;
    $('viewport').focus();
    paint(true);
    return true;
  }
  const dialogOpeners = new Map();
  function closeDialog(id) {
    cancelReview();
    if (id === 'course-dialog' && playShell) {
      playShell.open('briefing');
      return;
    }
    $(id).close();
    if (id === 'setup-dialog') {
      setup?.dispose();
      setup = null;
    }
    const opener = dialogOpeners.get(id);
    (opener?.isConnected && !opener.closest('[hidden],[inert]')
      ? opener
      : (playShell?.topDialog()?.querySelector('h1') ?? $('viewport'))
    ).focus();
  }
  function openDialog(id) {
    if (id === 'course-dialog' && playShell) return playShell.open('missions');
    if (!$(id).open) dialogOpeners.set(id, doc.activeElement);
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
        onDone() {
          if ($('input-source').value !== 'radio') {
            $('input-source').value = 'radio';
            $('input-source').dispatchEvent(new win.Event('change', { bubbles: true }));
          }
          closeDialog('setup-dialog');
          pause();
        },
        onResponse(value) {
          response = value;
          reset();
        },
      });
    }
    if ($('academy-flight-options')) $('academy-flight-options').open = false;
    $(id).showModal();
  }
  const copyProof = (inputProof) => readAcademyRecording(inputProof);
  function review(inputProof, kind = 'review') {
    // Copy caller-owned data before the first asynchronous boundary.
    const recording = copyProof(inputProof);
    return startReview(() => academyRecording(recording.proof, recording.presentation), kind);
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
        const recording = copyProof(raw);
        const proof = recording.proof;
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
        await showReview(proof, kind, index, checked, recording.presentation);
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
  async function showReview(proof, kind, index, checked, savedPresentation = null) {
    playShell?.enterPlay();
    selected = index;
    mode = proof.mode;
    authoringCourse = null;
    const playback = createFlight({ course: courses[index], mode, response: proof.response });
    const acceptedPresentation = savedPresentation ?? { collectionId: 'authored', revision: 'r1' };
    replay = {
      proof,
      kind,
      flight: playback,
      at: 0,
      paused: true,
      presentation: acceptedPresentation,
    };
    const requestedReplay = replay,
      requestedPause = pauseGeneration;
    $('replay-controls').hidden = false;
    $('replay-rate').value = String(replayRate);
    $('mode').value = mode;
    $('complete').hidden = true;
    $('try').hidden = false;
    message = null;
    accumulator = 0;
    lastTime = null;
    lastExecutionTime = null;
    const appearance = appearanceSession.begin(acceptedPresentation, { retained: true });
    const playable = playableSimAppearance(appearance);
    renderer.setPresentation?.(playable.appearance);
    renderer.setCourse?.(courses[index], mode);
    appearanceControls.refresh();
    renderer.setPath?.(checked.path);
    paint(true);
    if (!(await prepareScene()) || replay !== requestedReplay || disposed) return;
    if (playable.fallbackReason)
      message =
        locale === 'uk'
          ? 'Оформлення запису недоступне; використано авторське оформлення.'
          : 'Recorded appearance unavailable; using the authored appearance.';
    if (requestedPause === pauseGeneration && inputAvailable() && !modalOpen() && !suspended) {
      playback.arm();
      replay.paused = false;
      accumulator = 0;
      lastTime = null;
      lastExecutionTime = null;
    }
    paint(true);
  }
  function translated() {
    doc.documentElement.lang = locale;
    $('language').value = locale;
    $('radio-setup-title').textContent = locale === 'uk' ? 'Налаштування пульта' : 'Radio setup';
    immersive.refresh();
    for (const node of doc.querySelectorAll('[data-sim-copy]')) {
      const values = shellCopy[node.dataset.simCopy];
      if (values) node.textContent = values[locale === 'uk' ? 1 : 0];
    }
    presentation.refresh();
    playShell?.setLocale(locale);
    modeSettingsView?.refresh(locale);
    globalSettingsView?.refresh(locale);
    globalTools?.refresh();
    modes.refresh?.();
    appearanceControls.refresh();
    updateSoundLabel(presentation.soundEnabled());
    audioControls.refresh();
    for (const node of doc.querySelectorAll('[data-copy]'))
      if (c()[node.dataset.copy]) node.textContent = c()[node.dataset.copy];
    for (const node of doc.querySelectorAll('[data-copy="keys"]'))
      node.textContent = `${keyboardFlightHelp($('keyboard-preset').value, locale)}. ${locale === 'uk' ? 'Відпустіть клавіші газу, щоб утримувати його значення. Центровані стіки не зупиняють рух і не утримують висоту.' : 'Release the throttle keys to keep that setting. Centre sticks do not stop momentum or hold altitude.'}`;
    $('mode').options[0].textContent = locale === 'uk' ? 'Самовирівнювання' : 'Self-level';
    $('mode').options[1].textContent = 'Acro';
    $('academy-navigation')?.setAttribute(
      'aria-label',
      locale === 'uk' ? 'Розділи симулятора' : 'Simulator navigation',
    );
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
    // A recording can end before its objective; exhausting its commands is a
    // presentation result, never a simulated completion or resumable flight.
    const replayEnded = !!replay && replay.at >= replay.proof.frames.length;
    const terminal = ['complete', 'expired'].includes(state.status) || replayEnded;
    // Playback retains the recorded model's status when its presentation clock
    // pauses. The shared menu must follow that clock, not the live-flight model.
    const pausedReplay =
      !!replay && replay.paused && replay.at < replay.proof.frames.length && !terminal;
    for (const [action, labels] of resultChoices) {
      const node = $(`academy-result-${action}`),
        value = labels[locale === 'uk' ? 1 : 0];
      if (node.textContent !== value) node.textContent = value;
    }
    $('flight-app').dataset.flightState = state.status;
    playShell?.update({
      phase: terminal
        ? 'results'
        : pausedReplay
          ? 'paused'
          : state.status === 'active'
            ? 'playing'
            : state.status,
      transitionActive: !['idle', 'cancelled'].includes(continuousPlay.snapshot().phase),
      missionName: currentCourse().locales[locale].title,
      summary: currentCourse().locales[locale].brief,
      canResume: replay
        ? pausedReplay
        : state.ticks > 0 && ['paused', 'disarmed'].includes(state.status),
      muted: !audio.enabled(),
    });
    $('arm').disabled = !sceneReady || terminal;
    if ($('academy-flight-resume')) {
      $('academy-flight-resume').disabled =
        !sceneReady || terminal || !['disarmed', 'paused'].includes(state.status);
      $('academy-flight-resume').textContent = c().arm;
    }
    if ($('academy-controller-hint')) {
      $('academy-controller-hint').textContent = gamepadHelp();
      $('academy-controller-hint').hidden = input.owner() !== 'controller';
    }
    renderer.draw?.(state, {
      cameraMode: $('camera').value || 'fpv',
      cameraFov: Number($('camera-fov').value) || 82,
      cameraTilt: Number($('camera-tilt').value) || 0,
    });
    const radioPreview = !replay && input.owner() === 'radio' ? radio.preview() : null,
      values =
        !replay && input.owner() === 'touch' && state.status !== 'active'
          ? Object.fromEntries(
              Object.entries(input.sample(0)).map(([axis, value]) => [
                axis,
                Math.round(value * 1000),
              ]),
            )
          : state.lastInput,
      monitor = radioPreview
        ? radioPreview.controls
        : !replay && input.owner() === 'controller'
          ? gamepad.preview().controls
          : Object.fromEntries(FLIGHT_CONTROLS.map((key) => [key, values[key] / 1000])),
      stickMode = radioPreview?.stickMode ?? 2,
      layout = STICK_LAYOUTS[stickMode],
      source = replay ? 'recording' : input.owner(),
      traceLayout = `${epoch}:${source}:${layout.join(':')}`,
      reducedMotion = Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches),
      traceTime = win.performance.now();
    if (stickTraceLayout !== traceLayout) resetStickTraces();
    stickTraceLayout = traceLayout;
    droneResponse.update({
      state,
      controls: monitor ?? neutralFlightInput(),
      source: replay ? 'recording' : input.owner(),
      unavailable: !replay && input.owner() === 'radio' && !radioPreview?.controls,
      locale,
      mode,
      display: $('academy-drone-guide').value,
      scale: $('academy-guide-scale').value,
      reducedMotion,
    });
    $('sticks').setAttribute(
      'aria-label',
      `${locale === 'uk' ? 'Органи керування' : 'Flight controls'} · Mode ${stickMode}`,
    );
    for (const [i, id] of ['left-dot', 'right-dot'].entries()) {
      const dot = $(id),
        horizontal = layout[i * 2],
        vertical = layout[i * 2 + 1],
        y = monitor ? (vertical === 'throttle' ? monitor.throttle * 2 - 1 : monitor[vertical]) : 0;
      dot.hidden = !monitor;
      const expanded = $('academy-stick-display')?.value === 'expanded';
      $('sticks').classList.toggle('expanded-sticks', expanded);
      paintStickDirections(dot.parentElement, { horizontal, vertical, locale });
      const radius = dot.parentElement.clientWidth * 0.3;
      dot.style.transform = `translate(${(monitor?.[horizontal] ?? 0) * radius}px, ${-y * radius}px)`;
      stickTraces[i].update({
        x: monitor?.[horizontal] ?? 0,
        y,
        now: traceTime,
        source,
        reducedMotion,
        available:
          Boolean(monitor) &&
          !(source === 'radio' && !radioPreview?.controls) &&
          state.status === 'active' &&
          source !== 'touch',
      });
    }
    if (input.owner() === 'touch') {
      $('touch-throttle').value = String(Math.round(values.throttle / 10));
      paintStickDirections($('left-stick'), { horizontal: 'yaw', vertical: 'throttle', locale });
      paintStickDirections($('right-stick'), { horizontal: 'roll', vertical: 'pitch', locale });
      const leftTravel = $('left-stick').clientWidth * 0.34,
        rightTravel = $('right-stick').clientWidth * 0.34;
      $('left-stick').querySelector('i').style.transform =
        `translate(${(values.yaw / 1000) * leftTravel}px, ${(1 - values.throttle / 500) * leftTravel}px)`;
      $('right-stick').querySelector('i').style.transform =
        `translate(${(values.roll / 1000) * rightTravel}px, ${(-values.pitch / 1000) * rightTravel}px)`;
      $('touch-throttle-readout').textContent = `${Math.round(values.throttle / 10)}%${
        $('left-stick').dataset.touchActive === 'true'
          ? ''
          : locale === 'uk'
            ? ' · тримає'
            : ' · held'
      }`;
      for (const [index, pair] of [
        [values.yaw / 1000, values.throttle / 500 - 1],
        [values.roll / 1000, values.pitch / 1000],
      ].entries())
        touchTraces[index].update({
          x: pair[0],
          y: pair[1],
          now: traceTime,
          source,
          reducedMotion,
          available: state.status === 'active',
        });
    } else touchTraces.forEach((trace) => trace.reset());
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
    say(
      reviewAbort
        ? c().verifying
        : message
          ? messageText(message)
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
    lastPresentation = appearanceSession.current();
    if (state.status !== 'complete') {
      $('complete').hidden = false;
      $('complete-title').textContent = locale === 'uk' ? 'Політ завершено' : 'Flight ended';
      $('lesson').textContent =
        locale === 'uk'
          ? 'Новий маршрут починається з наступної спроби.'
          : 'Your next route starts with another try.';
      $('next').hidden = $('review').hidden = true;
      $('retry').focus();
      if (!authoringCourse)
        continuousPlay.begin({ identity: flight, outcome: 'lost', replayMs: 0, readyMs: 400 });
      return;
    }
    $('complete-title').textContent = currentCourse().locales[locale].title;
    $('lesson').textContent = currentCourse().locales[locale].lesson;
    $('complete').hidden = false;
    $('next').hidden = !!authoringCourse || selected === courses.length - 1;
    $('review').hidden = !!authoringCourse;
    (!$('next').hidden ? $('next') : $('retry')).focus();
    if (!authoringCourse)
      continuousPlay.begin({ identity: flight, outcome: 'won', canAdvance: !$('next').hidden });
    if (lastProof.session !== 'practice') return;
    const owner = epoch,
      delivery = { course: courses[selected], attempt: lastProof },
      previous = pendingAttempt;
    // Notebook admission already replays cooperatively. Retain this exact win
    // independently of the next visible run; Next/Retry need not wait for it.
    const admission = notebook?.accept
      ? Promise.resolve(notebook.accept(delivery.attempt, { presentation: lastPresentation })).then(
          (verification) => ({
            ...delivery,
            verification,
          }),
        )
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
    if (disposed || suspended) return;
    const delta = lastTime === null ? 0 : now - lastTime,
      executedAt = win.performance?.now?.() ?? now,
      executionDelta = lastExecutionTime === null ? 0 : executedAt - lastExecutionTime;
    lastTime = now;
    lastExecutionTime = executedAt;
    // Freeze before polling actions or advancing a countdown. A queued rAF can
    // retain its pre-stall timestamp, so also check the callback execution gap.
    if (delta > 250 || executionDelta > 250) {
      pause('focusLost');
      frameId = win.requestAnimationFrame(frame);
      return;
    }
    pollGamepad(now);
    pollMenu(now);
    if (
      launchIntent &&
      launchIntent.epoch === epoch &&
      launchIntent.pauseGeneration === pauseGeneration &&
      sceneReady &&
      arm()
    )
      launchIntent = null;
    // A manual launch/reset above starts a fresh clock for the accepted flight.
    const elapsed = lastTime === null ? 0 : delta;
    continuousPlay.advance(elapsed);
    if (
      !reviewAbort &&
      inputAvailable() &&
      !modalOpen() &&
      !flightMenuOpen() &&
      !immersive.snapshot().toolsOpen &&
      renderer.available &&
      sceneReady &&
      !graphicsLost
    ) {
      let radioInput = neutralFlightInput();
      if (!replay && input.owner() === 'radio') {
        if (!radio.status().active && now - lastRadioDiscovery >= 500) {
          lastRadioDiscovery = now;
          restoreRadio();
        }
        radioInput = radio.poll();
        if (!radio.status().active && ['paused', 'disarmed'].includes(flight.snapshot().status))
          message = radio.status().reason === 'ready' ? 'radioReady' : radio.status().reason;
        if (radio.status().active && ['paused', 'disarmed'].includes(flight.snapshot().status)) {
          flight.arm();
          void audio.resume();
          appearanceSession.arm(flight.snapshot().status);
          input.enable(true);
          message = null;
        }
      }
      const active = replay
        ? !replay.paused && replay.at < replay.proof.frames.length
        : flight.snapshot().status === 'active';
      // Slow replay changes wall-clock scheduling, not the input order or model step.
      // Every recorded command still advances the fixed-step model exactly once.
      if (active) accumulator += Math.max(0, elapsed) * (replay ? replayRate : 1);
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
          const command =
            input.owner() === 'radio'
              ? radioInput
              : input.owner() === 'controller'
                ? gamepad.sample(1 / FLIGHT_HZ)
                : input.sample(1 / FLIGHT_HZ);
          const before = flight.snapshot().ticks;
          audio.update(flight.snapshot(), { active: true });
          flight.step(command);
          audio.update(flight.snapshot(), { active: flight.snapshot().status === 'active' });
          if (flight.snapshot().ticks !== before) recorder.record(command);
          completed();
        }
      }
    }
    if (!replay && flight)
      audio.update(flight.snapshot(), { active: flight.snapshot().status === 'active' });
    paint(false, now);
    frameId = win.requestAnimationFrame(frame);
  }
  listen($('academy-flight-menu'), 'click', () => setFlightMenu(true));
  listen($('academy-flight-close-menu'), 'click', () => setFlightMenu(false));
  listen($('academy-flight-resume'), 'click', () => arm());
  input.bindStick($('left-stick'), 'left');
  input.bindStick($('right-stick'), 'right');
  listen($('touch-throttle'), 'input', () =>
    input.throttle(Number($('touch-throttle').value) / 100),
  );
  listen($('academy-flight-options'), 'toggle', () => {
    if ($('academy-flight-options').open) {
      pause();
      if (playShell) {
        $('academy-flight-options').open = false;
        playShell.open('settings');
      }
    }
  });
  const closeOptionsOnEscape = (event) => {
    if (
      event.key !== 'Escape' ||
      !$('academy-flight-options').open ||
      dialogIds.some((id) => $(id).open)
    )
      return;
    event.preventDefault();
    event.stopImmediatePropagation();
    $('academy-flight-options').open = false;
    $('academy-flight-options').querySelector('summary').focus();
  };
  doc.addEventListener('keydown', closeOptionsOnEscape, true);
  listeners.push(() => doc.removeEventListener('keydown', closeOptionsOnEscape, true));
  listen($('academy-close-options'), 'click', () => {
    $('academy-flight-options').open = false;
    $('academy-flight-options').querySelector('summary').focus();
  });
  listen($('academy-stick-display'), 'change', () => {
    try {
      win.localStorage?.setItem(
        'revealline.fpv.academy-sticks.v1',
        $('academy-stick-display').value,
      );
    } catch {
      /* Display changes do not depend on storage availability. */
    }
    paint(true);
  });
  listen($('academy-sound'), 'click', async () => {
    const enabled = !audio.enabled();
    await audio.setEnabled(enabled);
    await presentation.setSoundEnabled(enabled);
    updateSoundLabel(enabled);
  });
  for (const id of ['academy-drone-guide', 'academy-guide-scale'])
    listen($(id), 'change', () => {
      saveGuidePreferences();
      paint(true);
    });
  listen($('arm'), 'click', arm);
  listen(win, 'keydown', (event) => {
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      !flight ||
      modalOpen() ||
      flightMenuOpen() ||
      immersive.snapshot().toolsOpen ||
      !inputAvailable() ||
      !$('viewport').contains(event.target) ||
      !$('viewport').contains(doc.activeElement) ||
      /^(INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(event.target?.tagName) ||
      event.target?.isContentEditable
    )
      return;
    const preset = keyboardFlightPreset($('keyboard-preset').value);
    if (event.code === preset.arm) {
      event.preventDefault();
      if (event.repeat) return;
      if (replay ? !replay.paused : flight.snapshot().status === 'active') pause();
      else arm();
    } else if (event.code === preset.reset) {
      event.preventDefault();
      if (event.repeat) return;
      if (replay) {
        pause();
        replay.flight = createFlight({
          course: courses[selected],
          mode,
          response: replay.proof.response,
        });
        replay.at = 0;
        message = 'paused';
        paint(true);
      } else reset();
      $('viewport').focus();
    }
  });
  listen(win, 'blur', () => {
    focused = false;
    presentation.pause();
    pause('focusLost');
  });
  listen(win, 'focus', () => {
    focused = true;
    presentation.resume();
    if (!replay && !modalOpen()) restoreRadio();
  });
  listen(doc, 'visibilitychange', () => {
    if (doc.visibilityState === 'hidden') {
      presentation.pause();
      pause('focusLost');
    } else presentation.resume();
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
  listen($('replay-rate'), 'change', () => {
    const value = Number($('replay-rate').value);
    if (!replay || ![0.5, 1].includes(value)) {
      $('replay-rate').value = String(replayRate);
      return;
    }
    replayRate = value;
    // Do not apply a newly selected rate to elapsed time before this change.
    // A paused review stays paused; changing speed never acquires live input.
    accumulator = 0;
    lastTime = null;
    lastExecutionTime = null;
    paint(true);
  });
  listen($('reset'), 'click', () => reset());
  listen($('retry'), 'click', () => {
    reset(selected, mode, null);
    void startPrepared();
  });
  listen($('try'), 'click', () => reset(selected, mode, null));
  listen($('next'), 'click', () => {
    reset(Math.min(courses.length - 1, selected + 1), mode, null);
    void startPrepared();
  });
  listen($('mode'), 'change', () => reset(selected, $('mode').value));
  listen($('input-source'), 'change', () => {
    input.select($('input-source').value);
    restoreRadio();
    reset();
    $('touch-controls').hidden = input.owner() !== 'touch';
    doc.body.classList.toggle('touch-mode', input.owner() === 'touch');
  });
  listen($('touch-response'), 'change', () => {
    pause();
    input.touchResponse($('touch-response').value);
    try {
      win.localStorage?.setItem('revealline.fpv.touch-response.v1', $('touch-response').value);
    } catch {
      /* Touch response remains available when preference storage is denied. */
    }
    paint(true);
  });
  listen($('keyboard-preset'), 'change', () => {
    pause();
    input.keyboardPreset($('keyboard-preset').value);
    try {
      win.localStorage?.setItem(KEYBOARD_PRESET_KEY, $('keyboard-preset').value);
    } catch {
      /* Session controls remain usable without storage. */
    }
    translated();
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
  listen(win, 'gamepaddisconnected', (event) => {
    if (!replay && input.owner() === 'radio') radio.disconnect(event.gamepad.index);
  });
  listen(win, 'gamepadconnected', () => {
    if (!replay && !modalOpen()) restoreRadio();
  });
  const menuHint = doc.createElement('p');
  menuHint.className = 'sim-menu-hint';
  menuHint.id = 'academy-menu-hint';
  $('flight-app').append(menuHint);
  const menuContext = () => {
    const globalToolRoot = globalTools?.root();
    if (globalToolRoot)
      return {
        root: globalToolRoot,
        key: `global-tools:${globalToolRoot.id}`,
        frameFocused: globalTools.frameFocused(),
        handleFrameCommand: globalTools.handleFrameCommand,
      };
    const dialog = dialogIds.map($).find((node) => node.open);
    if (dialog)
      return {
        root: dialog,
        key: dialog.id,
        blockRadio: dialog.id === 'setup-dialog',
        blockDevices: dialog.id === 'setup-dialog' && Boolean(setup?.captureActive()),
      };
    if (playShell?.topDialog())
      return { root: playShell.topDialog(), key: playShell.topDialog().id, blockDevices: false };
    // Initial title focus can blur the page before reset installs a flight.
    if (flight?.snapshot().status === 'active' && !modalOpen()) return null;
    return {
      root: $('flight-app'),
      key: `academy:${modalOpen()}:${flightMenuOpen()}`,
      blockDevices: gamepadScope() !== 'blocked',
    };
  };
  const menuNavigation = createFlightMenuNavigation({
    onAction: () => continuousPlay.cancel('controller'),
    document: doc,
    window: win,
    locale: () => locale,
    getContext: menuContext,
    ownsKeyboardEvent: (event) => simSettingsTabOwnsKey(event, menuContext()?.root),
    onHint(value) {
      const context = menuContext();
      // Suspending device input must not reflow an open shared menu beneath
      // the pointer. Its instructions remain valid while the page is blurred.
      if (!value && context?.root.dataset.modeSurface) return;
      menuHint.hidden = !context;
      const hintContainer =
        context?.root === playShell?.elements.dialogs.settings
          ? (modeSettingsView?.panels.extras ?? context.root)
          : context?.root;
      if (hintContainer && menuHint.parentElement !== hintContainer) hintContainer.append(menuHint);
      if (context?.root.dataset.modeSurface)
        context.root.setAttribute('aria-describedby', menuHint.id);
      if (menuHint.textContent !== value) menuHint.textContent = value;
    },
    onBack() {
      const dialog = dialogIds.find((id) => $(id).open);
      if (globalTools?.back()) return;
      if (dialog) closeDialog(dialog);
      else if (playShell?.topDialog()) playShell.back();
      else if (flightMenuOpen()) setFlightMenu(false);
      else if ($('academy-flight-options').open) $('academy-flight-options').open = false;
      else if (immersive.active()) void immersive.exit();
      else openDialog('course-dialog');
    },
  });
  function pollMenu(now) {
    if (!menuContext()) {
      menuNavigation.poll({ now });
      return;
    }
    let gamepads = [];
    try {
      gamepads = win.navigator.getGamepads?.() ?? [];
    } catch {
      /* Menus remain usable without device access. */
    }
    if (now - lastRadioDiscovery > 1000 && !$('setup-dialog').open) {
      lastRadioDiscovery = now;
      restoreRadio();
    }
    const observed = radio.preview();
    menuNavigation.poll({
      now,
      gamepads,
      radio: {
        key: radio.status().selected?.key,
        controls: observed.controls,
        verified: observed.verified,
        index: radio.status().selected?.index,
      },
    });
  }
  const fullscreenButtons = [];
  for (const dialog of dialogIds.map($)) {
    const full = doc.createElement('button');
    full.type = 'button';
    full.className = 'sim-screen-fullscreen';
    (dialog.querySelector('header') ?? dialog).append(full);
    fullscreenButtons.push(full);
  }
  const immersive = mountFlightFullscreen({
    document: doc,
    window: win,
    surface: $('flight-app'),
    viewport: $('viewport'),
    button: $('fullscreen'),
    buttons: fullscreenButtons,
    scope: 'application',
    getFocusTarget: () => doc.activeElement,
    setupButton: $('setup'),
    kind: 'academy',
    locale: () => locale,
    onPause: () => pause(),
    secondaryDialogOpen: modalOpen,
  });
  listen($('watch'), 'click', () => {
    const proof = demonstrations.find(
      (item) => item.course === courses[selected].id && item.mode === mode,
    );
    if (proof) void review(proof, 'demonstration').catch(() => {});
  });
  listen($('review'), 'click', () => {
    if (lastProof) void review(academyRecording(lastProof, lastPresentation)).catch(() => {});
  });
  listen($('export-attempt'), 'click', () => {
    pause();
    const proof = replay?.proof ?? recorder.export();
    const recording = academyRecording(proof, replay?.presentation ?? appearanceSession.current());
    const url = win.URL.createObjectURL(
        new Blob([JSON.stringify(recording)], { type: 'application/json' }),
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
      if (file.size > 1024 * 1024 + 2048)
        throw new Error('Flight recording exceeds its size limit.');
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
        playShell?.open('briefing');
      }
    },
    onCosmetic(recipe) {
      if (/^#[a-fA-F0-9]{6}$/.test(recipe.color)) {
        doc.documentElement.style.setProperty('--accent', recipe.color);
        renderer.setCosmetic?.(recipe);
      }
    },
  });
  void Promise.resolve(notebook?.ready)
    .then(() => {
      if (!disposed)
        appearanceControls.preferences.adoptExisting(
          Boolean(notebook?.snapshot?.().attempts?.length),
        );
    })
    .catch(() => {});
  studio = studioFactory?.({
    container: $('flight-studio'),
    courses,
    locale,
    onPreview(course) {
      closeDialog('studio-dialog');
      reset(selected, mode, course);
      playShell?.open('briefing');
    },
  });
  for (const [id, operation] of [
    ['install-offline', preparePracticeOffline],
    ['remove-offline', removePracticeOffline],
  ])
    listen($(id), 'click', async () => {
      if (!offlineAvailable || offlineBusy || disposed || suspended) return;
      pause();
      offlineBusy = true;
      refreshOfflineControls();
      $('transfer-status').textContent =
        c()[id === 'install-offline' ? 'offlinePreparing' : 'offlineRemoving'];
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
      } finally {
        offlineBusy = false;
        if (!disposed) refreshOfflineControls();
      }
    });
  if (win.matchMedia?.('(pointer: coarse)').matches) {
    $('input-source').value = 'touch';
    input.select('touch');
    $('touch-controls').hidden = false;
    doc.body.classList.add('touch-mode');
  }
  const menuSection = (className) => {
    const node = doc.createElement('section');
    node.className = className;
    return node;
  };
  const shellSettings = menuSection('sim-shell-settings');
  shellSettings.append(
    doc.querySelector('.academy-input-controls'),
    doc.querySelector('.academy-options-panel'),
  );
  const shellBriefing = menuSection('sim-shell-briefing');
  const keys = doc.createElement('p');
  keys.dataset.copy = 'keys';
  shellBriefing.append(keys);
  const arcadeReturn = gameReturn ?? (sourceWorlds ? new URL('../../game/', pageURL).href : null);
  let wordmarkURL = '';
  if (arcadeReturn) {
    const target = new URL(arcadeReturn);
    const match = /^(.*\/game\/)/.exec(target.pathname);
    if (match)
      wordmarkURL = new URL(match[1] + 'ui/art/identity/fpv-line/wordmark.png', target).href;
  }
  const modes = createSimModeLinks({
    document: doc,
    gameReturn: arcadeReturn,
    locale: () => locale,
    setMenuIcon(node, name) {
      node.dataset.simIcon = name;
      presentation.refresh(node);
    },
  });
  const expert = menuSection('sim-shell-expert');
  for (const id of ['notebook-button', 'help']) expert.append($(id));
  playShell = mountSimPlayShell({
    document: doc,
    mount: doc.body,
    idPrefix: 'academy-shell',
    wordmarkURL,
    artworkURL: wordmarkURL ? new URL('../../menu-scenes/fpv.webp', wordmarkURL).href : '',
    modeName: () => (locale === 'uk' ? 'FPV SIM · Академія' : 'FPV SIM · Academy'),
    locale,
    services: {
      settingsPanelBack: simSettingsPanelBack,
      setMenuIcon(node, name) {
        node.dataset.simIcon = name;
        presentation.refresh(node);
      },
    },
    slots: {
      modes,
      missions: $('course-list'),
      briefing: shellBriefing,
      play: $('flight-app'),
      settings: shellSettings,
      expert,
    },
    actions: {
      pause: () => pause(),
      start: startPrepared,
      resume: startPrepared,
      continue: startPrepared,
      skip: () => {
        reset((selected + 1) % courses.length, mode, null);
        void startPrepared();
      },
      random: () => {
        const offset = 1 + Math.floor(Math.random() * Math.max(1, courses.length - 1));
        reset((selected + offset) % courses.length, mode, null);
        void startPrepared();
      },
      retry: () => {
        reset();
        void startPrepared();
      },
      canResume: () =>
        Boolean(
          flight &&
            flight.snapshot().ticks > 0 &&
            ['paused', 'disarmed'].includes(flight.snapshot().status),
        ),
      toggleSound: () => $('academy-sound').click(),
      fullscreen: () => void immersive.toggle(),
      open(surface) {
        if (surface === 'settings') void globalTools?.ensure();
        if (flight?.snapshot().status === 'active') pause();
        if (surface === 'results') {
          // Reveal the retained native outcome; entering the scene never arms.
          playShell.enterPlay();
          const target = $('complete').hidden ? $('status') : $('retry');
          if (target === $('status')) target.setAttribute('tabindex', '-1');
          target.focus();
          return false;
        }
        if (surface === 'workshop' || surface === 'help') {
          openDialog(surface === 'workshop' ? 'studio-dialog' : 'help-dialog');
          return false;
        }
      },
    },

    initial: 'home',
    focusPlay: () => $('viewport').focus(),
  });
  const settingLabel = (id) => $(id)?.closest('label');
  const languageLabel = doc.createElement('label');
  languageLabel.textContent = 'Language / Мова';
  languageLabel.append($('language'));
  modeSettingsView = mountSimModeSettings({
    root: playShell.elements.dialogs.settings,
    content: playShell.elements.content.settings,
    prefix: 'academy-settings',
    locale,
    attachPanels: simAttachSettingsPanels,
    setMenuIcon(node, name) {
      node.dataset.simIcon = name;
      presentation.refresh(node);
    },
    groups: {
      gameplay: [settingLabel('mode'), playShell.elements.buttons['home-retry']],
      controls: [
        settingLabel('input-source'),
        $('setup'),
        settingLabel('keyboard-preset'),
        settingLabel('touch-response'),
        controllerHint,
      ],
      audio: [
        $('academy-audio-mix'),
        $('academy-sound'),
        shellSettings.querySelector('[data-sim-copy="audioMixHelp"]'),
      ],
      display: [
        languageLabel,
        settingLabel('camera'),
        settingLabel('camera-fov'),
        settingLabel('camera-tilt'),
        shellSettings.querySelector('.sim-appearance-controls'),
      ],
      accessibility: [
        settingLabel('academy-stick-display'),
        settingLabel('academy-drone-guide'),
        settingLabel('academy-guide-scale'),
      ],
      data: [$('notebook-button')],
      content: [playShell.elements.buttons.workshop],
      extras: [$('help'), shellSettings.querySelector('[data-sim-copy="optionsPause"]')],
    },
  });
  const globalThemeControls = attachSimThemeFamilyControls({
    document: doc,
    root: modeSettingsView.panels.display,
    host: appearanceControls.host,
    prefix: 'academy-global-',
  });
  const displayBinding = (key) => ({
    get: () => displayPreferences.snapshot()[key],
    set: (value) => displayPreferences.set({ [key]: value }),
    subscribe: (listener) => displayPreferences.subscribe(listener),
  });
  globalSettingsView = mountSimGlobalSettings({
    document: doc,
    root: playShell.elements.dialogs.settings,
    panels: modeSettingsView.panels,
    prefix: 'academy-global',
    locale,
    controls: {
      language: languageLabel,
      appearance: modeSettingsView.panels.display.querySelector('[data-theme-controls]'),
    },
    bindings: {
      textFace: displayBinding('textFace'),
      textSize: displayBinding('textSize'),
      reducedEffects: displayBinding('reducedEffects'),
      menuAnimation: {
        get: () => getSimMenuAnimation(win),
        set: (value) => setSimMenuAnimation(value, win),
        subscribe: (listener) => subscribeSimMenuAnimation(listener, win),
      },
      masterMuted: {
        get: () => audio.masterSnapshot().muted,
        set: (value) => audio.setEnabled(!value),
        subscribe: (listener) => audio.subscribeMaster(listener),
      },
      masterVolume: {
        get: () => audio.masterSnapshot().volume,
        set: (value) => audio.setMasterVolume(value),
        subscribe: (listener) => audio.subscribeMaster(listener),
      },
    },
    duplicates: { masterMuted: [$('academy-sound')] },
  });
  const sharedAudioCues = doc.createElement('section');
  let radioCueStorage;
  try {
    radioCueStorage = win.localStorage;
  } catch {
    /* Preferences still work for this visit. */
  }
  let sharedRadioCues = readSimRadioAudio(radioCueStorage);
  const restoreRadioCues = () => {
    if (radioCueStorage) sharedRadioCues = readSimRadioAudio(radioCueStorage);
  };
  listen(win, 'pageshow', restoreRadioCues);
  listen(win, 'storage', (event) => {
    if (event.key === SIM_RADIO_AUDIO_KEY || event.key === null) restoreRadioCues();
  });

  const cueSettings = {
    // This preference is global; the 3D engine has no separate radio bus.
    // The canonical Soundscape consumes the same record in supported modes.
    get radioSettings() {
      return sharedRadioCues;
    },
    set radioSettings(value) {
      sharedRadioCues = value;
    },
    get menuSettings() {
      return presentation.menuSettings;
    },
    set menuSettings(value) {
      presentation.menuSettings = value;
    },
    get movementSettings() {
      return audio.movementSettings;
    },
    set movementSettings(value) {
      audio.movementSettings = value;
    },
    applyVolumes() {
      presentation.applyVolumes();
      audio.applyVolumes();
    },
  };
  listeners.push(
    attachSimMenuAudioSettings(cueSettings, doc, {
      target: sharedAudioCues,
      window: win,
      getStorage: () => win.localStorage,
      idPrefix: 'sim-global',
    }),
  );
  globalSettingsView.update({ controls: { audioCues: sharedAudioCues } });
  globalTools = globalToolsFactory({
    document: doc,
    window: win,
    gameReturn,
    settingsRoot: playShell.elements.dialogs.settings,
    panels: modeSettingsView.panels,
    locale: () => locale,
    onOpen: () => pause(),
    onControls: (controls) => globalSettingsView.update({ controls }),
  });
  // These wrappers only held the controls now owned by the shared categories.
  shellSettings.hidden = true;
  enemyStatsViews.push(
    mountSimEnemyStats({
      document: doc,
      container: playShell.elements.content.pause,
      stats: enemyStatistics.stats,
      variant: 'panel',
      locale: () => locale,
      spritePortraits: false,
    }),
  );
  playShell.elements.buttons.expert.hidden = true;
  playShell.elements.buttons.help.hidden = true;
  $('academy-close-options').dataset.settingsBack = '';
  listen($('academy-close-options'), 'click', () => playShell.back());

  // Existing renderer preparation remains asynchronous; Play enters its native
  // disarmed scene, where Arm becomes available as soon as assets are ready.
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
      await pendingScene;
    },
    snapshot: () => flight.snapshot(),
    exportAttempt: () => recorder.export(),
    exportRecording: () => academyRecording(recorder.export(), appearanceSession.current()),
    appearance: () => ({
      ...appearanceControls.resolve(),
      accepted: appearanceSession.current(),
      pending: appearanceSession.pending(),
    }),
    dispose() {
      if (disposed) return;
      pause();
      disposed = true;
      epoch++;
      scenePreparation?.abort();
      if (frameId !== null) win.cancelAnimationFrame(frameId);
      setup?.dispose();
      void notebook?.dispose();
      studio?.dispose();
      globalTools?.dispose();
      globalSettingsView?.destroy();
      globalThemeControls?.dispose();
      displayPreferences.dispose();
      modeSettingsView?.destroy();
      enemyStatsViews.forEach((view) => view.dispose());
      enemyStatistics.close();
      continuousPlay.dispose();
      flowControls.dispose();
      flowCelebration.dispose();
      playShell?.dispose();
      menuNavigation.dispose();
      menuHint.remove();
      input.dispose();
      gamepad.dispose();
      renderer.dispose();
      immersive.dispose();
      audioControls.dispose();
      presentation.dispose();
      audio.dispose();
      appearanceControls.dispose();
      droneResponse.dispose();
      [...stickTraces, ...touchTraces].forEach((trace) => trace.dispose());
      for (const remove of listeners) remove();
      for (const button of courseButtons) {
        button.onclick = null;
        button.remove();
      }
      courseButtons = [];
    },
  };
  listen(win, 'pagehide', (event) => {
    if (!event.persisted) {
      api.dispose();
      return;
    }
    // History caching retains this exact attempt and its resources, but releases
    // live input. Restoring the page must never resume or arm it automatically.
    suspended = true;
    presentation.pause();
    focused = false;
    pause('focusLost');
    if (frameId !== null) win.cancelAnimationFrame(frameId);
    frameId = null;
  });
  listen(win, 'pageshow', (event) => {
    if (!event.persisted || disposed || !suspended) return;
    suspended = false;
    presentation.resume();
    focused = typeof doc.hasFocus === 'function' ? doc.hasFocus() : true;
    lastTime = null;
    lastExecutionTime = null;
    accumulator = 0;
    frameId = win.requestAnimationFrame(frame);
    paint(true);
  });
  return api;
}

if (globalThis.document?.documentElement?.dataset?.civilianFpv === 'true') mountFlightApp();
