import { STICK_LAYOUTS, DEFAULT_RESPONSE, neutralFlightInput } from './radio-profile.mjs';
import { createFlight, FLIGHT_HZ } from './model.mjs';
import { createFlightGamepad } from './input.mjs';
import { mountDroneDiagram, mountStickTrace, practiceSkillFeedback } from './sim-presentation.mjs';
import {
  ACRO_LESSON_ORDER,
  EXPERIENCED_LESSON_ORDER,
  ADVANCED_LESSON_ORDER,
  PRO_LESSON_ORDER,
  MASTER_LESSON_ORDER,
  PRIMARY_LESSON_ORDER,
  SELF_LEVEL_LESSON_ORDER,
} from './world-catalogue.mjs';

const SVG_NS = 'http://www.w3.org/2000/svg';
const AXES = ['throttle', 'yaw', 'pitch', 'roll'];
const clamp = (n, a = -1, b = 1) => Math.max(a, Math.min(b, Number.isFinite(n) ? n : 0));
const EXAMPLE_PACE = 0.2;
const EXAMPLE_TICKS = 150;

/** Full travel is the real command, shown at one-fifth speed, never enlarged UI input. */
export function beginnerExampleCommand(ticks, axis = 'throttle') {
  const input = neutralFlightInput();
  input.throttle = ticks < 25 ? 1 : 0.5;
  if (axis === 'throttle') input.throttle = ticks < 25 ? 1 : ticks >= 50 && ticks < 82 ? 0 : 0.5;
  else {
    const selected = ['roll', 'pitch', 'yaw'].includes(axis) ? axis : 'pitch';
    if ((ticks >= 25 && ticks < 35) || (ticks >= 115 && ticks < 125)) input[selected] = 1;
    if ((ticks >= 55 && ticks < 65) || (ticks >= 85 && ticks < 95)) input[selected] = -1;
  }
  return input;
}

/** A command-driven control-technique example, not a route replay or scored proof.
 * Run warmup through the same flight before tick 0; never assign its attitude.
 * Commands use the lab's Gentle response and consume the actual simulation state. */
export function beginnerStepExample(
  step,
  { mode = 'acro', objective, previousStep, previousObjective } = {},
) {
  const limit = (n, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, n));
  const sign = step.direction < 0 ? -1 : 1;
  const motion = step.motion;
  const axis = ['roll', 'pitch', 'yaw'].includes(step.axis) ? step.axis : 'pitch';
  const ground = objective?.type === 'hold' && objective.max?.y <= 800 && objective.centred;
  const centredTilt = objective?.minTilt > 0 && objective.centred;
  const techniqueTilt = centredTilt ? (objective.minTilt + objective.maxTilt) / 200 : 8;
  const levelOnly = motion === 'acro' && sign < 0 && objective?.centred && !centredTilt;
  const descending =
    objective?.type !== 'land' &&
    ((step.axis === 'throttle' && sign < 0) || (motion === 'lift' && sign < 0));
  const kind = ground
    ? 'ground'
    : objective?.type === 'land'
      ? 'land'
      : descending
        ? 'descend'
        : ['throttle', 'mixed'].includes(step.axis) && motion === 'lift'
          ? 'lift'
          : centredTilt
            ? 'tilt-release'
            : levelOnly
              ? 'level'
              : motion === 'brake' || (motion === 'hover' && step.axis === 'mixed')
                ? 'brake'
                : motion === 'turn'
                  ? 'turn'
                  : step.axis === 'yaw'
                    ? 'yaw'
                    : motion === 'hover' && step.axis === 'throttle'
                      ? 'hover'
                      : 'travel';
  const initialHeading =
    typeof previousObjective?.heading === 'number'
      ? previousObjective.heading / 100
      : previousObjective?.type === 'gate'
        ? previousObjective.axis === 'x'
          ? previousObjective.direction * 90
          : previousObjective.direction < 0
            ? 0
            : 180
        : 0;
  const targetHeading =
    typeof objective?.heading === 'number' ? objective.heading / 100 : initialHeading + sign * 65;
  const desiredHeight =
    objective?.min && objective?.max
      ? (objective.min.y + objective.max.y) / 2
      : objective?.type === 'gate'
        ? motion === 'lift'
          ? objective.maxY - 2000
          : (objective.minY + objective.maxY) / 2
        : 3000;
  const height = Math.max(1400, desiredHeight);
  const spawnHeight =
    kind === 'ground' || (kind === 'lift' && (!previousStep || previousStep.target === 0))
      ? 0
      : kind === 'lift'
        ? Math.max(1000, height - 2000)
        : kind === 'descend'
          ? height + 1800
          : kind === 'land'
            ? 3000
            : height;
  const neutral = (throttle = 0.5) => ({ roll: 0, pitch: 0, yaw: 0, throttle });
  const warmup = [];
  // Setup is physical: a small input creates the tilt/drift the next step corrects.
  if (kind === 'level' || kind === 'brake') {
    const driftAxis =
      step.axis === 'mixed'
        ? ['roll', 'pitch'].includes(previousStep?.axis)
          ? previousStep.axis
          : 'pitch'
        : axis;
    const initialSign = step.axis === 'mixed' ? 1 : -sign;
    for (let tick = 0; tick < 70; tick++) {
      const input = neutral(0.515);
      input[driftAxis] = tick < 30 ? initialSign * (mode === 'acro' ? 0.12 : 0.42) : 0;
      warmup.push(input);
    }
  }
  // Invert the Gentle expo curve, rather than changing the integrator or display.
  const unshape = (value) => {
    const s = Math.sign(value);
    const magnitude = Math.abs(limit(value));
    let lo = 0,
      hi = 1;
    for (let i = 0; i < 14; i++) {
      const n = (lo + hi) / 2;
      if (0.7 * n + 0.3 * n * n * n < magnitude) lo = n;
      else hi = n;
    }
    return (s * (lo + hi)) / 2;
  };
  const tiltCommand = (target, key, state) => {
    if (mode === 'self-level') return unshape(target / 30);
    const angle = (state.attitude?.[key] ?? 0) / 100;
    const rate = (state.angular?.[key] ?? 0) / 100;
    return unshape(limit((target - angle) * 3 - rate * 0.45, -45, 45) / 240);
  };
  const yawCommand = (target, state) => {
    const angle = (state.attitude?.yaw ?? 0) / 100;
    const delta = ((target - angle + 540) % 360) - 180;
    return unshape(limit(delta * 2.2 - ((state.angular?.yaw ?? 0) / 100) * 0.45, -36, 36) / 240);
  };
  const throttleFor = (target, state, landing = false) => {
    const y = state.position?.y ?? 0;
    if (landing && y < 35) return 0;
    const velocity = state.velocity?.y ?? 0;
    const desiredVelocity = landing
      ? -(y < 650 ? 450 : 950)
      : limit((target - y) * 1.4, -1000, 1500);
    const acceleration = limit((desiredVelocity - velocity) * 2.8, -4000, 5000);
    const up = Math.max(0.65, (state.attitude?.up?.y ?? 1000000) / 1000000);
    return limit((9810 + acceleration) / (19620 * up), 0, 0.82);
  };
  const localVelocity = (state) => {
    const yaw = ((state.attitude?.yaw ?? 0) * Math.PI) / 18000;
    const vx = state.velocity?.x ?? 0;
    const vz = state.velocity?.z ?? 0;
    return {
      pitch: (vx * Math.sin(yaw) - vz * Math.cos(yaw)) / 1000,
      roll: (vx * Math.cos(yaw) + vz * Math.sin(yaw)) / 1000,
    };
  };
  const ticks = {
    ground: 150,
    lift: 300,
    descend: 300,
    land: 400,
    hover: 220,
    'tilt-release': 180,
    level: 220,
    brake: 280,
    yaw: 280,
    turn: 360,
    travel: 320,
  }[kind];
  const phases = {
    ground: [['Keep throttle down; centre the controls', 'Газ унизу; решта осей по центру']],
    lift: [
      ['Add thrust and climb gently', 'Додайте тягу й плавно підніміться'],
      ['Ease thrust and settle at height', 'Зменште тягу й утримайте висоту'],
    ],
    descend: [
      ['Reduce thrust to descend', 'Зменште тягу для спуску'],
      ['Restore thrust to catch the descent', 'Відновіть тягу, щоб припинити спуск'],
    ],
    land: [
      ['Descend level at a calm speed', 'Спускайтеся рівно й повільно'],
      ['Touch down, then lower throttle', 'Торкніться землі, потім приберіть газ'],
    ],
    hover: [['Keep level; make small height corrections', 'Тримайте рівно; малі поправки висоти']],
    'tilt-release': [
      ['Set a small tilt', 'Задайте малий нахил'],
      ['Centre: Acro retains the tilt', 'По центру: Acro зберігає нахил'],
    ],
    level: [
      ['Counter the existing tilt', 'Протидійте початковому нахилу'],
      ['Centre near level', 'Центруйте біля горизонту'],
    ],
    brake: [
      ['Lean against the existing drift', 'Нахиліться проти початкового дрейфу'],
      ['Level as the motion slows', 'Вирівнюйтеся, коли рух сповільнюється'],
    ],
    yaw: [
      [
        sign < 0 ? 'Yaw left; keep roll and pitch calm' : 'Yaw right; keep roll and pitch calm',
        sign < 0
          ? 'Рискання ліворуч; крен і тангаж спокійні'
          : 'Рискання праворуч; крен і тангаж спокійні',
      ],
      ['Centre near the new heading', 'Центруйте біля нового курсу'],
    ],
    turn: [
      [
        sign < 0 ? 'Bank and yaw left together' : 'Bank and yaw right together',
        sign < 0 ? 'Крен і рискання ліворуч разом' : 'Крен і рискання праворуч разом',
      ],
      ['Counter-roll to leave the turn', 'Протилежний крен для виходу з повороту'],
    ],
    travel: [
      ['Set a small directional tilt', 'Задайте малий нахил у напрямку руху'],
      ['Centre and observe the motion', 'Центруйте й спостерігайте за рухом'],
      ['Brake the drift, then level', 'Погасіть дрейф і вирівняйтеся'],
    ],
  };
  const phaseIndex = (tick) =>
    kind === 'travel'
      ? tick < 75
        ? 0
        : tick < 125
          ? 1
          : 2
      : phases[kind].length === 1
        ? 0
        : tick <
            (kind === 'turn'
              ? 170
              : kind === 'tilt-release'
                ? 60
                : kind === 'level'
                  ? 100
                  : ticks / 2)
          ? 0
          : 1;
  return {
    kind,
    spawnHeight,
    initialHeading,
    targetHeading,
    warmup,
    ticks,
    prepareMaxTicks: spawnHeight ? 500 : 0,
    prepareReady(state) {
      const headingError = ((initialHeading - (state.attitude?.yaw ?? 0) / 100 + 540) % 360) - 180;
      return (
        !spawnHeight ||
        (Math.abs((state.position?.y ?? 0) - spawnHeight) < 45 &&
          Math.abs(state.velocity?.y ?? 0) < 90 &&
          Math.abs(headingError) < 2 &&
          Math.abs(state.angular?.yaw ?? 0) < 500)
      );
    },
    prepareCommand(state) {
      return {
        roll: tiltCommand(0, 'roll', state),
        pitch: tiltCommand(0, 'pitch', state),
        yaw: yawCommand(initialHeading, state),
        throttle: throttleFor(spawnHeight, state),
      };
    },
    phase(tick) {
      const [en, uk] = phases[kind][phaseIndex(tick)];
      return { en, uk };
    },
    command(tick, state = {}) {
      if (kind === 'ground') return neutral(0);
      const input = neutral(throttleFor(kind === 'land' ? 0 : height, state, kind === 'land'));
      let desiredPitch = 0,
        desiredRoll = 0,
        desiredYaw = initialHeading;
      const velocity = localVelocity(state);
      if (kind === 'turn') {
        desiredRoll = tick < 170 ? sign * 7 : 0;
        desiredPitch = tick < 210 ? 4 : limit(-velocity.pitch * 4, -8, 8);
        desiredYaw = targetHeading;
      } else if (kind === 'yaw') desiredYaw = targetHeading;
      else if (kind === 'travel' || kind === 'tilt-release') {
        let tilt = tick < (kind === 'travel' ? 75 : 60) ? sign * techniqueTilt : 0;
        if (kind === 'travel' && tick >= 125) tilt = limit(-velocity[axis] * 4, -8, 8);
        if (axis === 'roll') desiredRoll = tilt;
        else desiredPitch = tilt;
        if (step.axis === 'mixed' && motion === 'lift')
          desiredPitch = tick < 125 ? 6 : desiredPitch;
        if (step.axis === 'mixed' && Number.isFinite(step.lateralDirection))
          desiredRoll =
            tick < 75 ? limit(step.lateralDirection ?? 0) * 3 : limit(-velocity.roll * 4, -6, 6);
      } else if (kind === 'brake') {
        desiredPitch = limit(-velocity.pitch * 4, -8, 8);
        desiredRoll = limit(-velocity.roll * 4, -8, 8);
      } else if (['lift', 'descend'].includes(kind) && step.axis === 'mixed') {
        desiredPitch = tick < 100 ? 5 : limit(-velocity.pitch * 4, -8, 8);
      }
      input.roll = tiltCommand(desiredRoll, 'roll', state);
      input.pitch = tiltCommand(desiredPitch, 'pitch', state);
      input.yaw = yawCommand(desiredYaw, state);
      if (
        (kind === 'tilt-release' && tick >= 60) ||
        (kind === 'travel' && tick >= 75 && tick < 125)
      ) {
        input[axis] = 0;
      }
      return input;
    },
  };
}

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
    unscoredPractice: true,
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
      bounds: { min: { x: -80000, y: 0, z: -80000 }, max: { x: 80000, y: 80000, z: 80000 } },
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
  onPracticeView = () => {},
  readRadioPreview = () => undefined,
  createLessonPreview = null,
}) {
  const doc = root.ownerDocument;
  const labController = createFlightGamepad({ window: win, document: doc });
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
    labState = null,
    labPlan = null,
    labExampleTick = 0,
    labReferenceOrientation = null,
    labInput = neutralFlightInput(),
    labReason = '',
    labFrameId = null,
    labLastTime = null,
    labAccumulator = 0,
    autoPreviewPending = false,
    radioBaseline = null,
    radioIntentTicks = 0,
    exampleLoops = 0,
    labImmersive = false,
    practiceNativeSeen = false,
    practiceViewRevision = 0,
    previewActivityRevision = 0,
    diagram = null,
    viewReleases = [];
  let lessonDemonstration = null,
    lessonTimeline = null,
    labScope = 'step',
    labLesson = false,
    labCompletedStep = -1;
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
  const hasLessonPreview = () =>
    typeof createLessonPreview === 'function' &&
    lessonDemonstration?.mode === mode() &&
    lessonDemonstration?.course === lesson?.id &&
    Array.isArray(lessonDemonstration?.frames) &&
    lessonDemonstration.frames.length > 0;
  const isExploring = () =>
    stage === 'guide' &&
    labScope !== 'lesson' &&
    ['beginner-01', 'beginner-15'].includes(lesson?.id) &&
    viewedStep === 0;
  const sequence = () => (lesson?.mode === 'acro' ? PRIMARY_LESSON_ORDER : SELF_LEVEL_LESSON_ORDER);
  const lessonNumber = () => Math.max(0, sequence().indexOf(lesson?.id)) + 1;
  const curriculumPosition = () => {
    if (lesson?.mode !== 'acro')
      return `${t('SELF-LEVEL PRACTICE', 'САМОВИРІВНЮВАННЯ')} · ${String(lessonNumber()).padStart(2, '0')} / ${SELF_LEVEL_LESSON_ORDER.length}`;
    const tiers = {
      beginner: [ACRO_LESSON_ORDER, t('BEGINNER', 'ПОЧАТКОВИЙ')],
      experienced: [EXPERIENCED_LESSON_ORDER, t('EXPERIENCED', 'ДЛЯ ДОСВІДЧЕНИХ')],
      advanced: [ADVANCED_LESSON_ORDER, t('ADVANCED', 'ПОГЛИБЛЕНИЙ')],
      pro: [PRO_LESSON_ORDER, t('PRO', 'PRO · ПРОФІ')],
      master: [MASTER_LESSON_ORDER, t('MASTER', 'MASTER · МАЙСТЕРНІСТЬ')],
    };
    const [ids, name] = tiers[lesson.tier] ?? tiers.beginner;
    const withinTier = Math.max(0, ids.indexOf(lesson.id)) + 1;
    return `${name} · ${String(withinTier).padStart(2, '0')}/${ids.length} · ACRO ${String(lessonNumber()).padStart(2, '0')}/${PRIMARY_LESSON_ORDER.length}`;
  };
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
  const labStickMode = () => {
    if (labMode === 'try' && labSource === 'controller') return 2;
    const requested = labRadioAvailable()
      ? (snapshot.radioStickMode ?? snapshot.stickMode)
      : snapshot.stickMode;
    return STICK_LAYOUTS[requested] ? requested : 2;
  };
  function clearLabInput({ block = true } = {}) {
    if (block) for (const key of labKeys) blockedKeys.add(key);
    labKeys.clear();
    Object.assign(labTouch, neutralFlightInput());
    touchThrottleDirection = 0;
    labInput = neutralFlightInput();
  }
  function pausePreview(reason = 'stopped') {
    ++previewActivityRevision;
    autoPreviewPending = false;
    labRunning = false;
    labReason = reason;
    labController.reset(reason);
    labFlight?.pause();
    labState = labFlight?.snapshot() ?? null;
    clearLabInput();
    if (labFrameId !== null) win.cancelAnimationFrame(labFrameId);
    labFrameId = null;
    labLastTime = null;
    labAccumulator = 0;
    clearStickMotion();
    paintLab();
  }
  const recordedCommand = (frame) => ({
    roll: frame[0],
    pitch: frame[1],
    yaw: frame[2],
    throttle: frame[3],
    actions: frame[4],
  });
  function prepareExample({ fromStep = viewedStep } = {}) {
    clearStickMotion();
    labController.reset('preview-reset');
    labFlight?.dispose?.();
    labFlight = null;
    labLesson = labScope === 'lesson' && hasLessonPreview();
    labCompletedStep = -1;
    if (labLesson) {
      labPlan = null;
      labFlight = createLessonPreview(lesson, mode(), lessonDemonstration);
      if (!lessonTimeline) {
        // Derive boundaries from real objectives once. Store only command
        // offsets: seeking replays the prefix, never injects a saved pose.
        const starts = [0];
        labFlight.arm();
        for (const [index, frame] of lessonDemonstration.frames.entries()) {
          const state = labFlight.step(recordedCommand(frame), { quantized: true });
          if (state.step > starts.length - 1) starts.push(index + 1);
        }
        if (starts.length !== lesson.steps.length + 1) {
          labFlight.dispose?.();
          labFlight = null;
          throw new Error('Lesson demonstration does not complete every objective');
        }
        lessonTimeline = starts;
        labFlight.reset();
      }
      labFlight.arm();
      labExampleTick = lessonTimeline[clamp(fromStep, 0, lesson.steps.length - 1)] ?? 0;
      for (let index = 0; index < labExampleTick; index++)
        labFlight.step(recordedCommand(lessonDemonstration.frames[index]), { quantized: true });
      labFlight.pause();
      labState = labFlight.snapshot();
      viewedStep = Math.min(labState.step, lesson.steps.length - 1);
      labReferenceOrientation = [0, 0, 0, 1000000];
      labInput = Object.fromEntries(
        AXES.map((axis) => [axis, (labState.lastInput?.[axis] ?? 0) / 1000]),
      );
      return;
    }
    labPlan =
      labMode === 'example' && !isExploring()
        ? beginnerStepExample(displayedStep(), {
            mode: mode(),
            objective: criterion(viewedStep),
            previousStep: lesson?.steps[viewedStep - 1],
            previousObjective: criterion(viewedStep - 1),
          })
        : null;
    labExampleTick = 0;
    labFlight = createBeginnerPreview(mode());
    labState = labFlight.snapshot();
    if (labPlan) {
      // Reach the example's opening height/heading through real commands.
      // This bounded setup never touches the host flight or its recorder.
      labFlight.arm();
      for (let tick = 0; tick < labPlan.prepareMaxTicks && !labPlan.prepareReady(labState); tick++)
        labState = labFlight.step(labPlan.prepareCommand(labState));
      for (const command of labPlan.warmup) labState = labFlight.step(command);
      labFlight.pause();
      labState = labFlight.snapshot();
    }
    labReferenceOrientation = [...labState.orientation];
    labInput = Object.fromEntries(
      AXES.map((axis) => [axis, (labState.lastInput?.[axis] ?? 0) / 1000]),
    );
  }
  // One recorded clock across the whole manoeuvre. Objective boundaries must
  // not accelerate/decelerate the drone or transmitter presentation.
  const examplePace = () => (labLesson || labPlan ? 0.5 : EXAMPLE_PACE);
  function clearStickMotion() {
    for (const stick of refs.sticks ?? []) {
      stick.trace?.reset();
      stick.guide = null;
    }
  }
  function resetPreview() {
    pausePreview('ready');
    prepareExample();
    paintLab();
  }
  function rememberRadioBaseline() {
    const value = labRadioInput();
    radioBaseline =
      labRadioAvailable() && ['roll', 'pitch', 'yaw'].every((axis) => Math.abs(value[axis]) < 0.08)
        ? value
        : null;
    radioIntentTicks = 0;
  }
  function takeControls(source, { focus = false } = {}) {
    if (stage !== 'guide' || disposed) return;
    if (labMode !== 'try' || labSource !== source) {
      ++previewActivityRevision;
      const previousStickMode = labStickMode();
      const throttle = labInput.throttle;
      clearLabInput();
      labMode = 'try';
      labSource = source;
      clearStickMotion();
      // Keyboard and touch take over the current preview without dropping its
      // throttle. Radio uses its actual calibrated value, never this handoff.
      labInput.throttle = throttle;
      labTouch.throttle = throttle;
      if (source === 'controller') labController.seedThrottle(throttle);
      else labController.reset('ownership');
      rememberRadioBaseline();
      if (labStickMode() !== previousStickMode) render();
      else paint();
    }
    playPreview({ focus });
  }
  function observeRadio() {
    if (!labRadioAvailable()) {
      radioBaseline = null;
      radioIntentTicks = 0;
      if (labRunning && labMode === 'try' && labSource === 'radio') pausePreview('radio');
      return;
    }
    if (labMode !== 'example') return;
    if (!radioBaseline) {
      rememberRadioBaseline();
      return;
    }
    // Resting throttle is part of the baseline. A held off-centre stick at
    // connect, normal sensor noise, or reconnect cannot seize the example.
    const value = labRadioInput();
    const moved = AXES.some((axis) => Math.abs(value[axis] - radioBaseline[axis]) > 0.18);
    radioIntentTicks = labRunning && moved ? radioIntentTicks + 1 : 0;
    if (radioIntentTicks >= 2) takeControls('radio');
  }
  function refreshRadioSample() {
    const value = readRadioPreview();
    if (value === undefined) return;
    snapshot.radioMonitor = value?.controls;
    snapshot.radioAvailable = Boolean(value?.verified);
    snapshot.radioStickMode = value?.stickMode ?? snapshot.radioStickMode;
    snapshot.radioIndex = value?.verified && Number.isInteger(value.index) ? value.index : null;
  }
  function pollController(now = win.performance?.now?.() ?? Date.now()) {
    let gamepads = [];
    try {
      gamepads = win.navigator?.getGamepads?.() ?? [];
    } catch {
      // An unavailable browser Gamepad API cannot keep a preview moving.
    }
    // Older hosts may omit the selected radio slot. Preserve their calibrated
    // radio ownership instead of guessing whether a standard pad is that radio.
    if (labRadioAvailable() && !Number.isInteger(snapshot.radioIndex)) gamepads = [];
    return labController.poll({
      gamepads,
      now,
      scope: 'flight',
      excludeIndex: labRadioAvailable() ? snapshot.radioIndex : null,
    });
  }
  function observeController(now) {
    const value = pollController(now);
    if (value.actions.includes('reset')) {
      if (labLesson) viewedStep = 0;
      resetPreview();
      patchLessonStep();
      return false;
    }
    const ownsPreview = labMode === 'try' && labSource === 'controller';
    const explicitPause =
      value.actions.includes('back') ||
      (value.actions.includes('pause') && value.reason === 'neutral');
    if (explicitPause || (ownsPreview && value.actions.includes('pause'))) {
      pausePreview('controller');
      return false;
    }
    if (ownsPreview && !value.active) {
      pausePreview('controller');
      return false;
    }
    if (labMode === 'example' && value.intent) takeControls('controller');
    return true;
  }
  function previewCommand(advance = true) {
    if (labMode === 'example')
      return labLesson
        ? Object.fromEntries(
            ['roll', 'pitch', 'yaw', 'throttle'].map((axis, index) => [
              axis,
              (lessonDemonstration.frames[labExampleTick]?.[index] ?? 0) / 1000,
            ]),
          )
        : labPlan
          ? labPlan.command(labExampleTick, labState)
          : beginnerExampleCommand(labExampleTick, displayedStep()?.axis);
    if (labSource === 'radio') return labRadioInput();
    if (labSource === 'controller')
      return advance ? labController.sample(1 / FLIGHT_HZ) : labController.preview().controls;
    if (labSource === 'touch') {
      if (advance)
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
            (fine ? 0.1 : 0.35) *
            Number(advance)) /
            FLIGHT_HZ,
        0,
        1,
      ),
      roll: (Number(labKeys.has('KeyD')) - Number(labKeys.has('KeyA'))) * gain,
      pitch: (Number(labKeys.has('KeyW')) - Number(labKeys.has('KeyS'))) * gain,
      yaw: (Number(labKeys.has('KeyE')) - Number(labKeys.has('KeyQ'))) * gain,
    };
  }
  function patchLessonStep() {
    if (!labLesson || stage !== 'guide') return;
    const step = lesson.steps[viewedStep];
    const values = {
      stepLabel: t(
        `STEP ${viewedStep + 1} OF ${lesson.steps.length}`,
        `КРОК ${viewedStep + 1} ІЗ ${lesson.steps.length}`,
      ),
      stepTitle: copy(step.title),
      stepInstruction: copy(step.instruction),
      stepWhy: copy(step.why) || copy(lesson.concept),
      stepTip: copy(step.tip),
      target: objectiveText(labState.target),
    };
    for (const [key, value] of Object.entries(values))
      if (refs[key] && refs[key].textContent !== value) refs[key].textContent = value;
    for (const [index, item] of (refs.stepDots ?? []).entries()) {
      item.dataset.state =
        index < labState.step ? 'done' : index === viewedStep ? 'current' : 'later';
      if (index === viewedStep && labState.step < lesson.steps.length)
        item.setAttribute('aria-current', 'step');
      else item.removeAttribute('aria-current');
    }
    for (const stick of refs.sticks ?? []) {
      stick.section.dataset.highlight = String(
        step.axis === 'mixed' || [stick.h, stick.v].includes(step.axis),
      );
      for (const label of stick.labels.children)
        label.classList.toggle('is-focus', label.dataset.axis === step.axis);
    }
  }
  function previewFrame(time) {
    labFrameId = null;
    if (!labRunning || stage !== 'guide' || disposed) return;
    if (doc.hidden || (doc.hasFocus && !doc.hasFocus())) {
      pausePreview('focus');
      return;
    }
    refreshRadioSample();
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
    if (!observeController(time)) return;
    labAccumulator += Math.max(0, elapsed) * (labMode === 'example' ? examplePace() : 1);
    while (labAccumulator >= 1000 / FLIGHT_HZ) {
      labAccumulator -= 1000 / FLIGHT_HZ;
      labInput = previewCommand();
      const previousStep = labState.step;
      const state = (labState =
        labLesson && labMode === 'example'
          ? labFlight.step(recordedCommand(lessonDemonstration.frames[labExampleTick]), {
              quantized: true,
            })
          : labFlight.step(labInput));
      if (labLesson && state.step !== previousStep) {
        viewedStep = Math.min(state.step, lesson.steps.length - 1);
        if (labMode === 'try') labCompletedStep = previousStep;
        patchLessonStep();
      }
      if (labMode === 'example') labExampleTick++;
      if (
        labMode === 'example' &&
        labExampleTick >=
          (labLesson ? lessonDemonstration.frames.length : (labPlan?.ticks ?? EXAMPLE_TICKS))
      ) {
        exampleLoops++;
        if (snapshot.reducedMotion) {
          pausePreview('finished');
          break;
        }
        // A whole lesson repeats only after its final genuine objective. The
        // flight and its momentum are retained between every intermediate step.
        prepareExample({ fromStep: labLesson ? 0 : viewedStep });
        patchLessonStep();
        labFlight.arm();
        labState = labFlight.snapshot();
        continue;
      }
      // The unscored lab has no attempt timer. Ground and boundary contacts
      // resolve normally without interrupting the player's controls.
      if (state.status !== 'active') {
        pausePreview('finished');
        break;
      }
    }
    paint();
    if (labRunning) labFrameId = win.requestAnimationFrame(previewFrame);
  }
  function playPreview({ focus = true } = {}) {
    if (!lesson || stage !== 'guide' || disposed) return;
    if (!labFlight || labReason === 'finished' || labReason === 'boundary') resetPreview();
    if (labMode === 'try' && labSource === 'radio' && !labRadioAvailable()) {
      pausePreview('radio');
      return;
    }
    if (!labRunning && labMode === 'try' && labSource === 'controller') {
      refreshRadioSample();
      if (!pollController().ready) {
        pausePreview('controller');
        return;
      }
      labController.seedThrottle(labInput.throttle);
    }
    labReason = '';
    if (labRunning) {
      if (focus) refs.labFocus?.focus({ preventScroll: true });
      return;
    }
    ++previewActivityRevision;
    labRunning = true;
    labFlight.arm();
    labState = labFlight.snapshot();
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
    const release = (event) => {
      if (event && event.pointerId !== pointer) return;
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
      if (stage !== 'guide' || pointer !== null) return;
      takeControls('touch', { focus: true });
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
          if (stage !== 'guide') return;
          if (event.type === 'keydown' && ![' ', 'Enter'].includes(event.key)) return;
          if (event.repeat && !labRunning) return;
          event.preventDefault();
          takeControls('touch', { focus: event.type !== 'keydown' });
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
    const state = labState;
    // Live controls are displayed on the next animation frame. Only the fixed
    // simulation loop advances throttle or physics; attitude is never predicted.
    const input = labRunning
      ? labMode === 'try'
        ? previewCommand(false)
        : labInput
      : neutralFlightInput();
    diagram?.update({
      state,
      referenceOrientation: labReferenceOrientation,
      detailScale: 1.5,
      followHeading: true,
      environmentMotion: true,
      immersivePractice: labImmersive,
      reducedMotion: Boolean(snapshot.reducedMotion),
      controls: input,
      locale: lang(),
      unavailable:
        labMode === 'try' &&
        ((labSource === 'radio' && !labRadioAvailable()) ||
          (labSource === 'controller' && !labController.status().connected)),
      practiceTarget: labLesson ? state.target : null,
    });
    if (refs.labPlay) {
      const label = labRunning
        ? t('Pause preview', 'Пауза перегляду')
        : labMode === 'example'
          ? t('Play example', 'Показати приклад')
          : t('Resume controls', 'Продовжити керування');
      if (refs.labPlay.textContent !== label) refs.labPlay.textContent = label;
    }
    if (refs.labSourceHint) {
      const source = {
        keyboard: t('Keyboard', 'Клавіатура'),
        touch: t('Touch controls', 'Дотикове керування'),
        radio: t('Radio / controller', 'Пульт / контролер'),
        controller: t('Gamepad / Steam Deck', 'Геймпад / Steam Deck'),
      }[labSource];
      const text =
        labMode === 'example'
          ? t(
              'Move a stick, drag a gimbal or use the keyboard to take control. Esc pauses so you can browse.',
              'Рухайте стіком, перетягніть джойстик або натисніть клавішу, щоб керувати. Esc — пауза для навігації.',
            )
          : labSource === 'controller'
            ? `${source} · ${t('left up/down adjusts thrust; release holds · Start / B pauses', 'лівий стік угору/вниз змінює тягу; центр утримує · Start / B — пауза')}`
            : `${source} · ${t('live input at normal speed · replay the example whenever you want', 'ваш сигнал зі звичайною швидкістю · приклад можна повторити будь-коли')}`;
      if (refs.labSourceHint.textContent !== text) refs.labSourceHint.textContent = text;
    }
    if (refs.labPhase) {
      refs.labPhase.hidden = !labLesson && (labMode !== 'example' || !labPlan);
      const text = labLesson
        ? state.step >= lesson.steps.length
          ? labMode === 'example'
            ? t(
                'Lesson demonstration complete. Watch again or try the controls.',
                'Показ уроку завершено. Повторіть його або спробуйте керування.',
              )
            : t(
                '✓ Well flown! Practice lesson complete. Keep flying or watch again; no score is recorded.',
                '✓ Гарний політ! Навчальну практику завершено. Літайте далі або повторіть показ; бали не записуються.',
              )
          : labMode === 'try' && labCompletedStep >= 0
            ? t(
                `✓ Well flown! Step ${labCompletedStep + 1} complete. Next: ${copy(lesson.steps[viewedStep].title)}`,
                `✓ Гарний політ! Крок ${labCompletedStep + 1} виконано. Далі: ${copy(lesson.steps[viewedStep].title)}`,
              )
            : copy(lesson.steps[viewedStep].title)
        : labPlan
          ? copy(labPlan.phase(labExampleTick))
          : '';
      if (refs.labPhase.textContent !== text) refs.labPhase.textContent = text;
    }
    if (refs.labStatus) {
      const text = labRunning
        ? labMode === 'example'
          ? labLesson
            ? snapshot.reducedMotion
              ? t(
                  `WATCH LESSON · ${examplePace().toFixed(2)}× pace · one complete demonstration`,
                  `ПОКАЗ УРОКУ · темп ${examplePace().toFixed(2)}× · один повний показ`,
                )
              : t(
                  `WATCH LESSON · ${examplePace().toFixed(2)}× pace · real route · repeats after the landing`,
                  `ПОКАЗ УРОКУ · темп ${examplePace().toFixed(2)}× · справжній маршрут · повтор після посадки`,
                )
            : labPlan
              ? `${labImmersive ? copy(labPlan.phase(labExampleTick)) + ' · ' : ''}${t(
                  'STEP EXAMPLE · 0.5× pace · control technique, not route playback',
                  'ПРИКЛАД КРОКУ · темп 0,5× · прийом керування, а не запис маршруту',
                )}`
              : snapshot.reducedMotion
                ? t(
                    'EXAMPLE · 0.2× teaching pace · real full-travel commands · one pass',
                    'ПРИКЛАД · навчальний темп 0,2× · справжні команди до краю · один показ',
                  )
                : t(
                    'EXAMPLE · 0.2× teaching pace · real full-travel commands · loops from the starting pose',
                    'ПРИКЛАД · навчальний темп 0,2× · справжні команди до краю · повтор із початкової позиції',
                  )
          : labLesson
            ? t(
                'YOUR CONTROLS · real objectives advance automatically · unscored practice',
                'ВАШЕ КЕРУВАННЯ · справжні цілі змінюються автоматично · практика без балів',
              )
            : t(
                'YOUR CONTROLS · no time limit · real lesson stays paused',
                'ВАШЕ КЕРУВАННЯ · без обмеження часу · урок залишається на паузі',
              )
        : labReason === 'controller'
          ? t(
              'PREVIEW PAUSED · Centre the gamepad sticks and release its buttons, then choose Resume controls. The real flight stays paused.',
              'ПЕРЕГЛЯД НА ПАУЗІ · Центруйте стіки геймпада й відпустіть кнопки, потім виберіть «Продовжити керування». Справжній політ на паузі.',
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
                    'PREVIEW PAUSED · Play / Resume opens controls; the real lesson stays paused',
                    'ПЕРЕГЛЯД НА ПАУЗІ · показ / продовжити відкриває керування; справжній урок на паузі',
                  );
      const statusText =
        labImmersive && labLesson && labMode === 'try' && labCompletedStep >= 0
          ? `${refs.labPhase.textContent} · ${text}`
          : text;
      if (refs.labStatus.textContent !== statusText) refs.labStatus.textContent = statusText;
    }
    if (refs.labTelemetry) {
      const text = `${(state.position.y / 1000).toFixed(1)} ${t('m height', 'м висоти')} · ${(Math.hypot(state.velocity.x, state.velocity.z) / 1000).toFixed(1)} ${t('m/s drift', 'м/с дрейфу')} · ${(Math.max(Math.abs(state.attitude.roll), Math.abs(state.attitude.pitch)) / 100).toFixed(1)}° ${t('tilt', 'нахилу')}`;
      if (refs.labTelemetry.textContent !== text) refs.labTelemetry.textContent = text;
    }
    for (const stick of refs.sticks ?? []) paintStick(stick, input, true);
  }
  function paintStick(stick, input, preview = false) {
    const x = input[stick.h],
      y = stick.v === 'throttle' ? input[stick.v] * 2 - 1 : input[stick.v],
      example = preview && labMode === 'example',
      now = win.performance?.now?.() ?? Date.now(),
      reducedMotion = Boolean(snapshot.reducedMotion);
    // The small filled marker and readout always show the exact applied command.
    // Only the separately labelled hollow movement guide eases between samples.
    stick.live.style.display = example ? 'none' : '';
    stick.exampleInput.style.display = example ? '' : 'none';
    stick.suggestion.style.display = example && !reducedMotion ? '' : 'none';
    stick.live.setAttribute('cx', 90 + x * 60);
    stick.live.setAttribute('cy', 90 - y * 60);
    stick.exampleInput.setAttribute('cx', 90 + x * 60);
    stick.exampleInput.setAttribute('cy', 90 - y * 60);
    let gx = x,
      gy = y;
    const guide = stick.guide;
    if (
      example &&
      labRunning &&
      !reducedMotion &&
      guide &&
      now >= guide.time &&
      now - guide.time <= 150
    ) {
      const fraction = clamp((now - guide.started) / 80, 0, 1);
      gx = guide.fromX + (guide.targetX - guide.fromX) * fraction;
      gy = guide.fromY + (guide.targetY - guide.fromY) * fraction;
      if (x !== guide.targetX || y !== guide.targetY) {
        guide.fromX = gx;
        guide.fromY = gy;
        guide.targetX = x;
        guide.targetY = y;
        guide.started = now;
      }
      guide.time = now;
    } else stick.guide = { fromX: x, fromY: y, targetX: x, targetY: y, started: now, time: now };
    stick.suggestion.style.transform = `translate(${gx * 60}px, ${-gy * 60}px)`;
    stick.trace.update({
      x,
      y,
      now,
      source: `${example ? 'example' : preview ? labSource : snapshot.source}:${stick.h}:${stick.v}`,
      reducedMotion,
      available: preview
        ? labRunning
        : !(snapshot.source === 'radio' && snapshot.monitorAvailable === false),
    });
    const text = `${axisName(stick.h)} ${Math.round(x * 100)}% · ${axisName(stick.v)} ${Math.round(input[stick.v] * 100)}%`;
    if (stick.readout.textContent !== text) stick.readout.textContent = text;
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
    const trace = mountStickTrace(drawing);
    viewReleases.push(() => trace.dispose());
    const exampleInput = svg('circle', { cx: 90, cy: 90, r: 4.5, class: 'coach-example-input' });
    const live = svg('circle', { cx: 90, cy: 90, r: 6, class: 'coach-live-dot' });
    suggestion.style.animation = 'none';
    drawing.classList.add('coach-stick-pad');
    bindGimbal(drawing, h, v);
    drawing.append(suggestion, exampleInput, live);
    const labels = node('div', 'coach-stick-axes');
    for (const axis of [v, h]) {
      const label = node('p', axis === step.axis ? 'is-focus' : '');
      label.dataset.axis = axis;
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
    refs.sticks.push({
      live,
      suggestion,
      exampleInput,
      trace,
      readout,
      h,
      v,
      section,
      labels,
      guide: null,
    });
    return section;
  }
  function makeDrone() {
    const figure = node('figure', 'coach-drone-figure');
    const drawing = node('div', 'coach-lab-drawing');
    drawing.setAttribute('role', 'img');
    drawing.setAttribute(
      'aria-label',
      t(
        'Rear view follows the drone’s heading; ground arrow shows the starting direction. Amber front and thrust; cyan actual movement. Full tilt and inversion remain visible.',
        'Вигляд ззаду стежить за курсом дрона; стрілка на землі показує початковий напрямок. Жовте — перед і тяга; блакитне — фактичний рух. Нахил і переворот залишаються видимими.',
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
    const skill = practiceSkillFeedback(target, null, lang());
    if (skill) return skill.objective;
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
    const state = stage === 'guide' && labLesson ? labState : snapshot.state,
      step = currentStep(),
      target = stage === 'guide' && labLesson ? labState.target : criterion();
    if (stage === 'guide' && labLesson) {
      if (state.step >= lesson.steps.length)
        return t(
          'All practice objectives complete. Keep flying, or Watch lesson to repeat. No score was recorded.',
          'Усі цілі практики виконано. Літайте далі або повторіть урок. Бали не записано.',
        );
      const skill = practiceSkillFeedback(target, state, lang());
      if (skill && labMode !== 'example') return skill.hint;
      return labMode === 'example'
        ? t(
            'Watch the recorded controls and the next target. Move a control to continue from this exact point.',
            'Стежте за записаним керуванням і наступною ціллю. Рухайте керуванням, щоб продовжити з цієї позиції.',
          )
        : state.hold > 0
          ? t(
              'You are in the target. Keep it gentle while the progress fills.',
              'Ви в цілі. Керуйте плавно, доки заповнюється поступ.',
            )
          : copy(step?.tip) || copy(step?.instruction);
    }
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
    const skill = practiceSkillFeedback(target, state, lang());
    if (skill) return skill.hint;
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
    refs = { sticks: [], stepDots: [] };
    root.replaceChildren();
    root.hidden = false;
    root.classList.add('beginner-coach');
    root.dataset.stage = stage;
    root.dataset.labImmersive = String(labImmersive && stage === 'guide');
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
      eyebrow = node('p', 'coach-eyebrow', curriculumPosition());
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
      refs.stepDots.push(item);
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
      refs.stepLabel = node(
        'p',
        'coach-step-label',
        t(
          `STEP ${index + 1} OF ${lesson.steps.length}`,
          `КРОК ${index + 1} ІЗ ${lesson.steps.length}`,
        ),
      );
      refs.stepTitle = node('h3', '', copy(step?.title));
      refs.stepInstruction = node('p', 'coach-instruction', copy(step?.instruction));
      lessonStep.append(refs.stepLabel, refs.stepTitle, refs.stepInstruction);
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
      refs.labSourceHint = node('p', 'coach-lab-source-hint');
      card.append(refs.labSourceHint);
      const visuals = node('div', 'coach-visuals coach-grid'),
        controller = node('section', 'coach-controller coach-radio-chassis');
      const stickMode = labStickMode();
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
        node('span', 'coach-legend-example-input', t('Example input', 'Сигнал прикладу')),
        node('span', 'coach-legend-example', t('Movement guide', 'Підказка руху')),
      );
      controller.append(
        legend,
        node(
          'p',
          'coach-example-note',
          t(
            'The small amber dot shows exact example input; the hollow ring follows its movement. The short trail shows where the stick came from. Your cyan dot responds immediately.',
            'Мала жовта крапка показує точний сигнал прикладу; порожнє коло допомагає простежити рух. Короткий слід показує, звідки рухався стік. Ваша блакитна крапка реагує відразу.',
          ),
        ),
      );
      notes.append(
        node(
          'p',
          'coach-example-note',
          t(
            'Gamepad / Steam Deck: left stick turns the nose and adjusts thrust; centring holds the thrust setting. Right stick banks and pitches. D-pad moves roll/pitch; shoulder buttons turn; triggers lower/raise thrust. Move a centred controller to take over an example. Start or B / Circle pauses; Y / Triangle resets practice. Paused controls belong to the menus. These buttons never arm the real flight from this guide.',
            'Геймпад / Steam Deck: лівий стік повертає ніс і змінює тягу; центр зберігає її рівень. Правий стік — крен і тангаж. Хрестовина — крен/тангаж; плечові кнопки — поворот; тригери зменшують/збільшують тягу. Центруйте геймпад і рухайте стіком, щоб перейняти приклад. Start або B / Circle — пауза; Y / Triangle — скидання практики. На паузі керування належить меню. Ці кнопки ніколи не вмикають справжній політ із пояснення.',
          ),
        ),
      );
      const touchControls = node('details', 'coach-lab-touch-controls');
      touchControls.append(node('summary', '', t('Touch buttons', 'Сенсорні кнопки')), makeDpad());
      controller.append(touchControls);
      visuals.append(controller);
      const behavior = node('section', 'coach-behavior coach-drone');
      refs.labPhase = node('p', 'coach-lab-phase coach-target');
      refs.labPhase.setAttribute('role', 'status');
      refs.labPhase.setAttribute('aria-live', 'polite');
      refs.stepWhy = node(
        'p',
        '',
        isExploring() ? axisExplanation(explored) : copy(step?.why) || copy(lesson.concept),
      );
      behavior.append(
        node('h3', '', t('WHAT THE DRONE DOES', 'ЩО РОБИТЬ ДРОН')),
        refs.labPhase,
        makeDrone(step),
        refs.stepWhy,
      );
      visuals.append(behavior);
      card.append(visuals);
      const labActions = node('div', 'coach-lab-actions coach-lab-toolbar');
      refs.labPlay = button('lab-play', '');
      labActions.append(
        button(
          'lab-immersive',
          labImmersive
            ? t('Back to lesson', 'До пояснення')
            : t('Fullscreen practice', 'Повноекранна практика'),
        ),
        refs.labPlay,
        button('lab-reset', t('Reset controls', 'Скинути керування')),
        button(
          'lab-replay',
          hasLessonPreview()
            ? t('Watch lesson', 'Переглянути урок')
            : t('Replay example', 'Повторити приклад'),
        ),
      );
      if (hasLessonPreview() && ['beginner-01', 'beginner-15'].includes(lesson.id))
        labActions.append(button('lab-explore', t('Explore controls', 'Дослідити керування')));
      refs.labStatus = node('p', 'coach-lab-status');
      refs.labStatus.setAttribute('role', 'status');
      refs.labStatus.setAttribute('aria-live', 'polite');
      card.insertBefore(labActions, visuals);
      card.append(
        refs.labStatus,
        node(
          'p',
          'coach-lab-help',
          t(
            hasLessonPreview()
              ? 'Watch the complete lesson, then move a control to take over at this exact point. Real objectives advance the instructions automatically. Click a step number to replay from it. Watch lesson restarts the complete route. Practice is unscored; use Let’s fly for a recorded attempt. W/S, A/D, Q/E and ↑/↓; Shift is gentle. Esc pauses.'
              : 'Focus the drone and use W/S, A/D, Q/E and ↑/↓, or move a calibrated radio stick. Drag either gimbal or open Touch buttons. Shift is gentle; throttle stays set. Esc pauses for menu navigation. Replay example returns to this step’s control technique.',
            hasLessonPreview()
              ? 'Перегляньте весь урок і рухайте керуванням, щоб продовжити саме з цієї позиції. Справжні цілі автоматично змінюють пояснення. Номер кроку починає показ із нього. «Переглянути урок» повторює весь маршрут. Практика без балів; для записаної спроби натисніть «Почнімо політ». W/S, A/D, Q/E та ↑/↓; Shift — плавно. Esc — пауза.'
              : 'Виберіть схему дрона й натискайте W/S, A/D, Q/E та ↑/↓ або рухайте каліброваним стіком пульта. Перетягніть джойстик або відкрийте сенсорні кнопки. Shift — плавно; газ зберігається. Esc — пауза для меню. «Повторити приклад» показує прийом цього кроку.',
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
      refs.stepTip = node('p', '', copy(step?.tip));
      tip.append(node('strong', '', t('Pilot’s tip', 'Порада пілота')), refs.stepTip);
      notes.append(tip);
    } else card.append(node('p', 'coach-instruction', copy(step?.instruction)));
    const target = (refs.target = node('p', 'coach-target', objectiveText(criterion(index))));
    refs.skillProgress = node('p', 'coach-skill-progress');
    refs.skillProgress.setAttribute('aria-live', 'off');
    refs.skillProgress.hidden = true;
    refs.hint = node('p', 'coach-live-hint');
    refs.hint.setAttribute('role', 'status');
    refs.hint.setAttribute('aria-live', 'polite');
    const hold = node('div', 'coach-hold');
    refs.hold = node('div', 'coach-hold-fill');
    hold.append(refs.hold);
    hold.setAttribute('aria-hidden', 'true');
    (notes ?? card).append(target, refs.skillProgress, makeTelemetry(), hold, refs.hint);
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
    patchLessonStep();
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
        labMode === 'try' && labSource === 'controller'
          ? t(
              'The standard gamepad drives only this preview. Thrust is inherited at takeover, then changes only while you move the left stick vertically or use the triggers.',
              'Стандартний геймпад керує лише переглядом. Під час переходу тяга зберігається, а далі змінюється лише вертикальним рухом лівого стіка або тригерами.',
            )
          : labMode === 'try' && labSource === 'radio'
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
                'Use the keyboard, touch a gimbal or move a calibrated controller to take over. Preview results never count toward the lesson.',
                'Скористайтеся клавіатурою, торкніться джойстика або рухайте каліброваним пультом, щоб керувати. Результати перегляду не зараховуються до уроку.',
              );
    if (stage !== 'guide') for (const stick of refs.sticks) paintStick(stick, input);
    const state = stage === 'guide' && labLesson ? labState : snapshot.state,
      at = state?.attitude;
    const values = {
      height: `${((state?.position?.y ?? 0) / 1000).toFixed(1)} ${t('m', 'м')}`,
      speed: `${(Math.hypot(state?.velocity?.x ?? 0, state?.velocity?.y ?? 0, state?.velocity?.z ?? 0) / 1000).toFixed(1)} ${t('m/s', 'м/с')}`,
      tilt: `${(Math.max(Math.abs(at?.roll ?? 0), Math.abs(at?.pitch ?? 0)) / 100).toFixed(0)}°`,
      throttle: `${Math.round(input.throttle * 100)}%`,
    };
    for (const item of refs.telemetry ?? [])
      if (item.value.textContent !== values[item.key]) item.value.textContent = values[item.key];
    if (refs.hint) {
      const text = hint();
      if (refs.hint.textContent !== text) refs.hint.textContent = text;
    }
    const target = stage === 'guide' && labLesson ? labState.target : criterion();
    const skill = practiceSkillFeedback(target, state, lang());
    if (refs.skillProgress) {
      refs.skillProgress.hidden = !skill;
      if (skill && refs.skillProgress.textContent !== skill.detail)
        refs.skillProgress.textContent = skill.detail;
    }
    if (refs.hold)
      refs.hold.style.width = `${(skill ? skill.progress : clamp((state?.hold ?? 0) / (target?.ticks || 1), 0, 1)) * 100}%`;
  }
  function setPracticeView(enabled, { resume = true } = {}) {
    if (enabled && (!lesson || stage !== 'guide' || disposed)) return;
    if (enabled === labImmersive) return;
    const owner = ++practiceViewRevision;
    const wasRunning = labRunning;
    const throttle = labInput.throttle;
    labImmersive = enabled;
    practiceNativeSeen = enabled && Boolean(doc.fullscreenElement);
    pausePreview();
    if (!disposed && lesson && stage === 'guide') {
      render();
      // Rendering replaces the clicked button. Keep focus inside the lab before
      // the host captures its return target for the asynchronous transition.
      root.querySelector('[data-coach-action="lab-immersive"]')?.focus({ preventScroll: true });
    } else root.dataset.labImmersive = 'false';
    // Request native fullscreen in the original gesture; the host preserves a
    // fullscreen session that the player opened before entering this view.
    const transition = onPracticeView(enabled);
    const activity = previewActivityRevision;
    Promise.resolve(transition)
      .then(() => {
        if (
          disposed ||
          owner !== practiceViewRevision ||
          stage !== 'guide' ||
          activity !== previewActivityRevision
        )
          return;
        practiceNativeSeen = enabled && Boolean(doc.fullscreenElement);
        const focused =
          !doc.hidden && (!doc.hasFocus || doc.hasFocus()) && root.contains(doc.activeElement);
        if (enabled && resume && wasRunning && focused && labReason === 'stopped') {
          // A presentation-only transition releases rotation keys but preserves
          // manual throttle. It never resumes or arms the actual lesson.
          labInput.throttle = throttle;
          labTouch.throttle = throttle;
          playPreview();
        } else
          root.querySelector('[data-coach-action="lab-immersive"]')?.focus({ preventScroll: true });
      })
      .catch(() => {
        if (
          disposed ||
          owner !== practiceViewRevision ||
          stage !== 'guide' ||
          activity !== previewActivityRevision
        )
          return;
        // The full-window practice layout remains usable when native fullscreen
        // is unavailable. No rejected request can resume input by itself.
        pausePreview();
      });
  }
  function practiceFullscreenChanged() {
    if (!labImmersive) return;
    if (doc.fullscreenElement) practiceNativeSeen = true;
    else if (practiceNativeSeen) setPracticeView(false, { resume: false });
  }
  function showGuide() {
    if (!lesson || disposed || stage === 'complete') return;
    onPause();
    stage = 'guide';
    labMode = 'example';
    labScope = hasLessonPreview() ? 'lesson' : 'step';
    viewedStep = activeStep();
    resetPreview();
    radioBaseline = null;
    radioIntentTicks = 0;
    viewedStep = activeStep();
    render();
    autoPreviewPending = !snapshot.reducedMotion;
    root.querySelector('[data-coach-action="start"]')?.focus({ preventScroll: true });
  }
  function click(event) {
    const action = event.target.closest?.('[data-coach-action]')?.dataset.coachAction;
    if (!action || !lesson || disposed) return;
    if (action === 'start') {
      setPracticeView(false, { resume: false });
      pausePreview();
      stage = 'live';
      render();
      onStart();
    } else if (action === 'lab-immersive') {
      setPracticeView(!labImmersive);
    } else if (action === 'lab-replay') {
      labMode = 'example';
      if (hasLessonPreview()) {
        labScope = 'lesson';
        viewedStep = 0;
      }
      exampleLoops = 0;
      resetPreview();
      rememberRadioBaseline();
      render();
      playPreview();
    } else if (action === 'lab-explore' && hasLessonPreview()) {
      labScope = 'explore';
      labMode = 'example';
      viewedStep = 0;
      resetPreview();
      rememberRadioBaseline();
      render();
      if (!snapshot.reducedMotion) playPreview();
    } else if (action === 'lab-play') {
      if (labRunning) pausePreview();
      else playPreview();
    } else if (action === 'lab-reset') {
      const wasRunning = labRunning;
      labMode = 'try';
      if (labLesson) viewedStep = 0;
      resetPreview();
      rememberRadioBaseline();
      paint();
      if (wasRunning) playPreview();
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
      setPracticeView(false, { resume: false });
      pausePreview();
      onPause();
      onExit();
    } else if (action.startsWith('axis-') && AXES.includes(action.slice(5))) {
      explored = action.slice(5);
      resetPreview();
      render();
      if (labMode === 'example' && !snapshot.reducedMotion) playPreview();
    } else if (action.startsWith('step-')) {
      viewedStep = clamp(Number(action.slice(5)), 0, lesson.steps.length - 1);
      if (hasLessonPreview()) {
        labScope = 'lesson';
        labMode = 'example';
      }
      resetPreview();
      render();
      if (labMode === 'example' && !snapshot.reducedMotion) playPreview();
    }
  }
  const keyDown = (event) => {
    if (blockedKeys.has(event.code)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    if (stage !== 'guide' || disposed || !root.contains(event.target)) return;
    if (event.code === 'Escape') {
      if (!labRunning && !labImmersive) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (labRunning) pausePreview();
      else setPracticeView(false, { resume: false });
      return;
    }
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.isComposing ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName) ||
      event.target?.isContentEditable
    )
      return;
    if (!movementKeys.has(event.code)) return;
    // A held flight key can keep repeating while Explain opens. Only a fresh
    // keydown may take ownership from an example or a different input source.
    if (event.repeat && (labMode !== 'try' || labSource !== 'keyboard')) return;
    // A paused guide is a menu. Only explicit focus on its drone opens a
    // keyboard sandbox; menu arrows and held keys returning from blur stay safe.
    if (!labRunning && (event.target !== refs.labFocus || event.repeat)) return;
    if (event.code.startsWith('Shift') && (labMode !== 'try' || labSource !== 'keyboard')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    takeControls('keyboard');
    labKeys.add(event.code);
    if (event.shiftKey) labKeys.add('ShiftLeft');
  };
  const keyUp = (event) => {
    labKeys.delete(event.code);
    if (event.code.startsWith('Shift')) {
      labKeys.delete('ShiftLeft');
      labKeys.delete('ShiftRight');
    }
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
  doc.addEventListener('fullscreenchange', practiceFullscreenChanged);
  root.addEventListener('focusout', leaveLab);
  root.addEventListener('click', click);
  root.hidden = true;
  return {
    open(value, options = {}) {
      setPracticeView(false, { resume: false });
      if (disposed) return;
      pausePreview();
      lesson = value;
      snapshot = {};
      lessonDemonstration = options.demonstration ?? null;
      lessonTimeline = null;
      labScope = hasLessonPreview() ? 'lesson' : 'step';
      labMode = 'example';
      labSource = 'keyboard';
      radioBaseline = null;
      radioIntentTicks = 0;
      exampleLoops = 0;
      replay = Boolean(options.replay);
      explored = 'throttle';
      viewedStep = 0;
      lastRender = '';
      lastPaint = 0;
      stage = options.practice || replay ? 'live' : 'guide';
      resetPreview();
      if (stage === 'guide') onPause();
      render();
      autoPreviewPending = stage === 'guide';
    },
    update(value) {
      if (!lesson || disposed || stage === 'closed') return;
      const previousMode = mode();
      const wasPending = autoPreviewPending;
      const wasReduced = snapshot.reducedMotion;
      snapshot = { ...snapshot, ...value };
      if (mode() !== previousMode) {
        resetPreview();
        autoPreviewPending = wasPending;
      }
      if (!wasReduced && snapshot.reducedMotion && labMode === 'example' && labRunning)
        pausePreview();
      if (labRunning && labMode === 'try' && labSource === 'radio' && !labRadioAvailable())
        pausePreview('radio');
      const key = `${lang()}|${activeStep()}|${snapshot.stickMode}|${snapshot.radioStickMode}|${snapshot.radioAvailable}|${snapshot.source}|${snapshot.monitorAvailable}|${snapshot.mode}|${Boolean(snapshot.reducedMotion)}`;
      if (key !== lastRender) {
        lastRender = key;
        render();
      }
      if (autoPreviewPending) {
        autoPreviewPending = false;
        if (!snapshot.reducedMotion) playPreview({ focus: false });
      }
      observeRadio();
      const now = win.performance?.now?.() ?? Date.now();
      if (!(stage === 'guide' && labRunning) && now - lastPaint >= 80) {
        lastPaint = now;
        paint();
      }
    },
    focusPreview() {
      if (stage === 'guide') refs.labFocus?.focus({ preventScroll: true });
    },
    blocksArm: () => Boolean(lesson && stage === 'guide'),
    pausePreview,
    wantsRadioPreview: () => Boolean(lesson && stage === 'guide' && !disposed),
    previewRunning: () => labRunning,
    previewSource: () => (stage === 'guide' && labMode === 'try' ? labSource : null),
    previewSnapshot: () => ({
      mode: labMode,
      source: labSource,
      running: labRunning,
      state: labFlight?.snapshot() ?? null,
      controls: { ...labInput },
      teachingPace: labMode === 'example' ? examplePace() : 1,
      exampleKind: labLesson ? 'whole-lesson' : (labPlan?.kind ?? 'axis-explorer'),
      exampleTick: labExampleTick,
      phase: labLesson
        ? lesson?.steps[viewedStep]?.title
        : (labPlan?.phase(labExampleTick) ?? null),
      viewedStep,
      completedPracticeSteps: labLesson ? (labState?.step ?? 0) : 0,
      displayedInput: labRunning && labMode === 'try' ? previewCommand(false) : { ...labInput },
      exampleLoops,
      immersive: labImmersive,
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
      setPracticeView(false, { resume: false });
      pausePreview();
      releaseView();
      labFlight?.dispose?.();
      labFlight = labState = null;
      lessonDemonstration = lessonTimeline = null;
      stage = 'closed';
      lesson = null;
      refs = {};
      root.replaceChildren();
      root.hidden = true;
    },
    dispose() {
      setPracticeView(false, { resume: false });
      pausePreview();
      releaseView();
      labFlight?.dispose?.();
      labFlight = labState = null;
      lessonDemonstration = lessonTimeline = null;
      disposed = true;
      labController.dispose();
      win.removeEventListener('keydown', keyDown, true);
      win.removeEventListener('keyup', keyUp, true);
      win.removeEventListener('blur', loseFocus);
      doc.removeEventListener('visibilitychange', visibility);
      doc.removeEventListener('fullscreenchange', practiceFullscreenChanged);
      root.removeEventListener('focusout', leaveLab);
      root.removeEventListener('click', click);
      root.replaceChildren();
      root.hidden = true;
      lesson = null;
      refs = {};
    },
  };
}
