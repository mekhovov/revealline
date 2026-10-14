import {
  OVERFLIGHT_BATTLEFIELDS,
  OVERFLIGHT_MOVEMENT_PRESETS,
  applyOverflightBattlefield,
  validateOverflightBattlefieldProject,
  validateOverflightMovement,
} from '../overflight/battlefields.mjs';
import { OVERFLIGHT_WORLDS, createOverflightWorldPresentation } from '../overflight/worlds.mjs';
import { overflightTerrainClear } from '../overflight/terrain.mjs';

const PRESETS = {
  pursuit: ['Pursuit', 'Переслідування'],
  'split-front': ['Split front', 'Розділений фронт'],
  'committed-flank': ['Committed flank', 'Рішучий обхід'],
  crosscut: ['Crossing interception', 'Перехоплення навхрест'],
  standoff: ['Ranged firing stops', 'Вогневі зупинки'],
  'screen-support': ['Protective screen', 'Захисний заслін'],
  convoy: ['Convoy', 'Колона'],
};

/** Validate a complete draft before changing it. Escort paths derive from their
 * objective so a route edit cannot silently detach the formation. */
export function editOverflightMovement(project, id, changes) {
  const next = structuredClone(project);
  const raid = next.format.startsWith('OverflightHunt');
  const sources = raid
    ? next.encounters.flatMap((entry) => [...entry.objectives, ...entry.packs])
    : next.encounters;
  const actor = sources.find((entry) => entry.id === id);
  if (!actor?.movement) throw new TypeError('Unknown movement source.');
  if (actor.escortOf && changes.anchors) throw new TypeError('Edit the escorted objective route.');
  actor.movement = { ...actor.movement, ...structuredClone(changes) };
  validateOverflightMovement(actor.movement, next.arena);
  for (const point of actor.movement.anchors)
    if (!overflightTerrainClear(next.terrain, point.x, point.y, point.x, point.y, 28))
      throw new TypeError('Keep movement anchors clear of cover.');
  if (raid && changes.anchors) {
    actor.route = structuredClone(changes.anchors);
    for (const wing of sources.filter((entry) => entry.escortOf === actor.id)) {
      const dx = wing.x - actor.x,
        dy = wing.y - actor.y;
      wing.route = actor.route.map((point) => ({ x: point.x + dx, y: point.y + dy }));
      wing.movement.anchors = structuredClone(wing.route);
      validateOverflightMovement(wing.movement, next.arena);
    }
  }
  validateOverflightBattlefieldProject(next);
  return next;
}

/** Layout edits are gameplay edits. World appearance remains a separate control. */
export function overflightBattlefieldEditor({
  document,
  project,
  locale = 'en',
  onChange,
  onApply,
}) {
  const words = (en, uk) => (locale === 'uk' ? uk : en);
  const node = (tag, text = '', attrs = {}) => {
    const value = document.createElement(tag);
    value.textContent = text;
    for (const [key, entry] of Object.entries(attrs)) value.setAttribute(key, entry);
    return value;
  };
  const root = node('fieldset', '', { 'data-battlefield-editor': '' });
  if (!project.battlefield) {
    root.hidden = true;
    return root;
  }
  root.append(
    node('legend', words('Battlefield layout and approaches', 'План поля бою та підходи')),
    node(
      'p',
      words(
        'Changing a layout replaces cover, routes and encounter approaches. It creates a different gameplay record. Appearance can be edited independently below.',
        'Зміна плану замінює перешкоди, маршрути й підходи та створює окремий ігровий рекорд. Оформлення можна змінити окремо нижче.',
      ),
    ),
  );
  const world = node('select', '', { 'data-battlefield-world': '' });
  const layout = node('select', '', { 'data-battlefield-layout': '' });
  const status = node('p', '', { role: 'status' });
  for (const entry of OVERFLIGHT_WORLDS)
    world.append(node('option', entry.title[locale] ?? entry.title.en, { value: entry.id }));
  world.value = project.battlefield.world;
  const fill = () => {
    layout.replaceChildren();
    for (const entry of OVERFLIGHT_BATTLEFIELDS.filter((value) => value.world === world.value))
      layout.append(node('option', entry.title[locale] ?? entry.title.en, { value: entry.id }));
    if (project.battlefield.world === world.value) layout.value = project.battlefield.id;
  };
  fill();
  world.addEventListener('change', fill);
  for (const [control, title] of [
    [world, words('World', 'Світ')],
    [layout, words('Layout', 'План')],
  ]) {
    const label = node('label', title);
    label.append(control);
    root.append(label);
  }
  const apply = node('button', words('Apply layout and routes', 'Застосувати план і маршрути'), {
    type: 'button',
    'data-battlefield-apply': '',
  });
  root.append(apply, status);
  apply.addEventListener('click', () => {
    try {
      const next = applyOverflightBattlefield(project, layout.value);
      next.presentation = createOverflightWorldPresentation(next.battlefield.world, next.arena, {
        layout: next.battlefield,
      });
      validateOverflightBattlefieldProject(next);
      Object.assign(project, next);
      onChange();
      onApply();
    } catch (error) {
      status.textContent = error.message;
    }
  });
  const motion = node('details');
  motion.append(node('summary', words('Encounter movement', 'Рух у боях')));
  const sources = project.format.startsWith('OverflightHunt')
    ? project.encounters.flatMap((entry) => [...entry.objectives, ...entry.packs])
    : project.encounters;
  for (const entry of sources) {
    if (!entry.movement) continue;
    const row = node('fieldset');
    row.append(node('legend', entry.id));
    const preset = node('select', '', { 'data-movement-preset': entry.id });
    for (const value of OVERFLIGHT_MOVEMENT_PRESETS)
      preset.append(node('option', words(...PRESETS[value]), { value }));
    preset.value = entry.movement.preset;
    preset.addEventListener('change', () => {
      const candidate = { ...entry.movement, preset: preset.value };
      try {
        validateOverflightMovement(candidate, project.arena);
        entry.movement = candidate;
        onChange();
        status.textContent = '';
      } catch (error) {
        preset.value = entry.movement.preset;
        status.textContent = error.message;
      }
    });
    const presetLabel = node('label', words('Movement pattern', 'Тип руху'));
    presetLabel.append(preset);
    row.append(presetLabel);
    for (const [key, title, min, max, step] of [
      ['commitmentSeconds', words('Commitment seconds', 'Тривалість маневру'), 1, 6, 0.25],
      ['formationWidth', words('Formation width', 'Ширина строю'), 48, 320, 1],
      [
        'coordinatedFraction',
        words('Coordinated group share', 'Частка узгоджених груп'),
        0,
        0.3,
        0.05,
      ],
    ]) {
      const label = node('label', title),
        input = node('input', '', { type: 'number', min, max, step, 'data-movement-field': key });
      input.value = entry.movement[key];
      input.addEventListener('change', () => {
        const candidate = { ...entry.movement, [key]: Number(input.value) };
        try {
          validateOverflightMovement(candidate, project.arena);
          entry.movement = candidate;
          onChange();
          status.textContent = '';
        } catch (error) {
          input.value = entry.movement[key];
          status.textContent = error.message;
        }
      });
      label.append(input);
      row.append(label);
    }
    if (entry.escortOf)
      row.append(
        node(
          'p',
          words('Route follows the escorted objective.', 'Маршрут наслідує ціль супроводу.'),
        ),
      );
    else {
      const anchors = node('details');
      anchors.append(node('summary', words('Route anchors', 'Опорні точки маршруту')));
      entry.movement.anchors.forEach((point, index) => {
        const pointRow = node('fieldset');
        pointRow.append(node('legend', `${words('Point', 'Точка')} ${index + 1}`));
        for (const coordinate of ['x', 'y']) {
          const label = node('label', coordinate.toUpperCase());
          const input = node('input', '', {
            type: 'number',
            min: 40,
            max: project.arena[coordinate === 'x' ? 'width' : 'height'] - 40,
            step: 1,
            'data-movement-anchor': `${entry.id}:${index}:${coordinate}`,
          });
          input.value = point[coordinate];
          input.addEventListener('change', () => {
            try {
              if (!String(input.value).trim())
                throw new TypeError(words('Enter a coordinate.', 'Введіть координату.'));
              const changed = structuredClone(entry.movement.anchors);
              changed[index][coordinate] = Number(input.value);
              const next = editOverflightMovement(project, entry.id, { anchors: changed });
              Object.assign(project, next);
              onChange();
              onApply();
              status.textContent = '';
            } catch (error) {
              input.value = entry.movement.anchors[index][coordinate];
              status.textContent = error.message;
            }
          });
          label.append(input);
          pointRow.append(label);
        }
        anchors.append(pointRow);
      });
      row.append(anchors);
    }
    motion.append(row);
  }
  root.append(motion);
  return root;
}

export function paintOverflightBattlefieldRoutes(context, battlefield) {
  if (!battlefield) return;
  context.save();
  context.lineWidth = 5;
  context.strokeStyle = '#75baa8';
  context.setLineDash([18, 12]);
  for (const route of battlefield.routes) {
    context.beginPath();
    route.points.forEach((point, index) =>
      index ? context.lineTo(point.x, point.y) : context.moveTo(point.x, point.y),
    );
    context.stroke();
  }
  context.setLineDash([]);
  for (const point of battlefield.courts) {
    context.strokeStyle = '#f4c765';
    context.strokeRect(point.x - 25, point.y - 25, 50, 50);
  }
  context.restore();
}
