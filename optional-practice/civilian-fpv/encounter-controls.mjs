/** Player choices are separate from aircraft controls and historical course preferences. */
export const ENCOUNTER_PREFERENCES_KEY = 'revealline.fpv.encounters.v1';
export const ENCOUNTER_ACTIVITIES = Object.freeze([
  'original',
  'continuous',
  'hunting',
  'elimination',
  'strike',
  'survival',
]);
const difficulties = ['easy', 'normal', 'hard'];
const populations = [6, 12, 20];
const survivalPopulations = [64, 96, 128];
const weapons = ['autocannon', 'scatter', 'precision', 'rocket'];
const choices = {
  survivalMode: ['timed', 'endless'],
  payload: ['bomb', 'remote', 'drone'],
  ammoPreset: ['balanced', 'arcade', 'tactical'],
  playerDamage: ['normal', 'invulnerable'],
  enemyDamage: ['normal', 'one-hit'],
};
const copy = (value) => structuredClone(value);
const defaults = () => ({
  learning: 'original',
  other: 'continuous',
  difficulty: 'normal',
  population: 12,
  survivalPopulation: 96,
  survivalMode: 'timed',
  loadout: ['autocannon', 'scatter'],
  payload: 'bomb',
  ammoPreset: 'balanced',
  playerDamage: 'normal',
  enemyDamage: 'normal',
});
function applyChoices(value, patch) {
  for (const [key, values] of Object.entries(choices))
    if (values.includes(patch[key])) value[key] = patch[key];
  if (
    Array.isArray(patch.loadout) &&
    patch.loadout.length === 2 &&
    patch.loadout.every((item) => weapons.includes(item)) &&
    patch.loadout[0] !== patch.loadout[1]
  )
    value.loadout = [...patch.loadout];
  if (difficulties.includes(patch.difficulty)) value.difficulty = patch.difficulty;
  if (populations.includes(patch.population)) value.population = patch.population;
  if (survivalPopulations.includes(patch.population)) value.survivalPopulation = patch.population;
  if (survivalPopulations.includes(patch.survivalPopulation))
    value.survivalPopulation = patch.survivalPopulation;
  return value;
}
export function createEncounterPreferences(storage) {
  let value = defaults();
  try {
    const saved = JSON.parse(storage?.getItem(ENCOUNTER_PREFERENCES_KEY) ?? 'null');
    if (['FPVEncounterPreferences.v1', 'FPVEncounterPreferences.v2'].includes(saved?.format)) {
      for (const key of ['learning', 'other'])
        if (ENCOUNTER_ACTIVITIES.includes(saved[key])) value[key] = saved[key];
      value = applyChoices(value, saved);
    }
  } catch {
    /* A damaged optional preference does not prevent flying. */
  }
  return {
    snapshot: () => copy(value),
    select({ learning = false, original = false, override = null } = {}) {
      // Historical recovery definitions retain their original rules and shape.
      if (override?.format === 'FPVEncounterDefinition.v1') return copy(override);
      const chosen = applyChoices(copy(value), override ?? {});
      const activity = original
        ? 'original'
        : ENCOUNTER_ACTIVITIES.includes(override?.activity)
          ? override.activity
          : value[learning ? 'learning' : 'other'];
      return {
        version: 2,
        activity,
        difficulty: chosen.difficulty,
        population: activity === 'survival' ? chosen.survivalPopulation : chosen.population,
        survivalMode: chosen.survivalMode,
        loadout: chosen.loadout,
        payload: chosen.payload,
        ammoPreset: chosen.ammoPreset,
        playerDamage: chosen.playerDamage,
        enemyDamage: chosen.enemyDamage,
        seed:
          Number.isSafeInteger(override?.seed) && override.seed >= 1 && override.seed <= 0xffffffff
            ? override.seed
            : 1,
      };
    },
    update(patch, learning = false) {
      if (ENCOUNTER_ACTIVITIES.includes(patch.activity))
        value[learning ? 'learning' : 'other'] = patch.activity;
      applyChoices(value, patch);
      try {
        storage?.setItem(
          ENCOUNTER_PREFERENCES_KEY,
          JSON.stringify({ format: 'FPVEncounterPreferences.v2', ...value }),
        );
      } catch {
        /* Keep the user's choice for this session when storage is unavailable. */
      }
      return copy(value);
    },
  };
}

const labels = {
  original: ['Original course', 'Початковий маршрут'],
  continuous: ['Continuous combat', 'Безперервний бій'],
  hunting: ['Target hunting · 3 minutes', 'Полювання на цілі · 3 хвилини'],
  elimination: ['Elimination', 'Знищення цілей'],
  strike: ['Strike', 'Удар'],
  survival: ['Survival', 'Виживання'],
  timed: ['Six minutes', 'Шість хвилин'],
  endless: ['Endless', 'Нескінченно'],
  autocannon: ['Autocannon', 'Автогармата'],
  scatter: ['Scatter', 'Картеч'],
  precision: ['Precision', 'Точна зброя'],
  rocket: ['Rockets', 'Ракети'],
  bomb: ['Drop bomb', 'Скидання бомби'],
  remote: ['Remote charge', 'Дистанційний заряд'],
  drone: ['Drone charge', 'Заряд дрона'],
  balanced: ['Balanced', 'Збалансовано'],
  arcade: ['Arcade', 'Аркада'],
  tactical: ['Tactical', 'Тактичний'],
  invulnerable: ['Invulnerable · assisted', 'Невразливість · допомога'],
  'one-hit': ['One hit · assisted', 'Одне влучання · допомога'],
  64: ['Up to 64', 'До 64'],
  96: ['Up to 96', 'До 96'],
  128: ['Up to 128', 'До 128'],
  easy: ['Easy', 'Легко'],
  normal: ['Normal', 'Звичайно'],
  hard: ['Hard', 'Складно'],
  6: ['Sparse · up to 6', 'Небагато · до 6'],
  12: ['Standard · up to 12', 'Звичайно · до 12'],
  20: ['Dense · up to 20', 'Багато · до 20'],
};
export function encounterActivityLabel(activity, locale = 'en') {
  return (labels[activity] ?? labels.original)[locale === 'uk' ? 1 : 0];
}

export function mountEncounterControls({
  document: doc,
  container,
  locale = () => 'en',
  onChange,
  onNextWave,
  onReturn,
  onRestart,
  onSave,
  onLoad,
  onNewRun,
  onRetry,
}) {
  const root = doc.createElement('section');
  root.className = 'fpv-encounter-controls flight-control-group';
  root.dataset.encounterControls = '';
  const title = doc.createElement('h3');
  root.append(title);
  const fields = {};
  for (const [key, values] of [
    ['activity', ENCOUNTER_ACTIVITIES],
    ['difficulty', difficulties],
    ['population', [...populations, ...survivalPopulations]],
    ...Object.entries(choices),
    ['weaponA', weapons],
    ['weaponB', weapons],
  ]) {
    const label = doc.createElement('label'),
      caption = doc.createElement('span'),
      select = doc.createElement('select');
    select.dataset.encounterChoice = key;
    for (const value of values) {
      const option = doc.createElement('option');
      option.value = String(value);
      select.append(option);
    }
    select.addEventListener('change', () => {
      const selected = Object.fromEntries(
        Object.entries(fields).map(([name, field]) => [name, field.select.value]),
      );
      const loadout = [selected.weaponA, selected.weaponB];
      if (loadout[0] === loadout[1]) {
        loadout[key === 'weaponA' ? 1 : 0] = weapons.find((id) => id !== select.value);
      }
      delete selected.weaponA;
      delete selected.weaponB;
      const allowed = selected.activity === 'survival' ? survivalPopulations : populations;
      onChange?.({
        ...selection,
        ...selected,
        version: 2,
        loadout,
        population: allowed.includes(Number(selected.population))
          ? Number(selected.population)
          : allowed[1],
      });
    });
    label.append(caption, select);
    root.append(label);
    fields[key] = { label, caption, select };
  }
  const help = doc.createElement('p'),
    status = doc.createElement('p'),
    actions = doc.createElement('div');
  status.setAttribute('role', 'status');
  actions.className = 'flight-actions';
  const buttons = {};
  for (const [key, handler] of Object.entries({
    next: onNextWave,
    retry: onRetry,
    newRun: onNewRun,
    return: onReturn,
    restart: onRestart,
    save: onSave,
    load: onLoad,
  })) {
    const button = doc.createElement('button');
    button.type = 'button';
    button.addEventListener('click', () => handler?.());
    buttons[key] = button;
    actions.append(button);
  }
  root.append(help, status, actions);
  container.append(root);
  let selection = { ...defaults(), activity: 'original', version: 2 },
    encounter = null,
    unavailable = '',
    busy = false;
  const txt = (en, uk) => (locale() === 'uk' ? uk : en);
  function refresh() {
    title.textContent = txt('Flight activity', 'Режим гри');
    for (const [key, field] of Object.entries(fields)) {
      field.caption.textContent = {
        activity: txt('Activity', 'Заняття'),
        difficulty: txt('Difficulty', 'Складність'),
        population: txt('Moving targets', 'Рухомі цілі'),
        survivalMode: txt('Survival length', 'Тривалість виживання'),
        weaponA: txt('Primary weapon', 'Основна зброя'),
        weaponB: txt('Secondary weapon', 'Друга зброя'),
        payload: txt('Payload', 'Заряд'),
        ammoPreset: txt('Ammunition', 'Боєприпаси'),
        playerDamage: txt('Player damage', 'Пошкодження гравця'),
        enemyDamage: txt('Enemy damage', 'Пошкодження ворогів'),
      }[key];
      for (const option of field.select.options) {
        option.textContent = labels[option.value]?.[locale() === 'uk' ? 1 : 0] ?? option.value;
        if (key === 'population') {
          const allowed = selection.activity === 'survival' ? survivalPopulations : populations;
          option.hidden = option.disabled = !allowed.includes(Number(option.value));
        }
      }
      field.select.value = String(
        key === 'weaponA'
          ? selection.loadout[0]
          : key === 'weaponB'
            ? selection.loadout[1]
            : selection[key],
      );
      field.select.disabled = busy;
      field.label.hidden =
        (key !== 'activity' && selection.activity === 'original') ||
        (key === 'survivalMode' && selection.activity !== 'survival');
    }
    help.textContent =
      selection.activity === 'original'
        ? txt(
            'Fly the original objectives. Combat has its own results.',
            'Виконуйте початкові завдання. Бойові режими мають окремі результати.',
          )
        : txt(
            'Fire shoots the active primary or secondary gun. The payload is separate: Deploy drops the bomb or charge; Detonate triggers an armed charge. Switch weapon changes guns only. Changing these choices restarts the attempt.',
            'Вогонь стріляє з активної основної або другої зброї. Заряд окремий: застосування скидає бомбу чи заряд; підрив запускає зведений заряд. Перемикання зброї змінює лише гармати. Зміна параметрів починає нову спробу.',
          );
    if (selection.activity !== 'original' && selection.ammoPreset === 'arcade')
      help.textContent += txt(
        ' Arcade: ramming enemies does not damage your hull. Enemy fire still does.',
        ' Аркада: зіткнення з ворогами не пошкоджують ваш корпус. Ворожий вогонь залишається небезпечним.',
      );
    status.textContent =
      unavailable ||
      (encounter
        ? `${txt('Targets', 'Цілі')}: ${encounter.admittedCount ?? encounter.actors?.length ?? 0} / ${encounter.population ?? selection.population}${encounter.population > selection.population ? ` · ${txt('Authored roster minimum', 'Мінімум заданого складу')}` : ''}${encounter.recording ? ` · ${txt('Retained recording', 'Збережений запис')}: ${(encounter.recording.retainedFrom / 50).toFixed(0)}–${(encounter.recording.retainedTo / 50).toFixed(0)} s` : ''}`
        : '');
    const outside = Boolean(encounter?.outsideArea || encounter?.phase === 'outside');
    buttons.retry.textContent = txt('Retry same run', 'Повторити цю спробу');
    buttons.newRun.textContent = txt('New run', 'Нова спроба');
    buttons.retry.hidden = buttons.newRun.hidden = !encounter;
    buttons.next.textContent = txt('Start next wave', 'Почати наступну хвилю');
    buttons.return.textContent = txt('Guide to encounter', 'Напрямок до бою');
    buttons.restart.textContent = txt('Restart encounter here', 'Почати бій тут');
    buttons.save.textContent = txt('Save combat session', 'Зберегти бойову сесію');
    buttons.load.textContent = txt('Load combat session', 'Відкрити бойову сесію');
    buttons.next.hidden =
      !encounter || !['preparation', 'intermission', 'break'].includes(encounter.phase);
    buttons.return.hidden = buttons.restart.hidden = !outside;
    buttons.save.hidden = !encounter;
    buttons.load.hidden = selection.activity === 'original';
    for (const button of Object.values(buttons)) button.disabled = busy;
  }
  refresh();
  return {
    root,
    fields,
    buttons,
    update(next) {
      selection = { ...selection, ...next.selection };
      encounter = next.encounter ?? null;
      unavailable = next.unavailable ?? '';
      busy = Boolean(next.busy);
      refresh();
    },
    refresh,
    dispose() {
      root.remove();
    },
  };
}

/** Read-only vitals from accepted combat state. */
export function mountCombatVitals({ document: doc, parent, weaponRules }) {
  if (!weaponRules) throw new TypeError('Missing combat weapon rules.');
  const make = (tag, part, owner) => {
      const node = doc.createElement(tag);
      node.className = `combat-vitals${part ? `__${part}` : ''}`;
      owner?.append(node);
      return node;
    },
    root = make('section', '', parent),
    text = (node, value) => {
      if (node.textContent !== value) node.textContent = value;
    },
    attribute = (node, key, value) => {
      const next = String(value);
      if (node.getAttribute(key) !== next) node.setAttribute(key, next);
    },
    hidden = (node, value) => {
      if (node.hidden !== value) node.hidden = value;
    },
    icon = (owner, kind) => {
      if (!doc.createElementNS) {
        const fallback = make('span', 'icon', owner);
        fallback.textContent = kind === 'health' ? '+' : '|||';
        fallback.setAttribute('aria-hidden', 'true');
        return;
      }
      const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg'),
        path = doc.createElementNS('http://www.w3.org/2000/svg', 'path');
      svg.setAttribute('class', 'combat-vitals__icon');
      svg.setAttribute('viewBox', '0 0 24 24');
      svg.setAttribute('width', '20');
      svg.setAttribute('height', '20');
      svg.setAttribute('aria-hidden', 'true');
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'currentColor');
      path.setAttribute('stroke-width', '1.7');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute(
        'd',
        kind === 'health'
          ? 'M12 2 4 5v7c0 5 8 10 8 10s8-5 8-10V5ZM12 7v9M8 11.5h8'
          : 'M3 8 5 4l2 4v12H3ZM10 6l2-4 2 4v14h-4ZM17 8l2-4 2 4v12h-4ZM3 16h4M10 16h4M17 16h4',
      );
      svg.append(path);
      owner.append(svg);
    },
    card = (kind) => {
      const node = make('div', 'card', root),
        heading = make('div', 'heading', node);
      node.dataset.vital = kind;
      icon(heading, kind);
      const label = make('span', 'label', heading),
        numbers = make('div', 'numbers', node),
        value = make('strong', 'value', numbers),
        max = make('span', 'max', numbers),
        meter = make('div', 'meter', node),
        fill = make('span', 'fill', meter),
        status = make('div', 'status', node);
      meter.setAttribute('role', 'meter');
      meter.setAttribute('aria-valuemin', '0');
      fill.setAttribute('aria-hidden', 'true');
      return { node, label, value, max, meter, fill, status, fillRatio: null };
    },
    hull = card('health'),
    ammo = card('ammo'),
    footer = make('div', 'footer', ammo.node),
    reserve = make('span', 'reserve', footer),
    payload = make('span', 'payload', footer),
    warning = make('div', 'warning', root);
  root.dataset.combatVitals = '';
  root.hidden = true;
  warning.setAttribute('role', 'status');
  warning.setAttribute('aria-live', 'polite');
  warning.setAttribute('aria-atomic', 'true');
  warning.hidden = true;
  let disposed = false;
  const fillMeter = (view, value, max, label, description) => {
      const fraction = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
      if (view.fillRatio !== fraction) {
        view.fillRatio = fraction;
        view.fill.style.transform = `scaleX(${fraction})`;
      }
      attribute(view.meter, 'aria-label', label);
      attribute(view.meter, 'aria-valuemax', max);
      attribute(view.meter, 'aria-valuenow', value);
      attribute(view.meter, 'aria-valuetext', description);
    },
    finite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback),
    seconds = (ticks) => (Math.ceil(Math.max(0, ticks) / 5) / 10).toFixed(1);
  function update({
    state,
    definition = {},
    preferences = {},
    locale = 'en',
    visible = true,
  } = {}) {
    if (disposed) return;
    const c = state?.encounter,
      t = (en, uk) => (locale === 'uk' ? uk : en),
      shown = Boolean(visible && preferences.vitals !== false && c);
    if (!shown) {
      hidden(root, true);
      hidden(warning, true);
      text(warning, '');
      return;
    }
    attribute(root, 'aria-label', t('Vitals', 'Стан'));
    const maxHealth = Math.max(1, finite(c.maxHealth, 100)),
      health = Math.max(0, Math.min(maxHealth, finite(c.health))),
      ratio = health / maxHealth,
      showHealth =
        preferences.playerHealth !== 'off' &&
        (preferences.playerHealth !== 'damaged' || health < maxHealth),
      hullTone =
        health <= 0
          ? 'destroyed'
          : definition.playerDamage === 'invulnerable'
            ? 'invulnerable'
            : ratio <= 0.15
              ? 'critical'
              : ratio <= 0.35
                ? 'low'
                : health < maxHealth
                  ? 'damaged'
                  : 'healthy',
      hullStatus = {
        healthy: t('Healthy', 'Цілий'),
        damaged: t('Damaged', 'Пошкоджено'),
        low: t('LOW HULL', 'МАЛО МІЦНОСТІ'),
        critical: t('CRITICAL', 'КРИТИЧНО'),
        destroyed: t('Destroyed', 'Знищено'),
        invulnerable: t('Invulnerable', 'Невразливість'),
      }[hullTone];
    hidden(hull.node, !showHealth);
    attribute(root, 'data-health-hidden', !showHealth);
    attribute(hull.node, 'data-tone', hullTone);
    text(hull.label, t('Health', 'Здоров’я'));
    text(hull.value, String(Math.ceil(health)));
    text(hull.max, `/ ${maxHealth}`);
    text(hull.status, hullStatus);
    fillMeter(
      hull,
      health,
      maxHealth,
      t('Health', 'Здоров’я'),
      `${Math.ceil(health)} / ${maxHealth} · ${hullStatus}`,
    );
    const weapon = c.weapons?.[c.weaponIndex ?? 0],
      rule = weaponRules[weapon?.id],
      showAmmo = Boolean(weapon && rule),
      waiting = Boolean(c.outsideArea || c.geometryWaiting),
      magazine = Math.max(1, finite(rule?.magazine, 1)),
      rounds = Math.max(0, Math.min(magazine, finite(weapon?.ammo))),
      released = Math.max(0, finite(c.fireReleasedTicks)),
      arcade = definition.ammoPreset === 'arcade',
      refillTicks = weapon?.id === 'rocket' ? 250 : 150,
      reloadTicks = Math.max(0, finite(weapon?.reloadTicks)),
      rechargeTicks =
        arcade && rounds < magazine && released > 0
          ? Math.max(0, refillTicks - released)
          : Infinity,
      recharging = (released >= 50 || reloadTicks > 0) && rechargeTicks < (reloadTicks || Infinity),
      ammoTone =
        health <= 0
          ? 'destroyed'
          : waiting
            ? 'waiting'
            : recharging
              ? 'recharging'
              : reloadTicks > 0
                ? 'reloading'
                : rounds === 0
                  ? 'empty'
                  : rounds / magazine <= 0.25
                    ? 'low'
                    : 'ready',
      weaponName =
        (labels[weapon?.id] ?? [t('Weapon', 'Зброя')])[locale === 'uk' ? 1 : 0] ??
        t('Weapon', 'Зброя'),
      pauseSuffix =
        state.status !== 'active'
          ? ` · ${t('Paused', 'Пауза')}`
          : waiting
            ? ` · ${t('Waiting', 'Очікування')}`
            : '';
    hidden(ammo.node, !showAmmo);
    attribute(root, 'data-ammo-hidden', !showAmmo);
    hidden(root, !showHealth && !showAmmo);
    if (root.hidden) {
      hidden(warning, true);
      text(warning, '');
      return;
    }
    attribute(ammo.node, 'data-tone', ammoTone);
    text(ammo.label, `${t('Gun', 'Зброя')} · ${weaponName}`);
    text(ammo.value, String(rounds));
    text(ammo.max, `/ ${magazine}`);
    let ammoStatus = {
      destroyed:
        c.phase === 'aftermath'
          ? t('Ordnance resolving', 'Очікування влучання')
          : t('Weapons offline', 'Зброю вимкнено'),
      reloading: `${t('RELOADING', 'ПЕРЕЗАРЯДЖЕННЯ')} ${seconds(reloadTicks)} s${pauseSuffix}`,
      recharging: `${t('RECHARGING', 'ПОПОВНЕННЯ')} ${seconds(rechargeTicks)} s${pauseSuffix}`,
      empty: t('EMPTY', 'ПОРОЖНЬО'),
      low: t('LOW AMMO', 'МАЛО НАБОЇВ'),
      ready: t('Ready', 'Готово'),
    }[ammoTone];
    if (waiting && health > 0)
      ammoStatus = c.outsideArea
        ? t('Return to resume combat', 'Поверніться, щоб продовжити бій')
        : t('Loading combat terrain', 'Завантаження місцевості для бою');
    else if (health > 0 && arcade && rounds < magazine && released < 50 && !reloadTicks)
      ammoStatus += ` · ${t('Release Fire to recharge', 'Відпустіть вогонь: поповнення')}`;
    const supplyHelp =
      c.servicePad || definition.ammoPreset === 'tactical'
        ? t('Find a service pad', 'Знайдіть майданчик поповнення')
        : t('Collect supplies', 'Зберіть припаси');
    if (health > 0 && !waiting && !arcade && rounds === 0 && !reloadTicks && weapon?.reserve === 0)
      ammoStatus += ` · ${supplyHelp}`;
    text(ammo.status, ammoStatus);
    const progressTotal =
        ammoTone === 'recharging'
          ? refillTicks
          : ammoTone === 'reloading'
            ? Math.max(1, finite(weapon?.reloadTotal, rule?.reload ?? 1))
            : 0,
      progressRemaining = ammoTone === 'recharging' ? rechargeTicks : reloadTicks;
    fillMeter(
      ammo,
      progressTotal ? Math.max(0, progressTotal - progressRemaining) : rounds,
      progressTotal || magazine,
      progressTotal
        ? ammoTone === 'recharging'
          ? t('Recharge progress', 'Перебіг поповнення')
          : t('Reload progress', 'Перебіг перезарядження')
        : `${weaponName} · ${t('Magazine', 'Магазин')}`,
      `${rounds} / ${magazine} · ${ammoStatus}`,
    );
    const reserveCount =
      weapon?.id !== 'rocket' && weapon?.reserve < 0
        ? '∞'
        : String(Math.max(0, finite(weapon?.reserve)));
    text(reserve, `${t('Reserve', 'Запас')} ${reserveCount}`);
    const payloadName =
        {
          bomb: t('Bomb', 'Бомба'),
          remote: t('Remote charge', 'Дистанційний заряд'),
          drone: t('Drone charge', 'Заряд дрона'),
        }[definition.payload] ?? t('Payload', 'Заряд'),
      capacity =
        definition.ammoPreset === 'tactical'
          ? 1
          : ({ bomb: 3, remote: 2, drone: 1 }[definition.payload] ?? 0),
      payloadCount = Math.max(0, finite(c.payloadAmmo)),
      deployed = c.ordnance?.filter((item) => item.kind === definition.payload) ?? [],
      payloadState = c.payloadArmed
        ? t('ARMED', 'ОЗБРОЄНО')
        : deployed.some((item) => item.kind === 'remote' && item.settled)
          ? t('Ready to detonate', 'Готовий до підриву')
          : deployed.length
            ? t('In flight', 'У польоті')
            : payloadCount === 0 && !arcade
              ? t('Empty', 'Порожньо')
              : '';
    let payloadText = `${t('Payload', 'Заряд')} · ${payloadName} ×${payloadCount}${payloadState ? ` · ${payloadState}` : ''}`;
    if (health > 0 && !arcade && !payloadCount && !c.payloadArmed && !deployed.length)
      payloadText += ` · ${supplyHelp}`;
    if (health > 0 && arcade && payloadCount < capacity)
      payloadText +=
        released < 50
          ? ` · ${t('Release Fire to refill', 'Відпустіть вогонь: поповнення')}`
          : ` · ${t('Refill', 'Поповнення')} ${seconds(550 - released)} s${pauseSuffix}`;
    text(payload, payloadText);
    attribute(
      payload,
      'data-state',
      c.payloadArmed ? 'armed' : deployed.length ? 'deployed' : 'ready',
    );
    const hullWarning = showHealth && ['critical', 'destroyed'].includes(hullTone),
      emptyWarning = showAmmo && ammoTone === 'empty',
      lowHull = showHealth && hullTone === 'low',
      warningText = hullWarning
        ? hullStatus
        : emptyWarning
          ? arcade
            ? t('EMPTY · Release Fire', 'ПОРОЖНЬО · Відпустіть вогонь')
            : weapon.reserve === 0
              ? `${t('EMPTY', 'ПОРОЖНЬО')} · ${supplyHelp}`
              : t('EMPTY · Reload', 'ПОРОЖНЬО · Перезарядіть')
          : lowHull
            ? hullStatus
            : '';
    hidden(warning, !warningText || state.status !== 'active' || waiting);
    attribute(warning, 'data-tone', hullWarning ? hullTone : emptyWarning ? 'empty' : 'low');
    text(warning, warning.hidden ? '' : warningText);
  }
  return {
    root,
    update,
    dispose() {
      disposed = true;
      root.remove();
    },
  };
}
