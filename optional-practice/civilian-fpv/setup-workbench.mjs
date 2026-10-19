import { aircraftTuningFields } from './aircraft-tuning-fields.mjs';
const clone = (value) => structuredClone(value);
const get = (object, path) => path.split('.').reduce((value, key) => value?.[key], object);
const set = (object, path, value) => {
  const keys = path.split('.'),
    last = keys.pop();
  keys.reduce((current, key) => current[key], object)[last] = value;
};
export const WORKBENCH_VIEW_KEY = 'revealline.fpv.workbench.view.v1';

/** Search disclosure never changes the saved Basic/Expert preference. */
export function mountWorkbenchChrome({
  document: doc,
  window: win,
  root,
  t,
  listen,
  action,
  el,
  heading,
  status,
  onSection = () => {},
}) {
  const header = el('header');
  header.className = 'workbench-header';
  header.append(heading);
  const summary = el('p', '', header);
  summary.className = 'workbench-summary';
  const view = el('div', undefined, header);
  view.className = 'workbench-view';
  let expert = false,
    current = 'overview',
    revealed = null;
  try {
    expert = win.localStorage?.getItem(WORKBENCH_VIEW_KEY) === 'expert';
  } catch {
    /* Optional preference. */
  }
  const basicButton = action(t('Basic', 'Базовий'), () => chooseView(false), view);
  const expertButton = action(t('Expert', 'Експертний'), () => chooseView(true), view);
  const searchLabel = el('label', t('Search all settings', 'Пошук усіх налаштувань'), header);
  const search = el('input', undefined, searchLabel);
  search.type = 'search';
  search.setAttribute('aria-label', t('Search all settings', 'Пошук усіх налаштувань'));
  search.placeholder = t('Try expo, FOV or feedforward', 'Наприклад: expo, FOV або випередження');
  const results = el('div', undefined, header);
  results.className = 'workbench-search-results';
  results.hidden = true;
  const nav = el('nav');
  nav.className = 'workbench-nav';
  nav.setAttribute('aria-label', t('Setup sections', 'Розділи налаштувань'));
  const main = el('main');
  main.className = 'workbench-main';
  const sections = new Map();
  for (const [key, en, uk] of [
    ['overview', 'Overview', 'Огляд'],
    ['aircraft', 'Aircraft', 'Дрон'],
    ['rates', 'Rates & throttle', 'Рейти й газ'],
    ['camera', 'Camera', 'Камера'],
    ['controller', 'Flight response / PID', 'Реакція польоту / PID'],
    ['library', 'Library', 'Бібліотека'],
  ]) {
    const panel = el('section', undefined, main);
    panel.className = 'workbench-panel';
    panel.dataset.section = key;
    const title = el('h3', t(en, uk), panel);
    title.tabIndex = -1;
    const button = action(t(en, uk), () => show(key), nav);
    sections.set(key, { panel, button, title, aliases: `${en} ${uk}` });
  }
  root.append(header, nav, status, main);
  function applyView() {
    root.dataset.view = expert ? 'expert' : 'basic';
    basicButton.setAttribute('aria-pressed', String(!expert));
    expertButton.setAttribute('aria-pressed', String(expert));
    for (const node of main.querySelectorAll('[data-expert]')) {
      node.hidden =
        node.dataset.unavailable === 'true' ||
        (!expert &&
          node.dataset.customized !== 'true' &&
          !node.querySelector('[data-customized="true"]') &&
          !node.contains(doc.activeElement) &&
          !(revealed && (node === revealed || node.contains(revealed) || revealed.contains(node))));
    }
  }
  function chooseView(value) {
    expert = value;
    revealed = null;
    try {
      win.localStorage?.setItem(WORKBENCH_VIEW_KEY, expert ? 'expert' : 'basic');
    } catch {
      /* Draft still usable. */
    }
    applyView();
  }
  function show(key, focus = true) {
    current = sections.has(key) ? key : 'overview';
    for (const [name, entry] of sections) {
      entry.panel.hidden = name !== current;
      entry.button.setAttribute('aria-current', name === current ? 'page' : 'false');
    }
    onSection(current);
    if (focus) sections.get(current).title.focus();
  }
  const normalize = (value) => value.toLocaleLowerCase().replace(/[’']/g, '');
  function renderSearch() {
    const focused = Array.from(results.children).indexOf(doc.activeElement);
    results.replaceChildren();
    const query = normalize(search.value.trim());
    results.hidden = !query;
    if (!query) return;
    let found = 0;
    for (const [key, entry] of sections) {
      for (const input of entry.panel.querySelectorAll('input,select,textarea')) {
        if (input.type === 'range' || input.type === 'file') continue;
        const label = input.getAttribute('aria-label') || '';
        if (!normalize(`${label} ${input.dataset.search ?? ''} ${entry.aliases}`).includes(query))
          continue;
        found++;
        const availability = input.disabled
          ? t('unavailable', 'недоступно')
          : input.closest?.('[data-expert]')
            ? t('Expert', 'Експертний')
            : t('Basic', 'Базовий');
        const button = doc.createElement('button');
        button.type = 'button';
        button.textContent = `${label} · ${entry.title.textContent} · ${availability}`;
        button.addEventListener('click', () => {
          if (!entry.panel.contains(input)) return;
          revealed = input;
          show(key, false);
          applyView();
          for (let node = input.parentNode; node && node !== root; node = node.parentNode)
            if (node.tagName === 'DETAILS') node.open = true;
          results.hidden = true;
          input.focus();
          input.scrollIntoView?.({ block: 'center' });
        });
        results.append(button);
        if (found >= 40) break;
      }
      if (found >= 40) break;
    }
    if (!found) el('p', t('No matching settings', 'Налаштувань не знайдено'), results);
    if (focused >= 0) (results.querySelectorAll('button')[focused] ?? search).focus();
  }
  listen(search, 'input', renderSearch);
  show('overview', false);
  applyView();
  return {
    panel: (key) => sections.get(key).panel,
    show,
    refresh() {
      search.setAttribute('aria-label', t('Search all settings', 'Пошук усіх налаштувань'));
      search.placeholder = t(
        'Try expo, FOV or feedforward',
        'Наприклад: expo, FOV або випередження',
      );
      nav.setAttribute('aria-label', t('Setup sections', 'Розділи налаштувань'));
      applyView();
      if (!results.hidden) renderSearch();
    },
    reveal(node) {
      revealed = node;
      applyView();
    },
    current: () => current,
    summary(value) {
      summary.textContent = value;
    },
    add(key, ...nodes) {
      sections.get(key).panel.append(...nodes);
    },
  };
}

/** Controller/aircraft values remain text until a valid commit. */
export function mountWorkbenchPhysics({
  t,
  el,
  field,
  action,
  translatedAttribute,
  listen,
  aircraftParent,
  controllerParent,
  onChange,
}) {
  const note = el('p', '', controllerParent);
  const controllerGrid = el('div', undefined, controllerParent);
  controllerGrid.className = 'workbench-pid-matrix';
  const filters = el('fieldset', undefined, controllerParent);
  filters.dataset.expert = 'true';
  el('legend', t('Filters & anti-windup', 'Фільтри й захист інтегратора'), filters);
  const physical = el('fieldset', undefined, aircraftParent);
  physical.dataset.expert = 'true';
  el(
    'legend',
    t('Physical coefficients · SIM estimates', 'Фізичні коефіцієнти · оцінки SIM'),
    physical,
  );
  let configuration = null,
    baseline = null;
  const controls = [],
    fields = aircraftTuningFields();
  // Compact text is presentation only; untouched gains retain their exact double.
  const gainText = (value, exact) =>
    value === undefined ? '' : String(exact ? value : Number(value.toPrecision(12)));
  for (const axis of ['x', 'y', 'z'])
    fields.push([
      `aircraft.geometry.centerOfMass.${axis}`,
      `Centre of mass ${axis} (m)`,
      `Центр мас ${axis} (м)`,
      -1,
      1,
    ]);
  fields.push([
    'aircraft.geometry.propellerRadius',
    'Propeller radius (m)',
    'Радіус пропелера (м)',
    0.005,
    1,
  ]);
  for (let rotor = 0; rotor < 4; rotor++)
    for (const axis of ['x', 'y', 'z'])
      fields.push([
        `aircraft.geometry.rotors.${rotor}.position.${axis}`,
        `Rotor ${rotor + 1} position ${axis} (m)`,
        `Положення ротора ${rotor + 1} ${axis} (м)`,
        -2,
        2,
      ]);
  for (const [path, en, uk, min, max] of fields) {
    const gain = path.startsWith('controller.gains.');
    const parent = path.startsWith('aircraft.') ? physical : gain ? controllerGrid : filters;
    const row = el('div', undefined, parent);
    row.className = 'workbench-physical-field';
    row.dataset.expert = 'true';
    const input = field(t(en, uk), 'number', row);
    input.dataset.search = `${en} ${uk} ${path}`;
    input.step = 'any';
    input.min = String(min);
    input.max = String(max);
    const control = { path, input, row, min, max, gain, edited: false };
    if (gain)
      for (const [event, exact] of [
        ['focusin', true],
        ['focusout', false],
      ])
        listen(input, event, () => {
          if (!control.edited) input.value = gainText(get(configuration, path), exact);
        });
    function changed() {
      control.edited = true;
      const value = Number(input.value),
        valid =
          input.value.trim() &&
          Number.isFinite(value) &&
          value >= Number(input.min) &&
          value <= Number(input.max);
      input.setAttribute('aria-invalid', valid ? 'false' : 'true');
      row.dataset.customized = String(input.value !== String(get(baseline, path)));
      if (valid) set(configuration, path, value);
      updateCustomizationGroups();
      onChange?.();
    }
    if (gain || path.includes('inertia')) {
      const adjust = el('div', undefined, row);
      adjust.className = 'workbench-fine-adjust';
      for (const direction of [-1, 1])
        translatedAttribute(
          action(
            direction < 0 ? '−' : '+',
            () => {
              const current =
                gain && !control.edited ? get(configuration, path) : Number(input.value);
              if (!Number.isFinite(current) || !input.value.trim()) return;
              const step =
                current === 0 ? 0.000001 : 10 ** (Math.floor(Math.log10(Math.abs(current))) - 2);
              input.value = String(
                Number(
                  Math.min(
                    Number(input.max),
                    Math.max(Number(input.min), current + direction * step),
                  ).toPrecision(10),
                ),
              );
              changed();
            },
            adjust,
          ),
          'aria-label',
          t(
            `${direction < 0 ? 'Decrease' : 'Increase'} ${en}`,
            `${direction < 0 ? 'Зменшити' : 'Збільшити'} ${uk}`,
          ),
        );
    }
    listen(input, 'input', changed);
    listen(input, 'change', changed);
    controls.push(control);
  }
  const airmode = field(
    t(
      'Airmode · retain rotation authority at low throttle',
      'Airmode · керування обертанням за малого газу',
    ),
    'checkbox',
    physical,
  );
  listen(airmode, 'change', () => {
    if (configuration?.aircraft.propulsion)
      configuration.aircraft.propulsion.airmode = airmode.checked;
    updateCustomizationGroups();
    onChange?.();
  });
  function updateCustomizationGroups() {
    airmode.parentNode.dataset.customized = String(
      configuration?.aircraft.format === 'AdvancedAircraft.v2' &&
        airmode.checked !== baseline?.aircraft.propulsion?.airmode,
    );
    for (const parent of [physical, filters])
      parent.dataset.customized = String(
        controls.some(({ row }) => parent.contains(row) && row.dataset.customized === 'true') ||
          (parent === physical && airmode.parentNode.dataset.customized === 'true'),
      );
  }
  const guide = el('details', undefined, controllerParent);
  el(
    'summary',
    t('What P, I, D and feedforward change', 'Що змінюють P, I, D і випередження'),
    guide,
  );
  for (const [en, uk] of [
    [
      'P follows rotation error. More responds faster; too much can oscillate. Less softens response.',
      'P реагує на помилку обертання. Більше пришвидшує реакцію, надлишок може спричинити коливання. Менше пом’якшує реакцію.',
    ],
    [
      'I corrects persistent error. More holds the target against disturbances; too much can recover slowly after saturation.',
      'I виправляє тривалу помилку. Більше краще утримує ціль під збуреннями, надлишок уповільнює відновлення після насичення.',
    ],
    [
      'D damps changes in rotation. More can reduce overshoot but amplifies noise; less reduces damping.',
      'D гасить зміни обертання. Більше може зменшити перерегулювання, але посилює шум; менше зменшує демпфування.',
    ],
    [
      'Feedforward anticipates target changes. More follows sharp commands faster but can increase overshoot and motor demand.',
      'Випередження передбачає зміни цілі. Більше швидше виконує різкі команди, але може збільшити перерегулювання й навантаження моторів.',
    ],
    [
      'Lower filter cutoffs smooth noise with more delay. Zero disables a filter. Anti-windup helps recovery when available torque is exhausted.',
      'Нижча частота фільтра згладжує шум із більшою затримкою. Нуль вимикає фільтр. Захист інтегратора допомагає відновленню після вичерпання моменту.',
    ],
  ])
    el('p', t(en, uk), guide);
  return {
    load(value, saved = value, raw = {}) {
      configuration = clone(value);
      baseline = clone(saved);
      const isPhysical = value?.aircraft.format === 'AdvancedAircraft.v2';
      note.textContent = value
        ? t(
            'SIM gains in SI units. Betaflight PID values are unsupported. Customized Expert values remain visible in Basic.',
            'Коефіцієнти SIM в одиницях SI. PID Betaflight не підтримуються. Змінені експертні значення видимі в базовому режимі.',
          )
        : t(
            'This legacy aircraft has no independent PID controller. Select a physical aircraft to edit its controller.',
            'Класичний дрон не має незалежного PID-контролера. Виберіть фізичний дрон для його редагування.',
          );
      for (const control of controls) {
        const { path, input, row, min, max, gain } = control;
        control.edited = raw[path] != null;
        const v = get(value, path),
          legacyOnly =
            isPhysical &&
            [
              'aircraft.armLength',
              'aircraft.radius',
              'aircraft.linearDrag',
              'aircraft.quadraticDrag',
              'aircraft.angularDrag',
            ].includes(path);
        row.hidden = v === undefined || legacyOnly;
        input.disabled = row.hidden;
        row.dataset.unavailable = String(row.hidden);
        input.value =
          raw[path] ??
          (gain
            ? gainText(v, input.ownerDocument.activeElement === input)
            : v === undefined
              ? ''
              : String(v));
        input.max = String(
          isPhysical &&
            (path.startsWith('controller.gains.') || path === 'controller.integralLimit')
            ? 1000
            : max,
        );
        input.min = String(isPhysical && path.startsWith('aircraft.inertia.') ? 0.0000001 : min);
        row.dataset.customized = String(v !== get(saved, path));
      }
      physical.dataset.unavailable = filters.dataset.unavailable = String(!value);
      airmode.disabled = !isPhysical;
      airmode.checked = value?.aircraft.propulsion?.airmode ?? false;
      updateCustomizationGroups();
    },
    read(commit = true) {
      for (const { input } of controls)
        if (
          !input.disabled &&
          (!input.value.trim() ||
            !Number.isFinite(Number(input.value)) ||
            Number(input.value) < Number(input.min) ||
            Number(input.value) > Number(input.max))
        ) {
          if (commit) {
            input.setAttribute('aria-invalid', 'true');
            throw new Error(
              `${input.getAttribute('aria-label')}: ${t('enter a valid number', 'введіть коректне число')}`,
            );
          }
          return null;
        }
      for (const { path, input, gain, edited } of controls)
        if (!input.disabled && (!gain || edited)) set(configuration, path, Number(input.value));
      return clone(configuration);
    },
    raw: () =>
      Object.fromEntries(
        controls
          .filter(({ input, gain, edited }) => !input.disabled && (!gain || edited))
          .map(({ path, input }) => [path, input.value]),
      ),
    fields: controls,
  };
}

/** Convert client coordinates through the SVG's centered, aspect-preserving
 * viewBox. The plot remains usable at narrow sizes and browser zoom. */
export function workbenchCurvePosition(svg, clientX) {
  const box = svg.getBoundingClientRect();
  if (
    !Number.isFinite(clientX) ||
    !Number.isFinite(box.width) ||
    !Number.isFinite(box.height) ||
    box.width <= 0 ||
    box.height <= 0
  )
    return null;
  const scale = Math.min(box.width / 600, box.height / 245);
  const x = (clientX - box.left - (box.width - 600 * scale) / 2) / scale;
  return Math.min(1, Math.max(0, (x - 52) / 512));
}

export function drawWorkbenchCurve(
  doc,
  svg,
  { series, maximum = 1, yLabel = '°/s', xLabel = 'Stick %' },
) {
  svg.replaceChildren();
  svg.setAttribute('viewBox', '0 0 600 245');
  const part = (tag, attrs, text) => {
    const n = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    if (text !== undefined) n.textContent = text;
    svg.append(n);
    return n;
  };
  for (let tick = 0; tick <= 4; tick++) {
    const x = 52 + tick * 128,
      y = 200 - tick * 42;
    part('line', { x1: x, x2: x, y1: 32, y2: 200, stroke: '#304b5d' });
    part('line', { x1: 52, x2: 564, y1: y, y2: y, stroke: '#304b5d' });
    part(
      'text',
      { x, y: 220, fill: '#c4d5e5', 'text-anchor': 'middle', 'font-size': 13 },
      String(tick * 25),
    );
    part(
      'text',
      { x: 45, y: y + 4, fill: '#c4d5e5', 'text-anchor': 'end', 'font-size': 13 },
      String(Math.round((maximum * tick) / 4)),
    );
  }
  part('text', { x: 52, y: 18, fill: '#edf5ff', 'font-size': 14 }, yLabel);
  part('text', { x: 564, y: 240, fill: '#edf5ff', 'text-anchor': 'end', 'font-size': 14 }, xLabel);
  for (const { evaluate, color, dashed, label } of series) {
    const path = part('path', {
      d: Array.from(
        { length: 101 },
        (_, i) => `${i ? 'L' : 'M'}${52 + i * 5.12},${200 - (evaluate(i / 100) / maximum) * 168}`,
      ).join(' '),
      fill: 'none',
      stroke: color,
      'stroke-width': dashed ? 1.5 : 2.5,
      ...(dashed ? { 'stroke-dasharray': '6 5' } : {}),
    });
    const title = doc.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = label;
    path.append(title);
  }
  let cursor = null;
  return {
    inspect(position) {
      cursor?.remove();
      cursor = null;
      if (!Number.isFinite(position) || position < 0 || position > 1) return;
      cursor = part('g', {
        'data-curve-inspection': '',
        'aria-hidden': 'true',
        'pointer-events': 'none',
      });
      const mark = (tag, attributes, text) => {
        const node = part(tag, attributes, text);
        cursor.append(node);
        return node;
      };
      const x = 52 + position * 512;
      mark('line', {
        x1: x,
        x2: x,
        y1: 32,
        y2: 200,
        stroke: '#edf5ff',
        'stroke-width': 1.5,
        'stroke-dasharray': '3 3',
      });
      mark(
        'text',
        { x, y: 28, fill: '#edf5ff', 'text-anchor': 'middle', 'font-size': 13 },
        `${Math.round(position * 100)}%`,
      );
      for (const { evaluate, color, dashed, label } of series) {
        const value = evaluate(position);
        const point = mark('circle', {
          cx: x,
          cy: 200 - (value / maximum) * 168,
          r: dashed ? 5 : 3,
          fill: dashed ? '#07141e' : color,
          stroke: color,
          'stroke-width': 2,
        });
        const title = doc.createElementNS('http://www.w3.org/2000/svg', 'title');
        title.textContent = `${label}: ${value.toFixed(1)} ${yLabel}`;
        point.append(title);
      }
    },
  };
}
export function paintCameraFraming(doc, svg, tilt, fov, t) {
  svg.replaceChildren();
  svg.setAttribute('viewBox', '0 0 560 315');
  const part = (tag, attrs, text) => {
    const n = doc.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
    if (text) n.textContent = text;
    svg.append(n);
    return n;
  };
  const focal = 157.5 / Math.tan((fov * Math.PI) / 360),
    horizon = 157.5 + focal * Math.tan((tilt * Math.PI) / 180);
  part('rect', { width: 560, height: 315, fill: '#132d3e' });
  part('rect', {
    x: 0,
    y: Math.min(315, horizon),
    width: 560,
    height: Math.max(0, 315 - horizon),
    fill: '#32564f',
  });
  for (const angle of [-30, -15, 0, 15, 30]) {
    const y = 157.5 + focal * Math.tan(((tilt - angle) * Math.PI) / 180);
    if (y > 0 && y < 315) {
      part('line', {
        x1: angle ? 180 : 0,
        x2: angle ? 380 : 560,
        y1: y,
        y2: y,
        stroke: angle ? '#7695ae' : '#f1ca72',
        'stroke-dasharray': angle ? '4 5' : 'none',
      });
      part('text', { x: 390, y: y - 4, fill: '#edf5ff', 'font-size': 13 }, `${angle}°`);
    }
  }
  part('path', { d: 'M265 157.5 H295 M280 143 V172', stroke: '#edf5ff', 'stroke-width': 2 });
  part(
    'text',
    { x: 14, y: 26, fill: '#edf5ff', 'font-size': 15 },
    `${t('Vertical FOV', 'Вертикальне поле зору')} ${fov}° · ${t('Tilt', 'Нахил')} ${tilt}°`,
  );
  part(
    'text',
    { x: 14, y: 294, fill: '#edf5ff', 'font-size': 13 },
    `16:9 · ${t('Horizontal', 'Горизонтальне')} ${((2 * Math.atan((Math.tan((fov * Math.PI) / 360) * 16) / 9) * 180) / Math.PI).toFixed(1)}°`,
  );
}
