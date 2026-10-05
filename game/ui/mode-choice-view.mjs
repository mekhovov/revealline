// Dependency-free presentation shared with bundled simulator builds.
export const GAME_MODE_ORDER = Object.freeze([
  'solo',
  'team',
  'versus',
  'snake',
  'overflight',
  'simulator',
]);
const copy = {
  en: {
    solo: 'Solo',
    team: 'Team',
    versus: 'VS',
    snake: 'Snake',
    overflight: 'Overflight',
    simulator: 'SIM',
    mode: 'Game mode',
  },
  uk: {
    solo: 'Соло',
    team: 'Разом',
    versus: 'VS',
    snake: 'Змійка',
    overflight: 'Проліт',
    simulator: 'SIM',
    mode: 'Режим гри',
  },
};

/** Reuse each host's real actions, keeping navigation, handlers and save ownership. */
export function renderModeChoices({
  root,
  current,
  actions = {},
  locale = 'en',
  setMenuIcon = () => {},
}) {
  if (!root || !GAME_MODE_ORDER.includes(current))
    throw new Error('A visible game mode is required.');
  const document = root.ownerDocument;
  const rows = GAME_MODE_ORDER.filter((id) => id !== 'overflight' || actions.overflight).map(
    (id) => {
      const element = actions[id] ?? document.createElement('button');
      if (element.tagName === 'BUTTON') element.type = 'button';
      // A reused launch link must never retain primary/pressed paint from its old home.
      element.classList.remove(
        'primary',
        'race-primary',
        'field-kit-primary',
        'selected',
        'active-tab',
      );
      for (const attribute of [
        'data-i18n',
        'data-field-kit-copy',
        'aria-current',
        'aria-selected',
        'aria-pressed',
      ])
        element.removeAttribute(attribute);
      if (id === current) element.setAttribute('aria-current', 'page');
      element.dataset.gameMode = id;
      element.id ||= `${root.id || 'game-mode'}-${id}`;
      const label = document.createElement('strong');
      label.className = 'game-mode-label';
      element.replaceChildren(label);
      if (['solo', 'team', 'versus', 'simulator'].includes(id)) {
        const badge = document.createElement('small');
        badge.className = 'game-mode-badge';
        badge.textContent = id === 'simulator' ? 'beta' : id === 'solo' ? '1P' : '2P';
        badge.setAttribute('aria-hidden', 'true');
        element.append(badge);
      }
      setMenuIcon(element, id);
      return { id, element, label };
    },
  );
  root.classList.add('game-mode-choice');
  root.dataset.menuLayout = 'horizontal';
  root.dataset.menuScope = 'modes';
  root.replaceChildren(...rows.map(({ element }) => element));
  for (const [index, { element }] of rows.entries()) {
    element.setAttribute(
      'data-menu-left',
      Array.from(
        { length: rows.length - 1 },
        (_, offset) => rows[(index - offset - 1 + rows.length) % rows.length].element.id,
      ).join(' '),
    );
    element.setAttribute(
      'data-menu-right',
      Array.from(
        { length: rows.length - 1 },
        (_, offset) => rows[(index + offset + 1) % rows.length].element.id,
      ).join(' '),
    );
  }
  const EventType = document.defaultView?.Event ?? globalThis.Event;
  if (EventType) root.dispatchEvent(new EventType('game-mode-choices-ready', { bubbles: true }));
  const refresh = (locale) => {
    const labels = copy[locale] ?? copy.en;
    root.setAttribute('aria-label', labels.mode);
    for (const { id, element, label } of rows) {
      label.textContent = labels[id];
      const players = id === 'solo' ? '1P ' : ['team', 'versus'].includes(id) ? '2P ' : '';
      element.setAttribute(
        'aria-label',
        `${players}${labels[id]}${id === 'simulator' ? ' beta' : ''}`,
      );
    }
  };
  refresh(locale);
  return { choices: Object.fromEntries(rows.map(({ id, element }) => [id, element])), refresh };
}
