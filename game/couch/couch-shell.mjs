import { mountModeChoices } from '../ui/mode-choice.mjs';
import { arcadeActionCapabilities } from '../core/arcade-actions.mjs';

const ABILITY = Object.freeze({
  scan: 'Scan',
  shield: 'Shield',
  'stun-field': 'Stun field',
  'slow-field': 'Slow field',
  'impact-pulse': 'Impact pulse',
});
const SCREENS = Object.freeze({
  main: ['race-main', 'race-start'],
  setup: ['race-setup', 'race-level'],
  options: ['race-options-panel', 'race-text-face'],
  help: ['race-help-panel', 'race-help-read'],
  confirm: ['race-confirm', 'race-confirm-back'],
  leave: ['race-leave-panel', 'race-leave-back'],
});
const DESTINATIONS = Object.freeze({ solo: '../', team: 'relay-rescue.html?return=versus' });
/** Display capabilities come from the actual authored level and equipped recipe. */
export function couchEquipment(run) {
  const actions = arcadeActionCapabilities(run.level),
    recipe = run.classRecipe;
  return Object.freeze({
    action: actions.manualAbility,
    pickup: actions.manualPickup && recipe.capacity > 0 && run.supplies.length > 0,
    boost: actions.manualBoost,
    label: ABILITY[recipe.primitive] || 'Ability',
    description: actions.manualAbility
      ? recipe.description
      : 'Directions only. Pickups activate on contact.',
  });
}

/** Presentation only: never steps, resumes, resets or replaces a duel itself. */
export function createCouchShell({
  document: doc = globalThis.document,
  coarse = false,
  onTransition = () => {},
  onNewMatch = () => {},
  getDepartureState = () => null,
  onLeaveRequest = () => {},
  getSoloReturnToken = () => null,
} = {}) {
  const $ = (id) => doc.getElementById(id),
    view = doc.defaultView,
    pads = [...doc.querySelectorAll('.race-pad')],
    preferences = ['auto', 'auto'],
    modality = [coarse ? 'touch' : 'keyboard', coarse ? 'touch' : 'keyboard'],
    shown = [false, false],
    removers = [];
  mountModeChoices({
    root: $('race-mode-choices'),
    current: 'versus',
    actions: { solo: $('race-solo-return'), team: $('race-coop') },
  });
  let screen = 'main',
    status = null,
    opener = null,
    departure = null,
    destroyed = false,
    revealingResize = false,
    equipment = [];
  const setText = (id, text) => {
    if ($(id).textContent !== text) $(id).textContent = text;
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
  function actionCurrent(element) {
    const owner = root(),
      previousScreen = screen,
      previousStatus = status;
    return () =>
      !destroyed &&
      foreground() &&
      screen === previousScreen &&
      status === previousStatus &&
      root() === owner &&
      element?.isConnected &&
      owner.contains(element) &&
      !element.disabled &&
      !element.closest('[hidden],[inert],[aria-hidden="true"]') &&
      element.getClientRects().length > 0 &&
      doc.defaultView?.getComputedStyle(element)?.visibility !== 'hidden';
  }
  function focus(element = primary()) {
    const eligible = actionCurrent(element);
    if (!eligible()) return;
    element.focus({ preventScroll: true });
    // The screen is installed first. Reveal its actual focused action without
    // letting a synchronous focus callback scroll a replacement/background view.
    if (eligible() && doc.activeElement === element)
      element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
  }
  function revealResizedAction(event) {
    if (revealingResize || event.target !== view) return;
    revealingResize = true;
    try {
      // Resize owns no opener or future focus. Measure only this current action.
      const element = doc.activeElement,
        owner = root(),
        previousScreen = screen,
        previousStatus = status,
        current = actionCurrent(element),
        eligible = () => current() && doc.activeElement === element;
      if (!eligible()) return;
      const width = doc.documentElement.clientWidth || view.innerWidth,
        height = doc.documentElement.clientHeight || view.innerHeight,
        rect = element.getBoundingClientRect();
      if (
        ![
          width,
          height,
          rect.left,
          rect.top,
          rect.right,
          rect.bottom,
          rect.width,
          rect.height,
        ].every(Number.isFinite) ||
        width <= 0 ||
        height <= 0 ||
        rect.width <= 0 ||
        rect.height <= 0
      )
        return;
      if (
        (rect.left < 0 || rect.top < 0 || rect.right > width || rect.bottom > height) &&
        eligible() &&
        // DOM reads can synchronously retire this resize's current owner.
        foreground() &&
        !destroyed &&
        screen === previousScreen &&
        status === previousStatus &&
        root() === owner &&
        doc.activeElement === element
      )
        element.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    } finally {
      revealingResize = false;
    }
  }
  function renderScreens() {
    const running = status === 'running' || screen === 'review';
    $('race-shell').hidden = running;
    $('race-shell').inert = running;
    $('race-hud').hidden = !running;
    $('race-pause').disabled = !running;
    $('race-pause').textContent = screen === 'review' ? 'Results' : 'Pause';
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
          ? 'Controller'
          : modality[i] === 'pointer'
            ? 'On-screen controls'
            : modality[i] === 'touch'
              ? 'Touch'
              : i === 0
                ? 'W A S D'
                : 'Arrow keys';
      setText(`race-seat-${i}`, device);
      setText(
        `racer-input-${i}`,
        `${device} · ${status === 'running' && shown[i] && !wanted ? 'Touch stays visible until pause' : status === 'finished' ? 'Results for options' : 'Pause for options'}`,
      );
      for (const button of pads[i].querySelectorAll('button')) {
        const kind = button.dataset.action;
        button.hidden = !!kind && !equipment[i]?.[kind];
        button.disabled = status !== 'running' || button.hidden;
        if (kind === 'action') button.textContent = equipment[i]?.label || 'Ability';
      }
    }
  }
  function show(next, { restore = null, remember = false, restoreFocus = true } = {}) {
    if (destroyed || status === 'running' || (!Object.hasOwn(SCREENS, next) && next !== 'review'))
      return;
    if (remember) opener = remember === true ? doc.activeElement : remember;
    onTransition({ from: screen, to: next });
    screen = next;
    renderScreens();
    renderPads();
    if (restoreFocus) focus(restore || primary());
  }
  function back() {
    departure = null;
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
  const foreground = () => !doc.hidden && doc.hasFocus?.() !== false;
  function soloReturnToken() {
    try {
      const token = getSoloReturnToken();
      return typeof token === 'string' && /^[0-9a-f]{32}$/.test(token) ? token : null;
    } catch {
      return null;
    }
  }
  const destinationHref = (kind, token) =>
    kind === 'solo' && token ? `../?mode-return-v2=${token}` : DESTINATIONS[kind];
  function departureCurrent(ticket) {
    const current = getDepartureState();
    return (
      !destroyed &&
      departure === ticket &&
      current?.match === ticket.match &&
      current.generation === ticket.generation &&
      current.match.status === 'paused'
    );
  }
  function cancelDeparture({ restore = false } = {}) {
    if (!departure) return;
    const target = departure.opener;
    departure = null;
    opener = null;
    if (screen === 'leave')
      show('main', { restore: target, restoreFocus: restore && foreground() });
  }
  function requestLeave(kind, element, event) {
    if (
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      (event.button !== undefined && event.button !== 0)
    )
      return;
    // Fixed routes are owned here; no target is accepted from a URL or control.
    const returnToken = kind === 'solo' ? soloReturnToken() : null;
    element.setAttribute('href', destinationHref(kind, returnToken));
    const before = getDepartureState();
    if (destroyed || departure || screen !== 'main' || !foreground() || !before?.match) {
      event.preventDefault();
      return;
    }
    if (['ready', 'finished'].includes(before.match.status)) return;
    event.preventDefault();
    if (!['running', 'paused'].includes(before.match.status)) return;
    onLeaveRequest(); // The host owns pause and normal physical-input release.
    const current = getDepartureState();
    if (
      destroyed ||
      !foreground() ||
      current?.match !== before.match ||
      current.generation !== before.generation ||
      current.match.status !== 'paused'
    )
      return;
    const ticket = {
      kind,
      returnToken,
      opener: element,
      match: current.match,
      generation: current.generation,
    };
    departure = ticket;
    setText('race-leave-title', kind === 'team' ? 'Go to Couch Team?' : 'Return to Solo?');
    setText(
      'race-leave-copy',
      'This Versus attempt exists only on this page and is not saved. Stay keeps both boards paused. Leaving discards this attempt.',
    );
    setText(
      'race-leave',
      kind === 'team' ? 'Discard and go to Team' : 'Discard and return to Solo',
    );
    $('race-leave').setAttribute('href', destinationHref(kind, returnToken));
    show('leave', { remember: element });
    if (!departureCurrent(ticket)) cancelDeparture();
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
  for (const [id, kind] of [
    ['race-solo-return', 'solo'],
    ['race-coop', 'team'],
  ])
    listen($(id), 'click', (event) => requestLeave(kind, $(id), event));
  listen($('race-leave'), 'click', (event) => {
    const ticket = departure;
    if (!ticket || screen !== 'leave' || !foreground() || !departureCurrent(ticket)) {
      event.preventDefault();
      cancelDeparture();
      return;
    }
    $('race-leave').setAttribute('href', destinationHref(ticket.kind, ticket.returnToken));
    // Preserve native anchor activation. If the browser cannot leave, the
    // original paused attempt stays intact and another decision remains explicit.
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
    if (departure && !departureCurrent(departure)) cancelDeparture();
    equipment = match.runs.map(couchEquipment);
    if (status !== previous) {
      if (status !== 'ready' || previous === null) screen = 'main';
      opener = null;
      renderScreens();
    }
    setText('race-summary', summary);
    setText(
      'race-title',
      contentBusy
        ? 'Loading the shared picture…'
        : status === 'paused'
          ? 'Both boards paused.'
          : status === 'finished'
            ? won.some((n) => n >= 2)
              ? 'Match complete.'
              : 'Round complete.'
            : 'Two boards. One race.',
    );
    $('race-review').hidden = status !== 'finished';
    $('race-pause').disabled = status !== 'running' && screen !== 'review';
    $('race-pause').textContent = screen === 'review' ? 'Results' : 'Pause';
    $('race-focus').textContent = status === 'ready' ? 'Race setup' : 'New match · setup';
    $('race-class-field').hidden = !equipment[0].action;
    $('race-class').disabled = !equipment[0].action || status !== 'ready';
    for (const id of ['race-level', 'race-theme', 'race-turn', 'race-time'])
      $(id).disabled = status !== 'ready';
    $('race-tap-field').hidden = !equipment.some((e) => e.boost);
    $('race-tap').disabled = !equipment.some((e) => e.boost);
    setText('race-loadout', equipment[0].description);
    const controller = ['D-pad or left stick: move'];
    if (equipment[0].action) controller.push(`South: ${equipment[0].label}`);
    if (equipment[0].pickup) controller.push('West: supply');
    if (equipment[0].boost) controller.push('right shoulder: hold Boost');
    controller.push('Menu: pause');
    setText('race-controller-help', `Controllers · ${controller.join(' · ')}.`);
    for (let i = 0; i < 2; i++) {
      const run = match.runs[i],
        e = equipment[i],
        hints = [i === 0 ? 'W A S D: move' : 'Arrow keys: move'];
      if (e.action) hints.push(`${i === 0 ? 'Q' : 'Enter'}: ${e.label}`);
      if (e.pickup) hints.push(`${i === 0 ? 'E' : '/'}: supply`);
      if (e.boost) hints.push(`${i === 0 ? 'left' : 'right'} Shift: hold Boost`);
      setText(`race-help-${i}`, `${hints.join(' · ')}.`);
      $(`race-result-${i}`).hidden = status !== 'finished';
      setText(
        `race-result-${i}`,
        `${(run.coverage * 100).toFixed(1)}% · ${run.lives} lives · ${run.score} points · ${won[i]} round wins`,
      );
    }
    renderPads();
    // Result rows and their copy precede the primary action in the layout.
    // Install them before the one transition-owned focus/reveal, never later.
    if (status !== previous && previous !== null && status !== 'running') focus();
  }
  renderScreens();
  if (view?.addEventListener) listen(view, 'resize', revealResizedAction);
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
    cancelDeparture,
    destroy() {
      departure = null;
      destroyed = true;
      for (const remove of removers) remove();
    },
  };
}
