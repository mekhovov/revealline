import { STICK_LAYOUTS, DEFAULT_RESPONSE, neutralFlightInput } from './radio-profile.mjs';
import { createFlight, FLIGHT_HZ } from './model.mjs';
import { mountDroneDiagram } from './sim-presentation.mjs';
import { ACRO_LESSON_ORDER, SELF_LEVEL_LESSON_ORDER } from './world-catalogue.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const AXES = ['throttle', 'yaw', 'pitch', 'roll'];
const clamp = (n, a = -1, b = 1) => Math.max(a, Math.min(b, Number.isFinite(n) ? n : 0));

/** A separate, unscored teaching sandbox using the unchanged flight integrator.
 * It never receives the host flight or a recorder and cannot award completion. */
export function createBeginnerPreview(mode = 'acro') {
  const target = {
    type: 'hold',
    min: { x: 90000, y: 90000, z: 90000 },
    max: { x: 95000, y: 95000, z: 95000 },
    ticks: 500,
    maxSpeed: 0,
    maxTilt: 0,
    minTilt: 0,
    centred: true,
    heading: null,
  };
  return createFlight({
    mode,
    response: DEFAULT_RESPONSE,
    course: {
      format: 'FlightCourse.v1',
      id: 'coach-controls-preview',
      revision: 'v1',
      environment: 'field',
      locales: {
        en: {
          title: 'Controls preview',
          brief: 'Separate unscored preview.',
          lesson: 'Explore controls.',
        },
        uk: {
          title: 'Перегляд керування',
          brief: 'Окремий перегляд без оцінювання.',
          lesson: 'Досліджуйте керування.',
        },
      },
      spawn: { x: 0, y: 0, z: 0 },
      bounds: { min: { x: -30000, y: 0, z: -30000 }, max: { x: 30000, y: 30000, z: 30000 } },
      obstacles: [],
      steps: { 'self-level': [target], acro: [target] },
    },
  });
}

/** Guide-only input belongs to a separate sandbox; the host remains paused. */
export function mountBeginnerCoach({
  root,
  window: win = globalThis.window,
  locale = () => 'en',
  onStart = () => {},
  onPause = () => {},
  onRetry = () => {},
  onNext = () => {},
  onExit = () => {},
  onRadio = () => {},
  onFullscreen = () => {},
}) {
  const doc = root.ownerDocument;
  let lesson = null,
    stage = 'closed',
    explored = 'throttle',
    viewedStep = 0,
    replay = false,
    snapshot = {},
    lastRender = '',
    nextAvailable = false,
    disposed = false,
    lastPaint = 0;
  let refs = {};
  let labMode = 'example',
    labSource = 'keyboard',
    labRunning = false,
    labFlight = null,
    labInput = neutralFlightInput(),
    labReason = '',
    labFrameId = null,
    labLastTime = null,
    labAccumulator = 0,
    diagram = null,
    viewReleases = [];
  const labKeys = new Set(),
    blockedKeys = new Set();
  const labTouch = neutralFlightInput();
  let touchThrottleDirection = 0;
  const movementKeys = new Set([
    'KeyW',
    'KeyS',
    'KeyA',
    'KeyD',
    'KeyQ',
    'KeyE',
    'ArrowUp',
    'ArrowDown',
    'ShiftLeft',
    'ShiftRight',
  ]);
  const lang = () => ((typeof locale === 'function' ? locale() : locale) === 'uk' ? 'uk' : 'en');
  const t = (en, uk) => (lang() === 'uk' ? uk : en);
  const copy = (value) =>
    typeof value === 'string' ? value : (value?.[lang()] ?? value?.en ?? '');
  const node = (tag, className, value) => {
    const el = doc.createElement(tag);
    if (className) el.className = className;
    if (value !== undefined) el.textContent = value;
    return el;
  };
  const svg = (tag, attrs = {}, value) => {
    const el = doc.createElementNS(SVG_NS, tag);
    for (const [key, val] of Object.entries(attrs)) el.setAttribute(key, String(val));
    if (value !== undefined) el.textContent = value;
    return el;
  };
  const button = (action, label, className = '') => {
    const el = node('button', className, label);
    el.type = 'button';
    el.dataset.coachAction = action;
    return el;
  };
  const axisName = (axis) =>
    ({
      throttle: t('Throttle', 'Газ'),
      yaw: t('Yaw', 'Рискання'),
      pitch: t('Pitch', 'Тангаж'),
      roll: t('Roll', 'Крен'),
      mixed: t('Combine controls', 'Поєднайте керування'),
    })[axis] ?? axis;
  const directionName = (axis) =>
    ({
      throttle: t('↑ more thrust · ↓ less thrust', '↑ більше тяги · ↓ менше тяги'),
      yaw: t('← turn left · turn right →', '← поворот ліворуч · праворуч →'),
      pitch: t('↑ nose forward · ↓ nose back', '↑ ніс уперед · ↓ ніс назад'),
      roll: t('← tilt left · tilt right →', '← нахил ліворуч · праворуч →'),
    })[axis];
  const axisExplanation = (axis) =>
    ({
      throttle: t(
        'All four motors increase thrust along the drone’s own upward axis. While upright, more thrust usually accelerates you upward. Tilt and momentum determine whether you climb, descend or drift. Throttle controls thrust, not height.',
        'Усі чотири мотори збільшують тягу вздовж власної осі дрона вгору. У горизонтальному положенні більша тяга зазвичай прискорює вгору. Нахил та інерція визначають, чи ви набираєте висоту, спускаєтеся або дрейфуєте. Газ керує тягою, а не висотою.',
      ),
      yaw: t(
        'Turn the nose left or right while keeping the drone level. Yaw changes where you face; it does not move you sideways.',
        'Поверніть ніс ліворуч або праворуч, зберігаючи горизонтальне положення. Рискання змінює напрям погляду, а не рухає дрон убік.',
      ),
      pitch:
        mode() === 'acro'
          ? t(
              'A short forward input rotates the nose down. Centre to stop requesting rotation: the tilt stays. Opposite input levels you, then a small backward tilt can brake the drift.',
              'Короткий рух уперед обертає ніс униз. Центрування припиняє команду обертання: нахил зберігається. Протилежний рух вирівнює, а малий нахил назад може загальмувати дрейф.',
            )
          : t(
              'Push forward to tip the nose down. Some thrust now points forward, so you accelerate. Pull back gently to slow down.',
              'Штовхніть стік уперед, щоб опустити ніс. Частина тяги тепер спрямована вперед, і дрон прискорюється. Плавно потягніть назад, щоб загальмувати.',
            ),
      roll:
        mode() === 'acro'
          ? t(
              'A short sideways input rotates the bank. Centre and the bank stays; thrust carries you sideways. Counter-roll to level and then brake. Yaw turns the nose instead.',
              'Короткий рух убік змінює крен. Після центрування крен зберігається, а тяга рухає вбік. Протилежним креном вирівняйтеся й загальмуйте. Рискання натомість повертає ніс.',
            )
          : t(
              'Move sideways to bank the drone. It leans and accelerates sideways without needing to turn the nose.',
              'Рухайте стік убік, щоб нахилити дрон. Він нахиляється та прискорюється вбік без повороту носа.',
            ),
    })[axis];
  const activeStep = () =>
    Math.min(Math.max(0, snapshot.state?.step ?? 0), (lesson?.steps.length ?? 1) - 1);
  const currentStep = () => lesson?.steps[stage === 'guide' ? viewedStep : activeStep()];
  const mode = () => snapshot.mode ?? lesson?.mode ?? 'self-level';
  const criterion = (index = activeStep()) => lesson?.course?.steps?.[mode()]?.[index];
  const isExploring = () =>
    stage === 'guide' && ['beginner-01', 'beginner-15'].includes(lesson?.id) && viewedStep === 0;
  const sequence = () => (lesson?.mode === 'acro' ? ACRO_LESSON_ORDER : SELF_LEVEL_LESSON_ORDER);
  const lessonNumber = () => Math.max(0, sequence().indexOf(lesson?.id)) + 1;
  const displayedStep = () => {
    if (!isExploring()) return currentStep();
    return {
      ...currentStep(),
      axis: explored,
      motion: { throttle: 'lift', yaw: 'yaw', pitch: 'pitch', roll: 'roll' }[explored],
      direction: 1,
      target: explored === 'throttle' ? 0.58 : 0.25,
    };
  };
  const controls = () => {
    // The host passes normalized values. Quantized recorded input is a fallback.
    if (snapshot.source === 'radio' && snapshot.monitorAvailable === false)
      return { throttle: 0, yaw: 0, pitch: 0, roll: 0 };
    const value = snapshot.monitor?.controls ?? snapshot.monitor?.input ?? snapshot.monitor;
    return Object.fromEntries(
      AXES.map((axis) => [
        axis,
        clamp(
          Number.isFinite(value?.[axis])
            ? value[axis]
            : (snapshot.state?.lastInput?.[axis] ?? 0) / 1000,
          axis === 'throttle' ? 0 : -1,
          1,
        ),
      ]),
    );
  };
  const labRadioAvailable = () =>
    snapshot.radioAvailable ?? (snapshot.source === 'radio' && snapshot.monitorAvailable !== false);
  const labRadioInput = () => {
    const value = snapshot.radioMonitor ?? (snapshot.source === 'radio' ? snapshot.monitor : null);
    const values = value?.controls ?? value?.input ?? value;
    return Object.fromEntries(
      AXES.map((axis) => [axis, clamp(values?.[axis], axis === 'throttle' ? 0 : -1, 1)]),
    );
  };
  function clearLabInput({ block = true } = {}) {
    if (block) for (const key of labKeys) blockedKeys.add(key);
    labKeys.clear();
    Object.assign(labTouch, neutralFlightInput());
    touchThrottleDirection = 0;
    labInput = neutralFlightInput();
  }
  function pausePreview(reason = 'stopped') {
    labRunning = false;
    labReason = reason;
    labFlight?.pause();
    clearLabInput();
    if (labFrameId !== null) win.cancelAnimationFrame(labFrameId);
    labFrameId = null;
    labLastTime = null;
    labAccumulator = 0;
    paintLab();
  }
  function resetPreview() {
    pausePreview('ready');
    labFlight = createBeginnerPreview(mode());
    paintLab();
  }
  function exampleInput(ticks) {
    const seconds = ticks / FLIGHT_HZ;
    const input = neutralFlightInput();
    input.throttle = seconds < 1.5 ? 0.62 : 0.5;
    const axis = displayedStep()?.axis;
    if (axis === 'throttle')
      input.throttle = seconds < 1.5 ? 0.62 : seconds < 3 ? 0.5 : seconds < 4.5 ? 0.39 : 0.54;
    else if (seconds >= 1.8 && seconds < (mode() === 'acro' ? 2.45 : 3.2)) {
      const selected = ['roll', 'pitch', 'yaw'].includes(axis) ? axis : 'pitch';
      input[selected] =
        (selected === 'yaw' ? 0.11 : mode() === 'acro' ? 0.07 : 0.25) *
        (displayedStep()?.direction ?? 1);
    }
    return input;
  }
  function previewCommand() {
    if (labMode === 'example') return exampleInput(labFlight.snapshot().ticks);
    if (labSource === 'radio') return labRadioInput();
    if (labSource === 'touch') {
      labTouch.throttle = clamp(
        labTouch.throttle + (touchThrottleDirection * 0.35) / FLIGHT_HZ,
        0,
        1,
      );
      return { ...labTouch };
    }
    const fine = labKeys.has('ShiftLeft') || labKeys.has('ShiftRight');
    const gain = fine ? 0.18 : 0.5;
    return {
      throttle: clamp(
        labInput.throttle +
          ((Number(labKeys.has('ArrowUp')) - Number(labKeys.has('ArrowDown'))) *
            (fine ? 0.1 : 0.35)) /
            FLIGHT_HZ,
        0,
        1,
      ),
      roll: (Number(labKeys.has('KeyD')) - Number(labKeys.has('KeyA'))) * gain,
      pitch: (Number(labKeys.has('KeyW')) - Number(labKeys.has('KeyS'))) * gain,
      yaw: (Number(labKeys.has('KeyE')) - Number(labKeys.has('KeyQ'))) * gain,
    };
  }
  function previewFrame(time) {
    labFrameId = null;
    if (!labRunning || stage !== 'guide' || disposed) return;
    if (doc.hidden || (doc.hasFocus && !doc.hasFocus())) {
      pausePreview('focus');
      return;
    }
    if (labMode === 'try' && labSource === 'radio' && !labRadioAvailable()) {
      pausePreview('radio');
      return;
    }
    const elapsed = labLastTime === null ? 0 : time - labLastTime;
    labLastTime = time;
    if (elapsed > 150) {
      pausePreview('stall');
      return;
    }
    labAccumulator += Math.max(0, elapsed);
    while (labAccumulator >= 1000 / FLIGHT_HZ) {
      labAccumulator -= 1000 / FLIGHT_HZ;
      labInput = previewCommand();
      labFlight.step(labInput);
      const state = labFlight.snapshot();
      if (
        state.ticks >= (labMode === 'example' ? 8 : 60) * FLIGHT_HZ ||
        state.contacts > 0 ||
        state.status !== 'active'
      ) {
        pausePreview(state.contacts ? 'boundary' : 'finished');
        break;
      }
    }
    paintLab();
    if (labRunning) labFrameId = win.requestAnimationFrame(previewFrame);
  }
  function playPreview({ focus = true } = {}) {
    if (!lesson || stage !== 'guide' || disposed) return;
    if (!labFlight || labReason === 'finished' || labReason === 'boundary') resetPreview();
    if (labMode === 'try' && labSource === 'radio' && !labRadioAvailable()) {
      pausePreview('radio');
      return;
    }
    labReason = '';
    labRunning = true;
    labFlight.arm();
    labLastTime = null;
    labAccumulator = 0;
    if (labFrameId === null) labFrameId = win.requestAnimationFrame(previewFrame);
    paintLab();
    if (focus) refs.labFocus?.focus({ preventScroll: true });
  }
  function releaseView() {
    for (const release of viewReleases) release();
    viewReleases = [];
    diagram?.dispose();
    diagram = null;
  }
  function bindGimbal(drawing, horizontal, vertical) {
    let pointer = null;
    const move = (event) => {
      if (pointer !== event.pointerId || !labRunning || labMode !== 'try' || labSource !== 'touch')
        return;
      const rect = drawing.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      labTouch[horizontal] = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 3);
      const verticalValue = clamp((0.5 - (event.clientY - rect.top) / rect.height) * 3);
      labTouch[vertical] = vertical === 'throttle' ? (verticalValue + 1) / 2 : verticalValue;
      event.preventDefault();
    };
    const release = () => {
      const previous = pointer;
      pointer = null;
      if (previous !== null) {
        try {
          drawing.releasePointerCapture(previous);
        } catch {
          /* Pointer already released. */
        }
      }
      pointer = null;
      for (const axis of [horizontal, vertical]) if (axis !== 'throttle') labTouch[axis] = 0;
    };
    const down = (event) => {
      if (labMode !== 'try' || labSource !== 'touch' || stage !== 'guide') return;
      if (!labRunning) playPreview();
      pointer = event.pointerId;
      drawing.setPointerCapture(pointer);
      move(event);
    };
    drawing.addEventListener('pointerdown', down);
    drawing.addEventListener('pointermove', move);
    drawing.addEventListener('pointerup', release);
    drawing.addEventListener('pointercancel', release);
    drawing.addEventListener('lostpointercapture', release);
    viewReleases.push(() => {
      release();
      drawing.removeEventListener('pointerdown', down);
      drawing.removeEventListener('pointermove', move);
      drawing.removeEventListener('pointerup', release);
      drawing.removeEventListener('pointercancel', release);
      drawing.removeEventListener('lostpointercapture', release);
    });
  }
  function makeDpad() {
    const pad = node('div', 'coach-lab-dpad');
    pad.setAttribute('role', 'group');
    pad.setAttribute('aria-label', t('Touch control buttons', 'Сенсорні кнопки керування'));
    for (const axis of AXES) {
      const row = node('div', 'coach-dpad-axis');
      row.append(node('strong', '', axisName(axis)));
      for (const direction of [-1, 1]) {
        const control = node('button', 'coach-dpad-button', direction < 0 ? '−' : '+');
        control.type = 'button';
        const directions = {
          throttle: [
            t('Throttle: less thrust', 'Газ: менше тяги'),
            t('Throttle: more thrust', 'Газ: більше тяги'),
          ],
          yaw: [
            t('Yaw: turn nose left', 'Рискання: повернути ніс ліворуч'),
            t('Yaw: turn nose right', 'Рискання: повернути ніс праворуч'),
          ],
          pitch: [
            t('Pitch: nose up', 'Тангаж: ніс угору'),
            t('Pitch: nose down', 'Тангаж: ніс униз'),
          ],
          roll: [t('Roll left', 'Крен ліворуч'), t('Roll right', 'Крен праворуч')],
        };
        control.setAttribute('aria-label', directions[axis][direction < 0 ? 0 : 1]);
        const down = (event) => {
          if (labMode !== 'try' || labSource !== 'touch') return;
          if (event.type === 'keydown' && ![' ', 'Enter'].includes(event.key)) return;
          event.preventDefault();
          if (!labRunning) playPreview({ focus: event.type !== 'keydown' });
          if (event.pointerId !== undefined) control.setPointerCapture(event.pointerId);
          if (axis === 'throttle') {
            touchThrottleDirection = direction;
            labTouch.throttle = clamp(labTouch.throttle + direction * 0.025, 0, 1);
          } else labTouch[axis] = direction * 0.35;
        };
        const up = () => {
          if (axis === 'throttle') touchThrottleDirection = 0;
          else labTouch[axis] = 0;
        };
        for (const name of ['pointerdown', 'keydown']) control.addEventListener(name, down);
        for (const name of ['pointerup', 'pointercancel', 'lostpointercapture', 'keyup', 'blur'])
          control.addEventListener(name, up);
        viewReleases.push(() => {
          up();
          for (const name of ['pointerdown', 'keydown']) control.removeEventListener(name, down);
          for (const name of ['pointerup', 'pointercancel', 'lostpointercapture', 'keyup', 'blur'])
            control.removeEventListener(name, up);
        });
        row.append(control);
      }
      pad.append(row);
    }
    return pad;
  }
  function paintLab() {
    if (stage !== 'guide' || !labFlight) return;
    const state = labFlight.snapshot();
    const input = labRunning ? labInput : neutralFlightInput();
    diagram?.update({
      state,
      detailScale: 1.5,
      controls: input,
      locale: lang(),
      unavailable: labMode === 'try' && labSource === 'radio' && !labRadioAvailable(),
    });
    if (refs.labPlay)
      refs.labPlay.textContent = labRunning
        ? t('Stop preview', 'Зупинити перегляд')
        : labMode === 'example'
          ? t('Play example', 'Показати приклад')
          : t('Resume controls', 'Продовжити керування');
    if (refs.labStatus) {
      const text = labRunning
        ? labMode === 'example'
          ? t(
              'EXAMPLE · real physics · hollow dots are example commands',
              'ПРИКЛАД · справжня фізика · порожні крапки — команди прикладу',
            )
          : t(
              'YOUR CONTROLS · separate preview · real lesson stays paused',
              'ВАШЕ КЕРУВАННЯ · окремий перегляд · урок залишається на паузі',
            )
        : labReason === 'radio'
          ? t(
              'Connect and select a radio/controller in Setup, then resume preview.',
              'Під’єднайте та виберіть пульт у налаштуваннях і продовжте перегляд.',
            )
          : labReason === 'boundary'
            ? t(
                'Preview touched ground or its boundary. Reset to try again.',
                'Перегляд торкнувся землі чи межі. Скиньте його та спробуйте знову.',
              )
            : labReason === 'finished'
              ? t(
                  'Preview finished. Reset or play again; no progress was awarded.',
                  'Перегляд завершено. Скиньте або повторіть; поступ не зараховано.',
                )
              : t(
                  'PREVIEW STOPPED · press Play / Resume to try; the lesson stays paused',
                  'ПЕРЕГЛЯД ЗУПИНЕНО · натисніть показ / продовжити; урок залишається на паузі',
                );
      if (refs.labStatus.textContent !== text) refs.labStatus.textContent = text;
    }
    if (refs.labTelemetry)
      refs.labTelemetry.textContent = `${(state.position.y / 1000).toFixed(1)} ${t('m height', 'м висоти')} · ${(Math.hypot(state.velocity.x, state.velocity.z) / 1000).toFixed(1)} ${t('m/s drift', 'м/с дрейфу')} · ${(Math.max(Math.abs(state.attitude.roll), Math.abs(state.attitude.pitch)) / 100).toFixed(1)}° ${t('tilt', 'нахилу')}`;
    for (const stick of refs.sticks ?? []) {
      const x = input[stick.h],
        y = stick.v === 'throttle' ? input[stick.v] * 2 - 1 : input[stick.v];
      stick.live.style.display = labMode === 'try' ? '' : 'none';
      stick.suggestion.style.display = labMode === 'example' ? '' : 'none';
      stick.live.setAttribute('cx', 90 + x * 60);
      stick.live.setAttribute('cy', 90 - y * 60);
      stick.suggestion.style.transform = `translate(${x * 60}px, ${-y * 60}px)`;
      stick.readout.textContent = `${axisName(stick.h)} ${Math.round(x * 100)}% · ${axisName(stick.v)} ${Math.round(input[stick.v] * 100)}%`;
    }
  }
  function makeStick(side, layout, step) {
    const section = node('section', 'coach-stick'),
      h = layout[side * 2],
      v = layout[side * 2 + 1],
      highlighted = step.axis === h || step.axis === v || step.axis === 'mixed';
    section.dataset.highlight = String(highlighted);
    section.append(
      node('h4', '', side === 0 ? t('Left stick', 'Лівий стік') : t('Right stick', 'Правий стік')),
    );
    const drawing = svg('svg', {
      viewBox: '0 0 180 180',
      role: 'img',
      'aria-label': `${axisName(h)} / ${axisName(v)}`,
    });
    drawing.append(
      svg('circle', { cx: 90, cy: 90, r: 68, class: 'coach-stick-rim' }),
      svg('circle', { cx: 90, cy: 90, r: 34, class: 'coach-stick-grid' }),
      svg('path', { d: 'M22 90H158M90 22V158', class: 'coach-stick-grid' }),
      svg('path', {
        d: 'M84 17L90 10L96 17M163 84L170 90L163 96M96 163L90 170L84 163M17 96L10 90L17 84',
        class: 'coach-stick-arrows',
      }),
    );
    const target = {
      throttle: ['throttle', 'mixed'].includes(step.axis) ? clamp(step.target ?? 0.5, 0, 1) : 0.5,
      yaw: 0,
      pitch: 0,
      roll: 0,
    };
    if (step.axis !== 'throttle' && step.axis !== 'mixed')
      target[step.axis] = clamp((step.target ?? 0.25) * (step.direction ?? 1));
    const targetX = target[h] * 60,
      targetY = -(v === 'throttle' ? target[v] * 2 - 1 : target[v]) * 60;
    const suggestion = svg('g', { class: 'coach-stick-suggestion' });
    suggestion.style.setProperty('--coach-target-x', `${targetX}px`);
    suggestion.style.setProperty('--coach-target-y', `${targetY}px`);
    suggestion.append(svg('circle', { cx: 90, cy: 90, r: 11, class: 'coach-target-dot' }));
    const live = svg('circle', { cx: 90, cy: 90, r: 6, class: 'coach-live-dot' });
    suggestion.style.animation = 'none';
    drawing.classList.add('coach-stick-pad');
    bindGimbal(drawing, h, v);
    drawing.append(suggestion, live);
    const labels = node('div', 'coach-stick-axes');
    for (const axis of [v, h]) {
      const label = node('p', axis === step.axis ? 'is-focus' : '');
      label.append(node('strong', '', axisName(axis)), node('span', '', directionName(axis)));
      labels.append(label);
    }
    const readout = node('output', 'coach-stick-readout');
    readout.setAttribute('aria-live', 'off');
    const directions = {
      throttle: [t('More thrust', 'Більше тяги'), t('Less thrust', 'Менше тяги')],
      yaw: [t('Nose right', 'Ніс праворуч'), t('Nose left', 'Ніс ліворуч')],
      pitch: [t('Nose down', 'Ніс униз'), t('Nose up', 'Ніс угору')],
      roll: [t('Right side down', 'Правий бік униз'), t('Left side down', 'Лівий бік униз')],
    };
    const gimbal = node('div', 'coach-gimbal-wrap');
    gimbal.append(
      node('span', 'coach-direction-up', directions[v][0]),
      node('span', 'coach-direction-down', directions[v][1]),
      node('span', 'coach-direction-left', directions[h][1]),
      node('span', 'coach-direction-right', directions[h][0]),
      drawing,
    );
    section.append(gimbal, labels, readout);
    refs.sticks.push({ live, suggestion, readout, h, v });
    return section;
  }
  function makeDrone() {
    const figure = node('figure', 'coach-drone-figure');
    const drawing = node('div', 'coach-lab-drawing');
    drawing.setAttribute('role', 'img');
    drawing.setAttribute(
      'aria-label',
      t(
        'Drone seen from behind, nose facing away. Amber front and thrust; cyan actual movement.',
        'Дрон ззаду, ніс спрямований від вас. Жовте — перед і тяга; блакитне — фактичний рух.',
      ),
    );
    drawing.tabIndex = 0;
    refs.labFocus = drawing;
    diagram = mountDroneDiagram({ root: drawing });
    refs.labTelemetry = node('p', 'coach-lab-telemetry');
    figure.append(
      drawing,
      refs.labTelemetry,
      node(
        'figcaption',
        '',
        t(
          'Separate controls preview · your lesson stays paused · no score or lesson progress',
          'Окремий перегляд керування · урок залишається на паузі · без балів і поступу уроку',
        ),
      ),
    );
    return figure;
  }
  function objectiveText(target) {
    if (!target)
      return t(
        'Follow the highlighted objective in the world.',
        'Виконайте підсвічену ціль у світі.',
      );
    if (target.type === 'gate')
      return t(
        `Fly through the opening at ${(target.minY / 1000).toFixed(1)}–${(target.maxY / 1000).toFixed(1)} m.`,
        `Пролетіть крізь отвір на висоті ${(target.minY / 1000).toFixed(1)}–${(target.maxY / 1000).toFixed(1)} м.`,
      );
    const height = `${(target.min.y / 1000).toFixed(1)}–${(target.max.y / 1000).toFixed(1)}`;
    const seconds = ((target.ticks ?? 0) / 50).toFixed(1);
    return target.type === 'land'
      ? t(
          `Land inside the marked pad. Hold steady for ${seconds} s.`,
          `Сядьте в межах позначеного майданчика. Утримуйте положення ${seconds} с.`,
        )
      : t(
          `Stay in the highlighted zone at ${height} m for ${seconds} s.`,
          `Залишайтеся в підсвіченій зоні на висоті ${height} м протягом ${seconds} с.`,
        );
  }
  function hint() {
    const state = snapshot.state,
      step = currentStep(),
      target = criterion();
    if (snapshot.source === 'radio' && snapshot.monitorAvailable === false)
      return t(
        'Radio signal unavailable. Reconnect or open Radio setup; the cyan dots are neutral until the selected radio returns.',
        'Сигнал пульта недоступний. Підключіть його знову або відкрийте налаштування; блакитні крапки нейтральні до відновлення сигналу.',
      );
    if (replay)
      return t(
        'Watch the solid dots: these are the recorded controls. Your sticks do not change playback.',
        'Стежте за суцільними крапками: це записане керування. Ваші стіки не змінюють відтворення.',
      );
    if (stage === 'guide')
      return t(
        'Flight is paused. Read, explore the controls, then start when you are ready.',
        'Політ на паузі. Перегляньте пояснення й керування та починайте, коли будете готові.',
      );
    if (!state || ['paused', 'ready', 'disarmed'].includes(state.status))
      return t(
        'Ready? Lower throttle, centre the other axes, then Arm / resume. A radio may also need its arm switch OFF → ON.',
        'Готові? Опустіть газ, центруйте інші осі й натисніть «Увімкнути / продовжити». Пульт також може потребувати перемикання ВИМК → УВІМК.',
      );
    if (state.status === 'complete')
      return t(
        'Nice flying. Your recording is being checked before this lesson is recorded as complete.',
        'Гарний політ. Запис перевіряється, перш ніж урок буде зараховано.',
      );
    if (['crashed', 'failed', 'timeout', 'expired'].includes(state.status))
      return t(
        'Every pilot retries. Open the guide, then try the small movement again.',
        'Кожен пілот пробує знову. Відкрийте пояснення й повторіть невеликий рух.',
      );
    if (state.hold > 0)
      return t(
        'You are in the right place. Keep it gentle while the ring fills.',
        'Ви в потрібному місці. Рухайте стіки плавно, поки заповнюється індикатор.',
      );
    if (target?.max && state.position?.y > target.max.y + 200)
      return t(
        'A little high. Ease throttle down, then restore it near hover before you descend too far.',
        'Трохи зависоко. Зменште газ, а до потрібної висоти поверніть його до рівня зависання.',
      );
    if (target?.min && state.position?.y < target.min.y - 200)
      return t(
        'A little low. Add a small amount of throttle; ease it back as you approach the target height.',
        'Трохи занизько. Плавно додайте газ і зменште його, наближаючись до потрібної висоти.',
      );
    const speed = Math.hypot(state.velocity?.x ?? 0, state.velocity?.z ?? 0);
    if (target?.maxSpeed && speed > target.maxSpeed)
      return t(
        'Still moving? Centre is not a brake. Gently tilt against your travel, then level out as you slow.',
        'Дрон ще рухається? Центр стіка не гальмує. Плавно нахиліть дрон проти руху й вирівняйте, коли сповільнитеся.',
      );
    if (
      mode() === 'acro' &&
      Math.max(Math.abs(state.attitude?.roll ?? 0), Math.abs(state.attitude?.pitch ?? 0)) > 1600
    )
      return t(
        'In Acro, centred sticks keep the tilt. Briefly move the opposite way to return to level.',
        'В Acro центральне положення стіків зберігає нахил. Коротко рухайте стік у протилежний бік, щоб вирівнятися.',
      );
    return copy(step?.tip) || copy(step?.instruction);
  }
  function makeTelemetry() {
    const strip = node('div', 'coach-telemetry');
    refs.telemetry = [];
    for (const [key, label] of [
      ['height', t('Height', 'Висота')],
      ['speed', t('Speed', 'Швидкість')],
      ['tilt', t('Tilt', 'Нахил')],
      ['throttle', axisName('throttle')],
    ]) {
      const item = node('div', ''),
        value = node('strong', '', '—');
      item.append(node('span', '', label), value);
      strip.append(item);
      refs.telemetry.push({ key, value });
    }
    return strip;
  }
  function render() {
    if (!lesson || stage === 'closed' || disposed) return;
    const focusLab = refs.labFocus === doc.activeElement;
    const focusAction = root.contains(doc.activeElement)
      ? doc.activeElement?.dataset.coachAction
      : null;
    releaseView();
    refs = { sticks: [] };
    root.replaceChildren();
    root.hidden = false;
    root.classList.add('beginner-coach');
    root.dataset.stage = stage;
    root.dataset.reducedMotion = String(Boolean(snapshot.reducedMotion));
    root.setAttribute('aria-label', t('Your flight coach', 'Ваш інструктор польоту'));
    const step = displayedStep(),
      index = stage === 'guide' ? viewedStep : activeStep();
    const card = node('section', 'coach-card');
    let notes = null;
    const startLabel = () =>
      replay
        ? t('Continue playback', 'Продовжити перегляд')
        : activeStep() > 0 || (snapshot.state?.ticks ?? 0) > 0
          ? t('Back to practice →', 'До практики →')
          : t('Let’s fly →', 'Почнімо політ →');
    const heading = node('header', 'coach-heading'),
      eyebrow = node(
        'p',
        'coach-eyebrow',
        t(
          `${lesson.mode === 'acro' ? 'ACRO SCHOOL' : 'SELF-LEVEL PRACTICE'} · ${String(lessonNumber()).padStart(2, '0')} / ${sequence().length}`,
          `${lesson.mode === 'acro' ? 'ШКОЛА ACRO' : 'САМОВИРІВНЮВАННЯ'} · ${String(lessonNumber()).padStart(2, '0')} / ${sequence().length}`,
        ),
      );
    const headingText = node('div', '');
    headingText.append(
      eyebrow,
      node(
        stage === 'guide' ? 'h2' : 'h3',
        '',
        stage === 'guide' ? copy(lesson.title) : copy(step?.title),
      ),
    );
    heading.append(headingText);
    if (stage === 'live')
      heading.append(button('guide', t('Explain', 'Пояснення'), 'coach-explain'));
    if (stage === 'guide') {
      const close = button('exit', '×', 'coach-exit');
      close.setAttribute('aria-label', t('Back to school', 'До школи'));
      close.title = t('Back to school', 'До школи');
      heading.append(
        button('fullscreen', t('Fullscreen', 'Повний екран')),
        button('start', startLabel(), 'primary coach-start'),
        close,
      );
    }
    card.append(heading);
    if (stage === 'complete') {
      card.append(
        node(
          'p',
          'coach-success',
          t('✓ Lesson complete · recording verified', '✓ Урок завершено · запис перевірено'),
        ),
        node('p', '', copy(lesson.concept)),
      );
      const actions = node('div', 'coach-actions');
      if (nextAvailable)
        actions.append(button('next', t('Next lesson →', 'Наступний урок →'), 'primary'));
      actions.append(
        button('retry', t('Fly it again', 'Пролетіти ще раз')),
        button('exit', t('Back to school', 'До школи')),
      );
      card.append(actions);
      root.append(card);
      return;
    }
    const progress = node('div', 'coach-progress');
    progress.setAttribute('aria-label', t('Lesson steps', 'Кроки уроку'));
    for (const [i, entry] of lesson.steps.entries()) {
      const item =
        stage === 'guide' ? button(`step-${i}`, String(i + 1)) : node('span', '', String(i + 1));
      item.className = 'coach-step-dot';
      item.dataset.state = i < activeStep() ? 'done' : i === index ? 'current' : 'later';
      if (i === index) item.setAttribute('aria-current', 'step');
      item.setAttribute('aria-label', `${i + 1}. ${copy(entry.title)}`);
      if (stage === 'guide') item.title = copy(entry.title);
      progress.append(item);
    }
    card.append(progress);
    if (stage === 'guide') {
      notes = node('details', 'coach-notes');
      notes.append(
        node(
          'summary',
          '',
          t('Lesson notes & keyboard controls', 'Нотатки до уроку та клавіатура'),
        ),
      );
      notes.append(
        node('p', 'coach-summary', copy(lesson.summary)),
        node(
          'p',
          'coach-pause-note',
          t(
            'Explore in a separate preview. The real lesson stays paused until you start practice.',
            'Досліджуйте в окремому перегляді. Справжній урок залишається на паузі до початку практики.',
          ),
        ),
      );
      const lessonStep = node('section', 'coach-step-copy');
      lessonStep.append(
        node(
          'p',
          'coach-step-label',
          t(
            `STEP ${index + 1} OF ${lesson.steps.length}`,
            `КРОК ${index + 1} ІЗ ${lesson.steps.length}`,
          ),
        ),
        node('h3', '', copy(step?.title)),
        node('p', 'coach-instruction', copy(step?.instruction)),
      );
      card.append(lessonStep);
      if (isExploring()) {
        const picker = node('div', 'coach-axis-picker');
        picker.setAttribute('role', 'group');
        picker.setAttribute(
          'aria-label',
          t('Explore a control with motors off', 'Дослідіть керування з вимкненими моторами'),
        );
        for (const axis of AXES) {
          const choice = button(`axis-${axis}`, axisName(axis));
          choice.setAttribute('aria-pressed', String(explored === axis));
          picker.append(choice);
        }
        card.append(picker);
      }
      const labModes = node('div', 'coach-lab-mode');
      labModes.setAttribute('role', 'group');
      labModes.setAttribute('aria-label', t('Controls lab mode', 'Режим майданчика керування'));
      for (const [value, en, uk] of [
        ['example', 'Example', 'Приклад'],
        ['try', 'Try controls', 'Спробувати керування'],
      ]) {
        const choice = button(`lab-${value}`, t(en, uk));
        choice.setAttribute('aria-pressed', String(labMode === value));
        labModes.append(choice);
      }
      card.append(labModes);
      const sources = node('div', 'coach-lab-sources');
      sources.setAttribute('role', 'group');
      sources.setAttribute('aria-label', t('Preview controls', 'Керування переглядом'));
      for (const [value, en, uk] of [
        ['keyboard', 'Keyboard', 'Клавіатура'],
        ['touch', 'Touch / D-pad', 'Дотик / кнопки'],
        ['radio', 'Radio / controller', 'Пульт / контролер'],
      ]) {
        const choice = button(`source-${value}`, t(en, uk));
        choice.setAttribute('aria-pressed', String(labSource === value));
        choice.disabled = labMode !== 'try';
        sources.append(choice);
      }
      card.append(sources);
      const visuals = node('div', 'coach-visuals'),
        controller = node('section', 'coach-controller coach-radio-chassis');
      const requestedMode =
        labSource === 'radio'
          ? (snapshot.radioStickMode ?? snapshot.stickMode)
          : snapshot.stickMode;
      const stickMode = STICK_LAYOUTS[requestedMode] ? requestedMode : 2;
      controller.append(
        node(
          'div',
          'coach-radio-top',
          t('CONTROL LAB · PREVIEW ONLY', 'КЕРУВАННЯ · ЛИШЕ ПЕРЕГЛЯД'),
        ),
      );
      controller.append(
        node(
          'h3',
          '',
          t(`YOUR CONTROLS · MODE ${stickMode}`, `ВАШЕ КЕРУВАННЯ · MODE ${stickMode}`),
        ),
      );
      refs.signal = node('p', 'coach-example-note');
      notes.append(refs.signal);
      const sticks = node('div', 'coach-sticks');
      for (const side of [0, 1]) sticks.append(makeStick(side, STICK_LAYOUTS[stickMode], step));
      controller.append(sticks);
      const legend = node('p', 'coach-dot-legend');
      legend.append(
        node('span', 'coach-legend-live', t('Your preview input', 'Ваш сигнал перегляду')),
        node('span', 'coach-legend-example', t('Example movement', 'Приклад руху')),
      );
      controller.append(
        legend,
        node(
          'p',
          'coach-example-note',
          t(
            'Example uses hollow dots. Try controls uses solid dots and the same flight physics. The real lesson stays paused.',
            'Приклад показує порожні крапки. Ваше керування — суцільні крапки й ту саму фізику. Справжній урок залишається на паузі.',
          ),
        ),
      );
      if (labMode === 'try' && labSource === 'touch') controller.append(makeDpad());
      visuals.append(controller);
      const behavior = node('section', 'coach-behavior');
      behavior.append(
        node('h3', '', t('WHAT THE DRONE DOES', 'ЩО РОБИТЬ ДРОН')),
        makeDrone(step),
        node(
          'p',
          '',
          isExploring() ? axisExplanation(explored) : copy(step?.why) || copy(lesson.concept),
        ),
      );
      visuals.append(behavior);
      card.append(visuals);
      const labActions = node('div', 'coach-lab-actions');
      refs.labPlay = button('lab-play', '');
      labActions.append(refs.labPlay, button('lab-reset', t('Reset preview', 'Скинути перегляд')));
      refs.labStatus = node('p', 'coach-lab-status');
      refs.labStatus.setAttribute('role', 'status');
      refs.labStatus.setAttribute('aria-live', 'polite');
      card.append(
        labActions,
        refs.labStatus,
        node(
          'p',
          'coach-lab-help',
          t(
            'Try controls: focus the drone, then use W/S, A/D, Q/E and ↑/↓. Shift is gentle; throttle stays set. Escape stops the preview. Touch: drag the gimbals or hold the buttons.',
            'Ваше керування: виберіть схему дрона, потім W/S, A/D, Q/E та ↑/↓. Shift — плавно; газ зберігається. Escape зупиняє перегляд. Дотик: рухайте стіки або утримуйте кнопки.',
          ),
        ),
      );
      const keys = node('p', 'coach-keys');
      keys.append(node('strong', '', t('Keyboard: ', 'Клавіатура: ')));
      for (const [key, axis] of [
        ['↑ / ↓', 'throttle'],
        ['Q / E', 'yaw'],
        ['W / S', 'pitch'],
        ['A / D', 'roll'],
      ])
        keys.append(node('kbd', '', key), node('span', '', axisName(axis)));
      keys.append(
        node(
          'small',
          '',
          t(
            'Hold Shift for finer movements. Throttle stays where you set it.',
            'Утримуйте Shift для точніших рухів. Газ залишається у встановленому положенні.',
          ),
        ),
      );
      notes.append(keys);
      const tip = node('aside', 'coach-tip');
      tip.append(
        node('strong', '', t('Pilot’s tip', 'Порада пілота')),
        node('p', '', copy(step?.tip)),
      );
      notes.append(tip);
    } else card.append(node('p', 'coach-instruction', copy(step?.instruction)));
    const target = node('p', 'coach-target', objectiveText(criterion(index)));
    refs.hint = node('p', 'coach-live-hint');
    refs.hint.setAttribute('role', 'status');
    refs.hint.setAttribute('aria-live', 'polite');
    const hold = node('div', 'coach-hold');
    refs.hold = node('div', 'coach-hold-fill');
    hold.append(refs.hold);
    hold.setAttribute('aria-hidden', 'true');
    (notes ?? card).append(target, makeTelemetry(), hold, refs.hint);
    if (notes) card.append(notes);
    if (stage === 'guide') {
      const actions = node('div', 'coach-actions');
      actions.append(
        button('start', startLabel(), 'primary'),
        button('radio', t('Set up radio', 'Налаштувати пульт')),
        button('exit', t('Back to school', 'До школи')),
      );
      card.append(
        actions,
        node(
          'p',
          'coach-pause-note',
          t(
            'Flight stays paused while this guide is open. The real arm and throttle checks still apply.',
            'Поки пояснення відкрито, політ залишається на паузі. Звичайні перевірки газу та увімкнення діють.',
          ),
        ),
      );
    }
    root.append(card);
    if (focusAction)
      root.querySelector(`[data-coach-action="${focusAction}"]`)?.focus({ preventScroll: true });
    if (focusLab && labRunning) refs.labFocus?.focus({ preventScroll: true });
    paint();
  }
  function paint() {
    if (!lesson || !refs.sticks) return;
    const input = stage === 'guide' ? labInput : controls();
    if (stage === 'guide') paintLab();
    if (refs.signal)
      refs.signal.textContent =
        labMode === 'try' && labSource === 'radio'
          ? labRadioAvailable()
            ? t(
                'Calibrated radio/controller signal drives only this preview. Arm switches cannot start the real lesson here.',
                'Калібрований сигнал пульта керує лише переглядом. Перемикач увімкнення не запускає справжній урок тут.',
              )
            : t(
                'No selected radio/controller signal. Use Setup, then resume the preview.',
                'Немає сигналу вибраного пульта. Відкрийте налаштування та продовжте перегляд.',
              )
          : t(
              'Choose Try controls to use keyboard, touch or a controller. Preview results never count toward the lesson.',
              'Виберіть «Спробувати керування» для клавіатури, дотику чи пульта. Результати перегляду не зараховуються до уроку.',
            );
    for (const stick of stage === 'guide' ? [] : refs.sticks) {
      const x = input[stick.h],
        y = stick.v === 'throttle' ? input[stick.v] * 2 - 1 : input[stick.v];
      stick.live.setAttribute('cx', 90 + x * 60);
      stick.live.setAttribute('cy', 90 - y * 60);
      stick.readout.textContent = `${axisName(stick.h)} ${Math.round(x * 100)}% · ${axisName(stick.v)} ${Math.round(input[stick.v] * 100)}%`;
    }
    const state = snapshot.state,
      at = state?.attitude;
    const values = {
      height: `${((state?.position?.y ?? 0) / 1000).toFixed(1)} ${t('m', 'м')}`,
      speed: `${(Math.hypot(state?.velocity?.x ?? 0, state?.velocity?.y ?? 0, state?.velocity?.z ?? 0) / 1000).toFixed(1)} ${t('m/s', 'м/с')}`,
      tilt: `${(Math.max(Math.abs(at?.roll ?? 0), Math.abs(at?.pitch ?? 0)) / 100).toFixed(0)}°`,
      throttle: `${Math.round(input.throttle * 100)}%`,
    };
    for (const item of refs.telemetry ?? []) item.value.textContent = values[item.key];
    if (refs.hint) {
      const text = hint();
      if (refs.hint.textContent !== text) refs.hint.textContent = text;
    }
    if (refs.hold)
      refs.hold.style.width = `${clamp((state?.hold ?? 0) / (criterion()?.ticks || 1), 0, 1) * 100}%`;
  }
  function showGuide() {
    if (!lesson || disposed || stage === 'complete') return;
    onPause();
    stage = 'guide';
    labMode = 'example';
    resetPreview();
    viewedStep = activeStep();
    render();
    root.querySelector('[data-coach-action="start"]')?.focus({ preventScroll: true });
  }
  function click(event) {
    const action = event.target.closest?.('[data-coach-action]')?.dataset.coachAction;
    if (!action || !lesson || disposed) return;
    if (action === 'start') {
      pausePreview();
      stage = 'live';
      render();
      onStart();
    } else if (action === 'lab-example' || action === 'lab-try') {
      labMode = action === 'lab-try' ? 'try' : 'example';
      resetPreview();
      render();
      playPreview();
    } else if (action === 'lab-play') {
      if (labRunning) pausePreview();
      else playPreview();
    } else if (action === 'lab-reset') {
      resetPreview();
      paint();
    } else if (
      action.startsWith('source-') &&
      ['keyboard', 'touch', 'radio'].includes(action.slice(7))
    ) {
      labSource = action.slice(7);
      resetPreview();
      render();
      playPreview();
    } else if (action === 'fullscreen') {
      pausePreview();
      onFullscreen();
    } else if (action === 'guide') showGuide();
    else if (action === 'radio') {
      pausePreview();
      onPause();
      onRadio();
    } else if (action === 'retry') onRetry();
    else if (action === 'next') onNext();
    else if (action === 'exit') {
      pausePreview();
      onPause();
      onExit();
    } else if (action.startsWith('axis-') && AXES.includes(action.slice(5))) {
      explored = action.slice(5);
      resetPreview();
      render();
      if (labMode === 'example') playPreview();
    } else if (action.startsWith('step-')) {
      viewedStep = clamp(Number(action.slice(5)), 0, lesson.steps.length - 1);
      resetPreview();
      render();
    }
  }
  const keyDown = (event) => {
    if (blockedKeys.has(event.code)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (!labRunning || stage !== 'guide' || disposed || !root.contains(event.target)) return;
    if (event.code === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      pausePreview();
      return;
    }
    if (
      labMode !== 'try' ||
      labSource !== 'keyboard' ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.isComposing ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) ||
      event.target?.isContentEditable
    )
      return;
    if (!movementKeys.has(event.code)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    labKeys.add(event.code);
  };
  const keyUp = (event) => {
    labKeys.delete(event.code);
    blockedKeys.delete(event.code);
  };
  const loseFocus = () => {
    pausePreview('focus');
    blockedKeys.clear();
  };
  const visibility = () => {
    if (doc.hidden) loseFocus();
  };
  const leaveLab = (event) => {
    if (
      stage === 'guide' &&
      labRunning &&
      event.relatedTarget &&
      !root.contains(event.relatedTarget)
    )
      pausePreview('focus');
  };
  win.addEventListener('keydown', keyDown, true);
  win.addEventListener('keyup', keyUp, true);
  win.addEventListener('blur', loseFocus);
  doc.addEventListener('visibilitychange', visibility);
  root.addEventListener('focusout', leaveLab);
  root.addEventListener('click', click);
  root.hidden = true;
  return {
    open(value, options = {}) {
      if (disposed) return;
      pausePreview();
      lesson = value;
      snapshot = {};
      labMode = 'example';
      labSource = 'keyboard';
      resetPreview();
      replay = Boolean(options.replay);
      explored = 'throttle';
      viewedStep = 0;
      lastRender = '';
      lastPaint = 0;
      stage = options.practice || replay ? 'live' : 'guide';
      if (stage === 'guide') onPause();
      render();
    },
    update(value) {
      if (!lesson || disposed || stage === 'closed') return;
      const previousMode = mode();
      snapshot = { ...snapshot, ...value };
      if (mode() !== previousMode) resetPreview();
      if (labRunning && labMode === 'try' && labSource === 'radio' && !labRadioAvailable())
        pausePreview('radio');
      const key = `${lang()}|${activeStep()}|${snapshot.stickMode}|${snapshot.radioStickMode}|${snapshot.radioAvailable}|${snapshot.source}|${snapshot.monitorAvailable}|${snapshot.mode}|${Boolean(snapshot.reducedMotion)}`;
      if (key !== lastRender) {
        lastRender = key;
        render();
      }
      const now = win.performance?.now?.() ?? Date.now();
      if (now - lastPaint >= 80) {
        lastPaint = now;
        paint();
      }
    },
    blocksArm: () => Boolean(lesson && stage === 'guide'),
    pausePreview,
    previewSource: () => (stage === 'guide' && labMode === 'try' ? labSource : null),
    previewSnapshot: () => ({
      mode: labMode,
      source: labSource,
      running: labRunning,
      state: labFlight?.snapshot() ?? null,
      controls: { ...labInput },
    }),
    showGuide,
    complete({ verified, nextAvailable: hasNext = false } = {}) {
      if (!lesson || disposed || !verified) return;
      pausePreview();
      nextAvailable = hasNext;
      stage = 'complete';
      render();
    },
    close() {
      pausePreview();
      releaseView();
      stage = 'closed';
      lesson = null;
      refs = {};
      root.replaceChildren();
      root.hidden = true;
    },
    dispose() {
      pausePreview();
      releaseView();
      disposed = true;
      win.removeEventListener('keydown', keyDown, true);
      win.removeEventListener('keyup', keyUp, true);
      win.removeEventListener('blur', loseFocus);
      doc.removeEventListener('visibilitychange', visibility);
      root.removeEventListener('focusout', leaveLab);
      root.removeEventListener('click', click);
      root.replaceChildren();
      root.hidden = true;
      lesson = null;
      refs = {};
    },
  };
}
