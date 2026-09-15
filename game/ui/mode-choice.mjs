const MODES = Object.freeze([
  ['solo', 'Solo', 'One player'],
  ['versus', 'Versus', 'Two rival boards'],
  ['team', 'Team', 'One shared arena'],
]);

/** Shared presentation only. Existing anchors keep their hrefs and listeners. */
export function mountModeChoices({ root, current, actions }) {
  if (!root || !MODES.some(([id]) => id === current))
    throw new Error('A game mode and its visible navigation container are required.');
  const document = root.ownerDocument;
  for (const [id] of MODES) {
    if (id !== current && actions?.[id]?.tagName !== 'A')
      throw new Error(`The existing ${id} mode link is required.`);
  }
  const choices = MODES.map(([id, title, detail]) => {
    const selected = id === current;
    const element = selected ? document.createElement('span') : actions[id];
    const label = document.createElement('strong');
    label.textContent = title;
    const description = document.createElement('span');
    description.className = 'game-mode-description';
    description.textContent = detail;
    element.replaceChildren(label, description);
    element.dataset.gameMode = id;
    if (selected) element.setAttribute('aria-current', 'page');
    return element;
  });
  root.classList.add('game-mode-choice');
  root.setAttribute('aria-label', 'Game mode');
  root.replaceChildren(...choices);
}
