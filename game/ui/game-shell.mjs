import { attachModalNavigation } from './modal-navigation.mjs';

/** Game navigation owns presentation only; the host owns pause, save and start. */
export function attachGameShell({
  document: doc = globalThis.document,
  pause,
  canContinue,
  initial = true,
  onFeatured,
  getTopDialog,
} = {}) {
  const $ = (id) => doc.getElementById(id);
  const home = $('shell-home'),
    missions = $('shell-missions');
  if (!home || !missions) return null;
  const modalNavigation = getTopDialog ? null : attachModalNavigation({ document: doc });
  const topDialog = getTopDialog ?? modalNavigation.topDialog;
  const deck = doc.querySelector('.flight-deck');
  if (deck) $('shell-mission-content').append(deck);
  doc.body.classList.add('game-shell');
  const closeHome = () => {
    if (home.open) home.close();
  };
  const openMissions = () => {
    pause(true);
    closeHome();
    if (!missions.open) missions.showModal();
    $('pack-select').focus();
  };
  const openHome = () => {
    pause(true);
    if (missions.open) missions.close();
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
          $('start-button').focus();
        }
      } finally {
        featured.disabled = false;
      }
    };
  $('shell-briefing').onclick = () => {
    missions.close();
    $('start-button').focus();
  };
  $('shell-continue').onclick = () => {
    closeHome();
    // Loading is explicit and verified by the existing host. An in-memory
    // paused flight returns to its briefing; choosing Resume remains deliberate.
    if (!$('continue-saved').hidden) $('continue-saved').click();
    else $('start-button').focus();
  };
  forward('shell-collection', 'collection-button');
  forward('shell-settings', 'settings-button');
  forward('shell-library', 'library-button');
  forward('shell-options', 'settings-button');
  // Toggle music without leaving the title; browser activation remains local.
  $('shell-music').onclick = () => $('sound-button').click();
  forward('shell-help', 'help-button');
  home.addEventListener('cancel', () => $('start-button').focus());
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
      doc.removeEventListener('keydown', keydown);
      modalNavigation?.destroy();
    },
  };
}
