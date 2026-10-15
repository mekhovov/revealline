import { readSimMenuAudio } from './flight-fullscreen.mjs';
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
    interface: ['Flight feedback', 'Звуки подій польоту'],
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
    previousContext = '',
    announcedInverted,
    candidateInverted,
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
      // Lifecycle changes must agree with the visible controls immediately.
      // Only inversion is debounced, so a brief roll cannot chatter in the live region.
      const context = `${locale}|${phase}|${unavailable}`;
      const time = now(win);
      if (candidateInverted !== inverted) {
        candidateInverted = inverted;
        candidateSince = time;
      }
      const inversionChanged = announcedInverted !== inverted && time - candidateSince >= 650;
      if (announcedInverted === undefined || inversionChanged) announcedInverted = inverted;
      if (context !== previousContext || inversionChanged) {
        previousContext = context;
        set(
          status,
          [
            phaseText,
            announcedInverted
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
  displayPreferences,
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
      display = displayPreferences?.snapshot() ?? read('revealline.display.v1');
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
        textFace: display.textFace ?? body.textFace,
        textSize: display.textSize ?? body.textSize,
        reducedEffects:
          display.effectiveReducedEffects === true ||
          display.reducedEffects === true ||
          motion?.matches === true ||
          (!displayPreferences && body.effects === 'reduced'),
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
  const stopDisplay = displayPreferences?.subscribe(refresh);
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
    availableThemeChoices() {
      const requested = getAppearanceDefault();
      const candidate = contextCandidate(requested);
      const follow =
        candidate ??
        resolveThemeFamilySelection({ familyId: 'follow-game', appearanceDefault: requested });
      const candidates = [...admitted.values()];
      return [
        {
          id: 'follow-game',
          family: follow.family,
          interfaceTheme:
            follow.interfaceTheme ??
            getInterfaceTheme(follow.family.interface.id, follow.family.interface.revision),
          basis: candidate?.basis,
        },
        ...BUILTIN_THEME_FAMILIES.map((family) => ({
          id: family.id,
          family,
          interfaceTheme: getInterfaceTheme(family.interface.id, family.interface.revision),
        })),
        ...candidates
          .filter((item) => !BUILTIN_THEME_FAMILIES.some((family) => family.id === item.family.id))
          .map((item) => ({
            id: item.family.id,
            family: item.family,
            interfaceTheme: item.interfaceTheme,
            basis: item.basis,
          })),
      ];
    },
    applyComplete(id) {
      override = null;
      preferences.applyComplete(id);
      const EventType = win?.CustomEvent ?? globalThis.CustomEvent;
      if (EventType)
        win?.dispatchEvent?.(
          new EventType('revealline:complete-theme', { detail: { familyId: id } }),
        );
      return refresh();
    },
    subscribeStatus(listener) {
      return preferences.subscribe(() => listener(preferences.getWarning()));
    },
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
      stopDisplay?.();
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
  displayPreferences,
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
    displayPreferences,
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
    host,
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
  let menuStorage;
  try {
    menuStorage = win.localStorage;
  } catch {
    /* Sound stays available for this visit. */
  }
  let menuSettings = readSimMenuAudio(menuStorage);
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
  const active = () =>
    !disposed &&
    selected &&
    menuSettings.enabled &&
    menuSettings.volume > 0 &&
    wanted &&
    focused &&
    !doc.hidden;

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
      master.gain.value = 0.3 * level * menuSettings.volume;
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
  const menuPreferenceChanged = (event) => {
    if (event?.type === 'storage' && event.key !== 'revealline.menu-audio.v1' && event.key !== null)
      return;
    try {
      menuSettings = readSimMenuAudio(win.localStorage);
    } catch {
      /* Keep this visit's intent. */
    }
    if (master && context.state !== 'closed')
      master.gain.setTargetAtTime(0.3 * level * menuSettings.volume, context.currentTime, 0.025);
    synchronize();
  };
  win.addEventListener('storage', menuPreferenceChanged);
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
    get menuSettings() {
      return menuSettings;
    },
    set menuSettings(value) {
      menuSettings = { enabled: !!value.enabled, volume: audioVolume(value.volume) };
    },
    applyVolumes() {
      if (master && context.state !== 'closed') {
        master.gain.cancelScheduledValues(context.currentTime);
        master.gain.setTargetAtTime(0.3 * level * menuSettings.volume, context.currentTime, 0.025);
      }
      synchronize();
    },
    setVolume(value) {
      if (disposed) return;
      level = audioVolume(value);
      if (!master || context.state === 'closed') return;
      master.gain.cancelScheduledValues(context.currentTime);
      master.gain.setTargetAtTime(0.3 * level * menuSettings.volume, context.currentTime, 0.025);
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
      win.removeEventListener('storage', menuPreferenceChanged);
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
    "base64": "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"
  },
  "mono": {
    "source": "game/ui/fonts/field-kit/ibm-plex-mono-500.woff2",
    "bytes": 40080,
    "sha256": "0498bcb48294756b5ac9062290e1639e907b1ec69b5dc2e8cfdec3fab58e0bc8",
    "license": "OFL-1.1",
    "base64": "d09GMgABAAAAAJyQABIAAAACFegAAJwnAAIAxAAAAAAAAAAAAAAAAAAAAAAAAAAAGoEyG4owHJNMBmAAk1wIRAmCcxEQCobpaIaFLQE2AiQDoCQLkBQABCA/bWV0YToFjDgHxhUMg2BbYtqRAZaH7eGDyGxTd6Uj59gmcH+BcazAfnVX/dvgXKdkrWDHvMLtAMVHnc+S/f////+SZI+M+3tX3du2VqkUgPg+ILiMQwgyMcWEnNqSc0ZCCBI8OFwoblOAk07eYwhm4DuMZWpnpISEvQkB0SyYM4+VVSHzgpU63cubctgtx9WeqGrouWobzbLInC/9dM22pZ2oRHMFVb/Re3l4GWZzTh7TaEqiEpWoq+r1NpfebHgGDIpPxMYsqiMjV3s1Zqww4sKEpWGd/ZuM462bXQINEGS1Gdmr5F6TVvzLHFV5EEsfZyeIvSDrMr18PrAbcUxmsqppMqptGws6cicBX5pEL7ozbWIR/rUpoP3h56bb26+JjtHxgeJI384cPyPr9RdTSGpe1+EkE3b5IWw9Ip35yp17jfcfF5WaV7io1JRlQBk3LxzJyMqVfePL0/P+CHdm7oua4yIVFUVJZ1pCaSYbYvt/nt/mn3vve7Ru4srGaBSMb3+HLsNeRDVGF9gYYNb862z/nyv4D6JtEbOapT2L2W8vyYnYiqgG9ZlhYeLdjEwMwDZrU7BwxgxqIIKgUoKAEplSBioGivZ0kS7y5jpu00X+6aL61rf9IvJ/1fS/i0AAJAASjEOCcWY4SSMNRyFZ+aWoDamSdnMn7+lfqH+utrWL7rvcbBedffqfiiYV3eP5/z/67XPvE/1E374O8demQVthXD7MRAmkUWJhz+9tllVJwuGX1GzI8ZqzQIDGgxlss888nzbO9oW+wtUxbAjxllP0BwBFxuHeQPigHbbN3sfl/N5fzyaMCvTK/+rSAkkFsgvkSPGFrCuxS/5PDqlAngqsTNLaW0N/PRcmbwXyFBo2mm4qsm/L8fx/97zurGT5hAP44IJVuDIC89uytwWrHe8RHKhswyWfz6cWhZFY5CU1pspT62cOwY9z+Td7J9wkgRwLRfi/FZs+AEo3LiYdp7Ck8JqYuFRpWyf7naRr8gbyAkLX2dgyMFI/0agfAzbXvtnv0Xp+URhixm0irUSzcIAET1pWu3QA8qAvFE3Gron5CTZY9eeyfCezBwg1pvGd9uKq+68xKNq1NU8HGZjnoUTE9NpmnHDLCoLJNX263GJyGWZkpxgUsQMUhopC9ZpXZf33EzLjlChTFap59bUVZgAGjK2SEN8OtQTZPDZ4GZhnKHXmbfD/yJ67563/EPo3QaJWm6AgVCGQgAIAf/+/affu+jlhNRAzYuZXkrxMKaUtnWHN+fjr/jaNeAWxmEFUK6QZPCdylEU0+HWxqbOifB8nT9MkyTzyspcJ5mSMm2oWnrcdys4/TZ8PKba4SzIInu/XfpX7DmY7b5juEgreGVrZL3pRTWIbEiqRyBAqJWkTiz8CIdHKD6WSCjwfjf2vPrnnKwMeUtfdr4MveHylYZXG/9/rtO1/YE4gFVLlTGVqatmW1hebWWb1/n1P/v+/py/Q/wikL7rAB0TsIyRjCywnauRIQjmHlgIpvUmuMOZksDv2FDy9tVVpu1kl2+20ttjNLHabzLr6/6nmV8pbxQIkrftYNpdrXB/8cdkGIUW2pFTjNKlLEnbhgfXBwmN9dXM0pj+nx3h9jTMZgQe06NRjnOaPiY07+XobpBNEmda4zIbh+l+rVKru30/yeVGXUQj7vUZhMWAhcNT/97alnvYxOyvHtXKO62AzOXtlMg6yYBIUJgJy8FADSGJts77B2g1qzIaBtcnY/8GQIQa/tC5L8kdzpc18dh44BVQnCyhcT1aqZHb29ubm91N6TFNwT6AK9M/bsiLhUVXY8vzX3pqdU7Vvg3V/s3A4Q0/YcMnGUCgkbjc3TcoS7xFGoYZieHx5gBA+zGQQudP/tqwwsA7EkgQCDOOsZUUYaMJhJmP6/LsEoUO7oo0UKSKif6zh9/vq3bvFLC7T2doRn4RMCJZYh1MSDiEttrzJ+uvPmPrdy+xf06StaWIUQdmCgmJWxzK3ez+m9c89N7mS3C/bmi1VXUBBiiIzjB7DLQ+MwsqlG1VW/h/+1L4n5/f22/a1JOsUqg0GoTYjNGoIA9HcuC0sjGGcBuME0RIcGNKf/ksE2B+A0oHwIOqcIV99g8nIoNCIBhTNaEKxiQ0UccRQguICcy7noGQkA0p2sqH0pheqTnWg6lcA1ahGUEUVQXWoA1T3ukP1rASsd8VgZ1QDdk4NYH1qASdp8pEpHAUy3YsCAgH78tYq9V73cQZB2WGLrgJ0RZkY2FDgH7ODri2axcj7ZwyULaABGzMQOZnZTeHg02a09AtsXtxSr43MGpm7Ny/qqNrpQ2+g29fYoVmnfhdcs1XveOSFdz7f9J0vfgkWGYDGX+5Lla1QuWoN/kyLLgpG3dQZCD5EsUcumDyHgCY1uGKIG7bo4YiImfyPEB5mbMeSPNyxZ7QRj7lEWDOKCTgb88VGNr46Dh+aOR5HXjZiwZYjNxJzTObQn11RTlnman8FlLoySblkriz2WO8I/w1fWIAcvfb8ibe5OeGcK255oJufeeOTH/5hc7hYyTLlB/8llkm3fVKqkoJKh8Q+kdcXQHs+BrAUHuIjcuONi35MkhfyYxXwEOi6xr/YH9mlAsAVWyzUisWFASGEQoQbevhhM2AZl2D1AqMR44SHcR/zCthjo9bJOpM4pIdxVTdGfTNzMEp0TO+sI6jViHufc/LVOTsQE4WvxNAUTjFQ9vIgHICkcL6IK7XHNzi1GHa6HXDs68FQ4zB+lCPz/X9AIHGMUXKNibmDtwkj7/9GFSAdJHpoeRZmmB4ARRM+xxCCRAUyQu6UGbaYBBCCERTDCU1NInbjSTkCI6tR2fs/CrjM+CcJkkkwLiUQSeVKjbHewg7HL5sEzqMZsUyh0pqYWVrDHOaUlZgvlBixap2puVUQE7LZp1QTJl2B1EY9k9GSMAdKbeazcEKDQuQXtf/Pjxxoxlnb95IGTYcBqmuHX6qzGLYyLD5mwsuBE5lee/Yr12MeLmR57bWv3Ll8BfzED/lnV8JwYiXZroKZ5EupXQ0rUYjKroEdpq9VCuy8ThopUcTHB88uOSkQkJrVjQLH2r4wcn0wqWO6Y0bHVMcj27PliOXaxw7ZZnk2sEpWWDWL8Bdfq242U2WyHUGCm0DHrA44mn/S/Scfy3zXAj4ztpx4mi2sBg9r1GnQFXc88cYXf/5U8fQhJtaaQvVcDR7bQ194SD/ieP/lGj1xB7+d7K9+s6LlqtWTrhoLYraEsYLKXL5PrD1S8dgKlIYztjZ1HTzJI2+d9Kl0MqZiLgs94vyDZbtJK+BJmqo4NVI9kz21fDFXRmUcSinT8ug6gRZDivlAhg65acsLvH+DoYOUQl2ajoSs6cmY+Fvw8pZiJxNcEhn4fimPbuyzSBEjVuy58XaQXwxNpmvV64IbHlQDYo0xJNdgLc9k+RYrcFihy4rcVuxXSao4ALDx11S3jNn3643AZ+OnWHVN7y2zRtv+uRGHYONdEanLzrzdI39n7rPE/Xsj9vkrtb+IiPUL/FtifAsnSIpmWI4XArdESVZUao1Wpw8ACMEIiqHdJjapyU2Bew2nqU1rejOa2axmN6e5zYN6BoJ7hjYsUZIUqdKky5ApS7YcufLkK1CoSLESpcqUd1wX1C2lW6RjG0aAgjCgOkFQxTDUZSDcZQgYm5v0OLEyNDnLNTbfOjj9X7TnxTSNclTTPC3TOm3TOV3TPT3TO33TPwMzOEMzvIAKhSlCUYBqQo2AGTEnHrzt5xYUU4eHpWDjoLhyq/zK4Ra0Am5hK+EWtQpucavhlrQGbmlr4Za1Dm55FXBlrUfm39RPAzLtEz0dcFLxQyPNyZ/uydMm1l9e6mRO9mRgoMm66lguu9jFg4eHWjC98BEBpBbIo88Z5A13k2k5Z6KTSya6eWSil5cm+vmlM5hMsgUOw5TBxChdOuMpJVA1ES/KnVxBMeyE73J1d+OBWzTdj7mgNrjOBNDFHEY/FoNP+PFzvyQgHduxxlZgXaZAaCz9BgwagqBMkoKd4OyN5ZdUnAyZofXXOVqZpDOF0L9hNoybK8BkLNPRvX9mSyeSQcdMLPPysBQrYmVWw+LCnYf/eTok8d9pV/9vosqZlkcNzLcmqzIOMsV3HZUq0zq2gfm4TegHGgh44KtQnsIVxt5szGWwaUwAzzP4pTeD9UsAwP1XLgQjwV2l0NDfAFaQ5tMA/DCgCwcDJyNg5ceXOcFev0Xuzf4yo/ZKBL7tGIb5gAOIuZKIEbTqzMjMyI08z7eUZrhlnRvUPU1oGSaC8dNyunzj+CPoYAt73vmtYr0/3xXJ6jvpGwTv/81U84NRpUnosWDNlh1hhjKJLAVKtOgxZMaStTaLxp4z3/pcYM2+Y+ceFNES2bmkkGqaGeeU4pR3l3Vv/e7+bZyc+r+F/Xh4AziAgB03XuJEbc6Ws/Vn+Zq09HXc9nc3voUDZE9kVgC0wAMu7eWLZ2qtEbXOKK1U9QB9tp7BRpk6rLVis04zox63Cl0GTN78lxZnWrXjyNnDjs/rBLrEBw8v6PpBP8pIcdIP7Au2MhFeTonDpwQ/bHP3p0PPw4Femb4sSqg/YPcxuNHOrhtUAGby7ycDv7kfgF9e4Wf85ZlyjlwqN5BnVZrPSzFTNiDrk/UC/OJ/sg5Zm6xF1iw7KjssmytXy0q27VcvEOWJvKKnV0wpv/FLnnwB/PxR5bvKd5SvKvcox5ZnlYOLD5UoSr4B9vgoBPB1oL8KO+Q+dyigX216M6tqD6BtdGeA7A1gqzwlFW55dj7YWyerjd1wJNWYgRlA+NIdXK9YrasDMD2v5wUan7ZKV7sme9+SytsEXC9ajfTC3gMW82lz3Aa7edWhNOvkttchvPVm8Rh00llL7UETMNod7H0Q8tn7pzKWVVScjhEFixx2320PbYZ7t20MMROmqO8+u3Xv+P80PmHVsNVoJzTGLvF61YaqLElbGtKc4WlJZybmUu7nRm7nTr7nQz7nS64nJimJS2KykuR4MtKWpjSnpUzUmEme+O6XML+FkKnSol4TZXiIgdiIA4oIYhnjmEUUcydik/nRxhBjKqNJVYZ6mh3u54BnuaAil1XnippcVJmranNNXR5qy00NuUuVR9pzS2NeG8gr/XlrKG8Mzi14T+NJ7ctsO6MXvQ+TN60fiz4O/ZzAdnPby2sPj3189vM7AOGQDAchZToC7RyiY7KcRXAHx11c9/Hdw/OAwCNiD4n8R+g5taeUnlD4KtAnfl7R+SLAR74+8x/AdTFui9vhviThJXqQuoTimyBNbddg8If1mt4f9QaEWITLBjoNaw8iuQvI/k/imapS3jL3AG3xFktBSA4LlQqRTK81rAWClU++dn++3pPZd9DbP0gqgTLhaCxuMCU1ijuytBawIl4imnxbHGpHurF+apyb1/aD5+g9+S6Ba/BHdxqclAUzQA6p0n+mzraEvtqVF5aVbePYOneus/8WCgIGWtNItLJAtDqtHmcfKyfF5LS4nBGfsxJySmyOeJVjInNcVE6IzlGvc09zHmjNYx15ojPPdOe5nrzQm6e68iNq6Fu4KDkWSY1VCuOU4rikJK4pjVuK4pyc2CUvDsmPYwryX3Jjn9bMy4f45HsW5GcW5VcW53eW5EcWFoQ2NhZtaDza1EFoM7+AsKCQiBatxjzz3Asv3fXK6+psXxvb1Oa2tLVtbW9Hu9rdnvZ2sEMDeJuAjBxEMKEIITThEgbh4VGOdhxhETZhEvlUYqQH2Ef30s8BAABiPLV7REWdaCINre9HG63O2MRUb2ZuYWllx9quPRuDrX0HDh05duJ00MHn7JB+8gJGKBJLpDIjuYJVqtTjUEdCwCDDFtsFjUlSWnz31y+/hQlRpV7LcFqTgXiiVYxRYBZzeWYLJ7cWDQN1y1uM2RqZ+jd0vfdOiNM5lwzXHHPOeQ9Lw60aVc2OcdVOJuAXsbFElQlX3HOq+BaIc44otDfDczFlcTfVAUEhfgG9LmV942CdIwKR7vjmgFH+IpQ0Z062Z27uj2L2fQy7Qb4ygDFa0iRi/o50DCgJtilxIo1t0W+eqK18+Y1ZgnSRBU+LaEzA/tvVvEyTkY0yMkdGtssoBbwG47Ua7/Pg/LUF7Ic97h5CVx7/Dw2/+x+YuHiKjTz1KXYLOv9ktEfafRctu8CCz/88dO4pdgs5/+S9d4npffzRuSQaPXm8/6pRwT1IpNi7lKkVZzNwo0EidJfPTmqn9N0Rd28Omv57m9UkudFuoSSyKVyJyY7k5GxZNMr/FQ76/AfScMfsYVFf9O6x3Tp3b55ITicItOdu5NxAkScGG0lWFDFUilrRIU3Ri5g2xrnGwhKQH2lliakTdH/Bq55L3H2bHT99PK1c+rNEHvcykCPRLWL+xPTeFjr2sLfLx8CmG/zE7kkmpxPkbruFff4DA9E9u6cTBGkHCMHCMRL9KdpnhLUPAHsfClYArv0eAPf/ATj8CxzwXfCNGwC/NCKjK0ggHpHGI5Fj7UThJgkPCLJtBEz58sUFS8SYrpZqXDPpAtvenhh00lSVXEolt9NcjVJ4k8oEsqSRhVb6ouEGSaa07dsLd9sY7Zk/DZPXQ03LdCGeV1lOyb74sIY49Y/cs6yriRYzToSq6pyY4Fhi+MmoZlznyxiZltwvEypw0fUb2SewdpWNQpcFIj69dZFVchuczpp0MGkWUusqvldQxdYk1QjVjBinqBqpsCsyrXOQaQc6y8hDO2YUPrTb1u1s+bI5pyAwFOj/zOhhGAM1uPYxMsAQkKYeOrRVVZezVa3SLgokbEy5t12hnrw02D42l2+aUoLhadzA1sDk10GemvnsfXmfYQxXyBqIB2S7MbxjBPWxNZKHXJiCyGYqKgeqBld0K9JzBPiIo4SgYgEmovOdp/0Z6QjMuPbnICLCLYuqk8ShQYNPXTO/PBhNsYqOxz8wvAcLVnVWgbmYVGFKKz15lKPSD0DNYjRmOg+G4JxTxCwb0j0v+ZH0mNHxdnW85xLryZHbVr7oiW6k+8MbQgeyJjpyC/PNDhOPY82zyBoF3fjDcKHp/RrUhT3c+t7PsgFKAUqJPEJDQyM+AunWfzh+7s/X4WycKad33daYGW0ZYR1FehTyMzHbGV/MvSPGQTGjEHGrZOMIbVkosx6omuaZeCEvm13VSiauSLbO0dYcKmZtngu7z6haGNPmzqm2m8Mg+VpgaTJrqJpOtxmbu3sXcenG4HDTHav6Vse2UcD3h56WCmkMeIj+xi4fK0RXL3KKghg3D+3JCe2Uq2UWOUs20mpRg5ClO6TziDiHGiUml8dUQKz4hVQzy6LkN5FVAuKdpPuvPlDSSQfeQaTFpqbQWbMqmJBNfIeoKci+OdXiopK4PAAnzkQT01NMkJhmFk0KBs8fn6yc93ErLrFuxJEwAVBBI9G8SNdPEnMSl5AKrUySCmOq4cqAt9LA5oHTkYpBPr0556gWyLFqg4EYbnWiBJG9LaUnAwgCevFCuDTPNhdpcNtX9A37MGd38/psNsUQcXR5PJPPQyE7/3F4fnxzEfazIPHGuQ+M1DtPcrwQUjRY+HISSASl221stTr30JBCarkKnG1iQjfKXoakZJ+zr1y6wZZeqcQKekrYQgcm6GqucmCKqRYRNCCGtz+Tc6fItxllRZJTBwXrsRV+vbeQYE+1XPEtQmkJ/ZSAyt37lK01nZVDLxTdOPoRrx9LcJbmfaII5vh3ZpL46zQDAPNkwDKzENCXkHuCkKatkJVESA6BHPG0xkXIqIk3F5AiKg0RNAV84JtFmIRkMztBB/0RYjTr2+mKVDbQYDztXHyBDeJJbg5GhfRZB26DSxaLRljc60UiwynvcghoykY8f/19tUD4VStN9IDrx1RiMb4tdk/Wl2GjW9SQKRPM0iPLkmXy8luqsZT4w2sJFQqMPF9PFdmQg/em09beA4AlVJmEO8uONjlyS8GoZcNWKKSWgVFH3/5+Qm/8cMPEqRYMoLi0NlI40dVeBBtDjs0aNK3hnAvjE/alH0sR1L8gjCSOLP2QrrgSC51GJ1ayd2bPgSwKHRQS5SI0Z8uwEZzeKya9KkSYDInFsjM6T7IB90KBkSvGtwtQVJBhKCglOmuYULBBknaaCCbV8VOjtEwNBmto7lbf5eqPkUxVpj6shAphShVorTGJyaKG/Fjsz3TmyVX/trc8oyONySABp1Qr67+wgTOW7uxAnOfAtHIIlUKkS/ikhqkl1X8FxMogqgrRl5UqtWYQuwTsdLcynHIcJXdwjBuSBlt2fo/nphDjFBvM6Z59OPlXWWN9LrFFajn8Ln2JJ1xMf96M+VvEFm+KmKqbEjYCaWKcXKCrWcx7T7Xk5TPfAhF58uvtUOlO0LqWjB1b7kQJgVZEo7de3iVqfZO5fnS6sTInrU28InJ1KV76D37R6nFl6wQpqhG0+lsCO1pqs94ZrfzTb2rtrib6saRICImK72S/E6wugpu7m3+cZmSyfgh4JAUmsnwqT7DJdwb2pCZvZ8MdwsZYCZnLNmp3J3OOh2QUEuyHNA45DoOYvFSxDiV1p0f1TFYwdpvNTbdC2l2d+j/i22cenU+EaoGhNjHsSXYU2ZHmlDJ21DjsRG4JqWKstZQCUYvqFX6gkL7NacgYl1JITnCdNEpJy6Sv21BRocLfHCd1v/d3hRSJ5bfCFS6O4iP2pR/VkPy/HDkzspxxqp1u8ghBi6J9tE6lUF0Mm+JmMVYT2oLqwGQqwY3Eztd6Hn2N9UPOZoyWlrrudAY5yzRpWKaZlFKej8amqBYxmkDDKA+otk+JN3X0bUbe5kp6VvhYAJJQP4XEMDFiC7QViG5DrGyWPDS0T5KGQxCxbCjUgWjiRv7uHY2SOq5QgbM5vtD8h6vKRL5THO1QqkJk2n3GrbusiZAPKQIird8E1mbf759NdJLR6bWV1+mmgI3mZEvEWC1fK2sqXFkSZzvc/6ECOsJcuyPwOlYgPjQe/oVZU8+X63AFf9Wr/CVvos9vxQI35M9zGts94avPhrJq55PBAu4YfmuQwKD1Q2U9k9bKoHotku14BRvTBcfR1EYYd4FxFNd9IepyyGd3xf/eDkfF2+ekUy9Xhu8sTsOzmBI2LYc7cK1Ld0cGB3ualjZ2iRQ4wOeQUTfqoTDiQ6NQ90FqcMW4QM4jE2mwn9ej6rSAPtWPmihm2fac7cyZb654nRq7FWx8lIhFEHXJoEL1alIm+Kdg6UdoJqOsSMcVJY+kAJatyxJ68UKYL3QVFLmCZfuUZXgwFKKFVAP/0t0WTsbxY5lkIsQ7hMXRRr31TJAL2BahqSUOxGAE2T3d6CZY9GEEi5eG9vYW/1rDkTA+A2yjKukXnJn2JusDbW8RnH5o6Qo3tFHYkV7BkbX9AsFHYssAZiRY3ba5U+8W3o+/iGUhpACfGahlp6QCS9bN4sGS9O1JKCtZ1Om4/B9MGgL/aLAiaurDyIpUrrU4fNKw11svd26xy64X4bZbu3/Lb1gsT+ptBWr7IFBYeeLHV3Wn6eEbbxup/ZBLO71HnP1t65XIOJpP0y+JlGUPZwGrCkw31akWNWiFNEwyFuqIwsstTg8KXLi4xL5OyNcw7jMhHe/kVC3mWyTvtRqz0yEncV+x/r+D0/VMzCNZ6Nta5sEJH63x+nVbjKohyf94GWiiF2mEMM9or7KZkt+/t7g405oPwiQiSDgm0R5e5locBkD4S0kzC1T2WgC4gLXaa1qAhRAk2JElJly2QOKo+W/67cqnCVMs2iD2r52ZihWQiyervQWfbcGwPFj1/M+jBWug7wspDJbKU7QUTfKzDRiJelPDEDpN9qFiUOCV7f+SzxZc2zQuMQhcAE/cNi32T8XPk3Q2tda39hnF54F5qMfbwMGhLrre2esbkmRlHchBll8lYYyxGnt7vbOmj6oDNWCy7X5bS1wLQmPJXZ5kKomRUae3VJloSOKhuLJJyzn5jTk0KY4P8Xu+49nz3pjjsierb6ni4qZERWkFwyYalt9hhAw0HUW40RgilI5hDmeen1gUV0qQjLiuQgdK3WLmUiHWyI58jkHVZwuMHQk0KrSoPoAJtH9LYM/hbsvglECBPD2MXgp0kH57+R8MjZaDGMgYlE0kCkh/1ODu1HbaH5NsNoYSGE4rj7/VMKglXudZ8GH3OzwOrR5kaMAK8H1N1C9yOwwzNxYsCjAoxmspM/H6Su6Fa1i9ufRjwuDQ3SwJg+XqoU5JS9ZZSKbaX+jIVfCTcQHUHfRsN0Sgl30REw9DUykZf6RQIA8TWu62dyLIgaqNEPxW81lLlQOpsCjUxVIprt69zCONVcK8IvMSH4GMy3UGGsF9WKEmtPERg/Qz05v5ePwa1w8qH6HQV4eDJm49ZRX34SuID5mgFzUHJwdYI4k5c5TZuMr3dHrjChdLY5eBc/yPDvNV+dMaIxNv8FmeAzMjLbbIF9xOm9jX44cJJvKws9TD/e+tsYXlDa6mcmhoWvZpRgUJ0owmchiJNF6SbXJz4UzioQdRcSeXydu9mijW+j1dFBWsRm6KEhzS4uWgzQ7h4Jl71gHk6jIjQZFN5SZXTiZgFuogFKPdE167puzUa/N2lqis+BnRkZiigACFNKc0gGZE6Mpk/wFDhkHmwECOI2SnqqpUEziTEoo38RYWyCLBa0EGEKmb7M4E2RpDujYsi0cmH8OxJjhr6c2Sp+NPQzsTjuvMK+Kvm1RLhyN9G9Q0bOjlbxpc0If9bCHttUTp+VkNr6zEqCSFUf9hVxGUOaleHU8qBCpcssNBTArGjbMB5eT/NSxxHIBXBCgzoL4PtGphpBcujb/F18jkXzD8UUGCxd32OGPKrmshRVTg5DAIjN5FZKcjQMo647x2gyNqH7AXm4HqGSjqdmWeHybw5l85llo2XApgNqU/sBZuszqGro3scoG6h7ukkSH1PAMTCS8DgSfVmBs9f1z9T0ztsgQgIEywtbZ/7oUlyTEgm3fA3LaOwHBUyyU7xbTnIyFyMV4j7m+ozj1atW9sfa0opFZrIZeN3QkoR9UqkLEM04xnvj7OM8DKOXPfegaGaogSnJSQx2uXEdrn65+e+TrpKk/dWlQaFNITpSuJlY86fNqP1oX/vVadI08fI1D1GXIv4yWfAA7WoFNTFp7WHlnGeZKbaOQa0G5pXFd5EwUcvMDdosu0E8xOIMk5WGMxSmGgYtcswZtB4ZFtAfRQ4BRq3ECzHoWrnZl/v+fbLEeu2JEtqXBBOBQH43ot4FfJ0kvRe2YXfPHEs+Cp5lJtjldg7NubDMR/RHf90bgEzHJdyhiiAhChL9x2MqgIihoK09ijEQyARoUg7+5i7joLy5bQatDgT5PgEQ4piXR1TvjN4K35HN4kL7sjwDSdgOAjN4zdHFs7RDgbEdGOaPU3ebU3+XVCHl6ehAMK1Gdq89pAS162J3P2ND3jfJ4g+5SXDdENWlBTZvuCSpSJiRmqJsdyFrpMgXpdwCvkKI5sdgwmjv2qpi8KzG9pC6dFfAd26JUtcIzNF7HIE8c5FNGUqC6eDqJwtniN2Ez/cx8GAQC5uUTWKLHpYdKhYGxWIqsECPF1xrhUo+4yUuYObkkUELZLmuhamIqVSPf0T0ZjuPsfuGVKhIQdBOZ8b6LqORVT3ylJjpbD4oyObWabwf5aStg3TqTH/6AEcRj2cW4y/5YKdDgPtzWUWiLFNSCrySDIm4iR3RkFYX1qZKEyxyk+RqiFBUcKLMORar/f1Ha5vhhLJbX2mgBIo8is5URGsg/CQezj3/h1oiQlW9M5jvaWmmSnI2ZR18c3I8lGz1jy5lPbVAw6mB1L6D8ZkzoTAm+zQJvqCPU3g8VVL9/rDmvoe83IHUZBh5cgwIF/HLPuI6cd6xRK6Z06O1Q6nNW0jFmEOyRqhtKsD8nMuTQOMs31fqQcndo3qB4qEfWqzRUcG4ANsQeqiAHJ/98SLkyB3p/bMo8KcBd73J0IBuEC7JAWfKFHftaVzmIQoDaiDIyGebnsaqMzTZRAMirQCQT5NtHpY3KSNDPgX5uLlNmg3FyQkH0nMjYSGUqnXxXuu5zBEMmsqCHHfCW2W4VW2Qip7lkcoc48ZKMXmO1R1p2kv1xL3RTzWm+aVmOpQSIGlBgl+lE6XOBIFamtgl0sBBP1KxqUEZhbSlEfoWcuBQ4hPS9FyMDvSd9ZHdWVkxs+w5zkbNuoxQMR1IFHkavkD50/3TJ83HRjmN8fPcABlqkq1RtE/ZM4dSOTN9Uyv+U5tn1pt5IC66ueMRyVJMZOY6BCXUKpeUldmyCiVOi/k2JH/3G5V7CJSZ7YHjXmGCyUCzVQ1aVWyTz8o2VLBitnfsy+aFahwkHXoGorZP4Qk11hWgfIEbHLkn3A+Qd0H1u8+sQj997TPILIMdFyEsLSJEnKqVYpyvNovPRlKMeswPCz/PdVu61XIqPwY2xki482CQQ2k9iXCr34kAWi0WIX96tC4Z8rgQ+LizKjQpnYAZ9S6+I2TjnmorF5XLbNM4WF/Q1S6j2d5fDlQcKobhAspk9sOeFa1zLsJ0xN3ehw8rxJvFrysY+sMhnfOaqhbzUJdwwOemCrsEuUkn1GI6TDssmEDgKFbKX74CYRo6wqaa/5UiQC4tlQIhDzvKgIi1RUzJjUBtvPRetmA8Jkkx87M0FYp1qIrAZzGG2y8svQc2sIj+puUjvCPUpMv1JqkgiP2FQrb0reParh5mKUy6XvQwzO9P0t42PnGpnQ6vfZyEIZ1eNzWMT38hVOLxiFNQMMWz1pNhIRGnKpQ5i18/zpYIdfWc5mD7sz05neLVRAvXRiJ9bhuJerH+YKpxCRMX1md0/NwReiXmuSX0cPN6kZYbih5kb1kfHmNzeKp0og1f6/4E/gzjgg+xXe188G+nTdrEwtVWTzk8p5l/i9S1QE8o+gwyllrEfKXl4eJD4W5U+ulN3M0CMrNSyAXXZqhejlJoJ7TuKP2GMRGEOgnwZfqGEPhVFq6oBdFDrPlUb+kKkbkWxguftU8Vg+4kGxFFWdKmK7dd8qny5rMdnYjACrxH1s15uWHW+dsl1saa+fdiiNGyujne5b1afLiShtQ3yXWUmsW9mO18m83vE1xgic+tOHXTOkOLgQdYUVDkw/tNYw91cIOovyUkpHrx+bHon48gg3/PGQAFRTsbnsb/H3l2wPUWtf+bg/9bbbtz6K/8Edjei4onuyOi3pUtlw1h56393/J9NwRk9NbV5tldJsXX8uq2BxAykQqg49CIT1m7XveHKaS22Y7m59d/dI1+E4q56k7bB4Q3Mxjt5Q5RIxFPmiBvZHlSBKcrFCflXBipnQ3DwaaRl+LiV7ukeODDtqHfdOHc/s2yzZc8SXNDMk90Q5x/0aYSnIWUtJ/wPJF3rPtGoDHiooKTWFfq+p50O3FTqJxjvoulz7DZ5iyyeJavdl8hWZTvGJfeyzXDtJ1R6UyKAbMzs1ml31hDl46KaWNMS+yWKX6PXnrSKqRUtL/WFwFyGJllZKW75DnFQVcSds39mN4ZgzKZTciZukxynDHNk9vehN30H0RrFZfz9RDz/l6Nqf5fXtmg/pkbn6RrpCn0N9trnQC+BthBdZui1UNndImzYTbNkEXFVcB8ZOpyOfYub+lg0sZEjjQd1qbWpKf49SNWM5r1Nzfs0sOb82XedWy7eeW7XryiqUeczn36QnmgsDHQnH9f9dEQ2mfZIT8Xpu/APsUMZzxD/AfU1KpMLLiDcglfuIN+AQHQZeV4eDhyV6CbzlaByHCLtJ4IQSDhSW6CUKESGLvIQFDsfdhA9CKcNu+MLLeBuAmwfideHES/KrREL9fF4waWcsljFrsWWzR8VR7toUzv6rNrFzZ4Ds/GuXuNVZP74mWF6hncCacY57iX/9EgKt6Kge8bOmnsbSk1eMQExd9euuvG6YSack6ddnxLpEvFH3gORcck1C1pnlZmbeJliH1IlOLtuZ6am7vRgq00eH9tc4kpkJ2+GMn8jJkXyI4MTqyJqHhOlLCjRlh/jK9bnrXN71nEiZaBrMt0jeZ9hmadZW1gZaDwtDNbMsAEseCODO6AnYIh5N7U6GrF0hxc3nk5JaJNT/E03x4nA2m7rEI2HG6Ex2w0NGZmr7ThbrO+R58oDpuCkJvU7UsiLZXzuqEMpB0Kn29YTlHs9TZcXyf90paWKdqbIO3DAvE6xClno8oa3J9uYZqanNK1UAKxIskiLe7Ikly17p/1RkM/1h/iSApyqXF9sFu0vMyLzj+W5hvk+aG7v6kbBz7iS9rML4dq5MzXwJdcgo24N35/92YL5/mhu/bEYH+EEBJP6UdkTjCPbLvDdy4Gs9jWfwmlWaOn1TWU5Vff41g5DuquSaS+u9rkiRHSdhSPJwmpJWRSpm8MRFjqg6DZ3lrpnQ1VUzwc3S0OuinCFAqFkLWfQFDemFoL8sgvDFGoFVINaM1j8MMUnpA+3hOD5LxtF8ELsIy5ehyvh8kWXhc5JlLJa0WEmXJ5H4EjXfzpNohJTTaQbK+HKpxIhDwgw9evEpAHG8WIEss5TPR5fx5S5sYYEjiydBeVm5jck8jVaSL8dbJJzF1TzHCURkFhUZHRnHkypH6BxrrJudm71sgVK6yXl04lGSrfo8ONDIKjSO10ySFCXNmIbAv94Qt+AhAlcwCfh/moGZixDXaaGUguXJSDDGZ2+HpGPkeQVPJwgFfTW1MA1yC90cdOvL5bClhdtNOYhYlokvzOqxMJLxcHwyo7+AW2LS6zs7W2X+nDdceYFZKpJLvFH1zjq6RgwXKYp8pas58/PVQtGFVk/AXzbrDpHdu/VF78/CDLpOoXG8ZspRK7rep9j49FlneRhiApvGsf+g9P5ynzbE7axJ6/iUme4L1WhK8AOhadCBuavPaGLsFusWJ6J3jfNQWUn9oyHPnQ4VW6iUnknejq/1HHc4Hob2A43mmVNGXzj1hDl2+3eF+J9QmdrRQ+9xQqb2OA8riACvBLjlLD73jB1wKSmPS7aYarzegvkIGBrT2hVMRMCveJ0VEHIaVltDALHOLJQ5JjNSOoBp48qVSr2yt3I3VyDRR4ac59gFoUIPUi/dFIbfFsKZnU19sdE4JlknOT9Piqr+q3luNj9YwdXIuQd3O7c2EkHWdoZWzEm14tgMIQaXtNN7/N28+MsXBzy0MLSbypRBPPZ8gQrHC8kyn36YzXt0frj6dmeNRipQsnOXORsQrcjRFbtuO29b5QwCcx3RGBAF9oUAoapn/0Q2yG+Kz0Wd8PPFMPRPpDQl0kvdGqvdWq3ZGpu/1aWI7JLOiJXN6Oog7Qf+79dISQlDF0XXSUpa//l2MHaUto6uiaJpNHVthyLrvlVShVSew9lBbj3/c4fpumBLFFo5dcUsTZ5z/dFb6rSco/fdhanxdN+CP0HSlTE26o6Aue+dP1hi43EUZOBZlV5JgCvoyiHE+Gc25l5aFm0vc9jjmkJGkJJFCTJqr4UEoPGjdm/cOGr3eJoa5tNvD2S2se6MRqol4eLWYklYjRx9h9UWyNyu96lhElPfha5RW3t6Rm3tunDCrVNXFDcXqyt0RREae/9On+w0y8e6KvM57P0HfabT+b58mm6jP3pcl46KDoX6NmwbvnsMTQv38VcGMluZ50cjVMJwcT1lkCHGgOMJlSzBBOur8orWZflPaeH+cO7TXGxtrtG2Omm17Z+Ra172/TlGqsYa4FRPrTvRWJU2GcqgVvNmffAJkoWW4I3Vzx890Nq04ebo/2Nfd48qq+0Pe/g+xh5dxMWYKRVTKmIiLurL+idVp0bXpI7uL2vYBomFlvbPPDMYoIQAEhdT+G7EeLsN0aU4WMRpR5fNngIEiDwaXrikpbhXNGNecWugxNoPDATrS0vlszIwJ71pXLCY4A+Os33bNErKkbNxSl1hfhG4UyfsuC8s66tKsiw+21Necri+9Wps1FUqQcsxw7qh3vGuoJ/gD3Y9C2NB7k5Bs0I60kVkieUcJonyXAMCS7JmkTFlIyvClma6QCY7pMez+UI6jYASxqnivUm2CjUFZRAW+pBlZW5P2HPLh/PxdvRtJABk4W94/LcwQEbYGF6gSQpT1UVYlYqw4pBWs0B+90jfULef+zLq4fD4m8/ppRpqXylkTty2GP2yesgxYyB0jo/aN1feHYNRbpOP1E9SjY3SjDVNartafsIyUj5MMQqoGKUa1nbS0vYx+sm24c6NitlRytnOjR2cIboo52tZ3dcS3+3hFA63BN7brRWGi9uLT1vU4jzpCVpKO2Vm6R7sRUxPanpqD6ZzMoMy5tKmF4VLW8DoaNTnPjIisXI65m/FNqf3CChmRa+Ut/XARu96rzvzv5qHx/xsGwVU2M9iv7pXkjXTs9kIZxRYkXMQahIeIicKb+n+nlZlSVggETIJ0ZT/GDQ5qU0j/LzAJxtMpFrAdzPF+EyZEroTeLVoYQeOjFGLGd4hbKo6dVbvF7NggZzOF8u4BTEFSqZM4yupnqgtxlzs/rfUWTrRce9VU5T/t5OX/CWmXULhkLSICSgjjZ5p/+1Fc/OUqWMWfzEJDh9ivUKKJHJeDE8qEeaZ6J546LhZDhKI48YK5JllAi1pvKreZd8zt99vkFvyPCdKVl/pFGSSNIh2pCGfjrYLeW400yWUSQVxAplUKNiMin99hCdpdMndB6U/HAoCiO9FfkKpiHKd5X6MWWTimtpL6usFA4fFNcfc11nkRJTqkxfJc4rlLEYaQ84SQ7BIyX1EGUR5xG2XL0PvNGdfOHbrbI/xpV8W9q0C+359l10BkRVIIFSeyyqslGZdQ6vwuHMIKSQb033+RrMxd186BvcaG53YmXFMrfHyzcBApD92iU3lSpDHDpsz1FIWtdLMzXKiq+MX7iuCC7GxtGe7DtU3G2ryxRVDFgWbUIv4fk8Ol+/EskSwInqznRO16VouR1ZRXy+r4ORe3xgF3TAr93a2KCWoGc1OLibI1Dhms+wflAU9G21BYYwCocA4ava3EDkE5gzw/c4HHuhz+gZxtu2CCbGUSgQMUUlZZQQHAVmv0rPSX2Vhfn2s+mt5h5jUkxT4MG9RZ44t7VsfPoBHUh9aGbmLkNEPFw3LtSKLG1rJp3sqHtUo5ZQ5xkjb37bCE5JfmLQ3O0/nDMTlDDzNwZJtCAjCRkbOfMjLs9K+0HXw58KvXAn5YL4RPgupJJIyZFRxBtZZtcgY4WULEvI3U+nf9/iwM1Q1WhiKytGf/sFdius1XV2jgeWL6Up9ioZp2l+gQnUxmzSeZaHzBhunEtMs9Ah7POLJrM6Hlmq8zCZUV9q8GnvnXbrWMo1nlucmjSHoLz6+qM+d+GX7soCVTGIAcgph8xIKJ0eeSRINt+gtw0VJZyInM3+tgxXmABhb9HuEqZ51D4cC7qHwK+1R9pV41D3A0IfrPKnCPXpFyhfeg1j3i/mwKYUJc/vmdHxoGx86ctrNzJPSUsaUSFnaqm2bL3221QTbyhISYFnrlpk9TiepsnWwVJLJx1Pw/MzmB0AttGgxwbWpxLWIULQGRBdwdPoMqdqg0bAqxcESHvJrBj7jKxI30EceW8F8NFuPEquN6qVqMUoZ1SZjJhPv0Ce+SA3y+Of5Mb4xaT9nVvoqvbB+1LBvI3B3OrXpeRQ/vJQl7XqKo23AZqb/lKVY0hVGKpmpsMW1Z0lzVxyiDi14zUJF+ZsnuJr1ZoY0efSnxu4DyF26jshPecbMW2gzlSryLT/MvBiD55vxm4dOSBbUkow28lCdltyhuLMI0o4OrS4FSPeYZsfyxRgXjUvr8YgnSWmZ0WW59M6AzVYU0BaIqNEi9DoQDDMMK8iqxSJIu4QYoJQWIrhwYngGXJydLXKGV3BRXuKQ/CHixDfLiYigGpCpSAM1AtF99Usi9zlRb+Gp+Ci8nMaHPYClx6TDMujvvEufGOj36YYnYbiW2wHgdSjg7MZIO0A/Vz8XEGlv7Oj1ohAwQE+AVLCWUmCgayRglRK9+8jXfkUuW6oVC9dkC/vmZpWD48FX4BgkInchwWZwldjtrBpGwXp+7go8G78it5nORyjBCWF/YEIcjuQ/3obDRgieBZ+YpSWwCLMN2G6F2JrA4Kk787T0thX9fLitj3+i+ETfiCf4Dc9kbFmR/PN4x27z7vu++0NxR1EEa1WZM2+HMaLrXId1UkpTu3VC1jl3R5+74JGAyXqd/Dduoy4aDzdnn+5q/ahETuvHzh0dLkhBZMo3GRITK7VB4XBq1Xfe8b2uvcdLlxmyeQDXbRf4+6r+SO8vBRty1XuAhPB24SKhcNGpYKFQKO15HnXwq39zBkDAkAE5q67Z45NOyVVd2Xbrcv9RkD9PnWG5u/hROhxw3oC8oVawUe9Zlw+l725hMkrqXMvEHf+5knyCrzdkmfVncOPbavWuGPXOmjRrSx8n4jEwzebc5HwjHxX9MAU2bqk7PdH6KCXjF85nE5Fw5+UxHEKvmivKR0Jv/rbDYqm/b0KR+bGcprLnzjy9arxv8S+wKFhmxSbJwQbXGRj4ZccGr+tv6lbx7yj574rKkjN95oz6kxe/ye1bneuPEcHS4Qqt12YzedV0NS9NCogTiwWE7FAoPfrRv69uohGsbFw2C9PniMHSNKwoVSowJI1P+/1E0r/9GmgeP1Cg8OPG6vWCFQcrPx24OIV4qUqWQSLxK3HVpXoZyOT16BPWHVxLUg9P4qUUgLX712TpjG4bFe5gWI0WD75wGiblxfp5/1pIB+Qxn+lLYATW7XJuHT+B+NB/zxju8xW4WKwCl68vz9jfnWMfAojx6DbBjTNh33M0Od9h7WencYn4mngLKkmFrubLnZmFbHcWX5JZzGUjvAUiDYbM1TImmTNcq6aEmevmuxTqcsqEjyiuXCYTyayViwasIjTQZorqdUR521KYmUYTeanHEU56M5NW1pBvoS7m3koWU1dpGgY1VHsTyqfW1QnW0ay2Bp8YBQYTofd/n6tw0Ddast8qFEUHNyhpZMXpwGmygtakAI2b0L9pE14WxlEVYLn4pp3K2VUoVhniZA/0j62P9Q/iZCqDuHAXx069KZYrwNsy6k9qz24Z5NiSPmGBRCT9J8FxEt6zfZBjh3x9+iXer2ydmS0kJaMq7Nr9KcJscqb2iQNRqK9ho3XCbnEujSXhiDCw3n321VGgaMSrslPXo6sCZaA4AzDEy1NIIRrix/+XQWSY7fwsW1XAH1tprRRF+WlEpWjE/2dfWZV9ah8SZNmrQ2WgKqu/Cf/afSIAgswlJUy+VuhYJ7bvWLjDMXxbQ9uahug1Dc3bGoY7SMClVnPY0rCtn/DwAHYEUQHNg0lyBVyFAbBMoZUThijoiiHERP3UG/ob8wcWASxZliKAetBT/dMFVREevKcqYis1LnJIW2xIBJogwglWd8zxbi8Gx9aKYgJZtJigKK6zu1BGtGf/GEp+DQtcsmdPtlpkcTFBUfo9AFCYl7a6KyGKilghXqPNS9TCcy+0Y8rku1E3Wn9ya4s1AczOEr2WJhClxGlESWziWe32kp2YJZpV3aM80VVjMj8M/eh4w9KxxNLPm3naZEAJw50Rg/p1EaMVOEzsn1xkK3byiK5IzZGra7MEhfGm5QM3JP3xJjNlUh4U4c+UnMAISaQ0ffvrP03RKjBPr7YJHfR0sf5qhhg3Cx/Ek/AbPPvySsMAvpYbYWJpC6POlQy4wh94xRd1rlDLijBxtfyYAXlanUpdPc9vyjWLIsxJkWZxrnn3PqT1ijWt5jkM9cvxMR+uSpaCc7dM79+aKwUPhKvyXdbSDPipmjR7fcu0/4AMcV6BwVdRWemrNBSI8xjAidON05kVTJ6Rd6yiQkFagnajl5AK2sh55Lald6z7rEuOh9mCIgEujKMcwHYcxfYXbTvLGn2CRR1deuJk3bwurrmL6+xMeea2G+e+vTDX6uTuGg1Dx5DQVLPeGbyqZIUwJQtHfPodYeiqvd/4ntT58KrqkapjKul94335n5upAEOGbtOk3uF7xgCihInl9sHNGI422Y5etHdE9of9LUy4mymyYJnAOGFSua3zboxa2hBonSKk2iF8rklMq8o4SllGBeXrhpjhkpy0sNeiHP+XDQBWlm4bQvFTNSGeqLo8l01WQYn7sFl/OyueR4FoLG1uAU6JGsoVe8P5hy7F6DLVPV2bRvWPAyYGbIMbxghNSU5U77uN9mRRHBC57Y26zZfxP8tIaTEHipMqrB33lABFTUWrAOF7NpZYbv1tPbZ2f3j/cR5d04izicPscxkSQnKyIVEpzqbOtX+3HwcWSGaOMwzTy20XbiGOTfjPnm2x5xgH2QqvezUbew3Wi9PUa6Tc/1HnMVhdI8yoE5hLyeJ1R+8PGx4errKrNHbE8neBYF1xSbAmMFrzr/3m5+1VPqqvqmEFV9SgbCjuL4bonwftwkR5kYzLkguBbxRaZXa66K/ljGZlx69aRjUFQ6lm1A4eztxEw9I2MYdP8vZwnJxYwHyHqHaOnsgChHrP9IbqS3Ixy+zcuGkVHA3OiTcsePkbIObD0KPQ9DzHwaqSmNSRSclLF91epcRDJn5ApuP6J0eU7mWg7XrCdJidEyH3qjn/XDitZ6QTd49wnZ52I4DGH9UsngxiarRqo9vgLChk6DGZhVtlqAiNgEu6BgAw/8vWW4aGud/TxAQjHi3crIYNXRpgZNL0LCagR1QAVeFdJBmBgsUnY45nTMpdzMpek81a/I6XCM0/o1qKxbqBS2grJSDEKAxYAFgPIWk2Tp98H5wyLTF+7Y4xgyTeQZXT6gD+gMZrIKt34vjx8rXSShPRBFHM6kfVziiBiBZnx5+nbKKcx9MZElFAxJDI5jfmH5UshFjfmn/PNs/mh/hcM9eK/q+sFg5715W9JsYfpo7ghYQEysxqvsyVWchxZ5WI08zzFC5LHlfHGGouEHjm+fkr7Uy4Om/O38+Ag1zsYWsd5kSBTCHjPtsnBPskcFd7ypjtyYVFWZkzjykVEAsz+1aibYLLxsalzkjsJw36K8JgYUUb+pmzcQgJ8R4YOR6sUJZZxuOjA3zZGTvVGY7xiqyyWnnm8g0O8bvN3X/j3lWLAw4QvpPimiqVNjmzIshPX5CFBs1Pd4Y7MgQI1dYfaw6p1LyfzZFl2H1i3Iek3VWnF/WBULTdS2pZ8ybjqW/zmk4i4FVSkPxeq+ipBdS+ibJ4Zvw16vy5x/SxZSC1o2f3dLJtOgnb44R4p5Ft00i3NjgPLaqIrHYCm5rxbzI0RSU+YzV3eEVq9bVMsK/a+zDEOswdd6D+Vi8dEb5nfzXlBEcaxBILVRKKAVy+dQJPs+eLdurZ7tbUySjN+V999Pp3bzeDvctIzeWY73kiaSeJcP1ZJLe5YTU+ljCTxm18TK10nLQW8/iCLnmRzRqGww1jZZsLcoW4ckC21qgzTejqMk3QOzHWSI8wO0djbG/gvksT4025qOQZaljVdGlaP/0CSbN36WB6J7lr9Zh4kQxQQYsmC2amCdmLAdNoKyVxyCGabAvRJdOl5oDTWhL9XJPNsvdOthYtueqNrfK7q6aF2sV2vl5TyINwDfmOFPu8sy83TdP3CJwCAB1hm2pC0WkmVCfCRtfQ8hdlIznf10vAXBHH4LPYC22Y/ws5bgUKcy4bOt7TdzMaRURJzCoVMFbOkPN4DLk8oWZe0lGpQMkuDxgDzbGM29W8yrhq5u2Jw1k/wwRNLOnReWyf/SkaT0O2n8ZpA3AcHFoSkzpjOJz7zCom3gDHQKTcCaMMCdhnpAOhIo+7wTfyXswjhjGhvCMiOy7CoYTI8nXm9o8j9df19TU4Vl6b55h3b6UDBKuxusJFU/lBmqMFJUmb5sVur2MbiSeHv+vFvhAyRzWup7gusWrXspjJCRodMoVNkXEqQrKHU4duzXpslHHUy+O2vihJTM3uVN4BYA8XPRWSl6DDDc+lKlmpKh8uvajdVyIrWRA8zIpmC565i93ZurQEHSUaGk1J0AG9/vhJpoFCmzAQrnxaGQ74WxsY/qvpadMrgzWWEstoOmqDg9WAvm95GZrZ5iE0X70nUR+C0j/2Fg+hLxY9V4RnhvWw9QANxPHYgD/MPy5y1h9j/aUkUNgfJfc8sP/ZkfL+3oYRQA4nxaTG8yv3QkeawHjzVyFoH2EC5NueIkHwktvtqewYiD5RHgmhX2a1rOAo5gUxYT16eslhScXg/vUnu4savHE34yjejUPGjtja0yNlYzO6PE2cPT5Bp60KhAPn89NV0i706c1YqAeE+AJq5Vq9zQ2hqKXS8lwaU9j3rGLObmBYDqEi1bQ8uN5hQNLz7RmfOIrLQkocOYvMoLp98w/G+cPhMiYrzFpuW36OlCm+dc53X8IcjDrcU9DFM0T/0vms/eEJ3YFgfUmxvE0C3bPejK3yEXxVY8uInTeHATSnSf6pSbkAS+nuj8pJ75Fp2B2TUjAQlQtH0STVqxfUH3e7nQ3eCtSeXEdsaNYey/EzIebIYFrHVRTYKYyu5McyeMbOb8Ck4NgxucU7nfN3OksAQHXs5JdIlazvTH/Y89ITVqcev1H6zQN4bLD0hs//f556mH433jIlboz8mQrRxDV48UKhB88zhGLVs/Tv77gp1rvjXYUt51BBG8crl3O8tiDqXEt21fi7vpIevRPr1Fv1zgKZQMXK3dwb8hBBhU4sX5PZqGvJWC0L1tK0gMUxFQtj/nvakmrlR2UqGKw8fWahEOnncTNL+VInttDGkivFcrlEzuUJpSyLTKqo8kWmSVRyTnEwEfhxHy1D1r4OCxlg6vgICCIPMf+vSTfhv2DpsF/wyV2toyI7nQm9IVaSg3M2c0zRiuJey6PSqVVTS+seWmfonLARy/y/7qrZd0upe0Y9XA0881W81c+6pLjsuaxgXfJTtn49A1z9cBR1Tyn7rvqeZwcCZK2nDZLxutVZLO48VByqIXessR1fjIxDpLALZOiZYoYhSLcGa7QCsuo5IHsTTdlmrzBH1t6NnQJ8WFUJeH4A0+uODF3wdp5vadwd/0UKbP46SNjMdAozX+fbFnhvh7rADskB7fkoC3NlCBDqXagdi+0eWLkvM8vKjxxZ/z66/n0zwI+JLIqeTJxMjI4swvhDlsjQhWsXQoDQ7Wu3Q43WyE2AUO+V3pD6Y89O5w3nrt4Q74iSpbqvYqGi9RX6aEcC8PM5BPLk68RKnS6x8vVJJOLcZ/qn7+c/dRG+OUnHMNTxbS/fnQsI9Z7uDXFyvsyTHwKXyVEF63t2hTaTnjJpd5En1sf4ESK9W5q33HkB/kR6HfAS6iBZYZs5Dxw13T0TnB83jDH6XRaL32V8U2utxx3GoDGHcfW1hMiyDSpDcRZjS4be1SbcSlzW7MW7WFvLAGVTyyJDG7qPqhjw0jddxFFbSm8QjkUIZBpBfh/ARJgTkJhZrolKNurbjW0KSOZqyWkvqWKpRgA8tqcLlHNsbborQmK+7wf4r1jyILbundn4bxtTK/X6tMol33LNg3sGjcMH8OMG9Qx+/XtoOsvByZLs+lgC+GhQyLGdpx5nDwBoB0rEQxl/cBLjppG4MRmwjDG4kR3avgW+3H8WFleHAoHqUHHcTzeZTyFT+ORpL/3tfbN9WZ4wK95byM5QpJeChpuOez2aj5VzK+cGh72b2LoQ1//+/ISvdLaJXiP5E5VHo+ak9vC+V6jwbEIFga3CV/C+92SNjzrKOij5s7GbzmZU7ICA7C0Co0Imd5ZzpSxact5qQYnPyy7LTyLN4jLk2TMV3MaaAlN9c8COlcuzjwDfl3e1Z+ehtZ89SK+0r4456Ej0z5/V/ZtXJ6+iL4yvHZfb1BINTLREjXsTo9vJ80mxaVz/3Zr8cNdq9/JhpaAZ4Aq02DZ/BxHpk9JuDXbHjvOd7egPW1V9R/rDnkeesHq4tx4uf5ra3pGT0xqBbQ/i6u/o9q8H9yF1zg+FdTE1i0eMEKxpHWFHs4nA0MAqBQJgpDcRmxxhoOpxoVESlBzKHgf2AYtuzusPe654eCk1H4MdC6OAC0UgPNcyxAP2ii6GLxFPPURihVZHeIW/F9dXUVxbnMykP8795UJ/WbG/+G7+JG+Luue4p/t+x7cVV9dXVlSHi5/c7B/EdFZ/9m/zjud4y8MVFbTI3hXzXGQelUvlkfO/81z9Ff2dpr5w/MKduWOzmOf/2QQGrdi43ORLvkvRqzZU2gKPUbGMAZGEQ/CK9M6BPim9or+CII1wp7cR5D+IeeIMgjFlSm2tYMUhDdk1uDclRsQ4x7j0Sekd/OeXhtEYL0829VVcU5QD4Ciz+arqSwb035G+ygvuARh5i3dsHpmSTSHnje0YFQmdWvoooTckmn0+YAw86nQmTN1s3Hwh1Easd597RLLzXrNo55BdIUCJ8+Ml4EwphmmzFAWqKkxOvXTiyrVcQ4nHRHg0KU/3FijimOkYUCDViKkv07TkuQHJniiq8Tx598zsOzVYJeeB7djzmMd26s6fj1foNTtixpa2qh0b6Buch5wrqZoOaY6mf7elyQGG9tmifFTade1W/u0KQMWF/BZdS27j+VBwz09cANgMu8VuZjk5STtnFK3RzMaGdT0zeiY6P10wL++4IUf4vNTdDs0ckPa3kOLFQI94RtIGssHjslg8LsOULUV8XWw4Wd+daBEkLTbjZmejs2fj8P0TFJGhC6cvhFzRvflun74dGkeI9F6afMm7If/IljPuTr7rbTAc/omQ3L+GEFl5cf7FdPvmTZV35t+pHLbEa2RmgVyhiYyP1MgV/Ba+XD5AqQYcfCQPJkR7B1X8i0Q7lh0OqNUK+saVWj4diWyQHZccj3rg51srdDTyRMj70TDBOCHrViYaJ7aHmu5QF0lFXkI1t9FbLY9KJ931PQIuk6IK1o4WphOF+ecIFwbpmv4Q+ABe6NGZ/HarfaEtDhKYrpueOgI8mrhmWiNHs+sGrJ1aOnWtPeiNjgjQ4HcFL2/vI84NfszyhEWTphFn+7LO7bXtZYVZXlvTb9P0pDRRoZ9w6nJCFrp/PTzcX/pYfwxcKIonci1DtGCvyNfhrbU1t2zJT9bZ6Auz3vrRl3wWhNBEZzIqGEyrjZg7Yr5zJaxRvC16/ShaGO1hf9vM0Bysc8dPD4auP9wZY4uT9xvqF4z5Y3DXqfx8Wk1/DSF/jmUOvh0from9OCDAmh98mbiD6xPiVBmmG/huy8rp7mm+X3h7e25T4cpvn2ZJnofX7fnhmUP8DvuomHWDq0/TKkoxIC/hbUOCP2pBx3pEfJK7or6ysqLe3VrnIpKoXCqJGPu946aFdmW5mHAFbLSnF0QfyTBsE0cSKuIzq68+YeQnQtj3+dl9NYSlBGjRpuIaxlJGzbAVQ4FOnaCufDBscPlzrEAMi2W6L7fLHxdVlVSxa3EH5f6FqG7wt/p7lxrxV1++tTZdW7xMNj1o+QAcuAjKe+A027St4a3DmQ1+pK2eGnpRtPVjcOtNSzRw8o9ctnEI0f1skHTq8GsMHwtMt1rx5U0t0NM6LNdWnS0Fr7CsWjXDMQVHA0k7x1smfN00Ri57/6a5wREg0z8M0S4qJA6sDHtm++b7ZvcDd7ORxdbqUAKEdD6rOhe5syofhB9WPpMj9mxzgwGTCGK9stTjFkWvuW5PsE6A3U9QEPZj021mFSfvjQPF7U1eGv8OJb/ilZf8pI1rpbn57n4lWN7uj30CBUDotyfyTqsUelVSwBfKeFTwl60+vZF50AHDoZ8OBqReh9FvETQPaAI1nYQ59ZFgf+DyjWwJR5RL6DlWm4mKgwCgssxsYatEqdghXvKk9DWdS1doMoG1SxurVrftiG0D9gmwNDmvkKVTKpnCXPiUqzpU5oAhAFhCBvTCRGF0woU3zWSxXKuXZEOkkxHLQoo8i/mocPVoHE3EY7D0CgkbSULEIEjIZKnL/1NOoo6XSMdAxOPIPIJYoeGSMb05gJMqFEHGEIkQSECpTgJyejHkbLD8LuJ6WmzadcTNNoesyogBg8AxGUbvHlJ9e02acT2kcq1+VlWdpyIBKO7EnSnfne7Tp5Dd7k4PZ6TpKX9LTi8u8SwyMEl4mOwKYCKbu12Rq3h/tu3c8+imOqAQFa3Boig012wJlheie3NEOb3odJJMZ/LeuFiyxBrF/lbfvbrougW/oqpAn2Zkf3Bv7gnZrneBAYPnpENPd1038p/sQ3Bu4NP+m8nji6kb2T8duEDBye++qzkI+PHU6DQsMqMwE7kzKSZ5NTjvn+vsEWSWJC8X1XUEAFiLISkYbcINS0UTz7r/JTPIQnnLfED5vKrcAGPBc/oOAhxxDwIAv4Cmba28Hr/vX86amHrgWgSG/IhGk0kqiQGBVMnF1NFP1lWIiUbtcuPoRixpHoUuF+0ccgYSBzmDgFFzlIxsFgk6f/JbknQCQkAgKcCju54A1jGQuEtc7iUckrEO8KQLjc8F80/AdqXEpOyCwTahs+A3UmNSb8D7W3SyWkcRX3tX4AZ1Z6efAIzwTrB2nXA3BO6MYNcDdxvgSqmHD48APHWunGp+2qCPyuGSg8JjUcpjy2f6USmb2vARZwlncWb6P7G7Ys20/WjFv2De0aieRDqBNA/NCYx8olHfuX0LHPP0jlozggJ0nfacBrooIxqcOdrbefoLjpqRdzaEcSsqygyuCTqqrwwWszkcobAPFGfqqh1MMIaCQl0mR8xWOJ02+Ark0boLUBxRjkBwVr5wO7mRYBURar5/9d1Rq55GOAGfQZ7NC52AiCdq9Z1bt3NInvpJ4cLNHtDnNZ+qVXlnFgWOQAGcPRmezmh2oaarvJOlVKBSTy+M7vRk9OCOwD4YTBMmR5fRC9cfnSkUmZjmUt4dofBLpAtY+mgW+UUovHPJRs6q4CiPB7huA9oY5sDH3W7bAZGGflpm5kFNJA06n6RGOhC6vMGewSyeNB8xZ+0R5FT7V5sf6T0VeWTtHET+ssKqenfyEDqHGknK16BJUFPeTLfyHv0Go4bVnL7oKw4Ox31dlO4g6sGb0QoKReTlXiM2mwuCx98GN0opxeUxy9Hmcgd4CmPnKWD04s7qc5SvS7m+NjVLmm5nKbObFKYAgccL4JWGnAa5W/uXlDqpzjyLDjfFipE5eDHqBdRK19ODoOdUV6WDatJPdFS6qM9B9KCeDrW+EKPwOWJkLNxEn1VnniSlXkfkluc0KA0BPI8fIChMuCYlK90uuT44zz+sfXHnIw1TGWTLmclwWPxVTyZgjhu4K/oncI4buk1qCIamo2ZD3GSG8GUdhpYxOQJfoW+O3mz6XHEEv2LfW/wav+C5NcqCfRRBw7U1xiInDkPLa6QKk3ACo6Po7aZvFFWcxBPoKHo70A2iLAgNm4mxKKRusFApUI0PNylSuUGmbA5aFBpbA4lLG8hR083MUUMJ8BMv6WA3+VIgOOzWFFLIlxRxfaHQkNtGIaFm40KqMU8nUIm1lB9MUD0iXlWPiJlmmgeF4sqEWWprofhSPfHiWkWWbYYrEyarrYXii3ua4VjgrdzTDnskiQVEpNxKRAV4xVvLxLIYLJ51RKQsiKgAj/mhMqjGgfknHTihUrfcBVwpRxld8Gjijh2/ILjgF+vAZpum0FNuv01S6JRHWtMUYGuTFESiC7JDWiE4Lm6Pl0CMDS4iAnuxyJXEFSydlbEIlKfHSyj6tzllK9ECE7sMoVy22BNLPLHLEMp3PC0JNu/LXcrrt1HrxBX+GNWc9kSx5TtcZCr2P1y00+lsWUB5L5e5vHeEPWGqJ3Z0q8fwOIh6AuNXvnmMyjAad5AZWHvYsAOlYgbXbtzBEqtmUO4tu3XTupYMOmufMqlaEEj2g++kGoO6BnAEk1U02ByG780LdSNkpIa3bYAvysytkkN+PWA45fnNZfj18MyWfSb1WFkNpXDCWDCBgXNseLbBSyCLKrQ1LMxQmI8FjDgbY74p0wLRevG7DAeJ4o74A1kilIOpRedEQ7nLF7vEa3OcRTNvNvi6qvNHN7N6qPXquSgBG94iHFKzYIgd31FOaXQT6ZAvvZNaNLDiWqmNWd5DRKhu7hmFq0VSL9lE6KVtQhePBEl7eMOULtV92rOjkiSVHT0ceHijBFC6EV6FzeTK1ZBwhBMlnH276KnsSJIdlZ6rm1VCeyacPxOtgOa151vjZmdh3+gmI3Grx2hwFwQLvjsspgVzaxyy10rsoc3Wnyh3Di5J4AH2jD242frHlDtHlyS0QmHy4IDbm7O7HjyU1NYHC85xVpv0B2hFg7uck52gPc6VzkFQp8zjY+1TJ4iYd5x3kii/wXk+P9XZiGucA4BlFzRo7KC0XYeEQ6hNaENEgYgeCA/QXGEu0tRr0gYfrpgMEbkrUZo469XxhMTEQl3cnTjo1fFY6PzETJ/aDEk7qj9K3IwcGekq76jMArH9DC95GFAvKa3+Qn8F7S+yFP5wF/g1eLZ0PD2h58nOpPmBDsfNcC0onAMFb6rMArF6qAwPaMEZWqyCNprfmTDaLvRr9GzpeGZCL2dfRvMNGY6b4UagcE4SeGVlFojVJ7EtqhkwwmQYYVXSA/Nrf5F1u/5Fs6Mu70G+ROJkYhqBcFV3HbBb2YmBt8u5lcpkEjAiYIE9CzNKM0cZ4gL733uEaXFD+dHVhKTkxS/HPs7Evvbu1tR4039eh51MhM8f/fg/tBuyZuFRtBnNIdhzB0LToQNzf50J6rgPewecAr6DfUhctczAckt8u2iHk8BdA3degVj8jZgOzIanLR7xJC0mnRbVNmdBS1NrU5U6NR91QK2Ca1QVBCV+0/QJbUKkcCsRXZWUgQsIhci2eSM2cQgKtiK/dEJRBqZq7KX4+EtjgcPAE0oV+fkEOvx9Eh8+hJf8Hm6nn8wbAucnve8pZMAZhb/Mn27wB8K1kiZRQbsX/pbPhsHZ/Ldw5MFhQevhN2DJsBvwH96r3pRVSSrw8dGYD3At8PgI9HcaXTqljJVk+hajMvqt7289H58muumbxj6zWVG02E4yHQY9WbtsUX5pu6s4Afssr1la3uBF9b2/li/j+WjDcVW0EN/398qJy3VzelGo3jm65RNX/t2HmFzBDonh4h7KAZ87vk3vy78MYTIdCn02fHo1LVBf8O565BGo4APgPHWP0djX3kJl3Jmzru1OwlOsxsQeL4BGvD9ypqet7i5ztdezu1lvxzEpTU6Ca/tZz0jGACvO3Cna7iQ8bu+c6W6rZ5nD6czkWx2154Zbh1n36aCPc+Y2TW4aya5fjUCsrmePnHjPZSWPbXIStpz+ziXioSbiQ3fbtzr83YWa07UOVIfv3EBsihFtQedsVnHhWIDuaXXxXrqkc7y7rfIuc/TCDQWXRX1MTRtIPxyT/vJJbv8x1NW6Y7eHf+47+PDA44XNjx8bezyQ/tbLtbkFL+socdu7jwJlB1tOJ/745bUzwyO8xyFBEd4dchTh7juaKSXlWoS/UZHXWfxwnroo2vaPhV7ycrRMfqjvw+WT5xEzTl3b13snwAu33tz82LmnzR/YFxHDg5t+vzhk+PIHj8dSxko94fxlHMxrj25//OE9R+xSuI2jnqPRf8Ix8scfbxDW7Ko7j72Ymn1V80LMACEY0OT8M81Y2V62vCqa++XPPjb3s6k5Mfewm3/nTsy/JR/y6fwf2Nf9jYEu8MWcDzTwubMETRWrCzrLRevyHjnacxx5asL+63gUj+QRWyFH7DVF0Rfk4X6ukc7BY3hs/TeRl+6c+SVKeVJ0vczzy33ZepXMzSL8Gr8WihbXye44PHQ8kkcgREECh4dBPxdSwdDwWPxVkMBht0MC4NHil/uyzSrFD8n4NX6tU3QThp7MHT+gn6irkQcAIgKIWgQfwD0esIweo8Y5aTaOMXQHhxgTHKC6a4cgD39hbmwglbp+LgBndVVsnG0kF6KsJi2oVQ+KllOCiojJnBCxJnF3uxPB97RsLu3YHWI7tv2fY9udzM30fsR2zePqmZNPhD4VujrZmMhtaFwxMEu84uqZiQjXio2CkArEkebVsIdBF/GwOl0sjgepb4zYSOiQe5+t/MX4MPoRWCR0I87dBd4Plrt7pyjTnkYfqYt8siWNVkNL1S60/B6/DuoUROOKMVdRhItgGHS50wlNhTSQs9GL6tlyIuJmGMmfjjgFE/p/t/O1K0no+Bb4EMaoeKgdFWQUosOcszDaIVKrSdx69FamMXUkIULZd6yX0M5rZHRPG0vb27FCdrPjeuPaYTc3jnY1rhhzFbVlIsIVo6AJnTsrfWJiZNTQZjcKQpCxbHgzfOEsYfHUlDtNyow6Nb7cr7QVqaqkXUc4FjKl3XVZF1fDAjwCIaq9zmMjPA29tJi/cw2kV0W6nt6AsbI+eDNv5228FcrUmynIW/zuupF4J++q6xN5z86ZX6KUJ0XXez2/z+9fH5a5SeuTC8HHjupzrk72Ya3AsSN4m209P01HLAjQGsY3/rLaE127IaNJ8zK83badn9YVkExWhvwmLcSIm252i+1OqaZx7kz9HBg2rWO5N5w1kA1L8LZwSjy1qJ5JCWbOT+tMmIwQNUH53XFTpn1FZnUzeDvavpfLlWhKrU0LWkY9CbOBs/WL/NG7at4WMS82e0bmk+aDaaNVyqIJxiIk5AMeWV6Od0ZZ5K3jgiyvB7v4/4GarXXPutS0a6Zg0KYusUlYCysFodT/++NQxurIgpaQC90kPFiVahsXyQBvrur1nEh2M/yA/DiI7lMNd4bM/rBpHenUPoxRRfICIFS0In3Vnm6jTQw5ZRHDiYeENmmuQ2ba34+za4y1m7KXUYf2720G2XP72faJkSqVKAUV4TKzcwzqvVnv3d6Gq6ekLmU+vkgyz58Bf8gOps6sHcslRzjG7ClETnWzQ2vSm4JQDrY0c0qg+tpZsnZuATUZ52YgRNgw+jM7wHP0TeYTaRJFuqRD+mSQjdJIQh1kRaYkJBsSkJ35b3wHHh1Fp7vNBBMd78H66kwN9WF3QmjA0NnovvqhCii6NYD9fysAw8NJ2hrltNtdPvfpPfHe+cNI54aHIFQy2ziR/e+Wg06cj/YE3n2JhOzJVq1D5HoSuI/rm0tSAxbonF5yP9F8FBlNWpbjStuxV0+hBOpox4d2/53Tmp2uZEC8hRrJe9p85xCWatmPfWewqjFcyVVdx+QkJzfH/rfykXsFxHSFawpZ8+Po5QdntWDbOFjtuj9qpTsXVDUyolDmmeotRZBhanYXYnzR+OLrC0ztiBIZu+tgFOOLxpeML7u+wNS/fxD4dPxSA2Cb9dMDdrm6zfrA3908AE2TVLAQocKEixApSoy4R/Hbgk7ANnG+0LHNk0PPuhhIMmDAt/4OD0cMNR1tljUOXbn96V1jw7dvDEZswDzDvW/913y0c6h7SNbfdPv54/ipnbnwaq8aBl7ziUMfLEvYKLeuvi0BwE1zZaCqt/5dw8jOn5Sw8W7rS0zW+rF1zcmqQ/g0maFbvJfgRLWaZ15ptBAZyT6lQQpzz0TLSi9KHkCjM3NBH9x+B1KXu7ppj0kfpRpGtmAIIsjvUwrEMNfAIUWYgTNDOmAdJI1WiCMNPTyZzUkZ2pjKIrTa1YlFEEHUp0mBGOYaOKSJMANnhjQHrIOk0QpxpKGHZ7M5qUjt4/lSWSR6/uMRpqMO9C6LyIC7mluaVMyEIIL8QaXlCsRwioGDClf78GFNYRhSrHAG1d9xKisD1uBTutC4Fm/C4Lx0OtmAKlc+2wdCCCLI71XeDmJtroETClzv4CnzP/qP0QHlb/8DW2hQJegNdPL9Igc+yEUNtWoJxCYoL1EvkG9bDIUyZrYIIsj0KQVimIvQ9L6kANszG3PS6aaNJw36DgYO2Lz/wewcZweUJLWP90u9GNECKCNIUO8/1lAuAIaBKAFF6VwjxgJoK7D+TMZANdUJIYgg6tOkQMzgIjS9E5ognEkdvUcbTxokBwMnbKaEUzS351MBUjAMmFKGVs2LaRgwpIwZMYRrHXQAEDky6K7mStaylYEsxv2E9uZLZrj4hh4jJ+4eaOpOKksxscUVHI/tcXAP17NFOAuMlWFvYU/Ikc1EzCS5uU4ynTZjPw7Sy8hi3EeaRHqzdQq+oSc1K+XtcUmiC5KzxWjOrVv8axFRXzJme39CgSqi7NUZZqRjMXrZUzOONIkU9L0OLZOCb+iZMRVof1miLTI1v7eLTP974lwtAMZMvbaKHFoCawtlJJy3lPPHzL26KLFFFuMGqNrTt+DiGxYXPRh3W8yGpdNToeUoMfAtDWcf3J7K2ZVKZAnXq0V8R0koI+F2pGSZbOlzTMgTVlCjVwBtCMahcAMyiWuZkMW4DzSxNeEbFtETJFJT/xZCy1Fi4FsIm7Ef3Pz2WHMoA1lJQxBfapGw3j87E2YQo7HwhsykQA4b5CEyA7kZpLVXF7zqAwDuMedi5hQjPAuUeITN7wGIDAmNHLCMZ23FgkBGtRUmxlE9mMPPjNRSwcXAhhlAQSApDHI32zHenJ14lgL+6sdijjNgfs4YSEo5mzRGAJG1BcF5m8RcYstM6IQygQdQbo9l8iVHxCjP2Y/4xkfAfFViTcbkXpc7NyuEtu1I3J7vGMASi2A1rvZ+lLvRzqP0KjNDAYO2GnVIMxYh9hgiwE5bYjwaQb4VgVosq6clZf4WLmlrAFVz5zFITZF6b2AAQD6AILtDRc60BX1ONwp5lL3Wej/rfw3682PLUojxllLsTTTN9H+DRpLNOJ+a+Kdhzzb9BDu95odOngA3FH15xgzdLu94p8y/QXFvRw9PjLTg+rKzzbcBHANhrwClYp7/YTNtdwkcBkcMc8ZWzw39EpD6J9weApSSv5Tgfu4XdAHv/hN8+P0Hhi8BzLcfqEChoAB6O++Ju9LejjX6WKs8yVX0huIJZwTZv44vW+5tjculntWTJj1U0HzZK+tMkdchPMaxR2U1pLGZOeKYqmA4UN66h9KKogPKqKgb3feWDVUpQjVX6OKY0sQTC4XHSqEB0ik2zJQaVirshlA6TokYA9P2RQFLHYZa3V7hUkEXNj0J3kiuzGva6F5xg/ZjXlpZWKIyXlsxUFn+E4DKyu9vrvm10IMQPpjw6dNUT+dC6XH67gl0lXd7KlPuC7o6AeNKJSo5E2QJ6skSrlaeNoq3QBQGcBKmtEPiL/0VbcZ7IOEjkVU5XKrp+nRFkZ8nIj8Vw4qW7iHK2Z4UXvrRnuf2OrsgK/T76Yk97/+lJ+Mlfevde5DDHj56C6XnL40jbWzto4mJqgaVSo3MqGLPEtVWvbYQjHhlDhMNoW7IbFDyyERSgK/d85Esd37udGT1OVARSl31Z6CcyQszPQPoL9KNL8zubmbVcQ5H5I/0BTa9D+lDI1c0cwNKDAuVIRP8wl/aWEZ87tcfPMfO4xMbrfigGAsIYq6iMZEyvyVaAoi75Lj04dNGcg33/UVip6mrYOGy/1GqETnsjADUy+IQWZwFxXogIQXDoJxhR7nDrtKRPnNoBoG9ZPoQ8cg6Zrd3xAQgy/IMB3uesUaXQvu2Asrfw3dZ1VoTGxWXsRjPEwBc2x1iC3+u4scL7zv/qo8RdZ3oyIM5i6uAqRzLzRhykFMwcAG5NITUBHsT00dO3PSZCaPwUDZuMxW8SgCVM+tdUTOZtiu7cHtpzBMYMIyIdkFXZ3yCZCRv1oxIHME7SGY6OT3NACjFoJYBbcA6PgTYsxFcpWQIIQ/J0kALroDpcW4S4BOf9ricqzCNjPD2RKrkQGoUG8+osuDYMbWdsbNifcE3dFFLrnMWbGiX8YZWMewZywKG4tkvhKn/kGu+7McVdME7ak81I6xsFSyqKUYV6KAqUZjM7d/FEcv2PH0OktHtkVjhR8aMy53QoQMDi/VMUMtDxOHTjsGax61cMW0aeCeaWljQ+riil3dJ7oGd+fjqemGpTARi91w3lYQQ9tNSUCYD4gWcxPDs2Qi9ghIYPE3veyMWOzja/XBlboFsFyjnrZG629UAJussWSMUU06VWcHPwYol98AjzU311VHdr1lo5yFtC0BbrL1Y4nn/m/TRcY42rhoIE7E7tDVLp0lPgEBthRxQcGV0vQtula9hj6Q/pbJjHVPKKFluqNXaykrj0fT0R9inNwAzMz/oCDRiTnz8ihUtDOy2BjXL4k82qiZ/GJoaPyBojyrA6b5N/OGDTxCcpAcr2E7dI7cEZIOuERxPrwsRCWDcGh2g4tExVZNoej3mGhbYsNnYKHecK7Ml47KC4RrqD0kwnIOIMelTSoQiuQuuRVlAqja1Ml6rbVI8C1J8XThxIAj2P4ycJVMnz3GarRXaILmjNLHWOihlAQXRbjQtV4wEERLu46DJv28trW59T7sIEJpp3Awl2FJE1oYvJ1iMwp/aFoEP4x4PMqPYV3gYK7QPEro0haH76ajlcupKaWCTpNyuvQqeazLAmiNDPbGprwYdf5J0kk5lOKbcG8dvWnBFV2GFp0IL7eGHrx2zSlWYoqIUpRULyY+GaMkxZyvtbk6assEszX6vJGTbdUzuupzFARwgUI4QQIBpw6RJUazleeeITWmeEEjWKFVc3PY1DJkSQdsc4Vb4yFjBFgBkVtOELIIDwphMQ7O5oBAjsESQxRlKcAjiKOZvKcCRY07ol0ufK4yJTedK8LHzcQ8/BPUJxh502sgF37Ebbqh2agegm5nNmN1HKK9pLwE2sEIiaj8ljiaggxitHoNXVjAVbfiGYp2x/CTQEO2rG8Tee1/UyuiUGmfOq0YlNEzNujOYM06TfwNjxqfDk5w6IYQSNgv5PGC8A/DbYQKyB7owHxo0MFxAvKn1a5dWdtQCC1FPLhZrtB/0hAHT9ycjq3zd6KK0szGguwTgTd8p7XTBA1cWw5lrud/JCJYkLq/tQJAoafyAAsC+DOLu3jMXptm+a95khmBwyCUX5m2HGvxW/dGGfcVrmqGF+h4b9zbk87u/K4T6mRBwdhUGcFtJS8u61yIclBweN2JGs+pFqoQWhfra285rcOtu21nIobFiV9to++DPMZcncEyc4Iv3xbkyyN3lxPmy7xnHyzXzrLHWq7D/7XSjt89nV8twKt24hVSXX+p2TJK/BZnWdPrSrQ1FztxvI43tG92vjcibqK/IhZ6QkB+uqHFGPJNQzsfkfyD6+n7PR3W390I/O/AF55x3Cn54D/5C5vyttYm5lV2cWdhwwlfTdBZPwUqfcmZD2OruQ3aeizcURHBzsGvqaQcnCjKjYQTSjNl65jjOMPuW4P2ywkC/De9KiPvtXYAv5ZWQRTdOCrC26+uf8sBUP+sL/ITSLRDv5BfgzPr3UI8DADSENZ2Gq7Yq3bDaGVWr2qabQgPUvq8WFSHonMYk8OGjQVqTHyDUbM0Bph6NMXG3pgDjrNEvgX8Yj4TqNuxp5doNtzWF1guW+iaAfRVkG3IS8qkdc+FjBZwxnBed8PlCs5I6ONPNJzyCzo9vHO7yhYSy3KwC0rALPnAjQCZwGxEkAVdW/QF2YlXzOAdGJJ25dMUz/YoZB2dTm/bLOw8tpOy6/T81HowZNZlPCNN47Ey8o7rvL1mTGw+WQ5VAgMZPwIXNiCUfP4VwEQ7FBVxccHA2pWn2/LM7UM2gYdS+2v8DHouq0cejRGW/3M40sYIK/Q30/uZ9sdDQJz58YB2aWn2WHmuc+f0wKtRTN4t9Mh+kGAz6i6cupDMHUcRp5CtfI5p9nAJOZUK4ARv5NGCiV2eRVYsPejBx2oa796k1uAuf3yhOQoic+c4m+uLhwKgzg5buwq+WHKr7boAPfQTd1c7CmwFOEhSeb6+zJHHWxvvZbOspdMKOv44DSY+cun72aKL4ju9ELMcQriE+Oe86w322vBN5u/2klczu6Wcf9Xlp7ZXgDd6d0r0a6ay//lV545QcedtZY5d/uiQONusH8OmEy9v+2GDsZbcSt5IzoWmz+052h0fI9Ma1dXGT6tP00I3T++vF8ciGLByLzDiO9EHTlphakDVhnsBTlggdAAFYmJBRyCiEFHLdgVy184YfVK7yLJoAzfEY/RC91LckLrpeEvWKzM+v2RPpzCclze9rubrFoJOAoKB7LcpAXEwDiZuDash79AvfgQi60HsHgKr4U81kubV3kLG9+2rt1t6N8rbCOmTTbdhfbc1jMHeDO1ZKTJGjHECB7NIe7Kv4aBjhEinlpXlgyI5JYnXBUW1B2LwQLNd57IejOGhZR2EUt4CRcV2DTQknJfeRfryUEOSMNLlPfIH4JUJ0P/UcKbf3lDpvZDYvFP3D/BeolyhcBb5yQqgJLQ1Oh7AR3UagIHeo+f+hn39Vo8+z8CsLlzzs19wAhvP5jBaLQCdzPECVAGvC5IkaXGcDGNeuWxqhYBzPgwBPPDSUTe5h+kvDUKs8C+UUCNJot3fGdP78KJ2iETyRNV3mNEkRRSgkk1j52cTDAX1Xjfa50Ujz0aqO67fjenRYLFkou11s3MGgG04ArYILu+/pqY5VU1i/9+2ntxb2yu2U+UDAMgYO5saeOg5Mg3wKv/o/TcBP3Ea0jAwzxOBVUG0P2DHGChvoA0MD83WCGRB8OjZbjIBiqWRXGrG6egQYPgfUYGXN0H4sd0t7SF7xM8aDAUIicwjcuJGsPlydPhxdyU2QHnSpP6rsPlYd2NzWmdNK1BMYOJnpwZHjRZ3zbN+QQ8cLAFgKc5wsUuJjncXcdIkQAMTWDE82wf311kZKBOVrhvryxvE1KNVVnuCMoioxCVJPUj1bMoQYOuSUinwSyzFpTQ4OHY1cxp2CIfDLxVIUGmBFxrVV1Q/VIXJAIAJGxNO3HXMyUvYPyISS8rZ7EVhkJWCxOZcYHIseJDLyl5eULncQJFR9RbXdGXnZZdYPZItgquIKs09QBjMAUUb6+SlPzSIKyfSwUdfBkGw9DGjRaGfq3vxOn9G5dI4/C/cOEdLQ/BbNokwE6GCqN6gi8wVfWVWCwZsme5MmLVCkGx0tKc7eLjuGKK22kQyf/Iw4Et1KFknm3S4TBDZ/fYkeop9rOCNR+SX6SXc0fzhFr/XPKWHyhXIoFZ3DcGIz/5FKykRSaASXVZx3T0FXyIBWoocJersYrsoCO1oT8iCI3il44neqB9cCDbgeH3LHTugPrz/fdiDSzQOWCPVuX9hFeBJ3RCs07IayYttkeokDwHwWVpp1H41Dz9n5vtI1zUKnNpsXytvH81QyjPUBE0cLAnRdGVmANmEnCpp3+o4drs6m2zqPkJXD8s776MkaHXrZoh6ve+1IxzTUWjJpzlOBgeb2DzfDhVWxo1j6obMpcu4ZEJZAl3DsZVg4lTe8DGwxdMID1IHuKQFFoJ3o1uJJxiQUvmfwuvX2BGFSh3dC1nbPnpffLY4reDm5P3DtwKGvXKESLXzslDMwlQR2iDjAmmxa7IBj5tU5yzEh4XIhdpJHvKVJU4DezFauB5MjJwjJukWRYaLKbpm6HIz8hAohx5H24LNnaWiXAAAyOCiguPkMLUp0waXWg3CLsHD7tUyWIqYGNdhjEgMEkiMuhD4Kg/RKLeQGlsc+jt7YwPP4Wxpgcx0XXGAjFJc1WQuqcnRJgwxHY2Ag0q6eXdc9TA3HhFNdtJ4OtHHglBPPhes2Y/9YC7mzvcmRkbdIcLwtJafTjiONfWkOuZT/NNEwKF9glbSzu0tU43h1VQYPXpYqt06jY/Z+QZsMBGoVSmjhcU+JDUjQT/Jou1+ihNQuVCErtBuNAknnLjrygOg44KjgJolYCpeYLyDgTDxiZMQ09VlSH9ASgAbpAnmbscw5JO4JMYR3f4dYR/c9rugGdKLoZ01yJrSesifEnNYnZNct8pxNQyqo3WCSc3WGGqqNqIP2QEfyR5F5iSG6wn//yWQ9eEabgIOTv8Ggj6r1lm4DfYoi3i/FDzLDGIuAZu01HDx1v3tKb+yR1FB/LwbBzX26JU1W3DVFlkFA3k+QDfKFarihmjzoFdLH7gorrNTK6+UU7cfUKxRUpbFmYqZ+OauWE/vYBBMwTLYPPghZIXkmzLa1TAFKEzB4oTT8PYVZf9mbKNMNpryyGSQk6idtb11JVhgphOTE6WZaboKS4cHPQG7Xm90vaAbAI76Bm32h6ydf8+1OA8kP6rlOlyNBkJODAYSPGTxeGCTesUP88P0PH3ANVt5gY9hzPqiqG+rMfNCZQ6DTKTydLkPzVQ66K30P96RYY2JEod3IU0tm7J0A6CqqcIZSyNA86TtptBcT06H9t7qtRvcW12vB25IQl3CnlZ+SBh0Ugc5IxYVcOG99jeR4i98Dj9mifNlXiDdk6uJY99EFMghfQPGEwOIDkDGW/cTnD1anUDoA1giBMX3E9LAAFKpinAsFL7+dcowM3tVrZiH4NaQhxKAOUUo8t5OOfFtEZDVJjoTkxop5roFdLB3xJ9TsCFtCQRX3Y/EoeD6hMx0u0PSN8E4rOErcxEjg+hGfhDFFhDEA4+1rEZBjXj+PlOdnCrez9vodhg6HtrM57xzaE2jBwiqyPhmbTGdE3TNHJ7nVZESj/DWfASojAQIJgLHbfZwjaCzrbbmUJL01cTigk/JaZOpJGRhhA+90fsIF996Vcc+AvD896Yk77+EkzHqituvbhlU7aBmVm3xVDpQRgepV/FZ/q30r28pwGab6CDN/MqOK1vOlu2G5dhUI5TXZVPXkx5VKOf0/eQOiChCIfiSkOLFHb5PACYkyrym8QWq97CnH5+Bjn5jjPd/boqqKvYtsJLVeW29iXUqY3EgO4JSRDkqWCQ4GZvtWzHAYCn/91bS2dt2tUaO2srQdNvBgpra3yQL1BgckY3rvQ3611ha2eUmRCCvb6Y4zTu3zPrrG/sx2AR8IWK1gsL2fK0P9CrTvopsoFybnrb1029alc8i7ErSP6nJsvJcAWGmV0nB1orwdHgfsMhuvPqsSwGMEnVWG9wCAdtfnWy5NiTLTCpZZl8ijDYdDDVPkP79tlZqTYoCRLr1iny4DoD8hJxHmhDVQ0RUIFSXz2a6Ih09NS7omLGNhBu95f1tGIUslJGRxRaYvfoCacsHjQSUzFT30GOC33mrUfMfZId2jAem2lr/q5QzRbLpNAaSWIb0R1Hbo5wC0OZ41Eoo06YokF7IFxcBCdZDcfEGIEKFtyxMmtJOpJmIEfTrUsrkQOt2VRIiiaU75zayCciNCPdIqA1l6uhKpSSfIFSxJwQoTLkvqcz/RsmbFMg6bvglsI5N/C00iKYTZuDtCU5sq2s/r5pEs0cRmSFwrHJh9t7nVRj8jLyncLu5al/rnumLd01oLHiSSuuBCB40z10ZWN7/qpMivvM6jyyjAWgvSJHdKBX6Bd/pYAyQVxvKeHIdeihEqEIE9d1AcHlH3nQBgKTUqNUxcKNgTspAd29U59Kqj03J/DKbxRJuZ9sbbxJXcLknbiscGSaCOsTJptuPbwkJi8pCEnJ935zGrIJR89kimSayFF5eTsXVXzm7TI/r8O3GbdnJJWL3xzg0S8sHS6hvbBBq60W4yJiHVGH0qXdDRCouiyp3t6N+fu3D5x8/jXelM5kze2YbclUI3tht7k+YzsJ7aJVY6CiNE2N+I1KZ4+Xb2yia9x2dQ7kEJYJoL1Ofq75351GfZKasnddm9LO+gGu5wp++gwQHHa3NnpV/Ev9KU+c24ZOYYbaftbFzqbBlrnYzPH1rIvvaytw7dO7R9/7ONw75eUPEiZW7IaCAYR+tBqYyKzM9O3eyOXDagzCFJX+imAe+lVIMhhCGRVmhJMpO10+xeFTa4winCM6vafajRWzmzG+bmQ5ho7WB5qBekxKhpnPi0S96quYaZWA4hyRlTfU6CJwyyEDzjjYg9qMrcVaOYM+qWBdn5J4NG1Xf7cjVvscJq3Ao9DDKkK6ksnAacuJcHbfd2+Y/V/TMc8BJWbeYhV+tXm92bSahyavO1emr1Otj1DreHxFlW5QJTSXa5cvZxSm4wuS/SzzO2zmWwBiUche2uVQ2dTwpdDAoMyAQFzZj6E52015+Ae5MJlwaIHAhBrguC/aLEHLealOCZ3UkbOPyAtqRqtpTYDUgt4Ht9DcwPVG4cNY6pE5yI1A9OlgDaqLN7fY5iUaBAoQtssNRjJLzN0z8vVUZ1T50AoJRRzkVdgLKyjzIyvgvlu0uyumIruMU9HvH8LntV4Hd5LHr+m/mrS2T09yTlSXoYgGLr/OOGd5rxjJqa6epaXUeZFqE0kwExXVLaQLO4ku/VF4Z6m8pzQlOZIJkup9yqLpTz3DZ13i8pB57dVcDxxsA3a6TIPmSvrgJBE6Ca4hr6rbwbx3y4KLC3r1EdxJLxb3mqPCgZy2kCVU1EMigyj/yVDSZQ0ZtCMa0FBYFvDHATJhWg25VNWuvyHxz0ebeKtaz3bgre4UkUe/C+GyO8NUvu0XKrF+0GcQ3y20CsOsNBYQs5ENR862+70k1RBBok5gLSZg0ycPOB39ZnHDZp0utYP+geBhNvnNw9m91IA1ofotOs/pixtNGBeM27b65sjqMv9qwiHWkl10T5IdPTD1OZqR2BDNar1Dqjp/IVoYG2JY50vHBTdDRAmdngqQpt2c+uST7y8ZZsod/dTGZ5bR5wjevt18CJqBaf1R1maXGoKVj1+IGZk4PP/Ya3T0wV7ALjKW/TYx8S2BKWAAm4Jh5DrSsPgFrrN4AZ4cjGFQYM2HsEAGFmO5ByJy8UM/thW5a/HJAp60FEjXpcjVhHmxlhG3yaCP4leLvPgFRojwEAIhOyTjbNBpaKViHxGxsMtd6xRpQqCmswg1ivfedi3K3cnwTUpKYkwpxqzfe0mZV4Tyk43n7q7BR5RzvHmnGac0DK7l44RN2VKFzaCezhbu3QQD7uke6sVpJVGUbpe+zML6qEchza5dBKZpy43ziXQbSOimbydofOw9KZAc9TXq+UMTKKGxXZaGG59CwZl+qVcUMoYKExljXlqBTehZ3R8oJzti9FwHXCrhg3LaPhAkoSWzFilYTzNNOR97JJUC9iDZ2naDAzP0VhkoNX6v/U/kPPsEk3A7qhT+6xNpL0CupPmNKCeQaJ3EJ17tGPDAnRvlGIDHXf3V2tXANAKFqUBOTYeaKV7WRhrPglUZQDBCRVG5PJZBok+ozw622ExJP+blrOKhU0dBLmjj69SAPk2/6GtrRVVVrtUzGLMTW4tjSTpQ2C47OjNQ9njMC51Vu+CW5l8URiG5ztRD+6VMHu0klvspff2vtBDmhAkelM46ddWEaemmq6Q6PsCicZZP/QZpLEwKo+luqh/UNVmSxFvdmyRx4ZUHgrROGPzqPohpQcL62CehKU7hDCjd2mBuBmVU1qUfgo2KnNfJfXgD22wAuV85e6jfmWnUAOZMaVOv4mj0VTogYzOD0BC8ea0hLAgPrEcgiB8tV+Ob2ZKwz65PDAiaFhYbLGnjaFFKotCnlN1qhGc9u5ymRLO1W4uKPsvRE7itJNobziCFDaurhBk/oeXvndas4j8DSEGwRobj84TlBbjZaLcFaorFSYj16QUdU4Co/Fjj9J/z6GKVkEMAaUrKye5ga/vAD8hZvznrkpJuwn3GMDudiPeWXcD8Q61hieSYIE9l6yZu0r77K92oOzY27bvbe5jmbo11SWsAwoIcY5eQCZmgIAsvkJyP+uXmBj6N68Tf9I0umn4yW81b+lqYHzOPDqirCblIzdbSpLq7HHWQFA0JO5FKQTKVwwzYJs35dXhGHu9B9M9WYs7IfvOEHWoyGfsemYL783Huo/ZcZi4wuCsV26vEXmiEoa2JAREAaIlm0KE4/asB6NQa4wzKk8cTWfO7zdkjs1JQ9hMuciTMfglD//5EzbC8mLwFfIHpFxVGjNUYHts5ccxJAJUNl96LSbg5NDCg/mqefTxp/m2pyMs8+rI3qeNK83U9ZHXslPLWkEuvFBuSZoNDwqOPktBHwUOaoR7MjW7AhkZPNIjSjIDA/xk9I2tsq0ZrwcGhEvTqNJKo5oFqDcmnuyrG1mKSttd66Ro1hYR6bo8B4eYxzq7HfUp2nOFEx4IxvPylOPGDnn80u01UBOiVPe5RX4/627+feAWZp48L3UEXwA1LRZB9kjz8q8Nie6p/4Th6SoX5CZYsgvaHMZAQkpvhpEebs8QZfSLShu0owyzYWQOkOcfscU7fwtTaDVON1+tBxrN3xVRsMYBVEQBQhMEDItszODYEdsJHYdllCXYSNTNDLR7mDYOGP1SyLTTwA5xtuCrMtuKqNo0c3QD02kt5ZpSBoj1AZjZALUATSXFHIRdjmI2HeJrBsO3UTa+R8GYxPTuomunRLZB0QeDw12jyVkGd8+fD9jnyxknIL8gle49v6SW2rZ7q9SEp02q43QSTGNz3DH89K/hL2GCboCA0/tYMb+wYA0IcO2GwEHCk1WtHwlthI+hzbMQUhTT5BFGTKdsaAX+xnBIS696NfkUVJSmqp4ZYr3kUZplCKNUqRIMxyPNP8UA25yzG/S6UW9mO1q14ipRpORvbz2Il9AUxewQ6uyXzXlXGHJsT84OMGcNf5SI7caPxml5e0RI0Y7cdIWosWs9OAdHGzjsBvqcKTvdvakXZTp7Pda3C1enyDH8TcNeMuYjoStcdBEsdGMTinFMVC3TdYCu+Touhsb30u5PJ7FrY+OkmG74wyH0vegjl8wyilj5uIDWnSBA7rjIk2RPj+dNF4BE/Jhfcu1xjXS9li0KpEBq6vSdhg2WGa7HaYmdD1OBA5h/gJCM3dPUeiCvDZFFYDnNC9nLgbM9AyuWyR1NvJlyuOgmr/+iei9Mlj30kBAr2tHByRYbtTLgoxBrfmKqvSjfZYfvbjBw6lrYGJjT/Mc+CgNF0pdagYfVXXnrfYdkzUJqTw69SXdlZCxdAavbu8Pk1xSfdSdvd3sIOGR0tKdLuBx3UYI/LxtD+R6k1i7rTqRo27R2bfTylTetX9hYTUeRWZMK77mhrnV1mZjhCR75NhgtynUFRxkgssVkMqV91SSvWHtX8thq1diw5SMl46AdPpI/isWVYRIbPN5nwstNyKuIx++9jVjkuBIPYgTPWInBkYODcpp+8rOrXDeJlkEus26AzPVvCmAwUsac/YUqzL5+XMbB3ucfKInv/ovpuHgZkcRk3qWaqyNcHYgMtsGhgoVKlLjms78TW7H8E2dHQ/t06BnQsmmWPzmNKNchXaiNVb1CLPvUDwo/NF9neQDnorv5B7Z6SvshJpZTJKDDV84mTFtktgUJkmxMD5uPM0F4k5un3AAOXKVe00GLBDBo6fobMAKThUbmz5e0Sunnvxp40hDV91gaeWWXMMVsSts/rCw8FCEh1FP/YTWCXK0cR56h2y5cDdEi2gRLbDAgpygd/TA4avXYMSTPKjZa/tlWa62XWxsw5OCLsDxgnUdOHCINyjWW3sMfSM5UxbDExVRERUoTLG7zU+RenzxeBgP8dM4bZrhxmjfjWkYSez2bizHmsNgaOTalnk/kXPOjB7OtQ51Fhhqs2hNEKv6SLUl1TFrtUg1xAej8fwUEPJtRd+1X5Yp4WBdAuLJaVOkYV040RcihGyih3IEn4PM7XmLo4RXOvo5iINFUQpmQ+qLAsCFg2I8xE+xNvrl5xYjJ0dpoE1NGV++qBqemZj8YRxfOi3TR2eegaVvXyI9Xk2ZrgFoA4ADWJMvJHZRw6wx6hP8+jiZRZrmdpRGaZQiNSnHcaBtCEzZlU5RpQZlDivEU+MTcGnNgCYFqCw7F5VRGZUoTckjsqURj7vRlJdY6qKi0u2cdgFESS28nk9UBDl3gUY0mc4/txC0oTu/fDdwsxZtJvvCepZyE6CIWkOa0jyVzr/nBX1LgTihMF2ScsjSc2NfvetWZW1qfR4nTrzYAZZTPyIP3hRZ9hiv6rNqFeaQXSJMQxn5jnX4Hr9QL22wXNwC9+Xj/yVq7qFNMh8CUGHNUYRGwbZQTZ1EOEoGdh32x2QapH1hSVGKTarTCFyTHkVIQnvnRkBoP4TCLYdE3CxVibc/XOC85DbYYLL3Glkvjh1MtbVdeS464KISr0+sUtKSMVVAwmOJmu0GCAAAOtB5nS3RUlUJwFJ4GSFUC8M3SyDFACgw69eNsH7/eSyl5RVVZQslW8Xeq+Reu54IlI4/zCCxN+ldFr0iDmv3vhHn6XhupgdBNe0Su241ubO3aeIIA6UBPms9NYQMBvWFHVwYJ9ldlVQBusI4bAXALN3Tb9DDnqU7d8d+Vq031jvB7+6S84Zf4KV6hY1HPPff3zxzmAlLzpaSRawH1vxEd44l+WgHvRni5hvQqI9Pe5i44xGy5fr4mZhZ5dJItpUJI+0RzJ0AYE2qe/hspL31ZqQ9uqHRZ+ASAEABNgCwCX+Z/SmffRhs9KcuBN8se4pfswoAyCq7Phdky5zGkoaWizwBdBrnjHZixxR1tv1uu/ryjV6HSh0AsuPY50mFA0c7LLdn0hIuC+XjbGgV3D2ty0hRqOpbL0RySLrvVuxOZIRY8cWzJj1cWzKzxBJLtYS+awm9ZgWWWM6X6ghLLPXSjPtLY7rSY8PSDL+E4W2kvSFzx2tsZNPNYrofhSkGtbHcqboYNP56AmfkghbAhjuI2/iFlFSttgXw9agn0L5Qm6YVcaayhKPw5+CkT9a2uBXcl0S+dPzZoYwppebz35z3wujCQGQHSKwV2U0GiygB400o8dEU8xE4QBAgWhu/hpOaP1painEumyCPiPZ7IZ/4zPGUm7n717DENaOzCgQh6xhmRQEY3sqpErKjzI43UWD+ocCRTjZFDDElbj8fW0KU2p0Xn3nh6iu80e+aIRIyg26wgpag7bvEdYWhLgcziUDBL07ER+ZHMHcEIB6Zw9z6kfktN+IAPPlM0V10sIiNp6Mp6JGV/GiOvYa52MjNOHaHM2Jkfp3pcCGGXu6XE+nblnSYS/gUnwmHhdU2szlK9Oxh31j9XWevZB+WDrw0Nv/xo2I7ZVKQZEPLR6llrypAzSK/ukiDy9fsGp/XpgZu7RXPmTx7aQSt7pWUQvye6MKsfLXdNgdia9wg0sSafwQyMjSwxky0OYYcbCgc2ZC1M29SA78O0kPUMhXUBMKUqXwoTe6Bbx7B9+V+okwckavfWXs4jnL9ZnrnTx+1Ki5AJ/4IIudjbe7X5CPcmx76xKvxIUaYF94550JQXaIXNUGf2f6qj9/sK84P1rXYRr2pK66iPwtX/5UGAd70StmXBX7PvxpSfs1g9WXALcI3KXRNyNca4HxyU52rhKcD11i5XwwsjHTtcNwsDE7ORqfbP24n7XTT3utPc4vQogRgfkj7f71VbHEgIAi0jotS2XHI718Ud3vctwbcp5/cE0ZU7u3ispU3MtEBh1zlDq1rqyQbXHB+srFXB0vzeT5qltcbPJQcQwY1LsLDhSE3tJcA8NBgyIzsJCC4VVQdbAFoezLokpCaDFzfoZLT2Iqpb62zLCtkHQoZ21fKYUUu7IaAgtyBgBhrARA4cgclwbUYVGk1EsrzoNjpbJoGBGvHhiuo/mXGZ0po+5WMnK3a6yZEPTaqfLkARNPtKl8KfaW9L5mhWMlMsklMedlH1EqfqfJkMeJcSVdgU9S9ldGujfHPGKGOwrXGoB6ToDKPDhoiVfmLs9bmJCoK4+3Bo+H2doz455q4tA93gTBDj6AJYnuRY9CniwaDauntgWh/yGJ/zhjxloEejXfxlkbhnF84DC5S8cQC4QvT8tozU387BdGnBwxzStsoVbJd0JuwigjDUm75vExG/Kepkbi+VgrAzHslGpUzwqJ9rL1yH6l52qMhTuSa7lpUdnPbpqjsCrq9eThCZinPtyouRMdG9g7bEK2mXA26ppS6UK7+9QGVnvjkriWNxMhv463pVuh43RkBQYBqA6GqwYELGEWKpL3/mQGqFxyuyRca1SfuMobKkxDaYNdr7fD7coq0bCflBwGIatALK3BMgQqD89oDl+2UNGRDIlMUM1gBo0cg/djpJ8Lw/EFzTkmuzoH2b0U147/zm+fYXn1j0h1wEMIAWCvUt7aeu4/5i7k4ajEJm9mOasR+pcyoHWiT9khWHuQde+hR5ejDbAAWogeFAM2XITsWALNjAHM16nWjXJMx55AyJNeYTbvDIXW1JzjVxuEK+2VZqtxT36lyx7UEO0Nfld6QnJic9uoU72z5CO0OOGXpHfUwNExtyNbpBRz6JmnwnKn46is5fxnnqYWEaLQg5Vl3cDNVwsbGQhzdyM0E/oZ6wroyqJywnkmJVx4s7mh+sdLL3Rz781ZMXHDGXdivzcmk3BnmmhMja7wehDRjaOFAmNx+YHPgjonl0s7WDEnfyXxisJ5eYz38xeYaYJXr8psfpJazDVFf0HVyWSB5A3CHbFY8Tc2niO0470HYZX5svv54ysoxJjpGBKZER6LHLFXMoIhVHo7PgWlwmx7uZVWS/1SsGacvk6Nn+54JQMtn7pui5I2mz4QTb1MtsN4mR1xwzQvf/RIvW4WGtFQwdaNYEvI03Vwr7HLGDfd88FOodMXkn9u+CQx4peCiokrmzadnVUVSYQytKOWwUvWqXtuUEjVsGrDIzGZ5JVev5fZdMwp6Hrbq3ZiiZ+Gmv38zNaYWy+JvjQq7atjTo9vd9rONQOrnvG9x8cwUkOjEGTLnwKZca7xJZggwrxbXSuttddDuOl5nXXbTU/frdX303V8xwiqpMuS9qjhYquRxCSd17Um7rIaz2+E+Da3RiNfYEz0wJmKZ/6DceZnCx6wKqqVW22iv7Q7bWyedd9VDt+t5vfXZTxGk4kRUSrjHsr7pmzxDLDqaiy32BMhrnorS1GXGKyfucp6TpZ3U0ixv+SyrWSoahpspKUeMHOfgk0ya8V+ysJJiHEsnQgyNNp5D5jBpXA8CrGwGLLa+eXDQ2bbCcZfbjfdU090kr33vPsRMxkGSvMJQXVCSUlUo0a6iy9fpvRouhjsaXyq03uEOY3jtsjQDLMUUrB43CyexEefHbcdbXMXncbeRgp/IGidFMwrQWZQRClCFsv97qP+m0+6EvAcrZV63x8Ue/MQNuZ54kqrtV23V87Bx6n8D1yeHXAhc6HFDD0pwk/1U0C5TQnD+ifbCVBNN3VZlzfzH5pNv5sbfRsHB0khx/1snN35653qguGn+vM5v9i4bh9E70ZqxMB67fQgX8MZ4Fx6M3Hbx0HsLqNTvpMA5fnePfWBCZrUojUE1BpUEFM6Rb+aUD8j5dxgtogv+Da0Ouqv85kEk+RMrY8+DRfS1HmoGhWUn00nMhpmdUDF3PFfEwohY6ShNKNGWRE7Z49yT8ZThnP9xEW31q+8hADs/K0uho+tc/urPg0r9hWGyVIfJtn6f63jK3XOjAuB77oGE6gsEXzTowJpXxX6bpBFFx5Anx+SAEyVlvUv9sHAvWJApHwT0eGl+gWf0Z81Y9hj9AIPoQxxVRHrFmZFsIvoXZAOE9gojsZw5dp9rtNYi6G/7YIrm6cNF9R4/h8Q942D9AM46ea7WaNBPFUWbr59vq4+1/NUxM84xPzJUo0vuoGLhLUgrGDzZusafW+7UzAPfbQakSJFmh+Tcy0cJT25SeR2j6WDvOOfIol4VZ1QBdvT1fFgfDfN3N9SjOVZ8SKqD4mvEMLnT2ynvthkvdAnAa+7n82v82fv8t+BQXCqrR7CvUtIvN2tUVKcrTYs0uqAcYNY3FIl6+9KZmi1dkHAGNUXVNJH4Ogz1BfK0SPouj7jmXX/+K080fX67diUcgUA0MoByf4EAg1h4Pd0199xKxDV3FMju6IBi+jMy3CTEWtIxnryKHlGaiuuaebDQg73zHz1CcG5ymyAbT/IQITgvkhVLpycHe1Rf3S61pPRuEzVRoxvu7qkY4vxe31oz8TWduO2w+zF9RmMKs/Yc0xeftoUkX6irfYfcsruvE//uwc8B4O7woQcNdtIY70yI1SZIeFUjKnoXbdUbHPX8iGf7D036Mh7Dhu6j9h/bKwC4xxC9mD/gRKsHIXxomV2Qkc0akYiAGFINLJ6g/sT8NahOnfa9iOahQqvAoCoNJ6OK1D43b4MDwgzapQdvafmwSPzn8xdJ6mbP01sQzm0hY3EuyM2FtiAgKq1uW2MQ28z2WbujropUpKC00tmJKFMdKE/XRjaysNqinwzo7IOeKgNY/DYBMHfjnHD0YnPQB7mc1i0uYYh4xA1v1wa3Z6J9q1zVt2AN3z6gM5To0g8VSxYbe7P2uj2FN5mUhiAMm4b7M4xrt1fs/wJacDtxrbYkB6eri+y89UP2+VZSU83lDvzhE3PSNP1GPd3S+JorltnmmGue+SZSJrmWv3lPviWXwIkYJN9FvzxAeABgz1a1LTj4hwABFfv8zswNSwu5/2OxiQLws+vJMPziQ8d/vqsYetGTaxNgHxgg4D+o42kfp/fCTPEn5MVrax8c6CBDCS4aQ9QOlxQnNMuqnIeTJsRQClPRouUm5xZFKpLs6HwWbObYV3mUMabTq8XslLmWVjZoyUCliEfpiQZJARwkLgaOPPlS0WsObgbA1cJlH3w3306X8OMOs+hxINL0sxvUqOTczvMlgLJMQQbUL2oYA7RINN5YHblt4SKGQbBIU35vdEUa2eCqNcmKSYUCAkuBj0lAPePu/MlCDSE3PTYaKKLBoYYDCYEnz2Ijhc6RwxLMuk7ctY+idaKhj0GisZ86WHyqwhJGaXiLY66jGXjnT+nHLAeloqmHk2uqidyOrMgAfIxCFPbWvD7VGdRraT8OKaukvXLW2bDulXrQ7KluXVPXituPzVzJx2HvIQZxlAcxlEdpLEVx6Peqhd1PeRTEwtya16fSANb717cWcwRdWddVtu4FPWj8lMIKT46H8Dh1dDbLb3SSfeCetcfxgPSCMdDb5hFC2bKQKMkR4TPICZQKWyodi6EGsYvos8umHMXMGNSs2KA9arYg7vNblRjL/Jim85o9RHRGr6j8Uy51gQ0qFs3UEo8hEDMa2Ld9IVHvlV0UJHLCiIHT20Z779HDOuKOhgxdkWinduyNiM//9ORmHMlqTxgyz2CJRznbCHuEWiveIPlykSubuow4FUOHaI6lFptlZhb6VlvwseZxrLLO31kNvdZns/1Ya+lTg1YwmRLLYAh6D6agIaWHI3JUYpA8SJf+OL+ey9HxYpvN08TBr3MCS1/pZmmzzTVqqUtzt7ElLnP/U2gz0lJ/u80n/+zTesncNnTH+FriJB6D9XJ9G6fhstalXabcD56GyIjxHNFnHRS+FpdD2ozPTuz4acBpv93oO9a03rpm0lXfX0rANhe2+WuBnZIc25rffI9nETvqqWcnYfCe514z+A187Ff23T/eLplbQtIxPpeCArCSx7UP6mFlvQwIYF9Q5CMIBFalZ9c+60VYcG6fV5pL+tter6s2J2Xi364AODLqQKDFRngCAGJhAZi6ExBOrs1UHNoY8TCYKIXpTUBYPm9gW5M9cNmXETwm5YtaBN2HOse+x0janYoG3tRGTbv6fYMATh9roMheAIPZ+AIBo5H7kwLH0WWChKQWOolAZELsidlxJjDNTi5oybrLDjp7UakQe1dUYxFOgZNG+5DlSJO5lTOcZn/hLAlYguLrJQ00/k4EmlFRO69cyZYDd4eWgD/daIfwos4gRQKi3SZtrXB+kR0Wx7q+IFkuM7voKiyppk6U9kdb8ZUJthqokKimHspCQoApNcNaqg0aaqeGhpphqqZ8uldI1LZqIuWcdvAG3fj6zbMoLW5RouDaUdHoDJXCVohS1ayQPfkUSYjO2UxUwIxawml8jSXzWQ2dVA3Fzc3dfNJGonu6t3ZYoeagdsozsPJdNLasd6UWr4PE+urkZOo58fHAa1ONgeOobqoP6QhGLWF3q5hqF5E37+MAp1ZzJPGG6OGZyWDbslvAjtYgULVNTt8Ptkoq9arS9VHUJNLA3bI42Q4+l6ewcYtaVDsxbdfkpslJd8qoo+EilH76HHs5+TvcbG+eZH9cNUEdra3JQvvNDIXdhqgmu0gEO7OGTiqUHFYa2ETbmzqLNFAOYtf1GhqTt40WGqyG1pQgSa6UbsoOHMlxXd93eRzWquoFMYtu0RroLtADVhPpSunfURQo7nlS+G5mNlhNfGpDyXqKF8dtOw2zAEF2kh/e3CsRMMle++x3wMFEIgpmcHJx8/Dy8QsICgmLiCLFxFWpPuKpM8GFKzepnSvSDI0YajoLwmZsZJjww0/ein2k97pgAgftT/tH+1hxwkV474OXKC8Y4eLxJFGjTonxQsMClnhL/XLGORddcMljT5wMG3FAzQnRGLxQCjS7qcU/Am9dZcDQLbfFOEvqldceuREu4iE1uCfMqajDG6cx3XlLbWSEIrFEKjOSK1ilSq3R6oynunpTVOuhYVKqlZUMCyc7LCdNLjwCIhKyPBRU+WjoGAoUYmJh4+Di4RMQEhGTkJKRU1BStVyg34ChoaUzsD+3jZ6hxpoYmWpgZmFlY+fg5FLE3TeLePn4FStRqkyg6+1SrqLW2lTWIqhKtRq1QurUC2vQqEmzFq091Kbd0Np16GyoYYbX2TAj6jDSKEDPgR02FgyBwuAIJAqN6TsWhydU04AbJHLnBYWERURTdcRC8Y51XKKjlkhJy8jKySsoKimrqKqpa2hqaevUZGvBevoGhkbV+V9J/jEtoRX6+2xuYdlK+/pibeOgQw474qhjjjvRNdcGG2acctoZZ6tvtXPOl1iyCy6W4pLLrrjqmutuuOlft+pR6o677rlfqgf+K630+lSV4ZH/e+yJp5557oWXXnntjbdVeqdNe2t8LNMnXWW11pdyfNWrr+t+ffU3aMjwt5QGm93hjMldbqtW/fZ4fX7+wpTlisTlte4rXyozkitYpUqt0eqMTUz1ZuYWljVa2SnEtV17NtUaukuFGFHSxN3ad+DQkWMnTp0598yFS1eu3bgFEGFCGRdSaWOdDzHlUlsfc62wCIrhBEnRDMvxgijJiqrR6vQGo8lssdrsDqfL7fH6/IFgKBwRRFISNlMqncnm8h/Y8pJEklK1meuNZqvd6doXRH8wHI0n09l8sVytN9vd/nA8nS/X2/0hmaR87Bn+tr5dUWW7wuy8Jku+Vm3aBb2iorfB4aivsiqLo6LO4ulrfwdMjrA1+e9AM+jUNRgFFKE5M/8/c06RbRnbcb0wipM0G+WFLau6abvxZNrP5ovlame9u7cZtvsHh0fHJ6dn588uLq+ub2537Ny1e8/effsPHDzkdLk9Xp8/EAyFI1EyFq+qrqmto2iG5XhBlGRF1XAiWa8bZkNjU3NLa1t7R2dXNwBCMIJiOEFSNMNyvCBKcjAUjkRj8UQylc5kc/lCsVSuVGv1RrPV7nR7/cFwNJ5MZ/PFcrXesNgcLo8vAMCKoIor7crSZbmwikrgyoQiceXJJVKZXKFUqTVand5gNJktVpvd4XS5PYjXZwd2ln7qB/YZvkZzC0sbVgbSjyb+mPlveXEtzm8koV3jLjQ2suyA2rJIPyDGkh7ETGYdVJyt1iauq5HS7Ew5mRxcq6pWgZFIjmZ5QZSU1EqEaYYXROXQgOofv3txt4eU6wnVwUEJer/S5lO9RlyBX08dSQE+7fL3H5/3Jvm2jSo5RMUcRYUT5lir1BNOlXnuaYrXykCZxp78W7y9PuZvYzS98ecf4sPm7XCTsgoHczxX9bmIIsVYFCxCFE8hSyH1in7HtP3OPpzX5NCiLMYxn3zlmRnRL77zg0srQULjRDYJvds1vr0z4b+acA/4zZu2uoIotnlK7EEn22J1lRA9SkJ07ySOUeJnZGRkykcgmyCVlr1e33gfOn/QablNTiiKGp65W/tHiToZICocNet18ZT94xTMsk8VXOYUPQrCwNkCTKevTmyIh6hQqd9XDq5P5RCBP00r/1GE8W2wuVrBTNk8RbbTfmb58mzy7Q2+zTn323I+/FsTNnOv3vebaXxoB6AejPJqG9D9X+0Wz8/lvPi8BXh5SSKmi9d+fHte3L89r1lL4XpZVbyUqLRNoDkgQMHsO1jMu8VXD6EkHjyUj0+59rvbPNOPruvl+aU5sxewianMe0opf2MVpAycXlYTHXZDQskKddnNs+EuIKu1mQxUcaqGZaP4XDWlQGmFFcPaCB55P8LmlO29r+2ImoXgdBqwG8taGbgf4/XiolWAh2vSvdq6BlwzCvAyCwAwE6DCAsHQ0Miw8G9GAYiYNfIqDBHefjbm9iJqiXNxZCaBvxwF8QkyKiwQTPrF5JtkHtti3Yx7Bs65OJ0b4mUvBIQTN4QUQrbweyplwWuqGZBuSOsI191MOwFnneX2yCn5d+BYO10I+XAdnMUXV/O54w4RjIwKBMKDoS9ZiC560SWeeFL010Od5WbuZcRbGAoU9K12KCgoVFzhBR6IiIwKA4d0KUDjbau5NnvcomGwI/vYwzSHVzx0doXhH738PCQFJiFMKONCKm2syysBiDChjAuptLEurxAgwoQyLqTSxrq8IoAIE8q4kEob6/Jq+Q7+L+bGl/QSIz7yt/JXosUz1oCZwlv87BpCe6gfJc2rk+wF7uF222FWISWPqstvpXg5T+qmvPXQTgmX1x3T/aT16qSBV1pKP8u4QGldmwhEXkErGoBmLHDR0jafZHpIrj10IPDqJHsJzdYoEziCyZ0gDAnlwJSYcAARJoZtAAAAgCNQ4wnxciBCGRfJCoAIE8q4gFvk5/DDQlB1fPMAlvXibkI+I+yUsltsO+O2lL6RSyH9IvmpSYL51HrJJdfzg+5jQNdAQJGmhE0JBHRECShSA4pOOUi4lDuhjAupgDbW7fGxI7eMrAQgRozLRDXs6XEjLnh70JfGFXqN5chRtqY24lWZOup9P1EAiDChjAuptLEurxAgwoQyLqTSxrq8IoAIE8q4kEob6/KKASJMKONCKm2syysBiDChjAuptLEurxQgwoQyLqTSxrq8MoAIE8q4kEob6/LKASJMKONCKm2sy6sAiDChjAuptLEurxIgwoQyLqTSxrr/32+yevudCD4P1fPf8rBxuKm77+cJAxMuNATIMJUsJJoucswI20aHKRd69VJ2A3OBNzvwrBFB77TZ1m6kZEwx2T1OIKjV3r8M2UbxgGsEkpUdobw7Bybdax5+EBYyfoU3u1V90oGstJ1eru4e+6zyJdEnsfq8f67bMujUy8CQwnCs64XXAKqqmGGg/91vEBtQCpI1CJSpq2GOmJDig3LvHhUwTBpwvnapiu9bVQbHMCB5wK1uvn9NEmkEA1R2k9g64EZf34s4eN/m6an2jP7b+QXW/hui4WdrH56a91kObTRGIgDieQNbC62MvvGveQ35yDO72hQFw+Va+FzixpElos9Sf+dT565Y+DvHey5t9UZ/HMV84NSaqL589X2VLXL0ULioN/Ni4APXtcNyED70TOijjOHBd6Uf+Xd/62aXQlGsXJ7JdrT9aN9CRaLNELfu88fqv1ZfWHk1gX4qbvEcN3hpzcYv3G7dlCwvMgW8wEu8vfgkN98FOPfI7v7YZKyOApQA6AUA"
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
    "base64": "UklGRmQLAABXQVZFZm10IBAAAAABAAEAAH0AAAD6AAACABAAZGF0YUALAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+/8b/N/96/nD+kP9BAcYC/gPkBE8FQAUuBGMCUgHm//r+QgBDAkEBeP6d/dz9kv11/PX6afny+BH57/jU+EX55/nj+mr8tPs0+gz6sv3FBCIG9gQCAUv9dP7SA5MGNAdjB3MHdgdqBxYH6AVJBJsB8P/3Aa4DmwA7/Pj7IP0Z/bj7/vnx+Ln4v/il+J347viu+aT6n/uM+qH5QPr2/zYG7wYvBrMCJf4X/2AEtgY6B2AHbQdyB3EHVAeuBsUEggEAAHkCTQRgArL+lP3n/av9Dfzd+eX4wPjT+NL43/hW+Rz6Mfub/Cn8ufrn+kn/IwU5BgIFoQFd/5cASQRWBvIGNgdTB1cHQQfUBoYFpQPwAWEBXgLoAnsBkv8V//b+Of4F/Wv7Afpy+Xb5dvl2+Rv6YfuZ/If9+Pzk+1X8eP9yA7sE1wNEAfj+cv9VAsIE1gU6Bl0GXAYTBjoF1wOCAkQBoQBMAegBGAG6/z3/Kf+i/pf9W/xd+wf7OvtR+1z7APz9/L39EP6e/e/8Uv16/w4C8QIeAooAhv/e/04BugKZAx0EegSkBFgEfQN5ArsBKwHhAAoBIQGEAKr/af+I/2r/y/7a/f78i/x4/ID8rvwn/bT9Fv4//h3+6/00/lX/vQBlAQwBNACW/8b/tQDDAXsCzQLgAr0CXgLOAT0BzQB8AFIAXgBWAPL/eP9R/2r/Zf8U/4/+FP7g/e39+v0J/kz+tP4V/1P/Sf8d/zf/wv9sALsAkgAuAOb/8v9SAMkAJQFgAXsBcwE7AdkAdAAoAPb/4P/2/wwA6v+q/5L/lv+E/1H/DP/J/q7+v/7T/ur+Ff9B/1n/Yf9f/13/gv/e/0AAZgBCAAAA1P/k/yIAbACrAM8A2QDHAJ8AbAA+ABoABAD8/wIA/P/g/8D/rv+u/67/oP+A/1v/Q/89/z//S/9l/4L/nP+q/6b/oP+u/97/FgAuAB4A+P/g/+r/EAA4AFYAaABwAG4AXgBAACAACAD6//j//v8AAPL/3P/Q/87/zv/G/7b/pP+W/47/jv+U/6T/uv/K/9D/yv/I/9L/7v8MABgAEAD+//b/+v8IABwALgA8AEQAQgA4ACgAGAAKAAAA+P/2//j/+P/0//D/6v/k/9r/0v/K/8b/xv/G/8r/0P/c/+T/6P/k/+T/6v/6/woAEAAMAAQA/P/+/wYAEgAcACYALAAsACQAGAAKAAAAAAAEAAgACgAEAPr/9P/y//T/9P/w/+j/4P/e/+D/5P/q//D/9P/2//j/9v/2//z/BgAMAAwACAAEAAYADgAWABgAGAAUABQAFAAUABAACgAEAAQABgAGAAQA/v/8//z//P/8//r/9v/w//D/8P/2//r//P/+//z//P/+/wAABAAKAAwACgAIAAgACAAMAA4ADgAOAA4ADgAQABAADgAKAAYABgAEAAQABgAEAAIAAAD+//7/AAACAAQAAgD+//r/+v/+/wQABgAGAAIAAgAEAAYACAAIAAgACAAIAAYABgAGAAgACgAMAAwACgAKAAoACAAIAAYABAAEAAQABAAGAAgACAAGAAQABAACAAIAAgACAAQABgAEAAQABAAEAAQABgAIAAoACAAGAAQAAgAEAAgADAAOAAwACAAGAAYABgAIAAYABAAEAAYABgAGAAYABgAEAAQAAgAAAAAAAAACAAQABAAEAAQABAAGAAgACAAGAAYABgAEAAQABAAGAAgACgAKAAoACAAGAAYABAAEAAQABAACAAIAAgAEAAYABgAGAAQAAgAAAP7/AAAAAAIABAAEAAYABgAGAAYABAAEAAYACAAIAAYAAgAAAAQACAAMAAoABgACAAAAAAACAAIAAgACAAIAAgACAAIABAAGAAYABAAAAP7//v8AAAIABAAGAAQABAAEAAYABgAGAAQABAAEAAQAAgAAAAAAAgAGAAgACAACAP7//P/+/wIABAAEAAIA/v/+//7/AgAEAAYABgACAAAA/P/8//7/AAAAAAAA/v/8//7/AAAAAAAA/v/8//z//P/+//7//P/+//7/AAAAAAAA/v8AAAIAAgAAAP7//P/+//7/AAACAAAAAAAAAAIAAgAAAP7//v8AAAAA/v/8//z//v8AAAIAAgAAAP7/AAAAAAAA/P/8//z/AAACAAIAAAAAAAAAAgACAAAA/v/8//z//v8AAAIAAAD+/wAAAgACAAAA/v/8//z//v/+//7//v/+/wAAAgACAAIAAgACAAIAAAD+//z//v8AAAIAAgACAAIAAgACAAIAAAD8//z//P/+/wAAAgACAAAAAAD+//7/AAAAAAAAAAD+//7//v/+/wAAAAACAAQABAACAAAA/v/+//z//v/+/wAAAgACAAIAAgACAAIAAgAAAP7//v/+/wAAAAAAAAAAAgAAAAAAAAAAAAAA/v/+//7/AAAAAAAA/v8AAAAAAgACAAAAAAD+//7//v8AAAAAAAAAAAAAAAAAAAIABAAEAAIAAAAAAP7/AAAAAAIABAACAAIAAAAAAAAA/v/+//7/AAAAAAAA/v/8//z//v8AAAIAAgAAAP7//v/+/wIABAAEAAAA/v/+/wAAAgAEAAYABAACAAAA/v/+/wAAAgACAAIAAAD+//7//v/+/wAAAAD+//7//v/+/wAAAAAAAAAAAAAAAAIAAgAAAAAAAgACAAIAAAD+//7/AAACAAQABAACAAAA/P/8//z//v8AAAAAAgAAAAAA/v/+//7/AAAAAAAAAAAAAAAAAAAAAAAAAAACAAIAAgACAAIAAAAAAP7//v/+//7/AAAAAAAAAAAAAAAAAAD+//7//v/+/wAAAgACAAIAAAAAAAAAAAAAAAAAAgACAAIAAAAAAAAAAAAAAAIAAgAAAAAA/v/+//7//v/+/wAAAAAAAAAAAAAAAAAAAAD+//7/AAAAAAAAAgACAAIAAgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/v/+/wAAAAACAAIAAAAAAP7//P/+/wAAAgAEAAQAAgAAAAAAAAAAAAAAAAAAAAAAAgACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAIAAgACAAAAAAD+/wAAAAACAAQAAgACAAAA/v8AAAIAAgACAAAAAAD+/wAAAAAAAAAAAAD+//7//v8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgACAAIAAAAAAAAAAAAAAAAAAAACAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
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
// Exact shared material sheet; fonts are acquired from the embedded source assets.
// prettier-ignore
const SHARED_THEME_CSS = "/* Shared appearance recipes. Existing screen layout is in @layer legacy so\n   component paint has one authority, independent of a screen's ID selectors.\n   The aliases below are the migration boundary for existing semantic classes;\n   new components should use data-ui-surface / data-ui-action / data-ui-tone. */\n[data-theme-styled='true'] {\n  color-scheme: var(--iw-color-scheme, dark);\n  color: var(--iw-text);\n  background: var(--iw-ink);\n  font-family: var(--iw-font-ui);\n  --ui-shadow: color-mix(in srgb, var(--iw-ink) 78%, black);\n  --ui-hover: color-mix(in srgb, var(--iw-panel-raised) 90%, var(--iw-text));\n  --ui-disabled: var(--iw-muted);\n  --ui-control-border: var(--iw-control-line);\n}\n[data-theme-family] {\n  /* Each presentation owns its finish, including nested Studio specimens.\n     Material paint never leaks from an enclosing theme or accessibility mode. */\n  --ui-panel-finish: none;\n  --ui-control-finish: none;\n  --ui-hover-finish: initial;\n  --ui-selected-finish: initial;\n  --ui-active-finish: none;\n  --ui-inset-finish: none;\n  --ui-toolbar-finish: none;\n  --ui-thumb-finish: none;\n  --ui-inset-depth: initial;\n  --ui-input-hover-depth: initial;\n  --ui-material-travel: none;\n  --ui-loading-rail: 3px;\n  --ui-hover-face: initial;\n  --ui-hover-ink: initial;\n  --ui-hover-frame: initial;\n  --ui-panel-frame: none;\n  --ui-raised-frame: none;\n  --ui-primary-frame: none;\n  --ui-panel-depth: initial;\n  --ui-action-depth: initial;\n  --ui-hover-depth: initial;\n  --ui-pressed-depth: initial;\n  --ui-selected-depth: initial;\n  --ui-gallery-depth: none;\n  --ui-press-travel: none;\n  --ui-scene-motif: none;\n  --ui-scene-motif-size: 48px 48px;\n  --ui-scene-inset: 24px 24px auto auto;\n  --ui-scene-width: min(24vw, 192px);\n  --ui-scene-height: 96px;\n  --ui-scene-repeat: no-repeat;\n  --ui-scene-opacity: 0.18;\n}\n/* Rebind older semantic variables on their owning scope. Authored image, video,\n   Canvas and 3D assets remain in their own renderer; none are filtered/recolored. */\n[data-theme-styled='true'],\n[data-theme-styled='true']\n  :where(\n    body,\n    .field-kit,\n    dialog,\n    .race-screen,\n    .race-shell,\n    .overlay-card,\n    .native-landing,\n    .native-settings,\n    [data-ui-surface]\n  ) {\n  --fk-bg: var(--iw-ink);\n  --fk-panel: var(--iw-panel);\n  --fk-panel-raised: var(--iw-panel-raised);\n  --fk-text: var(--iw-text);\n  --fk-muted: var(--iw-muted);\n  --fk-line: var(--iw-line);\n  --fk-control-line: var(--iw-control-line);\n  --fk-cyan: var(--iw-accent);\n  --fk-amber: var(--iw-amber);\n  --fk-hazard: var(--iw-hazard);\n  --fk-success: var(--iw-safe);\n  --fk-accent: var(--iw-accent);\n  --fk-on-accent: var(--iw-on-accent, var(--iw-ink));\n  --fk-focus: var(--iw-focus, var(--iw-control-line));\n  --fk-font-ui: var(--iw-font-ui);\n  --fk-font-pixel: var(--iw-font-ui);\n  --fk-font-mono: var(--iw-font-mono);\n  --fk-font-display: var(--iw-font-display);\n  --fk-text-body: var(--iw-text-size);\n  --fk-text-control: var(--iw-text-size);\n  --fk-text-secondary: max(14px, calc(var(--iw-text-size) - 2px));\n  --fk-target-size: var(--iw-target);\n  --rl-menu-skin-bg: var(--iw-ink);\n  --rl-menu-skin-panel: var(--iw-panel);\n  --rl-menu-skin-panel-raised: var(--iw-panel-raised);\n  --rl-menu-skin-text: var(--iw-text);\n  --rl-menu-skin-muted: var(--iw-muted);\n  --rl-menu-skin-line: var(--iw-line);\n  --rl-menu-skin-control-line: var(--iw-control-line);\n  --rl-menu-skin-cyan: var(--iw-accent);\n  --rl-menu-skin-amber: var(--iw-amber);\n  --rl-menu-skin-hazard: var(--iw-hazard);\n  --rl-menu-skin-decorative: var(--iw-line);\n  --native-ink: var(--iw-ink);\n  --native-panel: var(--iw-panel);\n  --native-surface: var(--iw-panel-raised);\n  --paper: var(--iw-ink);\n  --ink: var(--iw-text);\n  --bg: var(--iw-ink);\n  --panel: var(--iw-panel);\n  --panel-raised: var(--iw-panel-raised);\n  --text: var(--iw-text);\n  --muted: var(--iw-muted);\n  --line: var(--iw-line);\n  --accent: var(--iw-accent);\n  --safe: var(--iw-safe);\n  --danger: var(--iw-hazard);\n  --sky: var(--iw-accent);\n  --sun: var(--iw-amber);\n  --mint: var(--iw-safe);\n}\n[data-theme-styled='true']\n  :where(\n    body,\n    .access-gate,\n    .launch-screen,\n    .native-landing,\n    .native-mission-library,\n    .race-screen,\n    .race-shell,\n    #coop-menu,\n    [data-ui-surface='page']\n  ) {\n  color: var(--iw-text);\n  background: var(--iw-ink);\n  font-family: var(--iw-font-ui);\n  color-scheme: inherit;\n}\n[data-theme-styled='true']\n  :where(p, li, dd, dt, label, legend, summary, h1, h2, h3, h4, h5, h6, strong, b, em, span) {\n  color: inherit;\n  text-shadow: none;\n}\n[data-theme-styled='true'] :where(h1, .display-heading, .native-game-title) {\n  color: var(--iw-text);\n  font-family: var(--iw-font-display);\n  letter-spacing: 0.02em;\n}\n[data-theme-styled='true'] :where(h2, h3, h4, legend, label, summary) {\n  font-family: var(--iw-font-ui);\n}\n[data-theme-styled='true'] :where(a) {\n  color: var(--iw-link, var(--iw-accent));\n  text-underline-offset: 0.2em;\n}\n[data-theme-styled='true']\n  :where(\n    .micro-note,\n    .muted,\n    small,\n    .help,\n    .description,\n    .quiet,\n    .smallprint,\n    .race-footnote,\n    .race-menu-status,\n    .soundtrack-advanced-description,\n    .native-menu-footer,\n    #demo-status,\n    #demo-picture-note,\n    #demo-audio-artist,\n    .demo-audio-status,\n    .sidebar-note,\n    [data-ui-tone='muted']\n  ) {\n  color: var(--iw-muted);\n}\n[data-theme-styled='true']\n  :where(.eyebrow, .launch-kicker, .access-gate-eyebrow, [data-ui-tone='accent']) {\n  color: var(--iw-accent);\n}\n[data-theme-styled='true'] :where(kbd, code, pre, .telemetry, .hud-value, .metric-value) {\n  font-family: var(--iw-font-mono);\n}\n\n/* Reading surfaces receive a bounded material finish over semantic colors.\n   Asset frames supply the edges; their opaque nine-slice centers are not used. */\n[data-theme-styled='true']\n  :where(\n    dialog,\n    .overlay-card,\n    .panel,\n    .field-kit-panel,\n    .inspection-card,\n    .mission-detail,\n    .settings-group,\n    .inspector,\n    .tool-panel,\n    .editor-panel,\n    .launch-card,\n    .access-gate-card,\n    .hud-card,\n    .sim-panel,\n    .workshop-card,\n    .iw-panel,\n    .studio-panel,\n    .sidebar,\n    .creator-inspector,\n    .controller-settings-section,\n    .settings-section,\n    .settings-card,\n    .info-card,\n    .choice-card,\n    .mission-card,\n    .campaign-card,\n    .library-card,\n    .community-card,\n    .candidate-entry,\n    .version-control,\n    .pack-instructions,\n    .content-card,\n    .pack-card,\n    .profile-card,\n    .recovery-card,\n    .download-card,\n    .story-card,\n    .flight-dialog,\n    .soundtrack-section,\n    .soundtrack-now-card,\n    .soundtrack-listen-card,\n    .soundtrack-online-card,\n    .soundtrack-settings-style-card,\n    .soundtrack-source-row,\n    .first-flight-card,\n    .school-lesson-card,\n    .school-after,\n    .coach-card,\n    .result-panel,\n    .sim-academy #complete,\n    .sim-academy #fallback,\n    .optional-world-card,\n    .team-level-card,\n    .team-review-card,\n    .creator-media-card,\n    .creator-mission-review-card,\n    .batch-card,\n    .watch,\n    [role='tooltip'],\n    [data-component='panel'],\n    [data-ui-surface='panel'],\n    [data-ui-surface='dialog']\n  ) {\n  color: var(--iw-text);\n  font-family: var(--iw-font-ui);\n  background: var(--ui-panel-finish, none), var(--iw-panel);\n  border: 2px solid var(--iw-line);\n  border-image: var(--ui-panel-frame, none);\n  border-radius: 0;\n  box-shadow: var(\n    --ui-panel-depth,\n    inset 0 1px 0 color-mix(in srgb, var(--iw-text) 8%, transparent),\n    0 2px 0 var(--ui-shadow),\n    0 8px 18px #0002\n  );\n}\n[data-theme-styled='true']\n  :where(\n    .masthead,\n    .shell-bar,\n    body > header,\n    .toolbar,\n    .studio-toolbar,\n    .authoring-input-rail,\n    .authoring-section-menu,\n    .sim-toolbar,\n    .hud,\n    .telemetry,\n    .workspace-bar,\n    .studio-header,\n    .flight-controls,\n    .flight-immersive-bar,\n    .sim-drone-response,\n    .flight-instruments,\n    .flight-coaching,\n    .coaching,\n    .sim-menu-hint,\n    .coach-heading,\n    .coach-lab-toolbar,\n    .coach-lab-telemetry,\n    .coach-drone-figure figcaption,\n    .handheld-flight-identity,\n    .sim-worlds #flight-objective,\n    .sim-worlds .flight-brief p,\n    .beginner-coach[data-stage='live'] :is(.coach-target, .coach-explain),\n    .settings-heading,\n    .dialog-header,\n    .dialog-footer,\n    .field-kit-settings-tabs,\n    .soundtrack-footer,\n    #soundtrack-operation,\n    .optional-worlds-top,\n    .race-heading,\n    .reading-toolbar,\n    .shell-dialog-heading,\n    .demo-panel,\n    .demo-notes,\n    .demo-transport,\n    #demo-audio,\n    [data-ui-surface='toolbar']\n  ) {\n  color: var(--iw-text);\n  background: var(--ui-toolbar-finish, none), var(--iw-panel);\n  border-color: var(--iw-line);\n  border-image: none;\n  text-shadow: none;\n}\n[data-theme-styled='true']\n  :where(\n    fieldset,\n    details,\n    .drop,\n    .drop-zone,\n    .setting-row,\n    .settings-row,\n    .settings-preset,\n    .device-card,\n    .controller-card,\n    .controller-mapping,\n    .range-field,\n    .settings-metric,\n    .settings-note,\n    .settings-warning,\n    .mission-brief,\n    .enemy-guide,\n    .soundtrack-choice,\n    .soundtrack-advanced,\n    .soundtrack-online-results,\n    .school-flight-map,\n    .replay-controls,\n    .radio-device-card,\n    .radio-monitor,\n    .coach-tip,\n    .checkpoint,\n    .encounter-cue,\n    .demo-board,\n    .demo-settings,\n    .seat,\n    .control-card,\n    .batch-card-media,\n    .creator-media-poster,\n    .creator-poster-option,\n    #mission-brief-reading,\n    [data-ui-surface='inset']\n  ) {\n  color: var(--iw-text);\n  background: var(--ui-inset-finish, none), var(--iw-ink);\n  border-color: var(--iw-line);\n  border-image: none;\n  border-radius: 0;\n  box-shadow: var(--ui-inset-depth, none);\n}\n[data-theme-styled='true'] :where(table, .asset-grid, .inventory-grid, [data-ui-surface='table']) {\n  color: var(--iw-text);\n  background: var(--ui-panel-finish, none), var(--iw-panel);\n}\n[data-theme-styled='true'] :where(th, td, hr) {\n  color: inherit;\n  border-color: var(--iw-line);\n}\n[data-theme-styled='true'] :where(th, thead) {\n  background: var(--iw-panel-raised);\n}\n[data-theme-styled='true']\n  :where(tr[aria-selected='true'], [data-ui-surface='slot'][aria-selected='true']) {\n  color: var(--iw-on-selection, var(--iw-text));\n  background: var(--iw-selection, var(--iw-panel-raised));\n  box-shadow: inset 3px 0 var(--iw-focus, var(--iw-accent));\n}\n\n/* Each action chooses paired local roles; one painter handles every state. */\n[data-theme-styled='true']\n  :where(\n    button,\n    .button,\n    .button-link,\n    #profile-recovery-root a,\n    .action,\n    .community-entry,\n    [role='button'],\n    [data-ui-action],\n    .launch-action,\n    .file-button,\n    .native-menu-actions > a,\n    .game-mode-choice > a\n  ) {\n  --ui-action-status-depth: 0 0 0 0 transparent;\n  --ui-action-fill: var(--iw-button-default-background, var(--iw-panel-raised));\n  --ui-action-ink: var(--iw-button-default-foreground, var(--iw-text));\n  --ui-action-hover-fill: var(\n    --ui-hover-face,\n    var(--iw-button-hover-background, var(--iw-panel-raised))\n  );\n  --ui-action-hover-ink: var(--ui-hover-ink, var(--iw-button-hover-foreground, var(--iw-text)));\n  --ui-action-pressed-fill: var(--iw-button-pressed-background, var(--iw-selection));\n  --ui-action-pressed-ink: var(--iw-button-pressed-foreground, var(--iw-on-selection));\n  --ui-action-edge: var(--iw-control-line);\n  --ui-action-frame: var(--ui-raised-frame, none);\n  --ui-action-hover-frame: var(--ui-hover-frame, var(--ui-raised-frame, none));\n  --ui-action-pressed-frame: var(--ui-primary-frame, none);\n  color: var(--ui-action-ink);\n  background: var(--ui-control-finish, none), var(--ui-action-fill);\n  border: 2px solid var(--ui-action-edge);\n  border-image: var(--ui-action-frame, none);\n  border-radius: 0;\n  min-height: var(--iw-target);\n  box-sizing: border-box;\n  padding: 8px 14px;\n  font-family: var(--iw-font-ui);\n  font-size: var(--iw-text-size);\n  font-weight: 600;\n  line-height: 1.35;\n  text-shadow: none;\n  text-decoration: none;\n  box-shadow:\n    var(--ui-action-status-depth, 0 0 0 0 transparent),\n    var(\n      --ui-action-depth,\n      inset 0 1px 0 color-mix(in srgb, var(--ui-action-ink) 12%, transparent),\n      inset 0 -1px 0 #0002,\n      0 2px 0 var(--ui-shadow)\n    );\n  cursor: pointer;\n}\n[data-theme-styled='true']\n  :where(\n    .primary,\n    .primary-action,\n    .field-kit-primary,\n    .race-primary,\n    .soundtrack-primary-action,\n    .community-entry,\n    [data-ui-action='primary']\n  ) {\n  --ui-action-fill: var(--iw-primary-default-background, var(--iw-accent));\n  --ui-action-ink: var(--iw-primary-default-foreground, var(--iw-on-accent, var(--iw-ink)));\n  --ui-action-hover-fill: var(--iw-primary-hover-background, var(--iw-accent));\n  --ui-action-hover-ink: var(--iw-primary-hover-foreground, var(--iw-on-accent, var(--iw-ink)));\n  --ui-action-pressed-fill: var(--iw-primary-pressed-background, var(--iw-selection));\n  --ui-action-pressed-ink: var(--iw-primary-pressed-foreground, var(--iw-on-selection));\n  --ui-action-edge: var(--iw-accent);\n  --ui-action-frame: var(--ui-primary-frame, none);\n  --ui-action-hover-frame: var(--ui-primary-frame, none);\n}\n[data-theme-styled='true'] :where(.danger, .danger-action, [data-ui-action='danger']) {\n  --ui-action-fill: var(--iw-danger-default-background, var(--iw-hazard));\n  --ui-action-ink: var(--iw-danger-default-foreground, var(--iw-on-hazard));\n  --ui-action-hover-fill: var(--iw-danger-hover-background, var(--iw-hazard));\n  --ui-action-hover-ink: var(--iw-danger-hover-foreground, var(--iw-on-hazard));\n  --ui-action-pressed-fill: var(--iw-danger-pressed-background, var(--iw-hazard));\n  --ui-action-pressed-ink: var(--iw-danger-pressed-foreground, var(--iw-on-hazard));\n  --ui-action-edge: var(--iw-hazard);\n  --ui-action-frame: none;\n  --ui-action-hover-frame: none;\n  --ui-action-pressed-frame: none;\n}\n[data-theme-styled='true']\n  :where(\n    button,\n    .button,\n    .button-link,\n    #profile-recovery-root a,\n    .action,\n    .community-entry,\n    [role='button'],\n    [data-ui-action],\n    .launch-action,\n    .file-button,\n    .native-menu-actions > a,\n    .game-mode-choice > a\n  ):is(:hover, [data-state='hover']):not(:disabled, [aria-disabled='true']) {\n  background: var(--ui-hover-finish, var(--ui-control-finish, none)), var(--ui-action-hover-fill);\n  border-image: var(--ui-action-hover-frame, none);\n  color: var(--ui-action-hover-ink);\n  box-shadow:\n    var(--ui-action-status-depth, 0 0 0 0 transparent),\n    var(--ui-hover-depth, inset 0 0 0 1px var(--ui-action-edge), 0 2px 0 var(--ui-shadow));\n}\n[data-theme-styled='true']\n  :where(\n    button,\n    .button,\n    .button-link,\n    #profile-recovery-root a,\n    .action,\n    .community-entry,\n    [role='button'],\n    [data-ui-action],\n    .launch-action,\n    .file-button,\n    .native-menu-actions > a,\n    .game-mode-choice > a\n  ):is(:active, [data-state='pressed']):not(:disabled, [aria-disabled='true']) {\n  background: var(--ui-active-finish, none), var(--ui-action-pressed-fill);\n  color: var(--ui-action-pressed-ink);\n  border-image: var(--ui-action-pressed-frame, none);\n  box-shadow:\n    var(--ui-action-status-depth, 0 0 0 0 transparent),\n    var(--ui-pressed-depth, inset 0 2px 3px #0005);\n}\n[data-theme-styled='true']\n  :where(button, .button, [role='button'], a, [role='tab']):is(\n    [aria-pressed='true'],\n    [aria-selected='true'],\n    [aria-current]:where(:not([aria-current='false'])),\n    .selected,\n    .active-tab\n  ) {\n  --ui-action-fill: var(--iw-selection, var(--iw-panel-raised));\n  --ui-action-ink: var(--iw-on-selection, var(--iw-text));\n  --ui-action-hover-fill: var(--ui-action-fill);\n  --ui-action-hover-ink: var(--ui-action-ink);\n  color: var(--ui-action-ink);\n  background: var(--ui-selected-finish, var(--ui-active-finish, none)), var(--ui-action-fill);\n  border-color: var(--iw-focus, var(--iw-accent));\n  border-image: var(--ui-primary-frame, none);\n  box-shadow:\n    var(--ui-action-status-depth, 0 0 0 0 transparent),\n    var(--ui-selected-depth, inset 3px 0 var(--iw-focus, var(--iw-accent)));\n  text-decoration-thickness: 2px;\n}\n[data-theme-styled='true']\n  :where(button, .button, [role='button'], a, [role='tab']):is(\n    [aria-pressed='true'],\n    [aria-selected='true'],\n    [aria-current]:where(:not([aria-current='false'])),\n    .selected,\n    .active-tab\n  ):is(:active, [data-state='pressed']):not(:disabled, [aria-disabled='true']) {\n  background: var(--ui-active-finish, none), var(--ui-action-fill);\n  box-shadow:\n    var(--ui-action-status-depth, 0 0 0 0 transparent),\n    var(--ui-pressed-depth, inset 0 2px 3px #0005);\n}\n/* Busy paint is a stable progress rail, not a second label or a spinning\n   pseudo-element that could collide with a control's existing icon. */\n[data-theme-styled='true']\n  :where(button, .button, [role='button'], [data-ui-action])[aria-busy='true']:not(\n    :disabled,\n    [aria-disabled='true']\n  ) {\n  --ui-action-status-depth: inset 0 calc(-1 * var(--ui-loading-rail)) 0 currentColor;\n  cursor: progress;\n}\n[data-theme-styled='true']\n  :where(\n    button,\n    input,\n    select,\n    textarea,\n    a,\n    .button,\n    .button-link,\n    [role='button'],\n    [role='tab'],\n    [data-ui-action]\n  ):is(:disabled, [aria-disabled='true']) {\n  color: var(--iw-muted);\n  background: var(--iw-panel);\n  border-color: var(--iw-line);\n  border-style: dashed;\n  border-image: none;\n  opacity: 1;\n  cursor: not-allowed;\n  box-shadow: none;\n}\n[data-theme-styled='true']\n  :where(button, .button, [role='button'])\n  :where(span, strong, em, small) {\n  color: inherit;\n}\n\n/* Native value controls retain browser semantics and keyboard operation. */\n[data-theme-styled='true'] :where(input, select, textarea) {\n  color: var(--iw-input-text, var(--iw-text));\n  background: var(--ui-inset-finish, none), var(--iw-input, var(--iw-ink));\n  border: 2px solid var(--iw-control-line);\n  border-image: none;\n  border-radius: 0;\n  font-family: var(--iw-font-ui);\n  font-size: var(--iw-text-size);\n  accent-color: var(--iw-accent);\n  box-shadow: var(--ui-inset-depth, inset 0 1px 2px #0003);\n}\n[data-theme-styled='true']\n  :where(\n    select,\n    textarea,\n    input:not([type='checkbox'], [type='radio'], [type='range'], [type='color'])\n  ) {\n  min-height: var(--iw-target);\n  box-sizing: border-box;\n  padding: 6px 10px;\n}\n[data-theme-styled='true'] :where(input, textarea)::placeholder {\n  color: var(--iw-muted);\n  opacity: 1;\n}\n[data-theme-styled='true'] :where(option, optgroup) {\n  color: var(--iw-input-text, var(--iw-text));\n  background: var(--iw-input, var(--iw-ink));\n}\n[data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio']) {\n  appearance: none;\n  display: inline-grid;\n  place-content: center;\n  inline-size: 22px;\n  block-size: 22px;\n  min-inline-size: 22px;\n  min-block-size: 22px;\n  flex: 0 0 22px;\n  padding: 0;\n  vertical-align: middle;\n  background: var(--ui-inset-finish, none), var(--iw-ink);\n  border: 2px solid var(--iw-control-line);\n  border-image: none;\n  box-shadow: var(--ui-inset-depth, none);\n}\n[data-theme-styled='true'] input[type='radio'] {\n  border-radius: 50%;\n}\n[data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio'])::before {\n  content: '';\n  display: block;\n  width: 12px;\n  height: 12px;\n  background: var(--iw-on-accent, var(--iw-ink));\n  transform: scale(0);\n  clip-path: polygon(0 43%, 17% 26%, 40% 51%, 83% 4%, 100% 20%, 41% 87%);\n}\n[data-theme-styled='true'] input[type='radio']::before {\n  width: 10px;\n  height: 10px;\n  border-radius: 50%;\n  clip-path: none;\n}\n[data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio']):checked {\n  background: var(--ui-active-finish, none), var(--iw-accent);\n  border-color: var(--iw-accent);\n  outline: none;\n  box-shadow: var(--ui-inset-depth, none);\n}\n[data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio']):checked::before {\n  transform: scale(1);\n}\n[data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio']):disabled {\n  background: var(--ui-panel-finish, none), var(--iw-panel);\n  border-color: var(--iw-muted);\n  border-style: dashed;\n  cursor: not-allowed;\n}\n[data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio']):disabled::before {\n  background: var(--iw-muted);\n}\n[data-theme-styled='true'] input[type='checkbox']:indeterminate::before {\n  transform: scale(1);\n  clip-path: inset(40% 0);\n  background: var(--iw-accent);\n}\n[data-theme-styled='true'] label:has(> input:is([type='checkbox'], [type='radio'])) {\n  min-height: var(--iw-target);\n  align-items: center;\n  cursor: pointer;\n}\n[data-theme-styled='true'] input[type='range'] {\n  appearance: none;\n  min-height: var(--iw-target);\n  padding: 0;\n  background: transparent;\n  border: 0;\n  box-shadow: none;\n  cursor: pointer;\n}\n[data-theme-styled='true'] input[type='range']::-webkit-slider-runnable-track {\n  height: 6px;\n  border: 1px solid var(--iw-control-line);\n  background: var(--iw-ink);\n  border-radius: 0;\n}\n[data-theme-styled='true'] input[type='range']::-moz-range-track {\n  height: 4px;\n  border: 1px solid var(--iw-control-line);\n  background: var(--iw-ink);\n  border-radius: 0;\n}\n[data-theme-styled='true'] input[type='range']::-webkit-slider-thumb {\n  appearance: none;\n  width: 24px;\n  height: 24px;\n  margin-top: -10px;\n  background: var(--ui-thumb-finish, none), var(--iw-accent);\n  border: 2px solid var(--iw-on-accent, var(--iw-ink));\n  border-radius: 0;\n  box-shadow: 0 0 0 1px var(--iw-control-line);\n}\n[data-theme-styled='true'] input[type='range']::-moz-range-thumb {\n  width: 20px;\n  height: 20px;\n  background: var(--ui-thumb-finish, none), var(--iw-accent);\n  border: 2px solid var(--iw-on-accent, var(--iw-ink));\n  border-radius: 0;\n  box-shadow: 0 0 0 1px var(--iw-control-line);\n}\n[data-theme-styled='true'] input[type='range']:disabled {\n  cursor: not-allowed;\n  opacity: 0.65;\n}\n[data-theme-styled='true'] :where(progress, meter) {\n  accent-color: var(--iw-accent);\n  color: var(--iw-accent);\n  background: var(--iw-ink);\n  border: 1px solid var(--iw-control-line);\n  border-image: none;\n  border-radius: 0;\n}\n[data-theme-styled='true'] progress::-webkit-progress-bar {\n  background: var(--iw-ink);\n}\n[data-theme-styled='true'] progress::-webkit-progress-value {\n  background: var(--ui-active-finish, none), var(--iw-accent);\n}\n[data-theme-styled='true'] progress::-moz-progress-bar {\n  background: var(--ui-active-finish, none), var(--iw-accent);\n}\n[data-theme-styled='true'] :where(*) {\n  scrollbar-color: var(--iw-control-line) var(--iw-ink);\n}\n[data-theme-styled='true'] ::-webkit-scrollbar-thumb {\n  background: var(--iw-control-line);\n  border: 2px solid var(--iw-ink);\n}\n[data-theme-styled='true'] ::-webkit-scrollbar-track {\n  background: var(--iw-ink);\n}\n\n/* Native controls share the same material authority as action buttons.\n   Errors mark the well; the entered value keeps its readable text pair. */\n[data-theme-styled='true']\n  :where(\n    select,\n    textarea,\n    input:not([type='range'], [type='checkbox'], [type='radio'], [type='color'])\n  ):is(:hover, [data-state='hover']):not(:disabled, [aria-disabled='true']) {\n  border-color: var(--iw-focus);\n  box-shadow: var(\n    --ui-input-hover-depth,\n    var(--ui-inset-depth, inset 0 0 0 1px var(--iw-control-line))\n  );\n}\n[data-theme-styled='true']\n  :where(input, select, textarea)[aria-invalid='true']:not(:disabled, [aria-disabled='true']) {\n  color: var(--iw-input-text, var(--iw-text));\n  border-color: var(--iw-hazard);\n  box-shadow:\n    inset 3px 0 0 var(--iw-hazard),\n    var(--ui-inset-depth, 0 0 0 0 transparent);\n}\n[data-theme-styled='true']\n  :where(input, select, textarea)[data-ui-validation='success']:not(\n    [aria-invalid='true'],\n    :disabled,\n    [aria-disabled='true']\n  ) {\n  border-color: var(--iw-safe);\n  box-shadow:\n    inset 3px 0 0 var(--iw-safe),\n    var(--ui-inset-depth, 0 0 0 0 transparent);\n}\n[data-theme-styled='true']\n  :where(input[type='checkbox'], input[type='radio']):is(:hover, [data-state='hover']):not(\n    :disabled,\n    [aria-disabled='true'],\n    [aria-invalid='true'],\n    [data-ui-validation='success']\n  ) {\n  border-color: var(--iw-focus);\n  box-shadow: var(--ui-input-hover-depth, var(--ui-inset-depth, none));\n}\n[data-theme-styled='true'] input[type='range']::-webkit-slider-runnable-track {\n  background: var(--ui-inset-finish, none), var(--iw-ink);\n  box-shadow: var(--ui-inset-depth, none);\n}\n[data-theme-styled='true'] input[type='range']::-moz-range-track {\n  background: var(--ui-inset-finish, none), var(--iw-ink);\n  box-shadow: var(--ui-inset-depth, none);\n}\n[data-theme-styled='true']\n  input[type='range']:is(:hover, :focus-visible, [data-state='hover'])::-webkit-slider-thumb {\n  box-shadow:\n    0 0 0 2px var(--iw-focus),\n    var(--ui-hover-depth, 0 0 0 0 transparent);\n}\n[data-theme-styled='true']\n  input[type='range']:is(:hover, :focus-visible, [data-state='hover'])::-moz-range-thumb {\n  box-shadow:\n    0 0 0 2px var(--iw-focus),\n    var(--ui-hover-depth, 0 0 0 0 transparent);\n}\n[data-theme-styled='true'] input[type='range']:disabled {\n  opacity: 1;\n}\n[data-theme-styled='true'] input[type='range']:disabled::-webkit-slider-thumb {\n  background: var(--iw-muted);\n  border: 2px dashed var(--iw-panel);\n  box-shadow: 0 0 0 1px var(--iw-line);\n}\n[data-theme-styled='true'] input[type='range']:disabled::-moz-range-thumb {\n  background: var(--iw-muted);\n  border: 2px dashed var(--iw-panel);\n  box-shadow: 0 0 0 1px var(--iw-line);\n}\n\n/* Compiled icon silhouettes are reusable geometry, never a fixed cyan pigment. */\n[data-theme-styled='true'] [data-presentation-icon]:not([data-menu-icon])::before {\n  color: inherit;\n  content: '';\n  display: inline-block;\n  inline-size: 24px;\n  block-size: 24px;\n  flex: 0 0 24px;\n  background: currentColor;\n  mask: var(--fk-current-icon, linear-gradient(transparent, transparent)) center / contain no-repeat;\n  -webkit-mask: var(--fk-current-icon, linear-gradient(transparent, transparent)) center / contain\n    no-repeat;\n  clip-path: none;\n  image-rendering: pixelated;\n}\n[data-theme-styled='true']\n  :where([data-presentation-control], [data-presentation-hud], [data-presentation-reward])::before {\n  background: currentColor;\n  color: inherit;\n  mask: var(--fk-current-glyph, linear-gradient(transparent, transparent)) center / contain\n    no-repeat;\n  -webkit-mask: var(--fk-current-glyph, linear-gradient(transparent, transparent)) center / contain\n    no-repeat;\n}\n[data-theme-styled='true'] :where([data-menu-icon])::before {\n  background: currentColor;\n  mask: var(--native-menu-icon, linear-gradient(transparent, transparent)) center / contain\n    no-repeat;\n  -webkit-mask: var(--native-menu-icon, linear-gradient(transparent, transparent)) center / contain\n    no-repeat;\n}\n[data-theme-styled='true'] :where(.meter > span, .launch-signal i) {\n  background: var(--iw-accent);\n}\n[data-theme-styled='true'] :where(.meter, [role='progressbar']) {\n  color: var(--iw-text);\n  background: var(--iw-ink);\n  border-color: var(--iw-control-line);\n  border-image: none;\n}\n\n/* Focus and state cues retain a shape in every palette. */\n[data-theme-styled='true'] :is(:focus-visible, .controller-focus, [data-state='focus']) {\n  outline: 3px solid var(--iw-focus, var(--iw-control-line));\n  outline-offset: 3px;\n  scroll-margin: 12px;\n}\n[data-theme-styled='true']\n  :where([aria-invalid='true']:not(input, select, textarea), .error, [data-ui-tone='danger']) {\n  color: var(--iw-hazard);\n  border-color: var(--iw-hazard);\n  border-image: none;\n}\n[data-theme-styled='true'] :where([data-ui-tone='success'], .success) {\n  color: var(--iw-safe);\n}\n[data-theme-styled='true'] :where([data-ui-tone='warning'], .warning) {\n  color: var(--iw-amber);\n}\n[data-theme-styled='true'] ::selection {\n  color: var(--iw-on-selection, var(--iw-ink));\n  background: var(--iw-selection, var(--iw-accent));\n}\n[data-theme-styled='true'] :where(dialog)::backdrop {\n  background: color-mix(in srgb, var(--iw-ink) 78%, transparent);\n}\n\n/* Source art stays intact; only its reading veil follows the interface. */\n[data-theme-styled='true'] .menu-scene::after {\n  background:\n    linear-gradient(\n      90deg,\n      color-mix(in srgb, var(--iw-ink) 94%, transparent),\n      color-mix(in srgb, var(--iw-ink) 75%, transparent) 28%,\n      color-mix(in srgb, var(--iw-ink) 22%, transparent) 63%,\n      transparent\n    ),\n    linear-gradient(0deg, color-mix(in srgb, var(--iw-ink) 65%, transparent), transparent 30%);\n}\n[data-theme-styled='true'] .menu-scene {\n  --scene-ink: var(--iw-ink);\n  --scene-accent: var(--iw-panel-raised);\n}\n[data-theme-styled='true'] :where(.menu-ornament, .menu-scene-decoration) {\n  color: var(--iw-line);\n}\n[data-theme-texture='off'] :where(.menu-ornament, .menu-scene-decoration, .menu-retune-layer) {\n  display: none;\n}\n/* Composed action shadows need a transparent zero, not `none`: a shadow\n   list containing `none` is invalid and would also remove semantic busy rails. */\n[data-theme-surface='flat'] {\n  --ui-panel-frame: none;\n  --ui-raised-frame: none;\n  --ui-primary-frame: none;\n  --ui-panel-depth: none;\n  --ui-action-depth: 0 0 0 0 transparent;\n  --ui-hover-depth: 0 0 0 0 transparent;\n  --ui-pressed-depth: 0 0 0 0 transparent;\n  --ui-selected-depth: 0 0 0 0 transparent;\n  --ui-gallery-depth: none;\n}\n[data-theme-hud='opaque']\n  :where(\n    .hud,\n    .hud-card,\n    .hud-panel,\n    .telemetry,\n    .sim-hud,\n    .flight-hud,\n    .flight-instruments,\n    .flight-coaching,\n    .flight-brief p,\n    .scene-heading,\n    #hud,\n    [data-hud]\n  ) {\n  background: var(--iw-ink);\n  color: var(--iw-text);\n  text-shadow: none;\n  backdrop-filter: none;\n  opacity: 1;\n}\n[data-theme-motion='reduced']\n  :where(\n    .menu-ornament,\n    .edition-propeller,\n    .theme-decoration,\n    .menu-scene-decoration,\n    .operation-status-signal i,\n    .win-picture-caption\n  ) {\n  animation: none;\n  transition: none;\n  transform: none;\n}\n[data-theme-motion='reduced'] .menu-retune-layer {\n  display: none;\n}\n[data-theme-text-size='large']:not([data-interface-theme='legacy'])\n  :where(p, label, button, select, input, textarea, .micro-note) {\n  font-size: max(18px, 1em);\n}\n\n.theme-family-controls {\n  display: grid;\n  grid-template-columns: minmax(0, 1fr);\n  min-width: 0;\n  gap: 10px;\n  margin-block: 16px;\n  padding-block: 12px;\n  border-block: 1px solid var(--fk-line, #737c69);\n}\n/* Native select options must not widen the grid's implicit min-content track.\n   Keep help text and nested controls inside narrow settings panels. */\n.theme-family-controls > * {\n  min-width: 0;\n  max-width: 100%;\n  box-sizing: border-box;\n}\n.theme-family-controls > h4 {\n  margin: 2px 0 0;\n}\n.theme-family-controls label {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px;\n  justify-content: space-between;\n}\n.theme-family-controls label:has(> input[type='checkbox']) {\n  justify-content: flex-start;\n  min-height: var(--iw-target, 44px);\n}\n.theme-family-controls select {\n  min-width: 0;\n  max-width: 100%;\n  box-sizing: border-box;\n}\n.theme-family-controls [role='status']:empty {\n  display: none;\n}\n.sim-appearance-controls {\n  grid-column: 1 / -1;\n  display: flex;\n  flex-wrap: wrap;\n  align-items: center;\n  gap: 8px 16px;\n  min-width: 0;\n  max-width: 100%;\n}\n.sim-appearance-controls label {\n  display: grid;\n  gap: 6px;\n  min-width: 0;\n  max-width: 100%;\n}\n.sim-appearance-controls select {\n  min-width: 0;\n  max-width: 100%;\n}\n.sim-appearance-controls [role='status'] {\n  flex-basis: 100%;\n}\n.sim-worlds .flight-controls > .sim-appearance-controls {\n  flex: 1 0 100%;\n  box-sizing: border-box;\n  margin-inline: 0;\n}\n[data-theme-styled='true'] .sim-worlds .flight-dialog > header {\n  z-index: 10;\n  background: var(--ui-panel-finish, none), var(--iw-panel);\n  box-shadow: 0 0 0 8px var(--iw-panel);\n}\n@media (pointer: coarse) {\n  [data-theme-density='studio'] {\n    --iw-target: 44px;\n  }\n}\n@media (orientation: portrait) {\n  [data-theme-styled='true'] .menu-scene::after {\n    background: linear-gradient(\n      0deg,\n      color-mix(in srgb, var(--iw-ink) 94%, transparent),\n      color-mix(in srgb, var(--iw-ink) 73%, transparent) 35%,\n      color-mix(in srgb, var(--iw-ink) 23%, transparent) 80%\n    );\n  }\n}\n@media (forced-colors: active) {\n  [data-theme-family][data-theme-material] {\n    --ui-panel-finish: none;\n    --ui-control-finish: none;\n    --ui-hover-finish: none;\n    --ui-selected-finish: none;\n    --ui-active-finish: none;\n    --ui-inset-finish: none;\n    --ui-toolbar-finish: none;\n    --ui-thumb-finish: none;\n    --ui-scene-motif: none;\n  }\n  [data-theme-styled='true']\n    :where(button, .button, input, select, textarea, dialog, .panel, [data-ui-surface]) {\n    border-image: none;\n    box-shadow: none;\n    border-color: ButtonText;\n    forced-color-adjust: auto;\n  }\n  [data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio']) {\n    appearance: auto;\n  }\n  [data-theme-styled='true'] :where(input[type='checkbox'], input[type='radio'])::before {\n    display: none;\n  }\n  [data-theme-styled='true'] :is(:focus-visible, .controller-focus) {\n    outline-color: Highlight;\n  }\n}\n\n/* A filled raster swaps atomically. Interpolating its label separately can\n   briefly create dark-on-dark text while a selected tab changes state. */\n[data-theme-styled='true']\n  :where(button, .button, [role='button'], .native-menu-actions > a, .game-mode-choice > a) {\n  transition:\n    box-shadow 100ms ease,\n    outline-color 100ms ease,\n    translate 70ms ease-out;\n}\n[data-theme-styled='true']\n  :where(button, .button, [role='button'], .native-menu-actions > a, .game-mode-choice > a):is(\n    :active,\n    [data-state='pressed']\n  ):not(:disabled, [aria-disabled='true']) {\n  translate: var(--ui-press-travel);\n}\n/* The game's motion preference applies even when the operating system allows\n   animation. Keep this override after the common action transition recipe. */\n[data-theme-motion='reduced']\n  :where(button, .button, [role='button'], .native-menu-actions > a, .game-mode-choice > a) {\n  transition: none;\n  translate: none;\n}\n[data-theme-styled='true'] label:has(> input:is([type='checkbox'], [type='radio'])) {\n  color: var(--iw-text);\n  background-color: var(--iw-panel-raised);\n  border-color: var(--iw-line);\n  border-image: none;\n  border-radius: 0;\n}\n.theme-gallery {\n  display: grid;\n  grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr));\n  gap: 8px;\n}\n.theme-gallery .theme-preview-card {\n  display: grid;\n  grid-template-columns: 1fr;\n  gap: 5px;\n  align-content: start;\n  min-width: 0;\n  text-align: left;\n  min-height: var(--iw-target, 44px);\n  padding: 8px 10px 9px;\n  border-image: var(--ui-raised-frame, none);\n  background: var(--ui-control-finish, none), var(--iw-panel, var(--fk-panel));\n  color: var(--iw-text, var(--fk-text));\n  box-shadow: var(--ui-gallery-depth, none);\n}\n.theme-preview-swatches {\n  display: grid;\n  grid-template-columns: 2fr 2fr 1fr 1fr;\n  gap: 0;\n  overflow: hidden;\n  border: 1px solid var(--iw-control-line, var(--fk-line));\n}\n.theme-preview-swatches span {\n  display: block;\n  min-width: 0;\n  height: 28px;\n  border: 0;\n}\n.theme-preview-card strong {\n  line-height: 1.2;\n}\n.theme-preview-card small {\n  font-size: 13px;\n  font-weight: 400;\n  line-height: 1.32;\n  opacity: 0.9;\n}\n.theme-gallery\n  .theme-preview-card:hover:not(\n    [aria-pressed='true'],\n    :disabled,\n    [aria-disabled='true'],\n    :active,\n    [data-state='pressed']\n  ) {\n  background: var(--ui-control-finish, none), var(--ui-action-hover-fill);\n  color: var(--ui-action-hover-ink);\n  border-image: var(--ui-action-hover-frame, none);\n  box-shadow: var(--ui-hover-depth, none);\n}\n.theme-gallery .theme-preview-card[aria-pressed='true'] {\n  color: var(--iw-on-selection, var(--fk-text));\n  background: var(--ui-active-finish, none), var(--iw-selection, var(--fk-panel));\n  border-image: var(--ui-primary-frame, none);\n  outline: 2px solid var(--iw-focus, var(--fk-focus));\n  outline-offset: 2px;\n}\n.theme-gallery\n  .theme-preview-card:is(:active, [data-state='pressed']):not(:disabled, [aria-disabled='true']) {\n  color: var(--ui-action-pressed-ink);\n  background: var(--ui-active-finish, none), var(--ui-action-pressed-fill);\n  border-image: var(--ui-primary-frame, none);\n  box-shadow: var(--ui-pressed-depth, inset 0 2px 3px #0005);\n}\n.theme-gallery .theme-preview-card:is(:focus-visible, .controller-focus) {\n  outline: 3px solid var(--iw-focus, var(--fk-focus));\n  outline-offset: 5px;\n}\n.theme-gallery .theme-preview-card:is(:disabled, [aria-disabled='true']) {\n  color: var(--iw-muted);\n  background: var(--iw-panel);\n  border-image: none;\n  box-shadow: none;\n}\n.theme-preview-card[aria-pressed='true'] strong::after {\n  content: ' ✓';\n}\n/* Independent runtime specimens inside the chooser. Only the surrounding card\n   is interactive; its focus and selected frame remain outside the preview. */\n.theme-gallery .theme-preview-card:has([data-theme-card-preview]) {\n  gap: 8px;\n  padding: 10px;\n}\n.theme-preview-card:has([data-theme-card-preview]) .theme-preview-swatches {\n  height: 4px;\n}\n.theme-preview-card:has([data-theme-card-preview]) .theme-preview-swatches span {\n  height: 4px;\n}\n.theme-material-preview {\n  display: block;\n  min-width: 0;\n  padding: 14px;\n  background: var(--iw-ink);\n  color: var(--iw-text);\n  font-family: var(--iw-font-ui);\n  font-size: var(--iw-text-size, 16px);\n  text-align: left;\n  line-height: 1.35;\n  isolation: isolate;\n}\n.theme-material-preview .theme-material-panel {\n  display: grid;\n  min-width: 0;\n  gap: 12px;\n  padding: 14px;\n  color: var(--iw-text);\n}\n.theme-material-actions,\n.theme-material-states {\n  display: flex;\n  flex-wrap: wrap;\n  align-items: stretch;\n  gap: 8px;\n}\n.theme-material-preview .theme-material-action {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: auto;\n  margin: 0;\n  font-family: var(--iw-font-ui);\n  font-size: inherit;\n  font-weight: 600;\n  color: var(--ui-action-ink);\n}\n.theme-material-preview .theme-material-action:is(:hover, [data-state='hover']) {\n  color: var(--ui-action-hover-ink);\n}\n.theme-material-preview .theme-material-action:is(:active, [data-state='pressed']) {\n  color: var(--ui-action-pressed-ink);\n}\n.theme-material-preview .theme-material-action:is(:disabled, [aria-disabled='true']) {\n  color: var(--iw-muted);\n}\n.theme-material-preview .theme-material-field {\n  display: grid;\n  grid-template-columns: auto minmax(0, 1fr);\n  align-items: center;\n  gap: 10px;\n  color: var(--iw-text);\n  margin: 0;\n}\n.theme-material-preview .theme-material-field select {\n  min-width: 0;\n  width: 100%;\n  font-size: inherit;\n}\n.theme-material-preview .theme-material-select {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  gap: 6px;\n  padding: 5px 8px;\n  border: 2px solid var(--iw-control-line);\n  background: var(--ui-inset-finish, none), var(--iw-input);\n  box-shadow: var(--ui-inset-depth, none);\n  color: var(--iw-input-text);\n}\n.theme-material-select::after {\n  content: '⌄';\n}\n.theme-material-preview .theme-material-check {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n  padding: 6px 8px;\n  background: var(--iw-panel-raised);\n  color: var(--iw-text);\n  margin: 0;\n}\n.theme-material-preview span.theme-material-checkbox {\n  display: inline-grid;\n  place-items: center;\n  width: 18px;\n  height: 18px;\n  flex: 0 0 18px;\n  border: 2px solid var(--iw-accent);\n  background: var(--ui-active-finish, none), var(--iw-accent);\n  color: var(--iw-on-accent);\n  font-weight: 700;\n  line-height: 1;\n}\n.theme-material-preview[data-preview-compact='true'] {\n  padding: 8px;\n  font-size: 12px;\n  pointer-events: none;\n}\n.theme-material-preview[data-preview-compact='true'] .theme-material-panel {\n  gap: 7px;\n  padding: 10px;\n}\n.theme-material-preview[data-preview-compact='true'] .theme-material-action {\n  min-height: 30px;\n  min-width: 0;\n  padding: 5px 7px;\n  flex: 1 1 auto;\n}\n.theme-material-preview[data-preview-compact='true']\n  :is(.theme-material-actions, .theme-material-states) {\n  gap: 6px;\n}\n.theme-material-preview[data-theme-text-size='large'] {\n  font-size: 16px;\n}\n.theme-material-preview[data-theme-text-size='large'] .theme-material-field {\n  grid-template-columns: 1fr;\n  gap: 4px;\n}\n.theme-preview-card .theme-material-preview,\n.theme-preview-card .theme-material-preview .theme-material-panel {\n  color: var(--iw-text);\n}\n.theme-accessibility {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px 20px;\n}\n.theme-family-controls > details {\n  padding: 12px;\n}\n.theme-family-controls > details > summary {\n  min-height: var(--iw-target, 44px);\n  cursor: pointer;\n}\n@media (max-width: 600px) {\n  .theme-gallery {\n    grid-template-columns: 1fr;\n  }\n}\n/* Compact Settings deliberately gives Back a fixed icon slot. Typography\n   overrides, including Large text, must not reveal its label over the arrow.\n   The real text/accessible name and the 44px target remain intact. */\n@media (max-width: 700px) {\n  [data-theme-styled='true'] .native-settings [data-menu-icon='back'] {\n    font-size: 0;\n    flex: 0 0 44px;\n    width: 44px;\n    min-width: 44px;\n    height: 44px;\n    min-height: 44px;\n    padding: 8px;\n    gap: 0;\n  }\n}\n/* Keep the compiled icon-only controls' real labels available to assistive\n   technology without drawing fallback text beside their replacement glyphs. */\n[data-theme-styled='true']\n  :is(.dialog-close, .icon-button)[data-presentation-icon][aria-label]:not([data-menu-icon]),\n[data-theme-styled='true']\n  :is(\n    [data-presentation-control='up'],\n    [data-presentation-control='down'],\n    [data-presentation-control='left'],\n    [data-presentation-control='right']\n  )[aria-label] {\n  font-size: 0;\n  gap: 0;\n  min-inline-size: var(--iw-target);\n}\n@media (prefers-reduced-motion: reduce) {\n  [data-theme-styled='true']\n    :where(button, .button, [role='button'], .native-menu-actions > a, .game-mode-choice > a) {\n    transition: none;\n    translate: none;\n  }\n}\n\n[data-theme-styled='true'] [data-ui-surface='section-title'] {\n  color: var(--iw-muted);\n  background: var(--iw-ink);\n  border-color: var(--iw-line);\n  border-image: none;\n}\n\n/* Earned media keeps its authored picture. Only the overlaid reading and\n   control surfaces share the active interface's paired colors. */\n[data-theme-styled='true']\n  :where(\n    .story-controls,\n    .story-notice,\n    .story-dialog--immersive > p:not(:empty),\n    .win-picture-caption,\n    #demo-dialog[data-reward='expanded'] .demo-header,\n    #demo-dialog[data-reward='expanded'] .demo-panel\n  ) {\n  color: var(--iw-text);\n  background: var(--ui-panel-finish, none), var(--iw-panel);\n  border-color: var(--iw-line);\n  border-image: none;\n  border-radius: 0;\n  text-shadow: none;\n  backdrop-filter: none;\n}\n[data-theme-styled='true']\n  :where(.story-dialog--immersive, .creator-player[data-earned-view='on'] #earned) {\n  background: var(--iw-ink);\n  border: 0;\n  border-image: none;\n  box-shadow: none;\n}\n/* The image element fills the viewport, including its contain-fit letterbox.\n   Theme only that backing; the authored pixels and fitting remain unchanged. */\n[data-theme-styled='true'] .creator-player #earned-picture {\n  background-color: var(--iw-ink);\n}\n[data-theme-styled='true'] .win-picture-caption {\n  width: fit-content;\n  max-width: calc(100% - 32px);\n  box-sizing: border-box;\n  margin-inline: auto;\n  padding: 12px 20px;\n  border: 1px solid var(--iw-line);\n}\n[data-theme-styled='true'] .win-picture-mark {\n  color: var(--iw-accent);\n}\n[data-theme-styled='true'] [data-win-picture] #shell-menu {\n  padding: 0;\n}\n[data-theme-styled='true'] [data-win-picture] #shell-menu::before {\n  color: inherit;\n}\n\n/* Status, badges and callouts are shared reading surfaces, including tools. */\n[data-theme-styled='true']\n  :where(\n    [role='status'],\n    [role='alert'],\n    .operation-status,\n    .callout,\n    .notice,\n    .pill,\n    .chip,\n    .status,\n    .skip-link,\n    pre\n  ) {\n  color: var(--iw-text);\n  background-color: var(--iw-panel);\n  border-color: var(--iw-line);\n  border-image: none;\n  border-radius: 0;\n}\n[data-theme-styled='true']\n  :where(.status-ready, [role='status'].success, [data-ui-tone='success']) {\n  color: var(--iw-safe);\n}\n[data-theme-styled='true']\n  :where(.status-building, [role='status'].warning, [data-ui-tone='warning']) {\n  color: var(--iw-amber);\n}\n[data-theme-styled='true']\n  :where(\n    [role='alert'],\n    [role='status'].error,\n    [role='status'][data-error='true'],\n    [data-ui-tone='danger']\n  ) {\n  color: var(--iw-hazard);\n}\n[data-theme-styled='true'] :where([role='status'][data-error='true'], [role='status'].error) {\n  border-inline-start: 3px solid var(--iw-hazard);\n  padding-inline-start: 0.75rem;\n}\n[data-theme-styled='true'] .operation-status[data-state='error'] {\n  color: var(--iw-hazard);\n  border-inline-start: 3px solid var(--iw-hazard);\n  padding-inline-start: 0.75rem;\n}\n[data-theme-styled='true'] .operation-status:is([data-state='cancelled'], [data-state='detached']) {\n  color: var(--iw-amber);\n}\n[data-theme-styled='true'] .operation-status .operation-status-label {\n  color: inherit;\n  background: transparent;\n}\n\n/* Deep dialogs and tool results are part of the same interface. Never leave a\n   legacy navy/teal well behind a newly resolved light-theme text color. */\n[data-theme-styled='true'] :where(.soundtrack-quick-status, .race-start-cue strong) {\n  color: var(--iw-on-accent);\n  background: var(--iw-accent);\n  border-color: var(--iw-accent);\n  border-image: none;\n}\n[data-theme-styled='true'] .journey-card-action {\n  color: var(--iw-on-accent);\n  background: var(--iw-accent);\n  border-color: var(--iw-accent);\n  font-size: 0.75rem;\n}\n[data-theme-styled='true'] .soundtrack-now-card::after {\n  background: var(--iw-accent);\n}\n[data-theme-styled='true'] .soundtrack-advanced-summary::after {\n  color: inherit;\n}\n[data-theme-styled='true'] .soundtrack-online-track {\n  border-color: var(--iw-line);\n}\n[data-theme-styled='true'] .soundtrack-online-track:is(:hover, :focus-within) {\n  color: var(--iw-text);\n  background: var(--iw-panel-raised);\n}\n[data-theme-styled='true'] :where(.soundtrack-online-style, .creator-poster-option):focus-within {\n  outline: 3px solid var(--iw-focus);\n  outline-offset: 2px;\n}\n[data-theme-styled='true'] :where(.batch-card-error, .creator-media-card-error) {\n  border-color: var(--iw-hazard);\n  border-image: none;\n}\n[data-theme-styled='true'] :where(.batch-card-preparing, .optional-world-current) {\n  outline: 2px solid var(--iw-focus);\n  outline-offset: 2px;\n}\n[data-theme-styled='true']\n  :where(\n    .asset-row.selected,\n    .candidate-entry.selected,\n    [aria-selected='true'],\n    [aria-pressed='true']\n  )\n  :where(.muted, .micro-note, small) {\n  color: inherit;\n}\n[data-theme-styled='true'] input[type='file']::file-selector-button {\n  color: var(--iw-text);\n  background: var(--ui-control-finish, none), var(--iw-panel-raised);\n  border: 1px solid var(--iw-control-line);\n  border-radius: 0;\n  box-shadow: var(--ui-action-depth, none);\n  min-height: var(--iw-target);\n  padding: 6px 10px;\n  margin-inline-end: 10px;\n  font: inherit;\n  cursor: pointer;\n}\n[data-theme-styled='true'] input[type='file']:not(:disabled)::file-selector-button:hover {\n  background:\n    var(--ui-hover-finish, var(--ui-control-finish, none)),\n    var(--ui-hover-face, var(--iw-panel-raised));\n  color: var(--ui-hover-ink, var(--iw-text));\n  box-shadow: var(--ui-hover-depth, none);\n}\n[data-theme-styled='true'] input[type='file']:not(:disabled)::file-selector-button:active {\n  background: var(--ui-active-finish, none), var(--iw-selection);\n  color: var(--iw-on-selection);\n  box-shadow: var(--ui-pressed-depth, none);\n}\n[data-theme-styled='true'] input[type='file']:disabled::file-selector-button {\n  color: var(--iw-muted);\n  background: var(--iw-panel);\n  border-style: dashed;\n  box-shadow: none;\n  cursor: not-allowed;\n}\n/* Reading state belongs to the message, not a permanent empty painted bar. */\n[data-theme-styled='true'] :where([role='status'], [role='alert']):empty {\n  background: transparent;\n}\n[data-theme-styled='true'] label:has(> input:is([type='checkbox'], [type='radio'])) {\n  padding: 6px 10px;\n  box-sizing: border-box;\n  gap: 10px;\n}\n[data-theme-styled='true'] :where(.soundtrack-dialog, .optional-worlds-dialog) .micro-note {\n  font-size: var(--fk-text-secondary);\n}\n/* Session transport is one control group. Its volume label must not run into\n   the last button when a long translation or enlarged text wraps the row. */\n[data-theme-styled='true'] [data-couch-music] {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 10px;\n  align-items: center;\n}\n[data-theme-styled='true'] [data-couch-music] > :where(h3, p, label, input, section, details) {\n  flex: 1 0 100%;\n  min-width: 0;\n  max-width: 100%;\n  box-sizing: border-box;\n}\n[data-theme-styled='true'] [data-couch-music] > :where(h3, p) {\n  margin-block: 8px;\n}\n[data-theme-styled='true'] [data-couch-music] > label {\n  margin-top: 8px;\n}\n[data-theme-styled='true'] #soundtrack-now-sources {\n  display: flex;\n  flex-wrap: wrap;\n  gap: 8px 16px;\n  margin-block: 12px;\n}\n[data-theme-styled='true'] :where(.page-head, .masthead) > a + a {\n  margin-inline-start: 12px;\n}\n\n[data-theme-styled='true'] :where(.asset-row.selected, .candidate-entry.selected) {\n  color: var(--iw-on-selection);\n  background: var(--iw-selection);\n  border-color: var(--iw-focus);\n  box-shadow: inset 3px 0 var(--iw-focus);\n}\n\n/* Only the application-owned menu backdrop changes with the interface. Authored\n   campaign/edition scenery and logos are separate content and remain visible. */\n[data-theme-styled='true'] .menu-scene[data-backdrop='interface'] {\n  background: var(--iw-ink);\n}\n[data-theme-styled='true']\n  .menu-scene[data-backdrop='interface']\n  > :where(.menu-scene-art-plane, .menu-scene-signal) {\n  display: none;\n}\n[data-theme-styled='true'] .menu-scene[data-backdrop='interface']::before {\n  content: '';\n  position: absolute;\n  inset: var(--ui-scene-inset);\n  inline-size: var(--ui-scene-width);\n  block-size: var(--ui-scene-height);\n  pointer-events: none;\n  background-image: var(--ui-scene-motif, none);\n  background-size: var(--ui-scene-motif-size, 48px 48px);\n  background-position: right top;\n  background-repeat: var(--ui-scene-repeat);\n  opacity: var(--ui-scene-opacity);\n}\n[data-theme-material='linen'] {\n  --ui-scene-motif: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='64' height='64' shape-rendering='crispEdges'%3E%3Cg fill='none' stroke='%23f48686' stroke-width='2'%3E%3Cpath d='M32 10l22 22-22 22L10 32zM24 24l16 16m0-16L24 40'/%3E%3C/g%3E%3Cpath fill='%23e1ddcf' d='M0 0h2v2H0zm62 0h2v2h-2zM0 62h2v2H0zm62 0h2v2h-2z'/%3E%3C/svg%3E\");\n  --ui-scene-motif-size: 64px 64px;\n}\n[data-theme-material='porcelain'] {\n  --ui-scene-motif: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='96'%3E%3Cg fill='none' stroke='%230057b7'%3E%3Cpath d='M-30 24q30-28 60 0t60 0t60 0M-30 72q30-28 60 0t60 0t60 0'/%3E%3Cpath d='M60 30q-12 10 0 20q12-10 0-20m0 20v8'/%3E%3C/g%3E%3C/svg%3E\");\n  --ui-scene-motif-size: 120px 96px;\n}\n[data-theme-material='brass'],\n[data-theme-material='copper'] {\n  --ui-scene-motif:\n    repeating-linear-gradient(90deg, transparent 0 95px, var(--iw-line) 95px 96px),\n    repeating-linear-gradient(0deg, transparent 0 95px, var(--iw-line) 95px 96px);\n  --ui-scene-motif-size: 96px 96px;\n}\n[data-theme-material='wood'] {\n  --ui-scene-motif:\n    repeating-linear-gradient(\n      0deg,\n      transparent 0 7px,\n      var(--iw-line) 7px 8px,\n      transparent 8px 62px,\n      var(--iw-line) 62px 64px\n    ),\n    repeating-linear-gradient(90deg, transparent 0 191px, var(--iw-line) 191px 192px);\n  --ui-scene-motif-size: 192px 64px;\n}\n[data-theme-material='composite'] {\n  --ui-scene-motif:\n    linear-gradient(30deg, transparent 0 48%, var(--iw-accent) 49% 50%, transparent 51%),\n    linear-gradient(150deg, transparent 0 48%, var(--iw-line) 49% 50%, transparent 51%);\n  --ui-scene-motif-size: 96px 64px;\n}\n[data-theme-material='classic'],\n[data-theme-material='terminal'],\n[data-theme-material='lcd'] {\n  --ui-scene-motif: none;\n}\n[data-theme-material='classic'] .menu-scene[data-backdrop='interface']::after,\n[data-theme-material='terminal'] .menu-scene[data-backdrop='interface']::after,\n[data-theme-material='lcd'] .menu-scene[data-backdrop='interface']::after {\n  background: none;\n}\n[data-theme-texture='off'] {\n  --ui-scene-motif: none;\n}\n\n/* BEGIN ORIGINAL MATERIAL GRAIN — generated by scripts/refresh-interface-material-grain.mjs */\n[data-theme-family] {\n  --ui-grain-powder: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='128' shape-rendering='crispEdges'%3E%3Cpath fill='%23fff' opacity='.055' d='M68 16h2v1h-2zM166 44h2v1h-2zM150 5h2v1h-2zM69 90h1v1h-1zM154 30h2v1h-2zM113 37h1v1h-1zM101 58h1v1h-1zM167 80h1v1h-1zM131 76h1v1h-1zM81 23h2v1h-2zM58 109h2v1h-2zM167 78h2v1h-2zM183 84h2v1h-2zM17 46h2v1h-2zM141 20h2v1h-2zM30 100h2v1h-2zM21 69h1v1h-1zM94 102h1v1h-1zM66 101h1v1h-1zM109 34h2v1h-2zM143 6h2v1h-2zM14 89h1v1h-1zM8 100h2v1h-2zM25 29h1v1h-1zM173 68h1v1h-1zM144 79h1v1h-1zM38 28h2v1h-2zM102 90h2v1h-2zM49 26h2v1h-2zM9 40h1v1h-1zM186 17h2v1h-2zM175 119h1v1h-1zM154 115h1v1h-1zM101 3h1v1h-1zM173 62h1v1h-1zM29 13h1v1h-1zM17 79h2v1h-2zM117 41h2v1h-2zM145 20h2v1h-2zM176 86h1v1h-1zM46 56h2v1h-2zM137 82h2v1h-2zM157 96h1v1h-1zM186 84h1v1h-1zM160 6h1v1h-1zM96 33h2v1h-2zM90 123h2v1h-2zM131 110h2v1h-2zM152 119h2v1h-2zM150 92h1v1h-1zM178 69h2v1h-2zM151 21h1v1h-1zM110 12h2v1h-2zM76 31h1v1h-1zM116 63h2v1h-2zM160 2h1v1h-1z'/%3E%3Cpath fill='%23000' opacity='.09' d='M69 17h2v1h-2zM162 111h1v1h-1zM143 121h2v1h-2zM151 6h2v1h-2zM145 9h2v1h-2zM143 22h1v1h-1zM155 31h2v1h-2zM16 113h2v1h-2zM121 4h2v1h-2zM102 59h2v1h-2zM64 119h2v1h-2zM20 76h2v1h-2zM132 77h2v1h-2zM27 48h2v1h-2zM128 8h2v1h-2zM59 110h2v1h-2zM3 8h1v1h-1zM102 112h1v1h-1zM184 85h2v1h-2zM170 45h1v1h-1zM182 94h1v1h-1zM142 21h2v1h-2zM38 5h1v1h-1zM18 72h1v1h-1zM22 70h2v1h-2zM13 95h2v1h-2zM75 74h1v1h-1zM67 102h2v1h-2zM135 49h2v1h-2zM16 70h1v1h-1zM144 7h2v1h-2zM173 80h2v1h-2zM51 98h1v1h-1zM9 101h2v1h-2zM116 14h2v1h-2zM115 42h2v1h-2zM174 69h2v1h-2zM141 82h1v1h-1zM182 15h2v1h-2zM39 29h2v1h-2zM100 70h1v1h-1zM184 113h1v1h-1zM50 27h2v1h-2zM131 4h2v1h-2zM143 68h1v1h-1zM187 18h2v1h-2zM120 104h2v1h-2zM41 78h2v1h-2zM155 116h2v1h-2zM51 73h1v1h-1zM93 86h1v1h-1zM174 63h2v1h-2zM34 31h2v1h-2zM122 87h2v1h-2zM18 80h2v1h-2zM67 48h1v1h-1zM103 7h2v1h-2zM146 21h2v1h-2zM94 32h2v1h-2zM110 84h2v1h-2zM47 57h2v1h-2zM155 50h2v1h-2zM137 2h2v1h-2zM158 97h2v1h-2zM134 82h1v1h-1zM184 74h2v1h-2zM161 7h2v1h-2zM137 83h2v1h-2zM50 100h2v1h-2zM91 124h2v1h-2zM162 19h2v1h-2zM49 9h1v1h-1zM153 120h2v1h-2zM180 90h2v1h-2zM158 24h1v1h-1zM179 70h2v1h-2zM131 8h1v1h-1zM15 12h1v1h-1zM111 13h2v1h-2zM113 40h1v1h-1zM143 104h2v1h-2zM117 64h2v1h-2zM184 70h2v1h-2zM54 87h2v1h-2z'/%3E%3Cpath fill='%23000' opacity='.023' d='M132 15h18v2h-18zM134 17h15v2h-15zM121 51h9v2h-9zM123 53h6v2h-6zM111 13h6v2h-6zM113 15h3v2h-3zM14 91h12v2h-12zM16 93h9v2h-9zM65 54h16v2h-16zM67 56h13v2h-13zM64 17h13v2h-13zM66 19h10v2h-10zM68 93h7v2h-7zM70 95h4v2h-4zM141 56h15v2h-15zM143 58h12v2h-12zM28 11h18v2h-18zM30 13h15v2h-15zM141 81h18v2h-18zM143 83h15v2h-15zM153 15h14v2h-14zM155 17h11v2h-11zM134 60h8v2h-8zM136 62h5v2h-5zM90 108h17v2h-17zM92 110h14v2h-14zM146 27h17v2h-17zM148 29h14v2h-14zM22 77h17v2h-17zM24 79h14v2h-14zM152 86h10v2h-10zM154 88h7v2h-7zM94 5h9v2h-9zM96 7h6v2h-6zM147 6h11v2h-11zM149 8h8v2h-8z'/%3E%3C/svg%3E\");\n  --ui-grain-brush: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='96' shape-rendering='crispEdges'%3E%3Cpath fill='%23fff' opacity='.045' d='M99 35h13v1h-13zM120 79h20v1h-20zM90 63h30v1h-30zM108 57h19v1h-19zM91 60h33v1h-33zM127 70h29v1h-29zM28 81h6v1h-6zM141 88h23v1h-23zM75 28h6v1h-6zM138 54h21v1h-21zM37 68h26v1h-26zM37 32h22v1h-22zM118 72h33v1h-33z'/%3E%3Cpath fill='%23000' opacity='.055' d='M56 73h18v1h-18zM127 41h29v1h-29zM124 72h27v1h-27zM99 53h6v1h-6zM118 51h17v1h-17zM86 83h12v1h-12zM53 53h9v1h-9zM15 9h20v1h-20zM34 36h23v1h-23zM53 84h13v1h-13zM117 62h14v1h-14zM107 45h6v1h-6zM59 86h21v1h-21z'/%3E%3C/svg%3E\");\n  --ui-grain-thread: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48' shape-rendering='crispEdges'%3E%3Cpath fill='%23fff' opacity='.021' d='M0 0h2v1h-2zM4 0h1v3h-1zM8 0h3v1h-3zM12 0h1v3h-1zM16 0h3v1h-3zM20 0h1v3h-1zM24 0h3v1h-3zM28 0h1v3h-1zM32 0h3v1h-3zM36 0h1v3h-1zM40 0h3v1h-3zM44 0h1v2h-1zM0 4h1v3h-1zM4 4h3v1h-3zM8 4h1v3h-1zM12 4h3v1h-3zM16 4h1v2h-1zM20 4h3v1h-3zM24 4h1v2h-1zM28 4h3v1h-3zM32 4h1v2h-1zM36 4h3v1h-3zM40 4h1v2h-1zM44 4h3v1h-3zM0 8h3v1h-3zM4 8h1v2h-1zM8 8h3v1h-3zM12 8h1v2h-1zM16 8h3v1h-3zM20 8h1v2h-1zM24 8h3v1h-3zM28 8h1v3h-1zM32 8h3v1h-3zM36 8h1v3h-1zM40 8h3v1h-3zM44 8h1v3h-1zM0 12h1v3h-1zM4 12h3v1h-3zM8 12h1v3h-1zM12 12h3v1h-3zM16 12h1v3h-1zM20 12h3v1h-3zM24 12h1v3h-1zM28 12h3v1h-3zM32 12h1v3h-1zM36 12h2v1h-2zM40 12h1v3h-1zM44 12h2v1h-2zM0 16h3v1h-3zM4 16h1v3h-1zM8 16h2v1h-2zM12 16h1v3h-1zM16 16h2v1h-2zM20 16h1v3h-1zM24 16h2v1h-2zM28 16h1v3h-1zM32 16h2v1h-2zM36 16h1v3h-1zM40 16h2v1h-2zM44 16h1v3h-1zM0 20h1v3h-1zM4 20h2v1h-2zM8 20h1v3h-1zM12 20h2v1h-2zM16 20h1v3h-1zM20 20h3v1h-3zM24 20h1v3h-1zM28 20h3v1h-3zM32 20h1v3h-1zM36 20h3v1h-3zM40 20h1v3h-1zM44 20h3v1h-3zM0 24h3v1h-3zM4 24h1v3h-1zM8 24h3v1h-3zM12 24h1v3h-1zM16 24h3v1h-3zM20 24h1v3h-1zM24 24h3v1h-3zM28 24h1v2h-1zM32 24h3v1h-3zM36 24h1v2h-1zM40 24h3v1h-3zM44 24h1v2h-1zM0 28h1v2h-1zM4 28h3v1h-3zM8 28h1v2h-1zM12 28h3v1h-3zM16 28h1v2h-1zM20 28h3v1h-3zM24 28h1v2h-1zM28 28h3v1h-3zM32 28h1v2h-1zM36 28h3v1h-3zM40 28h1v3h-1zM44 28h3v1h-3zM0 32h3v1h-3zM4 32h1v2h-1zM8 32h3v1h-3zM12 32h1v3h-1zM16 32h3v1h-3zM20 32h1v3h-1zM24 32h3v1h-3zM28 32h1v3h-1zM32 32h3v1h-3zM36 32h1v3h-1zM40 32h3v1h-3zM44 32h1v3h-1zM0 36h1v3h-1zM4 36h3v1h-3zM8 36h1v3h-1zM12 36h3v1h-3zM16 36h1v3h-1zM20 36h2v1h-2zM24 36h1v3h-1zM28 36h2v1h-2zM32 36h1v3h-1zM36 36h2v1h-2zM40 36h1v3h-1zM44 36h2v1h-2zM0 40h2v1h-2zM4 40h1v3h-1zM8 40h2v1h-2zM12 40h1v3h-1zM16 40h2v1h-2zM20 40h1v3h-1zM24 40h2v1h-2zM28 40h1v3h-1zM32 40h3v1h-3zM36 40h1v3h-1zM40 40h3v1h-3zM44 40h1v3h-1zM0 44h1v3h-1zM4 44h3v1h-3zM8 44h1v3h-1zM12 44h3v1h-3zM16 44h1v3h-1zM20 44h3v1h-3zM24 44h1v3h-1zM28 44h3v1h-3zM32 44h1v3h-1zM36 44h3v1h-3zM40 44h1v2h-1zM44 44h3v1h-3z'/%3E%3Cpath fill='%23000' opacity='.065' d='M2 2h1v2h-1zM6 2h2v1h-2zM10 2h1v2h-1zM14 2h2v1h-2zM18 2h1v2h-1zM22 2h2v1h-2zM26 2h1v2h-1zM30 2h2v1h-2zM34 2h1v2h-1zM38 2h2v1h-2zM42 2h1v2h-1zM46 2h2v1h-2zM2 6h2v1h-2zM6 6h1v2h-1zM10 6h2v1h-2zM14 6h1v2h-1zM18 6h2v1h-2zM22 6h1v2h-1zM26 6h2v1h-2zM30 6h1v2h-1zM34 6h2v1h-2zM38 6h1v2h-1zM42 6h2v1h-2zM46 6h1v2h-1zM2 10h1v2h-1zM6 10h2v1h-2zM10 10h1v2h-1zM14 10h2v1h-2zM18 10h1v2h-1zM22 10h2v1h-2zM26 10h1v2h-1zM30 10h2v1h-2zM34 10h1v2h-1zM38 10h2v1h-2zM42 10h1v2h-1zM46 10h2v1h-2zM2 14h2v1h-2zM6 14h1v2h-1zM10 14h2v1h-2zM14 14h1v2h-1zM18 14h2v1h-2zM22 14h1v2h-1zM26 14h2v1h-2zM30 14h1v2h-1zM34 14h2v1h-2zM38 14h1v2h-1zM42 14h2v1h-2zM46 14h1v2h-1zM2 18h1v2h-1zM6 18h2v1h-2zM10 18h1v2h-1zM14 18h2v1h-2zM18 18h1v2h-1zM22 18h2v1h-2zM26 18h1v2h-1zM30 18h2v1h-2zM34 18h1v2h-1zM38 18h2v1h-2zM42 18h1v2h-1zM46 18h2v1h-2zM2 22h2v1h-2zM6 22h1v2h-1zM10 22h2v1h-2zM14 22h1v2h-1zM18 22h2v1h-2zM22 22h1v2h-1zM26 22h2v1h-2zM30 22h1v2h-1zM34 22h2v1h-2zM38 22h1v2h-1zM42 22h2v1h-2zM46 22h1v2h-1zM2 26h1v2h-1zM6 26h2v1h-2zM10 26h1v2h-1zM14 26h2v1h-2zM18 26h1v2h-1zM22 26h2v1h-2zM26 26h1v2h-1zM30 26h2v1h-2zM34 26h1v2h-1zM38 26h2v1h-2zM42 26h1v2h-1zM46 26h2v1h-2zM2 30h2v1h-2zM6 30h1v2h-1zM10 30h2v1h-2zM14 30h1v2h-1zM18 30h2v1h-2zM22 30h1v2h-1zM26 30h2v1h-2zM30 30h1v2h-1zM34 30h2v1h-2zM38 30h1v2h-1zM42 30h2v1h-2zM46 30h1v2h-1zM2 34h1v2h-1zM6 34h2v1h-2zM10 34h1v2h-1zM14 34h2v1h-2zM18 34h1v2h-1zM22 34h2v1h-2zM26 34h1v2h-1zM30 34h2v1h-2zM34 34h1v2h-1zM38 34h2v1h-2zM42 34h1v2h-1zM46 34h2v1h-2zM2 38h2v1h-2zM6 38h1v2h-1zM10 38h2v1h-2zM14 38h1v2h-1zM18 38h2v1h-2zM22 38h1v2h-1zM26 38h2v1h-2zM30 38h1v2h-1zM34 38h2v1h-2zM38 38h1v2h-1zM42 38h2v1h-2zM46 38h1v2h-1zM2 42h1v2h-1zM6 42h2v1h-2zM10 42h1v2h-1zM14 42h2v1h-2zM18 42h1v2h-1zM22 42h2v1h-2zM26 42h1v2h-1zM30 42h2v1h-2zM34 42h1v2h-1zM38 42h2v1h-2zM42 42h1v2h-1zM46 42h2v1h-2zM2 46h2v1h-2zM6 46h1v2h-1zM10 46h2v1h-2zM14 46h1v2h-1zM18 46h2v1h-2zM22 46h1v2h-1zM26 46h2v1h-2zM30 46h1v2h-1zM34 46h2v1h-2zM38 46h1v2h-1zM42 46h2v1h-2zM46 46h1v2h-1z'/%3E%3Cpath fill='%23fff' opacity='.018' d='M1 0h2v1h-2zM21 8h1v2h-1zM41 16h2v1h-2zM13 20h2v1h-2zM33 28h1v2h-1zM5 32h1v2h-1zM25 40h2v1h-2z'/%3E%3C/svg%3E\");\n  --ui-grain-glaze: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='192' shape-rendering='crispEdges'%3E%3Cpath fill='%23183858' opacity='.045' d='M19 27h1v1h-1zM107 68h1v1h-1zM214 21h1v1h-1zM64 143h1v1h-1zM182 155h1v1h-1zM236 108h1v1h-1z'/%3E%3Cpath fill='%23fff' opacity='.18' d='M20 28h1v1h-1zM108 69h1v1h-1zM215 22h1v1h-1zM65 144h1v1h-1zM183 156h1v1h-1zM237 109h1v1h-1z'/%3E%3C/svg%3E\");\n  --ui-grain-timber: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='128' shape-rendering='crispEdges'%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='.045' d='M81 15h9v3h17v3h13v2h14v1h7v-1h8v-2h10v-3h13v-3h11v-3'/%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='.045' d='M15 105h17v-1h9v-1h8v-1h15v0h17v0h7v1h12v1h10v1'/%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='.045' d='M73 99h14v1h13v1h10v1h15v1h9v0'/%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='.045' d='M64 18h13v1h11v2h16v3'/%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='.045' d='M25 7h16v-1h16v-1h17v0h17v1h17v1h15v1h9v0h15v0h14v-1h8v-1h16v-1'/%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='.045' d='M60 25h15v0h12v1h15v1h13v1h12v1h14v0'/%3E%3Cpath fill='none' stroke='%23000' stroke-opacity='.045' d='M25 79h17v-3h17v-2h8v0h8v1h12v2'/%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='.028' d='M68 13h7v0h15v1h9v1h7v1h15v1h7v0h8v0h6v0'/%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='.028' d='M35 90h12v-3h6v-1h10v-1h8v1h10v2h13v3h14v3h7v2h8v2'/%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='.028' d='M13 94h16v-1h11v-1h6v-1h9v-1h6v0h10v0h16v1h7v1h15v1'/%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='.028' d='M51 100h12v0h8v0h8v1h10v1'/%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='.028' d='M55 83h6v0h11v0h10v2h17v3h7v3h11v2h15v1h17v-1h13v-3h6v-3'/%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='.028' d='M26 82h10v-1h15v-1h11v0h12v0h16v1h13v1h10v1'/%3E%3Cpath fill='none' stroke='%23fff' stroke-opacity='.028' d='M35 28h9v-1h9v-1h14v0h13v0'/%3E%3C/svg%3E\");\n  --ui-grain-stone: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='128' shape-rendering='crispEdges'%3E%3Cpath fill='%23fff' opacity='.028' d='M18 33h6v1h2v1h-7v-1h-1zM160 72h6v2h-6zM145 100h4v1h-4zM94 118h3v1h2v1h-4v-1h-1zM62 19h5v1h-5zM147 18h3v1h-3zM85 59h3v1h2v1h-4v-1h-1zM121 47h5v2h-5zM95 56h2v2h-2zM54 77h6v1h2v1h-7v-1h-1zM115 4h3v2h-3zM50 21h5v1h-5zM126 95h6v1h2v1h-7v-1h-1zM127 90h5v2h-5zM159 21h2v2h-2zM153 89h5v1h2v1h-6v-1h-1z'/%3E%3Cpath fill='%23000' opacity='.04' d='M146 23h2v2h-2zM179 84h3v1h2v1h-4v-1h-1zM12 16h5v2h-5zM151 77h5v1h-5zM31 104h5v1h2v1h-6v-1h-1zM137 43h5v1h-5zM70 81h5v2h-5zM124 10h6v1h2v1h-7v-1h-1zM20 118h4v2h-4zM90 69h6v2h-6zM118 30h3v1h2v1h-4v-1h-1zM36 86h2v2h-2zM82 103h4v1h-4zM61 16h3v1h2v1h-4v-1h-1zM115 58h2v1h-2zM106 98h3v2h-3z'/%3E%3C/svg%3E\");\n  --ui-grain-fiber: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='192' height='128' shape-rendering='crispEdges'%3E%3Cpath fill='%23fff' opacity='.035' d='M137 49h8v1h-3v1h-2v-1h-2zM81 29h6v1h-3v1h-2v-1h-2zM82 31h3v1h-3v1h-2v-1h-2zM54 100h9v1h-3v1h-2v-1h-2zM114 57h4v1h-3v1h-2v-1h-2zM145 26h9v1h-3v1h-2v-1h-2zM129 105h8v1h-3v1h-2v-1h-2zM84 63h3v1h-3v1h-2v-1h-2zM37 44h9v1h-3v1h-2v-1h-2zM136 106h5v1h-3v1h-2v-1h-2zM142 46h8v1h-3v1h-2v-1h-2zM33 60h6v1h-3v1h-2v-1h-2zM16 13h3v1h-3v1h-2v-1h-2z'/%3E%3Cpath fill='%23000' opacity='.033' d='M108 55h4v1h-3v1h-2v-1h-2zM80 108h3v1h-3v1h-2v-1h-2zM36 44h8v1h-3v1h-2v-1h-2zM35 84h4v1h-3v1h-2v-1h-2zM39 91h5v1h-3v1h-2v-1h-2zM83 46h8v1h-3v1h-2v-1h-2zM134 114h9v1h-3v1h-2v-1h-2zM81 45h4v1h-3v1h-2v-1h-2zM75 15h9v1h-3v1h-2v-1h-2zM42 34h4v1h-3v1h-2v-1h-2zM156 90h4v1h-3v1h-2v-1h-2zM89 27h8v1h-3v1h-2v-1h-2z'/%3E%3C/svg%3E\");\n  --ui-grain-machining: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='128' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' opacity='.075' d='M12 18h34v1H12zM91 43h19v1H91zM164 12h47v1h-47zM37 95h31v1H37zM146 103h18v1h-18zM208 74h26v1h-26zM118 65h8v1h-8zM68 28h6v1h-6z'/%3E%3Cpath fill='%23fff' opacity='.045' d='M13 19h30v1H13zM92 44h16v1H92zM167 13h40v1h-40zM39 96h26v1H39zM147 104h15v1h-15zM209 75h22v1h-22z'/%3E%3C/svg%3E\");\n  --ui-grain-edge-wear: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='6' shape-rendering='crispEdges'%3E%3Cpath fill='%23fff' opacity='.20' d='M7 1h12v1H7zM42 2h5v1h-5zM76 1h17v1H76zM111 2h8v1h-8z'/%3E%3Cpath fill='%23000' opacity='.26' d='M8 2h9v1H8zM42 3h4v1h-4zM78 2h13v1H78zM111 3h6v1h-6z'/%3E%3C/svg%3E\");\n  --ui-grain-vent: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='8' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' opacity='.45' d='M4 2h3v4h-3zM10 2h3v4h-3zM16 2h3v4h-3zM22 2h3v4h-3zM28 2h3v4h-3zM34 2h3v4h-3zM40 2h3v4h-3zM46 2h3v4h-3zM52 2h3v4h-3zM58 2h3v4h-3zM64 2h3v4h-3zM70 2h3v4h-3zM76 2h3v4h-3zM82 2h3v4h-3zM88 2h3v4h-3z'/%3E%3Cpath fill='%23fff' opacity='.14' d='M4 6h3v1h-3zM10 6h3v1h-3zM16 6h3v1h-3zM22 6h3v1h-3zM28 6h3v1h-3zM34 6h3v1h-3zM40 6h3v1h-3zM46 6h3v1h-3zM52 6h3v1h-3zM58 6h3v1h-3zM64 6h3v1h-3zM70 6h3v1h-3zM76 6h3v1h-3zM82 6h3v1h-3zM88 6h3v1h-3z'/%3E%3C/svg%3E\");\n  --ui-grain-bulkhead: url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='256' height='192' shape-rendering='crispEdges'%3E%3Cpath fill='%23000' opacity='.42' d='M0 0h256v2H0zM0 2h2v190H0z'/%3E%3Cpath fill='%23fff' opacity='.07' d='M2 2h254v1H2zM2 3h1v189H2z'/%3E%3Cpath fill='%23000' opacity='.32' d='M9 9h6v6H9zM241 9h6v6h-6zM9 177h6v6H9zM241 177h6v6h-6z'/%3E%3Cpath fill='%23fff' opacity='.12' d='M10 10h4v1h-4zM242 10h4v1h-4zM10 178h4v1h-4zM242 178h4v1h-4z'/%3E%3Cpath fill='%23fff' opacity='.055' d='M34 3h26v1H34zM186 3h39v1h-39zM3 88h1v12H3z'/%3E%3C/svg%3E\");\n}\n/* END ORIGINAL MATERIAL GRAIN */\n\n/* Material finishes are independent of the immutable asset frames. The opaque\n   semantic base always supplies the text/state pair; these original, static\n   layers add restrained grain across the face and stronger light at its edges.\n   Grain is not stretched nine-slice art: it contains no screws, seams or labels. */\n@media (forced-colors: none) {\n  [data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-control-finish: linear-gradient(180deg, #ffffff0a, transparent 22%, #00000008);\n    --ui-active-finish: linear-gradient(180deg, #00000008, transparent 40%, #ffffff08);\n    --ui-inset-finish: linear-gradient(180deg, #00000012, transparent 12px);\n    --ui-inset-depth: inset 0 2px 3px #0005, inset 0 -1px 0 #ffffff0c;\n    --ui-toolbar-finish: linear-gradient(180deg, #ffffff08, transparent 8px, #00000008);\n    --ui-action-depth: inset 1px 1px 0 #ffffff20, inset -1px -1px 0 #0005, 0 2px 0 var(--ui-shadow);\n    --ui-hover-depth:\n      inset 0 0 0 1px var(--iw-accent), inset 0 2px 0 #ffffff20, 0 2px 0 var(--ui-shadow);\n    --ui-pressed-depth: inset 0 2px 3px #0005, inset 0 -1px 0 #ffffff14;\n    --ui-selected-depth: inset 3px 0 var(--iw-focus), inset 0 1px 0 #ffffff18, inset 0 -2px 0 #0003;\n    --ui-gallery-depth: var(--ui-action-depth);\n  }\n\n  /* Steel: powder-coated face, rolled edge, dark socket and amber activation.\n     Four riveted corners belong to frames; wear never crosses the label. */\n  :is(\n      [data-theme-material='steel'],\n      [data-theme-material='industrial-workshop']\n    )[data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-loading-rail: 7px;\n    --ui-grain:\n      var(--ui-grain-machining) 0 0 / 256px 128px repeat,\n      var(--ui-grain-powder) 17px 11px / 192px 128px repeat;\n    --ui-panel-finish:\n      var(--ui-grain-vent) right 18px top 7px / 96px 8px no-repeat,\n      var(--ui-grain-edge-wear) left 14px top 2px / 128px 6px repeat-x, var(--ui-grain),\n      linear-gradient(180deg, #ffffff18, transparent 7px, transparent calc(100% - 5px), #00000025);\n    --ui-control-finish:\n      var(--ui-grain-edge-wear) left 14px top 1px / 128px 6px repeat-x, var(--ui-grain),\n      linear-gradient(90deg, #ffffff14, transparent 4px, transparent calc(100% - 4px), #00000020),\n      linear-gradient(\n        180deg,\n        #ffffff38 0 1px,\n        #ffffff14 1px 3px,\n        transparent 6px,\n        transparent calc(100% - 5px),\n        #00000035 calc(100% - 2px),\n        #00000050\n      );\n    --ui-active-finish:\n      var(--ui-grain-edge-wear) left 14px bottom 1px / 128px 6px repeat-x, var(--ui-grain),\n      linear-gradient(180deg, #00000022, transparent 3px, transparent calc(100% - 2px), #ffffff20);\n    --ui-inset-finish:\n      var(--ui-grain-powder) 41px 27px / 192px 128px repeat,\n      linear-gradient(180deg, #00000048, transparent 6px, transparent calc(100% - 2px), #ffffff10);\n    --ui-toolbar-finish:\n      var(--ui-grain-edge-wear) left 14px top 1px / 128px 6px repeat-x, var(--ui-grain),\n      linear-gradient(180deg, #ffffff28, transparent 4px, transparent calc(100% - 4px), #00000025);\n    --ui-thumb-finish:\n      repeating-linear-gradient(90deg, transparent 0 3px, #0006 3px 4px, #fff4 4px 5px) center /\n        15px 60% no-repeat,\n      linear-gradient(180deg, #fff3, transparent 3px, transparent calc(100% - 3px), #0003);\n    --ui-panel-frame: var(--iw-material-panel) 6 / 6px / 0 repeat;\n    --ui-raised-frame: var(--iw-material-raised) 6 / 6px / 0 repeat;\n    --ui-primary-frame: var(--iw-material-primary) 6 / 6px / 0 repeat;\n    --ui-hover-frame: var(--ui-primary-frame);\n    --ui-hover-face: var(--iw-accent);\n    --ui-hover-ink: var(--iw-on-accent);\n    --ui-panel-depth:\n      inset 1px 1px 0 #ffffff18, inset -1px -2px 0 #0008, 0 0 0 1px #0007, 0 4px 0 var(--ui-shadow),\n      0 16px 28px #0006;\n    --ui-action-depth:\n      inset 0 2px 0 #ffffff25, inset 2px 0 0 #ffffff12, inset 0 -3px 0 #0006, inset -2px 0 0 #0003,\n      0 0 0 1px #0008, 0 4px 0 var(--ui-shadow), 0 5px 0 #0003;\n    --ui-hover-depth:\n      inset 0 2px 0 #ffffff65, inset 2px 0 0 #ffffff35, inset 0 -3px 0 #0005, inset -2px 0 0 #0002,\n      0 0 0 1px #0008, 0 4px 0 var(--ui-shadow),\n      0 0 6px color-mix(in srgb, var(--iw-accent) 18%, transparent);\n    --ui-pressed-depth:\n      inset 0 3px 4px #0006, inset 2px 0 0 #0003, inset 0 -1px 0 #ffffff50, 0 0 0 1px #0009,\n      0 1px 0 var(--ui-shadow);\n    --ui-selected-depth:\n      inset 0 2px 0 #ffffff45, inset 3px 0 0 #ffffff30, inset 0 -2px 0 #0004, 0 0 0 1px #0008,\n      0 2px 0 var(--ui-shadow);\n    --ui-inset-depth:\n      inset 0 3px 4px #0007, inset 1px 0 0 #0006, inset 0 -1px 0 #ffffff1c, 0 1px 0 #ffffff10;\n    --ui-scene-inset: 0;\n    --ui-scene-width: auto;\n    --ui-scene-height: auto;\n    --ui-scene-motif:\n      linear-gradient(\n        135deg,\n        transparent 35%,\n        color-mix(in srgb, var(--iw-accent) 7%, transparent)\n      ),\n      var(--ui-grain-bulkhead), var(--ui-grain-machining);\n    --ui-scene-motif-size: 100% 100%, 256px 192px, 256px 128px;\n    --ui-scene-repeat: no-repeat, repeat, repeat;\n    --ui-scene-opacity: 0.8;\n  }\n\n  /* Cloth keeps its stitches on the panel seam. Buttons are woven fabric,\n     never embroidered borders repeated through every navigation row. */\n  [data-theme-material='linen'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-weave: var(--ui-grain-thread) 1px 1px / 48px 48px repeat;\n    --ui-panel-finish:\n      repeating-linear-gradient(\n          90deg,\n          color-mix(in srgb, var(--iw-accent) 48%, transparent) 0 3px,\n          transparent 3px 9px\n        )\n        left 12px top 3px / calc(100% - 24px) 2px no-repeat,\n      var(--ui-weave), linear-gradient(180deg, #ffffff06, transparent 72px);\n    --ui-toolbar-finish: var(--ui-weave);\n    --ui-panel-depth:\n      inset 0 2px 0 color-mix(in srgb, var(--iw-accent) 65%, transparent),\n      inset 0 -1px 0 color-mix(in srgb, var(--iw-accent) 32%, transparent), 0 6px 14px #0004;\n    --ui-inset-finish: var(--ui-weave), linear-gradient(180deg, #00000024, transparent 5px);\n  }\n\n  /* Glaze and paper have different grain. Both keep their clean edge relief;\n     material identity is declared on this scope, including custom themes. */\n  [data-theme-material='porcelain'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-ceramic: var(--ui-grain-glaze) 0 0 / 256px 192px repeat;\n  }\n  [data-theme-material='sakura'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-ceramic: var(--ui-grain-fiber) 0 0 / 192px 128px repeat;\n  }\n  /* Porcelain: a glazed face and cobalt double lip. Sakura is warmer satin. */\n  :is(\n      [data-theme-material='porcelain'],\n      [data-theme-material='sakura']\n    )[data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish: var(--ui-ceramic), linear-gradient(180deg, #ffffff30, transparent 9px);\n    --ui-control-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #ffffff80, transparent 4px, transparent calc(100% - 4px), #00000015);\n    --ui-toolbar-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #ffffff30, transparent 4px, transparent calc(100% - 4px), #00000009);\n    --ui-panel-depth:\n      inset 0 0 0 2px color-mix(in srgb, var(--iw-accent) 24%, transparent),\n      inset 0 0 0 5px #ffffff24, 0 4px 0 color-mix(in srgb, var(--iw-line) 28%, transparent),\n      0 8px 18px #0001;\n    --ui-action-depth:\n      inset 0 2px 0 #ffffff80, inset 0 -2px 0 #00000018,\n      0 2px 0 color-mix(in srgb, var(--iw-line) 40%, transparent);\n    --ui-hover-depth:\n      inset 0 0 0 1px var(--iw-accent), inset 0 2px 0 #ffffff80,\n      0 2px 0 color-mix(in srgb, var(--iw-accent) 45%, transparent);\n    --ui-active-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #00000022, transparent 3px, transparent calc(100% - 2px), #ffffff20);\n    --ui-inset-finish: var(--ui-ceramic), linear-gradient(180deg, #00000012, transparent 4px);\n    --ui-pressed-depth: inset 0 2px 0 #00000028, inset 0 -1px 0 #ffffff70;\n  }\n  [data-theme-material='sakura'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish: var(--ui-ceramic), linear-gradient(180deg, #ffffff18, transparent 6px);\n    --ui-panel-depth:\n      inset 0 2px 0 color-mix(in srgb, var(--iw-accent) 42%, transparent), inset 0 -1px 0 #00000015,\n      0 4px 14px #0001;\n  }\n\n  /* Enamel and instrument copper: hairline inlays, directional satin, no\n     repeated chevrons. Obsidian overrides the enamel with cut stone below. */\n  :is(\n      [data-theme-material='brass'],\n      [data-theme-material='copper']\n    )[data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish: var(--ui-metal), linear-gradient(180deg, #ffffff08, transparent 8px);\n    --ui-control-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff30, transparent 4px, transparent calc(100% - 4px), #00000030);\n    --ui-toolbar-finish: var(--ui-metal);\n    --ui-panel-depth:\n      inset 0 1px 0 color-mix(in srgb, var(--iw-accent) 45%, transparent),\n      inset 0 0 0 4px #00000018,\n      inset 0 -1px 0 color-mix(in srgb, var(--iw-accent) 22%, transparent),\n      0 4px 0 var(--ui-shadow), 0 10px 20px #0003;\n    --ui-hover-depth:\n      inset 0 2px 0 var(--iw-accent), inset 0 -1px 0 #0005, 0 2px 0 var(--ui-shadow);\n    --ui-metal: var(--ui-grain-powder) 9px 19px / 192px 128px repeat;\n    --ui-active-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #00000022, transparent 3px, transparent calc(100% - 2px), #ffffff20);\n    --ui-inset-finish: var(--ui-metal), linear-gradient(180deg, #00000030, transparent 5px);\n    --ui-pressed-depth: inset 0 2px 0 #0006, inset 0 -1px 0 #ffffff30;\n  }\n  [data-theme-material='copper'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-scene-motif: repeating-radial-gradient(\n      circle at 100% 0,\n      transparent 0 27px,\n      var(--iw-accent) 28px 29px,\n      transparent 30px 44px\n    );\n    --ui-scene-motif-size: 192px 96px;\n    --ui-metal: var(--ui-grain-brush) 0 0 / 192px 96px repeat;\n  }\n\n  /* Fine timber grain remains broad and sparse enough for small labels. */\n  [data-theme-material='wood'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-woodgrain: var(--ui-grain-timber) 11px 3px / 192px 128px repeat;\n    --ui-panel-finish: var(--ui-woodgrain), linear-gradient(180deg, #ffffff12, transparent 6px);\n    --ui-panel-depth:\n      inset 0 3px 0 #ffffff20, inset 0 -4px 0 #00000022, inset 2px 0 0 #ffffff10,\n      0 4px 0 color-mix(in srgb, var(--iw-line) 50%, transparent), 0 8px 16px #0002;\n    --ui-active-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #00000022, transparent 3px, transparent calc(100% - 2px), #ffffff20);\n    --ui-inset-finish: var(--ui-woodgrain), linear-gradient(180deg, #00000025, transparent 4px);\n    --ui-pressed-depth: inset 0 2px 0 #0005, inset 0 -1px 0 #ffffff20;\n  }\n  [data-theme-material='composite'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish:\n      var(--ui-composite),\n      linear-gradient(135deg, #ffffff20 0 5px, transparent 5px) top left / 18px 18px no-repeat;\n    --ui-panel-depth:\n      inset 2px 0 0 color-mix(in srgb, var(--iw-accent) 28%, transparent), inset 0 1px 0 #ffffff12,\n      inset 0 -2px 0 #0004, 0 4px 0 var(--ui-shadow), 0 10px 24px #0003;\n    --ui-composite: var(--ui-grain-stone) 0 0 / 192px 128px repeat;\n    --ui-active-finish:\n      var(--ui-composite),\n      linear-gradient(180deg, #00000022, transparent 3px, transparent calc(100% - 2px), #ffffff20);\n    --ui-inset-finish: var(--ui-composite), linear-gradient(180deg, #00000030, transparent 4px);\n    --ui-pressed-depth: inset 0 2px 0 #0005, inset 0 -1px 0 #ffffff25;\n  }\n  [data-theme-material='lcd'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish:\n      repeating-linear-gradient(0deg, transparent 0 3px, #00000003 3px 4px),\n      repeating-linear-gradient(90deg, transparent 0 3px, #00000003 3px 4px);\n    --ui-panel-depth:\n      inset 0 3px 5px #0003, inset 0 -2px 0 #ffffff35,\n      0 0 0 3px color-mix(in srgb, var(--iw-line) 25%, transparent);\n    --ui-active-finish: linear-gradient(\n      180deg,\n      #00000028,\n      transparent 3px,\n      transparent calc(100% - 2px),\n      #ffffff25\n    );\n    --ui-inset-finish:\n      repeating-linear-gradient(0deg, transparent 0 3px, #00000006 3px 4px),\n      repeating-linear-gradient(90deg, transparent 0 3px, #00000006 3px 4px);\n    --ui-pressed-depth: inset 0 2px 0 #0005, inset 0 -1px 0 #ffffff20;\n  }\n\n  /* These variants are resolved from the interface basis, including Studio\n     descendants, rather than testing the current campaign or family name. */\n  [data-theme-finish='ember-foundry'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-grain:\n      var(--ui-grain-stone) 0 0 / 192px 128px repeat,\n      var(--ui-grain-powder) 17px 11px / 192px 128px repeat;\n    --ui-panel-finish:\n      var(--ui-grain-vent) right 18px top 7px / 96px 8px no-repeat,\n      linear-gradient(90deg, var(--iw-accent), transparent) left 12px bottom 5px / 72px 2px\n        no-repeat,\n      var(--ui-grain),\n      linear-gradient(180deg, #ffffff12, transparent 6px, transparent calc(100% - 5px), #0005);\n    --ui-toolbar-finish:\n      var(--ui-grain-brush) 0 0 / 192px 96px repeat,\n      linear-gradient(180deg, #ffffff25, transparent 4px, transparent calc(100% - 4px), #0005);\n    --ui-panel-depth:\n      inset 1px 1px 0 #ffffff20, inset -2px -3px 0 #0009, 0 0 0 1px #0008, 0 5px 0 var(--ui-shadow),\n      0 16px 28px #0006;\n  }\n  [data-theme-finish='polar-relay'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-grain: var(--ui-grain-brush) 0 0 / 192px 96px repeat;\n    --ui-panel-finish:\n      var(--ui-grain-vent) right 18px top 7px / 96px 8px no-repeat,\n      linear-gradient(\n          90deg,\n          var(--iw-accent) 0 5px,\n          transparent 5px 9px,\n          var(--iw-accent) 9px 14px,\n          transparent 14px 18px,\n          var(--iw-accent) 18px 23px\n        )\n        left 14px top 8px / 23px 2px no-repeat,\n      var(--ui-grain),\n      linear-gradient(180deg, #ffffff20, transparent 8px, transparent calc(100% - 4px), #0004);\n    --ui-control-finish:\n      var(--ui-grain),\n      linear-gradient(90deg, #ffffff18, transparent 3px, transparent calc(100% - 3px), #0003),\n      linear-gradient(\n        180deg,\n        #ffffff40 0 1px,\n        #ffffff12 1px 3px,\n        transparent 5px,\n        transparent calc(100% - 3px),\n        #0005\n      );\n    --ui-panel-depth:\n      inset 1px 1px 0 #ffffff30, inset -1px -2px 0 #0008, 0 0 0 1px #0007, 0 3px 0 var(--ui-shadow),\n      0 12px 24px #0005;\n  }\n  [data-theme-finish='obsidian-reliquary'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish:\n      var(--ui-metal),\n      linear-gradient(135deg, #ffffff20 0 8px, transparent 8px) top left / 24px 24px no-repeat,\n      linear-gradient(315deg, #0005 0 8px, transparent 8px) bottom right / 24px 24px no-repeat;\n    --ui-panel-depth:\n      inset 2px 2px 0 color-mix(in srgb, var(--iw-accent) 28%, transparent),\n      inset -3px -3px 0 #0006, 0 5px 0 var(--ui-shadow), 0 10px 20px #0005;\n    --ui-scene-motif: linear-gradient(\n      135deg,\n      transparent 42%,\n      var(--iw-accent) 43% 44%,\n      transparent 45% 52%,\n      var(--iw-accent) 53% 54%,\n      transparent 55%\n    );\n    --ui-scene-motif-size: 144px 96px;\n    --ui-metal: var(--ui-grain-stone) 23px 7px / 192px 128px repeat;\n    --ui-pressed-depth: inset 2px 2px 0 #0005, inset -1px -1px 0 #ffffff20;\n  }\n  [data-theme-finish='deep-space'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish: var(--ui-composite), linear-gradient(180deg, #ffffff18, transparent 4px);\n    --ui-panel-depth:\n      inset 0 2px 0 #ffffff18, inset 0 -3px 0 #0007, inset 3px 0 0 #0003, 0 3px 0 var(--ui-shadow),\n      0 8px 20px #0004;\n    --ui-scene-motif:\n      linear-gradient(0deg, transparent 0 46px, var(--iw-line) 46px 48px, transparent 48px),\n      linear-gradient(90deg, transparent 0 130px, var(--iw-accent) 130px 138px, transparent 138px);\n    --ui-scene-motif-size: 192px 96px;\n    --ui-composite: var(--ui-grain-brush) 23px 11px / 192px 96px repeat;\n  }\n  [data-theme-finish='moonlit-grove'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-woodgrain: var(--ui-grain-timber) 53px 47px / 192px 128px repeat;\n    --ui-panel-finish: var(--ui-woodgrain), linear-gradient(180deg, #ffffff12, transparent 6px);\n    --ui-panel-depth:\n      inset 1px 1px 0 #ffffff18, inset -2px -3px 0 #0006, 0 4px 0 var(--ui-shadow),\n      0 12px 24px #0003;\n    --ui-scene-motif:\n      radial-gradient(\n        ellipse at 75% 22%,\n        transparent 25px,\n        var(--iw-accent) 26px 28px,\n        transparent 29px\n      ),\n      linear-gradient(120deg, transparent 64%, var(--iw-line) 65% 66%, transparent 67%);\n    --ui-scene-motif-size: 144px 96px;\n  }\n\n  /* Texture-free systems still have intentional construction. Native desktop\n     bevels and terminal double rules are geometry, not decorative texture. */\n\n  [data-theme-material='terminal'][data-theme-contrast='normal'] {\n    --ui-hover-face: var(--iw-selection);\n    --ui-hover-ink: var(--iw-on-selection);\n  }\n}\n\n/* Material state finishes: grain belongs to the material, relief belongs to the\n   interaction. Faces remain quiet; focus, text and status colors retain their\n   semantic pairings. Existing steel recipes deliberately remain untouched. */\n@media (forced-colors: none) {\n  /* Woven patches compress rather than becoming metal plates. Red embroidery\n     remains on the existing outer panel seam, never on every button. */\n  [data-theme-material='linen'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-control-finish:\n      var(--ui-weave),\n      linear-gradient(180deg, #ffffff14, transparent 3px, transparent calc(100% - 3px), #0004);\n    --ui-hover-finish:\n      var(--ui-weave),\n      linear-gradient(180deg, #ffffff20, transparent 3px, transparent calc(100% - 3px), #0004);\n    --ui-active-finish:\n      var(--ui-weave),\n      linear-gradient(180deg, #0004, transparent 3px, transparent calc(100% - 2px), #ffffff18);\n    --ui-selected-finish:\n      var(--ui-weave),\n      linear-gradient(180deg, #ffffff18, transparent 2px, transparent calc(100% - 2px), #0003);\n    --ui-action-depth: inset 1px 1px 0 #ffffff16, inset -1px -1px 0 #0006, 0 2px 2px #0005;\n    --ui-hover-depth: inset 2px 0 0 currentColor, inset 0 1px 0 #ffffff25, 0 2px 3px #0005;\n    --ui-pressed-depth: inset 0 2px 3px #0006, inset 0 -1px 0 #ffffff20;\n    --ui-selected-depth: inset 2px 0 0 currentColor, inset 0 1px 0 #ffffff20, 0 1px 1px #0005;\n    --ui-inset-depth: inset 0 2px 3px #0007, inset 0 -1px 0 #ffffff14;\n    --ui-input-hover-depth: inset 0 2px 3px #0007, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish:\n      linear-gradient(90deg, transparent 0 44%, #0003 44% 48%, #ffffff25 48% 52%, transparent 52%)\n        center / 12px 65% no-repeat,\n      var(--ui-weave);\n  }\n\n  /* Glazed ceramic has a broad clean face with a hard rim and a small catch\n     light. The cobalt lip, not scratches, explains its construction. */\n  [data-theme-material='porcelain'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish:\n      var(--ui-ceramic),\n      linear-gradient(\n        180deg,\n        #ffffffb0 0 1px,\n        #ffffff45 1px 3px,\n        transparent 5px,\n        transparent calc(100% - 3px),\n        #00000018\n      );\n    --ui-hover-finish:\n      var(--ui-ceramic),\n      linear-gradient(\n        180deg,\n        #ffffffd0,\n        #ffffff50 2px,\n        transparent 5px,\n        transparent calc(100% - 3px),\n        #00000018\n      );\n    --ui-active-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #00000025, transparent 3px, transparent calc(100% - 2px), #ffffff60);\n    --ui-selected-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #ffffff55, transparent 3px, transparent calc(100% - 2px), #00000020);\n    --ui-action-depth:\n      inset 1px 1px 0 #ffffffa0, inset -1px -2px 0 #00000015,\n      0 2px 0 color-mix(in srgb, var(--iw-line) 45%, transparent), 0 3px 4px #0000000c;\n    --ui-hover-depth:\n      inset 0 0 0 1px currentColor, inset 0 2px 0 #ffffffb0,\n      0 2px 0 color-mix(in srgb, var(--iw-line) 55%, transparent), 0 3px 5px #00000012;\n    --ui-selected-depth: inset 0 1px 0 #ffffff65, inset 0 -2px 0 #0003, 0 1px 0 var(--ui-shadow);\n    --ui-inset-depth: inset 0 2px 3px #00000020, inset 0 -1px 0 #ffffffb0;\n    --ui-input-hover-depth: inset 0 2px 3px #00000020, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish:\n      linear-gradient(90deg, #ffffff90 0 1px, transparent 1px),\n      linear-gradient(180deg, #ffffff85, transparent 3px, transparent calc(100% - 2px), #0003);\n  }\n\n  /* Lacquered station signage: restrained satin, crisp printed edges and paper\n     fibers. It shares no glazed ceramic glare or industrial fasteners. */\n  [data-theme-material='sakura'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #ffffff65, transparent 2px, transparent calc(100% - 2px), #00000014);\n    --ui-hover-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #ffffff90, transparent 3px, transparent calc(100% - 2px), #00000016);\n    --ui-selected-finish:\n      var(--ui-ceramic),\n      linear-gradient(180deg, #ffffff30, transparent 2px, transparent calc(100% - 2px), #00000022);\n    --ui-toolbar-finish: var(--ui-ceramic), linear-gradient(180deg, #ffffff50, transparent 2px);\n    --ui-action-depth:\n      inset 0 1px 0 #ffffff80, inset 0 -1px 0 #00000016,\n      0 2px 0 color-mix(in srgb, var(--iw-line) 40%, transparent);\n    --ui-hover-depth:\n      inset 0 -2px 0 currentColor, inset 0 1px 0 #ffffff90,\n      0 2px 0 color-mix(in srgb, var(--iw-line) 45%, transparent);\n    --ui-pressed-depth: inset 0 2px 2px #00000025, inset 0 -1px 0 #ffffff50;\n    --ui-selected-depth: inset 0 -2px 0 currentColor, inset 0 1px 0 #ffffff35;\n    --ui-inset-depth: inset 0 1px 2px #00000024, inset 0 -1px 0 #ffffff70;\n    --ui-input-hover-depth: inset 0 1px 2px #00000024, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish: linear-gradient(\n      180deg,\n      #ffffff55,\n      transparent 2px,\n      transparent calc(100% - 2px),\n      #00000022\n    );\n  }\n\n  /* Enamel instrument keys sit in a brass surround. Edge highlights stop after\n     four pixels; there is no bright glaze crossing a label. */\n  [data-theme-material='brass'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish:\n      var(--ui-metal),\n      linear-gradient(\n        180deg,\n        #ffffff35 0 1px,\n        #ffffff14 1px 3px,\n        transparent 5px,\n        transparent calc(100% - 4px),\n        #0005\n      );\n    --ui-hover-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff50, transparent 4px, transparent calc(100% - 3px), #0005);\n    --ui-selected-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff45, transparent 3px, transparent calc(100% - 3px), #0004);\n    --ui-toolbar-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff20, transparent 3px, transparent calc(100% - 2px), #0004);\n    --ui-action-depth:\n      inset 1px 1px 0 #ffffff22, inset -1px -2px 0 #0006, 0 2px 0 var(--ui-shadow), 0 3px 3px #0003;\n    --ui-hover-depth:\n      inset 0 2px 0 currentColor, inset 1px 0 0 #ffffff20, inset 0 -2px 0 #0006,\n      0 2px 0 var(--ui-shadow);\n    --ui-selected-depth: inset 0 1px 0 #ffffff50, inset 0 -2px 0 #0004, 0 1px 0 var(--ui-shadow);\n    --ui-inset-depth: inset 0 3px 3px #0007, inset 0 -1px 0 #ffffff20;\n    --ui-input-hover-depth: inset 0 3px 3px #0007, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish:\n      linear-gradient(180deg, transparent 0 40%, #0005 40% 46%, #ffffff40 46% 52%, transparent 52%)\n        center / 65% 12px no-repeat,\n      linear-gradient(90deg, #ffffff45, transparent 3px, transparent calc(100% - 2px), #0004);\n  }\n\n  /* Brushed observatory controls have a narrow metal cap and a darker foot.\n     Directional grain is restrained and coherent with the instrument fascia. */\n  [data-theme-material='copper'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish:\n      var(--ui-metal),\n      linear-gradient(\n        180deg,\n        #ffffff45 0 1px,\n        #ffffff16 1px 3px,\n        transparent 5px,\n        transparent calc(100% - 4px),\n        #0005\n      );\n    --ui-hover-finish:\n      var(--ui-metal),\n      linear-gradient(\n        180deg,\n        #ffffff60 0 1px,\n        #ffffff25 1px 3px,\n        transparent 5px,\n        transparent calc(100% - 4px),\n        #0005\n      );\n    --ui-selected-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff45, transparent 3px, transparent calc(100% - 3px), #0004);\n    --ui-toolbar-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff20, transparent 3px, transparent calc(100% - 3px), #0004);\n    --ui-action-depth: inset 1px 1px 0 #ffffff28, inset -1px -2px 0 #0007, 0 3px 0 var(--ui-shadow);\n    --ui-hover-depth:\n      inset 0 1px 0 #ffffff60, inset 0 -2px 0 currentColor, 0 3px 0 var(--ui-shadow);\n    --ui-pressed-depth: inset 0 3px 3px #0007, inset 0 -1px 0 #ffffff35, 0 1px 0 #0005;\n    --ui-selected-depth: inset 0 1px 0 #ffffff45, inset 0 -2px 0 #0005, 0 1px 0 var(--ui-shadow);\n    --ui-inset-depth: inset 0 3px 4px #0007, inset 0 -1px 0 #ffffff20;\n    --ui-input-hover-depth: inset 0 3px 4px #0007, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish:\n      repeating-linear-gradient(90deg, transparent 0 3px, #0005 3px 4px, #ffffff35 4px 5px) center /\n        15px 55% no-repeat,\n      linear-gradient(180deg, #ffffff60, transparent 3px, transparent calc(100% - 2px), #0004);\n  }\n\n  /* Wood uses planed edges and quiet long fibers; a selected key feels like a\n     stained inlay rather than a metal switch. */\n  [data-theme-material='wood'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #ffffff40, transparent 3px, transparent calc(100% - 3px), #0000002a);\n    --ui-hover-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #ffffff60, transparent 3px, transparent calc(100% - 3px), #0000002a);\n    --ui-selected-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #00000022, transparent 2px, transparent calc(100% - 2px), #ffffff28);\n    --ui-toolbar-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #ffffff30, transparent 3px, transparent calc(100% - 3px), #00000020);\n    --ui-action-depth:\n      inset 1px 1px 0 #ffffff35, inset -1px -2px 0 #00000030,\n      0 3px 0 color-mix(in srgb, var(--iw-line) 60%, transparent);\n    --ui-hover-depth:\n      inset 0 2px 0 currentColor, inset 0 -2px 0 #00000030,\n      0 3px 0 color-mix(in srgb, var(--iw-line) 70%, transparent);\n    --ui-selected-depth: inset 0 2px 2px #0004, inset 0 -1px 0 #ffffff35, 0 1px 0 var(--ui-shadow);\n    --ui-inset-depth: inset 0 2px 3px #00000035, inset 0 -1px 0 #ffffff50;\n    --ui-input-hover-depth: inset 0 2px 3px #00000035, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #ffffff45, transparent 3px, transparent calc(100% - 2px), #0004);\n  }\n\n  /* Ruins use honed stone and small luminous edge inlays. Glow is an interaction\n     response and never sits behind type or repeats across every resting key. */\n  [data-theme-material='composite'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish:\n      var(--ui-composite),\n      linear-gradient(180deg, #ffffff25 0 1px, transparent 4px, transparent calc(100% - 3px), #0005);\n    --ui-hover-finish:\n      var(--ui-composite),\n      linear-gradient(180deg, #ffffff40, transparent 3px, transparent calc(100% - 3px), #0005);\n    --ui-selected-finish:\n      var(--ui-composite),\n      linear-gradient(180deg, #ffffff30, transparent 2px, transparent calc(100% - 2px), #0004);\n    --ui-toolbar-finish:\n      var(--ui-composite),\n      linear-gradient(180deg, #ffffff1a, transparent 3px, transparent calc(100% - 2px), #0004);\n    --ui-action-depth: inset 1px 1px 0 #ffffff1c, inset -1px -2px 0 #0006, 0 2px 0 var(--ui-shadow);\n    --ui-hover-depth:\n      inset 0 -2px 0 currentColor, inset 0 1px 0 #ffffff30, 0 2px 0 var(--ui-shadow),\n      0 2px 7px color-mix(in srgb, currentColor 12%, transparent);\n    --ui-selected-depth: inset 0 1px 0 #ffffff40, inset 0 -2px 0 #0004, 0 1px 0 var(--ui-shadow);\n    --ui-inset-depth: inset 0 2px 3px #0007, inset 0 -1px 0 #ffffff1c;\n    --ui-input-hover-depth: inset 0 2px 3px #0007, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish:\n      linear-gradient(180deg, #ffffff50, transparent 2px, transparent calc(100% - 2px), #0004),\n      linear-gradient(90deg, transparent 0 40%, #0004 40% 50%, transparent 50%) center / 10px 60%\n        no-repeat;\n  }\n\n  /* LCD controls are monochrome molded keys; the display pixel matrix stays\n     inside the recessed readout. No grain or fake bloom on text. */\n  [data-theme-material='lcd'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish: linear-gradient(\n      180deg,\n      #ffffff35,\n      transparent 2px,\n      transparent calc(100% - 3px),\n      #00000022\n    );\n    --ui-hover-finish: linear-gradient(\n      180deg,\n      #ffffff55,\n      transparent 2px,\n      transparent calc(100% - 3px),\n      #00000022\n    );\n    --ui-selected-finish: linear-gradient(\n      180deg,\n      #00000022,\n      transparent 2px,\n      transparent calc(100% - 2px),\n      #ffffff25\n    );\n    --ui-toolbar-finish: linear-gradient(\n      180deg,\n      #ffffff30,\n      transparent 2px,\n      transparent calc(100% - 2px),\n      #00000018\n    );\n    --ui-action-depth:\n      inset 1px 1px 0 #ffffff45, inset -1px -2px 0 #00000035,\n      0 2px 0 color-mix(in srgb, var(--iw-line) 70%, transparent);\n    --ui-hover-depth:\n      inset 0 0 0 1px currentColor, inset 0 1px 0 #ffffff45,\n      0 2px 0 color-mix(in srgb, var(--iw-line) 70%, transparent);\n    --ui-selected-depth: inset 0 2px 2px #0004, inset 0 -1px 0 #ffffff35;\n    --ui-inset-depth: inset 0 2px 3px #00000040, inset 0 -1px 0 #ffffff40;\n    --ui-input-hover-depth: inset 0 2px 3px #00000040, inset 0 -1px 0 var(--iw-control-line);\n    --ui-thumb-finish:\n      linear-gradient(180deg, #ffffff50, transparent 2px, transparent calc(100% - 2px), #0003),\n      linear-gradient(90deg, transparent 0 42%, #0004 42% 52%, transparent 52%) center / 10px 65%\n        no-repeat;\n  }\n\n  /* The variants inherit the full material contract but keep their own finish:\n     carved obsidian, anodized command consoles, and dark waxed timber. */\n  [data-theme-finish='obsidian-reliquary'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-control-finish:\n      var(--ui-metal), linear-gradient(135deg, #ffffff18 0 3px, transparent 3px),\n      linear-gradient(180deg, #ffffff20 0 2px, transparent 2px, transparent calc(100% - 3px), #0005);\n    --ui-hover-finish:\n      var(--ui-metal), linear-gradient(135deg, #ffffff30 0 3px, transparent 3px),\n      linear-gradient(180deg, #ffffff30 0 2px, transparent 3px, transparent calc(100% - 3px), #0005);\n    --ui-active-finish:\n      var(--ui-metal), linear-gradient(135deg, #0004 0 3px, transparent 3px),\n      linear-gradient(180deg, #0005, transparent 3px, transparent calc(100% - 2px), #ffffff25);\n    --ui-selected-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff30 0 2px, transparent 2px, transparent calc(100% - 2px), #0004);\n    --ui-toolbar-finish:\n      var(--ui-metal),\n      linear-gradient(180deg, #ffffff18 0 2px, transparent 2px, transparent calc(100% - 3px), #0005);\n    --ui-action-depth: inset 2px 2px 0 #ffffff18, inset -2px -2px 0 #0006, 0 3px 0 var(--ui-shadow);\n    --ui-hover-depth:\n      inset 2px 2px 0 currentColor, inset -2px -2px 0 #0007, 0 3px 0 var(--ui-shadow);\n    --ui-selected-depth:\n      inset 2px 2px 0 #ffffff35, inset -2px -2px 0 #0005, 0 1px 0 var(--ui-shadow);\n    --ui-thumb-finish:\n      linear-gradient(135deg, #ffffff40 0 3px, transparent 3px),\n      linear-gradient(180deg, #ffffff25, transparent 2px, transparent calc(100% - 2px), #0005);\n  }\n  [data-theme-finish='deep-space'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-control-finish:\n      var(--ui-composite),\n      linear-gradient(180deg, #ffffff30 0 1px, transparent 3px, transparent calc(100% - 3px), #0006);\n    --ui-hover-finish:\n      var(--ui-composite),\n      linear-gradient(180deg, #ffffff45, transparent 3px, transparent calc(100% - 3px), #0006);\n    --ui-action-depth: inset 0 1px 0 #ffffff25, inset 0 -2px 0 #0007, 0 2px 0 var(--ui-shadow);\n    --ui-hover-depth:\n      inset 0 -2px 0 currentColor, inset 0 1px 0 #ffffff40, 0 2px 0 var(--ui-shadow);\n    --ui-selected-depth: inset 0 1px 0 #ffffff40, inset 0 -2px 0 #0005, 0 1px 0 var(--ui-shadow);\n    --ui-thumb-finish:\n      linear-gradient(90deg, transparent 0 40%, #0006 40% 48%, #ffffff40 48% 56%, transparent 56%)\n        center / 12px 65% no-repeat,\n      linear-gradient(180deg, #ffffff55, transparent 2px, transparent calc(100% - 2px), #0005);\n  }\n  [data-theme-finish='moonlit-grove'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-control-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #ffffff25, transparent 3px, transparent calc(100% - 3px), #0005);\n    --ui-hover-finish:\n      var(--ui-woodgrain),\n      linear-gradient(180deg, #ffffff40, transparent 3px, transparent calc(100% - 3px), #0005);\n    --ui-action-depth: inset 1px 1px 0 #ffffff22, inset -1px -2px 0 #0006, 0 3px 0 var(--ui-shadow);\n    --ui-hover-depth: inset 0 2px 0 currentColor, inset 0 -2px 0 #0006, 0 3px 0 var(--ui-shadow);\n    --ui-selected-depth: inset 0 2px 2px #0005, inset 0 -1px 0 #ffffff30, 0 1px 0 var(--ui-shadow);\n    --ui-inset-depth: inset 0 2px 3px #0006, inset 0 -1px 0 #ffffff25;\n    --ui-input-hover-depth: inset 0 2px 3px #0006, inset 0 -1px 0 var(--iw-control-line);\n  }\n\n  /* Texture-free systems have structural states. These are not decoration and\n     remain when decorative detail is Off; high contrast has its own painter. */\n  [data-theme-material='classic'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-material-travel: 0 1px;\n    --ui-control-finish: none;\n    --ui-hover-finish: none;\n    --ui-active-finish: none;\n    --ui-selected-finish: none;\n    --ui-toolbar-finish: none;\n    --ui-thumb-finish: none;\n    --ui-panel-depth:\n      inset 1px 1px #fff, inset 2px 2px #dfdfdf, inset -1px -1px #000, inset -2px -2px #808080,\n      2px 2px 0 #0005;\n    --ui-action-depth:\n      inset 1px 1px #fff, inset 2px 2px #dfdfdf, inset -1px -1px #404040, inset -2px -2px #808080;\n    --ui-hover-depth: var(--ui-action-depth);\n    --ui-pressed-depth: inset 1px 1px #404040, inset 2px 2px #808080, inset -1px -1px #fff;\n    --ui-selected-depth: var(--ui-pressed-depth);\n    --ui-inset-depth: inset 1px 1px #808080, inset 2px 2px #404040, inset -1px -1px #fff;\n    --ui-input-hover-depth: var(--ui-inset-depth);\n    --ui-gallery-depth: var(--ui-action-depth);\n  }\n  [data-theme-material='terminal'][data-theme-contrast='normal'] {\n    --ui-control-finish: none;\n    --ui-hover-finish: none;\n    --ui-active-finish: none;\n    --ui-selected-finish: none;\n    --ui-inset-finish: none;\n    --ui-toolbar-finish: none;\n    --ui-thumb-finish: none;\n    --ui-panel-depth: inset 0 0 0 1px var(--iw-panel), inset 0 0 0 2px var(--iw-control-line);\n    --ui-action-depth: 0 0 0 0 transparent;\n    --ui-hover-depth: inset 2px 0 currentColor, inset -2px 0 currentColor;\n    --ui-pressed-depth: inset 0 0 0 1px currentColor;\n    --ui-selected-depth: inset 2px 0 currentColor, inset -2px 0 currentColor;\n    --ui-inset-depth: inset 0 -1px 0 var(--iw-control-line);\n    --ui-input-hover-depth: inset 0 -2px 0 var(--iw-control-line);\n    --ui-gallery-depth: none;\n  }\n  [data-theme-material='legacy'][data-theme-styled='true'][data-theme-contrast='normal'][data-theme-surface='bevel'] {\n    --ui-panel-finish: none;\n    --ui-control-finish: none;\n    --ui-hover-finish: none;\n    --ui-active-finish: none;\n    --ui-selected-finish: none;\n    --ui-toolbar-finish: none;\n    --ui-thumb-finish: none;\n    --ui-panel-depth:\n      inset 0 1px 0 #ffffff14, inset 0 -2px 0 #0006, 0 3px 0 var(--ui-shadow), 0 8px 16px #0003;\n    --ui-action-depth: inset 0 1px 0 #ffffff20, inset 0 -2px 0 #0005, 0 2px 0 var(--ui-shadow);\n    --ui-hover-depth:\n      inset 0 -2px 0 currentColor, inset 0 1px 0 #ffffff30, 0 2px 0 var(--ui-shadow);\n    --ui-pressed-depth: inset 0 2px 2px #0006, inset 0 -1px 0 #ffffff25;\n    --ui-selected-depth: inset 2px 0 currentColor, inset 0 -2px 0 #0004;\n    --ui-inset-depth: inset 0 2px 3px #0006, inset 0 -1px 0 #ffffff20;\n    --ui-input-hover-depth: inset 0 2px 3px #0006, inset 0 -1px 0 var(--iw-control-line);\n    --ui-gallery-depth: var(--ui-action-depth);\n  }\n}\n\n/* Mechanical travel is an input response, never an idle animation. Both\n   motion preferences opt in; nested flat/HC specimens keep their own reset. */\n@media (prefers-reduced-motion: no-preference) and (forced-colors: none) {\n  [data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'][data-theme-motion='full'] {\n    --ui-press-travel: var(--ui-material-travel);\n  }\n  [data-theme-material='steel'][data-theme-texture='on'][data-theme-contrast='normal'][data-theme-surface='bevel'][data-theme-motion='full'] {\n    --ui-press-travel: 0 2px;\n  }\n}\n";
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
// Existing package slot, compact CC0 reactions, no gameplay clocks or simulation state.
import * as academyAudioExternal0 from '../../game/i18n/index.mjs';
export const createSimFlightAudio = (() => {
  const sourceHashes = Object.freeze({
    'optional-practice/civilian-fpv/world-audio.mjs':
      '9341dd1ba2d9062a138cc20576d2ce8bbe12c92c65d877cfea237c8652ac25b3',
    'game/ui/human-reaction-policy.mjs':
      'dd5992bca561093f9a8c31c4e2cd51ddb239e97719df8d2567f27e4330f7b731',
    'game/ui/destruction-audio.mjs':
      'b9a52dbf64e751536a171a0e0d26223bd01e3e8d3fee5c0dffb4556b8775d85b',
    'game/ui/published-cues.mjs':
      '2be0b16b9c13f5315deec99385b536e25b6be2e77de4e0d56b8879cbf9d71b07',
    'game/ui/destruction-level.mjs':
      'ffbdf16469259f5ef6be0197aa8efd458038106d39cae6b25a57231aff790f61',
    'game/presentation/portable-destruction-audio.mjs':
      'cb594da86028972ed4eef40466944a385a73931846db6ffebeded6361f76d396',
    'game/audio/portable-destruction.mjs':
      '9af791e206d60041c99cc0d755305681ac3dbe02a7f990ecf5aeb8e0fb0a0938',
    'game/audio/dialogue-mix.mjs':
      '43ffa5b261e585e59b515fab19d1b6d0ccf636152ca6107602dbdb9143ddb00a',
    'game/ui/audio-output.mjs': 'dc1b2776407d0b6649b0d15c5c721bd59384d7e38a2e61087961ff7a37bd86c1',
    'game/ui/audio-master.mjs': '6bf14bc5268c0eff8f38c21c819f398917712fdc2607c33977ac873111d1dca8',
    'game/audio-preferences.mjs':
      '9212831a3524c9e1ebe8c595783f9f53a112e02e3d51280d775ac103b94a9239',
    'game/ui/encounter-audio.mjs':
      'ad58592952c55444713911a27df525b2c2d1f2a47c8a909a96597fda85e46dbd',
    'game/ui/world-ambience.mjs':
      '95b506a5cd1c34323a2bed5be3444be55ea38ddfc6036903757cccd3c301b260',
    'game/ui/movement-audio.mjs':
      '685d8e458401354028a2cacda0c7b1009b3c1e480a08d4cafce46d8f98b69020',
    'game/ui/dialogue-channel.mjs':
      'f4839f3a1634189a03eed6a3096dc595dfc88ee6437277ee82d78de05c300142',
  });
  const modules = Object.create(null);
  modules['game/ui/destruction-audio.mjs'] = (() => {
    /** Presentation-only vocabulary shared by every destruction adapter and Studio.
     * Classify before coalescing crowds; never consume the simulation random stream. */
    const DESTRUCTION_CATEGORIES = Object.freeze([
      'soft',
      'armored',
      'light',
      'heavy',
      'electronic',
    ]);
    const DESTRUCTION_CUES = Object.freeze(DESTRUCTION_CATEGORIES.map((id) => `destroy-${id}`));

    // Separate slots preserve the dry impact when Classic sounds is selected. Human identity
    // is independent of armor/electronics material (for example a relay operator).
    const HUMAN_REACTION_CUES = Object.freeze(
      Array.from({ length: 8 }, (_, index) => `human-reaction-${index + 1}`),
    );
    const humanoidFamilies = new Set([
      'lookout',
      'patroller',
      'runner',
      'sprinter',
      'courier',
      'guard',
      'refuge',
      'refuge-seeker',
      'switchback',
      'pair',
      'rendezvous-pair',
      'shield',
      'shield-bearer',
      'brace',
      'brace-trooper',
      'relay-warden',
    ]);
    function isHumanoidDestruction(details = {}) {
      if (details.machine || details.humanoid === false || details.flesh === false) return false;
      return details.humanoid === true || humanoidFamilies.has(details.family ?? details.kind);
    }

    function destructionCategory(details = {}) {
      if (DESTRUCTION_CATEGORIES.includes(details.category)) return details.category;
      const family = String(details.family ?? details.kind ?? '').toLowerCase();
      const machine = String(details.machine ?? '').toLowerCase();
      if (/relay|jammer|radar|electronic|generator|core|sentry|turret/.test(family))
        return 'electronic';
      if (/tank|carrier|tracked|heavy/.test(family + ' ' + machine)) return 'heavy';
      if (/shield|brace|guard|armored/.test(family) && !details.machine) return 'armored';
      if (details.machine || /car|truck|rover|buggy|vehicle|transport/.test(family)) return 'light';
      return details.material === 'metal' ? 'armored' : 'soft';
    }

    // Shape and decay, not loudness alone, separate infantry, equipment and engines.
    const profiles = Object.freeze({
      soft: [0.52, 0.24, 0.09, 190, 64, 'sine', 900, 280],
      armored: [0.54, 0.32, 0.11, 250, 72, 'triangle', 1300, 320],
      light: [0.58, 0.48, 0.16, 130, 38, 'triangle', 690, 100],
      heavy: [0.64, 0.8, 0.22, 86, 32, 'sine', 420, 70],
      electronic: [0.48, 0.33, 0.14, 710, 76, 'triangle', 1150, 145],
    });

    function destructionSoundRecipe(details = {}) {
      const category = destructionCategory(details);
      const [baseGain, maxDuration, cooldown, from, to, type, accentFrom, accentTo] =
        profiles[category];
      const scale = Number.isFinite(details.gainScale)
        ? Math.max(0, Math.min(1, details.gainScale))
        : 1;
      const organic = category === 'soft' || category === 'armored';
      const brutal = organic && details.brutal === true;
      const rate = /sprinter|courier/.test(details.family ?? '')
        ? 1.06
        : /brace|guard/.test(details.family ?? '')
          ? 0.96
          : 1;
      const gain = baseGain * scale * (brutal ? 1.12 : 1);
      return {
        category,
        name: `destroy-${category}`,
        gain,
        priority: category === 'heavy' ? 4 : 3,
        movement: false,
        rate,
        maxDuration,
        cooldown,
        // The recorded bank has quiet calibrated peaks. A full-scale oscillator
        // needs matching attenuation or initial/offline kills are much louder.
        tone: { from, to, duration: maxDuration * 0.7, gain: gain * (0.2 / 3), type },
        layers: [
          {
            from: accentFrom,
            to: accentTo,
            duration: brutal ? 0.16 : 0.08,
            gain: gain * ((brutal ? 0.085 : 0.045) / 3),
            type: 'triangle',
            kind: 'snare',
            delay: 0.008,
          },
        ],
      };
    }

    return {
      DESTRUCTION_CATEGORIES: DESTRUCTION_CATEGORIES,
      DESTRUCTION_CUES: DESTRUCTION_CUES,
      HUMAN_REACTION_CUES: HUMAN_REACTION_CUES,
      isHumanoidDestruction: isHumanoidDestruction,
      destructionCategory: destructionCategory,
      destructionSoundRecipe: destructionSoundRecipe,
    };
  })();
  modules['game/ui/human-reaction-policy.mjs'] = (() => {
    const HUMAN_REACTION_CUES = modules['game/ui/destruction-audio.mjs']['HUMAN_REACTION_CUES'];
    const isHumanoidDestruction = modules['game/ui/destruction-audio.mjs']['isHumanoidDestruction'];

    /** Cosmetic scheduling only. It never queues deaths or consumes gameplay RNG. */
    function createHumanReactionPolicy({ random = Math.random } = {}) {
      let tokens = 2,
        lastTime = null,
        lastOnset = -Infinity,
        quietUntil = -Infinity;
      let bag = [],
        previous = null;
      const metrics = { attempted: 0, admitted: 0, rejected: 0 };
      return {
        interrupt(now, duration = 0.35) {
          quietUntil = Math.max(quietUntil, now + duration);
        },
        request(now, details = {}, activeVoices = 0) {
          metrics.attempted++;
          if (!Number.isFinite(now)) {
            metrics.rejected++;
            return null;
          }
          if (lastTime !== null) tokens = Math.min(2, tokens + Math.max(0, now - lastTime));
          lastTime = now;
          if (
            !Number.isFinite(now) ||
            details.vocals === false ||
            !isHumanoidDestruction(details) ||
            details.audible === false ||
            activeVoices >= 2 ||
            now < quietUntil ||
            now - lastOnset < 0.25 ||
            tokens < 1
          ) {
            metrics.rejected++;
            return null;
          }
          if (!bag.length) {
            bag = [...HUMAN_REACTION_CUES];
            for (let i = bag.length - 1; i > 0; i--) {
              const j = Math.floor(Math.max(0, Math.min(0.999999, random())) * (i + 1));
              [bag[i], bag[j]] = [bag[j], bag[i]];
            }
            if (bag.at(-1) === previous) [bag[0], bag[bag.length - 1]] = [bag.at(-1), bag[0]];
          }
          previous = bag.pop();
          tokens--;
          lastOnset = now;
          metrics.admitted++;
          return previous;
        },
        snapshot: () => ({ ...metrics, tokens }),
        reset() {
          tokens = 2;
          lastTime = null;
          lastOnset = -Infinity;
          quietUntil = -Infinity;
          // Keep shuffle history across retries so every launch does not repeat take 1.
          metrics.attempted = metrics.admitted = metrics.rejected = 0;
        },
      };
    }

    return { createHumanReactionPolicy: createHumanReactionPolicy };
  })();
  modules['game/ui/destruction-level.mjs'] = (() => {
    const HUMAN_REACTION_CUES = modules['game/ui/destruction-audio.mjs']['HUMAN_REACTION_CUES'];
    /** Match imported destruction recordings to the admitted bank without changing
     * their original samples. Summed channel magnitudes bound stereo/downmix peaks
     * even when channels cancel in a mono audition. This runs once after decoding. */
    const targets = Object.freeze({
      ...Object.fromEntries(HUMAN_REACTION_CUES.map((name) => [name, -30])),
      'destroy-soft': -30,
      'destroy-armored': -30,
      'destroy-light': -29,
      'destroy-heavy': -28,
      'destroy-electronic': -31,
    });

    function destructionBufferGain(name, buffer) {
      if (!Object.hasOwn(targets, name)) return 1;
      const { length, numberOfChannels, sampleRate, duration } = buffer ?? {};
      if (
        !Number.isSafeInteger(length) ||
        length <= 0 ||
        !Number.isSafeInteger(numberOfChannels) ||
        numberOfChannels <= 0 ||
        numberOfChannels > 32 ||
        length * numberOfChannels > 4 * 1024 * 1024 ||
        !Number.isFinite(sampleRate) ||
        sampleRate <= 0 ||
        !Number.isFinite(duration) ||
        duration <= 0 ||
        duration > 1 ||
        typeof buffer.getChannelData !== 'function'
      )
        throw new TypeError('Invalid destruction audio buffer.');
      const envelope = new Float64Array(length);
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        if (data.length !== length) throw new TypeError('Incomplete destruction audio channel.');
        for (let index = 0; index < length; index++) {
          const value = data[index];
          if (!Number.isFinite(value)) throw new TypeError('Nonfinite destruction audio sample.');
          envelope[index] += Math.abs(value);
        }
      }
      const window = Math.max(1, Math.min(length, Math.round(sampleRate * 0.05)));
      let peak = 0,
        energy = 0,
        maximumEnergy = 0;
      for (let index = 0; index < length; index++) {
        const value = envelope[index];
        peak = Math.max(peak, value);
        energy += value * value;
        if (index >= window) energy -= envelope[index - window] ** 2;
        maximumEnergy = Math.max(maximumEnergy, energy);
      }
      const rms = Math.sqrt(maximumEnergy / window);
      return Math.min(1, peak > 0 ? 0.1 / peak : 1, rms > 0 ? 10 ** (targets[name] / 20) / rms : 1);
    }

    return { destructionBufferGain: destructionBufferGain };
  })();
  modules['game/ui/published-cues.mjs'] = (() => {
    const t = academyAudioExternal0['t'];
    const DESTRUCTION_CUES = modules['game/ui/destruction-audio.mjs']['DESTRUCTION_CUES'];
    const HUMAN_REACTION_CUES = modules['game/ui/destruction-audio.mjs']['HUMAN_REACTION_CUES'];
    const destructionBufferGain = modules['game/ui/destruction-level.mjs']['destructionBufferGain'];
    const cueNames = new Set([
      'focus',
      'confirm',
      'cancel',
      'capture',
      'failure',
      'victory',
      'pickup',
      ...DESTRUCTION_CUES,
      ...HUMAN_REACTION_CUES,
    ]);

    /** Read-only session cache. An unavailable cue uses its existing procedural
     * fallback; a late decode never replays an event that has already happened. */
    function createPublishedCues({
      sound,
      readAudio,
      maxVoices = 64,
      maxFeedbackVoices = 16,
      maxDecodedSamples = 16 * 1024 * 1024,
    }) {
      if (
        !Number.isSafeInteger(maxVoices) ||
        maxVoices < 1 ||
        maxVoices > 64 ||
        !Number.isSafeInteger(maxFeedbackVoices) ||
        maxFeedbackVoices < 1 ||
        maxFeedbackVoices > maxVoices ||
        !Number.isSafeInteger(maxDecodedSamples) ||
        maxDecodedSamples < 1 ||
        maxDecodedSamples > 16 * 1024 * 1024
      )
        throw new TypeError('Invalid published audio voice budget.');
      const cache = new Map(),
        attenuation = new Map(),
        pending = new Set(),
        loads = new Map(),
        voices = new Set(),
        recent = new Map();
      let closed = false,
        decodedSamples = 0;
      const cancelPending = () => {
        for (const controller of pending) controller.abort();
        pending.clear();
        loads.clear();
        for (const [key, value] of cache) if (value === 'loading') cache.delete(key);
      };
      const available = (ui = false) =>
        !closed &&
        sound.enabled &&
        !sound.paused &&
        !sound.disposed &&
        !sound.audioMaster?.muted &&
        sound.audioMaster?.volume !== 0 &&
        sound.context?.state === 'running' &&
        sound.settings.master &&
        (ui ? sound.menuSettings?.enabled !== false : sound.settings.sfx) &&
        (ui || !sound.persistentMusic || !sound.gameplayPaused);
      function load(name) {
        if (cache.get(name) === 'loading') return loads.get(name);
        if (
          !cueNames.has(name) ||
          cache.has(name) ||
          typeof sound.context?.decodeAudioData !== 'function'
        )
          return;
        const controller = new AbortController();
        pending.add(controller);
        cache.set(name, 'loading');
        const promise = Promise.resolve()
          .then(() => readAudio(`audio.${name}`, { signal: controller.signal }))
          .then(async (result) => {
            if (!result || controller.signal.aborted || closed || !sound.enabled) return null;
            const decoded = await sound.context.decodeAudioData(await result.blob.arrayBuffer());
            if (closed || controller.signal.aborted || !sound.enabled) return null;
            if (
              !Number.isFinite(decoded.duration) ||
              decoded.duration <= 0 ||
              decoded.duration >
                (HUMAN_REACTION_CUES.includes(name)
                  ? 0.7
                  : DESTRUCTION_CUES.includes(name)
                    ? 1
                    : 15) ||
              decoded.length * decoded.numberOfChannels > 4 * 1024 * 1024
            )
              throw new Error(t('interface:publishedCueExceedsItsDecodedBudget'));
            if ([...DESTRUCTION_CUES, ...HUMAN_REACTION_CUES].includes(name))
              attenuation.set(name, destructionBufferGain(name, decoded));
            return decoded;
          })
          .then((decoded) => {
            if (!closed && !controller.signal.aborted) {
              if (
                decoded &&
                decodedSamples + decoded.length * decoded.numberOfChannels > maxDecodedSamples
              )
                decoded = null;
              if (decoded) decodedSamples += decoded.length * decoded.numberOfChannels;
              cache.set(name, decoded ?? false);
            }
          })
          .catch(() => {
            if (!closed && !controller.signal.aborted) cache.set(name, false);
          })
          .finally(() => {
            pending.delete(controller);
            if (loads.get(name) === promise) loads.delete(name);
          });
        loads.set(name, promise);
        return promise;
      }
      return Object.freeze({
        has(name) {
          const value = cache.get(name);
          return !!value && value !== 'loading';
        },
        prepare(names) {
          if (!available()) return Promise.resolve();
          return Promise.all(names.filter((name) => cueNames.has(name)).map(load));
        },
        play(
          name,
          {
            ui = false,
            board = 'solo',
            pan = 0,
            feedback = false,
            priority = 2,
            gain = 1,
            rate = 1,
            maxDuration = null,
            humanReaction = false,
          } = {},
        ) {
          if (!cueNames.has(name) || !available(ui)) return false;
          const buffer = cache.get(name);
          if (buffer === undefined) {
            void load(name);
            return false;
          }
          if (!buffer || buffer === 'loading') return false;
          const now = sound.context.currentTime;
          if (ui && now - (recent.get(name) ?? -Infinity) < 0.08) return true;
          const destruction = [...DESTRUCTION_CUES, ...HUMAN_REACTION_CUES].includes(name);
          const owned = [...sound.voices].filter((voice) => voice.feedback);
          if (feedback && (owned.length >= maxFeedbackVoices || sound.voices.size >= maxVoices)) {
            const victim = owned
              .filter((voice) => voice.priority < priority)
              .sort((a, b) => a.priority - b.priority)[0];
            if (!victim) return true; // A budget rejection must not trigger a synthetic duplicate.
            victim.stop();
          }
          if (sound.voices.size >= maxVoices) return true;
          if (destruction && now - (recent.get(`${board}:${name}`) ?? -Infinity) < 0.09)
            return true;
          if (destruction) recent.set(`${board}:${name}`, now);
          recent.set(name, now);
          const source = sound.context.createBufferSource(),
            panner = pan ? sound.context.createStereoPanner?.() : null;
          source.buffer = buffer;
          const volume = sound.context.createGain();
          const playbackRate = Math.max(0.8, Math.min(1.2, Number.isFinite(rate) ? rate : 1));
          const duration = Math.min(
            buffer.duration / playbackRate,
            destruction ? (maxDuration ?? 0.85) : Infinity,
          );
          source.playbackRate?.setValueAtTime(playbackRate, now);
          const level =
            Math.max(0, Math.min(1, Number.isFinite(gain) ? gain : 1)) *
            (attenuation.get(name) ?? 1);
          volume.gain.setValueAtTime(level, now);
          if (destruction) {
            volume.gain.setValueAtTime(level, now + Math.max(0, duration - 0.02));
            volume.gain.linearRampToValueAtTime?.(0, now + duration);
          }
          source.connect(volume);
          const bus = ui ? (sound.menuBus ?? sound.sfxBus) : sound.sfxBus;
          if (panner) {
            volume.connect(panner);
            panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), now);
            panner.connect(bus);
          } else volume.connect(bus);
          let stopped = false;
          const voice = {
            bus: ui ? 'menu' : 'sfx',
            name,
            board,
            feedback,
            humanReaction,
            destruction: DESTRUCTION_CUES.includes(name),
            cueFamily: name,
            priority,
            source,
            retire() {
              if (!humanReaction) {
                voice.stop();
                return;
              }
              volume.gain.cancelScheduledValues?.(sound.context.currentTime);
              volume.gain.setTargetAtTime?.(0, sound.context.currentTime, 0.008);
              source.stop(sound.context.currentTime + 0.04);
            },
            stop() {
              if (stopped) return;
              stopped = true;
              try {
                source.stop();
              } catch {}
              source.disconnect();
              volume.disconnect();
              panner?.disconnect();
              voices.delete(voice);
              sound.voices.delete(voice);
            },
          };
          source.onended = voice.stop;
          sound.voices.add(voice);
          voices.add(voice);
          try {
            source.start(now);
            source.stop(now + duration);
          } catch {
            voice.stop();
            return false;
          }
          return true;
        },
        cancelPending,
        close() {
          closed = true;
          for (const voice of [...voices]) voice.stop();
          cancelPending();
          cache.clear();
          decodedSamples = 0;
          attenuation.clear();
          recent.clear();
        },
      });
    }

    return { createPublishedCues: createPublishedCues };
  })();
  modules['game/audio/portable-destruction.mjs'] = (() => {
    // Generated by scripts/refresh-portable-destruction-audio.mjs. Original bytes and provenance retained.
    // prettier-ignore
    const bank = {"format":"revealline-portable-destruction.v1","release":{"id":"field-kit","revision":104},"bytes":232892,"clips":{"audio.destroy-soft":{"mime":"audio/wav","bytes":21164,"sha256":"4ccf476d260718a54c78954918b06e0b222c75eae12c967f68e7ac5047b97acf","source":{"kind":"core","recordingSha256":"4ccf476d260718a54c78954918b06e0b222c75eae12c967f68e7ac5047b97acf"},"base64":"UklGRqRSAABXQVZFZm10IBAAAAABAAEAgLsAAAB3AQACABAAZGF0YYBSAAAAAAAAAAAAAAEAAQACAAIAAwADAAQABAAEAAUABQAGAAYABwAIAAgACQAKAAsADAANAA4ADgAPABAAEQASABMAFAAWABcAGAAaABwAHQAfACAAIQAiACMAJAAmACcAKAApACsALAAtAC8AMAAyADMANQA2ADgAOQA7ADwAPgA/AEAAQgBDAEQARQBGAEcARwBIAEgARwBHAEcARwBIAEgASABIAEgASABIAEgASQBJAEkASQBJAEgASABIAEcARwBGAEYARgBFAEUARABEAEMAQwBCAEIAQQBBAEAAQAA/AD8APgA+AD0APQA9AD0APAA8ADsAOwA6ADoAOQA4ADgANwA2ADUANAAzADIAMQAwADAALwAvAC4ALgAuAC0ALQAtACwALAAsACwAKwArACoAKgApACkAKAAoACcAJwAmACUAJQAkACMAIgAiACEAIAAgAB8AHwAeAB4AHQAdAB0AHAAcABwAHAAbABsAGgAaABkAGAAYABcAFwAXABYAFgAWABUAFQAUABQAEwASABIAEgARABEAEAAQABAADwAPAA8ADwAPAA8ADwAPAA8ADwAOAA4ADgANAA0ADAAMAAsACwAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAJAAkACAAIAAcABwAHAAcABwAHAAcABwAHAAcABwAGAAYABgAGAAYABgAGAAcABwAHAAgACQAJAAoACwALAAsACwALAAoACgAKAAoACQAJAAkACQAIAAgACAAIAAgACAAIAAgACQAJAAkACgAKAAsADAAMAA0ADQAOAA4ADgANAA0ADQAMAAwACwALAAsACwAKAAoACgAKAAoACwALAAsACwALAAsACwALAAwADAAMAAwADQANAA0ADQANAAwADAAMAAwADAALAAsACwALAAsACwALAAsADAAMAAwADAAMAAwADAALAAsACwAMAAwADAANAA0ADgAOAA4ADwAPABAAEQARABEAEQARABAAEAAQAA8ADwAPAA8AEAAPAA4ADQALAAkACAAIAAcACAAJAAoACwANAA8AEQAUABcAGwAfACMAKAAtADIANwA8AEIASABOAFUAWwBjAGoAcgB6AIIAiwCUAJ4AqACyALwAxwDRANwA6ADzAP8ACwEYASUBMwFAAU4BXAFqAXkBhwGUAaEBqwG1AbwBwwHIAc0B0QHVAdgB3AHfAeIB5QHoAesB7gHwAfMB9QH3AfoB/AH+AQACAQICAgMCAwIDAgICAgIBAgACAAL/Af4B/gH9AfwB/AH7AfsB+gH5AfgB9gH1AfMB8gHwAe4B7AHqAegB5gHkAeEB3wHcAdkB1gHTAdABzQHKAccBxAHBAb4BugG3AbMBsAGsAagBpAGgAZwBmAGUAZABjQGJAYUBgQF+AXoBdgFyAW4BagFmAWEBXQFZAVUBUQFMAUgBQwE/AToBNgExAS0BKAEkASABGwEXARMBDwELAQcBAwH/APsA9gDyAO0A6ADkAN8A2wDXANIAzQDJAMQAvwC7ALYAsQCtAKgAowCeAJgAkwCNAIgAgwB/AHsAdwBzAG8AbABoAGMAXwBbAFcAUgBOAEkARABAADsANgAyAC4AKQAmACIAHgAaABYAEgAOAAoABQABAPz/9v/u/+X/2v/P/8P/tv+p/5z/jv+B/3P/Zv9Y/0r/PP8u/yD/Ev8D//T+5P7V/sX+tf6l/pX+hf51/mb+Vv5H/jj+KP4Z/gr++/3s/d79z/3B/bP9pf2X/Yn9e/1t/V/9Uf1D/TX9KP0a/Qz9/vzw/OL81fzI/Lz8sPyl/Jr8j/yF/Hv8cfxn/F78VfxM/EL8Ofww/Cf8HvwW/A38Bfz9+/b77/vo++H72/vV+8/7yvvF+8H7vvu7+7n7uPu3+7f7tvu2+7f7t/u4+7j7ufu6+7r7u/u8+737vvvA+8L7w/vF+8j7yvvN+9D71PvY+9374fvm++v78Pv1+/n7/fsA/AT8BvwJ/A38EPwU/Bj8HPwh/Cb8K/ww/DX8Ovw//ET8SvxP/FX8Wvxg/Gb8bPxz/Hn8gPyG/Iv8kfyW/Jz8ofym/Kz8s/y6/ML8yvzS/Nv84/zq/PL8+fwA/Qf9Df0V/R39J/0y/T79S/1Y/Wb9c/2B/Y39mf2k/a/9uf3F/dH93v3t/f39DP4c/iz+PP5M/lr+aP52/oP+kP6c/qf+sv69/sn+1f7h/u3++/4I/xb/I/8x/z7/S/9Y/2T/b/96/4P/jf+X/6L/rf+5/8f/1v/n//n/DAAeAC4APABLAFkAZgBzAIAAjACYAKIAqwCzALoAwQDHAM0A1QDdAOcA9gAOATQBagGyAQkCagLSAjkDmQPsAywEWAR1BIkEmwSsBL4E0ATiBPUEBwUaBSwFPAVMBVoFZgVwBXoFggWJBZAFlwWeBaYFrwW6BcYF0wXhBe8F/QUKBhUGHQYhBiMGIwYiBiEGIAYeBh0GGwYZBhYGEwYPBgoGBQb+BfcF8AXnBd4F1AXKBb8FtAWoBZsFjQV9BWkFTwUsBf0EvgRwBBQEsANHA98CewIaAroBWQH2AJEAKgDE/2H/BP+v/mD+Ff7O/Yj9Rf0D/cP8iPxQ/B788fvI+6P7gfth+0L7IfsA+976vPqc+n76Y/pK+jT6IPoN+vz56/nc+cz5vvmw+aL5lPmH+Xv5b/ll+Vv5U/lM+Ub5QPk7+Tf5M/kv+Sz5K/kr+Sz5L/kz+Tj5PvlF+U75V/li+W/5ffmN+aD5tfnO+ev5DPoy+lv6h/q2+uj6Hvtb+5/77ftD/KL8CP1x/d/9Uf7K/kz/2P9qAAABkAERAn0C1AIaA1cDkAPHA/4DMwRnBJkEyQT2BCIFSwVyBZgFvAXfBQEGIgZCBmEGfgaYBq8GxAbXBugG+AYGBxQHIAcrBzQHOwdAB0IHRAdEB0QHRAdDB0IHQQc/BzwHOgc2BzMHLwcqByQHHQcRBwAH5wbFBpoGZgYqBugFowVZBQkFtARXBPMDhgMRA5UCFQKWARkBnQAjAKn/MP+5/kX+1f1t/Q39tfxl/Bz82fub+2D7KPvy+r36ivpa+i76Bvrk+cb5rPmW+YP5c/lm+Vr5T/lH+T/5O/k4+Tj5Ovk9+UH5RflJ+U75VPld+Wf5dfmE+Zb5qvnA+df58fkN+iz6Tvpz+pv6x/r3+in7XvuW+9H7D/xQ/JT83Pwo/Xb9xf0W/mj+uv4M/17/r////1AAoADwAEABjQHYASECZgKpAucCIgNaA48DwAPuAxkEQQRnBIoEqgTJBOUE/gQWBSwFQAVSBWIFcAV+BYwFmQWkBa4FtgW8Bb8FwAW/BbsFtQWtBaIFlgWIBXkFagVcBU8FRQU/BTwFOQU2BTIFLAUlBR8FGQUTBQwFBAX4BOoE2ATFBLIEngSLBHcEYwRPBDoEJAQOBPcD4APJA7EDmgODA20DWANFAzQDJAMWAwgD+wLrAtYCvQKdAngCUAInAv0B0gGnAXkBSAEVAeAAqABxADoABQDP/5r/ZP8s//H+tP50/jX++f3A/Yr9Vv0i/e38t/yC/E38G/zs+7/7k/tp+z/7GPv0+tL6s/qY+oD6a/pX+kX6M/oi+hD6//nu+dz5zPm8+a35oPmV+Yv5hPl9+Xj5c/lv+W35a/lq+Wv5bPlv+XL5dfl5+Xz5f/mC+Yb5ivmP+ZT5mvmf+aP5p/mq+az5rvmw+bH5sPmv+a35q/mp+an5q/mt+bH5tfm7+cD5x/nN+dP52vnh+en58fn6+QL6C/oU+h/6K/o5+kr6Xfpx+of6n/q5+tX68/oU+zX7Wft/+6n71vsI/ED8f/zG/BT9aP2+/Rb+cf7O/jD/mP8HAHwA9QBtAeEBTgK2AhkDeAPTAykEewTHBA0FSwWDBbcF6AUVBkAGaQaOBrEG0QbuBggHHgcyB0QHVAdhB2wHdQd8B4IHhweKB40HjgeOB4wHiAeCB3sHcgdpB2AHVQdJBzwHLAcZBwMH6QbNBq8GjwZtBkcGHAbqBbEFbwUkBdAEdgQWBLADRAPTAl0C4wFnAeoAbADy/33/Df+h/jz+3v2G/TP95PyY/E/8CfzH+4n7Ufsf+/T6zvqu+pH6d/pe+kb6Mvoj+hb6C/oD+v75+/n8+f75A/oL+hX6Ifow+kL6Vvps+oP6m/q1+s/66voH+yf7Svtx+5v7yPv3+yj8XPyS/Mv8Bf1B/X79vP37/T3+gf7I/hH/XP+n//H/OwCDAMkADQFPAY8BzAEHAkECewK0Au0CIwNWA4YDtQPhAwwENQRdBIEEoQS+BNcE7gQDBRYFKAU7BU8FYwV3BYsFngWwBb8FzAXXBeAF5gXsBe8F8QXwBe4F6gXkBd0F1QXMBcEFtgWpBZoFiQV2BV8FRQUnBQMF2wSuBH0ESQQTBN0DpgNtAzMD9wK3AnICKALZAYcBMgHfAIwAOQDl/4//OP/f/oT+K/7Y/Y79Sv0M/dL8mfxg/Cf87fu1+3/7TPsd+/H6yvqn+oj6bvpX+kT6NPon+hz6E/oN+gn6B/oJ+g36FPoa+iH6KPov+jf6QfpO+l/6dPqM+qf6xPrj+gX7KftR+3z7q/vf+xf8U/yU/Nv8Kv2E/e39Zv7v/oH/FQCiABwBhwHoAUYCowL9AlMDpAPxAzgEegS1BOoEGgVGBW8FlAW3BdkF+AUUBi8GRwZdBnEGhAaVBqYGtQbEBtMG4gbxBv4GCQcSBxkHHgchByIHIgchByAHHQcbBxcHFAcQBwsHBwcBB/sG9QbvBugG4AbXBs0GwQazBqIGjgZ3Bl4GQgYjBgEG3AWzBYcFWQUoBfYEwwSMBFMEFwTZA5kDWAMXA9cCmAJaAhsC2gGWAU0B/gCrAFUA//+r/1j/Bv+3/mr+If7b/Zj9WP0a/d/8pvxu/Dj8A/zP+577bvtC+xn79PrS+rT6mfqB+mz6WvpK+jz6L/oj+hn6EPoI+gL6/vn9+QD6B/oR+h36K/o7+kv6Xfpv+oL6lfqo+rv6zPrc+uz6/PoP+yb7QPte+4D7pvvP+/z7LPxf/Jb80vwS/Vb9nP3j/Sj+Z/6i/tj+C/87/2X/jP+u/83/6P8BABoANABOAGwAjwC2AOEADwFAAXIBowHTAf8BKAJMAmoChAKaAq0CvALIAtAC1ALTAs4CxgK9ArUCrQKmAqICnwKdApsCmAKTAowCggJ3AmkCWgJIAjUCHwIHAuwBzwGvAY0BaQFFASEB/gDeAL4AngB9AFoAMwAIANv/rP99/03/HP/p/rL+dv43/vb9t/17/UX9FP3p/ML8n/x//GT8TPw5/Cf8F/wF/PP73/vL+7f7pPuT+4L7c/tm+1v7UvtK+0X7QvtA+z/7QPtA+0D7Pvs7+zb7MPsp+yT7IPsd+xz7Hvsi+yn7M/tA+1D7Yvt2+4r7nfuv+8D70Pvf++z7+vsJ/Bf8Jfwz/ET8Wfx1/Jj8xfz7/Df9ef2+/Qb+Tv6X/uH+Lv99/9D/JgB+ANUAKgF4AbwB+AEuAmEClALIAv0CMANhA44DuQPgAwcELQRSBHYEmwS+BOMEBwUqBUsFaQWFBZ8FtwXOBeQF+AULBh0GLAY5BkMGSgZPBlEGUQZQBk4GTAZJBkgGRwZIBkoGTgZRBlUGWAZaBlsGWgZYBlUGUAZKBkIGNwYpBhoGCQb4BegF2QXKBbsFqwWcBY0FfwVzBWcFXAVQBUEFLgUXBfsE2gS3BJIEbARHBCQEBAToA84DtgOcA4ADYwNFAyUDBAPhArgChwJLAgQCsgFZAQIBrwBkACEA4/+n/2v/Lf/v/rD+df49/gr+3v23/ZX9d/1b/UL9K/0V/QH96/zS/LP8j/xn/Dz8Efzm+777mPtz+1D7L/sR+/X63vrL+rz6sfqq+qf6qPqt+rb6w/rT+uX69/oJ+xn7J/sz+z37RvtP+1b7Xftk+2r7cvt5+4L7jfua+6v7wPvX+/H7DPwo/EX8ZvyK/LL83PwH/TP9Xv2K/bf95P0S/kH+cP6c/sb+7P4M/yf/P/9W/2z/g/+b/7T/zv/p/wQAHgA5AFQAcQCQALAA0ADwAA4BKgFFAWIBgAGhAcUB6QEKAiYCPQJNAlkCYQJnAm0CcwJ4An4ChwKTAqICtALGAtcC5gL0AgADDQMcAy0DQQNWA2kDeAOBA4cDiwOMA4wDiwOHA4ADdwNsA18DUQNCAzYDLgMsAy8DNgM9A0IDRwNMA1IDWgNjA2wDcwN1A3IDaQNZA0QDKgMMA+oCxAKbAnECSQInAg8CAQL5AfUB8gHxAfIB8wH2AfsB/wEEAggCDAIOAgkC+QHcAbQBhQFYATIBFgEFAf8AAwEPASEBOAFPAWMBcAF3AXkBdQFsAVwBRAEiAfgAyACaAHIAUwA+ADYAPgBXAIEAvAADAVABmwHiAR8CVAKCAqkCyALeAukC5wLaAsMCogJ4AkQCCALJAY0BVwEuARIBAAHyAOUA2wDXANoA5gD4AAgBEwEZAR0BHwEiAR8BFgEFAeoAyQCnAIQAXwA0AAEAxP9//zH/3v6I/jT+4v2U/Uj9Af3C/I38Y/xE/C78HfwQ/An8CPwP/Bv8K/w9/E38Wvxf/Fr8TPw4/B78Afzk+8X7pvuG+2j7TPs0+x/7D/sD+/36/PoA+wf7DvsV+xv7Ifso+zD7O/tJ+137efuf+877Afw0/GP8ivym/Lf8vvy9/Lb8qfyY/Ib8cvxe/Ev8Ovwt/Cf8K/w6/FT8efyo/N78GP1S/Yr9vP3n/Qr+Jf45/kX+Sf5E/jX+Hf79/df9s/2U/Xz9aP1Z/Uv9Q/1C/Un9W/11/ZT9s/3Q/er9Af4V/if+OP5H/lL+WP5V/kn+Nv4d/gH+6P3U/cf9xf3P/eX9Bv4u/lv+jP7A/vj+MP9o/5n/vv/Y/+f/7v/v/+v/5f/c/9P/zP/L/9H/3f/t/wAAFAAoAD0AUgBoAHwAiwCUAJgAlwCSAIwAhQCBAIQAkwCvANgACQE8AW4BlwG1AcYBywHFAbgBpAGMAW8BTgEnAfwA0QCoAIkAdQBuAHAAeACFAJkAswDVAP4AKQFOAWoBewGAAXsBbQFdAU8BRAE8ATgBNAEwAS0BLAEvATgBRAFTAWEBawFxAXQBdgF7AYYBmQG0AdYB+QEcAj8CYwKKArMC4QITA0cDegOsA9gD/QMZBC0EPARGBEsESwRHBEAEOAQyBDIEOARDBFIEZAR3BIoEnAStBLwEygTVBNsE2wTTBMUEswShBJEEhgSDBIQEiASMBI0EiQR+BG4EWgRFBDAEHAQGBOwDzgOpA38DUAMeA+wCvAKPAmUCPQIXAvEBzAGmAX8BWAExAQsB5wDEAKIAfgBXACkA8/+y/2j/Ff+//mr+Hv7e/a39iv1x/WD9Uv1E/Tb9Kf0e/Rn9GP0d/SX9L/05/T/9Qf08/TL9If0O/fn85fzQ/Lz8qvyc/JD8iPyD/IT8ivyU/KT8uPzN/OL89fwF/Q39DP0D/fb86/zn/Ov8+fwL/R/9M/1F/VT9YP1p/W39bP1k/Vf9Rv0z/SH9Ev0H/f/8+vz2/PL87Pzo/Ob86Pzw/P38Df0d/Sr9Nv1B/U79YP13/ZL9rf3E/dL91v3R/cj9uv2s/Zz9iP1v/VH9Lv0N/fP85fzl/PP8Df01/Wf9ov3j/SX+X/6Q/rf+2P7z/gn/Fv8Y/wv/7/7J/p/+c/5H/h7+9/3W/b/9s/21/cX94f0H/jb+bP6m/uP+Hf9T/3//nv+v/7P/r/+l/5b/gv9p/0//Of8r/yn/Mv9B/1D/Wv9c/1T/Qf8n/wX/3v62/pD+cP5Z/k7+T/5d/nX+lf69/un+Gf9H/3P/mf+7/9f/7v8AAAwAEAANAAUA+P/p/9//3f/n////JABSAIUAuADmAAwBLAFIAWIBfQGaAbYB0AHpAQECFwIrAj8CUwJqAoQCowLEAucCCwMyA1oDgQOnA8cD3wPsA/AD8APtA+gD4wPbA80DugOgA4EDXwM8AxgD9gLZAsMCuAK2Ar4CzALbAucC7wL1AvgC+QL4AvEC4QLFApsCZAIiAtYBhQExAeAAlQBUAB8A9//b/8j/uv+u/6H/kv+B/2//V/87/xn/8P7A/on+TP4N/s79lP1i/Tr9H/0N/QH99/zu/OP81/zO/Mr8xvy+/LT8pfyV/IX8dvxq/GD8WPxS/E78S/xH/ED8Nvwn/BL89vvW+7L7jvts+037M/se+xH7DfsU+yX7Qftj+4n7s/ve+wr8M/xV/G38efx5/HD8XfxE/Cf8Cfzq+837tfuk+5v7nPup+8D74fsJ/Dn8cPyu/PH8OP19/b79+f0x/mX+lf7C/uf+A/8U/xn/Ff8M/wL/+v74/v7+EP8v/1z/lf/X/x8AaQC0AAABTwGeAewBOAJ9ArkC7QIZAz8DXwN5A4wDmQOgA6IDowOkA6QDowOhA5wDlgORA48DkgOZA6YDtgPJA90D7wP9AwUEBgQABPMD4QPLA7EDkQNsA0IDFAPjArMChgJeAjwCHgIBAuEBvwGaAXQBTgEpAQQB3QCyAIMATgAXAOL/sf+I/2j/U/9E/zf/Kf8W//z+3P6z/oH+R/4I/sf9iv1T/ST9/vzi/M/8xfzB/ML8x/zQ/Nv86Pzz/Pz8/vz7/PD83/zH/Kv8j/x1/GL8W/xi/Hj8nPzO/An9R/2H/cf9Av40/l3+ev6O/pn+nv6f/pz+lf6J/nr+bP5g/lv+X/5u/ov+t/7w/jT/gP/Q/yMAeADOACIBcAG3AfUBKwJYAnsClQKlAq4CswK3ArwCwwLLAtMC2gLfAuMC5wLuAvoCCwMjA0ADXwOAA50DtgPJA9cD4QPoA+4D9AP3A/YD8QPpA94DzwPAA68DoAOTA4cDfgN3A3IDbANlA1sDTAM6AyMDCgPuAtACsgKTAnMCUwI1AhkC/QHhAcEBnQFzAUQBEgHdAKgAdwBLACUABQDq/9L/vv+r/5r/iv95/2X/S/8q/wL/0f6Z/l/+Jf7v/cL9oP2J/Xr9cf1r/WX9YP1Z/VH9R/06/Sr9Gf0I/fr88Pzt/PH8+vwE/Q39Ef0P/Qj9+/zn/M/8s/yU/Hb8WPw9/CT8D/z8++775vvm+/D7A/wd/Dv8W/x8/Jz8vPza/PT8DP0h/TP9Qf1O/Vn9YP1j/WP9YP1b/Vb9U/1R/VD9T/1N/Uv9TP1T/WD9dv2U/bj94v0R/kT+ev61/vT+M/9y/6z/3/8KAC0ASABcAGcAaQBjAFsAVABRAFQAXABnAHQAhgCbALUA0QDuAAgBIAE0AUcBWAFoAXgBhwGUAaIBsAG+AcwB2QHlAe4B9QH4AfYB7wHhAc0BswGUAXQBVwFAAS8BJQEeARoBFQEPAQYB+gDpANUAuwCdAHwAWgA7AB4ABQDw/+D/1v/T/9b/3f/l/+r/6v/m/9z/zf+7/6b/kv9+/2//Y/9b/1b/Uf9N/0r/R/9D/0D/P/89/zn/NP8t/yT/HP8Y/xr/JP83/1L/cf+U/7n/3f///yEAQABcAHQAhgCSAJgAmQCYAJUAkQCOAI4AkQCUAJcAmACXAJQAkwCVAJoAogCrALMAugDAAMUAywDRANYA2wDeAOAA4ADhAOIA5QDpAO0A8gD5AAEBCQESARsBIwEpASwBLQEqASUBHwEXAQ0B/wDrANQAuwCgAIYAbwBbAE0ARwBLAFgAbwCLAKoAyQDmAAEBGgEvAUABSwFRAVIBTgFFATQBGwH5ANIAqQCFAGoAWQBQAE0ATwBTAFsAZgB0AIMAkwCiALEAwgDTAOEA7ADxAO8A5QDUAL8ApgCLAG8AUQAyABIA8f/Q/7H/lP96/2P/Uf9G/0P/Sf9V/2f/eP+G/47/k/+W/5f/l/+V/5D/h/97/2z/W/9I/zX/I/8U/wn/Bf8J/xP/If8x/0L/Uv9h/27/ef9+/4D/ff95/3T/cv90/3r/hv+X/67/x//j/wEAHwA+AF0AegCWAK4AwwDUAOIA6wDyAPgA/gAEAQ0BGAElATMBQQFOAVoBZAFtAXQBfAGDAYoBkQGXAZwBoAGjAaUBpwGnAaQBngGUAYgBeQFqAVwBUQFJAUMBQQE/AT4BOwE2AS8BJgEbAQ8BAgHxAN4AxwCuAJUAfABlAFIAQAAxACQAGQARAAsACgALAA4ADwANAAUA9v/h/8j/rv+X/4X/fP97/4D/h/+P/5j/n/+k/6b/pP+d/5H/gv9w/13/Sf83/yr/I/8j/yj/Mv8+/0n/Uf9V/1P/S/88/yn/E//6/t7+v/6f/n/+Yv5K/jj+Lv4s/jH+Ov5H/lX+ZP5y/n/+if6R/pT+kf6H/nb+YP5H/i7+Fv7+/ej90/2//a79nf2M/Xz9bv1j/V39XP1h/Wv9d/2F/ZX9qP28/dH95/37/Qz+Gf4j/iv+M/4+/kv+Wv5r/nz+jv6g/rP+x/7a/uz+/P4K/xj/Jv80/0P/Uf9f/3D/hP+d/7r/3P8AACYATQBzAJkAvwDjAAUBIwE9AVABXAFhAWEBXgFbAVgBWAFdAWcBdgGKAaEBtwHMAd4B7QH5AQMCCwIQAhECDgIHAv0B8QHkAdgBzgHHAcEBvwG+AcABxQHKAc8B0gHSAc8ByAG9AbABoQGSAYQBdgFqAWEBXgFkAXMBigGlAb8B1QHlAe8B8gHuAeUB1QHBAaoBkgF8AWcBUgE9ASgBFQEGAfoA8wDxAPIA9wD+AAcBEAEZASABJAEkASABGAEMAf8A8ADiANMAxQC4AK0ApgCjAKYAqgCtAK0AqACdAIwAeABiAEsANAAcAAUA7//Z/8b/tf+n/5r/j/+E/3r/b/9k/1n/Tv9E/zz/Nv8w/yv/Jv8h/xz/GP8W/xX/Ff8W/xj/Gv8c/x7/H/8h/yL/I/8l/yj/Lf80/0D/Tv9f/3H/hP+X/6n/u//N/97/7//+/w0AHQAtAEAAVgBtAIUAnwC3AM4A4gD0AAMBDwEZAR8BIgEkAScBLAE0AT8BTwFiAXkBkgGuAckB4gH3AQgCFgIgAioCMgI6AkACRQJJAksCTAJLAkgCQgI7AjQCLAIlAh4CGQITAg8CCwIHAgMC/gH4AfEB6gHkAd8B3AHZAdYB0QHKAcABswGlAZUBhAF0AWUBWAFMAUABNAEqASABFwERAQwBCAEEAf4A9gDrAN4A0ADCALMAowCTAIMAdABoAFwAUgBHADwAMgAnAB0AEgAHAPr/6v/Y/8X/sP+a/4T/cf9g/1P/TP9K/03/Vf9h/3D/gP+O/5n/n/+f/5f/hv9s/0r/Jf/+/tf+s/6V/n/+cf5s/m/+eP6F/pP+o/6y/sH+z/7b/ub+8P75/gH/Cv8T/x3/KP80/0H/Tf9a/2b/cv98/4X/jP+S/5X/lf+T/5D/jv+N/4//lv+i/7X/0f/0/x4ATAB7AKcAzgDvAAsBIgE0AUIBTAFUAVoBYAFmAW0BcwF5AX4BhAGJAY8BlQGaAZwBnAGaAZcBlAGQAYwBigGJAYsBkgGdAasBvAHNAd8B7gH8AQUCCQIHAv8B8gHhAcsBtAGdAYgBdQFlAVgBTAFCATkBMgEuASwBKQElAR0BEQEAAe0A2QDGALUApgCbAJMAkACSAJgAogCsALcAvwDEAMMAvACtAJgAfQBfAD8AHgD+/+D/xf+v/53/kv+M/43/lP+h/7P/xv/Y/+f/8P/z/+//5f/V/8L/rP+V/3z/ZP9N/zn/KP8a/xD/Cv8F/wH/Af8C/wb/C/8Q/xL/Ev8O/wj///70/uf+2P7I/rj+p/6Z/o7+h/6D/oH+gf6B/oD+ff56/nX+cP5r/mX+YP5b/lj+V/5Z/l3+Y/5q/nL+e/6G/pL+oP6v/r7+zP7Z/uT+7/75/gT/D/8c/yj/Nf8//0j/Tv9R/1L/T/9K/0P/PP82/zP/Nf87/0X/Uv9h/3D/fv+L/5X/nf+m/6//u//K/9z/8P8GABsALQA8AEYATABPAFIAVQBWAFYAUwBNAEMANgAnABcABgD1/+b/2v/S/9L/2//s/wMAHAAzAEYAUgBVAFEAQwAvABYA/P/j/8z/uf+q/57/l/+U/5X/mf+g/6j/sP+4/8H/y//W/+L/7//7/wUACwANAA0ACgAGAAEA/P/5//j/+f/8/wAAAwAFAAYABwAHAAcACQALAA8AFAAZACAAJwAuADUAPABDAEoAUgBaAGMAbQB4AIYAlgCpALwAzQDZAOEA5gDoAOgA6QDrAPAA+AACAQ0BFwEhASoBMgE5AUABRgFNAVMBWgFgAWYBawFvAXQBeQF/AYUBigGNAY8BkAGQAZIBlgGcAaQBrAG1Ab4BxgHOAdUB3QHmAe4B+AEAAgcCDAIOAg0CCAL/AfIB4QHNAbcBnwGHAXABWgFHATgBLwEsAS8BNwFBAUwBVgFfAWYBbAFvAXIBcwFzAXMBcwFzAXEBbgFnAV0BTwE9ASoBFQEAAewA2gDLAL8AtwC1ALkAwQDMANcA4gDoAOsA6wDnAN8A0gC/AKcAigBrAE4AMwAZAAIA7P/Z/8r/v/+5/7f/t/+3/7X/sP+o/53/kf+F/3z/df9y/3L/dP93/3n/ev95/3b/b/9m/1j/Rf8v/xX/+f7d/sT+rv6g/pn+mf6f/qj+sf66/sP+y/7V/t/+6v71/v3+A/8I/wr/C/8M/w3/D/8S/xb/G/8g/yX/Kv8v/zT/Ov9A/0T/SP9L/07/U/9a/2X/dP+F/5n/rP/A/9P/5v/3/wgAFwAmADQAQgBRAGIAcQB/AIoAkQCUAJYAmACaAJ4AowCoAKsArQCsAKgAoQCXAIkAewBtAGEAWABRAEwARgA/ADgAMQAsACkAKAAqAC0AMAAzADMAMAApAB8ADwD7/+T/y/+x/5j/gP9q/1b/Rf82/yj/HP8R/wb/+v7s/t7+zv6+/q7+nv6P/oD+cf5j/lX+Sf5B/jv+OP44/jn+O/48/j3+Pf46/jb+Lv4k/hj+C/7+/fL96P3g/dr91/3X/dn93f3j/ev99P39/Qb+Dv4W/h7+Jv4u/jf+QP5J/lL+XP5o/nT+gf6O/pv+p/6x/rn+wf7I/s/+1/7f/un+8/7+/gv/Gf8o/zb/RP9R/17/av94/4f/l/+p/73/0v/o////FgAtAEQAXAByAIkAnwC0AMkA3QDwAAIBEwEiATABOwFEAUsBUQFXAV0BZAFtAXcBgwGQAZ0BqAGzAbwBxQHNAdcB4gHtAfgBAQIIAg4CEgITAhICDgIGAv0B8wHrAeMB3QHZAdYB1AHUAdYB2QHaAdgB0wHMAcIBuAGuAaQBmAGKAXsBaQFUAT0BJAEJAe0A0QC1AJsAgwBuAFsASgA7ACwAGwAJAPb/4v/M/7b/nv+G/23/Vf8//yz/G/8M///+8v7l/tv+1P7R/tH+1f7a/t/+4f7f/tj+y/66/qj+lP6B/nH+ZP5c/lj+WP5a/l3+Yv5n/m3+c/57/oP+i/6R/pX+mf6c/qD+pf6t/rf+xP7R/t/+7P75/gX/Ev8h/zH/Qv9S/1//av9x/3f/ff+E/47/m/+p/7j/xv/S/9r/3//j/+b/6f/u//X///8KABcAJQA0AEQAUwBiAHEAgACPAJ4AqwC1ALwAwgDHAMwA0wDbAOMA6wDxAPcA+wD+AAEBBAEEAQMBAQH9APgA9ADwAO0A6wDrAO8A9gD/AAwBGQElAS0BMwE1ATUBMwEvASoBJAEdARUBDQECAfcA7ADgANUAyQC+ALMAqQChAJwAmACWAJQAkwCSAJEAjQCHAH4AcABgAE0AOQAlABIA///u/9//0P/C/7T/pv+a/47/hP97/3L/a/9j/1r/Uf9H/z7/Nf8u/yn/J/8n/yf/Jv8i/xv/Ev8F//X+5P7S/r/+rv6g/pf+kf6O/pD+lP6c/qf+tP7B/s7+2f7j/uv+8/74/vz+/P76/vX+7v7o/uL+3/7f/uP+7P73/gT/Ef8d/yj/Mf85/z7/QP9A/z//PP85/zj/O/9A/0n/Vv9l/3X/h/+Z/6n/tv+//8X/x//F/8D/uf+w/6X/mv+O/4T/ef9t/2L/V/9O/0n/Sf9O/1j/ZP9w/3z/hf+M/5H/lP+W/5b/lP+P/4j/fv9y/2f/W/9R/0f/Pf8z/yr/I/8f/x3/H/8j/yn/Mf85/z//Q/9E/0L/P/87/zf/NP8z/zP/Nf85/z7/Q/9I/03/Uf9V/1j/W/9d/13/W/9X/1H/Sv9A/zb/K/8h/xr/Fv8X/x3/J/80/0T/VP9l/3T/gv+O/5f/nf+f/6D/nv+a/5b/kf+N/4r/if+K/4v/jf+Q/5T/mP+d/6L/p/+t/7P/uf/A/8b/y//N/83/y//I/8T/wv/C/8T/yP/P/9j/4//v//z/CQAUAB0AJQArAC8AMwA0ADUAMwAwAC0AKgAnACQAIwAkACcAKwAzADwARwBTAGAAbQB6AIcAkwCdAKMApwCmAKMAnQCXAJEAiwCGAIMAgAB/AH8AgACCAIUAhwCKAIwAjQCOAI8AjwCOAI0AjACLAIsAjQCPAJEAlACWAJcAmQCbAJ0AoACkAKkArQCxALMAswCxAKsAogCWAIYAcwBeAEoANwApACAAHQAeACIAKQAyAD0ASgBWAGEAZwBqAGgAYgBWAEUAMAAXAPz/4//N/7r/q/+g/5n/lv+Y/53/pf+t/7P/uP+5/7j/tv+x/6r/oP+W/4v/gf94/3H/bP9p/2n/av9s/2//cv90/3X/dP9x/23/Zv9d/1L/Rf84/yz/If8X/xD/DP8K/wr/DP8R/xj/IP8q/zX/QP9K/1P/Wf9e/2H/Yv9k/2b/aP9t/3P/e/+F/4//mv+k/6z/s/+4/7z/wP/C/8T/xf/F/8T/w//C/8P/x//N/9b/4f/t//r/BgASAB4AKQAzAD0ARgBOAFQAWABaAFwAXABbAFsAWwBdAF8AYABiAGQAZQBmAGgAagBtAHAAdQB5AHwAfgB/AH8AgACBAIEAgQB/AHsAdABsAGMAWQBPAEUAPAA0AC4AKgAoACcAJwAnACcAJgAkACIAIAAdABkAFgASAA0ABwABAPn/7//l/9n/zf/A/7P/pv+b/5H/if+A/3j/cP9n/1//V/9P/0f/QP85/zP/Lf8m/yD/Gv8V/xD/DP8I/wb/BP8E/wT/Bv8J/w3/Ev8W/xr/HP8d/x3/Gv8V/w//CP8B//v+9v7z/vL+8v71/vn+//4H/w//GP8i/yz/Nv9B/0z/WP9k/3D/fP+G/4//lv+c/6L/qf+v/7X/vP/B/8b/y//P/9P/2P/e/+X/7f/2////CAASABwAJwA0AEIAUQBiAHQAiACbAK0AvADJANIA2QDeAOEA4QDhAOAA3gDeAN8A4gDmAO0A9AD7AAEBBgEJAQoBCgEJAQgBBgEFAQMBAgEAAQABAAEBAQMBCAEOARUBHQEkASoBLQEuASoBIwEZAQwB/QDtANsAygC6AKwAoQCaAJUAkgCRAJAAjwCOAI0AjACKAIcAgQB6AG8AYwBUAEMAMwAjABQABwD8//P/6v/j/93/1//Q/8j/wP+2/6v/n/+R/4H/cP9d/0v/Of8q/x7/FP8N/wf/A/8A//7+/f7+/v/+Af8C/wL/Af8A//3++f72/vT+8v7y/vP+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AAADAAYACQAMAA4ADwAPAA8ADwAOAA0ADAALAAsACgAJAAkACAAHAAcABgAGAAcABwAIAAkACgALAAsADAALAAsACgAJAAkACQAKAAoACgAKAAsACwAMAA4AEAASABQAFQAWABcAFwAXABYAFQAUABQAEwASABAADwAOAA0ADQANAA4AEAATABcAHAAgACQAKAAqACsALAAsACsAKwAqACgAJQAiAB4AGgAXABUAFAAUABUAFwAZABsAHQAdAB0AHAAaABgAFQASAA8ADQAMAAsADAANAA8AEQATABUAFwAZABoAGwAbABwAGwAbABoAGQAZABgAFwAVABMAEAAOAAwACgAJAAkACgALAAwADQANAA0ADAALAAoACAAHAAQAAgAAAP7//f/9//7///8BAAUACQANABIAFgAZABwAHQAdABsAGQAVABEADAAIAAQAAAD+//z/+v/5//n/+f/5//r/+//7//z//f/9//3//f/9//3//f/9//3//P/8//v/+v/5//j/+P/4//r//P/+/wAAAgADAAMAAgD///v/9//y/+3/6P/k/+H/3//e/97/3v/f/9//3//f/9//3f/c/9r/2f/Y/9f/2P/Z/9v/3f/e/+D/4f/i/+L/4v/h/+D/3v/c/9r/1v/S/87/y//H/8X/w//B/8H/wf/C/8P/xf/I/8r/zP/M/8z/y//K/8n/x//F/8P/wf+//77/vf+8/7v/u/+8/73/vv/A/8H/w//D/8T/xP/E/8L/wP+9/7n/tf+x/63/qv+n/6X/pP+k/6T/pf+n/6n/rP+v/7L/tP+3/7r/vP+//8L/xf/H/8n/yv/L/8r/x//D/73/uP+y/63/qf+m/6P/ov+i/6T/qP+s/7L/uP++/8X/y//R/9f/2//d/9//3//e/93/3P/b/9r/2f/Z/9j/1//W/9b/1v/W/9f/2f/a/9z/3v/g/+L/5P/n/+r/7v/0//r/AQAHAAwAEAAUABcAGQAbABsAGgAZABUAEgAOAAsACAAFAAMAAgABAAEAAgAEAAcACgAOABEAFQAXABkAGQAYABYAEwAQAA4ADAAKAAkACAAIAAgACQALAA0ADwARABMAFQAYABkAGgAZABYAEQALAAMA+//z/+z/5v/g/9z/2f/Y/9j/2v/d/+H/5f/q/+7/8v/1//f/9//2//X/8//x/+7/7P/p/+b/5P/h/9//3f/b/9v/2//c/93/3v/f/+D/4P/f/97/3f/c/9v/2//c/97/4P/j/+b/6f/s/+//8v/0//X/9v/3//f/9v/2//X/9v/2//f/+P/6//3/AAADAAcACwAPABMAFwAcACAAIwAnACoALQAwADIANAA1ADQANAAzADIAMQAxADEAMgA0ADYAOQA+AEMASQBPAFUAWwBgAGUAaQBsAG8AcQBzAHUAdgB4AHkAeQB5AHkAeAB3AHYAdAByAHAAbgBsAGoAaABnAGYAZQBkAGMAYwBkAGUAZwBpAGwAbwByAHQAdgB3AHcAdgBzAHAAawBnAGIAXgBZAFUAUABLAEcAQgA+ADoANwA1ADQAMwAxADAALgAsACkAJgAiAB4AGgAWABIADwANAAsACgAJAAgABwAGAAUAAwACAAAA/f/6//X/8f/s/+f/4v/e/9v/2v/Z/9n/2//c/93/3v/e/93/3P/a/9f/1P/R/8//zv/N/87/z//R/9L/1f/X/9n/3P/e/+D/4f/i/+H/4P/d/9v/2P/V/9P/0f/Q/9D/0P/S/9P/1v/Z/93/4v/n/+v/8P/z//b/9//4//f/9v/z//H/7//s/+v/6//r/+z/7v/x//T/9//7//7/AQAEAAcACQALAAwADAAKAAgABQACAP3/+f/1//D/7P/p/+f/5f/l/+X/5//p/+z/8P/z//f/+//+/wEABAAGAAgABwAGAAQAAQD///z/+//5//n/+f/5//v//f///wIABAAFAAYABQAEAAEA/f/5//T/8P/t/+r/6f/o/+j/6P/o/+j/6P/o/+j/6f/q/+v/7f/v//H/8//1//X/9f/z//D/7f/p/+X/4f/d/9r/2P/Y/9n/3P/f/+P/6P/t//L/+P/9/wEABAAFAAUABAACAAAA/f/6//j/9v/0//T/9P/2//j/+v/8////AgAEAAcACQAMAA0ADwARABMAFQAXABkAGwAdAB8AIQAjACQAJQAlACQAIgAhAB8AHQAbABoAGQAYABkAGwAeACMAKAAvADUAPABDAEoAUQBWAFoAXQBeAF4AXQBcAFkAVgBRAE0ASABFAEIAQgBCAEQARgBJAEwAUABUAFgAWwBcAF0AXQBdAFwAWgBYAFYAVQBTAFIAUQBRAFAAUABQAFAAUQBTAFQAVQBWAFYAVgBVAFQAUgBQAE4ASwBIAEYAQwBBAEAAPwA+AD4APwA/AEAAQQBCAEMARABFAEUARQBEAEMAQQA/AD4APAA6ADkAOQA5ADoAPAA9AD8AQABCAEMARABEAEQAQgBBAEAAPgA9ADsAOQA2ADQAMQAvAC0AKwApACgAJgAlACUAJAAkACUAJQAmACYAJgAmACUAIwAiACAAHwAeAB0AHQAcABsAGQAWABMAEAANAAoACAAHAAYABgAHAAYABgAFAAMAAAD9//v/+P/2//T/8v/x/+//7v/t/+3/7P/s/+z/6//q/+j/5v/k/+H/3v/b/9n/2P/X/9b/1f/V/9T/1P/U/9T/0//T/9P/0v/R/9D/z//O/87/zf/N/83/zf/O/87/zv/P/8//zv/O/87/zf/N/83/zf/O/87/zv/N/83/zP/L/8n/yP/H/8b/xf/F/8X/xv/H/8j/yv/M/87/0P/S/9X/1//Y/9r/2v/b/9v/3P/c/9v/2//a/9n/2P/X/9f/1v/W/9b/1v/X/9j/2f/b/9z/3v/f/9//4P/h/+L/5P/m/+j/6v/r/+z/7P/s/+v/6//q/+r/6v/r/+z/7v/w//P/9v/4//r//P/9//3//f/8//v/+v/5//n/+P/3//b/9v/2//b/9//4//r//P///wIABQAJAAwADwARABMAEwATABIAEAAOAA0ACwAKAAgACAAHAAcABwAIAAoADQAQABMAFgAZABwAHwAiACQAJgAnACcAJgAkACIAHwAcABkAFwAWABUAFQAWABgAGwAeACEAJAAnACoALAAuAC8ALwAuAC0ALAArACoAKQAoACgAKAAnACcAJwAnACcAJwAoACkAKQAqACsAKgAqACgAJgAkACIAIAAfAB4AHAAcABsAGwAbABsAHAAcABsAGwAZABgAFQATABAADgALAAkACAAHAAYABgAHAAcACAAJAAkACgALAAsACwALAAsACwALAAsACQAIAAYABAABAP///f/8//r/+P/3//f/9//3//j/+v/7//3//v8AAAEAAgACAAEAAAD///3/+//5//b/9P/x/+//7f/s/+v/7P/t/+//8v/1//r//v8BAAQABgAGAAUAAwAAAP3/+P/0//D/7P/p/+f/5f/l/+X/5v/o/+v/7//z//f/+//9////AAD///7//P/6//f/9P/y//D/7//v//D/8f/0//f/+//+/wEABAAFAAYABgAFAAUABAADAAIAAQAAAAAA/////wAAAAAAAAEAAgADAAUABgAIAAkACQAJAAgABwAFAAMAAgABAAEAAQADAAUABwAKAA0AEAATABYAFwAZABkAGAAXABUAEgAPAAwACgAIAAcABgAGAAcACAAJAAoACwALAAwADAAMAAwADAALAAoACQAIAAYABAACAAAA/v/9//v/+v/6//n/+f/5//r/+v/7//z//f/+////AAABAAEAAQAAAP///v/8//r/+P/2//T/8v/x//D/8P/x//H/8v/z//X/9v/4//r/+//8//3//f/9//3//P/7//r/+f/5//n/+f/5//n/+v/6//r/+f/5//n/+f/6//v//P/9////AAABAAIAAgACAAIAAgABAAEAAAD///7//f/8//z//P/9//7///8AAAIAAwAFAAYABgAGAAUABAADAAIAAQAAAAAA///+//3//f/8//z//f/9//7///8AAAEAAwAEAAYABwAIAAgACAAHAAYABAABAP3/+v/2//T/8v/w//D/8P/y//P/9f/3//r//P///wAAAQABAAAA/v/8//r/+P/1//L/7//s/+n/5//l/+T/4//k/+X/5v/p/+v/7v/w//H/8f/w/+//7f/q/+j/5f/i/+D/3v/c/9v/2//b/9z/3f/e/+D/4f/h/+H/4P/f/93/2//Y/9b/1P/S/9H/0P/Q/8//z//P/8//z//O/87/zv/O/87/z//Q/9H/0v/T/9T/1v/X/9j/2f/Z/9n/2v/a/9r/2//b/9r/2v/a/9r/2v/a/9r/2v/a/9v/3P/c/93/3//g/+H/4//l/+f/6P/q/+v/7P/t/+7/7//v/+//7//v/+//7v/u/+3/7f/u/+7/8P/y//T/9//6//z//v///wEAAgADAAQABQAFAAUABQAEAAQABAAEAAQABQAFAAUABQAGAAYABgAHAAcACAAIAAoACwANAA4AEAARABIAEwAUABQAFAATABMAEgARABEAEAAPAA8ADgANAA0ADAANAA0ADgAQABEAEwAVABcAGAAZABoAGwAbABoAGQAXABUAEgAQAA0ACgAIAAcABgAGAAYABgAHAAcACAAJAAoACwALAAsADAAMAAwADAAMAAwADAALAAoACQAHAAUABAACAAEA/////////////wAAAQABAAIAAgACAAEAAQAAAP///f/8//r/+f/4//f/9v/1//T/9P/z//P/8//y//L/8v/z//T/9f/2//f/+P/5//r/+//8//z//P/8//z/+//6//r/+f/4//f/9v/2//b/9v/2//f/9//4//n/+f/6//v//P/9//7//v/+//7//f/8//v/+v/5//j/9//2//X/9P/0//P/8v/y//L/8v/z//P/9P/1//b/9v/3//f/9//2//b/9v/1//X/9P/0//T/9P/0//T/9P/0//T/9P/1//X/9f/1//X/9P/0//P/8//y//L/8f/x//D/8P/w//D/7//v/+//8P/w//D/8f/x//H/8f/x//D/8P/w//D/8P/x//L/8v/z//T/9P/0//T/9f/1//X/9v/2//b/9v/3//f/9//3//f/9v/2//b/9v/2//f/+P/5//v//f/+/wAAAQACAAMAAwAEAAQAAwADAAMAAwADAAMAAwADAAMAAwAEAAQABQAGAAcACAAKAAwADgAPABEAEwAUABYAFwAYABkAGQAZABkAGAAYABcAFwAXABcAFwAYABgAGQAaABsAHAAdAB4AHgAfAB8AIAAgACAAIAAgACAAHwAeAB0AHAAcABsAGwAaABoAGgAaABoAGwAbABwAHAAcABwAHAAcABsAGgAZABkAGAAXABYAFAATABIAEQAQAA8ADgANAA0ADAAMAAsACgAJAAgACAAHAAcABwAHAAcABwAHAAcABwAGAAYABQAFAAQAAwACAAEAAAD///7//f/8//v/+v/6//n/+f/4//j/9//3//b/9v/1//X/9P/0//T/9P/z//P/8//y//L/8v/x//H/8P/w//D/8P/w//D/8P/w//D/8P/v/+7/7v/t/+3/7f/t/+3/7f/u/+7/7v/v/+//8P/w//D/8f/x//H/8f/y//L/8v/y//P/8//z//P/8//z//T/9P/0//T/9P/0//T/9P/1//X/9f/2//b/9v/2//b/9f/1//T/9P/z//P/8//z//P/8//0//X/9v/3//j/+f/5//r/+v/6//r/+f/4//f/9v/1//T/8//y//L/8f/x//L/8v/z//T/9P/0//X/9f/0//T/9P/z//P/8v/y//H/8f/w/+//7//u/+7/7v/u/+//7//w//D/8P/w//D/8P/w//D/8P/v/+//7//u/+7/7v/u/+7/7//v//D/8f/x//L/8//0//X/9f/2//b/9//3//f/9//3//j/+P/4//n/+f/6//v//P/9//7///8AAAEAAgADAAQABAAFAAUABQAGAAYABgAHAAcACAAIAAkACwAMAA0ADwAQABEAEwAUABUAFQAWABYAFwAXABcAGAAYABkAGQAaABsAGwAcAB0AHgAeAB8AIAAhACIAIgAjACMAIwAjACMAJAAkACQAJAAkACQAJAAkACQAJQAlACUAJQAmACYAJgAnACcAJwAnACcAJwAmACYAJQAlACQAIwAjACIAIgAiACIAIgAiACIAIgAiACIAIgAiACEAIQAgAB8AHgAdABwAGwAaABoAGQAYABgAFwAXABYAFgAVABUAFAAUABMAEgASABEAEAAPAA8ADgAOAA0ADAALAAoACQAIAAcABgAFAAQAAwADAAIAAgACAAIAAgABAAEAAQAAAAAAAAD///7//f/9//z/+//6//r/+v/5//n/+f/5//r/+v/6//r/+f/5//n/+f/4//j/+P/4//j/+P/3//f/9v/2//X/9P/0//P/8//z//T/9P/1//X/9f/2//b/9v/2//b/9v/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9f/1//X/9P/0//T/8//z//L/8v/y//L/8v/y//L/8v/z//P/9P/0//T/9P/0//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//y//L/8v/z//P/8//z//T/9P/0//T/9f/1//X/9f/2//b/9v/2//b/9v/3//f/9//3//f/+P/4//j/+P/5//n/+f/6//r/+v/7//v/+//7//v/+//7//z//P/8//z//P/9//3//v/+//////8AAAAAAQABAAIAAgACAAIAAwADAAMABAAEAAUABQAGAAYABgAGAAYABwAHAAcACAAIAAgACQAJAAkACQAJAAkACgAKAAsACwAMAAwADQANAA4ADgAOAA4ADgAOAA4ADgAOAA0ADQAMAAwACwALAAsACwALAAsACwAMAAwADAAMAA0ADQANAA0ADQANAA0ADQAMAAwACwALAAoACgAJAAkACQAJAAkACQAJAAkACgAKAAoACgAKAAoACgAJAAkACAAIAAcABwAGAAYABgAFAAUABQAEAAQABAAEAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAgACAAIAAQABAAAAAAD////////////////////////////////////////+//7//f/8//z/+//7//v/+//7//v/+//7//z//P/8//z//f/9//3//f/9//3//P/8//z/+//7//r/+v/6//r/+v/6//r/+v/6//v/+//7//z//P/8//z//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/9//3//f/9//3//f/9//3//v/+//7//v///////////////v/+//7//v/9//3//f/9//3//f/9//3//f/+//7//v/+//7//v////////////////////////////////////////////////8AAAAAAAABAAEAAQABAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgADAAMAAwAEAAQABAAFAAUABQAFAAUABQAFAAUABQAFAAUABAAEAAQABAAEAAUABQAFAAUABQAGAAYABgAGAAYABwAHAAcABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAFAAUABQAFAAUABQAEAAQABAAEAAQABAAEAAQABAADAAMAAwADAAMAAgACAAIAAgABAAEAAQABAAAAAAAAAAAA/////////////////v/+//7//v/+//7//v/9//3//f/8//z//P/7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//6//r/+v/6//r/+v/6//n/+f/5//n/+f/5//n/+f/5//n/+f/5//n/+f/5//n/+f/5//r/+v/5//n/+f/5//n/+f/5//n/+f/5//r/+v/6//r/+v/6//r/+v/6//r/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v//P/8//z//P/8//z//P/9//3//f/9//3//f/9//3//f/9//3//f/9//3//v/+//7//v/+//7//v/+//7//v/+/////////////////////////////////////////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="},"audio.destroy-armored":{"mime":"audio/wav","bytes":28844,"sha256":"341ec9b36071d2a2b8ee77c570b7ab950be85e795f5f1a2f74b32812d6f6b634","source":{"kind":"core","recordingSha256":"341ec9b36071d2a2b8ee77c570b7ab950be85e795f5f1a2f74b32812d6f6b634"},"base64":"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6f/s/+//9P/6/wMADQAXACEAKwA2AEIATwBdAGsAdgCBAIsAkwCZAJ4AogClAKgArACyALoAwADHAMwA0ADTANUA1QDVANQA0wDSANEAzwDNAMwAywDJAMgAyQDMANQA3QDpAPQA/gAFAQoBDgEPAQ4BCgEEAf0A9QDtAOUA3QDUAMoAwAC2AK0ApQCdAJYAjgCIAIQAggCAAH0AeQB2AHMAcABsAGcAYABXAEwAQAAzACUAFgAHAPj/6//e/9L/x/+9/7T/qv+h/5j/kf+L/4b/gP95/3H/av9i/1z/Vv9R/07/S/9J/0b/Q/8//zn/Mf8o/xz/D/8C//X+5/7a/tH+yv7I/sn+y/7P/tT+2/7k/u/++f4C/wr/Ef8Y/x7/JP8p/yz/LP8q/yb/If8c/xn/Gf8d/yP/K/81/0D/TP9V/13/ZP9p/23/b/9x/3H/cP9v/2//cf92/33/hv+R/53/qf+1/8P/z//Z/+D/4//j/+L/3//b/9X/zf/F/73/tv+v/6b/nP+R/4f/f/96/3n/ff+F/4//mf+i/6n/rv+y/7T/tf+z/7H/rv+p/6T/nP+U/4z/hP9+/3f/cP9o/2D/Wv9V/1P/VP9W/1v/YP9k/2j/bP9u/3D/cf9v/2z/af9n/2b/Zv9n/2n/bP9x/3b/fP+C/4b/iv+N/5D/kf+R/4//jP+H/4H/e/91/3D/a/9n/2T/Yv9k/2j/cP95/4T/kP+d/6n/tP++/8X/yv/M/83/zP/J/8b/w/+//7z/uP+2/7X/tv+3/7j/uf+6/7z/v//E/8n/zv/T/9j/3f/h/+X/5//n/+f/5f/j/+L/4//j/+X/5//r//H/+f8DAA0AFgAfACYALQAyADYAOAA5ADgANgAzAC8ALAApACcAJgAlACUAJwArADAANQA7AEMATQBXAGIAbAB1AHwAggCHAIoAigCIAIUAgAB6AHQAbwBsAGoAaABnAGcAaABqAGwAbgBwAHEAcgB0AHQAdABxAG4AawBpAGkAagBrAG0AbgBvAG8AbwBvAHAAcgB0AHYAeAB8AIAAhACFAIUAgwB/AHgAbgBiAFQAQwAzACQAGAAQAAwADAAOABMAGgAkAC8AOwBFAE0AUQBSAFAASwBDADUAJAARAP7/6f/W/8T/tf+o/5//mf+X/5f/m/+h/6f/rP+w/7P/tf+1/7L/rf+m/5//l/+Q/4n/g/9//3z/e/98/33/fv+B/4T/iP+K/4v/i/+I/4T/ff91/2z/Y/9a/1L/Sf9B/zv/N/81/zb/N/86/z3/Qv9J/1H/Wv9k/27/d/9+/4P/h/+J/4z/jv+Q/5T/mv+i/6r/sv+7/8P/y//S/9j/3f/g/+P/5f/n/+n/6//s/+z/6//r/+z/7f/x//b//P8DAAsAEwAcACUALQA0ADsAQgBJAE8AVQBZAFwAXABcAFoAWQBYAFcAVwBYAFgAWQBZAFoAWQBaAFsAXABeAGEAZABmAGYAZwBpAGsAbQBuAG4AbQBqAGUAXwBZAFMASwBEADwANQAuACoAJwAkACMAIgAiACEAIAAeABwAGQAXABQAEgAQAAwACAADAP//+f/y/+v/4v/X/8v/v/+0/6n/oP+Z/5P/jf+H/4L/ff93/3D/af9i/1z/Vv9Q/0v/Rv9B/zz/N/80/zH/Lv8s/yr/KP8n/yj/Kv8s/y//M/83/zv/Pv9B/0L/Qv9A/z7/O/83/zH/LP8o/yX/I/8j/yX/KP8s/zL/N/89/0X/Tv9X/1//Z/9v/3j/gf+L/5T/nf+l/6z/s/+5/77/wv/I/87/1P/a/9//5P/p/+7/8v/2//v/AQAIAA8AFwAeACUALAA0AD0ARgBRAFwAaQB3AIUAkwCgAKsAtQC8AMEAxQDHAMgAxwDFAMMAwgDDAMQAxgDJAM0A0gDXAN0A4QDkAOUA5wDnAOcA5gDlAOMA4wDiAOEA4QDiAOMA5gDrAPAA9gD7AAEBBwEJAQkBBgEAAfkA8ADmANoAzQC+ALAAogCWAIwAhQCAAHwAegB4AHcAdgB0AHMAcgBxAG4AagBlAF0AVABJAD0AMQAkABgADQADAPv/8//t/+j/5P/g/9z/1//Q/8n/wv+5/67/ov+V/4j/ev9s/1//U/9J/0L/PP85/zb/M/8x/zD/MP8x/zL/M/8z/zL/MP8u/yv/KP8l/yP/Iv8i/yP/Jf8n/yn/Kv8r/yz/LP8s/yv/LP8s/y7/MP8y/zX/Of89/0L/SP9P/1j/Yv9s/3b/f/+I/4//lv+e/6X/rf+1/7z/xP/M/9X/3f/k/+z/8//7/wMACwAUABwAJQAsADMAOAA8AD4AQABCAEQARwBLAFAAVABYAFwAXwBhAGMAZABmAGgAawBuAHIAdgB5AHwAfwCBAIQAhwCKAI0A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JwAnACUAIwAhACAAHwAeAB0AHAAcABsAGgAZABkAGQAZABoAGwAcAB0AHgAfACAAIQAhACIAIgAiACMAIwAiACEAHgAcABkAFgAUABIAEQARABEAEQARABAAEAARABEAEgATABQAFQAXABoAHQAgACMAJgApACoAKgAoACUAIgAeABkAFQARAA4ACwAJAAgABwAGAAUAAwACAAEAAQABAAEAAQACAAMABQAHAAgACgALAA0ADgAPAA8ADwAOAA4ADAAKAAYAAgD///z/+f/2//T/8//z//P/9P/1//X/9//5//r/+//7//r/+v/6//r/+v/7//v//f///wIABQAIAAsADwASABMAFQAXABgAGgAbABsAHAAcABwAGwAbABoAGQAYABYAFQATABMAEwAVABcAGgAeACIAJwAsADEANgA6AD8ARABJAE0AUgBVAFkAXABeAGEAYgBkAGUAZQBkAGMAYQBdAFkAVQBQAEsARQBBAD0AOgA5ADoAPAA+AEEAQwBGAEkASwBOAFAAUgBTAFMAUgBPAEwASABDAD0ANwAxACoAJAAeABoAFgAUABMAEwAUABcAGgAcAB4AHwAgACAAHgAbABcAEgANAAYAAAD5//L/7P/m/+H/2//W/9L/zv/M/8v/yv/K/8r/yv/J/8n/yP/H/8X/wv+//7v/t/+z/7D/rf+q/6f/pP+g/5z/l/+S/47/iv+H/4X/g/+D/4L/gv+B/3//ff98/3r/ef93/3X/c/9x/3H/cP9w/3D/cP9x/3H/cv9y/3P/dP92/3j/ev96/3v/e/98/33/fv9+/3//fv99/3r/d/90/3L/cP9w/3H/dP94/33/g/+K/5H/mv+i/6r/sv+5/8D/x//N/9L/1v/Z/9z/3f/c/9n/1f/Q/8v/x//D/8D/vv+8/7z/vP+9/77/wP/D/8f/y//P/9L/1P/X/9n/2//b/9z/3P/c/9v/2//a/9n/2f/Z/9n/2f/Z/9r/2//d/97/4P/h/+L/4//i/+D/3f/b/9n/1//V/9P/0//T/9T/1v/Y/9v/3v/i/+b/6P/q/+v/7P/s/+r/5//j/97/2v/W/9T/0v/T/9T/1//Z/9v/3f/e/9//4P/h/+L/4//l/+j/6v/s/+7/8P/x//L/8//0//b/+f/7//z//v/////////+//3/+//5//j/9//3//f/9//4//n/+f/6//r/+//9////AQACAAQABgAJAAsADQAPABEAEgASABIAEgARAA8ADwAOAA0ADQAMAAsACgAKAAoACgAKAAoACwAMAAwADQANAA0ADQAOAA4ADgAOAA0ADAAMAAsADAAMAAwACwAKAAkACQAJAAoADAAOABAAEQASABMAEgASABEAEAAPAA4ADQALAAoACQAHAAYABQAGAAcACAAKAAwADwASABYAGQAcAB4AIAAiACIAIgAhACAAHwAdABsAGAAVABMAEQAPAA4ADwAQABIAFQAXABgAGAAZABkAGgAZABcAFQATABEADwANAAwADAANAA8AEQASABMAFQAXABgAGgAbABsAHAAcABwAGwAbABsAGwAbABsAGQAXABQAEgAQAA8ADgAOAA8AEAARABIAEwATABIAEgARABAADwAOAAwACgAIAAcABwAHAAcABwAHAAkADAAQABMAFwAaAB0AIAAgACAAHgAcABoAFwAUABAADQALAAoACAAHAAcABwAHAAcABwAGAAYABgAGAAcACAAIAAgABwAHAAcABgAGAAUABAADAAMAAgABAAAA//8AAAEAAgADAAUABQAGAAUABAADAAAA/v/6//f/8//w/+3/6v/p/+j/6P/o/+j/6f/p/+j/6P/m/+X/5P/j/+L/4f/h/+H/4v/k/+f/6f/r/+z/7P/r/+v/6v/p/+j/5v/k/+H/3v/a/9f/1P/S/8//zv/N/8z/zP/M/83/zv/Q/9H/0//U/9P/0v/R/8//zv/M/8v/yf/I/8f/xv/F/8T/xP/E/8T/xf/G/8j/yf/L/8z/zf/O/8//z//O/83/yv/H/8P/wP+9/7r/t/+1/7P/sf+w/7D/sf+y/7T/tv+5/7v/vf+//8H/w//F/8f/yv/M/87/z//Q/9H/0v/S/9D/zf/K/8b/w//A/77/vP+8/7z/vf+//8L/xf/J/87/0//Y/93/4v/m/+r/7f/v//D/8P/w//D/7//t/+v/6v/o/+j/5//m/+X/5f/k/+X/5f/m/+j/6f/q/+v/7P/u/+//8v/1//n//f8DAAkADgATABYAGQAbAB0AHwAfAB8AHQAaABcAFAARAA4ADAALAAkACAAHAAcABwAJAAsADQAQABIAFQAXABgAGAAXABYAFAASAA8ADAAKAAcABgAFAAUABgAHAAkACwANAA8AEQAUABYAGAAZABoAGQAXABMADgAJAAMA/f/4//L/7f/p/+b/4//i/+P/5f/n/+r/7f/x//T/9//6//v/+//6//j/9v/0//H/7v/r/+j/5v/k/+L/3//d/9v/2v/a/9v/3P/d/9//3//g/+D/4P/g/9//3//e/97/3v/f/+D/4v/k/+b/6f/s/+//8v/z//X/9v/3//f/9//2//b/9f/1//X/9f/2//j/+v/8//7/AAACAAUACAAMAA8AEgAUABcAGgAdAB8AIQAiACMAJAAkACMAIgAhACAAIAAgACIAIwAlACgAKwAvADQAOQA+AEMASABMAE8AUwBVAFgAWgBcAF8AYQBiAGMAZABkAGMAYgBhAGAAXgBdAFsAWgBYAFcAVgBVAFQAVABSAFEATwBOAE4ATgBOAE4ATwBRAFQAVQBXAFcAWABZAFkAWQBXAFQAUABNAEoASABFAEIAPwA7ADcAMwAvACwAKQAnACYAJQAkACMAIgAhAB8AHQAbABgAFQARAA4ACgAHAAQAAgABAAAAAAD+//3//P/6//n/+P/2//T/8f/u/+v/5//k/+D/3v/b/9r/2v/b/9z/3f/f/+D/4f/i/+P/4//i/+D/3v/c/9v/2//b/9v/3P/d/97/4P/i/+T/5v/o/+v/7f/u/+7/7v/s/+r/5//l/+L/3//d/9v/2v/a/9v/3P/e/+D/4//l/+f/6v/t//D/8//2//j/+f/6//r/+f/4//b/9f/z//L/8v/y//L/8//1//f/+v/+/wEABQAHAAkACwANAA8ADwAPAA4ADQALAAgABAABAP3/+f/2//P/8P/u/+z/6//q/+v/7P/u//H/9P/3//r//P///wEABAAHAAgACAAGAAUAAwACAAAA////////AAABAAMABAAGAAkADAAOABAAEQARABAADgAMAAkABgACAP///P/6//j/9//2//b/9f/1//X/9v/2//f/9//4//j/+v/7//z//f/9//3//f/7//n/9//1//L/8P/t/+r/6P/n/+f/6P/q/+3/8P/z//j//P8BAAUACQAMAA0ADgAOAA0ACgAIAAYABAACAAAA///+//7//v/+////AQADAAQABgAHAAgACQAKAAsADAANAA4AEAARABIAFAAVABYAFwAZABsAHAAdAB0AHAAbABoAGQAYABcAFgAVABQAEwAUABcAGgAeACIAJwAtADMAOQA/AEQASABMAE4AUABQAE8ATQBLAEkARgBDAEAAPAA5ADcANgA1ADYANwA5ADsAPgBBAEQARwBJAEoASwBMAEwATABLAEkASABHAEUARQBEAEQARABEAEQAQwBDAEQARQBHAEgASABIAEgARwBHAEYARABCAEAAPwA8ADoANwA1ADMAMgAxADAAMAAxADEAMQAyADIAMwA0ADUANQA0ADMAMgAxAC8ALgAtACwAKwArACsALAAuAC8AMQAzADQANQA2ADcANgA2ADUANAAzADMAMgAwAC4ALAAqACgAJgAkACIAIQAfAB4AHQAcABwAGwAbABwAHAAcABwAGwAbABoAGQAYABcAFgAVABMAEgARABAADwANAAsACAAFAAIAAAD///7//f/9//3//f/9//3//P/6//j/9f/z//D/7v/s/+r/6P/n/+X/5f/k/+T/5P/j/+P/4v/h/+D/3//d/9v/2f/X/9T/0v/R/9D/z//O/83/zf/M/8z/y//L/8v/yv/L/8v/y//K/8n/yf/I/8j/yP/I/8j/yf/J/8r/yv/L/8v/zP/M/83/zf/N/8z/zP/M/8z/y//L/8r/yv/K/8r/yf/I/8f/x//H/8f/x//H/8j/yf/L/83/z//R/9P/1f/W/9f/2P/Z/9n/2v/b/9v/3P/c/9z/2//b/9r/2v/Z/9n/2P/Y/9j/2P/Y/9n/2//c/97/4P/h/+H/4v/j/+T/5v/n/+j/6v/s/+3/7v/u/+3/7P/s/+z/7f/t/+7/7//x//P/9f/3//r//P/9////AAAAAP/////+//7//f/9//z/+//6//r/+v/5//r/+//8//7/AAACAAQABwAKAA0AEAASABQAFQAVABUAFQAUABIAEQAPAA0ACwAKAAgACAAHAAgACQALAA4AEQAUABcAGQAcAB4AIQAjACQAJAAkACMAIgAgAB0AGwAYABYAFAATABMAEwAUABYAGAAaAB0AIAAjACYAKAApACoAKgAqACoAKQAoACcAJwAmACYAJQAlACUAJAAkACMAIgAiACEAIgAiACIAIgAiACIAIQAfAB0AHAAaABkAFwAWABQAEwASABIAEgASABIAEgARABEAEQAQAA4ADAALAAkABgAEAAIAAAD///7//v/+//7///8AAAEAAgACAAMABAAFAAUABgAGAAYABgAFAAQAAwACAAAA/f/7//n/9//2//T/8//y//L/8v/0//X/9v/4//n/+//9//7//v/+//3//P/7//n/9//1//P/8f/v/+z/6v/o/+f/5//n/+j/6v/s/+//8//3//r//v8AAAIAAwACAAAA/f/6//b/8v/v/+v/6P/m/+T/4//j/+P/5f/o/+v/7v/y//b/+f/8//7/AAAAAP///v/8//v/+f/3//X/8//z//P/8//1//f/+v/9/wAABAAHAAkACwAMAAwACwAKAAoACQAIAAcABgAFAAQABAAEAAQABQAFAAYACAAJAAoADAANAA4ADgAOAA0ACwAJAAcABQAEAAMAAwAEAAYACAALAA4AEQAUABcAGgAcAB0AHQAdAB0AGwAZABYAEwAQAA0ADAALAAoACgALAAwADQAOAA8ADwAQABAAEAAQAA8ADgANAAwACwAJAAgABgAEAAIAAAD+//z/+v/6//n/+f/5//n/+f/5//r//P/9//7///8AAAEAAQABAAEAAAD+//3/+//5//f/9f/z//H/8P/v/+//7//w//H/8v/z//T/9v/3//n/+v/6//r/+v/5//j/+P/3//b/9f/0//T/9P/0//X/9f/1//X/9f/1//T/9P/0//X/9f/2//j/+f/6//z//f/+/////////////v/9//z/+//6//n/+P/3//f/9//4//n/+//8//3///8AAAEAAQABAAAA///+//3//P/7//r/+f/5//j/9//2//b/9v/3//f/+P/5//v//f///wEAAgAEAAUABgAGAAYABQADAAAA/f/5//X/8v/v/+3/7P/r/+v/7f/u//H/8//2//n/+//+////AAAAAP///v/8//r/9//1//L/7//s/+r/5//l/+T/4//j/+T/5f/o/+r/7f/w//P/9P/1//T/9P/y//D/7v/s/+n/5//l/+P/4f/g/+D/3//g/+D/4f/j/+T/5f/m/+b/5f/j/+H/3//d/9r/2P/V/9T/0v/R/9D/0P/Q/9D/z//P/87/zf/M/8z/zf/N/87/zv/P/9D/0v/T/9X/1v/X/9j/2P/Y/9j/2P/Y/9j/1//X/9f/1v/W/9b/1//X/9f/2P/Y/9n/2f/a/9v/2//c/97/3//h/+T/5v/o/+n/6v/r/+z/7f/t/+3/7f/t/+z/6//q/+n/6f/o/+j/6f/q/+z/7v/w//P/9v/4//r/+//8//7///8AAAEAAgACAAIAAgACAAIAAgACAAMAAwADAAMABAAEAAUABgAHAAcACAAJAAsADQAOABAAEgAUABYAFwAYABoAGgAbABsAGgAZABgAFwAXABYAFgAVABQAEwATABMAEwAUABUAFwAZABsAHQAfACEAIwAkACUAJgAmACYAJQAjACEAHgAcABkAFgATABEAEAAPAA4ADgAOAA8AEAARABIAEwAUABUAFQAWABYAFgAWABYAFgAWABUAFAASABEADwANAAoACAAGAAQAAwACAAMAAwAEAAUABgAHAAcACAAIAAcABwAGAAQAAwABAP///f/8//v/+v/5//n/+P/4//j/9//2//X/9f/1//X/9v/2//f/+f/6//v//P/+//////8AAAAAAAD///7//P/7//r/+f/4//f/9v/2//b/9v/2//f/9//4//j/+f/6//v//f/+//////8AAAAAAAAAAP///f/7//r/+P/3//b/9f/0//P/8v/y//H/8f/x//L/8v/z//T/9P/1//X/9v/2//b/9v/2//X/9P/0//P/8v/y//H/8f/w//D/8P/w//H/8f/x//L/8v/y//L/8f/w/+//7v/t/+z/6//q/+r/6v/p/+n/6f/p/+n/6v/q/+v/6//r/+v/7P/s/+z/6//r/+v/6//r/+v/7P/s/+3/7v/v/+//7//v/+//7//w//D/8P/x//H/8f/y//L/8v/x//H/8P/w/+//7//w//H/8v/0//b/+P/6//3///8CAAQABQAGAAcABwAHAAgACAAIAAkACQAKAAoACgAKAAsACwAMAA0ADgAPABAAEgAVABcAGgAdAB8AIgAkACUAJgAoACgAKQApACgAKAAnACYAJQAlACUAJQAmACYAJwAoACkAKgArAC0ALgAvADAAMQAyADMANAA0ADQANAA0ADMAMgAwAC4ALQAsACsAKgAqACkAKQAqACsAKwArACwALAAsACwALAArACoAKQAoACYAJQAjACEAIAAeABwAGwAZABcAFQATABEAEAAPAA4ADgANAAwACwAKAAkACAAIAAgACAAIAAcABwAHAAYABgAGAAYABQAEAAMAAQAAAP7//P/6//j/9//1//P/8v/x//D/7//u/+3/7f/r/+r/6f/o/+f/5v/l/+T/4//j/+L/4v/h/+H/4P/e/97/3f/c/9v/2//b/9v/2//c/9z/3f/d/9z/3P/b/9r/2f/Y/9j/1//X/9f/2P/Z/9r/2v/b/9z/3P/d/97/3//f/9//3//g/+D/4P/g/+H/4f/h/+L/4v/i/+L/4v/i/+L/4f/h/+H/4f/i/+L/4//k/+T/5f/l/+X/5f/l/+T/5P/j/+H/4f/g/+D/4P/g/+H/4v/j/+X/5//o/+r/6//s/+3/7v/u/+7/7f/t/+z/7P/q/+n/5//l/+T/4//i/+L/4v/i/+P/5P/m/+f/5//o/+j/6P/o/+j/5//m/+X/5P/j/+L/4f/f/97/3v/d/93/3f/d/93/3v/f/9//4P/g/+D/4P/g/+D/4P/f/9//3//e/97/3v/d/93/3f/d/97/3//g/+H/4//k/+b/6P/p/+r/7P/s/+3/7f/t/+3/7f/t/+3/7v/v//D/8f/z//T/9v/4//r//P/9////AQACAAQABQAGAAcACAAJAAoACwAMAA0ADgAPABAAEgAUABcAGQAcAB8AIgAkACYAKAAqACwALgAvADAAMQAxADIAMwA0ADUANgA4ADkAOwA8AD4APwBAAEEAQwBEAEUARgBHAEcASABJAEkASgBKAEsATABMAEwATABLAEsASwBLAEwATABNAE0ATgBPAFAAUABRAFEAUQBRAFEAUABPAE4ATQBMAEoASQBIAEgASABIAEgASQBJAEoASgBKAEkASQBIAEcARgBEAEMAQQA/AD0APAA6ADkANwA1ADQAMwAyADEAMQAwADAALwAuAC0AKwAqACkAKAAmACUAIwAiACEAIAAfAB0AHAAaABkAFwAVABMAEgAQAA8ADgAOAA0ADQAMAAwACwALAAsACgAKAAkACQAHAAYABAACAAAA///9//z/+//6//r/+f/5//n/+v/6//r/+f/5//j/+P/3//b/9v/1//X/9f/1//T/9P/z//L/8P/v/+3/7P/r/+r/6v/q/+v/6//t/+7/7//w//D/8P/w//D/8P/v/+//7v/t/+3/7f/t/+3/7f/t/+3/7f/t/+3/7f/t/+3/7f/t/+z/7P/s/+z/7P/s/+v/6//q/+n/6P/n/+b/5f/k/+P/4v/i/+L/4v/i/+P/5P/l/+b/5//o/+j/6P/o/+f/5//n/+b/5v/m/+b/5v/m/+b/5v/n/+f/6P/o/+j/6P/o/+f/5//m/+b/5v/m/+b/5v/m/+b/5f/l/+T/5P/l/+X/5v/m/+f/5//o/+j/6f/q/+v/6//s/+3/7f/t/+3/7v/u/+7/7//w//D/8f/x//L/8v/y//P/9P/1//b/9//3//j/+P/4//n/+f/5//n/+f/5//n/+f/5//n/+v/6//v//P/9//7/AAABAAIAAwAEAAUABgAHAAcACAAIAAkACgAMAA0ADgAQABEAEQASABIAEwATABQAFQAXABgAGQAaABoAGwAbABsAHAAcAB0AHwAgACIAIwAlACYAJwAoACkAKgAqACoAKgAqACoAKQAoACYAJQAkACIAIQAgACAAHwAfACAAIAAhACEAIgAjACQAJAAlACUAJQAlACUAJQAjACIAIAAeABwAGwAZABgAFwAXABYAFgAWABYAFwAXABcAFwAYABgAGAAXABcAFgAVABMAEgAQAA8ADQAMAAsACQAIAAcABgAFAAQAAwADAAIAAgABAAEAAAAAAP////////////////7//f/9//z/+//6//n/9//2//X/8//y//H/8P/w//D/8P/x//H/8v/y//L/8v/y//L/8f/v/+3/7P/q/+j/5v/l/+T/5P/k/+X/5v/n/+j/6f/q/+v/7P/t/+3/7v/u/+3/7f/s/+v/6v/p/+f/5v/l/+T/4//j/+L/4v/j/+T/5f/m/+f/6f/q/+v/7P/t/+3/7v/v/+//7//v/+//7v/u/+7/7v/u/+7/7v/u/+7/7//v//D/8P/x//H/8v/y//P/8//0//T/9P/0//T/9f/2//f/9//4//j/+P/3//f/9v/2//X/9P/z//P/8//y//L/8//0//X/9v/3//j/+P/5//n/+f/5//n/+f/4//f/9v/1//T/8//y//L/8v/y//P/9P/1//X/9v/3//j/+f/6//v/+//8//z//P/8//z//P/8//v/+//7//v/+//7//v/+//8//z//f/+////AAABAAIAAgADAAQABQAGAAYABwAHAAcABwAHAAcABwAHAAYABgAGAAYABgAGAAcABwAIAAkACgAMAA4ADwARABIAEwAUABUAFgAWABYAFgAVABUAFAATABIAEgARABEAEQASABIAEgATABQAFQAWABcAGAAZABoAGwAbABoAGgAZABkAGQAYABgAFwAXABYAFgAWABYAFgAWABcAFwAYABgAGQAZABoAGgAbABsAGwAcABwAHAAcABsAGwAaABkAGAAYABcAFgAWABUAFQAVABUAFAAVABUAFQAUABMAEgASABEAEAAPAA4ADQALAAoACgAJAAgABgAFAAQAAwACAAEAAAD+//3//P/7//v/+v/5//j/9//3//b/9v/1//T/8v/x/+//7v/s/+r/6f/n/+b/5f/k/+P/4//j/+P/4//j/+P/4//j/+P/4v/i/+H/4f/g/9//3v/d/9z/2//a/9n/2f/Z/9j/2P/Y/9j/2P/Y/9j/2P/Y/9j/2f/a/9v/2//b/9v/2//b/9r/2v/a/9r/2v/a/9r/2v/a/9v/2//c/93/3v/f/+D/4P/g/+H/4f/i/+L/4v/i/+L/4f/h/+H/4f/g/+D/4P/g/+D/4f/h/+L/4//k/+X/5v/n/+j/6f/q/+r/6//r/+v/6//r/+v/6//r/+v/7P/s/+3/7v/v//D/8v/z//T/9f/2//f/9//3//j/+P/4//n/+f/5//r/+v/6//r/+v/6//v/+//7//z//P/8//z//f/9//7//v///wAAAQACAAIAAwAEAAQABQAFAAYABgAFAAUABAAEAAQABAAEAAQABQAFAAUABQAFAAUABgAGAAYABgAGAAcABwAHAAgACAAIAAgACQAJAAoACgALAAsACgAKAAoACQAJAAkACAAIAAgACAAIAAgACAAJAAoACwAMAAwADAAMAA0ADQANAA0ADQAOAA4ADgAPAA8ADwAQABAAEQARABIAEgATABMAEwATABMAEwATABMAEwATABMAEwASABIAEwATABMAEwATABMAFAAUABQAFAAUABQAFAAUABQAEwATABIAEQAQAA8ADgANAA0ADAALAAsACwALAAoACgAKAAoACwALAAsACwAKAAoACgAKAAkACQAIAAgABwAGAAUABAADAAIAAQAAAP/////+//7//v/+//3//f/9//3//v/+//7//v/+//3//f/8//v/+//6//r/+f/5//r/+v/6//r/+//7//v//P/8//z//P/7//r/+v/5//n/+P/4//j/+P/4//j/+P/4//j/+P/4//j/+P/4//j/+P/4//j/+P/4//f/9//2//b/9f/1//X/9P/0//T/9P/0//T/9f/1//X/9f/1//X/9f/1//T/9P/z//P/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8//0//T/9f/1//b/9v/2//b/9v/2//b/9v/2//X/9f/2//b/9v/3//f/9//4//j/+P/4//j/9//3//f/+P/4//n/+v/7//v//P/8//z/+//7//v/+v/5//j/9//2//X/9P/0//T/9P/0//T/9P/1//X/9v/2//b/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//j/+P/5//r/+//8//z//f/+////AAAAAAEAAgACAAIAAwADAAMAAwADAAMAAwAEAAQABQAGAAYABwAHAAgACQAKAAsADAAMAA0ADgAOAA8ADwAPAA8ADwAQABAAEAAQABAADwAPABAAEAAQABAAEQARABIAEwATABQAFQAVABYAFgAXABcAFwAXABcAFwAWABYAFgAWABUAFQAVABQAFAAUABQAFAAUABQAFAAVABUAFgAWABYAFgAWABYAFQAVABQAFAATABIAEQAQAA8ADgAOAA4ADgAOAA8ADwAQABEAEQARABIAEgASABIAEgARABAAEAAPAA4ADQAMAAsACgAKAAoACgAKAAoACgAKAAsACwALAAsACwAKAAoACQAIAAcABgAEAAMAAgABAAAA//////7//v/+//7//v/+//7//v/+//7//v/9//3//P/7//r/+f/4//f/9v/2//b/9v/2//b/9//3//f/+P/4//j/+P/4//f/9//2//b/9f/0//T/9P/0//P/8//z//T/9P/1//b/9v/3//f/9//3//b/9v/2//b/9v/2//X/9f/1//X/9f/1//X/9v/2//b/9//3//j/+P/4//j/+P/4//j/+P/4//f/9//3//b/9v/2//b/9f/1//b/9v/2//f/9//4//j/+f/6//r/+v/7//r/+v/6//r/+f/5//n/+f/5//n/+f/5//r/+v/6//v/+//8//z//P/9//3//f/9//3//f/9//3//f/9//z//P/8//z//P/9//3//f/9//7//v/+/////////wAAAAAAAAAAAQABAAEAAQACAAIAAgADAAMABAAEAAUABQAGAAYABwAHAAcABwAIAAgACAAIAAgACAAIAAgACQAJAAoACgALAAsADAANAA0ADQANAA0ADQANAA0ADQANAAwADAAMAAwADAAMAA0ADQAOAA4ADgAOAA4ADgAPAA8ADwAPABAAEAAQABEAEgASABMAEwATABQAFAAUABQAFAATABMAEwASABIAEgASABMAEwATABQAFAAUABUAFQAVABUAFQAVABUAFQAVABQAFAAUABQAFAAUABQAFAAUABQAFAATABMAEgASABEAEQARABEAEQARABEAEgASABIAEgASABIAEgARABEAEAAQAA8ADwAOAA4ADgAOAA4ADgAOAA0ADQANAA0ADAAMAAwACwALAAsACgAKAAkACQAJAAgACAAHAAcABgAGAAUABAADAAMAAgACAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAD////////+//7//f/8//z/+//7//r/+v/6//n/+f/5//n/+f/5//n/+f/4//j/+P/4//j/+P/4//j/+P/3//f/9//2//b/9v/1//X/9P/0//T/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8v/y//L/8v/x//H/8f/x//D/8P/w//D/8P/w//D/8P/w//D/8P/x//H/8f/y//L/8v/y//P/8//z//P/8//z//P/8//y//L/8v/y//H/8f/x//H/8f/y//L/8v/z//P/8//0//T/9P/0//T/9P/0//T/9P/0//T/8//z//P/8//z//P/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/y//L/8v/x//H/8f/w/+//7//u/+7/7v/u/+7/7v/u/+7/7//v//D/8f/x//H/8v/y//L/8v/y//L/8v/x//H/8f/x//H/8f/x//H/8f/x//H/8v/y//L/8//z//T/9P/1//b/9v/3//f/9//3//j/+P/3//f/9//3//f/9//3//j/+P/4//n/+v/6//v//P/9//3//v/+//////8AAAAAAAABAAEAAQACAAIAAgADAAMAAwADAAMAAwAEAAQABAAEAAUABQAGAAYABwAHAAgACQAJAAkACgAKAAoACQAJAAkACQAJAAkACQAJAAkACQAKAAoACwALAAwADAANAA0ADQANAA0ADQANAA0ADQANAA0ADQANAA0ADQANAAwADAAMAAwADAAMAAsACwALAAsADAAMAAwADAANAA0ADQANAA0ADQAMAAwACwALAAoACgAJAAkACQAIAAgACAAIAAgACAAIAAgACAAIAAcABwAHAAcABwAHAAYABgAGAAYABgAFAAUABQAFAAUABQAEAAQABAAEAAQABAAEAAQABAAEAAQABAAFAAUABQAFAAUABgAGAAYABgAGAAcABwAHAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAYABgAGAAcABwAHAAcABwAHAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAGAAYABgAGAAYABgAGAAYABQAFAAUABQAFAAUABAAEAAQABAADAAMAAwADAAIAAgACAAIAAgACAAEAAQABAAEAAQAAAAAAAAAAAAAA/////////////////v/+//7//v/+//7//f/9//3//f/9//3//P/8//z//P/8//z//P/8//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//r/+v/6//r/+v/6//r/+f/6//r/+v/6//r/+v/6//v/+//7//v//P/8//z//P/8//3//f/9//3//f/9//3//f/+//7//v/+//3//v/+//7//v/+//7//v/+//7//v////////////////////////////////////////////////////////////////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAQABAAEAAQABAAEAAQABAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP////////////////7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//3//f/9//3//f/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+v/6//r/+v/6//r/+v/5//n/+f/5//n/+f/5//n/+f/5//n/+f/6//r/+v/6//r/+v/5//n/+f/5//n/+f/5//n/+f/5//n/+f/5//n/+f/5//n/+f/5//n/+f/5//r/+v/6//r/+v/6//r/+v/6//n/+f/5//n/+f/5//n/+f/5//r/+v/6//r/+v/7//v/+//7//v/+//7//v//P/8//z//P/8//z//P/8//z//P/8//3//f/9//3//f/9//7//v/+////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAQABAAIAAgACAAIAAwADAAMAAwADAAMABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAEAAQABAAEAAQABAAEAAQABAADAAMAAwADAAMAAwADAAMAAwADAAMAAgACAAIAAgACAAIAAgACAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAAAAAAAAAAAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD///////8AAAAAAAD//////////////////////////////v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//v/+//7//v/+//7//v////////////////////////////////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAEAAQABAAEAAQABAAEAAQABAAEAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAAAAAAAAAAAAAAAAAAA//////////////////////////////////////////////////////7//v/+//7//v/+//7//f/9//3//f/9//3//f/9//3//f/9//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/7//v//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/8//z//P/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/9//3//f/+//7//v/+//7//v/+//7//v/+//7//////////////////////////////wAAAAAAAAAAAAAAAAAAAAAAAAEAAQABAAEAAQABAAEAAQABAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////+//7//v/+//7//v/+//7//v/+//7//////////////////v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v/+//7//v//////////////////////////////////////////////////////////////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP////////////////////8AAAAAAAD//////////////////////////////////////////////////////////////////////////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAD///////////////////////8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="},"audio.destroy-light":{"mime":"audio/wav","bytes":43244,"sha256":"b7f5836a2b207d984cf324b3eb2633c5c2971c313a640d1e0f0f2fb56bae7788","source":{"kind":"core","recordingSha256":"b7f5836a2b207d984cf324b3eb2633c5c2971c313a640d1e0f0f2fb56bae7788"},"base64":"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dQB/AIkAhABwAGoAfwClAMsA3gDRALEAiQBnAE8APAA1ADoASwBkAHMAbQBuAIgApwC+AM8A4QDrAOMA0gDBALYAwgDiAAoBMAFNAWoBhgGcAaUBnQGJAWoBSgErAQkB5AC6AIYATAAZAPX/8f8PAC4APABCAE8AWQBQADgAGQADAAMAFAAlAC8AJgALAOv/0v/G/8f/zf/J/xIALgFxAvoC9QLCAo4CZgJIAiwCCALmAc0BswGSAXUBXwFIASkBCwH/AAQBHgFAAVABRwExARcB9QDIAK8AuQDKAMIArQCmAKsArQCmAJUAgABtAFsARQAnAAsA7//S/73/rP+V/3//gf+d/7L/uP/X/xMAQQBRAE0APQA1ADwASgBVAFgATgBAAEQAWgBkAFkARgAyACUAIwAkABkABQDx/+T/5/8NAGMAwADuAO4A4wDgAOgA9wD7AOgAwgCZAHoAaQBdAFIASABCAD8AOgA0AC8ALAAqACgAKwA+AFEATQA/AEAASgBIADoALwAtADIAPQBHAE0ASQA4ACcALwBOAHMAkACSAH4AdACEAJcAkgCGAIsA1QChAX8C8QIJA/YC3ALRAtgC6QL5AgQDDgMUAxUDEwMPAw8DFAMYAxoDHQMqAzwDQgM4AyID8wJ0ApkB1wCEAIAAmgCqAJsAewBbAEAANQA6AEIAQwA/ADYAKAAQAPT/5//o/+P/z/+3/6L/nP+r/8n/6f/9/wYAAgDu/9v/3v/s/+n/2P/O/83/xf+z/6L/k/+O/5b/pv+6/9D/3v/i/9b/uf+Y/4P/uf9BALQA3wDgANEAvAChAIYAaQBNAE0AYABlAFcASgBNAFgAXgBlAHgAhwB5AGAAVwBZAFMAYgDGAF0BuQG/AZgBZAE7ASABFwEfASUBFgH9APgABgERAQ8BAgHuAOUA7wACARsBMgE5ATQBLwE5AXABxAH+AQMC5gHCAaUBkQGMAZgBoAGZAYcBbwFYAUYBNQEtAS4BLgErASQBGQEOAQkBBgHtAOAALAGhAdsB1wG5AZcBggF9AYQBlAGdAZABcwFXAUABLQEdARgBIgEwATkBMgEZAfkA4ADQAL0AogCGAG4AXgBUAEkANwAhAAoA/v8FABUAHgAeABkAEAABAOz/2f/G/8H/0v/h/9r/x/+5/7T/uv+7/6D/dv9X/0v/V/9x/4T/i/+I/4L/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XwBmAGYAXwBXAE8ATABLAE4AWgBkAGMAXABSAEkARgBJAE0ATgBLAEQAOgAuACcAKQA0AEAASABGAD8APwBJAFcAZgBtAGoAYgBZAFAASABDAEAAOgA1ADcAPgBGAEsASQA/ADkAPABFAFEAcQCxAPIADAEGAf8ABAEHAQQB/QD0AOwA4wDaANoA4ADjAOMA3gDSAMYAvQC3AK8ApQCgAKUArgC1AMwA+wAgASYBGgENAQQB/wD+AP8AAgH/APMA5gDiAOUA5wDlAN0A0ADEAL0AuACvAKYApACqALIAvADGAM8A2ADjAOgA4QDZANcA2QDaANUAygC8ALEAqgCjAJwAlQCWAJ4AowChAJ0AmwCYAJAAhAB8AGAACgCm/3X/cP92/3b/cv9y/3b/ef98/33/fP9//4j/kP+S/5T/mv+l/7D/uP+8/77/v//B/8L/vf+z/6j/n/+i/6z/sP+t/6j/n/+a/6D/q/+0/7r/uv+y/6z/sP+2/7b/s/+0/7r/vf+6/7T/rf+q/67/s/+z/6//r/+z/7n/vv/F/87/1//h/+v/8f/y//D/7P/s//P//f8DAAUAAgD9//n/9//0/+7/6v/s/w4AZADFAPYA+gD0APEA8ADrAOcA5gDlAN0A0gDOANIA2ADdAOAA5ADmAOUA4QDYAM0AwgC4ALAArACnAJsAkACIAIMAgwCDAIIAfgB6AHkAeAB0AG8AcAB1AHsAgACGAIsAjQCOAIsAhAB6AHQAdAB0AG8AXAA0ABEACQARABwAJgAsADAAMQAwAC0AJwAgABgAEAAHAP7/9//w/+r/6P/p//D/+P/5//L/6v/b/7v/kP9x/2z/dP98/4L/hf+F/4T/gP9//4L/iP+Q/5f/n/+p/6//sP+v/6//sv+5/8L/yf/L/8r/xf+0/5b/fP9t/2n/cP98/4T/iv+N/43/jP+K/4j/hP+A/3//g/+E/4D/e/91/3H/cv93/3j/dv91/3z/pv///1QAdgB0AGwAawBuAHEAcABpAGEAWwBWAFMAUABMAEkARQBBAD4APAA7ADkANwA2ADQANAA4AD8ARwBMAEwASwBGAEAAPwBDAEgATQBQAFQAWABdAGEAYgBiAGIAZQBmAGEAWgBWAFUAUwBNAEcAQwA8ADAAJgAjACQAKQAuADIANQA3ADoAOwA5ADUAMwAzADUAOAA5ADUAMgA0ADcANgAwACsAKAAmACIAGwATAA0ABwABAPz/9//1//X/9v/5//v//P/7//j/8v/s/+X/3//Z/9X/0P/K/8T/v/+8/7v/vP+//9b/HgBpAIYAggB7AHgAeAB4AHUAcQBsAGcAYQBdAFwAWQBUAE8ATQBMAEcAQAA9AD8AQgBCAEAAPwBGAGAAfgCIAIMAfgB8AH0AfQB9AHwAegB6AHoAeABzAGwAZABfAF8AYQBjAGQAZABgAF0AWgBZAFoAYAByAIoAmgCdAJkAkACJAIUAhACGAIcAgwB9AHcAcABqAGcAZQBjAGIAXwBcAFYATwBJAEYARABAADcAEADS/6b/mP+Z/5z/nv+e/57/nP+a/5r/nP+g/6T/p/+m/6T/of+e/5r/mP+W/5b/mP+c/6L/pf+l/5r/hP9y/23/cP90/3j/ff+D/4f/if+J/4r/i/+N/5D/kf+P/4z/if+I/4v/j/+U/5j/nP+f/6D/nv+V/4P/df9y/3X/d/93/3n/fv+E/4n/j/+V/5r/nv+i/6X/qP+p/6j/qP+r/6//s/+2/7r/vf/A/8T/wP+r/5X/jf+Q/5b/nP+e/53/nf+f/6P/qP+r/63/rf+v/7L/tf+1/7T/tf+5/77/wv/F/8f/x//G/8f/0f/f/+f/6f/p/+b/4//g/97/3P/b/9v/3P/c/9r/2P/Y/9n/2f/Z/9n/3P/f/+D/4f/h/+H/4f/i/+P/5f/l/+P/4//k/+f/6f/o/+f/5//n/+j/6f/r/+7/7//v//D/8v/z//L/8P/u/+z/6//r/+r/6//v//f/AAACAAIAAwAEAAUABQAEAAMAAQAAAP7//f/8//z//f///wEAAwAEAAQABAAFAAUABgAGAAUABgAMABMAFwAWABQAEgARABEAEQASABEAEQAPAA0ACwAKAAgABgAGAAcACAAKAAsADQAOAA0ADQAMAAsAAwD5//L/7//v/+//8P/w/+//7//w//D/8P/w//D/7//w//H/8v/z//T/9P/0//T/9P/1//X/9v/3//j/+//9//3//f/8//z//f/+/////////wAAAQABAAEAAQAAAAAA///+//3//f/9//z//P/8//v//P/8//v/+v/6//r/+//7//r/+v/6//r/+v/6//v/+//7//v/+//8//z//P/8//z//f/9//3//v/+//////8AAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAAAAAAAAAAAAAA="},"audio.destroy-heavy":{"mime":"audio/wav","bytes":72044,"sha256":"84b26977fc5779e551dcae00acb30ec473fb4a6b275f3c7903d6e30c9e1aedc7","source":{"kind":"core","recordingSha256":"84b26977fc5779e551dcae00acb30ec473fb4a6b275f3c7903d6e30c9e1aedc7"},"base64":"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+f77/v3+//4B/wT/B/8G/wH//f78/v7+Av8H/w//Gf8j/yr/L/8y/zL/L/8r/yn/Kv8t/zD/M/80/zb/OP8x/xb/7f7L/rr+uf6//sv+2f7m/u/+9v77/gH/Cv8U/x3/I/8n/yz/Lv8s/yv/K/8v/zT/OP85/zj/OP86/z//RP9H/0j/Sv9N/1H/Vf9c/2b/cv96/4H/hf+J/5H/nP+l/6v/sP+0/7T/sP+t/63/sf+1/7n/vf+//8H/xf/J/83/0f/U/9b/2v/d/+H/5f/p/+z/7//z//f/+/8BAAcADgAUABYAEAABAPL/6//s//D/9P/2//j/+v/+/wIABwANABIAFgAbAB8AJAAoACkAKAApACwAMAA1ADsAQQBHAEwAUQBWAFoAXgBhAGUAaQBuAHQAewCEAIsAkACUAJcAmgCbAJwAnQCgAKQAqQCxALwAxQDMANAA0QDRAM4AzADLAMwAzgDSANcA3ADhAOUA6ADrAPEA+gADAQgBCwENAQ4BDAEJAQYBBgEIAQkBCQEJAQoBCwEMAQ8BFAEYARwBHgEfASIBKQEzAToBPQE+ATwBNwEuASYBIwEiASIBIQEfARsBFwEUARMBEwETARMBEwESARIBEgEPAQoBBAH/APwA+wD7APsA/AD8APsA+gD5APoA/gABAQMBAwECAQAB/wD+AP0A/AD7APkA9wDzAO0A6ADlAOIA4ADhAOQA5gDlAOQA4gDdANYAzwDJAMUAsgB5ACIA1v+s/6D/ov+p/67/sf+y/7P/s/+1/7n/v//D/8b/x//I/8r/zP/O/8//z//O/8r/wv+6/7X/s/+z/7T/uP/A/8j/y//M/8z/yv/H/8P/wP+//77/v//A/8H/wv/D/8P/w//G/87/1f/Z/9v/2//b/9z/3//i/+P/5P/k/+D/2f/R/8v/yP/I/8j/yv/L/8z/zf/N/87/0f/X/93/4P/j/9r/qf9a/x//Bf8B/wf/D/8X/xz/H/8i/yT/J/8q/y7/Mv81/zj/Ov84/zT/Mf8x/zT/N/83/zT/MP8w/zH/NP83/zz/Qv9I/0z/T/9S/1X/Vv9Y/1r/Xf9f/2P/aP9v/3X/ev99/3//hP+L/5L/l/+a/5z/nv+j/6v/sv+2/7n/uv+5/7T/rv+s/6z/rv+v/6z/p/+k/6T/pf+n/6j/pv+l/6X/qf/S/z0AzQA/AXYB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CQAOABMAGAAdACEAJgAqAC4AMgA2ADoAPQA/AD0AOwA6AEEAXgCUANAA+QAMARABDwEPARQBGgEeASEBIwElAScBKgEsAS4BMAExATUBOwFDAUkBTQFOAU4BTAFJAUcBRgFHAUkBTAFOAVEBVAFWAVcBVwFVAU8BSQFHAUYBRwFIAUoBTAFNAU0BTgFPAU8BTgFNAU0BTAFMAU0BTAFKAUcBRAFEAUQBRAFEAUQBRAFDAUMBQgFEAUkBTQFPAU8BTgFNAU0BTQFNAU0BTQFSAVwBZgFrAWwBagFnAWMBXQFYAVUBUgFQAUwBQgE4ATABLAEqASgBJAEeARYBEQENAQsBCgELAQ0BDgENAQsBCAEEAfsA8QDoAOQA4QDfAN4A3wDfAN0A2gDXANMAzADEALwAtgCyAK8ArQCqAKYAowCgAJwAmQCXAJcAlwCVAJMAkACLAIUAfQB3AHIAbgBrAGgAYwBeAFkAVQBRAE0ASABBADoANQAwADQASwBqAH4AgwCBAHsAdgByAG8AawBnAGMAXgBWAEwAQwA8ADcAMwAwAC4AKwAoACQAIAAcABUACwABAPr/9f/x//D/8//3//j/9//z/+//6//l/+D/3P/Y/9X/0f/K/8D/uP+y/6//rf+r/6v/q/+q/6n/p/+k/5//lf+N/4j/hf+E/4X/h/+M/5D/kf+Q/47/jP+K/4n/h/+G/4X/g/+C/4L/gf+A/4D/e/9u/1//Vv9T/1L/Uv9Q/0z/R/9E/0L/Q/9F/0n/T/9U/1b/V/9X/1b/UP9I/0P/Qv9C/0P/Qv8//z3/Pf8+/0D/QP89/zj/NP8z/zP/Nv86/z//RP9I/0r/S/9M/1D/WP9g/2T/Z/9p/2r/bv9y/3X/dv93/3j/ev98/37/gP+C/4P/hP+F/4f/iP+J/4v/jP+M/4v/iP+H/4j/if+L/4z/jf+P/5D/kf+C/1L/Dv/V/rr+tf66/sP+yv7Q/tT+2P7c/uD+5/7x/vv+Av8G/wn/DP8R/xn/IP8l/yn/LP8x/zj/P/9F/0n/TP9O/1D/UP9Q/1D/Uv9U/1X/Uv9N/0v/TP9O/1H/U/9U/1X/Vv9Y/1r/W/9a/1f/Vf9U/1b/WP9b/2H/av9y/3b/ef96/3r/ev95/3r/e/99/3//g/+I/43/kP+S/5P/kv+P/4v/iP+I/4j/hf95/27/af9o/2r/b/93/4D/hv+K/4v/jP+L/4r/h/+G/4f/iP+K/4z/jf+O/4//kP+R/5P/mf+i/6j/rP+u/6//rv+r/6b/ov+h/6H/o/+k/6b/p/+o/6r/q/+s/6r/pf+h/6D/oP+i/6b/rP+y/7f/uf+7/7z/v//E/8n/zv/Q/9L/0//T/8//y//K/8v/zP/P/9X/3P/h/+T/5v/n/+b/5P/g/93/3f/f/+L/5f/o/+r/7f/v//H/8v/z//T/9v/4//n/9//z/+//7v/w//L/8//0//P/8//z//X/+P/+/wYADgAUABcAGQAbAB4AJQArADAAMwA0ADYAOAA6ADwAPgBAAEMARgBMAFMAWQBcAF4AXwBgAF8AXQBcAF0AXgBfAF8AXwBeAF8AYQBjAGMAYQBdAFoAWQBaAF0AXgBcAFkAVwBWAFcAWQBeAGYAbQBxAHQAgAChAM0A8AACAQYBAwEAAf0A+gD5APgA+AD3APYA9ADyAPEA7wDuAOwA5wDhAN4A3ADaANoA2wDeAOEA4wDjAOIA4QDgAOEA4gDhAOEA3wDeAOEA5ADmAOYA5QDjAOEA4ADfAN4A3QDbANkA2gDcAN4A3gDdANsA2ADYANoA2wDaANgA1gDTANAAzADJAMYAwwDCAMEAwQDCAMEAvwC9ALsAuQC5ALkAuAC2AMYA6wAOAR8BIgEeARcBEQEMAQcBAwH/APsA+AD0APEA7gDrAOcA4wDgAN4A3QDaANcA0wDPAMsAxwDDAL8AvAC4ALUAsACrAKYAogCeAJoAlwCVAJMAkQCOAIoAhwCFAIUAhwCHAIYAgwB/AHsAeAB0AHAAbQBpAGcAZwBpAGoAaQBmAGIAXwBfAGEAYgBhAF8AWwBVAE4ARwBBAD0AOgA4ADQALwAqACcAIwAYAAMA7v/i/93/3P/c/9z/3f/f/9//3v/c/9v/2//d/+D/4P/f/97/2//Y/9X/0v/Q/8//zv/N/83/zf/N/83/zP/M/87/0v/V/9f/1//W/9T/0v/P/83/y//K/8n/x//E/7//vP+6/7n/uP+3/7b/tP+z/7P/s/+z/7D/q/+m/6T/pP+k/6X/pf+m/6b/pv+n/6j/qf+q/6z/rf+u/67/r/+v/63/q/+q/6r/qP+g/5P/iP+C/4H/g/+D/4L/gf+B/4L/hP+G/4j/if+K/4z/jv+Q/5L/lv+Z/53/n/+h/6P/pP+k/6P/o/+k/6b/qP+r/7H/t/+7/77/wf/C/8P/w//D/8X/x//J/8z/z//T/9b/2P/a/9z/4P/m/+3/8//2//n/+v/6//n/+P/5//r//P///wQACgAQABQAFgAXABgAGwAeACAAIgAkACYAJgAkACIAIgAjAC0ATwCCALEAywDTANMAzwDIAMEAuwC5ALgAtwC3ALcAtgC2ALUAtQC1ALUAtgC3ALcAtwC2ALUAtgC5ALwAvgC+AL0AvAC8ALsAuwC6ALkAuAC4ALgAuAC4ALcAtwC2ALUAtgC3ALcAtgC1ALQAtACzALMAsgCxALAArwCsAKkApwClAKMAogChAJ4AmwCYAJYAlQCUAJYAmgCdAJ4AngCcAJoAlwCUAJAAjgCMAI0AkgCZAJ4AnwCeAJwAmgCZAJcAlgCUAJIAkQCQAJAAkACPAI4AjACKAIsAjACOAI0AiwCIAIQAfQB2AHEAbgBsAGoAaQBpAGgAZwBmAGQAYwBgAF0AWgBXAFQAUgBQAE0ASABEAEAAPQA7ADsAPAA/AD8APwA9ADsAOQA3ADYANAAxAC8ALAArACsAKwArACkAJwAlACIAIAAeABsAGQAXABMADQAGAAAA/P/5//H/4v/R/8X/v/+9/7z/uf+1/7H/r/+u/6z/q/+p/6f/pf+j/6L/of+g/5//nv+d/5z/m/+a/5n/m/+e/5//n/+e/53/nP+a/5j/lv+V/5T/k/+R/47/jP+L/4r/if+I/4X/gP98/3r/ef95/3r/ff+A/4H/gf+A/3//f/+A/4H/gf+B/4D/f/9//4D/gP+A/4D/f/9+/37/fv99/33/fP97/3r/e/98/3z/e/97/4H/kP+d/6L/o/+g/53/m/+Y/5b/lP+S/5H/jf+I/4P/fv98/3v/ev94/3P/bv9r/2n/Z/9n/2f/aP9q/2r/av9p/2j/Z/9n/2j/Z/9n/2b/Zf9l/2b/Zv9l/2T/Y/9h/13/Wf9V/1T/U/9S/1L/Uv9R/1H/UP9P/07/Tf9M/0v/Sv9J/0j/R/9E/0H/P/89/zz/PP87/zf/M/8v/y7/Lf8t/y7/MP8z/zb/Nv8o/wL/zP6h/oz+iP6M/pL+mf6f/qT+p/6p/qr+q/6r/qv+q/6t/q/+sf60/rj+vP7A/sL+xf7G/sb+xP7D/sT+xv7J/sz+0P7V/tr+3f7g/uL+5P7m/uf+6P7q/u3+7/7y/vb++v7+/gH/BP8G/wr/EP8V/xn/HP8f/yH/Jf8q/y7/Mv81/zj/Ov86/zr/Ov87/z3/QP9D/0b/R/9J/0v/Tv9R/1T/Vf9W/1j/W/9e/2P/af9v/3P/d/96/33/gv+I/43/kv+V/5n/nP+g/6X/qv+u/7L/tf+3/7r/vf/A/8P/xv/J/83/0v/X/9v/3v/h/+T/5v/o/+v/7v/x//T/9//6//3/AAADAAYACQAMAA0ADgAOAA8AEQAUABgAGwAfACIAJQApACwAMAA1ADsAPwBDAEYASQBMAE8AUwBXAFoAXQBgAGIAYwBlAGcAaQBsAG4AcABxAHMAdQB5AIEAjgCdAKgArgCwALIAtAC4AL0AwQDDAMUAxwDJAMwAzwDRANMA1QDWANUA1QDUANUA1gDYANoA3QDiAOUA5wDoAOkA6gDqAOoA6gDqAOsA7ADuAPIA9gD5APsA/AD8AP4AAQEEAQcBCAEJAQoBCwEOARABEgESARIBEgETARUBFgEXARcBFgEWARYBFgEWARYBFgEVARQBEgEOAQsBCQEIAQcBBgEFAQIBAQH/APgA5wDPALwAswCwALEAsgCxAK4ArACqAKoAqQCoAKYAowCgAJ8AngCdAJwAmQCVAJIAkQCQAI8AjgCMAIoAiACHAIUAhQCFAIUAhQCFAIQAgwCBAIAAgACAAH8AfQB8AHkAdQBxAGwAaQBnAGUAYwBfAFsAVwBUAFIAUABOAEoARgBBAD8APAA7ADgANAAvACsAKAAmACQAIAAcABcAFAATABEAEAAQABEAEgASABEACgDv/8n/rv+i/5//oP+h/6H/n/+c/5v/mv+Z/5n/mf+Z/5n/mf+Y/5j/mP+Z/5r/mv+a/5n/mP+X/5b/lP+T/5P/kv+S/5H/j/+N/4z/i/+L/4v/i/+M/43/jf+N/43/jP+L/4n/h/+G/4X/hf+F/4P/gv+A/3//f/9//37/ff98/3v/ev96/3v/fP9//4L/g/+D/4P/gv+B/4D/fv9+/37/fv9//3//gP+B/4L/g/+F/4r/kf+W/5n/mv+a/5n/mf+Z/5n/mf+a/5r/nP+e/6D/of+i/6L/of+f/53/m/+a/5r/mv+a/5r/mv+Z/5r/mv+a/5r/mf+X/5X/lf+V/5X/l/+Z/5v/nv+f/6D/oP+g/5//nf+c/5v/nP+d/57/nv+e/57/n/+g/6H/ov+i/6L/o/+k/6X/pv+n/6f/qP+p/6r/q/+s/67/r/+x/7P/tP+1/7f/uf+8/8D/wv/D/8j/1//s//n///8BAAAA/v/9//z//P/8//3//f/+//7/////////AAAAAAEAAgADAAMABAAFAAUABAACAAEAAQABAAIAAwADAAIAAgACAAMABAAFAAYABwAIAAkACgALAAwADgASABQAFgAXABcAGAAZABsAHQAeAB4AHwAfAB8AHwAfAB8AIAAgAB8AHQAbABsAGwAcAB0AHQAeAB8AHwAgACAAIQAgAB8AHgAeAB4AIQAnAC4AMwA1ADYANgA2ADcAOQA6ADsAOwA7ADoAOQA3ADYANQA1ADUANgA4ADsAPQA9AD0APQA7ADkAOAA3ADcANwA3ADcANwA2ADYANgA2ADUANQA0ADMAMgAyADEAMQAxADEAMQAwADAAMAAwADAAMAAwADAALwAvAC8AMAAxADEAMQAxADEAMAAwADAAMAAvAC8ALgAtACwAKgApACkAKAAoACcAJgAkACIAIgAhACIAIwAjACMAIwAiACIAIgAjACMAIwAjACIAIQAeABsAGQAYABcAFwAXABYAFQAUABQAEwATABMAFQAWABcAFwAXABYAFQATABAADwAOAA0ADQANAAwADAAMAAsACwAKAAsADAAOAA4ADgAOAA4ADQANAA4ADgANAA0ADAAMAAwADAAMAAsACwALAAoACQAIAAcABwAHAAYABQADAAIAAgABAAEAAgADAAUABgAGAAYAAQD4/+//6v/p/+n/6v/q/+v/7P/s/+z/7P/s/+v/6f/n/+f/5v/n/+f/5v/l/+T/5P/k/+T/5P/k/+T/5P/k/+T/5f/l/+b/6P/q/+v/6//r/+v/6//p/+j/6P/o/+j/6P/o/+f/5v/m/+b/5//n/+j/5//n/+f/6P/o/+n/6f/p/+r/6v/r/+v/7P/t/+//8f/y//P/8//0//b/+P/6//v//P/8//3///8BAAIAAwAEAAYACQALAA0ADQANAA0ADQANAAwADAANAA0ADgAPABAAEQASABMAEwAUABUAFgAXABgAGAAZABkAGgAbABwAHAAdAB0AHgAgACIAJAAlACYAJgAmACYAJQAlACUAJQAmACYAJQAkACQAJAAkACQAJAAkACMAIwAjACQAJAAjACIAIQAgACAAIAAhACIAIwAlACYAJgAmACYAJgAmACUAJQAlACUAJQAmACcAKQAqACoALQA3AEYAVABcAF4AXQBbAFoAWwBbAFsAWgBaAFkAWABYAFcAVgBVAFQAUwBSAFEAUABPAE4ATgBNAE0ATQBMAEsASgBJAEgASABHAEYARQBEAEMAQQA/AD0APAA6ADoAOQA4ADgANwA2ADYANQAzADEALwAsACsAKQAoACgAJwAmACQAIwAiACIAIQAfAB0AHAAaABoAGQAYABcAFgAVABQAEwASABIAEQAQABAADwAPABMAHgArADQAOAA4ADYAMwAwAC0AKwApACgAJwAmACYAJQAlACQAIwAiACEAIAAfAB4AHQAcABsAGgAYABYAFAATABIAEQARABEAEQARABAAEAAPAA8ADwAPAA8ADgANAAwACwAKAAgABwAGAAUABQAEAAQAAwADAAIAAQABAP///f/7//r/+f/5//n/+f/6//r/+//6//r/+f/5//j/+P/4//j/9//3//b/9P/z//L/8f/y//j/AQAIAAoACwAJAAgACAAIAAgACAAIAAcABwAGAAYABQAFAAQABAADAAMAAwADAAIAAgABAAEAAgACAAMAAwACAAIAAQAAAAAA///+//7//v/+////AAABAAEAAQABAAAAAAD//////////////////////////////////////////wAAAAAAAAAAAAABAAEAAQABAAEAAQAAAAAAAAAAAAAAAAAAAAEAAgACAAMAAwABAAAA/v/9//3//f/9//3//f/9//3//f/+//7//////wAAAAAAAAAAAAAAAP/////+//7///////////////////8AAAAAAAD//////////wAAAAAAAP//////////AAAAAAAAAQABAAEAAQABAAEAAAD//////v/+//7//v///wAAAQACAAIAAQABAAAA///+//7//v/+//7//f/8//v/+//6//r/+v/6//v/+//7//v/+P/y/+z/6f/o/+j/6P/p/+r/6//r/+v/6//r/+v/6//q/+r/6v/q/+r/6v/q/+r/6//r/+v/6v/q/+r/6v/q/+r/6v/p/+n/6P/o/+f/5//m/+b/5v/l/+T/4//i/+L/4v/h/+H/4v/h/+H/4f/h/+D/3//e/93/3f/c/9z/3P/b/9r/2v/a/9n/2f/Z/9j/2P/Y/9f/1//X/9f/1v/V/9X/1P/U/9T/1P/T/9P/0v/S/9L/1v/e/+T/6P/o/+j/5//n/+f/5//n/+f/5v/m/+b/5f/l/+X/5P/k/+T/5P/j/+P/4//j/+P/4v/i/+H/4f/h/+H/4f/g/+D/4P/g/+D/4P/g/+D/4P/g/9//3//f/9//3//f/97/3v/e/97/3v/e/97/3v/f/9//3//f/+D/3//f/97/3v/e/97/3//f/97/3v/e/97/3v/e/9//3//f/+D/4P/g/+D/4f/h/+L/4v/j/+P/4//k/+X/5f/m/+b/5v/m/+b/5//n/+f/6P/o/+j/5//n/+f/5//o/+j/6P/o/+j/6P/o/+n/6f/p/+n/6f/p/+n/6f/q/+r/6v/r/+v/7P/s/+z/7f/t/+7/7v/u/+//7//v/+//8P/w//D/8P/x//H/8f/y//L/8//z//P/9P/0//X/9f/2//b/9v/3//f/+P/5//n/+f/5//r/+v/7//v/+//8//z//P/8//z//P/8//3//v///wAAAQABAAEAAQABAAIAAgACAAIAAwADAAMABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAUABQAFAAYABgAGAAYABgAGAAYABwAHAAcABwAHAAcACAAIAAgACAAIAAgACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAKAAoACgAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAkACQAJAAgACAAIAAgACAAIAAgACAAIAAgABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAHAAcABwAGAAYABgAGAAYABgAFAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwADAAMAAwACAAIAAgACAAIAAgACAAIAAgACAAIAAgACAAIAAgABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQABAAEAAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="},"audio.destroy-electronic":{"mime":"audio/wav","bytes":28844,"sha256":"9cffbf1ec33ca0f183261bc4335befb6cf77ed76954485aeb928480415c0512a","source":{"kind":"core","recordingSha256":"9cffbf1ec33ca0f183261bc4335befb6cf77ed76954485aeb928480415c0512a"},"base64":"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sQCtAKYAnACRAIYAeQBtAGEAVgBKAD0AMQAkABgACwD///L/5P/X/8r/vv+x/6X/mf+O/4P/eP9v/2X/XP9T/0v/RP89/zf/Mv8w/y//Mf80/zf/Of87/z3/Pv8//0H/Q/9F/0f/Sf9L/0z/Tv9Q/1L/VP9W/1n/XP9j/2v/df9//4r/lv+h/6z/t//C/83/2f/l//H//v8JABUAIQAtADkARABPAFkAYwBtAHgAggCMAJUAnQCkAKsAsgC4AL4AwgDEAMQAwgC/AL0AugC4ALcAtQCzALEArwCtAKsAqgCoAKYApACiAKAAnwCcAJgAkwCLAIIAeABtAGMAWQBOAEQAOQAuACMAGAANAAIA+P/t/+H/1v/M/8H/tv+s/6L/mf+Q/4f/f/93/3D/af9i/1z/V/9S/07/Tf9N/0//Uv9U/1b/WP9Z/1r/XP9d/1//Yf9i/2T/Zv9n/2n/a/9t/27/cP9z/3f/fv+F/47/l/+h/6r/tP++/8f/0f/a/+T/7//5/wMADgAYACIALAA2AD8ARwBQAFkAYQBpAHIAeQCAAIcAjQCTAJkAngCjAKYApwCnAKUAowCgAJ4AnACbAJkAlwCWAJQAkwCSAJAAjgCNAIsAiQCHAIUAggB+AHgAcQBpAGAAVwBPAEYAPQA1ACsAIgAYAA8ABgD9//T/6//h/9j/z//G/77/tv+u/6b/n/+Y/5H/i/+F/3//ev91/3H/bf9q/2n/av9s/27/cP9y/3P/dP92/3f/eP95/3v/fP9+/3//gf+C/4T/hv+H/4n/jP+R/5f/nv+l/63/tf++/8b/zv/W/97/5v/u//f///8IABAAGQAhACkAMQA4AEAARwBNAFQAWwBhAGcAbABxAHYAewB/AIMAhgCJAIoAiQCIAIYAhACCAIAAfwB+AHwAewB6AHkAeAB3AHUAcwByAHAAbwBsAGkAZABfAFkAUgBLAEQAPQA2AC8AKAAgABkAEQAKAAIA+//z/+z/5P/d/9b/z//I/8H/u/+1/6//qv+k/5//m/+W/5L/j/+L/4j/hv+G/4b/iP+J/4v/jP+O/4//kP+R/5L/k/+U/5X/l/+Y/5n/m/+c/53/n/+h/6T/qf+v/7X/u//B/8j/zv/U/9v/4f/o/+7/9f/8/wMACQAQABcAHQAkACoAMAA2ADsAQQBGAEsATwBUAFgAXABfAGIAZQBoAGsAbABtAGwAawBpAGgAZwBmAGUAZABjAGIAYQBgAF8AXgBcAFsAWgBZAFcAVQBRAE0ASABDAD4AOQAzAC4AKAAjAB0AFwASAAwABgAAAPv/9f/v/+n/5P/e/9n/0//O/8r/xf/B/7z/uP+1/7H/rv+r/6j/pf+j/6L/of+i/6P/pP+m/6f/qP+p/6n/qv+r/6z/rf+u/6//sP+y/7P/tP+1/7b/uf+8/8D/xf/J/87/0//X/9z/4f/m/+v/8P/1//r///8EAAkADgATABgAHQAhACYAKgAuADIANgA6AD0AQABDAEYASABKAEwATgBQAFEAUQBQAE8ATgBNAEwASwBLAEoASQBIAEgARwBGAEUARABDAEIAQQBAAD0AOgA3ADMALwAsACgAJAAfABsAFwATAA8ACwAHAAMA///6//b/8v/u/+r/5v/j/9//2//Y/9X/0v/P/8z/yf/H/8X/w//B/7//vv+9/73/vf++/7//wP/B/8L/w//D/8T/xP/F/8b/x//I/8n/yv/K/8v/zP/O/9D/0//W/9n/3P/f/+P/5v/p/+3/8P/z//f/+v/+/wEABAAIAAsADgASABUAGAAbAB0AIAAjACUAKAAqACwALgAvADEAMgAzADQANQA1ADUANQA0ADMAMgAyADEAMQAwAC8ALwAuAC4ALQAsACwAKwAqACkAKAAmACQAIgAfAB0AGgAYABUAEgAQAA0ACgAIAAUAAwAAAP7/+//5//b/9P/y/+//7f/r/+n/5//l/+P/4v/g/9//3f/c/9v/2v/a/9n/2f/Y/9n/2f/a/9v/2//c/9z/3f/d/97/3v/f/+D/4P/h/+H/4v/j/+T/5f/m/+j/6v/r/+3/7//x//P/9f/2//j/+v/8//7/AAABAAMABQAGAAgACgALAA0ADgAQABEAEgATABQAFQAWABcAGAAYABkAGQAaABoAGgAaABkAGQAYABgAFwAXABYAFgAWABUAFQAUABQAFAATABMAEgASABEAEAAPAA4ADQAMAAoACQAIAAcABgAFAAQAAwACAAEAAAD///7//f/8//v/+v/6//n/+P/4//f/9v/2//b/9f/1//X/9P/0//T/9P/0//T/9P/0//X/9f/1//b/9v/2//f/9//3//j/+P/4//j/+f/5//n/+v/6//v/+//7//z//P/9//3//v/+//7/////////AAAAAAAAAAAAAAEAAQABAAEAAQABAAEAAQABAAEAAAAAAAAAAAA="},"audio.human-reaction-1":{"mime":"audio/mpeg","bytes":5996,"sha256":"d980edc4cfe48e781a70656bacc68030c9a6b922f056fff63167e43d42859081","source":{"kind":"core-compact","recordingSha256":"4fb0c8881f4ddee958b94e03b70339b291e90c6139adffe9326ffd6d1bf6209a"},"base64":"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"},"audio.human-reaction-2":{"mime":"audio/mpeg","bytes":4460,"sha256":"d6615407ef5c3b6629745d8dd2dc1b6c906c099c7e65030d94d6733393da17ac","source":{"kind":"core-compact","recordingSha256":"212de184cd976cc1aef23ad0c2a13af7353c1dbc3564264718e7dfb8f589dd1e"},"base64":"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uisrcj//0////+oYmRkMgbuFoTkmSFZkALABdl8HvC3TIFgK9UEzUkBgiNQy1ov8XhPZsKJIwJ7f2/xAj7K0B1CBJNDf/Lp5j+n/////+lUB1wmHyx4JIAQAWKL/+1TEkwPI5G0WDmsigQoNowG8vGipZ7JuSEaJ0HAfNGKUrGYJiHEiZSGFA28gYwTRq00R8Ejay2VZI+gVh2EeNAXJ4tb2+z////1f+nu/3esAKFuJbRrwdRMuCoxaMQeJgARuYnIglmpyOUrenDG/9WMGAj33L9iSX7PKu/+wt+Hee//W5jBKqAAAVaiC+EVHYQcKB/cfSXzVgYKCwsLCT1itYqLNizf6xTULCsVFWfqFhcVYKirdYoLYsK//9Yr/+1TEo4MJYGUaTecBARENo0W8PHKLf4rVTEFNRTQuMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+1TEsQMJAGMSLeWjgNuL4g2GCGhVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+1TExwPHZCatJ7BiQAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU="},"audio.human-reaction-3":{"mime":"audio/mpeg","bytes":2924,"sha256":"1db90de7c27138131cf9c131b5a227d303b98151793d4c11845cf9f35e451133","source":{"kind":"core-compact","recordingSha256":"ff99273589efd9db0fe0931d6bdfc2908b563e4fed9e2436f2df053b07688abe"},"base64":"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3mnUL+NDCpHYP561Pob2Pq9cX+IrAeTkn2mt5njBDgmWJ2cpLTmLuuEEpqdiBISH3//95DqhWdhW3//3Rl/rFcAARIwABL+Al0LPAEImwJVLmMc6SUxwsJTHSrmJW424yRt11/JRhr1y5voq5X3FYXjwISBiQtRlsIEcREMFCJ4igKEY9///RIiihUI0JEG2UXd8ib6wksNikAASkAkLrQth6bb/+1TEBoCJ7K1HTDyr0SuVaKjym0rORY7OF0OHLGWn0Ok6FWqLOT9uk18/GKZdqidVu4sTbHSOep1LKPVwiJRpFRMsPRxAYKgIz//+iWINE4oQIf+FOoO4FDQYAFUfrIUoUEu+0oGGLCX9lQiGh5+2gQ5G1/qBHx7Uh86j2Tk7HpTI2rOXM4SZEyCuSjllRmA3aGxYHW///oiSRQstBQLt/4ZqqLSLkQALYHBITQlEyLYn0US1Clp0i2BjQRYodlb/+1TEDoAI5K1Rp6TvUSMVaHDzj0kG6iIk6rJVDXOx2b2cZYLHIPNWNoYXdio6Y///3U0dFoXMYuDP////v/bSC0BIADgBIaVwcocTQdStOBYUZooonrMjY1WN5He7g/41ij6GxPn0WJFSL9qZUynwbxey5pZYRBqv4pw8bCo///9kBoqihmN3rVjMcYALYH6Fn6/H8N1HiZjlJA1oVGZIScmC4kvM0XfVr666xNYtgaz97KQPHt4G4S8ntYKdjBz/+1TEHAAJKKdRp7BL0SaWKXTxlirN//7lBBxhA7iLv///+r//+htSsuxEBODjzbSJMhjK1EGUqhFlU9YWA+y+uMaInnIGJVp6lAwsMKNtfwsAgJ1JgcagVEiXQ///5RwM6kNWJAX/+o9/r//+r+okAUCwAIAV1jtaBJRbTQRy6ap08uUUF8o6bg0tDpvX3b2qqnrijj9VUI0o8ro+VBzkLGhBPZThP1DYla6fM2rf8CMBWWEpKKKTiSDs21spAQf/+1TEKAAIlKUlJ4B8AN8LJXQwjdJSLpYCIAjiPX5GqCqsPbjiQoaCqUQ6EnyrvXPZbllHsRSXq/WNdqlXZYO/8lVMQU1FNC4wVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+1TEPwPAAAGkAAAAIAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU="},"audio.human-reaction-4":{"mime":"audio/mpeg","bytes":5804,"sha256":"b87531ee6463743abeb19ab6d2cf8380089c15b245a6f1a699d8476aed318d95","source":{"kind":"core-compact","recordingSha256":"0dfbe18eddc5a832af74a9413084329a7d2a33691fec12b2d489d5a11bb0201c"},"base64":"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5GBYdMb///2Iok5UBHKzfikyOdf//hgBmkACgbECaACBEIFUQoFoEDFC5oBMmkeUqiQDDPEOuI3FIvzKYCgQiWRSHEhEOGDxQX/ikCpbP///0moKFGpMwfMLJ+YTn1cx///kirO6gBKBtpJoAVBIiikPITccpoQWY7i6mFhkMlGJqjchcBbts7GGyyUgsz3iJZCGA1k2//z/+1TEt4AKkQk1p4zyiUmhZzT0HerwIG////RTGKEB6qax/5yHnMc7///kZMYSJ/6EACA/iAMJmosUQFZCNmIU3nkm0aeiEhAmdPpSYsSWjs/6q42CJprqpg5IiQKhIGgZ/5ojt////JOowCwDDhqTPJS/UaC8w4SjTxtO//1UCqrVVUAAAgBmgAcAIB9IaelEFEkdM06Bo3E3ilUTqo1BEI7GIfXPvLosiSjX27gfDkVFRxX/zP///7TlUHQbMDD/+1TEuYAJIQk/p6hRWTIg53TyniNM4xvmjo3NEhEp//1HDxkmFMABA6tXvlQI+EmAEh+tSyYWVUapZh0FyvcWRSt+rqHCOyDymRBYwAoEI/6B7f///jRIoROIuA452f48pphZ0f//5BNVFQBAARmoxJKc0TDiug95c6AJTQO0lM1ti0Zlvooj6COhYkE1PoqNlmR0kRqJUuDhq/1Jf///1l0mlAQE4TxMTA4UxhTTzozkoiw/DhLCo3b//oySbAD/+1TExABJsQ09p5lREUegpjWHnKkAANAIrACdo2XqdNFxgssGk8UnwhzTSzJb/uFAUehlCgJSsVAJ2/+rf+X/9EEYBzHaP9DhSJJwqGv///o/kUxBTUU0LjBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVUCTi0FkSQkCAwMo8y83P0wkZE0wiMjP//////3ZbKRrLPI7KRnY5MrUKCBw0FRQW//wKKigsaAoqLCQ0PFBZvFhYX/+1TEyYCJvQkz7CDtSQ6hJhDxFfCF1UxBTUU0LjBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+1TE1gAKmQcezAGuSP0aYrTxHfhVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+1TEzAPIaNyaIwRvwAAANIAAAARVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU="},"audio.human-reaction-5":{"mime":"audio/mpeg","bytes":3500,"sha256":"a91552a1cc27b3ccdd005c355e5b4278dd00fcbcf9a3f8ad7ea51effc0d598d9","source":{"kind":"core-compact","recordingSha256":"448601efaac9ed7cd7121a9a210ea75d434c91b1776b681e04493c096b3fdacf"},"base64":"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"},"audio.human-reaction-6":{"mime":"audio/mpeg","bytes":5228,"sha256":"37cb7f8024f58c7672687ae5d6872e3866afbe2036315a3aa2fba77c028e3857","source":{"kind":"core-compact","recordingSha256":"fce6fcfb558076547f18569542a364ccc677185568fed96f90d1e643906896c8"},"base64":"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"},"audio.human-reaction-7":{"mime":"audio/mpeg","bytes":5612,"sha256":"2f8c7f69f0df46479bb4b6b885cc5adcad3dda1e5d0cb68ce8a3a41b8ac00b46","source":{"kind":"core-compact","recordingSha256":"c600f66cf99796d9981621a5fccc97430fa7b7c9c493f27dbc56b79986b49edd"},"base64":"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OIJsABXbYIfOpRrloTEtzCeRYmh9JhSmYys79ofyPfA35M6eJH9ji3ZGnrCu7oJ0XjdFX0VRGCAY/27UHBHYY9RsOE3qX/u+j5Wjb04KAAAA6AA4rSk7CeSTGmXR2UyR1XojEPAIDx2X4j9bU/jncwoaF926LHdNaTHK7RFdqrKLt1S6haj5WkCkjLjtMloetFY+yoNh////+1TEpYALTLEzTL1YAV2WJumHqbIxSlf0BHqCkQAAHgAJtrQxwINFU9G6P1eeiq4L6P8FysrksTlFNyd3ljhRPNBsPk04W0pRtnVGw4IDBZd9DSXoI11AoAKcgEqZt+s8cF5//9CEJ6QACLFyCgAEYADSGZDsSmSQgXAMIZAUpU0WBHYgmEOAxWnk92tat361fKa7Bz+lUtVJrygDHr4YpnC0hHAz7KMUA81ydNb1//iMEYBnuphi/OHgsC07rRX/+1TEogAJtLFHp7T4EUOV5imJCwgARMAsAASgAS/AE0BwKVP1nz4NxcV0XjkMJLSwTBdafynJf2pScppbF2CNRDiJBxxgSAGVEgnYeRCe/KcgIABeTjKEm6X7LH8u//6nMCZqD6MjicgADgotmSI0Rqk8GAX8+DKP46jXfopKop1OpzRXF1eJpq02iZGg2jS9Ac0hPr2dAKBaY/64qB8Ac//+aRO/6pb///2af/9aZEjubU5uBs+caecGQRmgcpj/+1TEqAAKDLExTDRYQVATpmmXnspJbVkrAJGZOMvgfdXYuFil6h0NKjW44uNIi1y7wKgBSXUxKeR1NR2IDA0kolPy3nP/8eY3H+l1rolYKCdDVgwOPLKCSmyiVUehWqf+uJgqIi8VzxBLJOEkOgdB0UCWWEcXhEWb+sW1C////+rQFRbin//QDIoSNUxBTUU0LjBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+1TEqwAKBJ0vrExYQSYTZ3T2HhpVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/+1TEs4OJJH0MDLMMgPsNGUQ0sdhVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU="},"audio.human-reaction-8":{"mime":"audio/mpeg","bytes":5228,"sha256":"d84e65a5e3df70ede5e2249cec52eb77eb0b673920b5ec5ab579a0dbe70cad91","source":{"kind":"core-compact","recordingSha256":"df6a067eec36f2a2ab8599e0541ea0ab04befaf7d268e8815d0f859fe8b0d542"},"base64":"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"}}};
    for (const clip of Object.values(bank.clips)) {
      Object.freeze(clip.source);
      Object.freeze(clip);
    }
    Object.freeze(bank.release);
    Object.freeze(bank.clips);
    const PORTABLE_DESTRUCTION_AUDIO = Object.freeze(bank);

    return { PORTABLE_DESTRUCTION_AUDIO: PORTABLE_DESTRUCTION_AUDIO };
  })();
  modules['game/presentation/portable-destruction-audio.mjs'] = (() => {
    const PORTABLE_DESTRUCTION_AUDIO =
      modules['game/audio/portable-destruction.mjs']['PORTABLE_DESTRUCTION_AUDIO'];

    /** The optional package contains the exact accepted release recordings. No
     * network, draft-library access, object URL, or playback belongs to this reader. */
    async function readPortableDestructionAudio(slot, { signal } = {}) {
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      const clip = PORTABLE_DESTRUCTION_AUDIO.clips[slot];
      if (!clip) return null;
      const bytes = Uint8Array.from(atob(clip.base64), (value) => value.charCodeAt(0));
      if (bytes.length !== clip.bytes)
        throw new TypeError('Incomplete portable destruction recording.');
      if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
      return { blob: new Blob([bytes], { type: clip.mime }), asset: clip };
    }

    return { readPortableDestructionAudio: readPortableDestructionAudio };
  })();
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
  modules['game/ui/world-ambience.mjs'] = (() => {
    /** Shared, original atmosphere recipes. They use the existing SFX owner and
     * require no decoded files, independent context or background scheduler. */
    const WORLDS = Object.freeze({
      'field-crossing': { filter: 760, air: 0.009, hum: 108, humGain: 0.0015 },
      'freight-depot': { filter: 310, air: 0.006, hum: 61, humGain: 0.0035 },
      'relay-ruins': { filter: 480, air: 0.008, hum: 89, humGain: 0.002 },
      'river-port': { filter: 570, air: 0.008, hum: 74, humGain: 0.0016 },
      'chalk-quarry': { filter: 930, air: 0.007, hum: 48, humGain: 0.0022 },
      'orchard-strongpoint': { filter: 1120, air: 0.006, hum: 123, humGain: 0.0012 },
    });

    function worldAmbienceRecipe(world) {
      const profile = WORLDS[world];
      if (!profile) return null;
      return {
        name: `ambience-${world}`,
        procedural: true,
        ambience: true,
        gain: 1,
        priority: 0,
        movement: false,
        cooldown: 1.25,
        tone: {
          kind: 'snare',
          from: profile.filter,
          to: profile.filter,
          filterFrequency: profile.filter,
          duration: 1.75,
          gain: profile.air,
          type: 'sine',
        },
        layers: [
          {
            from: profile.hum,
            to: profile.hum * 0.985,
            duration: 1.7,
            gain: profile.humGain,
            type: 'sine',
          },
        ],
      };
    }

    return { worldAmbienceRecipe: worldAmbienceRecipe };
  })();
  modules['game/ui/encounter-audio.mjs'] = (() => {
    /** Shared semantic cues; both recorded and offline procedural renditions use
     * these recipes. No context, clock, randomness or actor mutation lives here. */
    const destructionSoundRecipe =
      modules['game/ui/destruction-audio.mjs']['destructionSoundRecipe'];
    const worldAmbienceRecipe = modules['game/ui/world-ambience.mjs']['worldAmbienceRecipe'];
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
      runner: Object.freeze({
        cadence: 0.32,
        rate: 1.08,
        equipment: 'paper',
        from: 240,
        to: 150,
      }),
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
      if (type === 'catch') return destructionSoundRecipe(details);
      if (type === 'ambience') return worldAmbienceRecipe(details.world);
      if (type === 'warning-charge') {
        const progress = Math.max(0, Math.min(1, details.progress ?? 0));
        return {
          name: 'warning-charge',
          procedural: true,
          gain: 0.18,
          priority: 5,
          movement: false,
          cooldown: 0.16,
          tone: {
            from: 660 + progress * 360,
            to: 740 + progress * 360,
            duration: 0.055,
            gain: 0.024,
            type: 'sine',
          },
        };
      }
      if (type === 'escort-shot') {
        const breaker = details.role === 'breaker';
        return {
          name: breaker ? 'escort-breaker' : 'escort-sweeper',
          procedural: true,
          gain: 0.15,
          priority: 2,
          movement: false,
          cooldown: 0.65,
          tone: {
            from: breaker ? 520 : 160,
            to: breaker ? 180 : 60,
            duration: breaker ? 0.075 : 0.12,
            gain: 0.016,
            type: breaker ? 'triangle' : 'sine',
          },
        };
      }
      const pitch = FAMILY_PITCH[details.family] ?? 1;
      const actor = actorSoundProfile(details.family),
        tracked = details.machine === 'tracked',
        metal =
          details.material === 'metal' || [true, 'tracked', 'wheeled'].includes(details.machine);
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
        priority:
          details.semantic === 'armor-break'
            ? 4
            : details.semantic === 'harmful-contact'
              ? 5
              : details.semantic === 'friendly-impact'
                ? 3
                : priority,
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
    const createHumanReactionPolicy =
      modules['game/ui/human-reaction-policy.mjs']['createHumanReactionPolicy'];
    const createPublishedCues = modules['game/ui/published-cues.mjs']['createPublishedCues'];
    const readPortableDestructionAudio =
      modules['game/presentation/portable-destruction-audio.mjs']['readPortableDestructionAudio'];
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
    const destructionCategory = modules['game/ui/destruction-audio.mjs']['destructionCategory'];
    const DESTRUCTION_CUES = modules['game/ui/destruction-audio.mjs']['DESTRUCTION_CUES'];
    const HUMAN_REACTION_CUES = modules['game/ui/destruction-audio.mjs']['HUMAN_REACTION_CUES'];
    const encounterSoundRecipe = modules['game/ui/encounter-audio.mjs']['encounterSoundRecipe'];
    const actorPhaseSound = modules['game/ui/encounter-audio.mjs']['actorPhaseSound'];
    const readMovementAudio = modules['game/ui/movement-audio.mjs']['readMovementAudio'];
    const MOVEMENT_AUDIO_KEY = modules['game/ui/movement-audio.mjs']['MOVEMENT_AUDIO_KEY'];
    const dialogueChannel = modules['game/ui/dialogue-channel.mjs']['dialogueChannel'];

    /** Native flight uses the shared published-cue cache and mixer. Accepted package
     * recordings decode on activation; no network reads or gameplay clocks. */
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
      let recorded = null;
      const effects = new Set();
      const humanReactions = createHumanReactionPolicy();
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

      recorded = createPublishedCues({
        sound: {
          get enabled() {
            return enabled;
          },
          get paused() {
            return !wanted;
          },
          get disposed() {
            return disposed;
          },
          get context() {
            return context;
          },
          get audioMaster() {
            return masterState;
          },
          get sfxBus() {
            return graph?.buses.interface;
          },
          get settings() {
            return { master: enabled, sfx: levels.interface > 0 };
          },
          voices: effects,
        },
        readAudio: options.readAudio ?? readPortableDestructionAudio,
        maxVoices: 12,
        maxFeedbackVoices: 10,
        maxDecodedSamples: 2 * 1024 * 1024,
      });
      function prepareRecordings() {
        void recorded.prepare([
          ...DESTRUCTION_CUES,
          ...(options.getDestruction?.()?.vocals === false ? [] : HUMAN_REACTION_CUES),
        ]);
      }
      function humanReaction(details) {
        prepareRecordings();
        if (
          !graph ||
          !enabled ||
          !wanted ||
          masterState.volume === 0 ||
          !levels.interface ||
          context.state !== 'running' ||
          dialogueVoice ||
          dialogueChannel.active ||
          [...effects].some((effect) => effect.priority >= 5) ||
          effects.size >= 12
        )
          return;
        const name = humanReactions.request(
          context.currentTime,
          details,
          [...effects].filter((effect) => effect.humanReaction).length,
        );
        if (name)
          recorded.play(name, {
            gain: 0.45,
            maxDuration: 0.7,
            humanReaction: true,
            feedback: true,
            priority: 2,
            board: 'flight',
          });
      }
      function silence() {
        recorded?.cancelPending();
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
        kind = 'tone',
        destruction = false,
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
        // Crowd feedback cannot use the warning reserve. A warning may reclaim
        // a lower-priority tail, without adding a second output or context.
        if (destruction && [...effects].filter((effect) => effect.destruction).length >= 10) return;
        if (effects.size >= 12) {
          const victim = [...effects].find((effect) => effect.priority < priority);
          if (!victim) return;
          victim.stop();
        }
        const oscillator =
          kind === 'snare' ? context.createBufferSource() : context.createOscillator();
        const envelope = context.createGain();
        const start = context.currentTime + delay;
        if (kind === 'snare') {
          const samples = Math.max(1, Math.ceil(context.sampleRate * duration));
          const buffer = context.createBuffer(1, samples, context.sampleRate);
          const data = buffer.getChannelData(0);
          let seed = 73471,
            low = 0;
          for (let index = 0; index < data.length; index++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
            low = low * 0.65 + (seed / 2147483648 - 1) * 0.35;
            data[index] = low;
          }
          oscillator.buffer = buffer;
        } else {
          oscillator.type = type;
          oscillator.frequency.setValueAtTime(from, start);
          oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, to), start + duration);
        }
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
          destruction,
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

      function actorSoundDetails(event = {}) {
        const actor = actorDefinitions.get(event.actor);
        const machine =
          event.machine ??
          (actor?.type === 'vehicle'
            ? actor.vehicleModel === 'field-tank'
              ? 'tracked'
              : 'wheeled'
            : false);
        const machineFamily =
          actor?.type === 'vehicle'
            ? ({
                'field-utility': 'utility-car',
                'field-tank': 'tracked-tank',
                'relay-truck': 'radar-truck',
              }[actor.vehicleModel] ?? actor.vehicleModel)
            : null;
        return {
          family:
            event.family ??
            machineFamily ??
            actorFamilies.get(event.actor) ??
            (actor?.speed > 0 ? 'patroller' : 'lookout'),
          machine,
          brutal: options.getDestruction?.()?.brutal === true,
          vocals: options.getDestruction?.()?.vocals,
          // Patrols and sentries use the humanoid painter. Drones, hazards and
          // vehicles must never inherit a human voice from the family fallback.
          humanoid:
            event.humanoid ?? (actor ? ['patrol', 'sentry'].includes(actor.type) : undefined),
          flesh: event.flesh,
        };
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
        const details = actorSoundDetails(event);
        const recipe = encounterSoundRecipe(kind, details);
        const now = context?.currentTime ?? 0;
        const cueKey = kind === 'catch' ? `catch:${recipe.category}` : kind;
        if (now - (recentCues.get(cueKey) ?? -Infinity) < (recipe.cooldown ?? 0.12)) return;
        recentCues.set(cueKey, now);
        if (recipe.priority >= 5 || (type === 'fire' && !player)) {
          humanReactions.interrupt(now);
          for (const effect of [...effects]) if (effect.humanReaction) effect.stop();
        }
        if (kind === 'catch') {
          humanReaction(details);
          if (
            recorded.play(recipe.name, {
              gain: recipe.gain,
              rate: recipe.rate,
              maxDuration: recipe.maxDuration,
              priority: recipe.priority,
              feedback: true,
              board: 'flight',
            })
          )
            return;
        }
        if (recipe.priority >= 5 || (type === 'fire' && !player)) dialogueChannel.interrupt();
        const voice = { ...recipe.tone, priority: recipe.priority, movementCue: recipe.movement };
        if (recipe.movement) voice.gain *= levels.interface;
        if (type === 'fire' && !player) voice.gain *= 0.65;
        if (type === 'objective' && gateStyle === 'digital') voice.type = 'triangle';
        tone({ ...voice, destruction: kind === 'catch' });
        for (const layer of recipe.layers ?? [])
          tone({ ...layer, priority: recipe.priority, destruction: kind === 'catch' });
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
          prepareRecordings();
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
        get movementSettings() {
          return movement;
        },
        set movementSettings(value) {
          if (
            typeof value?.enabled !== 'boolean' ||
            !Number.isFinite(value.volume) ||
            value.volume < 0 ||
            value.volume > 1
          )
            throw new TypeError(
              'Movement sound requires an enabled boolean and volume between zero and one.',
            );
          movement = { enabled: value.enabled, volume: value.volume };
        },
        applyVolumes: applyOutput,
        masterSnapshot: () => audioMaster.snapshot(),
        subscribeMaster: (listener) => audioMaster.subscribe(listener),
        setMasterVolume: (value) => preferences.setVolume(value),
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
          humanReactions.reset();
          actorPositions.clear();
          actorPhases.clear();
          actorFamilies = new Map(
            (course.pursuit?.actors ?? []).map((policy) => [policy.id, policy.family]),
          );
          lastFootstep = -Infinity;
          actorDefinitions = new Map((course.actors ?? []).map((actor) => [actor.id, actor]));
          stopEffects();
          recorded.cancelPending();
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
              const destructionTypes = new Set();
              // Bound cue overlap independently of simulation actor/projectile counts.
              for (const event of events) {
                if (['catch', 'defeat'].includes(event.type)) {
                  const category = destructionCategory(actorSoundDetails(event));
                  if (destructionTypes.has(category)) continue;
                  destructionTypes.add(category);
                } else if (types.has(event.type)) continue;
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
          recorded.close();
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

export function mountSimGlobalTools({
  document: doc,
  window: win,
  gameReturn,
  settingsRoot,
  panels,
  locale = () => 'en',
  onOpen = () => {},
  onControls = () => {},
  loadProvider = () => import('../../game/ui/global-settings-tools.mjs'),
  moduleURL = import.meta.url,
} = {}) {
  let coreURL;
  const knownReturn = typeof gameReturn === 'string' && gameReturn.length > 0;
  try {
    coreURL = new URL('../../game/', moduleURL);
    if (coreURL.origin !== new URL(win.location.href).origin)
      throw new Error('Core origin mismatch');
    if (knownReturn) {
      const target = new URL(gameReturn, win.location.href);
      if (target.origin !== coreURL.origin || !target.pathname.startsWith(coreURL.pathname))
        throw new Error('Core return does not match this application');
    }
  } catch {
    return {
      ensure: async () => false,
      refresh() {},
      dispose() {},
      root: () => null,
      back: () => false,
    };
  }
  const fallback = doc.createElement('section'),
    link = doc.createElement('a'),
    status = doc.createElement('p');
  fallback.dataset.simGlobalToolsFallback = '';
  link.href = coreURL.href;
  link.target = '_blank';
  link.rel = 'noopener';
  status.setAttribute('role', 'status');
  fallback.append(link, status);
  panels.extras.append(fallback);
  let provider,
    pending,
    disposed = false,
    failed = false;
  const refresh = () => {
    provider?.refresh?.();
    const uk = locale() === 'uk';
    link.textContent = uk ? 'Відкрити спільні інструменти гри' : 'Open shared game tools';
    link.hidden = !knownReturn;
    status.textContent = failed
      ? uk
        ? knownReturn
          ? 'Спільні інструменти недоступні тут. Відкрийте гру в новій вкладці. Інструменти SIM залишаються доступними.'
          : 'Цей пакет не містить спільних інструментів основної гри. Інструменти SIM залишаються доступними.'
        : knownReturn
          ? 'Shared tools are unavailable here. Open the game in a new tab. SIM tools remain available.'
          : 'This package does not include the main game tools. SIM tools remain available.'
      : uk
        ? 'Спільні інструменти завантажуються з основної гри.'
        : 'Shared tools load from the main game.';
  };
  refresh();
  const ensure = () => {
    if (disposed) return Promise.resolve(false);
    if (pending) return pending;
    pending = Promise.resolve()
      .then(() => loadProvider(new URL('ui/global-settings-tools.mjs', coreURL).href))
      .then((module) => {
        if (disposed) return false;
        if (typeof module?.mountGlobalSettingsTools !== 'function')
          throw new Error('Shared tools are unavailable');
        provider = module.mountGlobalSettingsTools({
          document: doc,
          window: win,
          settingsRoot,
          panels,
          prefix: 'sim-global-tools',
          coreURL,
          onOpen,
        });
        fallback.hidden = true;
        onControls(provider.controls);
        return true;
      })
      .catch(() => {
        failed = true;
        refresh();
        return false;
      });
    return pending;
  };
  return {
    ensure,
    refresh,
    root: () => provider?.root() ?? null,
    frameFocused: () => provider?.frameFocused() === true,
    handleFrameCommand: (command) => provider?.handleFrameCommand(command) === true,
    back: () => provider?.back() === true,
    dispose() {
      disposed = true;
      provider?.dispose();
      fallback.remove();
    },
  };
}

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
[data-sim-hud][data-hud-component][hidden],
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
[data-sim-hud='flight'][data-hud-component][data-hud-status-only='true'] [data-hud-part='card'] { height: auto; min-height: 32px; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto; }
[data-sim-hud='flight'][data-hud-component] :is([data-hud-part='navigation-label'], [data-hud-part='navigation-hint']) { grid-column: 1; font-size: 12px; line-height: 15px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; color: var(--hud-muted); }
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
    navigationLabel = make('div', 'navigation-label', card),
    navigationHint = make('div', 'navigation-hint', card),
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
    root.dataset.hudStatusOnly = String(options.statusOnly === true);
    // Paused practice can retain guidance, but a covering menu or result owns
    // the screen regardless of the simulation/playback state underneath it.
    root.hidden =
      options.visible === false ||
      !feedback ||
      (options.active === false && !options.paused && !options.replay);
    if (!feedback) return;
    telemetry.hidden = !options.telemetry;
    setText(telemetry, options.telemetry ?? '');
    const notice = !options.active ? copy(options.notice) : '',
      title = notice || copy(feedback.action) || copy(feedback.label) || t('Fly', 'Політ'),
      g = feedback.gauge;
    setText(action, title);
    navigationLabel.hidden = navigationHint.hidden = !options.navigation;
    setText(navigationLabel, options.navigation?.label ?? '');
    setText(navigationHint, options.navigation?.hint ?? '');
    navigationLabel.title = options.navigation?.label ?? '';
    navigationHint.title = options.navigation?.detail ?? '';
    action.title = [
      copy(feedback.label),
      title,
      options.navigation?.label,
      options.navigation?.detail,
    ]
      .filter(Boolean)
      .join(' · ');
    setAttribute(card, 'aria-label', action.title);
    setAttribute(
      explain,
      'aria-label',
      t('Explain the current objective', 'Пояснити поточну ціль'),
    );
    explain.title = t('Objective details', 'Умови завдання');
    gauge.hidden = !g;
    explain.hidden = options.explain === false;
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
    checks.hidden = options.statusOnly === true;
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
    details.hidden = options.statusOnly === true || preferences.mode !== 'detailed';
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
