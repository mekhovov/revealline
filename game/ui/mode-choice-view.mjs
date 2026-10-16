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
    versus: 'Duel',
    snake: 'Snake',
    overflight: 'FPV Survivals',
    simulator: 'SIM',
    mode: 'Game mode',
    more: 'More',
    less: 'Less',
  },
  uk: {
    solo: 'Соло',
    team: 'Разом',
    versus: 'Дуель',
    snake: 'Змійка',
    overflight: 'FPV Survivals',
    simulator: 'SIM',
    mode: 'Режим гри',
    more: 'Ще',
    less: 'Згорнути',
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
      if (['solo', 'team', 'versus', 'overflight', 'simulator'].includes(id)) {
        const badge = document.createElement('small');
        badge.className = 'game-mode-badge';
        badge.textContent = ['simulator', 'overflight'].includes(id)
          ? 'beta'
          : id === 'solo'
            ? '1P'
            : '2P';
        badge.setAttribute('aria-hidden', 'true');
        element.append(badge);
      }
      setMenuIcon(element, id);
      return { id, element, label, available: !element.hidden };
    },
  );
  const primary = rows.filter(({ id }) => ['solo', 'team', 'versus'].includes(id));
  const secondary = rows.filter((row) => !primary.includes(row));
  const more = document.createElement('button');
  more.type = 'button';
  more.id = `${root.id || current + '-modes'}-more`;
  more.dataset.modeMore = 'true';
  more.setAttribute('aria-controls', secondary.map(({ element }) => element.id).join(' '));
  const moreLabel = document.createElement('strong');
  more.append(moreLabel);
  setMenuIcon(more, 'more');
  let language = locale;
  let expanded = secondary.some(({ id }) => id === current);
  const emit = (name) => {
    const EventType = document.defaultView?.Event ?? globalThis.Event;
    if (EventType) root.dispatchEvent(new EventType(name, { bubbles: true }));
  };
  const horizontal = (elements) => {
    for (const [index, element] of elements.entries()) {
      for (const [direction, delta] of [
        ['left', -1],
        ['right', 1],
      ])
        element.setAttribute(
          `data-menu-${direction}`,
          Array.from(
            { length: elements.length - 1 },
            (_, offset) =>
              elements[
                (index + delta * (offset + 1) + elements.length * elements.length) % elements.length
              ].id,
          ).join(' '),
        );
    }
  };
  const refreshLayout = () => {
    root.dataset.modesExpanded = String(expanded);
    root.style.setProperty('--game-mode-count', expanded ? '3' : '4');
    more.setAttribute('aria-expanded', String(expanded));
    moreLabel.textContent = (copy[language] ?? copy.en)[expanded ? 'less' : 'more'];
    for (const { element, available } of secondary) element.hidden = !expanded || !available;
    // Follow visual reading order across the two rows, then the disclosure.
    horizontal([...(expanded ? rows : primary).map(({ element }) => element), more]);
  };
  const close = (force = false) => {
    if (!expanded || (!force && !root.contains(document.activeElement))) return false;
    expanded = false;
    refreshLayout();
    emit('game-mode-visibility-changed');
    more.focus({ preventScroll: true });
    return true;
  };
  const toggle = () => {
    if (expanded) return close(true);
    expanded = true;
    refreshLayout();
    emit('game-mode-visibility-changed');
    const available = secondary.filter(({ element }) => !element.disabled && !element.hidden);
    (available.find(({ id }) => id === current)?.element ?? available[0]?.element ?? more).focus({
      preventScroll: true,
    });
  };
  const keydown = (event) => {
    if (event.key !== 'Escape' || !expanded) return;
    event.preventDefault();
    event.stopPropagation();
    close();
  };
  more.addEventListener('click', toggle);
  root.addEventListener('keydown', keydown);
  root.classList.add('game-mode-choice');
  root.dataset.menuLayout = 'horizontal';
  root.dataset.menuScope = 'modes';
  root.replaceChildren(...rows.map(({ element }) => element), more);
  const refresh = (locale) => {
    language = locale;
    const labels = copy[locale] ?? copy.en;
    root.setAttribute('aria-label', labels.mode);
    for (const { id, element, label } of rows) {
      label.textContent = labels[id];
      const players = id === 'solo' ? '1P ' : ['team', 'versus'].includes(id) ? '2P ' : '';
      element.setAttribute(
        'aria-label',
        `${players}${labels[id]}${['simulator', 'overflight'].includes(id) ? ' beta' : ''}`,
      );
    }
    refreshLayout();
  };
  refresh(locale);
  emit('game-mode-choices-ready');
  return {
    choices: Object.fromEntries(rows.map(({ id, element }) => [id, element])),
    refresh,
    more,
    close,
    dispose() {
      more.removeEventListener('click', toggle);
      root.removeEventListener('keydown', keydown);
      more.remove();
    },
  };
}
