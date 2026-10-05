import { nativeArtReviewURL } from './art-review-navigation.mjs';
import { t, localizedText, localizedAttribute, getLocale, onLocaleChange } from '../i18n/index.mjs';
import { setMenuIcon } from './native-menu-icons.mjs';
import { mountOptionalPracticePanel } from './optional-practice-panel.mjs';
import { fpvWorldLaunchURL, snakeLaunchURL } from '../fpv-entry.mjs';
import { loadAcceptedAppearance } from '../presentation/theme-system.mjs';
import { GAME_MODE_ORDER, renderModeChoices } from './mode-choice-view.mjs';
const guideOwners = new WeakMap();

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
  guidesContainer = null,
  pause = () => {},
  getAppearanceDefault = () => contextualAppearance(root.ownerDocument),
}) {
  if (!root || !GAME_MODE_ORDER.includes(current))
    throw new Error(t('interface:aGameModeAndItsVisibleNavigationContainerAreRequired'));
  const document = root.ownerDocument;
  const modeActions = { ...actions };
  for (const id of ['solo', 'team', 'versus']) {
    if (id !== current && modeActions[id]?.tagName !== 'A')
      throw new Error(`The existing ${id} mode link is required.`);
  }
  const selected = document.createElement('button');
  selected.type = 'button';
  selected.id = `${current}-current-mode`;
  modeActions[current] = selected;
  // A simulator destination is not an arcade ruleset or Journey mode.
  const simulator = modeActions.simulator ?? document.createElement('button');
  simulator.type = 'button';
  simulator.id ||= `${current}-fpv-sim`;
  simulator.dataset.simulatorEntry = 'true';
  const snake = modeActions.snake ?? document.createElement('a');
  snake.id ||= `${current}-snake`;
  snake.dataset.snakeEntry = 'true';
  const snakeURL = () =>
    snakeLaunchURL(
      document.defaultView?.location?.href ?? globalThis.location?.href,
      ['solo', 'team', 'versus'].includes(current) ? current : 'solo',
      document.documentElement.lang,
      getAppearanceDefault(),
    );
  const initialSnakeURL = snakeLaunchURL(
    document.defaultView?.location?.href ?? globalThis.location?.href,
    ['solo', 'team', 'versus'].includes(current) ? current : 'solo',
    document.documentElement.lang,
  );
  if (current !== 'snake') {
    if (initialSnakeURL) snake.href = initialSnakeURL;
    else if (!snake.href) snake.hidden = true;
  }
  const enterSnake = (event) => {
    const href = snakeURL();
    if (!href) return event.preventDefault();
    snake.href = href;
    pause();
  };
  if (current !== 'snake') snake.addEventListener('click', enterSnake);
  const view = renderModeChoices({
    root,
    current,
    actions: { ...modeActions, simulator, snake },
    locale: getLocale(),
    setMenuIcon,
  });
  const unsubscribeLocale = onLocaleChange(() => view.refresh(getLocale()));
  const guides = mountModeGuides({
    container: guidesContainer ?? document.querySelector('.native-settings [id$="-panel-extras"]'),
    document,
    pause,
  });
  const simulatorHref = fpvWorldLaunchURL(
    document.defaultView?.location?.href ?? globalThis.location?.href,
    document.documentElement.lang,
  );
  const simulatorHome = simulatorHref ? new URL(simulatorHref) : null;
  // Mode switching always enters Home. Deep links such as #learn remain
  // available to lesson/mission entry points that deliberately request them.
  if (simulatorHome) simulatorHome.hash = '';
  const panel =
    current === 'simulator' || simulator.tagName === 'A'
      ? null
      : mountOptionalPracticePanel({
          document,
          getAppearanceDefault,
          container: root,
          opener: simulator,
          pause,
          href: document.defaultView?.location?.href ?? globalThis.location?.href,
          bundledHref: simulatorHome?.href ?? null,
          packageId: 'fpv-worlds',
          idPrefix: `${current}-fpv-sim`,
          preferDirect: true,
          timeoutMs: 4000,
        });
  if (panel && !panel.open) {
    simulator.disabled = true;
    localizedAttribute(simulator, 'title', () => t('interface:optionalPractice.simBrowserOnly'));
  }
  return {
    closeMore: () =>
      guides.closeMore() ||
      guideOwners
        .get(document.querySelector('.native-settings [id$="-panel-extras"]'))
        ?.closeMore() ||
      false,
    openSimulator: panel?.open,
    simulatorRoot: () => panel?.root?.() ?? null,
    simulatorPrimary: () => panel?.primary?.() ?? simulator,
    closeSimulator: () => panel?.close?.(),
    dispose() {
      unsubscribeLocale();
      panel?.dispose();
      guides.dispose();
      snake.removeEventListener('click', enterSnake);
      snake.remove();
      simulator.remove();
    },
  };
}

/** Secondary discovery belongs in Settings → Help & Extras on every host. */
export function mountModeGuides({
  container,
  document = container?.ownerDocument,
  pause = () => {},
}) {
  if (!container || !document) return { closeMore: () => false, dispose() {} };
  if (guideOwners.has(container)) return guideOwners.get(container);

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
  container.append(destinations);
  const owner = {
    closeMore,
    dispose() {
      destinations.removeEventListener('keydown', backFromMore);
      destinations.remove();
      guideOwners.delete(container);
    },
  };
  guideOwners.set(container, owner);
  return owner;
}
