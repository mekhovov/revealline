import { t, localizedText, localizedMessage, localizedAttribute } from '../i18n/index.mjs';
const MODES = Object.freeze([
  ['solo', localizedMessage('interface:solo2'), localizedMessage('interface:onePlayer')],
  ['versus', localizedMessage('interface:versus2'), localizedMessage('interface:twoRivalBoards')],
  ['team', localizedMessage('interface:team'), localizedMessage('interface:oneSharedArena')],
]);

/** Shared presentation only. Existing anchors keep their hrefs and listeners. */
export function mountModeChoices({ root, current, actions, separateTeam = false }) {
  if (!root || !MODES.some(([id]) => id === current))
    throw new Error(t('interface:aGameModeAndItsVisibleNavigationContainerAreRequired'));
  const document = root.ownerDocument;
  for (const [id] of MODES) {
    if (id !== current && actions?.[id]?.tagName !== 'A')
      throw new Error(`The existing ${id} mode link is required.`);
  }
  const choices = MODES.map(([id, title, detail]) => {
    const selected = id === current;
    const element = selected ? document.createElement('span') : actions[id];
    const label = document.createElement('strong');
    localizedText(label, () => title);
    const description = document.createElement('span');
    description.className = 'game-mode-description';
    localizedText(description, () =>
      separateTeam && id === 'team' ? t('interface:separateTeamArenas') : detail,
    );
    element.replaceChildren(label, description);
    element.dataset.gameMode = id;
    if (selected) element.setAttribute('aria-current', 'page');
    return element;
  });
  root.classList.add('game-mode-choice');
  localizedAttribute(root, 'aria-label', () => t('interface:gameMode'));
  root.replaceChildren(...choices);
}
