import { contentText } from '../i18n/content.mjs';
import { localizedText, t } from '../i18n/index.mjs';
import { arcadeActionCapabilities } from '../core/arcade-actions.mjs';

const ABILITY = Object.freeze({
  get scan() { return t("interface:scan"); },
  get shield() { return t("interface:shield"); },
  get 'stun-field'() { return t("interface:stunField"); },
  get 'slow-field'() { return t("interface:slowField"); },
  get 'impact-pulse'() { return t("interface:impactPulse"); },
});
const SCREENS = Object.freeze({
  main: ['race-main', 'race-start'],
  setup: ['race-setup', 'race-level'],
  options: ['race-options-panel', 'race-touch-0'],
  help: ['race-help-panel', 'race-help-read'],
  confirm: ['race-confirm', 'race-confirm-back'],
  leave: ['race-leave-panel', 'race-leave-back'],
});
/** Display capabilities come from the actual authored level and equipped recipe. */
export function couchEquipment(run) {
  const actions = arcadeActionCapabilities(run.level),
    recipe = run.classRecipe;
  return Object.freeze({
    action: actions.manualAbility,
    pickup: actions.manualPickup && recipe.capacity > 0 && run.supplies.length > 0,
    boost: actions.manualBoost,
    label: ABILITY[recipe.primitive] || t("interface:ability"),
    description: actions.manualAbility
      ? recipe.description
      : t("interface:directionsOnlyPickupsActivateOnContact"),
  });
}

/** Presentation only: never steps, resumes, resets or replaces a duel itself. */
export function createCouchShell({
  document: doc = globalThis.document,
  coarse = false,
  onTransition = () => {},
  onNewMatch = () => {},
} = {}) {
  const $ = (id) => doc.getElementById(id),
    pads = [...doc.querySelectorAll('.race-pad')],
    preferences = ['auto', 'auto'],
    modality = [coarse ? 'touch' : 'keyboard', coarse ? 'touch' : 'keyboard'],
    shown = [false, false],
    removers = [];
  let screen = 'main',
    status = null,
    opener = null,
    destroyed = false,
    equipment = [];
  const setText = (id, text) => {
    if ($(id).textContent !== text) localizedText($(id), () =>text);
  };
  const listen = (element, type, fn) => {
    element.addEventListener(type, fn);
    removers.push(() => element.removeEventListener(type, fn));
  };
  function primary() {
    if (screen === 'main' && $('race-start').disabled) {
      const retry = $('race-chapter-retry');
      return retry && !retry.hidden && !retry.disabled ? retry : $('race-focus');
    }
    return screen === 'review' ? $('race-pause') : $(SCREENS[screen][1]);
  }
  function root() {
    return status === 'running' || screen === 'review' ? $('race-hud') : $(SCREENS[screen][0]);
  }
  function focus(element = primary()) {
    if (!destroyed && !element.disabled && !element.closest('[hidden],[inert]'))
      element.focus({ preventScroll: true });
  }
  function renderScreens() {
    const running = status === 'running' || screen === 'review';
    $('race-shell').hidden = running;
    $('race-shell').inert = running;
    $('race-hud').hidden = !running;
    $('race-pause').disabled = !running;
    localizedText($('race-pause'), () =>screen === 'review' ? t("interface:results2") : t("common:actions.pause"));
    $('race-boards').hidden = !running;
    $('race-boards').inert = !running;
    doc.body.classList.toggle('race-focus', running);
    doc.body.dataset.couchScreen = running ? 'flight' : screen;
    for (const [name, [id]] of Object.entries(SCREENS)) {
      $(id).hidden = running || name !== screen;
      $(id).inert = running || name !== screen;
    }
  }
  function renderPads() {
    for (let i = 0; i < 2; i++) {
      const wanted =
        preferences[i] === 'always' || (preferences[i] === 'auto' && modality[i] === 'touch');
      // A held physical control may not vanish mid-round. Collapse at pause,
      // after the host has called its existing clearPhysical lifecycle guard.
      shown[i] = status === 'running' && (wanted || shown[i]);
      pads[i].hidden = !shown[i];
      pads[i].inert = !shown[i];
      pads[i].closest('.racer').dataset.touch = String(shown[i]);
      const device =
        modality[i] === 'controller'
          ? t("interface:controller")
          : modality[i] === 'pointer'
            ? t("interface:onScreenControls")
            : modality[i] === 'touch'
              ? t("interface:touch")
              : i === 0
                ? t("interface:wASD")
                : t("interface:arrowKeys");
      setText(`race-seat-${i}`, device);
      setText(
        `racer-input-${i}`,
        `${device} · ${status === 'running' && shown[i] && !wanted ? t("interface:touchStaysVisibleUntilPause") : status === 'finished' ? t("interface:resultsForOptions") : t("interface:pauseForOptions")}`,
      );
      for (const button of pads[i].querySelectorAll('button')) {
        const kind = button.dataset.action;
        button.hidden = !!kind && !equipment[i]?.[kind];
        button.disabled = status !== 'running' || button.hidden;
        if (kind === 'action') localizedText(button, () =>contentText(equipment[i], 'label') || t("interface:ability"));
      }
    }
  }
  function show(next, { restore = null, remember = false } = {}) {
    if (destroyed || status === 'running' || (!Object.hasOwn(SCREENS, next) && next !== 'review'))
      return;
    if (remember) opener = remember === true ? doc.activeElement : remember;
    onTransition({ from: screen, to: next });
    screen = next;
    renderScreens();
    renderPads();
    focus(restore || primary());
  }
  function back() {
    if (screen === 'main') {
      onTransition({ from: screen, to: screen, back: true });
      return focus();
    }
    const target = opener;
    opener = null;
    show('main', { restore: target });
  }
  function setup() {
    show(status === 'ready' ? 'setup' : 'confirm', { remember: $('race-focus') });
  }
  listen($('race-focus'), 'click', setup);
  listen($('race-review'), 'click', () => {
    if (status === 'finished') show('review', { remember: $('race-review') });
  });
  listen($('race-options'), 'click', () => show('options', { remember: $('race-options') }));
  listen($('race-help'), 'click', () => show('help', { remember: $('race-help') }));
  for (const id of [
    'race-setup-back',
    'race-options-back',
    'race-help-back',
    'race-confirm-back',
    'race-leave-back',
  ])
    listen($(id), 'click', back);
  listen($('race-confirm-reset'), 'click', () => {
    if (status === 'running' || destroyed) return;
    onNewMatch();
    opener = $('race-focus');
    show('setup');
  });
  listen($('race-solo-return'), 'click', (event) => {
    event.preventDefault();
    show('leave', { remember: $('race-solo-return') });
  });
  for (let i = 0; i < 2; i++)
    listen($(`race-touch-${i}`), 'change', () => {
      if (status === 'running' || destroyed) return;
      const value = $(`race-touch-${i}`).value;
      if (!['auto', 'always', 'off'].includes(value)) return;
      onTransition();
      preferences[i] = value;
      renderPads();
    });
  function observe(player, source) {
    if (
      destroyed ||
      ![0, 1].includes(player) ||
      !['touch', 'keyboard', 'controller', 'pointer'].includes(source)
    )
      return;
    modality[player] = source;
    renderPads();
  }
  listen(doc, 'pointerdown', (event) => {
    // Touching the canvas is an explicit request to reveal Auto controls. Pad
    // gestures themselves are reported only after the input adapter accepts them.
    if (
      status !== 'running' ||
      event.pointerType !== 'touch' ||
      (event.button !== undefined && event.button !== 0)
    )
      return;
    const arena = event.target?.closest('.race-arena');
    const seat = arena?.closest('.racer');
    if (seat) observe(Number(seat.dataset.player), 'touch');
  });
  function update({ match, summary, won, contentBusy = false }) {
    if (destroyed) return;
    const previous = status;
    status = match.status;
    equipment = match.runs.map(couchEquipment);
    if (status !== previous) {
      if (status !== 'ready' || previous === null) screen = 'main';
      opener = null;
      renderScreens();
      if (previous !== null && status !== 'running') focus();
    }
    setText('race-summary', summary);
    setText(
      'race-title',
      contentBusy
        ? t("interface:loadingTheSharedPicture")
        : status === 'paused'
          ? t("interface:bothBoardsPaused")
          : status === 'finished'
            ? won.some((n) => n >= 2)
              ? t("interface:matchComplete")
              : t("interface:roundComplete")
            : t("interface:twoBoardsOneRace2"),
    );
    $('race-review').hidden = status !== 'finished';
    $('race-pause').disabled = status !== 'running' && screen !== 'review';
    localizedText($('race-pause'), () =>screen === 'review' ? t("interface:results2") : t("common:actions.pause"));
    localizedText($('race-focus'), () =>status === 'ready' ? t("interface:raceSetup") : t("interface:newMatchSetup"));
    $('race-class-field').hidden = !equipment[0].action;
    $('race-class').disabled = !equipment[0].action || status !== 'ready';
    for (const id of ['race-level', 'race-theme', 'race-turn', 'race-time'])
      $(id).disabled = status !== 'ready';
    $('race-tap-field').hidden = !equipment.some((e) => e.boost);
    $('race-tap').disabled = !equipment.some((e) => e.boost);
    setText('race-loadout', equipment[0].description);
    const controller = [t("interface:dPadOrLeftStickMove")];
    if (equipment[0].action) controller.push(t("gameplay:south", { value1: contentText(equipment[0], 'label') }));
    if (equipment[0].pickup) controller.push(t("interface:westSupply"));
    if (equipment[0].boost) controller.push('right shoulder: hold Boost');
    controller.push(t("interface:menuPause"));
    setText('race-controller-help', t("gameplay:controllers", { value1: controller.join(' · ') }));
    for (let i = 0; i < 2; i++) {
      const run = match.runs[i],
        e = equipment[i],
        hints = [i === 0 ? t("interface:wASDMove") : t("interface:arrowKeysMove")];
      if (e.action) hints.push(`${i === 0 ? 'Q' : t("interface:enter")}: ${e.label}`);
      if (e.pickup) hints.push(t("gameplay:supply", { value1: i === 0 ? 'E' : '/' }));
      if (e.boost) hints.push(t("gameplay:shiftHoldBoost", { value1: i === 0 ? 'left' : 'right' }));
      setText(`race-help-${i}`, `${hints.join(' · ')}.`);
      $(`race-result-${i}`).hidden = status !== 'finished';
      setText(
        `race-result-${i}`,
        t("gameplay:livesPointsRoundWins", { value1: (run.coverage * 100).toFixed(1), value2: run.lives, value3: run.score, value4: won[i] }),
      );
    }
    renderPads();
  }
  renderScreens();
  return {
    update,
    back,
    setup,
    observe,
    root,
    primary,
    focus,
    scope: () => screen,
    controllerHint: () => $('race-controller-help').textContent,
    destroy() {
      destroyed = true;
      for (const remove of removers) remove();
    },
  };
}
