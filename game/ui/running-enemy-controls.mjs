import { snakeText } from '../snake/copy.mjs';
import { getLocale, onLocaleChange } from '../i18n/index.mjs';
import { createRunningEnemyPreferences } from '../hunt/running-enemy-preferences.mjs';

const copy = {
  en: {
    title: 'Running enemies',
    help: 'Adds humanoids to hunt by touch. Applies when starting or restarting a level. Blood is optional.',
    objective:
      'Your original mission objective stays the same; hunting adds bonus points. Off keeps the level as designed.',
    on: 'On',
    off: 'Off',
    current: 'Humanoids in the current attempt',
    next: 'Extra enemies on next start or restart',
    unchanged: 'The current attempt stays unchanged.',
    restart: 'Restart with this setting',
    restartHelp: 'This replaces the current attempt with a new attempt using your setting.',
    unavailable:
      'This level cannot add running enemies. Your choice still applies to other levels.',
    saving:
      'This choice applies to this session. Saving is unavailable; existing saved data was kept where possible.',
    retry: 'Retry saving',
  },
  uk: {
    title: 'Рухливі вороги',
    help: 'Додає гуманоїдів, яких можна знищувати дотиком. Діє після початку або перезапуску рівня. Кров необов’язкова.',
    objective:
      'Початкова мета місії не змінюється; полювання додає бонусні бали. Вимкнення залишає рівень у початковому вигляді.',
    on: 'Увімкнено',
    off: 'Вимкнено',
    current: 'Гуманоїди в поточній спробі',
    next: 'Додаткові вороги після початку або перезапуску',
    unchanged: 'Поточна спроба залишається без змін.',
    restart: 'Перезапустити з цим налаштуванням',
    restartHelp: 'Поточну спробу буде замінено новою з вибраним налаштуванням.',
    unavailable:
      'На цьому рівні не можна додати рухливих ворогів. Вибір і далі діє для інших рівнів.',
    saving:
      'Вибір діє в цьому сеансі. Збереження недоступне; наявні збережені дані за можливості залишено без змін.',
    retry: 'Зберегти повторно',
  },
};
let nextControlId = 0;

/** Mount beside display options or a prestart selector. This only changes the
 * shared next-attempt preference; the host remains the owner of every run. */
export function mountRunningEnemyControls({
  container,
  document: doc = container?.ownerDocument ?? globalThis.document,
  window: target = globalThis.window,
  preferences: suppliedPreferences = null,
  getStorage,
  getCurrentEnabled = () => null,
  getAcceptedEnabled = getCurrentEnabled,
  getAvailability = () => null,
  onRestart = null,
} = {}) {
  if (!doc || !container) throw new TypeError('A running enemy settings container is required.');
  const preferences =
    suppliedPreferences ??
    createRunningEnemyPreferences({
      window: target,
      ...(getStorage ? { getStorage } : {}),
    });
  const root = doc.createElement('div');
  root.className = 'running-enemy-controls';
  root.dataset.runningEnemyControls = 'true';
  const label = doc.createElement('label');
  label.className = 'settings-check';
  const control = doc.createElement('input');
  control.type = 'checkbox';
  control.name = 'running-enemies';
  control.dataset.runningEnemies = 'true';
  control.id = `running-enemies-${++nextControlId}`;
  const heading = doc.createElement('span');
  label.append(control, heading);
  root.append(label);
  const note = (name, live = false) => {
    const node = doc.createElement('p');
    node.className = 'micro-note';
    node.id = `${control.id}-${name}`;
    if (live) node.setAttribute('role', 'status');
    root.append(node);
    return node;
  };
  const help = note('help'),
    objective = note('objective'),
    attempts = note('attempts', true),
    availability = note('availability', true),
    saving = note('saving', true);
  control.setAttribute('aria-describedby', `${help.id} ${objective.id} ${attempts.id}`);
  const retry = doc.createElement('button');
  retry.type = 'button';
  root.append(retry);
  const restartHelp = note('restart-help'),
    restart = doc.createElement('button');
  restart.type = 'button';
  restart.dataset.runningEnemiesRestart = 'true';
  restart.setAttribute('aria-describedby', restartHelp.id);
  root.append(restart);
  const campaigns = doc.createElement('a');
  campaigns.href = new URL('../snake/', import.meta.url).href;
  root.append(campaigns);
  container.append(root);
  let disposed = false;
  const text = (node, value) => {
    if (node.textContent !== value) node.textContent = value;
  };
  const refresh = () => {
    if (disposed) return;
    const words = copy[getLocale()] ?? copy.en,
      state = preferences.snapshot(),
      current = getCurrentEnabled(),
      accepted = getAcceptedEnabled(),
      available = getAvailability(),
      choice = (enabled) => words[enabled ? 'on' : 'off'];
    control.checked = state.enabled;
    text(heading, words.title);
    text(campaigns, snakeText('campaigns'));
    text(help, words.help);
    text(objective, words.objective);
    const currentText =
      typeof current === 'boolean' ? `${words.current}: ${choice(current)}. ` : '';
    text(
      attempts,
      `${currentText}${words.next}: ${choice(state.enabled)}.${typeof accepted === 'boolean' && accepted !== state.enabled ? ` ${words.unchanged}` : ''}`,
    );
    availability.hidden = !state.enabled || available?.available !== false;
    text(availability, available?.reason || words.unavailable);
    saving.hidden = retry.hidden = state.durable;
    text(saving, words.saving);
    text(retry, words.retry);
    restart.hidden = restartHelp.hidden = !(
      typeof onRestart === 'function' &&
      typeof accepted === 'boolean' &&
      accepted !== state.enabled
    );
    text(restart, words.restart);
    text(restartHelp, words.restartHelp);
  };
  const change = () => preferences.set(control.checked);
  const save = () => preferences.retry();
  const restartAttempt = () => {
    if (disposed || restart.hidden) return;
    onRestart();
    refresh();
  };
  control.addEventListener('change', change);
  retry.addEventListener('click', save);
  restart.addEventListener('click', restartAttempt);
  const unsubscribe = preferences.subscribe(refresh);
  const unlocale = onLocaleChange(refresh);
  return Object.freeze({
    element: root,
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      unlocale();
      control.removeEventListener('change', change);
      retry.removeEventListener('click', save);
      restart.removeEventListener('click', restartAttempt);
      if (!suppliedPreferences) preferences.dispose();
      root.remove();
    },
  });
}
