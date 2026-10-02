import { t, localizedText, localizedAttribute } from '../i18n/index.mjs';
import { setMenuIcon } from './native-menu-icons.mjs';
import { mountOptionalPracticePanel } from './optional-practice-panel.mjs';
import { fpvWorldLaunchURL } from '../fpv-entry.mjs';
const MODES = Object.freeze([['solo'], ['versus'], ['team']]);

/** Shared presentation only. Existing anchors keep their hrefs and listeners. */
export function mountModeChoices({
  root,
  current,
  actions,
  separateTeam = false,
  pause = () => {},
}) {
  if (!root || !MODES.some(([id]) => id === current))
    throw new Error(t('interface:aGameModeAndItsVisibleNavigationContainerAreRequired'));
  const document = root.ownerDocument;
  for (const [id] of MODES) {
    if (id !== current && actions?.[id]?.tagName !== 'A')
      throw new Error(`The existing ${id} mode link is required.`);
  }
  const choices = MODES.map(([id]) => {
    const selected = id === current;
    const element = selected ? document.createElement('button') : actions[id];
    if (selected) {
      element.type = 'button';
      element.id = `${current}-current-mode`;
    }
    element.removeAttribute('data-i18n');
    const label = document.createElement('strong');
    localizedText(label, () => t(`interface:nativeMenu.${id}`));
    element.replaceChildren(label);
    setMenuIcon(element, id);
    element.dataset.gameMode = id;
    if (selected) element.setAttribute('aria-current', 'page');
    return element;
  });
  root.classList.add('game-mode-choice');
  root.dataset.menuLayout = 'horizontal';
  root.dataset.menuScope = 'modes';
  localizedAttribute(root, 'aria-label', () => t('common:game.mode'));
  // A simulator destination is not an arcade ruleset or Journey mode.
  const simulator = document.createElement('button');
  simulator.type = 'button';
  simulator.id = `${current}-fpv-sim`;
  simulator.dataset.simulatorEntry = 'true';
  const simulatorLabel = document.createElement('strong');
  localizedText(simulatorLabel, () => t('interface:nativeMenu.fpvSim'));
  simulator.append(simulatorLabel);
  setMenuIcon(simulator, 'simulator');
  root.replaceChildren(...choices, simulator);
  const panel = mountOptionalPracticePanel({
    document,
    container: root,
    opener: simulator,
    pause,
    href: document.defaultView?.location?.href ?? globalThis.location?.href,
    bundledHref: fpvWorldLaunchURL(
      document.defaultView?.location?.href ?? globalThis.location?.href,
      document.documentElement.lang,
    ),
    packageId: 'fpv-worlds',
    idPrefix: `${current}-fpv-sim`,
  });
  if (!panel.open) {
    simulator.disabled = true;
    localizedAttribute(simulator, 'title', () => t('interface:optionalPractice.simBrowserOnly'));
  }
  return {
    openSimulator: panel.open,
    simulatorRoot: () => panel.root?.() ?? null,
    simulatorPrimary: () => panel.primary?.() ?? simulator,
    closeSimulator: () => panel.close?.(),
    dispose() {
      panel.dispose();
      simulator.remove();
    },
  };
}
