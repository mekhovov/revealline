import { attachModalNavigation } from './modal-navigation.mjs';

/** Game navigation owns presentation only; the host owns pause, save and start. */
export function attachGameShell({
  document: doc = globalThis.document,
  pause,
  canContinue,
  initial = true,
  onFeatured,
  onWorlds,
  getTopDialog,
  focusMissions,
  focusBriefing,
  focusGame = () => doc.getElementById('start-button')?.focus(),
} = {}) {
  const $ = (id) => doc.getElementById(id);
  const home = $('shell-home'),
    missions = $('shell-missions');
  if (!home || !missions) return null;
  let destroyed = false;
  const modalNavigation = getTopDialog ? null : attachModalNavigation({ document: doc });
  const topDialog = getTopDialog ?? modalNavigation.topDialog;
  const deck = doc.querySelector('.flight-deck');
  if (deck) $('shell-mission-content').append(deck);
  doc.body.classList.add('game-shell');
  const closeHome = () => {
    if (home.open) home.close();
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
    pause(true);
    restoreMissionView();
    closeHome();
    if (!missions.open) missions.showModal();
    if (!focusMissions?.()) $('pack-select').focus();
  };
  const openHome = () => {
    pause(true);
    if (missions.open) missions.close();
    restoreMissionView();
    $('shell-continue').hidden = !canContinue();
    if (!home.open) home.showModal();
    (canContinue() ? $('shell-continue') : $('shell-play')).focus();
  };
  const forward = (source, target) => {
    $(source).onclick = () => {
      closeHome();
      $(target).click();
    };
  };
  $('shell-menu').onclick = openHome;
  const overlayMenu = $('overlay-menu');
  if (overlayMenu) overlayMenu.onclick = () => $('shell-menu').click();
  const worlds = $('shell-worlds');
  if (worlds) {
    worlds.hidden = !onWorlds;
    worlds.onclick = () => {
      pause(true);
      closeHome();
      onWorlds?.();
    };
  }
  const overlayBrief = $('overlay-brief');
  if (overlayBrief)
    overlayBrief.onclick = () => {
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
        missions.dataset.view = 'brief';
        $('shell-missions-title').textContent =
          $('mission-brief-title').textContent || 'Mission brief';
        if ($('shell-missions-context'))
          $('shell-missions-context').textContent =
            `${$('shell-edition')?.textContent || 'CURRENT FLIGHT'} · MISSION BRIEF`;
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
          closeHome();
          focusGame();
        }
      } finally {
        featured.disabled = false;
      }
    };
  $('shell-briefing').onclick = () => {
    missions.close();
    focusGame();
  };
  $('shell-continue').onclick = () => {
    closeHome();
    // Loading is explicit and verified by the existing host. An in-memory
    // paused flight returns to its briefing; choosing Resume remains deliberate.
    if (!$('continue-saved').hidden) $('continue-saved').click();
    else focusGame();
  };
  forward('shell-collection', 'collection-button');
  forward('shell-gallery', 'collection-button');
  forward('shell-settings', 'settings-button');
  forward('shell-library', 'library-button');
  forward('shell-options', 'settings-button');
  // Toggle music without leaving the title; browser activation remains local.
  $('shell-music').onclick = () => $('sound-button').click();
  forward('shell-help', 'help-button');
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
    },
  };
}
