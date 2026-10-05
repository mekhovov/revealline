import {
  createSimAppearancePreferences,
  resolveSimAppearance,
  playableSimAppearance,
} from './world-themes.mjs';
import { setMenuIcon } from '../../game/ui/native-menu-icons.mjs';
import { sharedEnemyArtwork } from '../../game/hunt/preferences.mjs';
import { Q, attitude, atan2, cos, isqrt, rotate, roundDiv } from './math.mjs';
import { mountEnemyAppearanceControls } from '../../game/ui/enemy-appearance-controls.mjs';
import {
  resolvePresentation,
  applyResolvedPresentation,
  getInterfaceTheme,
  createThemePreferences,
  BUILTIN_THEME_FAMILIES,
  resolveThemeFamilySelection,
} from '../../game/presentation/theme-system.mjs';
import {
  loadAppearanceContext,
  saveAppearanceContext,
} from '../../game/presentation/theme-system.mjs';

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

/** Observer-only goal guidance. Gauge values use metres, seconds, degrees or percent.
 * A gauge describes correction; earned describes runtime credit. Neither awards progress.
 * Legacy facts must match this exact consumed tick; missing facts never imply success. */
export function flightGoalFeedback({
  course,
  mode = 'acro',
  state,
  legacyFacts = null,
  legacy = false,
  locale = 'en',
  freeFlight = false,
} = {}) {
  const t = (en, uk) => (locale === 'uk' ? uk : en);
  const axes = ['x', 'y', 'z'];
  const finite = Number.isFinite;
  const vector = (v) => v && axes.every((key) => Number.isSafeInteger(v[key]));
  const length = (v) => (vector(v) ? isqrt(axes.reduce((n, key) => n + v[key] ** 2, 0)) : null);
  const p = vector(state?.position) ? state.position : null;
  const q =
    state?.orientation?.length === 4 && state.orientation.every(Number.isSafeInteger)
      ? state.orientation
      : null;
  const angles = q ? attitude(q) : state?.attitude;
  const index = Number.isInteger(state?.step) ? state.step : 0;
  const steps = course?.steps?.[mode] ?? [];
  const target = state?.target ?? steps[index];
  const world = !legacy;
  const facts =
    legacyFacts?.index === index && legacyFacts.tick === state?.ticks ? legacyFacts : null;
  const result = {
    id: `${course?.id ?? 'flight'}:${mode}:${index}:${target?.type ?? 'none'}`,
    phase: 'waiting',
    action: t('Find the next target', 'Знайдіть наступну ціль'),
    label: '',
    gauge: {
      kind: 'height',
      value: null,
      min: 0,
      max: 1,
      valid: false,
      met: false,
      oneSided: null,
      detail: '',
    },
    checks: [],
    earned: { kind: 'hold', value: 0, total: 1, complete: false },
    detail: '',
    interaction: null,
    worldTargetId: null,
  };
  const check = (id, label, met, valid = true) => {
    const item = { id, label, met: Boolean(valid && met), valid: Boolean(valid) };
    result.checks.push(item);
    return item.met;
  };
  const gauge = (kind, value, min, max, label, oneSided = null, detail = '') => {
    const valid = finite(value) && finite(min) && finite(max);
    result.label = label;
    result.gauge = {
      kind,
      value: valid ? value : null,
      min,
      max,
      valid,
      met: valid && (oneSided === 'max' || value >= min) && (oneSided === 'min' || value <= max),
      oneSided,
      detail,
    };
  };
  const earned = (kind, value, total, complete = false) => {
    result.earned = {
      kind,
      value: finite(value) ? Math.max(0, value) : 0,
      total: finite(total) ? Math.max(0, total) : 0,
      complete: Boolean(complete),
    };
  };
  const relativeTilt = (normal = { x: 0, y: Q, z: 0 }) => {
    if (!q || !vector(normal)) return null;
    const up = rotate(q, { x: 0, y: Q, z: 0 });
    const dot = Math.max(
      -Q,
      Math.min(
        Q,
        roundDiv(
          axes.reduce((sum, axis) => sum + up[axis] * normal[axis], 0),
          Q,
        ),
      ),
    );
    return Math.abs(atan2(isqrt(Math.max(0, Q * Q - dot * dot)), dot));
  };
  const inBand = (value, min, max) => finite(value) && value >= min && value <= max;
  const zone = () => p && axes.every((axis) => inBand(p[axis], target.min[axis], target.max[axis]));
  const heightGauge = () =>
    gauge(
      'height',
      p ? p.y / 1000 : null,
      target.min.y / 1000,
      target.max.y / 1000,
      t('Height', 'Висота'),
    );
  const zoneAction = () =>
    !p
      ? t('Enter the marked zone', 'Увійдіть у позначену зону')
      : p.y < target.min.y
        ? t('Climb into the band', 'Підніміться в смугу')
        : p.y > target.max.y
          ? t('Descend into the band', 'Спустіться в смугу')
          : t('Move inside the marker', 'Увійдіть у межі позначки');
  if (freeFlight) {
    result.phase = 'free-flight';
    result.action = t('Explore freely', 'Досліджуйте вільно');
    gauge(
      'height',
      p ? p.y / 1000 : null,
      0,
      (course?.bounds?.max?.y ?? 100000) / 1000,
      t('Height', 'Висота'),
    );
    earned('none', 0, 0);
    return result;
  }
  if (!target) {
    const complete = state?.status === 'complete' || Boolean(steps.length && index >= steps.length);
    result.phase = complete ? 'complete' : 'waiting';
    result.action = complete
      ? t('Route complete', 'Маршрут виконано')
      : t('Waiting for the objective', 'Очікування цілі');
    earned(
      'steps',
      complete ? steps.length || state?.total || 1 : 0,
      steps.length || state?.total || 1,
      complete,
    );
    return result;
  }
  result.phase = 'correct';
  if (['hold', 'land'].includes(target.type)) {
    const speed = world ? length(state?.velocity) : facts?.speed;
    const tilt = world
      ? target.type === 'land' && state?.support
        ? relativeTilt(state.support.normal)
        : angles && finite(angles.roll) && finite(angles.pitch)
          ? Math.max(Math.abs(angles.roll), Math.abs(angles.pitch))
          : null
      : facts?.tilt;
    const command = state?.lastInput;
    const centred =
      world && command
        ? ['pitch', 'roll', 'yaw'].every(
            (key) => finite(command[key]) && Math.abs(command[key]) <= 50,
          )
        : facts?.conditions?.centred;
    const heading =
      world && finite(angles?.yaw) && finite(target.heading)
        ? Math.abs(((angles.yaw - target.heading + 54000) % 36000) - 18000)
        : facts?.headingError;
    const heightMet = check(
      'height',
      t('Height band', 'Смуга висоти'),
      p && inBand(p.y, target.min.y, target.max.y),
      Boolean(p),
    );
    const positionMet = check(
      'position',
      t('Inside marker', 'У межах позначки'),
      p && ['x', 'z'].every((axis) => inBand(p[axis], target.min[axis], target.max[axis])),
      Boolean(p),
    );
    const tiltMet = check(
      'tilt',
      t('Tilt band', 'Смуга нахилу'),
      inBand(tilt, target.minTilt, target.maxTilt),
      finite(tilt),
    );
    const centredMet =
      !target.centred ||
      check(
        'centred',
        t('Rotation sticks centred', 'Стіки обертання в центрі'),
        centred,
        world ? Boolean(command) : typeof facts?.conditions?.centred === 'boolean',
      );
    const speedMet = check(
      'speed',
      t('Slow enough', 'Достатньо повільно'),
      finite(speed) && speed <= target.maxSpeed,
      finite(speed),
    );
    const headingMet =
      !finite(target.heading) ||
      check(
        'heading',
        t('Correct heading', 'Правильний курс'),
        finite(heading) && heading <= 1500,
        finite(heading),
      );
    let touchdownMet = true,
      throttleMet = true;
    const throttle = world ? command?.throttle : facts?.throttle;
    if (target.type === 'land') {
      const supported = world
        ? state.grounded && (!target.surface || state.support?.id === target.surface)
        : facts?.grounded;
      const impactSpeed = world ? state?.landingSpeed : facts?.landingSpeed;
      const impactTilt = world ? state?.landingTilt : facts?.landingTilt;
      touchdownMet = check(
        'touchdown',
        t('Soft touchdown', 'М’яке торкання'),
        supported &&
          finite(impactSpeed) &&
          impactSpeed <= target.maxSpeed &&
          finite(impactTilt) &&
          impactTilt <= target.maxTilt,
        typeof supported === 'boolean' && finite(impactSpeed) && finite(impactTilt),
      );
      throttleMet = check(
        'throttle',
        t('Throttle down', 'Газ униз'),
        finite(throttle) && throttle <= 100,
        finite(throttle),
      );
    }
    heightGauge();
    result.action = t('Hold steady', 'Утримуйте стабільно');
    if (!heightMet) result.action = zoneAction();
    else if (!positionMet) {
      result.action = zoneAction();
      const axis = ['x', 'z'].find(
        (key) => !p || !inBand(p[key], target.min[key], target.max[key]),
      );
      gauge(
        'range',
        p ? p[axis] / 1000 : null,
        target.min[axis] / 1000,
        target.max[axis] / 1000,
        t('Inside marker', 'У межах позначки'),
      );
    } else if (!tiltMet || !centredMet || target.minTilt > 0) {
      gauge(
        'tilt',
        finite(tilt) ? tilt / 100 : null,
        target.minTilt / 100,
        target.maxTilt / 100,
        t('Tilt', 'Нахил'),
        target.minTilt ? null : 'max',
      );
      result.action = !tiltMet
        ? tilt < target.minTilt
          ? t('Tilt gently', 'Плавно нахиліть')
          : t('Reduce the tilt', 'Зменште нахил')
        : !centredMet
          ? t('Centre rotation sticks', 'Центруйте стіки обертання')
          : t('Keep the tilt; hold steady', 'Збережіть нахил; утримуйте');
    }
    // Once the entry pose is right, explain the next failing condition without replacing
    // the tilt band during the defining Acro tilt-and-centre exercise.
    if (heightMet && positionMet && tiltMet && centredMet) {
      if (!speedMet) {
        result.action = t('Brake the drift gently', 'Плавно загальмуйте дрейф');
        if (!target.minTilt)
          gauge(
            'speed',
            finite(speed) ? speed / 1000 : null,
            0,
            target.maxSpeed / 1000,
            t('Speed', 'Швидкість'),
            'max',
          );
      } else if (!headingMet) {
        result.action = t('Turn the nose to the marker', 'Поверніть ніс до позначки');
        gauge(
          'heading',
          finite(heading) ? heading / 100 : null,
          0,
          15,
          t('Heading error', 'Відхилення курсу'),
          'max',
        );
      } else if (!touchdownMet) {
        result.action =
          state?.grounded || facts?.grounded
            ? t('Lift slightly; land softly again', 'Трохи злетіть; сядьте м’якіше')
            : t('Touch down softly on the pad', 'М’яко торкніться майданчика');
      } else if (!throttleMet) {
        result.action = t('Lower throttle fully', 'Повністю опустіть газ');
        gauge(
          'throttle',
          finite(throttle) ? throttle / 10 : null,
          0,
          10,
          t('Throttle', 'Газ'),
          'max',
        );
      } else result.phase = 'hold';
    }
    const hold = world ? state?.hold : facts?.hold;
    earned('hold', finite(hold) ? hold / 50 : 0, target.ticks / 50, Boolean(facts?.accepted));
    result.detail =
      target.minTilt && target.centred && mode !== 'acro'
        ? t(
            'Self-level returns toward level when you release the sticks. The Acro example shows retained tilt.',
            'Самовирівнювання повертає до горизонту після відпускання стіків. Приклад Acro показує збереження нахилу.',
          )
        : t(
            'Keep every condition together; the hold restarts if one is lost.',
            'Утримуйте всі умови разом; втрата однієї скидає час утримання.',
          );
    return result;
  }
  if (target.type === 'gate' || target.type === 'crossing-v1') {
    const advanced = target.type === 'crossing-v1';
    const sides = advanced
      ? axes.filter((axis) => axis !== target.axis)
      : [target.axis === 'x' ? 'z' : 'x', 'y'];
    const bands = advanced
      ? [
          [target.minA, target.maxA],
          [target.minB, target.maxB],
        ]
      : [
          [target.minSide, target.maxSide],
          [target.minY, target.maxY],
        ];
    const aligned = sides.map((axis, i) =>
      check(
        axis === 'y' ? 'height' : `opening-${axis}`,
        axis === 'y'
          ? t('Opening height', 'Висота отвору')
          : t('Opening alignment', 'У створі отвору'),
        p && inBand(p[axis], ...bands[i]),
        Boolean(p),
      ),
    );
    const remaining = p ? (target.at - p[target.axis]) * target.direction : null;
    const approach = check(
      'approach',
      t('Approach side', 'Бік заходу'),
      remaining > 0,
      finite(remaining),
    );
    const side = Math.max(
      0,
      aligned.findIndex((value) => !value),
    );
    gauge(
      sides[side] === 'y' ? 'height' : 'alignment',
      p ? p[sides[side]] / 1000 : null,
      bands[side][0] / 1000,
      bands[side][1] / 1000,
      t('Opening', 'Отвір'),
    );
    result.action = !p
      ? t('Find the marked opening', 'Знайдіть позначений отвір')
      : !approach
        ? t('Return to the approach side', 'Поверніться на бік заходу')
        : !aligned.every(Boolean)
          ? t('Line up with the opening', 'Вирівняйтеся з отвором')
          : t('Fly through the arrow', 'Пролетіть за стрілкою');
    if (advanced) {
      const speed = vector(state?.velocity) ? state.velocity[target.axis] * target.direction : null;
      const forward = q ? rotate(q, { x: 0, y: 0, z: -Q })[target.axis] * target.direction : null;
      const speedMet = check(
        'speed',
        t('Crossing speed', 'Швидкість перетину'),
        speed >= target.minSpeed,
        finite(speed),
      );
      const noseMet = check(
        'heading',
        t('Nose follows travel', 'Ніс уздовж руху'),
        forward >= cos(target.forwardTolerance),
        finite(forward),
      );
      check(
        'airborne',
        t('Clear of ground', 'Над землею'),
        state?.grounded === false,
        typeof state?.grounded === 'boolean',
      );
      check('zone', t('Inside practice zone', 'У навчальній зоні'), zone(), Boolean(p));
      if (approach && aligned.every(Boolean) && !speedMet) {
        result.action = t('Build speed toward the opening', 'Наберіть швидкість до отвору');
        gauge(
          'speed',
          finite(speed) ? speed / 1000 : null,
          target.minSpeed / 1000,
          Math.max(target.minSpeed / 1000, 1),
          t('Crossing speed', 'Швидкість перетину'),
          'min',
        );
      } else if (approach && aligned.every(Boolean) && !noseMet)
        result.action = t('Point the nose along the arrow', 'Спрямуйте ніс за стрілкою');
    }
    result.phase = !approach ? 'approach' : 'cross';
    result.detail = t(
      'Cross from the indicated side. Distance and alignment are guidance, not crossing credit.',
      'Перетинайте з позначеного боку. Відстань і вирівнювання лише спрямовують, не зараховують перетин.',
    );
    earned('crossing', 0, 1);
    return result;
  }
  if (['hunt-contact-v1', 'eliminate'].includes(target.type)) {
    const contact = target.type === 'hunt-contact-v1';
    const available = contact ? Array.isArray(state?.hunt?.caught) : Array.isArray(state?.actors);
    const done = (id) =>
      contact
        ? state?.hunt?.caught?.includes(id)
        : state?.actors?.some((actor) => actor.id === id && actor.status === 'defeated');
    const caught = target.targets.filter(done).length;
    result.phase = contact ? 'catch' : 'combat';
    result.interaction = contact ? 'touch' : 'fire';
    result.worldTargetId = target.targets.find((id) => !done(id)) ?? null;
    result.action = contact
      ? target.ordered
        ? t('Touch the next marked target', 'Торкніться наступної цілі')
        : t('Touch a marked target', 'Торкніться позначеної цілі')
      : t('Fire at the marked target', 'Стріляйте в позначену ціль');
    gauge(
      'count',
      available ? caught : null,
      0,
      target.targets.length,
      contact ? t('Caught', 'Спіймано') : t('Defeated', 'Знешкоджено'),
    );
    result.gauge.met = available && caught === target.targets.length;
    earned(contact ? 'catches' : 'defeats', caught, target.targets.length);
    result.detail = contact
      ? t(
          'Contact catches count. Shooting does not complete this objective.',
          'Зараховуються перехвати торканням. Стрільба не виконує цю ціль.',
        )
      : t(
          'Use fire to defeat the targets. Touching them does not count.',
          'Знешкодьте цілі вогнем. Торкання не зараховуються.',
        );
    return result;
  }
  if (target.type === 'survive') {
    result.phase = 'survive';
    result.action = t('Stay safe until time is up', 'Збережіться до кінця відліку');
    gauge(
      'time',
      finite(state?.hold) ? state.hold / 50 : null,
      0,
      target.ticks / 50,
      t('Time survived', 'Час виживання'),
    );
    result.gauge.met = finite(state?.hold) && state.hold >= target.ticks;
    earned('time', (state?.hold ?? 0) / 50, target.ticks / 50);
    return result;
  }
  if (target.type === 'actor-track-v1') {
    const track = state?.actorTrack?.index === index ? state.actorTrack : null;
    const actor = state?.actors?.find((item) => item.id === target.actorId);
    const lift =
      actor && (['patrol', 'sentry'].includes(actor.type) ? actor.height / 2 : actor.radius);
    const distance =
      p && vector(actor?.position) && finite(lift)
        ? length({
            x: actor.position.x - p.x,
            y: actor.position.y + lift - p.y - (course?.rules?.droneRadius ?? 220),
            z: actor.position.z - p.z,
          })
        : null;
    const reasons = {
      'acquire-subject': t('Face the marked subject', 'Спрямуйте ніс на об’єкт'),
      'subject-unavailable': t('Subject unavailable; restart', 'Об’єкт недоступний; почніть знову'),
      'airborne-clearance': t('Lift off to follow', 'Злетіть для стеження'),
      'subject-range':
        distance < target.minDistance
          ? t('Back away a little', 'Трохи віддаліться')
          : t('Move closer to the subject', 'Наблизьтеся до об’єкта'),
      'relative-speed': t('Match the subject’s speed', 'Узгодьте швидкість з об’єктом'),
      'airframe-tilt': t('Reduce the tilt', 'Зменште нахил'),
      'nose-alignment': t('Point the nose at the subject', 'Спрямуйте ніс на об’єкт'),
      'subject-occluded': t('Find a clear sight line', 'Знайдіть пряму видимість'),
      'subject-travel': t('Keep following its movement', 'Продовжуйте стеження за рухом'),
    };
    result.phase = track?.status === 'tracking' ? 'track' : 'acquire';
    result.interaction = target.minTargetTravel ? 'follow' : 'observe';
    result.worldTargetId = target.actorId;
    result.action =
      reasons[track?.reason] ?? t('Keep the subject in view', 'Тримайте об’єкт у полі зору');
    gauge(
      'range',
      finite(distance) ? distance / 1000 : null,
      target.minDistance / 1000,
      target.maxDistance / 1000,
      t('Distance to subject', 'Відстань до об’єкта'),
    );
    // Runtime evaluates these in order and stops at the first failure. Later checks
    // are unknown, never inferred from pixels or absent measurements after reset.
    const order = [
      'subject-unavailable',
      'airborne-clearance',
      'subject-range',
      'relative-speed',
      'airframe-tilt',
      'nose-alignment',
      'subject-occluded',
    ];
    const labels = [
      t('Subject available', 'Об’єкт доступний'),
      t('Airborne', 'У повітрі'),
      t('Distance band', 'Смуга відстані'),
      t('Matched speed', 'Узгоджена швидкість'),
      t('Steady tilt', 'Стабільний нахил'),
      t('Nose on subject', 'Ніс на об’єкт'),
      t('Clear sight line', 'Пряма видимість'),
    ];
    const all = track && ['tracking', 'complete'].includes(track.status);
    const failed = order.indexOf(track?.reason);
    order.forEach((reason, i) =>
      check(reason, labels[i], all || failed > i, Boolean(all || failed >= i)),
    );
    if (track?.reason === 'airframe-tilt') {
      const tilt = relativeTilt();
      gauge(
        'tilt',
        finite(tilt) ? tilt / 100 : null,
        0,
        target.maxTilt / 100,
        t('Tilt', 'Нахил'),
        'max',
      );
    }
    const hold = track ? (state?.hold ?? 0) : 0;
    if (target.minTargetTravel && hold >= target.ticks) {
      earned(
        'travel',
        (track?.travel ?? 0) / 1000,
        target.minTargetTravel / 1000,
        track?.status === 'complete',
      );
      result.detail = t(
        'Time held; keep following until the subject finishes the distance.',
        'Час утримано; стежте, доки об’єкт не пройде потрібну відстань.',
      );
    } else earned('hold', hold / 50, target.ticks / 50, track?.status === 'complete');
    return result;
  }
  const skillInfo = practiceSkillFeedback(target, state, locale);
  if (skillInfo) {
    const skill = state?.skill?.index === index ? state.skill : null;
    const active = skill && ['active', 'complete'].includes(skill.status);
    const complete = skill?.status === 'complete';
    const angular = state?.angular;
    const rotationLow = ['pitch', 'roll', 'yaw'].every(
      (axis) => finite(angular?.[axis]) && Math.abs(angular[axis]) <= target.maxAngular,
    );
    const inZone = check('zone', t('Practice zone', 'Навчальна зона'), zone(), Boolean(p));
    check(
      'airborne',
      t('Clear of ground', 'Над землею'),
      state?.grounded === false,
      typeof state?.grounded === 'boolean',
    );
    heightGauge();
    result.phase = active ? 'manoeuvre' : 'entry';
    result.action = !inZone
      ? zoneAction()
      : t('Follow the marked manoeuvre', 'Виконайте позначений маневр');
    result.detail = skillInfo.hint;
    const entryActions = {
      'airborne-clearance': t('Recover into clear air', 'Поверніться у вільне повітря'),
      'entry-attitude': t('Settle at the entry attitude', 'Стабілізуйте положення входу'),
      'entry-bearing': t('Return to the marked entry', 'Поверніться до позначеного входу'),
      'time-window': t('Return to entry; try again', 'Поверніться до входу; повторіть'),
      'rotation-purity': t(
        'Settle; use only the shown axis',
        'Стабілізуйтеся; рухайте показану вісь',
      ),
      'missed-attitude': t('Retry the whole rotation', 'Повторіть повний оберт'),
      'path-envelope': t('Return to the marked path band', 'Поверніться в смугу траєкторії'),
      'path-direction': t('Return; follow the path arrow', 'Поверніться; летіть за стрілкою'),
      'path-axial-progress': t('Combine travel with the turn', 'Поєднайте рух із поворотом'),
      'rotation-path-phase': t('Match rotation to the path', 'Узгодьте оберт із траєкторією'),
      'ambiguous-path': t('Return to entry; try again', 'Поверніться до входу; повторіть'),
    };
    if (target.type === 'rotation-v1') {
      const checkpoint = active ? (skill.rotation?.checkpoint ?? 0) : 0;
      const amount = active ? skill.rotation?.angle : null;
      gauge(
        'rotation',
        finite(amount) ? amount / 100 : null,
        (target.angle - target.tolerance) / 100,
        (target.angle + target.tolerance) / 100,
        t('Rotation traced', 'Пройдений оберт'),
      );
      result.action =
        checkpoint >= target.angle / 9000
          ? t('Settle at the exit attitude', 'Стабілізуйте положення виходу')
          : skillInfo.label;
      if (checkpoint >= target.angle / 9000)
        earned('hold', (skill?.dwell ?? 0) / 50, target.settleTicks / 50, complete);
      else earned('checkpoints', checkpoint, target.angle / 9000, complete);
      check(
        'settled',
        t('Rotation settled', 'Обертання зупинено'),
        rotationLow,
        Boolean(angular && finite(target.maxAngular)),
      );
    } else if (target.type === 'attitude-v1') {
      const angle = relativeTilt();
      const expected = target.up === 'inverted' ? 180 : 0;
      gauge(
        'tilt',
        finite(angle) ? angle / 100 : null,
        Math.max(0, expected - target.tolerance / 100),
        Math.min(180, expected + target.tolerance / 100),
        t('Attitude', 'Положення'),
      );
      if (q)
        result.gauge.met =
          rotate(q, { x: 0, y: Q, z: 0 }).y * (target.up === 'upright' ? 1 : -1) >=
          cos(target.tolerance);
      result.action =
        target.up === 'inverted'
          ? t('Hold briefly inverted', 'Коротко утримайте перевернутим')
          : t('Recover upright and settle', 'Вирівняйтеся й стабілізуйтеся');
      const speed = length(state?.velocity);
      check(
        'speed',
        t('Slow enough', 'Достатньо повільно'),
        speed <= target.maxSpeed,
        finite(speed),
      );
      check('settled', t('Rotation settled', 'Обертання зупинено'), rotationLow, Boolean(angular));
      earned('hold', active ? (skill.dwell ?? 0) / 50 : 0, target.ticks / 50, complete);
    } else if (target.type === 'path-v1') {
      const radius = p
        ? isqrt(
            [...target.plane].reduce((sum, axis) => sum + (p[axis] - target.center[axis]) ** 2, 0),
          )
        : null;
      gauge(
        'range',
        finite(radius) ? radius / 1000 : null,
        target.radiusMin / 1000,
        target.radiusMax / 1000,
        t('Distance from landmark', 'Відстань до орієнтира'),
      );
      result.action =
        radius < target.radiusMin
          ? t('Move out into the path band', 'Віддаліться в смугу траєкторії')
          : radius > target.radiusMax
            ? t('Move in toward the path band', 'Наблизьтеся до смуги траєкторії')
            : t('Follow the path arrow', 'Летіть за стрілкою траєкторії');
      earned(
        'checkpoints',
        active ? (skill.path?.checkpoint ?? 0) : 0,
        target.sweep / 9000,
        complete,
      );
      if (target.coupled)
        check(
          'coupled',
          t('Body follows the path', 'Корпус узгоджено з траєкторією'),
          active &&
            Math.abs(
              (skill.rotation?.angle ?? 0) * target.sweep -
                (skill.path?.winding ?? 0) * target.coupled.angle,
            ) <=
              target.coupled.phaseTolerance * target.sweep,
          Boolean(active && skill.rotation && skill.path),
        );
      if (target.axialMin || target.axialMax) {
        const axis = axes.find((key) => !target.plane.includes(key));
        const travel = active && p && finite(skill.startAxis) ? p[axis] - skill.startAxis : null;
        check(
          'travel',
          t('Required travel', 'Потрібне переміщення'),
          inBand(travel, target.axialMin, target.axialMax),
          finite(travel),
        );
      }
    }
    if (!active)
      result.action =
        entryActions[skill?.reason] ??
        (!inZone
          ? zoneAction()
          : t('Settle at the marked entry', 'Стабілізуйтеся в позначеному вході'));
    if (complete) result.phase = 'complete';
    return result;
  }
  result.action = t('Follow the current objective', 'Виконайте поточну ціль');
  return result;
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
      ['mono', 'Field Kit Mono', '500'],
      ['display', 'Field Kit Display', '600'],
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

/** Only a cosmetic family pin crosses the admitted optional launcher boundary. */
export function simAppearanceDefaultFromURL(location) {
  try {
    const href = typeof location === 'string' ? location : location?.href;
    if (typeof href !== 'string' || href.length > 4096) return null;
    const params = new URL(href).searchParams;
    if (
      params.getAll('appearanceFamily').length !== 1 ||
      params.getAll('appearanceRevision').length !== 1
    )
      return null;
    const familyId = params.get('appearanceFamily'),
      revision = params.get('appearanceRevision');
    return /^[a-z][a-z0-9-]{0,63}$/.test(familyId ?? '') &&
      /^r[1-9][0-9]{0,8}$/.test(revision ?? '')
      ? Object.freeze({ familyId, revision })
      : null;
  } catch {
    return null;
  }
}

/** The optional package embeds the exact shared sheet/fonts to retain its
 * existing file-count budget. Tokens, validation and DOM application are shared
 * with the full game; this host only bridges standalone storage and lifecycle. */
export function installSimThemeHost({
  document: doc = globalThis.document,
  window: win = doc?.defaultView ?? globalThis.window,
  getStorage = () => win?.localStorage,
  getAppearanceDefault = () => simAppearanceDefaultFromURL(win?.location),
} = {}) {
  const preferences = createThemePreferences({ window: win, getStorage });
  const listeners = new Set();
  let disposed = false,
    override = null,
    snapshot = null,
    cleanup = null;
  const admitted = new Map();
  const contextCandidate = (ref) => {
    if (!ref) return null;
    const key = `${ref.familyId}@${ref.revision}`;
    if (admitted.has(key)) return admitted.get(key);
    let candidate = null;
    try {
      candidate = loadAppearanceContext(win.sessionStorage, ref);
    } catch {
      /* Blocked storage follows normal fallback. */
    }
    if (!candidate) {
      try {
        candidate = loadAppearanceContext(getStorage(), ref, { consume: true });
        if (candidate) saveAppearanceContext(win.sessionStorage, candidate);
      } catch {
        /* A consumed context remains usable for this host if tab storage is denied. */
      }
    }
    if (candidate) admitted.set(key, candidate);
    return candidate;
  };
  const sheet = doc.createElement('style');
  sheet.setAttribute('data-industrial-workshop', '');
  sheet.textContent = SHARED_THEME_CSS;
  (doc.head ?? doc.body)?.append(sheet);
  const releaseFonts = acquireFonts(doc, win);
  let motion, coarse, observer;
  try {
    motion = win?.matchMedia?.('(prefers-reduced-motion: reduce)');
    coarse = win?.matchMedia?.('(pointer: coarse)');
  } catch {
    /* Optional browser media queries. */
  }
  const read = (key) => {
    try {
      const raw = getStorage()?.getItem(key);
      return typeof raw === 'string' && raw.length < 512 ? (JSON.parse(raw) ?? {}) : {};
    } catch {
      return {};
    }
  };
  const refresh = () => {
    if (disposed) return snapshot;
    const values = preferences.snapshot(),
      display = read('revealline.display.v1');
    const ornaments = values.ornaments === 'theme' ? 'subtle' : values.ornaments;
    const body = doc.body?.dataset ?? {};
    const appearanceDefault = getAppearanceDefault();
    const candidate = contextCandidate(
      values.familyId === 'follow-game'
        ? appearanceDefault
        : { familyId: values.familyId, revision: 'r1' },
    );
    const familySelection = candidate
      ? {
          family: candidate.family,
          interfaceTheme: candidate.interfaceTheme,
          fallbackReason: null,
          requested: { familyId: candidate.family.id, revision: candidate.family.revision },
        }
      : resolveThemeFamilySelection({
          familyId: values.familyId,
          appearanceDefault,
        });
    const next = resolvePresentation({
      themeFamily: familySelection.family,
      ...(override || candidate
        ? {
            interfaceTheme: override ?? candidate.interfaceTheme,
            ...(!override && candidate ? { interfaceBasis: candidate.basis } : {}),
          }
        : {}),
      ornaments: ['off', 'subtle', 'rich'].includes(ornaments) ? ornaments : 'subtle',
      accessibility: {
        ...values,
        textFace: body.textFace ?? display.textFace,
        textSize: body.textSize ?? display.textSize,
        reducedEffects:
          display.reducedEffects === true || motion?.matches === true || body.effects === 'reduced',
        coarsePointer: coarse?.matches === true,
      },
    });
    const samePresentation = next.identity === snapshot?.identity;
    if (
      samePresentation &&
      JSON.stringify(familySelection) === JSON.stringify(snapshot?.familySelection)
    )
      return snapshot;
    if (!samePresentation) {
      cleanup?.();
      cleanup = applyResolvedPresentation(doc.documentElement, next);
    }
    snapshot = Object.freeze({ ...next, familySelection });
    for (const listener of [...listeners]) listener(snapshot);
    return snapshot;
  };
  const stop = preferences.subscribe(refresh);
  const storageChanged = (event) => {
    if (['revealline.display.v1', 'revealline.menu-style.v1'].includes(event.key)) refresh();
  };
  if (win?.MutationObserver && doc.body) {
    observer = new win.MutationObserver(refresh);
    observer.observe(doc.body, {
      attributes: true,
      attributeFilter: ['data-text-face', 'data-text-size', 'data-effects'],
    });
  }
  motion?.addEventListener?.('change', refresh);
  coarse?.addEventListener?.('change', refresh);
  win?.addEventListener?.('storage', storageChanged);
  return Object.freeze({
    preferences,
    snapshot: () => snapshot,
    ready: Promise.resolve(snapshot),
    refresh,
    set: (patch) => preferences.set(patch),
    getWarning: () => preferences.getWarning(),
    setInterface(id, revision) {
      const source = id === null ? null : getInterfaceTheme(id, revision);
      if (id !== null && !source) throw new TypeError('Unknown interface theme.');
      override = source;
      return refresh();
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
      preferences.dispose();
      observer?.disconnect();
      cleanup?.();
      releaseFonts();
      sheet.remove();
      listeners.clear();
      motion?.removeEventListener?.('change', refresh);
      coarse?.removeEventListener?.('change', refresh);
      win?.removeEventListener?.('storage', storageChanged);
    },
  });
}

/** Shared SIM appearance controls. Interface changes are immediate; the host
 * decides when a prepared world selection may replace an attempt's appearance. */
export function mountSimAppearanceControls({
  document: doc,
  window: win,
  container,
  locale = () => 'en',
  drone = () => undefined,
  pending = () => false,
  accepted = () => null,
  onChange = () => {},
  getAppearanceDefault = () => simAppearanceDefaultFromURL(win?.location),
} = {}) {
  let storage;
  try {
    storage = win.localStorage;
  } catch {
    /* Session-only preferences. */
  }
  const preferences = createSimAppearancePreferences({ storage, window: win });
  const host = installSimThemeHost({
    document: doc,
    window: win,
    getStorage: () => storage,
    getAppearanceDefault,
  });
  const fieldset = doc.createElement('fieldset');
  fieldset.className = 'sim-appearance-controls';
  const legend = doc.createElement('legend');
  const status = doc.createElement('p');
  status.setAttribute('role', 'status');
  const rows = {};
  fieldset.append(legend);
  for (const name of ['interface', 'world']) {
    const label = doc.createElement('label');
    const text = doc.createElement('span');
    const select = doc.createElement('select');
    select.setAttribute('id', `sim-appearance-${name}`);
    label.append(text, select);
    fieldset.append(label);
    rows[name] = { text, select };
    select.addEventListener('change', () => preferences.set({ [name]: select.value }));
  }
  fieldset.append(status);
  container?.append(fieldset);
  const enemyAppearance = mountEnemyAppearanceControls({
    document: doc,
    container: fieldset,
    locale,
    includeUniform: true,
    applyMilitary: () => {
      host.preferences.applyComplete('military-field');
      preferences.set({ interface: 'follow-game', world: 'follow-game' });
    },
    applyAuthored: () => {
      host.set({ arcadeArt: 'authored' });
      preferences.set({ world: 'authored' });
    },
  });
  const resolve = () => {
    const selection = host.snapshot().familySelection;
    const family = selection.family;
    const choice = preferences.snapshot().world;
    if (choice === 'follow-game' && selection.fallbackReason) {
      const authored = resolveSimAppearance({ choice: 'authored', drone: drone() });
      return Object.freeze({
        ...authored,
        requested: selection.requested?.familyId ?? family.id,
        fallbackReason: selection.fallbackReason,
      });
    }
    return resolveSimAppearance({
      choice,
      familyId: family.id,
      familyRevision: family.revision,
      simCollection: family.sim,
      drone: drone(),
    });
  };
  function refresh() {
    const uk = locale() === 'uk';
    enemyAppearance.refresh();
    legend.textContent = uk ? 'Оформлення' : 'Appearance';
    const value = preferences.snapshot();
    for (const name of ['interface', 'world']) {
      const { text, select } = rows[name];
      text.textContent =
        name === 'interface'
          ? uk
            ? 'Інтерфейс SIM'
            : 'SIM interface'
          : uk
            ? 'Оформлення світу'
            : 'World appearance';
      select.replaceChildren();
      const labels = [
        [
          'follow-game',
          `${uk ? 'Як у грі' : 'Follow game'}${host.snapshot().familyId.startsWith('candidate-') ? ` · ${host.snapshot().familySelection.family.name} · ${host.snapshot().familyRevision}` : ''}`,
        ],
        ['authored', uk ? 'Авторське оформлення' : 'Authored appearance'],
        ...BUILTIN_THEME_FAMILIES.filter((family) => name === 'interface' || family.sim).map(
          (family) => [family.id, family.name],
        ),
      ];
      if (!labels.some(([id]) => id === value[name])) labels.push([value[name], value[name]]);
      for (const [id, title] of labels) {
        const option = doc.createElement('option');
        option.value = id;
        option.textContent = title;
        select.append(option);
      }
      select.value = value[name];
    }
    const saved = accepted();
    const recordedFallback = saved && playableSimAppearance(saved).fallbackReason;
    const contextFallback = host.snapshot()?.familySelection?.fallbackReason;
    const fallback = recordedFallback || resolve().fallbackReason || contextFallback;
    const fallbackText = contextFallback
      ? contextFallback
      : recordedFallback
        ? uk
          ? 'Оформлення запису недоступне. Використано авторське оформлення без зміни запису польоту.'
          : 'Recorded appearance unavailable. Using authored appearance without changing the flight proof.'
        : uk
          ? 'Колекція недоступна. Використано авторське оформлення.'
          : 'Collection unavailable. Using the authored appearance.';
    status.textContent = pending()
      ? uk
        ? 'Нове оформлення застосуємо після повтору або нового польоту.'
        : 'Your new appearance applies on Retry, Reset, or the next flight.'
      : fallback
        ? fallbackText
        : uk
          ? 'Зміна інтерфейсу не змінює керування польотом.'
          : 'Interface changes preserve your flight controls.';
    if (pending() && fallback) status.textContent += ` ${fallbackText}`;
  }
  let lastSelection = '';
  function notify() {
    const next = resolve();
    const signature = JSON.stringify([
      preferences.snapshot().world,
      next,
      sharedEnemyArtwork().snapshot().style,
    ]);
    if (signature !== lastSelection) {
      lastSelection = signature;
      onChange(next.appearance);
    }
    refresh();
  }
  function applyInterface() {
    const id = preferences.snapshot().interface;
    if (id === 'follow-game') host.setInterface(null);
    else if (getInterfaceTheme(id)) host.setInterface(id);
    else host.setInterface('legacy', 'r1'); // Authored and unavailable choices retain the old adapter.
  }
  applyInterface();
  lastSelection = JSON.stringify([
    preferences.snapshot().world,
    resolve(),
    sharedEnemyArtwork().snapshot().style,
  ]);
  const unsubscribeArtwork = sharedEnemyArtwork().subscribe(notify);
  const unsubscribeHost = host.subscribe(notify);
  const unsubscribePreferences = preferences.subscribe(() => {
    applyInterface();
    notify();
  });
  const completeTheme = (event) => {
    const id = event.detail?.familyId;
    if (
      typeof id === 'string' &&
      getInterfaceTheme(id) &&
      host.preferences.snapshot().familyId !== id
    )
      host.set({ familyId: id, arcadeArt: 'follow-game' });
    preferences.set({ interface: 'follow-game', world: 'follow-game' });
  };
  win?.addEventListener?.('revealline:complete-theme', completeTheme);
  refresh();
  return Object.freeze({
    resolve,
    preferences,
    refresh,
    changed: notify,
    dispose() {
      win?.removeEventListener?.('revealline:complete-theme', completeTheme);
      enemyAppearance.dispose();
      unsubscribeHost();
      unsubscribeArtwork();
      unsubscribePreferences();
      preferences.dispose();
      fieldset.remove();
      host.dispose();
    },
  });
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
  audioHost = null,
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
    if (audioHost) {
      if (!active()) stopVoices();
      return; // Flight owns the shared context transport.
    }
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
    if (!AudioContext && !audioHost) return false;
    let candidate;
    try {
      if (audioHost) {
        void audioHost.resume();
        candidate = audioHost.context;
        if (!candidate || !audioHost.menuBus) return false;
      } else candidate = new AudioContext({ latencyHint: 'interactive' });
      master = candidate.createGain();
      master.gain.value = 0.3 * level;
      master.connect(audioHost ? audioHost.menuBus : candidate.destination);
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
      if (!audioHost) candidate?.close().catch(() => {});
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
    if (!active()) return;
    if (context && audioHost && context.state !== 'running') void audioHost.resume();
    if (!context && initialize(true)) synchronize();
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
    setSoundPreference(value) {
      if (disposed) return;
      selected = Boolean(value);
      onSoundChange(selected);
      if (!selected) stopVoices();
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
      if (!audioHost) context?.close().catch(() => {});
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
    "base64": "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"
  },
  "pixel": {
    "source": "game/ui/fonts/departure-mono/DepartureMono-Regular.woff2",
    "bytes": 22496,
    "sha256": "5b4fed1daa90708aa9c6ee1190abca9dc22164a1c1def0020386e46b61038cfb",
    "license": "OFL-1.1",
    "base64": "d09GMk9UVE8AAFfgAAwAAAABSgAAAFeQAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAADYPaEBqFYhuUbhyWFAZgAOpuATYCJAOSSAQGBYgeByBbJ0mRC/1P7u5tS4r6RRqA3GIAlX/Olb1lcIFt04l41nlDup6FdNjsYAwbJ4Dh+a2z/////////5XLl8fmkrT15fwtLcgQZODm2O0OLwIBpKaCgyKrtRHTlKsxpmxVWWhFEXOQU1M38lQa2QK2FB8hFIHa2mfME83kZAWum69SqZQ6C1tSu5J0tybnq2+23W3YPoLcD8y/S0dVcipmxpXSGEZ2zZOt2Ek8Y6lgLSIiuDuZoOrmW6cAuaBK2pOv02xhP4Y7ZmZukm6Ge/uzqvh5uFNEULA7dydnfhEBERCB3vI+M08sIiKCPTyKgAiIQG+HXRUlc3enJ3bzLAIiICY6Q5yxr5q5u7sHiysREAERx94NmSnY8F7EbJlJB5bDexWrqkqIodz+skxKAimUK1M1esugiLDjo1JECGYmqaq0f/5iZQcMz99FQEhSrQ/m5O6Sqhjob+5pm2EpoudP+Q4iIAIiwMF+C+j0dH6QGlst7K2DD+qav67XtAOYdX+RP/pTPrL3S1s299w7F3r/nMTCiU/U3mxaaE1FfyQQJBAkpHZeiY5GI6iRDS5ZCUaBZtyHu7S/8a/Y/8FdRnGCuEHnpQN6OwPcMe2R4w4J7x/UJC9/QR9AVaCqK5cGPE+wtt6fWRGJMgpxjUZExMJCREQl2yDbLkzMswsz+soMepCx13slVVc9lFNAkhSCpngCR2qZXOaIOH5KkewvAIH51y0/gQQ5NZm79XVYhk7nglvEgBDEEkQJoFPvd9KNpVgpJB0baBMWlMv/0y/73zq7b88fileelI1BZaOykmAxEi0wBlQccjOrm9jUce06fyXqaJQDInYKH2KvIljo1ssLJUdQk0gBxP/vx5qLJ82cgSxe8UymiXc6jSYJIt2TeCRTzd5HPOtuABxTzXFzEapj/0/i1jcMZ3E2AkUcbsPr1vvNyyXAHQ9LQhSNCaLB/IuZT5Vh7dwO2Fm9Kze1uYE4dDJSoN27HMXqi+YjATXoUnNezBqrlD2htkIdkMlAnXHw4Ijpwd+1X3nbNSTTbIJkkwiGEhiA//8pU94lXODrSaupw5x1bPoHAmj7yWsC9YOeUIODOjU1CFTqSjGIdB8OavJGHqhuSkJHujuEMhABYNhkmuzafgZIhAMNSLWccbfJ01odj8I4hIQCt73hCGwyCTRnq4ZBICREQgQU0K7weG95Is9IBYaJqEAcnNjsdsuyrFgICwqGY8qf4OCiuEyCggRB1DIurRUXIRET8P2YrIS2MPqWNg2Wd/+u6CFmQcGSpMLOT25Jp28F1Qp0yg6bFHV3ULxQoHMyq1D49ifG5QPyoBjXVvJuSeigD4KXuqd/krt9bayfLgYW6SB/5CAHM1WZhcTu+UyWxuhoaRCWivCSS4rwqeUBMuzUApDEIk0klX92z9Q50EeIvnUxJuCAq4VXAQJ+tbd2R0j9iH9I2ZnZVQsKJ39N94ba6Y3TxPl3WRGize7fKWrVFg53OCynCBYrMErD8/InL2f3lBocGP01lmedTWT+p2rZEkveORWN3XWpbZb4D3grEaQ2kBdCrtx5Bh/QjiHRgY6h9Lhy1Zgg3VAjiEfiHNb2/hGk/XYZbnL+/6tatsCQmwKdam/n1BSc4JhO76YT/n/gHZIAaYmkdCyOtCEmPDz890FIoiSORpPkEEObclFu66Zx5XVRuis1jqGvXZT2/3+/b/Xtv8fsjCiuoY1nxBslXhl5iGgyaSN2GcQ0iWYxSzRCYxKLSIjeLRJKohGJLELqENiOd480ganvbkaBpQWWcfzza49p58JbEdgauWLgyHqT/lYkTMSHUji2fLBvbSE0k+CiRJPTzvwBoPlLy1bv/NnrEoFQd5I+/XQbZKr1JLi9d9bd/XdlGizBNmNJQgJNhJzWPtneZpNTTYWfKSFiPERPFCrut2G9eVq0115fbFgkBCuDDDKEIUgIn/Q+fiwMChGpcMsL7xTmJfpmZ2U3vu6iEPi+x3u/DP9lSlHR0UsWpe1vL+lEl/1P3Luvb2Tii3R+0WteDEV/+7el84+w/UevTfafuW2/qgZrar2OBITSWFGevVoac9WGh3Nd7Dp3uM+jnvaSNxUpNsdCq5XYYb9jzrritkde+tcHpH53i7VUyB0aXSS9VJnaTWh6C1vR+ra1t4nNbmErWt+WdnWwo53pcrd60LP+7r00KATQWflJb/AEwkdLNqkUUks3WJj042YSZwKJR0g6WiohsaKOMY74QyYWISVAE15cOEEJImFgkqFEEwgSHh2PKU4CxJFRqECwUGPEDg5HHJFSh8IZyhhsTsVT7dQ6jY/raXM8TtcTcMJP3Ek8GSfv9Dsjz4Qz48w7S8+as+FsO3vPiWM89uM71OFO4mTPz/N7MBodZS1DWxcxGWV1ABxHZvL94xbCEWXoqixqJk6kkJiMohiiQBqRTpSOyEYily41IZJX7IE7xMm5Qp31mZ1kKCZ0QUnI6VuHiLi0QVlFVaMmDRs3bd6ydduCopKyisrq2vr2+F+PYXnTalYkWqo16RSVkTdl3trCzde8nBjDKvFcutSESEF1xg5/TMoV6kZbZ/UQwZgQSajiUo276yeeq3ZQpmf4/9whLqWWcaPP6PDT4WSuKgfez/0RyLQWRw9/KUUNIAJPYRux84kSZeXVMC2DJsxbs+vEtaKkatZZ30q1prauPpattBFa0r2pK5hIghLq7RrsPopLZPdILrt2z5XX2nCL7XdLFuoAzsnW0OaNCBm9SpsD43OrO8dX2wE2isgbFz78cKgkMMlQpgUMhYiGywQnPkLEkVHQKVIDY9LmBzVaLNhw4gODJQRPDIGqKm+dUgrGLFq3IyQuY09VQ9eh/3QZNGxUUdm0miWrUk0tv9RoFTNuMWWfmIRiFStUDwiLqZ/ZoH95iiSULV8ts27GHGEFiydWOs3ysBxLr8VtISwhi2iJWXIyakAUiWXCLUKUU0a16TkROHKpuZCk6mrr6OrpK1G+Wt2w2PqZDfqfp3B86bQqkazUmXKGxsSXKp9YjRfkhDCIgVhIgeJQudgACV6xR3ZfNFXGjT6jzeWnw8lsWUK6JwxgFI7AMqzDCdjMlFswJWruxBVL5utmR2/z0zGhtFMgTx+r3en2+iUV1AE4MsuQjVeEIEVVhjX0MXLwo4Ul5VRXDlZagTK1WnTUQ99EvgYSvGKP7L6omM3XWGtwYn5t9+S6KCnT6StqrPOxbKWN0JLuTV3BRBKUUG/XYPdRXCK7R0xccYdRjlYMYxH7uCULdQDnZGto80aEjF6lzYHxudWd46tRuABAFoc8NbpMWHPiSYYyLWAoRDRcJjgJEEdGoQjEpIMeG15IQsQRKSt1usWSTQeufJqyIiylqOFQm0ETJgWWJFqqteszbNKc1bIEKmAHOOBBHJRAFcCABzaYAw8IAw4kgQIKoAYosMAvMAAb8IKCsyk1s4epmMJT332fySo89X0k9V1gCYT0BD4gMHpTJsBilWtPFBkLRARbJPYH+56a89mHIQQKbw3dgVDngRqvhlBBLgObGMPljDH33VJJg2RvDQgNBdEUkparTYw4DCMB5F2V/i1CChGGaay6HQI5NXOJlDUuH5BitVgNWbPC8/kUYhoFx1X+u8JMk1OuWe+Hqlbwk9KNn4qlROP/FUh+wy5D2Gw6nOjNGWaC/KVMINGQ2JVSXE2xKJasVbJhFr93LEjpLEmcQSo3i5m0QTt2sRY5nCzgLSyMlDGUrEnj7ahq0y6pWjUl+Ldyqbxp+eA7zT0t37N2UA/R9+Kl09ypuZCjeHNQ26Qr10VZ5NvdbAVI1Jpvm3gxmKYWTwQFq1m9u1ptFygEBUDkyGP5bj4M9/SJ9Wr9RtnB7BuBve77vb8f0nH/RjpCukWL5Dkpj4RrR6JfHyXCg1fYerwfM7PgPA9yWp9VEiEyUsoCXWzSyzaXmdDPzuzMk7Tg00XrBeimHPw4b+UgGXLEBEh44rjwZetUotAqiCYixcAImoHLACDWWoCqQRVJMxxpbgYxa6lt2pYHuhDTOBGWhWvs/lStQxS3bdTnEc4AmlRlgTX1MccpjniFd1y2x+4yXjOT+yJEktjjz6r2o8ZUwVKm3et6QZ4tNSWWFRI1OZwa87pZl4gRHcmuBUkAvkVwS2UbrPTKF6PQokgGf0AiPCelqxy45dnUIcO0z1aPE0eZT2AoUFB1Z5p5hKci3+Dh4Y948hJBi1VZVC/vdexFr6af1uaDEKzIvs2+3gP7V/KRE9dBiZIFdau2VGHd61G6ujJlq6//NZQrKl/PetW7PvV91v36VBEIf+m3MWESRVvV93V1lx1G0EQTiG9AbvHszn5w02oey3ZyWwiTIbyHMeAbTA6NiWeZqc9UjwQTNhshdChCTsuNrIsNnOpSuc1yuomwH/xCpE2mrZweIoxvRxj2+Jhan1tMQSiT3ZsI41ZOHyKMS209qPvxCJM/Vn9gAnlcTyKnlTCJHsx3LGhAKQCllF7IUKCUUsoYY8AYY4wBYwwAgAEAMHaBglDGxRQEKGO7mIIwwnYHhHGprT3AFITtYgpCGdvFFJSNqT1gHO8VVcMG3Mc/vOu49ystO5TsHWprLtt6dTnZqcn4j5Xav0dw3ZtF/nCVfO4X/oTLDYCfmBVulN1i25UV93u/l1cKS4WrBYdLeZajRxZ0si4wikBnbcryzkWTwkVxqgW0Zu6nrtf6Q/WQ+E95Ww3ZDgnAVt+qggMyePCotVB7UpTGv7ci8fMeB2XfXCsDV6GKGl/1laj6tS3LgIQLpKMLqXBuijkd3ytTVwMUbLEOi3fdFXaImn6T/JOIPvpGiwfiQS8bb+037w1/PPAJP4fv5D36ZuIfijZ6DdaKM3itk/aKAeOMMmCU8TBgNKxT6sQiDuIgdmIRiziIRbwvU5EskkkySYpkkSySSTJJ/tLYLjfhkM55KgdO03k68NDw0/huCAVIcEgFAJrgCQDqBckE33C3As6qHBQGwBFIFBp0hC9REhgChQFwBJIqxkNQRVOAyBkgEAgEQqNYPrFpVHGSS1j+2RMUqetvPwmuzrX58+dEbI9sOxzHGEICaMD8SGC9wGLXJffa9wsSsI9Ps7xqHVvenBy9RhCv+c9vXIIMjTfo2puwHNPEMYidsTLQVq4w6yaiyGyVVSBe53z73MMgxw3Vk9GYzt3/ofsoJkRW42hsqkGXULo+rDbh6gnkevGeZHvDlIugCuQXn976Nz9/hOYm86x9blM46tqSLAv5Pl72Xbdn2t7YbF8o4tP7GSfD38NaGcov33umCon3/YRTBgWgPKEKKsF9A3dVqbMhAYZAt7GHdFfxFvZYw5NiSgOHkD582Z5kSQAcgihrfaUrw9XD5/enmz8GPV8/frkSrJwhkCg0Bgsbp7qf6FFXR/iS5OM5K99eS9svmBZ2zPPVvl9YM0NPh5oj+R4q39ooELTT4uo0EJK+oXA3BGBKahQ2GqwLUBDBwQXQgqWQMDoldAtjJ7ctUTnaArNIAgNIzLagazGZoQJHl9hF0nFUOiXyNIiteGashvA0KvraYMSUQPaqdClJH2PTs85u5HYQJeG2lfNGwAo1rYnApiTZ1JzxBZ+ax15OjNW0JutI9ZCKv3KwLhycuiy2zl4sDA+tqm/xl5s561ZS6C2JLJIIk1zHOj+Yt2QyDw0XZtC2Oa6j8r8mSv54///E/n6F8luffJFD/QskzEKKLv4HpR+MoRU4yTFKw7x5sR5vn+g0CJrVeNf/CYtcanvO8uErXfiDykmcy781b8zz38MQrMn+0JIao6iDBOUt6xnblFOMwBd/+U7dJf6xcmSsklnizfHTO6k8ISUjkFNQUlG3At5jiPgB4mZuzGbv8OWn2NPzRw2Gt7aNF9UrK/liLR3j4Xzj/88JQaAm1mlsrE/Gs1ETokQT2cQETaIWmRy1ydTYrOKoQ2Z8zKUutmhebE0WxHYtOuqRFVGfrPpoQDa+NCRbY4e2x85kZ+zW7tGI7MeRHHhoTA6/TMSJnIgm5NSxRxfgjL26GPuSyzigK2OSbuAgk2lKbmIBLvW/NVzJPRwi94/m5OnRAofJ64cjyT84Rv49WpIP1op8LlrX7zj5DifIj2gjo6mAYZQoPDCcMging0xgFFVaOEeVgTH4gDKDM9hc8GRL4QJlLXRm2wercDbGUZXGpaAq4wplf9OFa+JcrvWkKzseuuFDTKKajmtBzTCVcr3pzm7Dh9te+LL7TTEuZq/hz943Nyk/XIrplP+4HRSIWVTQxXQqDLPxCS7jcPyEy1MRhxCOxRwq7jCTisdVnHAThrlUWjwMysQCKusmnAtGBPe5iIwn1AAsogYeonkYFlPD36EI71ML/y8LP8S214c+Jx5f0z9jIX6m/9QQ98tgUpE11Ie2gf4w3IpOeAGP40nUxeAwDNAIJzEY0QBDDTyC9xhqhjtqCzG4GSfiZIY6N4WRimdwGmrB/XgWD4SGe3GXNHqhBmrCE7gbf+FXfIkfGVqNWPyAR8UNj0mbm164BxWGjg96i3ckSPdhAb/hD3yPDgy+6Ij2DH5jPkMAbsHnOIUh8IkJPC9RfzASr+PFGIOX8S5ew5t4JUbjHaXcXjcsDaEJZ9E+daPOhW3qjq5XqGQ1i3I2J6wylV20EPpIL/Vht3rp2DkWHZOjdmwMeNyjPKixHNUxPNIOW9XwgA03pnzeszFXpzFnlmT9LW7VlrFur6e9u9fsU3upmuquejl1qmZqo8Up99vSbRrdFiq+5IEZI9MHbbMBJzi1baHplDqJLctktHlgy98yy5zhtrun8+zyFbyABqEMpEGXoRN4Ah4PT2ACn1r7rC3rwNqytdgaNsW22YZti7aasSB907Y0nIqxGf+YYpgf93znb8+BUQ2XLGTNWTu7Z0K2OxvJ2PyKc8E5zmk7TzgHnYKrx5V3ea5rrg13vzvq3ukuu888K56lnjOeS++Ad7x3l3cGUSAZREXOItfoODoLPYluYr0YiTWwBTboU/hMn+u76DvE+/EOvgtfJUaIWcRVYoNsI01SIs+Qx9Q0NZ/aSw3RMJ2lVfosvcV0MxVmySDm3L/oX+w/7d8KtAfMgBu4FDgJjgbnBjcFjeB6SBWKhTaGnoTrwu3w1vB4RBWRIisj2yIkcsXOsjPZ9SxgTXaTU3IcN4GzuANck8N5KY/zTX7BT/BZoV0wBVm4JOyL7WJZBMSRmBUHxYAkkaxSUkKkbVJTwmWVHJUXyBtkJq8qHYqhTFU2KoOqRNXUReo2tV8taJPaRG2m9eudekdf6lg/MjqNhDHVWGdYRiLaFZWjy6I3Yh9jjdj+2H58Jr4oviNeiE/Ei4m5xNTExgRL7CWRFWll8srmlf6VUoAJtAKDQC4wF6gVU3BB8EhwJJgKSaFJoY2hoVA1zIdXhY+HDyJLkeWR05Hj6GR0ZvRCdD7WGCvGjNipWD22FpfGg3Ez3olL8e3xfLwZRxMNCVcikZiVmCfkxGAikhxPCkdasp40k8eSH6nGlJgam7JSO1N5ajq1n8rPmOl0upa20lvSQ+nVdCLTnKEz9YySeZuVZZns7OyO7ENOmcvkOrlBrjO3mDvJJfLdeSo/MX84T82xQnshWKgV8MKoECngwlqhtumL7eKGolE8KYF2SrHSnNKWEisdlVvLZvlA+bDSV6lV7MruCqysVbLVeHVLdVPVrJ7XdmqdmlXbX+uriXWqbtTv1jcaSINqVBty41hjrzncrDTN5v+tida01vqW1cq0Xe12e1MbyX6nsVPveJ0r3Yau0Z3R3did6j4BKiABzAZM4AAwDRwDPNgOiuAUcBu4D3VDVUiETkE38BBcgedwH7wCe+GywCEqMgvpIceQf2gfOhmV0W2oQndQHC3RGubGDGwaNsQYto934Bzexg38MD6OiwRBlAiTeEU2kylSI0+QbRKlpBSgxlPbKEDN0DBdpUl6SZfpRQZmRKbAnGRWWbB4sRmWZHew81wT1+Q2cgf8HD+H38S3eEEAQl1YE/pFhVgUdfGkeC0xUkHipS3SoCT03L1Qr9vjevt7qLfRE/pov9jn+pv7pf5sn5NhWZFNuSfvl3eUBiWhbFD2Kx0lpPaoLXWTWlXPtB6tpunaDe1Un9FNXdBnek3f1KsGZcw31hvAmDSlJmHGzenm3Bw1s1bY6lq2ddnattvtjk39uX3gyJ2KoztTZ9Y5cuvdrEu7O9x9N+7NeTO9HZ70vvxhx3T6zilnx5W7cXex67uj7q/X4sW91d5W79hX+DG/5S/9DT8a9AT1QAzOBW9ha0iGE8JN4WT4FvVGerQuOh8dR2xcHyfiibER74nH449EkQSSeDIn2ZGMJEcJwZRNZTNsk22y7bl9w37K8dFRdlxwPDr/Oh+52lzTXTddr+5/7v88u57LnkMcQAfwg4lgCTS4ghD0wQnQhwquwAyaQSUko/1oEf3HA9iDZ+IjWOI5vI9ZXCSNBCUt4pI5gWSRPBCONlOFjqdTimgvrekYfaFxWmRSFmBd5jPJ5tgB47mMI1zjU7jPAVd8iwe4KBBREhvEqLgQYSEiiPXFwrFKTIkdi+3EFXEtPik+iWfi/XEqMZCYktifqHHvuancKa6XW+ZCXJFHeBfP8gv4IV/mz4ROYZPwVgQHTDwkjkkyySvNkfZJXSknD8lZuSXvk0H3U1k6Jm2mcMqmJ9Ll1JkmstGsk23OTrNYPp2X83rO5cfz5TxT9BXhYnoxLWaLq/KkPFqul6mqtdKqKdVaJatTWKVe4ZSxiqUcVPqUiJJRKkAOIOAGNBBAHBRBEbQBDiRggxnwAx6oAIImMAEv4EBJValOlVZjak37UvsTlRyUKanJoeQyk7PyWIZUk1LVTLWqBtSkulMF3aEZ3dCcnulOvacTpsXQJmrqBjKimRhsarNkHIY1Bau0HqvYliWsY7fYQTtut6zHhqygHglgGQuCz86NJx9wYhTUIp8k1YXL1FZddNdP/EhmGXnqc23+HrHgoismrXnq1Zvx20mX0xYhiTSDpJdhllzzyDdcqhWHHZCFOViHAlxAEVZhP8RhHEHIgnDEowoCkYqmiEM6GkQ4ygwhhvv4jpuYwTbeiXVs4SCuEciQ3EmFYGRE/IQjGjHIMEFJig760g390C7lqUZnNEJ12qQuGqAJWmUT+9iMvVmXWWw7k1iRETbAvIxj59lKW0s3V7B0vW7t0fRVfV2lGq3/49////jL//X//L3395rve9n3DjvEwQVkIR/ZK+f9fOyeq0oZbqmR13OxX1EsuHwts1VsiabXaD59IcDsquHcxCboSY2aX/Hod1hD+yg31FcdZxWHwCNcAjmXTAMzrbap2zXDhlJ1Dv2sPDC2z/wbUcyLH9Kt77vgoRCrk1rtOMKv0VgpZy27ysz/qNHwd8yivOFhenvnKfdRQE3WMaL2EKHzUzWXM5zxxNRYbe/XY11fF00r13A3ksbV3Ye4uEq5J411saRvjH2EiaDFa+SNZtJKci6olNsbm3bTztz3vIEY52sdlBXOug39y+1c8+HIJk2pUuO710KRaJC+s3YnWmWGWhMFfyZBRssBs0hxyCY3KH8yQ8f9uP6CqFPw3Hvgd2/ZHUuytXT9mXDqNs5lK+gBA2gtO/QX8odDbiBcrDJrHAOmlprjdX09VVndNiY5z+2qpU01HIoRVY+9KXJLoI8bb1vpVdfshI9CYx+9u5uTtPoiQviVAqmIV85XLTA7KA+hamSOQfSPHPnpeiUQkm60XSnwxKzSXK5bNXrLOn1+ts1AuZB+50+80wBew25tZbbc9g7djIvFtXS1jFhkyNXyHN3utwZHh2PPffQXLL6isdrxQs4nqtr4dd0PWky7sL6wBd8LPVHf81RsdPKp1a0uZxrVcApfS0NfBmpiA/L5UHb01lVnd1Yi7vx3yuia61IJMYR+Ik80maTYd2ATiE9b4FN1vBRq3z3n4vROSw+8PQF6dPmvix+3PKFeEwY9QNOT2WDRjgi6/AsROase1kocPjNV7jXv8bkhO0v5mIxFYvXCfssRup8sE50ybX5lYa5BYAlndDIkFt5WfWFBCLcLXi7M+fzW9vLcofeCAxfkAPNTPgOGCYDB5qwAzvB10MNVIpm218yHmke/TMnn+/L3PnTFpraW9oa7cu2JlTvPvJDcKFGnnBTHieNcmj+X2mVJYs8dYAIKXAN+5mTGlaI1MU35nNbUPk6jwEE3616OIvzVchCYuwd6X1pWy8C5zD/iHEXidcDS9zDh0SYbKWFabJhd8dmEb8vfwhyWGJkjEdP3iV0L5zsyw2reeggXDH29MmvTLl5P3+qQ+tF+H75wXYqHoAcAohS/s2IO0QortwrtaZd5mqfaZTL6gME5jEkGjgLEDK15zD3CcB5QgzrROAugeItWpjKnwDQYnIn9kV2uxosnSspjPM778pqMvKaTE6OJ6160N/o+8pLR7+1fCgWr47kwlMAP14V0PI3vJNC3+5AymNvq1I72BVvd6HUqrJXIuOdAyLwm3M95NIlStdhIHnsjhK0vMRBkv6wcG0ocDu+KBsucNxLs9RDBg261C1REL5qiLKZzgea1537k6F3puJGCQnOqlNUJ7NMMpCQEGsDtEqS6J9zBYUDwHauK7vfZ+Hw5T+symoCGzAXpZNVHP8siW4WCx+PvMcE3SoakVlgHf2zH7Stmzt2CIlCwfCGsdKMFP7wzRiYyfRxoUtEE5ZSNasTT5RTYW/Tp101FqUog4blQ/S8wiSNQRtN9tkVGfWVqlM6WeEfxRiUBIwyOeVcjqaiqcCmPuytmMWs0sX5k/SKjazSzqlUqZR8KSzxGh300zC6XGEX5WwshNHPpwzFQForK+NZQ4XseLjBGnH5U9Hl/BU4A0I50abpU6rr/Ua8fA1Oc++EGmCTLOyCWSAuKCwN0Isk8Ac24TUxdPidJXo5TrDgNZdqXqF+8Yt0Y6LDd7Swbtg7y0xqSnod+dQuyGQaLLFuIcH9zETklIL9TKUeRuvHi0o6mTU/ss2qdRW7UTRFtdFz7vQj05mu9mtXgJiQ16w+8HR6+0aSWmz5xR+aIe77rg4lAKKWOElhfvF7VWLOmwLdoXOo1QsZvnCAIXvVu62TU6NdhUcS5FYMD7FLyadKtzB4TBQ8hKSaLQltWqngm5mXODzlnSiqvi9evyLa7KhQ6KlYKDINmDFNAiCJZuaIa62p9NHnUsKLxOK+VN90260yFLBqy6KVD7iMuH+FqG9Vor32k+4eQLuzbRt+Km/unBvaOzXQaQHz66MVZXO71s+SjTz0mv/XiTbHi1FGDvmSoN4nmDQG5gOdrv1WN/IMdJoKXCoMnzEACKvLbYRNetl2vbB2NsRyqvZWXFUPvKgXWzYR6EFTLTKfrSZdEce4SDrKPKqIugJztnDjRzOp1chd7ZGmT8sWInTM4Z0Ewa90U5jVzjkgviTSxifJ5e3vxevK9RdaLRnJq451vg8MJ3s42tpel7cAY7Qf6aqRc/SLIpVK4H6DY5th5DCgzvOAqn3dNwo59oa+4R3pBminKr1nzKwJDwFH/YWJDlXHGFC0ULH+MyNcT8vmZPnUiw5QtW3HwuIrD0dtIVRS6YoVK5JrH1hJCpkN4mpXG7kjPJHpoJ9IOmWaTVMdoDnHbBASgQxkDpicGCWMJDqR+BsJTHPO2bD9mgFtzF7STSmH2SGhrqTH9M4nzlod3Ev0hU/xUPRDl8AJZWoifiNj2MBn9KDkCFn8twNC1SR70DNa4Rt4c95FwwkdpcsrnTyj2367sk3RpXTQqeFzpgpOuZANTjwXCvwvjf5ia77/MWh00tUG9d+gSR9Mbx3BBHewEDcEO4GwRLVrpB94hRMiwGJygZHaEfg+wJo2KaBUA5lJQFU0zlw4eYnENKRh9BOGJcI7HCHzZlr9VvXv4BGIdd+jRPGDuUonUxJTkC5IrXW8KBU0slmo11G4gAdUpu0sXYsEFRMtkVf0wkAT4AYlXsyD2aPBDwBqYQTAXNUA51sDTrGVim8mTWuJyTry3HoGVXnw/TPE8t8y/hpHB7YLP9zTzR5cTZrRaNjFkIiMWXMfBPOhAkfADRLP0oAdFPSinHIYCiWdkjStNfZatg3i+M4xBz+tLm/KxUy7QJSwP+7pACg/O8OxBA5TDnNeDYgVj+QYyad5D/B4PHnOfsGryE4nVk7c0pBpESjSFVQv1Rk8FUuTx9i+CItXxWQzQlLf9rr+3eukojMJAgALL0zxmLSk0mXmSnhQ2Zl39boqd7Fm75I51I9cwlHM6JcSmhYFLErZxhYF7+rs4oEH6tRLmC6vhEkoiMVIRuJ2rlpo2aKt2EyAsSiVraorvlKJswOUao8kpyeeqPcXjRguSFB2aZXcFVasRUDauN5DvikBYeUMoo9FYbFXntXN4LEnnoxy9q1lBhVfL0NKwsRshoq2TUmHjEZ4JmZgPWt2lhcb6ZpcoiJJZf6UIVbBd2rG0ileH5cG4L8PMuArrYpjP5buCQBvJjW9CBjR1ERgCdA/gxs9krh67iq73msRmVOQ5+sk2z0Trtbjr9gjC7+OST0KJV3zSmSRzFluL4nfaCKcEMxHyrhRljn5KZX012OMGXaz4BpVwgWWefdp2/x1xoUA6yOak2fGNJdNampe1eGBKy7oyZKAtrs9jx91W+DGTk96S3bCFkxa9xXVWm2Xqp4h4mhzPb7G/8Dtl7ySZvIQ07wh2NZW3Suwb0+EylbDDADfipSurtGiMykPDFWGgdUza8Gz7hLvoTjgOWvZ7kfQmB+jcciu8xvZd5og0TYeqjHneZfSh5yMdxUV9qCAe1OMESqK5s/CLcya+9j09bbLjqr1Y2gjYjBbA7l4bjKIntTc7LjbXHmCX3gwXbW0mSwzUQYlbi2LO2qf4NJopXt+EBIdIXMT+ASoYGyIuuY7MdnFRe8HyCFzALXYUzmnOCZSbwyCdPYVsc3Wo1Jh22H3w4HMiz7lR3nmziFia8TrBB+yB+i5f6ZiCLeVIF2ssFtkZhiRTmEaTaOlYmrSXl/vst8KsIRwHJP5dqKDmgcez9j6xHjNGCtVsa5Cn1c5IVaHxdvaU1hhL150ZmhBjHwYemU1wVazhc2qvWktuStgZAKYAWM3pROvJLw7+ZcOhy+2M7N++ANutL28uRwVM3uSILQkrzTOQOtNM07G7l52NuNtdD1prChM53J6nYzuq47BKtFBTZdeVwdfWwMEcYd/Fq8Wuh0S898owDPW/PQQDBuhhmZugm5ke2k7KcMTHiVVBLNOG7Rl9E1OD19piNLfv9shJLBHz2iYEdohDO8EasRgbwZGa1m85QaqUi7fg9EiiNROh3wZe8HVPY6CU3OYYPLZnJ54FubJRAeR3U+1onQ9dhidwHY0qInaLQoFUhQJHdrHi4PDFwRkKpORx/YcxcmvYvUhmOnEJLSs6EoNwbJSnHhTrkF4vOyqH0eSv5llkyzmnmGmjVXkByHUR6wkf61geVMUt2qpgzczU3VfEjO5VHyTefZ7JxLitibdgtOgcET0YKQuQGM2YNC9JxFkB7UE3HUEeqTnaB14g3B/vTkNvSoCUit/Ni80Jkz9rRXc8TBoog/65rLSUIW35DoKVRmzfWEbVlafvUXPyRyEfkvaeu1LyxIlzIDAtSs+/bZ6l8zNdNeSB5gPAbIciys0DgYB5Xt7dmSp/jcMEQiGxN1UiDTkc6WFa5601etpabQYL0f8cibqDWs5+8R209iMDO/v7NPNaczrwTqwCWeedvnsmUGbEQmKNwCdhEoN/2llNDE2N2gIYlgNv9S5LjAIMwg2tLgObmJ2Fdmma6hC1mHiZfE65Qq4xRTuv1XWquR/7DnTz/C2HkAIuShDT7cV9o0K/TWPZAz6pBiSK5XFfIt4TEBWskgYQT1udJkNMNLMfPrN+PK8Zlyp1c10eTEr64k7D5wsOgAg9LXAsA+lvt1baVGVLl14OysJrBoLOxxXQ3O6vw6CyFS7N8vwJHE8tq2WrBoC4Lkz+jkq0mSZ2UKHFXacpuEoVZO1kBthZOc8RpgkFbywamBgUlThk/CHymgE16maC8FI27Mr2ohPgj4UJDAjcPWOhtv+3RHFj+lJZGdrHju8DubXK4v3qXOVUTI1cEaKBzbjWI2TAHyVpQ460wBxdwyF1BqnUiNSTXxCYmJaNJac9sJ/JeJIpxd1Y0VERUNAnoakf98QuiobpVf7CZyhn/UXEChNGwaBQ19qZy048yb7989HOz4ouX18g52XCSdgXUv5+ccgyy0CzRCMzRkslYCZfUw1Emm/jdNflZqW6b/AtTpt4aOat9WwsCTXHAths0Upj4U5BcwyxfSGNBmQ5sSMk3G8LBquBSLGcyThtXW3BLuPMPDo4bA5+tOrQkSa9jVluayc4TR5SFxtm7FCsR9UGCzZNattvMGZpe1tPgpVqrX8BRIXeSvhmuWNyjgbyQkkkPBvLZysbV4KauDmqoeMmBdkC2VcxBLpux5VTp2AR3YpckyLUlO3JEIBOOyRrdxdiVZhH5ojsEyGd4gg/I3LZgGQiyAXpCvZI4Qi+hUwIy/Ngu26u0OMgpuUwwRkXIZ8ExOmieKMm/xShas9sLfhjoJHh+dxpArNFi7Wbgu2M6ZQ7WB8ZSr5Y1AvKt5jOTpAcbH8G7a/xGQHpO9vFyuFoJMDk1D4ZAruyqDKcKydsv9CdlZBthylp4fPYqp1lFBVRfwX0BQLrWzNhKREpfLEc0K6JxF0yOZepOM6IWsT435U4gsK62rejH7/ONfbHEILJIAXqr2WqrSmqLwBzX7dQV6jAoUj+NqERtixjRAc3EwoQPFlNFosPu3NWwxIZexN6OVD0dGyqK+XNOV4eFyIZ8udjDxQZj6bVjlcy2XanIosvQIcg5Opl6tm61eLva19XjtSGqziSFEMltfB/DL09oD5kKYCyG0IHzRhnvrQ8Tytel6RXm9Gt6r5epUdnMx+tT8EwhTXDO9mvRWwzuh8NguzlJe7g3qj2gdjSKwF/l5BukCyxPedMeaBkKkXMUcqkpIU2bMVznfeaFghqeon56wajbKCI2+JMWW9fBJ0RmBerGqNFBJBGQv7d0SSpv/P7ExCGj5itRtcK2ag1pos2jjenuPKuPcQ/SLne7SSbi4PVL63/4IKzm9rKzoqz/8FsBgoNUk/2ak0x8ejvy1rBoGe3Fc3jHoPcy/wFnNDVEUzW1WyZuI2YLciCnFw32Mmvh4qJYxU7kEFDa7omqaT1u4z+YfDNuv6b7JnUalenWTJ10c9X2gimpiA7n1pmrMtLSpucBubYK6SunYlLbD8wFV3UyRp6Uat74UqvmY3+rdxmrHEgUBuGEo1ysKq8DaDSrXalpMQ4zadoMfYXjPOfl0WJuaOFkzuS78cyjBWMG8zR28CMIZTYd6XdWYuBLM2FQnGvHowAkA735sbaSAd49kSuBfM2BMfBcxnmYgG9dIZ5jRT0cPvi90TyhEtjNb47ehTcPMQsJAgNFrwSzuTXNSJmGQO95dDILjNP+Xgs1Mw99rDLMnUoSD9iX1+aMuD2G9Wwpe0HymDhOOAMP3XRM9CC+CLJ5W6eCctkN/mKeCDYVnDZ2/LItmy4aOu2MExOrfTUxHmU5lIpVwEpTY3oPYFL2h4aScTN+ENmtxKuSTCw6DPfdnyPp20y12ElY7IGyUc6y0py7rHkw+ThY/SVkde3jY7Y195frvx/UuY/xpmjVVfGJr+9TKIE6Z9VRI1z8WPDumjdTFXr7CxzbfChoeChhVqLFadRAqdF6ZN4a/fRVhPgFeX0IpaMaCMwJdDa2ptU1pldv/a4L1jHd6c63hHtPBD5KIRpOFbpVAdDqDy/DDSk+YEAm1Fc8HDmgaUMFKjmnBr1LXu9Ey/83Rx8EqnJ3l6/7/H3+r2PT1HlI1VeyzPZOBxHRU3YYiu6eSvVYts/VnX0SB0ipebYceSaSIwHd28qHSMX/i9DKav0qPcMaW76ExgWJhqXWait35PblOUsTnztRl8vuEepgdVT1p3sxBRp51IUS2yCyq3YvKEuqKZgNu/poTTVe4GI7ooMVsITemhw5jpB9stEeE/97lOO/XJB4Qp2W8GLO76furYbydQy1+yFLsR9EPpBQmGEwJeuJQmVuuY6God20nN4mQRb0DcDlJHLxyUn5IFr3eQaPpTVl0e0Pi1PslPsn5nSoattFCaW5q17R1w9/IBUVzqstrAVfbFoTQZur13FJ8hiqApYLIc14BX0LWbjxkeZFboFrsAFsHUzrtUl8RTjY+ymFXPGyn4inrxB1n3916Gzc8AuWyHLmLurF3yowrm7c20HO0cZrzXbzdznE7z6UJWIxhUY+D50YPLd9ZLeCX7OUJ88OzZ01Dbg5MhV6Hv+7kEoJ3U4nSYLL+FKKGyTLaoqxBdgq3XFjbgVzc9+TC0gv4nC1MCXgBFJlzlQW1TaPdzQNS5HtvomwTDmfxejhnD3ldoGps6OOeUUbUvwzUwz9Eq6FOEWuSpdwlJj3MFeMK2jgwcWrDY0rjS6QUAj8Fh56aby+9EnOc3ZIM1zcbNYgciRcnjMO44GtKS64jmmk75KjoUeslEgYSRWbq90eXfj+x7yhd9T6zXW98R743dE2Y9rTXRFQCeiZ/xBCZXDcaDFwCH+mNc7G1/subNy21p3Wpk3Q3wfAUOb35M9YDYDhKD56byb19pHJ8H8iDvWqe38OE0OjJIyIpLadq0TdVKt0t92pW7/1oAlozaQVwMPQV05Ge0eEiRCuI0gdh7h8OKgUo9JvfotsSjC2aOcEYZynYgcwGOHoh1kw88/7nqCFsL2xjOkg3fYcC/v3Z9+szwhj9cXwoyrWdVjzweJ/xsIoLP4h9M43g8s8O8JNv8nPw3YMiR1EDp5ZsaGW7HaGts+bN+XuJCIYueO3ZyHFpg7aeX8Gl7K5hmIM/n1aQlcuez8j6E/DOTGFbku50eXj967IR+sAirXTP6p7cR5HedcKrxnXv0Z3AGat1M51i4Yhz3kEcr66FT1ajKvM96gpwxlG72E5P9QvGi16iuEUOigPolM6ZEErrwQC2eEkse2cDEBbTuNu62tgzqxshgx4+sycDt1f6dlFBXtXFygm/IOHm2Wyav7OWRLg/j3hLvoDfBqSyjHeAqXKTPnApDIeB6afl9BeM0HxL+8jlUytzM42lH/Ri1o1xsqDscxYLdxNq0mex4ZaOeKBk9wfEOgTwp74LReoAMsEwbOYy5l0GDCGsgWmrZC8U5V66Qj7IeRUcrm3PX+dXQuCztSJ73EPbj4W7pAe8QVBg48VasM7NM+opIQLsZPNRg5GgNLTxwNkTEy07dDXpAM3IbECxBuD1kuoG2LCFprWHxLislOalWxSim6O76yhHQVyjz9zl8/z5BJplAlWDSspmiCWnP7qM3CXJ+enVmOVG3c1Js2AunleLpMkbd3+3gwFV0UNLjviMtvGiUkTWGgo+jtEdxTtN2d+/Nbvpnn+vCYesjMRoi1T0VjijNCO4JUhkaC50h1ubAeN4w6xSbsGzhFUZA9igt1IAv2hWy63IFW3VXuJty0+UUXtcpJnqsdZYOD8PqKlDAy3af/Yn2NXVopYmFCWEsIIyErDJ66PMoeUtmJ8Kg9Lq4dl76Q2nMbywf+z19h4d84TtAZP8UPJJAxHnHk9tqGNqyDNXEV2agbYlOWW/oSmFSb0BzkpRC//Ry965eNqbbsN/QV9gbNxWACsJchzQmzxIO8aA744bQsJtRnHdPxHbAQ13RubfW5ucw2MURZ5MTpZYrU+M5burVHiuMX5qwFnVqna8+07coH500hGTe/MgNq8HFRFzYQ2A3CIEXMQZTpd8wTQ+q4IbX/MomsFin1rsMxavARr2WDvGG8AQQvEdFyck63Ew5NuvHyWzxqm+trWLCIFhSamySwmGlNN0o6n5dAtULtdH3DSTRruWj6a6BIGYXlYtQMPVPWc/iwL80g1h7lSxXx5WfyNpGlXftnZP+WBqeULM7JA4eWY69rLVgBmo5tTf90Ju0HdF5yv4PPQm4j4vXMsfMPC9D4Ygrx6oinbnD1EuKdZUh0r8QcZQKXRiiG4fVaxVvWQtJWf4ht1W3ueWiu6wrSwgbsBC8bRgorlVxnIDa8DinzeC+UmbEAqM5obpYv0nzDkooZ+HYDeJGbgIQdPNall7pOxoWMIw6y8KiS1z2AvJkYS42F7qCiODNk4NPswzfDm1r87qj1y2b7H/DnXfzwSf2e//9F/v/YKNqzSdsw37S/QrNBOWQyU7LrsJLjUtakaovKu5iUrDdX4uGeJTzEIldguM4scp2tNGYiNqOjpf7NGcB8FRJbgcv71etrcePMt83pO6LhT0q/ZprI6cM0sed5guzBsm+y03ookGPpl0kNwvHMwJr6Fa8nvBNdINRfYIACWGipwN8bU6j2V2t4K36XgBcHXr4IIWA64IziFZMIxOKRJ7FDiqvK1Ffw4lcklR1FcnoSIuW7Zqcz2/b7qzt9n5hiYJVS+YEAVbGGHUP6D3FS2pU3WnyRJTrFkSScqV1PUuSOtjTFphqfr8GLj3jdjW9LX0BuYWHkHfNYqvxTEyHMnbSV5dJ+1t5oWXB4JDD/cFS6UMDMQPkr1byV2i0vzCbRA7JA5ThHSkbYIH4Sk5uPIrksvo3j6eYIi2niso3yWMS05yUCbSsrHP0Lj10BAlcHlFyClpGao4vXUi4WyxIIscnYrO4DA5F0yiP4cfrJ1L/eZtIf1yY+a8s3wY7hIitaGTncgz/DMty9eBEhMP7Z725NsExcUVE2wWuj60cis+63urRrq9XZw7xE1sYibw2NBHUe+QQoKwmhNuQbd+Quc+r6+QSKEKmY32oiiWKnAaG28QYmMvqKr96M449PSsRh4HDaqV3p4WP3Z8He+5HtxvP2+osu0k1/JwK6pXcCY2kTHYsnM4Mjk7NbiyN7nRNkvhHY28TiZSzpxc7OfNJUE/gpqO2wrmW4mHPbaL3ihNSxCd4TVEIkPdbRzppm11cQKyAeV9VRyUr7g/yen/odFlk2OaAJ/XjRO7nQWvXTwLCwV2BabP3bOgnHBzvK8Oi6jy3M0Ra3pWNB2K5sPp5XQdF0iW5YGR+vK4fhdss2YG8RXOlLfSkGKpeAe7hRM5zR9CJI6ZuhK9Fqmz0XwiNBcArZqJynrmYWBqvzGuDLTw9hZmUEgt4hX78cJ1efHsp2NzMXhaAjPVzsPdz2ZwU1fh9QyNlxHLQ169/a/U6oHHpcI4lweejPqUzSNL1WrDCvUBc+EWUwacefq5M3d4S4cV4ZfF8cyP1VTxNqx5fAjN+um+JKxRvbhLI7KNilzFl/QC5M2UDaTy6uj09JQJlfiI5zqGSMkeI+Dfn6sL7MD53qQxuVe2+AqSZLTwY7qjdC6MB4ZaBu0pPmbBSJpB5CQeLpOEVbNsBmilCFp4ljOe4VcQmZbGnUEnpKaCY1i4xhQnMs2yYr9LkoDFjnkff2djYwrDOWgAnmQI6ERPI+4b1OgZmlER8buDiBl7qPGhJ9RAdYA4KBmSrdXcZ2sfxdIsJ+VTWmwRgCkos0dWy/MzEvVjM3qZpkqGbGNIXmYySxcD4gisqzRCLE/2qIpYJ1b8/DKFYjYi++mCF0chno7+H129rOfQHfrEYyev+L822mJq9YXxkMJ5l/Mgue086XQm8yibrZKZcgq/SJt6QKGlwnnD9NMkEIWteon19Mb90MnTvBkqDYc/RD/Lg+Sz7/Heo71Nf0IY3cxjvsdwTfkX5H+OpvP/SMc3sYqLUn102STZdG348KpucwtQdcu6bvvC9ms0kYR53eejBQ77rL8ihHV1zYoIkJB/q/S22OHP6oTfnNin7zLxsJCisAUHMNkUFjhmCBFYING4IdO0J5lQlV2RMcVCfU5khoogmhmWaEFtwIbbUldOBB6MyPECiQECyYECqMECmSEC2aECOGIlYsoadehHjJhFSphAwFhH76EwYZRBjmhBjtlJjitJjpjJjtrFjogljisljpuljtjtjosdjmmdjptdjvK+GEU4QzzhDOOUe46CrhhhuEW24THnhBeO014V//Et76SPjiC+G730QQM0QsxAIRa7FGxDaISIXsRCrVR6RyDkqq5CTikJdIjQgi9aKINIwn0iKFiFs6kfaliHhWIhJQm0hoXSLhTSYS1zQivZpJJLE5RJJbSCSzFUTyW02kTxuILGqRZGWrJOvaICmpRLK73ZIznSFytatE7nWPyKteEfm/t4i815+IZPc+76vkeyBlrswRZVdZoipWmaiqVSWqTnWIal4LojrUgSjvvEmFFEIquhhScfUk1bsEUkllkCpqOlEb2kUMSSdZMaSfcTSCBhqBTuBACmVIP9lI7umrQjAY+p3+Z+AZzBjquhRrfsZrGoaccawQoA5BnmfPb31CaJDxc0EWTTiDLkp1+iLEyPGUe8eLlj6N88yzcV/6fhvs2yeCuod09J8bPKIZLnxkPrADKEB5xiloDJTCBCvJ29fnkOeF15YZAGGKyGfjKP3MEKJlWLQmkWus34bH7t6Z2YeOUz5yjQ/7eOWXff0B+7Gf+7Xf+2OU+SkyjUpV7tRRPHLL3oVoHLlGj3o24kv4wcmllFpa6WU4po9CGNSaNQIsdx3UcgWb0+hmOGVUOwSh9+FC6t5ohRxGN8s5oG+DYo9Tw9hTqP6q8a0oQ3lh4EZ7Sc0ZDWoF1b1ykoDHQE0XQvctMk/l07I2AdkCJ0q+l3Mr1Z3RvwfevhrlwWccWwqffRdMmbNgyU4tbddpyLARkygBEplCG33HZYiKy8iqqssrawFBCBQGS6TQWEamZubWW9pol90SJLIT5MrN3O617jx48u6DjsE/sJ9gutnmWGSJZZZbbcO6iSmo7oV4Url33pg+YtgFzKheA+/wpdQQPCV7AAlKUgm4ERIxxxS1Qo3My/lRD1o5IvcZCboegHNYntXamtKbJMpn06JaAFICNzOCHgQ2V2klUGQNkGS+sB8L5YxcOaMeJSRDqUfEWFcGn8B5adWvKK0TsT4mWKwrw2b5kqTxc5S3lM/ymMbgkZbBpsU1QZ3I8TLlJ1HQh2uDta6bOrYppJOsm5xHW99UWlK2uoTHkd0nDO5ITiODwQN64F5M/Gjs2C5miFhgsXMlzgemIwM0CVcSSkAww8bpqeLScej9gGLWmYrVpNAHMnPcmmVBRU9umf/znT2e+M7I7uOA2exVxVKh/t44W32sG6jypVuDB8HjYy3Cqu426+RxGIED4050XHIqhQkWacARjBqqe9Dsl3jWM3Nd+rAftVnOS/w5wQ6+6Pj4dBZYYoU1NmzZKauc8iqQsiu7rsx9fpXJL9P8MstN6StX3M4zCph4Aico/uvJvjhzjsjMYeFjsjNZ/g694ll7TWEm266Nz2BP5CGe8M+9fkYeV3aRStzaNSRk8WB3uvKzfZiVxJt9XXwOb//sweE+x52D+v1P8cNkhJcz3PLZUmIHAmBZlqfAbLBWfA4I1qCipoGlWIZ2tKINS0s5JnMqQLgDrqJtMNDE0PT2tuy55Uon4Yw5c8+pG7otanO73w63I17a7554X7ujj9XHmMeJV8evTjzrTY1P16fPc8CzmIajpKi39ljP/8NTqigx+YpIiJXYZQ/kCYvMH5uYWtKrPP2TT406jW9y02uMd/nhRcNO2QqnN7zZrW53M1reto51rWehEzIoM2VTheyrWf2ccs0t97zyKaiI4koorZz6NKgRjWtyM5rb4la2vi3tal+H+k6TIUuOPKGRsXFFCeMJ0yiZuYGuAzbgwIUHHwMMMcIYE0wx8+dVsl1LGw7iEA6jgCM4iiaO4ThO4CRO/a6eNrSf+PhXd4rhA7JPfvek2XpQ7umf3gzbDsk/+9uXZfthhefV/QPce0TxxYHoIPcdVXp5MDbEjmPKrw7FcwyOq7w+nBhm58xbnX73sXOR8ZTa3XlK7ekCpfZ2kVL7ukSp/V2m1IGuUOpgVyl1KAelDuek1JFclDoaRalj0ZQ6HkOpE7GUOlmAUqcKUup0IUqdiaPU2cKUOtdSzvcgF3qUiz3JpZ7lci9ypVe52ptc6734uk+l1I3pRP1t8Q/+xX/4H2/xDu/xwfs4XLuN+OMNessMA4hcxlY5VdTiorl2Orncla51i9s94AUve8WbxppkqhmWWWW9DXbY56wLrrnvH//5yiQDWYqV2Kz8qs24Bmu9tmu3TvOaz3y7/P81fklLX8YK292e9rav/R3oYIf66LOvvvvpN3WatOnSZ8iYKXOWrNmy58iZKyo6JrZAwUJxheMT+9yXvvat7/3oZ7/6fblera60018NbCgsqA0KIOwIzgRoRRB+5zJV2pxYvlfF7hIvrrDCwHjT8l4gYWCsqXktoGh2JsiOYuj/Fu+SDhRmlCO/eGcmiDCIBUosERReQQ1ipF5KB49w7XKmCAJaz6OkfNW2O+4SOelyrfid5nMRKH+Gbahb2YkDnChAN55Uk1ZlpnaGD7QZq/7kQitBLfg7gUrWbseRYAdt5ysU+3w09mwruzuiyzun10DiwK0lOZ+ryhrsEyfluka3tNyn9eN4Zgzvq4cO8WaevPnyh4aFR3StPOxRZ+9Z0Q5RTtrSALLyXu3PBDdZlu24nu96fhBGcdLY1NzS2tYOIMKEFghVNrRy1VyVpt1x1954l3f5dVRtZ9CumqvlqjrXQ8N2hUX1DRiw21inzWkCV3ukHspWPR7Fb7H0Xkykdhlc+X4sRUTlO1Q+9bv6TjFDZm5W0NCdPVxvf3+DxG2qUphKyrqBXmNdH8TBLBhqA8CP1B/z9QcAAFetCvejP+N/37r/3w/XNWsbWgSQ46aCTjQQoADdQKCen4JMEzRmf3pi0RBKGtQkySFaG5L3hm74xmzCZuyvLdimbdvROYYttMhqrlr1mtUyz0IKL7LoehZfSnkNanxFzWhfJ8MmVppb2vJFRhduY9MmNLGpLWlNmzrdWG34MCIEEo0uIwGAUOyx0007qP1FFmvW67O52WRUDOw48RFR04LgOCY8AhIEMsI0ate1wuZUaZCS5mmTrukuvab/ycVi42KqWl9YS5u7aYOfqB3FUBINo006TGQqBwgQo5532MBO7I0BzIMFsEKmZ87p8xHEdv8bVFRWsyqSatr0W52GIuR/Z3VuFw9FrZj/b9e9X6uZHpve9d8aN7Y1d4u0XmyVZjXj1YKNb/l0xxN+6H4p1eux9MUDaMIeSMmY/4/vxkcKlTJDzwXoU1tDzly1GB6/DU/d9FZggglTdv28FyGIlMOrsJg8QEnPliNP/qqaQDSbz80/XF6CGYbsuNLz19A5jPQhLgRByBQe0WT13h4MssOtN2jTZVJzLyFKKb+Yg7Ov3o9YmyElVStDqEG48zldMCS1eP4LvOsOjX/ApN/FPXG4qAEFucnzgkgv5hLiJKvpc95tvdMROjU8thIXuuCFzP//f9iXPwX2Pqmm2PlTAOyZWTnr37T+A3f4x5UMXHt2Sw36X3g0/Qc2XDQnXf4w0+Hek33K/mb2s8cvLlecPQQs/E2jtNnO+km/ZvH41fjSA+huAFjwKG1J/QCwcIj6Pc1L0wEWHE0FVBDlCvN3kqGAuYtg7oIb/YaHubNu/DB35g168wf+gn2HaWyYe3+uTgCzFh/TgCQJGpGZjgKUQ9fnZUK5dNku14WivLr4K3oVDwYFAAdGlLdeUXZWBpPcKn7He8TUYAOIO+JtXwOI58k6OSfvzDhvah9/8AgJJy4pr6iuqa0LhCPRWD0609jf6nRJ/9l5+QXD2YniSNI9HW2z4bIIhUypZTg4aM4qRVuo1/BHjo2xJpaCPG0Mf6xfs96uJvRr21tVWs1ChfupYzXMiEktULCzTW9mzi149H8nu/R7hfblYe3RWzmHq+7+4ihSv2h7qlukrc0b2roKYi3KHLcV2t7attSWctqVQ16HW1l6PzhdtfFsYX3Q8LpzH2XQmGBFaSywpqJGaqunPl9nO8/5ukj1uAc94jmPDk/T1zdm+stcGw2uu0H2O+SUw0447bLnHnjsSYggWgzca2rOa7jGazmnq3jNF7PQRS5qmWuzbHU4xsAB5hxX3kWVXFHZVRVcUtV11dzk6IU6HmrgqcZequuR7WvlvRbecvNRax909FN73wQ2Ar+G0qX++DeM7v7wbCTB/UFoPcEis4uuT1S9YnKIyyU+VGI+CWHSohXEyywgP86AVMNqb0TuhtfB6DyNq4uxeRlTZ1MLMCV/k/OztN4W1cPswi2pl4XFWVxPa0pRUpZNXtTH7vrZVd8qajBy1pQT1+FJ2lhuvfCsFhRrhSfldb6/mt1coxy0vAFkFTSnCC29U5ggOYIlJ9k4o1+y8XmbViB3P2wr3/lc3TUj2z43y1QTTDNTsUky8SQKVR+LIRP0kL53QHFv32L/wHoYza8sLK8urX2MuPNxvX6bsy7cFqvHQEdYahyeIC1DAag0BW2T0eH1BVv2Xrp44fqdux9BXnJvnY+46v5N27p85fa+3SfOs4Sskf9/hf1Y4MeRn/TTL/r5V02M2ROOFM2wHC+IkqzoGlNnG1yTbwltsSN15Z460Ia6f2ycmKbmmWVuXdiWoX3l2HbuuHbdAU/QG/KF/RGp8LWEfStx30vaj5L3s5T9KnW/S9sfp29JlgqVkajMlMpKq+wMKmd3utyz/mjiHAe3VHebvRua+VdbX1hmD4t9Z2t2YquiZw56VV1SWuEGpRtZRxPqqqhuigsyvWArS7SuNKtLtrZUm8uxp/5MOaKhZ5p4zafB5BYxr2hbyrW9gsUWX3LtdVZfc601tmbrJiw0eYc2duM3ZqNmoW03QGtdsjVbtw3bvE1bu/XbuGWbuklbvjlPR43TK+OjguasPdlwYeHB0tWvvjB19qNPSnsLE6A8NyH8lNVBb/591aPfQlXWXi++fRbXT8EqcVRVx773kScHJl7seQjio7Pq7LRTTSc9de+bWDV0UYV7fxR4MaqoAe1g6Nu/VP9ekX69FKlb/4jQtb8liumtBNH9j1K9EM67N+JF9Z9aaqqtjvrqqctZS64aMbOyMrm1Ym5nzvZ9p3ZyJ3Z8x3Z0R3Z613djN3d4D/ZoD/dkvquttMqKK9vbABYADaYDQGcAY7iJZGqgnUBNdCSohW4JaqOHQR30KqiLTgP1Nh0F6v/eALoTaIh2BY3QU8AR3RA0RrcBTugGoMmmWwHn1XpTu8FttUE3Am3Rs6Adejq0R8+EDmhn4K5OBR0JU3mwrZNyeapSZ7Xy4lIXzcd70w50pVPdBNVdSD4i8tUjP73zl16AgRfIZcgFw6hCTCrUjMIsK/xWtRVp/UXBjommhe4CYtCtQSzaG8ShF0APtAfoqaEIelFiX72dLd6FElwr0f2S/FOy/0rxtVS/J42FiCWQjtiADKQ8yESqgSzECLKRBiDnLUstd+U9pO3JB9IJFCC+oBAJAX2QeND3LfLrt/o/JP0MAFIIBqI7g0HofDAY7QWGoOfBYnRdsATdBCxFDwHL0ONgOXooWIGeCCvRBWAVOgOsxjAe1qAzwVpkJqxDh4L16PmwAd0WbERngRIM02ETOgds3vRfsGVtRTuAbRgmwnb0StiBTgc70S5gF4YZsBtdDexBZsFedBjYhzYA+9EAB9ClgIPqpiDv3J8stRugNFCNBmnQYDUbol5DNWyYlg13QCN0u5HbRM8bDRc1xtnGGue8xuvSBPc10eNN8mCTPdIUzzXVozNtl2lgOs80wzfN9KlZZvuyOf5rrpdm3lZ3MJ9BLdCnhfq3yPAWG9ASQ1tqxCxbTADLH8qtgLlW3qpW32osmQBrfrHPvOsSfeuN2bOB34fqgY3IGWxCDcFm1BhsQS3BVuQEtlGKwXbUHOxAMWDnplCwa+1GkWAPygR7URuw76HsAeqABAZDCgLS0BcyQF1QKRgCmUBzqDSMg0yhFVQGJkJm0Boyh0mQBbSALGE8ZAVtIWuYAtlAe8gWpkF2cCBUFpZC5aA7VB7mQRVgP6giLIIqwUFQZVgGVYEeUFWY74hB7KEVpBq8hzhAC0h1eAsxghukBnyE1ITWkFrwAVIbOkLqwE9IXWgPqQffIPUlENJAZtNQ/CCNVHocpQuksWScxB/SRKbjDN0hTeEPxEU8Ic1kPq4SDGku62khoZCWsv1qVdlpLZEQN1WYNhINaatK006iIO1VcTpIDMRdlaejxEE8ZD+dJB7iqRrTWRIhXqo1XSQB4q2a003SIN1Vf3z+HhP+IZfxk0yIvxpNgORDAtV0gmQAJFitJkSGIaFqP2EyAgmX+0TIcCRSHSZKRiPR8pwYGYfEqsvEyVikh7ymp4xBeqnz9JapSLwCJkGmIInynySZjCTLb1JgKZJ68Z40yCIkXT0mQ2YjmQqfLFmCZKvX5MhCJFdxkyeLkXz1nAJZgxQqZfpICdJXWdMPNiH9YScy4Ko5AwG7kUEXzmDALmTIxfkZinxmOJSFjIE+kPFQAzJhwwiZvKaAM2QqOEGmgSukGB0NmQ5tIDNgOTIbAiBzJBzyl8rNAkiBlMgCZJNiZwusQLbGL9lWXoc+h1t8jqDZX0ebO+ehFMgFOIhcFG/IJam5LFmQK3KcqzIH4X/imiLmPqyEXsAx0EvYAL2Rp6C/1Wy+yj3QN9WZ71Af9AOGQT+hEfQLRkK/4VnoD2oBV4L34MrIG64CH8JVUSDsAKfC1WEX7AL/w81QPtwSWYE94TM4GMbAIcgVDoNZcDjMhCNhFRwNy+GesAWOh3VwCioDzkN14UHIAx6PwuAilADPgK3wXjIb3veO9E68TqYmn1uGTIVvkwnwHTINvktmwvdIMXx/yyQUXoIyU6ly0xkqPCYg+SilSQaKKUlHMSMFKOYkG8WC5KHYkb4otUg/lLp3+qN61W/gcQIZjDIA70IZRVJQRpM0lDG3i9C4JjTxwhNNaXJTmnrhiUqa1pLyW9aaRrW2dRW3vo1tr6SSNrSpTW1pc6ebcc4Ab0Q5izejnMNbUc7jTSgXNm9DWIJWIgpdRDRahBjQSaTUrRPIJNNOVyazjh1zoHOIBSpBLNF6xArtRqxvHUI2lW1e5Srf8ipUudVVqUobq1qtNlW7Bu05DYGOIo3QEcQRHUYa3zqFnGrS+ZxXs4dL51rzbGpR68rllltValOn7POsa3VPN+AmSHfshPjgxojvZlfEb/lvbo0ErEBshwThNkgwNoeE4GZI6G0XFFZEzYssKucTDdwKicFVkVhcCYnDdZAe2BHpjS4h8bgtUoAuI4W4HTIBbUCKcGVkIi4FmYRzkcnYBDIF5yFT0WJkGraAFKOlyHRsBZmBliEzsTVkFrqCzMbtkTnoKvIX7oDMRdeQedgdWYiuI4twR2QxuoEswR7IUnQTWYY7IcvRLWQF9kRWotvIKtwZWY3uImtwF2Qtuoesw97IenQf2YC7IhvRA6QEd0M2oYfIZtwd2YIeIVuxD7INPUa2Y19kB3qC7MR+yB70FNmL/ZF96DmyHwciB9AL5ODmIOTQOoxeIkdwCHIUvUaO4VDkOHqDnMBhyEn0N3IKhyOn0T/IGRyBnEX/IudwJHIe/YdcwFHIRRyMXEL/I5dxNHIFvSVXcQxyDb0j13EscgO9JzdxHHIPfSD3cQ/kAfpIHuKeyCP0iTzGvZAn6DN5insjz9AX8hzHIy/QV/ISJyCv0DfyGicib9B38jdOQv5BP8i/OBn5D/0k/+MU5C36Rd7hVOQ9+k0+4DTkI/qDfMLpyGe0BPmCLSFfMZBvOAP5iQXyC2eissEKKluchcoOa6jK4mxU9tgAVTWcg6o2uoOqDvZCVRc9Q1UPB9xbVpwgd7oKylHDkWYgmsOZFlCJlnCuDVSgLZzoAC1YHT41QivWgC9rQ7d14L8NoQMbwa8u0GszAsoW0GdLAmR7GLQD4Ul3GLIj4U1PGLczgWcYTBpO6BkFU0YTKXvCtL2Ior1hxniiZBrMmU60zIB5M4m2g2DRwcQch8Gaw4mFjoBlRxLzHAWrjiYWOBnWnUIstxgOnE5scB7hzIUw62Io6ucSOHQXVONueHAfNOB+ePUM9HiWGOw5mPA8EclnsOBzYpLvYcMPxAq/wrbfiNVVNnduxQJ4CMzqbzY2K/o4lABAjotbgYdHHgKhQKE0GMyPSKSvUSi/YLFO4gkkGl2tWSCl5as/GFeim8O4ET0Z4+63lvdnievIpo0wHn2dtNmdKxY9AuMtdBHG2+ixGO+ih2O8j56A8Sl6JMaX6PEYX6HHYHyNHoXxHXo0xg/owagxcWsyVLAVOzsDBiMgkQ4KC9M1NHysqekLbR3v6ZroI5NM9YkDDnjXccddcMIJp5x00hmnnHLOGWdcctZZF51zzmnnnXfWBRec99ybufwZgIVjhhjikD/84bAePY6AQDZycFgPAI6KcjBYaDRaZGtrroeHGT4+5vSLKLPRdR1lILpuogxAd5cmEARlRFFbSVJBljVXFNaqqoWmsWkHohIXdO+JBXSfkGboPiWW0H1GnNB9TvlF9wXlC92XxBS6r/g/K2n1sG8QewMTnJXcbFRjp4JeouojFwdVAMpxEpmL/Nw0yEN5XvYBoT4o+4NRlY+YcPIhaABJWRR7R1MPw374qSxADMH6FiK2MAVF2BeWveIogicegWBEcpKIQ6YQhUpUytAoSic+g0iiP3kRV5zCEtQvSWkp9ilNXRkSylJcjlhMCsizfwUqKlJMiQTKRFchpSqB1UilThANdqXJ7rQIpM1edNilLgGNZc/GsQvjf2qilIns1iRqmExJU9iNqTRiGnVMZ49m0LCZ1DaLPZhNgGMOezKXnZtHdfMpYQG7tpCGLKKWxezeEhJbuiWybC0niRWksJLkVpHMajJYQ3ZryWIdqa0nlA1EtJFwNhHUZjLaQg5bCW0bUWy/N412tL/JcwBs2UG25BBbdJgtOMLmHWVzjrFZx++toBOdaq3TnW6mM11rtevdaLuHPWr3vATb94odeseOfGSnPrMDX9ixH+zEb3bmT7bl722bz+DXEDTQ9KY3dOGJhpvT3EZa0OLV2S55qcZa3JKyLW1pqZa1rEzLW16yFa0o3X/9v+T/314w/1fE+fkmbhhqAP34tfBv7zdA5hBAw9T8DRrbo6ntXwqt6gIWr318jtfvu7+43FU1UXBM8PVbcxggzhDXtufdwwvrO/yWgjVxKIY42GLVSvDP1wC8SvVsNjRL3n5t3IPft9XX3T+3/5N+XXVCbcjmIY+u8sbiSa5z0Fa/23/3L8mzaOWdzXvf+e/u9qmQ4zw9OePhEthjl5+XbA6T0DbkDOOGus2dq9ffOe2IeOnKhJm1Yb7vs674gqwUZNCReJ7HtxlWiTLUdMudtYaR5pzna5/laGh0Sollhi1v3omxuTNvDPVnOKWoQCpHZOVq13yWmiHOJxSJZHuVFF3JYI79JTQEs7O4s2tkjqwiKJfL0CipN3fyc/3PuPRjiP9LIydoxFAGOBXpugj23KGwIgYad/fDgKO1KIWHqTChYaiEMlQKHrBdM1ybCAucOgpLqdlnWNFi6F9llG3aN9k+SKDmsBWh/OKyTrLl6C9PqmQpChi5cF7iaPrEy1++KyNviTIkytKLUZQUvWRJ5ilRjl7yFCiUJ5GRr2xZsgVJlKxQRsl8HeCtzTlz9leG6j7Pz+bXwlU0RvEmVUb/+DCJ8uRLLU0a2/7wLjL0lyNFPqNmnEK7aWrU16ztimk1kCSrEuvYLjiN87l9D9HqBLbzMr9xJ/GyZWpCL6fw9gY4UMOQbuoCul4sVxUwCn5wkgJ99dKHirdnSBVv2vnx/gmMCmXJuT2PUUETU/n4rnwY+cuhMdZJn+rQUVLYhsQoSmgJIffvpY9eUtUb95aRHfeVKsEUTMvljgJTNA/dclUZ54vv13aOG+dzEtDOsM8e2fIka8KfF5+KbifbzefrxrdfyZSzzG4vxbqdFhMWpHlKGipNzeJW0unvDND45VCXzBU="
  },
  "mono": {
    "source": "game/ui/fonts/field-kit/ibm-plex-mono-500.woff2",
    "bytes": 40080,
    "sha256": "0498bcb48294756b5ac9062290e1639e907b1ec69b5dc2e8cfdec3fab58e0bc8",
    "license": "OFL-1.1",
    "base64": "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"
  },
  "display": {
    "source": "game/ui/fonts/field-kit/handjet-display-600.woff2",
    "bytes": 38120,
    "sha256": "4797c11d5e17c3f5f9b5b3fa96efb4fd2aabb877fb4d625dfc8eb7465464e145",
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
    "base64": "UklGRuAWAABXQVZFZm10IBAAAAABAAEAAH0AAAD6AAACABAAZGF0YbwWAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEAAAD///7//P/8//z//P/+/wAAAQABAAAA/////wAAAgAEAAYABwAFAAQABQAIAAsACwAKAAcAAwD+//f/7v/i/9b/zP/E/8D/wf/G/8//2v/j/+b/5v/l/+X/5//p/+j/4v/Z/8//xv++/7f/r/+r/6v/tf/I/93/7v/1//D/5P/X/8v/xv/I/9H/3P/q//r/BgAGAPn/6P/Z/8z/vv+x/6v/s//B/9D/3f/o//X///8AAPX/4//S/8P/tf+o/6H/nv+e/6H/n/+b/5T/i/+F/4T/if+Q/5r/n/+Z/43/f/91/3P/eP+H/57/wf/u/xYAKwAoAB0AGgAWAAwAAAD2//L///8VACkALwAmABYACQACAAYAEAAbACQAKQAxAEQAZQCGAKEAsgC6ALwAuACtAKAAmQCVAJUAlgCUAJEAmwC0AMsAzwCxAHUAMQD2/9X/2f/6/ygAUQBiAF0ATwBGAEgAVABmAHgAjACmAMIA1wDdANYAywDBAMEAzgDtABUBOAFRAV4BWwFMATsBKwEdAQ8BBQH8APYA7wDuAPQA+QD6APgA8gDvAPMA9gDvAN4AxACuAKoAswDFANYA3ADcANoA4AD3ABoBOAFGAUoBSQFDATcBJwEgASMBKgE0AUMBWgFtAXUBbQFTATEBDwH6APsAAQH8AOwA1wDFALoAtACqAI0AWgAgAPH/1//Y//j/IgA0ACAA+f/R/7H/pf+///X/IQAyADAAKgAuADgAQwBIADwAKQAdABcAGgAtAEYASQAgAMr/Wv/o/pD+Zv5g/mb+a/5z/nv+dP5V/iv+C/76/fP98P3w/QP+Nf50/qz+y/7Q/tP+4v7q/tn+wP6y/rr+3/4U/0n/Yv9G/wj/yv6O/l3+U/5x/pP+n/6Y/nz+Rv4B/sv9tv2v/ab9oP2n/bT91P0l/pr+Bv9D/1D/QP8h/w//Mv+D/9f/CwAKANH/e/8x/yf/Z/++/+//5/++/4n/Uv8h//L+wv6a/ob+gP55/oz+zv4l/2r/hv91/1X/Xv+V/93/MwCUAOwAGgH5AJYAHwDE/5P/hP+o/9b/yP+j/3//Pf8b/1j/1f81AAIAL/9O/tn9vv3g/Vr+Gf++/zAAgABmANr/IP8w/kX9yfxL/U3/HgICBEEE0wLu/x/95PvP++77CfzM/ML+NQH2ApsDuAL//6b8dfp9+Un5vfk5+/r9ywC2AjEDbgHA/bD6V/ki+dv5xPs//mb/G//L/hH/pf8fAJz/nP07++/5E/rL+6H+hgBnAJj+hfyA+4z7XvyT/Wv+9f1P/Lv6FPp7+sH75fzu/Ez87ftf/LD9Ev8c/8b9ePwg/Kf8if1r/hj/V/8X/9P+FP/c/6YA5wCWAAAAzv+HAMsBnwKDAscBHwH1AEsB2AFgAusCcwMABHgEqAR7BBcEsQNAAwgDdQNjBFQF5gUUBgMGywVwBQoFvgSrBAUFugViBrMGoAZKBvUFzAWuBYEFZQV+BcYFIQZrBooGgAZKBgQG3gXRBcYFvAWtBXUFJAXsBPsEZgXyBVQGcAZKBuEFdwVGBUgFbQV8BWkFNgUNBQkFAgUUBVsFsgUCBksGngb8BlwH1QdVCKIIvwjGCLoIhwjEBzsF/gF+ARYDKAWiBrYHYQiyCNQI3QjeCNMIogj7B2YGoQMIAcoA1gLkBaoHOwhuCHgIaQhGCPQHBgchBI3/Ff2v/XYAcwLqAa//Mf1f+2D6yPlQ+R/5Pvms+ZH6r/th/En8fPt4+qr5NvkL+Qz5N/mW+Sz6tPrp+pf66/lJ+dL4ofi++Dv5IfpC+zv8n/xX/K378vo2+o/5BvmX+FP4Mvgt+FH4mPjj+Az5Jvlj+dr5Yvqf+of6X/om+sr5SfnS+I34cPh2+JX40vgv+Y35wvm6+Y75bvl1+YX5fvln+VX5Xflu+XH5dfmY+dH5//kT+g/6DPon+mr6vvoB+xr7FvsQ+/v6wvqA+m76mPr4+nj75/sW/Pz7wvus+/X7gvwB/Tf9Gf29/Ev86vup+5j7s/vm+y38oPw+/d79Vf5z/jb+3P2f/Xr9Sf0I/cP8pPy6/PX8Of1s/W/9Qv0S/f78B/0t/W/9uP3l/dv9lP02/fj87/wB/QP96PzS/On8N/2k/RT+cP6h/qz+uf7V/uf+1P6h/m7+Tf5P/nL+ov7N/vr+M/+F/8//2f+v/4L/cf+Q/8f/BABHAJIA0ADuAOgAygCdAG4ATwBKAGsAqADeAAYBJwFDAWcBjQGcAZMBfAFkAV0BcgGfAdYBAQINAvcBzwGjAYYBhAGPAYwBcQFZAVcBZgFwAWUBUAFIAVUBdgGoAdoB/gEGAuUBpwFfASgBFQEjAUoBfgGsAdMB+QEYAiMCHAIIAvAB2AG8AZsBdwFYAUABMwE0AUEBWwGCAaYBtwHBAdEB5wEBAhcCIAIZAgYC9AHjAcwBrQGbAaYBzgEDAjUCWwJpAmICVQJHAi4CBwLgAcwB2AH7ARwCKAIcAgEC5AHLAbQBowGlAbwB2wHxAfIB3wHHAbYBswGyAakBmgGMAZIBqwHJAeAB5gHqAfMB/wEDAvgB5wHWAcUBqgGSAY0BngG8AdIB3AHdAdMBvAGcAXgBVwFAAToBPwFIAU8BUgFOAUcBPwE7AUgBYAF0AYIBhgGCAXgBXAEtAQEB7wD8ACABUQF6AYsBhQFxAV0BSwE7ASwBIAELAekAyAC1ALEAtwDBAM8A2wDlAO4A8gDrAN0AzQC7AKwAqQCtAK0AowCLAGsAUwBDAD0AQQBCAEAASwBjAHkAiACLAIIAbABOACwACgD2//D/9f/+//7/+//8/wEABwAJAAMA8P/X/8j/yP/U/+r/BwAlADkAPAAvABkA/P/h/9T/2f/r//f/7f/Y/8L/t/+0/7L/sf+z/7n/wv/M/9b/3P/g/+T/5f/g/9P/wv+3/73/1//9/xYAGAANAP//7v/a/8H/p/+Q/4j/lv+x/9D/5//1/wIACQALAAoA/v/j/8b/t/+5/8r/4f/0/wAACAARABMACwD5/+b/1//N/8P/vf/B/8n/0v/d/+j/7v/y//b//P8FAA8AFgAXABkAHAAbABkAEAACAPb/9////w4AHQAgAB0AGAAUAA4ABgD5/+T/0f/J/8v/1P/g//L/AQAJAAQA+v/y/+//6//i/9f/z//L/8//3//w//f/8v/k/9n/0//M/7//tv+1/7n/xP/U/+b/8v/3//L/4v/L/7L/o/+s/8j/5f/0//L/6P/e/9T/yv+9/7P/sf+2/73/wf/B/8D/x//W/+b/7P/r/+X/4P/j/+X/4v/c/9L/xP+9/8L/yv/O/8v/wv+4/7T/tP+2/7//x//D/7L/nv+W/6D/tv/D/8T/wv/B/8T/yv/M/8T/tv+w/7X/wf/Q/+D/6f/l/9X/wv+2/7L/r/+v/7D/sv+4/8T/0//d/9//2//P/8H/t/+x/63/rv+z/7n/u/+2/7H/sv+x/6//sf++/9L/5f/x//P/6//d/9H/xv+6/7D/rf+x/73/zP/b/+D/2f/K/77/vf/K/+L/+f8GAAMA8//d/8n/u/+5/73/xP/J/87/0//Z/+P/6//u/+v/6f/l/+H/5P/s//X/+P/0/+z/6P/n/+j/6f/m/97/2P/Y/9z/4//s//X//f8DAAYA/v/y/+j/5P/m/+z/+P8IABkAIgAcAAQA3P+3/6f/sf/L/+n/CQAmADgAPAAvABMA8//g/97/5v/q/+z/8f/9/wwAEgAQAAkABQAIAA8AFQAVAA4A/P/e/8P/uP/A/9T/7v8GABcAHQAbABUADAAAAPX/7//z//z/BgAMAA0ACgAHAAcACQAMAAwABQD4/+n/3//b/97/6v/8/w4AGgAeAB8AHwAcABcAEgANAAcAAgD9//f/6f/W/8n/zP/e//X/CgAYAB0AGwAVAAwABAAAAPv/8//r/+n/7v/y//L/7f/u//b/BAAVACcAMgAzADEAJwASAPX/3f/S/9X/4//z////AwAAAP7/AAADAAcADQAXACEAKgAtACcAGQAFAPP/5P/Z/9T/0//Z/+L/7v/5////AgAFAAgABwD///X/7P/m/+T/5//q/+f/5P/j/+T/6P/r/+3/6//n/+X/5//t//f/BAAOABMADgAEAPf/7f/q/+r/7P/w//T/9f/z//D/7//v//H/9//9/wIABgAKAAsACAABAPr/9P/v/+3/7f/u/+7/8P/1//n/+//6//v///8GAA4AEgARAAoAAwD+//z/+v/5//j/9//4//v/AAAFAAoADgAPAA0ACgAIAAkACgAKAAcAAgD9//z//f///wAAAQABAAQABgAHAAUAAQD///3//v8AAAMACAAMAAsABwACAPz/+v/8/wAAAQACAAUACgARABUAFgAVABQAFAAUABIADgAHAAAA/P/6//n/+f/8/wMACQANAA4ACwAJAAcABwAJAAsADAAOAA8ADgAOAA8ADgAPAA8AEQASABIAFAAVABUAEwAOAAoABwAFAAQABwAMABEAEwAXABwAIAAiACEAHgAbABcAFQATABIAEgASABAADwAPABEAFQAaAB0AHwAgACEAIAAfAB0AHAAcABwAHgAfACEAIwAjACUAJgAnACcAJQAjACAAHQAbABoAGwAbABgAFQASABIAEwAUABQAFAASABEADwAOAAsACQAGAAYACAALAA4ADwAQABEAEAAOAAwADAAMAAsADAANAA4ADwAPAA4ADgAOAA4ADAAIAAYABAADAAMABAAFAAYABgAFAAMAAQAAAAEAAwAFAAYABQAEAAIAAAD///z/+f/0/+7/6//r/+3/8P/x//P/9P/0//X/9P/y/+//7v/t/+7/7//w//D/7//t/+v/6//s/+7/8P/w/+//7v/t/+v/6//r/+z/7v/x//P/9v/5//v/+//5//X/8//z//T/9f/0//L/7v/s/+z/6//o/+f/5//p/+v/7v/y//T/9f/1//P/8f/v/+7/7f/q/+f/5P/k/+X/6f/s//D/9f/4//r/+f/4//b/8v/v/+v/6P/m/+X/5v/n/+j/6v/s/+7/7//v/+7/7//v//D/8f/z//X/+P/5//n/+f/4//j/+f/7//7/AAAAAAAA/v/8//r/9//0//L/8v/z//X/+f/8/wAAAgACAAEAAQABAAAA///+//3//P/8//z//P/8//v/+//6//j/9f/1//X/9f/2//f/+P/4//j/+P/5//n/+P/4//n/+f/6//z///8CAAQABQAEAAMAAQAAAAAA/////wAAAgAGAAgACQAIAAcABQADAAEAAAAAAAAAAQADAAQAAwABAAAAAAD///7///////////8AAAMABQAIAAsADQANAAkABgADAAAA/P/5//f/9v/3//j/+v/8//z//P/9//7/AAABAAMABAAEAAIAAAAAAP//AAAAAAAAAQADAAUABwAIAAkACQAKAAwADgAOAAwACQAIAAcABgAFAAYABwAIAAgABwAEAAMAAwAEAAQAAwABAAAAAAD///7//v/+//7///8AAAAAAAAAAAAA///9//7/AAACAAQABAADAAIAAAD+//7///8AAAAAAAAAAAAAAAAAAAEAAgAEAAQABQAEAAIAAAD9//r/+P/4//n/+v/8//3//v///////v//////AAAAAAAA///+//z//P/8//z//f/9//3//f/9//3//v////////////7//P/5//f/9//3//n/+//8//z/+//5//j/+P/3//f/9//5//r//P/9//3//P/8//z//P/9//7//v/+//7///8BAAMABAAEAAQAAgAAAP////8AAAAA/////wAAAgAEAAUABQAFAAQAAwACAAIAAwADAAIAAgACAAEAAQAAAP///v///wAAAAABAAEAAAD//////////wAAAQADAAQABQAFAAQABAADAAMAAwAEAAQAAwADAAMABAAEAAUABgAHAAYABgAGAAYABgAGAAcACAAJAAkACAAHAAYABQAEAAQABAAEAAUABwAKAAsADQANAA4ADwAQAA8ADwAPAA4ADgANAA0ADAAMAAwADAANAA4ADgAOAA4ADgAOAA8AEAAPAA4ADQAMAAwACwAKAAoACQALAAsADAAMAAwACwALAAsACgAJAAgACAAJAAkACQALAAwADQAOAA4ADgANAA0ADQANAA0ADgAOAA8AEQASABIAEwATABIAEAAPAA4ADgANAAwACwAJAAkACQAJAAgACQAJAAkACgAJAAgABwAGAAUABQAFAAUABQAGAAYABgAGAAYABAADAAMAAwADAAMAAwAEAAQABAAEAAMABAAEAAQABAAEAAUABAAEAAQABAAEAAQABAADAAIAAgABAAAAAAD//////v/+////AAAAAP///v/9//7//v/+////AAABAAIAAgABAAAA///9//v/+//8//z//P/8//z//P/9//7////////////+//7//v/+//7//////////v/9//z//P/8//3//v/+//////8AAAAAAQABAAAA///9//v/+v/6//v/+//8//3//v/+//7//v/+//3//f/9//3//P/7//r/+v/5//r/+//8//3//v/+//7//v/+//z//P/7//r/+v/6//r/+v/6//r/+//8//v/+//7//z//P/8//z//P/7//r/+v/6//r/+//6//n/+P/4//f/+P/5//n/+v/6//v//P/8//z//P/7//v/+//7//v/+//7//r/+v/5//n/+P/4//n/+f/5//n/+f/6//v//P/8//z//P/8//z//P/7//v/+//8//z//P/8//3//f/9//z//P/8//z//P/8//z//f/8//z//P/8//z//f/9//z//P/8//z//P/7//v/+v/6//v//P/8//3//v8AAAAAAAABAAEAAAABAAEAAQABAAAAAAAAAAAAAAAAAAEAAQACAAIAAgACAAEAAAAAAAAAAAAAAAEAAgADAAQABAAEAAMAAwACAAEAAQACAAIAAwACAAIAAQACAAIAAwADAAIAAgACAAEAAAD+//3//f/+//7///8AAAAAAQACAAIAAwADAAMAAgABAAEAAAAAAAAAAQABAAEAAQABAAEAAQACAAIAAgACAAIAAgACAAIAAwADAAQABAAEAAMAAwADAAIAAgABAAEAAQABAAAAAAABAAEAAQABAAEAAAAAAAAAAAAAAAAAAQABAAAAAAD/////AAAAAAAAAQABAAIAAgACAAIAAQAAAAAA/////wAAAAAAAAAAAAAAAAAAAAD//////v/+//7//v/+//7//v///////////wAAAAA="
  },
  "cancel": {
    "source": "game/audio/effects/cancel.wav",
    "bytes": 3948,
    "sha256": "d59b933dbe794b9d36f962c8505513f3a85a30a6c2c3e2ed1d6895769d0a2616",
    "license": "CC0-1.0",
    "base64": "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"
  }
};
// Exact shared material sheet; fonts are acquired from the embedded source assets.
// prettier-ignore
const SHARED_THEME_CSS = "/* Shared appearance recipes. Existing screen layout is in @layer legacy so\n   component paint has one authority, independent of a screen's ID selectors.\n   The aliases below are the migration boundary for existing semantic classes;\n   new components should use data-ui-surface / data-ui-action / data-ui-tone. */\n[data-theme-styled='true'] {\n  color-scheme: var(--iw-color-scheme, dark);\n  color: var(--iw-text);\n  background: var(--iw-ink);\n  font-family: var(--iw-font-ui);\n  --ui-shadow: color-mix(in srgb, var(--iw-ink) 78%, black);\n  --ui-hover: color-mix(in srgb, var(--iw-panel-raised) 90%, var(--iw-text));\n  --ui-disabled: var(--iw-muted);\n  --ui-control-border: var(--iw-control-line);\n}\n[data-theme-family] {\n  /* Each presentation owns its finish, including nested Studio specimens.\n     Material paint never leaks from an enclosing theme or accessibility mode. */\n  --ui-panel-finish: none;\n  --ui-control-finish: none;\n  --ui-hover-finish: initial;\n  --ui-selected-finish: initial;\n  --ui-active-finish: none;\n  --ui-inset-finish: none;\n  --ui-toolbar-finish: none;\n  --ui-thumb-finish: none;\n  --ui-inset-depth: initial;\n  --ui-input-hover-depth: initial;\n  --ui-material-travel: none;\n  --ui-loading-rail: 3px;\n  --ui-hover-face: initial;\n  --ui-hover-ink: initial;\n  --ui-hover-frame: initial;\n  --ui-panel-frame: none;\n  --ui-raised-frame: none;\n  --ui-primary-frame: none;\n  --ui-panel-depth: initial;\n  --ui-action-depth: initial;\n  --ui-hover-depth: initial;\n  --ui-pressed-depth: initial;\n  --ui-selected-depth: initial;\n  --ui-gallery-depth: none;\n  --ui-press-travel: none;\n  --ui-scene-motif: none;\n  --ui-scene-motif-size: 48px 48px;\n  --ui-scene-inset: 24px 24px auto auto;\n  --ui-scene-width: min(24vw, 192px);\n  --ui-scene-height: 96px;\n  --ui-scene-repeat: no-repeat;\n  --ui-scene-opacity: 0.18;\n}\n/* Rebind older semantic variables on their owning scope. Authored image, video,\n   Canvas and 3D assets remain in their own renderer; none are filtered/recolored. */\n[data-theme-styled='true'],\n[data-theme-styled='true']\n  :where(\n    body,\n    .field-kit,\n    dialog,\n    .race-screen,\n    .race-shell,\n    .overlay-card,\n    .native-landing,\n    .native-settings,\n    [data-ui-surface]\n  ) {\n  --fk-bg: var(--iw-ink);\n  --fk-panel: var(--iw-panel);\n  --fk-panel-raised: var(--iw-panel-raised);\n  --fk-text: var(--iw-text);\n  --fk-muted: var(--iw-muted);\n  --fk-line: var(--iw-line);\n  --fk-control-line: var(--iw-control-line);\n  --fk-cyan: var(--iw-accent);\n  --fk-amber: var(--iw-amber);\n  --fk-hazard: var(--iw-hazard);\n  --fk-success: var(--iw-safe);\n  --fk-accent: var(--iw-accent);\n  --fk-on-accent: var(--iw-on-accent, var(--iw-ink));\n  --fk-focus: var(--iw-focus, var(--iw-control-line));\n  --fk-font-ui: var(--iw-font-ui);\n  --fk-font-pixel: var(--iw-font-ui);\n  --fk-font-mono: var(--iw-font-mono);\n  --fk-font-display: var(--iw-font-display);\n  --fk-text-body: var(--iw-text-size);\n  --fk-text-control: var(--iw-text-size);\n  --fk-text-secondary: max(14px, calc(var(--iw-text-size) - 2px));\n  --fk-target-size: var(--iw-target);\n  --rl-menu-skin-bg: var(--iw-ink);\n  --rl-menu-skin-panel: var(--iw-panel);\n  --rl-menu-skin-panel-raised: var(--iw-panel-raised);\n  --rl-menu-skin-text: var(--iw-text);\n  --rl-menu-skin-muted: var(--iw-muted);\n  --rl-menu-skin-line: var(--iw-line);\n  --rl-menu-skin-control-line: var(--iw-control-line);\n  --rl-menu-skin-cyan: var(--iw-accent);\n  --rl-menu-skin-amber: var(--iw-amber);\n  --rl-menu-skin-hazard: var(--iw-hazard);\n  --rl-menu-skin-decorative: var(--iw-line);\n  --native-ink: var(--iw-ink);\n  --native-panel: var(--iw-panel);\n  --native-surface: var(--iw-panel-raised);\n  --paper: var(--iw-ink);\n  --ink: var(--iw-text);\n  --bg: var(--iw-ink);\n  --panel: var(--iw-panel);\n  --panel-raised: var(--iw-panel-raised);\n  --text: var(--iw-text);\n  --muted: var(--iw-muted);\n  --line: var(--iw-line);\n  --accent: var(--iw-accent);\n  --safe: var(--iw-safe);\n  --danger: var(--iw-hazard);\n  --sky: var(--iw-accent);\n  --sun: var(--iw-amber);\n  --mint: var(--iw-safe);\n}\n[data-theme-styled='true']\n  :where(\n    body,\n    .access-gate,\n    .launch-screen,\n    .native-landing,\n    .native-mission-library,\n    .race-screen,\n    .race-shell,\n    #coop-menu,\n    [data-ui-surface='page']\n  ) {\n  color: var(--iw-text);\n  background: var(--iw-ink);\n  font-family: var(--iw-font-ui);\n  color-scheme: inherit;\n}\n[data-theme-styled='true']\n  :where(p, li, dd, dt, label, legend, summary, h1, h2, h3, h4, h5, h6, strong, b, em, span) {\n  color: inherit;\n  text-shadow: none;\n}\n[data-theme-styled='true'] :where(h1, .display-heading, .native-game-title) {\n  color: var(--iw-text);\n  font-family: var(--iw-font-display);\n  letter-spacing: 0.02em;\n}\n[data-theme-styled='true'] :where(h2, h3, h4, legend, label, summary) {\n  font-family: var(--iw-font-ui);\n}\n[data-theme-styled='true'] :where(a) {\n  color: var(--iw-link, var(--iw-accent));\n  text-underline-offset: 0.2em;\n}\n[data-theme-styled='true']\n  :where(\n    .micro-note,\n    .muted,\n    small,\n    .help,\n    .description,\n    .quiet,\n    .smallprint,\n    .race-footnote,\n    .race-menu-status,\n    .soundtrack-advanced-description,\n    .native-menu-footer,\n    #demo-status,\n    #demo-picture-note,\n    #demo-audio-artist,\n    .demo-audio-status,\n    .sidebar-note,\n    [data-ui-tone='muted']\n  ) {\n  color: var(--iw-muted);\n}\n[data-theme-styled='true']\n  :where(.eyebrow, .launch-kicker, .access-gate-eyebrow, [data-ui-tone='accent']) {\n  color: var(--iw-accent);\n}\n[data-theme-styled='true'] :where(kbd, code, pre, .telemetry, .hud-value, .metric-value) {\n  font-family: var(--iw-font-mono);\n}\n\n/* Reading surfaces receive a bounded material finish over semantic colors.\n   Asset frames supply the edges; their opaque nine-slice centers are not used. */\n[data-theme-styled='true']\n  :where(\n    dialog,\n    .overlay-card,\n    .panel,\n    .field-kit-panel,\n    .inspection-card,\n    .mission-detail,\n    .settings-group,\n    .inspector,\n    .tool-panel,\n    .editor-panel,\n    .launch-card,\n    .access-gate-card,\n    .hud-card,\n    .sim-panel,\n    .workshop-card,\n    .iw-panel,\n    .studio-panel,\n    .sidebar,\n    .creator-inspector,\n    .controller-settings-section,\n    .settings-section,\n    .settings-card,\n    .info-card,\n    .choice-card,\n    .mission-card,\n    .campaign-card,\n    .library-card,\n    .community-card,\n    .candidate-entry,\n    .version-control,\n    .pack-instructions,\n    .content-card,\n    .pack-card,\n    .profile-card,\n    .recovery-card,\n    .download-card,\n    .story-card,\n    .flight-dialog,\n    .soundtrack-section,\n    .soundtrack-now-card,\n    .soundtrack-listen-card,\n    .soundtrack-online-card,\n    .soundtrack-settings-style-card,\n    .soundtrack-source-row,\n    .first-flight-card,\n    .school-lesson-card,\n    .school-after,\n    .coach-card,\n    .result-panel,\n    .sim-academy #complete,\n    .sim-academy #fallback,\n    .optional-world-card,\n    .team-level-card,\n    .team-review-card,\n    .creator-media-card,\n    .creator-mission-review-card,\n    .batch-card,\n    .watch,\n    [role='tooltip'],\n    [data-component='panel'],\n    [data-ui-surface='panel'],\n    [data-ui-surface='dialog']\n  ) {\n  color: var(--iw-text);\n  font-family: var(--iw-font-ui);\n  background: var(--ui-panel-finish, none), var(--iw-panel);\n  border: 2px solid var(--iw-line);\n  border-image: var(--ui-panel-frame, none);\n  border-radius: 0;\n  box-shadow: var(\n    --ui-panel-depth,\n    inset 0 1px 0 color-mix(in srgb, var(--iw-text) 8%, transparent),\n    0 2px 0 var(--ui-shadow),\n    0 8px 18px #0002\n  );\n}\n[data-theme-styled='true']\n  :where(\n    .masthead,\n    .shell-bar,\n    body > header,\n    .toolbar,\n    .studio-toolbar,\n    .authoring-input-rail,\n    .authoring-section-menu,\n    .sim-toolbar,\n    .hud,\n    .telemetry,\n    .workspace-bar,\n    .studio-header,\n    .flight-controls,\n    .flight-immersive-bar,\n    .sim-drone-response,\n    .flight-instruments,\n    .flight-coaching,\n    .coaching,\n    .sim-menu-hint,\n    .coach-heading,\n    .coach-lab-toolbar,\n    .coach-lab-telemetry,\n    .coach-drone-figure figcaption,\n    .handheld-flight-identity,\n    .sim-worlds #flight-objective,\n    .sim-worlds .flight-brief p,\n    .beginner-coach[data-stage='live'] :is(.coach-target, .coach-explain),\n    .settings-heading,\n    .dialog-header,\n    .dialog-footer,\n    .field-kit-settings-tabs,\n    .soundtrack-footer,\n    #soundtrack-operation,\n    .optional-worlds-top,\n    .race-heading,\n    .reading-toolbar,\n    .shell-dialog-heading,\n    .demo-panel,\n    .demo-notes,\n    .demo-transport,\n    #demo-audio,\n    [data-ui-surface='toolbar']\n  ) {\n  color: var(--iw-text);\n  background: var(--ui-toolbar-finish, none), var(--iw-panel);\n  border-color: var(--iw-line);\n  border-image: none;\n  text-shadow: none;\n}\n[data-theme-styled='true']\n  :where(\n    fieldset,\n    details,\n    .drop,\n    .drop-zone,\n    .setting-row,\n    .settings-row,\n    .settings-preset,\n    .device-card,\n    .controller-card,\n    .controller-mapping,\n    .range-field,\n    .settings-metric,\n    .settings-note,\n    .settings-warning,\n    .mission-brief,\n    .enemy-guide,\n    .soundtrack-choice,\n    .soundtrack-advanced,\n    .soundtrack-online-results,\n    .school-flight-map,\n    .replay-controls,\n    .radio-device-card,\n    .radio-monitor,\n    .coach-tip,\n    .checkpoint,\n    .encounter-cue,\n    .demo-board,\n    .demo-settings,\n    .seat,\n    .control-card,\n    .batch-card-media,\n    .creator-media-poster,\n    .creator-poster-option,\n    #mission-brief-reading,\n    [data-ui-surface='inset']\n  ) {\n  color: var(--iw-text);\n  background: var(--ui-inset-finish, none), var(--iw-ink);\n  border-color: var(--iw-line);\n  border-image: none;\n  border-radius: 0;\n  box-shadow: var(--ui-inset-depth, none);\n}\n[data-theme-styled='true'] :where(table, .asset-grid, .inventory-grid, [data-ui-surface='table']) {\n  color: var(--iw-text);\n  background: var(--ui-panel-finish, none), var(--iw-panel);\n}\n[data-theme-styled='true'] :where(th, td, hr) {\n  color: inherit;\n  border-color: var(--iw-line);\n}\n[data-theme-styled='true'] :where(th, thead) {\n  background: var(--iw-panel-raised);\n}\n[data-theme-styled='true']\n  :where(tr[aria-selected='true'], [data-ui-surface='slot'][aria-selected='true']) {\n  color: var(--iw-on-selection, var(--iw-text));\n  background: var(--iw-selection, var(--iw-panel-raised));\n  box-shadow: inset 3px 0 var(--iw-focus, var(--iw-accent));\n}\n\n/* Each action chooses paired local roles; one painter handles every state. */\n[data-theme-styled='true']\n  :where(\n    button,\n    .button,\n    .button-link,\n    #profile-recovery-root a,\n    .action,\n    .community-entry,\n    [role='button'],\n    [data-ui-action],\n    .launch-action,\n    .file-button,\n    .native-menu-actions > a,\n    .game-mode-choice > a\n  ) {\n  --ui-action-status-depth: 0 0 0 0 transparent;\n  --ui-action-fill: var(--iw-button-default-background, var(--iw-panel-raised));\n  --ui-action-ink: var(--iw-button-default-foreground, var(--iw-text));\n  --ui-action-hover-fill: var(\n    --ui-hover-face,\n    var(--iw-button-hover-background, var(--iw-panel-raised))\n  );\n  --ui-action-hover-ink: var(--ui-hover-ink, var(--iw-button-hover-foreground, var(--iw-text)));\n  --ui-action-pressed-fill: var(--iw-button-pressed-background, var(--iw-selection));\n  --ui-action-pressed-ink: var(--iw-button-pressed-foreground, var(--iw-on-selection));\n  --ui-action-edge: var(--iw-control-line);\n  --ui-action-frame: var(--ui-raised-frame, none);\n  --ui-action-hover-frame: var(--ui-hover-frame, var(--ui-raised-frame, none));\n  --ui-action-pressed-frame: var(--ui-primary-frame, none);\n  color: var(--ui-action-ink);\n  background: var(--ui-control-finish, none), var(--ui-action-fill);\n  border: 2px solid var(--ui-action-edge);\n  border-image: var(--ui-action-frame, none);\n  border-radius: 0;\n  min-height: var(--iw-target);\n  box-sizing: border-box;\n  padding: 8px 14px;\n  font-family: var(--iw-font-ui);\n  font-size: var(--iw-text-size);\n  font-weight: 600;\n  line-height: 1.35;\n  text-shadow: none;\n  text-decoration: none;\n  box-shadow:\n    var(--ui-action-status-depth, 0 0 0 0 transparent),\n    var(\n      --ui-action-depth,\n      inset 0 1px 0 color-mix(in srgb, var(--ui-action-ink) 12%, transparent),\n      inset 0 -1px 0 #0002,\n      0 2px 0 var(--ui-shadow)\n    );\n  cursor: pointer;\n}\n[data-theme-styled='true']\n  :where(\n    .primary,\n    .primary-action,\n    .field-kit-primary,\n    .race-primary,\n    .soundtrack-primary-action,\n    .community-entry,\n    [data-ui-action='primary']\n  ) {\n  --ui-action-fill: var(--iw-primary-default-background, var(--iw-accent));\n  --ui-action-ink: var(--iw-primary-default-foreground, var(--iw-on-accent, var(--iw-ink)));\n  --ui-action-hover-fill: var(--iw-primary-hover-background, var(--iw-accent));\n  --ui-action-hover-ink: var(--iw-primary-hover-foreground, var(--iw-on-accent, var(--iw-ink)));\n  --ui-action-pressed-fill: var(--iw-primary-pressed-background, var(--iw-selection));\n  --ui-action-pressed-ink: var(--iw-primary-pressed-foreground, var(--iw-on-selection));\n  --ui-action-edge: var(--iw-accent);\n  --ui-action-frame: var(--ui-primary-frame, none);\n  --ui-action-hover-frame: var(--ui-primary-frame, none);\n}\n[data-theme-styled='true'] :where(.danger, .danger-action, [data-ui-action='danger']) {\n  --ui-action-fill: var(--iw-danger-default-background, var(--iw-hazard));\n  --ui-action-ink: var(--iw-danger-default-foreground, var(--iw-on-hazard));\n  --ui-action-hover-fill: var(--iw-danger-hover-background, var(--iw-hazard));\n  --ui-action-hover-ink: var(--iw-danger-hover-foreground, var(--iw-on-hazard));\n  --ui-action-pressed-fill: var(--iw-danger-pressed-background, var(--iw-hazard));\n  --ui-action-pressed-ink: var(--iw-danger-pressed-foreground, var(--iw-on-hazard));\n  --ui-action-edge: var(--iw-hazard);\n  --ui-action-frame: none;\n  --ui-action-hover-frame: none;\n  --ui-action-pressed-frame: none;\n}\n[data-theme-styled='true']\n  :where(\n    button,\n    .button,\n    .button-link,\n    #profile-recovery-root a,\n    .action,\n    .community-entry,\n    [role='button'],\n    [data-ui-action],\n    .launch-action,\n    .file-button,\n    .native-menu-actions > a,\n    .game-mode-choice > a\n  ):is(:hover, [data-state='hover']):not(:disabled, [aria-disabled='true']) {\n  background: var(--ui-hover-finish, var(--ui-control-finish, none)), var(--ui-action-hover-fill);\n  border-image: var(--ui-action-hover-frame, none);\n  color: var(--ui-action-hover-ink);\n  box-shadow:\n    var(--ui-action-status-depth, 0 0 0 0 transparent),\n    var(--ui-hover-depth, inset 0 0 0 1px var(--ui-action-edge), 0 2px 0 var(--ui-shadow));\n}\n[data-theme-styled='true']\n  :where(\n    button,\n    .button,\n    .button-link,\n    #profile-recovery-root a,\n    .action,\n    .community-entry,\n    [role='button'],\n    [data-ui-action],\n    .launch-action,\n    .file-button,\n    .native-menu-actions > a,\n    .game-mode-choice > a\n  ):is(:active, [data-state='pressed']):not(:disabled, [aria-disabled='true']) {\n  background: var(--ui-active-finish, none), var(--ui-action-pressed-fill);\n  color: var(--ui-action-pressed-ink);\n  border-image: var(--ui-action-pressed-frame, none);\n  box-shadow:\n    var(--ui-action-status-depth, 0 0 0 0 transparent),\n    var(--ui-pressed-depth, inset 0 2px 3px #0005);\n}\n[data-theme-styled='true']\n  :where(button, .button, [role='button'], a, [role='tab']):is(\n    [aria-pressed='true'],\n    [aria-selected='true'],\n    [aria-current]:where(:not([aria-current='false'])),\n    .selected,\n    .active-tab\n  ) {\n  --ui-action-fill: var(--iw-selection, var(--iw-panel-raised));\n  --ui-action-ink: var(--iw-on-selection, var(--iw-text));\n  --ui-action-hover-fill: var(--ui-action-fill);\n  --ui-action-hover-ink: var(--ui-action-ink);\n  color: var(--ui-action-ink);\n  background: var(--ui-selected-finish, var(--ui-active-finish, none)), var(--ui-action-fill);\n  border-color: var(--iw-focus, var(--iw-accent));\n  border-image: var(--ui-primary-frame, none);\n  box-shadow:\n    var(--ui-action-status-depth, 0 0 0 0 transparent),\n    var(--ui-selected-depth, inset 3px 0 var(--iw-focus, var(--iw-accent)));\n  text-decoration-thickness: 2px;\n}\n[data-theme-styled='true']\n  :where(button, .button, [role='button'], a, [role='tab']):is(\n    [aria-pressed='true'],\n    [aria-selected='true'],\n    [aria-current]:where(:not([aria-current='false'])),\n    .selected,\n    .active-tab\n  ):is(:active, [data-state='pressed']):not(:disabled, [aria-disabled='true']) {\n  background: var(--ui-active-finish, none), var(--ui-action-fill);\n  box-shadow:\n    var(--ui-action-status-depth, 0 0 0 0 transparent),\n    var(--ui-pressed-depth, inset 0 2px 3px #0005);\n}\n/* Busy paint is a stable progress rail, not a second label or a spinning\n   pseudo-element that could collide with a control's existing icon. */\n[data-theme-styled='true']\n  :where(button, .button, [role='button'], [data-ui-action])[aria-busy='true']:not(\n    :disabled,\n    [aria-disabled='true']\n  ) {\n  --ui-action-status-depth: inset 0 calc(-1 * var(--ui-loading-rail)) 0 currentColor;\n  cursor: progress;\n}\n[data-theme-styled='true']\n  :where(\n    button,\n    input,\n    select,\n    textarea,\n    a,\n    .button,\n    .button-link,\n    [role='button'],\n    [role='tab'],\n    [data-ui-action]\n  ):is(:disabled, [aria-disabled='true']) {\n  color: var(--iw-muted);\n  background: var(--iw-panel);\n  border-color: var(--iw-line);\n  border-style: dashed;\n  border-image: none;\n  opacity: 1;\n  cursor: not-allowed;\n  box-shadow: none;\n}\n[data-theme-styled='true']\n  :where(button, .button, [role='button'])\n  :where(span, strong, em, small) {\n  color: inherit;\n}\n\n/* Native value controls retain browser semantics and keyboard operation. */\n[data-theme-styled='true'] :where(input, select, textarea) {\n  color: var(--iw-input-text, var(--iw-text));\n  background: var(--ui-inset-finish, none), var(--iw-input, var(--iw-ink));\n  border: 2px solid var(--iw-control-line);\n  border-image: none;\n  border-radius: 0;\n  font-family: var(--iw-font-ui);\n  font-size: var(--iw-text-size);\n  accent-color: var(--iw-accent);\n  box-shadow: var(--ui-inset-depth, inset 0 1px 2px #0003);\n}\n[data-theme-styled='true']\n  :where(\n    select,\n    textarea,\n    input:not([type='checkbox'], [type='radio'], [type='range'], [type='color'])\n  ) {\n  min-height: var(--iw-target);\n  box-sizing: border-box;\n  padding: 6px 10px;\n}\n[data-theme-styled='true'] :where(input, textarea)::placeholder {\n  color: var(--iw-muted);\n  opacity: 1;\n}\n[data-theme-styled='true'] :where(option, optgroup) {\n  color: var(--iw-input-text, var(--iw-text));\n  background: var(--iw-input, var(--iw-ink));\n}\n[data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio']) {\n  appearance: none;\n  display: inline-grid;\n  place-content: center;\n  inline-size: 22px;\n  block-size: 22px;\n  min-inline-size: 22px;\n  min-block-size: 22px;\n  flex: 0 0 22px;\n  padding: 0;\n  vertical-align: middle;\n  background: var(--ui-inset-finish, none), var(--iw-ink);\n  border: 2px solid var(--iw-control-line);\n  border-image: none;\n  box-shadow: var(--ui-inset-depth, none);\n}\n[data-theme-styled='true'] input[type='radio'] {\n  border-radius: 50%;\n}\n[data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio'])::before {\n  content: '';\n  display: block;\n  width: 12px;\n  height: 12px;\n  background: var(--iw-on-accent, var(--iw-ink));\n  transform: scale(0);\n  clip-path: polygon(0 43%, 17% 26%, 40% 51%, 83% 4%, 100% 20%, 41% 87%);\n}\n[data-theme-styled='true'] input[type='radio']::before {\n  width: 10px;\n  height: 10px;\n  border-radius: 50%;\n  clip-path: none;\n}\n[data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio']):checked {\n  background: var(--ui-active-finish, none), var(--iw-accent);\n  border-color: var(--iw-accent);\n  outline: none;\n  box-shadow: var(--ui-inset-depth, none);\n}\n[data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio']):checked::before {\n  transform: scale(1);\n}\n[data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio']):disabled {\n  background: var(--ui-panel-finish, none), var(--iw-panel);\n  border-color: var(--iw-muted);\n  border-style: dashed;\n  cursor: not-allowed;\n}\n[data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio']):disabled::before {\n  background: var(--iw-muted);\n}\n[data-theme-styled='true'] input[type='checkbox']:indeterminate::before {\n  transform: scale(1);\n  clip-path: inset(40% 0);\n  background: var(--iw-accent);\n}\n[data-theme-styled='true'] label:has(> input:is([type='checkbox'], [type='radio'])) {\n  min-height: var(--iw-target);\n  align-items: center;\n  cursor: pointer;\n}\n[data-theme-styled='true'] input[type='range'] {\n  appearance: none;\n  min-height: var(--iw-target);\n  padding: 0;\n  background: transparent;\n  border: 0;\n  box-shadow: none;\n  cursor: pointer;\n}\n[data-theme-styled='true'] input[type='range']::-webkit-slider-runnable-track {\n  height: 6px;\n  border: 1px solid var(--iw-control-line);\n  background: var(--iw-ink);\n  border-radius: 0;\n}\n[data-theme-styled='true'] input[type='range']::-moz-range-track {\n  height: 4px;\n  border: 1px solid var(--iw-control-line);\n  background: var(--iw-ink);\n  border-radius: 0;\n}\n[data-theme-styled='true'] input[type='range']::-webkit-slider-thumb {\n  appearance: none;\n  width: 24px;\n  height: 24px;\n  margin-top: -10px;\n  background: var(--ui-thumb-finish, none), var(--iw-accent);\n  border: 2px solid var(--iw-on-accent, var(--iw-ink));\n  border-radius: 0;\n  box-shadow: 0 0 0 1px var(--iw-control-line);\n}\n[data-theme-styled='true'] input[type='range']::-moz-range-thumb {\n  width: 20px;\n  height: 20px;\n  background: var(--ui-thumb-finish, none), var(--iw-accent);\n  border: 2px solid var(--iw-on-accent, var(--iw-ink));\n  border-radius: 0;\n  box-shadow: 0 0 0 1px var(--iw-control-line);\n}\n[data-theme-styled='true'] input[type='range']:disabled {\n  cursor: not-allowed;\n  opacity: 0.65;\n}\n[data-theme-styled='true'] :where(progress, meter) {\n  accent-color: var(--iw-accent);\n  color: var(--iw-accent);\n  background: var(--iw-ink);\n  border: 1px solid var(--iw-control-line);\n  border-image: none;\n  border-radius: 0;\n}\n[data-theme-styled='true'] progress::-webkit-progress-bar {\n  background: var(--iw-ink);\n}\n[data-theme-styled='true'] progress::-webkit-progress-value {\n  background: var(--ui-active-finish, none), var(--iw-accent);\n}\n[data-theme-styled='true'] progress::-moz-progress-bar {\n  background: var(--ui-active-finish, none), var(--iw-accent);\n}\n[data-theme-styled='true'] :where(*) {\n  scrollbar-color: var(--iw-control-line) var(--iw-ink);\n}\n[data-theme-styled='true'] ::-webkit-scrollbar-thumb {\n  background: var(--iw-control-line);\n  border: 2px solid var(--iw-ink);\n}\n[data-theme-styled='true'] ::-webkit-scrollbar-track {\n  background: var(--iw-ink);\n}\n\n/* Native controls share the same material authority as action buttons.\n   Errors mark the well; the entered value keeps its readable text pair. */\n[data-theme-styled='true']\n  :where(\n    select,\n    textarea,\n    input:not([type='range'], [type='checkbox'], [type='radio'], [type='color'])\n  ):is(:hover, [data-state='hover']):not(:disabled, [aria-disabled='true']) {\n  border-color: var(--iw-focus);\n  box-shadow: var(\n    --ui-input-hover-depth,\n    var(--ui-inset-depth, inset 0 0 0 1px var(--iw-control-line))\n  );\n}\n[data-theme-styled='true']\n  :where(input, select, textarea)[aria-invalid='true']:not(:disabled, [aria-disabled='true']) {\n  color: var(--iw-input-text, var(--iw-text));\n  border-color: var(--iw-hazard);\n  box-shadow:\n    inset 3px 0 0 var(--iw-hazard),\n    var(--ui-inset-depth, 0 0 0 0 transparent);\n}\n[data-theme-styled='true']\n  :where(input, select, textarea)[data-ui-validation='success']:not(\n    [aria-invalid='true'],\n    :disabled,\n    [aria-disabled='true']\n  ) {\n  border-color: var(--iw-safe);\n  box-shadow:\n    inset 3px 0 0 var(--iw-safe),\n    var(--ui-inset-depth, 0 0 0 0 transparent);\n}\n[data-theme-styled='true']\n  :where(input[type='checkbox'], input[type='radio']):is(:hover, [data-state='hover']):not(\n    :disabled,\n    [aria-disabled='true'],\n    [aria-invalid='true'],\n    [data-ui-validation='success']\n  ) {\n  border-color: var(--iw-focus);\n  box-shadow: var(--ui-input-hover-depth, var(--ui-inset-depth, none));\n}\n[data-theme-styled='true'] input[type='range']::-webkit-slider-runnable-track {\n  background: var(--ui-inset-finish, none), var(--iw-ink);\n  box-shadow: var(--ui-inset-depth, none);\n}\n[data-theme-styled='true'] input[type='range']::-moz-range-track {\n  background: var(--ui-inset-finish, none), var(--iw-ink);\n  box-shadow: var(--ui-inset-depth, none);\n}\n[data-theme-styled='true']\n  input[type='range']:is(:hover, :focus-visible, [data-state='hover'])::-webkit-slider-thumb {\n  box-shadow:\n    0 0 0 2px var(--iw-focus),\n    var(--ui-hover-depth, 0 0 0 0 transparent);\n}\n[data-theme-styled='true']\n  input[type='range']:is(:hover, :focus-visible, [data-state='hover'])::-moz-range-thumb {\n  box-shadow:\n    0 0 0 2px var(--iw-focus),\n    var(--ui-hover-depth, 0 0 0 0 transparent);\n}\n[data-theme-styled='true'] input[type='range']:disabled {\n  opacity: 1;\n}\n[data-theme-styled='true'] input[type='range']:disabled::-webkit-slider-thumb {\n  background: var(--iw-muted);\n  border: 2px dashed var(--iw-panel);\n  box-shadow: 0 0 0 1px var(--iw-line);\n}\n[data-theme-styled='true'] input[type='range']:disabled::-moz-range-thumb {\n  background: var(--iw-muted);\n  border: 2px dashed var(--iw-panel);\n  box-shadow: 0 0 0 1px var(--iw-line);\n}\n\n/* Compiled icon silhouettes are reusable geometry, never a fixed cyan pigment. */\n[data-theme-styled='true'] [data-presentation-icon]:not([data-menu-icon])::before {\n  color: inherit;\n  content: '';\n  display: inline-block;\n  inline-size: 24px;\n  block-size: 24px;\n  flex: 0 0 24px;\n  background: currentColor;\n  mask: var(--fk-current-icon, linear-gradient(transparent, transparent)) center / contain no-repeat;\n  -webkit-mask: var(--fk-current-icon, linear-gradient(transparent, transparent)) center / contain\n    no-repeat;\n  clip-path: none;\n  image-rendering: pixelated;\n}\n[data-theme-styled='true']\n  :where([data-presentation-control], [data-presentation-hud], [data-presentation-reward])::before {\n  background: currentColor;\n  color: inherit;\n  mask: var(--fk-current-glyph, linear-gradient(transparent, transparent)) center / contain\n    no-repeat;\n  -webkit-mask: var(--fk-current-glyph, linear-gradient(transparent, transparent)) center / contain\n    no-repeat;\n}\n[data-theme-styled='true'] :where([data-menu-icon])::before {\n  background: currentColor;\n  mask: var(--native-menu-icon, linear-gradient(transparent, transparent)) center / contain\n    no-repeat;\n  -webkit-mask: var(--native-menu-icon, linear-gradient(transparent, transparent)) center / contain\n    no-repeat;\n}\n[data-theme-styled='true'] :where(.meter > span, .launch-signal i) {\n  background: var(--iw-accent);\n}\n[data-theme-styled='true'] :where(.meter, [role='progressbar']) {\n  color: var(--iw-text);\n  background: var(--iw-ink);\n  border-color: var(--iw-control-line);\n  border-image: none;\n}\n\n/* Focus and state cues retain a shape in every palette. */\n[data-theme-styled='true'] :is(:focus-visible, .controller-focus, [data-state='focus']) {\n  outline: 3px solid var(--iw-focus, var(--iw-control-line));\n  outline-offset: 3px;\n  scroll-margin: 12px;\n}\n[data-theme-styled='true']\n  :where([aria-invalid='true']:not(input, select, textarea), .error, [data-ui-tone='danger']) {\n  color: var(--iw-hazard);\n  border-color: var(--iw-hazard);\n  border-image: none;\n}\n[data-theme-styled='true'] :where([data-ui-tone='success'], .success) {\n  color: var(--iw-safe);\n}\n[data-theme-styled='true'] :where([data-ui-tone='warning'], .warning) {\n  color: var(--iw-amber);\n}\n[data-theme-styled='true'] ::selection {\n  color: var(--iw-on-selection, var(--iw-ink));\n  background: var(--iw-selection, var(--iw-accent));\n}\n[data-theme-styled='true'] :where(dialog)::backdrop {\n  background: color-mix(in srgb, var(--iw-ink) 78%, transparent);\n}\n\n/* Source art stays intact; only its reading veil follows the interface. */\n[data-theme-styled='true'] .menu-scene::after {\n  background:\n    linear-gradient(\n      90deg,\n      color-mix(in srgb, var(--iw-ink) 94%, transparent),\n      color-mix(in srgb, var(--iw-ink) 75%, transparent) 28%,\n      color-mix(in srgb, var(--iw-ink) 22%, transparent) 63%,\n      transparent\n    ),\n    linear-gradient(0deg, color-mix(in srgb, var(--iw-ink) 65%, transparent), transparent 30%);\n}\n[data-theme-styled='true'] .menu-scene {\n  --scene-ink: var(--iw-ink);\n  --scene-accent: var(--iw-panel-raised);\n}\n[data-theme-styled='true'] :where(.menu-ornament, .menu-scene-decoration) {\n  color: var(--iw-line);\n}\n[data-theme-texture='off'] :where(.menu-ornament, .menu-scene-decoration, .menu-retune-layer) {\n  display: none;\n}\n/* Composed action shadows need a transparent zero, not `none`: a shadow\n   list containing `none` is invalid and would also remove semantic busy rails. */\n[data-theme-surface='flat'] {\n  --ui-panel-frame: none;\n  --ui-raised-frame: none;\n  --ui-primary-frame: none;\n  --ui-panel-depth: none;\n  --ui-action-depth: 0 0 0 0 transparent;\n  --ui-hover-depth: 0 0 0 0 transparent;\n  --ui-pressed-depth: 0 0 0 0 transparent;\n  --ui-selected-depth: 0 0 0 0 transparent;\n  --ui-gallery-depth: none;\n}\n[data-theme-hud='opaque']\n  :where(\n    .hud,\n    .hud-card,\n    .hud-panel,\n    .telemetry,\n    .sim-hud,\n    .flight-hud,\n    .flight-instruments,\n    .flight-coaching,\n    .flight-brief p,\n    .scene-heading,\n    #hud,\n    [data-hud]\n  ) {\n  background: var(--iw-ink);\n  color: var(--iw-text);\n  text-shadow: none;\n  backdrop-filter: none;\n  opacity: 1;\n}\n[data-theme-motion='reduced']\n  :where(\n    .menu-ornament,\n    .edition-propeller,\n    .theme-decoration,\n    .menu-scene-decoration,\n    .operation-status-signal i,\n    .win-picture-caption\n  ) {\n  animation: none;\n  transition: none;\n  transform: none;\n}\n[data-theme-motion='reduced'] .menu-retune-layer {\n  display: none;\n}\n[data-theme-text-size='large']:not([data-interface-theme='legacy'])\n  :where(p, label, button, select, input, textarea, .micro-note) {\n  font-size: max(18px, 1em);\n}\n\n.theme-family-controls {\n  display: grid;\n  gap: 10px;\n  margin-block: 16px;\n  padding-block: 12px;\n  border-block: 1px solid var(--fk-line, #737c69);\n}\n.theme-family-controls > h4 {\n  margin: 2px 0 0;\n}\n.theme-family-controls label {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  justify-content: space-between;\n}\n.theme-family-controls label:has(> input[type='checkbox']) {\n  justify-content: flex-start;\n  min-height: var(--iw-target, 44px);\n}\n.theme-family-controls select {\n  max-width: 100%;\n}\n.theme-family-controls [role='status']:empty {\n  display: none;\n}\n.sim-appearance-controls {\n  grid-column: 1 / -1;\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px 16px;\n  min-width: 0;\n  max-width: 100%;\n}\n.sim-appearance-controls label {\n  display: grid;\n  gap: 6px;\n  min-width: 0;\n  max-width: 100%;\n}\n.sim-appearance-controls select {\n  min-width: 0;\n  max-width: 100%;\n}\n.sim-appearance-controls [role='status'] {\n  flex-basis: 100%;\n}\n.sim-worlds .flight-controls > .sim-appearance-controls {\n  flex: 1 0 100%;\n  box-sizing: border-box;\n  margin-inline: 0;\n}\n[data-theme-styled='true'] .sim-worlds .flight-dialog > header {\n  z-index: 10;\n  background: var(--ui-panel-finish, none), var(--iw-panel);\n  box-shadow: 0 0 0 8px var(--iw-panel);\n}\n@media (pointer: coarse) {\n  [data-theme-density='studio'] {\n    --iw-target: 44px;\n  }\n}\n@media (orientation: portrait) {\n  [data-theme-styled='true'] .menu-scene::after {\n    background: linear-gradient(\n      0deg,\n      color-mix(in srgb, var(--iw-ink) 94%, transparent),\n      color-mix(in srgb, var(--iw-ink) 73%, transparent) 35%,\n      color-mix(in srgb, var(--iw-ink) 23%, transparent) 80%\n    );\n  }\n}\n@media (forced-colors: active) {\n  [data-theme-family][data-theme-material] {\n    --ui-panel-finish: none;\n    --ui-control-finish: none;\n    --ui-hover-finish: none;\n    --ui-selected-finish: none;\n    --ui-active-finish: none;\n    --ui-inset-finish: none;\n    --ui-toolbar-finish: none;\n    --ui-thumb-finish: none;\n    --ui-scene-motif: none;\n  }\n  [data-theme-styled='true']\n    :where(button, .button, input, select, textarea, dialog, .panel, [data-ui-surface]) {\n    border-image: none;\n    box-shadow: none;\n    border-color: ButtonText;\n    forced-color-adjust: auto;\n  }\n  [data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio']) {\n    appearance: auto;\n  }\n  [data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio'])::before {\n    display: none;\n  }\n  [data-theme-styled='true'] :is(:focus-visible, .controller-focus) {\n    outline-color: Highlight;\n  }\n}\n\n/* A filled raster swaps atomically. Interpolating its label separately can\n   briefly create dark-on-dark text while a selected tab changes state. */\n[data-theme-styled='true']\n  :where(button, .button, [role='button'], .native-menu-actions > a, .game-mode-choice > a) {\n  transition:\n    box-shadow 100ms ease,\n    outline-color 100ms ease,\n    translate 70ms ease-out;\n}\n[data-theme-styled='true']\n  :where(button, .button, [role='button'], .native-menu-actions > a, .game-mode-choice > a):is(\n    :active,\n    [data-state='pressed']\n  ):not(:disabled, [aria-disabled='true']) {\n  translate: var(--ui-press-travel);\n}\n/* The game's motion preference applies even when the operating system allows\n   animation. Keep this override after the common action transition recipe. */\n[data-theme-motion='reduced']\n  :where(button, .button, [role='button'], .native-menu-actions > a, .game-mode-choice > a) {\n  transition: none;\n  translate: none;\n}\n[data-theme-styled='true'] label:has(> input:is([type='checkbox'], [type='radio'])) {\n  color: var(--iw-text);\n  background-color: var(--iw-panel-raised);\n  border-color: var(--iw-line);\n  border-image: none;\n  border-radius: 0;\n}\n.theme-gallery {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));\n  gap: 8px;\n}\n.theme-gallery .theme-preview-card {\n  display: grid;\n  grid-template-columns: 1fr;\n  gap: 5px;\n  align-content: start;\n  min-width: 0;\n  text-align: left;\n  min-height: var(--iw-target, 44px);\n  padding: 8px 10px 9px;\n  border-image: var(--ui-raised-frame, none);\n  background: var(--ui-control-finish, none), var(--iw-panel, var(--fk-panel));\n  color: var(--iw-text, var(--fk-text));\n  box-shadow: var(--ui-gallery-depth, none);\n}\n.theme-preview-swatches {\n  display: grid;\n  grid-template-columns: 2fr 2fr 1fr 1fr;\n  gap: 0;\n  overflow: hidden;\n  border: 1px solid var(--iw-control-line, var(--fk-line));\n}\n.theme-preview-swatches span {\n  display: block;\n  min-width: 0;\n  height: 28px;\n  border: 0;\n}\n.theme-preview-card strong {\n  line-height: 1.2;\n}\n.theme-preview-card small {\n  font-size: 13px;\n  font-weight: 400;\n  line-height: 1.32;\n  opacity: 0.9;\n}\n.theme-gallery\n  .theme-preview-card:hover:not(\n    [aria-pressed='true'],\n    :disabled,\n    [aria-disabled='true'],\n    :active,\n    [data-state='pressed']\n  ) {\n  background: var(--ui-control-finish, none), var(--ui-action-hover-fill);\n  color: var(--ui-action-hover-ink);\n  border-image: var(--ui-action-hover-frame, none);\n  box-shadow: var(--ui-hover-depth, none);\n}\n.theme-gallery .theme-preview-card[aria-pressed='true'] {\n  color: var(--iw-on-selection, var(--fk-text));\n  background: var(--ui-active-finish, none), var(--iw-selection, var(--fk-panel));\n  border-image: var(--ui-primary-frame, none);\n  outline: 2px solid var(--iw-focus, var(--fk-focus));\n  outline-offset: 2px;\n}\n.theme-gallery\n  .theme-preview-card:is(:active, [data-state='pressed']):not(:disabled, [aria-disabled='true']) {\n  color: var(--ui-action-pressed-ink);\n  background: var(--ui-active-finish, none), var(--ui-action-pressed-fill);\n  border-image: var(--ui-primary-frame, none);\n  box-shadow: var(--ui-pressed-depth, inset 0 2px 3px #0005);\n}\n.theme-gallery .theme-preview-card:is(:focus-visible, .controller-focus) {\n  outline: 3px solid var(--iw-focus, var(--fk-focus));\n  outline-offset: 5px;\n}\n.theme-gallery .theme-preview-card:is(:disabled, [aria-disabled='true']) {\n  color: var(--iw-muted);\n  background: var(--iw-panel);\n  border-image: none;\n  box-shadow: none;\n}\n.theme-preview-card[aria-pressed='true'] strong::after {\n  content: ' ✓';\n}\n/* Independent runtime specimens inside the chooser. Only the surrounding card\n   is interactive; its focus and selected frame remain outside the preview. */\n.theme-gallery .theme-preview-card:has([data-theme-card-preview]) {\n  gap: 8px;\n  padding: 10px;\n}\n.theme-preview-card:has([data-theme-card-preview]) .theme-preview-swatches {\n  height: 4px;\n}\n.theme-preview-card:has([data-theme-card-preview]) .theme-preview-swatches span {\n  height: 4px;\n}\n.theme-material-preview {\n  display: block;\n  min-width: 0;\n  padding: 14px;\n  background: var(--iw-ink);\n  color: var(--iw-text);\n  font-family: var(--iw-font-ui);\n  font-size: var(--iw-text-size, 16px);\n  text-align: left;\n  line-height: 1.35;\n  isolation: isolate;\n}\n.theme-material-preview .theme-material-panel {\n  display: grid;\n  min-width: 0;\n  gap: 12px;\n  padding: 14px;\n  color: var(--iw-text);\n}\n.theme-material-actions,\n.theme-material-states {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: stretch;\n  gap: 8px;\n}\n.theme-material-preview .theme-material-action {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: auto;\n  margin: 0;\n  font-family: var(--iw-font-ui);\n  font-size: inherit;\n  font-weight: 600;\n  color: var(--ui-action-ink);\n}\n.theme-material-preview .theme-material-action:is(:hover, [data-state='hover']) {\n  color: var(--ui-action-hover-ink);\n}\n.theme-material-preview .theme-material-action:is(:active, [data-state='pressed']) {\n  color: var(--ui-action-pressed-ink);\n}\n.theme-material-preview .theme-material-action:is(:disabled, [aria-disabled='true']) {\n  color: var(--iw-muted);\n}\n.theme-material-preview .theme-material-field {\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr);\n  align-items: center;\n  gap: 10px;\n  color: var(--iw-text);\n  margin: 0;\n}\n.theme-material-preview .theme-material-field select {\n  min-width: 0;\n  width: 100%;\n  font-size: inherit;\n}\n.theme-material-preview .theme-material-select {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 6px;\n  padding: 5px 8px;\n  border: 2px solid var(--iw-control-line);\n  background: var(--ui-inset-finish, none), var(--iw-input);\n  box-shadow: var(--ui-inset-depth, none);\n  color: var(--iw-input-text);\n}\n.theme-material-select::after {\n  content: '⌄';\n}\n.theme-material-preview .theme-material-check {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 6px 8px;\n  background: var(--iw-panel-raised);\n  color: var(--iw-text);\n  margin: 0;\n}\n.theme-material-preview span.theme-material-checkbox {\n  display: inline-grid;\n  place-items: center;\n  width: 18px;\n  height: 18px;\n  flex: 0 0 18px;\n  border: 2px solid var(--iw-accent);\n  background: var(--ui-active-finish, none), var(--iw-accent);\n  color: var(--iw-on-accent);\n  font-weight: 700;\n  line-height: 1;\n}\n.theme-material-preview[data-preview-compact='true'] {\n  padding: 8px;\n  font-size: 12px;\n  pointer-events: none;\n}\n.theme-material-preview[data-preview-compact='true'] .theme-material-panel {\n  gap: 7px;\n  padding: 10px;\n}\n.theme-material-preview[data-preview-compact='true'] .theme-material-action {\n  min-height: 30px;\n  min-width: 0;\n  padding: 5px 7px;\n  flex: 1 1 auto;\n}\n.theme-material-preview[data-preview-compact='true']\n  :is(.theme-material-actions, .theme-material-states) {\n  gap: 6px;\n}\n.theme-material-preview[data-theme-text-size='large'] {\n  font-size: 16px;\n}\n.theme-material-preview[data-theme-text-size='large'] .theme-material-field {\n  grid-template-columns: 1fr;\n  gap: 4px;\n}\n.theme-preview-card .theme-material-preview,\n.theme-preview-card .theme-material-preview .theme-material-panel {\n  color: var(--iw-text);\n}\n.theme-accessibility {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px 20px;\n}\n.theme-family-controls > details {\n  padding: 12px;\n}\n.theme-family-controls > details > summary {\n  min-height: var(--iw-target, 44px);\n  cursor: pointer;\n}\n@media (max-width: 600px) {\n  .theme-gallery {\n    grid-template-columns: 1fr;\n  }\n}\n/* Compact Settings deliberately gives Back a fixed icon slot. Typography\n   overrides, including Large text, must not reveal its label over the arrow.\n   The real text/accessible name and the 44px target remain intact. */\n@media (max-width: 700px) {\n  [data-theme-styled='true'] .native-settings [data-menu-icon='back'] {\n    font-size: 0;\n    flex: 0 0 44px;\n    width: 44px;\n    min-width: 44px;\n    height: 44px;\n    min-height: 44px;\n    padding: 8px;\n    gap: 0;\n  }\n}\n/* Keep the compiled icon-only controls' real labels available to assistive\n   technology without drawing fallback text beside their replacement glyphs. */\n[data-theme-styled='true']\n  :is(.dialog-close, .icon-button)[data-presentation-icon][aria-label]:not([data-menu-icon]),\n[data-theme-styled='true']\n  :is(\n    [data-presentation-control='up'],\n    [data-presentation-control='down'],\n    [data-presentation-control='left'],\n    [data-presentation-control='right']\n  )[aria-label] {\n  font-size: 0;\n  gap: 0;\n  min-inline-size: var(--iw-target);\n}\n@media (prefers-reduced-motion: reduce) {\n  [data-theme-styled='true']\n    :where(button, .button, [role='button'], .native-menu-actions > a, .game-mode-choice > a) {\n    transition: none;\n    translate: none;\n  }\n}\n\n[data-theme-styled='true'] [data-ui-surface='section-title'] {\n  color: var(--iw-muted);\n  background: var(--iw-ink);\n  border-color: var(--iw-line);\n  border-image: none;\n}\n\n/* Earned media keeps its authored picture. Only the overlaid reading and\n   control surfaces share the active interface's paired colors. */\n[data-theme-styled='true']\n  :where(\n    .story-controls,\n    .story-notice,\n    .story-dialog--immersive > p:not(:empty),\n    .win-picture-caption,\n    #demo-dialog[data-reward='expanded'] .demo-header,\n    #demo-dialog[data-reward='expanded'] .demo-panel\n  ) {\n  color: var(--iw-text);\n  background: var(--ui-panel-finish, none), var(--iw-panel);\n  border-color: var(--iw-line);\n  border-image: none;\n  border-radius: 0;\n  text-shadow: none;\n  backdrop-filter: none;\n}\n[data-theme-styled='true']\n  :where(.story-dialog--immersive, .creator-player[data-earned-view='on'] #earned) {\n  background: var(--iw-ink);\n  border: 0;\n  border-image: none;\n  box-shadow: none;\n}\n/* The image element fills the viewport, including its contain-fit letterbox.\n   Theme only that backing; the authored pixels and fitting remain unchanged. */\n[data-theme-styled='true'] .creator-player #earned-picture {\n  background-color: var(--iw-ink);\n}\n[data-theme-styled='true'] .win-picture-caption {\n  width: fit-content;\n  max-width: calc(100% - 32px);\n  box-sizing: border-box;\n  margin-inline: auto;\n  padding: 12px 20px;\n  border: 1px solid var(--iw-line);\n}\n[data-theme-styled='true'] .win-picture-mark {\n  color: var(--iw-accent);\n}\n[data-theme-styled='true'] [data-win-picture] #shell-menu {\n  padding: 0;\n}\n[data-theme-styled='true'] [data-win-picture] #shell-menu::before {\n  color: inherit;\n}\n\n/* Status, badges and callouts are shared reading surfaces, including tools. */\n[data-theme-styled='true']\n  :where(\n    [role='status'],\n    [role='alert'],\n    .operation-status,\n    .callout,\n    .notice,\n    .pill,\n    .chip,\n    .status,\n    .skip-link,\n    pre\n  ) {\n  color: var(--iw-text);\n  background-color: var(--iw-panel);\n  border-color: var(--iw-line);\n  border-image: none;\n  border-radius: 0;\n}\n[data-theme-styled='true']\n  :where(.status-ready, [role='status'].success, [data-ui-tone='success']) {\n  color: var(--iw-safe);\n}\n[data-theme-styled='true']\n  :where(.status-building, [role='status'].warning, [data-ui-tone='warning']) {\n  color: var(--iw-amber);\n}\n[data-theme-styled='true']\n  :where(\n    [role='alert'],\n    [role='status'].error,\n    [role='status'][data-error='true'],\n    [data-ui-tone='danger']\n  ) {\n  color: var(--iw-hazard);\n}\n[data-theme-styled='true'] :where([role='status'][data-error='true'], [role='status'].error) {\n  border-inline-start: 3px solid var(--iw-hazard);\n  padding-inline-start: 0.75rem;\n}\n[data-theme-styled='true'] .operation-status[data-state='error'] {\n  color: var(--iw-hazard);\n  border-inline-start: 3px solid var(--iw-hazard);\n  padding-inline-start: 0.75rem;\n}\n[data-theme-styled='true'] .operation-status:is([data-state='cancelled'], [data-state='detached']) {\n  color: var(--iw-amber);\n}\n[data-theme-styled='true'] .operation-status .operation-status-label {\n  color: inherit;\n  background: transparent;\n}\n\n/* Deep dialogs and tool results are part of the same interface. Never leave a\n   legacy navy/teal well behind a newly resolved light-theme text color. */\n[data-theme-styled='true'] :where(.soundtrack-quick-status, .race-start-cue strong) {\n  color: var(--iw-on-accent);\n  background: var(--iw-accent);\n  border-color: var(--iw-accent);\n  border-image: none;\n}\n[data-theme-styled='true'] .journey-card-action {\n  color: var(--iw-on-accent);\n  background: var(--iw-accent);\n  border-color: var(--iw-accent);\n  font-size: 0.75rem;\n}\n[data-theme-styled='true'] .soundtrack-now-card::after {\n  background: var(--iw-accent);\n}\n[data-theme-styled='true'] .soundtrack-advanced-summary::after {\n  color: inherit;\n}\n[data-theme-styled='true'] .soundtrack-online-track {\n  border-color: var(--iw-line);\n}\n[data-theme-styled='true'] .soundtrack-online-track:is(:hover, :focus-within) {\n  color: var(--iw-text);\n  background: var(--iw-panel-raised);\n}\n[data-theme-styled='true'] :where(.soundtrack-online-style, .creator-poster-option):focus-within {\n  outline: 3px solid var(--iw-focus);\n  outline-offset: 2px;\n}\n[data-theme-styled='true'] :where(.batch-card-error, .creator-media-card-error) {\n  border-color: var(--iw-hazard);\n  border-image: none;\n}\n[data-theme-styled='true'] :where(.batch-card-preparing, .optional-world-current) {\n  outline: 2px solid var(--iw-focus);\n  outline-offset: 2px;\n}\n[data-theme-styled='true']\n  :where(\n    .asset-row.selected,\n    .candidate-entry.selected,\n    [aria-selected='true'],\n    [aria-pressed='true']\n  )\n  :where(.muted, .micro-note, small) {\n  color: inherit;\n}\n[data-theme-styled='true'] input[type='file']::file-selector-button {\n  color: var(--iw-text);\n  background: var(--ui-control-finish, none), var(--iw-panel-raised);\n  border: 1px solid var(--iw-control-line);\n  border-radius: 0;\n  box-shadow: var(--ui-action-depth, none);\n  min-height: var(--iw-target);\n  padding: 6px 10px;\n  margin-inline-end: 10px;\n  font: inherit;\n  cursor: pointer;\n}\n[data-theme-styled='true'] input[type='file']:not(:disabled)::file-selector-button:hover {\n  background:\n    var(--ui-hover-finish, var(--ui-control-finish, none)),\n    var(--ui-hover-face, var(--iw-panel-raised));\n  color: var(--ui-hover-ink, var(--iw-text));\n  box-shadow: var(--ui-hover-depth, none);\n}\n[data-theme-styled='true'] input[type='file']:not(:disabled)::file-selector-button:active {\n  background: var(--ui-active-finish, none), var(--iw-selection);\n  color: var(--iw-on-selection);\n  box-shadow: var(--ui-pressed-depth, none);\n}\n[data-theme-styled='true'] input[type='file']:disabled::file-selector-button {\n  color: var(--iw-muted);\n  background: var(--iw-panel);\n  border-style: dashed;\n  box-shadow: none;\n  cursor: not-allowed;\n}\n/* Reading state belongs to the message, not a permanent empty painted bar. */\n[data-theme-styled='true'] :where([role='status'], [role='alert']):empty {\n  background: transparent;\n}\n[data-theme-styled='true'] label:has(> input:is([type='checkbox'], [type='radio'])) {\n  padding: 6px 10px;\n  box-sizing: border-box;\n  gap: 10px;\n}\n[data-theme-styled='true'] :where(.soundtrack-dialog, .optional-worlds-dialog) .micro-note {\n  font-size: var(--fk-text-secondary);\n}\n/* Session transport is one control group. Its volume label must not run into\n   the last button when a long translation or enlarged text wraps the row. */\n[data-theme-styled='true'] [data-couch-music] {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px;\n  align-items: center;\n}\n[data-theme-styled='true'] [data-couch-music] > :where(h3, p, label, input, section, details) {\n  flex: 1 0 100%;\n  min-width: 0;\n  max-width: 100%;\n  box-sizing: border-box;\n}\n[data-theme-styled='true'] [data-couch-music] > :where(h3, p) {\n  margin-block: 8px;\n}\n[data-theme-styled='true'] [data-couch-music] > label {\n  margin-top: 8px;\n}\n[data-theme-styled='true'] #soundtrack-now-sources {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px 16px;\n  margin-block: 12px;\n}\n[data-theme-styled='true'] :where(.page-head, .masthead) > a + a {\n  margin-inline-start: 12px;\n}\n\n[data-theme-styled='true'] :where(.asset-row.selected, .candidate-entry.selected) {\n  color: var(--iw-on-selection);\n  background: var(--iw-selection);\n  border-color: var(--iw-focus);\n  box-shadow: inset 3px 0 var(--iw-focus);\n}\n\n/* Only the application-owned menu backdrop changes with the interface. Authored\n   campaign/edition scenery and logos are separate content and remain visible. */\n[data-theme-styled='true'] .menu-scene[data-backdrop='interface'] {\n  background: var(--iw-ink);\n}\n[data-theme-styled='true']\n  .menu-scene[data-backdrop='interface']\n  > :where(.menu-scene-art-plane, .menu-scene-signal) {\n  display: none;\n}\n[data-theme-styled='true'] .menu-scene[data-backdrop='interface']::before {\n  content: '';\n  position: absolute;\n  inset: var(--ui-scene-inset);\n  inline-size: var(--ui-scene-width);\n  block-size: var(--ui-scene-height);\n  pointer-events: none;\n  background-image: var(--ui-scene-motif, none);\n  background-size: var(--ui-scene-motif-size, 48px 48px);\n  background-position: right top;\n  background-repeat: var(--ui-scene-repeat);\n  opacity: var(--ui-scene-opacity);\n}\n[data-theme-material='linen'] {\n  --ui-scene-motif: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' shape-rendering='crispEdges'%3E%3Cg fill='none' stroke='%23f48686' stroke-width='2'%3E%3Cpath d='M32 10l22 22-22 22L10 32zM24 24l16 16m0-16L24 40'/%3E%3C/g%3E%3Cpath fill='%23e1ddcf' d='M0 0h2v2H0zm62 0h2v2h-2zM0 62h2v2H0zm62 0h2v2h-2z'/%3E%3C/svg%3E\");\n  --ui-scene-motif-size: 64px 64px;\n}\n[data-theme-material='porcelain'] {\n  --ui-scene-motif: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='96'%3E%3Cg fill='none' stroke='%230057b7'%3E%3Cpath d='M-30 24q30-28 60 0t60 0t60 0M-30 72q30-28 60 0t60 0t60 0'/%3E%3Cpath d='M60 30q-12 10 0 20q12-10 0-20m0 20v8'/%3E%3C/g%3E%3C/svg%3E\");\n  --ui-scene-motif-size: 120px 96px;\n}\n[data-theme-material='brass'],\n[data-theme-material='copper'] {\n  --ui-scene-motif:\n    repeating-linear-gradient(90deg, transparent 0 95px, var(--iw-line) 95px 96px),\n    repeating-linear-gradient(0deg, transparent 0 95px, var(--iw-line) 95px 96px);\n  --ui-scene-motif-size: 96px 96px;\n}\n[data-theme-material='wood'] {\n  --ui-scene-motif:\n    repeating-linear-gradient(\n      0deg,\n      transparent 0 7px,\n      var(--iw-line) 7px 8px,\n      transparent 8px 62px,\n      var(--iw-line) 62px 64px\n    ),\n    repeating-linear-gradient(90deg, transparent 0 191px, var(--iw-line) 191px 192px);\n  --ui-scene-motif-size: 192px 64px;\n}\n[data-theme-material='composite'] {\n  --ui-scene-motif:\n    linear-gradient(30deg, transparent 0 48%, var(--iw-accent) 49% 50%, transparent 51%),\n    linear-gradient(150deg, transparent 0 48%, var(--iw-line) 49% 50%, transparent 51%);\n  --ui-scene-motif-size: 96px 64px;\n}\n[data-theme-material='classic'],\n[data-theme-material='terminal'],\n[data-theme-material='lcd'] {\n  --ui-scene-motif: none;\n}\n[data-theme-material='classic'] .menu-scene[data-backdrop='interface']::after,\n[data-theme-material='terminal'] .menu-scene[data-backdrop='interface']::after,\n[data-theme-material='lcd'] .menu-scene[data-backdrop='interface']::after {\n  background: none;\n}\n[data-theme-texture='off'] {\n  --ui-scene-motif: none;\n}\n\n/* BEGIN ORIGINAL MATERIAL GRAIN — generated by scripts/refresh-interface-material-grain.mjs */\n[data-theme-family] {\n  --ui-grain-powder: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='128' shape-rendering='crispEdges'%3E%3Cpath fill='%23fff' opacity='.055' d='M68 16h2v1h-2zM166 44h2v1h-2zM150 5h2v1h-2zM69 90h1v1h-1zM154 30h2v1h-2zM113 37h1v1h-1zM101 58h1v1h-1zM167 80h1v1h-1zM131 76h1v1h-1zM81 23h2v1h-2zM58 109h2v1h-2zM167 78h2v1h-2zM183 84h2v1h-2zM17 46h2v1h-2zM141 20h2v1h-2zM30 100h2v1h-2zM21 69h1v1h-1zM94 102h1v1h-1zM66 101h1v1h-1zM109 34h2v1h-2zM143 6h2v1h-2zM14 89h1v1h-1zM8 100h2v1h-2zM25 29h1v1h-1zM173 68h1v1h-1zM144 79h1v1h-1zM38 28h2v1h-2zM102 90h2v1h-2zM49 26h2v1h-2zM9 40h1v1h-1zM186 17h2v1h-2zM175 119h1v1h-1zM154 115h1v1h-1zM101 3h1v1h-1zM173 62h1v1h-1zM29 13h1v1h-1zM17 79h2v1h-2zM117 41h2v1h-2zM145 20h2v1h-2zM176 86h1v1h-1zM46 56h2v1h-2zM137 82h2v1h-2zM157 96h1v1h-1zM186 84h1v1h-1zM160 6h1v1h-1zM96 33h2v1h-2zM90 123h2v1h-2zM131 110h2v1h-2zM152 119h2v1h-2zM150 92h1v1h-1zM178 69h2v1h-2zM151 21h1v1h-1zM110 12h2v1h-2zM76 31h1v1h-1zM116 63h2v1h-2zM160 2h1v1h-1z'/%3E%3Cpath fill='%23000' opacity='.09' d='M69 17h2v1h-2zM162 111h1v1h-1zM143 121h2v1h-2zM151 6h2v1h-2zM145 9h2v1h-2zM143 22h1v1h-1zM155 31h2v1h-2zM16 113h2v1h-2zM121 4h2v1h-2zM102 59h2v1h-2zM64 119h2v1h-2zM20 76h2v1h-2zM132 77h2v1h-2zM27 48h2v1h-2zM128 8h2v1h-2zM59 110h2v1h-2zM3 8h1v1h-1zM102 112h1v1h-1zM184 85h2v1h-2zM170 45h1v1h-1zM182 94h1v1h-1zM142 21h2v1h-2zM38 5h1v1h-1zM18 72h1v1h-1zM22 70h2v1h-2zM13 95h2v1h-2zM75 74h1v1h-1zM67 102h2v1h-2zM135 49h2v1h-2zM16 70h1v1h-1zM144 7h2v1h-2zM173 80h2v1h-2zM51 98h1v1h-1zM9 101h2v1h-2zM116 14h2v1h-2zM115 42h2v1h-2zM174 69h2v1h-2zM141 82h1v1h-1zM182 15h2v1h-2zM39 29h2v1h-2zM100 70h1v1h-1zM184 113h1v1h-1zM50 27h2v1h-2zM131 4h2v1h-2zM143 68h1v1h-1zM187 18h2v1h-2zM120 104h2v1h-2zM41 78h2v1h-2zM155 116h2v1h-2zM51 73h1v1h-1zM93 86h1v1h-1zM174 63h2v1h-2zM34 31h2v1h-2zM122 87h2v1h-2zM18 80h2v1h-2zM67 48h1v1h-1zM103 7h2v1h-2zM146 21h2v1h-2zM94 32h2v1h-2zM110 84h2v1h-2zM47 57h2v1h-2zM155 50h2v1h-2zM137 2h2v1h-2zM158 97h2v1h-2zM134 82h1v1h-1zM184 74h2v1h-2zM161 7h2v1h-2zM137 83h2v1h-2zM50 100h2v1h-2zM91 124h2v1h-2zM162 19h2v1h-2zM49 9h1v1h-1zM153 120h2v1h-2zM180 90h2v1h-2zM158 24h1v1h-1zM179 70h2v1h-2zM131 8h1v1h-1zM15 12h1v1h-1zM111 13h2v1h-2zM113 40h1v1h-1zM143 104h2v1h-2zM117 64h2v1h-2zM184 70h2v1h-2zM54 87h2v1h-2z'/%3E%3Cpath fill='%23000' opacity='.023' d='M132 15h18v2h-18zM134 17h15v2h-15zM121 51h9v2h-9zM123 53h6v2h-6zM111 13h6v2h-6zM113 15h3v2h-3zM14 91h12v2h-12zM16 93h9v2h-9zM65 54h16v2h-16zM67 56h13v2h-13zM64 17h13v2h-13zM66 19h10v2h-10zM68 93h7v2h-7zM70 95h4v2h-4zM141 56h15v2h-15zM143 58h12v2h-12zM28 11h18v2h-18zM30 13h15v2h-15zM141 81h18v2h-18zM143 83h15v2h-15zM153 15h14v2h-14zM155 17h11v2h-11zM134 60h8v2h-8zM136 62h5v2h-5zM90 108h17v2h-17zM92 110h14v2h-14zM146 27h17v2h-17zM148 29h14v2h-14zM22 77h17v2h-17zM24 79h14v2h-14zM152 86h10v2h-10zM154 88h7v2h-7zM94 5h9v2h-9zM96 7h6v2h-6zM147 6h11v2h-11zM149 8h8v2h-8z'/%3E%3C/svg%3E\");\n  --ui-grain-brush: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='96' shape-rendering='crispEdges'%3E%3Cpath fill='%23fff' opacity='.045' d='M99 35h13v1h-13zM120 79h20v1h-20zM90 63h30v1h-30zM108 57h19v1h-19zM91 60h33v1h-33zM127 70h29v1h-29zM28 81h6v1h-6zM141 88h23v1h-23zM75 28h6v1h-6zM138 54h21v1h-21zM37 68h26v1h-26zM37 32h22v1h-22zM118 72h33v1h-33z'/%3E%3Cpath fill='%23000' opacity='.055' d='M56 73h18v1h-18zM127 41h29v1h-29zM124 72h27v1h-27zM99 53h6v1h-6zM118 51h17v1h-17zM86 83h12v1h-12zM53 53h9v1h-9zM15 9h20v1h-20zM34 36h23v1h-23zM53 84h13v1h-13zM117 62h14v1h-14zM107 45h6v1h-6zM59 86h21v1h-21z'/%3E%3C/svg%3E\");\n  --ui-grain-thread: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' shape-rendering='crispEdges'%3E%3Cpath fill='%23fff' opacity='.026' d='M0 0h3v1h-3zM4 0h1v3h-1zM8 0h3v1h-3zM12 0h1v3h-1zM16 0h3v1h-3zM20 0h1v3h-1zM24 0h3v1h-3zM28 0h1v3h-1zM0 4h1v3h-1zM4 4h3v1h-3zM8 4h1v3h-1zM12 4h3v1h-3zM16 4h1v3h-1zM20 4h3v1h-3zM24 4h1v3h-1zM28 4h3v1h-3zM0 8h3v1h-3zM4 8h1v3h-1zM8 8h3v1h-3zM12 8h1v3h-1zM16 8h3v1h-3zM20 8h1v3h-1zM24 8h3v1h-3zM28 8h1v3h-1zM0 12h1v3h-1zM4 12h3v1h-3zM8 12h1v3h-1zM12 12h3v1h-3zM16 12h1v3h-1zM20 12h3v1h-3zM24 12h1v3h-1zM28 12h3v1h-3zM0 16h3v1h-3zM4 16h1v3h-1zM8 16h3v1h-3zM12 16h1v3h-1zM16 16h3v1h-3zM20 16h1v3h-1zM24 16h3v1h-3zM28 16h1v3h-1zM0 20h1v3h-1zM4 20h3v1h-3zM8 20h1v3h-1zM12 20h3v1h-3zM16 20h1v3h-1zM20 20h3v1h-3zM24 20h1v3h-1zM28 20h3v1h-3zM0 24h3v1h-3zM4 24h1v3h-1zM8 24h3v1h-3zM12 24h1v3h-1zM16 24h3v1h-3zM20 24h1v3h-1zM24 24h3v1h-3zM28 24h1v3h-1zM0 28h1v3h-1zM4 28h3v1h-3zM8 28h1v3h-1zM12 28h3v1h-3zM16 28h1v3h-1zM20 28h3v1h-3zM24 28h1v3h-1zM28 28h3v1h-3z'/%3E%3Cpath fill='%23000' opacity='.075' d='M2 2h1v2h-1zM6 2h2v1h-2zM10 2h1v2h-1zM14 2h2v1h-2zM18 2h1v2h-1zM22 2h2v1h-2zM26 2h1v2h-1zM30 2h2v1h-2zM2 6h2v1h-2zM6 6h1v2h-1zM10 6h2v1h-2zM14 6h1v2h-1zM18 6h2v1h-2zM22 6h1v2h-1zM26 6h2v1h-2zM30 6h1v2h-1zM2 10h1v2h-1zM6 10h2v1h-2zM10 10h1v2h-1zM14 10h2v1h-2zM18 10h1v2h-1zM22 10h2v1h-2zM26 10h1v2h-1zM30 10h2v1h-2zM2 14h2v1h-2zM6 14h1v2h-1zM10 14h2v1h-2zM14 14h1v2h-1zM18 14h2v1h-2zM22 14h1v2h-1zM26 14h2v1h-2zM30 14h1v2h-1zM2 18h1v2h-1zM6 18h2v1h-2zM10 18h1v2h-1zM14 18h2v1h-2zM18 18h1v2h-1zM22 18h2v1h-2zM26 18h1v2h-1zM30 18h2v1h-2zM2 22h2v1h-2zM6 22h1v2h-1zM10 22h2v1h-2zM14 22h1v2h-1zM18 22h2v1h-2zM22 22h1v2h-1zM26 22h2v1h-2zM30 22h1v2h-1zM2 26h1v2h-1zM6 26h2v1h-2zM10 26h1v2h-1zM14 26h2v1h-2zM18 26h1v2h-1zM22 26h2v1h-2zM26 26h1v2h-1zM30 26h2v1h-2zM2 30h2v1h-2zM6 30h1v2h-1zM10 30h2v1h-2zM14 30h1v2h-1zM18 30h2v1h-2zM22 30h1v2h-1zM26 30h2v1h-2zM30 30h1v2h-1z'/%3E%3C/svg%3E\");\n  --ui-grain-timber: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='128' shape-rendering='crispEdges'%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='.045' d='M81 15h9v3h17v3h13v2h14v1h7v-1h8v-2h10v-3h13v-3h11v-3'/%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='.045' d='M15 105h17v-1h9v-1h8v-1h15v0h17v0h7v1h12v1h10v1'/%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='.045' d='M73 99h14v1h13v1h10v1h15v1h9v0'/%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='.045' d='M64 18h13v1h11v2h16v3'/%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='.045' d='M25 7h16v-1h16v-1h17v0h17v1h17v1h15v1h9v0h15v0h14v-1h8v-1h16v-1'/%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='.045' d='M60 25h15v0h12v1h15v1h13v1h12v1h14v0'/%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='.045' d='M25 79h17v-3h17v-2h8v0h8v1h12v2'/%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='.028' d='M68 13h7v0h15v1h9v1h7v1h15v1h7v0h8v0h6v0'/%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='.028' d='M35 90h12v-3h6v-1h10v-1h8v1h10v2h13v3h14v3h7v2h8v2'/%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='.028' d='M13 94h16v-1h11v-1h6v-1h9v-1h6v0h10v0h16v1h7v1h15v1'/%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='.028' d='M51 100h12v0h8v0h8v1h10v1'/%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='.028' d='M55 83h6v0h11v0h10v2h17v3h7v3h11v2h15v1h17v-1h13v-3h6v-3'/%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='.028' d='M26 82h10v-1h15v-1h11v0h12v0h16v1h13v1h10v1'/%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='.028' d='M35 28h9v-1h9v-1h14v0h13v0'/%3E%3C/svg%3E\");\n  --ui-grain-stone: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='128' shape-rendering='crispEdges'%3E%3Cpath fill='%23fff' opacity='.028' d='M18 33h6v1h2v1h-7v-1h-1zM160 72h6v2h-6zM145 100h4v1h-4zM94 118h3v1h2v1h-4v-1h-1zM62 19h5v1h-5zM147 18h3v1h-3zM85 59h3v1h2v1h-4v-1h-1zM121 47h5v2h-5zM95 56h2v2h-2zM54 77h6v1h2v1h-7v-1h-1zM115 4h3v2h-3zM50 21h5v1h-5zM126 95h6v1h2v1h-7v-1h-1zM127 90h5v2h-5zM159 21h2v2h-2zM153 89h5v1h2v1h-6v-1h-1z'/%3E%3Cpath fill='%23000' opacity='.04' d='M146 23h2v2h-2zM179 84h3v1h2v1h-4v-1h-1zM12 16h5v2h-5zM151 77h5v1h-5zM31 104h5v1h2v1h-6v-1h-1zM137 43h5v1h-5zM70 81h5v2h-5zM124 10h6v1h2v1h-7v-1h-1zM20 118h4v2h-4zM90 69h6v2h-6zM118 30h3v1h2v1h-4v-1h-1zM36 86h2v2h-2zM82 103h4v1h-4zM61 16h3v1h2v1h-4v-1h-1zM115 58h2v1h-2zM106 98h3v2h-3z'/%3E%3C/svg%3E\");\n  --ui-grain-fiber: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='128' shape-rendering='crispEdges'%3E%3Cpath fill='%23fff' opacity='.035' d='M137 49h8v1h-3v1h-2v-1h-2zM81 29h6v1h-3v1h-2v-1h-2zM82 31h3v1h-3v1h-2v-1h-2zM54 100h9v1h-3v1h-2v-1h-2zM114 57h4v1h-3v1h-2v-1h-2zM145 26h9v1h-3v1h-2v-1h-2zM129 105h8v1h-3v1h-2v-1h-2zM84 63h3v1h-3v1h-2v-1h-2zM37 44h9v1h-3v1h-2v-1h-2zM136 106h5v1h-3v1h-2v-1h-2zM142 46h8v1h-3v1h-2v-1h-2zM33 60h6v1h-3v1h-2v-1h-2zM16 13h3v1h-3v1h-2v-1h-2z'/%3E%3Cpath fill='%23000' opacity='.033' d='M108 55h4v1h-3v1h-2v-1h-2zM80 108h3v1h-3v1h-2v-1h-2zM36 44h8v1h-3v1h-2v-1h-2zM35 84h4v1h-3v1h-2v-1h-2zM39 91h5v1h-3v1h-2v-1h-2zM83 46h8v1h-3v1h-2v-1h-2zM134 114h9v1h-3v1h-2v-1h-2zM81 45h4v1h-3v1h-2v-1h-2zM75 15h9v1h-3v1h-2v-1h-2zM42 34h4v1h-3v1h-2v-1h-2zM156 90h4v1h-3v1h-2v-1h-2zM89 27h8v1h-3v1h-2v-1h-2z'/%3E%3C/svg%3E\");\n  --ui-grain-machining: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='128' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' opacity='.075' d='M12 18h34v1H12zM91 43h19v1H91zM164 12h47v1h-47zM37 95h31v1H37zM146 103h18v1h-18zM208 74h26v1h-26zM118 65h8v1h-8zM68 28h6v1h-6z'/%3E%3Cpath fill='%23fff' opacity='.045' d='M13 19h30v1H13zM92 44h16v1H92zM167 13h40v1h-40zM39 96h26v1H39zM147 104h15v1h-15zM209 75h22v1h-22z'/%3E%3C/svg%3E\");\n  --ui-grain-edge-wear: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='6' shape-rendering='crispEdges'%3E%3Cpath fill='%23fff' opacity='.20' d='M7 1h12v1H7zM42 2h5v1h-5zM76 1h17v1H76zM111 2h8v1h-8z'/%3E%3Cpath fill='%23000' opacity='.26' d='M8 2h9v1H8zM42 3h4v1h-4zM78 2h13v1H78zM111 3h6v1h-6z'/%3E%3C/svg%3E\");\n  --ui-grain-vent: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='8' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' opacity='.45' d='M4 2h3v4h-3zM10 2h3v4h-3zM16 2h3v4h-3zM22 2h3v4h-3zM28 2h3v4h-3zM34 2h3v4h-3zM40 2h3v4h-3zM46 2h3v4h-3zM52 2h3v4h-3zM58 2h3v4h-3zM64 2h3v4h-3zM70 2h3v4h-3zM76 2h3v4h-3zM82 2h3v4h-3zM88 2h3v4h-3z'/%3E%3Cpath fill='%23fff' opacity='.14' d='M4 6h3v1h-3zM10 6h3v1h-3zM16 6h3v1h-3zM22 6h3v1h-3zM28 6h3v1h-3zM34 6h3v1h-3zM40 6h3v1h-3zM46 6h3v1h-3zM52 6h3v1h-3zM58 6h3v1h-3zM64 6h3v1h-3zM70 6h3v1h-3zM76 6h3v1h-3zM82 6h3v1h-3zM88 6h3v1h-3z'/%3E%3C/svg%3E\");\n  --ui-grain-bulkhead: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='192' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' opacity='.42' d='M0 0h256v2H0zM0 2h2v190H0z'/%3E%3Cpath fill='%23fff' opacity='.07' d='M2 2h254v1H2zM2 3h1v189H2z'/%3E%3Cpath fill='%23000' opacity='.32' d='M9 9h6v6H9zM241 9h6v6h-6zM9 177h6v6H9zM241 177h6v6h-6z'/%3E%3Cpath fill='%23fff' opacity='.12' d='M10 10h4v1h-4zM242 10h4v1h-4zM10 178h4v1h-4zM242 178h4v1h-4z'/%3E%3Cpath fill='%23fff' opacity='.055' d='M34 3h26v1H34zM186 3h39v1h-39zM3 88h1v12H3z'/%3E%3C/svg%3E\");\n}\n/* END ORIGINAL MATERIAL GRAIN */\n\n/* Material finishes are independent of the immutable asset frames. The opaque\n   semantic base always supplies the text/state pair; these original, static\n   layers add restrained grain across the face and stronger light at its edges.\n   Grain is not stretched nine-slice art: it contains no screws, seams or labels. */\n@media (forced-colors: none) {\n  [data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-control-finish: linear-gradient(180deg, #ffffff0a, transparent 22%, #00000008);\n    --ui-active-finish: linear-gradient(180deg, #00000008, transparent 40%, #ffffff08);\n    --ui-inset-finish: linear-gradient(180deg, #00000012, transparent 12px);\n    --ui-inset-depth: inset 0 2px 3px #0005, inset 0 -1px 0 #ffffff0c;\n    --ui-toolbar-finish: linear-gradient(180deg, #ffffff08, transparent 8px, #00000008);\n    --ui-action-depth: inset 1px 1px 0 #ffffff20, inset -1px -1px 0 #0005, 0 2px 0 var(--ui-shadow);\n    --ui-hover-depth:\n      inset 0 0 0 1px var(--iw-accent), inset 0 2px 0 #ffffff20, 0 2px 0 var(--ui-shadow);\n    --ui-pressed-depth: inset 0 2px 3px #0005, inset 0 -1px 0 #ffffff14;\n    --ui-selected-depth: inset 3px 0 var(--iw-focus), inset 0 1px 0 #ffffff18, inset 0 -2px 0 #0003;\n    --ui-gallery-depth: var(--ui-action-depth);\n  }\n\n  /* Steel: powder-coated face, rolled edge, dark socket and amber activation.\n     Four riveted corners belong to frames; wear never crosses the label. */\n  :is(\n      [data-theme-material='steel'],\n      [data-theme-material='industrial-workshop']\n    )[data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-loading-rail: 7px;\n    --ui-grain:\n      var(--ui-grain-machining) 0 0 / 256px 128px repeat,\n      var(--ui-grain-powder) 17px 11px / 192px 128px repeat;\n    --ui-panel-finish:\n      var(--ui-grain-vent) right 18px top 7px / 96px 8px no-repeat,\n      var(--ui-grain-edge-wear) left 14px top 2px / 128px 6px repeat-x, var(--ui-grain),\n      linear-gradient(180deg, #ffffff18, transparent 7px, transparent calc(100% - 5px), #00000025);\n    --ui-control-finish:\n      var(--ui-grain-edge-wear) left 14px top 1px / 128px 6px repeat-x, var(--ui-grain),\n      linear-gradient(90deg, #ffffff14, transparent 4px, transparent calc(100% - 4px), #00000020),\n      linear-gradient(\n        180deg,\n        #ffffff38 0 1px,\n        #ffffff14 1px 3px,\n        transparent 6px,\n        transparent calc(100% - 5px),\n        #00000035 calc(100% - 2px),\n        #00000050\n      );\n    --ui-active-finish:\n      var(--ui-grain-edge-wear) left 14px bottom 1px / 128px 6px repeat-x, var(--ui-grain),\n      linear-gradient(180deg, #00000022, transparent 3px, transparent calc(100% - 2px), #ffffff20);\n    --ui-inset-finish:\n      var(--ui-grain-powder) 41px 27px / 192px 128px repeat,\n      linear-gradient(180deg, #00000048, transparent 6px, transparent calc(100% - 2px), #ffffff10);\n    --ui-toolbar-finish:\n      var(--ui-grain-edge-wear) left 14px top 1px / 128px 6px repeat-x, var(--ui-grain),\n      linear-gradient(180deg, #ffffff28, transparent 4px, transparent calc(100% - 4px), #00000025);\n    --ui-thumb-finish:\n      repeating-linear-gradient(90deg, transparent 0 3px, #0006 3px 4px, #fff4 4px 5px) center /\n        15px 60% no-repeat,\n      linear-gradient(180deg, #fff3, transparent 3px, transparent calc(100% - 3px), #0003);\n    --ui-panel-frame: var(--iw-material-panel) 6 / 6px / 0 repeat;\n    --ui-raised-frame: var(--iw-material-raised) 6 / 6px / 0 repeat;\n    --ui-primary-frame: var(--iw-material-primary) 6 / 6px / 0 repeat;\n    --ui-hover-frame: var(--ui-primary-frame);\n    --ui-hover-face: var(--iw-accent);\n    --ui-hover-ink: var(--iw-on-accent);\n    --ui-panel-depth:\n      inset 1px 1px 0 #ffffff18, inset -1px -2px 0 #0008, 0 0 0 1px #0007, 0 4px 0 var(--ui-shadow),\n      0 16px 28px #0006;\n    --ui-action-depth:\n      inset 0 2px 0 #ffffff25, inset 2px 0 0 #ffffff12, inset 0 -3px 0 #0006, inset -2px 0 0 #0003,\n      0 0 0 1px #0008, 0 4px 0 var(--ui-shadow), 0 5px 0 #0003;\n    --ui-hover-depth:\n      inset 0 2px 0 #ffffff65, inset 2px 0 0 #ffffff35, inset 0 -3px 0 #0005, inset -2px 0 0 #0002,\n      0 0 0 1px #0008, 0 4px 0 var(--ui-shadow),\n      0 0 6px color-mix(in srgb, var(--iw-accent) 18%, transparent);\n    --ui-pressed-depth:\n      inset 0 3px 4px #0006, inset 2px 0 0 #0003, inset 0 -1px 0 #ffffff50, 0 0 0 1px #0009,\n      0 1px 0 var(--ui-shadow);\n    --ui-selected-depth:\n      inset 0 2px 0 #ffffff45, inset 3px 0 0 #ffffff30, inset 0 -2px 0 #0004, 0 0 0 1px #0008,\n      0 2px 0 var(--ui-shadow);\n    --ui-inset-depth:\n      inset 0 3px 4px #0007, inset 1px 0 0 #0006, inset 0 -1px 0 #ffffff1c, 0 1px 0 #ffffff10;\n    --ui-scene-inset: 0;\n    --ui-scene-width: auto;\n    --ui-scene-height: auto;\n    --ui-scene-motif:\n      linear-gradient(\n        135deg,\n        transparent 35%,\n        color-mix(in srgb, var(--iw-accent) 7%, transparent)\n      ),\n      var(--ui-grain-bulkhead), var(--ui-grain-machining);\n    --ui-scene-motif-size: 100% 100%, 256px 192px, 256px 128px;\n    --ui-scene-repeat: no-repeat, repeat, repeat;\n    --ui-scene-opacity: 0.8;\n  }\n\n  /* Cloth keeps its stitches on the panel seam. Buttons are woven fabric,\n     never embroidered borders repeated through every navigation row. */\n  [data-theme-material='linen'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-weave: var(--ui-grain-thread) 1px 1px / 32px 32px repeat;\n    --ui-panel-finish:\n      repeating-linear-gradient(\n          90deg,\n          color-mix(in srgb, var(--iw-accent) 48%, transparent) 0 3px,\n          transparent 3px 9px\n        )\n        left 12px top 3px / calc(100% - 24px) 2px no-repeat,\n      var(--ui-weave), linear-gradient(180deg, #ffffff06, transparent 72px);\n    --ui-toolbar-finish: var(--ui-weave);\n    --ui-panel-depth:\n      inset 0 2px 0 color-mix(in srgb, var(--iw-accent) 65%, transparent),\n      inset 0 -1px 0 color-mix(in srgb, var(--iw-accent) 32%, transparent), 0 6px 14px #0004;\n    --ui-inset-finish: var(--ui-weave), linear-gradient(180deg, #00000024, transparent 5px);\n  }\n\n  /* Porcelain: a glazed face and cobalt double lip. Sakura is warmer satin. */\n  :is(\n      [data-theme-material='porcelain'],\n      [data-theme-material='sakura']\n    )[data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish: var(--ui-ceramic), linear-gradient(180deg, #ffffff30, transparent 9px);\n    --ui-control-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #ffffff80, transparent 4px, transparent calc(100% - 4px), #00000015);\n    --ui-toolbar-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #ffffff30, transparent 4px, transparent calc(100% - 4px), #00000009);\n    --ui-panel-depth:\n      inset 0 0 0 2px color-mix(in srgb, var(--iw-accent) 24%, transparent),\n      inset 0 0 0 5px #ffffff24, 0 4px 0 color-mix(in srgb, var(--iw-line) 28%, transparent),\n      0 8px 18px #0001;\n    --ui-action-depth:\n      inset 0 2px 0 #ffffff80, inset 0 -2px 0 #00000018,\n      0 2px 0 color-mix(in srgb, var(--iw-line) 40%, transparent);\n    --ui-hover-depth:\n      inset 0 0 0 1px var(--iw-accent), inset 0 2px 0 #ffffff80,\n      0 2px 0 color-mix(in srgb, var(--iw-accent) 45%, transparent);\n    --ui-ceramic: var(--ui-grain-fiber) 0 0 / 192px 128px repeat;\n    --ui-active-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #00000022, transparent 3px, transparent calc(100% - 2px), #ffffff20);\n    --ui-inset-finish: var(--ui-ceramic), linear-gradient(180deg, #00000012, transparent 4px);\n    --ui-pressed-depth: inset 0 2px 0 #00000028, inset 0 -1px 0 #ffffff70;\n  }\n  [data-theme-material='sakura'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish: var(--ui-ceramic), linear-gradient(180deg, #ffffff18, transparent 6px);\n    --ui-panel-depth:\n      inset 0 2px 0 color-mix(in srgb, var(--iw-accent) 42%, transparent), inset 0 -1px 0 #00000015,\n      0 4px 14px #0001;\n  }\n\n  /* Enamel and instrument copper: hairline inlays, directional satin, no\n     repeated chevrons. Obsidian overrides the enamel with cut stone below. */\n  :is(\n      [data-theme-material='brass'],\n      [data-theme-material='copper']\n    )[data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish: var(--ui-metal), linear-gradient(180deg, #ffffff08, transparent 8px);\n    --ui-control-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff30, transparent 4px, transparent calc(100% - 4px), #00000030);\n    --ui-toolbar-finish: var(--ui-metal);\n    --ui-panel-depth:\n      inset 0 1px 0 color-mix(in srgb, var(--iw-accent) 45%, transparent),\n      inset 0 0 0 4px #00000018,\n      inset 0 -1px 0 color-mix(in srgb, var(--iw-accent) 22%, transparent),\n      0 4px 0 var(--ui-shadow), 0 10px 20px #0003;\n    --ui-hover-depth:\n      inset 0 2px 0 var(--iw-accent), inset 0 -1px 0 #0005, 0 2px 0 var(--ui-shadow);\n    --ui-metal: var(--ui-grain-powder) 9px 19px / 192px 128px repeat;\n    --ui-active-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #00000022, transparent 3px, transparent calc(100% - 2px), #ffffff20);\n    --ui-inset-finish: var(--ui-metal), linear-gradient(180deg, #00000030, transparent 5px);\n    --ui-pressed-depth: inset 0 2px 0 #0006, inset 0 -1px 0 #ffffff30;\n  }\n  [data-theme-material='copper'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-scene-motif: repeating-radial-gradient(\n      circle at 100% 0,\n      transparent 0 27px,\n      var(--iw-accent) 28px 29px,\n      transparent 30px 44px\n    );\n    --ui-scene-motif-size: 192px 96px;\n    --ui-metal: var(--ui-grain-brush) 0 0 / 192px 96px repeat;\n  }\n\n  /* Fine timber grain remains broad and sparse enough for small labels. */\n  [data-theme-material='wood'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-woodgrain: var(--ui-grain-timber) 11px 3px / 192px 128px repeat;\n    --ui-panel-finish: var(--ui-woodgrain), linear-gradient(180deg, #ffffff12, transparent 6px);\n    --ui-panel-depth:\n      inset 0 3px 0 #ffffff20, inset 0 -4px 0 #00000022, inset 2px 0 0 #ffffff10,\n      0 4px 0 color-mix(in srgb, var(--iw-line) 50%, transparent), 0 8px 16px #0002;\n    --ui-active-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #00000022, transparent 3px, transparent calc(100% - 2px), #ffffff20);\n    --ui-inset-finish: var(--ui-woodgrain), linear-gradient(180deg, #00000025, transparent 4px);\n    --ui-pressed-depth: inset 0 2px 0 #0005, inset 0 -1px 0 #ffffff20;\n  }\n  [data-theme-material='composite'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish:\n      var(--ui-composite),\n      linear-gradient(135deg, #ffffff20 0 5px, transparent 5px) top left / 18px 18px no-repeat;\n    --ui-panel-depth:\n      inset 2px 0 0 color-mix(in srgb, var(--iw-accent) 28%, transparent), inset 0 1px 0 #ffffff12,\n      inset 0 -2px 0 #0004, 0 4px 0 var(--ui-shadow), 0 10px 24px #0003;\n    --ui-composite: var(--ui-grain-stone) 0 0 / 192px 128px repeat;\n    --ui-active-finish:\n      var(--ui-composite),\n      linear-gradient(180deg, #00000022, transparent 3px, transparent calc(100% - 2px), #ffffff20);\n    --ui-inset-finish: var(--ui-composite), linear-gradient(180deg, #00000030, transparent 4px);\n    --ui-pressed-depth: inset 0 2px 0 #0005, inset 0 -1px 0 #ffffff25;\n  }\n  [data-theme-material='lcd'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish:\n      repeating-linear-gradient(0deg, transparent 0 3px, #00000003 3px 4px),\n      repeating-linear-gradient(90deg, transparent 0 3px, #00000003 3px 4px);\n    --ui-panel-depth:\n      inset 0 3px 5px #0003, inset 0 -2px 0 #ffffff35,\n      0 0 0 3px color-mix(in srgb, var(--iw-line) 25%, transparent);\n    --ui-active-finish: linear-gradient(\n      180deg,\n      #00000028,\n      transparent 3px,\n      transparent calc(100% - 2px),\n      #ffffff25\n    );\n    --ui-inset-finish:\n      repeating-linear-gradient(0deg, transparent 0 3px, #00000006 3px 4px),\n      repeating-linear-gradient(90deg, transparent 0 3px, #00000006 3px 4px);\n    --ui-pressed-depth: inset 0 2px 0 #0005, inset 0 -1px 0 #ffffff20;\n  }\n\n  /* These variants are resolved from the interface basis, including Studio\n     descendants, rather than testing the current campaign or family name. */\n  [data-theme-finish='ember-foundry'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-grain:\n      var(--ui-grain-stone) 0 0 / 192px 128px repeat,\n      var(--ui-grain-powder) 17px 11px / 192px 128px repeat;\n    --ui-panel-finish:\n      var(--ui-grain-vent) right 18px top 7px / 96px 8px no-repeat,\n      linear-gradient(90deg, var(--iw-accent), transparent) left 12px bottom 5px / 72px 2px\n        no-repeat,\n      var(--ui-grain),\n      linear-gradient(180deg, #ffffff12, transparent 6px, transparent calc(100% - 5px), #0005);\n    --ui-toolbar-finish:\n      var(--ui-grain-brush) 0 0 / 192px 96px repeat,\n      linear-gradient(180deg, #ffffff25, transparent 4px, transparent calc(100% - 4px), #0005);\n    --ui-panel-depth:\n      inset 1px 1px 0 #ffffff20, inset -2px -3px 0 #0009, 0 0 0 1px #0008, 0 5px 0 var(--ui-shadow),\n      0 16px 28px #0006;\n  }\n  [data-theme-finish='polar-relay'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-grain: var(--ui-grain-brush) 0 0 / 192px 96px repeat;\n    --ui-panel-finish:\n      var(--ui-grain-vent) right 18px top 7px / 96px 8px no-repeat,\n      linear-gradient(\n          90deg,\n          var(--iw-accent) 0 5px,\n          transparent 5px 9px,\n          var(--iw-accent) 9px 14px,\n          transparent 14px 18px,\n          var(--iw-accent) 18px 23px\n        )\n        left 14px top 8px / 23px 2px no-repeat,\n      var(--ui-grain),\n      linear-gradient(180deg, #ffffff20, transparent 8px, transparent calc(100% - 4px), #0004);\n    --ui-control-finish:\n      var(--ui-grain),\n      linear-gradient(90deg, #ffffff18, transparent 3px, transparent calc(100% - 3px), #0003),\n      linear-gradient(\n        180deg,\n        #ffffff40 0 1px,\n        #ffffff12 1px 3px,\n        transparent 5px,\n        transparent calc(100% - 3px),\n        #0005\n      );\n    --ui-panel-depth:\n      inset 1px 1px 0 #ffffff30, inset -1px -2px 0 #0008, 0 0 0 1px #0007, 0 3px 0 var(--ui-shadow),\n      0 12px 24px #0005;\n  }\n  [data-theme-finish='obsidian-reliquary'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish:\n      var(--ui-metal),\n      linear-gradient(135deg, #ffffff20 0 8px, transparent 8px) top left / 24px 24px no-repeat,\n      linear-gradient(315deg, #0005 0 8px, transparent 8px) bottom right / 24px 24px no-repeat;\n    --ui-panel-depth:\n      inset 2px 2px 0 color-mix(in srgb, var(--iw-accent) 28%, transparent),\n      inset -3px -3px 0 #0006, 0 5px 0 var(--ui-shadow), 0 10px 20px #0005;\n    --ui-scene-motif: linear-gradient(\n      135deg,\n      transparent 42%,\n      var(--iw-accent) 43% 44%,\n      transparent 45% 52%,\n      var(--iw-accent) 53% 54%,\n      transparent 55%\n    );\n    --ui-scene-motif-size: 144px 96px;\n    --ui-metal: var(--ui-grain-stone) 23px 7px / 192px 128px repeat;\n    --ui-pressed-depth: inset 2px 2px 0 #0005, inset -1px -1px 0 #ffffff20;\n  }\n  [data-theme-finish='deep-space'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish: var(--ui-composite), linear-gradient(180deg, #ffffff18, transparent 4px);\n    --ui-panel-depth:\n      inset 0 2px 0 #ffffff18, inset 0 -3px 0 #0007, inset 3px 0 0 #0003, 0 3px 0 var(--ui-shadow),\n      0 8px 20px #0004;\n    --ui-scene-motif:\n      linear-gradient(0deg, transparent 0 46px, var(--iw-line) 46px 48px, transparent 48px),\n      linear-gradient(90deg, transparent 0 130px, var(--iw-accent) 130px 138px, transparent 138px);\n    --ui-scene-motif-size: 192px 96px;\n    --ui-composite: var(--ui-grain-brush) 23px 11px / 192px 96px repeat;\n  }\n  [data-theme-finish='moonlit-grove'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-woodgrain: var(--ui-grain-timber) 53px 47px / 192px 128px repeat;\n    --ui-panel-finish: var(--ui-woodgrain), linear-gradient(180deg, #ffffff12, transparent 6px);\n    --ui-panel-depth:\n      inset 1px 1px 0 #ffffff18, inset -2px -3px 0 #0006, 0 4px 0 var(--ui-shadow),\n      0 12px 24px #0003;\n    --ui-scene-motif:\n      radial-gradient(\n        ellipse at 75% 22%,\n        transparent 25px,\n        var(--iw-accent) 26px 28px,\n        transparent 29px\n      ),\n      linear-gradient(120deg, transparent 64%, var(--iw-line) 65% 66%, transparent 67%);\n    --ui-scene-motif-size: 144px 96px;\n  }\n\n  /* Texture-free systems still have intentional construction. Native desktop\n     bevels and terminal double rules are geometry, not decorative texture. */\n\n  [data-theme-material='terminal'][data-theme-contrast='normal'] {\n    --ui-hover-face: var(--iw-selection);\n    --ui-hover-ink: var(--iw-on-selection);\n  }\n}\n\n/* Material state finishes: grain belongs to the material, relief belongs to the\n   interaction. Faces remain quiet; focus, text and status colors retain their\n   semantic pairings. Existing steel recipes deliberately remain untouched. */\n@media (forced-colors: none) {\n  /* Woven patches compress rather than becoming metal plates. Red embroidery\n     remains on the existing outer panel seam, never on every button. */\n  [data-theme-material='linen'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-control-finish:\n      var(--ui-weave),\n      linear-gradient(180deg, #ffffff14, transparent 3px, transparent calc(100% - 3px), #0004);\n    --ui-hover-finish:\n      var(--ui-weave),\n      linear-gradient(180deg, #ffffff20, transparent 3px, transparent calc(100% - 3px), #0004);\n    --ui-active-finish:\n      var(--ui-weave),\n      linear-gradient(180deg, #0004, transparent 3px, transparent calc(100% - 2px), #ffffff18);\n    --ui-selected-finish:\n      var(--ui-weave),\n      linear-gradient(180deg, #ffffff18, transparent 2px, transparent calc(100% - 2px), #0003);\n    --ui-action-depth: inset 1px 1px 0 #ffffff16, inset -1px -1px 0 #0006, 0 2px 2px #0005;\n    --ui-hover-depth: inset 2px 0 0 currentColor, inset 0 1px 0 #ffffff25, 0 2px 3px #0005;\n    --ui-pressed-depth: inset 0 2px 3px #0006, inset 0 -1px 0 #ffffff20;\n    --ui-selected-depth: inset 2px 0 0 currentColor, inset 0 1px 0 #ffffff20, 0 1px 1px #0005;\n    --ui-inset-depth: inset 0 2px 3px #0007, inset 0 -1px 0 #ffffff14;\n    --ui-input-hover-depth: inset 0 2px 3px #0007, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish:\n      linear-gradient(90deg, transparent 0 44%, #0003 44% 48%, #ffffff25 48% 52%, transparent 52%)\n        center / 12px 65% no-repeat,\n      var(--ui-weave);\n  }\n\n  /* Glazed ceramic has a broad clean face with a hard rim and a small catch\n     light. The cobalt lip, not scratches, explains its construction. */\n  [data-theme-material='porcelain'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish:\n      var(--ui-ceramic),\n      linear-gradient(\n        180deg,\n        #ffffffb0 0 1px,\n        #ffffff45 1px 3px,\n        transparent 5px,\n        transparent calc(100% - 3px),\n        #00000018\n      );\n    --ui-hover-finish:\n      var(--ui-ceramic),\n      linear-gradient(\n        180deg,\n        #ffffffd0,\n        #ffffff50 2px,\n        transparent 5px,\n        transparent calc(100% - 3px),\n        #00000018\n      );\n    --ui-active-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #00000025, transparent 3px, transparent calc(100% - 2px), #ffffff60);\n    --ui-selected-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #ffffff55, transparent 3px, transparent calc(100% - 2px), #00000020);\n    --ui-action-depth:\n      inset 1px 1px 0 #ffffffa0, inset -1px -2px 0 #00000015,\n      0 2px 0 color-mix(in srgb, var(--iw-line) 45%, transparent), 0 3px 4px #0000000c;\n    --ui-hover-depth:\n      inset 0 0 0 1px currentColor, inset 0 2px 0 #ffffffb0,\n      0 2px 0 color-mix(in srgb, var(--iw-line) 55%, transparent), 0 3px 5px #00000012;\n    --ui-selected-depth: inset 0 1px 0 #ffffff65, inset 0 -2px 0 #0003, 0 1px 0 var(--ui-shadow);\n    --ui-inset-depth: inset 0 2px 3px #00000020, inset 0 -1px 0 #ffffffb0;\n    --ui-input-hover-depth: inset 0 2px 3px #00000020, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish:\n      linear-gradient(90deg, #ffffff90 0 1px, transparent 1px),\n      linear-gradient(180deg, #ffffff85, transparent 3px, transparent calc(100% - 2px), #0003);\n  }\n\n  /* Lacquered station signage: restrained satin, crisp printed edges and paper\n     fibers. It shares no glazed ceramic glare or industrial fasteners. */\n  [data-theme-material='sakura'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #ffffff65, transparent 2px, transparent calc(100% - 2px), #00000014);\n    --ui-hover-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #ffffff90, transparent 3px, transparent calc(100% - 2px), #00000016);\n    --ui-selected-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #ffffff30, transparent 2px, transparent calc(100% - 2px), #00000022);\n    --ui-toolbar-finish: var(--ui-ceramic), linear-gradient(180deg, #ffffff50, transparent 2px);\n    --ui-action-depth:\n      inset 0 1px 0 #ffffff80, inset 0 -1px 0 #00000016,\n      0 2px 0 color-mix(in srgb, var(--iw-line) 40%, transparent);\n    --ui-hover-depth:\n      inset 0 -2px 0 currentColor, inset 0 1px 0 #ffffff90,\n      0 2px 0 color-mix(in srgb, var(--iw-line) 45%, transparent);\n    --ui-pressed-depth: inset 0 2px 2px #00000025, inset 0 -1px 0 #ffffff50;\n    --ui-selected-depth: inset 0 -2px 0 currentColor, inset 0 1px 0 #ffffff35;\n    --ui-inset-depth: inset 0 1px 2px #00000024, inset 0 -1px 0 #ffffff70;\n    --ui-input-hover-depth: inset 0 1px 2px #00000024, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish: linear-gradient(\n      180deg,\n      #ffffff55,\n      transparent 2px,\n      transparent calc(100% - 2px),\n      #00000022\n    );\n  }\n\n  /* Enamel instrument keys sit in a brass surround. Edge highlights stop after\n     four pixels; there is no bright glaze crossing a label. */\n  [data-theme-material='brass'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish:\n      var(--ui-metal),\n      linear-gradient(\n        180deg,\n        #ffffff35 0 1px,\n        #ffffff14 1px 3px,\n        transparent 5px,\n        transparent calc(100% - 4px),\n        #0005\n      );\n    --ui-hover-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff50, transparent 4px, transparent calc(100% - 3px), #0005);\n    --ui-selected-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff45, transparent 3px, transparent calc(100% - 3px), #0004);\n    --ui-toolbar-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff20, transparent 3px, transparent calc(100% - 2px), #0004);\n    --ui-action-depth:\n      inset 1px 1px 0 #ffffff22, inset -1px -2px 0 #0006, 0 2px 0 var(--ui-shadow), 0 3px 3px #0003;\n    --ui-hover-depth:\n      inset 0 2px 0 currentColor, inset 1px 0 0 #ffffff20, inset 0 -2px 0 #0006,\n      0 2px 0 var(--ui-shadow);\n    --ui-selected-depth: inset 0 1px 0 #ffffff50, inset 0 -2px 0 #0004, 0 1px 0 var(--ui-shadow);\n    --ui-inset-depth: inset 0 3px 3px #0007, inset 0 -1px 0 #ffffff20;\n    --ui-input-hover-depth: inset 0 3px 3px #0007, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish:\n      linear-gradient(180deg, transparent 0 40%, #0005 40% 46%, #ffffff40 46% 52%, transparent 52%)\n        center / 65% 12px no-repeat,\n      linear-gradient(90deg, #ffffff45, transparent 3px, transparent calc(100% - 2px), #0004);\n  }\n\n  /* Brushed observatory controls have a narrow metal cap and a darker foot.\n     Directional grain is restrained and coherent with the instrument fascia. */\n  [data-theme-material='copper'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish:\n      var(--ui-metal),\n      linear-gradient(\n        180deg,\n        #ffffff45 0 1px,\n        #ffffff16 1px 3px,\n        transparent 5px,\n        transparent calc(100% - 4px),\n        #0005\n      );\n    --ui-hover-finish:\n      var(--ui-metal),\n      linear-gradient(\n        180deg,\n        #ffffff60 0 1px,\n        #ffffff25 1px 3px,\n        transparent 5px,\n        transparent calc(100% - 4px),\n        #0005\n      );\n    --ui-selected-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff45, transparent 3px, transparent calc(100% - 3px), #0004);\n    --ui-toolbar-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff20, transparent 3px, transparent calc(100% - 3px), #0004);\n    --ui-action-depth: inset 1px 1px 0 #ffffff28, inset -1px -2px 0 #0007, 0 3px 0 var(--ui-shadow);\n    --ui-hover-depth:\n      inset 0 1px 0 #ffffff60, inset 0 -2px 0 currentColor, 0 3px 0 var(--ui-shadow);\n    --ui-pressed-depth: inset 0 3px 3px #0007, inset 0 -1px 0 #ffffff35, 0 1px 0 #0005;\n    --ui-selected-depth: inset 0 1px 0 #ffffff45, inset 0 -2px 0 #0005, 0 1px 0 var(--ui-shadow);\n    --ui-inset-depth: inset 0 3px 4px #0007, inset 0 -1px 0 #ffffff20;\n    --ui-input-hover-depth: inset 0 3px 4px #0007, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish:\n      repeating-linear-gradient(90deg, transparent 0 3px, #0005 3px 4px, #ffffff35 4px 5px) center /\n        15px 55% no-repeat,\n      linear-gradient(180deg, #ffffff60, transparent 3px, transparent calc(100% - 2px), #0004);\n  }\n\n  /* Wood uses planed edges and quiet long fibers; a selected key feels like a\n     stained inlay rather than a metal switch. */\n  [data-theme-material='wood'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #ffffff40, transparent 3px, transparent calc(100% - 3px), #0000002a);\n    --ui-hover-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #ffffff60, transparent 3px, transparent calc(100% - 3px), #0000002a);\n    --ui-selected-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #00000022, transparent 2px, transparent calc(100% - 2px), #ffffff28);\n    --ui-toolbar-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #ffffff30, transparent 3px, transparent calc(100% - 3px), #00000020);\n    --ui-action-depth:\n      inset 1px 1px 0 #ffffff35, inset -1px -2px 0 #00000030,\n      0 3px 0 color-mix(in srgb, var(--iw-line) 60%, transparent);\n    --ui-hover-depth:\n      inset 0 2px 0 currentColor, inset 0 -2px 0 #00000030,\n      0 3px 0 color-mix(in srgb, var(--iw-line) 70%, transparent);\n    --ui-selected-depth: inset 0 2px 2px #0004, inset 0 -1px 0 #ffffff35, 0 1px 0 var(--ui-shadow);\n    --ui-inset-depth: inset 0 2px 3px #00000035, inset 0 -1px 0 #ffffff50;\n    --ui-input-hover-depth: inset 0 2px 3px #00000035, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #ffffff45, transparent 3px, transparent calc(100% - 2px), #0004);\n  }\n\n  /* Ruins use honed stone and small luminous edge inlays. Glow is an interaction\n     response and never sits behind type or repeats across every resting key. */\n  [data-theme-material='composite'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish:\n      var(--ui-composite),\n      linear-gradient(180deg, #ffffff25 0 1px, transparent 4px, transparent calc(100% - 3px), #0005);\n    --ui-hover-finish:\n      var(--ui-composite),\n      linear-gradient(180deg, #ffffff40, transparent 3px, transparent calc(100% - 3px), #0005);\n    --ui-selected-finish:\n      var(--ui-composite),\n      linear-gradient(180deg, #ffffff30, transparent 2px, transparent calc(100% - 2px), #0004);\n    --ui-toolbar-finish:\n      var(--ui-composite),\n      linear-gradient(180deg, #ffffff1a, transparent 3px, transparent calc(100% - 2px), #0004);\n    --ui-action-depth: inset 1px 1px 0 #ffffff1c, inset -1px -2px 0 #0006, 0 2px 0 var(--ui-shadow);\n    --ui-hover-depth:\n      inset 0 -2px 0 currentColor, inset 0 1px 0 #ffffff30, 0 2px 0 var(--ui-shadow),\n      0 2px 7px color-mix(in srgb, currentColor 12%, transparent);\n    --ui-selected-depth: inset 0 1px 0 #ffffff40, inset 0 -2px 0 #0004, 0 1px 0 var(--ui-shadow);\n    --ui-inset-depth: inset 0 2px 3px #0007, inset 0 -1px 0 #ffffff1c;\n    --ui-input-hover-depth: inset 0 2px 3px #0007, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish:\n      linear-gradient(180deg, #ffffff50, transparent 2px, transparent calc(100% - 2px), #0004),\n      linear-gradient(90deg, transparent 0 40%, #0004 40% 50%, transparent 50%) center / 10px 60%\n        no-repeat;\n  }\n\n  /* LCD controls are monochrome molded keys; the display pixel matrix stays\n     inside the recessed readout. No grain or fake bloom on text. */\n  [data-theme-material='lcd'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish: linear-gradient(\n      180deg,\n      #ffffff35,\n      transparent 2px,\n      transparent calc(100% - 3px),\n      #00000022\n    );\n    --ui-hover-finish: linear-gradient(\n      180deg,\n      #ffffff55,\n      transparent 2px,\n      transparent calc(100% - 3px),\n      #00000022\n    );\n    --ui-selected-finish: linear-gradient(\n      180deg,\n      #00000022,\n      transparent 2px,\n      transparent calc(100% - 2px),\n      #ffffff25\n    );\n    --ui-toolbar-finish: linear-gradient(\n      180deg,\n      #ffffff30,\n      transparent 2px,\n      transparent calc(100% - 2px),\n      #00000018\n    );\n    --ui-action-depth:\n      inset 1px 1px 0 #ffffff45, inset -1px -2px 0 #00000035,\n      0 2px 0 color-mix(in srgb, var(--iw-line) 70%, transparent);\n    --ui-hover-depth:\n      inset 0 0 0 1px currentColor, inset 0 1px 0 #ffffff45,\n      0 2px 0 color-mix(in srgb, var(--iw-line) 70%, transparent);\n    --ui-selected-depth: inset 0 2px 2px #0004, inset 0 -1px 0 #ffffff35;\n    --ui-inset-depth: inset 0 2px 3px #00000040, inset 0 -1px 0 #ffffff40;\n    --ui-input-hover-depth: inset 0 2px 3px #00000040, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish:\n      linear-gradient(180deg, #ffffff50, transparent 2px, transparent calc(100% - 2px), #0003),\n      linear-gradient(90deg, transparent 0 42%, #0004 42% 52%, transparent 52%) center / 10px 65%\n        no-repeat;\n  }\n\n  /* The variants inherit the full material contract but keep their own finish:\n     carved obsidian, anodized command consoles, and dark waxed timber. */\n  [data-theme-finish='obsidian-reliquary'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-control-finish:\n      var(--ui-metal), linear-gradient(135deg, #ffffff18 0 3px, transparent 3px),\n      linear-gradient(180deg, #ffffff20 0 2px, transparent 2px, transparent calc(100% - 3px), #0005);\n    --ui-hover-finish:\n      var(--ui-metal), linear-gradient(135deg, #ffffff30 0 3px, transparent 3px),\n      linear-gradient(180deg, #ffffff30 0 2px, transparent 3px, transparent calc(100% - 3px), #0005);\n    --ui-active-finish:\n      var(--ui-metal), linear-gradient(135deg, #0004 0 3px, transparent 3px),\n      linear-gradient(180deg, #0005, transparent 3px, transparent calc(100% - 2px), #ffffff25);\n    --ui-selected-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff30 0 2px, transparent 2px, transparent calc(100% - 2px), #0004);\n    --ui-toolbar-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff18 0 2px, transparent 2px, transparent calc(100% - 3px), #0005);\n    --ui-action-depth: inset 2px 2px 0 #ffffff18, inset -2px -2px 0 #0006, 0 3px 0 var(--ui-shadow);\n    --ui-hover-depth:\n      inset 2px 2px 0 currentColor, inset -2px -2px 0 #0007, 0 3px 0 var(--ui-shadow);\n    --ui-selected-depth:\n      inset 2px 2px 0 #ffffff35, inset -2px -2px 0 #0005, 0 1px 0 var(--ui-shadow);\n    --ui-thumb-finish:\n      linear-gradient(135deg, #ffffff40 0 3px, transparent 3px),\n      linear-gradient(180deg, #ffffff25, transparent 2px, transparent calc(100% - 2px), #0005);\n  }\n  [data-theme-finish='deep-space'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-control-finish:\n      var(--ui-composite),\n      linear-gradient(180deg, #ffffff30 0 1px, transparent 3px, transparent calc(100% - 3px), #0006);\n    --ui-hover-finish:\n      var(--ui-composite),\n      linear-gradient(180deg, #ffffff45, transparent 3px, transparent calc(100% - 3px), #0006);\n    --ui-action-depth: inset 0 1px 0 #ffffff25, inset 0 -2px 0 #0007, 0 2px 0 var(--ui-shadow);\n    --ui-hover-depth:\n      inset 0 -2px 0 currentColor, inset 0 1px 0 #ffffff40, 0 2px 0 var(--ui-shadow);\n    --ui-selected-depth: inset 0 1px 0 #ffffff40, inset 0 -2px 0 #0005, 0 1px 0 var(--ui-shadow);\n    --ui-thumb-finish:\n      linear-gradient(90deg, transparent 0 40%, #0006 40% 48%, #ffffff40 48% 56%, transparent 56%)\n        center / 12px 65% no-repeat,\n      linear-gradient(180deg, #ffffff55, transparent 2px, transparent calc(100% - 2px), #0005);\n  }\n  [data-theme-finish='moonlit-grove'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-control-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #ffffff25, transparent 3px, transparent calc(100% - 3px), #0005);\n    --ui-hover-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #ffffff40, transparent 3px, transparent calc(100% - 3px), #0005);\n    --ui-action-depth: inset 1px 1px 0 #ffffff22, inset -1px -2px 0 #0006, 0 3px 0 var(--ui-shadow);\n    --ui-hover-depth: inset 0 2px 0 currentColor, inset 0 -2px 0 #0006, 0 3px 0 var(--ui-shadow);\n    --ui-selected-depth: inset 0 2px 2px #0005, inset 0 -1px 0 #ffffff30, 0 1px 0 var(--ui-shadow);\n    --ui-inset-depth: inset 0 2px 3px #0006, inset 0 -1px 0 #ffffff25;\n    --ui-input-hover-depth: inset 0 2px 3px #0006, inset 0 -1px 0 var(--iw-control-line);\n  }\n\n  /* Texture-free systems have structural states. These are not decoration and\n     remain when decorative detail is Off; high contrast has its own painter. */\n  [data-theme-material='classic'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish: none;\n    --ui-hover-finish: none;\n    --ui-active-finish: none;\n    --ui-selected-finish: none;\n    --ui-toolbar-finish: none;\n    --ui-thumb-finish: none;\n    --ui-panel-depth:\n      inset 1px 1px #fff, inset 2px 2px #dfdfdf, inset -1px -1px #000, inset -2px -2px #808080,\n      2px 2px 0 #0005;\n    --ui-action-depth:\n      inset 1px 1px #fff, inset 2px 2px #dfdfdf, inset -1px -1px #404040, inset -2px -2px #808080;\n    --ui-hover-depth: var(--ui-action-depth);\n    --ui-pressed-depth: inset 1px 1px #404040, inset 2px 2px #808080, inset -1px -1px #fff;\n    --ui-selected-depth: var(--ui-pressed-depth);\n    --ui-inset-depth: inset 1px 1px #808080, inset 2px 2px #404040, inset -1px -1px #fff;\n    --ui-input-hover-depth: var(--ui-inset-depth);\n    --ui-gallery-depth: var(--ui-action-depth);\n  }\n  [data-theme-material='terminal'][data-theme-contrast='normal'] {\n    --ui-control-finish: none;\n    --ui-hover-finish: none;\n    --ui-active-finish: none;\n    --ui-selected-finish: none;\n    --ui-inset-finish: none;\n    --ui-toolbar-finish: none;\n    --ui-thumb-finish: none;\n    --ui-panel-depth: inset 0 0 0 1px var(--iw-panel), inset 0 0 0 2px var(--iw-control-line);\n    --ui-action-depth: 0 0 0 0 transparent;\n    --ui-hover-depth: inset 2px 0 currentColor, inset -2px 0 currentColor;\n    --ui-pressed-depth: inset 0 0 0 1px currentColor;\n    --ui-selected-depth: inset 2px 0 currentColor, inset -2px 0 currentColor;\n    --ui-inset-depth: inset 0 -1px 0 var(--iw-control-line);\n    --ui-input-hover-depth: inset 0 -2px 0 var(--iw-control-line);\n    --ui-gallery-depth: none;\n  }\n  [data-theme-material='legacy'][data-theme-styled='true'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish: none;\n    --ui-control-finish: none;\n    --ui-hover-finish: none;\n    --ui-active-finish: none;\n    --ui-selected-finish: none;\n    --ui-toolbar-finish: none;\n    --ui-thumb-finish: none;\n    --ui-panel-depth:\n      inset 0 1px 0 #ffffff14, inset 0 -2px 0 #0006, 0 3px 0 var(--ui-shadow), 0 8px 16px #0003;\n    --ui-action-depth: inset 0 1px 0 #ffffff20, inset 0 -2px 0 #0005, 0 2px 0 var(--ui-shadow);\n    --ui-hover-depth:\n      inset 0 -2px 0 currentColor, inset 0 1px 0 #ffffff30, 0 2px 0 var(--ui-shadow);\n    --ui-pressed-depth: inset 0 2px 2px #0006, inset 0 -1px 0 #ffffff25;\n    --ui-selected-depth: inset 2px 0 currentColor, inset 0 -2px 0 #0004;\n    --ui-inset-depth: inset 0 2px 3px #0006, inset 0 -1px 0 #ffffff20;\n    --ui-input-hover-depth: inset 0 2px 3px #0006, inset 0 -1px 0 var(--iw-control-line);\n    --ui-gallery-depth: var(--ui-action-depth);\n  }\n}\n\n/* Mechanical travel is an input response, never an idle animation. Both\n   motion preferences opt in; nested flat/HC specimens keep their own reset. */\n@media (prefers-reduced-motion: no-preference) and (forced-colors: none) {\n  [data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'][data-theme-motion='full'] {\n    --ui-press-travel: var(--ui-material-travel);\n  }\n  [data-theme-material='steel'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'][data-theme-motion='full'] {\n    --ui-press-travel: 0 2px;\n  }\n}\n";
// END SHARED SIM ASSETS

/** Observer-only, bounded input history. Coordinates stay normalized and current dots stay host-owned. */
export function mountStickTrace(element, { center = 90, travel = 60 } = {}) {
  const ns = 'http://www.w3.org/2000/svg',
    doc = element.ownerDocument,
    ownedSVG = element.namespaceURI !== ns,
    make = (name, attributes) => {
      const node = doc.createElementNS(ns, name);
      for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value));
      return node;
    },
    canvas = ownedSVG
      ? make('svg', {
          class: 'sim-stick-trace',
          viewBox: `0 0 ${center * 2} ${center * 2}`,
          'aria-hidden': 'true',
          focusable: 'false',
        })
      : element,
    group = make('g', { class: 'sim-stick-trace-history', 'aria-hidden': 'true' }),
    line = make('polyline', { class: 'sim-stick-trace-path', fill: 'none' }),
    origin = make('circle', { class: 'sim-stick-trace-origin', r: 2.8, fill: 'none' }),
    arrow = make('path', { class: 'sim-stick-trace-arrow', fill: 'none' });
  group.style.pointerEvents = 'none';
  group.append(line, origin, arrow);
  canvas.append(group);
  if (ownedSVG) element.insertBefore(canvas, element.querySelector('i') ?? element.firstChild);
  let history = [],
    previous = null,
    directionPoint = null,
    tangent = null,
    previousSource = null,
    lastMotion = 0,
    disposed = false;
  const attr = (node, key, value) => {
    const text = String(value);
    if (node.getAttribute(key) !== text) node.setAttribute(key, text);
  };
  const reset = () => {
    history = [];
    previous = null;
    directionPoint = null;
    tangent = null;
    previousSource = null;
    group.style.display = 'none';
    attr(line, 'points', '');
    attr(arrow, 'd', '');
  };
  reset();
  return {
    update({ x, y, now, source = 'live', reducedMotion = false, available = true }) {
      if (disposed) return;
      if (!available || reducedMotion || ![x, y, now].every(Number.isFinite)) {
        reset();
        return;
      }
      if (source !== previousSource || (previous && now < previous.time)) reset();
      previousSource = source;
      attr(
        group,
        'data-source',
        source === 'example' || String(source).startsWith('example:') ? 'example' : source,
      );
      const point = {
        x: Math.max(-1, Math.min(1, x)),
        y: Math.max(-1, Math.min(1, y)),
        time: now,
      };
      history = history.filter((sample) => now - sample.time <= 450);
      if (!directionPoint) {
        directionPoint = point;
        lastMotion = now;
      } else if (Math.hypot(point.x - directionPoint.x, point.y - directionPoint.y) > 0.002) {
        const nextTangent = { x: point.x - directionPoint.x, y: directionPoint.y - point.y };
        // Preserve a real reversal even when it falls between regular history samples.
        if (
          tangent &&
          tangent.x * nextTangent.x + tangent.y * nextTangent.y < 0 &&
          now - directionPoint.time <= 450 &&
          history.at(-1) !== directionPoint
        )
          history.push(directionPoint);
        tangent = nextTangent;
        directionPoint = point;
        lastMotion = now;
      }
      previous = point;
      const last = history.at(-1);
      // Sample every 40 ms plus reversals; the unsmoothed current endpoint is always included.
      if (
        !last ||
        (now - last.time >= 40 && Math.hypot(point.x - last.x, point.y - last.y) > 0.002)
      )
        history.push(point);
      if (history.length > 11) history.splice(0, history.length - 11);
      const points = [...history];
      if (points.at(-1) !== point) points.push(point);
      const distance = points
        .slice(1)
        .reduce(
          (sum, sample, index) =>
            sum + Math.hypot(sample.x - points[index].x, sample.y - points[index].y),
          0,
        );
      if (distance < 0.025 || now - lastMotion >= 450) {
        group.style.display = 'none';
        attr(line, 'points', '');
        attr(arrow, 'd', '');
        return;
      }
      const projected = points.map((sample) => ({
        x: center + sample.x * travel,
        y: center - sample.y * travel,
      }));
      attr(
        line,
        'points',
        projected.map((sample) => `${sample.x.toFixed(2)},${sample.y.toFixed(2)}`).join(' '),
      );
      attr(origin, 'cx', projected[0].x.toFixed(2));
      attr(origin, 'cy', projected[0].y.toFixed(2));
      const end = projected.at(-1);
      if (tangent) {
        // This is a direction cue, not additional travel: keep it separate from the exact dot.
        const length = Math.hypot(tangent.x, tangent.y),
          dx = tangent.x / length,
          dy = tangent.y / length,
          tip = { x: end.x - dx * 8, y: end.y - dy * 8 };
        attr(
          arrow,
          'd',
          `M ${(tip.x - dx * 5 - dy * 3).toFixed(2)} ${(tip.y - dy * 5 + dx * 3).toFixed(2)} L ${tip.x.toFixed(2)} ${tip.y.toFixed(2)} L ${(tip.x - dx * 5 + dy * 3).toFixed(2)} ${(tip.y - dy * 5 - dx * 3).toFixed(2)}`,
        );
      } else attr(arrow, 'd', '');
      group.style.display = '';
      group.style.opacity = String(Math.min(1, (450 - (now - lastMotion)) / 200));
    },
    reset,
    dispose() {
      if (disposed) return;
      reset();
      disposed = true;
      (ownedSVG ? canvas : group).remove();
    },
  };
}

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

// BEGIN GENERATED ACADEMY SHARED AUDIO
// Generated by scripts/refresh-fpv-academy-audio.mjs; edit canonical audio sources instead.
// No new package files, recordings, gameplay clocks or simulation state.
import * as academyAudioExternal0 from '../../game/i18n/index.mjs';
export const createSimFlightAudio = (() => {
  const sourceHashes = Object.freeze({
    'optional-practice/civilian-fpv/world-audio.mjs':
      '753913b5070fec47a140236f5f820107254969b122dcf420bf139421546c3fbb',
    'game/audio/dialogue-mix.mjs':
      '43ffa5b261e585e59b515fab19d1b6d0ccf636152ca6107602dbdb9143ddb00a',
    'game/ui/audio-output.mjs': 'dc1b2776407d0b6649b0d15c5c721bd59384d7e38a2e61087961ff7a37bd86c1',
    'game/ui/audio-master.mjs': '6bf14bc5268c0eff8f38c21c819f398917712fdc2607c33977ac873111d1dca8',
    'game/audio-preferences.mjs':
      '9212831a3524c9e1ebe8c595783f9f53a112e02e3d51280d775ac103b94a9239',
    'game/ui/encounter-audio.mjs':
      'de48fc709c99c571e1e2a15e8a5cb1958a53e6404751cc3482255f05c626c519',
    'game/ui/movement-audio.mjs':
      '685d8e458401354028a2cacda0c7b1009b3c1e480a08d4cafce46d8f98b69020',
    'game/ui/dialogue-channel.mjs':
      'f4839f3a1634189a03eed6a3096dc595dfc88ee6437277ee82d78de05c300142',
  });
  const modules = Object.create(null);
  modules['game/audio/dialogue-mix.mjs'] = (() => {
    /** Decorative spoken reactions sit behind music and gameplay warnings.
     * The mix trim also applies to saved slider choices without rewriting preferences. */
    const DEFAULT_DIALOGUE_VOLUME = 0.25;
    const DIALOGUE_MIX_GAIN = 0.4;
    const DIALOGUE_MUSIC_GAIN = 0.9;

    return {
      DEFAULT_DIALOGUE_VOLUME: DEFAULT_DIALOGUE_VOLUME,
      DIALOGUE_MIX_GAIN: DIALOGUE_MIX_GAIN,
      DIALOGUE_MUSIC_GAIN: DIALOGUE_MUSIC_GAIN,
    };
  })();
  modules['game/ui/audio-output.mjs'] = (() => {
    /** Shared output topology for Capture, Snake and native flight presentation.
     * A page owns one context. Construction is called only from its gesture owner. */
    function createGameAudioContext(host = globalThis) {
      const Context = host.AudioContext ?? host.webkitAudioContext;
      return Context ? new Context({ latencyHint: 'interactive' }) : null;
    }

    function createGameAudioOutput(context) {
      const output = {};
      for (const key of [
        'master',
        'musicBus',
        'sfxBus',
        'menuBus',
        'movementBus',
        'radioBus',
        'dialogueBus',
      ])
        output[key] = context.createGain();
      for (const key of ['musicBus', 'sfxBus', 'menuBus', 'dialogueBus'])
        output[key].connect(output.master);
      for (const key of ['movementBus', 'radioBus']) output[key].connect(output.sfxBus);
      output.compressor = context.createDynamicsCompressor?.();
      if (output.compressor) {
        output.compressor.threshold.value = -12;
        output.compressor.knee.value = 12;
        output.compressor.ratio.value = 5;
        output.master.connect(output.compressor);
        output.compressor.connect(context.destination);
      } else output.master.connect(context.destination);
      return output;
    }

    /** Request the same audible iOS playback category before creating/resuming audio. */
    function requestPlaybackAudioSession(audioSession = globalThis.navigator?.audioSession) {
      if (!audioSession || typeof audioSession !== 'object') return false;
      try {
        if (audioSession.type !== 'playback') audioSession.type = 'playback';
        return audioSession.type === 'playback';
      } catch {
        return false;
      }
    }
    function releasePlaybackAudioSession(audioSession = globalThis.navigator?.audioSession) {
      if (!audioSession || typeof audioSession !== 'object') return false;
      try {
        if (audioSession.type === 'playback') audioSession.type = 'auto';
        return audioSession.type !== 'playback';
      } catch {
        return false;
      }
    }

    return {
      createGameAudioContext: createGameAudioContext,
      createGameAudioOutput: createGameAudioOutput,
      requestPlaybackAudioSession: requestPlaybackAudioSession,
      releasePlaybackAudioSession: releasePlaybackAudioSession,
    };
  })();
  modules['game/ui/audio-master.mjs'] = (() => {
    const t = academyAudioExternal0['t'];
    const volumeValue = (value) => {
      if (!Number.isFinite(value) || value < 0 || value > 1)
        throw new TypeError(t('interface:audioVolumeMustBeBetweenZeroAndOne'));
      return value;
    };
    const mutedValue = (value) => {
      if (typeof value !== 'boolean') throw new TypeError(t('interface:audioMuteMustBeABoolean'));
      return value;
    };

    /** Shared output policy only. Hosts retain persistence, gestures and transport. */
    function createAudioMaster({ muted = true, volume = 1 } = {}) {
      let state = Object.freeze({
        muted: mutedValue(muted),
        volume: volumeValue(volume),
        revision: 0,
      });
      let disposed = false;
      const listeners = new Set();
      function publish(next) {
        state = Object.freeze({ ...next, revision: state.revision + 1 });
        const errors = [];
        for (const listener of [...listeners]) {
          if (!listeners.has(listener)) continue;
          try {
            // A preceding observer may have applied a newer explicit intent.
            listener(state);
          } catch (error) {
            errors.push(error);
          }
        }
        if (errors.length)
          throw new AggregateError(errors, t('interface:audioMasterOutputCouldNotBeApplied'));
        return state;
      }
      function change(patch) {
        if (disposed) throw new Error(t('interface:audioMasterIsDisposed'));
        return publish({ ...state, ...patch });
      }
      return Object.freeze({
        snapshot: () => state,
        setMuted: (value) => change({ muted: mutedValue(value) }),
        setVolume: (value) => change({ volume: volumeValue(value) }),
        subscribe(listener) {
          if (disposed) throw new Error(t('interface:audioMasterIsDisposed'));
          if (typeof listener !== 'function')
            throw new TypeError(t('interface:audioMasterListenerRequired'));
          if (listeners.has(listener))
            throw new Error(t('interface:audioMasterListenerAlreadySubscribed'));
          listeners.add(listener);
          try {
            listener(state);
          } catch (error) {
            listeners.delete(listener);
            throw error;
          }
          return () => listeners.delete(listener);
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          try {
            publish({ ...state, muted: true });
          } finally {
            listeners.clear();
          }
        },
      });
    }

    const mediaOwners = new WeakSet();
    /** Native media keeps its own local fader. Queued native events cannot rewrite
     * master or local intent; explicit local controls call setLocal instead. */
    function bindAudioMasterMedia({ audioMaster, element, volume = 1, muted = false } = {}) {
      if (!audioMaster?.snapshot || !audioMaster?.subscribe)
        throw new TypeError(t('interface:audioMasterRequired'));
      if (!element?.addEventListener || !element?.removeEventListener)
        throw new TypeError(t('interface:audioMediaElementRequired'));
      if (mediaOwners.has(element))
        throw new Error(t('interface:audioMediaElementAlreadyHasAMasterOwner'));
      let local = { volume: volumeValue(volume), muted: mutedValue(muted) };
      let master = audioMaster.snapshot();
      let disposed = false;
      let applying = false;
      const attempted = new Map();
      const write = (key, value) => {
        const observed = element[key];
        const previous = attempted.get(key);
        if (observed === value || (previous?.value === value && previous.observed === observed))
          return;
        element[key] = value;
        // Some native platforms ignore/quantize volume. Their queued notification
        // must not cause an endless attempt to write the same unsupported value.
        attempted.set(key, { value, observed: element[key] });
      };
      const apply = () => {
        if (disposed || applying) return;
        const muted = local.muted || master.muted || local.volume === 0 || master.volume === 0;
        const volume = local.volume * master.volume;
        // Setting an unchanged property may still enqueue a native volumechange.
        // Mute first so a simultaneous volume increase cannot escape the gate.
        applying = true;
        try {
          if (muted) write('muted', true);
          write('volume', volume);
          if (!muted) write('muted', false);
        } finally {
          applying = false;
        }
      };
      mediaOwners.add(element);
      let unsubscribe;
      try {
        unsubscribe = audioMaster.subscribe((next) => {
          master = next;
          apply();
        });
        element.addEventListener('volumechange', apply);
        element.addEventListener('play', apply);
      } catch (error) {
        unsubscribe?.();
        element.removeEventListener('volumechange', apply);
        element.removeEventListener('play', apply);
        mediaOwners.delete(element);
        throw error;
      }
      return Object.freeze({
        setLocal(patch) {
          if (disposed) return;
          if (!patch || typeof patch !== 'object' || Array.isArray(patch))
            throw new TypeError(t('interface:localAudioSettingsRequired'));
          const next = { ...local };
          for (const key of Object.keys(patch)) {
            if (key === 'volume') next.volume = volumeValue(patch.volume);
            else if (key === 'muted') next.muted = mutedValue(patch.muted);
            else throw new TypeError(t('interface:unknownLocalAudioSetting'));
          }
          local = next;
          apply();
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          unsubscribe();
          element.removeEventListener('volumechange', apply);
          element.removeEventListener('play', apply);
          mediaOwners.delete(element);
          if (element.muted !== true) element.muted = true;
        },
      });
    }

    return { createAudioMaster: createAudioMaster, bindAudioMasterMedia: bindAudioMasterMedia };
  })();
  modules['game/audio-preferences.mjs'] = (() => {
    const AUDIO_PREFERENCES_KEY = 'revealline.audio-master.v1';
    const MAX_RECORD_LENGTH = 256;

    function values(value) {
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).length !== 2 ||
        !Object.hasOwn(value, 'muted') ||
        !Object.hasOwn(value, 'volume') ||
        typeof value.muted !== 'boolean' ||
        !Number.isFinite(value.volume) ||
        value.volume < 0 ||
        value.volume > 1
      )
        throw new TypeError(
          'Audio preferences require a mute boolean and volume between zero and one.',
        );
      return { muted: value.muted, volume: value.volume };
    }

    function decode(raw) {
      if (typeof raw !== 'string' || raw.length > MAX_RECORD_LENGTH) return null;
      try {
        return values(JSON.parse(raw));
      } catch {
        return null;
      }
    }

    /** Page-owned persistence for the shared output authority. This adapter never
     * starts media or writes a player profile. Only its explicit setters save. */
    function createAudioPreferences({
      audioMaster,
      getStorage = () => globalThis.localStorage,
      window: eventTarget = globalThis,
      fallback = { muted: true, volume: 0.65 },
      writable = () => true,
      onWarning = () => {},
    } = {}) {
      const initial = values(fallback);
      let disposed = false,
        explicit = false,
        stored = false,
        unsaved = false,
        warning = '';
      const notify = (message) => {
        warning = message;
        try {
          onWarning(message);
        } catch {
          // A notice cannot prevent the synchronous sound change.
        }
      };
      const read = () => {
        try {
          const storage = getStorage(),
            raw = storage?.getItem(AUDIO_PREFERENCES_KEY);
          return { storage, raw, value: decode(raw) };
        } catch {
          return { storage: null, raw: null, value: null };
        }
      };
      const apply = (record) => {
        let revision = audioMaster.snapshot().revision;
        // Close the mute gate before increasing volume; open it after the fader.
        for (const key of record.muted ? ['muted', 'volume'] : ['volume', 'muted']) {
          const current = audioMaster.snapshot();
          if (disposed || current.revision !== revision) return false;
          if (current[key] === record[key]) continue;
          audioMaster[key === 'muted' ? 'setMuted' : 'setVolume'](record[key]);
          revision++;
          // A subscriber's newer intent must also win over this synchronous seed.
          if (audioMaster.snapshot().revision !== revision) return false;
        }
        return true;
      };
      let seedRevision = audioMaster.snapshot().revision;
      explicit = seedRevision !== 0;
      const first = read();
      if (first.value) {
        stored = true;
        apply(first.value);
      } else if (seedRevision === 0 && apply(initial)) {
        seedRevision = audioMaster.snapshot().revision;
      }
      const persist = () => {
        try {
          const allowed = writable();
          if (disposed) return;
          if (!allowed) {
            unsaved = true;
            notify('Sound changes apply only to this session; saving is disabled here.');
            return;
          }
          const { muted, volume } = audioMaster.snapshot(),
            storage = getStorage();
          if (disposed) return;
          if (!storage) throw new Error('Storage unavailable.');
          storage.setItem(AUDIO_PREFERENCES_KEY, JSON.stringify(values({ muted, volume })));
          if (disposed) return;
          stored = true;
          unsaved = false;
          notify('');
        } catch {
          if (disposed) return;
          unsaved = true;
          notify('Sound changed for this session, but could not be saved for another page.');
        }
      };
      const change = (key, value) => {
        if (disposed) throw new Error('Audio preferences are disposed.');
        const before = audioMaster.snapshot();
        values({ muted: before.muted, volume: before.volume, [key]: value });
        explicit = true;
        try {
          audioMaster[key === 'muted' ? 'setMuted' : 'setVolume'](value);
        } finally {
          // Output listeners may throw after the authority accepted the intent.
          if (!disposed && audioMaster.snapshot().revision !== before.revision) persist();
        }
        return audioMaster.snapshot();
      };
      const receive = (event) => {
        if (disposed || unsaved || event.key !== AUDIO_PREFERENCES_KEY) return;
        const revision = audioMaster.snapshot().revision,
          current = read();
        if (
          disposed ||
          unsaved ||
          audioMaster.snapshot().revision !== revision ||
          !current.storage ||
          event.storageArea !== current.storage ||
          event.newValue !== current.raw ||
          !current.value
        )
          return;
        stored = true;
        apply(current.value);
      };
      // Reconcile a restored page with fresh storage rather than a missed event's
      // payload, without discarding local intent that could not be saved.
      const restored = (event) => {
        if (disposed || unsaved || event.persisted !== true) return;
        const revision = audioMaster.snapshot().revision,
          current = read();
        if (disposed || unsaved || audioMaster.snapshot().revision !== revision || !current.value)
          return;
        stored = true;
        apply(current.value);
      };
      eventTarget?.addEventListener?.('storage', receive);
      eventTarget?.addEventListener?.('pageshow', restored);
      return Object.freeze({
        setMuted: (value) => change('muted', value),
        setVolume: (value) => change('volume', value),
        seed(candidate) {
          if (disposed || stored || explicit || audioMaster.snapshot().revision !== seedRevision)
            return false;
          const current = read();
          if (current.value) {
            stored = true;
            apply(current.value);
            return false;
          }
          if (!apply(values(candidate))) return false;
          seedRevision = audioMaster.snapshot().revision;
          return true;
        },
        getWarning: () => warning,
        dispose() {
          if (disposed) return;
          disposed = true;
          eventTarget?.removeEventListener?.('storage', receive);
          eventTarget?.removeEventListener?.('pageshow', restored);
        },
      });
    }

    return {
      AUDIO_PREFERENCES_KEY: AUDIO_PREFERENCES_KEY,
      createAudioPreferences: createAudioPreferences,
    };
  })();
  modules['game/ui/encounter-audio.mjs'] = (() => {
    /** Shared semantic cues; both recorded and offline procedural renditions use
     * these recipes. No context, clock, randomness or actor mutation lives here. */
    const FAMILY_PITCH = Object.freeze({
      lookout: 1.1,
      patroller: 0.94,
      runner: 1.06,
      sprinter: 1.18,
      courier: 1.24,
      guard: 0.84,
      refuge: 0.98,
      switchback: 1.14,
      pair: 1.04,
      shield: 0.72,
      brace: 0.68,
      'refuge-seeker': 0.98,
      'rendezvous-pair': 1.04,
      'shield-bearer': 0.72,
      'brace-trooper': 0.68,
      'relay-warden': 0.62,
    });
    // Original material accents reuse the admitted bank. Cadence follows observed
    // movement, never a sprite frame, random choice or simulation mutation.
    const ACTOR_SOUNDS = Object.freeze({
      runner: Object.freeze({ cadence: 0.32, rate: 1.08, equipment: 'paper', from: 240, to: 150 }),
      courier: Object.freeze({
        cadence: 0.29,
        rate: 1.19,
        equipment: 'ratchet',
        from: 360,
        to: 210,
      }),
      guard: Object.freeze({
        cadence: 0.41,
        rate: 0.87,
        equipment: 'contact-metal',
        from: 210,
        to: 90,
      }),
      shield: Object.freeze({
        cadence: 0.48,
        rate: 0.7,
        equipment: 'contact-metal',
        from: 135,
        to: 48,
      }),
    });
    function actorSoundProfile(family) {
      return ACTOR_SOUNDS[family === 'shield-bearer' ? 'shield' : family] ?? ACTOR_SOUNDS.runner;
    }
    function encounterSoundRecipe(type, details = {}) {
      const pitch = FAMILY_PITCH[details.family] ?? 1;
      const actor = actorSoundProfile(details.family),
        tracked = details.machine === 'tracked',
        metal =
          details.material === 'metal' || [true, 'tracked', 'wheeled'].includes(details.machine);
      const brutal = details.brutal === true;
      const recipes = {
        step: ['grain', 0.11, 0, 130 * actor.rate, 65 * actor.rate, 0.055],
        equipment: [actor.equipment, 0.12, 1, actor.from, actor.to, 0.085],
        drive: [
          tracked ? 'ratchet' : 'wheels',
          0.17,
          1,
          tracked ? 110 : 210,
          tracked ? 48 : 90,
          0.16,
        ],
        notice: ['switch', 0.17, 2, 360, 520, 0.09],
        warning: ['warning', 0.44, 5, 620, 860, 0.13],
        burst: ['paper', 0.19, 2, 190, 320, 0.09],
        recover: ['cancel', 0.13, 1, 310, 210, 0.08],
        blocked: ['contact-soft', 0.1, 1, 150, 100, 0.055],
        catch: [
          metal ? 'contact-metal' : 'contact-soft',
          brutal ? 0.52 : 0.25,
          3,
          metal ? 150 : 390,
          metal ? 55 : 690,
          brutal ? 0.19 : 0.1,
        ],
        fire: ['attack', 0.34, 4, 620, 110, 0.08],
        impact: ['impact', 0.48, 5, 170, 38, 0.15],
        pulse: ['deploy', 0.33, 3, 880, 260, 0.19],
        reel: ['ratchet', 0.3, 3, 220, 510, 0.16],
        supply: ['pickup', 0.2, 2, 520, 780, 0.09],
        shutter: [
          details.closed ? 'closure' : 'gate',
          0.22,
          3,
          details.closed ? 360 : 260,
          details.closed ? 160 : 520,
          0.13,
        ],
        objective: ['confirm', 0.4, 4, 660, 990, 0.18],
        failure: ['loss', 0.42, 5, 260, 65, 0.23],
      };
      const row = recipes[type];
      if (!row) return null;
      const [name, gain, priority, from, to, duration] = row;
      const scale = Number.isFinite(details.gainScale)
        ? Math.max(0, Math.min(1, details.gainScale))
        : 1;
      const movement = ['step', 'equipment', 'drive'].includes(type);
      return {
        name,
        gain: gain * scale,
        priority,
        movement,
        // Loop textures are deliberately sampled as short envelopes for footsteps.
        maxDuration: movement ? duration : null,
        cooldown:
          type === 'step'
            ? actor.cadence
            : type === 'equipment'
              ? 0.7
              : type === 'drive'
                ? 1.2
                : null,
        rate: type === 'step' ? actor.rate : pitch,
        tone: {
          from: from * pitch,
          to: to * pitch,
          duration,
          gain: gain * scale * 0.14,
          type: metal || type === 'equipment' ? 'triangle' : 'sine',
        },
      };
    }

    /** Phase changes are incidental cues; blocked/idling actors never emit per frame. */
    function actorPhaseSound(previous, next) {
      if (!previous || previous === next) return null;
      if (['warning', 'telegraph', 'turning'].includes(next)) return 'warning';
      if (['burst', 'dash'].includes(next)) return 'burst';
      if (['recover', 'recovering', 'recovery', 'rest'].includes(next)) return 'recover';
      if (next === 'blocked') return 'blocked';
      if (['flee', 'fleeing', 'notice', 'committed'].includes(next)) return 'notice';
      return null;
    }

    return {
      actorSoundProfile: actorSoundProfile,
      encounterSoundRecipe: encounterSoundRecipe,
      actorPhaseSound: actorPhaseSound,
    };
  })();
  modules['game/ui/movement-audio.mjs'] = (() => {
    const MOVEMENT_AUDIO_KEY = 'revealline.movement-audio.v1';
    function readMovementAudio(storage) {
      try {
        storage ??= globalThis.localStorage;
        const value = JSON.parse(storage?.getItem(MOVEMENT_AUDIO_KEY) ?? 'null');
        return {
          enabled: typeof value?.enabled === 'boolean' ? value.enabled : true,
          volume:
            Number.isFinite(value?.volume) && value.volume >= 0 && value.volume <= 1
              ? value.volume
              : 0.5,
        };
      } catch {
        return { enabled: true, volume: 0.5 };
      }
    }

    return { MOVEMENT_AUDIO_KEY: MOVEMENT_AUDIO_KEY, readMovementAudio: readMovementAudio };
  })();
  modules['game/ui/dialogue-channel.mjs'] = (() => {
    /** One spoken line per page, including radio and Studio auditions. */
    let active = null;
    const dialogueChannel = Object.freeze({
      get active() {
        return active;
      },
      claim(voice) {
        if (active !== voice) active?.stop();
        active = voice;
      },
      release(voice) {
        if (active === voice) active = null;
      },
      interrupt() {
        active?.stop();
      },
      snapshot() {
        return Object.freeze({
          voices: active ? 1 : 0,
          kind: active?.radio ? 'radio' : active ? 'dialogue' : null,
        });
      },
    });

    return { dialogueChannel: dialogueChannel };
  })();
  modules['optional-practice/civilian-fpv/world-audio.mjs'] = (() => {
    const DEFAULT_DIALOGUE_VOLUME =
      modules['game/audio/dialogue-mix.mjs']['DEFAULT_DIALOGUE_VOLUME'];
    const DIALOGUE_MIX_GAIN = modules['game/audio/dialogue-mix.mjs']['DIALOGUE_MIX_GAIN'];
    const createGameAudioContext = modules['game/ui/audio-output.mjs']['createGameAudioContext'];
    const createGameAudioOutput = modules['game/ui/audio-output.mjs']['createGameAudioOutput'];
    const requestPlaybackAudioSession =
      modules['game/ui/audio-output.mjs']['requestPlaybackAudioSession'];
    const releasePlaybackAudioSession =
      modules['game/ui/audio-output.mjs']['releasePlaybackAudioSession'];
    const createAudioMaster = modules['game/ui/audio-master.mjs']['createAudioMaster'];
    const createAudioPreferences = modules['game/audio-preferences.mjs']['createAudioPreferences'];
    const encounterSoundRecipe = modules['game/ui/encounter-audio.mjs']['encounterSoundRecipe'];
    const actorPhaseSound = modules['game/ui/encounter-audio.mjs']['actorPhaseSound'];
    const readMovementAudio = modules['game/ui/movement-audio.mjs']['readMovementAudio'];
    const MOVEMENT_AUDIO_KEY = modules['game/ui/movement-audio.mjs']['MOVEMENT_AUDIO_KEY'];
    const dialogueChannel = modules['game/ui/dialogue-channel.mjs']['dialogueChannel'];

    /** Optional presentation-only sound. No media requests or gameplay clocks. */
    const PREFERENCE = 'revealline.fpv.world-audio.v1';
    const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
    const AMBIENCES = {
      hangar: { filter: 380, gain: 0.013, hum: 74, humGain: 0.006 },
      woodland: { filter: 1250, gain: 0.023, hum: 156, humGain: 0.002 },
      stadium: { filter: 730, gain: 0.016, hum: 110, humGain: 0.008 },
      industrial: { filter: 220, gain: 0.024, hum: 58, humGain: 0.009 },
    };

    function createWorldAudio(options = {}) {
      const host = options.window ?? globalThis.window ?? globalThis;
      let storage;
      try {
        storage = options.storage ?? host.localStorage;
      } catch {
        // Sound works for this visit even when browser preferences are unavailable.
      }
      const AudioContext = host.AudioContext ?? host.webkitAudioContext;
      let enabled = false;
      try {
        enabled = storage?.getItem(PREFERENCE) === 'on';
      } catch {
        // Muted is the default when preferences cannot be read.
      }
      let context;
      let graph;
      let disposed = false;
      let wanted = false;
      let transition = 0;
      let lastPlaying = false;
      let lastTick = null;
      let lastStep = null;
      let lastContacts = null;
      let ambience = AMBIENCES.hangar;
      let motorStyle = 'quad';
      let gateStyle = 'chime';
      let dialogue = { enabled: false, volume: DEFAULT_DIALOGUE_VOLUME };
      let dialogueVoice = null;
      const effects = new Set();
      const audioMaster = options.audioMaster ?? createAudioMaster();
      const preferences =
        options.audioPreferences ??
        createAudioPreferences({
          audioMaster,
          getStorage: () => storage,
          window: host,
          fallback: options.audioMaster
            ? { muted: audioMaster.snapshot().muted, volume: audioMaster.snapshot().volume }
            : { muted: !enabled, volume: 0.65 },
        });
      let movement = readMovementAudio(storage);
      let masterState = audioMaster.snapshot();
      enabled = !masterState.muted;
      const applyOutput = () => {
        if (!graph || context.state === 'closed') return;
        graph.master.gain.cancelScheduledValues(context.currentTime);
        graph.master.gain.setValueAtTime(enabled ? masterState.volume : 0, context.currentTime);
        graph.output.movementBus.gain.setTargetAtTime(
          movement.enabled ? movement.volume : 0,
          context.currentTime,
          0.025,
        );
      };
      const releaseMaster = audioMaster.subscribe((value) => {
        masterState = value;
        enabled = !value.muted;
        if (!enabled || value.volume === 0) silence();
        applyOutput();
      });
      const changed = (event) => {
        if (event.key === MOVEMENT_AUDIO_KEY) {
          movement = readMovementAudio(storage);
          applyOutput();
        }
      };
      host.addEventListener?.('storage', changed);
      const recentCues = new Map();
      let actorDefinitions = new Map();
      let actorPositions = new Map();
      let actorPhases = new Map();
      let actorFamilies = new Map();
      let lastFootstep = -Infinity;

      const volume = (value) =>
        typeof value === 'number' && Number.isFinite(value) ? clamp(value, 0, 1) : 1;
      let levels = Object.fromEntries(
        ['interface', 'motor', 'ambience'].map((key) => [key, volume(options.volumes?.[key])]),
      );

      function ramp(parameter, value, seconds = 0.04) {
        parameter.setTargetAtTime(value, context.currentTime, seconds);
      }

      function stopEffects() {
        for (const effect of effects) effect.stop();
        effects.clear();
      }

      function silence() {
        dialogueVoice?.stop();
        if (!graph || context.state === 'closed') return;
        for (const node of [graph.motor, graph.vehicleGain, graph.wind, graph.humGain]) {
          node.gain.cancelScheduledValues(context.currentTime);
          node.gain.setValueAtTime(0, context.currentTime);
        }
        stopEffects();
      }

      function initialize() {
        if (context) return true;
        if (!AudioContext || disposed) return false;
        let candidate;
        try {
          candidate = createGameAudioContext(host);
          const output = createGameAudioOutput(candidate);
          const master = output.master;
          master.gain.value = enabled ? masterState.volume : 0;
          output.movementBus.gain.value = movement.enabled ? movement.volume : 0;
          const buses = Object.fromEntries(
            Object.entries(levels).map(([key, level]) => {
              const bus = candidate.createGain();
              bus.gain.value = level;
              bus.connect(key === 'motor' ? output.movementBus : output.sfxBus);
              return [key, bus];
            }),
          );
          const dialogueBus = output.dialogueBus;
          dialogueBus.gain.value = dialogue.enabled ? dialogue.volume * DIALOGUE_MIX_GAIN : 0;
          const motor = candidate.createGain();
          motor.gain.value = 0;
          const motorFilter = candidate.createBiquadFilter();
          motorFilter.type = 'lowpass';
          motorFilter.frequency.value = 1200;
          motor.connect(motorFilter).connect(buses.motor);
          const rotors = [1, 1.013, 2.007].map((ratio, index) => {
            const oscillator = candidate.createOscillator();
            oscillator.type = index === 2 ? 'sine' : 'triangle';
            oscillator.frequency.value = 90 * ratio;
            oscillator.connect(motor);
            oscillator.start();
            return { oscillator, ratio };
          });

          // A small, locally synthesized loop avoids remote media and autoplay fetches.
          const buffer = candidate.createBuffer(1, candidate.sampleRate * 2, candidate.sampleRate);
          const samples = buffer.getChannelData(0);
          let seed = 73471;
          let low = 0;
          for (let i = 0; i < samples.length; i++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            low = 0.985 * low + 0.015 * (seed / 2147483648 - 1);
            samples[i] = low * 4;
          }
          const noise = candidate.createBufferSource();
          noise.buffer = buffer;
          noise.loop = true;
          const windFilter = candidate.createBiquadFilter();
          windFilter.type = 'lowpass';
          windFilter.frequency.value = ambience.filter;
          const wind = candidate.createGain();
          wind.gain.value = 0;
          noise.connect(windFilter).connect(wind).connect(buses.ambience);
          noise.start();
          const hum = candidate.createOscillator();
          hum.type = 'sine';
          hum.frequency.value = ambience.hum;
          const humGain = candidate.createGain();
          humGain.gain.value = 0;
          hum.connect(humGain).connect(buses.ambience);
          hum.start();
          const vehicleMotor = candidate.createOscillator(),
            vehicleGain = candidate.createGain();
          vehicleMotor.type = 'triangle';
          vehicleMotor.frequency.value = 62;
          vehicleGain.gain.value = 0;
          vehicleMotor.connect(vehicleGain).connect(buses.motor);
          vehicleMotor.start();
          context = candidate;
          graph = {
            vehicleMotor,
            vehicleGain,
            output,
            master,
            buses,
            dialogueBus,
            motor,
            motorFilter,
            rotors,
            noise,
            windFilter,
            wind,
            hum,
            humGain,
          };
          return true;
        } catch {
          candidate?.close().catch(() => {});
          return false;
        }
      }

      function tone({
        from,
        to = from,
        duration = 0.12,
        gain = 0.05,
        delay = 0,
        type = 'sine',
        movementCue = false,
        priority = 2,
      }) {
        if (
          !graph ||
          !enabled ||
          masterState.volume === 0 ||
          !levels.interface ||
          !wanted ||
          context.state !== 'running'
        )
          return;
        if (
          movementCue &&
          (!movement.enabled ||
            movement.volume === 0 ||
            [...effects].some((effect) => effect.priority >= 4))
        )
          return;
        if (priority >= 4) for (const effect of [...effects]) if (effect.movementCue) effect.stop();
        if (effects.size >= 12) return;
        const oscillator = context.createOscillator();
        const envelope = context.createGain();
        const start = context.currentTime + delay;
        oscillator.type = type;
        oscillator.frequency.setValueAtTime(from, start);
        oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
        envelope.gain.setValueAtTime(0, context.currentTime);
        envelope.gain.setValueAtTime(0, start);
        envelope.gain.linearRampToValueAtTime(gain, start + 0.008);
        envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
        oscillator
          .connect(envelope)
          .connect(movementCue ? graph.output.movementBus : graph.buses.interface);
        let stopped = false;
        const effect = {
          priority,
          movementCue,
          stop() {
            if (stopped) return;
            stopped = true;
            try {
              oscillator.stop();
            } catch {
              // The one-shot may already have ended before a pause.
            }
            oscillator.disconnect();
            envelope.disconnect();
            effects.delete(effect);
          },
        };
        effects.add(effect);
        oscillator.onended = () => effect.stop();
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
      }

      function cue(type, player = true, event = {}) {
        const kind = {
          catch: 'catch',
          'hunt-tail': 'failure',
          objective: 'objective',
          fire: 'fire',
          impact: 'impact',
          defeat: 'catch',
          'protected-contact': 'impact',
          warning: 'warning',
          notice: 'notice',
          burst: 'burst',
          recover: 'recover',
          blocked: 'blocked',
          equipment: 'equipment',
          drive: 'drive',
        }[type];
        if (!kind) return;
        const actor = actorDefinitions.get(event.actor);
        const machine =
          event.machine ??
          (actor?.type === 'vehicle'
            ? actor.vehicleModel === 'field-tank'
              ? 'tracked'
              : 'wheeled'
            : false);
        const recipe = encounterSoundRecipe(kind, {
          family:
            event.family ??
            actorFamilies.get(event.actor) ??
            (actor?.speed > 0 ? 'patroller' : 'lookout'),
          machine,
        });
        const now = context?.currentTime ?? 0;
        if (now - (recentCues.get(kind) ?? -Infinity) < (recipe.cooldown ?? 0.12)) return;
        recentCues.set(kind, now);
        if (recipe.priority >= 5 || (type === 'fire' && !player)) dialogueChannel.interrupt();
        const voice = { ...recipe.tone, priority: recipe.priority, movementCue: recipe.movement };
        if (recipe.movement) voice.gain *= levels.interface;
        if (type === 'fire' && !player) voice.gain *= 0.65;
        if (type === 'objective' && gateStyle === 'digital') voice.type = 'triangle';
        tone(voice);
      }

      async function resume() {
        if (!enabled || disposed) return false;
        requestPlaybackAudioSession(host.navigator?.audioSession);
        if (!initialize()) return false;
        wanted = true;
        const epoch = ++transition;
        try {
          await context.resume();
          if (disposed || !enabled || !wanted) {
            if (context.state !== 'closed') await context.suspend();
            return false;
          }
          return epoch === transition && context.state === 'running';
        } catch {
          return false;
        }
      }

      function pause() {
        wanted = false;
        transition++;
        silence();
        if (context && context.state !== 'closed') context.suspend().catch(() => {});
        releasePlaybackAudioSession(host.navigator?.audioSession);
      }

      return {
        get context() {
          return context;
        },
        get menuBus() {
          return graph?.output.menuBus;
        },
        subscribe(listener) {
          return audioMaster.subscribe(() => listener(enabled));
        },
        configureDialogue({ enabled = dialogue.enabled, volume: value = dialogue.volume } = {}) {
          if (typeof enabled !== 'boolean' || !Number.isFinite(value) || value < 0 || value > 1)
            throw new TypeError(
              'Dialogue requires an enabled boolean and volume from zero to one.',
            );
          dialogue = { enabled, volume: value };
          if (!enabled || !value) dialogueVoice?.stop();
          if (graph && context.state !== 'closed')
            ramp(graph.dialogueBus.gain, enabled ? value * DIALOGUE_MIX_GAIN : 0);
        },
        /** Uses the existing flight context and the shared one-line dialogue arbiter. */
        playDialogue(buffer, { onended = () => {} } = {}) {
          if (
            !buffer ||
            disposed ||
            !enabled ||
            !wanted ||
            !dialogue.enabled ||
            !dialogue.volume ||
            !graph ||
            context.state !== 'running'
          )
            return null;
          dialogueVoice?.stop();
          const source = context.createBufferSource();
          source.buffer = buffer;
          source.connect(graph.dialogueBus);
          let ended = false;
          const voice = {
            get ended() {
              return ended;
            },
            stop() {
              if (ended) return;
              ended = true;
              try {
                source.stop();
              } catch {
                /* An ended source is already silent. */
              }
              source.disconnect();
              if (dialogueVoice === voice) dialogueVoice = null;
              dialogueChannel.release(voice);
              try {
                onended();
              } catch {
                /* Presentation callbacks cannot interrupt flight. */
              }
            },
          };
          source.onended = voice.stop;
          dialogueChannel.claim(voice);
          dialogueVoice = voice;
          try {
            source.start();
          } catch {
            voice.stop();
            return null;
          }
          return voice;
        },
        enabled: () => enabled,
        volumes: () => ({ ...levels }),
        setVolumes(values = {}) {
          if (disposed) return;
          levels = Object.fromEntries(
            Object.keys(levels).map((key) => [
              key,
              Object.hasOwn(values, key) ? volume(values[key]) : levels[key],
            ]),
          );
          if (!graph || context.state === 'closed') return;
          for (const [key, bus] of Object.entries(graph.buses)) {
            bus.gain.cancelScheduledValues(context.currentTime);
            ramp(bus.gain, levels[key], 0.025);
          }
          if (!levels.interface) stopEffects();
        },
        status: () => ({
          enabled,
          volumes: { ...levels },
          available: Boolean(AudioContext) && !disposed,
          running: Boolean(wanted && context?.state === 'running'),
        }),
        async setEnabled(value) {
          if (disposed) return false;
          enabled = Boolean(value);
          preferences.setMuted(!enabled);
          try {
            storage?.setItem(PREFERENCE, enabled ? 'on' : 'off');
          } catch {
            // A privacy setting must not interrupt flight or the mute control.
          }
          if (enabled) return resume();
          pause();
          return true;
        },
        resume,
        pause,
        setCourse(course = {}) {
          dialogueVoice?.stop();
          const theme = course.world?.theme ?? course.theme ?? 'academy';
          const profile = course.world?.themeProfile?.audio ?? course.themeProfile?.audio ?? {};
          const fallback =
            theme === 'ukrainian'
              ? 'woodland'
              : theme === 'pixel'
                ? 'stadium'
                : theme === 'operations'
                  ? 'industrial'
                  : 'hangar';
          ambience = AMBIENCES[profile.ambience] ?? AMBIENCES[fallback];
          motorStyle =
            profile.motor ??
            (theme === 'pixel' ? 'arcade' : theme === 'operations' ? 'utility' : 'quad');
          gateStyle =
            profile.gate ??
            (theme === 'pixel' ? 'digital' : theme === 'ukrainian' ? 'bell' : 'chime');
          lastPlaying = false;
          lastTick = null;
          lastStep = null;
          lastContacts = null;
          recentCues.clear();
          actorPositions.clear();
          actorPhases.clear();
          actorFamilies = new Map(
            (course.pursuit?.actors ?? []).map((policy) => [policy.id, policy.family]),
          );
          lastFootstep = -Infinity;
          actorDefinitions = new Map((course.actors ?? []).map((actor) => [actor.id, actor]));
          stopEffects();
          if (graph && context.state !== 'closed') {
            ramp(graph.windFilter.frequency, ambience.filter);
            ramp(graph.hum.frequency, ambience.hum);
          }
        },
        update(snapshot, { active = true } = {}) {
          if (disposed || !snapshot) return;
          const tick = snapshot.ticks;
          const step = snapshot.step;
          const fresh = Number.isSafeInteger(tick) && lastTick !== null && tick > lastTick;
          const advanced = Number.isSafeInteger(step) && lastStep !== null && step > lastStep;
          const playing = active && !['paused', 'disarmed'].includes(snapshot.status);
          const finalCue = fresh && lastPlaying && ['complete', 'failed'].includes(snapshot.status);
          if (enabled && wanted && graph && context.state === 'running' && (playing || finalCue)) {
            const flying = snapshot.status === 'active';
            const throttle = clamp((snapshot.lastInput?.throttle ?? 0) / 1000, 0, 1);
            const velocity = snapshot.velocity ?? {};
            const speed = Math.hypot(velocity.x ?? 0, velocity.y ?? 0, velocity.z ?? 0);
            const airflow = clamp(speed / 16000, 0, 1);
            const fundamental =
              (motorStyle === 'utility' ? 65 : motorStyle === 'arcade' ? 125 : 95) +
              throttle * 230 +
              airflow * 35;
            for (const rotor of graph.rotors)
              ramp(rotor.oscillator.frequency, fundamental * rotor.ratio);
            ramp(graph.motorFilter.frequency, 850 + throttle * 2400);
            ramp(graph.motor.gain, flying ? 0.009 + throttle * 0.025 : 0);
            ramp(graph.wind.gain, ambience.gain + (flying ? airflow * 0.028 : 0));
            ramp(graph.humGain.gain, ambience.humGain);
            if (fresh) {
              let nearestVehicle = Infinity,
                nearestFoot = Infinity,
                footActor = null,
                startingVehicle = null;
              for (const actor of snapshot.actors ?? []) {
                const previous = actorPositions.get(actor.id),
                  position = actor.position;
                if (!position) continue;
                const moving =
                  previous && Math.hypot(position.x - previous.x, position.z - previous.z) > 0;
                if (moving && actor.status === 'active') {
                  const d = Math.hypot(
                    position.x - snapshot.position.x,
                    position.y - snapshot.position.y,
                    position.z - snapshot.position.z,
                  );
                  if (actor.type === 'vehicle') {
                    nearestVehicle = Math.min(nearestVehicle, d);
                    if (
                      !previous.moving &&
                      d < 16000 &&
                      (!startingVehicle || d < startingVehicle.distance)
                    )
                      startingVehicle = { actor: actor.id, distance: d };
                  } else if (['patrol', 'sentry'].includes(actor.type) && d < nearestFoot) {
                    nearestFoot = d;
                    footActor = actor;
                  }
                }
              }
              ramp(
                graph.vehicleGain.gain,
                flying && nearestVehicle < 16000 ? 0.012 * (1 - nearestVehicle / 16000) : 0,
              );
              if (flying && startingVehicle) cue('drive', false, { actor: startingVehicle.actor });
              const step = encounterSoundRecipe('step', {
                family: footActor?.pursuit?.family ?? actorFamilies.get(footActor?.id),
              });
              if (
                flying &&
                nearestFoot < 6000 &&
                context.currentTime - lastFootstep >= step.cooldown
              ) {
                lastFootstep = context.currentTime;
                tone({
                  ...step.tone,
                  gain: step.tone.gain * (1 - nearestFoot / 6000) * levels.interface,
                  movementCue: true,
                  priority: 0,
                });
              }
              for (const actor of snapshot.actors ?? []) {
                if (!actor.pursuit || actor.status !== 'active') continue;
                const phase = actor.blocked ? 'blocked' : actor.pursuit.phase;
                const sound = actorPhaseSound(actorPhases.get(actor.id), phase);
                if (sound) {
                  cue(sound, false, { actor: actor.id, family: actor.pursuit.family });
                  if (sound !== 'warning')
                    cue('equipment', false, { actor: actor.id, family: actor.pursuit.family });
                }
              }
              const events = snapshot.events ?? [];
              const types = new Set();
              // Bound cue overlap independently of simulation actor/projectile counts.
              for (const event of events) {
                if (types.has(event.type)) continue;
                types.add(event.type);
                cue(event.type, event.actor === 'player', event);
              }
              if (advanced && !types.has('objective')) cue('objective');
              if (lastContacts !== null && snapshot.contacts > lastContacts && !types.has('impact'))
                cue('impact');
            }
          } else if (graph && context.state !== 'closed') {
            ramp(graph.motor.gain, 0);
            ramp(graph.vehicleGain.gain, 0);
            ramp(graph.wind.gain, 0);
            ramp(graph.humGain.gain, 0);
          }
          actorPositions = new Map(
            (snapshot.actors ?? []).map((actor) => {
              const previous = actorPositions.get(actor.id);
              return [
                actor.id,
                {
                  ...actor.position,
                  moving:
                    fresh && previous && actor.position
                      ? Math.hypot(actor.position.x - previous.x, actor.position.z - previous.z) > 0
                      : previous?.moving,
                },
              ];
            }),
          );
          actorPhases = new Map(
            (snapshot.actors ?? [])
              .filter((actor) => actor.pursuit)
              .map((actor) => [actor.id, actor.blocked ? 'blocked' : actor.pursuit.phase]),
          );
          lastTick = tick;
          lastStep = step;
          lastContacts = snapshot.contacts ?? null;
          lastPlaying = playing;
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          pause();
          releaseMaster();
          host.removeEventListener?.('storage', changed);
          if (!options.audioPreferences) preferences.dispose();
          if (!options.audioMaster) audioMaster.dispose();
          if (!graph) return;
          for (const node of [
            ...graph.rotors.map((rotor) => rotor.oscillator),
            graph.noise,
            graph.hum,
            graph.vehicleMotor,
          ]) {
            node.stop();
            node.disconnect();
          }
          for (const node of [
            graph.motor,
            graph.vehicleGain,
            graph.motorFilter,
            graph.windFilter,
            graph.wind,
            graph.humGain,
            ...Object.values(graph.buses),
            ...Object.values(graph.output).filter(Boolean),
          ])
            node.disconnect();
          context.close().catch(() => {});
          graph = null;
        },
      };
    }

    return { createWorldAudio: createWorldAudio };
  })();
  return modules['optional-practice/civilian-fpv/world-audio.mjs'].createWorldAudio;
})();
// END GENERATED ACADEMY SHARED AUDIO

const FLIGHT_HUD_PREFERENCE_KEY = 'revealline.sim-flight-hud.v1';
const FLIGHT_HUD_PREFERENCE_EVENT = 'revealline:sim-flight-hud';
const FLIGHT_HUD_STYLE = `
[data-sim-hud][data-hud-component] {
  --hud-ink: #f4f7fb;
  --hud-muted: #ced8e3;
  --hud-bg: #0a111bd9;
  --hud-accent: color-mix(in srgb, var(--fk-amber, #f4bf62) 75%, white);
  color: var(--hud-ink);
  font: 14px/1.2 var(--fk-font-ui, system-ui, sans-serif);
  text-align: start;
  text-shadow: none;
}
[data-sim-hud][data-hud-component] *,
[data-sim-hud][data-hud-component] *::before,
[data-sim-hud][data-hud-component] *::after {
  box-sizing: border-box;
}
[data-sim-hud][data-hud-component] :where(div, span, p, h2, strong, button, ul, li) {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  border-image: none;
  border-radius: 0;
  background: none;
  box-shadow: none;
  color: inherit;
  font: inherit;
  text-shadow: none;
  letter-spacing: normal;
}
[data-sim-hud][data-hud-component] [hidden] { display: none !important; }
[data-sim-hud='flight'][data-hud-component] {
  position: absolute;
  inset: 0;
  z-index: 16;
  pointer-events: none;
  container: sim-flight-hud / size;
  --hud-card-width: 240px;
  --hud-card-height: 72px;
  --hud-left: clamp(var(--flight-safe-left, 12px), calc(50% - 120px), calc(100% - 290px - var(--flight-safe-right, 12px)));
  --hud-top: clamp(70px, calc(var(--hud-aim-y, 50%) + 28px), calc(100% - 140px));
}
[data-sim-hud='flight'][data-hud-component] [data-hud-part='card'] {
  position: absolute;
  top: var(--hud-top);
  left: var(--hud-left);
  display: grid;
  grid-template-columns: minmax(0, 1fr) 40px;
  grid-template-rows: 18px 22px 14px;
  gap: 2px 6px;
  width: min(var(--hud-card-width), calc(100% - var(--hud-left) - 64px));
  height: var(--hud-card-height);
  padding: 7px 8px;
  background: var(--hud-bg);
  border-radius: 6px;
  overflow: hidden;
  pointer-events: none;
}
[data-sim-hud='flight'][data-hud-component] [data-hud-part='action'] {
  grid-column: 1;
  font-weight: 600;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
[data-sim-hud='flight'][data-hud-component] [data-hud-part='gauge'] {
  grid-column: 1;
  display: flex;
  align-items: center;
  gap: 5px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}
[data-sim-hud='flight'][data-hud-component] [data-hud-part='value'] { font-size: 20px; font-weight: 700; }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='gauge-name'] { max-width: 54px; overflow: hidden; text-overflow: ellipsis; font-size: 11px; color: var(--hud-muted); }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='gauge-track'] { flex: 1; min-width: 0; width: 104px; height: 22px; overflow: visible; }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='direction'] { color: var(--hud-accent); }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='checks'] {
  grid-column: 1 / -1;
  display: flex;
  gap: 7px;
  overflow: hidden;
  font-size: 11px;
  white-space: nowrap;
  color: var(--hud-muted);
}
[data-sim-hud='flight'][data-hud-component] [data-hud-part='checks'] > span { overflow: hidden; text-overflow: ellipsis; }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='checks'] > [data-met='true'] { color: var(--hud-accent); }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='earned'] {
  grid-column: 2;
  grid-row: 1 / 3;
  align-self: center;
  position: relative;
  width: 40px;
  height: 40px;
}
[data-sim-hud='flight'][data-hud-component] [data-hud-part='earned'] svg { display: block; width: 40px; height: 40px; }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='earned-label'] { position: absolute; inset: 0; display: grid; place-items: center; font-size: 11px; font-variant-numeric: tabular-nums; }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='explain'] {
  position: absolute;
  top: var(--hud-top);
  left: calc(var(--hud-left) + min(var(--hud-card-width), 100% - var(--hud-left) - 64px) + 6px);
  width: 44px;
  min-width: 44px;
  height: 44px;
  min-height: 44px;
  padding: 0;
  border: 1px solid #ffffff65;
  border-radius: 50%;
  background: var(--hud-bg);
  color: var(--hud-ink);
  font-size: 20px;
  font-weight: 700;
  cursor: pointer;
  pointer-events: auto;
}
[data-sim-hud][data-hud-component] button:focus-visible { outline: 3px solid var(--hud-accent); outline-offset: 3px; }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='details'] {
  grid-column: 1 / -1;
  grid-row: 3;
  min-width: 0;
  padding: 0;
  overflow: hidden;
  font-size: 11px;
  white-space: nowrap;
  text-overflow: ellipsis;
  pointer-events: none;
}
[data-sim-hud='flight'][data-hud-component][data-hud-mode='minimal'] [data-hud-part='card'] { grid-template-rows: 18px 22px; height: 56px; }
[data-sim-hud='flight'][data-hud-component][data-hud-mode='minimal'] [data-hud-part='checks'] { display: none; }
[data-sim-hud='flight'][data-hud-component][data-hud-mode='detailed'] [data-hud-part='checks'] { display: none; }
[data-sim-hud='flight'][data-hud-component][data-hud-size='large'] [data-hud-part='action'] { font-size: 16px; }
[data-sim-hud='flight'][data-hud-component][data-hud-size='large'] [data-hud-part='value'] { font-size: 22px; }
[data-sim-hud='flight'][data-hud-component][data-hud-size='large'] [data-hud-part='checks'] { font-size: 12px; }
[data-sim-hud][data-hud-component][data-hud-contrast='high'] { --hud-bg: #000; --hud-ink: #fff; --hud-muted: #fff; --hud-accent: #ffe47a; }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='telemetry'] { position: absolute; top: max(12px, env(safe-area-inset-top)); left: max(12px, env(safe-area-inset-left)); padding: 4px 8px; border-radius: 4px; font-size: 14px; background: var(--hud-bg); }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='cue'] { position: absolute; width: 48px; height: 48px; transform: translate(-50%, -50%); color: var(--hud-accent); }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='brackets'] { position: absolute; inset: 0; }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='brackets'] > i { position: absolute; width: 11px; height: 11px; border: solid currentColor; border-width: 2px 0 0 2px; filter: drop-shadow(0 1px 1px #000); }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='brackets'] > i:nth-child(1) { top: 0; left: 0; }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='brackets'] > i:nth-child(2) { top: 0; right: 0; transform: rotate(90deg); }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='brackets'] > i:nth-child(3) { bottom: 0; right: 0; transform: rotate(180deg); }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='brackets'] > i:nth-child(4) { bottom: 0; left: 0; transform: rotate(270deg); }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='cue-arrow'] { position: absolute; inset: 0; display: grid; place-items: center; font: 32px/1 system-ui, sans-serif; text-shadow: 0 1px 3px #000; }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='cue-label'] { position: absolute; top: 51px; left: 50%; transform: translateX(-50%); width: max-content; max-width: 120px; color: var(--hud-ink); font-size: 12px; text-align: center; text-shadow: 0 1px 3px #000, 0 0 4px #000; }
[data-sim-hud='flight'][data-hud-component] [data-hud-part='announcement'] { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
[data-sim-hud='details'][data-hud-component] { width: min(480px, calc(100vw - 24px)); max-height: calc(100dvh - 24px); margin: auto; padding: 20px; border: 1px solid #ffffff65; border-radius: 8px; background: #0a111b; overflow: auto; }
[data-sim-hud='details'][data-hud-component]::backdrop { background: #0009; }
[data-sim-hud='details'][data-hud-component] h2 { font-size: 20px; font-weight: 700; margin-bottom: 12px; }
[data-sim-hud='details'][data-hud-component] p { white-space: pre-line; line-height: 1.5; margin-bottom: 16px; }
[data-sim-hud='details'][data-hud-component] [data-hud-part='dialog-actions'] { display: flex; flex-wrap: wrap; gap: 8px; }
[data-sim-hud='details'][data-hud-component] button { min-height: 44px; min-width: 44px; padding: 8px 14px; border: 1px solid #ffffff65; border-radius: 4px; background: #172431; cursor: pointer; }
@container sim-flight-hud (max-height: 480px) and (min-width: 500px) {
  [data-sim-hud='flight'][data-hud-component] [data-hud-part='card'] { --hud-card-width: 220px; --hud-card-height: 64px; top: clamp(58px, calc(var(--hud-aim-y, 50%) + 20px), calc(100% - 128px)); left: calc(50% - 110px); grid-template-rows: 16px 20px 12px; padding: 6px 8px; }
  [data-sim-hud='flight'][data-hud-component] [data-hud-part='explain'] { top: clamp(58px, calc(var(--hud-aim-y, 50%) + 20px), calc(100% - 128px)); left: calc(50% + 116px); }
}
@media (forced-colors: active) {
  [data-sim-hud][data-hud-component] { --hud-ink: CanvasText; --hud-muted: CanvasText; --hud-bg: Canvas; --hud-accent: Highlight; forced-color-adjust: auto; }
}
`;

/** Observer-only flight feedback, shared by Academy and World Studio. */
export function mountFlightHud({
  container,
  storage,
  locale = () => 'en',
  onExplain,
  onMenu,
  onLesson,
  onPreferencesChange = () => {},
}) {
  if (!container?.ownerDocument) throw new TypeError('A flight HUD container is required.');
  const doc = container.ownerDocument,
    win = doc.defaultView;
  const t = (en, uk) => (locale() === 'uk' ? uk : en);
  const copy = (value) =>
    typeof value === 'string' ? value : (value?.[locale()] ?? value?.en ?? '');
  const normalize = (value = {}) => ({
    mode: ['guided', 'minimal', 'detailed'].includes(value?.mode) ? value.mode : 'guided',
    textSize: value?.textSize === 'large' ? 'large' : 'standard',
    highContrast: value?.highContrast === true,
  });
  const store = () => (typeof storage === 'function' ? storage() : (storage ?? win?.localStorage));
  const readPreferences = () => {
    try {
      return normalize(JSON.parse(store()?.getItem(FLIGHT_HUD_PREFERENCE_KEY) ?? 'null'));
    } catch {
      return normalize();
    }
  };
  let preferences = readPreferences(),
    feedback = null,
    context = {},
    disposed = false,
    announcementKey = '',
    checkSignature = '';
  const preferenceViews = new Set(),
    numberFormats = new Map();
  const make = (tag, part, parent, text) => {
    const element = doc.createElement(tag);
    if (part) element.dataset.hudPart = part;
    if (text !== undefined) element.textContent = text;
    parent?.append(element);
    return element;
  };
  const setText = (element, value) => {
    if (element.textContent !== value) element.textContent = value;
  };
  const setAttribute = (element, name, value) => {
    const text = String(value);
    if (element.getAttribute(name) !== text) element.setAttribute(name, text);
  };
  const sheet = make('style');
  sheet.dataset.simHudStyles = 'true';
  sheet.textContent = FLIGHT_HUD_STYLE;
  (doc.head ?? container).append(sheet);
  const root = make('div', null, container);
  root.dataset.simHud = 'flight';
  root.dataset.hudComponent = 'true';
  root.hidden = true;
  const card = make('div', 'card', root),
    action = make('div', 'action', card),
    gauge = make('div', 'gauge', card),
    value = make('strong', 'value', gauge),
    gaugeName = make('span', 'gauge-name', gauge),
    direction = make('span', 'direction', gauge),
    earned = make('div', 'earned', card),
    earnedLabel = make('span', 'earned-label', earned),
    checks = make('div', 'checks', card),
    explain = make('button', 'explain', root, '?'),
    details = make('div', 'details', card),
    telemetry = make('div', 'telemetry', root),
    cue = make('div', 'cue', root),
    brackets = make('div', 'brackets', cue),
    cueArrow = make('span', 'cue-arrow', cue, '➜'),
    cueLabel = make('span', 'cue-label', cue),
    announcement = make('span', 'announcement', root);
  explain.type = 'button';
  card.setAttribute('role', 'group');
  announcement.setAttribute('role', 'status');
  announcement.setAttribute('aria-live', 'polite');
  announcement.setAttribute('aria-atomic', 'true');
  direction.setAttribute('aria-hidden', 'true');
  cue.setAttribute('aria-hidden', 'true');
  cue.hidden = true;
  for (let i = 0; i < 4; i++) make('i', null, brackets);
  const gaugeTrack = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  gaugeTrack.dataset.hudPart = 'gauge-track';
  gaugeTrack.setAttribute('viewBox', '0 0 120 24');
  gaugeTrack.setAttribute('role', 'img');
  const gaugeShape = (tag, attributes) => {
    const element = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [name, attribute] of Object.entries(attributes))
      element.setAttribute(name, attribute);
    gaugeTrack.append(element);
    return element;
  };
  gaugeShape('line', {
    x1: '6',
    x2: '114',
    y1: '12',
    y2: '12',
    stroke: '#ffffff35',
    'stroke-width': '4',
    'stroke-linecap': 'round',
  });
  const gaugeBand = gaugeShape('rect', {
      x: '42',
      y: '7',
      width: '36',
      height: '10',
      rx: '3',
      fill: 'var(--hud-accent)',
      opacity: '0.55',
    }),
    gaugeMarker = gaugeShape('path', {
      d: 'M -4 2 L 0 7 L 4 2 M 0 7 L 0 21',
      fill: 'none',
      stroke: 'var(--hud-ink)',
      'stroke-width': '2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    });
  gauge.insertBefore(gaugeTrack, direction);
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('aria-hidden', 'true');
  const ring = doc.createElementNS('http://www.w3.org/2000/svg', 'circle');
  for (const [name, attribute] of Object.entries({
    cx: '20',
    cy: '20',
    r: '16',
    fill: 'none',
    stroke: 'var(--hud-accent)',
    'stroke-width': '3',
    'stroke-linecap': 'round',
    pathLength: '100',
    'stroke-dasharray': '0 100',
    transform: 'rotate(-90 20 20)',
  }))
    ring.setAttribute(name, attribute);
  svg.append(ring);
  earned.prepend(svg);
  const dialog = make('dialog');
  dialog.id = 'sim-flight-hud-details';
  dialog.dataset.simHud = 'details';
  dialog.dataset.hudComponent = 'true';
  const dialogTitle = make('h2', null, dialog),
    dialogBody = make('p', null, dialog),
    dialogActions = make('div', 'dialog-actions', dialog),
    close = make('button', null, dialogActions),
    lesson = make('button', null, dialogActions);
  dialogTitle.id = 'sim-flight-hud-details-title';
  dialog.setAttribute('aria-labelledby', dialogTitle.id);
  close.type = lesson.type = 'button';
  doc.body.append(dialog);
  const format = (number, digits = 1) => {
    if (!Number.isFinite(number)) return '—';
    const language = locale() === 'uk' ? 'uk-UA' : 'en',
      key = `${language}:${digits}`;
    if (!numberFormats.has(key))
      numberFormats.set(key, new Intl.NumberFormat(language, { maximumFractionDigits: digits }));
    return numberFormats.get(key).format(number);
  };
  const unit = (kind) =>
    ({
      height: t('m', 'м'),
      range: t('m', 'м'),
      path: t('m', 'м'),
      speed: t('m/s', 'м/с'),
      tilt: '°',
      heading: '°',
      rotation: '°',
      alignment: t('m', 'м'),
      throttle: '%',
      input: '%',
      time: t('s', 'с'),
    })[kind] ?? '';
  const name = (kind) =>
    ({
      height: t('Height', 'Висота'),
      range: t('Distance', 'Відстань'),
      path: t('Path', 'Маршрут'),
      speed: t('Speed', 'Швидкість'),
      tilt: t('Tilt', 'Нахил'),
      heading: t('Heading', 'Курс'),
      rotation: t('Rotation', 'Обертання'),
      alignment: t('Alignment', 'Напрямок'),
      throttle: t('Throttle', 'Газ'),
      input: t('Stick input', 'Сигнал стіка'),
      time: t('Time', 'Час'),
      count: t('Count', 'Кількість'),
    })[kind] ?? '';
  const detailText = () => {
    const g = feedback?.gauge,
      description = copy(typeof context.details === 'string' ? context.details : feedback?.detail),
      range =
        g?.valid && (Number.isFinite(g.min) || Number.isFinite(g.max))
          ? `${copy(feedback?.label) || name(g.kind)}: ${format(g.value)} ${unit(g.kind)} · ${
              g.oneSided === 'min'
                ? `≥ ${format(g.min)}`
                : g.oneSided === 'max'
                  ? `≤ ${format(g.max)}`
                  : `${format(g.min)}–${format(g.max)}`
            } ${unit(g.kind)}`
          : copy(g?.detail),
      conditions = (feedback?.checks ?? [])
        .map(
          (check) =>
            `${check.valid === false ? '—' : check.met ? '✓' : '○'} ${{ height: t('Height', 'Висота'), position: t('Zone', 'Зона'), tilt: t('Tilt', 'Нахил'), centred: t('Sticks', 'Стіки'), speed: t('Speed', 'Рух'), heading: t('Nose', 'Ніс'), touchdown: t('Landing', 'Посадка'), throttle: t('Throttle', 'Газ') }[check.id] ?? copy(check.label)}`,
        )
        .join('\n');
    return [description, range, conditions].filter(Boolean).join('\n');
  };
  const numericLine = () => {
    const g = feedback?.gauge;
    if (!g || g.valid === false) return '';
    const target =
      g.oneSided === 'min'
        ? `≥ ${format(g.min)}`
        : g.oneSided === 'max'
          ? `≤ ${format(g.max)}`
          : `${format(g.min)}–${format(g.max)}`;
    return `${copy(feedback?.label) || name(g.kind)} ${format(g.value)} ${unit(g.kind)} · ${target} ${unit(g.kind)}`;
  };
  const paintGauge = (g) => {
    let lo = g.min,
      hi = g.max;
    if (g.oneSided === 'min') {
      lo = 0;
      hi = Math.abs(g.min) * 2;
    } else if (g.oneSided === 'max') {
      lo = 0;
      hi = Math.abs(g.max) * 2;
    } else {
      const span = hi - lo;
      lo -= span;
      hi += span;
    }
    const ranged = Number.isFinite(lo) && Number.isFinite(hi) && hi > lo,
      valid = g.valid !== false && Number.isFinite(g.value);
    gaugeTrack.hidden = !ranged;
    gaugeTrack.style.display = ranged ? '' : 'none';
    value.hidden = ranged;
    setText(value, valid ? (g.met ? '✓' : '○') : '—');
    setText(gaugeName, copy(feedback?.label) || name(g.kind));
    setText(direction, valid && ranged && g.met ? '✓' : '');
    if (!ranged) return;
    const toX = (n) => 6 + Math.max(0, Math.min(1, (n - lo) / (hi - lo))) * 108,
      from = g.oneSided === 'max' ? lo : g.min,
      to = g.oneSided === 'min' ? hi : g.max,
      start = toX(from),
      end = toX(to);
    setAttribute(gaugeBand, 'x', start);
    setAttribute(gaugeBand, 'width', Math.max(1, end - start));
    gaugeMarker.style.display = valid ? '' : 'none';
    if (valid) setAttribute(gaugeMarker, 'transform', `translate(${toX(g.value)} 0)`);
    setAttribute(
      gaugeTrack,
      'aria-label',
      `${copy(feedback?.label) || name(g.kind)}. ${valid ? (g.met ? t('Inside the target band', 'У цільовій смузі') : t('Outside the target band', 'Поза цільовою смугою')) : t('Waiting for a reading', 'Очікування показника')}`,
    );
  };
  const closeDetails = () => {
    if (dialog.open) dialog.close();
  };
  close.addEventListener('click', closeDetails);
  lesson.addEventListener('click', () => {
    closeDetails();
    onLesson?.(feedback);
  });
  explain.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    (onExplain ?? onMenu)?.(feedback);
  });
  const paintPreferences = () => {
    for (const element of [root, dialog]) {
      element.dataset.hudMode = preferences.mode;
      element.dataset.hudSize = preferences.textSize;
      element.dataset.hudContrast = preferences.highContrast ? 'high' : 'normal';
    }
    for (const view of preferenceViews) view.refresh();
  };
  const update = (next, options = {}) => {
    if (disposed) return;
    feedback = next;
    context = options;
    root.hidden = !feedback || (options.active === false && !options.paused && !options.replay);
    if (!feedback) return;
    telemetry.hidden = !options.telemetry;
    setText(telemetry, options.telemetry ?? '');
    const notice = !options.active ? copy(options.notice) : '',
      title = notice || copy(feedback.action) || copy(feedback.label) || t('Fly', 'Політ'),
      g = feedback.gauge;
    setText(action, title);
    action.title = [copy(feedback.label), title].filter(Boolean).join(' · ');
    setAttribute(card, 'aria-label', action.title);
    setAttribute(
      explain,
      'aria-label',
      t('Explain the current objective', 'Пояснити поточну ціль'),
    );
    explain.title = t('Objective details', 'Умови завдання');
    gauge.hidden = !g;
    if (g) paintGauge(g);
    const e = feedback.earned,
      hasEarned = e && Number.isFinite(e.value) && Number.isFinite(e.total) && e.total > 0,
      ratio = hasEarned ? Math.max(0, Math.min(1, e.value / e.total)) : 0;
    earned.hidden = !hasEarned;
    if (hasEarned) {
      setAttribute(ring, 'stroke-dasharray', `${ratio * 100} 100`);
      setText(
        earnedLabel,
        e.complete
          ? '✓'
          : e.kind === 'hold' || e.kind === 'time'
            ? t('Hold', 'Час')
            : e.kind === 'catches' || e.kind === 'defeats'
              ? '◎'
              : '↝',
      );
      setAttribute(earned, 'role', 'progressbar');
      setAttribute(earned, 'aria-valuemin', '0');
      setAttribute(earned, 'aria-valuemax', e.total);
      setAttribute(earned, 'aria-valuenow', Math.max(0, Math.min(e.value, e.total)));
      setAttribute(earned, 'aria-label', t('Earned progress', 'Виконаний прогрес'));
    }
    const allChecks = feedback.checks ?? [],
      gaugeCheck =
        { range: 'position', alignment: 'heading', input: 'centred' }[g?.kind] ?? g?.kind,
      priority = (check) =>
        check.valid === true && check.met ? 2 : check.id === gaugeCheck ? 0 : 1,
      ordered = [...allChecks].sort((a, b) => priority(a) - priority(b)),
      displayed = ordered.length > 4 ? ordered.slice(0, 3) : ordered,
      signature = JSON.stringify([
        locale(),
        gaugeCheck,
        allChecks.map((check) => [check.id, copy(check.label), check.met, check.valid]),
      ]);
    if (signature !== checkSignature) {
      checks.replaceChildren();
      for (const check of displayed) {
        const row = make(
          'span',
          null,
          checks,
          `${check.valid !== true ? '—' : check.met ? '✓' : '○'} ${{ height: t('Height', 'Висота'), position: t('Zone', 'Зона'), tilt: t('Tilt', 'Нахил'), centred: t('Sticks', 'Стіки'), speed: t('Speed', 'Рух'), heading: t('Nose', 'Ніс'), touchdown: t('Landing', 'Посадка'), throttle: t('Throttle', 'Газ') }[check.id] ?? copy(check.label)}`,
        );
        row.dataset.met = String(check.valid === true && Boolean(check.met));
        row.title = copy(check.label);
      }
      if (allChecks.length > 4) {
        const remaining = ordered.slice(3),
          met = remaining.every((check) => check.valid === true && check.met),
          row = make('span', null, checks, `${met ? '✓' : '○'} ${t('Other', 'Інше')}`);
        row.dataset.met = String(met);
        row.title = remaining
          .map(
            (check) => `${check.valid !== true ? '—' : check.met ? '✓' : '○'} ${copy(check.label)}`,
          )
          .join('\n');
      }
      checkSignature = signature;
    }
    details.hidden = preferences.mode !== 'detailed';
    if (!details.hidden) setText(details, numericLine());
    if (dialog.open) {
      setText(dialogTitle, title);
      setText(dialogBody, detailText());
    }
    const key = `${feedback.id}:${feedback.phase}:${Boolean(e?.complete)}:${notice}`;
    if (key !== announcementKey) {
      setText(announcement, e?.complete ? `${t('Complete', 'Виконано')}. ${title}` : title);
      announcementKey = key;
    }
  };
  const applyPreferences = (value, notify = false) => {
    preferences = normalize(value);
    paintPreferences();
    update(feedback, context);
    if (notify) onPreferencesChange({ ...preferences });
  };
  const persistPreferences = (value) => {
    if (disposed) return;
    const next = normalize(value);
    try {
      store()?.setItem(FLIGHT_HUD_PREFERENCE_KEY, JSON.stringify(next));
    } catch {
      /* Session preference remains usable when storage is full. */
    }
    applyPreferences(next, true);
    if (win?.CustomEvent)
      win.dispatchEvent(new win.CustomEvent(FLIGHT_HUD_PREFERENCE_EVENT, { detail: next }));
  };
  const stored = (event) => {
    if (event.key === FLIGHT_HUD_PREFERENCE_KEY || event.key === null)
      applyPreferences(readPreferences(), true);
  };
  const shared = (event) => {
    if (JSON.stringify(normalize(event.detail)) !== JSON.stringify(preferences))
      applyPreferences(event.detail, true);
  };
  win?.addEventListener('storage', stored);
  win?.addEventListener(FLIGHT_HUD_PREFERENCE_EVENT, shared);
  paintPreferences();
  return {
    update,
    preferences: () => ({ ...preferences }),
    setAim(next) {
      if (!disposed && Number.isFinite(next?.y))
        root.style.setProperty('--hud-aim-y', `${Math.max(0.25, Math.min(0.7, next.y)) * 100}%`);
    },
    setWorldCue(next) {
      if (disposed) return;
      cue.hidden =
        !next ||
        next.visible === false ||
        next.hidden === true ||
        !Number.isFinite(next.x) ||
        !Number.isFinite(next.y);
      if (cue.hidden) return;
      const offscreen = Boolean(
          next.offscreen || next.behind || next.occluded || next.directionOnly,
        ),
        x = offscreen ? Math.max(0.05, Math.min(0.95, next.x)) : next.x,
        y = offscreen ? Math.max(0.08, Math.min(0.72, next.y)) : next.y;
      const dock = offscreen && x > 0.25 && x < 0.8 && y > 0.58;
      cue.style.left = `${(dock ? 0.12 : x) * 100}%`;
      cue.style.top = `${(dock ? 0.5 : y) * 100}%`;
      cue.dataset.targetId = String(next.targetId ?? next.worldTargetId ?? '');
      cue.dataset.occluded = String(Boolean(next.occluded));
      brackets.hidden = offscreen;
      cueArrow.hidden = !offscreen;
      cueArrow.style.transform = `rotate(${Number.isFinite(next.angle) ? next.angle : 0}rad)`;
      setText(cueLabel, copy(next.label));
    },
    preferenceControls(target) {
      if (!target?.ownerDocument || disposed) return { destroy() {} };
      const wrapper = make('section', null, target),
        heading = make('h3', null, wrapper),
        controls = {};
      wrapper.dataset.simHudPreferences = 'true';
      for (const key of ['mode', 'textSize', 'highContrast']) {
        const label = make('label', null, wrapper),
          caption = make('span', null, label),
          control = make('select', null, label);
        controls[key] = { caption, control };
        control.dataset.hudPreference = key;
        control.addEventListener('change', () =>
          persistPreferences({
            ...preferences,
            [key]: key === 'highContrast' ? control.value === 'true' : control.value,
          }),
        );
      }
      const view = {
        refresh() {
          setText(heading, t('Flight guidance', 'Підказки польоту'));
          for (const [key, label, options] of [
            [
              'mode',
              t('Guidance', 'Підказки'),
              [
                ['guided', t('Guided', 'З підказками')],
                ['minimal', t('Minimal', 'Мінімальні')],
                ['detailed', t('Detailed', 'Докладні')],
              ],
            ],
            [
              'textSize',
              t('Text size', 'Розмір тексту'),
              [
                ['standard', t('Standard', 'Стандартний')],
                ['large', t('Large', 'Великий')],
              ],
            ],
            [
              'highContrast',
              t('HUD contrast', 'Контраст приладів'),
              [
                ['false', t('Standard', 'Стандартний')],
                ['true', t('High contrast', 'Високий контраст')],
              ],
            ],
          ]) {
            const { caption, control } = controls[key];
            setText(caption, label);
            const optionSignature = JSON.stringify(options);
            if (control.dataset.options !== optionSignature) {
              control.replaceChildren();
              for (const [value, text] of options) {
                const option = make('option', null, control, text);
                option.value = value;
              }
              control.dataset.options = optionSignature;
            }
            control.value = String(preferences[key]);
          }
        },
        destroy() {
          preferenceViews.delete(view);
          wrapper.remove();
        },
      };
      preferenceViews.add(view);
      view.refresh();
      return view;
    },
    openDetails({ title, body } = {}) {
      if (disposed) return;
      setText(
        dialogTitle,
        copy(title) || copy(feedback?.action) || t('Flight objective', 'Завдання польоту'),
      );
      setText(
        dialogBody,
        copy(body) || detailText() || t('Fly at your own pace.', 'Літайте у власному темпі.'),
      );
      setText(close, t('Close', 'Закрити'));
      setText(lesson, t('Lesson guide', 'Пояснення уроку'));
      lesson.hidden = !context.lesson || typeof onLesson !== 'function';
      if (!dialog.open) dialog.showModal();
      close.focus({ preventScroll: true });
    },
    closeDetails,
    detailsRoot: () => (dialog.open ? dialog : null),
    destroy() {
      if (disposed) return;
      disposed = true;
      win?.removeEventListener('storage', stored);
      win?.removeEventListener(FLIGHT_HUD_PREFERENCE_EVENT, shared);
      for (const view of [...preferenceViews]) view.destroy();
      closeDetails();
      dialog.remove();
      root.remove();
      sheet.remove();
    },
  };
}
