import { setMenuIcon } from '../../game/ui/native-menu-icons.mjs';

/** Read-only teaching feedback from the runtime's matching criterion state. */
export function practiceSkillFeedback(target, state, locale = 'en') {
  if (!['rotation-v1', 'attitude-v1', 'path-v1', 'crossing-v1'].includes(target?.type)) return null;
  const t = (en, uk) => (locale === 'uk' ? uk : en);
  const clamp = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const deg = (value) => Math.round((value ?? 0) / 100);
  const m = (value) => ((value ?? 0) / 1000).toFixed(1);
  const seconds = (ticks) => ((ticks ?? 0) / 50).toFixed(1);
  const skill = state?.skill && state.skill.index === state.step ? state.skill : null;
  const active = skill?.status === 'active' || skill?.status === 'complete';
  const height = `${m(target.min.y)}–${m(target.max.y)}`;
  const pose = (up) =>
    up === 'inverted'
      ? t('inverted', 'догори дном')
      : up === 'upright'
        ? t('upright', 'рівно')
        : t('at the shown entry attitude', 'у показаному положенні входу');
  const rotationName = (spec) =>
    spec.axis === 'roll'
      ? spec.direction > 0
        ? t('Roll right', 'Крен праворуч')
        : t('Roll left', 'Крен ліворуч')
      : spec.axis === 'pitch'
        ? spec.direction > 0
          ? t('Pitch forward', 'Тангаж уперед')
          : t('Pitch back', 'Тангаж назад')
        : spec.direction > 0
          ? t('Yaw right', 'Курс праворуч')
          : t('Yaw left', 'Курс ліворуч');
  const direction = (axis, sign) =>
    axis === 'y'
      ? sign > 0
        ? t('up', 'угору')
        : t('down', 'униз')
      : axis === 'x'
        ? sign > 0
          ? t('east', 'на схід')
          : t('west', 'на захід')
        : sign > 0
          ? t('south', 'на південь')
          : t('north', 'на північ');
  let label,
    objective,
    detail,
    progress = 0;
  let hint = t(
    'Stay airborne inside the marked zone and follow the demonstrated sequence.',
    'Залишайтеся в повітрі в позначеній зоні та виконуйте показану послідовність.',
  );
  if (target.type === 'rotation-v1') {
    label = `${rotationName(target)} ${deg(target.angle)}°`;
    objective = t(
      `${label}. Enter ${pose(target.entryUp)} at ${height} m. Complete the whole rotation, then stop rotating for ${seconds(target.settleTicks)} s.`,
      `${label}. Почніть ${pose(target.entryUp)} на ${height} м. Виконайте весь оберт, потім зупиніть обертання на ${seconds(target.settleTicks)} с.`,
    );
    const amount = Math.max(0, skill?.rotation?.angle ?? 0);
    detail = `${deg(amount)}° / ${deg(target.angle)}° · ${t('steady', 'стабільно')} ${seconds(skill?.dwell)} / ${seconds(target.settleTicks)} ${t('s', 'с')}`;
    progress = active
      ? 0.9 *
          Math.min(
            clamp(amount / target.angle),
            clamp((skill?.rotation?.checkpoint ?? 0) / (target.angle / 9000)),
          ) +
        0.1 * clamp((skill?.dwell ?? 0) / target.settleTicks)
      : 0;
    hint =
      skill?.status === 'entry'
        ? t(
            `Return to the zone ${pose(target.entryUp)} and stop rotating before trying again.`,
            `Поверніться в зону ${pose(target.entryUp)} й зупиніть обертання перед повтором.`,
          )
        : (skill?.rotation?.checkpoint ?? 0) >= target.angle / 9000
          ? t(
              'The rotation is traced. Ease the rotation stick toward centre and settle at the exit attitude.',
              'Оберт пройдено. Поверніть стік обертання до центру й стабілізуйте положення виходу.',
            )
          : t(
              'Follow the complete rotation. A matching final view alone does not count.',
              'Виконайте повний оберт. Самого схожого вигляду наприкінці недостатньо.',
            );
  } else if (target.type === 'attitude-v1') {
    label =
      target.up === 'inverted'
        ? t('Inverted recognition', 'Перевернуте положення')
        : t('Upright recovery', 'Рівне положення');
    objective = t(
      `Remain ${pose(target.up)} at ${height} m for ${seconds(target.ticks)} s, with rotation settled.`,
      `Залишайтеся ${pose(target.up)} на ${height} м протягом ${seconds(target.ticks)} с без обертання.`,
    );
    detail = `${seconds(skill?.dwell)} / ${seconds(target.ticks)} ${t('s steady', 'с стабільно')}`;
    progress = active ? clamp((skill?.dwell ?? 0) / target.ticks) : 0;
    hint =
      target.up === 'inverted'
        ? t(
            'This is a brief inverted falling phase, not inverted hover. Keep recovery height available.',
            'Це коротка фаза падіння догори дном, а не перевернуте зависання. Залишайте висоту для відновлення.',
          )
        : t(
            'Settle the rotation and slow the drift inside the zone.',
            'Зупиніть обертання й уповільніть дрейф у зоні.',
          );
  } else if (target.type === 'path-v1') {
    label =
      target.plane === 'xz'
        ? t('Orbit path', 'Орбітальна траєкторія')
        : t('Loop path', 'Траєкторія петлі');
    objective = t(
      `${label}: ${deg(target.sweep)}° in the marked direction, ${m(target.radiusMin)}–${m(target.radiusMax)} m from the centre; stay at ${height} m.`,
      `${label}: ${deg(target.sweep)}° у позначеному напрямку, ${m(target.radiusMin)}–${m(target.radiusMax)} м від центра; висота ${height} м.`,
    );
    if (target.entryBearing !== null)
      objective += t(' Begin at the marked entry.', ' Почніть у позначеному вході.');
    if (target.noseToward)
      objective += t(' Keep the nose toward the landmark.', ' Тримайте ніс до орієнтира.');
    if (target.coupled)
      objective += ` ${rotationName(target.coupled)} ${deg(target.coupled.angle)}° ${t('along the path.', 'уздовж траєкторії.')}`;
    const winding = Math.max(0, skill?.path?.winding ?? 0);
    progress = active
      ? Math.min(
          clamp(winding / target.sweep),
          clamp((skill?.path?.checkpoint ?? 0) / (target.sweep / 9000)),
        )
      : 0;
    detail = `${deg(winding)}° / ${deg(target.sweep)}° ${t('path', 'траєкторії')}`;
    if (target.coupled) {
      detail += ` · ${deg(skill?.rotation?.angle)}° / ${deg(target.coupled.angle)}° ${t('body', 'корпусу')}`;
      progress = Math.min(progress, clamp((skill?.rotation?.angle ?? 0) / target.coupled.angle));
    }
    if (target.axialMin || target.axialMax) {
      const axis = ['x', 'y', 'z'].find((value) => !target.plane.includes(value));
      const sign = target.axialMax <= 0 ? -1 : 1;
      const low = sign < 0 ? -target.axialMax : target.axialMin;
      const high = sign < 0 ? -target.axialMin : target.axialMax;
      const travel = active ? ((state?.position?.[axis] ?? 0) - skill.startAxis) * sign : 0;
      const travelLabel = direction(axis, sign);
      objective += t(
        ` Gain ${m(low)}–${m(high)} m ${travelLabel} gradually through the path.`,
        ` Поступово пройдіть ${m(low)}–${m(high)} м ${travelLabel} вздовж траєкторії.`,
      );
      detail += ` · ${m(travel)} ${t('m', 'м')} ${travelLabel}`;
    }
    hint = t(
      'Keep the path, nose direction and body rotation together. Return to the entry if progress resets.',
      'Поєднуйте траєкторію, напрямок носа й оберт корпусу. Якщо поступ скинувся, поверніться до входу.',
    );
  } else {
    label = t(
      `Cross ${direction(target.axis, target.direction)}`,
      `Перетніть ${direction(target.axis, target.direction)}`,
    );
    const location =
      target.axis === 'y'
        ? t(`at ${m(target.at)} m height`, `на висоті ${m(target.at)} м`)
        : t('through the marked plane', 'крізь позначену площину');
    const nose =
      target.forwardTolerance === 9000
        ? t('without pointing the nose against travel', 'не спрямовуючи ніс проти руху')
        : t(
            `with the nose within ${deg(target.forwardTolerance)}° of travel`,
            `з носом у межах ${deg(target.forwardTolerance)}° від напрямку руху`,
          );
    objective = t(
      `${label} ${location}, ${nose}, at least ${m(target.minSpeed)} m/s. Stay inside the marked opening.`,
      `${label} ${location}, ${nose}, щонайменше ${m(target.minSpeed)} м/с. Залишайтеся в позначеному отворі.`,
    );
    const remaining = ((target.at ?? 0) - (state?.position?.[target.axis] ?? 0)) * target.direction;
    detail =
      remaining >= 0
        ? t(`${m(remaining)} m to the plane`, `${m(remaining)} м до площини`)
        : t('Return to the approach side to retry', 'Поверніться на бік заходу для повтору');
    hint =
      target.forwardTolerance === 9000
        ? t(
            'Cross from the approach side in the shown direction. A level nose is allowed; do not point it against travel.',
            'Перетніть із боку заходу у вказаному напрямку. Ніс може бути горизонтальним; не спрямовуйте його проти руху.',
          )
        : t(
            'Cross from the approach side with both travel and nose in the shown direction. Falling in another attitude does not qualify.',
            'Перетніть із боку заходу: рух і ніс мають бути у вказаному напрямку. Падіння в іншому положенні не зараховується.',
          );
  }
  const reasons = {
    'enter-zone': t(
      'Enter the marked airborne zone to begin.',
      'Увійдіть у позначену зону в повітрі.',
    ),
    'airborne-clearance': t(
      'Ground or obstacle contact interrupted the movement. Recover into clear air before retrying.',
      'Контакт із землею чи перешкодою перервав маневр. Відновіть політ у вільному просторі перед повтором.',
    ),
    'outside-zone': t(
      'You left the practice zone. Return to its entry before retrying.',
      'Ви вийшли з навчальної зони. Поверніться до входу перед повтором.',
    ),
    'entry-attitude': t(
      `Start ${pose(target.entryUp)} with rotation settled, inside the marked path band.`,
      `Почніть ${pose(target.entryUp)} без обертання, у позначеній смузі траєкторії.`,
    ),
    'entry-bearing': t(
      'Return to the marked starting point on the path.',
      'Поверніться до позначеної початкової точки траєкторії.',
    ),
    'time-window': t(
      'This attempt took too long. Return to the entry and try the sequence again.',
      'Спроба тривала надто довго. Поверніться до входу й повторіть послідовність.',
    ),
    'rotation-purity': t(
      'Too much reverse or cross-axis rotation. Settle at the entry and follow the shown rotation axis.',
      'Забагато зворотного обертання чи руху іншими осями. Стабілізуйтеся на вході й обертайтеся навколо показаної осі.',
    ),
    'missed-attitude': t(
      'A required intermediate attitude was missed. Return to the entry and follow the full rotation.',
      'Пропущено потрібне проміжне положення. Поверніться до входу й виконайте повний оберт.',
    ),
    'path-envelope': t(
      'Keep the marked distance from the centre and the requested nose direction. Re-enter at the starting point.',
      'Тримайте позначену відстань від центра й потрібний напрямок носа. Почніть знову з точки входу.',
    ),
    'path-direction': t(
      'The path reversed too far. Return to the entry and follow the marked direction.',
      'Траєкторія надто змінилася у зворотний бік. Поверніться до входу й рухайтеся в позначеному напрямку.',
    ),
    'path-axial-progress': t(
      'Travel along the route must develop with the turn. Re-enter and combine both movements.',
      'Рух уздовж маршруту має зростати разом із поворотом. Почніть знову й поєднайте обидва рухи.',
    ),
    'rotation-path-phase': t(
      'Body rotation and path drifted apart. Re-enter and coordinate them through the whole movement.',
      'Оберт корпусу й траєкторія розійшлися. Почніть знову й узгоджуйте їх протягом усього маневру.',
    ),
    'ambiguous-path': t(
      'The path could not be followed continuously. Return to the entry to begin again.',
      'Не вдалося простежити безперервну траєкторію. Поверніться до входу для повтору.',
    ),
  };
  if (skill?.reason && reasons[skill.reason]) hint = reasons[skill.reason];
  if (skill?.status === 'complete') progress = 1;
  else progress = Math.min(0.99, progress);
  return {
    label,
    objective,
    detail,
    hint,
    progress,
    status: skill?.status ?? 'entry',
    reason: skill?.reason ?? null,
  };
}

/** Presentation only: shared game fonts, icons and short menu cues. No simulation input. */
const fontOwners = new WeakMap();
const cueNames = new Set(['focus', 'confirm', 'cancel']);
const now = (win) => win.performance?.now?.() ?? Date.now();

const AUDIO_MIX_KEY = 'revealline.fpv.audio-mix.v1';
const AUDIO_CHANNELS = ['interface', 'motor', 'ambience'];
const audioVolume = (value) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;

/** Shared mix only. Master mute and browser audio activation remain host-owned. */
export function createSimAudioMix({ storage } = {}) {
  let values = { interface: 1, motor: 1, ambience: 1 };
  let localOnly = !storage;
  const refresh = () => {
    if (localOnly) return { ...values };
    try {
      const raw = storage?.getItem(AUDIO_MIX_KEY);
      if (raw && raw.length <= 512) {
        const saved = JSON.parse(raw);
        if (saved?.format === 'SimAudioMix.v1')
          values = Object.fromEntries(AUDIO_CHANNELS.map((key) => [key, audioVolume(saved[key])]));
      } else if (raw === null) values = { interface: 1, motor: 1, ambience: 1 };
    } catch {
      localOnly = true;
      // Retain the current visit's mix when browser storage is unavailable.
    }
    return { ...values };
  };
  refresh();
  return {
    snapshot: () => ({ ...values }),
    refresh,
    set(channel, value) {
      if (!AUDIO_CHANNELS.includes(channel)) throw new TypeError('Unknown simulator audio channel');
      refresh();
      values[channel] = audioVolume(value);
      try {
        storage?.setItem(AUDIO_MIX_KEY, JSON.stringify({ format: 'SimAudioMix.v1', ...values }));
      } catch {
        localOnly = true;
        // Sliders work for this visit even without persistent preferences.
      }
      return { ...values };
    },
  };
}

/** Accessible shared sliders; changing a mix never creates or resumes audio. */
export function mountSimAudioControls({
  root,
  window: win = globalThis.window,
  locale = () => 'en',
  channels = AUDIO_CHANNELS,
  onChange = () => {},
} = {}) {
  const doc = root.ownerDocument;
  let storage;
  try {
    storage = win.localStorage;
  } catch {
    // Preferences are optional; sound controls remain usable.
  }
  const mix = createSimAudioMix({ storage });
  const controls = [];
  const names = {
    interface: ['Interface & feedback', 'Інтерфейс і сигнали'],
    motor: ['Drone motors', 'Мотори дрона'],
    ambience: ['Environment & wind', 'Оточення та вітер'],
  };
  for (const channel of channels) {
    if (!AUDIO_CHANNELS.includes(channel)) continue;
    const label = doc.createElement('label');
    const name = doc.createElement('span');
    const slider = doc.createElement('input');
    const output = doc.createElement('output');
    name.id = `${root.id}-${channel}-label`;
    slider.id = `${root.id}-${channel}`;
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.setAttribute('aria-labelledby', name.id);
    output.setAttribute('for', slider.id);
    // Native slider announces values. Do not add a second live region per tick.
    output.setAttribute('aria-hidden', 'true');
    label.append(name, slider, output);
    root.append(label);
    const input = () => {
      mix.set(channel, Number(slider.value) / 100);
      apply();
    };
    slider.addEventListener('input', input);
    controls.push({ channel, name, slider, output, input });
  }
  function apply() {
    const values = mix.snapshot();
    for (const control of controls) {
      const percent = Math.round(values[control.channel] * 100);
      control.name.textContent = names[control.channel][locale() === 'uk' ? 1 : 0];
      control.slider.value = String(percent);
      control.slider.setAttribute('aria-valuetext', `${percent}%`);
      control.output.textContent = `${percent}%`;
    }
    onChange(values);
  }
  const refresh = () => {
    mix.refresh();
    apply();
  };
  const changed = (event) => {
    if (event.key === AUDIO_MIX_KEY || event.key === null) refresh();
  };
  win.addEventListener('storage', changed);
  win.addEventListener('focus', refresh);
  apply();
  return {
    refresh,
    snapshot: mix.snapshot,
    dispose() {
      win.removeEventListener('storage', changed);
      win.removeEventListener('focus', refresh);
      for (const { slider, input } of controls) slider.removeEventListener('input', input);
      root.replaceChildren();
    },
  };
}

/** Shared observer. Following heading moves the camera, never the drone's full
 * quaternion or its pitch/roll. Rendering cannot mutate supplied flight state. */
export function mountDroneDiagram({ root }) {
  const doc = root.ownerDocument;
  const attributes = new WeakMap();
  const attr = (element, name, value) => {
    let values = attributes.get(element);
    if (!values) attributes.set(element, (values = new Map()));
    const text = String(value);
    if (values.get(name) === text) return;
    values.set(name, text);
    element.setAttribute(name, text);
  };
  const style = (element, name, value) => {
    if (element.style[name] !== value) element.style[name] = value;
  };
  const data = (element, name, value) => {
    const text = String(value);
    if (element.dataset[name] !== text) element.dataset[name] = text;
  };
  const text = (element, value) => {
    if (element.textContent !== value) element.textContent = value;
  };
  const svg = (tag, attributes = {}) => {
    const element = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [key, value] of Object.entries(attributes)) attr(element, key, value);
    return element;
  };
  const drawing = svg('svg', {
    viewBox: '0 0 220 160',
    class: 'sim-response-drawing',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  const ground = svg('path', { class: 'sim-response-ground' });
  const groundFar = svg('path', { class: 'sim-response-ground-far' });
  const horizon = svg('path', { class: 'sim-response-horizon' });
  const reference = svg('text', {
    x: 110,
    y: 154,
    'text-anchor': 'middle',
    class: 'sim-response-north',
  });
  const shadow = svg('ellipse', {
    cx: 110,
    cy: 118,
    rx: 30,
    ry: 8,
    class: 'sim-response-shadow',
  });
  const drift = svg('path', { class: 'sim-response-drift' });
  const heightLine = svg('path', { class: 'sim-response-height-line' });
  const heightLabel = svg('text', { x: 9, y: 14, class: 'sim-response-height-label' });
  const mixNote = svg('text', {
    x: 110,
    y: 184,
    'text-anchor': 'middle',
    class: 'sim-response-mix-note',
  });
  const airframe = svg('g', { class: 'sim-response-airframe' });
  const lowerArms = svg('path', { class: 'sim-response-lower-arms' });
  const arms = svg('path', { class: 'sim-response-arms' });
  const sides = Array.from({ length: 4 }, () => svg('path', { class: 'sim-response-body-side' }));
  const body = svg('path', { class: 'sim-response-body' });
  const nose = svg('path', { class: 'sim-response-nose' });
  const rear = svg('path', { class: 'sim-response-rear' });
  // Props-in Quad X, viewed from above: FL/RR clockwise, FR/RL anticlockwise.
  // This is a teaching mix of commands, not simulated motor RPM or ESC output.
  const motorNames = ['front-left', 'front-right', 'rear-left', 'rear-right'];
  const yawMix = [-1, 1, 1, -1];
  const propellers = motorNames.map((name, index) =>
    svg('path', {
      class: 'sim-response-propeller',
      'data-motor': name,
      'data-rotation': yawMix[index] > 0 ? 'ccw' : 'cw',
    }),
  );
  const motorPower = motorNames.map((name) =>
    svg('path', { class: 'sim-response-motor-power', 'data-motor': name }),
  );
  const motorLabels = motorNames.map((name) =>
    svg('text', {
      class: 'sim-response-motor-label',
      'data-motor': name,
      'text-anchor': 'middle',
    }),
  );
  const struts = svg('path', { class: 'sim-response-struts' });
  const thrust = svg('path', { class: 'sim-response-thrust' });
  const frontLeader = svg('path', { class: 'sim-response-front-leader' });
  const frontLabel = svg('text', {
    'text-anchor': 'middle',
    class: 'sim-response-front-label',
  });
  const rearLabel = svg('text', {
    'text-anchor': 'middle',
    class: 'sim-response-rear-label',
  });
  const targetCue = svg('g', { class: 'sim-response-practice-target' });
  const targetOutline = svg('path', {
    class: 'sim-response-target-outline',
    fill: 'none',
    stroke: 'var(--fk-amber, #ffd27c)',
    'stroke-width': 1.5,
    'stroke-dasharray': '4 3',
  });
  const targetMarker = svg('path', {
    class: 'sim-response-target-marker',
    fill: 'none',
    stroke: 'var(--fk-amber, #ffd27c)',
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
  });
  const targetLabel = svg('text', {
    class: 'sim-response-target-label',
    'text-anchor': 'middle',
    fill: 'var(--fk-amber, #ffd27c)',
    stroke: 'var(--fk-panel, #101923)',
    'stroke-width': 3,
    'paint-order': 'stroke',
    'font-family': 'var(--fk-font-mono, monospace)',
  });
  const targetProgress = svg('path', {
    class: 'sim-response-target-progress',
    fill: 'none',
    stroke: 'var(--fk-amber, #ffd27c)',
    'stroke-width': 2,
    'stroke-linecap': 'round',
  });
  targetCue.append(targetOutline, targetMarker, targetLabel, targetProgress);
  airframe.append(
    lowerArms,
    arms,
    ...sides,
    body,
    struts,
    ...motorPower,
    ...propellers,
    rear,
    nose,
    thrust,
  );
  drawing.append(
    horizon,
    groundFar,
    ground,
    reference,
    shadow,
    heightLine,
    drift,
    airframe,
    targetCue,
    frontLeader,
    frontLabel,
    rearLabel,
    ...motorLabels,
    heightLabel,
    mixNote,
  );
  root.append(drawing);
  let disposed = false,
    lastHeading = null,
    lastTick = null,
    lastUpdateKey = '',
    lastPoseKey = '',
    lastGroundKey = '',
    lastThrustKey = '',
    lastDriftKey = '',
    lastResult,
    cachedGroundTile = null;
  const phases = [0, 0, 0, 0],
    previousPower = [0, 0, 0, 0],
    drawnPhases = [NaN, NaN, NaN, NaN];
  // Generic 10-inch True-X proportions: 254 mm props / 420 mm diagonal.
  // Reduce the motor span as the props grow to preserve the observer's fit.
  // These visual dimensions never enter the flight or collision model.
  const motorOffset = 0.58,
    propRadius = (motorOffset * Math.SQRT2 * 254) / 420,
    powerRadius = propRadius + 0.025;
  const corners = [
    [-motorOffset, 0, -motorOffset],
    [motorOffset, 0, -motorOffset],
    [-motorOffset, 0, motorOffset],
    [motorOffset, 0, motorOffset],
  ];
  const finite = (value) => (Number.isFinite(value) ? value : 0);
  const rotation = (orientation) => {
    const values =
      Array.isArray(orientation) && orientation.length === 4
        ? orientation.map(finite)
        : [0, 0, 0, 1];
    const length = Math.hypot(...values);
    const [x, y, z, w] = length ? values.map((value) => value / length) : [0, 0, 0, 1];
    const xx = 1 - 2 * (y * y + z * z),
      xy = 2 * (x * y - z * w),
      xz = 2 * (x * z + y * w),
      yx = 2 * (x * y + z * w),
      yy = 1 - 2 * (x * x + z * z),
      yz = 2 * (y * z - x * w),
      zx = 2 * (x * z - y * w),
      zy = 2 * (y * z + x * w),
      zz = 1 - 2 * (x * x + y * y);
    return ([a, b, c]) => [
      xx * a + xy * b + xz * c,
      yx * a + yy * b + yz * c,
      zx * a + zy * b + zz * c,
    ];
  };
  return {
    update({
      state,
      controls = {},
      locale = 'en',
      unavailable = false,
      referenceOrientation,
      detailScale = 1,
      followHeading = false,
      environmentMotion = false,
      reducedMotion = false,
      immersivePractice = false,
      showMotorDetails = false,
      practiceTarget = null,
    } = {}) {
      if (disposed || !state) return;
      environmentMotion ||= immersivePractice;
      const updateKey = [
        state.ticks,
        ...(state.orientation ?? []),
        ...(referenceOrientation ?? []),
        state.position?.x,
        state.position?.y,
        state.position?.z,
        state.velocity?.x,
        state.velocity?.z,
        controls.throttle,
        controls.roll,
        controls.pitch,
        controls.yaw,
        locale,
        unavailable,
        detailScale,
        followHeading,
        environmentMotion,
        reducedMotion,
        immersivePractice,
        showMotorDetails,
        practiceTarget?.type,
        practiceTarget?.axis,
        practiceTarget?.at,
        practiceTarget?.minSide,
        practiceTarget?.maxSide,
        practiceTarget?.minY,
        practiceTarget?.maxY,
        practiceTarget?.direction,
        practiceTarget?.angle,
        practiceTarget?.up,
        practiceTarget?.entryUp,
        practiceTarget?.entryBearing,
        practiceTarget?.ticks,
        practiceTarget?.settleTicks,
        practiceTarget?.plane,
        practiceTarget?.sweep,
        practiceTarget?.radiusMin,
        practiceTarget?.radiusMax,
        practiceTarget?.noseToward,
        practiceTarget?.axialMin,
        practiceTarget?.axialMax,
        practiceTarget?.minA,
        practiceTarget?.maxA,
        practiceTarget?.minB,
        practiceTarget?.maxB,
        practiceTarget?.coupled?.axis,
        practiceTarget?.coupled?.direction,
        practiceTarget?.coupled?.angle,
        state.step,
        state.skill?.index,
        state.skill?.status,
        state.skill?.reason,
        state.skill?.rotation?.angle,
        state.skill?.rotation?.checkpoint,
        state.skill?.path?.winding,
        state.skill?.path?.checkpoint,
        state.skill?.dwell,
        state.skill?.startAxis,
        ...['x', 'y', 'z'].map((axis) => practiceTarget?.center?.[axis]),
        ...['x', 'y', 'z'].flatMap((axis) => [
          practiceTarget?.min?.[axis],
          practiceTarget?.max?.[axis],
        ]),
      ].join('|');
      // Hosts may paint more often than the fixed simulation clock. Repeated
      // samples perform no SVG work; changed attitude/position is never delayed.
      if (updateKey === lastUpdateKey) return lastResult;
      const rotate = rotation(state.orientation);
      const initialForward = rotation(referenceOrientation)([0, 0, -1]);
      const referenceHeading =
        Math.hypot(initialForward[0], initialForward[2]) > 0.0001
          ? Math.atan2(initialForward[0], -initialForward[2])
          : 0;
      const forward = rotate([0, 0, -1]);
      // A vertical nose has no horizontal heading. Keep the last valid camera
      // heading through this small singular region instead of spinning it.
      if (Math.hypot(forward[0], forward[2]) > 0.04)
        lastHeading = Math.atan2(forward[0], -forward[2]);
      const cameraHeading = followHeading ? (lastHeading ?? referenceHeading) : referenceHeading;
      const headingDelta = Math.atan2(
        Math.sin(cameraHeading - referenceHeading),
        Math.cos(cameraHeading - referenceHeading),
      );
      const cosine = Math.cos(cameraHeading),
        sine = Math.sin(cameraHeading);
      const relative = ([x, y, z]) => [cosine * x + sine * z, y, -sine * x + cosine * z];
      const height = Math.max(0, finite(state.position?.y) / 1000);
      const centerX = immersivePractice ? 320 : 110,
        floorY = immersivePractice ? 230 : environmentMotion ? 150 : 118,
        projectionScale = immersivePractice ? 48 : 36;
      // Smoothly auto-frame actual height so a high flight never clips out of
      // the teaching view. This camera framing does not alter the measured m.
      const bodyY = environmentMotion ? floorY - (96 * height) / (height + 4) : 67;
      attr(
        drawing,
        'viewBox',
        immersivePractice ? '0 0 640 360' : environmentMotion ? '0 0 220 200' : '0 0 220 160',
      );
      data(drawing, 'environmentMotion', String(environmentMotion));
      data(drawing, 'reducedMotion', String(reducedMotion));
      data(drawing, 'immersivePractice', String(immersivePractice));
      // The observer is behind (+Z) and slightly above the nose (-Z). Following
      // heading keeps that rear view through turns without levelling the body.
      // Perspective makes the rear motor pair visibly nearer; height and depth
      // remain independent, so pitch cannot read as a flat icon being squashed.
      const projectView = ([x, y, z], floor = false) => {
        const scale = (projectionScale * 5) / (5 - z * 0.9165 - y * 0.4);
        return [centerX + x * scale, (floor ? floorY : bodyY) + (z * 0.4 - y * 0.9165) * scale];
      };
      const project = (value, floor = false) => projectView(relative(value), floor);
      const bodyScale = Math.max(1, Math.min(1.5, finite(detailScale)));
      const bodyPoint = (value) => project(rotate(value.map((n) => n * bodyScale)));
      const pair = (value) => value.map((number) => number.toFixed(2)).join(' ');
      const path = (points, close = false) => `M${points.map(pair).join('L')}${close ? 'Z' : ''}`;
      const bodyPath = (points, close = false) => path(points.map(bodyPoint), close);
      const initialCosine = Math.cos(referenceHeading),
        initialSine = Math.sin(referenceHeading);
      // The ground arrow stays aligned to the starting world heading while the
      // camera follows the nose; its rotation makes yaw visible independently.
      const floorPoint = ([x, y, z]) =>
        followHeading
          ? project(
              [
                (initialCosine * x - initialSine * z) * 0.55,
                y,
                (initialSine * x + initialCosine * z) * 0.55,
              ],
              true,
            )
          : projectView([x, y, z], true);
      const groundOffset = {
        x:
          (initialCosine * finite(state.position?.x) + initialSine * finite(state.position?.z)) /
          1000,
        z:
          (-initialSine * finite(state.position?.x) + initialCosine * finite(state.position?.z)) /
          1000,
      };
      const groundKey = [
        cameraHeading,
        referenceHeading,
        environmentMotion ? groundOffset.x : 0,
        environmentMotion ? groundOffset.z : 0,
        followHeading,
        environmentMotion,
        immersivePractice,
      ].join('|');
      let groundTile = cachedGroundTile;
      if (groundKey !== lastGroundKey) {
        let groundPaths = [
          path(
            [
              [-1.65, 0, -1.6],
              [1.65, 0, -1.6],
              [1.65, 0, 1.5],
              [-1.65, 0, 1.5],
            ].map(floorPoint),
            true,
          ),
          path(
            [
              [-1.65, 0, 0],
              [1.65, 0, 0],
            ].map(floorPoint),
          ),
          path(
            [
              [0, 0, 1.5],
              [0, 0, -1.6],
              [-0.13, 0, -1.25],
              [0, 0, -1.6],
              [0.13, 0, -1.25],
            ].map(floorPoint),
          ),
        ];
        groundTile = null;
        const farPaths = [];
        if (environmentMotion) {
          // One metre tiles are anchored to the world, not integrated a second
          // time from velocity. Camera translation subtracts the actual position.
          // Clip in the ground plane before perspective to keep geometry bounded.
          const groundView = ([x, z]) =>
            relative([initialCosine * x - initialSine * z, 0, initialSine * x + initialCosine * z]);
          const clipGround = (a, b, far = false) => {
            let lo = 0,
              hi = 1;
            for (const [axis, min, max] of [
              [0, immersivePractice ? -12 : -2.4, immersivePractice ? 12 : 2.4],
              [
                2,
                immersivePractice ? (far ? -16 : -5) : -2.8,
                immersivePractice ? (far ? -5 : 2.4) : 1.4,
              ],
            ]) {
              const delta = b[axis] - a[axis];
              if (Math.abs(delta) < 1e-8) {
                if (a[axis] < min || a[axis] > max) return '';
              } else {
                const from = (min - a[axis]) / delta,
                  to = (max - a[axis]) / delta;
                lo = Math.max(lo, Math.min(from, to));
                hi = Math.min(hi, Math.max(from, to));
                if (lo > hi) return '';
              }
            }
            const ends = [lo, hi].map((amount) =>
              projectView(
                a.map((value, i) => value + (b[i] - value) * amount),
                true,
              ),
            );
            if (!immersivePractice) return path(ends);
            // The wider world grid must stay inside the SVG at every heading.
            // Clip the projected segment rather than squeezing world coordinates.
            let first = 0,
              last = 1;
            for (const [axis, min, max] of [
              [0, 16, 624],
              [1, 16, 314],
            ]) {
              const delta = ends[1][axis] - ends[0][axis];
              if (Math.abs(delta) < 1e-8) {
                if (ends[0][axis] < min || ends[0][axis] > max) return '';
              } else {
                const from = (min - ends[0][axis]) / delta,
                  to = (max - ends[0][axis]) / delta;
                first = Math.max(first, Math.min(from, to));
                last = Math.min(last, Math.max(from, to));
                if (first > last) return '';
              }
            }
            return path(
              [first, last].map((amount) =>
                ends[0].map((value, i) => value + (ends[1][i] - value) * amount),
              ),
            );
          };
          const x = groundOffset.x - Math.floor(groundOffset.x),
            z = groundOffset.z - Math.floor(groundOffset.z);
          groundTile = {
            x: Math.round(groundOffset.x),
            z: Math.round(groundOffset.z),
            screen: projectView(
              groundView([
                Math.round(groundOffset.x) - groundOffset.x,
                Math.round(groundOffset.z) - groundOffset.z,
              ]),
              true,
            ),
          };
          groundPaths = [];
          const range = immersivePractice ? 22 : 5,
            span = immersivePractice ? 24 : 6;
          for (let line = -range; line <= range; line++) {
            const segments = [
              [groundView([line - x, -span]), groundView([line - x, span])],
              [groundView([-span, line - z]), groundView([span, line - z])],
            ];
            for (const [a, b] of segments) {
              groundPaths.push(clipGround(a, b));
              if (immersivePractice) farPaths.push(clipGround(a, b, true));
            }
          }
        }
        attr(ground, 'd', groundPaths.join(''));
        attr(groundFar, 'd', farPaths.join(''));
        style(groundFar, 'display', immersivePractice ? '' : 'none');
        style(horizon, 'display', immersivePractice ? '' : 'none');
        const horizonY = floorY - (projectionScale * 5 * 0.4) / 0.9165;
        attr(horizon, 'd', immersivePractice ? `M16 ${horizonY.toFixed(2)}H624` : '');
        lastGroundKey = groundKey;
        cachedGroundTile = groundTile;
      }
      data(ground, 'offsetX', String(groundOffset.x));
      data(ground, 'offsetZ', String(groundOffset.z));
      attr(shadow, 'cx', String(centerX));
      attr(shadow, 'cy', String(floorY));
      attr(
        shadow,
        'rx',
        String(environmentMotion ? (immersivePractice ? 45 : 30) / (1 + height / 18) : 30),
      );
      attr(shadow, 'ry', immersivePractice ? '12' : '8');
      style(shadow, 'opacity', environmentMotion ? String(0.65 / (1 + height / 8)) : '');
      for (const element of [heightLine, heightLabel, mixNote])
        style(element, 'display', environmentMotion ? '' : 'none');
      const heightX = immersivePractice ? 574 : 192;
      attr(
        heightLine,
        'd',
        path([
          [heightX, bodyY],
          [heightX, floorY],
        ]) +
          path([
            [heightX - 4, bodyY],
            [heightX + 4, bodyY],
          ]) +
          path([
            [heightX - 4, floorY],
            [heightX + 4, floorY],
          ]),
      );
      attr(heightLabel, 'x', immersivePractice ? '20' : '9');
      attr(heightLabel, 'y', immersivePractice ? '28' : '14');
      text(
        heightLabel,
        locale === 'uk'
          ? `${height.toFixed(1)} м · авторамка висоти`
          : `${height.toFixed(1)} m · height auto-framed`,
      );
      text(
        mixNote,
        locale === 'uk' ? 'Умовний мікс команд · не об/хв' : 'Illustrative command mix · not RPM',
      );
      attr(mixNote, 'x', String(centerX));
      attr(mixNote, 'y', immersivePractice ? '324' : '184');
      attr(reference, 'x', String(centerX));
      attr(reference, 'y', immersivePractice ? '345' : environmentMotion ? '196' : '154');
      let targetResult = null;
      const target = practiceTarget;
      const skillFeedback = practiceSkillFeedback(target, state, locale);
      let bounds = null;
      if (target?.type === 'gate' && ['x', 'z'].includes(target.axis)) {
        const side = target.axis === 'x' ? 'z' : 'x';
        bounds = {
          min: { [target.axis]: target.at, [side]: target.minSide, y: target.minY },
          max: { [target.axis]: target.at, [side]: target.maxSide, y: target.maxY },
        };
      } else if (target?.type === 'crossing-v1') {
        const [a, b] = ['x', 'y', 'z'].filter((axis) => axis !== target.axis);
        bounds = {
          min: { [target.axis]: target.at, [a]: target.minA, [b]: target.minB },
          max: { [target.axis]: target.at, [a]: target.maxA, [b]: target.maxB },
        };
      } else if (['hold', 'land'].includes(target?.type) || skillFeedback) bounds = target;
      const validBounds =
        bounds &&
        ['x', 'y', 'z'].every(
          (axis) =>
            Number.isFinite(bounds.min?.[axis]) &&
            Number.isFinite(bounds.max?.[axis]) &&
            bounds.min[axis] <= bounds.max[axis],
        );
      style(targetCue, 'display', validBounds ? '' : 'none');
      if (validBounds) {
        const center = Object.fromEntries(
          ['x', 'y', 'z'].map((axis) => [
            axis,
            (target.type === 'land' && axis === 'y'
              ? bounds.min.y
              : (bounds.min[axis] + bounds.max[axis]) / 2) / 1000,
          ]),
        );
        if (target.type === 'path-v1') {
          for (const axis of target.plane) center[axis] = target.center[axis] / 1000;
          const normal = ['x', 'y', 'z'].find((axis) => !target.plane.includes(axis));
          center[normal] =
            Math.max(
              bounds.min[normal],
              Math.min(bounds.max[normal], finite(state.position?.[normal])),
            ) / 1000;
        }
        const targetView = (point) => {
          const [x, , z] = relative([
            point.x - finite(state.position?.x) / 1000,
            0,
            point.z - finite(state.position?.z) / 1000,
          ]);
          const depth = 5 - z * 0.9165;
          const scale = (projectionScale * 5) / Math.max(0.35, depth);
          const altitude = Math.max(0, point.y);
          // Use the same explicit height auto-framing as the observer. A target
          // at the drone's position/height projects onto its body centre.
          const framedHeight = environmentMotion
            ? (96 * altitude) / (altitude + 4)
            : floorY - bodyY + (altitude - height) * projectionScale;
          return {
            point: [
              centerX + x * scale,
              floorY + z * 0.4 * scale - framedHeight * (scale / projectionScale),
            ],
            direction: [x, z * 0.4 - (altitude - height)],
            depth,
          };
        };
        const minX = 18,
          maxX = immersivePractice ? 622 : 202,
          minY = 30,
          maxY = immersivePractice ? 298 : environmentMotion ? 163 : 123;
        const inside = (view) =>
          view.depth > 0.35 &&
          view.point[0] >= minX &&
          view.point[0] <= maxX &&
          view.point[1] >= minY &&
          view.point[1] <= maxY;
        const view = targetView(center);
        const offscreen = !inside(view);
        let screen = view.point;
        let direction =
          view.depth > 0.35 ? [screen[0] - centerX, screen[1] - bodyY] : view.direction;
        if (Math.hypot(...direction) < 1e-6) direction = [0, -1];
        if (offscreen) {
          const originY = Math.max(minY, Math.min(maxY, bodyY));
          const reach = Math.min(
            direction[0]
              ? (direction[0] > 0 ? maxX - centerX : minX - centerX) / direction[0]
              : Infinity,
            direction[1]
              ? (direction[1] > 0 ? maxY - originY : minY - originY) / direction[1]
              : Infinity,
          );
          screen = [centerX + direction[0] * reach, originY + direction[1] * reach];
        }
        const [x, y] = screen;
        if (offscreen) {
          const length = Math.hypot(...direction),
            dx = direction[0] / length,
            dy = direction[1] / length;
          attr(
            targetMarker,
            'd',
            path([
              [x - dx * 11 - dy * 5, y - dy * 11 + dx * 5],
              screen,
              [x - dx * 11 + dy * 5, y - dy * 11 - dx * 5],
            ]),
          );
        } else
          attr(
            targetMarker,
            'd',
            path([
              [x - 5, y],
              [x + 5, y],
            ]) +
              path([
                [x, y - 5],
                [x, y + 5],
              ]),
          );
        // Draw actual target extents only when the entire outline is in view;
        // distant/near-plane volumes use the bounded centre/direction cue.
        let corners =
          target.type === 'gate'
            ? [
                { x: bounds.min.x, y: bounds.min.y, z: bounds.min.z },
                { x: bounds.max.x, y: bounds.min.y, z: bounds.max.z },
                { x: bounds.max.x, y: bounds.max.y, z: bounds.max.z },
                { x: bounds.min.x, y: bounds.max.y, z: bounds.min.z },
              ].map((point) =>
                Object.fromEntries(
                  Object.entries(point).map(([axis, value]) => [axis, value / 1000]),
                ),
              )
            : [
                { x: bounds.min.x / 1000, y: center.y, z: bounds.min.z / 1000 },
                { x: bounds.max.x / 1000, y: center.y, z: bounds.min.z / 1000 },
                { x: bounds.max.x / 1000, y: center.y, z: bounds.max.z / 1000 },
                { x: bounds.min.x / 1000, y: center.y, z: bounds.max.z / 1000 },
              ];
        if (target.type === 'crossing-v1') {
          const [a, b] = ['x', 'y', 'z'].filter((axis) => axis !== target.axis);
          corners = [
            [target.minA, target.minB],
            [target.maxA, target.minB],
            [target.maxA, target.maxB],
            [target.minA, target.maxB],
          ].map(([av, bv]) => ({
            [target.axis]: target.at / 1000,
            [a]: av / 1000,
            [b]: bv / 1000,
          }));
        } else if (target.type === 'path-v1') {
          const [a, b] = [...target.plane];
          const normal = ['x', 'y', 'z'].find((axis) => !target.plane.includes(axis));
          const radius = (target.radiusMin + target.radiusMax) / 2000;
          const start = ((target.entryBearing ?? 0) * Math.PI) / 18000;
          const sweep = (Math.min(36000, target.sweep) * Math.PI) / 18000;
          // A diagram slice of the real path band; the world renderer supplies
          // its full corridor. Use the actual normal-axis location, not a fake pose.
          corners = Array.from({ length: 25 }, (_, index) => {
            const angle = start + (target.direction * sweep * index) / 24;
            return {
              [a]: target.center[a] / 1000 + Math.cos(angle) * radius,
              [b]: target.center[b] / 1000 + Math.sin(angle) * radius,
              [normal]:
                Math.max(
                  bounds.min[normal],
                  Math.min(bounds.max[normal], finite(state.position?.[normal])),
                ) / 1000,
            };
          });
        }
        const outline = corners.map(targetView);
        attr(
          targetOutline,
          'd',
          !offscreen && outline.every(inside)
            ? path(
                outline.map((point) => point.point),
                target.type !== 'path-v1' || target.sweep >= 36000,
              )
            : '',
        );
        if (target.type === 'path-v1' && !offscreen && outline.slice(0, 3).every(inside)) {
          const start = outline[0].point,
            end = outline[2].point;
          const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
          if (length > 0.01) {
            const dx = (end[0] - start[0]) / length,
              dy = (end[1] - start[1]) / length;
            attr(
              targetMarker,
              'd',
              path([
                [end[0] - dx * 8 - dy * 4, end[1] - dy * 8 + dx * 4],
                end,
                [end[0] - dx * 8 + dy * 4, end[1] - dy * 8 - dx * 4],
              ]),
            );
          }
        }
        const distance = Math.hypot(
          center.x - finite(state.position?.x) / 1000,
          center.y - finite(state.position?.y) / 1000,
          center.z - finite(state.position?.z) / 1000,
        );
        const name =
          locale === 'uk'
            ? target.type === 'gate'
              ? 'Брама'
              : target.type === 'land'
                ? 'Посадка'
                : 'Ціль'
            : target.type === 'gate'
              ? 'Gate'
              : target.type === 'land'
                ? 'Land'
                : 'Goal';
        const unit = locale === 'uk' ? 'м' : 'm';
        text(
          targetLabel,
          skillFeedback
            ? `${skillFeedback.label} · ${Math.floor(skillFeedback.progress * 100)}% · ↑${(bounds.min.y / 1000).toFixed(1)}–${(bounds.max.y / 1000).toFixed(1)}${unit}`
            : `${name} ${distance.toFixed(1)}${unit} · ↑${(bounds.min.y / 1000).toFixed(1)}–${(bounds.max.y / 1000).toFixed(1)}${unit}`,
        );
        // Keep instructions in the quiet header. Only the target marker moves:
        // following it with text would obscure the drone and FRONT annotation.
        attr(targetLabel, 'x', centerX);
        attr(targetLabel, 'y', immersivePractice ? 44 : 30);
        attr(targetLabel, 'font-size', immersivePractice ? 11 : 8);
        style(targetProgress, 'display', skillFeedback ? '' : 'none');
        if (skillFeedback) {
          const barY = immersivePractice ? 50 : 35;
          attr(
            targetProgress,
            'd',
            path([
              [centerX - 40, barY],
              [centerX - 40 + 80 * skillFeedback.progress, barY],
            ]),
          );
        }
        data(targetCue, 'offscreen', offscreen);
        data(targetCue, 'type', target.type);
        targetResult = {
          type: target.type,
          center,
          screen,
          distance,
          offscreen,
          ...(skillFeedback ? { skill: skillFeedback } : {}),
        };
      }
      const poseKey = [
        ...(state.orientation ?? []),
        cameraHeading,
        bodyY,
        bodyScale,
        immersivePractice,
        environmentMotion,
      ].join('|');
      const poseChanged = poseKey !== lastPoseKey;
      if (poseChanged) {
        const crosses = (height) =>
          bodyPath([corners[0], corners[3]].map(([x, , z]) => [x, height, z])) +
          bodyPath([corners[1], corners[2]].map(([x, , z]) => [x, height, z]));
        attr(arms, 'd', crosses(-0.025));
        attr(lowerArms, 'd', crosses(-0.06));
        attr(
          struts,
          'd',
          corners
            .map(([x, , z]) =>
              bodyPath([
                [x, -0.06, z],
                [x, 0.11, z],
              ]),
            )
            .join(''),
        );
        const chassis = [
          [-0.1, 0.08, -0.5],
          [0.1, 0.08, -0.5],
          [0.1, 0.08, 0.5],
          [-0.1, 0.08, 0.5],
        ];
        sides.forEach((side, index) => {
          const a = chassis[index],
            b = chassis[(index + 1) % 4];
          attr(side, 'd', bodyPath([a, b, [b[0], -0.06, b[2]], [a[0], -0.06, a[2]]], true));
        });
        attr(body, 'd', bodyPath(chassis, true));
      }
      const throttle = Math.min(1, Math.max(0, finite(controls.throttle)));
      const axis = (name) => Math.max(-1, Math.min(1, finite(controls[name])));
      const power = corners.map(([x, , z], index) =>
        unavailable || throttle === 0
          ? 0
          : Math.max(
              0,
              Math.min(
                1,
                throttle +
                  0.22 *
                    (-Math.sign(x) * axis('roll') +
                      Math.sign(z) * axis('pitch') +
                      yawMix[index] * axis('yaw')),
              ),
            ),
      );
      const powerChanged = power.map((value, index) => value !== previousPower[index]);
      const tick = Number.isSafeInteger(state.ticks) ? state.ticks : 0;
      const delta = lastTick === null ? 0 : tick - lastTick;
      if (delta < 0) phases.fill(0);
      // Integrate display phase, not tick × the latest output. No phase jump
      // when a command changes, no wall-clock drift while paused, and no long
      // catch-up animation after a seek/stall. 50 Hz is the simulation clock.
      // Max 1.5 illustrative revolutions/s keeps a three-blade step below half
      // its repeated shape (60 degrees), even at a 100ms display interval.
      // This deliberately readable animation is not physical motor speed.
      if (!reducedMotion && delta > 0 && delta <= 5)
        phases.forEach((phase, index) => {
          const average = (power[index] + previousPower[index]) / 2;
          const advance = (delta / 50) * average * 2 * Math.PI * 1.5 * -yawMix[index];
          phases[index] = (((phase + advance) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        });
      lastTick = tick;
      previousPower.splice(0, 4, ...power);
      propellers.forEach((propeller, index) => {
        const center = corners[index];
        const rotorPoint = (angle, radius) => [
          center[0] + Math.cos(angle) * radius,
          0.115,
          center[2] + Math.sin(angle) * radius,
        ];
        if (poseChanged || phases[index] !== drawnPhases[index]) {
          attr(
            propeller,
            'd',
            Array.from({ length: 3 }, (_, blade) => {
              const angle = phases[index] + (blade * Math.PI * 2) / 3;
              return bodyPath(
                [
                  rotorPoint(angle - 0.55, 0.035),
                  rotorPoint(angle - 0.18, propRadius * 0.52),
                  rotorPoint(angle - 0.025, propRadius),
                  rotorPoint(angle + 0.025, propRadius),
                  rotorPoint(angle + 0.18, propRadius * 0.52),
                  rotorPoint(angle + 0.55, 0.035),
                ],
                true,
              );
            }).join(''),
          );
          drawnPhases[index] = phases[index];
        }
        data(propellers[index], 'power', power[index].toFixed(4));
        data(propellers[index], 'phase', phases[index].toFixed(6));
        style(propellers[index], 'opacity', String(0.45 + power[index] * 0.55));
        if (poseChanged || powerChanged[index])
          attr(
            motorPower[index],
            'd',
            bodyPath(
              Array.from({ length: 21 }, (_, part) =>
                rotorPoint(-Math.PI / 2 + (Math.PI * 2 * power[index] * part) / 20, powerRadius),
              ),
            ),
          );
        style(motorPower[index], 'opacity', power[index] ? '1' : '0');
        style(motorLabels[index], 'display', showMotorDetails && environmentMotion ? '' : 'none');
        if (showMotorDetails && environmentMotion) {
          const label = bodyPoint([center[0], 0.08, center[2]]);
          attr(motorLabels[index], 'x', label[0].toFixed(2));
          attr(
            motorLabels[index],
            'y',
            Math.min(
              immersivePractice ? 314 : environmentMotion ? 172 : 130,
              label[1] + 14,
            ).toFixed(2),
          );

          text(
            motorLabels[index],
            `${yawMix[index] > 0 ? '↺' : '↻'} ${Math.round(power[index] * 100)}%`,
          );
        }
      });
      if (poseChanged) {
        attr(
          nose,
          'd',
          bodyPath(
            [
              [-0.1, 0.1, -0.5],
              [0, 0.1, -0.64],
              [0.1, 0.1, -0.5],
            ],
            true,
          ),
        );
        attr(
          rear,
          'd',
          bodyPath([
            [-0.1, 0.1, 0.51],
            [0.1, 0.1, 0.51],
          ]),
        );
      }
      const front = bodyPoint([0, 0.1, -0.72]),
        back = bodyPoint([0, 0.1, 0.7]);
      const labelY = Math.min(
        immersivePractice ? 314 : environmentMotion ? 172 : 109,
        Math.max(12, front[1] - 10),
      );
      attr(frontLabel, 'x', front[0].toFixed(2));
      attr(frontLabel, 'y', labelY.toFixed(2));
      text(frontLabel, locale === 'uk' ? 'ПЕРЕД' : 'FRONT');
      attr(rearLabel, 'x', back[0].toFixed(2));
      attr(
        rearLabel,
        'y',
        Math.min(
          immersivePractice ? 316 : environmentMotion ? 174 : 112,
          Math.max(12, back[1] + 13),
        ).toFixed(2),
      );
      text(rearLabel, locale === 'uk' ? 'ЗАД' : 'REAR');
      attr(frontLeader, 'd', path([front, [front[0], labelY + 3]]));
      const up = rotate([0, 1, 0]),
        inverted = up[1] < 0;
      data(drawing, 'inverted', String(inverted));
      data(drawing, 'referenceHeading', String((referenceHeading * 180) / Math.PI));
      data(drawing, 'cameraHeading', String((cameraHeading * 180) / Math.PI));
      const headingDegrees = Math.round((headingDelta * 180) / Math.PI);
      text(
        reference,
        followHeading
          ? `${locale === 'uk' ? 'Поворот від старту' : 'Turn from start'} ${headingDegrees > 0 ? '+' : ''}${headingDegrees}°`
          : locale === 'uk'
            ? 'Початковий напрямок ↑'
            : 'Start heading ↑',
      );
      const thrustKey = `${poseKey}|${throttle}`;
      if (thrustKey !== lastThrustKey) {
        const thrustEnd = 0.38 + throttle * 0.75;
        attr(
          thrust,
          'd',
          bodyPath([
            [0, 0, 0],
            [0, thrustEnd, 0],
          ]) +
            bodyPath([
              [-0.1, thrustEnd - 0.15, 0],
              [0, thrustEnd, 0],
              [0.1, thrustEnd - 0.15, 0],
            ]),
        );
        lastThrustKey = thrustKey;
      }
      style(thrust, 'opacity', unavailable ? '0' : String(0.25 + throttle * 0.75));
      const vx = finite(state.velocity?.x) / 1000,
        vz = finite(state.velocity?.z) / 1000;
      const driftKey = `${groundKey}|${vx}|${vz}`;
      if (driftKey !== lastDriftKey) {
        const speed = Math.hypot(vx, vz),
          distance = Math.min(1.6, speed / 4);
        const end = project(
          speed > 0.05 ? [(vx / speed) * distance, 0, (vz / speed) * distance] : [0, 0, 0],
          true,
        );
        const dx = end[0] - centerX,
          dy = end[1] - floorY,
          length = Math.hypot(dx, dy) || 1;
        const ax = dx / length,
          ay = dy / length;
        attr(
          drift,
          'd',
          path([[centerX, floorY], end]) +
            path([
              [end[0] - ax * 7 - ay * 4, end[1] - ay * 7 + ax * 4],
              end,
              [end[0] - ax * 7 + ay * 4, end[1] - ay * 7 - ax * 4],
            ]),
        );
        style(drift, 'opacity', speed > 0.05 ? '1' : '0');
        lastDriftKey = driftKey;
      }
      lastUpdateKey = updateKey;
      lastPoseKey = poseKey;
      lastResult = {
        inverted,
        referenceHeading,
        cameraHeading,
        headingDelta,
        height,
        groundOffset,
        groundTile,
        bodyCenter: [centerX, bodyY],
        motorMix: motorNames.map((name, index) => ({
          name,
          power: power[index],
          phase: phases[index],
          rotation: yawMix[index] > 0 ? 'ccw' : 'cw',
        })),
        front,
        rear: back,
        left: bodyPoint([-motorOffset, 0, 0]),
        right: bodyPoint([motorOffset, 0, 0]),
        practiceTarget: targetResult,
      };
      return lastResult;
    },
    dispose() {
      disposed = true;
      drawing.remove();
    },
  };
}

/** Read-only view: quaternion geometry and measured motion, never flight input. */
export function mountDroneResponse({ root, window: win = globalThis.window, onHide = () => {} }) {
  const doc = root.ownerDocument;
  const node = (tag, className) => {
    const value = doc.createElement(tag);
    if (className) value.className = className;
    return value;
  };
  const set = (element, value) => {
    if (element.textContent !== value) element.textContent = value;
  };
  root.classList.add('sim-drone-response');
  root.removeAttribute('aria-live');
  const heading = node('div', 'sim-response-heading');
  const title = node('strong');
  const close = node('button', 'sim-response-close');
  close.type = 'button';
  close.textContent = '×';
  heading.append(title, close);
  const drawing = node('div', 'sim-response-visual');
  const diagram = mountDroneDiagram({ root: drawing });
  const viewLabel = node('p', 'sim-response-view');
  const inputLabel = node('p', 'sim-response-input');
  const motion = node('p', 'sim-response-motion');
  const detail = node('p', 'sim-response-detail');
  const status = node('p', 'sim-response-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  root.replaceChildren(heading, drawing, viewLabel, inputLabel, motion, detail, status);
  let disposed = false,
    previousState = '',
    candidateState = '',
    candidateSince = 0;
  const hide = () => onHide();
  close.addEventListener('click', hide);
  root.hidden = true;
  return {
    update({
      state,
      controls = {},
      source = 'keyboard',
      unavailable = false,
      locale = 'en',
      display = 'compact',
      scale = 'standard',
      mode = 'self-level',
      guideOpen = false,
      referenceOrientation,
      reducedMotion = false,
    } = {}) {
      if (disposed) return;
      root.hidden = !state || display === 'off';
      if (root.hidden) return;
      const t = (en, uk) => (locale === 'uk' ? uk : en);
      const finite = (value) => (Number.isFinite(value) ? value : 0);
      const clamp = (value, min, max) => Math.min(max, Math.max(min, finite(value)));
      const { inverted } = diagram.update({
        state,
        controls,
        locale,
        unavailable,
        referenceOrientation,
        reducedMotion,
        followHeading: true,
        detailScale: display === 'compact' ? 1.4 : 1,
      });
      const thrustValue = clamp(controls.throttle, 0, 1);
      const vx = finite(state.velocity?.x) / 1000,
        vy = finite(state.velocity?.y) / 1000,
        vz = finite(state.velocity?.z) / 1000;
      const speed = Math.hypot(vx, vz);
      const angular = ['pitch', 'roll', 'yaw'].filter(
        (key) => Math.abs(finite(controls[key])) >= 0.08,
      );
      const axisNames = {
        pitch: t('pitch', 'тангаж'),
        roll: t('roll', 'крен'),
        yaw: t('yaw', 'рискання'),
      };
      const command = angular.length
        ? angular.map((key) => `${axisNames[key]} ${Math.round(controls[key] * 100)}%`).join(' · ')
        : t('Rotation sticks centred', 'Стіки обертання в центрі');
      const phase = guideOpen ? 'guide' : state.status;
      const phaseText = unavailable
        ? t('Radio unavailable', 'Пульт недоступний')
        : phase === 'active'
          ? ''
          : ['paused', 'guide'].includes(phase)
            ? t('Paused · actual pose retained', 'Пауза · фактичне положення')
            : phase === 'ready' || phase === 'disarmed'
              ? t('Motors off', 'Мотори вимкнено')
              : t('Flight ended', 'Політ завершено');
      const travel =
        vy > 0.08
          ? t('climbing', 'набір висоти')
          : vy < -0.08
            ? t('descending', 'зниження')
            : t('vertical speed near zero', 'вертикальна швидкість близька до нуля');
      root.dataset.display = display === 'learning' ? 'learning' : 'compact';
      root.dataset.scale = scale === 'large' ? 'large' : 'standard';
      root.dataset.inverted = String(inverted);
      root.dataset.source = source;
      root.dataset.phase = phase;
      root.classList.toggle('input-unavailable', unavailable);
      set(title, t('Drone response', 'Реакція дрона'));
      close.setAttribute('aria-label', t('Hide drone response', 'Приховати реакцію дрона'));
      set(
        viewLabel,
        `${inverted ? t('INVERTED · ', 'ДОГОРИ ДНОМ · ') : ''}${t('Rear view · camera follows heading · amber front', 'Вигляд ззаду · камера стежить за курсом · перед жовтий')}`,
      );
      set(
        inputLabel,
        unavailable
          ? t('Input unavailable', 'Сигнал недоступний')
          : `${source === 'recording' ? t('Recorded', 'Запис') : t('Input', 'Сигнал')}: ${t('thrust', 'тяга')} ${Math.round(thrustValue * 100)}%`,
      );
      set(
        motion,
        `${(finite(state.position?.y) / 1000).toFixed(1)} ${t('m', 'м')} · ${vy >= 0 ? '+' : ''}${vy.toFixed(1)} ${t('m/s vertical', 'м/с вертикально')} · ${speed.toFixed(1)} ${t('m/s drift', 'м/с дрейф')}`,
      );
      set(
        detail,
        `${command}. ${t('Thrust follows the amber arrow; cyan shows actual travel.', 'Тяга спрямована за жовтою стрілкою; блакитна показує фактичний рух.')} ${mode === 'acro' ? t('Acro: centred sticks stop requested rotation, not tilt or drift.', 'Acro: центр стіків припиняє задане обертання, а не нахил чи дрейф.') : t('Self-level levels attitude; it does not hold height or position.', 'Самовирівнювання вирівнює дрон, але не утримує висоту чи позицію.')}`,
      );
      root.setAttribute(
        'aria-label',
        `${t('Drone response', 'Реакція дрона')}. ${phaseText} ${inverted ? t('Inverted.', 'Догори дном.') : ''} ${travel}. ${motion.textContent}`,
      );
      // Announce only stable discrete state changes; numeric telemetry is readable on demand.
      const meaningful = `${locale}|${phase}|${unavailable}|${inverted}`;
      const time = now(win);
      if (candidateState !== meaningful) {
        candidateState = meaningful;
        candidateSince = time;
      }
      if (meaningful !== previousState && time - candidateSince >= 650) {
        previousState = meaningful;
        set(
          status,
          [
            phaseText,
            inverted
              ? t('Drone inverted', 'Дрон догори дном')
              : t('Drone upright', 'Дрон у прямому положенні'),
          ]
            .filter(Boolean)
            .join(' · '),
        );
      }
    },
    dispose() {
      disposed = true;
      close.removeEventListener('click', hide);
      diagram.dispose();
      root.replaceChildren();
      root.hidden = true;
    },
  };
}

function bytesOf(asset, win) {
  const raw = win.atob(asset.base64);
  return Uint8Array.from(raw, (character) => character.charCodeAt(0)).buffer;
}

function acquireFonts(doc, win) {
  if (!win.FontFace || !doc.fonts) return () => {};
  let owner = fontOwners.get(doc);
  if (!owner) {
    owner = { users: 0, faces: [], disposed: false };
    fontOwners.set(doc, owner);
    for (const [name, family, weight] of [
      ['ui', 'Field Kit UI', '400 600'],
      ['pixel', 'Reveal Line Pixel', '400'],
    ]) {
      try {
        const face = new win.FontFace(family, bytesOf(SHARED_ASSETS[name], win), {
          weight,
          style: 'normal',
          display: 'swap',
        });
        owner.faces.push(face);
        doc.fonts.add(face);
        face.load().catch(() => {});
      } catch {
        // The CSS stack keeps menus readable when fonts cannot be decoded.
      }
    }
  }
  owner.users++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    owner.users--;
    if (owner.users || fontOwners.get(doc) !== owner) return;
    owner.disposed = true;
    for (const face of owner.faces) doc.fonts.delete(face);
    fontOwners.delete(doc);
  };
}

/**
 * Audio stays opt-in. Hosts may use their existing audio preference by passing
 * enabled and calling setSoundEnabled(); preferenceKey is only for standalone
 * hosts. pause/resume gate menu cues without changing the player's sound choice.
 * Delegated decoration never replaces controls, text, handlers or focus routing.
 */
export function mountSimPresentation({
  root = globalThis.document,
  window: win = root?.defaultView ?? root?.ownerDocument?.defaultView ?? globalThis.window,
  enabled = false,
  preferenceKey = null,
  onSoundChange = () => {},
  volume = 1,
} = {}) {
  const doc = root?.nodeType === 9 ? root : root?.ownerDocument;
  if (!doc || !win) throw new TypeError('Simulator presentation requires a document.');
  const releaseFonts = acquireFonts(doc, win);
  let selected = Boolean(enabled);
  let level = audioVolume(volume);
  if (preferenceKey) {
    try {
      const stored = win.localStorage?.getItem(preferenceKey);
      if (stored === 'on' || stored === 'off') selected = stored === 'on';
    } catch {
      // The host's supplied preference remains valid for this visit.
    }
  }
  let disposed = false;
  let wanted = true;
  let focused = doc.hasFocus?.() ?? true;
  let context;
  let master;
  let generation = 0;
  let lastCueAt = -Infinity;
  let lastPointerAt = -Infinity;
  let lastTrustedAt = -Infinity;
  const voices = new Set();
  const buffers = new Map();
  const active = () => !disposed && selected && wanted && focused && !doc.hidden;

  function stopVoices() {
    for (const source of voices) {
      try {
        source.stop();
      } catch {
        // A one-shot can end immediately before lifecycle suspension.
      }
      source.disconnect();
    }
    voices.clear();
  }

  function synchronize() {
    if (!context || context.state === 'closed') return;
    if (!active()) {
      stopVoices();
      context.suspend().catch(() => {});
    } else context.resume().catch(() => {});
  }

  function initialize(trustedGesture = false) {
    if (context || disposed) return Boolean(context);
    // Hosts may forward a real button activation using click(). A standalone
    // synthetic click without browser activation cannot create an audio context.
    if (
      !trustedGesture &&
      (now(win) - lastTrustedAt > 1000 || win.navigator?.userActivation?.isActive === false)
    )
      return false;
    const AudioContext = win.AudioContext ?? win.webkitAudioContext;
    if (!AudioContext) return false;
    let candidate;
    try {
      candidate = new AudioContext({ latencyHint: 'interactive' });
      master = candidate.createGain();
      master.gain.value = 0.3 * level;
      master.connect(candidate.destination);
      context = candidate;
      const epoch = generation;
      // Decode only after explicit enable. Completion never replays an old click.
      for (const name of cueNames) {
        candidate
          .decodeAudioData(bytesOf(SHARED_ASSETS[name], win))
          .then((buffer) => {
            if (!disposed && generation === epoch && context === candidate)
              buffers.set(name, buffer);
          })
          .catch(() => {});
      }
      return true;
    } catch {
      candidate?.close().catch(() => {});
      context = null;
      master = null;
      return false;
    }
  }

  function play(name) {
    if (!cueNames.has(name) || !level || !active() || context?.state !== 'running') return;
    const buffer = buffers.get(name);
    const time = now(win);
    if (!buffer || voices.size >= 4 || time - lastCueAt < 80) return;
    lastCueAt = time;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(master);
    voices.add(source);
    source.onended = () => {
      voices.delete(source);
      source.disconnect();
    };
    source.start();
  }

  function refresh(target = root) {
    if (disposed) return;
    const decorate = (element) => {
      if (element?.dataset?.simIcon) setMenuIcon(element, element.dataset.simIcon);
    };
    decorate(target);
    for (const element of target.querySelectorAll?.('[data-sim-icon]') ?? []) decorate(element);
  }

  function control(event) {
    const target = event.target?.closest?.('button, a[href], summary, [role="button"]');
    if (!target || (root !== doc && !root.contains(target))) return null;
    if (target.disabled || target.getAttribute('aria-disabled') === 'true') return null;
    return target;
  }
  const unlock = (event) => {
    if (!event.isTrusted) return;
    lastTrustedAt = now(win);
    if (!active() || context) return;
    if (initialize(true)) synchronize();
  };
  const pointer = (event) => {
    lastPointerAt = now(win);
    if (control(event)) unlock(event);
  };
  const key = (event) => {
    if (!event.repeat && control(event)) unlock(event);
  };
  const focus = (event) => {
    if (control(event) && now(win) - lastPointerAt > 150) play('focus');
  };
  const click = (event) => {
    const target = control(event);
    if (!target) return;
    unlock(event);
    if (target.dataset.simSound === 'silent') return;
    play(target.dataset.simSound === 'cancel' ? 'cancel' : 'confirm');
  };
  const blur = () => {
    focused = false;
    synchronize();
  };
  const gainFocus = () => {
    focused = true;
    synchronize();
  };
  const visibility = () => {
    focused = doc.hasFocus?.() ?? focused;
    synchronize();
  };
  const pageHide = () => {
    focused = false;
    synchronize();
  };
  const pageShow = () => {
    focused = doc.hasFocus?.() ?? true;
    synchronize();
  };
  root.addEventListener('pointerdown', pointer, true);
  root.addEventListener('keydown', key, true);
  root.addEventListener('focusin', focus);
  root.addEventListener('click', click);
  doc.addEventListener('visibilitychange', visibility);
  win.addEventListener('blur', blur);
  win.addEventListener('focus', gainFocus);
  win.addEventListener('pagehide', pageHide);
  win.addEventListener('pageshow', pageShow);
  const observer = win.MutationObserver
    ? new win.MutationObserver((records) => {
        for (const record of records) {
          if (record.type === 'attributes') refresh(record.target);
          else
            for (const element of record.addedNodes) if (element.nodeType === 1) refresh(element);
        }
      })
    : null;
  observer?.observe(root === doc ? doc.body : root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['data-sim-icon'],
  });
  refresh();

  return Object.freeze({
    refresh,
    soundEnabled: () => selected,
    volume: () => level,
    setVolume(value) {
      if (disposed) return;
      level = audioVolume(value);
      if (!master || context.state === 'closed') return;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0.3 * level, context.currentTime, 0.025);
      if (!level) stopVoices();
    },
    async setSoundEnabled(value) {
      if (disposed) return false;
      selected = Boolean(value);
      if (preferenceKey) {
        try {
          win.localStorage?.setItem(preferenceKey, selected ? 'on' : 'off');
        } catch {
          // Sound remains usable without persistent browser storage.
        }
      }
      onSoundChange(selected);
      if (!selected) {
        synchronize();
        return true;
      }
      // This method must be called from an explicit player action to unlock sound.
      if (!initialize()) return false;
      synchronize();
      return active();
    },
    pause() {
      if (!wanted) return;
      wanted = false;
      synchronize();
    },
    resume() {
      if (wanted) return;
      wanted = true;
      synchronize();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation++;
      observer?.disconnect();
      root.removeEventListener('pointerdown', pointer, true);
      root.removeEventListener('keydown', key, true);
      root.removeEventListener('focusin', focus);
      root.removeEventListener('click', click);
      doc.removeEventListener('visibilitychange', visibility);
      win.removeEventListener('blur', blur);
      win.removeEventListener('focus', gainFocus);
      win.removeEventListener('pagehide', pageHide);
      win.removeEventListener('pageshow', pageShow);
      stopVoices();
      buffers.clear();
      master?.disconnect();
      context?.close().catch(() => {});
      releaseFonts();
    },
  });
}

// BEGIN SHARED SIM ASSETS — generated by scripts/refresh-fpv-presentation-assets.mjs
// prettier-ignore
const SHARED_ASSETS = {
  "ui": {
    "source": "game/ui/fonts/field-kit/exo2-ui-400-600.woff2",
    "bytes": 76652,
    "sha256": "fce2dc8f15375b66d336c1defbca23dfb2310301b62c822206a0a013d19601ef",
    "license": "OFL-1.1",
    "base64": "d09GMgABAAAAAStsABUAAAAD8FgAASrzAAICjwAAAAAAAAAAAAAAAAAAAAAAAAAAGoVVG4bdLhyTAD9IVkFSiHY/TVZBUjwGYD9TVEFUZCcaAN9QLzwRCAqD/TSDlUwwg4BcATYCJAOgIAuQFAAEIAWJBAfDfQwHW/Cykw6lY/jXFmCNoFNcFpNN5xCT7SiFonDVXyUDZBtuhoZB1bnNo7mvI59JGuYAc1MXi363DQhi1n4z7qX0/////////zewLGJNZxfo7N1xoKDgE61KjBo1v0na/E1bEObgEQjmsYBH6XvSoa8R1JheVSg1iDjAsGlH2SmptloxNhTSxcn0bFbNq58xxnmYLWKMEWXeLJvcD4aDHHlelTTnQyxM9lfTbs5zcG3CKOxCOGoTZaNv1WqX0BVoJo3sHKJTBvM2hnZS5MjLxWXY5zkOx/lwFVBcYdLMr8Y5Zqiuh+NyBDZgW6JHJrsxk0eH/aUJ581fOeE9PAa+up3mOShcvadS3hU4F7yfVNeCY7gM7VJYY48HnLI3QUhCqhSPCsewW8xAYZSeMMUCbKx19gSfJKSzlSScYuJZoWBUadhgjYhf0ktKSpOUj5KEozTCFBOMKg/b38pi5h5Ey86neEjOFK47sRUvmSvH90Qhtp5LZdqqZGKmV19IL1zu8CrfvErhNGqWQqc//wDy63elPlQfi6fFqT5LvtBfdCb2/NSK11Z7+8rcco0V1xzSafdmgiAFQbGkKSQpGMw5GAgD996jwGikUOy1Xqpdap9efWRmP6n2EjB7n+r7FAuN+iz9Rl1i90d5gaNyoHeKUTX5LW8MlvZpF8PZQAxDCKGW9yqpkiqZdNP+bZRv1/V6xxoBIYTwHUQZQvdYn2KMmpmJZ+GcE1FuLelVbf1a/suwP2gf2dscKSIOry9wyyH2yfMMrNTp/kuclhE+/aEeU2hw1O7+a85M7wfxnsZJfQsM5foAKNF0MUxLbHHEdT3nlwRCHOilmeyaeO4llOIgQxT8VH/v7ulJekLLkiyyrTiKHZtD5JBDDrCThp0CUNrvAnHaT5QCctqZuICcRwDs770X6hz6SvkwBzi5LpkAGIfdkMwIhbycVk2+Gb8+FXrNZRULoFVo8sZ/QLrVzCaUhFDEgFxEmuWU4xBbbEgJxYiRElooNYTQRQw9cpEmQizHof05iBztEBv9eIyIgNgQkSZ24BAblvq8e7Cucr0qDg/G7OEBR5X6///c681LCdTGjsACsyQHKNQskCKwYztV4jTbK4RfkpMfaDkETDeyfXh+v/mHrMcLeLxKXtetlwWPeFQJCIoICipG1NQZPd0Uc21srr7+6d90/WfNlS5aNwd9/a2Ka97dSeNfMPqCceMRBhh0lt1CJuLaO6y5eJUNcShgHNTskX1OSCAjI0A/jEQN6vbfCwQIbUJpC5QnXnhiatM/8c3Gm+72u2VyRzMA23RdVmw2VmEUOsWcIm0OqxnGHFYhFsYYFmLFMHKEw47tm7pG14j5nhpzEyuVxBGylgqVFubmPzHBhmBuHWNR1IoaI0bmNnowtjFgo1KqxMBCJdIEAyxQaQsUcaOEMVAMjAIMlMeGCaIiUfqyuFWhUCgUCrUvCoVCoapQVVVVqKqqqqqqqqqqqqoqVFRVFQqF2r0HhUKhRn0dACAwECTa2HaTLMBjy5ZsM7RiyPL0cQj5dvdap9MzKSkWK80yfuMhiFEwQgFKgDIfstr7ZEua2X3/kkNEV8ZGpiRRYsRMsAnO8EpEjY0uajUp6LCCFg2CQdFv3760/JM6DZe1d04Rp38OGICCUmzFINeWi7AOP4w/31z/7y8KWSNrWdWI+p5qVqw/IV7gtwCUzQYnk8xweGYDlSxwM7NfI5oaVaErCYZUOAQGoTzKECQ47nSrmqqqqqoqVBWqqqqqqgqFQqGqUCgUCoVCoVAoFAqFQqFQe9/zDmyDkdgVAlurahEGAJaxk9dq7oWURH6f27/njqALPFk+US9TpSnqFLXZU0PnL1Pr68kUqgQAAiSb83tnVmhvvY217QbBufvmKdPRjqtka5JAAVVZCQHpzBal9Qo5RH3a1HXm7ECXvk8H+IRm/ahT6OUkTgyy+AktQ5yU6Ijmtb0POAwTjwdYcrhdzJlSLAOlcYBLx7Ttde+v3euIF3UWIA7TSLQOzzDe3UPBKEuWIWnKl6l+fQMkJVqSZTnK4cX9KdQ9ns+f1szs7uFwjeGNLYkEgUYDjUZPri2/1L9OVY1U6obo2gNVPGaVTBPthDzHrRhrr7c6f4h1C41MaQVCxZ6/zPn1/brb0yrxEgQkwEdHlAO6rulqQw/9GKyHiSYIVacTA4lqydvHRFIikvC7HbyVjEZRFI1Go2g0iqIoGo2iUTQaRdFoFEXR0Wg0iqJRNIqie35U4booX8APRb8Xt/cu/f+U8bWoSNVVQitCM57xKFQUConEiAiFxu9jswD3ow49r4QGIWEws1PVvDOtlDvzvaXVLdvMYom2GUJwhH+l/3ctulXEnlqGpWIvdW1lcbHv3nT7323E8qyxoOSBSJKisqLGgGss/JDCcv4oHBMEwSQ7uBFszVRW4lpYCE0QBFn4JDO3HTgOn++MiK5dEWT7wduXsk5UqeKLrzp7dlRgIRD7IBD/fzl7uxDhwbshTE5LPTJiaUd89Veb3wMCAAEHnSu8Udbv02/bD0tr03yrt1obJhQJFlqxIEh/CaQABkrA4N7XWSPCtZFgW2fBbKtlJBmb4JeQHLnlWucn/Fq/pELSgW21NMFAgf7HcNFnTNcCItZcXiRUa1uOx7AuF7I1iGAQHlOabOiWaIr+lVt9v2t3/RsSCOMhYxZgTflmSbAVlcNt57wiiqjOTEJDKZNNyL7r9756bgKCIH4JyFWDw8/PpfxCR6oofD+wpKQDt9XvKEf4Strt/y9V+7b3oQATpBMgtftDHcn+X92Qw4w0cUuWLH+3e4KtiWkVQ+FWFV8FQgQKpAQWKAkoyDYASm0QlCwQtNosAKTBIqWWKFlfkj09tDvJcWQ5xO8DgpYbpGS3goOsTnLoH0KUQ/xJtntSiqte9l/Oajm7nHf7v9zOYheS//+qtVZPbwH/v0l3TLBI2RtiURNS10t/Zs/q63nPrCWCAibYJI9Jtjd5h1iF1FFRNLQUnQPJ5NmBXC1UHDqo4ukpGkpOT9F1xAL8A3/P5DrUo0SzAFOssn+tKC2M0iytSBPZFAfgm3/bspaBlVk2Du84F+789Rs1NqcQ8epM+Mu+uf/Yf06MECdihs0OMyyW2Qns+oQ42diJadlESXVln1wlBpstIGKVKFdp0TRXdVeWB9//r6nNO6NalV+8NrpCmN1ioLhjXoEcEKhaSZouSnFr6EMc7ZcVwgKDah/iTpw95Rwfobw+/FSTShm32HXSQ7B70gnojJ+sPCmyMzw65ob5+l//O7Js39qoYy1Wig+gQmp9+5aTLqeTlh0voIXALlJ/sgMPT7gDXizy3yZNk9vaOpQUKuLl+eZE+wMbJDBlAk8ItdX0eiarBBpAJhzPPAC4P8mqaUl3vOp67dcJyCkLOWX+8CD8G0ne21/tZ33M6xACUx00gSYofmTGZoZmBxgzg2bE/pta2s7wcbCLpRJB4EYhUcDgS7lodyU5lFvUhpvC92eo0R35FdJdHqe8RWtnslt3hKvr7WwgIMQIoqXTz+/QzwXnkzhcijP1jrrU4sAIJMKhLH790ulLso4mcTLGotzn7+71d6QtpTbVXUCVLkt1SAZ6XjYWCrBuaEnv8YtA0WhzMxThv/Pl67nD5OeFrWfUGrUiqiIiX1/rs71V1dPdu2tvKRYJTQihCBKCSAgiIYgECSKFSG0R0j0zmfPjc7b2OOErD968Xar9mYWDQOAgcBAodrxYqN9c/0/dUzUzuuabgRYREc0QEVEiokREicBEtIjIQkSzNMtluQyP5Rmxm8vstAbEX2rS/d0gxSDpCzwTz7zAAgMDAQEBAQEBg/V7m8o/d0YCN5JrTxTZITZgohCaeedtdrXsfvWpn2p5u2kFj0dpjIdD6rcmynoPtTXGBHMKIjrMcahhjmG4Wr4ZUvpQm7pDQlKzqxOkmBYCEREkoq+9ntsrMpnCTRcuzI2t4kDRUMEjSASJyv9HrDLfr+l/B0GTLif0epctJ/XueV5rDTGG0sRYm2sIIYrEyIgII+IwjjjCJPvn26xYG3hSlUSJpLBzs68ATz83Xr3P9c2QBKMg2Pv+m5YAgxQiiwKJFCgQCJMJ1BDIKxKoNUMAs9wIYItflIOgqCGEpu6FcL/REB5AAaI6MkPUJw5xJW+IOziHyOcXolhOiAdUh1iOHeIVmRB7gBCH9UIctYrAf21DnHEM8bVLiO/8CSDpFSCohAogQSNogIQWoQVIMEcMCaPRQsJkrJBYMm5IbJg+JLbMEhK2c4QEd64h4TN4SATPMyTChgmJiPmFRNSCQiJ22JBIWUxIZA4fErIlh0TeMkKiaLkhcWyUkFCMFhK1aw2J+j0PiYb1hETTmCFxedMhcWuVkOhfPSTuD4TqoNzOBFC+eEFQEoVGY802c+dTt1GrTr30WVirG/cLgoPJtbhA5o9HZldSSCouqcKMJbUR0325v71Ooh0LWd0zVzVucV3APsfa0Nbh8ot3Z8XPJ91Kr9p5bK0XqIsea0rM/2pqFu9HkqoP1JjigQkQQlF7JJNgT2WFQFmNHluygo9/mmnoBAIIvsw+YKSUuUhVJBY19qZqvraab6+vsH6JABLAQ8oF0J6PkrWk9n20zpcoP6bBbMnwZzMpl2wRAOhFZsZ3HAVeQIFbUBDyCHL69zRF8QFbzI3gCxzga1DCt6Asn3V8RkS6+E4SjpMr6L4/nxyIx/AhyAJFAAii2C/bJ5AQYdLGW2azQ5zoQje4SZgQRpS0EkGBG07H5b+EXr9F0KV4pD6bLn/67ZUgJ/8ECQNCCMFBLvzz8Syu/PEsrvn+zE1c/RoCZ1FzfRa1vw+w7j+IJ+kB8F/LJUFD29T+708aqfS459g/gnHmmlOaxKEM8du9Y/jTNOvF/X4mun9frUDHcqQaQ8Bbp5d3qG8Mthy7RldoJYE83ocziV/TCyEneV/crvBXbSOrVqs2q/zVr4fGkSJZZQ082VolZtZPdA2v6YFT4p7TptvT+DQzp8xH5/J8uATy8jBudbr8Y/6RSL9/k7kpOH72yM2vW0uO7KG9f587zKqOP/JPziHtirjirvatft92EcytdB3mNaaXraR1fD1bLUu5bl/57L2WWZMzvXfdi9B/ep0+rLZM3tFIu2YrU/7YTczSbPF/28XkFABPSFBQUqtOvbKhKho1adWmXacRxptgkm7TxcTl5JVVVNU1tXUNDI1Nzcxt2rJtx659Bw4dO3Xm3I1bd+49elauUpVqNWrVqdeoVbtuPXr16Tdg0JBxE6bMmLNsxao1W7bt2nfo2IlTZ85duHTt1p1HT5698NIrr73x1jvvffLNdz9gNg2NdNRGHSUIRKRk5FTUTCxsYGD2HEChxYrzWLwn8BLkK0BFU6tLtx69+vQbMCxr1tsYkhIoSLA27QYMWjdsxKg3Zs3wBHSXJGuG7XphFE/BfJHlRXVVNzftICwjBFkI6/2gAFV6a1wJ80l5QO5ZZD5mE4omJAKmmMTS4fw4FEj1s6Jf9Xelmcxiz0GLH5tBj02xrd57i9pjtX4S1PKwvC9fxWquCZ2PDSYyGh2JdTKTqpVC7Vqfj/bAFKUTTOZmi5S/cfBUdkKUedqlbSjc3hwbrDxm1faqM+8XNWAB8+1+1k+jUOjkZOFlk/wRyFdDSpij4aiepEtcD1Od1tJBoC0J5pUMtXRNmTfJNaqzeGjlk3GOdpsOeRxJritfTz0joXoUJ1aNYnSKwlycWBNdzkraSN7AyAA747Wy6bNG33id1kTgcX59QhYxcybCgFlnYhbGYzIYT0tFB98Pmv3eFyS7QvcGpJGkrseD6TioSjGmEisnUt0bsOZ7gLG7R1sBWnDlB0ShD7eRLyqCZvIyku+QVjZ70M+DxwPfCWfGD/yQH7lPv5VTfurP8vYj70/ghyHP3z/acovxI2ws5fHiwPFOUscD2w1k+rGV9kUx0jVFClzYDnQ3R5g4FOgE9LcT6tpskbI/SizuP6Ccu49mDBMWGYsEPE0LhU6MA8PpeUhUC9DboqpzprKhKrag49XOTrptiwFbiNtg+1YgAdooG/Cd2N2pWDHYTWaLnnEHWQ8DlzI471lv3GJrMDlVkVt0ECXQd8QRAxhvYIgEzsXGunM1bmsL2gaqoEBarZR+922KZtKN/kGzd5CxJn5lJpA/b9U/xaykqxLvFDI0nwTNJw+9NpWvi/d2BfrvYIW2ZSiRQXuV2MMzkwozgTJdIh/dC8LIpldnpZq2RBq7AosXhAQWDTu3K32CYSEoHgNzOp1USCCdFJrApb4sQ1kP3ZDWfmh8t5iLQltqtcxjD3Uy6oSlztVyofd5jE+QJ/viau9DXhoDj/tmXqbZfNRTD82CCVBLxuKMEVNibLLYyXmbi3TPb/mFxSXHT5aWE8n2r/xeQ6pk6qSLj1Cb9KhfPXcXM/qHUUuxFLjS7/rhAC+VYRARcV32Qwrp9kUCGVIuB0rzjnhdO1ImkgLLjWx8jTevMkonMusVCxPdNqWHDt/1Vvp90lOe0nxStcqmLPHjueUd2wc4eJUN5CBJDEK2y4lOKsNQMiBs1jUqfdPmW9Yyoirs34iZuS61qmWv0KJLLlqV5pVhBp02qgZcfiK0qFpZU14sG6p247Bq2E28WbZAbCH2cPZeAJjDUgz3SPiPgrIJQa0pI+bLsbJ/Ampr5zj0LufEtZ4eoByl31V4BwID0TM405ZSNb0f5lej2BLXyo49aloFYVRaBpHW02RnXz4cuZtV1q2KzzneC2vo+AQ01eUIan19vWpUBaVRhchSFP2H4KK1slrGloimPHdVw43MZKBqaU8cX8FTMYB2djR5elyljtGyhZ80Y9KGNdGkichN+VmUhsMTJ5UVZEocSt/vzypHXcGEnlhlZjulXCSKdDK6MEdW5eC3b7M8W6AUxBZXMy32MDSz4oSVZke46Gpy62RSKnLIYenKcdvb4XtuOR+pif8iIEgvA5PR3hOZjZwaZluBYoNH4sJm+y4uK8HpkmwQpSUbpduEDeqhkSvrLSns+ooyqwIXmSU0ixXcwsamWEXbaKJvgPwkGDVcrledTH4DxZoM6hGAASxiOKMjcrAEKoFyPN1A0s09DDSqM8kCRlem0GGsLQewBMUNbUZKPVhHr6s36xhd9QWwpgjYTK+sEFPGTEX8+oGYtXkqGjmayU+MtZViNf/+MlIa1QAtAwArwFE8gLK63kBWNBYSzxzp98lmJKBA5g/wJs66bJdlXQYlfKslud10JYERfEfzkDFB8faYDepr+MxVYJJ1K3STV29OitsBODuK+xEUeUC2eP8aB/wMJhTIHlfTCmQj+g05lEHmaRQwaHlVRk/A1bElDcfEHkP1uTjhOPHDxUzDIHJzri9HxKH1gKYxOFK3ur4OlAvQbUjY1a0ItbTiidye8OTbAF5loPTMTKUUUQ3IIGzGm50tnTSS7Vx4YDfms5dbFFt10LkesNQlGkKtTQCL3leh4VZdkQoqKGKrlJj6cCza9O+NA8cPJ6GmbtTd9MumAkmnmUA2qRQdem5lkHmvG8Q3WivSZ4hBJ53OdjBP3KrCBxc5k34cy1Q8RVU6DQbtCXTV+gpICoPqUaB4fKBJGwOYH4ZzfIhSkxhmQApAHPNAEkwpIbJYOnJPiq4VoE7LtkHfnCBNj+T+oRzIyKqYDQi9hrnSRYUqjVZCJZEWBhuvH9zAVG6gBkCkG5C0UXLxdExZR7Qii3RAzKMHWGMM7xUhqnaXsKjIccMjUQpAjt0SM8c4PAo33+DmAEILNGlR0FY9CggWYNISAKEOGrQEzKMlACIXEBMi2rwD8BGk51MRLDc/SqMUXia5Ir+W9W6H/vSUxpTj/iyrt1EkFK4vFXIN6HlZMWYpvSstqw9aUNTWsLqxixJnzJlazLq0xvbQslEuFFZS7QgcZ5JzsiPTbaPSzuUyjZVkMfMwP4ZWGtsEav43fe+d9LY1DviiFs5p7ZeSEcMGpbIzG1fYlroKEC4WZqe+On0O4aa130QLtovAJ0rt0ybdgJNkUi6aeiShHGlW6tF3JNZbSSRoEppeVdWZD3LMWU95pmKeSZW0AYT4m+uofVpRQsUXG2qghaP8mOHCI+JWt3yqN1PkKC8Qs/RwrztpgqKE44HvNo2nXIEF1FKEEjhPEZke8ooNoSkPlHAA1sRwjg8A+HzD+qXSjVWZerqAqLkcIGkk1LB/V1+De7b/oI1q0pv8iXjFHt4lOmc3RtARuiDwVIRFBCJWZ/FYQs4skHKTCAb6DCdg9dUYoMqQZoSMxUwyJczOcSQoYVCpTHrZQCgPs5L1aSkl4c4O+Wi7he5qG9JEtGirg6A3JNcLEkMiFok9dBpmLPehiO3a4UcSo3D/HrRm7dV9xvxQQOG65CVPoIGACrvv19jA5CDaExBkU0JDpyqIHvRkq13BF+dYwmz3VcYk0GmZtWckg3Gp6vsdcOtg/hXQZ8Dtj7tBMdlUcS429JeDaH1T1IHwAKimwLnc4iScECK/AkBQd1S3IC5dNTWwGh5H0Hs1jE99+RE1brZ2YVUIjArg+Cqi6l5stY6Vakxkh4mdV2gXVl3rEazIYlg4ghpPMpQnYKvqV/BdxvkeZ9KIUGNkvrWZCAXY1xD0X+o02/3QXxiF65dUPV/StcDeRn3otsNKs5HBNM1ImqCloRW0svBho8ZJGKskDApSB4NqTY2/hBQpQoCcDCZzx5ARKRC4ndymDIgrnyf9TcnRf6WbbKZceuxQJyHOckK/Ewhkp5009clPpts/33WKYMwZdUbPOg1mm6tUGJ5z8IncegqO0kGKSLdjCATwIAPgRkZ45p3NBCwE1CvCtGDiWDumhqwHXRlbUrAk9oCeixMg4sZJuxhJm9669NwYckdJY8SY5gBcydi09EeDZ0PJFEAbRk8OgUuS6PxtXxEDWE4YztMkKiN3DuFRmkLJ0Y8peAxZi9FhAdWNEc1cPWqMhwGin9Kgh+1ejZ8112AZ8vpUQ+QSdZX2wGIBnxy5UDUul0NivETxQqKu0T185I0hYc4qM6xng4qoH3iYUbjw0XyQxr8TiI56LomumhEm1CzxUaiyOjw2r8gZ1kduAz5GaeeIuu2HpSVjSB8lY9gdUYlRe7SEFBQAvOMoxQpWsgC+56tCf8FAEkkbiZ4hWse2nxcRexV8jBN0DA4XKzEotISLhV6EhUZuwhgyxtwxLFY2Kuo7gGwB9fEwugIZIDQkLNylWNDYAxcnmjOoQp3oWRj1tmaQEPvRmTihAYeFa15GeHORHblrpKNSC2TYPS/oxJDiCcSwNpqPUQspZQP53lJLOE0JkxeI8JcyyMn7Q0QpAMpFQV/I7uCI95FaUO3d/RNC/s+BYqXNXPZSSpEGrJG0tVJsoxpxnDJRJhbjwkW3KRus6YDkX1EcxspL0zGDO3L/zCnJgjKT9NK/kCMu/6cUqo4VHueS3b2//EyOkTUmq/dEwGh+Csa86vh6hFFpioVKDyEMNfvl7UdBO+tNkVIyLeFLrifrX69lZKGVpNY6tGWWepEwFLYsErF24GGi1i5K++6XhfZDOhTqhI6D+oyt03bcob7Raj+GuODodxNjNxvVrnPNGJiBhemSVW5H9cs0gq1lN8/k7am0KvfExp4ZWF+vXHa1cYlSuLgiA6nMK3AT82/2ZOjx/AMWqWdxygnXlmRsadBTy8K4c8slXSu8HHdY1bdhR9mwt9MOTuMK0rBqEFCF6p3M2kDG1kZepnJMsLuVZzeTQLO0gWHH/RHKHgWihWCigc3MgmxmR70z8hkayFubCwvpZAImlbwAsvIS0Mj1IivFTA5OrzscHgZR4HrwW2bJqQhxUAA0A0bFHcBqE4LT+cXQAVEC7FHcrcCVcTFxi3TQjUBGpLXM59ehtggb00YJMSpAqKGSGprWBtGWQKBbgPWKHiwMAPZo9NzFJybmkGOJxQwrANsFroHDQ3seDE3ctq775w/C+ASA6C8QSCZcCfKU8YE+Up4MBFUESSSUz7awd+9ETn0r3Yf0TtQ1WCZvT8SBcsFT1S0O4FhNApolP88/Ig5JsGyvziAkO3899oCUnfQurqqBY2scY7jLAPSUYHUxdV3OzgkYjSOW7iP9jYy0XOevLy9QYGhlMCvk7fJzOtqUB3vSMU2leHkvvuFYhNQZivJ07Un4DomgOChjoJyhYm6qqpRBVdFvqX75kHrr2ks16xQWakllhbqDVqaezkE1HMhYKHlZSo1yYdf0CfsORZNDlKspBo3qiA1R6YfTvyfRak/oUCEwqX0fztIAzcj/LINoEbl904B8qkK1jWZc0OwUZSMlrqOl4vu/Qsq0EV2jnzmg2i9iBQ9IJ3u6fF2s3Rtu4kT/kkd3sLrskHvs9DuUOSxp1Su8gSbjUT7WI+4KFsd/H9CNrBeqz5SOhsawxyomcDIqFE90th9ravTGqR+k5DaPb5PCkyWBRSenA1lNgfBQSKaEeCoE/IpqM8+o8ZzQ5tqVjh4mYnqgMxjpGS8h+0QIh/yMZ7ZmuMyYeFbW7g1t8/IOpXPuPNJuk9KRecZB/MV8BtBnZP0HD9gn2JcbaSh1JnSe9q58jcuzkb3/gzEdbNQkCSzisnCb5KaLQWr2nA2+K9CPnUz/FM0lRYDb1xac3MxC6Q7q275M0xfu86usGLSk0qMiD4PVjmHNMhvYttNRk9KzWdISc2I/MUDbWjlgQsc7J4exreiKehsudSQJ865xQ5XGW4+PeevgGbpXAq0E79phfk2uZJfn5hUAKpqlb3dXZR+vEd/bQMU1oWd1X52im+MrXa+8IRKuoRewQaMxxPu0RGRHk2hW3s0ZpddYAG7I/AiekJ8s+wpO9RyXdLhmEqP8bINwcMFofL5R9pDm9e27abEzAvEQ0cWj9/HSszjE3QLean/bi9u/jLCpRftD78qnDt9ry8eCHrtF7107+PdyylViHCkSkoSHmHQ2NjMZQs6md/aPKNK+O/pH4TFKs/QLqoLV1KopL2kwWrxTk4E2Q4pRnLzFWJ0O6gslA7o8JZip9zJzoCxwlguWV+SG1bxv5k3G+spbNoDZyl3vYMkea71cHyDnCOC5Eyddzl/x+uIdrpTctuAhxXM2b8vO84PW6j+Jr38CajxC899U4FsUdFnzBcndpGAGKYN1Q/bLlNusGToLI1yn4hondZASESlt8s8WNJwfkbwOqXTyyOehvdxZu8pSUZeho/NQw43tKaMyBBpFrCxTBK6xyIzkdkzJYnl/q9BJ4tfPOUFn4YdjXOT5CBPZ2d81qybpixzAnZh+QNwyVzJvCDdzmHNbDy6MvHOJQ6B2lQDTTq4VflMKu1G/hrUydxnWiz2U7e/KVxHwyDXejakmhtK0AcU078+ZfS7GzXGLZmhZ1UpqWrNpAzAQzT1UNbNRao96Gl4VR8+ooaNaxvk5EaVN8I4/8rw68xtYyosmaij2K2LBxyfJZ32yfuMrPB8+8g+Gk+d3ka8mbCCigoWo97cY9/xIPEHxBBJU1Ofyy1oZvsqHUlJpvoyjLE/BgqGzol5dFSs+6ks5nyrhKvVPzaZZc5iqgI9VasO9QjLQUHWQnKiRvKO2WqkuF2/1k+2FhtvCWWM/tZhYvDVPUXctBxtK7zQxdms7AXZ2DmfpM3SO6JarZ119YsQ/9ooC+OeFKqnVrIzOqRY+or8ocdO4a6eSKWig5bwZ+hQGVdbsZVTy1mAf/E1mtHWRcuCTQjxGmPYLP6LVKpNQe/SHqhIUze8A9UgebZFJZrVkJ7Bze4plDd310nKYg+pfo4KX+msGbh3F83b/aQ9YalMwwB5da0/4Er2OK5Bvc2iyTz0nTye+yGwq5QDdp6I/1Dy1dt4S/sZpzjVOs4u/RToquDB9rRRmqHIHvSeckRNMhDgZSe0zXZgXYZ8oUsNlcUR8u8ohLOoFuk7UwMjxRiFTsfJFnDTe5kIMKytcV7PMDFrFVZAkxsUdk6KhzNKGwbpjN1E2KD9Udt0P7qADRJYTxHjoXCnNG3ZP7twTL5LoLvbxPDTBTd+nItgM7u7yBlovlPGEBe79P+VblmpW8frvW3vbpu/LtofMcbDmW4d+cNRa/5RjTvdpOyUaTgiTEakfnDHLS38yk+cuoOWSxt1n9bt87hoqv7DynZDSsen+6kN/7bsDbD2iTOdTTYBnT9v42nhl/Myca59f9xS+lfoZZzzpzyPJD/5vOSAvwpOiks6i2+Wq65BSrl2/KJ8vw5pamIX9djkOKkK3fN0lY1/7mQS+iURup+XOZs5zMoJv4oLDv+/BKv3CI0JZucdIPPHdI/o9BXG3lXatzaaFlReggEs/eHPQ8O9RTPpFnSSremooK1l9RfYHotteNKn/v6YpuUMv6uKm3ndG/eHGQ3IfDwAmz5RoWid6c5BF/hEBXQu/FzIrVP5XUzWVvAVDU1ML//7vnthHEtE0AimFYi6ZG3yav8e0Ig+TTVbsTkZ2i8mdRW+mq1vklR1zSGcoIsGZX8K428XZUCaBN18mjdsI/8zqfLKZW5T/4mQ8RW7yUe6wvp9xmr4tL6Eg36eafIZ60p0NAMXktm/yIEq/5+ctbnqDAekcgcIveaQSP2ciMLybMw2veT+zPsTnTfEhc14oRLBdCJryAQXllDDmPOv79Xj4jx0SYRzfV5HeibKKTglj/BDrVwn5U8BbifwlOQ/F+XVaeZACyfw/BlYK0CnBzCM68NLUJQVV3ioP2sPBWTokpbhM//yIlQwIfPgZ3T3YSZSZnUU5Iys/nWxvVHZzaDXhdznHcnvoaZ5DXmqB7dlXefMnfOSAdMUhTVbkJ8mjbf8pRCAMrGAPv4FwSgz6BiOG9bCH56NPzaD5jkkDtJXg7B5hIcnoDsQSmXQpij4eKGqpvEV3HAIHBaMjJgLN67MlDDW7HcdYlF2/moXichXLcBB+84RAAsjKYntX7E489AU7/eE7JDFH4u6cXVNdz+7fUbY20PEQqZoEtzbPOYFu6tFAFpt3TajhEjBzS5kgzAqyY+0vypvTkaM7cgN0lcDLEunZNX8mqlAFjDQWxzSpjpx2pM3a0d4W3B0Lu7YUzsejTOd0BipCro5YPWpgMx/8PaX5z+3o7hY5ddOBowcKcETkR5HZBFWPzf+oZjXYZ8Fc/k4EiPNJ/UirlZaJWCFsTYB8ScupWaLFKgCLtfoLFee1QXGY2JD5cgTBQpdAEy/34u8KH9UKRIxUK7xNHUdNQ70STJakIj0DKo35ko0b5odKnmDF8DhYKVZBVXvGzmNNqD1e1Bmt5S+8LTSY0B27KPhETKauDr4Ce4++RsGPp89UMLqlT27ns/4BDUVldkbLA5VlCtd62CZItr4FnUE8xvhMBbVpg5lG5KliIp3EHEzJjvSxOPWc3TO2fttUB0+wxFQnE6wMVoLVYRfJLYx1YF1YH+qni4bSbn3BniVO031jAz/a+++bZTLO0wzzXl6oiLA0Vlnjkef89O1YVtOVrz3b6wqwDzYMQ730RmOYTIgprU07kRlBHiaiuKTswqciWTM0IIvwd8nTT32Ghdo3K9Ig4uHL9/ShW+UllaVvKe7eW+P11dvk76fH4e3IPT1k77Slcb/z990Xgx/vUZvw3RVJW8wqwSBO6Y8hrkxU7lCvvm+34pD26rPwTPp2X5W0ZFW/ApMaZW2jXWWD5KFhNlT1E39fNC5vy6/r8iyRNKWHySfNfNx8INQi+Cpb2mgrhLJvWwNsA7u2KKrTbjSJfc4MbfQ3Halv1X8imXUuINLl+w3X6yrPtsuWPQR7PrrLb4k+tylZP4GJEO+/UnSAJ3cQVSYLLrU8WedTSIbsJONheWskU5p88kTDaGSEx5yMqrDVB4PGo9PaidhVjCf82RNnlub72Ns3n+QWVuvlRjGmwTU5b+hGOC46MVMhmc5qvI+a/DAXq5MXP84u3yT2MEeEhqkfozZgTbZb8W3z7s1iAe2BRvrOzVrtQHaW7FzfDDwMfH98f4NmXDY3aKHVUtoKn1G0FvXNN91p2g+xn9CO194X3ZMXKDndnX6g7EiHsarfCWjJgLwzLEDpnbuN75QXTF6Ou4tUQJXK6SoDre7q9We4tdZ1kLXrDVbDQBw7w1AW/NiL5vQTbNxpbRdrNyCteyYauiUdZvSn6H+xJ968ONKsc+9v5l5Qk+Rd4/f78p8uhsLekgAbLP3u+0TL5Mt7xNe7l7wU1uuXRK+MQVTE6rX2vIaqnazVvQy02ULKtI+rEbhxMoixbrxNvEkgRZs6ocpG8d45oC3A3hL0VliJGrJt7indttm59vGf2GJ7wDsgAa3I41DsTxlptjORq2k5h9zVBtR2G99D5u5pXK+4sQSrD+lzDzewEP2dFszPEoc2R9MFL+KbXb15xEdHguI4+XdJ5yRbgqfiM+NXSQn063Vc4zeab3MtL857wosxq+vb+bIM+5BVL+zrJENrpS/P8OI2qVGobmylKi9sEkjlJ/u6novLvzA3/aWLBBdr6+MASR72JOtf6WESfhM8WsuCau8hHFPyyDb6If7ZEUj+moA5iLx3qBCH4HUmM5DL5SuOje2ulK3K6zrjq7W3+GRD10zWUuuq++vhgAB1fz1yPtHwnLzDCDkq3vRan6sxeHz+xRNGerLkQPWli27aw4uZ13H2lc5tsng0/yILmYAGM84vOHjli9G5vfcb0YrYbJ12trZNQ9f8eeHtwDfpmDlvdrqle5XhLRVx92QlXRM7zCuHrw2q3vSDTRyFrg0cq0tIjtdXfjiHPvFZ8Hz8JP8UdtrJxUZ8VinrAiPnwiyMXqT4Ho21c0jYOGBP75sEBJJx6WjoZOnPvfnfk9lUUV0gCQx9ZVahukoVtatJzQ0ldy3I60zB9/r6xN/uBqVotGnju395E8xuPpTiW5C8bNGtQN92GunJA6JLOodzVR/P9+y+uUW0AG+enyZs3OdNk+P/+GeDNgUJKnkOOjAPxlF8uzZhECsaPrd5e4O7z8Oud4DvFuEqvqMA7LRqiuo8jHjEsQzIPBx+wuB9BIvliCD3TxEJgwgmwyNq80q3Z2YSB15NkMWwTkjfJdiP+Xb6IArA9ePgBTjie3HYSTKKsjnnfpLtd6Lu89nnW0+SIs6TXnSQMt6I9t3UVxrvr+OsQ2QQ46SOO9ONvs794B5RW6QTH01frIMfI+y/kGN3ll8miJuvueuw+HDMg/Zn8JnJ3WcU6SwxK68vQYqTfnKKefFpaRHZ/aw/UDTbD/k/2hqWgTADwIIHHDwR4YaYWMKJZxdidpNKHOmUwsGUw8scg1cYpY8HvOAOr6IKb7oRDGrDN0rwUlCfWAauFCUuDsECSg4rRNWi1WDL8VKG3gTA4g99YRu2Ir65KLj77ZmhnkLyTWhA3mhaq/b/bTD7Y7v8/tqhZn+v0+2tpcu9d+9ph37oh/uW4uc9sBOpx9gZwgbIWcKJjUuECxdXCU8wAhCQhKGhifLgSYw3PxICPCIjWiwNT+BpS5JNV658ZooUsVSslBUyMhsUVcCoqBw1YnLCNkNk3h1JltwlseK+ZK88l4ZrSp4d0/J998V0xjFB7aSNHKvkwq1TPHhUzotXCj58OiNAUBXChFVFSFg1EVE1xKKrJSHprCy/VS9HTuflyeuCfU51USVlPTp19gyUwAmCm7XBLRxNcBuX4Em4UqlMJlPKzWTm5iILC5mlT84DpVV0uwW0QFkAy40E0G8iZGombG5uzZ52rdnfgTUHOhJx7NiyQ11adrRby7b4EAhnq5PpQl0C4VrdguF6fQLhBmOS/cuiaLdaUug2mzLc60gIPOZClmc8CIFXvFLgNV/F+cAv2T5fGWpRQxVUBRVURy0wVoTagDhPaYhM+EwRiVPBlTSZ0DKmgZsFQnTj0gYRrrHEwWKpAg/RFyKWGuhY6mDSQCGfECP4p4FiMVEwFb4VxmVHwf1yUkE5YjQ8oKSFNqlO1x5NaWGNzmh4UX/mzmNHwysyrfKWegy8C2TqY/20cNwols+NY+Ajk7TwsWkMfGIW4lPzWO5YpoUTVjFw0ibEf22z9q1LZn7yuwS/mC/Brxbi8JPFsvxuJYDfrKb32J84nPMvgKQxAA2kgaMBOiw0yGiZhkjK1UNENEIS1igipjFaEY0jElrVA0XVAaZzea6O5ztXK6bqNHU6XarBOtXoLDp3Xu/CRQ8uXUb37nvz4DF68tS50X4Y/cRPOjfez1IT/Tz2dcOYccVMmVbMjHmZLIBKcN/9OM5symLHMRMnzkVz4RLgybUgULASISACBJCZoKGL4MEjPU+eZfPmXYyH/AoWICAiSnCyECGJQoUWI0xESKLIiF2wiR55FJIsOiRFTJJYsSGZ8MVKkhQhkxKSLTUiR1pIrvQiZcgIyZddpFy5SYjyA35XFPKH4iKVKElUqjQJGbkYFBWJKlVGlKoqGBU1okpTRI3mkFotEX9rDanTnqxDR8g59ESdOiMu6gq5pDuiQU9Io96IJv1lGzCYbMiLJAyMREzMYrANh1zRlWRMT7EmXQ/p01ewGTcSzbsTctfdIq24FzJoMOK++8V4ZTRg3HgZtjwqxQdPS/fRs5J88rw0XFNl2DFdiu9elu6HVyX56XVpeKYy4ZtJ54CX0SE/jSNBhvCfXewZOYc4MnNu8WDsAhPEyOGCQ+yODCCoJPBBPhqkpstCN1tZDq4HmXmWg/UMZmRi6OYmloaaGbZ5gKoEjJ7nx4qzxbX096L+bkknU0IzInf4MiG2n4O+jFuvN8hgFVUqytOkG5TJkJCDNMUIYPppinRgklR5ZRSJzGs0WVdVxz/6r+neLRTRscjp5JdiRU9NLMPppFjMD3ZXiSuiucIVnJyKqeUPEcfM03GHS2nic6tt9z4kxnVRafXQxneuvdZ8x8MNZ5Yssoidtv0DyfcvBfY/OgWQnDZQaLKcwzCTdhWqBChdB0bcoBluu+kJVYKEpg4RJhwlR4nhKDkldpJI4SbSqrDJHVIAKPf/qVCJQpVaERqKjkYUmg+VdOkVAzTHTqiBPJsUiOxDiw6AUJaCI+fAIYmjuZqcUpDi5Ztx4LijtFJsSlC4Eyg2/Xjh1jMr4Kh/XtoQlhwJm9hgTl1PhIOrlgoGPogLSjfCMlxScqVFArQp0SWnWMCfkrNKkRGUD23Jol3ZBO2nHQTCiqhOAaUodDDRyjaSUiQndhTa99TJ6ZYJnkHQSQpRsV+SSqq8WIMWdkZ1c7FOfQ0aoGSNNcdNmrMmnZpasBLJ6A7mXSRWEpQ1ajsD+RkUlp/kTMCSOyQBD66GdeHqUq9lqSCrKQezL7wObpZsDjo2T4kWCOt3p2lYUiwLKjETrEMVvK13wGxsLhPTpI8Yi2SUeRr3FWA2UTOdj8lPKvDpG5g0BQ5NG4vElLmMk9svGjxRD8u8zpcFXZhOT0kruisnQK2CqTXw9wd8/a1X5X/9v/zTf+11RDlcL61avQywV4G7BtWNZ+Z7+8QsVifpCujUkTexaMPvouxZmNf9b6vvMDQk2kzECZ6dCwM/gzCvsxSLbgVmrxrgPuZ7jl+D4A28d2DeY/QBxccG3qLrYVfa+4XDOwDGDiJ6h8BYKTgrQ+yOIn7H6v7n46tgulM7w2lVwHRncWjncGRXX0kC4A243+QXfPBOUZhUqSIWycy34TYC8Fo1DAK2e9sOcCgHgfeNA3fiT2MTzzt3K13XHcaOxSSJp1FHHDabpGXakaDoZWOnrOdm+EKlYh/q4fsFi6mIhI2xpMPjU9rXtpJmbFpFAZLec4+hBW1fbxwVqNI0Plvwrvdtqc8ldu1EJKZCMcFF1upx2kfXOtNLx4ug9Zbq+fTgGcyNEFMVKY2kF9x6zriPACSSAzuxn01M4llg9EJpvdhgoHtAph8xDwOkSES0U8KPBSlfjVxnJU1auawles4/7Txqo44lno6Sn/pmSigqqEZmrtMySWtS5ADTZj2Hvdnkld4hPe2P7UgB1iH0QKHpUnKsXkaPUIFExFIB5rf+dVnoPPrlIgVSbDyszmN2wexJiOV6vPHoTSL3jeGMqDMqj7ecF6078hbUCZBY7E21kiU0TF+S/LQnqtZLStrdTFrWeXb/9D9Dsq9T1QF4K1S6rFPuJzTqTeXo8SY5YnJ9Kd6hrvOQvFPdeBv0atJXAdPltDseFxMOssfQrtG/jD1KVZKuHfWjsdloR0bLU6PJrUjLeYKnoPpaR/UWb6QfehG+x48XhKxMTLV8m8IwfO1zXztX3exXqe/hQcEsmbbl5EXJtH6MC6VzLJqrpyg1vGaL8jyJb7ntg+yKhLWE/gzEQX8XxulHFiWW3nuje5fzWbeKLsC4n7jIpT6VJntXx9vYEVhQcxAdvKDfoH0Dw5HUWz+J58WeDPI61xsG8mDPZ6/cB9BW/SbP/49DgaXO7LSpL93Z8o18LvB9YceO3A+yT1Y53U5YZalW51oCx76z8Q3L/wzaP+vJnkhGw6l9PEdacolewxD7KI3dR5Ug/ESSM0waMaFF2+0N3hp9V+lTCZPrHKtswRh27xJvdej6JN8OYpP+vzstHU6a6Z2E9f5M1J4bOklc34wZm/kmFPdU7Hnit6yOZX3pdU+bk4+EzCPT9A6GI+Xx8vHXBVbQu4FeTVyx9Elia++KF994IV/fcg62aj97o1u/C7Du2siVq7vnPm0SN+5NWL7JErkmPUjR8s7Sc27n2GUmbDhv+9TEvPsUu7c7sPjMpHfVTwPp7Xna103LSz0pCXmUsBE2pHsplbjqPfT6fHyZJ/ayf3BBekXT+abZGwVJXr06Tt6B4tnT3HfA+XyePj6qJMeRutqL25m+ID3DI3woNndzpGuO+M12vaPVE67vvJNwDbjA6ps5n2V6UG7xGtBvKp51pHWTWpyYrqNImer3IFJvXs1PuWyL+f9XpTj972xs8Y1yBRnx+TaAjUmULaFtIhV/jvriCjz1nAK+uqjsTW5XFfTS+N2W8xEOa1aal03InFS4HixD6EnStSESG+/rNUjFr5KU2c1nOPwV7RxxzhzhKS+sgYC2LqKicUXam6zZuxgigE6fZYuUWMM2inhoTuDurWmjKjdGD4ybD2OA8YPdLugJhG7vkQJd+wbpMptlQ4DWWkeulgaoDqVkY6yRZl/ZydvVfF+oMFSGGZegL783OKG/bHCK1gPyGsxZZucrmky46GXQNBKGSOircO0lRZsjLxBWpWp5EfIsrlLnWL/IEXAuuKLTycYcpuhST3FCu5qvr3kr248moYvkOPUQBT0ptYkcje5DmXSKR0cYhgIXPOUGMmtchr7ihDdxeW/yZpEuErIYgD49Zv51FO9gWJeTUeejpuim1URoV/VFQf/cbGtyNK3Ftcn3D/nDzwEL2BQ83Mfb/QK/E5j/igw2FeYsMbjcJXfBZsGI59FATlq0In5zom/2c+OmneHtUZ6egna4SB8KRac9vMMy/tJeKkpIJyfEl5hmNuorlMS28/XExuu2bQAZHpI0gHx0jXZH4h1+JTg6vw2JFEH1t0z4+PZQ8eX7iBO/760nOcwJ4+bWPFVKIRMnJxbGs4dOuenTmAoi62xNLS7uUAfZT71nWc56cgz4P+6p666qDMO6Nc8zL7YWX5AOyqIgDgm6pd+2l9E0wbqQ/2GlHLdoPFJARBGbqv+qge2Pm3m6kesCRZHSzaj/Y1a0h20g7qblCYvZUMlghXA4YZ7qAOuNCu8pe/QIdZaEWVqJArk8y5vTX75HI2Z9HV4HxGi5p6EMdufpGhNSu/4VWwnitj0UGlTRBuyr4lRkWkePBYW2sbhiLqnHokTUnb9OxbbcFJDYPSRmHfOwkYGgm5TJAEyGFcK8B11IjOZZULyqF43DX1mNp+/VV+yXhRtRq4EKez1dJvAMiIBEmVoTS7rNwvSUKkodTMkWa2kWB11NGKjkzB+U2zakG1Ebk2b3prTbfJImi0Rxwz6R/SbRmsO0Dvort9GTJW/asKCn6GyOIOOY+dhl0ID9sug3DTP1SakAIHTOCY3I11yNXtqfAHCUzNAu+y9ZIlqHpJGMWAujq++KQ1xYYqg8tpJZXhuSBFPBUqxDTyukjvK/ZAXGnUlHjqgIs8YQMG/CE7DWkEFsQVQeW0mFTKweNBIHTGgpD/9O6B4/qfgxFCGgjY3YJfjgHbl09Jgct8IYGZchFC+H4KyrkFUv6WdFychxsJey8JvLF6xR0tccpyeGU/E01KNGMOjv6V8NBtyizGY+jpHYtE+d2wcO3Tq59yViXupEyuI3PxtnRN2c0CE8kbu7dYBIHY7C9f1AfWn4bMHkaW4cLKzrQ6wILc4xqbosTa4nsdZiv+g5yyGMq9YG+Ilyc9/frgOpq5AdB/C2SuRosgc8hzhSiVc4X7Pf6XmEpG4nFe/IwtAnGQ8hJFZh3J4eP0Ik3GRYgcCsMeYhaqBRC3y8M6RhtkfXE4TMcEVLfmZ1iByMpmQJPqCQd5gg4j49fVWxbVEyo6zgsvd4bzJsaRfC8Ivl2SURQMt+a8E2x0vmxmnUOzUTh2cM0kPUWYnu2ZyBylt4Y6I4y7O963TT6ff2TjYie+SO5g2S1WNcxtCiGG4AqZGB5p2y4Q7HyirA1XrBSBdBbNo8gJCypOmWP/rZImhOp9UBM3eYigKMClWnBUxbBrn34UeUxJ6jOKXNqQ8pYc2/IZKjYTrzjj1UlLeEpg0HUszJBnqrwpkc7N0K2O1EyApaewi5obQ6KVnWdUmkaAL6zrP8DEcnZEHwggyCrBEKthScCnIk2B1iAJ0Ofw2SScucAO7ILwaQiZyLQNVSnFrJmd7mCtzCe5xzXzdO2jD0+3QLCbSCWrnoYb+NDc1MGLFGW/pwC9DdzrRm9Myb6RRPPqaRpI1zlUa7zHPsT2ctLuN0ZRigwKLAXOWcYeDP3zLCmcUQc3XrxO0gxSYj645DEEi+0iwzF0cDuAlgsIEoLBe9q2eaM3qp3EXAIli2dfWss9wCXbmsJKA3g3MV1lqKKqLpftSbIZjum+d6bYxOF3+POs4Wq0UhrnfdiMZSGEdUQRMVjAb0CKZcCxuMGdIb2VHe+MaIpTXMHLe2Jz0G/G4aDP5JfSd4wBxE/7Pseo4dSbMpJsEhzAYW/G0m8xim3JFAtCwMF/3mLaHklCEbqdtBeKUbBEn6Tf8bqwInnnMDy3dzFUptkzw7muh3i34t5Lzf4RIfYNguwZSj+q8sR4JtXTDa49by7l+ZU477NK2U8zdNbcDV3ThfHC68SFnAMKPpUX0GhWmXzB0dZmpbPIPNrrE6QlVWAnXiMYo8OqjHDdZTg/A8ZSqpJfTks9JBfWdOel4AqpihR+Mp8waRwt3wQT3jxN7WNmMrj2VQWCZabYxFbQl1e1Ikiqsgz8BkKPQUtkzIIjgJJEPLuDmeFsBcif1hKA9ygC2Sayo2ud0dT9TiodgPitZEcBsrsaFmXSKKF919w91YeQEM65TwgHqVhR0OQWrlsCUKeXM4kf0MLlyc+AfzEsH+Itf8LsMcSSN6ghaO+RdpQ5wWMT29npL7HmnzKuU+4Vd5CKzu1fomjCN1c9DiETb6rRRyXQ9rgbF55aM+aWy6aBG69/y4iw8IDTTRUbFS8rUvvb3Jy11TBCJD3bA7zZsIHL/c7ymjtLel0PJ9mMGqRFzzr5+U6iY5h8vnbLuze9GR/8nT2sxFb6B7Vci/kDCqJPrBC2Ri3+2/gA22Ynt40oRmBWWJfk6C52XAHlu0fCJkxKIl9D2x6beFGxUsQiscnrfiwrzQfPO03HLCzbLJUvlUW9vM7rS7BcnKYyuhs2iryKC9ln/chmbzmwOExvk6164MFziv6TgcsebHQNPr/yPvQxDk2J+VNdgYNOogkIohyEU1LGtgaGfvqtvOogiCoBCqhK7bhImRAqBMhSo12nTpsWQFDsWNF5w4j8VLkCgHQYFCJGVq0NSqU49l1i39BsQWvR5QLOMcSFz/reUK/8/yIKZMw0soi/Wcpdp1JW1rydhesgbbNTkPxdyA+ghAOdCGxrFWkVIJhmYYZmYcevIWGrIDnfkKXfkNrnwNq3oSgqoQUoOwujCyt6C9t6GtwtBRMXC1HiYUAJOqbEK/r73CmdBRNExxqqHq8z1ShQumFgXT6wZB3QijioPRjTPe70GvyCB6B3qNGcTuN6/xg3G/17ziObakE+J6KUxsDUwuzUR+T3lFM1kW0N1ZiOmzMK2LMKPL4OmrDa1zWSVQKsGQQUzzHdk1XHm1ZGkYoGm+UDt/U3cv9lQzDuOoGEYV/jfM/QkEtT1o5QrKGaKilAcBmYoQVhBS9br6/t2v878v62aqCN5n75D+V4RpekDRYf7jJbkhDcWLomFf0hbD3eBhr/pX5BOcxDCyONKjOHoDn8ghDAclpF/6CLBypPFseVyJWF+QRG1z/EnYcUkgbdfw/tGZNaSFrLB+XV2Od5l30DLc7jm88kHUScOqynLj09H/vhqwINhuBCP0KeeJFQDcPkSNIhYHXFirp9+W+TUmXDBwXKucCLwa8z+5pkRIs2z45AZpJL3mUi8OQE8IoKFjJQ5Y6nqAQ0T1q+Ljebal+d4F9qq7B91JWWNGpItI4v8kXR0PHaEIzXyyqXQSynOxF2ZHHkwrMN2htb6skI2bKw1HmOtXSHXgp89UAy4VWhGdA/qI+Y1yGM+G0fWpzOEFLvMPVD4bsHi0sii8VJUnqjuyNVvhmVmYZbbKRSwSD5wGz89w+E4beVThax90ALNQEYXY8iIfvv82T7+kSXd/c6Le8tibUe+SWzXzAT3Me0Tq7T5LdPeAPzPqQ9br6RHOeu/hS+mPcvSruhE0ryJLvMuGD7rKJaxCdPDQv626z1D1y8qbNr/j++j9ipsOom/cOsHHqENbf7d1jDf2jLQw//5BJ8fxYdnd9hEg99xT00Z2GF1dBMJ4r+6wVezNb+M8vVeU73f8zA+7ZO+j7g8QTFeZbwkJtkyKD4HOofDP2qVa4QGbVQZetfBLvIf9hpMPi0/LR6WnapvXw8D4NmZAEpgnEFNymaREFDYDINxSFDxZ0j6mlF+zlz0u+4L8oBoc1q8/KqR3mCPfNt9KZDnTRHaTAi6l+mU1B+8Ssc4PcGQLEpaipOVSSCFzDkpkVSAhSemxyS9QmCDMbpU4p1UcsFdRRkRjgWiLlsLizQ1G3qWUYlbeEKhTVTv70dbIE/Qg2vNenrw6guXq+WpRLZbPVfvhcNwY/wuOSif/Qf+FVXW7zOpFne6cjXwEz0yVPkfa/+d7v8KpHX7IRcX/xXP821V15owOS2bbui9t7/h+pIhf9fB4kt71hZpMtaB7A8LyEeZn8wH0XPHH7eVD/PUFwia0xtvmjR707VVd7MKoOYetVmwq/l1xH0cuWmDhwlPnBykwBcbxNflgyXXnPmmxJJ+f4pVOYxA7g5vymealzuJ7GL27wvyRgq9J+N844CRJphN8Jo8Wy2jq/gPcFg2Hy9yfj1T3y9nIuGymX+sQ/DqIkI366Eo4eAwkW3gpyzcjvAmvJao0Npn1TyaloW/Mh2qukfq67iKwXkmpQrgUwrUkfrLTlcH6sSXdmE2xQSOTL4GX9oeXogyGapuZe8MJkqHte0+cOHCm8O1X8Yc9xM5gku6cxmybUc844CxgPb8zQxv32xU4t5JcG2YmG5GC2oWKzez3c3XZ+mKl+f/X89V1seg/x7ehpPvGn0DrqmJXXqVPU6SavAFjkD8dvdZ/fHBPFRo2cPEcLiL9fnaycLna+PsjnQY1L01M7XgDN/ALwqNq9F9Pt4K8hWnbNZopRpYwiLKEQZQlDEqnHKqDcu75Zx+y8WMPYmb2dCU6L+qCclaQglTNRm8sFCK+4io+sjCtr4rX61DOztSqqI6qnG1p1VS8Xoe2E8tm26EuKhVxVjpb27Kzp/qnTP4EwIA1vVvNU5G3u1U45ZHAVCDNF/YEBcyKVFlJT3G1dqywKHBlPinViKFKejPxSb6WE5GwISmQIIXgflO0/kM1YK9kPa/zJm9RyoQakJdXo9YMObMco9sW1ziMR1LU0NGauldNDyCgBwaZvUMi7gcaLwF+zpRF+FHXKZulPNX81GCLMwHgeaVH68CiKxMc0ZHdHdPRWc9a6+CDa1voQrWPPLKO0UbzfC1rRR9zTF3jLMW1uVV4tjaAJdMXYojqJwBkQSPoAhNBD/OPAR4A4QEw3xgCnwLmV4HzL8B8a3BnA+ZrDIbcB1LuCHavKb6jLJlG6Bxkalx3Q2g6Gn6deUVEtykfUSRqw4e52OjPOZjglh6NsN2YIx/mZagRtDiGlSfmHhjGD1Yp2MsaEfP3DEdFDZ0MnaHTb7ezJxzxn2mzOp+juz77ivjRmv9qV52k2O65VVaP3XpeuI2ci2NYoTF3X7bwMy5xbtk1ZMJt6Nqm7QpyDrXAM+7yReyQDxvjlTAZW5deuECPIdSyTJdW2S2AJ91R0VCaiQzwrmqsVLnemcMMSRvIfWSbedWxkF3W4S97i0BzkFeF6QG3ZYQXgN/lfEJNw9/Si+lLDLraHdaUduFfl0fFC0nQ5Vs1t0bZBfm1wcDZM5VDhjgLUqk8okk4kT3qi3WvQIY7DwFxSctufBISduY/KF2MJ1hDhxTHM1QKDG44lDYjasyRXtBfuECXudMUz3HDrLi/DF3mAnmNOrNXArwojj/7vVjWzkiyd4la6NY1uXsCHbnkvFhwOIjv4FT8yHFq9lb7UEkBcV53jqlx1EsD/OLHSN2c8tMwuo9TNp0k2czKNslU4OHWpCXgJbzEuJysRpYT8tzqptSA6/qzdQm1CdxKfVwlBY1mu2mfHwAqc5Z/e2myzoHHTBrr6jlzKLbGUgonurArtgPV562t3HbZUpt0lmeZWrenLK7JU9ZW4zm8m0/lDPtR77QYpVxbG6f8vypOub9ixPjpRJrw7hqa8n5FfvEHifEfJh8igIv5l0C+BvhYlveut43bYuMXQnlD8i1i4/VN4foTv27WNwT8+lMheMPY3CCmuwH7j5nsRCUAnbqD4UZHCGsZSPLq8qEhwTnawZXW6yQHcuqsL91Kwl/h4usJd+hFMht9adr/ndK7yBZnoqg9/P70HL+KizIxDKhItVJIMVkgO07h4/J3rZZy/W0R4tvudy1LkVxwYqSZaC4aTssKxaSbbMqDto9x+P0Q0iJaTLutrRpvabyjsV+7rn2gfah9pH2ifaptaJ81nrar8bV97VA71mdDwGmXGjSjWa3WnOY11ajzpvOh86nzNeRmh+khgj1WDQ2CY+8u6Idxf/RX8QFmYQnWYQdO4Af8RVAZxJ57T7Zf3i9nzNdP9Q688Ji/M8WH/sJiPKHSF/xKxHxc0mx5isN2/qsmeBwCGID5him80I8s5hukgBeeCLgd9Q7JPMhHdCAyxQfwtNRTA1zIc67eJtVH8ILb6WkhWIJzVegmKElyYD38V+jrJPM03FnMz036Xgt9jPhuaVpxIHuVe+amzro8ZvyNCgPY5MiYdUdB07rwwHQoInq6hoMiUTvLZCN8OFMwYcZCwAtX9g7yYV4qGqmZWyUgqGoFwtwd3ua98PVmxzUKztszkBSxlURIxRnaUHsPm3Se8Ez+zFv6DjeZjt7lXTXEj95ukR02vjZ3FOsk5iWykai5VZIFVbeldnQwd1M28BkGOeGhvaPjXuPvFhSJ/ZNxRfrJv9eubLgqV69yyP41v54nBt64Cz1Np6v+wMO4Kmf8rJ/39975dvbRvNS1KIeDQ4MVaycCNVyig6mXdLm3idSe1OfcDqHC0/XIVu6A/6g9kBXMg33APaYlvZx5tBu1xSwHhT1ci5LHg0ODFQsUARsu0W7qQ3po6aRJTMb51STH7nLt6d4KN9YV+/cDeDZ57Q0Tp9sf96jgUgNoAZdpRi6eW1I/1t/Dj0/9XH9J1UjWLzM3v+aOs8ifM47XHfR7PCugmWMvtuv7ULx47RYvpTD0VF9l0D1coZPycbcpneERTZspt3srEJMxu2Tw8rnbfrtfksc5UWkJwrVI85HuYOpEsL2dWt+H9qGGs3/YwY+7QbToHC0DAbZa/WvejJqd6uu8qm+Os/nVFt03zOGEutdOGZBzuiaxSe5SWuKhNp94t3ylIsk1mO+vUNhSjl9bBeO4TstXvx5hVJ/rj+lvD5lL53ve3lglD1nNDFVYcxlAPLUPlyxvRa1Lq8k7TqMiOyyD8foEZkWOVGs+oyevYmszBBDUCZepOljONpLihiLtTmlZy18od+Bc7NzkLWVKEWBJ0nxck7TT+TQ88YCSx3oM9fgOuluW5mvYB4bPpfKh4nUpwtnN1z/ctHcriDxEjdjhDpqYDCDsxg7rGPW51rXUVe3g4sp76Ex6PCcwIKRI5ghahxj2o4XAs5lme1hWV/ixxn8sUlLAThxl1BRpIufprzhDiyzooDKrVLSXJqvYWXTlKjwpAB5xagqJKvhtNMEAT+I48qhyGKRjzlNecM9bU1bjbxlu/Cjfc7e9UQ4+z3APxfJ1brrQWVjmH9Qgp7vHFiHHQ/IcdKabVvyIimPE7aCD3JpUHI02cY73oiVcyxGa5lZtxKcuN6XlmkUqmV7+xoCJpdUZ5kkPm8NkG4enj9ZLnrzvALs7AJKQNJ4sE7q6YDVffG4dkhMuLklGCk/U2SDv3tn73MC2x/yOcDbGGH21Q2ylubm6QUPCNJ4U1GPVNjC1iNL2QFg82d1gKqR2helCJ+qZ1tJYGXt+Lc6fSHBlhza1pXcVEptKwmQsmT3XPqox1TVVTKjGmomZi8QPG5c4o21yjCvdQnHJMp5nkKqlpgcQW34qQqSUGE8Cp7tN1pBFS80+Z5IO5CRJcrO64TbJwW60gwwyPf0sKx1iSG5jKqTB0UKyrW/Dlj5Rt5Y05HM/VdqCze/q1ir3umETOWjOAXAmuJL8pfSunIO8z3zPGSmQlpZp+UdRRjzpWCoZWci5vMmGwXisCO9neSIrQE9FU01GIrvYXTWdeT5bTaxMsg9E8xJ1G9sHi2RkJzoqxaXMHOVc1ujNDHMsbq1M5VnWDBJ5ybmiGBbOyF1MBZIwOZ5sU1DwoxRti5IAtagiDSco4wQz3qEZJ5RxFmacoIx3aMYJjT0Lx/pqMxBmkNTigq64pQvqO4Wjk8iLDeyZRR82g4KoLbJ9pZHmiQTwpMtA7N3qYtJq7kPqci+wn30vHNLgV07md5Pr4YSJEiNOgqQqKdXS72IXs41Zx2xjtjGnMqcy25htlgd/gavFTGPdeAPPmMjcQpmZhgv77p2RveVlR1WB8GH/yMGI19ubjka8Pdx3+tNAF6Ro7G6sLu7t+b6Lce+me1oaTAfTJfd9NE70v2OEh959XNaNv1c9Ex+/ntzwzKfHgw2zn62ZgM8BjoJzX1K+gEw0vaqyrxYPpiuOWmqQhN/koqbWEqaGCTAeE2RcJi4ESCQte6DmCFPHRJkIEzvIvHrTvKsYN3k40ASGkOHM52MO83mYHD23RhoPHjTJQ573eypQWePFL+dccPvO0PnPgn0JoSxSyRdx+ZTPuNFdVde6LMUtP/3v1wrVey1XLGZxS1gyN3Mrt3MnApEOOhWpTFWqQ01NaKnNS4QKYYvLXeH/7vS5CMhIAUpTuiiqMzmCEYpwRCIasYhHIpKRCiKoZCc3eSlJacpCSXlaMUAIeSsghrciQZFJyu5wpdXVVm9DTTTTbP/mBNnFEpK4pJFb/p0YA4+Ykp4VxiMEJDpzvqVSmWAUIm6ZNBKCIp5bLp2ZDsW4WyGDJw4lQrdSJi/6nGK3ShZvfC6pWy2bDyG33K2Rw5cYxbq1ckUYeOjfbp08kxkBFCTOE2i8Z9AEL6CJXkGTHNBkAZoiQSMKNFWDphnQJvKLJvOHpkg0TaEZGs0yyGWRB5DPoQBilziD/S6J648R/r6Uj5mrDlHqMBfwva9U1YRrJOXIXZMgHn1vz1qTAa+6dyKq9R+W6N2vAVAWg249Mkoaeia2HDhz40mxAIjBMC32sGPPiaj1qNwRXEj56L0+oFR81KjNyrTd9dcNzY+hH6wfqGqSYBiyLCjC69T1mN4ho6UQRJLqQpaEholBHCc8MCQMBCe4MaAX4RqpvQ+E6K+KmNBQub14d4ItITzW1mmuaVtwQ1veYptyZr1cecEcJVs+xIaDrW4x0rjOf3hmW9VwocncVRWPBubJyAxcs1UvsnJrTQvRq0YtA+LqElzZSFFepkLaHCmSuUARPr/mKNkygg/yjG1sSYDbMT7hPhI+vsifD5Q6DhQe5Dp2KiZ7xg4bcrBE24zwp1j9hdWOX6N6fN56w5ve8ju/9wd/9Cf/8m/z/M7v/cEf/cmf/YVu++doDH8ij/3N3/0/z/n//mFSFpiYmpljAXMtaCELm2cRFLWRnwYLvaDJgfCc8+fgZXfJ2PJgPvuLud72jr/6m7/7h3+GPO+MkCnW3CUo0hxCDnuslnCIkzNaN8GRHahcjxEiKZtNTDo0oS19VO/Qih/EvItLIBKV93pqPsuhBbm07DeGOvaBP/CBt3U1GJ63ohEjbZAGiN6g6vuYAR/EkCrtsFpvEE9cmqyvV4UTkhJPRloE1qBCSYaI8HOi9n0pxbwfcfYJO/z0c4QJvbE29135bnStASchlu24fBgkHlIgO/yqwAkNYjIgkRfgsmjP6e++R4zLQufenjvhNMF+mLKI5qNMMuskeeD3pBG/biJLlKWucGBdkBPjwuNyWSS8oW0ZbfzjU6w7jq1CQlYC+WLSARLCr3DdtzUN/3CbSTVTk07RZ0YkjezxQShRL3DYuuxOLNlmDsERufX9fGzb7RT3/b8csgUwg7OnSfFnrJcvxc+C/M7ha4JESuvOdMG2YmOiT7C5gSMGD+4i0fYD3YEW2cFH8YzOT47YbSEQKuWhpWckYDzT0sXdIlyTAsKhnWiasaFFiVWJi0NObl+zJUvAKYUp5jhbvjkaSBKX0PQY85VMxrhJzhWlHVMpuRxLpPNZop9syAdRy85F7Kw9ESkxPd9oX5DaLwcTFCxKGknYWwPGwKM03zMiq6z07bQ6IlRm7PQwjn03kjFKSjgoiOhfDr+WnepvN6IiYvLyteR0go9X0KiWf8GLEECzY61jNIZ0bud/q/96G78FGWPvVhUA8+eFtaMVLqNecrFQbWC0vudqM/NP7r5z8bN4r3LjTkj98fI3B/KjryulpA1mKpsM7oMU6EiNlR5nqKrffgBAHqqXjf5Jr/45Kf8SAEIopY83GnGXHPX75hmQ6GPXB6QOjnaqkADomUYC8x/sWDYwMrKQH34r9d0pf1P4uYn7aD1AzF+ftL8C51Tp/1ByGYB85C5gzRciq8p6MDFU6JG/bp0FJ+DdJK8NLs0aIqei6+GCiiPng94DCIAE5HtVdSUi71KVSHT1yyOP8wAP8F85lP7LTpUxVRuXV0Ne0hi16YbndsKf/5vbuwxw2SxGpwmO95+AlagCkVQjuma1re8Ws6q1rW+UGWZ71ps5Y1FLWCpikY1i1KKZkjSHkeERHZkxHMvxGp8Jmej5H4ZfiVVa9Y+t5GeS35nMVrvD7ePHFEKwB19oWHiklukqI49RzCAwyAwag8XgMeQMFcPIwBgDjFHGMkY94wLjMqOJ0cIQMToYPQwJE88kMllMHlPKSmVlsopYOBaBRWbRWCKWi9XEaue++wTyLyMuB1qqXZeJtvpf7GzcHVXPNSquvukvm1vj0niDZnncr3PC3IxUnVMm8ofthFMc2TEaq8FM8GCHsDdWdGVX7WMj+U7ya6NYbHBgl9eXJDCUu/WKigm3POhTdukzJtPPPG6SV7cqWrcpjnMGEiZLvqgZCABdMCfQX33/qe68xccr+L/4vyK/u8FDPMidbnKj//jX/eF+eYtvAfzxDuwcT4m9l/j4XVg6xT6pG2+4/VzjaXRLsJrH8T5Tp+/j3S8tBkT1JSofJONFqBWqLxED7/zbyPmP/2VETqKJN/DGz+cxArwN/C65qvAigI2OXoABxy4OyU9Jy9N+aSpSlZb0hIEStJsE3q/uxJ2esR7wOC1wTddq4x+znBeyyPVc78Ws7/pv4AZv6MZv9hKWug3btn07ABC4DcDd7QSf8IOFYAffcG8+/mun33ucwDs/G/a/dHv11P7+M2YXN0l8FLks1W7hhLxV2i6AC188O5xVq44Hg6QIoKRWRZsecTllY1Nzh47d+den37hlWx49ee2Nb91IkLiGsj3yFw1oVEdt1Cclo2Xi8wCEGw8BCIjylKrRbFhCVk5jokSQEbnIgbsCJxQ6Za904zI+KcElmV7Y47xNHH3QIY2nGRs/aScz2qgCDGuBQhjykmoUlE3SboTx1qqqa1p3jHdFHn0p7lurQ9t27Xurd1/++/1bfhu+LlRBDVyKpAKL/UPr+y+rAtpFCxQsQ9SbpaFr0abDJJLp9AAoCG/SlwJGcsBMASxWCMZyYZniflaSDUGWytqInT3lViqPSytnGrnQaRvt3Bi0g36h7AoGzotpIWzzYxyffeGciuDMJTHXosGKAi0GvATodvMsmXcSXmXyr0RSWYIqllCpnM7I7y+FVSjob2WdV945lM4i16quFrU1ozUg2m3BLmvtrkg3+esXbliqhwo9akqzae3+1Uoutm7OlmYOX2RxkCWVxqetNDsmNQNpsFAmnJCeNnzPECkFsy34+TAviE15IvtDYpWKqlbcFZZuCXRBRW3q2wfbf2RX4FHP1W7tJI5GWV7rFOvtbl7e9YdBc31je/9gd+29w73NnYE2+l7Yn1onAM1gOLuD21KNykdqjVb21Q8/Hd24b65BDWlYPY1oQuMa0zTH98p58uLtoQCBQoQKEy5KgkRJkqVIlSlDulyFigQJRoJBkIMoT74s2QpgRcBLI66YhBKSSkkp25/uQFsSYHmvCPeLaL9FkvbUXWT3PCODQlY5ORXkVVJQRVE1gBrKaFTUUlVHTT11DTQ00tRESzNtrXS10dNOH9BzBugMdTLSxVg3Ez1M9epgpo+5fhYGgAyyNMTKC/cxWGOywQLGZmuYi5e24+AZscMoV2PcjHM3wcPkXosAMcXTNC8zvM3yMcfXPIEFfhatQKWjhbsVQVa9pEzlw3K4VijNDiBbwqyQ2043d4a5AiYAKhaieKgSuZfiYakwpfPtlMxOy+qolI5IrgqpGiVdVNklVdV5Wr1nNajuH421a+qeWHeEGpVpSLIR6R4r9QJoXnOJ/YiBT2H4EoGv6eBbLHwOwttU4V0aeB+CD6lgtnScrPHiUGk1SmvRWoceG6M1qAWyzp9V++EqEpNMSNnCyhFeroj2Cu2AuA6J77An/Q7fQY+7ytY1jnq4us5TH283+Orl7qlKT5R7ptqECegXLFCQEHHiRYkRK1q2XF4O+p3cAYcddchxxf5wTJNW/6hSod059XYyFwZw/wNyCVwOuBzIbbgL7kJycDfcjXTDPXAPMgn3wr1IH9wH9yGLcD/cj7yMB+ABZCoehAeRu/EQPIwMxyPwCNIbj8KjyEo8Bo8ht+NxeBwZgCfgCaQLnoQnkb54Cl5GgTG8AgWRPBSCQsizKAyFkbUoAkWQdSgKRZEeKIZiZAqKozgCUAIlcRuUQincB6VRGo9BGZRFKZRDOVRCeZRHdVRABTRHRVRES1RCJbRGZVRGV1RBFXRHVVTFIFRDNbyL6qiB91ETNTEDtVALS1AbtbEadVAXh1AP9XECDdAAn6IhGpKRaIRGpACN0ZgUowmakA1oiqZkGJqhGfkIzdEc36AFWhJq0AqtCG1ojdaEPrRBW8IS2qEdwYb2aE9shg7oQPDQER0JN3RCJ4KPzuhMBKALuhBB6IquhBjd0I0oRHf0IOToiZ7EEfRCL6IcvdGbqEEf9CWU6If+RDcGYABxFwMxkIzAIAwiZRiMwaQIQzCEvIj38B7pgPfxPumOD/ABWYCJmEiewCRMIgsxGZPJU5iCKeReTMVUMh3TMI0cx3RMJzMwAzOISczETDIBszCLvIQ5mENmYi7mki8wD/PIPZiP+eR5LMBCchMswiLyMRZjMdmBJVhCpmEplpKeWIZl5AyWYzm5EVZgBTGFlVhJ7sQqrCLNYDVWk6awBmvIxbAWa0k+1mEdroH1WI8CgA3YgIsBG7ERN8MmbMJVsBmbcSNswRbcAluxFXfBNmxDQdiO7XgcdmAHnoad2ImXYBd2oSF2YzdqYg/2oDb2Yi/qYh/24VHYj/0YgAM4gAk4iIMYjEM4hKE4jMN4A0dwBGNwFEfJahzDMbyG4ziOTTiBE1iDkziJdTiFU9iA0ziNUziDM3gPZ3GWKMM5nMO/+BAf4lt8hI/wCz7GxwQVPsEn+Buf4lOCgM/wGaECn+NzQgO+wBfEUvgSXxIL4Ct8RSyEr/E1YQbf4BvCCd/iW2ILfIfvCFv4Ht8T9vgBPxB68CN+JET4CT8RyfgZPxNR+AW/EDH4Fb8SefgNvxG78Dt+J2vwB/4gcvAn/iTO4y/8RdTib/xN1OEf/EPU41/8S/TiP/xHFOF//E/0EYAAuB6BCEQAgkAQkEBQEBT4jqAiqHADQgWhgkCEKkIV7kCoIdQQNIQ6Qh3uQdAQNIQmgo6gw70IDYQG9uhSCMmH5IN6SAE7s3fhr6ERUvSh+EnTZykRF7ohpQjEhw4IgTKJYQKEBNuyMB0pRyR5ohNScZ1uCsJchIpSWpiN0JHLCL0IE7WsMA9ho5ITFiNcDPLCQoSPTkHYhAjxWBk2ICJcisMKRIJVadiIyHArD7sgCswqwzJEhVd12IxoCKg9XhBDrNnw7Y4bw/Agm/Acm9cO2NbA2y2HEfwGXsN2bYVtB3y0D+OCcPAfDmv5tyMIHk4L2xmEujVMCcIlZLhcONkOIuWFLUF28JuuYV4QN6J1D5uCeLBHftgXxJP9eoXDQbw5qE84GsSXwwrCkSB+HNI/nA4SwFEDw4UgQZwyOJwPEsJJQ8PZIGEcNzzcDCKkYkRcOBGBM0aG60HEKIwKbwSJpsOY8EqQWNqMC/eDxPO3CeH1IDv5r4nhpSC7aDEpvBZkN+1KwrtBkrlqSvg4SCrXTZv4JEh6+CZIBgMjc63ZloLBsWct3s4C9zw00TFI8VRQEqRsYk2Q8sviPofwTJDzXLRrokaQa6FukG6Y9kwMC9J7GNPsDQT2TUwKciPMCHIToVOha5B/WeVM2B7kJdnWJH4NOYD8hvl7KALkD1x3hisA8R8nvxQHQwJQgV8BqEIaoAY+QB0YB9AAMgRQF6YANIg0ARqCPoCGkWmAerAeoBFkDqBROAXQGHIQoHG4CNAEcjygSfgboFXIBYCm4B+AVpcUOw14ENAM8l9As/AsoDXInYDm4EZA88jVgBbgLkCLyF8BbYHTAG1FDgG0Da4BtB05HdCu4ugRQA4FdCS8B+go5HmAjkMWAroL0g7o7XsCQqfAdAZE54joEoyuQKmOAzXgUPMQjNZoD6s7gEtdcFrCoxV2tIZPG4S0BaDdYkq7z4/U/1jbT/xU/88t8ZMI9yLdjfIi2tMYD2I9rmCIEpzh6l6i0vWKPkNvmnvXyhg5ep3ks41a55tL/mHg8vUM44fTCXKS49MpiNFp7judwW06u7lF5/rCuE8XySXcoMsQpivc33SVO6ZrOEvXS/Zb7tvTNLuzEghvS5BEsv9PlC9UppHZ7h+SjVKxagDjOinjGqngKqmWmluNVr+8kwbR3niSTnQ3AaQXA4SQ4RS1Morl5hFZxRYJZIdMskcGOSCdHKfclVMebArJOS4IIghI5AoMQUEg2JSzgge5IRIqaGSRGwrIHVjyQAR5Ak9eSCMMxMkHxRQMCQpBCWEhSY9QSjhIUTTKiMD9SbmIJCLQlIclyocbFWCZCrkfVAQfInG/qBh+VML9plL4Uxmk6enwiYy79KwkTQHuUXk5dwUgQ5Ul21WALFWXUlMBOaopiqYB8lSLSqqDAtWjihqgSI2opiYAqBk11AJlagWN2qBC7ailDqjSc9QRHWrUiXrqgjp1o4F6oEG9aKQ+aFI/mmgAWjSIZhqCNr1AKzGgS0y0EQt6xC7t7mHyEvrEKegRwIBGQacxGNI4OmkCRjSJLpqCMU2jm2ZgQrPooTmY0jx6aQEdtAgzWkIfLcOcVtBPq7CgNQzQOkD0CoP0Gpb0B4boDazoLV7QBu7TJhi0BWt6Bya9hw19AIs+AkyfwKbPsKUvGCYu7GgbL2kH9vQVHPoGB/qOEfoBR/qJUfoFJ/qNMeLhAe1inPhwpj1M0D5c6ACTdMj9pCP40jEg9Cem6C+40t+Ypn8ApX8xQ/8BRv9jlt0AnN3EHLsFBLuNeSYKJBPDAhMHiklgkclCicmByuShwxTQwhThzpSwwtTgwdSxyt6G6lAFSJthvIXaQE2ii1pQB6hN5iMT2qEeMUd9aAtcUCm2IaAecBFhoQn0RFOyDpdAP1xKNqE59MFfyAa0hP64knCQDaNxPfHFTTAWNxM/5MAEdCCB6AjT0ImEoTNMx60kHLkwE7eRCOTBbtxB8tEV9qAb2YfusA09yF7kw1b0JDL0h+MYQIoxGE5iCCnBULiEYeQ/GA6XUUhKMQLOoIgcw0g4h2JyAqPgCkaTPzEObmM8qcIEuIM7STWmwZuYTi5jBryKmRVlywDv415yDbPhHcwhnZgL72Ee6cKD8CkeIjewGL7HP8h9PEYqsRSuYhmUB5bDv6iAisAz8D9WQAngX/AbVkIpYBX8gdVQGlgDf2ItlAH+DX9hHZQEnoXfsR4KAc/BD3geigAvwE94EYoCL8HP2ADFgI3wCzZBYWAz/Igt0ALYSpZgG7QC/kOWYTt0wP8SC+yABsDLxBCV0Ah4hRhhJzQGXiXG2AVNgNeICXZDQ2APWYS9MBivE2fsg4F4gzjiTViJt4gEb8NqvENSsB8W4F0SiwOwCO+ReByExXifJOAQLMFhshNHYCGOkjgcg7X4gKThOKzHhyQDH8EGfEwy8QlsxKdEis9gHT4n6TgBj3GSnMMpeIr/kgs4Dc/iC3IJZ+B5fEka8RW8gK9JE76BF/EtacZZeA7fkQZ8D5/jB3ILP8Jn+IncxM/wBX4ht/ErfIXfZuKTF1b5cZ5jPVB+g22C8rtpG9YKdxf+JuztXxQiohgqVGVQoyYVmYZ0FBRptGgpok1bCR06gujTJ2DJ0i3WbOSx52ArDx60fisODDvs4aTAIebq1TukUaOjLrig3CWXndSkyVlXXVOmRYvjhIROExE5pkOHA7p1q9SjR4VevU5UgsgzANyNXxaDhGQ/HTpy6NN3s+aI3AfAPZClBDAwneDguilQ0EOJEjEcnMuIiC5SpeoCNWp6UVB0MGGiiydPQrFiXZUoUWuTEHld4WHY3yF32kO1vwnoKeRt5NffDwQ7HAGSFCHNCP0jARQiKuhqAEGcKP5nLfM9nvgf9uivewI4YYBQ6t77Ta1pj0+w4jfk3xfJbwvAQX0J2kLaahDOEwaZzSnZJaIt7ZKwO5eKnUJzU5MiSvkG51VjhiWRzR7hmBWUxdQUrCkK+RmbBKhblFnsFYf/TR4E5rpGPNP4MO6Mbm0apRuNrxdtiGu0vfseTmtVnaN5WprP78cIWHN0zKyWtO7cOjdEONkMbvZiYUZKrCmPn1bjPs6RPWU4iFDXYsVsUNk632e6isDsc5MyQFoVbXsMByPawJPcp/kmHGO3ZNxyYGkMwxNKcG7R4x1//XRLeOQY3mf4nqcMFicFkTxg7uj+jguRxaHJDaVCF0iW+/MatSRnfmdZaMz3o1oUjc6M/si54jQvpfzZRs6Ptxtug//AAJQczjrIWofv4jCcOXs04jAc6T7rES6Ma9kw76RWktcldKNGLP/eZeousnhekWVbSjlpWVBG4BX7PeDTM+4Ug0V7BBoL3kFcMYSoIPSIxodEnaNC4phxiKaSd2unRTydIg/3ELuuSm/WIpBa4j3nyLoc5XYd+2q/dcgqPOLmhoaCI4hFrYAVAifu2z4prxpFoY1t1EYJbkh3Be7b7dZtwqGyta3jPMd/WwMtfUO881qK/GghEg1khWTyTIVwZ1oTMTVsNQCpw/eqOWjFduUlwa1fEbQCkgib0J0nycgZEadFsWB2N3+ft3vGAXugdSmJtcUfiht55RGX1oXP6zjt5SMhovb99+yVj5dIHPAdjnilOsjf8+jMAGzQ9renYYp3SlML4pP8eowNUuT3dl9wJyz65xskeoTO6t3bKftU8g0rHAyunpHWD3wpvltz04WbG5GUbYaVe4XJxtqte9OVkKyEDBmWJHvmLbYBgRhOtMpuirfoqmp42/MlCXl+qLg7ios3J4UlQh+oCCXgNfATPSJo9Yxn7ByK1RXwLdPNNQhXiAfmVdW5dd7bLls9J2Nh/FSPr8GMH36MfL86pyMM3abYvKM+ch72UW/w5GMM9WFbrj/KOoSZraWSTRcrY3CjCrKG6jTF2EZACkDG2vDdv5VnYhjSNsXu7AeAAVLQ6XIMPdnXvQjaEN6rLEz7CU2ANaD1dtSofY/S0D23DN1Guf4MoCjUNwS14SQp5GaCJ8TOBW8oQm9CJIK5RCKApfYFyp8ki5yKlZS5Nc0QtxUfhPwGKCSIxrJkpSy87WCsmkorIbKV8k64bGf6nuQD3s6qXJa+hK7l0iCPyd54TU6DC3mU/M/Ga4P4syQPmNvJ1jDaWly2DnVY6GuSGNsAKSHIdFTEZnqPUreR5klz/44QYniIfoCg5qxvIWySXRDnpqkkwoZcPsr2o1I9DjUoQXosCEwTtifcJnVCfLoOZmsqFYH3wBOKPoC+VZcrkuMgyL5vR+Tvr+Xx0Cpx6kpAxSAVj7L9spkqtwoe8g5ENRMnNnlR3wAh1CrivEndri/xwxRk45tuE5SN69pAsJELRLOZ2EJigKh6lmh7UTh3tGaAOEMgksPEP0I0DCz1BvoMIB7eY115byPZgXwwClbigwrRldo7Wgh/Dl8t7k7HYELcYo4HyI2vEaximw5SCTPLRjMYGtB6pL6VVUF9cftdaPSkGu//gLnHeFAiujhtGsWuXYAa6LDaBFaugOY507FAwqIEI2+4MtNFvV7/FsXH2izElTL9SdOcKTU3G5gYvu7LrqEuWuKsvUnDBwfnGHsmJ3uf6JgYeHHGukV6N9gf0jc6p3NvxHu+zH0jAUbrYfd+di5BJaznOczZ/brHdv/Gl5WE8zVd9jJ3P6F12qjUUWkbGbDM91ApcuUytLXkKWdX/rvKUxBHxZmUyI7U6PjCdVi69h/uzUSr0V2ghPZJnhatRHTxSXH0QUPGjiEDE2LkArlN7H+mSlSN/puXa16yYksARv9ukOi6HdvrY5+0ws4HLlyop6W3j9S90ct1fpFr7BnCtkhz6GdA1r2JVkgOvCBigldeb94uVSjUuy3M4DdcmpvBFPj0/V4b+VRBGPQCftmrJA+ay4ZoHcI4TvnDWzNjmPWuCQFhIliieFStI1BU2qPiN5OFdT9YnOKLkbPIyzECndPdZbSPGZnFbhto76JO6B97TOhR2hicxjCxFCs+GHPtAKlWNqlQRPFZuiels1oWA+7MMUn7mkYH3PElz16ZN5m/Cypyo1neCb7dpChdFNA/JhSMz0PbarWMAqAQEsnWZUJnpCHykatpzVINT7BeHRnzGR7C6LQ0tsb4SEX7is/N+sLEwpOm5NKNKt9JtE95ieXOQHiLxVeKPB6nRv1QXzXDn++q9GyL6nhsWgSPupFrC0l9RndzzOKx71WOBsmNrhnzcAm4C0EjvGV8orYOJrjJpF+fnGis2hLOKWVufYwI6bnN9ExDfxtPUGcETytp0WE/snoE9KYk5rGzCRZQz5YYlxuI6Ieu1M78GbZgCztLNEGk+YfLQTLHRNpkbx0cfzdLock7ARCUte1fumcQPkNsVfkBlRdkGLGqivHipddeRY/fBXxG2KX9MZrmpLaf0lBFSkQ84D+sN0SWTao/YTFiRpJ4cmirPk6qFDOR5OwO9Tg3sQ4R4FB6e0OzOMhzapUowCt6hu8vPtNptB21yoZicP6nF44h3Kr4HGZhq/+Mb1EJC0sAM03bNP1WUWN/b621wcrJITmqlup7IhFhjvkqVRXFhknBueA56mLM1zcfdLjAlX/5EGA7UqBN8B0dL/mhOSB+/9jONBUt3HKYSbu8XwZ+LEf5fPiZpmA668FufiLh3Wib4ktdW6xm8h06QfCWkc1tEiR6v2DTvsjFREk47PeX4m7uYoKYvj0GlcWx+qIySC6/Ykf/aiKFKvFKrTeEkAUWXPFgKjWYuT5eP+XoFvloFeFhhj1e9mdd+OplWNVlJ7A5L1S60MKggqnyiHFqw1HNwAqzLOvfccVaZsFPqngNv/Dq+jnbbW6+gUC4SqqFvtCDsT9DBKP3dgm0p6pqTOJn8QLMwrIFPNND4PFMof0dSxoNpUehN5WxC228Cu0fb9tz9mztd2ZvSqJMYUR3MzR8uwtL6FUdKjbJdq+nCFZczi8meoqyZaDlZCaSkQ2xnDQDCPpvP/zpWbORNmnapV29k1Rnl86OBHfZpuXkNnMAslvehawBG8VGIXXZXqE1cjhOWB+NG9BWnpByPp0bjFRmwPgmtjoccvMbxoUeV/LBirkIj3b6qC1ksuQP86VGoRvsbh7WRuduwfl6mUbmtZSdNvMtD/ci6PyxMZ9bmCwYYpWUtTO9Ob98d7QMFXhABYS83znooR/mb6V8o2E4Xax8EiXJWfZ2LhvX4hHq8kyKZOMRbhwhAoKqNJEGYQasK07qXTBWkzMXyUkUf6JAP+Mk30OcSL6AnMMkGSTGVHyXv36nb5IXyHA28CWBdCgRTqErwsMIELVbT8lR2L0GowW7K6/qYRqcY6nDi66Q4rYJ/IiUwWvt7yMOuWV1Cw+901C+GVI0aKaPn10z+KWyY4CQOSHegsYbgxUGRaaDkkB39lY21xJATvOqKuE/LdPB3uSULofPlVqb7GJNEYmmF7s2djkrfLHaUiMYA6xgoKxYxxJNj+Ei6U6MywQPyf4njv53LEpmLLYLTAMWPOrHDC8iNvMLByKP8WJE8SesGikMcYt+uJvTYDAvNCLBkvqZVuVOFgp21Xy+eHg7djM6vhAeU7jCHKIZMCqAzYlea+2LDxwtEz3L3e8mT+KeMKhEeP1oJekdWiz9wzRbd3kMozMypVdVVqu8vH8J1/qyHBsYB008rcaje9ibCx4TasDY0yoO3ui5F7R4c0zjIJyU3BlZi2xDe8I4Yf9+jeiGBdj9E5hTNLQUeJlaXAW23lqGi2s5bRBhEEutCruil+mkVxMs4O6Bto19qY6w7GOEmxdKr63/IMMTA1lbBHUaRb8V5KyTvwSupZ1ULa/0ONwIBlIzmwj3sGODujHXLCSFOEE9NInLMtbIjm6hShDp8Q0375Js/WPJTWiZCH0RJcdHK1kf8mEXT9YTgoAIMspvmr2I3ZkjX/F4g02hjoRiEx5PWzIN/D+rrlOCVevzQzLNnccaG+Bf3cZaow/boYJJzFgf1x7FxYwWynKge6/kJzAk3DZ66o0iSkarOrVuJCaGS/ydSP70SUnB0lu9DlwqleoLQ/l1S0TBDZ9bHGQgxaPINOieMSBdF9Or6bhLj7C5rgtZ18BeKmMCGpP9ta6Yhp9UlHyhVDUHbKChT6oE+6+TyT3CY2OC8dh6RSlLUUdxQDsotZ/Qpe/4esXh/+HCMBefTsh/PK8I9K/GLg+BfyIOFSKKC4DKbwFLRCKl4wm3DTGWl+K7kv6dLN1km7Q0G5XlVTOVhnfO30/wawd/fiI6x14QyEhZpRbnQdLJ03e3YFwTOqcdipa2xJZFXdPWZp70+3uu5ciHVbomj5HSqrp4o0q1ZoCPH3N9zc6CWbGlid18d2FE3g5/oGuaHYKBqWnRzZayXtNGkfG+rjgpKkqpYBEpbo0zMqKrBCllENbjEK93dpAarjQbFKmTK7GcAxIyNozbtgux74Nk9He5fHavP6TIuEdch5e2yxhCVTeUCB9ia1l0FmWzXGaQBG8MFn2p5mrEwb7dF7VywMRSMy3BoKH+g442o6QaKWnqQXGIrmDXyzWm19Crho9K2+J5sB/gPO/dcjqLNDlqv1eDanNaHg1LJe5h4TO1jzW8iJLNEI8tdjRC9ZOhiZbCDLZ5UCEM2gNq9rYlQCPSP7ZKnAWCDcKB3FJgb3RShUZcLq8B1eIdFZP7kOdKVcYKtXX4bfsX6WlISNjJrmu7p7HkSfDwMeo78LPXcPaSzBRHTiJIxcO/xYfIB6ORyTUtpdpX7mYJ+1IxDhg97VcX8XxdSGDMZpHOh09V+TgBX8spC3iBBLPJcVYxMoH+YB0YPTBmrAO9cwrUAUTyE8/REOyoZAwiVnbgma+CcCknGZQzYrEANTbK7FX7DG/j9a54Gkm4mDf48J+cg11Onq4DmYgnsR9HKYKtSPYwNJU8Z5NbNUFVza9scUUpO1ASflp901AnVRgu4i4ahlDr+h2tcsNhJRME6zgweNM3IZO9/9oIBBUJUyA60TRQTnZJoEyyXcpNXMX2eLm/jeqFBaGgW2B4eaTKem4IPvKCWzhNWLlcxlZKoe8AWO34XT7NAw8QXx+bGHeg8Z4KHvKdpITOWJFw4WCT9B9TqMLvS6JqYoQ9fA+KuOh38LWb1okTAy5yOtOLX71izo5Jl8A5aYbQ2JeXQ237YMf3jmBkmz2rbsUZDyZ46ntWLPWLgN+2F0MgQsBhj9PkjaYSTiuYvChqPxeT1ODD+zgZAWt3B2IjoQSsOWRVSJat00OB3WJV87PqKa7QWmtjysNaruF6T9OY4MTDR8cZBAKHrOfXqeTLSIobuLAgiNpJMS7KD/GOFLPUxpRNz0HwVem8uhjOVHCDf5sY6f1ryoE7oAQASmyVh4L5jRJo6z2Mu0X01TfRodvlHN/PP1Zs7tPHlY9oGg6mjFxw0egMkoIbnLpoFxdb/zgVEIOT6ydAcJPwCscBb5Gx9HuJSaWnWWu2nNeTdXVDVf6MgJceEKGUFiaxyimH5vehM/6vrr5nmWRG3/l1yC9l56rSIMT6D4+lwLH1LQwzn0hNThWPJtYcxJC/84tVXtzynQuLXHkG6q0Uk+qkG0CMHvtu12Jsa6+9N4WMlFh3K1sIXkrd97ytv2ftF3C+ED0UUiOwAwZkzdq8eMNLWaMkWcjtituaWKjZSxluyRzx/doGPY6fgnJeAC6fZGiOm2NwArzft52Vxxa1numfOBzFxzK3wbLrm5h3gA/22K254ZxTSs2iFbeklczs80agmiuoiZJsmVh4g28ld78cCl3lz+zbWRcVuQBDS7J/QFYnVqRioH5znTLqQfEItiCgTqfXBlc8s62Fxijjb+eFqs6pN6L/UQVQasi9kQl0g2pbwXHvZMyv3yoeFx+5b9mQbC9mWk0Rjw22gX5A+OLrYyfuAB5jrZQ2YdQ3zL9GLWH3Sn2G/O2URuhUl5G++IYbtq3m7KBqQBiEkZG0aKPd0rnjqgjeX+0xnBMgtkufiiNFb5aCbqvG3pfwVKyUSnactdtVhkN54w3ryiApnyVhlgU97M8RUCrcOdTT1ZeXtXIJp3daohvlXmEjBp88ZyEC+NbWlohbluY8Sm5JZx4zCZjESC9Utq+0q0oKjTKRAlE11fm9JnX519grxI7lz1t+qbg9X9F9NLmu6FUG5BUvhKN8pcj2WHT55u2ThKIA5euuKWe6XBdkXZnKQbuye87ehhq1+41L0JjnIp4p2Q+qe7D+eGuJs5qnY5APt8XuRN/eGJqGZH/GhMekhd8RRfxYYbKIIWb7NLf6ZQdfX1ZJuBHlYWMRO6Y25iIEebolXSTnVywea8L2H2sTo2OHENG/mSqNwFuo+kJsVDDp6fWdC5unOtqjeepnNVKhQzRs+WiIrJZWKV6esN6kCEkAPzHQN1QmPqULMkxgx/wV8ymIgb3vbavkch9S7rGZU/z/6njFnOiixMHBh8uN9J0nXC88qvrvjoNFZkygNxv+qU47yKszGJbEtHRAMLyjSEsfVX5NaoU7UAtw0s18Cc+4isvu6nXOMGHtRHCoPX4LLOIOF0oW60RsIoJy1/L/ejVb4d00z5oBY2No6+nR6orjDIkDeQBcrilBDjZW2YOUkn98hOgNc6HSZV9DDMLXDPAUhPMMRZ/MyI6yQvkEoeEg21sqOT1JSHRhWA5dCPtcqzmMlNpsBPkMCeEwY/6KWTZalUzAo52LAYOuZnGlGtYib/tQayAzzk8wjP1kfb04NJDtxqu1gBqt9hFs+gaNnKk3dWF72GLrY6g0S9/sqHSs545g7JpYxCnjkkhyhaJV2iaRY0d+TS+k0SybxBjKGmQ0HE/IvVf1fsANJw+6I7gp/q4gVNG1lkkKPiRNZCn17h5qEyNbZzdyFh4LqWscEy7pz9EoDR4aklwZfuBZFTwF3Rk7+ETN9yYevDfDev0IVe8pdn2e82yWtF02XoBvFWhhG6GWHiDszcFh4Uk0bEOFisgHXxSZ3/jZgjqPhR5jp35FcLY5tFsztu5bIsPEJpoEprfon5q7ciH87GgyS+jQiIcZHUQb14aTpS3CQ4L75Q55PRfqInHZe1UEYggRdZ+GhZgww4cA+VJ8JQrzRUrCwXXngFOSNaESDQ/T9j+1HO3TpQ5JFyHaDJGgOY3EhloVAyh8eK024ufyn2yPCWjMhIwP5iI8VK/MMYHhn6ki42s6zGH+SUqL9KQ8ZvsRhYLf/n8pahPF4o0lnjm8et5Qxjx1PvmBgX+QKY1LzxoXGcae5Y8pddzfL5z4jRrfPHGJlofSJAuPdTp8zJ80JsMxv7rEvZgPvBlvh9ERkIMOa9hgVK13SzeBvsIbi9xbpmY8UO+a93awiNTje6aoSteXc5IWZS1PLwMERpO6pSir0FbUujtd/OA2/hcUIZDk3a/pcOfVhQWlUPEHHTuXm04xb1KyGdbHMIPi1bUIOgQUvqevWG4morCICj28ZTBkmFPVcsrxE+5bkOkXPMBnqPrJGoVeX/H3kJDuTZYl/Qa+wWMt/k0La9B6t8IP0i839cQA/TGDnVMjK86OMnGcOP7pG3TW2naP0uAUPVAO2lzHe2qVVp+CUJNkpKUwx0hY9jKgpNl1uZ3je1nQL+Ei9O4hGHQcEDFyS0azyvBMb1muUem1tI4gp6t8Hssgl+/nupba2NnL3LpJDlouNN3ILRz7a1I5LtZ/urGoYLUJhTqmJ4Ek2/Zbj/lQ36DAW83FK+9Tiu/hwziZq2jYao3vQvHKJNcaSXRh30RVLaPOwN9k1OmfYCwqrGRtTdfyBloRrqzThgm/XyGrMTU6QTALps/aWPEOKjmPknrNKBRUHvMAWShpo2HrhplSMm4+/lKT9ZJGqVr8YJUa8uJXfE+f6bC+QVAojB+Z+fSzrUeFFRfx7GWlmgSmBYLZlg4jB4Fxg562Ssjo0MZ/Zooc2xGk4KUaA94rsodBfh7FN6fkNtqQTxypyDPHby02Xks5d23FZY3xCwTaUI+XGAa8vL4pWT/AgquBLbE/ESeCsEEnuUH8An1rCBOy03dtIr1jqxF6DYqroMWFVpXhbax+5TQNGzP1Gxo31yytSZfvEJvwSmLJ1IZpNSVsnGBdXygps0b4rzReJRzzJ2sO36UHG5Uv31nGXOaBX3h2P+Kd4H2I/PSQPGOvNPa81Vq5NRLCCCoao1yh0KzSmRNBHOL4Mj7V6TRAbt6pPvfwwqOFGMMyi/hsh133Z3gnf9gDOl9yiUzNcz7aQPk5NNs7bhIAUZKzhZQPrXLIehH6Z7JOdWGg1n0V8+ePEA2mPtOz5nUtlE9K6DV6vZAi9jUdnphyq5aClHaIKYbDun/pjIh2gnfeF5ULxY/DiQz1kHmlVhfHipmxCIklSApzsfDZSwFG8V37vZ2lJELVDLlfyVt4P+1fX1sQD8quy9EmbBNNLnEC83Q0TLs0l+wkzW8vWaLllV1447S+ddu+2Ak3mzocyYE0iun0+FHOUSlJ847spVVp43rbd7QwkcrO5eWAhC5Lp+YSuvmyXrD0Juryx19aDzwMxW6880xZjod5tOQyTg5YLW3oZEquUMqMI8u6L6tq5E1LnhMbFz/gd+G8rNipT8ksqJ6bKBUnYqo1JqV8h/sU7rWwS5AUr/ifmcd7Z50s52xxY1VLj3qmkm6bpOHEi8ZoF3GKisjoYvq3iowknsPze5RD+wFP+7MURKwkewfbeKQHnygbyUEqkrNWdi5s+iIH/S5cktVbvyjaQZt5pQWSfWbzhLv44bZ9SMw7GLM+Ft856kqIHZ+pHe3FiV6p3UjzJiDLHdWjVyucG05P9KWWqzyIwkVUP43whIvnl5nP78Xaa5UvH5rJN8TfS1vkND4vfZBmUft8JWeo03kGow2KG0QUQNNyB/zGhVI4LIoTMC4kdzbUUsp0LWqX7Q7SvBz/WNqs8bTWQyCoVhQlmhz1i+P1t1VKvxUHeiPy+i/AZScnhaLnrWHR88LrTXsBEoX5lMrPt9WJNM4rzWTzmP8sRd6yKsn5n67yRfs+e+3Mzzd+nnzNX/wc+OsQkl5/538xy6fVV/gL9L97ay7GTKl512ga/31CgZUo1/LeK1ekUIrLyYl/iAGaKHkgBZZNta/TPRibWIC6TkxO2oYUj60NVZ8jGL2dfeXLoa20+io7fbnOI0e81G2a5VLtaATOGABe6I4n0MR+p0fr/zDdBzcno06Rv4kWNMWAU7ZFzu43KyVCv7NPQXsRVp73BWu8uGG91OIkpKRXBHYr5OzUOx5QhZisEgFvifiLqzMbGWaXC1h+FWO0u9s42QsUqkrflA1frUVjCcOY+pmFC8GhLPD1eJLZ1jBlSVsiOHDVpB7nSHpUz7m2A2JD/ErGyDKM/KY+Ym1J+ZLLjo6kVyEnEyLgtV9hpzCqEv9/llciZVJL6o00jEi/xj7Lfk4npqHDLTJtQOnsgDLfyHK4algDzgGgxzRs1SlaIFATVBezhgxSa1Yh6lNj95ioI7Wh4j4h4qIatG3Zzmt5bvkAgj912CPeNSdHsmMqD3wskseBRplT6ags+ymbl9CZnJBW3OnsBMk+tlvaR2+pw5/vHiYzfPhP8VtqOypGYI2Od7+l4gz+R1RT42/yiXaNHdKeneNqkq2B5Nq3E/Qe+bJ3lMRFuvQieMbN8zGIZcqi74rAdeFkQrSb7BP27SRfbhcctbOYLds1O10Q+pNSsC5k+mB+uICVsW+nUuDjADPh2xplqS+nvledfV2T8GvXlEvrI1pwvbeT/KRa9AqPu8iZ2Fjnm369Gq8KeTpFrL/SUGb64hTUx+bWKxib4fNHuq+Sv8Jq5QYyuYJMNpSTgd5brdI03U63iy/yz0KOHmVlQqWLsO3vXEqQvmrb3wRSV4K8Ek9to6yat3+4pRPX+WpXwd5xCkgTrmHrVBVRk19/nTMYVEygkjISrVpq9Dng9mcVC4+UoEvJv4pt5NRMMXyLh5KCejrex9kRligCfC52zmvu5c/WR/YV8gpJv9kAtL7vx6v7FlVFscq/Bjv6vKlsa4SyrD3JuMhVsrd22IitnCeABVSMkZ5uxqgoGBIe7e4RDsVrkqWnj/ObV+N8Q+wD/t2sHZA2mPkxsIBKuHx9IhdleMnS9+huHV0fMLuSstMyReaOsT/o2fXoqkkW39SDMeQpWppSL6ViMqxC9na2AisldfB+qdoiTuMJI8epYbYAZzwAJXuisVxhfTwuSNZzApW+tN8H53PtpumLD67UMVYcUgYMp8ByjkA4zQ+SY0PUgxZtnPm5JquqBA1nMzisJKm2vdaCGlzf1+ktV71o1jeHFzB5uRXV/qIJfQz833Jw+1VMF3PE/6exPHpCcSxxPKAv93R9mJGWfb7X/eMGp1tXzrOda8BJHMT1gXFxq8pm8wFVwHAKoQALhNMCoBE5WS3SHPZJB/zLoEkSkIIwNu7phMi5GO5bnv3KT0pZvjhjQ8hMdg9XF5pZvRkObAZU74SoKZr/rpEZVnTcXM32wpmTQTPZ1RbNs7Ax74pvH/KtiBPVDGogqemoe0h9rDdrar6NyX9pJf5ymnJe0EgULgBcg8YGaVyTzN2c4RDh3egRh87LrTqujwOgckC7V52AEAAfH1dmKu8xPilr2Jwa+Z0VV3i0zWJ0irYuOVWrGG07mmj2UKqcHLPZwaFXeY7y13OnjZZyvsL3Kw2U/Bo5mvD8/8Wpa2C571eqI5si9UxgHzC5YkslpbBNTloxJVM1rCQoO5U9mSJpQbuclLxiS3JjubJWS9KOqnr+psgKmuTo4p6/7Wn4ck6tqpcMnIRnfANtsa+03fCFn/D1tsVebGv3uQqxHgyIhV8Puk29FXycVfQgHtGyPHicfWCZIEwAalNiQD+5CdzyfuN93uH9rhc8sLYdhFjqgRydogdmaqbvrh/V2udlA6lPcnQQ0+bnyaefmPrLzph8GfTazNdgzZzWQ+Gipmo0vzvijmS/UX9a1lAeIZQThe29ovA1MBHRNXlKAcWBd4qu21oWzsdIAhFM84k1BocVAgSbVdcu1p2cTjWzyVVnVl9/hCbM9ccHQcDs2FxTHPI3b3u+tAvWXCvzsQdoYZSqF9RlxnYn0DwHjBLtUEoGkk2S/hZpi9MjozrxHskN2/VNGxwk4Y+20Ss53rqjqiP5/8AGgXO1wUPLbIRGORRh2Mo3nF85wjIccuuQvpwo97OjpQGmTOCsvJf48K0Dce3bnXRq7TgYDko7ADTmiNFlI5dSXRCyEaVTg04nNYTSjUU/JRQv9YXkiWLtCvHUhgbJ1HY5+DVnmSw7gv1wKggrxSS/y0UM0vnUR7D97KF2lak+MDE3ht8flpnefgVBxfYHok2l1M3AapNCqSiapfo1paA7kkZI6hyNgjVt7iW9Un9VJTYwpX/UzW+v0Xgr3n36pK3YqyhWDBEdyoTViRnbStrdSea4we/mhwsG9bw33zt9H+g1BeefFER3WShIJtNcUVgNTs6vz8QOdrnPiLUrpUQaARCM2nSY7nydiVKQYPhAOXldZuxgt3vu7B0KyUBDo3Rq8+GSeVKsqGT1t8nbxZq4Vfra9dP3WTxrfTqQnxNE0HmoTsPD6hiBChi1Gt1/Z4Hug9xLFZbL3F6jcsXI62rB7BzBo5zMwpfYX89QPHI0sMVQCbdXVCM1hS1ZlYzKiaITfVDrsQvKOhtgrMkEFWxgqr5j0X2e9CU4Vr/LzcZ21U6Mf2C8c27h/r6QuOIez6xGeMt8eKrVM28DpTbPvnp28CuAsUmhUkyfJTHxxUmpl9TyjKxmIJMFjwFw6W6fvKWganLegOjY/ubXThZX9ov1WnnPXy6SB/zBORibPD7ZZd2W2kbrOfxNwi3ijf++GgS2Jubz6sgH472Hllkzrdcb2dZbRN9suROXU1mx1Ch91pFbWc6TG9OvQSofw8qviEsPve+caQENYq0WnzZZDlScwcrXQjazmzZsV1RbH+k7Tx113hSdOw64r3SKg7p91azDsGvOFUGRvlg8v0xI/nJ6jjfQKr2Vl1F/dHbwgxKMFUbAx3EicVkVr/yHBavqMqGlIJj8Op7oQ3PpVMvDeZn10dOXAX51yNqmJc3ODqtkbtH+k6iL40L+jQ/vHRF5+teLFgSCOl5jQ/wBggiW9ZsD9blYokI0kEyap00Ri8riioizIk7NhXJfpxPLLmjs3r9Yl+9Lr9eNj6h3w5MW8bTOlgOV7kqxEqVRzUVR52Wr5iLrsCOoXSkZbBj4iPqa5IFprUFgpz+EVXWPbb8Jf6EQz8DWz5J8sLGl1sCr2534tgIS52r48+dG8/tDMpu8vvwlZMapKBBJSH6nnRC8wzf0c7Ujx1AjD/FYXnZblN4kSqOuit8AwXONvrOWNuj2B2RWdQfl+18/ewkcEYMYdDiJwRIh18M5we9qNh9++yhVVmSq1/oLL/uA0hxp+vmVMz2MW2rwoR/Xqvh7a0QxSOrh/XjoO8vQQeDFw6OLbIRGBRRlXKEFpW6Pg4Na1rWrwLFJdH3e7PgDOSYnSBbFWf9vi+xVqOgb+17Sg/+0za85LWeaA/ZB31A9RHpBk0bn6fir6NXdLub36vBOckfax8mtERNd9/EOqu4Wfil9z48xQ8NotFRxY81SP/6GTNCLUALpI5X6J07b21eiVchlDzvNHjaacw2zAngjPZT2u2+AM4Xa9EefFunr635pUuiNSn3K3BTVaTpp9jUD/c46OSlON9HsGyOYuVNYCRKZAgZ3/WZ/zvHKgeY3bcNabCj09w9rUE9rYzrgWcrL5Jvs3CKRjY1p+354aidD5DSVwhBv4dGVPWa6RYv76x94IOqOjoGnkyev20/n+dGP7c9lIrNiQ5+2yg1Nt2X/7AKK3w9WXTMm5/ux0oqgR9mO5qsWKQUeEa3Ah6VUrroWltgBDzEL4BKFn7eisMCPLRQHPYoFSjkkINLWAb6fPPpdw+OomscV33EV31U/3tDw+PR31QdIGgL+mbyEr1t0MPrFmQ3/SvZM/7fluUczr0ewQ6pcAZFz84Qn3gcx9Q3AENUAdrDP2yv3OE47wHh3OA2f1Dnjdo3MxmtCuYwUEIr/pp5x8n+zMq6DPjlu4CUu/739mq1X1ZvH4EEdPOy8In262vNFruClkhOZi8bN54iwcAirrR6gy0aURvVhTkoIoRvwvjTCSH4QI9B8jKc21Ci6O2TBrjU/UR9yvLKhL5umyVmsKPQ3kOkvOnED0hAib1II4krJD1+mY+cFnoZ2edxRZTtxsbV++RN3IP3BorGNo+jUhwf93n19TuoGW7i8SyWKqxUV6P8sEw+8pOaZkZ/9CruprIFSYJn9SjazmCHbFCH2R/dES9//Y7itqEqtqMD+t+YrVplaBt7H1sk4Sm1zUaDMql4OMfKeGC1pWZMt9KMt/ahbyMhj0iw8eF8gHt6SSStTTHUOHAjn94CUJ0Vf4nD9yWY7xQn+if2QLfTKycELOUiFhkMMJV/cKvAv1TVAF61FgzsgsFIX2ILIE/tlAr00bL2BRpcO7KIIrHS5WOs+f22VHqAeEnVHhdLZoWp6FIecXnhhfoV2+nAvMGAEDVIhkr2m6V3deWldbl5QGp4s/Rn7aiM5EpILFvSDf6Jpr1m+qFBOg41l1zg64fSWLdOG7w7tT92dcyKOx5WfrlBBnv6b9363XK4hrhPxeLliMB4d4fI1WuleB8N8CTQ02rOrRq1dZ/dYq6XNw9gToPTj8FSIcHl2JyYj6akaTVfqMlFIC09Y7UOpgXO1WAvXnuJAhn9gMi0lTD/VYatwnjeM2aHkfRkWuSpSEGga+j8b6GtXK4wOZ+dHUsSDJthNM+TVUbP5AKaQdxqsc7nnXM1QjRm5k3S1ZSDL+NNlQNeXvHyURc3552HyOWJ8ECsKjV410lh5BJ8/s4+u4EAEMqWvpok7G3XWMLMvV3NWpcCrjRa/gmzCyUT6aq4CIQ3FzsL30zoqG7+IWEd058kD6c1kNwo9PJq901Izh+ma65oD7bIgdoJXIgX6TF6r6Z9A4eyEdG/ouTbti8OpEU3ydBrZgZdaWOmt9f/RD+L1EqEkxS+ZKY28KwYco2MSX2FP/3C/oOec9ooAcEzfVe4j90W4ngiNfilxY5+ta4Wi8UfZAlYjb4LHne48yRulscfqOslPYn/IM729cdpHx3ncPif4uTsonibyOz2aBWOMfyGygRaQhdNcKNLU1v5s2O7SfqXdS5Cybsg+pJg+IbXce4dmn8j6GY68qUaASOFkfBlPYmW00OYp1mpF8TmCoDR9GnuddAXAuZedZlsseptbgup95IFbsL4E48jldo6ECIuuCQ1fA/pCPbWZ4z8ctklvLZ89kB5YhV80Ux55LHdKvpf58nsa6B/RQmuBZduFRw1wha6XGMyOqMbMlW/Au1IEZIgmyEJXM4gvpl3LjaD6YR7MeO5f/303aMBvXsj8EgNe+b669roCXM+GHEnPIIGUg5lc6Q95fTHyhC9mFfD9g+vBwCAlB8IbUmcv9dRsOZ48vLpRSZHvDqFkzqx9EVQdajtEDcR4g/EobyCKLKMmttYBhFvVx7mDUaxqvNvfib9IDkEgcuxiJ95fZJderwiCkIqq690XzDgCcmy+U+cl5nC+Y+cCCyhFXnDEwJTe1aKEKNs142qJh0w6nb3TUQNOCHNSPlPrw7kOtTMNPbXasUJO0OMLVnyBcna3bZicrBI5bZIz3Z5dwBnSPRkXgWvCRkKN63H94iGQq+Q97ZwjR3dZkDuB18wnG2tO22mG7XzKBM5DLkS37jdgnovHC4R1wUhlTT3bbwgDVDaCdcYqsOe6/aN2yrqjhv88PEJdZfcQLd7V9woBTLZF7mzTU0Lg/SVSI5IL8gKAInQ9Zt1hImqxc+Xr8M47QulDxZQ9f4yPGbEoMoLo9E2DODbs9mS16B4xhCgEnLVJTR8cBocH6TeYEqQfGKUpPS8aRj3gYlU8ni+sHRz0wlVkmohN8tZlT5pMiFaTPG2uFSS9xJHevQmQiOcTndnoiLJeyAmpWCPd3bZXIZXDFk1flINcrUKjyaOY5pmFCzMu7nKDOBlgyQB8K+nczaEcqnSi1bnPZCP7olCbI6yaj4Iu0BW4yyQOwR7lSA56P8FMY4sds0Wloz4eq+4Q3xuiJQo0L+l1oVxUbXMWcqWKEil8/Q/eHy3Qh8p397la2KZIRc0ZF7kqWJU/WpVq4LzmvHTfzUtFH+nppo/KYhgLIPQQ+NLS6dHxASSLyjncpqdELRdvTRWPzZHfTnXJDWx1AanOhXOmZw2uN1bd4uDTb64u46s94uomvm7PPlp3ZOe2+9V5GGTdztKjHXvHNr/HS3MVsGR+miyRwFhJWNtAzMlQTZNwz5EhhGEJAYv84zzdfWHvS4Yxz1gVh/1lPUk2mvVJ4t17ZsyXIZClHVONq+I/V5Og9H+wywj/ChLyj9KXPcamQ2HEn1Vx1RgzXk+vlk0To3Q0R4HPKPwxaLaQm65Ac2QiVDaNXu3e/M6bEyDPAduFPVsg2YZAYe3HQxztggcvj1W6v1MwzbeBHROk6+j3b+fa0/KBfZ3Lc54rX1d/fwDNWu65fYDrWuc6DtXokTuzj+oWy8/qDFPby5I7k9XtgmQ0f2433LnAUAyQclA09Ou+QW/hcmHALPBCy5Jn7KFR9h/VXsrrD+PrrHNSNqajr9izPOat9keW5fEx+sCbjQXnYPWzxFgfVhj6dtVIY+wIZ8vMXnOIVNY38EZQe3DPjoXqNlGN6Nluz4gLbON6HnNdhf7oinei+u0vWfTaYQ0oObMHuiyj/WqPsrEi4JUu6+MS6/IEAiop6emtXOzgxStEmq82jCDtONg6LGpo1u8biReN11oczhqzaLR+2HawN2WZzKtptUuwa2KB8dxMVp0eTCw+m77TfNJAHU0Cm7/IV9hrMlRu+VBkeiT8BWf7eBNe7DpfbMxlpfU2zwOuC9ZeV6YoIfrB0BnzLsfNNz488oAngcUA+GjNn+8LVtTkpD7U6sG5drUDWfDNGs1YgWJdyk7H4ix7NluaLTeSYGRN4D14biJH+R/t6O7vqcskzl+s3z+a1UA70ykGOWB3ASqK8VQPZsJNtZR4wZXH2hPs53oecV3hhU0/8kLdr0UNjEBPMKeeOw2RasX2OTyXy+qHfXLmaF8tsT8nTDByFYRfsyAulOeGcQfHXLKdc5PJS63+XexAsEuibvBauL4Y2wE+hxvdz4BfrfpTTyr+h21wCWGlwDb4KrWBEu/2UuRN7ibJdzK/nQjn95g2EbFS+8oTwphsZIpVdGg/TqRAeLgnYIR7xWlui64bnpXY3/I7EDs5MWGmVB+sIiyGHR+R3LVgpkswj9bq7Bw+czncK677WQ7ETjOW7bZrOp9yL/ewuVoI1ugnQsIE0mTq1oAc77jqJqpL0xxrYtdQpd+N+qi7+7IQ3sSB8b9mQqFPPDDOtNk4U/Gnc8AkguZM86Cy5srcixZWOCK0l4V8yFI1YZB/+iflbM1QZSiJmfUh4R62Ou6zV9Z1S0AIzXLXMrdEPXwK2VqLWbMFxUnvwWozLuJj73vXH3sskCvwJ1R3G91E1R0euXbCF3PSybEmZWGym8MkINVNzOmHt5oSs+e0IjTCKd05662+2O2oWp0jL2Soo/ARGG1pfgNRdutDs25lInMJhEHz815L84kF8h32IR1Eekljvf+GrVt/dusWkisnLCsLNNIq/c6oKenNTH9Ty/c4Rf4WGtAQul6h7LIawfWToPIp7s6JoFPo8bzdNYIBZ6cPw8a/I0oDLtHI8C0FLQOJoah2h7eEnTVB6uz+103XMTafaosqYEZKmAFH9N16+Pj/+WBd2BXWJfwLLdlWmnPvLs3LlUAoExHbPBXNe+88uzmtO1p7Cq87+cMOfBKGPfCADByP8KGasdvN/4gDXIwtTP2N6M2stwvmz9atc1tPvs2zj9wodbuhQgnOSYqfRWianNTBklU/WbpiMk5HzM+e2mRKOBXPlvtgNqKjV2F+E8/VoOX+1wHhuy+MMFOtTh+SRaEayKTsiBGcKi+4o90n3wjcZvXNdNk055uWe5XqISplfLZst92S+dqdTDfggj0ISUHLN2ZRyhnRW7qYkRabq25vlDENBjHIBtO799sLEn9ladZsRQm5x8BnlscoNmLdZEBuJH1ptfPpt/Rc/VI+oXfR5wMvRCV6rfJ1cvh8/js+S06N27bjZ61KmPRS13ydhpix+3v1QCTI6YKtCQZ4NelwXe+V7lQdl/ZPd3aLZ5HmpUH0t0yS24iNulNZViwbQ1g36REbU28/8JAC/eT2k3PTuixUJIvhy5VVIy/4xAfF+JQqNA9+q8TZ18pUdCeV8qN2E+lYEvUfk+Dr5Hc1+5nMszcgP7/mvaMJSqq72VHu20wm7b1STQ8tl8bwlL5MYzLe5upER6tLaIFPeJN3iBsHiR1k9mPnQ2gjtP+dcpJXG9ZdetzbUpqGtXlI63a/w0yGwNWfHjH4QxrbtzamQdA+F9WWOqJX0p55KxOCtEDlnoCY3twnm2GdDsRYG5W6crvawJ+2LxM6FICCtckHO1jFtJTUpPmKP7w4/z4lFpakztFY/oc3eN71hM18rUFvTdi73kZcbgIg/7iQTn4nO97kvr5DSf2NM0UXsGpoVNfl4mc0dw4Zpbvp368jRsZiNaXH49JTb7vvRsAHkw4iejPsnV+nEL89+eyhASR0KUXYtORzFAqHjDqPWJ4/8JaCXZMMLfyVIO5ASXbM/LQQkX/ky46VlBwI4K8wtBOFDy2JpOZ1CkVkXSiRtKIcNMRou9ffgRXg8MuXFWDRXCwBRudieywGqReVOtPA2/b3/FgalVYBDGEH7XO1UTHvsMwqT5YfPcbhwDuWunPafDyl+atiyylzxNbRcoXjDRgXw4aiFJxpxMkmVjTTx/ud4eh0gKeTF3GomJXprc117P3xylwB57V0BvNycCutyhSoPO+J/QvvA/Hc1BKl49RkvWlgoWLL1EUKddUnTWWUm5yRZoYw6HQYB08k2sQIOJzgsLvK4lusdu5QcIjbxn4D3iRTjttQbatxnfquoqUi9CvrKf1UgR0HLMFeMFkc0ubbp/TIjeDwZBdnhm0cLCJkQexBvNDyhnZk1eoo5deAtwLANPY+4Et7pJFTviC9A3s+maJtvC0fEqBxEkzNfbHWNgAWFrBC9j4IAV+Ff8o8YkAcAQQjb6yCjRhMHCRUDsvtYP3vVsX4FNTwH7sug/uDqNvGfuVBoHRqhjtcweImt/CX27BVDa5qdOUHLHhYJa16fn2BkXc8wkWCfdbv/d2vFec0ehiWn4Fh436xPveRxyjomHSrpJwShuRE+m5cxvxlsm7n1qcdP87mRCOym1NeeuAvffVFTwCFhRitPCRMgoUwWP+p9cS+Ms84P66vPGtttwIXkwb7DBvNHNhPhmQomP+7XzE6BTF4qNVVnnFlZl56IJDqxJZZywuKWePdHOWIKZLkXGS2dgfSeMlhBPozBk6GZ28zmqo0IPSKgMNR4UdoBq0zTTnb4M02Jrpkkv76BklfLDf2gZapBSMzghTZLdpQL+nHZAmjN9tdquSmaY0wrcI/vz8BmG5UoqnNh2s5GQUfQHYQOMSX5jIG4cQmrX1X1rVeKXIgPw21xjn+h6WsfNHi/PiiOCYTRljre84OmGwT6jA8mvGK+CtFO/SRevBn7m9oWU1Zs6dZ3NcmiYebJMK+Zg+x2RAtI+c9iEn/eIRcRTasVt8oEzjsZcETatqXZF+7gxz4Enz9ruOC+Z8xUH2vTNi5S6ZYbh2kYeQxI/tIp+5EwmRd21SvUvoMmYQBK2OjHZebeT86AeTlC1IWlZVljDRlbCV6vAlBRiEIEcX+DLpkMiKqmzREGAC8mhfmuQ0r/Ah95fQI/j95X+f/J2Xp+TPpPzIVrtfqJ3bWaniE8a46ETUnb1+kMa+8QFTXJYzTPL9T167gAg2sjCqNya5hoxHAL6XxRlWKCoyjvze0vB+RP803xUwUWELmBCdSfG5lBWZQCFleyKD8vDIrVfh3PrBWxLCZAM3S1J+ZGbdVUxseuqXfPVPGqYcOCxvGZowTMgdPqwyuHrpu8aNl1mWtlnz3bmDVLTq14dTvGe2jBsCqud+olkQXPBxsWkw6qX31trjJWc/CRgC62ypZR4l+Mla88YLgPULgxDcNO1I0oldoYnvr91pQ/Tz/aJDO76uzVaAGjsBF/iITIjZTpZIAX9FaV8WbifpqBNtPvCuRO2Ybgk/nvo6VtNldI/X91Y31giAR0fLr7f7jUnMB7EEYdd0ImSV8J/EoHyLp1U18n0886LZza71ifSzW3uFSD9QFpgtsc0fnr0hYdDZJPECz4ptJ9qNMb3fkyQc+0lxUgvL2YruxmeT41AdsJr++5jb1ZtBxRuGfcYjmbxNrGQcWC0OFZyb8nsBYqAdYlkcL1jzNTWN+KhR4tZOlVdLzD4KlWa4ml+O67K32qp0a1j7UsI23OuWrmHTLXiwDm/Jti1WBF1u2XWwlBk6supu88GEG2fqZmAy+1kDW3zNWprMzye6xL3vp8vL8vzZwjMnvvrXdaJeEqYj7QDRaR27NZ/KNCn+YB/h8QWIb3N/dGiND3GOWJ9s1uXseBPNxsGwsf1aDbaxTmPkas96akIMNZ3LIfpv6y1ARaw+W8ozqOQRE+2oMHOecdpqvseitCaEtt2fEL6xerDcDQW401A0zfhkI5ay+fjO6FK3ElwOK6Y8PgwDb5ENxyD/8wQJZd+7kmQS1TLtN8qfsPg8bstLsqAdT469gskzttRVC/q7Abv2f/yLfOSsDgylTM8RhdzNbEfc5+HXNYhDyQVeoE+NKOl6F3Fqz6RWJotY81yVhIw72wiYP6k/MCpvUIHs7myn0o7Wt678NPvnVY7twtovDtnwRUjE8t+fJ6emgim/PP0n9rN6gBsMq9usNLVetvj95ZP6kCdKXZUKNflm+6uhKqoaNIpoOrDtlfc10cYNb3pKemgm9aYdLPPWELSqX8V/TNr5la3eoieDAL3z26pJP18zB3+1ldWOdaWOF8WKzhdaXibT0Ec3YsRZWgJGFfWvTgSU0htzckAs2BSveG5TpEcJfyvSY3Jdv+aZB0YOtjW/uqL8Sfwak9LVlu/Xr+72oU2xhDu7n4i7g+wN4VEOwvN2e5A1FNZgjouUMNXgrWo3uu54//tSSn9K4tiilx9WvWz+bB/ZMcug6KefaVyxOVurup9s9aSIxSp+qaEmN2eSO8A4+N1v1uVJjhLsFp79VqiobBFcXfsYjcPSxP5KVbdFXk+IW75yTZ1xcryahlq32iXax3Ap7+L7CKYjtEpk8X9ZP8fEX9vwn0OeBhnAyQS2iSg+rMVCrAxRKkGiCzCYiejWhG2+O/76nYjp+T4eJpLx1255j6StOebRMoLUOgh/MQKcd6MsA+3xRFJHdIi5x7Z4JRdHKWuAAdqPaRlFE15/rgDlw966bMJCy75T6rhcMBfYCIWxaRlne9mt2VrXprEzUsCEb8IQXzixIL9lmi8zuJzfuOXy5+lGxNPCVwkHwnjDNo5PzshuGQhtUT5J99JXF/ofVuk7hlLwxlEOaRLEQmDEnv2hxT0QuLHvj9hKFIj7gSwjeadvn+sOVNJWdsLMkq8Wb1f7oiMpxYTFXZcCjc1TMuVtjjoWnHQS5OyxitsQ0RVXjcS2Hu44h9+Pmt+xlbIB92sjgmpCQ1xO5ORR2UcXfWheW5gEyMRJEyMNhMkkpepgNPVVYGtDauKE2bmOyncsP2bT4AG1fOvt8KUsiK8XyYkR0RPYy5Y7AfDFCslh+HzYXXv77rJmV4UyrmazlksFhn9Jcgp4BeIk3giUJFi5q20FdY/Vpr3CRAmnfZkGZYQlLbSftKsmsDWZ2VW9T2x8o5aqVeGy6gtm0Nerw9A07Qe4MG5jtcFDQ1aQGhorwFAU8o6MDGe5TwlCvEhqWf22a0aeweCkNb5O9rRay750GMrX/RbKPxUr2nu8HD4mkxNIiinSHDAM1wuAPRX0cR9ILy9FcyuaZ9bD6pXi1DsPefHqV+XMzirzsTz0KsrkDhjVDqOnggSK3isyHTTA/cTwdRcuiwCHTEtM9qGvILcuw49sQuv+xW49vVQ7aBzl74YiynM4oucKXzs7ElCPZgOv08nsJX0t22xLZIXLjuq2vXX/VXBitLhwAh6FpXnjOKQiWgLcaCiIOAc7/37CujduaV4dyDFYjaaYXkug8xTch1OVL7wjFRSzgJCHwzvoXv0JIkz5oVBiOcWe2ls221OmKXBbqgFjKLHbGzAVtTIIc8wsZDUFlUbw1rIM6qlnSQPH8xl3UDRZBkgJKofk4LTebwi7RfZb2umaTl4thP+JnxSypGIdu5UD3Pc0mk5Sgf1eT7KAWNBmyQ5Zt9tMNUPxWHEssTb66Xw0R4ZHK3n8u8U0db5scz2tN+aceRhoptDPZIknLkIpfcXQH06S0GmQpOmNMsa9wbsxU6kqLTyMVIznSPs6CtqbMY1nB5TyoeGq1J7P5kNNC5yxyyUjEVCkTMHCo7Qty1KumJ81+TledFsB5Xns9oFNUTS2i0g6r0d/E0uNOfLln6b2vLdBs6IRf+NpJyykI8uKXmbX/ZHsN4piLKx+gjA9VpuYrkIIyAYuPbpuTzaSX7gRoOi/bEp83dmBVLu1Vntb8/YpVBApKjlA65YkP/N/5e37S78hLk236U/XSw6w/RwS+trw8FHzzpV8yD6DRFa3w6ysEUZ1HR40xri+TrRhcN49IO1GJv4roxVMk8VQ5fnURq0PDvD5oyYHSwyqcn52fKlv0Fxx0WfNyq+XfydA8oSS9HloSEqnVFqUmPd6qOiwiyhn2RIKByZmWAszBhP9W5QyG/lW603JSc6aQ5wwKAbY4Qw4VZvNZAnRk5nAJFbcVoKw42f7gsdlHyom4/DVszX0LlW9RKMBSMwMrGuHNJak3WRgaaghxPZnpcNy0AYJ6jRD3KpMaV8YA++vqQoZGSb/TYpkBw8GFdbT6vj47/wfV4iPA2nuIcN3rmpWDAslf4omMloFmVvlvEmbvWT1u/dlYwulhEldxoQyy83yJ/7xj2dkvAnl8Ru777IWgFZNMq23Kxhx1a8p1GXcXV5iuFxDK+e2EN6eZIEKfqOGk3uEuKSTgwifGL4Clf0tvhPIG0T4rv0H7rgDIFaerzzzLMzx5DxKdlunt/t0+Bqn1sm+jkHsnBfaTASnT6RpFN1+h+JtDvSbSOiVGscveq6AwnrysQv0LiCNRjFh60Gp9hUZtOBtz0M/5iytbJTBZzyeU6eKEM/NFrkm3cM6k1vEGMTTgKq2ecwLk78R9jqPhPseRSx7iaLiHJSBvJ+4qjklZ9OWl2QKUW0YxpvyjCESdSsRJDHlSaQexQqSSYeOXgHpV5ElxsDjrpGT4zkkvkUgjtSX0Tw6QHWxP9IQkbMju4rpK3Zn0YB6uFCj9slvd5uB8Gzd/OPCz/1H8yg8eCTDQzKQHc3H4lOJHduvrKojvxJYPB35NbPcG9+CIOUtlN6ZkxrSfSHuD3iQLlSxfobbDiinyZagCrIkQu1sLVvn2+kZ3tuZn7p4bPizJOD5byy5PGdN8lQhowplCzKm2Rvd1Lx2kX/p12qWBKeHSXzgSBHGRcIcQ/ughC+wmwwoYZAW4kKUqpLr9CIML7zAaOOt2PGhQOkK80mpZ+9HRqQbPRXchrMNL1HlfXezMkgKikXhQFQOXrtThperKJBAZHohOba4ZHf7mBfDrbNsq6ansH7ppntlP2A8lIWrtZa+6RAbUHhyvdpm5fDl9UGbmpQCT9UGBLJG9RT+8fKZL9avnycDCzFPxP62dQ/Iw9Um2A6/7B2GblKMBmusbkguLCcWFHYw1pCmKfdlDEuhcLxsvs7fYUX1SUe8RFbUzQN7m0v+UOFZMPGyf5QOxysha8FcRKG/GNX+yrBLX02HmXX0PgJhZ1ueR4pDYxkDW4S8ExD969k1C3TtPszrGhXc01Ci48+hW4A7S1TpBAKGPdn+YXv+OZI9qwvSbRthND+ymCXoTFAkfPAIncQEUd+kFp9lcWMU3P72uxIYCr7+AmraZbv8xwgYzpkgyEY61Ow3wA/+aUCFfLK9dCWPG9Cv6fuCBn56eAcivg7I8Sjd9qpX8o+l8lXyz4bnIUKGcB/PzxrFt4e7shlOkgAxLKjQ/VxYOBFOxmC7TmTcUEssZpNjfaMV6wIe/LqQx3qWqcagM6r/tbaBOzPBPvZIDHZffEONs7uKf1LL5+5SHgHuZlkl6UWMxY5GCBzpNxj/8i2uVwJtcCZYg6AgaG7yZ6fdVfh4z1flzM0Z4eiF7nOW18+7OgALzp1qZ7B0gXEIPyhRGhu6dJBq/OhfVv30sae5bLI8rngvPvXccbgGlxZU5ebePNX96e5/QISuhYHrfDfFBETiitPeCpcGMP2mlidf31KDEcHrVpTNGTW+qH/oLDL7NfCGL3fQAk1Z9a08tSoSkV3VaHXb88+lYy6dbqYbamwkcqO/zFqrjG7XzAwLjJDqh9vaiI65RV3OQm3FYfBfLTt3K/w2ZyMeJdquF6BiXy67fdZ+EEApnvJLbGA5zm2J5OAENSOIx+QCGygczrgpAsEAsPIhiHTmGsoAgsSaYTK1Wq6ktcrnUVpE2qVUSKXWygrRuuqZKparWaIwTLvfHVU6+Sbys+yemvvAL5ETEjRqurAg2mIpFyhN5HVqXc/IvsvW0a/vKL4B11ueJyoWt9kU+TB0mSpDhWuvy8gt99kWtykRb7otC7099EeY8f7rZ80kUVzDmMnZR5aECHX3seiGVLdxr8iQesWCvSvMdJhEpJRBKlQTmiwDVWHDW2glQbQVrrcctepuDBzhhbq6dovOojNU0e27uqRvoXGnFvYXKknvq5rm5/+6GU80ioczNlZHbf8lgrJjBNqjcXMbtzDc0iDfAXJXlgXKuXE2s1np+Dpgne7YTeP86dxBB4x8F57hkk76svKOjvINc3V5ujWzKwFvLNFulmvY/zAa8RpLtoFQZVR4tzSGh0/+7YixQldztF1ibs/j6uwtVxX8mV+SeylTpebkOlFCr0hpyHBgNaFo9qqXopdJWhLTktMH/0BhR+dpPxJ1WWrRXbxuIRG1Te/WotUcN90TmZy8gFeNiL3zJAfNAmHANW7u6kNr38de749qKLpelYPa+Dz4raWsqRrPTXV9rWIFkvXnVJOyB+uRvClZr1C0AYYXVGgWKKVpqLHJLPM7BpU53Tm+tkUCjNYAcRYwtG7mS7oKQzXY6Leh0ItPOMBeltG2f3oJKmxzEaYqGW/kLJbv60GVWkzTTWJK/WIJZvO9fgfmuzhxkAK331KQvymma7J4WZePYz4nUv+a7MsBglg/zeLBAgJVgLp8PcX9Kh3j3IgFRDAe1lxscDmFPfrsJS8ycHq2uilVVdYV11Wp1QqfNPAm1VsuhTqsbFajQKd07Pjl8jMluOQ6pc66Suqu+WmW3/GZLLI9Tf5E9LkVs2MXov64tASv+TifM315PpD2sVRK9V44wB/2MFom3wil+Z9ZoclngUKvMlycXLcxGjSL5po6RoGrXcJZqZzy6yye6i43C+d1XjeCtyHUgBYGmoyvcJbdZ76z/fFhfn7kWyZPxyboAmeWWUmcNSk5J6BTBFo9k15zIfVmIdHNMHJBAW+uk6UG+2D6x0CdmAkcJvhCRZafbLUsgBcf8mVgBULDY/JUUoGTofdtrT22xFqZUkpx4d/7udOJQ5nDpy2MNJvacyXRRhmeMz8+mypuVN/I9cj+Cj6oIuzeXErSRaIJv46KEKO1HFv81jO+VygI/u0Yx3GEMBNuNsVyNvTrPj+t9B3L9GO/qz3vufIARAIu5POABy4TrzmcltTi1L6mTM1xx1oUVDnEmMOoJRgn4yXCYl0wIPCxH2v1mC7ZBR5PV9qnUvbUyuROAD+Ucon3zGF70iRt7v1NlnQb4mSo6Pygv57d4X4Bs3Be5WJmU2p2kak8DFj3ByIag+kNTzRd3z9+dgqn5Im7i5gwHKB5iNvypu2qRFObIyQQtQlc0TRryuRR1tSIrxZd6Ec7Q3H9Ob4W1qTuhUui/cO8CWxPU/bfNS9XT5Vv+4J2SSlrloSzgODdZuoVMUcmgiaZkqjpIK4B4KqwFbaSSZEzjlfFOLqYXNsrTKdM4Zeo/xLb4e/qg3unESu2gDrCFX4tC3ybrjuPK/9yGmIYcOFZ6cMg5YcnpsTmXem7A9lwafHEk0XQrbyFyunVPM81bjGIXh2xZWJSzHEEvz2aX5iyLt70MfCHDe/x7q19kvwVXjp3M2qChZqFFmHB+NtqEBZVn1TmODlpqw/MWEE4Nx+Q2LbbfBJN/P+HMiU04cs4vX5y15PL+zCWL7nuxza+rS9JeH7EZIlxJiBILr+y2BRPKXNWEKrdrXlr49VmQOuHlr46536/XHc+KnteeXblHV5sdPa0/BdjCq9mFqdfnRK7NX5/VgpiGnLe6YMlvQBwGXkaykXPArWuQdQ64g0ed637hVvwCfngxz0J/XgB1TLAbrHPexwPr3iW4rm9ltirWRw0st2R83VzyA2d5gRXEXRXOehLrSx6VWJV8wScVruHAeout09Zx4yku9rxaS+XM8bVzSTXH6qYW7NRRzHuptxQ8WhVpRYHaIYMAaesKrHI+xm/yd+/FXI/ZwDeSR6A70IRtm4/V/00zwRhmJ9QBpvkoLAJebl5wbH3tifu3ywb0GMZZj9eSb39YvpZkyzbUx36nv5rArTdSWcbZ05porK+6oCryOORRMrheqCme8l7z0FTdn8INZC2xm1MD/uV1z8Id2a8iEjAfeuY68djx7LXHuZXXQbZ/XzWbpfR7vW6nNxIwxYQmaO5vPVF8YQ8/HC2vJbFO4AY+24Ol8vnSg+Zo5euD887FE85yx8p6yoKQ3eZucSgk7jZbjItcxUHQjrOYv7r6rvIR2dysLH52FjebNIPZ8oHSVHk3TEGkZW9PeSSi8ScTEtYG8OjhvK3r6924d2ima9IQWxjLKr+wbsAH4t2XGK9Kgx0QgApzBR838tBTpfxn/DDbJ1Gpu/tmo2Guustd7gZIMy4Il5/9Y7Ii01XiAkVC17YDBacmljunnG0ThwpcgPmlV7G0jZ/biiGNf+HadKygKE0Jivo6wSa1KB9vXcaQbIg8TxtRI0NsMb4MxcUo9IqwyctQcZ1lf02P+uqrPSoONJKKksvc2+XmW+m8ohZGRh1+hg2eSW4Eeyb5tgsEZh6NuCY9dffTQA6tUoTS5ypaoutBLWqMN+dZRXax7lgBI8LrwLE94iJ09rU+M0dArfG44XEIzSYPtcbtmd0hOMApK3HT65MrOXoriy9QnLhi2HfSvItKtc32qUDCveKutQskQfRVUmI1tolzrkjdRch5rcT9zohXmIBSMDiRFYEVxcNOQ/GgIxCwc2L/pg4f+ImryAn4FIo/PFC/Dp297FZT/9Z47LSx4hnOC6isoO1nf67z5+jhnoVo/C74NZwOGjvTz2aeyQSKe3/xqW1b+29BkLL1yzaqW4Gca4WDewgafm7dlf6ZYP7wv4jpZTb+Sd6uOqXj4TB6wfTB4qsF2lT693qeiU4gKgs/LQbdD0rmvJxoQs5rujt/DoiM/O/gXMNNlTsTVUgQ1XWAp4Yx5Qp/b5XEA+wstbIT7J/4dy/H056AVohRTr/IgWlPsyBVhlw2kPmd77bgco5MTFZSBDp2J4Brbco2cC1+Zb4y+VJ57QoYM1ufsuoHOLg5v7mlbv+uduO+415fBvBsDxLVMYZcob+lTLyznGS1chis0JXbVlBIv3L+HFe/orhUVHAkHyye/H8HG8TbOGCTNtn98sh9CBTdbj8995U8ZeGnRcQ/O/9yAeuME8rGC3Ledav+9tk8onzKmCUokGkO67h+b/KR4q4bMJRtGxGDBKODPGOMKZfbmZVEWXdRNd9GtAHb9vGGz/ZM9LN3Vm6v3e+D0q9v854FNjTwoxdgHkyQBXLtN6Z9S33nhPLkcrvO8BxQpkI+N8eeSd3kTTP/iqe1EG8vqBZH2024cWv2uFzOS27V3/4zj+cG1zGZ8EFdvHf/TfFdJnDnLBt5DITqJVdxCtSFP546HGBxoRXklN+qev223TRY3zS73DTZ3gQ9v6PTaNN25Nb4fvFsLkIFkcUUoGbqO+WeUMTlxSC/Fc6Bg825TM4JiwpJnf9yfhnvrJpU5hn+/Pm2C5ZOxjz++aFQI/DrYqco1Z3sPoPdWTLRt3Zm+r7locNe0vnGrj4Coefxcu92hQ73128Y0HkYZk4eCf+b/OBWriVz288hmbLLr4N6Qw2upsQBfA//lzPD8FTlzrBPdub7ZSqq/Jfzy0mvZctIoK3bktt/enZQNn6rftA6OiO/9V/A3XmbP5gVlD0WdHp886HulNF/58xYk6b3P0gSCN2PV3i3K3U4v329QHu4hw+MNy/8b/K9VYNOnRs/iGTKLr1eXCGUUbbsa19L3b5n2416j3tfywLUSSJJSSCSiQRl0SvrzYeK1gtuYstO2BKYVPaWLunozZzyVP8UQOdhr23LrdzOlLeBHeFkp7yggBIbyXZ+srKkZgjMw+PJAqEV5cK28uyf33lq/xQ4lRC/TtT/NHXbdb8HMNHULEiTIZf0GoLEO885IroLOZ07jwhLaod7tdzFT02IQOyoN1nNN1pg9Ip8gvYVGf3DpDaSAQiaTL+uyC/eZpBN+5F4zKKTwZ7Iv/JqDoL+k4J7lc/5jEWyHDBrMSRCIjd03JzdRNMeqcKmxlguK28niBimxWJGOWK6/o9AKs1mxxJbGscPfQCxStS+ZTFpJkeuA1SiXmttkkQL1OoOo+oTDXf7DwvS2YLY2fSf+7RpN1WLzdaOyFW2LW2mi+6KjKBkul8y0QrZQt+K7gCdcQ4OvzQVdhXtvjhvvOo/kbnikFaWd0GIqenU5zEhg708OKeT6ENx9Jd3ykzLE4AxTQncpTpuH/mc5OEaHWOpbtHJ5NEwpYsZ5Yh4TAIp9DmRB+6w92U3YEz7m7scI0/oZghhxIDeZsWXDn1PHpnyAHLEE6w2SeS2sG0rywwYdn8XIcJO+kjkHUk9oEQ34UOckgFHyKafLVT9isz/U8KEY/QBk8HQQYbfICbif6FrnPv/aiTB/4aQigK75USIdK5cBy302VjyzxSIEVXXiJU44i1Lz4RYMuer2vS/1C5xo56XoVWXNFkRZJL0XFlQl7z0vXuw1AD8U452HfCqiG5LY6H6ktkDt01mWoDXCOmcJXZtssxZHoZRkxllPPpedMuUbpecHmo0EjI4SUyEXLp03EriI4blAEjyHBbEYjGdZIGIfWjAcSEhXjpwTySLlEMwBfBFkoMyAe2k38Oy0YZlJodlXY8qG/ermTvLCieXWTUfWxzUvUxDwaC8ODSH/qhMHWpP2I+5vJdOhU0ki5WmShqmU10RpLMB8TiHc+awXAN4AshJQzBAkWZFdTEWzmUtCfdQ3hE6MhK+QdTpCEfwootDiium+XlZY9d09suydPZSfrEgm/OAxVLB+gE1ErxmcJBRYSQqOyINqnIjLx/yGbxgmDQS7DcSfJX7PsJJ7gO9w/tdD7/PgImRoMJIYGok/f3aqAx+Q0IOty79qcRNnYQDhRwjgbR7ZdO6JBREBAlNJAgWzh9Igqf52Ddc0g4ieNNCAr5cdm3S5Jr3dgfAWCJEhhhp17BsEVKb+NAsE0TVR0I6XMQkclWn4BVAZrqOzkKTlWtGX5AfeCu1PqRREM2EZfdR66+SCiKZDy2ZmlfxVMmP80imkf1QMrWfYj6zeRBdCTP/CKHsl0tVUq8XHtKVC4sTrMwyZrJ6/6iRI1QglbYoP2dO421gS73XBl2BtDInV67pEy91NuXnftu0UcmF29dlTWzJhNQiNSCtAlZd+tDPKWE5c+45XlHAr4bGOUvbCSkMLZp4X/X6hh/oc4Lof2ymEdl5oiKzzXuWz9ZzHh79fNhktvopN5knOs5g6F5Gs5jPIMeTDoJq1Upa6oUZ6lZPPPQyw0MvDfyaQ596asrDbJM+xZbSnENnYU22IrfoddOKTEnQqRrisR6QcV+DRpys+qkj/rvOsUs4D6ckB9DUGg9WVuRfsmHDW/snTVb43/+pGLiMlGICkjmOHDS/x2npVm8Z8MYJkbmTvtWT7UYl3u70Z039vPlvADrHLWlmZT18rQhYyUC4U7guKT6fp1amLWCFWYyas3O81KgkcrNrjejzDVd2i4afh17f1Fyb9ICwOs7mG4qy8w1TxUaF0lzP85R8buGFn8HOZuMVme/7sBfzr6+X/EoDlOYpnwwin0/nM5tXuxvC4l+uOeD2Yqiw+GjIU9q+9gb+JeHbZGXPARpUi2jKw7dlK0zWvGjVL6u+kv+QsvkEK39xYc3q0/oh+ryUcx+lCxwHkWIzfayjG+aC30dOxdHufiVHVXckEnq3Blb3EFX+YuInnPI9Hh0rPRAcJGyQU/6Wh6FxKrmHi1u969qoK2ztw36oSGfCsuGIOfWf6cfglzdv1N/okpvMg+rOIT/VXKvsFcZtr1Pv2JjHO9NUXiSHpmT0e9ySXtfmqVglLCIsUFtvpmtCu7Kpwddtl1C4/zqCjGliH/8dA5rlj8Ky7zxW/p3GOODXdNUva6QZ+pDSf4KVP0y3Ya3kilN2/AWn9g7D8QErcQAsmfOtY1ZxBLdXsuhBF0R4RJYEnp0+kHjVKIP2ywniLd8ZH14Jkz+FxcDpfHCq2lFkpZneU+azc2EtWTP/4KU5ARkaiP0YSnrbJa0YM4YfUsgOmW4rW/XJ7zH6qUXdqmi4gCXXQp1lbsTJwdrz0dtCkUW/4S9TyAYs1jaHgW4BM8G8ibQ4RV7TXxMO4MAS579n7HhbVkMCcLNSElgZwgVssGQtTvIZjsg62TbA23pTaOWEQl4Aai0CGGYhvKzIot8WJQM5kafIH8QFo2jqK2kJx6aqZY+ZvpqtefKmRFvb0mU3qd59OLXeltPdWD7H6qLPd/rm8D1hpkxR3qXWt9c9SM8ISeprmQOB3qLLaN1p+GRkzVrDZ8LyfFe2QAaUMN+V1rKmLru9100/JIwrlV6vK6hmY2SfCV31HZx6DETWNEWvoraX9hFWIK7lCQSIkCBDAYGqtJbOLVZlEWCGacp2QFkNqEYCEs2Y15kYU8OP02U0gzHbMdzs8CbwH6igHkiQ3gjsPHHZZLMtttpmux12Dsy7unB6o3OebMJlM7BFpWyFbKvLdiI7IDup3aUlIyB8fHx8fHx8fPwVXw3xmIPBvMjIbvArDSgYtvHIwzJWoJrsuNH/OEEflB65VFla0+SKqLqV5L47TwCh5D5G94wPLGSAl7URDTs3/7pT73/mn7JKW9hfff3zzNf0/vcmuzEhfrWfrLKH3KkIf/8v+OvTyv8dGZkt9u9nsfW2QPL9sAUEdoAT/j0roPXBqAIAVG38raZWUPid1//TqmikBRBPfpBpQAEgBAz40+Vchqc9QHdbRUCGWP2EfzYyag+w0Zaxx77Lf0wf5zDvzqOI4agiHEYrdhgvHVjdNpwfSL/PunT3yjkfjbSqQMeEUmufPqPgwQShJ54qM6kiiDQeXfERIIU0mddL6hj+96fcdgkooPNkuEKmI8kfJe4nocmjGMS480eqsloMO4gQ2Q1sL7aWSm1jV0O4hYNBdL0DmXWFpbfzuBzJcnuB0ziA9MvDhF48dkUhYGAHLRF7MXBd6QSQ/KrOSUrbfo/f0biC+wngp70NCojQN8gD/E5VFwrg/0vQhLT+4ZMB7lk5HwBvre1sQIrLPgmQOH0K6ay0VXQEkKZlopwwa0WCTwxS3/Ctn+2cYFYqAkoCtbTTVmOT14ena13udpvmPuQBx2xCO5nuA8toJ7Yas/ODmZyPFP3KGdtRQJ9aIWbgH9bQiOSOgbQctR/lsm2yblXnPXV9ibqOulaZemTDv7rIzlrTdZeXowd4zNqh9m6KL0wxU8yYdq44UrasevpR/81ZwFpwTDkYoZTal7oCUIIDsCCuqQC0/dXt8AxVEZCsXhhwJM9VYTsKIKJkgXQe5bLNPuJTqEf6MiV9dpnsGgnZ8KehikWvc3lpnQd4mgC7ZJWMfCRNH4dpmQG7ECXCs9Z5dAcITeDGKSz3BenXeCauhofWQX/YnHBMJ15BvzKfVgAMxARenfpkOcWZ5fc8gSDN9n0yL3DcLxQilDIf3ThhHYNUPWtVmsMvkozT0V5Nmo55VydoTCg1mddnPBlrxeBQ23o7Af7UXpiT9EGXJ6nfdEzo57Sqx5TnU54ZMtmjzow0wCvgRPoLoqK1VMo8uXHCOgaD6npzm406TW9LGF0wlfYDY3iC1u2rCS7mmvYeBuRXS/SupELz1Z3wXZJs+49r/3Kf+B8C/EL88o8AfiNEkAA/UlIEAPh7WwkuSXM7bxTgto7DAbCj64UOSKaDPgdICL2HOyutbT0ekCGVEFzARhuOQms8D6m5Zr7Epu1Lkmq2Nw748qTlVeRw3dy0M88FAPlVJzCW2nQzKPP6sNkGthKz89sS9CPJIEL4Kztj8oxskkhLyjCwP9gdISf4UU/XiGRJzbIbhUysN5skVSoY+NOqWx+0ROh1dRucvabrLC+X9BXCRrugvf9TJ3Dg9kDHQEb7yxflWxTjgz6B4ZXHfDynoTQOYYxChVqThVKfgFodTC2kh9VPmNAlkV5kQU0OyfGKRVzofcQZ/YaBPc/huTmYDgQsRYriIzoNcqxN1eG0BSSGztGtj7TuEQd1yrQ+Z/WvSCm4tY7FUwVYfScCnkB04zi48/pPJ/AEoqC1JlKdxzqq35awAsizOgGMidbw4HdESjBAvrGq/TbtsnLY5NWdXrdtkOVmAmvEkxl0vb8e1zvDae1ZG7O/0n2sQ5G8k/N9aFzdGGvacKl5Lgup6+Dfl7xjiGZCKzE6mmxWX/hDxzMbOQG0QKFmmUf5ALmjE3O8rlM6ji9AftM+ZGx+vD3h3K53EvCMCZ0B/c5P253wPx0IRedKlJnX9fTxsl9VlI9FjIyYTO+qgxF5nCQL0a1MLuYOpLUNUtax+ZsWAPKIZvFeFZXuhPwp86N4LVJgfuw0bWcozi+YR1JvP5Kojstrv2sf2678LnSVTvK2R/0o73402O0NAPKOLmcfT6296KHLWicCBrTmUHhVUSPiVHIUTCoivF6rmYnIrV9WqZIogPxSCe8yft7e8Jpp1FnEZZ1WGPiZEONhZ063YbDpWA8+5HKuz4Z+to9ODQqAl1LJHiD7risZJ92QWlR/WKrY2bvkNFdRhDAbkDkils9INfcyUX1rOssY3ToUAbzUSvaM4b6FGGYDhnqSw1rFzrjcxlUmYjZmPZnT01hJRmu5U9TW9OsnOqEotzIcf/YayMZzJeNG2ZAwVL8jAewm7xJfrjIRtzGT4R5i+YyEcNffFZVQ3dfZAK7PTbzrcbF+1g1gLqTgyaALcb5z+NGy17f+GyMaUNmzkykGtuYxHMcoq+ilRP3/nR6MqAuPLUCvaj8XpzjTYWQABARCwx+gACDUAhDBHBucYONLGHGks50c9jumUr1mbcTueuq1D6Rm0SKMbMyOXMygvJC38ll+yJKsI0styqhrufVteEva3Lb29p4+11H9pN91QR+XvsC05ooDOYzjOYML8welq9Tts2D7eC2xCz9QNGEIGISUTNwisgaWDgJcO3HVzeqnCZqhXbuedlbmuvquset2qud+yoc5xmme6lwNfxRjnNWMjzcViht+0IM+FtiDCgGUMMGNCLIYwAgIbMzyLyinnjA9jDLBIlsc04ijlzHmOUiOmlbLo5reVdGQZC+x2Bpb7bSZYKZFVtlkdyB55T4ViSSddiZxoogxrtQzGjVO3NSabt9qrbOhcnOtd9BlD0orv/Ia6mwZoDJm7ugEICKvYWjlEJ2AkklUDmOUek7fbXJOaX3H4NTeuNw8XRa35e0+LXV5K1v9QuverzXcoYvviuEqVqvGZUUqdkmqXFhVJfcl5BJOSZ2OxZRIatnkV0K9wpJU0pQWzV+4VFweDo+j4ng4GU6Pg3EeXBQ3gTuPW8Q9Lc0qLS6dXbqgtKy0ufRx6cvS8dLJ0lV8Or4AT8TT8QK8Am/Eo3gfPo5vwHfiB/Cz8AvwpfgmvBh/Fy8lkAkQIU5IEtoJqwnXCB0ECeE+4SMRRcQRJQ/QlGzKMU0bM3gMQjFTAPNJRdpLAVKYFC9lSIX9YXrlXUltW//E9slNJ0pkvz+UccukZboyqN393MVO/R/ldgeMdkw0y2JrPLTucftWQ/I9uXZyU5/h/I8CoIqHCgg3EZQhKw6hwUeBASchUvQxhIKNi2RBWcobhUERUBQUIyWey/CjiCHOFDMeP0qk3lPLqSyqiKqmWqjhlc1vYwf7t2s3e0ND0fS0NtpO2lu6Lj1EX06/Qf+PQWY4GfMYHYwRxhyTxgwy25n9zKXMi0wJc5aFZxlZKMvH2ssaZv1kLbMB1Ybdyu5lr2F3su+xZ9n/LtHmoJwQZwZnDuclzjDnC+cft5jL4Wq5Ee4wdxt3lPs/T8tr4C3iHeWd4V3jPeH9z5fyE/wx/ln+hEBO0C0YFBwWvBPKCxFhQjgk3CvsEq5W0ioVld7K7sollecr+yr/q1wRVYhiorWiKlGDaFQMTNXFcnFYPC5eLD4mPi2uFQ+L34m/iGckahK2RCzRSJolPZLpkjHJIslRyRlJnWRQ8lOKlhqlXdJnpCPSFRlVZpV1ynbJPsrxcqFcKffLp8gXyTvk7xVYBUFRqzihkCoRymJluTKknK8sVYqUH5SzqlIVRxVXjaqWqFpVN1XTaoiapFao7eqkeki9Sd2pHtOoalDNqGa35pHmkxaqZWnt2kHtAe1z7bxOrAvqRnQ39Up6r35C36mfMUANTEPA0GHYZ3hq+Gz4ayQbjcaIcci43thl7DPOm8QmjclqGjLtNfWb3phWzGKzxmw1280B85h5obnMfNI8YH5sHjGPmf9ZMi2FFpKFbhFY5Ba9pdGyyFJvGbUirUVWopVqjVj7rTutl6wS628by6ayNdj6bVttT23fIDwUgFqgQ9BnaAqahZahfzAMxsJ4mAwzYQEcgdvgdfBD+Asij/CQBuRZ5B3yCZlH1lAZFIUqoiSUhtJQLipGragd9aFRtBZtRrvQqegwOo4uREvRCrQKrUMvo9fRDrQXvYM+RkfQMfQLOo3+RlcxgCEwBYyJtWPPYW1YD3Ybe4i9wN5g77EJbAabx/7YIXaUXcleZqfbeXaJXW032Rvtg/bt9qd2qUPR4XTUOTY6HjpeON443jje//zFCccfJ8lJc/Kdcufn15qd6513nU+cH51/XAouNRfXZXBBLq+rytXs6kW7DLtWuS64Xrj+ugnuSjfmHnDvcD9wf3b/9UA9ah6hR+9xeiKe2Z4NntdeslfuHfOe9E75lH1Sn8Zn9tl9Id8K3x2/+Wr3af7t/qf+hYBuoD2wI/A4MBVUD1qCfcEtwe7gVIgUMof6QttC98LwsGG4Orw1PBhej5xFkpGDkQeRF5H/It8jS1F41DoKRWPR1ui06KJoZbQ5+jUGixFj3FjnogX/1upYS+xW7EUcHqfHx+O346uKDAxOuAEhB01YwD2owQVFaOI4Ft/xhX/MYRcNpejHGgrsUUqf9KWbwpSlLs3ogLikpCB1qKRvzhd/+OEsN9lhDsvZwAn+w23p5JGGmLDFJSNxuqJv/SlrRU9VqFH9TzjXAQgBBz6HC/H18j/kVBXpo9TA95cSDG8UFof0c/lN1NI670MIHw8nX+ZNshYEErZxkN/+N4Ro/P97hlceGH/B8ZMxqJ9kXSIhj4kDHQi7tRtgng6aMaiFAISvBg0yANnZjsA+LVSs6EAgAu8wuLBu1oLaBTQ6VXZiQz8OsL4NGcbx5HcZhCEsyu7A2gmWNsrNk851zArb/XQRS0evErwVrhfrY5bjlUMxnj7Yw3yi7a8kHEhJ3hkmIjbOp8KsLiRsKzj1BSC7hc5xWGmOG6Z9gzmDZpJlCs6DSjFE0Y+HX//9r8qGf475RuwhsRvsb6zHsANXm7QsDd8QnIPOSza4Q8gV+DcaV/PmD657TUKFtjSuUdkoqZecS6giSHItIZJq9SNn92rOuGhhSkPjFZdr5aT2wY8Iif9jid1L4mimGC+8My37EyjqgwmwxtRqgnAyqvTgk0ckRJsidzlJvm9bV0nuXCMNpen6p0a9rsvVoWmiDwL65fMZEiLo1o3rKq/OflNxIHucAWZbqDdD9gZkJ1KQlhlXRskqgjgBG7bEskzvfGShtGLsOeljGBEiSYAQaNWX/J7hLHwBtrNZ394vqdtOPZhIgK09JHUAVDvkA2L2wTstBpZqjhsVPFsAA6ksM4viUhqbB8EqvLLcKDRIPI9v/NTK3LCad6rP/jOAh+l76CavwhWSP06wGt9zeueCjOM0HViOrSC5l6wdGyGwBFxA/1pv/ar2bQn4486ds7H2p3M81LWiuYC5tMa/+hBYwbDBvwwy60rnYdM2wDh6ExlkAlfC5mBkG6ANWWPQ/ACM9bv1ECytKBscYtax3NgZDAvWLNCwl8xDqUSplKXdWe8dX9A0sxrVRnSVUkCsLdusLPWASZMBa5vBu6fasD85S8E2vtuLDPcEBLcGL4nMUVfre0a3fsMvlLqrrpFe80xc2RjzY7IVmqZirlzuBpqTRb8N58JsWTm8+piYrkwxLdd72IU5PAeq7fnCp95NW5pwaF9RjmMkfBZD1VXBhgymxVzLlPyktcXSahqsbR6ekjpW3ZZpDBOLJB8AZtVpkvpoNgwOoYhEmUhnYH0Kovkx4FZzG0i8EyApE5vH0b2Yt8sjnlbPnSDU9RyPiV1/eP6cnvXrGuuqn8lf5xcBGWW9DOZWNwC0IVoxcMuBz3CP0Suzw+czJGrNOkAWhJXFgFqTEUsFGUJyt6nApxb5x4ZiFZGfAX4IwjoVrUEIDDOZObsiiZdcheaADdG2oi6kw4b4ZW4dIqRXxbt3d3txfn5xd99vV7cP8Dht64MdcVs2Et0nSqUVmqnpO+ECAc30ypLP/tUyIt0j3giE8aB1DiOIqDF1U4zltTWFFmV/K/E7AqgYoSouCEnC3tV0JUA3YAu3A/98y4woHXDSG+SgeBQi4Q5rEys6uXEps5vnKOaarKoDNLhUipiIU4LF1KJUks7iBHdzdfd+pXiupn3SnhvQIgDKy5CDRCY2WWXls0Y7EglLU1p9LM+c3UjSJXCwvzMQKdKKLbiJFO1F0nR9i6A/BGpu6UbCiEzzcHbOaN5UxvWr724kup8H/U9u5CJto+/W7aDPX9ooW7Xtpxx3ASbKL9VSNvPcyp2UAkATRm+DNpYLuTB4PvmUd1ut4d++ef/p0/tXLxROT6LF//vVL372s1/8+jdzOt8EfJhV4YRDxtfyNIWO7cbyGaHY3DrXqjb2khrNwyM/LZza0fB1MIJ2zgQ8rdt1G2r/lFlebrIEJ4KKZ15R25yOKWliLzcer/LPqNFlXvIA6Q90sukuXPxPH798+/bl43vnpv3Xz3/6ox/9uBBAKuOZDd2uPJ0GpZqI3kmsloc27onWnahf0k8bBZ+7lwSQQjikUQW2NNxJsYD/TyZltlzHu7Nsa6m22NHeAD89ND2wgiUDuA6sQQbcWAwgC4GZpxWIpVqfbYNQEmPlWq/djJngjsOH2gPyp/x0bdbsLAwT1ZQopY476ncOA50u650UWywBDIsM++48FgVlQXZtFfhVGUrrx63Z9TEzznBAXmdG4KzPTTMZNvkhu64j0sHhLrkacTHMiiQTzRHCxr03qwVvw3jF+LTxwcXlmvu+jC54VQVzYgpe4wt4djXw/9t/F1H5FzZaJ3g6PrbC+c/2bK9ism8InlgpEQwTC6GgchBCNM7LAfO5u8yqjRDpZdy92DqmNHn8fxCiAsiTyAUiaRCJURkxqRIN01FltKDyt/H1MefKbwoT2ItyzzZH2cKNP5cYDOvLGLvSiVdaUpRqqVhQxZtS5tyV+4aLHdELXXN0cazvGlAZlf9PGaMMtBisg1SSCHuruRc+Nv6DMtC1MGLXyNNPxxoSW0boM5CsVTEW9WFah7rPSGEzi8fZH+0o5sHHWYcT2jVsbz6EhHCfR/leRJIAQNGVUpIGZnXpbkLysa6p7LBh62qhaL0yYLQKe592BgC7vAuR9Q641JVBVtZWytk6XUs0aT6VygnjZ2lBxx2wlb9KVlM2y0XPSlVjlRqnozzlOCqzO/syl7lCqeaUiZKcTUc1xZZR1m1qPG2AQjVGzZ5ybOvE9eBaFm6tZywoXkQacbdtv/sMhdfjzXfmhrFXRuGSNmztQFeCCXE6TSHagQxdbL8a12sDF75lV5f78/P1atV30bFBCwG6XuLQwuwE3oMJg3ag3xeTIMmlZYL8UNhM0xc3ri+whrMQN4FxtowPE8n9x+64OcLsDDqG6DLCwHhIV7s+XcJfr9doUFpvSmCvSXgjyX2dwX34HTuWC1sHOPj93NczvfVSPadJV3OF2DBGQz6flhDw4mUq08KIxbFqWcD4nIHNUQVpY/B+SWxeti7WqIOVBWHDYoBYCJilWl+4IdkjFGwCoSW+5u0wtlx2Hj04oZqyBHYLZnqW8WH09LC9cTybjFgiGDYtaL+VIr/TwJHVXL60M81kHSx1fUFv2AkiHiW0bljWZo/jufu1jME7Z80PGImY6Ak1HOWjOpALwhIjI4FTtbLfwXyz951a50OIH2rgO3/C/pcjyIZcrztrD6Euin121prv0BMx1pNV/18bUmvZqF0B0476eRecGt1y5K04J+C3Fbr+Zx9b9YmxfdhRiW4+fUKtVyNi3ZM0DfWuuT4zv5noQd/XECrQCTZ8tSo3CP6PC4UQPiXK7XafP5OSUk4hXLfRU38F4o0GXQJnjINGMRBbaOt7fGk+9wmP7u4RjvwlMLJUqNauDEuBxCKtWgl8KzD6trI6XPMD25V0iNDCbjH+wu6Qm2PWL4eaTHlA3bbGQ9eznFWcLnFhHjx0hXy3MWU+YlfgKww9i9kFD35+2aRLPcZ2P1uOThI7BQ7Wr67TNY1ZOZnupb4O0xUyvAuOzljTS8rGhjAuOySAFk+dXkpCreYILxnAQbPTgq+nfJmOHu/HZU66EIk1ZXNyjlO01BTQIH/IlMUNyyVDbcTSRQQmUYHdBi5QXSCOjcdiQqrPnjJsqjY3GlAZWEfi8TIKadiw9bU9oFiVWvKXAT9ElLI7MHaG6dj5OQKBCArfEAQWgJ9eJsgoseC/QLDyP8zK29v0RmfEPC+KeV7EfM6VJbExZ99oXJPMR+z3MzoPV981Yt7naF4QX3IwG8SXPrW567LV9rY78kkVsfYp5UDXWs8IrC/AZJsqRLEan5xSje7MHpF6N2h9Hpdks2aphnGVTNr7ZFEN/ZxvqnouRQolUAFZiWAjIAQPgt15RdBs71+gcynj8yMxAC141p+GYecUIwDZRdZnFvPpxlgn6EJAWqnlNFUZA/b9slsSHE46pWejvQHBuA/BmeDj7ENBiDBby6cVkEap1ItlvLj33oV0xAI4Gmh2JZVw3LQWEW4KHQl4SCqbSew5CcE/RZeHVAZK03ozE4IJarS93gdevU8JlG7RPBmoQxp26tEM7HzRFqzrsRyRozjljqXmqD6NPupEXlbRVKRq5j5xpfxoD+TBOFBoRKgGRy+sTbwLrwwnK+VnYlaVZ8EGKISb4XjMXxNsVv56W9cqwQYDA3fWedMok02v7ZV6BGPyDFJUlgxm7Gx3H7yrF6+caQGHClUAL9JYNxxugi+qn3gwZL1nTThDJipUQrZLLoetGUUpCn+eUeqLCqFJYcZp9O63m4I/4gHTK19uRmMtRdVzRKnX0LtYxbLCpa2RDFu8ETOyBY5llxmhiHaej7wyvw7NVh2qTSWFAy0YyGLzyjIFakRO7PKXlLaK01IQ5op13ACsLBZ0ntjaK7G+tQF01hGwqzXl5qlZJ9CKAOojlMEMk1F8uJeXsXnDL7Kc45kKyKbbWeQCAY50yBrDIt3gaSSMJ6ukhSO4hygrCIXRwwI/1zgBwfrI2CtDWeMg6Rh3Gr7dU+lza8KvVMIiczuMkQ9aRA9tsEIhXJLIoNmBHqq3qUq+5VVqm9LlGHvNWXihK+EcpLbb1854K461UTgU76NdM6UCmVcRFSZiZiLRRVm6NGFCvF9csZ1ji826mAZBo1UjyLpQ0SiuLUlIo6U4TBorLAH12y6K0MCRaQlU0gpHQ9/tXzSTdQg3a+LzO4mJwftRCkHckbP241cB1T5E54xzytVmL25+ANKqLQGBq0wzUCp2Nwh97NwN+o2b7o4z763x4yYL/PsXyWQEiEJCHcBSKxf5Kl8wkOUaCsS893U3NQWqDZOKh4itvoxfjIB3IMop6h7GJ8LmXnbPXAKA/82xJn6QlajPJe8DCnj4f7QEiEWhsSBUFgtszZXWai0DwtKsJ20gs0RrVhGcnSh6BSD9xyQrOfrIGPaN0DMbdPotEIn5La/Pk1L34LH5GXB7sAT+xYE9yXYqW4CK5ZZbzjkQ2rth1XaxVdp3i7JFtSRkTYn34PHh5urq5uFx9bVZnw2M8xi05fKPnnP0GCZO8ZgZ06CtBewZwZ5eWTRRP3RB3yazqSVc9sB6zSvWm3ApImCU2ppyxvAKcyZmKZfbtTGmLjVbW3hyXl/bn9jcD6HEKyHC/UKkJCFceCAJ1xTFB9Py/gaAGfgD7CWNQ2Wl5vFnld853maqox10p+YDKVViCxAHDnIPItrdROCUi7bOHVp14hBvAnI0neqBiubUyioGup5wR7W8I/9Jr7b1zYK61DyZkb5xT9Bz0y41VxKRUhs4cCxDDyMNUD+Kun0YCcnsLWgtGDLErjDaGfE46YdCMoSEdHjuqv9b2J4kOxg/3v59LGbQIAh/0pe/2KpTEaRjZZykjAULUP0Ew6rvAEmtGeb92RLGQHKdM/HqA7UqNgwWKwMrKBoLjUlKGzrmRFurtnMYXjB2A0erQh2y8AIJc5haH9cQ4aO7HGX9vJTXm7FuRCgmmPxRNm/rG1UKZruSXMXXsK9mOOAtCTvXkdKMZ38KpEQO7kc5e6ZH1P7iYeNZe2IaaKFRFUHOlfIJIyMaIUTUn/2+WIBIZrq6j9HN384+b/oZIgD53Ze+B5YtHo6QRUaO5C9aUrq6oPURYIGJFSg3yALMLArEguDmqYKwNLiwCCR7gMRRrb5F6cVheWjZ6FWJobrSACBa+I5RR0fWEkFd294lVMLShp3KsDhwLDjsub0smD7Ohq3Na2stgcXeIHJntRpBIuvc1W7zqNw2zs320sxF9yCy2Lmu6whz6gvkVGH8lgDdlJ5exGt1p8VRFpHbjlsYa52jzJCVc7TkfASldIScpqcoydcsnVNaAcHLdGKRezEhgrFhC/yC74mLdT18K1IzLMOArAq+kyuNL5Q02BhID6d2AnoltEaY5+jnBEIwMkLFYFevF1Xbe8WqDnqWfm+1Ms5EENeaDTLd4I3EFJx+JlHUjhmu4OW8JS+MVVDaQy5aDWIlKbnQmjDNfqNPsTp6w4jnShvwQIZP0EyrrxtoHpAmHRyzD72L0pCAocIh7KfkJawz8SJwZWvtAcS6bvxcgYYWSUyrJHtleHu0HxrGqYSW7gRGfk5Ty4Wb9KhHS2Hr9RkFj4ZEyJhZWtVTJEArzSF23fKibC05jnPRRkeNyP+ghukqlBdDZr1qnb1nKB+VRKGSh7juXdGIzHzLzLWtp/FcyJHJA6wnnxkSS4PGojULDFRka23ZSMFIGdGppLFMAidi2K+UMbKwz6qj3tq3R6qQaVoV8/tzDrEuU0zRWcPPDWij/v5FCKyVUmJFXEFo9cNl3sDoJptfkd4dBdZUpqbB6eZENKuj8YXP3KCL1Bp8CMm2Y537aXGnjGJwbGQDnxGqWZoatILYjTwmhOslp5d0cbi+M+5vYoy6VYpO0i53yXge40a8cywW3awZ5UwLartDJNlW7G/G+1uOMNJqZ5Rq6NWU6qwaQhYrzxuA2D/sncBKpLZZwppS0YWid3o/odijDoXFyOvc6D9Ea2gLrrOtAEWc4E1c93BAP2VpmW8cvw6AWDumJcnXxsrZSareZB2fsYHqtO2u/DeW9F6VvUH9RimURxufCyt6nUWq9yGQCsMd1Tew6LmUYSFg9NCjUbQEfNpH8VIbRTYPiNODzypGxv0B50sp+6is4tWBUoFHl2FTQHN0Yn4DZGk+sJshVIVd4cKikJqErSv0jGIB1QUBJNAujr8iZINPsJtjU6Di0ERgFnahMKPgkViLDWHBYR05vviuaN1qhWYnJdLQH79pNUR3JDflL7SkELw177AjE6cnp05kr0Ep0CZPSbU5XesgqYgRca7AUGAvQW44jvxJOA+uzzmKzYO1c+wZqvIDuloxFwuf0TOMbg7K3EDgwRXcIen8vrZcuOadYWYorDkhxlHQFvipZQKceq1CB8L9uTU0p7Y+Sb+d6dmfBPYMm04GLgCP+Vu+EBoK+GPYdLZeOsxIqs4H//4FpxASLTS7DDsaSZ6qNBtehl6EOJOnAFL+NhN3ys9SdxK3rBGODs+A5tzPUWke+PIrhWGtIlwGsSv4PQJGn5b+bH/V3fK2zAwe2k+3Ur7Q9Jy3A0Yl35jUWiwIYsFGSrQUn0gFva8D5TpOnG0EK03XkdnvgrXOj6FpG5GtwTmXmhDEfhAn6HIzpt//1qZeiIYgF4Lbd/zA8FQ6OTjIfdccpjcTsCWG3ZAZ8malRSmWP+zueLrs8GTCNCp/+j58JzaBbyZf66YBimtFKpnPp4QdL3xGyEl5zeskFnMKGwbbqGGw0Qs6FvIaQbEzcigZpwrk2Oa57pTsWoYG21FrU+A9/VB0Pe6DmzqzbmzTheZyYe3HPT1XuQPffAuqAE/HCxIUj43vJvjB/LCMMr4jvvo9lP4kS4MgYzxwEbPd097XZ9e5j/9oHn/xi8fB2uERpgdK/N0Kod+JNrRBS5gPpuOcjKqMs2r8VvrIoT5/+inL/PDx+v7uYtl5RVdcX8LiHn35pdlngr9F835SPsZh3uS11IFeEzmFExZm85W3k9OgTIEGbLh8ZSKe/OCpbZvYSBqN9gL2mT5K9kbZuvFxuBSYfxSu/P3Pfvqj204DWOvD7KnOIBQpMtkNCNp5rqe/aowXWvu2KeJQdQJkd1ypexDVItU5mTU+Jjc6S9KOLjZ/XeZsiH3rJE1K7WN39PDYX6GtK9Y9gYk4R2vwGKrUeDxbi0VBvea0UmzU7V6yr9fX563IrQsxl54dDmKz9NMe05k/jfOx7e8nLxbJhtNvM7RNo0JOXkz8H9mvt7dLKMJuUBMdUUAf6VYptMsqhm25X7VGWueVwIbtgzkeHYYCUr6nfqHXA7K89N4ZdxzHfW2CghSJkBunURDo/oRlGq+s4YXlSg02ZruGcz6py2kU3vjoxDXnvYxbIXHDKnUJpX+ldr76hHWShT92B1wVPhDdB4wUOEvGrA61TvpyfiYF52LBLVGr3lX6yc3NRScL52OcjlWO+2najFx09IxuDA1FzMMXa6m8IgrZASmnSEXRZqMPo3ElT3djEWaUcqnAOhyp4mzo4Tl5F2Lrm0qVoqyVMnPw1irhyh4kZoom0/kEH2z0u99steUY1Q08ez9i/0qZEJnPKBdd5yvwMUDNbilrXtebyJZ9P09bYv9FlSxxJkpmLnWKUBcTQSHiTJ+7nALBlUxjlX/3d7KXrCzOcb2LE6Nei3uD4faaVH+xEs0eb3GPuJQ+ABahJYwPv0fbYKhSzMY9hk2EzKiHoBwmUktXdvQBaUMvgYACv4B458OQ1WJOLKxSDaeHJYfl1iTp2/K6LFzTkAUFhC8FcAqnp2EMbkRb/cQgSUn05iRYwO9GsG0cvNqGUcfyUq7Ey2NSurxr99jVJ7ObQ3E9uKZCSF8aBps7sgx7rm0ooyRUxtbEnl0GX8IOnsgc9/trypTw7xv5+7vcoB8DIHFlMYRN1IIcjcR3zbh3dR2cU521izFxMXw1TvKlK2bNCLzYqRXLUTz5zK9E4JhQvz/e0jfs+F429IIZX2vQm7dAQSJHuaWVeM03EEFhmjFYO5G3s0VvbGjaGE9GcNZOnB/JIidT0bnPbYBSJd7FrttlQj979MHEudZOo0CSKYP04RDJJSUyfHmPAo2JVAcScyRrXHRHHWhFXAVeeNBtaUI4o3TmSFF03IaASiFB+A9XsFy072BvWYF8KhW6AWnR93Hpg7GnwrgxIDm4cu29LP/cnCjdzF2de/Mp1Xuz5NICw58VWI+t02q6mBpJvEm8uTfNBSrJHPxjkxQJsyASCf42S2X35ufZPW2enffhY/OJPv/8/fXTGX26f/zxT19ohtaVmF6qfBxl/nrQ4ZvcPbxpxPtZqRpDjPyHl6k7zrCTVjVCub9HGINeIdknj55hWJbp7XqkcmWvWtloGiBDlShnEOIs1aG0kinzkVyvVsQSo/chCFsuB49tKtbn5Lmm5FKqzkQzrrnWqOqk04NjhQu8HNjcrBP8nmSmB4NjoG2oHGIt52sRKZki8zJsHvwOz4dAu+JRSuqjD41YP3hQnGZX3c+BSXrgbb/sEpanyBYz34LZxmgfzy84s/M3u/nGBQ6Jqmb2+qmfNvNH+777O5QJaYEb7OU+mrftEVYp5SxRUfQwz0qtKTaLvROFXBaTByMsRtqHzfWzt9IsXfK8J8UneCh5nXiIXd+3wcgcXGZVsFKaH59wDGa7m89UvcgqtImuUlnhwRiRUzi8qBMpnbDNRXxhvJdWCG+4vHXnekpVjhfiynIqjYujqrAo3Y6k9KT6GJwzz2eIcQz0PNJS6XcXwf8PlIsxsUgvCzW4+BP0p/ctYm25+3OQA0X++GX40Rkj8dSl/6MhZQnxN78Jo1dkpcTRq//chUQFjFusZGQllUSR1b/FCyoLtsSFplFmYYV5DRhJ8rNKwC3qb+xKefK/fX3YdI91e3j+Jyy8AdujMoAFvvYJQrro36++teqRMvjwNjwMeaeIn3whOIK713u13z7FzfYF+MWnGSjwdEUklD+6TnpZJTe1yym214+bDaUUTryEtPHGNCCkU2/QTDy/EUCFIH/Uu6nrBhwsTikB/8LN9ePmnycfpyml8CJL2MvCF5BCWt242GkLOJfapr0k7mFl5u7nMXTzp93lslbF+btQpITnJC+SReU5/88jRROFWKtFE201Wxbdp8I7E62Nj6wSrGJNMRLX8CZZzuaKCELsV1zOc+2D3al8MFKyKmhF/l589OVW8HcPjxKVk8bi3xiCEtYW/qmT0c7YioJQfmGVGf6ZqbjfC+MO400f9auSs/gisn9QTmbsj3jqn5l2pLhKpk3IJUWnnA4NgxY3IEUMt4jfvemyN0fwpNrSiRimhHB27yLGKf6RqXmdldmKOBfoBirUucxiUTZ1esN+B1kIroWLcs4/HXi+DuCneIkYBfz7ba9H0mgOtIH+PS9OPB+nmutNhI2JwThCSnnBvqVJZWFXRuIAc5AJQmkko+lg3+dtWQoEWGC4DfY6fsORYuZtdOYFZxqfS1t1vhtWmG3ovFGsSnruVZfOetB1bbqrB3hddYbQMtYW8B4UHOImeKmS97Bic5DWx2bj86it0azsbR2jE3gUtOs56Y1rNt4jUYqCxo37lQEd+2YBvLBg8OmMKUZ6QUWfjaiwMOMK+DZal0y9WacZJ5U5Nur6qvScJbb3jKTwOj/aY9kW0FD19xownd+NvsWx6zh1JMWVsjdmdgYz4z9JqxG/EUEU8JC3hb1GomY+cjP13YjPL5s7cip6AY47CACE9oAmH+LxmNAdtRBtSlz3LtTh/v76rI/evfnMgYOCbZurYeOaPn/70k9PrYmaiLYpy0H3mXQ7SnRUUePs0UfL4LpfFpRWKQrNG2gOqWOdMaEEBtpj8nLkQb8N/7zIORSl7eYJIPXd9dfopoGDqFU95laBFP7fark3i+nbSO1Qsj7pEjOUxv85nRmLplFyWo7Gb0NtJou45MzuJopN/RdKfNDDH+TO2pzCFfgwjUet3pz13uKz87HrO6fF4DplxNp3xbGLp/zaR1NZkw/tcnkomQg8SvCXu8owhJbIJLuAZ0mwMlbalq1CY0/q02sHxynye3YBJrlvYBPthwgf69gtl90LbWKzITYuRUcL0foxq+wYACo+4uA4ohS7N1grYjxK2pWxTH95fnF9e3ttmTfXlxcXI44MghJCJild1zMzCzQk7tW8z/aT3Y8Madv5py9tPVPsaR3vjQtNU9cxLu0r/z5jaZzlGv28pweEMt/bvLl17BkaoZtVuAGspo0kpnAsLy4cu24baFuHLlA5ql3w2hKGJ3qM0q7Ph7/Mo0BT9GAdnsH3FqPnLFMuyC8sbl/vtvjyOb3o18tP4Hf8TSQmYPyNTBIToh9OZNuIl2kADDRbT4JF6ZTfsdMqvB1Ifbf5VXh+/1TGUEG1dSk7elJXkh4U9oLLWPGbFwiWub03Thfw38napDRwiUHQLX4KKxg9EoP2znGs+/vGN8qLsJHGK97WLb0t8TF56xW3Ehk3H9W2uRTPLno3cfsf9CqadvRllkl0scmSharVPoHMem6w3ZWdoXeodYU/vvUIkEqt/c8yX/LKNUajHPckLowifxbEhE2bBiQ3khnrnGveFFDiGiS2OxmEfz5buUEIRJOeNP5/QXRtdvmOJeraf3Dau+/YZN/zJZPgCfEGRm+j2pNu06cqx5Ci99OnZpfym1hEb76HqpZ6Aiq+5mzs5AiPYLZd8EGOPKdSpc2HhMTx68bb3vDP+fpYVifw26Mi6UZg1rTXPbdGYp4jV+AjP+pUDdJAY5izbQxW8+J5T2nf8ILvsDL/CiciUo4CgoJcK/RQ+/T6MRpZaWMg180fJT4LqAMv4r4kOmpkOy/wkcVgsn3QaoDnKSvbw5Jg+WjbcJR6DmkThvxzv1gMbxVTXbTOI9zWQsZSR3ed5jlXjVdqv27z3dk61arRHOdRaq1otPypZFfLwEl4oaBjfY21YXGsV3CchLct1W1DC031KeOJrALKZwHChYaF5pLp6/3awpHrfQ+zvEklAAsR0o8GHQC2V9JfdpsWh2utRn1S4ZqCV5vwMPS0LeOBj3iV4cNnE6M7QneZoyKuOfDD949q3nOmgCqy/6/nV2kvt4PCRt+50P48XHMIe1NtJGhjvWPTOWVOMfjZTVO1+xp0KM1I/wnhoNRe3heiHryaM+sdLUN5jrNzm6M9rcxKMW8HjsENxgsD1cBzRnaBb9BWov/KkrcVobUg9ZAI3u/5/3qs8Bf7oQZW4C1kUaQFEc8/4VCH+edxaiug15+v1fmr1WVlYN0w9fHDBrZl5qa1XijbQzBdKePMCYb2qnS+6bhqiT1ZxX2fVr5/ooT/3gQqGN8SAw6OEcVBQlFPr3hK22HNSZ/CW30U24dT6gKnd1HfRV/0RCCg2uEAb/qaAAIKwBOIJY4gJMhp3oyDsoDWTPPRMDfrzFO31n58mlEGzUm2rQZA2hSNSdkb67ReFq76QD0tpJ+7QX6sBGEFXEatB6ouOw5PiC7FxBeRXslLiLDGDNqnPPJtITFw9YDo/AtG7dyv4LUfRDeNWOZkVoeFzlK9dUi/CJGF4MZiRs3bMguHDpDCvmGcDDNfIiHSuMRHO2ehZMRdrcGruoO2o4R1EFP5dgbHg96h9aSoK/KBZ67NDHN9WS2bkd0TZIFeJnpmfksPGr1Ed9sSjCo1fTYQYw3OKQeOuJwr+w0RK2uH5voy1JW1EYfBDR90qAl0/Lq0l/eVQDg7sC59OlGkuK+ZY4h2nZbDxL4vsUi5y56XKmNqGh5jVMpoIbmy+lfN2SFm42IIZ69kXHdnd+BCyvivk/kuT2dI7xV0+16EZ+5/NhFSkLblYJe0si18PzgB99PfXek5KOojRJXwDcpORT439eY2HYFmv2Rmq99nQa+MlZR1CsyhOC/m1HDghImQUo0hVtEnX3j5kNG5nYm4XcPLp9ji+xdTI9ULC/+MRzwnmFsAsOyKc4YH5jnUWUvDIvUxRiiGWMLItSB18rUnQwln3nFBSpKBMo2iImeX5phD9f5xMlbc9axw2ggHEnM69OdSgY1Mno7miLIvJBO4dPh6assUN6A4o70A4GVHlk1jhVR/Vq/ETd57RSdbPB7pPUiMFWI1zirh/5IGiJhXg1SM0WgYRIGCr0M5r6JcjS27XrGwIv6CiO0CFAc9F5lRJnTIT9VWgqQFr0jLn/2lf6MmWloipovDuH6qqgEFc45isvQO35xrdu2WrQUctgd7ZzZ6wXkUGRiSqsKhHSnJ/IZG3/DeINsjz/clp/enXeZXBAdJ6RcFRFyBuTU+gOdWM+XR59rwHQeP94gUaEB9jrISN7KIAyOP7ZLwfccZMO5k8K0KxahWk5I2SuwrsUlyGTUjCLh062uEwGZxOpdVgDWXvmgs4BDQqz0YlS3TN7wQ9BP4LPtcDCHQAzut8hSY1pKRfhMCsuMz7uWBv3RFLbOxOym4RwoF7UBClMESI5IIKBQY4M29MghIEjxHHtjQ7utpsGmDs8io5x+EbEAnvOG2RYa9zcGqvmCvOCubnXJJgxvjMmAN7Mukc4wVbsOu30+CZvCWzmHqKw49hlDHOviwiakuYjAtR/pQe6i8K3ch1oOTr1c2RaSc0zBE7p6qRiykHTxSSw5tUuBif5zUxMqMqD7aYxNoC7E8MdpqK6tqjBOpmmMfRq+IzI2TtHGitZS4tLGPbYshiaVU7CAyGNoG7GmMPcfPpULppWXunL1RdJQ6AVXWZBQNjfYaFX9llRtVo4zNtKzocnCnyMdL9KF0EYLDZR2RqxCNiZLBtc70tQpZz+jjiA8ksB/afELGCNBfirVGo/b0yMD4Ffyz1bLrlquz0TlzmW1xiXxEd9Fq/+SaFKcD5Y8Yuzy0DURKhcZjyJibQARBz1JgqYbTlAUNwBkbW+zp3j0ymACUFjy71Q4cjI1E404kZCNIF1RqaJF4BmrtnGkHmT26UoZ1U0yBjApA21CLWRuhcB4Q2TA8gSUxMMl3Hm0XU+1cSwXue8V4pWtRFOmmpHaKvO365gto9LJyjCO/q92GAIdlvfZeIt9HiYHuLdNgl7BSGgZif4mdhVuLtpaWK5xXx11b8xB9dHdPD6N/Nh+Xn7hc1gDFLhBar5QTRgEyiF9V4lEoMb/FRbkf0SExYWHaMOAEiZeGg0bC+4+nQnkCboB/5k2K4iiAKN7mM3iQHYCTstEh5FKQwRYoT8xrIcnGNqzTQFyZLOWeGLysuqxGUGw/IijFWPNtf94ct5+Y/P+JEPqE8bTuDTa8KtpF6QHn+Tuf9y9lDCHhTG5KsGWUVD1SAeyMNcAqCvaCbXdS260ob/G4Uvc0YyuG9XnnmhiV12qVEt3Bam2eXWJeBiM8cS30sl7FhhnBo9bkgS9jZajGGVreLYyx3U1f6OaueGyOFe6n71jgzm/EgcXC0fUP47PT788TEF8KAYMQRUfWhQeAIdw8UCZKT5EsIN619Plwj0W7cJkMUx20MPDyT3Q/wv2w/7C/fZaKablWz9CbuCnFUfJ5jZfd54UentUm1QQsXzhIgx9xds/OmHd/Jw8JMiCgbF/Qz45MAEiSwqpygViTzNzbKIOG6U7kUSNcoFZRmulp3FIOeHT2+rYrp2u9BChqmAFlWEXbzIMZE3+XOm2VbR7+j+w3HJtDRGYMhkLXW5coL1HBsYg+ScWNoWn+Odrmmf09vuw2yxXnnMLJKUGp03wekWB+ZW5TKEv/b0Geo/JapJbkMBtYX8LKHLX3gLRouWDTuVptcWZvbm4ZEoNU43qvzjtXGe670QSrZG7Fc5QST+lU6Hc/qefY0tJsLf2xBG7RD7ERbQ1OArjjIXkrK2GsZj61zPt+9HvzuWRrVX7Pa1TKuMAdwn97gII55zImE84MbsPErIqVrsZUV/LnYKg5fi4kNZpMIPYiYgG/kVl/j878xkC2D8FkOyMzN0f+eNjB3Ah9w1T60ZopUG2ibk5I1FxxKCpq4kzNRdXRjTIygXHaSpbVDqhGypavpHn5fnhvLL1ERst8XJP8mBg3c9/CYN5i4JF0PHV4GK8ePMVLNMOzlgA/bAGMQHSVfq9ajNOl8CYxwn5ENXJIeQEV4I/SvaNDTAuKl+blFrIN9zQy9fex7rRgnC9lnLvDZpwr/P8tFk/SAGdY4L8WwkPNl8ZiJvJPNUThkUofm1rikMrjeOvl+upqXbSU9M7OVFt196kK8P/158j9aEQ2O6B2W9xQ2d4MIpxvPKeW2Z2WSuDe+XqLGGPEEh2ZSmzv9PsMmS4QlO+6FSUQD/ctp5UVj7kIZyfTQJVstPAIJB1SEU9zUH6a8u29545Y26NHifOc5/x+MCSmwOhADOIgJN/GAIgnRI689LyFS+lpyMMTywh+LrzcYzPdaFnEvYSv8+zTnzZlTzgjjkc1tTygWx2zmFf5MJw5U3DjaAEY99gsh/7x8eH26uLsbCKh933X05bssxts0/HpR/Sc2BFjU8Qrg9AAB5mdLOajtCoFMamDPaOkqEM/9GAQS6XlFfhBQqDTgSOPKudpwsWd99q9bj4F+MA7HPjKF0sAIeib7v2JOo+pMhOAuGuXT8Td0Lx769y9lRS0pJU45sPtnSTb4W/uw3EG4f+DC6ydkd/T8yUeg9uSfSZNwIdQSjdXCeKnH/gSZDJ8bFU6yP7Eb4B4DwSfgownDq3+8La5vgoUL5m2xuBCcrX/3i5Gv1yfF47i+XpYDqcK4lLJyXGrDTn35hZAu1Ggh9CfUedOvZuArW+QmnWTK3Us0AMHaK9S3M5XuTgdVXQOdbut0nV938a63lBWCdA911nKWFO7EJ7T9vmaG3O6zBV2whtFPjtrL0x6+SN6qNFHWPX+OfMTOo4VeHFBAMVYRUklgLunvlvGbRqAWNJP/pmfOgkm2JSCd5Pwns9HVkjFuB4MJ/lLQVZnYG8Wcb4Rv0HHo0f01LUqz8ynVzsmb4RKG6+CsI0zIEz8K7oJLeR/LFDgJIB/wmyCix0cvXiekhNP3jVnlYeu7ZtYN3XoPI9iJkrPoIPeevJZVqZiFXyYDo5MwtB1hkNmsxSvUumpZWVLk1fPNuZolUfmU1+ZZw4kVg1VxcwOAYV4LK9xz+glcFle46cWCHyWhWF52oft4/FLdgzaLeSvBQ8o2pW7xH3+QkqKLFFlMqBM2BNkKUmuHq2UvsqsGFPQtQJVYk/uW9fm0lwhrnWNMkR7+602etJYrbwVZERhf4N2qvgSwQN+e3p90HEuT6dmXwpAYRC8NvL1hRoylCyEhpx+rnjUxxhVNSt729LH/dfT19w9sZl2ExA8SWb3xqxA6RDrGKoNTzf4d9+b7p5ulFheppBWd2bejG47tXXj0wTSwu3c7XPwE4K13QrhidBrsGlZHEgiDLY/Z7mWzblJvWbEcDZVU+67y9s9XbTOhOFsaAN6SroIkYlIGo91Xw4fQ0Ct5GX4v34P9/vc1Xf9RgQ+10lxc3Qa84G3mU1yg7aNXVewvXT9bbMl1rqaX0nKEmp/nVJmAM91u772L+El9oKifbxYy2xuSGAVXTCtSw8cBjeXfgzdApSBnbvJHVQCggzvkFhJB/ZyyOuXxXIxpkXPlv1kNDNIvMT1bSXKDZcdq+TWWjgFBD+D5cu+RrWVPs3NdIeGmie1oO/JNA6/wSFs4jX1xK8OpTeevHEKh28J+mO3zomnpNSn1thsQ0WmzKmpLK8pDB0mmINdaIUrSsFb2k9OM2Nde39ngBCT3IYKIsouFioEFdBIQ1y+6UtjWaDscAcn7JwzBNFNwFLjmcAJOHOCRpigM16UlI4TS1m6wBm9YnjW4EDFMSnYIhzqDUnNx5sfR9Tgjn/tWSJRodSc4Cwap4Cd0B2CKbwePaHk722P8Z3xfZljuiZ601qZyLTj4GnU3GKrlXVwOye4WYjCpka3g2CKrHY4p3QhHjbO83maLLqtgrShDO/b5OeA2ZCCtNAHbUVnV5b6aT209e/pwbC9zy/CH8ujRY+oaCN45a0gQINsrBFsryhyZPXSXqPlv13d6bb0ZdV+deuLCvuQXsJXhXt4tJR+MKMIf9iaLu/CiuHuhhgp3ao0D+cT8ZRtL7AlcOCfHNEcWwzCHxf6SonW3YtxIfhrErOubOmGpDXUapDOQ1aTI80jnfVgOc9eYec94TDX9hk5Tt/kt0i0SzpyYbtp4chJ79WtTyYIF5bmxEMZQQbbXyUFK/KrpZL5by0EQEwK3Qem2UgvnAUq/xg+V3lyKKH6BMLRJOI6XqAqeUkvaPQWWRqrAfX6z+Y9kRGBgdlLZjKQfSVy2eni3FdN65jSn2daiEpfKMSYuD3DGy8jwwsWvPp/cP/K5MpCN1Ya4qSS/1sX0lN9x7NqsgsqCO36C6kyzjwx8nBBVMVYDsmwcWkEsIV9XopKEcs1BrRDGnsIvpiuYpJGxgbLL8g8TjfrlVkwcdeMHCKMv+rQ4z1/CCUVn9XsZoOeMym7uo+VtJtLVXK7JPBmVemZcE2pvXfAiaMQs+7f+2X35/Fjf7SU2RZyBeVuJw71BsenMOdKXwsZ2n2QLehJtMg28DpYFWAN32ssBDjaWF5YlgyucGQCgKQxoJLiul9azvcvW4V/rwlFIV+1ol4lhsW8jXPDsom+rysV/eogUSoGfPcEgwpW+9iBExu1y1szX0Kx9TFNxAyKBi8QahR/1/vk0aWuR4ik87dKdkJzSiI5hTNgTiwKc4nT6QHHDCvnLB2o2eNQD4yB6ssUazWBwoZnDGFpSdvayVCT1zfXUfM+2S9dUwO4KYjO07ZhAevRBwQudY683SZCGxDt0NLZBRNy6DwIPuY0OssLZebiT85h4NXdN8dI4Il2buasxSoWmz6XVh9999pVqcs8ninOxAZEpjIuxpRRzOtFXK8T5pZgqWnpEiGnlNlZehk4DwmTK3qnYoBhdzr8D4xPMx0nI2nMEg05P/W5LEWF2RjFxjOpnPgotjXxm2LsQi+4/PtfpIZOCvPsKuuiH+jLn3qzqR40X2X+NEHi/qA/ISDM01yyiYnkr4pupJvTjYel1zgNMx0UaGWdThc/Xh4snKbp4q8SRFAqcEvhrOqEepRIA5B4obIeAPjkS5kXviFCkzoHLg8WMcVKqwuNK9JYzt63woXa5chPxOAqq3LgeFJIFiF5sGnrdgLagZbZgBe8hpPtZOLxaYoEBPq3V+Bcv7fZTUdN/dB0u2nQNGsaN03WNt7VX2HqAqNZoXN0RTYuDOvJxJw2UjepSpw8rmXre+oXpMh2XX/FruBcNrsTDszES2myDjPakWjV/O0J4rcwEDqMVXd97wzm+tje3tzdKhWSjJufk7sJXmU6SpOibIHHC4kGHPo/oijptRsWp0Uqunj/CyzgpNZMhvWdy0hAjORcXrXSXItShWN0K+b7ZMqZwnSe7eQTgPjLXbuV9cwVKBhGkGXBIcTQrEQCK28DNhzfweVoovSUtuCAoz90TdS63udE8W3P75JCjtBl5kc2fVamTa0x3p7ScWTmTMg+asQiLTmDC8k9JcYzOMepHy/6CSMH8gWXUhRyV9uUMH1oEgAM4nCio+okoAo1e9TnPpzmYHxvACmlkTzQShb1MsgLSiICJDCW1wcWOEM+JhLP+LNJxJOAtS0AM4ZEwXx8m+9J/QIFN/W841b+c00q1eHLi0cJ8qUukzFoI0KGMEnOIDJ/ftG7GBmX8VybbVLSyxcVK++P43R573R6nlb9hq29ZaiIIWnjbr7ky5ferSBB6ZLkHpryESVxJqSUk/X9v9qE5aVOpNZACfeU1nK0KnwPkEq/zsTMkfle+SXJOXoxuVMXbDe6QBjclusI4Pbw97DnG28mcEdt+XmjRxqOeCoq9F3RaAXHL2H7mH9EfZX6CZDfO/4WBE3/WP18XVit+u7H7V/ZRspvs+0Hmn4j/wddDfKrkL2jKhZnt4ZGQlNtiqbhSKPtpsFIdVdH7Nf8aUvAdodN2cCEA9LIoclT9vTpKRvrLVpffCZtOZvkF3y75qOcEsarTQ+dHZrLi7O11gX0mOuKR72LAXz0PRrxic+Mo2iejZVUjW5BA7zkrtvqGaR44T6L5k5yt4uiD8VUR/nH1WpYxtjjGDzFC1L1IClMHJ2oo3PJG3KGPuQgS5jd5IcVhWwKDrpyu8JKbBo6S6QkLEeZQwJaLj21zrDtabOsrTNjpLrcGaKCwGe87bFOQOUZMCnlqwILVaK4UG2J3Dsi0cXhmDoH4tNpTVVF2b/T9O3vLdpQXLMkCVvwW/h9pU1WBk7lRpSTQZBv4uGmi81EZK2w1la+Z+NHYpYA0CA2qOSW2J+jCUmkXL6C2DcESGmo2q6+0Ep/hwKtCJ2lyXnmPcyxON+1sgEVjghbAXaZl+8BXkLWg0m53SVrKXFTI+kKrU3QR3IBV/nrBI4uEM0Jz3QH5Bx04zTFKvA/zQDAMtwEIMj4rE4yxHIOs5/oeWEzWMt+NchurOSE6uv/bLYpkvaqjLtMdCMOXMHiidQ6OufEtbevA1ptas8kSV0fHP6CJoQT3YTBJQYeUu5KE+YCDkM/Xa8CtCE8laa9gRvUS53rHJtFCd2ovNPiSs+IksaeoTMj5xp1AnJCEtaH2NErGQJnWsHVAELA1FcicRyLDaOnqOXFazxQ1mHyNhTbgUO4ZYnfQYxCX3J5O3mecgIDI6o88AWQx3I03R+DGFwgP0RYaVpMphan0YmNie7gU21NuCp7z00/fcN1T/jNcxeYKZSabOZYW/jwSILzKoeKvHCNEfw+bWsykC2nbJVShei1LRMszZkz2AAqpQ7DqkteYYVgALE7B3ZNT2eVAds80ZPBpG/J0TF6mmVyMbX+cP7aVdANb9vD138CKTLwgAgqJB6lYDdyQTMiW0+bLD2TcxvpW+r9IC26Q3pNRI/yxgsP2gDCTiVxDpcUuZgjJa5sZM6vQXCXwvG7EP+WDYklBBnNILceuz+VxQmAsKGoIeiQfmuM3NIOR1imO5klwA7oZUIEUqgQ4FRqmF/f/ykl2eHXxWvjFnjzsFSBDKc388ctyED8zy38av/pA+4Gzj79dLLa2IEwizU6cKqVof648D7wLMytdBZCD+rwedUeWYG0myrVzjdHpX06lfZDPiiwoe07KFNJwXLtwfAWEZgeS7lQL0HsykfWNwtj9KlhQsVbdTUb8IAA5EJJcy3s2nIoHzrhGblRl+EvjrU5A0rwSfQ2VqMXppIZYxeSc6Aghq64yZUCxlbCxZmke0H8U1IDx1J83V7uBSM1a8jwdV6GS0zMBhKn1duo3tVF7Mp3pY4t7bpBj3SHXTMOoCfYOtnWM9DsBXP5/UV6O6LTvNH72HVFS39cZzr9uH7Sj2d7p+Mxmh0IQPH7EJ7TwrgYJ03TaBsxrCAygT8QA4ehwJQTD8TdjUub0gx8yJ/idHhBYy63RvGWwUEOkJrOPGdr68Ulk/rGVw2MzeegoNuh4A9xXgBeGrP/iXrHz0NHtEw7QH1t5JYi4ooHb7ulWj4pjZy7Hg2IKyFUWKAHS5cSvS1tKc/eoMY7raYGprXErP4WCWeMKbe8CuwabCcqr4Kdm+Y3uCBb0itwABlKR4YJU70w3AUZ08w2FflKys8BrIuNgECPRjqfw3Turj7JwxaMjfkDnHmwmjLIZsIbWSoJPuCsAEwJLHc4R0/5lVLfAwikOpZlWwsP8DwSjpiEtUjW2YWfBKcfuuSIbjsch0e5I1cXKPTnJY1UR22QZxLpRDilGB1nJ/S4uOHEVdEMFRz+bih0BeXJNDfPP6KqCxRMfKdq6gqPVTwP2h4bAggJtlq1yWEc/9qsC2mNiWOoCxREwRbOXr53AARNKFQoUDdWKa4RolnaSFa8iwQpk6lo/XqsSNod2dL3Yp65nv3/58WqxPBydE/bezKXAh7BE7izNL+XUsa7ZWRgzhHjRL1WTYD1E0KyHxaDZeF/V4qAlKIHnbEBJl1LnFFc2kjflwoTzzLEbMRJ+6iMDRCbJquHsAzQoRinWRS6HdxS/um6NrF2jC+ZXqyLsaFD8bgPL5jyI2KizhlcUwiYaDNm9gTRANOCw5OqMIeGHIEeOZLQX8q+X6jGnrMqhF6iNJcAcqklapBfCWrLx/XFRYfuBV4Wu1Z9XoFRtXqPfelqzlwEMPDBz7wsY5qgtGTxbEKvbEY5CWMuJBI9LeHFCfv/1181UxF+iDY1nA6NO6Jzc8xTQVLUKa8zVGkUzj7KYwI/yoYbctfNDsDuLJU3Em3PYIMt9iY0udg08e/RfgAosm8+cr17Nl0MS94uV7V/xjVel4ObEOJ/qydKQiysnEwza8olzZMb79gyLlA3esxLMTENTDFICG0Tgy3KQNOS0OUjleUcNZtazcE2kEhjnAF3QjzT1Q3yrKRHg1DmcFGXv5wXdhovRTkpRWQ1axG3ld0ZOVA1KMgORXc6S2eLssoFlHiCJwpeqh93KcciUXJ9yeRNhVNMhzOOWMH3H/mH4cbUX4SA2ZmuXWdWb85T41KpwCTBugw0VnhuhMQAoQP7NVqN6OOmm2LWWxgRaeOd8W8YfagSw9n4IhKeTxI/6xTqXKuGWMV7bjLo6ud5dsxgqNks440Up6phdyXf8rYbjsx2a+t6aWqOMv+Y0ipcEOo1pN4L6kFv/aKhlKPv1nUwfbqPD+TCDnY/4G78Ds6hgeUIkrBI4AVLj8TN7ILM2aVU4V2lFoWiEEfpIafJ2ZbAA9HolYilpd8RNrpsXHDzVS6qbHIIgJRfEUiNHWWVuXr1shMPeiWJDnfFeau9OZXLT1smQSEGhUL4xbF+BBV9zkQJRCB7kf4hX72JF2SYymfnK1dRK+p6yfCeZb1Q5gmhelu7WkVJXOXubAaZWyA44zxHntbH5+hS7LRy7fjeDcivS6GuKa7nd92l3D5W/dJMVNEE20n8JCj5vFIKPo+yIo/JBzwu4D6I77axdRlsulrfhx9Lql+B5Lp+RtFNQWYnPweUAs+vfgFtCpsoM5+dOEy+YyB6kRTM5bPSJgfStVbu3+WQ8310M3bWx+Zsp+fZHR5PQ2p4A5mjle+fGqaBXepHBaXwU+wFuec4eMAN157BUXvh7reBdiA9Ek1gvb52wRvdXR2vAKDmdplWs9kKIbptAaf5CVSYVTVam9AzWfBKvVJvcaApb34641ZX5/+RaYXPpGuilTZpkAzH0CcrKCwQtlI3soxXZYq3aBcN1nXJJ2CuTWp9thLOdaodmHLapP2D9qgNINNRui+L+cvIFzQRUng7M2NDKimqjdnzKJA3/zLC4iahWPXWf/NoQIvdaWY2eWSFuvOXpjxW/upO7c5MGDs500LPjV5CNVUy///ourRMSzOl5ZUWYU69s1dum4iBF2S1/N35QXJeaNy4Gg1GkW6oTINqjSmB0bO7bZeKk3BOMqRBBveV/H0GLe/TCqofhA0dAXjKl9SG02qSoet13+qT3CP7el3GTf19sqGxGjPFzqpTcNV+6zhBtRY1LnihmXYjlGs2z9P3mgBJ9VCPLlM0bEvT00q4Lj+lZ//l3x7APbU6UUfOzDJup8E3PeGgmInaDj5FZFDwXy/2Z+bRspbIPLcD6fCvHuXqvJ76UUwpVcC0oAKQsoaTmgfUxZNbHdNsqArxOGkcgC+scm8vkp7m3b+/u7zgDu8fltvVnMH3Jvja7TM8PL9T/yQXaHay2FdbBjqAkdVdrJumDrHpB8Z2CpQZk1yzfS6ixxgJMyXMTp1NGrTzYaqX4qEXuBZRCM5lIYjKSXmsvD+sZJZh8IRus5l83/emEI0ldsC45ifJ7RI+QqoI4I19LLwIiwl/l46vpujcPF+T9Be8shUtO/jwQmnDoNIWFhEQZPUJhdmEjt7iUd8OthSwKjZbKpCeGnCmHfV8ymjpXfA+JBnx1Yfg7rFm9O6aihsFfCakxmXCaU7zgp+VkzpjGXSHCyYlME+es77NaGJ2GHTd5STiUu0vDZlmgpPAPbtxYPLRIkCxrDtwzDsjCNzhlGDw/ojEKR4xC6IEgry8V7t8cEFhc70454tr4k+7/ZeP3L+YlMH6rTx6KzsiCV8SQGRhsS37Oza3CWdUjDSQDAdxUlmTLnQuwDGRuzfHAnt2y0Pl5SuPlDdb4VtmSal6zvo/JkYoeyZr+RITaS8b2N+KTbyTJn9ljv1dCZm0Rmo0dwTQ76VzGE88QmG8/UXmxrYYYOOprmVhtEUbbI07NzzmpUBWA68oyVD0Mr+7QQFhzmQ7RfyPdymKxykhuJn1jile5I2qPcRAlb89qgoWLzU0bpFGJW8yW/M16TeuR6B8pbakSo7xtm3szZSK+wveRDy4QY8ZjjH1HDGKNVzAr4/W7xGKBjQ03g0G+k6P6lCHRY25IfGSGmR+jR/oe3yGg/6gfar96Q38jfQ72tcvqWHu57HP73dNuJfNwSGgz/0HW5/l6tBcYqOH1boGuDHS+lGpBmt5sA3SwiumiDUhKMJGNBl9nsxccKa0gG0FaZvXbWJvTnLhb478ly19Qq82yZX8agKsh6R2Z7QZgt2gGwgW0oO0vL+hdZKUHZ3r3VbwYvnG7+FCJfJ6xNQGzcnZOhfdRRr3TjGaRb6cD4DM3F04jUcuJGl3pzE5BGh3Lf2H7lN39kGqdxCC06o24cSx6CBRB2fXzmxT00QjdfYL0eW2ZnM0YIbBdrEc6NraNujw1CleLr4xdW/bW74IiZ5GpmJf12B6mehdqM9ukktQI50/p80VL0Ja3SW+B7WJDbbF8cdROe5MBueBpa/z+mjbufgzvHKZeVg0BIq8RptI4Wp9Srg/UpnaqbSXq/MWIj4x65f4SaEijzYk0pmuLkNjyxm3qFKUXwPfBf9QxdsUSfdGt8m333t3Jd4lOJHrab6Nbrb+ivh0H546nfmv4cU1hW4wI3OEx83b5vu42U2XuFMQrzVGcKqPi0fU7fPQGo4uItEncYVL77+1lvP966ZwSZhL1+BiCn6xYmPBJkDG2pSWRRf3myjU4b7SXED8uJhqAdFjiJJDihsXAtUwUAqW05QyUWzHZLWRW/gQsA8xSc0pBCvUGqxcgfUlYJso/VwlLinnYjvY0egdU86q7qQfeOOZtIb/rxmZcTvFRFeFMP55nB4WIWRwwS47rcWlGNuR9a6H9bmLwyorSi9r5tqFsmGvwjCBKuQnHoc0DLsSMxTkNa/U2BCTBcyHdMhJRgF7YD1pm9HFahXN/Bt0c1svYFDKuEVU1A5nHBcqN4HEVHf+dFSLdCmVkqwTqKrqEk7euQDzkATgW9ZT9TN6sKUs/hmvgax0dcw+7MNHf1ynGB9P8fm0f5YV+qErRvZgBYZwpNdU+F/bb8CYWkxCKDjx/VhGPvwGQxFmPnYZiKhXrur0+9hNj1pKpPAo+5UwvpB4g9MrWD4xkR38Y2L8sr2GIZNlkNf/jsJcBgs00eBlyA1rtOkG/rvnkxEy07TqgUtgU7xGfj1gtYYRiYiZ6V51RtW54UtKy7HiyXHoBVH4XIl5EonwIgIsLFdiAU6RDLW9HgJCQ2BjcAEHjRs01y6eKagNH67088YipO0SpgXk/nWiKjWntPC0EpnGd8ftfvZjHY2uZIVZelfXLl/4He8/FRQnoNnvTw2h9PnMQ20Gq3ip947fQ7G+87QEAHRic4kXmgyHX6+jf9Iu485Ya9gi2afzvl+v+5Kb8qDxXM+KbQZYM5CSMIvPTq3oU0UsokkTZ7daUmIJVQWnWKiWTjP233+DtOJBA6c6sC79OvLbs5hNzOR02RWvWFmu/EjtsEiZbCCi9lZI4DenEdhQId/26EyMZrZimuPgmHqVfQDz4nf9LGtzVcO6ga9DOYEsI+lSOooCwUfW8I8yObEsrekApTNkmMaTrnVDDFN1PhRvf7m5vl/IYEZTFH9PQitI/7G2tpY0zai8fOCcT4cArJHGd0sUpylHMahsDud5ZvdGCmWp3KAzufC1WfNwJIIS4xLqRRSKtqL2X2fHAsm7tFaaMApXA3P0kkati6oTRGvUIUg5CgFG6XSO727wwkwT2ag0Y31EcsGl19Qw+gW9SsEvosoMVWVlPnsfD11ofaiDixjIS3g3z4htSmsTkMYsZt6oLMwxRhOygUfAkQNWc66dmg1TfQ7MIe7oq1q/uMinxkUU7TnDzUwgHi2ZE7jTUxUrJiJ+TQxKQymm9jCdmo5LCtRS6ZMxIhpQ1CmukbUZH5wV1UpnFQExhj+EOeTTzTyxW6t0JB6XHqBSJ6JcM6TPvGknTdWzVp1Fc9apiguTHVrO2imur0uqUYnibp5WkflcPRqgxm5H3OyEfyjvc6wWSbzzsakton9nq/Ru6LxzszQincUYbgzf/SIYonQkuO/EDso5r/mi+t0y6yl5qIslAgXEz/Sr2dj33i1YygpxYbAJIYJWHwNOr4r7taJTvt2Q4qVP6g1GHd2xcYvOqwr393qfwdKlEKH4v7yhu2gYVoihppcvX/BHgeiU1lYETBRMv/bKDmmF/RX0B7ZuRxm5K+pucBi8M0Mmr0XTn8u0mmeuJYY+02JlX1j3j4ul3gx7QHXlZFtCi3WuJmrGeVWvkagFbr3ayNQmWWXftqjuDf7OSVorBAhYkbh4j0s1pHbarGLtElO11jeFsV7r8RSNX3GwGiPHIu/J5lmvxqW0FlFwmDltCap69smGUrJtuUAZSXRFGSOx6NK6XkQdoiG9MMcrr9AGnSyE/5DomKYWFJ0EGP9a2azKe/ksIKoLskGXe0Gy816amRFPS5nRppr8hHDIDGPWogl4xWGKEMRfUwINtq2v6CByT5mMS21a/5liLh8/VQsTbeRpIsFLJpWdtwum2huayU50N3teQptezdTjcsnoxRolpIdi3FQpJ+qH7/ix3OEu2aLDn6PSdsmrP2lX+1mFgLw6FHvI3Ra0mrC7VreVCRm8NW+CIPQTFj2o7gCFoyI3pjSTLgNKZrpsJ40BhtWBE3fAaIkXvrOakxDMmbRaTmrTBnI5NTkGkfB2Rk+9qo2xSR0g4UxpXBsXbrytU+c+8u2JWO/LRv/D8/nYACFZt5Hc7S5S6Y5waN9VWzvclEVLtEb66d70C5n5y3Ut0AioVrzCA9bOarW1xnrER337czneZq2yjA9UEyCJC0xlym0UMMJBsNcuBIDGtHsO7eTtzJUdJ9yW3gda5oK4HiRvPnTvDFHpaS7RWedzxgYQejYHTj3Ftl9yhOjRUDSOy5WUtmKDEM0iZ2pFlvrp1SqmJXqtKzERkGzVW+HUQRU5q5p+sW76Ftxz9wbMlGVvCbdjfc6PON3t5OPxMb+VCanUe51X8U1uDE3eU/8uN3MCB0NL/G4bmylwWQjX4aR4uW4IP3JluZk6UKxZoEzCbFBIJhTjdVffISyNXc1kVkAM4U5g8CIXXQ0Hmd7y+g807bW1gCQzcM0gFBqosZYDqRVDKUbSgTR/t8F+1YBylDrW/AM+jP1scNe21A6z1UbYTq4AmYECQ1CVJ5tG12ysWJ80HTKshO2sBa7FQXDS3ZTRTbi9T+C4VSzt4OY0btUN8JOpbfpTGPkfZRH8CJ0C+oP7XFxDGg+AG4L4ZWfjQ/ABAqie9wfLXwhpNP6fUOxjgGe31t0CeG/YU///3f/P5YwY4KJQSfz/wMPfgwnnXjLJD6CdoB5Ef8Pxfn2dXdDqV1kzWFVDptSTWfVgEsPrW0kWE39Z/HXRYCmr4zHoeKY9ZlzFWFkc3a+eFaxqHekgIphzMGhpMrX+d/IRWmtxSNy+Kuh/gCyQp5FXNsmmPtVzQwSh4PX5Cq2HgPdCfFasyUz+P8hEAnOb8ODVbUIfIoa8GG3i5O/785zhXPksCYTm94u+mkvpQn/iWKH/oisVHJvKT9hZAXPtGmhpZ+MorZ0mfrWXQDV7mPmvZ+k/4+49pccGhHCG2hy3lF9FOfBxCtrrc8YgDPGofRxvHgv0VNGgquMSwK86K3OQM2fUk00QDzxMY989yAruVYiAtpZ0yZp8CMcQZJ/4TC25Ig7iAK8FXMcm5uhcgwr+wch1/E/AbcSX2DC+LcxwbNRcSz0Rl0GAdxjbZzbXy8NAh6qFAeH0eJyBjNBKSx2CXDitA7rlBMSBePqREVi3kJuMvyjxq7hGZHOp/9Ry4G3NS0YShHlx+AXFwY1B9VdzipRTgvup+g/F+Rmw9dfbGa1ByKsHvjmfdmePnUurLRrOH9AiWfcG9eVTtxvTXo7LGbkgdDEjcPAmwARdqAYVSD1i0bGIZVZGM316tZkyee4I00uhF0NcLrdz1X7BIuM06jaIv/YZjU1J1Mr1mZxWX7ubcgMQoKyw5gzKewRpI/Pc4cZZfqO1U6iLdsBDgsFqhZXEpFnKyoC2yxDVPfdTWh0VW5JFfCcvgVIOqP4SsRihm5R8XUuDOBviRPZeRUFfUZ3VSe7n0NY0JAntxLSXwOJSB/4+5gwU2nEQ/Uiu3VAqi+XjbRPen57EmKnDz4KCHtrqp9AIG6IjSugHBHwnHeepkquUPqf2gSwbP/8f6SYYvSy8H1C6DK0r2eWCmzFfn8H/lbzgD49fRnqXvGlExkCvEek4i7C3+oLEO1R6W8M3AzsOOMOyK7vj8nMGhtOoRUDg8s+hh6dSAL8Ie5bp852r7EEDFNwaevR2UxsVecb8XIfR/kHvGkL+QIg/ZAW/AyUe9ak/dE2G1CcimH4Dr16hBzdTW2JCVOZUBdWHgC6Etfi28jWNdKEvSscEhKPifuV8SuXuoZQWoQuTqGfcn3Cq0UefyHxzh9dIIWAbo3nsfvFXXDHen67Ohpodyv4GCrQVLxUbCp7orwrdB3Zi+JtSbznOoskNfgpxKrA1P4962O074BvL23rDc2wLGq+YepGYHkW6O+iZkkyhmwrjOXEPQFMx2Hvd0HOPjh+GSYeThbX+RRifobOIM8DyPZrZcYi6OjIwQ2JIgBqu40zi1ODI4WATBskgUYRHDP0RmYaw2Bz+0EmIp9DVR7GGvWcwvITqXnZWcXUHM69jWck9Nw51d3pZ9BcTuYdB1l/yaP6/gavVeeQ7spUcSsBT7w948BWbmezrD7zxuakkWgB9riJwASFPtKcbRToArRamwWBhcFiI8Z2V3GDcxjM/nivgGQq4hWEOOwHZE218LV2Zy2QoT+RSjCqD5pKdyc0tXHhbTl7HnMCULzk7NeiqycQ4HIZw7DnWIkh7hveg4JA/w7S4zINjRmi7C8uNbLN8YbYlqGcFkqYk3qTBK5WC85guQsi/O6+vcwHcs2W/9Xrms0sV8h5So+b40BhpwJeKP1kwLQyuo3AZIMZgc855UGBcOl0dalBhyjaf0XMsGOg/KzPi8fIr5jlyP3qVKiYcbhrsouN0Z+fDO++WlANugrmrGWVk/13WbqdzgeM7wzWMQQJW0UycJnIjWB6LZx6Z9r6YNAFUADurAn7gkPsDO0/jJwA780g5mfXvzcoqERHZLyeBzFq/C846qZvF1wJ8onzC+1LsHD/GcXWkqwMrB9eaF1h6nLMOJDtccpaWmzKxETlM0+Ev8LvnB5HYx1dZz6CLyVu0ucXVUI9l0QehMroTXeDoRXZeOhwQ5e9DN4291Xw9twyeca3BiIy1/M8vSgYQmRNmN0H2EEQQ1WJnIaYpCHGFY6ZDEFcO4IjNdAlRTTxH8b4jBBjCECcM3KARMwWPJ2YqcV6aaXR4e6ZDIddIwKE40yUXkBzCgS4NY2aE0cE1ip6KmDSo6VTEGdvpU5EXMk4jELVQiWMWlIAc6ZkuyUkTz9G1PIJnxwST34FmXi1qlbWgw9WGCQukE7PNZrGuzkxp9hEv9WGVOzUkkSIoF86cu0SxGgK7aLewJ0nR1CkvTJ017uhqr44Ultz8qXuDdBDVnfvdqVMJ1MA3S06dmBW1KOQuGXsyB83rqiWicToTOd7+xJn9mZMGKKnh3ERirXz+bfhBoS6m/Wg8nwvHpg3kq4g44MJVtIISatTiRpKVkIl1lCZ9Q47CSsWXblxwqTeBvidKANLY1OvJlkLgIPCEsbKTwhyCT7Lp8vxXvZkNL0BoIOeXPPuTS8cROihtEkBqP7msBhNP0lVVS/PAQ6UByFHe3ZNzDPGXX3BWupiOiWtT0aFEpvIK/81NYyXOqnfpKV9Hvud9GH68QPH2882inryod0PSiV6e5Dp92ap8aAS5C6ZcpNwbyXmr8jcqjKQaF4MXHFrh/3nRuMC/KRHZ/88jH4vjSxBVUBXVoAcGaUhHDWSgJoS7Bmd1TvHffnEJ3a6+w+60tGX9P2qQACJSPytTjqwCBbUXLU9EEh2jXg9Y2Di4ePV5JOiGJ5VExCSkZOStyLyvrCipqGn6hZaOniELxm567paXbnvtO5fueAexAGLZr7As2VvJwQaYLTv2HDj2LCuBVgly5gLCFRQMvEiIVtfvo7s+oblx58EzMS/eHnbPFx++/PgLEChIsBChwoT3u4jOiRQF2/nW9Lq1rTMdTrQYk1vUYrsDTZRg/ysTJUqSLEVq64Xw/pUrQ6Ys2W1oEKH7iEXJbQhZnnwFChUhKVaiVJmnyJ6htLFNnlGhUlWbs+4lWf+gqkFTq059Wxxsik6TZi05Fq1Vm3YdnqMXq1P3FwPFlWAx5dvboCEvSsAovjLMnHLuBwDjsbANt9VLUOyUkm4mbonGZOVKMqmgqKSs0m7zau2yqKGppQ3o6LYtl74Z1TcwNGq7fOSHP4vXcBIfSvGxVJ+srEvGRcHc3bEdfjjn6pdrbkiYnXPmoTAr9lXujqpzbJXxts/l/5FXcdfXs13zd2Q0VqYSKoQqjAnFDMEst8zgz7RahDah46ZbbrtDgGB7CDVOmAjRTtbQrzXWRIw4CZKkSLtblXtkum9Jf1tGngJFSi2rhaPGt3V1GiXaptk8Wk3Qbi4duvToAzJgyIgxE6bMmLMAqq12lqzcZ11Hnf1sa58Cs2XHngPHujj1HTfOXEC4goKBQ0BCQfdZnwvgzqNXvSZJE4WW1/Ex+AtwLxKMpqlHiKS67XMZ54tjxHLZ2PoJvExNOc25qmbCaSKjDX8upKZSAKyJdK19frRLlXmK7BmKchUqValGpbahNDDc9jkKMo+0aXfrdJ2qZ+1zpVe1ttGFLp/rTCz1sva5u9PV8DXd7nP9uj5O1j5HXuCkXx5waRCqp46DIQC3IDjuoIjMLQhCXBh2+J8lP1sGk8XmcHl8gbBSJJZIZXKFUqXWaHV6g9FktlhtULfXH9AMy/GCKMkmcM3Nt1hpGVk1cvIKikovmKYbpmU7rucHJvrYczgaT8SUfigA50mKmHMsLTF1Dp20qjFQ8fbu/uHxSW0Cqr5ys929+heLjTt8LhG9l3Yf/fmXm5LKoTJQMwXZuOm8/IJCy4+U+09edU1tXX0DymxqbmltazePgkUorqI6w0yDq/bRpEqXa+mkQ+RSV3cPDg0MwULZYOpyTYNGTZrVqNXhMhV0lb0WQymQr0ghuZy+fiGmZQ/ofDo0LHfEf6n9xnz58s3bd++tQYeO39ySt+jo0u6B0kO/Ng6Pjk9OaXlrlp+JY0xpOqXEH6qEqWCvOHB658JJJ/zl+B513VdaD25u7xr3zQdoUdkpsvdJgkFYv41GUZykw4hqnIMDHhspZvOxoYdGjXnkSTR5pJS5SFXABS4BGFgUKFGhhoPAI0BBGNyy13Wnp/ajzdpyyeqsYx8upVE85HaKNLvlvynvPdesyUtdy2Hd4o/YcVcNz322XZddHdh0W/Ku5x3bjEZE42W31/5pzg//N0OWyz7YY+qP7Sab2skGw2A2cv2vztkIlRAharExAbqYTaCFBSEIysPOoYkSh/R7ii+0e9WERcM8j+pB5y1yAY3Gsit5VflyXGO+G+vTlYrNp3BeQ7ywzpaRfnDTYX1/7q+cjmcckG+8AHyDskfwL2EJycPyXQ3e45z38L/Ak+Vm2laCR0ZanqMGUh05kMRfN+pDAntPI0k4qU6NOXM8QbFQrRiLGCQMzaDI3+07Xc5BbbM2KUqWOEnoYuYDdGAW1MQUD9S3aro/NVrH9MUyRxE1s0a7w648Ph+d3reb0Ttm4NILasubcFiiMfXTWanN+NXzonODTQfMuRsfzSibagNSCIOOwpOET+tmGjWV8Lm+mvXoNeA8UJR4xf4d9Yc1HZ3Acu9lGFTSNKJP62Z3tQ7gYoEn+tau0Y5lbVMyrOFKdLyla6N9QA+7Zl6lmzZu7TGjCXZ7VfaYbW41XKncYv8sXLBs/6sVnPQmp9HHpf6gMa+zNibBl9BPrXQjJMcsBNZvKoNRacEbNn35Za3bB43MaddgEmAhNQxGUJTEcALAiEXMCTAZmhybwEl3ne3M/gKYLB97QrIZlB8KMKSOQEnDYAQ1Uy6QE6btgMy0OmCJRelSLtGSWicK6ZK0wD5SxeGaLqQaSibGgOaMTn5nbcPbn9+XKEDkRB+rEco1QoFVhAxXaNGxfNt1Mcnq7Zbte9DMf3Se3hPIg0HavAiNjzzQcjRGCB+ilZrDZfJsdII09RaG/nPvsJwDDrAYR1CMqYA02dxigZA081gXT+8DE9jsqrCkGcxWj9QMCGiqaQ0121wbgRFv7oME1hGCokqYTGCqaS2hJs1ty2GCNK/ptqeG32C5VEHfjrQD126Gb3Zu4mb8nWZKwR2DBg7ux95/iRMkyVUTn4Tacfuf17MRXs9Hs1u7/7ck+s3u9/UiWcGuuSDoxbfzTwl9lhGAQXpG7nBrF2sEb0NI6b1paRp4BscsnhWPfSALhmnFLtgBbG1yESY0jXiza3pDNcuWa5G0mpi6rl91XbPLjcArDZHFMLiEcmnEKtkh7vVJYawaKaVSqqs1eKa2pUblbqwDQIQJFbPMDjHl0oiVq2xZlmVZVrfXgJhLo19HCjqUNXflqPlHdNTajtYAMIg8BiAttjTkkZgrpWi3haaBR1zJ1UYhghBCCGOMCcYYY0wwxoQQggkhBONtQQoRJpRpA0RYQwaUaQNEWIauURaZtg0x5dKwACJMKNMGiDChTBsgIpRpA6RM0xaP+9nz77F/OX/C3x+4xHpeorevqJER74H+v80fwGX79CI3H0e+r7gRz+yk8YNv9MG/NeirE9XqvJ+TCbxLZODI7X33/2YZDj4+ZDiK0SMfMT0YmnbTnUlz4q8LbrjiigtuuOGK9zqLdz5oS7nK+kVna0+aqWvqVpk6k54WGZoJUIYOUnYOqKdFhmYClKGDlJ0D62mRoZkAZeggBSQd8sepd4gCQIQJZTzi0ib6T1oBYLXHGGMsTT8zd4tGhVxITdfrrW/cnb5XTI5dLI/Ed0T/9kxPX/53B2Q/vsbTt3xhyEDg0d7a8yZdagceNodj/8rsJQZ03tuwStFSPCvp/mfh8LH+3oaj0/cNODfmN/vRWvlauwdz3uToNEpHQgz2YYUKnlskCDCRSoxmFCWSrYOc+Fh+Swt3fIGONZEQmxHLGz4nVo65/A7ukqWMt3wMm3LaV7Hj5xbzXEHwJa/P+1iJce/GsnZWjnkunf/6/p+9wmHTzruktcl+Oy62N/5Fea26wo3xNfqLDCCgQdrI8/btnPoevqd4vz564eeo+UY7AQjX6gYwHsjYM8KGDPikjMeqc7NPPgLIqFJDSWHHKmPY0fRelUQ7xKzcITNDXrnmsgL4/Eo6l0XW23xHqm39jSprnyXZRlsPeENnuWxuLgfTjVzR3QKzmaL3IWvrgb47IYu8SvMKiI68harKYeNZmRGLZd3X6Iw/RHT3f0bXEQA="
  },
  "pixel": {
    "source": "game/ui/fonts/departure-mono/DepartureMono-Regular.woff2",
    "bytes": 22496,
    "sha256": "5b4fed1daa90708aa9c6ee1190abca9dc22164a1c1def0020386e46b61038cfb",
    "license": "OFL-1.1",
    "base64": "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"
  },
  "focus": {
    "source": "game/audio/effects/focus.wav",
    "bytes": 2924,
    "sha256": "0eb2a24d7e17e79c6d2b4dc4c1be57ba0622d2e3e8e177999c12eb18c54d3256",
    "license": "CC0-1.0",
    "base64": "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BAAEAAQAAgAAAAAAAgAGAAgACAACAP7//P/+/wIABAAEAAIA/v/+//7/AgAEAAYABgACAAAA/P/8//7/AAAAAAAA/v/8//7/AAAAAAAA/v/8//z//P/+//7//P/+//7/AAAAAAAA/v8AAAIAAgAAAP7//P/+//7/AAACAAAAAAAAAAIAAgAAAP7//v8AAAAA/v/8//z//v8AAAIAAgAAAP7/AAAAAAAA/P/8//z/AAACAAIAAAAAAAAAAgACAAAA/v/8//z//v8AAAIAAAD+/wAAAgACAAAA/v/8//z//v/+//7//v/+/wAAAgACAAIAAgACAAIAAAD+//z//v8AAAIAAgACAAIAAgACAAIAAAD8//z//P/+/wAAAgACAAAAAAD+//7/AAAAAAAAAAD+//7//v/+/wAAAAACAAQABAACAAAA/v/+//z//v/+/wAAAgACAAIAAgACAAIAAgAAAP7//v/+/wAAAAAAAAAAAgAAAAAAAAAAAAAA/v/+//7/AAAAAAAA/v8AAAAAAgACAAAAAAD+//7//v8AAAAAAAAAAAAAAAAAAAIABAAEAAIAAAAAAP7/AAAAAAIABAACAAIAAAAAAAAA/v/+//7/AAAAAAAA/v/8//z//v8AAAIAAgAAAP7//v/+/wIABAAEAAAA/v/+/wAAAgAEAAYABAACAAAA/v/+/wAAAgACAAIAAAD+//7//v/+/wAAAAD+//7//v/+/wAAAAAAAAAAAAAAAAIAAgAAAAAAAgACAAIAAAD+//7/AAACAAQABAACAAAA/P/8//z//v8AAAAAAgAAAAAA/v/+//7/AAAAAAAAAAAAAAAAAAAAAAAAAAACAAIAAgACAAIAAAAAAP7//v/+//7/AAAAAAAAAAAAAAAAAAD+//7//v/+/wAAAgACAAIAAAAAAAAAAAAAAAAAAgACAAIAAAAAAAAAAAAAAAIAAgAAAAAA/v/+//7//v/+/wAAAAAAAAAAAAAAAAAAAAD+//7/AAAAAAAAAgACAAIAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/v/+/wAAAAACAAIAAAAAAP7//P/+/wAAAgAEAAQAAgAAAAAAAAAAAAAAAAAAAAAAAgACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAgACAAAAAAD+/wAAAAACAAQAAgACAAAA/v8AAAIAAgACAAAAAAD+/wAAAAAAAAAAAAD+//7//v8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgACAAIAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
  },
  "confirm": {
    "source": "game/audio/effects/confirm.wav",
    "bytes": 5864,
    "sha256": "52f084b9648ccd970891996c7ccdabb796dcd33c0a6d4a420bb70e51daef9bf1",
    "license": "CC0-1.0",
    "base64": "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/f///wAAAQABAAQABgAHAAUAAQD///3//v8AAAMACAAMAAsABwACAPz/+v/8/wAAAQACAAUACgARABUAFgAVABQAFAAUABIADgAHAAAA/P/6//n/+f/8/wMACQANAA4ACwAJAAcABwAJAAsADAAOAA8ADgAOAA8ADgAPAA8AEQASABIAFAAVABUAEwAOAAoABwAFAAQABwAMABEAEwAXABwAIAAiACEAHgAbABcAFQATABIAEgASABAADwAPABEAFQAaAB0AHwAgACEAIAAfAB0AHAAcABwAHgAfACEAIwAjACUAJgAnACcAJQAjACAAHQAbABoAGwAbABgAFQASABIAEwAUABQAFAASABEADwAOAAsACQAGAAYACAALAA4ADwAQABEAEAAOAAwADAAMAAsADAANAA4ADwAPAA4ADgAOAA4ADAAIAAYABAADAAMABAAFAAYABgAFAAMAAQAAAAEAAwAFAAYABQAEAAIAAAD///z/+f/0/+7/6//r/+3/8P/x//P/9P/0//X/9P/y/+//7v/t/+7/7//w//D/7//t/+v/6//s/+7/8P/w/+//7v/t/+v/6//r/+z/7v/x//P/9v/5//v/+//5//X/8//z//T/9f/0//L/7v/s/+z/6//o/+f/5//p/+v/7v/y//T/9f/1//P/8f/v/+7/7f/q/+f/5P/k/+X/6f/s//D/9f/4//r/+f/4//b/8v/v/+v/6P/m/+X/5v/n/+j/6v/s/+7/7//v/+7/7//v//D/8f/z//X/+P/5//n/+f/4//j/+f/7//7/AAAAAAAA/v/8//r/9//0//L/8v/z//X/+f/8/wAAAgACAAEAAQABAAAA///+//3//P/8//z//P/8//v/+//6//j/9f/1//X/9f/2//f/+P/4//j/+P/5//n/+P/4//n/+f/6//z///8CAAQABQAEAAMAAQAAAAAA/////wAAAgAGAAgACQAIAAcABQADAAEAAAAAAAAAAQADAAQAAwABAAAAAAD///7///////////8AAAMABQAIAAsADQANAAkABgADAAAA/P/5//f/9v/3//j/+v/8//z//P/9//7/AAABAAMABAAEAAIAAAAAAP//AAAAAAAAAQADAAUABwAIAAkACQAKAAwADgAOAAwACQAIAAcABgAFAAYABwAIAAgABwAEAAMAAwAEAAQAAwABAAAAAAD///7//v/+//7///8AAAAAAAAAAAAA///9//7/AAACAAQABAADAAIAAAD+//7///8AAAAAAAAAAAAAAAAAAAEAAgAEAAQABQAEAAIAAAD9//r/+P/4//n/+v/8//3//v///////v//////AAAAAAAA///+//z//P/8//z//f/9//3//f/9//3//v////////////7//P/5//f/9//3//n/+//8//z/+//5//j/+P/3//f/9//5//r//P/9//3//P/8//z//P/9//7//v/+//7///8BAAMABAAEAAQAAgAAAP////8AAAAA/////wAAAgAEAAUABQAFAAQAAwACAAIAAwADAAIAAgACAAEAAQAAAP///v///wAAAAABAAEAAAD//////////wAAAQADAAQABQAFAAQABAADAAMAAwAEAAQAAwADAAMABAAEAAUABgAHAAYABgAGAAYABgAGAAcACAAJAAkACAAHAAYABQAEAAQABAAEAAUABwAKAAsADQANAA4ADwAQAA8ADwAPAA4ADgANAA0ADAAMAAwADAANAA4ADgAOAA4ADgAOAA8AEAAPAA4ADQAMAAwACwAKAAoACQALAAsADAAMAAwACwALAAsACgAJAAgACAAJAAkACQALAAwADQAOAA4ADgANAA0ADQANAA0ADgAOAA8AEQASABIAEwATABIAEAAPAA4ADgANAAwACwAJAAkACQAJAAgACQAJAAkACgAJAAgABwAGAAUABQAFAAUABQAGAAYABgAGAAYABAADAAMAAwADAAMAAwAEAAQABAAEAAMABAAEAAQABAAEAAUABAAEAAQABAAEAAQABAADAAIAAgABAAAAAAD//////v/+////AAAAAP///v/9//7//v/+////AAABAAIAAgABAAAA///9//v/+//8//z//P/8//z//P/9//7////////////+//7//v/+//7//////////v/9//z//P/8//3//v/+//////8AAAAAAQABAAAA///9//v/+v/6//v/+//8//3//v/+//7//v/+//3//f/9//3//P/7//r/+v/5//r/+//8//3//v/+//7//v/+//z//P/7//r/+v/6//r/+v/6//r/+//8//v/+//7//z//P/8//z//P/7//r/+v/6//r/+//6//n/+P/4//f/+P/5//n/+v/6//v//P/8//z//P/7//v/+//7//v/+//7//r/+v/5//n/+P/4//n/+f/5//n/+f/6//v//P/8//z//P/8//z//P/7//v/+//8//z//P/8//3//f/9//z//P/8//z//P/8//z//f/8//z//P/8//z//f/9//z//P/8//z//P/7//v/+v/6//v//P/8//3//v8AAAAAAAABAAEAAAABAAEAAQABAAAAAAAAAAAAAAAAAAEAAQACAAIAAgACAAEAAAAAAAAAAAAAAAEAAgADAAQABAAEAAMAAwACAAEAAQACAAIAAwACAAIAAQACAAIAAwADAAIAAgACAAEAAAD+//3//f/+//7///8AAAAAAQACAAIAAwADAAMAAgABAAEAAAAAAAAAAQABAAEAAQABAAEAAQACAAIAAgACAAIAAgACAAIAAwADAAQABAAEAAMAAwADAAIAAgABAAEAAQABAAAAAAABAAEAAQABAAEAAAAAAAAAAAAAAAAAAQABAAAAAAD/////AAAAAAAAAQABAAIAAgACAAIAAQAAAAAA/////wAAAAAAAAAAAAAAAAAAAAD//////v/+//7//v/+//7//v///////////wAAAAA="
  },
  "cancel": {
    "source": "game/audio/effects/cancel.wav",
    "bytes": 3948,
    "sha256": "d59b933dbe794b9d36f962c8505513f3a85a30a6c2c3e2ed1d6895769d0a2616",
    "license": "CC0-1.0",
    "base64": "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"
  }
};
// END SHARED SIM ASSETS

/** Static axis legends share calibrated Mode 1–4 layout; never generate input. */
export function paintStickDirections(element, { horizontal, vertical, locale = 'en' }) {
  const key = `${horizontal}:${vertical}:${locale}`;
  if (element.dataset.stickLegend === key) return;
  element.dataset.stickLegend = key;
  element.classList.add('sim-labelled-stick');
  for (const old of element.querySelectorAll('.sim-stick-direction')) old.remove();
  const uk = locale === 'uk';
  const labels = {
    throttle: uk ? ['Тяга +', 'Тяга −'] : ['Thrust +', 'Thrust −'],
    pitch: uk ? ['Ніс униз', 'Ніс угору'] : ['Nose down', 'Nose up'],
    yaw: uk ? ['Поворот ←', '→ Поворот'] : ['Turn ←', '→ Turn'],
    roll: uk ? ['Крен ←', '→ Крен'] : ['Bank ←', '→ Bank'],
  };
  for (const [direction, text] of [
    ['up', `↑ ${labels[vertical][0]}`],
    ['down', `↓ ${labels[vertical][1]}`],
    ['left', labels[horizontal][0]],
    ['right', labels[horizontal][1]],
  ]) {
    const label = element.ownerDocument.createElement('b');
    label.className = `sim-stick-direction sim-stick-${direction}`;
    label.textContent = text;
    label.setAttribute('aria-hidden', 'true');
    element.append(label);
  }
}
