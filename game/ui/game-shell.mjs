import { attachModalNavigation } from './modal-navigation.mjs';
import { attachFieldKitSurfaces } from './field-kit-surfaces.mjs';
import { fieldKitCopy } from './field-kit-copy.mjs';

/** Game navigation owns presentation only; the host owns pause, save and start. */
export function attachGameShell({
  document: doc = globalThis.document,
  pause,
  canContinue,
  initial = true,
  training = false,
  onFeatured,
  onWorlds,
  getTopDialog,
  focusMissions,
  focusBriefing,
  focusGame = () => doc.getElementById('start-button')?.focus(),
} = {}) {
  const $ = (id) => doc.getElementById(id);
  const copy = (key, values) => fieldKitCopy(key, doc.documentElement?.lang || 'en', values);
  const home = $('shell-home'),
    missions = $('shell-missions'),
    workshop = $('shell-workshop-dialog');
  if (!home || !missions) return null;
  let destroyed = false,
    returnToHome = false;
  const modalNavigation = getTopDialog ? null : attachModalNavigation({ document: doc });
  const topDialog = getTopDialog ?? modalNavigation.topDialog;
  const surfaces = attachFieldKitSurfaces({ document: doc });
  const deck = doc.querySelector('.flight-deck');
  if (deck) $('shell-mission-content').append(deck);
  doc.body.classList.add('game-shell');
  const closeHome = () => {
    if (workshop?.open) workshop.close();
    if (home.open) home.close();
  };
  const syncPreparation = () => {
    const selected = $('missions')?.querySelector('.selected');
    const available = !!selected && !selected.disabled && !$('pack-select')?.disabled;
    const start = $('start-button');
    if ($('shell-deploy'))
      $('shell-deploy').disabled = !available || start.hidden || start.disabled;
    if ($('shell-prepared-mission'))
      $('shell-prepared-mission').textContent =
        selected?.querySelector('.name')?.textContent || copy('missions.chooseAvailable');
  };
  let briefing = null;
  const restoreMissionView = () => {
    if (!briefing) return;
    const { brief, unit, marker, open, title, context } = briefing;
    briefing = null;
    marker.after(unit);
    marker.remove();
    brief.open = open;
    $('shell-brief-content').hidden = true;
    $('shell-mission-content').hidden = false;
    $('shell-briefing').hidden = false;
    if ($('shell-deploy-bar')) $('shell-deploy-bar').hidden = false;
    if ($('shell-mode-choice')) $('shell-mode-choice').hidden = training;
    $('shell-missions-title').textContent = title;
    if ($('shell-missions-context')) $('shell-missions-context').textContent = context;
    delete missions.dataset.view;
  };
  const closedMissions = () => {
    // Native close events may arrive after a new showModal. Do not dismantle
    // the current reading view because a previous close was queued.
    if (!missions.open) restoreMissionView();
  };
  missions.addEventListener('close', closedMissions);
  const openMissions = () => {
    returnToHome = home.open;
    pause(true);
    restoreMissionView();
    closeHome();
    if (!missions.open) missions.showModal();
    syncPreparation();
    if (!focusMissions?.()) $('pack-select').focus();
  };
  const openHome = () => {
    pause(true);
    if (missions.open) missions.close();
    restoreMissionView();
    const continued = !training && canContinue();
    $('shell-continue').hidden = !continued;
    if ($('shell-featured')) $('shell-featured').hidden = training || continued;
    if ($('shell-destination'))
      $('shell-destination').textContent = training
        ? copy('title.trainingDestination')
        : continued
          ? copy('title.continueDestination', {
              destination: !$('continue-saved').hidden
                ? $('continue-saved').title
                : $('mission-brief-title').textContent,
            })
          : copy('title.deployDestination');
    if (!home.open) home.showModal();
    (training
      ? $('shell-course-return')
      : canContinue()
        ? $('shell-continue')
        : $('shell-featured') || $('shell-play')
    ).focus();
  };
  const forward = (source, target, { keepHome = false } = {}) => {
    $(source).onclick = () => {
      // Child screens retain their actual entry screen and opener. Explicit
      // selection actions leave those parents when choosing a flight.
      if (!keepHome) closeHome();
      $(target).click();
    };
  };
  $('shell-menu').onclick = openHome;
  if ($('shell-workshop'))
    $('shell-workshop').onclick = () => {
      pause(true);
      workshop?.showModal();
      workshop?.querySelector('button,a')?.focus();
    };
  if ($('shell-missions-back'))
    $('shell-missions-back').onclick = () => {
      if (!briefing && returnToHome) openHome();
      else {
        missions.close();
        focusGame();
      }
    };
  const overlayMenu = $('overlay-menu');
  if (overlayMenu) overlayMenu.onclick = () => $('shell-menu').click();
  const worlds = $('shell-worlds');
  if (worlds) {
    worlds.hidden = training || !onWorlds;
    worlds.onclick = () => {
      pause(true);
      closeHome();
      if (missions.open) missions.close();
      onWorlds?.();
    };
  }
  const overlayBrief = $('overlay-brief');
  if (overlayBrief)
    overlayBrief.onclick = () => {
      returnToHome = false;
      pause(true);
      closeHome();
      const brief = $('mission-brief'),
        unit = $('mission-brief-unit'),
        slot = $('shell-brief-content');
      if (brief && unit && slot && !briefing) {
        const marker = doc.createElement('span');
        marker.hidden = true;
        briefing = {
          brief,
          unit,
          marker,
          open: brief.open,
          title: $('shell-missions-title').textContent,
          context: $('shell-missions-context')?.textContent,
        };
        unit.after(marker);
        slot.append(unit);
        slot.hidden = false;
        $('shell-mission-content').hidden = true;
        $('shell-briefing').hidden = true;
        if ($('shell-deploy-bar')) $('shell-deploy-bar').hidden = true;
        if ($('shell-mode-choice')) $('shell-mode-choice').hidden = true;
        missions.dataset.view = 'brief';
        $('shell-missions-title').textContent =
          $('mission-brief-title').textContent || copy('missions.brief');
        if ($('shell-missions-context'))
          $('shell-missions-context').textContent = copy('missions.briefContext', {
            edition: $('shell-edition')?.textContent || copy('missions.currentFlight'),
          });
        missions.scrollTop = 0;
        $('mission-brief-reading').scrollTop = 0;
      }
      if (brief) brief.open = true;
      if (!missions.open) missions.showModal();
      if (!focusBriefing?.()) $('mission-brief-read')?.focus({ preventScroll: true });
    };
  $('shell-packs').onclick = openMissions;
  $('shell-play').onclick = openMissions;
  const featured = $('shell-featured');
  if (featured && onFeatured)
    featured.onclick = async () => {
      pause(true);
      featured.disabled = true;
      try {
        if (await onFeatured()) {
          openMissions();
        }
      } finally {
        featured.disabled = false;
      }
    };
  $('shell-briefing').onclick = () => {
    missions.close();
    focusGame();
  };
  if ($('shell-prepare'))
    $('shell-prepare').onclick = () => {
      const setup = $('mission-picker-setup');
      if (!setup) return;
      setup.open = true;
      setup.scrollIntoView({ block: 'start', behavior: 'instant' });
      (setup.querySelector('select:not(:disabled)') || setup.querySelector('summary'))?.focus({
        preventScroll: true,
      });
    };
  if ($('shell-deploy'))
    $('shell-deploy').onclick = () => {
      syncPreparation();
      if ($('shell-deploy').disabled) return;
      missions.close();
      $('start-button').click();
      focusGame();
    };
  const Observer = doc.defaultView?.MutationObserver ?? globalThis.MutationObserver;
  const preparationObserver = typeof Observer === 'function' ? new Observer(syncPreparation) : null;
  for (const source of [$('missions'), $('pack-select'), $('start-button')])
    if (source) preparationObserver?.observe(source, { childList: true, attributes: true });
  $('shell-continue').onclick = () => {
    closeHome();
    // Loading is explicit and verified by the existing host. An in-memory
    // paused flight returns to its briefing; choosing Resume remains deliberate.
    if (!$('continue-saved').hidden) $('continue-saved').click();
    else focusGame();
  };
  forward('shell-collection', 'collection-button', { keepHome: true });
  forward('shell-gallery', 'collection-button', { keepHome: true });
  forward('shell-settings', 'settings-button', { keepHome: true });
  forward('shell-library', 'library-button');
  forward('shell-options', 'settings-button', { keepHome: true });
  // Toggle music without leaving the title; browser activation remains local.
  $('shell-music').onclick = () => $('sound-button').click();
  forward('shell-help', 'help-button');
  // Keep Workshop beneath its Guide so native modal return restores the visible opener.
  const courseReturn = $('shell-course-return');
  if (courseReturn) {
    courseReturn.hidden = !training;
    courseReturn.onclick = () => {
      closeHome();
      focusGame();
    };
  }
  if (training) {
    // Course sessions keep their usable sound/help shortcuts in the lesson menu.
    home.querySelector('.home-actions')?.append($('shell-music'), $('shell-help'));
    // These destinations cannot operate on the course's isolated, non-awarding
    // session. Show only usable settings and the explicit lesson return.
    for (const id of [
      'shell-featured',
      'shell-play',
      'shell-library',
      'shell-gallery',
      'shell-guide',
      'shell-workshop',
    ])
      $(id).hidden = true;
    for (const element of doc.querySelectorAll('.home-actions a, .shell-tools'))
      element.hidden = true;
  }
  const cancelHome = () =>
    queueMicrotask(() => {
      if (!destroyed && !home.open && !topDialog()) focusGame();
    });
  home.addEventListener('cancel', cancelHome);
  // Native controls retain their arrow editing semantics. Arrows on game menu
  // actions move focus; Enter/Space and Tab remain browser-standard activation.
  const keydown = (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    const dialog = topDialog();
    if (!dialog || !event.target?.closest?.('button,a')) return;
    const controls = [...dialog.querySelectorAll('button,a,select,input,summary')].filter(
      (element) =>
        !element.disabled &&
        !element.hidden &&
        !element.closest('[hidden]') &&
        (typeof element.getClientRects !== 'function' || element.getClientRects().length > 0),
    );
    if (!controls.length) return;
    const index = controls.indexOf(doc.activeElement);
    const delta = ['ArrowUp', 'ArrowLeft'].includes(event.key) ? -1 : 1;
    controls[(index + delta + controls.length) % controls.length].focus();
    event.preventDefault();
  };
  doc.addEventListener('keydown', keydown);
  if (initial) openHome();
  return {
    openHome,
    openMissions,
    destroy() {
      destroyed = true;
      restoreMissionView();
      missions.removeEventListener('close', closedMissions);
      if (overlayMenu) overlayMenu.onclick = null;
      if (overlayBrief) overlayBrief.onclick = null;
      home.removeEventListener('cancel', cancelHome);
      doc.removeEventListener('keydown', keydown);
      modalNavigation?.destroy();
      surfaces.destroy();
      preparationObserver?.disconnect();
    },
  };
}
