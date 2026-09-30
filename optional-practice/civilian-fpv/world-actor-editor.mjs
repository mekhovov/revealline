import { boundedJSON, exactKeys } from '../../game/data-json.mjs';

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
};

/** A small numeric authoring surface; the host owns validation and undo history. */
export function mountActorEditor({ container, getCourse, onChange, locale = 'en' }) {
  if (!container || typeof getCourse !== 'function' || typeof onChange !== 'function')
    throw new TypeError('Actor editor needs a container, course getter and change callback');
  const document = container.ownerDocument;
  let selected = null;
  let newType = 'drone';
  let objectiveMode = 'both';
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
  async function change(mutator, success = 'updated') {
    if (disposed || busy) return;
    busy = true;
    try {
      await onChange(mutator);
      message = text(success);
      error = false;
      busy = false;
      refresh();
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
    return change((course) => {
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
      selected = id;
    }, 'added');
  }
  function removeActor() {
    const id = selected;
    return change((course, bindings) => {
      course.actors = course.actors.filter((actor) => actor.id !== id);
      removeTargetReferences(course, bindings, id);
      selected = course.actors[0]?.id ?? null;
    }, 'removed');
  }
  function removeTargetReferences(course, bindings, id) {
    for (const mode of MODES)
      alterSteps(course, bindings, mode, (step) => {
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
    if (!selected) {
      container.append(announcement);
      return;
    }
    const actor = actorIn(course);
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
      refresh();
    },
    selected: () => selected,
    dispose() {
      disposed = true;
      container.replaceChildren();
    },
  };
}
