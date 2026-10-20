import {
  STICK_LAYOUTS,
  normalizeRadioInput,
  radioDeviceKey,
  radioSwitch,
} from './radio-profile.mjs';

/** Player-facing calibration workflow; the existing profile editor owns validation/storage. */
export function mountRadioGuide({
  container,
  window: win,
  runtime,
  locale,
  select,
  refreshButton,
  layoutLabel,
  throttleLabel,
  mode,
  throttle,
  status,
  sticks,
  rows,
  switchRows,
  readProfile,
  loadProfile,
  invalidate,
  autoSaveProfile,
  previewControl = () => null,
  stopCaptures,
  externalCaptureActive = () => false,
  skipLegacySwitches = () => false,
  onDone,
  groups,
}) {
  const doc = container.ownerDocument,
    uk = locale === 'uk';
  const t = (en, ua) => (uk ? ua : en);
  const names = {
    throttle: t('Throttle', 'Газ'),
    yaw: t('Yaw', 'Рискання'),
    pitch: t('Pitch', 'Тангаж'),
    roll: t('Roll', 'Крен'),
  };
  const order = ['throttle', 'yaw', 'pitch', 'roll'];
  // Match profile validation: USB radios need not expose the full -1…1 range.
  const minimumSpan = 0.5;
  const minimumMovement = minimumSpan / 2;
  const listeners = [];
  const el = (tag, text, parent, cls) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    parent?.append(node);
    return node;
  };
  const on = (node, type, fn) => {
    node.addEventListener(type, fn);
    listeners.push(() => node.removeEventListener(type, fn));
  };
  const button = (text, parent, fn, cls) => {
    const node = el('button', text, parent, cls);
    node.type = 'button';
    on(node, 'click', fn);
    return node;
  };
  const setText = (node, value) => {
    if (node.textContent !== value) node.textContent = value;
  };
  container.classList.add('radio-setup');
  const shell = el('div', undefined, null, 'radio-guide');
  const head = el('div', undefined, shell, 'radio-guide-heading');
  el('p', t('YOUR CONTROLS', 'ВАШЕ КЕРУВАННЯ'), head, 'radio-eyebrow');
  el('h2', t('Make the sticks match.', 'Налаштуйте стіки під себе.'), head);
  el(
    'p',
    t(
      'A quick check for familiar radios. Guided setup for a new one.',
      'Швидка перевірка знайомого пульта. Покрокове налаштування нового.',
    ),
    head,
  );
  const device = el('section', undefined, shell, 'radio-device-card');
  const connection = el('p', undefined, device, 'radio-connection');
  connection.setAttribute('role', 'status');
  const deviceRow = el('div', undefined, device, 'radio-device-row');
  deviceRow.append(select.parentNode, refreshButton);
  select.parentNode.firstChild.textContent = t('Your radio', 'Ваш пульт');
  select.setAttribute('aria-label', t('Your radio', 'Ваш пульт'));
  const help = el(
    'p',
    t(
      'Connect by USB → select Joystick on your radio → move a stick. Then choose your radio above.',
      'Під’єднайте USB → виберіть «Джойстик» на пульті → рухніть стік. Потім виберіть пульт вище.',
    ),
    device,
    'radio-connect-help',
  );
  const steps = el('ol', undefined, shell, 'radio-steps');
  const stepNodes = [
    t('Connect', 'Під’єднайте'),
    t('Calibrate', 'Відкалібруйте'),
    t('Ready', 'Готово'),
  ].map((name, i) => {
    const node = el('li', undefined, steps);
    el('span', String(i + 1).padStart(2, '0'), node);
    el('b', name, node);
    return node;
  });
  const workspace = el('div', undefined, shell, 'radio-workspace');
  const task = el('section', undefined, workspace, 'radio-task');
  const progress = el('p', undefined, task, 'radio-eyebrow');
  const title = el('h3', undefined, task);
  title.tabIndex = -1;
  const instruction = el('p', undefined, task, 'radio-instruction');
  const settings = el('details', undefined, task, 'radio-layout-options');
  el('summary', t('Stick layout & throttle type', 'Розкладка стіків і тип газу'), settings);
  settings.open = !runtime.status().verified;
  settings.append(layoutLabel, throttleLabel);
  layoutLabel.firstChild.textContent = t('Stick layout', 'Розкладка стіків');
  mode.setAttribute('aria-label', t('Stick layout', 'Розкладка стіків'));
  for (const option of mode.options) {
    const left = ['2', '4'].includes(option.value);
    option.textContent = `${t('Mode', 'Режим')} ${option.value} · ${left ? t('left throttle', 'газ ліворуч') : t('right throttle', 'газ праворуч')}`;
  }
  throttleLabel.firstChild.textContent = t('Throttle stick', 'Стік газу');
  throttle.setAttribute('aria-label', t('Throttle stick', 'Стік газу'));
  throttle.options[0].textContent = t(
    'Stays where I leave it (radio)',
    'Залишається на місці (пульт)',
  );
  throttle.options[1].textContent = t(
    'Springs to centre (gamepad)',
    'Повертається в центр (геймпад)',
  );
  const automaticHint = el('p', undefined, task, 'radio-monitor-caption');
  const holdProgress = el('progress', undefined, task);
  holdProgress.max = 1;
  holdProgress.value = 0;
  holdProgress.setAttribute('aria-label', t('Hold this position', 'Утримуйте положення'));
  const actions = el('div', undefined, task, 'radio-guide-actions');
  const primary = button('', actions, advance, 'radio-primary');
  const back = button(t('Back', 'Назад'), actions, goBack);
  const skip = button(
    t('Keep current binding / skip', 'Залишити призначення / пропустити'),
    actions,
    () => finishAction(true),
  );
  const recalibrate = button(t('Recalibrate sticks', 'Калібрувати стіки'), actions, start);
  const manual = button(t('Set sticks manually', 'Налаштувати стіки вручну'), actions, startManual);
  const cancel = button(
    t('Cancel calibration', 'Скасувати калібрування'),
    actions,
    cancelCalibration,
  );
  status.classList.add('radio-feedback');
  task.insertBefore(status, automaticHint);
  const returnHint = el(
    'p',
    t(
      'Returning keeps the flight paused. Use Arm / resume or your arm switch when you are ready.',
      'Після повернення політ залишається на паузі. Коли будете готові, натисніть «Увімкнути» або використайте перемикач.',
    ),
    task,
    'radio-return-hint',
  );
  const monitor = el('section', undefined, workspace, 'radio-monitor');
  el('h3', t('Live sticks', 'Стіки наживо'), monitor);
  const monitorCaption = el(
    'p',
    t('These dots should follow your hands.', 'Ці точки мають повторювати рухи ваших рук.'),
    monitor,
    'radio-monitor-caption',
  );
  monitor.append(sticks);
  const stickGuides = [...sticks.children].map((node) => {
    const target = el('b', undefined, node, 'radio-stick-target'),
      ghost = el('em', undefined, node, 'radio-stick-ghost'),
      trail = el('small', undefined, node, 'radio-stick-trail'),
      circuit = el('div', undefined, node, 'radio-stick-circuit');
    for (const item of [target, ghost, trail, circuit]) item.setAttribute('aria-hidden', 'true');
    return { node, target, ghost, trail, circuit };
  });
  const legend = el(
    'p',
    t(
      '● Your stick · ◯ Required position · Moving outline: follow this path',
      '● Ваш стік · ◯ Потрібне положення · Рухомий контур: повторіть рух',
    ),
    monitor,
    'radio-stick-legend',
  );
  const meters = el('div', undefined, monitor, 'radio-values');
  const values = Object.fromEntries(
    order.map((key) => {
      const row = el('div', undefined, meters);
      el('span', names[key], row);
      return [key, el('output', '—', row)];
    }),
  );
  const armHint = el('p', undefined, monitor, 'radio-arm-hint');
  const switchCard = el('details', undefined, shell, 'radio-extra radio-extra-switches');
  switchCard.open = true;
  el(
    'summary',
    t(
      'Arm, reset, view & fire · your flight switches',
      'Мотори, скидання, камера й вогонь · перемикачі польоту',
    ),
    switchCard,
  );
  const switchContent = el('div', undefined, switchCard, 'radio-extra-body');
  switchContent.append(...groups.switches);
  const extra = el('div', undefined, shell, 'radio-extras');
  const labels = {
    switches: t('Switches & buttons · optional', 'Перемикачі й кнопки · необов’язково'),
    manual: t('Manual stick setup', 'Ручне налаштування стіків'),
    response: t('Flight feel · rates & sensitivity', 'Реакція польоту · швидкість і чутливість'),
    diagnostics: t('Connection diagnostics', 'Діагностика підключення'),
    transfer: t('Back up or import a profile', 'Резервна копія або імпорт профілю'),
  };
  const panels = {};
  for (const key of ['manual', 'response', 'diagnostics', 'transfer']) {
    const details = el('details', undefined, extra, `radio-extra radio-extra-${key}`);
    panels[key] = details;
    el('summary', labels[key], details);
    const content = el('div', undefined, details, 'radio-extra-body');
    content.append(...groups[key]);
  }
  container.prepend(shell);
  if (runtime.status().verified) status.textContent = '';
  let phase = runtime.status().verified ? 'check' : 'connect',
    index = 0,
    baseline = null,
    identity = null,
    assignments = [],
    sweep = null,
    prior = null,
    interrupted = false,
    dwell = null,
    lastSample = null,
    confirmationStage = 'rest',
    automaticAdvance = false;
  function raw() {
    const pad = runtime.raw();
    if (!pad || pad.axes.some((value) => !Number.isFinite(value)))
      throw new Error(
        t(
          'Reconnect your radio, then restart calibration.',
          'Під’єднайте пульт і почніть калібрування знову.',
        ),
      );
    if (identity && radioDeviceKey(pad) !== identity)
      throw new Error(
        t(
          'The radio changed. Restart calibration for this device.',
          'Пульт змінився. Почніть калібрування цього пристрою знову.',
        ),
      );
    return pad;
  }
  function isMapping() {
    return ['prepare', 'positive', 'sweep', 'centre'].includes(phase);
  }
  function isAction() {
    return phase === 'arm' || phase === 'reset';
  }
  function clearDwell() {
    dwell = null;
    holdProgress.value = 0;
  }
  function clearConfirmation() {
    confirmationStage = 'rest';
    clearDwell();
  }
  function validProfile(pad) {
    try {
      if (!pad) return null;
      return normalizeRadioInput(readProfile(false), pad);
    } catch {
      return null;
    }
  }
  function focusStep() {
    update(runtime.raw());
    title.focus({ preventScroll: true });
  }
  function startManual() {
    stopCaptures();
    clearConfirmation();
    identity = null;
    interrupted = false;
    phase = 'manual';
    // Keep measurements already collected by the wizard; provide editable
    // standard ranges for the remaining axes so automatic capture is optional.
    const used = new Set(
      Object.values(rows)
        .filter((row) => row.axis.value !== '')
        .map((row) => Number(row.axis.value)),
    );
    for (const row of Object.values(rows)) {
      if (row.axis.value === '') {
        let axis = 0;
        while (used.has(axis)) axis++;
        row.axis.value = String(axis);
        used.add(axis);
      }
      if (row.min.value === '') row.min.value = '-1';
      if (row.max.value === '') row.max.value = '1';
      if (row.center.value === '') row.center.value = '0';
    }
    invalidate();
    status.textContent = '';
    panels.manual.open = true;
    panels.diagnostics.open = false;
    task.insertBefore(panels.manual, automaticHint);
    switchCard.open = false;
    focusStep();
  }
  function start() {
    if (panels.manual.parentNode === task) extra.prepend(panels.manual);
    try {
      const pad = raw();
      stopCaptures();
      prior = {
        runtime: runtime.status(),
        fields: [...Object.values(rows), ...Object.values(switchRows)]
          .flatMap((row) => Object.values(row))
          .filter((node) => ['INPUT', 'SELECT'].includes(node?.tagName))
          .map((node) => ({ node, value: node.value, checked: node.checked })),
      };
      try {
        prior.form = readProfile(false);
      } catch {
        /* New mapping starts empty. */
      }
      identity = radioDeviceKey(pad);
      index = 0;
      assignments = [];
      sweep = null;
      interrupted = false;
      clearConfirmation();
      lastSample = null;
      phase = 'prepare';
      invalidate();
      status.textContent = '';
      focusStep();
    } catch (error) {
      status.textContent = error.message;
    }
  }
  function cancelCalibration() {
    stopCaptures();
    clearConfirmation();
    if (prior?.form) loadProfile(prior.form, { confirmed: prior.runtime.verified });
    else
      for (const field of prior?.fields ?? []) {
        field.node.value = field.value;
        if (field.checked !== undefined) field.node.checked = field.checked;
      }
    for (const row of Object.values(switchRows)) row.updateSwitchFields();
    if (prior?.runtime.verified && prior.runtime.profile) {
      runtime.setProfile(JSON.parse(prior.runtime.profile), { restoring: true });
      runtime.verify();
    }
    identity = null;
    interrupted = false;
    phase = prior?.form ? 'check' : 'connect';
    status.textContent = t(
      'Calibration cancelled. Your saved profile is unchanged.',
      'Калібрування скасовано. Збережений профіль не змінено.',
    );
    focusStep();
  }
  function goBack() {
    if (interrupted || !runtime.raw()) return;
    clearConfirmation();
    sweep = null;
    if (phase === 'centre' || phase === 'sweep') index = Math.min(3, index - 1);
    else index = Math.max(0, index - 1);
    assignments = assignments.slice(0, index);
    for (const key of order.slice(index))
      for (const field of ['axis', 'min', 'max', 'center']) rows[key][field].value = '';
    baseline = [...raw().axes];
    phase = index === 0 ? 'prepare' : 'positive';
    status.textContent = '';
    focusStep();
  }
  function advance() {
    clearDwell();
    try {
      if (phase === 'saved') {
        onDone();
        return;
      }
      const pad = raw();
      if (interrupted)
        throw new Error(
          t(
            'The connection changed. Cancel and restart this calibration.',
            'Підключення змінилося. Скасуйте й почніть калібрування знову.',
          ),
        );
      if (phase === 'manual') {
        if (autoSaveProfile()) onDone();
        return;
      }
      if (phase === 'connect') {
        if (validProfile(pad)) {
          phase = 'check';
          focusStep();
        } else start();
        return;
      }
      if (phase === 'prepare') {
        if (!index) {
          for (const row of Object.values(rows))
            for (const key of ['axis', 'min', 'max', 'center']) row[key].value = '';
        }
        baseline = [...pad.axes];
        phase = 'positive';
      } else if (phase === 'positive') {
        const ranges = pad.axes
          .map((v, axis) => ({ axis, change: Math.abs(v - baseline[axis]) }))
          .filter((item) => !assignments.includes(item.axis))
          .sort((a, b) => b.change - a.change);
        if (
          !ranges[0] ||
          ranges[0].change < minimumMovement ||
          ranges[0].change < (ranges[1]?.change ?? 0) * 1.8 ||
          !otherAxesStill(pad, ranges[0].axis)
        )
          throw new Error(
            t(
              'Move only the highlighted stick direction, all the way to the edge, and hold it there.',
              'Рухайте лише виділений стік у вказаному напрямку до краю та утримуйте його.',
            ),
          );
        const axis = ranges[0].axis,
          row = rows[order[index]];
        row.axis.value = String(axis);
        row.invert.checked = pad.axes[axis] < baseline[axis];
        assignments[index++] = axis;
        baseline = [...pad.axes];
        phase = index === order.length ? 'sweep' : 'positive';
        if (phase === 'sweep') {
          sweep = {
            min: [...pad.axes],
            max: [...pad.axes],
            started: win.performance.now(),
            lastEnd: pad.axes.map(() => null),
            turns: pad.axes.map(() => 0),
            returnFrom: null,
          };
          status.textContent = '';
        }
      } else if (phase === 'sweep') {
        if (!rangeReady() || !rangeCentred(pad))
          throw new Error(
            t(
              'Move both sticks around their full outer edge, then put both in the middle.',
              'Обведіть обома стіками весь зовнішній край, потім поверніть обидва посередині.',
            ),
          );
        for (const key of order) {
          const row = rows[key],
            axis = Number(row.axis.value);
          row.min.value = String(sweep.min[axis]);
          row.max.value = String(sweep.max[axis]);
          row.center.value = String(pad.axes[axis]);
        }
        phase = 'centre';
      } else if (phase === 'centre') {
        for (const key of order) {
          const row = rows[key],
            value = pad.axes[Number(row.axis.value)];
          if (key === 'throttle' && throttle.value === 'full-travel') {
            const low = row.invert.checked ? Number(row.max.value) : Number(row.min.value);
            if (Math.abs(value - low) > (Number(row.max.value) - Number(row.min.value)) * 0.08)
              throw new Error(
                t(
                  'Lower the throttle stick all the way before checking.',
                  'Повністю опустіть стік газу перед перевіркою.',
                ),
              );
            row.center.value = '';
          } else {
            const min = Number(row.min.value),
              max = Number(row.max.value);
            if (value < min + (max - min) * 0.25 || value > max - (max - min) * 0.25)
              throw new Error(
                t(
                  'Let the spring-loaded sticks return to centre.',
                  'Дайте стікам із пружиною повернутися в центр.',
                ),
              );
            row.center.value = String(value);
          }
        }
        let clearedSwitch = false;
        for (const row of Object.values(switchRows)) {
          if (
            row.button.value !== '' &&
            row.source.value === 'axis' &&
            assignments.includes(Number(row.button.value))
          ) {
            row.button.value = '';
            clearedSwitch = true;
          }
        }
        readProfile(false);
        // Stick calibration is complete here. Switch assignment is independent
        // and must never postpone saving the measured stick channels.
        phase = 'check';
        clearConfirmation();
        status.textContent = clearedSwitch
          ? t(
              'Sticks calibrated. A switch used the same channel as a stick and was cleared. Assign it again below if needed.',
              'Стіки відкалібровано. Перемикач використовував канал стіка, тому його призначення очищено. За потреби призначте його нижче.',
            )
          : t(
              'Sticks calibrated. Settings save automatically; watch the live preview.',
              'Стіки відкалібровано. Перевірте результат перед збереженням.',
            );
      } else if (isAction()) {
        beginAction(phase);
      } else if (phase === 'check') {
        if (externalCaptureActive()) return;
        if (autoSaveProfile()) onDone();
        return;
      }
      focusStep();
    } catch (error) {
      status.textContent = error.message;
    }
  }
  function completeSave(result) {
    if (!result) return;
    phase = 'saved';
    clearConfirmation();
    if (result.saved) onDone();
    else focusStep();
  }
  // Completed channels no longer participate in identifying the next stick.
  // In particular, a spring-centred or nudged throttle must not block yaw.
  // Unassigned channels still enforce one unambiguous movement at a time.
  function otherAxesStill(pad, axis) {
    return (
      baseline &&
      pad.axes.every(
        (value, i) =>
          i === axis || assignments.includes(i) || Math.abs(value - baseline[i]) <= 0.14,
      )
    );
  }
  function sample(pad) {
    if (
      phase !== 'sweep' ||
      !sweep ||
      !pad ||
      interrupted ||
      doc.hidden ||
      (doc.hasFocus && !doc.hasFocus()) ||
      radioDeviceKey(pad) !== identity
    )
      return;
    for (const axis of assignments) {
      sweep.min[axis] = Math.min(sweep.min[axis], pad.axes[axis]);
      sweep.max[axis] = Math.max(sweep.max[axis], pad.axes[axis]);
      const span = sweep.max[axis] - sweep.min[axis];
      if (span < minimumSpan) continue;
      const end =
        pad.axes[axis] <= sweep.min[axis] + span * 0.1
          ? 'low'
          : pad.axes[axis] >= sweep.max[axis] - span * 0.1
            ? 'high'
            : null;
      if (end && end !== sweep.lastEnd[axis]) {
        if (sweep.lastEnd[axis] !== null) sweep.turns[axis]++;
        sweep.lastEnd[axis] = end;
      }
    }
  }
  function axisReady(axis) {
    return sweep && sweep.max[axis] - sweep.min[axis] >= minimumSpan && sweep.turns[axis] >= 3;
  }
  function rangeReady() {
    return (
      sweep &&
      win.performance.now() - sweep.started >= 2500 &&
      assignments.length === order.length &&
      assignments.every(axisReady)
    );
  }
  function rangeCentred(pad) {
    return (
      rangeReady() &&
      assignments.every((axis) => {
        const min = sweep.min[axis],
          max = sweep.max[axis],
          span = max - min;
        return (
          pad.axes[axis] >= min + Math.max(0.1, span * 0.25) &&
          pad.axes[axis] <= max - Math.max(0.1, span * 0.25)
        );
      })
    );
  }
  function previousInput(pad) {
    try {
      return prior?.runtime.verified && prior.form ? normalizeRadioInput(prior.form, pad) : null;
    } catch {
      return null;
    }
  }
  function positiveCandidate(pad) {
    if (!baseline || pad.axes.length !== baseline.length) return null;
    const ranked = pad.axes
      .map((value, axis) => ({ axis, change: Math.abs(value - baseline[axis]) }))
      .filter(({ axis }) => !assignments.includes(axis))
      .sort((a, b) => b.change - a.change);
    const first = ranked[0];
    return first &&
      first.change >= minimumMovement &&
      first.change >= (ranked[1]?.change ?? 0) * 1.8 &&
      otherAxesStill(pad, first.axis)
      ? first
      : null;
  }
  // Provisional movement is display-only until both endpoints are measured.
  // It never nominates a channel for calibration, arms or saves a profile.
  function preview(pad) {
    if (!isMapping() || !pad || interrupted) return null;
    const previous = previousInput(pad),
      measured = Object.fromEntries(order.map((key) => [key, previewControl(key, pad)])),
      result = Object.fromEntries(
        order.map((key) => [key, measured[key] ?? previous?.[key] ?? null]),
      );
    for (const key of order) {
      const row = rows[key];
      if (measured[key] !== null || row.axis.value === '') continue;
      const axis = Number(row.axis.value),
        priorChannel = prior?.runtime.verified ? prior.form?.channels[key] : null,
        span = sweep ? sweep.max[axis] - sweep.min[axis] : 0;
      if (priorChannel?.axis === axis && priorChannel.invert === row.invert.checked && previous)
        continue;
      let value =
        span >= minimumSpan ? (2 * (pad.axes[axis] - sweep.min[axis])) / span - 1 : pad.axes[axis];
      value = Math.max(-1, Math.min(1, value)) * (row.invert.checked ? -1 : 1);
      result[key] = key === 'throttle' ? (value + 1) / 2 : value;
    }
    if (phase !== 'positive' || !baseline) return result;
    const ranked = pad.axes
      .map((value, axis) => ({ axis, delta: value - baseline[axis] }))
      .filter(({ axis }) => !assignments.includes(axis))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
    const candidate = ranked[0];
    if (
      candidate &&
      Math.abs(candidate.delta) >= 0.04 &&
      Math.abs(candidate.delta) >= Math.abs(ranked[1]?.delta ?? 0) * 1.8
    ) {
      const priorChannel = prior?.runtime.verified ? prior.form?.channels[order[index]] : null;
      if (
        previous &&
        priorChannel?.axis === candidate.axis &&
        priorChannel.invert === candidate.delta < 0
      )
        return result;
      const value = Math.max(
        -1,
        Math.min(1, pad.axes[candidate.axis] * Math.sign(candidate.delta)),
      );
      result[order[index]] = order[index] === 'throttle' ? (value + 1) / 2 : value;
    }
    return result;
  }
  function paintGuides(mapping, pad) {
    const layout = STICK_LAYOUTS[Number(mode.value)],
      from = [
        [0, 0],
        [0, 0],
      ],
      to = [
        [0, 0],
        [0, 0],
      ];
    let activeSide = null;
    if (phase === 'sweep' && rangeReady()) {
      const live = preview(pad);
      sweep.returnFrom ??= [0, 1].map((side) => {
        const x = live?.[layout[side * 2]] ?? 0,
          vertical = layout[side * 2 + 1],
          value = live?.[vertical] ?? 0;
        return [x, vertical === 'throttle' ? value * 2 - 1 : value];
      });
      from.splice(0, 2, ...sweep.returnFrom);
    } else if (phase === 'positive') {
      const position = layout.indexOf(order[index]),
        side = Math.floor(position / 2),
        component = position % 2,
        sign = 1;
      activeSide = side;
      to[side][component] = sign;
    } else if (phase === 'centre' && throttle.value === 'full-travel') {
      const position = layout.indexOf('throttle');
      activeSide = Math.floor(position / 2);
      to[activeSide][position % 2] = -1;
    }
    for (const [side, { node, target, ghost, trail, circuit }] of stickGuides.entries()) {
      const visible = mapping && !interrupted,
        radius = (node.clientWidth || 112) * 0.34,
        x0 = from[side][0] * radius,
        y0 = -from[side][1] * radius,
        x1 = to[side][0] * radius,
        y1 = -to[side][1] * radius,
        distance = Math.hypot(x1 - x0, y1 - y0);
      const circling = visible && phase === 'sweep' && !rangeReady();
      node.classList.toggle('is-sweeping', circling);
      node.style.setProperty('--guide-radius', `${radius}px`);
      circuit.hidden = !circling;
      target.hidden = !visible || circling;
      ghost.hidden = !visible || (!circling && distance === 0);
      trail.hidden = !visible || distance === 0;
      node.classList.toggle('is-guided', visible && (activeSide === null || activeSide === side));
      target.style.left = `${50 + to[side][0] * 34}%`;
      target.style.top = `${50 - to[side][1] * 34}%`;
      ghost.style.setProperty('--guide-from-x', `${x0}px`);
      ghost.style.setProperty('--guide-from-y', `${y0}px`);
      ghost.style.setProperty('--guide-to-x', `${x1}px`);
      ghost.style.setProperty('--guide-to-y', `${y1}px`);
      trail.style.left = `${50 + from[side][0] * 34}%`;
      trail.style.top = `${50 - from[side][1] * 34}%`;
      trail.style.width = `${distance}px`;
      trail.style.transform = `rotate(${Math.atan2(y1 - y0, x1 - x0)}rad)`;
    }
    legend.hidden = !mapping;
    setText(
      monitorCaption,
      mapping
        ? t(
            'Solid dots are live input. Follow the moving outlines. A new radio uses raw preview until the full-range sweep is complete.',
            'Суцільні точки — живий ввід. Повторюйте рух контурів. Новий пульт показує необроблений ввід до вимірювання повного діапазону.',
          )
        : t('These dots should follow your hands.', 'Ці точки мають повторювати рухи ваших рук.'),
    );
  }
  function held(pad, key, condition, now, duration = 650, observedAxes = null) {
    if (!condition) {
      clearDwell();
      return false;
    }
    if (
      !dwell ||
      dwell.key !== key ||
      dwell.axes.length !== pad.axes.length ||
      pad.axes.some(
        (value, i) =>
          (!observedAxes || observedAxes.includes(i)) && Math.abs(value - dwell.axes[i]) > 0.035,
      )
    )
      dwell = { key, start: now, axes: [...pad.axes] };
    holdProgress.value = Math.min(1, (now - dwell.start) / duration);
    return now - dwell.start >= duration;
  }
  function beginAction(action) {
    switchCard.open = true;
    clearConfirmation();
    phase = action;
    if (switchRows[action].startCapture) switchRows[action].startCapture();
    else switchRows[action].identify.click();
  }
  function finishAction(skipped = false) {
    if (!isAction() || interrupted) return;
    stopCaptures();
    const action = phase;
    if (action === 'arm') beginAction('reset');
    else {
      phase = 'check';
      clearConfirmation();
    }
    if (skipped)
      status.textContent = t(
        'Current binding kept. Unassigned actions remain available on screen.',
        'Поточне призначення збережено. Непризначені дії доступні на екрані.',
      );
    focusStep();
  }
  function confirmationGesture(pad, input, now) {
    if (!input) {
      clearConfirmation();
      return false;
    }
    let switchesOff = true;
    try {
      const profile = readProfile(false);
      switchesOff = ['arm', 'pause', 'reset', 'camera', 'fire'].every(
        (action) => !radioSwitch(profile, pad, action),
      );
    } catch {
      clearConfirmation();
      return false;
    }
    const quiet =
      Math.abs(input.roll) < 0.08 &&
      Math.abs(input.pitch) < 0.08 &&
      (throttle.value === 'full-travel'
        ? input.throttle < 0.04
        : Math.abs(input.throttle - 0.5) < 0.06);
    const neutral = quiet && Math.abs(input.yaw) < 0.08;
    if (!quiet || !switchesOff || input.yaw < -0.1) {
      clearConfirmation();
      return false;
    }
    if (confirmationStage === 'rest') {
      if (held(pad, 'confirm-rest', neutral, now)) {
        confirmationStage = 'ready';
        clearDwell();
      }
    } else if (confirmationStage === 'ready') {
      if (held(pad, 'confirm-right', input.yaw > 0.85, now, 1000)) {
        confirmationStage = 'release';
        clearDwell();
      }
    } else if (held(pad, 'confirm-release', neutral, now, 450)) {
      clearConfirmation();
      return true;
    }
    return false;
  }
  function tickAutomation(pad) {
    if (automaticAdvance) return;
    const now = win.performance?.now?.() ?? performance.now();
    const active = !doc.hidden && (typeof doc.hasFocus !== 'function' || doc.hasFocus());
    const changedDevice = !pad || (identity && radioDeviceKey(pad) !== identity);
    if (!active || changedDevice) {
      if (isMapping() || isAction() || (changedDevice && identity && phase === 'check'))
        interrupted = true;
      clearConfirmation();
      lastSample = null;
      return;
    }
    if (lastSample !== null && (now - lastSample > 350 || now < lastSample)) clearConfirmation();
    lastSample = now;
    if (interrupted) return;
    if (isMapping() && externalCaptureActive()) {
      clearConfirmation();
      return;
    }
    automaticAdvance = true;
    try {
      if (isAction()) {
        const capture = switchRows[phase].captureStatus?.();
        if ((capture?.state ?? capture) === 'done') finishAction();
        else if (confirmationGesture(pad, validProfile(pad), now)) finishAction(true);
      } else if (phase === 'prepare') {
        // An unknown radio cannot prove its midpoint before measuring travel.
        // Ready explicitly begins it; a verified profile can prove centre live.
        const previous = previousInput(pad);
        if (
          held(
            pad,
            'prepare',
            !!previous &&
              Math.abs(previous.throttle - 0.5) < 0.08 &&
              ['yaw', 'pitch', 'roll'].every((key) => Math.abs(previous[key]) < 0.1),
            now,
            850,
          )
        )
          advance();
      } else if (phase === 'positive') {
        const candidate = positiveCandidate(pad);
        if (held(pad, 'positive:' + candidate?.axis, !!candidate, now, 650, [candidate?.axis]))
          advance();
      } else if (phase === 'sweep') {
        sample(pad);
        if (held(pad, 'sweep-centre', rangeCentred(pad), now, 900, assignments)) advance();
      } else if (phase === 'centre') {
        const ready = order.every((key) => {
          const row = rows[key],
            value = pad.axes[Number(row.axis.value)],
            min = Number(row.min.value),
            max = Number(row.max.value);
          return key === 'throttle' && throttle.value === 'full-travel'
            ? Math.abs(value - (row.invert.checked ? max : min)) <= (max - min) * 0.08
            : value >= min + (max - min) * 0.25 && value <= max - (max - min) * 0.25;
        });
        if (held(pad, 'centre', ready, now, 650, assignments)) advance();
      }
    } finally {
      automaticAdvance = false;
    }
  }
  function update(pad) {
    tickAutomation(pad);
    // Loading a saved/known calibration fills the editor before the runtime is
    // verified. Always offer its explicit check/save action immediately.
    if (phase === 'connect' && validProfile(pad)) phase = 'check';
    const mapping = isMapping(),
      actionMapping = isAction(),
      input = validProfile(pad);
    shell.dataset.radioGuidePhase = phase;
    shell.dataset.radioGuideIndex = String(index);
    shell.dataset.radioGuideConfirmation = confirmationStage;
    if (!pad && (mapping || actionMapping)) interrupted = true;
    const step = phase === 'connect' ? 0 : mapping || actionMapping || phase === 'manual' ? 1 : 2;
    head.hidden = phase !== 'connect';
    stepNodes.forEach((node, i) => {
      node.classList.toggle('is-current', i === step);
      node.classList.toggle('is-done', i < step);
      if (i === step) node.setAttribute('aria-current', 'step');
      else node.removeAttribute('aria-current');
    });
    setText(
      connection,
      pad
        ? t('● Radio connected', '● Пульт під’єднано')
        : t('○ Waiting for a radio', '○ Очікуємо на пульт'),
    );
    connection.classList.toggle('is-connected', !!pad);
    help.hidden = !!pad;
    settings.hidden = mapping || actionMapping || phase === 'saved';
    select.disabled = mapping || actionMapping;
    refreshButton.disabled = mapping || actionMapping;
    extra.hidden = mapping || actionMapping;
    switchCard.hidden = mapping;
    skip.hidden = !actionMapping;
    holdProgress.hidden = !mapping && !actionMapping;
    automaticHint.hidden = holdProgress.hidden;
    setText(
      automaticHint,
      phase === 'prepare'
        ? t(
            'Centre both sticks, then choose Ready. A previously calibrated radio can continue automatically.',
            'Центруйте обидва стіки й натисніть «Готово». Раніше відкалібрований пульт може продовжити автоматично.',
          )
        : phase === 'sweep'
          ? order
              .map((key) => `${names[key]} ${axisReady(Number(rows[key].axis.value)) ? '✓' : '…'}`)
              .join(' · ')
          : mapping
            ? t(
                'Hold the shown direction; the next instruction starts automatically.',
                'Утримуйте вказаний напрямок: наступна підказка почнеться автоматично.',
              )
            : confirmationStage === 'release'
              ? t(
                  'Now return yaw to centre to confirm.',
                  'Тепер поверніть рискання в центр для підтвердження.',
                )
              : actionMapping
                ? t(
                    'To keep the current binding instead: rest sticks, hold yaw right for 1 second, then centre.',
                    'Щоб залишити поточне призначення: стіки у спокій, рискання праворуч на 1 секунду, потім у центр.',
                  )
                : t(
                    'Complete assignments save automatically. Close setup whenever you are ready.',
                    'Завершені призначення зберігаються автоматично. Закрийте налаштування, коли будете готові.',
                  ),
    );
    returnHint.hidden = mapping || actionMapping;
    back.hidden = !['positive', 'sweep', 'centre'].includes(phase);
    cancel.hidden = !mapping && !actionMapping;
    recalibrate.hidden =
      !['check', 'connect', 'manual'].includes(phase) || !pad || (phase === 'connect' && !input);
    manual.hidden = phase === 'manual' || phase === 'saved';
    manual.disabled = !pad;
    primary.disabled =
      !pad ||
      interrupted ||
      (phase === 'sweep' && !rangeCentred(pad)) ||
      (phase === 'manual' && (!input || externalCaptureActive())) ||
      (phase === 'check' && (!input || externalCaptureActive()));
    const displayed = mapping ? preview(pad) : input;
    for (const key of order)
      setText(values[key], displayed?.[key] == null ? '—' : `${Math.round(displayed[key] * 100)}%`);
    setText(
      armHint,
      switchRows.arm.button.value === ''
        ? t(
            'Arming: use the on-screen Arm / resume button.',
            'Увімкнення: екранна кнопка «Увімкнути / продовжити».',
          )
        : t(
            'Arm switch assigned. Use OFF → ON to start or resume.',
            'Перемикач призначено. ВИМК → УВІМК для початку або продовження.',
          ),
    );
    if (phase === 'manual') {
      setText(progress, t('02 / MANUAL SETUP', '02 / РУЧНЕ НАЛАШТУВАННЯ'));
      setText(title, t('Assign your stick channels.', 'Призначте канали стіків.'));
      setText(
        instruction,
        t(
          'Choose Map this movement, move the indicated stick to the edge, then to the opposite edge. Watch the live dots. Complete assignments save automatically. Use Reverse if a dot moves the wrong way.',
          'Натисніть «Призначити цей рух», перемістіть указаний стік до краю, потім до протилежного. Стежте за точками наживо. Завершені призначення зберігаються автоматично. Якщо напрямок зворотний, увімкніть інверсію.',
        ),
      );
      setText(primary, t('Done', 'Готово'));
    } else if (phase === 'connect') {
      setText(progress, t('01 / CONNECT', '01 / ПІД’ЄДНАННЯ'));
      setText(
        title,
        pad
          ? t('Your radio is connected.', 'Пульт під’єднано.')
          : t('Let’s find your radio.', 'Знайдемо ваш пульт.'),
      );
      setText(
        instruction,
        pad
          ? t(
              'Choose your stick layout. We’ll guide you through each movement—no channel numbers needed.',
              'Виберіть розкладку стіків. Ми підкажемо кожен рух — номери каналів не потрібні.',
            )
          : t(
              'Use a USB data cable and select Joystick / HID on the radio. Move a stick, then press Find devices.',
              'Під’єднайте USB-кабель із передаванням даних і виберіть «Джойстик / HID» на пульті. Рухніть стік і натисніть «Знайти пристрої».',
            ),
      );
      setText(
        primary,
        input
          ? t('Check my sticks', 'Перевірити стіки')
          : t('Set up my sticks', 'Налаштувати стіки'),
      );
    } else if (actionMapping) {
      setText(progress, t('02 / FLIGHT SWITCHES', '02 / ПЕРЕМИКАЧІ ПОЛЬОТУ'));
      setText(
        title,
        phase === 'arm'
          ? t('Arm · choose your start switch.', 'Увімкнення · виберіть перемикач старту.')
          : t('Reset · choose your restart switch.', 'Скидання · виберіть перемикач перезапуску.'),
      );
      setText(
        instruction,
        t(
          'Move only your chosen switch OFF → ON → OFF. Hold each position. We will detect it automatically; keep the flight sticks still.',
          'Перемістіть лише обраний перемикач ВИМК → УВІМК → ВИМК. Утримуйте кожне положення. Визначення автоматичне; стіки польоту залиште у спокої.',
        ),
      );
      setText(primary, t('Restart switch detection', 'Почати визначення перемикача знову'));
    } else if (mapping) {
      setText(
        progress,
        `${t('02 / CALIBRATE', '02 / КАЛІБРУВАННЯ')} · ${Math.min(index + 1, 4)} / 4`,
      );
      if (phase === 'sweep') {
        setText(progress, t('02 / MEASURE FULL TRAVEL', '02 / ВИМІРЯТИ ПОВНИЙ ДІАПАЗОН'));
        setText(
          title,
          rangeReady()
            ? t('Now centre both sticks.', 'Тепер центруйте обидва стіки.')
            : t('Circle both sticks around the edge.', 'Обведіть обидва стіки по краю.'),
        );
        setText(
          instruction,
          t(
            'Make two slow circles around each stick’s outer edge, reaching full up, down, left and right. Then put both sticks in the middle. Each check mark means that channel has enough measured travel.',
            'Зробіть по два повільних кола вздовж зовнішнього краю кожного стіка: повністю вгору, вниз, ліворуч і праворуч. Потім поверніть обидва посередині. Позначка означає достатній виміряний діапазон каналу.',
          ),
        );
        setText(primary, t('Continue', 'Далі'));
      } else if (phase === 'prepare' || phase === 'centre') {
        const finalLow = phase === 'centre' && throttle.value === 'full-travel';
        setText(
          title,
          finalLow
            ? t('Final check · throttle down.', 'Остання перевірка · газ униз.')
            : t('Centre both sticks.', 'Центруйте обидва стіки.'),
        );
        setText(
          instruction,
          finalLow
            ? t(
                'Lower throttle fully to the bottom ring. Keep yaw, pitch and roll centred. This is the final check before returning to flight.',
                'Повністю опустіть газ до нижнього кільця. Рискання, тангаж і крен тримайте в центрі. Це остання перевірка перед поверненням до польоту.',
              )
            : t(
                'Put both sticks in the middle and keep switches OFF. Choose Ready to start direction assignment. We will measure the full range with circles afterwards.',
                'Установіть обидва стіки посередині й вимкніть перемикачі. Натисніть «Готово» для призначення напрямків. Після цього виміряємо повний діапазон коловими рухами.',
              ),
        );
        setText(
          primary,
          phase === 'centre' ? t('Finish setup', 'Завершити') : t('Ready', 'Готово'),
        );
      } else {
        const key = order[index],
          position = STICK_LAYOUTS[Number(mode.value)].indexOf(key);
        const positiveDirection = true;
        const side = position < 2 ? t('left stick', 'лівий стік') : t('right stick', 'правий стік');
        const direction =
          position % 2 === 0
            ? positiveDirection
              ? t('right', 'праворуч')
              : t('left', 'ліворуч')
            : positiveDirection
              ? t('up', 'вгору')
              : t('down', 'вниз');
        setText(title, `${names[key]} · ${side}`);
        setText(
          instruction,
          t(
            `Move the ${side} all the way ${direction}. Hold it steadily until the next instruction appears. Keep the other controls still.`,
            `Перемістіть ${side} до краю ${direction}. Утримуйте до наступної підказки. Інші осі залиште нерухомими.`,
          ),
        );
        setText(primary, t('Continue', 'Далі'));
      }
    } else {
      setText(progress, t('03 / READY · AUTO-SAVE', '03 / ГОТОВО · АВТОЗБЕРЕЖЕННЯ'));
      setText(
        title,
        phase === 'saved'
          ? t('Ready for this session.', 'Готово для цього сеансу.')
          : t('Do the dots follow your hands?', 'Точки повторюють рухи ваших рук?'),
      );
      setText(
        instruction,
        phase === 'saved'
          ? t(
              'Your radio works, but the browser could not save the profile. You can return now or export a backup below.',
              'Пульт працює, але браузер не зміг зберегти профіль. Можна повернутися або експортувати копію нижче.',
            )
          : !input
            ? t(
                'This mapping needs calibration. Choose Recalibrate sticks or Set sticks manually.',
                'Це призначення потребує калібрування. Виберіть «Калібрувати стіки» або «Налаштувати стіки вручну».',
              )
            : t(
                'Move both sticks left/right and up/down. Check that the dots follow in the same direction.',
                'Рухайте обидва стіки ліворуч/праворуч і вгору/вниз. Точки мають повторювати напрямок руху.',
              ),
      );
      setText(
        primary,
        phase === 'saved' ? t('Return to flight', 'Повернутися до польоту') : t('Done', 'Готово'),
      );
    }
    paintGuides(mapping, pad);
    if (interrupted)
      setText(
        status,
        t(
          'Calibration interrupted by focus or connection change. Cancel and start again.',
          'Калібрування перервано через зміну фокуса або підключення. Скасуйте й почніть знову.',
        ),
      );
  }
  on(container, 'change', (event) => {
    {
      clearConfirmation();
      update(runtime.raw());
    }
  });
  const lostFocus = () => {
    if (isMapping() || isAction()) interrupted = true;
    clearConfirmation();
    lastSample = null;
  };
  on(win, 'blur', lostFocus);
  on(doc, 'visibilitychange', () => {
    if (doc.hidden) lostFocus();
  });
  update(runtime.raw());
  return {
    update,
    preview,
    sample,
    completeSave,
    start,
    cancel: cancelCalibration,
    captureActive: () => isMapping() || isAction(),
    reset() {
      clearConfirmation();
      lastSample = null;
      phase = 'connect';
      identity = null;
      interrupted = false;
    },
    dispose() {
      for (const remove of listeners) remove();
    },
  };
}
