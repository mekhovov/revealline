import { nativeArtReviewURL } from './art-review-navigation.mjs';
import { t, localizedText, localizedAttribute, getLocale } from '../i18n/index.mjs';
import { setMenuIcon } from './native-menu-icons.mjs';
import { mountOptionalPracticePanel } from './optional-practice-panel.mjs';
import { fpvWorldLaunchURL, snakeLaunchURL } from '../fpv-entry.mjs';
import { loadAcceptedAppearance } from '../presentation/theme-system.mjs';
const MODES = Object.freeze([['solo'], ['versus'], ['team']]);

export function contextualAppearance(document) {
  let accepted = null;
  try {
    accepted = loadAcceptedAppearance((document.defaultView ?? globalThis).sessionStorage);
  } catch {
    /* Denied storage still permits an explicit compiled appearance pin. */
  }
  const data = document.documentElement.dataset;
  const compiled =
    /^[a-z][a-z0-9-]{0,63}$/.test(data.appearanceFamily ?? '') &&
    /^r[1-9][0-9]{0,8}$/.test(data.appearanceRevision ?? '')
      ? { familyId: data.appearanceFamily, revision: data.appearanceRevision }
      : null;
  const pin =
    compiled ??
    (accepted ? { familyId: accepted.family.id, revision: accepted.family.revision } : null);
  return pin ? { ...pin, appearanceThemes: accepted ? [accepted] : [] } : null;
}

/** Shared presentation only. Existing anchors keep their hrefs and listeners. */
export function mountModeChoices({
  root,
  current,
  actions,
  separateTeam = false,
  pause = () => {},
  getAppearanceDefault = () => contextualAppearance(root.ownerDocument),
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
  const snake = document.createElement('a');
  snake.id = `${current}-snake`;
  snake.dataset.snakeEntry = 'true';
  const snakeLabel = document.createElement('strong');
  localizedText(snakeLabel, () => (getLocale() === 'uk' ? 'Змійка' : 'Snake'));
  snake.append(snakeLabel);
  setMenuIcon(snake, 'controls');
  const snakeURL = () =>
    snakeLaunchURL(
      document.defaultView?.location?.href ?? globalThis.location?.href,
      current,
      document.documentElement.lang,
      getAppearanceDefault(),
    );
  const initialSnakeURL = snakeLaunchURL(
    document.defaultView?.location?.href ?? globalThis.location?.href,
    current,
    document.documentElement.lang,
  );
  if (initialSnakeURL) snake.href = initialSnakeURL;
  else snake.hidden = true;
  const enterSnake = (event) => {
    const href = snakeURL();
    if (!href) return event.preventDefault();
    snake.href = href;
    pause();
  };
  snake.addEventListener('click', enterSnake);
  root.replaceChildren(...choices, simulator, snake);
  const destinations = document.createElement('details');
  destinations.className = 'game-mode-destinations';
  const summary = document.createElement('summary');
  localizedText(summary, () =>
    getLocale() === 'uk' ? 'Ще режими та посібники' : 'More modes and guides',
  );
  destinations.append(summary);
  const closeMore = () => {
    if (!destinations.open || !destinations.contains(document.activeElement)) return false;
    destinations.open = false;
    summary.focus({ preventScroll: true });
    return true;
  };
  const backFromMore = (event) => {
    if (event.key !== 'Escape' || event.defaultPrevented || !closeMore()) return;
    event.preventDefault();
    event.stopPropagation();
  };
  destinations.addEventListener('keydown', backFromMore);
  for (const [path, en, uk] of [
    ['../snake/', 'Snake campaign guide', 'Посібник кампаній Snake'],
    ['../hunt/', 'New pursuit campaigns', 'Нові кампанії переслідування'],
    ['../online/', 'Private rooms preview', 'Приватні кімнати'],
  ]) {
    const link = document.createElement('a');
    const sourceHref = document.defaultView?.location?.href ?? globalThis.location?.href;
    link.href = nativeArtReviewURL(new URL(path, import.meta.url).href, sourceHref);
    localizedText(link, () => (getLocale() === 'uk' ? uk : en));
    link.addEventListener('click', () => {
      const target = new URL(link.href);
      target.searchParams.set('lang', getLocale());
      link.href = nativeArtReviewURL(target.href, sourceHref);
      pause();
    });
    destinations.append(link);
  }
  root.append(destinations);
  const panel = mountOptionalPracticePanel({
    document,
    getAppearanceDefault,
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
    preferDirect: true,
    timeoutMs: 4000,
  });
  if (!panel.open) {
    simulator.disabled = true;
    localizedAttribute(simulator, 'title', () => t('interface:optionalPractice.simBrowserOnly'));
  }
  return {
    closeMore,
    openSimulator: panel.open,
    simulatorRoot: () => panel.root?.() ?? null,
    simulatorPrimary: () => panel.primary?.() ?? simulator,
    closeSimulator: () => panel.close?.(),
    dispose() {
      panel.dispose();
      simulator.remove();
      destinations.removeEventListener('keydown', backFromMore);
      destinations.remove();
      snake.removeEventListener('click', enterSnake);
      snake.remove();
    },
  };
}
