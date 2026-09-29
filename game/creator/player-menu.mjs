import { localizedText, t } from '../i18n/index.mjs';
import { attachFullscreen } from '../ui/fullscreen.mjs';
import { setMenuIcon } from '../ui/native-menu-icons.mjs';
import { attachSettingsPanels } from '../ui/settings-panels.mjs';
import { attachMenuScene, getMenuAnimation, setMenuAnimation } from '../ui/menu-scenes.mjs';
import { libraryMissionId } from '../mission-library/library.mjs';
import { missionLibraryHref } from '../mission-library/handoff.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';

/** Preserve the qualified installed-edition lookup used by the ordinary Versus host. */
export function creatorVersusHref(pack, missionId, baseURL) {
  const content = pack?.manifest?.content;
  if (!content?.compatibility?.modes.includes('versus')) return null;
  const mission = content.project.missions.find((row) => row.id === missionId);
  const campaign = content.project.campaigns.find((row) => row.missionIds.includes(missionId));
  if (!mission || !campaign) return null;
  return missionLibraryHref({
    baseURL: new URL('../', baseURL).href,
    currentMode: 'solo',
    mode: 'versus',
    journey: 'legacy',
    sourceJourney: 'legacy',
    missionId: libraryMissionId({
      owner: `creator:${pack.editionId}`,
      edition: pack.editionId,
      campaign: campaign.id,
      mission: mission.id,
      revision: mission.revision,
    }),
  });
}

/** Presentation and modal ownership only. The player retains all runtime, save,
 * verification and controller polling authority. Existing action nodes are moved,
 * not copied, so there is still exactly one handler for each game operation. */
export function attachCreatorPlayerMenu({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  getState,
  onChooseMission,
  onInputReset = () => {},
  navigate = (href) => {
    win.location.href = href;
  },
  createScene = attachMenuScene,
} = {}) {
  const $ = (id) => doc.getElementById(id);
  const home = $('creator-home'),
    settings = $('creator-settings'),
    missions = $('creator-missions'),
    confirm = $('creator-replace-attempt'),
    list = $('creator-mission-list');
  let disposed = false,
    pending = null,
    renderedPack = null;
  const listeners = [],
    openers = new Map();
  const listen = (node, type, callback) => {
    node.addEventListener(type, callback);
    listeners.push(() => node.removeEventListener(type, callback));
  };
  const close = (dialog, { focus = true } = {}) => {
    if (!dialog.open) return;
    const opener = openers.get(dialog);
    openers.delete(dialog);
    dialog.close();
    onInputReset();
    if (focus && opener?.isConnected && !opener.disabled && !opener.closest('[hidden]'))
      opener.focus();
    scene?.update();
  };
  const open = (dialog, target) => {
    if (disposed || dialog.open) return;
    openers.set(dialog, doc.activeElement);
    dialog.showModal();
    onInputReset();
    target?.focus();
    scene.update();
  };
  const panels = attachSettingsPanels({
    root: settings,
    document: doc,
    beforeSelect: () => onInputReset(),
  });
  const scene = createScene({
    root: home,
    mode: 'solo',
    getContext: () => ({ active: !home.hidden }),
  });
  const display = createDisplayPreferences({
    window: win,
    getStorage: () => win.localStorage,
    onWarning: (message, key) =>
      localizedText($('creator-display-status'), () => (key ? t(key) : message)),
  });
  const stopDisplay = display.subscribe((state) => {
    doc.body.dataset.textFace = state.textFace;
    doc.body.dataset.textSize = state.textSize;
    doc.body.dataset.effects = state.effectiveReducedEffects ? 'reduced' : 'full';
    $('creator-text-face').value = state.textFace;
    $('creator-text-size').value = state.textSize;
    $('creator-reduced-effects').checked = state.reducedEffects;
    scene.update();
  });
  for (const [id, key] of [
    ['creator-text-face', 'textFace'],
    ['creator-text-size', 'textSize'],
    ['creator-reduced-effects', 'reducedEffects'],
  ])
    listen($(id), 'change', () =>
      display.set({ [key]: key === 'reducedEffects' ? $(id).checked : $(id).value }),
    );
  for (const [id, icon] of Object.entries({
    start: 'play',
    resume: 'play',
    pause: 'play',
    retry: 'play',
    next: 'play',
    'creator-select-mission': 'missions',
    'creator-open-settings': 'settings',
    'creator-mode-solo': 'solo',
    'creator-mode-versus': 'versus',
    'creator-fullscreen': 'fullscreen',
    'creator-settings-fullscreen': 'fullscreen',
    'creator-settings-back': 'back',
    'creator-missions-back': 'back',
    'creator-tab-gameplay': 'play',
    'creator-tab-display': 'display',
    'creator-tab-data': 'collection',
    'creator-tab-help': 'help',
    'creator-back-library': 'collection',
    'creator-back-game': 'back',
    'export-attempt': 'collection',
    'export-progress': 'collection',
  }))
    setMenuIcon($(id), icon);
  localizedText($('start'), () => t('interface:startMission'));
  localizedText($('resume'), () => t('common:actions.continue'));
  $('creator-version').textContent =
    doc.documentElement?.dataset.buildVersion?.replace('__REVEALLINE_VERSION__', 'DEV') || 'DEV';
  const fullscreen = ['creator-fullscreen', 'creator-settings-fullscreen'].map((id) =>
    attachFullscreen($(id), doc, {
      escapeRoot: home,
      onState: (state) => {
        $(id).textContent = state.label;
        $('creator-fullscreen-status').textContent = state.message;
        if (state.message) {
          $('status').textContent = state.message;
          $('status').hidden = false;
        }
      },
    }),
  );
  $('creator-background-animation').checked = getMenuAnimation(win);
  listen($('creator-background-animation'), 'change', () =>
    setMenuAnimation($('creator-background-animation').checked, win),
  );
  listen($('creator-open-settings'), 'click', () => {
    open(settings, panels.primary());
    panels.focusCategories();
  });
  listen($('creator-settings-back'), 'click', () => close(settings));
  listen($('creator-missions-back'), 'click', () => close(missions));
  for (const dialog of [settings, missions, confirm])
    listen(dialog, 'cancel', (event) => {
      event.preventDefault();
      if (dialog === confirm) pending = null;
      close(dialog);
    });
  listen($('creator-replace-cancel'), 'click', () => {
    pending = null;
    close(confirm);
  });
  function ticketCurrent(ticket) {
    const state = getState();
    return (
      !disposed &&
      !state.busy &&
      state.pack === ticket.pack &&
      state.attempt === ticket.attempt &&
      state.savedRaw === ticket.savedRaw
    );
  }
  function execute(action) {
    for (const dialog of [confirm, missions, settings]) close(dialog, { focus: false });
    onInputReset();
    return action();
  }
  function request(action, { leaving = false } = {}) {
    const state = getState();
    if (disposed || state.busy || !state.ready) return false;
    if (!state.savedRaw && (!state.attempt || state.ended)) return execute(action);
    pending = { action, pack: state.pack, attempt: state.attempt, savedRaw: state.savedRaw };
    localizedText($('creator-replace-title'), () =>
      t(`interface:creatorMenu.${leaving ? 'leaveTitle' : 'replaceTitle'}`),
    );
    localizedText($('creator-replace-copy'), () =>
      t(`interface:creatorMenu.${leaving ? 'leaveBody' : 'replaceBody'}`),
    );
    localizedText($('creator-replace-confirm'), () =>
      t(leaving ? 'common:actions.continue' : 'common:actions.play'),
    );
    open(confirm, $('creator-replace-cancel'));
    return false;
  }
  listen($('creator-replace-confirm'), 'click', () => {
    const ticket = pending;
    pending = null;
    if (ticket && ticketCurrent(ticket)) execute(ticket.action);
    else close(confirm);
  });
  listen($('creator-select-mission'), 'click', () => {
    if (!getState().ready || getState().busy) return;
    open(
      missions,
      [...list.querySelectorAll('button')].find(
        (node) => node.dataset.mission === getState().missionId,
      ) || list.querySelector('button'),
    );
  });
  listen($('creator-mode-versus'), 'click', (event) => {
    event.preventDefault();
    const state = getState(),
      href = creatorVersusHref(state.pack, state.missionId, win.location.href);
    if (href) request(() => navigate(href), { leaving: true });
  });
  for (const id of ['creator-back-library', 'creator-back-game'])
    listen($(id), 'click', (event) => {
      const state = getState();
      if (!state.ready || (!state.attempt && !state.savedRaw) || (state.ended && !state.savedRaw))
        return;
      event.preventDefault();
      request(() => navigate(new URL($(id).getAttribute('href'), win.location.href).href), {
        leaving: true,
      });
    });
  function primaryId(state = getState()) {
    if (!state.ready) return 'creator-open-settings';
    if (state.ended) return !$('next').hidden ? 'next' : 'retry';
    if (state.attempt) return 'pause';
    return state.savedRaw ? 'resume' : 'start';
  }
  function refresh() {
    if (disposed) return;
    const state = getState(),
      running = state.ready && !state.paused && !state.ended;
    home.hidden = running;
    $('creator-game').hidden = !running && !state.ended;
    const earnedParent = state.ended ? $('creator-game') : $('creator-panel-data');
    if ($('earned').parentNode !== earnedParent) earnedParent.append($('earned'));
    doc.body.dataset.creatorPlayerState = state.busy
      ? 'busy'
      : !state.ready
        ? 'error'
        : running
          ? 'flight'
          : state.ended
            ? 'result'
            : 'menu';
    const primary = primaryId(state);
    for (const id of ['start', 'resume', 'pause', 'retry', 'next', 'creator-open-settings'])
      $(id).removeAttribute('data-menu-up');
    for (const id of ['creator-mode-solo', 'creator-mode-versus']) $(id).dataset.menuDown = primary;
    $(primary).dataset.menuUp = 'creator-mode-solo';
    for (const id of ['start', 'resume', 'pause', 'retry', 'next']) {
      const node = $(id),
        parent =
          running && id === 'pause'
            ? $('creator-flight-actions')
            : id === primary
              ? $('creator-primary-actions')
              : $('creator-runtime-controls');
      if (node.parentNode !== parent) parent.append(node);
      if (id === 'start' || id === 'retry' || id === 'pause')
        node.hidden = id !== primary && (id === 'pause' ? !running : node.disabled);
    }
    $('creator-select-mission').disabled = state.busy || !state.ready;
    $('status').hidden = !state.busy && !$('status').classList.contains('error');
    $('creator-save-warning').hidden = $('save-status').dataset.error !== 'true';
    localizedText($('creator-save-warning'), () => $('save-status').textContent);
    const href = creatorVersusHref(state.pack, state.missionId, win.location.href);
    $('creator-mode-versus').hidden = !href;
    if (href) $('creator-mode-versus').setAttribute('href', href);
    if (renderedPack !== state.pack) {
      renderedPack = state.pack;
      list.replaceChildren();
      for (const missionId of state.missionOrder || []) {
        const mission = state.pack.manifest.content.project.missions.find(
          (row) => row.id === missionId,
        );
        const button = doc.createElement('button');
        button.type = 'button';
        button.dataset.mission = missionId;
        button.textContent = mission.name;
        setMenuIcon(button, 'play');
        button.onclick = () => request(() => onChooseMission(missionId));
        list.append(button);
      }
    }
    for (const button of list.querySelectorAll('button')) {
      button.disabled = state.busy;
      if (button.dataset.mission === state.missionId) button.setAttribute('aria-current', 'true');
      else button.removeAttribute('aria-current');
    }
    if (running)
      for (const dialog of [confirm, missions, settings]) close(dialog, { focus: false });
    if (pending && !ticketCurrent(pending)) {
      pending = null;
      close(confirm);
    }
    scene.update();
  }
  refresh();
  return {
    refresh,
    request,
    root: () => (home.hidden || getState().ended ? doc.body : home),
    primary: () => $(primaryId()),
    back: () => {
      const dialog = [...doc.querySelectorAll('dialog[open]')].at(-1);
      if (![settings, missions, confirm].includes(dialog)) return false;
      if (dialog === confirm) pending = null;
      close(dialog);
      return true;
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      pending = null;
      listeners.forEach((remove) => remove());
      fullscreen.forEach((remove) => remove());
      panels.destroy();
      stopDisplay();
      display.dispose();
      scene.dispose();
      for (const dialog of [confirm, missions, settings]) close(dialog, { focus: false });
    },
  };
}
