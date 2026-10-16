import {
  sharedBattlefieldGround,
  BATTLEFIELD_GROUND_CHOICES,
} from '../presentation/battlefield-ground.mjs';

const COPY = {
  en: {
    label: 'Covered ground · Solo, Duel and Team',
    authored: 'Original ground',
    'field-crossing': 'FPV · Field Crossing',
    'freight-depot': 'FPV · Freight Depot',
    'relay-ruins': 'FPV · Relay Ruins',
    'river-port': 'FPV · River Port',
    'chalk-quarry': 'FPV · Chalk Quarry',
    'orchard-strongpoint': 'FPV · Orchard Strongpoint',
    help: 'Decorates unexplored ground only. Picture rewards and danger tiles stay intact. Pinned environments and custom terrain keep their own artwork. Snake has a separate Board look choice; SIM keeps its 3D worlds.',
    unsaved: 'Applied for this visit; could not save the choice.',
  },
  uk: {
    label: 'Нерозкрита земля · Соло, Дуель і Команда',
    authored: 'Початкове покриття',
    'field-crossing': 'FPV · Польова переправа',
    'freight-depot': 'FPV · Вантажне депо',
    'relay-ruins': 'FPV · Руїни ретранслятора',
    'river-port': 'FPV · Річковий порт',
    'chalk-quarry': 'FPV · Крейдяний кар’єр',
    'orchard-strongpoint': 'FPV · Садовий опорний пункт',
    help: 'Оформлює лише нерозкриту землю. Нагородні зображення й небезпечні клітини незмінні. Закріплені середовища й авторські текстури зберігаються. Snake має окремий вигляд поля; SIM зберігає 3D-світи.',
    unsaved: 'Діє лише під час цього відвідування; зберегти вибір не вдалося.',
  },
};
let sequence = 0;
export function mountBattlefieldGroundControls({
  document: doc,
  container,
  locale = () => 'en',
  preferences = sharedBattlefieldGround(),
}) {
  const root = doc.createElement('div'),
    label = doc.createElement('label'),
    title = doc.createElement('span'),
    select = doc.createElement('select'),
    help = doc.createElement('p'),
    status = doc.createElement('p');
  select.id = `battlefield-ground-${++sequence}`;
  select.name = 'battlefield-ground';
  select.dataset.battlefieldGround = 'true';
  help.id = `${select.id}-help`;
  select.setAttribute('aria-describedby', help.id);
  status.setAttribute('role', 'status');
  help.className = status.className = 'micro-note';
  label.className = 'settings-row';
  for (const value of BATTLEFIELD_GROUND_CHOICES) {
    const option = doc.createElement('option');
    option.value = value;
    select.append(option);
  }
  label.append(title, select);
  root.append(label, help, status);
  container.append(root);
  const refresh = () => {
    const words = COPY[locale()] ?? COPY.en,
      state = preferences.snapshot();
    title.textContent = words.label;
    help.textContent = words.help;
    for (const option of select.options) option.textContent = words[option.value];
    select.value = state.world;
    status.textContent = state.durable ? '' : words.unsaved;
  };
  const change = () => preferences.set(select.value);
  select.addEventListener('change', change);
  const stop = preferences.subscribe(refresh);
  return {
    refresh,
    dispose() {
      stop();
      select.removeEventListener('change', change);
      root.remove();
    },
  };
}
