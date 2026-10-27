import { AIRCRAFT_CHALLENGE_RULES, validateAircraftChallengeRules } from './aircraft-challenge.mjs';

const time = (ticks) => {
  const seconds = Math.floor(ticks / 50);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
};

/** One shared draft across preflight and pause. A selection is never applied to
 * an existing attempt: only its explicit restart callback creates new rules. */
export function mountAircraftChallengeControls({
  parents,
  statusParent,
  locale = () => 'en',
  getSession,
  onRestart,
}) {
  const removals = [],
    panels = [];
  const hud = statusParent?.ownerDocument.createElement('div'),
    hudClock = statusParent?.ownerDocument.createElement('output'),
    hudResult = statusParent?.ownerDocument.createElement('span');
  if (hud) {
    hud.className = 'aircraft-challenge-hud';
    hudClock.setAttribute('aria-live', 'off');
    hudResult.setAttribute('role', 'status');
    hud.append(hudClock, hudResult);
    statusParent.append(hud);
  }
  let kind = 'none',
    seconds = '120',
    busy = false,
    disposed = false,
    error = '',
    lastState = null;
  const text = (en, uk) => (locale() === 'uk' ? uk : en);
  const setText = (element, value) => {
    if (element.textContent !== value) element.textContent = value;
  };
  function listen(element, event, callback) {
    element.addEventListener(event, callback);
    removals.push(() => element.removeEventListener(event, callback));
  }
  function rules() {
    if (kind === 'none') return null;
    return validateAircraftChallengeRules(
      kind === 'timed-practice'
        ? { format: AIRCRAFT_CHALLENGE_RULES, kind, durationTicks: Number(seconds) * 50 }
        : { format: AIRCRAFT_CHALLENGE_RULES, kind, takeoffHoldTicks: 25, landingHoldTicks: 50 },
    );
  }
  function render() {
    if (disposed) return;
    const session = getSession(),
      state = lastState ?? session?.snapshot(),
      current = session?.challengeRules?.(),
      progress = state?.challenge,
      available = Boolean(session && (state?.aircraftRadiusMm || session.aircraft));
    for (const p of panels) {
      p.root.hidden = !available;
      if (!available) continue;
      setText(
        p.title,
        text('Optional practice challenges', 'Необов’язкові тренувальні випробування'),
      );
      setText(p.labelText, text('Rules for a new attempt', 'Правила нової спроби'));
      for (const [value, en, uk] of [
        ['none', 'Unlimited practice', 'Необмежене тренування'],
        ['timed-practice', 'Timed practice', 'Тренування на час'],
        ['battery-endurance', 'Battery endurance', 'Автономність батареї'],
      ])
        setText(p.options[value], text(en, uk));
      p.select.value = kind;
      p.duration.value = seconds;
      p.durationLabel.hidden = kind !== 'timed-practice';
      setText(p.durationText, text('Duration (seconds, 30–3600)', 'Тривалість (секунди, 30–3600)'));
      p.select.disabled = p.duration.disabled = p.restart.disabled = busy;
      setText(
        p.restart,
        busy
          ? text('Preparing fresh attempt…', 'Підготовка нової спроби…')
          : text('Restart with selected rules', 'Перезапустити з вибраними правилами'),
      );
      setText(
        p.help,
        text(
          'Restart returns to launch with a fresh battery and the same aircraft, mode and conditions. Arm when ready. Pause and recovery retain charge and challenge progress. Ordinary practice has no time limit.',
          'Перезапуск повертає на старт зі свіжою батареєю, тим самим дроном, режимом та умовами. Увімкніть двигуни, коли будете готові. Пауза й відновлення зберігають заряд і прогрес випробування. Звичайне тренування не має обмеження часу.',
        ),
      );
      p.enduranceHelp.hidden =
        kind !== 'battery-endurance' && current?.kind !== 'battery-endurance';
      setText(
        p.enduranceHelp,
        text(
          'Endurance enables battery depletion for this attempt only. Airborne time starts after 0.5 seconds clear of the ground and ends when the battery is empty or the aircraft stays grounded for 1 second. These are simulated estimates, not measured real-aircraft endurance.',
          'Автономність вмикає розряджання батареї лише для цієї спроби. Час у повітрі починається після 0,5 секунди без контакту із землею та завершується, коли батарея порожня або дрон стоїть на землі 1 секунду. Це оцінки симуляції, а не виміряна автономність реального дрона.',
        ),
      );
      setText(
        p.clock,
        !current || !progress
          ? text('Current flight: unlimited practice', 'Поточний політ: необмежене тренування')
          : current.kind === 'timed-practice'
            ? text(
                `Challenge time: ${time(progress.elapsedTicks)} / ${time(current.durationTicks)}`,
                `Час випробування: ${time(progress.elapsedTicks)} / ${time(current.durationTicks)}`,
              )
            : text(
                `Airborne time: ${time(progress.airborneTicks)}`,
                `Час у повітрі: ${time(progress.airborneTicks)}`,
              ),
      );
      const result = progress?.result;
      const reason = result
        ? {
            'time-elapsed': text('Time completed.', 'Час завершився.'),
            landed: text('Landing confirmed.', 'Посадку підтверджено.'),
            'battery-empty': text('Battery empty.', 'Батарея порожня.'),
          }[result.reason]
        : '';
      setText(
        p.status,
        error ||
          (result
            ? `${reason} ${text('Practice result · unscored. Continue flying or restart.', 'Результат тренування · без заліку. Продовжуйте політ або перезапустіть.')}`
            : current?.kind === 'battery-endurance' && progress?.takeoffTick === null
              ? text('Waiting for takeoff · unscored.', 'Очікування зльоту · без заліку.')
              : current
                ? text(
                    'Challenge in progress · unscored. Finishing the challenge does not end your flight.',
                    'Випробування триває · без заліку. Завершення випробування не припиняє політ.',
                  )
                : ''),
      );
    }
    if (hud) {
      hud.hidden = !available || !current || !progress;
      if (!hud.hidden) {
        setText(hudClock, panels[0].clock.textContent);
        setText(hudResult, progress.result ? panels[0].status.textContent : '');
      }
    }
  }
  for (const parent of parents) {
    const doc = parent.ownerDocument,
      element = (tag) => doc.createElement(tag),
      root = element('fieldset'),
      title = element('legend'),
      label = element('label'),
      labelText = element('span'),
      select = element('select'),
      durationLabel = element('label'),
      durationText = element('span'),
      duration = element('input'),
      restart = element('button'),
      help = element('p'),
      enduranceHelp = element('p'),
      clock = element('output'),
      status = element('p'),
      options = {};
    root.className = 'aircraft-challenge-controls';
    select.dataset.aircraftChallenge = 'kind';
    duration.dataset.aircraftChallenge = 'duration';
    restart.dataset.aircraftChallenge = 'restart';
    duration.type = 'number';
    duration.min = '30';
    duration.max = '3600';
    duration.step = '1';
    restart.type = 'button';
    clock.setAttribute('aria-live', 'off');
    status.setAttribute('role', 'status');
    for (const value of ['none', 'timed-practice', 'battery-endurance']) {
      const option = element('option');
      option.value = value;
      options[value] = option;
      select.append(option);
    }
    label.append(labelText, select);
    durationLabel.append(durationText, duration);
    root.append(title, label, durationLabel, restart, help, enduranceHelp, clock, status);
    parent.append(root);
    panels.push({
      root,
      title,
      labelText,
      select,
      options,
      durationLabel,
      durationText,
      duration,
      restart,
      help,
      enduranceHelp,
      clock,
      status,
    });
    listen(select, 'change', () => {
      kind = select.value;
      error = '';
      render();
    });
    listen(duration, 'input', () => {
      seconds = duration.value;
      error = '';
      render();
    });
    listen(restart, 'click', () => {
      if (busy || disposed || root.hidden) return;
      let selected;
      try {
        selected = rules();
      } catch {
        error = text(
          'Enter a whole number from 30 to 3600 seconds.',
          'Введіть ціле число від 30 до 3600 секунд.',
        );
        render();
        return;
      }
      busy = true;
      error = '';
      render();
      void Promise.resolve()
        .then(() => {
          if (!disposed) return onRestart(selected);
        })
        .catch((failure) => {
          error = failure.message;
        })
        .finally(() => {
          busy = false;
          lastState = getSession()?.snapshot() ?? null;
          render();
        });
    });
  }
  render();
  return {
    roots: panels.map((panel) => panel.root),
    update(state) {
      lastState = state;
      render();
    },
    dispose() {
      disposed = true;
      for (const remove of removals) remove();
      for (const panel of panels) panel.root.remove();
      hud?.remove();
    },
  };
}
