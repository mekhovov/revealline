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
  verifyProfile,
  saveProfile,
  stopCaptures,
  externalCaptureActive = () => false,
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
    t('Check & save', 'Перевірте й збережіть'),
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
  const confirmation = el('label', undefined, task, 'radio-confirm');
  const checked = el('input', undefined, confirmation);
  checked.type = 'checkbox';
  el(
    'span',
    t(
      'Both sticks move in the correct direction.',
      'Обидва стіки рухаються в правильному напрямку.',
    ),
    confirmation,
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
  const cancel = button(
    t('Cancel calibration', 'Скасувати калібрування'),
    actions,
    cancelCalibration,
  );
  status.classList.add('radio-feedback');
  task.append(status);
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
  el(
    'p',
    t('These dots should follow your hands.', 'Ці точки мають повторювати рухи ваших рук.'),
    monitor,
    'radio-monitor-caption',
  );
  monitor.append(sticks);
  const targets = [...sticks.children].map((node) =>
    el('b', undefined, node, 'radio-stick-target'),
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
    t('Arm & reset · your flight switches', 'Увімкнення й скидання · перемикачі польоту'),
    switchCard,
  );
  const switchContent = el('div', undefined, switchCard, 'radio-extra-body');
  switchContent.append(...groups.switches);
  const extra = el('div', undefined, shell, 'radio-extras');
  const labels = {
    switches: t('Switches & buttons · optional', 'Перемикачі й кнопки · необов’язково'),
    manual: t('Advanced calibration', 'Розширене калібрування'),
    response: t('Flight feel · rates & sensitivity', 'Реакція польоту · швидкість і чутливість'),
    diagnostics: t('Connection diagnostics', 'Діагностика підключення'),
    transfer: t('Back up or import a profile', 'Резервна копія або імпорт профілю'),
  };
  for (const key of ['manual', 'response', 'diagnostics', 'transfer']) {
    const details = el('details', undefined, extra, `radio-extra radio-extra-${key}`);
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
    positive = null,
    prior = null,
    interrupted = false,
    dwell = null,
    lastSample = null,
    confirmationStage = 'rest',
    returnFor = null,
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
    return ['prepare', 'positive', 'return', 'negative', 'centre'].includes(phase);
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
  function start() {
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
      positive = null;
      interrupted = false;
      clearConfirmation();
      lastSample = null;
      phase = 'prepare';
      checked.checked = false;
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
    checked.checked = false;
    status.textContent = t(
      'Calibration cancelled. Your saved profile is unchanged.',
      'Калібрування скасовано. Збережений профіль не змінено.',
    );
    focusStep();
  }
  function goBack() {
    clearConfirmation();
    if (phase === 'negative' || (phase === 'return' && returnFor === 'negative')) {
      phase = 'positive';
      positive = null;
    } else {
      if (!(phase === 'return' && returnFor === 'next')) index = Math.max(0, index - 1);
      assignments = assignments.slice(0, index);
      phase = 'prepare';
    }
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
      if (phase === 'connect') {
        if (validProfile(pad)) {
          phase = 'check';
          checked.checked = false;
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
          ranges[0].change < 0.3 ||
          ranges[0].change < (ranges[1]?.change ?? 0) * 1.8 ||
          !otherAxesStill(pad, ranges[0].axis)
        )
          throw new Error(
            t(
              'Move only the highlighted stick direction, all the way to the edge, and hold it there.',
              'Рухайте лише виділений стік у вказаному напрямку до краю та утримуйте його.',
            ),
          );
        positive = { axis: ranges[0].axis, value: pad.axes[ranges[0].axis] };
        returnFor = 'negative';
        phase = 'return';
      } else if (phase === 'return') {
        if (!atRest(pad))
          throw new Error(
            t(
              'Return the highlighted stick to its starting rest position.',
              'Поверніть виділений стік у початкове положення спокою.',
            ),
          );
        if (returnFor === 'negative') phase = 'negative';
        else {
          index++;
          positive = null;
          baseline = [...pad.axes];
          phase = index === order.length ? 'centre' : 'positive';
        }
      } else if (phase === 'negative') {
        const end = pad.axes[positive.axis];
        if (
          Math.abs(end - positive.value) < 0.5 ||
          !otherAxesStill(pad, positive.axis) ||
          (order[index] !== 'throttle' &&
            (end - baseline[positive.axis]) * (positive.value - baseline[positive.axis]) >= 0)
        )
          throw new Error(
            t(
              'Move the same stick all the way to the opposite edge before continuing.',
              'Перемістіть той самий стік до протилежного краю, перш ніж продовжити.',
            ),
          );
        const row = rows[order[index]];
        row.axis.value = String(positive.axis);
        row.min.value = String(Math.min(end, positive.value));
        row.max.value = String(Math.max(end, positive.value));
        row.center.value = String((end + positive.value) / 2);
        row.invert.checked = positive.value < end;
        assignments[index] = positive.axis;
        returnFor = 'next';
        phase = 'return';
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
        checked.checked = false;
        beginAction('arm');
        status.textContent = clearedSwitch
          ? t(
              'Sticks calibrated. A switch used the same channel as a stick and was cleared. Assign it again below if needed.',
              'Стіки відкалібровано. Перемикач використовував канал стіка, тому його призначення очищено. За потреби призначте його нижче.',
            )
          : t(
              'Sticks calibrated. Check the result before saving.',
              'Стіки відкалібровано. Перевірте результат перед збереженням.',
            );
      } else if (isAction()) {
        beginAction(phase);
      } else if (phase === 'check') {
        if (!checked.checked || externalCaptureActive()) return;
        if (!verifyProfile()) return;
        const result = saveProfile();
        if (!result) return;
        if (result.saved) {
          phase = 'saved';
          clearConfirmation();
          onDone();
          return;
        }
        phase = 'saved';
      }
      focusStep();
    } catch (error) {
      status.textContent = error.message;
    }
  }
  function otherAxesStill(pad, axis) {
    return (
      baseline && pad.axes.every((value, i) => i === axis || Math.abs(value - baseline[i]) <= 0.14)
    );
  }
  function atRest(pad) {
    return (
      baseline &&
      pad.axes.length === baseline.length &&
      pad.axes.every((value, i) => Math.abs(value - baseline[i]) <= 0.12)
    );
  }
  function positiveCandidate(pad) {
    if (!baseline || pad.axes.length !== baseline.length) return null;
    const ranked = pad.axes
      .map((value, axis) => ({ axis, change: Math.abs(value - baseline[axis]) }))
      .filter(({ axis }) => !assignments.includes(axis))
      .sort((a, b) => b.change - a.change);
    const first = ranked[0];
    return first &&
      first.change >= 0.65 &&
      first.change >= (ranked[1]?.change ?? 0) * 1.8 &&
      otherAxesStill(pad, first.axis)
      ? first
      : null;
  }
  function held(pad, key, condition, now, duration = 650) {
    if (!condition) {
      clearDwell();
      return false;
    }
    if (
      !dwell ||
      dwell.key !== key ||
      dwell.axes.length !== pad.axes.length ||
      pad.axes.some((value, i) => Math.abs(value - dwell.axes[i]) > 0.035)
    )
      dwell = { key, start: now, axes: [...pad.axes] };
    holdProgress.value = Math.min(1, (now - dwell.start) / duration);
    return now - dwell.start >= duration;
  }
  function beginAction(action) {
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
      checked.checked = false;
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
      switchesOff = ['arm', 'pause', 'reset'].every((action) => !radioSwitch(profile, pad, action));
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
      } else if (phase === 'check') {
        if (externalCaptureActive()) clearConfirmation();
        else if (confirmationGesture(pad, validProfile(pad), now)) {
          checked.checked = true;
          advance();
        }
      } else if (phase === 'prepare') {
        if (held(pad, 'prepare', true, now, 850)) advance();
      } else if (phase === 'positive') {
        const candidate = positiveCandidate(pad);
        if (held(pad, 'positive:' + candidate?.axis, !!candidate, now)) advance();
      } else if (phase === 'return') {
        if (held(pad, 'return:' + returnFor, atRest(pad), now)) advance();
      } else if (phase === 'negative') {
        const end = pad.axes[positive.axis],
          delta = end - positive.value;
        const opposite =
          order[index] === 'throttle' ||
          (end - baseline[positive.axis]) * (positive.value - baseline[positive.axis]) < 0;
        if (
          held(
            pad,
            'negative',
            Math.abs(delta) >= 1.1 && opposite && otherAxesStill(pad, positive.axis),
            now,
          )
        )
          advance();
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
        if (held(pad, 'centre', ready, now)) advance();
      }
    } finally {
      automaticAdvance = false;
    }
  }
  function update(pad) {
    tickAutomation(pad);
    const mapping = isMapping(),
      actionMapping = isAction(),
      input = validProfile(pad);
    shell.dataset.radioGuidePhase = phase;
    shell.dataset.radioGuideIndex = String(index);
    shell.dataset.radioGuideConfirmation = confirmationStage;
    if (!pad && (mapping || actionMapping)) interrupted = true;
    if (phase === 'connect' && runtime.status().verified && input) phase = 'check';
    const step = phase === 'connect' ? 0 : mapping || actionMapping ? 1 : 2;
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
    holdProgress.hidden = !mapping && !actionMapping && phase !== 'check';
    automaticHint.hidden = holdProgress.hidden;
    setText(
      automaticHint,
      mapping
        ? t(
            'Hold each position steadily; the next step starts automatically. Buttons remain available.',
            'Утримуйте кожне положення: наступний крок почнеться автоматично. Кнопки також доступні.',
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
                'After checking, rest sticks with switches OFF. Hold yaw right for 1 second, then centre to save and return. Or use the checkbox and Save.',
                'Після перевірки поверніть стіки у спокій, перемикачі ВИМК. Утримуйте рискання праворуч 1 секунду, потім поверніть у центр, щоб зберегти й повернутися. Або скористайтеся прапорцем і кнопкою збереження.',
              ),
    );
    confirmation.hidden = phase !== 'check';
    returnHint.hidden = mapping || actionMapping;
    back.hidden = !['positive', 'return', 'negative', 'centre'].includes(phase);
    cancel.hidden = !mapping && !actionMapping;
    recalibrate.hidden =
      !['check', 'connect'].includes(phase) || !pad || (phase === 'connect' && !input);
    primary.disabled =
      !pad ||
      interrupted ||
      (phase === 'check' && (!input || !checked.checked || externalCaptureActive()));
    for (const key of order) setText(values[key], input ? `${Math.round(input[key] * 100)}%` : '—');
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
    for (const target of targets) target.hidden = true;
    if (phase === 'connect') {
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
      if (phase === 'prepare' || phase === 'centre' || phase === 'return') {
        setText(title, t('Rest your sticks.', 'Поверніть стіки у вихідне положення.'));
        setText(
          instruction,
          throttle.value === 'full-travel'
            ? t(
                'Lower throttle all the way. Centre the other controls and leave switches OFF.',
                'Повністю опустіть газ. Центруйте інші осі й залиште перемикачі вимкненими.',
              )
            : t(
                'Release both sticks so they spring to centre. Centred gamepad throttle means 50% power.',
                'Відпустіть обидва стіки, щоб вони повернулися в центр. Центр газу геймпада означає 50% потужності.',
              ),
        );
        setText(
          primary,
          phase === 'centre' ? t('Continue to switches', 'До перемикачів') : t('Ready', 'Готово'),
        );
      } else {
        const key = order[index],
          position = STICK_LAYOUTS[Number(mode.value)].indexOf(key);
        const positiveDirection = phase === 'positive';
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
        const target = targets[Math.floor(position / 2)],
          sign = positiveDirection ? 1 : -1;
        target.hidden = false;
        target.style.transform = `translate(${position % 2 === 0 ? sign * 40 : 0}px, ${position % 2 === 1 ? -sign * 40 : 0}px)`;
        setText(primary, t('Continue', 'Далі'));
      }
    } else {
      setText(progress, t('03 / CHECK & SAVE', '03 / ПЕРЕВІРКА Й ЗБЕРЕЖЕННЯ'));
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
                'This mapping needs calibration. Choose Recalibrate sticks, or review Advanced calibration below.',
                'Це призначення потребує калібрування. Натисніть «Калібрувати стіки» або перевірте розширені налаштування нижче.',
              )
            : t(
                'Move both sticks left/right and up/down. Check that the dots follow in the same direction.',
                'Рухайте обидва стіки ліворуч/праворуч і вгору/вниз. Точки мають повторювати напрямок руху.',
              ),
      );
      setText(
        primary,
        phase === 'saved'
          ? t('Return to flight', 'Повернутися до польоту')
          : t('Save & return', 'Зберегти й повернутися'),
      );
    }
    if (interrupted)
      setText(
        status,
        t(
          'Calibration interrupted by focus or connection change. Cancel and start again.',
          'Калібрування перервано через зміну фокуса або підключення. Скасуйте й почніть знову.',
        ),
      );
  }
  on(checked, 'change', () => update(runtime.raw()));
  on(container, 'change', (event) => {
    if (event.target !== checked) {
      checked.checked = false;
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
    captureActive: () => isMapping() || isAction(),
    reset() {
      clearConfirmation();
      lastSample = null;
      phase = 'connect';
      identity = null;
      interrupted = false;
      checked.checked = false;
    },
    dispose() {
      for (const remove of listeners) remove();
    },
  };
}
