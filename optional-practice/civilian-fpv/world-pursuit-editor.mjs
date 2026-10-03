import { PURSUIT_COURSE, PURSUIT_FORMAT, PURSUIT_FAMILIES } from './world-pursuit.mjs';

/** Remove policy ownership with the same transaction as native actor/objective edits. */
export function removePursuitActor(course, id) {
  if (!course.pursuit) return;
  const removed = course.pursuit.actors.find((actor) => actor.id === id);
  course.pursuit.actors = course.pursuit.actors.filter((actor) => actor.id !== id);
  if (removed?.pair)
    for (const actor of course.pursuit.actors)
      if (actor.pair === removed.pair) {
        actor.family = 'runner';
        actor.pair = null;
      }
  if (!course.pursuit.actors.length) {
    delete course.pursuit;
    course.format = 'FlightCourse.v2';
    for (const actor of course.actors) delete actor.vehicleModel;
  }
}

/** Explicit successor: preserve the existing course until native admission succeeds. */
export function pursuitFromWaypoints(course, id, family = 'runner') {
  const actor = course.actors.find((item) => item.id === id);
  if (
    !actor ||
    !['patrol', 'sentry'].includes(actor.type) ||
    actor.role !== 'hostile' ||
    actor.fireEveryTicks !== 0
  )
    throw new TypeError('Choose an unarmed hostile Hunt target.');
  if (course.pursuit) throw new TypeError('Edit the existing pursuit graph.');
  const points = [actor.position, ...actor.path].filter(
    (point, index, all) =>
      all.findIndex((other) => ['x', 'y', 'z'].every((axis) => point[axis] === other[axis])) ===
      index,
  );
  if (points.length < 2) throw new TypeError('Add at least one distinct native waypoint first.');
  const nodes = points.map((position, index) => ({
    id: `node-${index + 1}`,
    position: { ...position },
  }));
  const edges = nodes.slice(1).map((node, index) => ({ from: nodes[index].id, to: node.id }));
  if (nodes.length > 2) edges.push({ from: nodes.at(-1).id, to: nodes[0].id });
  course.format = PURSUIT_COURSE;
  course.pursuit = {
    format: PURSUIT_FORMAT,
    nodes,
    edges,
    actors: [{ id, family, start: nodes[0].id, goals: nodes.map((node) => node.id), pair: null }],
  };
  actor.path = [];
}

/** Bounded graph editor uses the host's native validation, Undo and atomic commit. */
export function renderPursuitEditor({
  document,
  course,
  selected,
  locale,
  change,
  busy,
  draft = {},
}) {
  const uk = locale === 'uk',
    text = (en, translated) => (uk ? translated : en);
  const el = (tag, content) => {
    const node = document.createElement(tag);
    if (content) node.textContent = content;
    return node;
  };
  const panel = el('details'),
    title = el(
      'summary',
      text('Native pursuit · advanced routes', 'Наземне переслідування · маршрути'),
    );
  panel.dataset.pursuitEditor = '';
  panel.append(
    title,
    el(
      'p',
      text(
        'Create a versioned pursuit from the selected unarmed Hunt target’s native waypoints. Ground support, body clearance and slopes are checked before applying. Runner: 1.5 m/s, 6 m sight range, 0.5 s decisions. Armor: 25 hull damage with a 0.4 s cooldown.',
        'Створіть версію переслідування з точок вибраної неозброєної цілі. Перед застосуванням перевіряються опора, габарити й схили. Бігун: 1,5 м/с, огляд 6 м, рішення кожні 0,5 с. Броня: 25 шкоди корпусу з паузою 0,4 с.',
      ),
    ),
  );
  const button = (label, run, disabled = false) => {
    const node = el('button', label);
    node.type = 'button';
    node.disabled = busy || disabled;
    node.addEventListener('click', run);
    return node;
  };
  if (!course.pursuit) {
    for (const key of Object.keys(draft)) delete draft[key];
    panel.append(
      button(
        text('Create Runner from waypoints', 'Створити бігуна з точок'),
        () => change((next) => pursuitFromWaypoints(next, selected)),
        !selected,
      ),
    );
    return panel;
  }
  const explanation = el(
    'p',
    text(
      `Graph: at most 64 nodes / 128 undirected edges, millimetres. Policies: ${PURSUIT_FAMILIES.join(', ')}. Each actor starts at its node; clear its ordinary path. Required targets remain in Contact Hunt objectives; couriers must be optional. Rendezvous uses two actors with the same pair ID and one identical goal. All edits below apply together.`,
      `Граф: до 64 вузлів / 128 ненапрямлених ребер, міліметри. Політики: ${PURSUIT_FAMILIES.join(', ')}. Персонаж починає у своєму вузлі без звичайного маршруту. Обов’язкові цілі залишаються в завданнях полювання; кур’єри необов’язкові. Пара має спільний pair та одну однакову ціль. Усі зміни застосовуються разом.`,
    ),
  );
  const input = el('textarea');
  input.rows = 18;
  input.maxLength = 65536;
  input.spellcheck = false;
  input.setAttribute(
    'aria-label',
    text('Pursuit graph and actor policies JSON', 'JSON графа та політик персонажів'),
  );
  const fingerprint = JSON.stringify({
    pursuit: course.pursuit,
    actors: course.actors,
    steps: course.steps,
  });
  if (draft.fingerprint !== fingerprint) {
    draft.fingerprint = fingerprint;
    draft.value = JSON.stringify(course.pursuit, null, 2);
    draft.base = draft.value;
  }
  input.value = draft.value;
  const status = el('p');
  status.setAttribute('role', 'status');
  let dirty = input.value !== JSON.stringify(course.pursuit, null, 2);
  input.addEventListener('input', () => {
    dirty = true;
    draft.value = input.value;
    status.textContent = text(
      'Unapplied pursuit changes. Apply before editing other panels.',
      'Незастосовані зміни. Застосуйте їх перед редагуванням інших панелей.',
    );
  });
  panel.append(
    explanation,
    input,
    button(text('Apply graph and Hunt targets', 'Застосувати граф і цілі полювання'), () =>
      change((next) => {
        const accepted = JSON.parse(input.value);
        next.pursuit = accepted;
        next.format = PURSUIT_COURSE;
        for (const mode of ['self-level', 'acro']) {
          const hunt = next.steps[mode].find((step) => step.type === 'hunt-contact-v1');
          if (!hunt) throw new TypeError('Add a Contact Hunt objective in each flight mode first.');
          for (const policy of accepted.actors ?? []) {
            if (policy.family === 'courier')
              hunt.targets = hunt.targets.filter((id) => id !== policy.id);
            else if (!hunt.targets.includes(policy.id)) hunt.targets.push(policy.id);
          }
        }
        for (const policy of accepted.actors ?? []) {
          const actor = next.actors.find((item) => item.id === policy.id);
          const start = accepted.nodes?.find((node) => node.id === policy.start);
          if (actor && start) {
            actor.path = [];
            actor.position = { ...start.position };
          }
        }
      }),
    ),
    button(text('Discard graph edits', 'Скасувати зміни графа'), () => {
      input.value = draft.base;
      draft.value = draft.base;
      dirty = false;
      status.textContent = '';
    }),
    button(text('Return to ordinary native actors', 'Повернути звичайних персонажів'), () => {
      if (dirty) {
        status.textContent = text(
          'Apply or undo your text edits first.',
          'Спершу застосуйте або скасуйте зміни тексту.',
        );
        return;
      }
      return change((next) => {
        delete next.pursuit;
        next.format = 'FlightCourse.v2';
        for (const actor of next.actors) delete actor.vehicleModel;
      });
    }),
    status,
  );
  return panel;
}
