import { boundedJSON, exactKeys } from '../../game/data-json.mjs';
import { ACTOR_CASTS, actorFieldGuide } from '../../game/hunt/actor-catalog.mjs';
import { drawHuntActor } from '../../game/hunt/actor-art.mjs';
import { sharedActorAppearance } from '../../game/hunt/preferences.mjs';

const TYPES = ['drone', 'patrol', 'sentry', 'vehicle', 'hazard'];
const AXES = ['x', 'y', 'z'];
const MODES = ['self-level', 'acro'];
const LABELS = {
  heading: ['Actors & encounters', 'Персонажі та сутички'],
  actor: ['Selected actor', 'Вибраний персонаж'],
  empty: ['No actors yet', 'Персонажів ще немає'],
  kind: ['New actor type', 'Тип нового персонажа'],
  drone: ['Drone', 'Дрон'],
  patrol: ['Ground patrol', 'Наземний патруль'],
  sentry: ['Ground sentry', 'Наземний вартовий'],
  vehicle: ['Patrol vehicle', 'Патрульна машина'],
  hazard: ['Moving hazard', 'Рухома перешкода'],
  role: ['Actor role', 'Роль персонажа'],
  hostile: ['Hostile · pulse combat', 'Ворожий · імпульсний бій'],
  rival: ['Rival · no weapons or damage', 'Суперник · без зброї та шкоди'],
  civilian: ['Civilian · background movement', 'Цивільний · фоновий рух'],
  roleHelp: [
    'Rivals and civilians cannot be damaged. Changing role removes incompatible defeat objectives.',
    'Суперники та цивільні не отримують шкоди. Зміна ролі видаляє несумісні завдання знешкодження.',
  ],
  add: ['Add actor', 'Додати персонажа'],
  remove: ['Remove actor', 'Видалити персонажа'],
  position: ['Position · metres', 'Позиція · метри'],
  speed: ['Speed · m/s', 'Швидкість · м/с'],
  health: ['Health', 'Здоров’я'],
  cooldown: ['Fire interval · ticks (0 = disabled)', 'Інтервал пострілів · такти (0 = вимкнено)'],
  timing: [
    '50 ticks = 1 second. Pulse weapons are fictional.',
    '50 тактів = 1 секунда. Імпульсна зброя вигадана.',
  ],
  apply: ['Apply actor settings', 'Застосувати налаштування'],
  route: ['Waypoint route', 'Маршрут за точками'],
  routeHelp: [
    'Waypoints loop in order. Ground routes need supporting surfaces, slopes up to 30° and steps up to 0.2 m.',
    'Точки проходяться по колу за порядком. Наземному маршруту потрібні опорні поверхні, схили до 30° і сходинки до 0,2 м.',
  ],
  waypoint: ['Waypoint', 'Точка маршруту'],
  addWaypoint: ['Add waypoint', 'Додати точку'],
  applyRoute: ['Apply route', 'Застосувати маршрут'],
  up: ['Move waypoint earlier', 'Перемістити точку раніше'],
  down: ['Move waypoint later', 'Перемістити точку пізніше'],
  removeWaypoint: ['Remove waypoint', 'Видалити точку'],
  advanced: ['Advanced actor settings', 'Додаткові налаштування персонажа'],
  radius: ['Collision radius · m', 'Радіус зіткнень · м'],
  height: ['Height · m', 'Висота · м'],
  damage: ['Pulse damage', 'Шкода від імпульсу'],
  pulseSpeed: ['Pulse speed · m/s', 'Швидкість імпульсу · м/с'],
  range: ['Sight range · m', 'Дальність огляду · м'],
  json: ['Waypoint JSON · metres', 'JSON точок маршруту · метри'],
  applyJSON: ['Apply waypoint JSON', 'Застосувати JSON маршруту'],
  mode: ['Objective modes', 'Режими завдання'],
  both: ['Both flight modes', 'Обидва режими польоту'],
  level: ['Self-level', 'Самовирівнювання'],
  acro: ['Acro', 'Акро'],
  objective: ['Add defeat objective', 'Додати завдання знешкодження'],
  objectiveHelp: [
    'Adds this hostile target before the final landing. Rivals, civilians and hazards cannot be defeat targets.',
    'Додає цю ворожу ціль перед завершальною посадкою. Суперники, цивільні та перешкоди не можуть бути цілями знешкодження.',
  ],
  updated: ['Actor updated.', 'Персонажа оновлено.'],
  added: [
    'Actor added. Position it clear of walls before flying.',
    'Персонажа додано. Розмістіть його подалі від стін перед польотом.',
  ],
  removed: [
    'Actor removed; its objective references were updated in both modes.',
    'Персонажа видалено; посилання в завданнях оновлено в обох режимах.',
  ],
  objectiveAdded: ['Defeat objective added.', 'Завдання знешкодження додано.'],
  invalidNumber: [
    'Enter a finite number for every field.',
    'Введіть скінченне число в кожне поле.',
  ],
  missing: ['Select an actor first.', 'Спочатку виберіть персонажа.'],
  budget: ['Maximum: 12 actors and 8 hazards.', 'Максимум: 12 персонажів і 8 перешкод.'],
  waypointsBudget: [
    'A route supports at most 64 waypoints.',
    'Маршрут підтримує не більше 64 точок.',
  ],
  tracking: ['Follow & observe', 'Супровід і спостереження'],
  trackingObjective: ['Tracking objective', 'Завдання спостереження'],
  newTracking: ['New tracking objective', 'Нове завдання спостереження'],
  subject: ['Subject', 'Об’єкт спостереження'],
  trackingKind: ['Activity', 'Дія'],
  observe: ['Observe', 'Спостерігати'],
  follow: ['Follow', 'Супроводжувати'],
  trackingModes: ['Add to flight modes', 'Додати до режимів польоту'],
  minDistance: ['Minimum distance · m', 'Мінімальна відстань · м'],
  maxDistance: ['Maximum distance · m', 'Максимальна відстань · м'],
  maxRelativeSpeed: ['Maximum relative speed · m/s', 'Максимальна відносна швидкість · м/с'],
  maxTilt: ['Maximum bank / tilt · degrees', 'Максимальний крен / нахил · градуси'],
  viewAngle: [
    'Maximum angle from drone nose · degrees',
    'Максимальний кут від носа дрона · градуси',
  ],
  ticks: [
    'Minimum continuous tracking time · seconds',
    'Мінімальний час безперервного спостереження · секунди',
  ],
  minTargetTravel: ['Required subject travel · m', 'Потрібна пройдена об’єктом відстань · м'],
  trackingHelp: [
    'Stay airborne, keep a clear sight line and point the drone nose toward the subject within these limits. Camera tilt and field of view do not change the objective. Leaving any limit resets both the timer and subject travel.',
    'Залишайтеся в повітрі, тримайте пряму видимість і спрямовуйте ніс дрона на об’єкт у заданих межах. Нахил камери та поле зору не змінюють завдання. Вихід за будь-яку межу скидає час і пройдену об’єктом відстань.',
  ],
  followHelp: [
    'Follow needs a moving subject with at least two distinct waypoints. Both time and subject travel must be reached continuously.',
    'Для супроводу потрібен рухомий об’єкт із принаймні двома різними точками маршруту. Час і потрібну відстань об’єкта слід набрати безперервно.',
  ],
  observeHelp: [
    'Observe requires continuous time within the limits; the subject may stay still or move.',
    'Спостереження потребує безперервного часу в заданих межах; об’єкт може стояти або рухатися.',
  ],
  trackingScope: [
    'Editing, removing or moving this objective changes only the selected flight mode. Other modes keep their own settings.',
    'Зміна, видалення або переміщення цього завдання діє лише у вибраному режимі польоту. Інші режими зберігають власні налаштування.',
  ],
  addTracking: ['Add tracking objective', 'Додати завдання спостереження'],
  applyTracking: ['Apply tracking settings', 'Застосувати налаштування спостереження'],
  removeTracking: ['Remove tracking objective', 'Видалити завдання спостереження'],
  trackingEarlier: ['Move objective earlier', 'Перемістити завдання раніше'],
  trackingLater: ['Move objective later', 'Перемістити завдання пізніше'],
  trackingAdded: [
    'Tracking objective added to the selected flight modes.',
    'Завдання додано до вибраних режимів польоту.',
  ],
  trackingUpdated: ['Tracking objective updated.', 'Завдання спостереження оновлено.'],
  trackingRemoved: [
    'Tracking objective removed from the selected mode.',
    'Завдання спостереження видалено з вибраного режиму.',
  ],
  trackingMoved: [
    'Tracking objective moved in the selected mode.',
    'Завдання спостереження переміщено у вибраному режимі.',
  ],
  trackingMissing: [
    'Choose a non-hazard subject first.',
    'Спочатку виберіть об’єкт, що не є перешкодою.',
  ],
  trackingStale: [
    'The objective changed. Select it again before editing.',
    'Завдання змінилося. Виберіть його знову перед редагуванням.',
  ],
  trackingRange: [
    'Maximum distance must exceed minimum distance by at least 0.1 m.',
    'Максимальна відстань має перевищувати мінімальну принаймні на 0,1 м.',
  ],
  trackingBudget: [
    'A flight mode supports at most 64 objectives.',
    'Режим польоту підтримує щонайбільше 64 завдання.',
  ],
  trackingLast: [
    'Keep at least one objective in this flight mode.',
    'Залиште хоча б одне завдання у цьому режимі польоту.',
  ],
  trackingInvalid: [
    'Enter a value within the displayed limits and increments.',
    'Введіть значення у вказаних межах і з указаним кроком.',
  ],
};

/** A small numeric authoring surface; the host owns validation and undo history. */
export function mountActorEditor({ container, getCourse, onChange, locale = 'en' }) {
  if (!container || typeof getCourse !== 'function' || typeof onChange !== 'function')
    throw new TypeError('Actor editor needs a container, course getter and change callback');
  const document = container.ownerDocument;
  let selected = null;
  let newType = 'drone';
  let objectiveMode = 'both';
  let trackingSelection = null;
  let trackingAddMode = 'both';
  let trackingKind = 'observe';
  let message = '';
  let error = false;
  let disposed = false;
  let busy = false;
  const text = (key) =>
    LABELS[key][(typeof locale === 'function' ? locale() : locale) === 'uk' ? 1 : 0];
  const element = (tag, content, className) => {
    const node = document.createElement(tag);
    if (content !== undefined) node.textContent = content;
    if (className) node.className = className;
    return node;
  };
  const label = (title, input) => {
    const node = element('label');
    node.append(element('span', title), input);
    return node;
  };
  const button = (title, action, disabled = false) => {
    const node = element('button', title);
    node.type = 'button';
    node.disabled = disabled || busy;
    node.addEventListener('click', action);
    return node;
  };
  const choose = (items, value, title) => {
    const node = element('select');
    node.setAttribute('aria-label', title);
    for (const [id, name] of items) {
      const option = element('option', name);
      option.value = id;
      node.append(option);
    }
    node.value = value;
    return node;
  };
  function number(value, title, { min, max, step = 1 } = {}) {
    const input = element('input');
    input.type = 'number';
    input.value = String(value);
    input.step = String(step);
    if (min !== undefined) input.min = String(min);
    if (max !== undefined) input.max = String(max);
    input.setAttribute('aria-label', title);
    return input;
  }
  function numeric(input, scale = 1) {
    const value = input.valueAsNumber;
    if (!Number.isFinite(value)) throw new TypeError(text('invalidNumber'));
    return Math.round(value * scale);
  }
  function actorIn(course, id = selected) {
    const actor = course.actors.find((item) => item.id === id);
    if (!actor) throw new TypeError(text('missing'));
    return actor;
  }
  function status() {
    const node = container.querySelector('[data-actor-status]');
    if (node) {
      node.textContent = message;
      node.setAttribute('role', error ? 'alert' : 'status');
    }
  }
  async function change(mutator, success = 'updated', committed = () => {}) {
    if (disposed || busy) return;
    busy = true;
    try {
      await onChange(mutator);
      committed();
      message = text(success);
      error = false;
      busy = false;
      refresh();
      if (success.startsWith('tracking')) focusTracking();
    } catch (cause) {
      message = cause.message;
      error = true;
      status();
    } finally {
      busy = false;
    }
  }
  function positionFields(position, bounds, name) {
    const group = element('div', undefined, 'numeric-grid');
    const fields = {};
    for (const key of AXES) {
      const title = `${name} ${key.toUpperCase()} · m`;
      fields[key] = number(position[key] / 1000, title, {
        min: bounds.min[key] / 1000,
        max: bounds.max[key] / 1000,
        step: 0.1,
      });
      group.append(label(`${key.toUpperCase()} · m`, fields[key]));
    }
    return {
      group,
      read: () => Object.fromEntries(AXES.map((key) => [key, numeric(fields[key], 1000)])),
    };
  }
  function alterSteps(course, bindings, mode, transform) {
    const old = course.steps[mode];
    const next = [];
    const refs = [];
    old.forEach((step, index) => {
      const result = transform(step, index);
      if (result) {
        next.push(result);
        refs.push(bindings?.[mode]?.[index] ?? null);
      }
    });
    if (!next.length) {
      next.push({ type: 'survive', ticks: Math.min(50, course.rules?.maxTicks ?? 36000) });
      refs.push(null);
    }
    course.steps[mode] = next;
    if (bindings?.[mode]) bindings[mode] = refs;
  }
  function addActor() {
    let addedId;
    return change(
      (course) => {
        if (
          course.actors.filter((actor) => (actor.type === 'hazard') === (newType === 'hazard'))
            .length >= (newType === 'hazard' ? 8 : 12)
        )
          throw new TypeError(text('budget'));
        let n = 1;
        const ids = new Set([...course.actors, ...course.obstacles].map((item) => item.id));
        while (ids.has(`${newType}-${n}`)) n++;
        const id = `${newType}-${n}`;
        const grounded = ['patrol', 'sentry', 'vehicle'].includes(newType);
        const radius = newType === 'vehicle' ? 900 : newType === 'hazard' ? 500 : 300;
        const position = {
          x: Math.max(
            course.bounds.min.x + radius,
            Math.min(course.bounds.max.x - radius, course.spawn.x + 4000),
          ),
          y: grounded
            ? course.bounds.min.y
            : Math.max(
                course.bounds.min.y,
                Math.min(course.bounds.max.y - 2 * radius, course.spawn.y + 2000),
              ),
          z: Math.max(
            course.bounds.min.z + radius,
            Math.min(course.bounds.max.z - radius, course.spawn.z - 4000),
          ),
        };
        course.actors.push({
          id,
          type: newType,
          position,
          path: [],
          speed: newType === 'sentry' ? 0 : 1500,
          radius,
          height: ['patrol', 'sentry'].includes(newType) ? 1800 : 2 * radius,
          health: 50,
          fireEveryTicks: newType === 'hazard' ? 0 : 100,
          damage: 10,
          projectileSpeed: 8000,
          range: 20000,
        });
        addedId = id;
      },
      'added',
      () => {
        selected = addedId;
        trackingSelection = null;
      },
    );
  }
  function removeActor() {
    const id = selected;
    return change(
      (course, bindings) => {
        course.actors = course.actors.filter((actor) => actor.id !== id);
        removeTargetReferences(course, bindings, id, { removeTracking: true });
        selected = course.actors[0]?.id ?? null;
      },
      'removed',
      () => {
        selected = getCourse().actors[0]?.id ?? null;
        trackingSelection = null;
      },
    );
  }
  function removeTargetReferences(course, bindings, id, { removeTracking = false } = {}) {
    for (const mode of MODES)
      alterSteps(course, bindings, mode, (step) => {
        if (removeTracking && step.type === 'actor-track-v1' && step.actorId === id) return null;
        if (step.type !== 'eliminate') return step;
        const targets = step.targets.filter((target) => target !== id);
        return targets.length ? { ...step, targets } : null;
      });
  }
  function addObjective() {
    const id = selected;
    return change((course, bindings) => {
      const actor = actorIn(course, id);
      if (actor.type === 'hazard' || (actor.role ?? 'hostile') !== 'hostile')
        throw new TypeError(text('objectiveHelp'));
      for (const mode of objectiveMode === 'both' ? MODES : [objectiveMode]) {
        if (
          course.steps[mode].some((step) => step.type === 'eliminate' && step.targets.includes(id))
        )
          continue;
        const steps = course.steps[mode];
        const index = steps.at(-1)?.type === 'land' ? steps.length - 1 : steps.length;
        steps.splice(index, 0, { type: 'eliminate', targets: [id] });
        bindings?.[mode]?.splice(index, 0, null);
      }
    }, 'objectiveAdded');
  }
  const trackingRows = (course) =>
    MODES.flatMap((mode) =>
      course.steps[mode].flatMap((step, index) =>
        step.type === 'actor-track-v1' ? [{ mode, index, step }] : [],
      ),
    );
  const canFollow = (actor) =>
    actor &&
    actor.speed > 0 &&
    actor.path.length > 1 &&
    actor.path.some((point) => AXES.some((axis) => point[axis] !== actor.path[0][axis]));
  function focusTracking() {
    const selector = container.querySelector('[data-tracking-objective]');
    selector?.focus({ preventScroll: true });
    selector?.scrollIntoView?.({ block: 'nearest' });
  }
  function renderTracking(course) {
    const subjects = course.actors.filter((actor) => actor.type !== 'hazard');
    const rows = trackingRows(course);
    const current = rows.find(
      (row) => row.mode === trackingSelection?.mode && row.index === trackingSelection.index,
    );
    if (!current) trackingSelection = null;
    const panel = element('section');
    panel.dataset.trackingEditor = '';
    panel.append(element('h4', text('tracking')));
    const key = (row) => `${row.mode}:${row.index}`;
    const picker = choose(
      [
        ['', text('newTracking')],
        ...rows.map((row) => [
          key(row),
          `${text(row.mode === 'acro' ? 'acro' : 'level')} · ${row.index + 1}. ${text(row.step.minTargetTravel ? 'follow' : 'observe')} · ${row.step.actorId}`,
        ]),
      ],
      current ? key(current) : '',
      text('trackingObjective'),
    );
    picker.dataset.trackingObjective = '';
    picker.addEventListener('change', () => {
      const row = rows.find((value) => key(value) === picker.value);
      trackingSelection = row ? { mode: row.mode, index: row.index } : null;
      if (row) selected = row.step.actorId;
      refresh();
      focusTracking();
    });
    panel.append(label(text('trackingObjective'), picker));
    if (!subjects.length) {
      panel.append(element('p', text('trackingMissing'), 'hint'));
      return panel;
    }
    const initial = current?.step ?? {
      type: 'actor-track-v1',
      actorId: subjects.some((actor) => actor.id === selected) ? selected : subjects[0].id,
      minDistance: 3000,
      maxDistance: 15000,
      maxRelativeSpeed: 4000,
      maxTilt: 4500,
      ticks: Math.min(150, course.rules?.maxTicks ?? 36000),
      viewAngle: 7000,
      minTargetTravel: trackingKind === 'follow' ? 10000 : 0,
    };
    const subject = choose(
      subjects.map((actor) => [actor.id, `${text(actor.type)} · ${actor.id}`]),
      initial.actorId,
      text('subject'),
    );
    subject.dataset.trackingSubject = '';
    const kind = choose(
      ['observe', 'follow'].map((value) => [value, text(value)]),
      initial.minTargetTravel ? 'follow' : 'observe',
      text('trackingKind'),
    );
    kind.dataset.trackingKind = '';
    panel.append(label(text('subject'), subject), label(text('trackingKind'), kind));
    const modes = choose(
      [
        ['both', text('both')],
        ['self-level', text('level')],
        ['acro', text('acro')],
      ],
      trackingAddMode,
      text('trackingModes'),
    );
    modes.dataset.trackingModes = '';
    if (!current) panel.append(label(text('trackingModes'), modes));
    else panel.append(element('p', text('trackingScope'), 'hint'));
    modes.addEventListener('change', () => {
      trackingAddMode = modes.value;
    });
    const grid = element('div', undefined, 'numeric-grid');
    const fields = {};
    const specs = [
      ['minDistance', 1000, 0.1, 100, 0.001],
      ['maxDistance', 1000, 0.2, 100, 0.001],
      ['ticks', 50, 0.02, Math.min(5000, course.rules?.maxTicks ?? 36000) / 50, 0.02],
      ['minTargetTravel', 1000, 0.001, 1500, 0.001],
      ['maxRelativeSpeed', 1000, 0, 60, 0.001],
      ['maxTilt', 100, 0, 90, 0.01],
      ['viewAngle', 100, 1, 90, 0.01],
    ];
    for (const [name, scale, min, max, step] of specs) {
      fields[name] = number(
        name === 'minTargetTravel'
          ? (initial.minTargetTravel || 10000) / scale
          : initial[name] / scale,
        text(name),
        { min, max, step },
      );
      fields[name].dataset.trackingField = name;
      fields[name].inputMode = 'decimal';
      const fieldLabel = label(text(name), fields[name]);
      fieldLabel.append(element('small', `${min}–${max}`));
      grid.append(fieldLabel);
    }
    const help = element('p', undefined, 'hint');
    const updateKind = () => {
      fields.minTargetTravel.disabled = kind.value !== 'follow';
      fields.minTargetTravel.parentElement.hidden = kind.value !== 'follow';
      help.textContent = text(kind.value === 'follow' ? 'followHelp' : 'observeHelp');
      trackingKind = kind.value;
    };
    kind.addEventListener('change', updateKind);
    updateKind();
    panel.append(grid, help, element('p', text('trackingHelp'), 'hint'));
    const read = (next) => {
      const actor = next.actors.find((item) => item.id === subject.value && item.type !== 'hazard');
      if (!actor) throw new TypeError(text('trackingMissing'));
      if (kind.value === 'follow' && !canFollow(actor)) throw new TypeError(text('followHelp'));
      const values = { type: 'actor-track-v1', actorId: actor.id };
      for (const [name, scale, min, max] of specs) {
        if (name === 'minTargetTravel' && kind.value !== 'follow') {
          values[name] = 0;
          continue;
        }
        const value = fields[name].valueAsNumber;
        if (
          !Number.isFinite(value) ||
          value < min ||
          value > max ||
          Math.abs(value * scale - Math.round(value * scale)) > 0.000001
        ) {
          fields[name].setAttribute('aria-invalid', 'true');
          fields[name].focus();
          throw new TypeError(`${text(name)}: ${text('trackingInvalid')} ${min}–${max}.`);
        }
        fields[name].removeAttribute('aria-invalid');
        values[name] = Math.round(value * scale);
      }
      if (values.maxDistance < values.minDistance + 100) throw new TypeError(text('trackingRange'));
      return values;
    };
    const original = current ? JSON.stringify(current.step) : null;
    const locate = (next) => {
      if (!current || JSON.stringify(next.steps[current.mode]?.[current.index]) !== original)
        throw new Error(text('trackingStale'));
      return next.steps[current.mode];
    };
    const actions = element('div', undefined, 'button-row');
    const action = (name, labelKey, perform, disabled = false) => {
      const node = button(text(labelKey), perform, disabled);
      node.dataset.trackingAction = name;
      actions.append(node);
    };
    if (!current)
      action('add', 'addTracking', () => {
        let added;
        return change(
          (next, bindings) => {
            const values = read(next),
              targets = modes.value === 'both' ? MODES : [modes.value];
            if (!targets.every((mode) => MODES.includes(mode)))
              throw new TypeError(text('trackingInvalid'));
            if (targets.some((mode) => next.steps[mode].length >= 64))
              throw new TypeError(text('trackingBudget'));
            for (const mode of targets) {
              const steps = next.steps[mode],
                index = steps.at(-1)?.type === 'land' ? steps.length - 1 : steps.length;
              steps.splice(index, 0, { ...values });
              bindings?.[mode]?.splice(index, 0, null);
              added ??= { mode, index, actorId: values.actorId };
            }
          },
          'trackingAdded',
          () => {
            trackingSelection = { mode: added.mode, index: added.index };
            selected = added.actorId;
          },
        );
      });
    else {
      action('apply', 'applyTracking', () =>
        change(
          (next) => {
            const steps = locate(next),
              values = read(next);
            steps[current.index] = { ...steps[current.index], ...values };
          },
          'trackingUpdated',
          () => {
            selected = subject.value;
          },
        ),
      );
      action(
        'remove',
        'removeTracking',
        () =>
          change(
            (next, bindings) => {
              const steps = locate(next);
              if (steps.length === 1) throw new TypeError(text('trackingLast'));
              steps.splice(current.index, 1);
              bindings?.[current.mode]?.splice(current.index, 1);
            },
            'trackingRemoved',
            () => {
              trackingSelection = null;
            },
          ),
        course.steps[current.mode].length === 1,
      );
      for (const [delta, name, labelKey] of [
        [-1, 'up', 'trackingEarlier'],
        [1, 'down', 'trackingLater'],
      ])
        action(
          name,
          labelKey,
          () =>
            change(
              (next, bindings) => {
                const steps = locate(next),
                  other = current.index + delta;
                if (other < 0 || other >= steps.length) throw new Error(text('trackingStale'));
                [steps[current.index], steps[other]] = [steps[other], steps[current.index]];
                const refs = bindings?.[current.mode];
                if (refs) [refs[current.index], refs[other]] = [refs[other], refs[current.index]];
              },
              'trackingMoved',
              () => {
                trackingSelection = { mode: current.mode, index: current.index + delta };
              },
            ),
          current.index + delta < 0 || current.index + delta >= course.steps[current.mode].length,
        );
    }
    panel.append(actions);
    return panel;
  }
  function refresh() {
    if (disposed) return;
    const course = getCourse();
    container.replaceChildren(element('h3', text('heading')));
    const announcement = element('p', message, 'hint');
    announcement.dataset.actorStatus = '';
    announcement.setAttribute('role', error ? 'alert' : 'status');
    announcement.setAttribute('aria-live', 'polite');
    if (!course) {
      container.append(announcement);
      return;
    }
    const actors = course.actors ?? [];
    const trackingStep = course.steps[trackingSelection?.mode]?.[trackingSelection?.index];
    if (trackingStep?.type === 'actor-track-v1') selected = trackingStep.actorId;
    if (!actors.some((actor) => actor.id === selected)) selected = actors[0]?.id ?? null;
    const selector = choose(
      actors.length
        ? actors.map((actor) => [actor.id, `${text(actor.type)} · ${actor.id}`])
        : [['', text('empty')]],
      selected ?? '',
      text('actor'),
    );
    selector.disabled = !actors.length;
    selector.addEventListener('change', () => {
      selected = selector.value;
      trackingSelection = null;
      refresh();
    });
    container.append(label(text('actor'), selector));
    const kind = choose(
      TYPES.map((type) => [type, text(type)]),
      newType,
      text('kind'),
    );
    kind.addEventListener('change', () => {
      newType = kind.value;
    });
    const toolbar = element('div', undefined, 'button-row');
    toolbar.append(
      label(text('kind'), kind),
      button(text('add'), addActor),
      button(text('remove'), removeActor, !selected),
    );
    container.append(toolbar, element('p', text('budget'), 'hint'));
    container.append(renderTracking(course));
    if (!selected) {
      container.append(announcement);
      return;
    }
    const actor = actorIn(course);
    const contactTarget = MODES.some((mode) =>
      course.steps[mode]?.some(
        (step) => step.type === 'hunt-contact-v1' && step.targets.includes(actor.id),
      ),
    );
    if (contactTarget) {
      const language = (typeof locale === 'function' ? locale() : locale) === 'uk' ? 'uk' : 'en';
      const family = actor.speed > 0 ? 'patroller' : 'lookout';
      const guide = actorFieldGuide(family, language);
      const section = element('fieldset'),
        legend = element('legend', language === 'uk' ? 'Довідник цілей' : 'Target field guide');
      const preview = element('canvas');
      preview.width = preview.height = 112;
      preview.style.cssText = 'display:block;width:5rem;height:5rem;image-rendering:pixelated;';
      preview.setAttribute('aria-label', guide.name);
      const preferences = sharedActorAppearance();
      const cast = choose(
        [
          ['authored', language === 'uk' ? 'Як задумано' : 'As designed'],
          ...ACTOR_CASTS.map((entry) => [entry.id, entry.name[language]]),
        ],
        preferences.snapshot().cast,
        language === 'uk' ? 'Спільний вигляд персонажів' : 'Shared character cast',
      );
      const paint = () => {
        const ctx = preview.getContext?.('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, 112, 112);
        drawHuntActor(ctx, 0, 0, 112, 0, { kind: family, cast: cast.value, state: 'idle' });
      };
      cast.addEventListener('change', () => {
        preferences.set({ cast: cast.value });
        paint();
      });
      section.append(
        legend,
        preview,
        element('strong', guide.name),
        element('p', `${guide.goal} ${guide.tell} ${guide.counter}`),
        label(language === 'uk' ? 'Спільний вигляд персонажів' : 'Shared character cast', cast),
      );
      section.append(
        element(
          'p',
          language === 'uk'
            ? 'Вигляд спільний із грою. Цей льотний персонаж використовує справжній наземний маршрут; клітинкові щити й ривки не підмінюють його фізику.'
            : 'Appearance is shared with the game. This flight actor uses a native ground route; grid shields and bursts do not replace its physics.',
          'hint',
        ),
      );
      container.append(section);
      paint();
    }
    const role = choose(
      ['hostile', 'rival', 'civilian'].map((id) => [id, text(id)]),
      actor.role ?? 'hostile',
      text('role'),
    );
    if (actor.type !== 'hazard')
      container.append(label(text('role'), role), element('p', text('roleHelp'), 'hint'));
    const position = positionFields(actor.position, course.bounds, text('position'));
    container.append(element('h4', text('position')), position.group);
    const numericGroup = element('div', undefined, 'numeric-grid');
    const fields = {};
    const basic = [
      ['speed', 'speed', 1000, 0, 15, 0.1],
      ['health', 'health', 1, 1, 1000, 1],
      ['fireEveryTicks', 'cooldown', 1, 0, 5000, 1],
    ];
    const extra = [
      ['radius', 'radius', 1000, 0.1, 2, 0.1],
      ['height', 'height', 1000, 0.1, 5, 0.1],
      ['damage', 'damage', 1, 0, 1000, 1],
      ['projectileSpeed', 'pulseSpeed', 1000, 1, 60, 0.1],
      ['range', 'range', 1000, 0.1, 100, 0.1],
    ];
    const populate = (items, target) => {
      for (const [key, labelKey, scale, min, max, step] of items) {
        fields[key] = number(actor[key] / scale, text(labelKey), { min, max, step });
        target.append(label(text(labelKey), fields[key]));
      }
    };
    populate(basic, numericGroup);
    container.append(numericGroup, element('p', text('timing'), 'hint'));
    const advanced = element('details');
    advanced.append(element('summary', text('advanced')));
    const extraGrid = element('div', undefined, 'numeric-grid');
    populate(extra, extraGrid);
    const updateWeaponFields = () => {
      for (const key of ['fireEveryTicks', 'projectileSpeed', 'range'])
        fields[key].disabled = actor.type === 'hazard' || role.value !== 'hostile';
      fields.damage.disabled = actor.type !== 'hazard' && role.value !== 'hostile';
    };
    role.addEventListener('change', updateWeaponFields);
    updateWeaponFields();
    advanced.append(extraGrid);
    container.append(
      advanced,
      button(text('apply'), () =>
        change((next, bindings) => {
          const target = actorIn(next);
          target.position = position.read();
          for (const [key, , scale] of [...basic, ...extra])
            target[key] = numeric(fields[key], scale);
          if (target.type !== 'hazard') {
            target.role = role.value;
            if (target.role !== 'hostile') removeTargetReferences(next, bindings, target.id);
          }
        }),
      ),
    );

    container.append(element('h4', text('route')), element('p', text('routeHelp'), 'hint'));
    const waypointInputs = [];
    const readRoute = () => waypointInputs.map((item) => item.read());
    for (const [index, point] of (actor.path ?? []).entries()) {
      const pointFields = positionFields(point, course.bounds, `${text('waypoint')} ${index + 1}`);
      waypointInputs.push(pointFields);
      const row = element('div');
      const actions = element('div', undefined, 'button-row');
      const move = (offset) =>
        change((next) => {
          const path = readRoute();
          [path[index], path[index + offset]] = [path[index + offset], path[index]];
          actorIn(next).path = path;
        });
      actions.append(
        element('strong', `${text('waypoint')} ${index + 1}`),
        button('↑', () => move(-1), index === 0),
        button('↓', () => move(1), index === actor.path.length - 1),
        button(text('removeWaypoint'), () =>
          change((next) => {
            const path = readRoute();
            path.splice(index, 1);
            actorIn(next).path = path;
          }),
        ),
      );
      actions.children[1].setAttribute('aria-label', `${text('up')} ${index + 1}`);
      actions.children[2].setAttribute('aria-label', `${text('down')} ${index + 1}`);
      row.append(actions, pointFields.group);
      container.append(row);
    }
    const routeActions = element('div', undefined, 'button-row');
    routeActions.append(
      button(
        text('addWaypoint'),
        () =>
          change((next) => {
            const target = actorIn(next);
            const path = readRoute();
            if (path.length >= 64) throw new TypeError(text('waypointsBudget'));
            const last = path.at(-1) ?? target.position;
            path.push({
              ...last,
              x: Math.max(
                next.bounds.min.x + target.radius,
                Math.min(next.bounds.max.x - target.radius, last.x + 2000),
              ),
            });
            target.path = path;
          }),
        actor.path.length >= 64,
      ),
      button(
        text('applyRoute'),
        () =>
          change((next) => {
            actorIn(next).path = readRoute();
          }),
        !actor.path.length,
      ),
    );
    container.append(routeActions);
    const jsonDetails = element('details');
    const json = element('textarea');
    json.rows = 4;
    json.maxLength = 16384;
    json.spellcheck = false;
    json.setAttribute('aria-label', text('json'));
    json.value = JSON.stringify(
      (actor.path ?? []).map((point) =>
        Object.fromEntries(AXES.map((key) => [key, point[key] / 1000])),
      ),
      null,
      2,
    );
    jsonDetails.append(
      element('summary', text('json')),
      json,
      button(text('applyJSON'), () =>
        change((next) => {
          const path = boundedJSON(json.value, {
            maxBytes: 16384,
            maxNodes: 300,
            maxDepth: 2,
            maxArray: 64,
          });
          if (!Array.isArray(path)) throw new TypeError(text('waypointsBudget'));
          actorIn(next).path = path.map((point) => {
            exactKeys(point, AXES, text('waypoint'));
            if (!AXES.every((key) => Number.isFinite(point[key])))
              throw new TypeError(text('invalidNumber'));
            return Object.fromEntries(AXES.map((key) => [key, Math.round(point[key] * 1000)]));
          });
        }),
      ),
    );
    container.append(jsonDetails);
    const objective = choose(
      [
        ['both', text('both')],
        ['self-level', text('level')],
        ['acro', text('acro')],
      ],
      objectiveMode,
      text('mode'),
    );
    objective.addEventListener('change', () => {
      objectiveMode = objective.value;
    });
    const objectiveActions = element('div', undefined, 'button-row');
    objectiveActions.append(
      label(text('mode'), objective),
      button(
        text('objective'),
        addObjective,
        actor.type === 'hazard' || (actor.role ?? 'hostile') !== 'hostile',
      ),
    );
    container.append(objectiveActions, element('p', text('objectiveHelp'), 'hint'), announcement);
  }
  refresh();
  return {
    refresh,
    select(id) {
      selected = id;
      trackingSelection = null;
      refresh();
    },
    selectObjective(mode, index, { focus = false } = {}) {
      const step = getCourse()?.steps[mode]?.[index];
      if (!MODES.includes(mode) || step?.type !== 'actor-track-v1') return false;
      trackingSelection = { mode, index };
      selected = step.actorId;
      refresh();
      if (focus) focusTracking();
      return true;
    },
    selected: () => selected,
    dispose() {
      disposed = true;
      container.replaceChildren();
    },
  };
}
