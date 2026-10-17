import { validateAircraftPhysics } from './aircraft-physics.mjs';
import { createPresetConfiguration } from './aircraft-presets.mjs';

const axes = ['x', 'y', 'z'];
const positive = (value) => Number.isFinite(value) && value > 0;

/** Physical body and rotor-disc envelope in level body coordinates, matching
 * the runtime collider dimensions. No course's legacy drone radius is used. */
export function aircraftPracticeEnvelope(source) {
  const aircraft = validateAircraftPhysics(source),
    geometry = aircraft.geometry;
  const min = {},
    max = {};
  for (const axis of axes) {
    min[axis] = -geometry.bodyHalfExtents[axis] - geometry.centerOfMass[axis];
    max[axis] = geometry.bodyHalfExtents[axis] - geometry.centerOfMass[axis];
  }
  const rotorHalfHeight = geometry.ducted ? Math.max(geometry.bodyHalfExtents.y, 0.006) : 0.003;
  for (const rotor of geometry.rotors)
    for (const axis of axes) {
      const extent = axis === 'y' ? rotorHalfHeight : geometry.propellerRadius;
      min[axis] = Math.min(min[axis], rotor.position[axis] - extent);
      max[axis] = Math.max(max[axis], rotor.position[axis] + extent);
    }
  return {
    minMm: Object.fromEntries(axes.map((axis) => [axis, min[axis] * 1000])),
    maxMm: Object.fromEntries(axes.map((axis) => [axis, max[axis] * 1000])),
    dimensionsMm: Object.fromEntries(axes.map((axis) => [axis, (max[axis] - min[axis]) * 1000])),
  };
}

/** Advice only: neither course admission nor mission scoring consults this.
 * Checks all authored mode variants; a banked approach or an obstacle can need
 * more room than this conservative level-flight envelope. */
export function aircraftCourseAdvice(course, source) {
  const aircraft = validateAircraftPhysics(source),
    envelope = aircraftPracticeEnvelope(aircraft);
  const propellerDiameterMm = aircraft.geometry.propellerRadius * 2000;
  const classId = aircraft.geometry.ducted
    ? propellerDiameterMm <= 51
      ? 'whoop'
      : 'cinewhoop'
    : propellerDiameterMm > 300
      ? 'training'
      : propellerDiameterMm > 160
        ? 'long-range'
        : aircraft.id === 'mach-r5-sport-2050'
          ? 'racing'
          : 'freestyle';
  const spanMm = Math.ceil(Math.max(envelope.dimensionsMm.x, envelope.dimensionsMm.z));
  const heightMm = Math.ceil(envelope.dimensionsMm.y);
  const steps = Array.isArray(course?.steps)
    ? course.steps
    : Object.values(course?.steps ?? {}).flat();
  const gates = steps.filter(
    (step) =>
      step?.type === 'gate' &&
      ['x', 'z'].includes(step.axis) &&
      positive(step.maxSide - step.minSide) &&
      positive(step.maxY - step.minY),
  );
  const clearanceMm = gates.length
    ? Math.floor(
        Math.min(
          ...gates.map((gate) =>
            Math.min(gate.maxSide - gate.minSide - spanMm, gate.maxY - gate.minY - heightMm),
          ),
        ),
      )
    : null;
  const bounds = course?.bounds;
  const bounded = axes.every((axis) => positive(bounds?.max?.[axis] - bounds?.min?.[axis]));
  const boundsClearance = bounded
    ? Math.min(
        bounds.max.x - bounds.min.x - spanMm,
        bounds.max.z - bounds.min.z - spanMm,
        bounds.max.y - bounds.min.y - heightMm,
      )
    : null;
  // Recommendation margins describe maneuvering room, not a new restriction.
  const margin = Math.max(100, spanMm / 2);
  const recommended =
    (gates.length > 0 || bounded) &&
    (clearanceMm === null || clearanceMm >= margin) &&
    (boundsClearance === null || boundsClearance >= spanMm);
  const en = [],
    uk = [];
  if (clearanceMm === null) {
    en.push('No authored gates were available for a gate-clearance check.');
    uk.push('Немає заданих воріт для перевірки просвіту.');
  } else if (clearanceMm < 0) {
    en.push(
      `At least one gate is smaller than this aircraft’s level-flight envelope by ${-clearanceMm} mm.`,
    );
    uk.push(
      `Принаймні одні ворота менші за габарити цього дрона в горизонтальному польоті на ${-clearanceMm} мм.`,
    );
  } else {
    en.push(
      `Estimated level-flight spare room at the narrowest gate: ${clearanceMm} mm in total across the limiting dimension${clearanceMm < margin ? '; a tight approach' : ''}.`,
    );
    uk.push(
      `Оцінка запасу простору в найвужчих воротах у горизонтальному польоті: ${clearanceMm} мм сумарно за обмежувальним виміром${clearanceMm < margin ? '; тісний підхід' : ''}.`,
    );
  }
  if (boundsClearance !== null && boundsClearance < spanMm) {
    en.push(
      boundsClearance < 0
        ? 'The flight bounds are smaller than the level-flight aircraft envelope.'
        : 'The flight bounds leave little maneuvering room for this aircraft.',
    );
    uk.push(
      boundsClearance < 0
        ? 'Межі польоту менші за габарити дрона в горизонтальному положенні.'
        : 'Межі польоту залишають мало простору для маневрування цим дроном.',
    );
  }
  if (clearanceMm === null && boundsClearance === null) {
    en.push('No geometric course recommendation is available.');
    uk.push('Немає геометричних даних для рекомендації маршруту.');
  }
  en.push(
    'This estimate does not check obstacles or a banked approach. All courses remain available in practice; aircraft size stays unchanged.',
  );
  uk.push(
    'Ця оцінка не перевіряє перешкоди й підхід із креном. Усі маршрути доступні в практиці; розміри дрона не змінюються.',
  );
  return {
    classId,
    propellerDiameterMm,
    spanMm,
    ...(clearanceMm === null ? {} : { clearanceMm }),
    recommended,
    advisories: { en: en.join(' '), uk: uk.join(' ') },
  };
}

const courseClasses = [
  ['all', 'All courses', 'Усі маршрути'],
  ['whoop', 'Whoops · up to 2 inches', 'Вупи · до 2 дюймів', 'meteor85-analog'],
  ['cinewhoop', 'Cinewhoops · 2.2 inches', 'Сіневупи · 2,2 дюйма', 'pavo20-pro-ii-o4-4s'],
  ['freestyle', 'Freestyle · up to 5 inches', 'Фристайл · до 5 дюймів', 'nazgul-eco-xl5-v11'],
  ['racing', 'Racing · 5 inches', 'Перегони · 5 дюймів', 'mach-r5-sport-2050'],
  ['long-range', 'Long-range · up to 10 inches', 'Дальноліт · до 10 дюймів', 'helion-pro-o4'],
  ['training', 'Training · 15 inches', 'Навчальна платформа · 15 дюймів', 'holybro-x650-v2'],
];
const classAircraft = new Map();
export function aircraftClassRecommends(course, id = 'all') {
  const reference = courseClasses.find((row) => row[0] === id)?.[3];
  if (!reference) return true;
  if (!classAircraft.has(id)) classAircraft.set(id, createPresetConfiguration(reference).aircraft);
  return aircraftCourseAdvice(course, classAircraft.get(id)).recommended;
}

/** Optional browsing filter only. Launches never consult this preference. */
export function mountAircraftCourseFilter({ document: doc, locale, onChange }) {
  const root = doc.createElement('label'),
    caption = doc.createElement('span'),
    select = doc.createElement('select'),
    note = doc.createElement('small');
  root.className = 'fpv-aircraft-course-filter';
  select.dataset.aircraftCourseClass = '';
  root.append(caption, select, note);
  for (const [id] of courseClasses) {
    const option = doc.createElement('option');
    option.value = id;
    select.append(option);
  }
  select.value = 'all';
  select.addEventListener('change', onChange);
  function refresh() {
    const uk = locale() === 'uk';
    caption.textContent = uk ? 'Маршрути за класом дрона' : 'Courses suited to aircraft class';
    courseClasses.forEach((row, index) => {
      select.options[index].textContent = row[uk ? 2 : 1];
    });
    note.textContent = uk
      ? 'Поради за габаритами. «Усі маршрути» повертає повний список. Розміри дрона не змінюються.'
      : 'Based on clearance estimates. All courses restores the full list. Aircraft dimensions stay unchanged.';
  }
  refresh();
  return {
    root,
    refresh,
    matches: (course) => aircraftClassRecommends(course, select.value),
    dispose() {
      select.removeEventListener('change', onChange);
      root.remove();
    },
  };
}
