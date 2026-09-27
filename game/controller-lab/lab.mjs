import { contentText } from '../i18n/content.mjs';
import { t, localizedText, localizedMessage } from '../i18n/index.mjs';
globalThis.RevealLineToolLaunch?.attached();
import { createOperationStatus } from '../ui/operation-status.mjs';
import { attachControllerPracticeExit } from '../ui/controller-practice-exit.mjs';
import {
  CONTROLLER_PREVIEW_FORMAT,
  parseControllerPreviewStatus,
} from '../ui/controller-preview.mjs';
import { entryScenario } from '../playground/model.mjs';
import { prepareScenario } from '../imports.mjs';
import { preparePack, resolvePackCampaign } from '../packs.mjs';
import { FIRST_FLIGHT_LESSONS, createLessonScenario } from '../first-flight.mjs';
import { firstFlightPreviewURL } from '../ui/first-flight-preview.mjs';
import { loadEditionToolProvider } from '../ui/edition-tool-provider.mjs';
import {
  editionPracticeChoices,
  createEditionPracticeScenario,
  editionPracticePreviewURL,
} from '../ui/edition-controller-practice.mjs';

const $ = (id) => document.getElementById(id),
  frame = $('game-frame'),
  origin = window.location.origin,
  buttons = [...document.querySelectorAll('[data-pad]')],
  axisInputs = [0, 1, 2, 3].map((index) => $(`axis-${index}`)),
  axes = [0, 0, 0, 0],
  held = new Set(),
  timers = new Map(),
  missions = [];
let connected = false,
  loaded = false,
  sequence = 0,
  session = null,
  statusSequence = -1,
  loadEpoch = 0,
  revision = 0,
  pendingStick = null,
  disposed = false,
  editionProvider = null;
const presenter = createOperationStatus($('load-status'));
const practiceExit = attachControllerPracticeExit({
  frame,
  document,
  getSession: () => session,
  isReady: () => loaded && !disposed,
  getTarget: (backward) => $(backward ? 'focus-game' : 'mission'),
  releaseInputs: releaseAll,
});
const status = (message, error = false, busy = false) => {
  const lease = presenter.begin({ message });
  if (!busy) lease.finish({ message, state: error ? 'error' : 'ready' });
  $('load-status').classList.toggle('error', error);
};
status(t('interface:loadingValidatedGameContent'), false, true);
function focusGame() {
  if (!loaded) return;
  frame.focus({ preventScroll: true });
  frame.contentWindow?.focus();
}
function send() {
  if (disposed || !loaded || origin === 'null' || !session) return null;
  const sent = sequence++;
  frame.contentWindow?.postMessage(
    {
      format: CONTROLLER_PREVIEW_FORMAT,
      session,
      sequence: sent,
      pad: {
        index: 0,
        connected,
        axes: connected ? [...axes] : [0, 0, 0, 0],
        buttons: Array.from({ length: 16 }, (_, i) => connected && held.has(i)),
      },
    },
    origin,
  );
  return sent;
}
function paintAxes() {
  for (const [index, input] of axisInputs.entries()) {
    input.disabled = !loaded || !connected;
    localizedText($(`axis-${index}-value`), () => Number(input.value).toFixed(2));
  }
  $('apply-stick').disabled = !loaded || !connected;
}
function paintPad() {
  for (const button of buttons) {
    button.disabled = !loaded || !connected;
    button.setAttribute('aria-pressed', String(held.has(Number(button.dataset.pad))));
  }
  $('connect').disabled = !loaded || connected;
  $('disconnect').disabled = !loaded || !connected;
  $('release').disabled = !loaded || !connected;
  $('focus-game').disabled = !loaded;
  paintAxes();
  localizedText($('connection-status'), () =>
    connected
      ? t('gameplay:virtualPadConnectedButtonSHeldAxes', {
          value1: held.size,
          value2: axes.map((value) => value.toFixed(2)).join(', '),
        })
      : t('interface:virtualPadDisconnected'),
  );
}
function cancelStick(message) {
  if (!pendingStick) return;
  clearTimeout(pendingStick.timer);
  pendingStick = null;
  if (message) localizedText($('axis-status'), () => message);
}
function clearPhysical(resetDraft) {
  cancelStick();
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
  held.clear();
  axes.fill(0);
  if (resetDraft) for (const input of axisInputs) input.value = '0';
  paintPad();
  send();
}
function releaseAll() {
  clearPhysical(true);
  localizedText($('axis-status'), () => t('interface:bothSticksCenteredAllButtonsReleased'));
}
for (const input of axisInputs)
  input.addEventListener('input', () => {
    const value = Number(input.value);
    input.value = String(
      Number.isFinite(value) ? Math.round(Math.max(-1, Math.min(1, value)) * 100) / 100 : 0,
    );
    clearPhysical(false);
    localizedText($('axis-status'), () =>
      t('interface:draftOnlyApplyStickReturnsFocusToTheGameAfter'),
    );
  });
function applyStick() {
  if (!loaded || !connected || disposed) return;
  const values = axisInputs.map((input) => {
    const value = Number(input.value);
    return Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0;
  });
  clearPhysical(false);
  focusGame();
  const ticket = { values, minimumSequence: send(), timer: null };
  pendingStick = ticket;
  localizedText($('axis-status'), () => t('interface:waitingForTheGameToSampleNeutralInput'));
  ticket.timer = setTimeout(() => {
    if (pendingStick !== ticket) return;
    pendingStick = null;
    axes.fill(0);
    paintPad();
    send();
    localizedText($('axis-status'), () =>
      t('interface:stickWasNotAppliedFocusTheGameAndRetryApply'),
    );
  }, 2000);
}
function disconnect() {
  connected = false;
  releaseAll();
}
function press(index) {
  if (!connected || !loaded) return;
  cancelStick(t('interface:pendingStickApplicationCancelledByAButtonGesture'));
  focusGame();
  clearTimeout(timers.get(index));
  timers.delete(index);
  if ($('gesture').value === 'hold' && held.has(index)) held.delete(index);
  else {
    held.add(index);
    if ($('gesture').value === 'pulse')
      timers.set(
        index,
        setTimeout(() => {
          held.delete(index);
          timers.delete(index);
          paintPad();
          send();
        }, 200),
      );
  }
  paintPad();
  send();
}
// Pointer focus remains in the iframe. Keyboard/assistive activation uses the
// button's native click; no keyup is required after focus enters the game.
for (const button of buttons) {
  button.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    press(Number(button.dataset.pad));
  });
  button.addEventListener('click', (event) => {
    if (event.detail === 0) press(Number(button.dataset.pad));
  });
  button.addEventListener('pointercancel', releaseAll);
}
function gameAction(button, action) {
  $(button).addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    action();
  });
  $(button).addEventListener('click', (event) => {
    if (event.detail === 0) action();
  });
}
gameAction('connect', () => {
  if (!loaded) return;
  focusGame();
  connected = true;
  releaseAll();
});
gameAction('disconnect', disconnect);
gameAction('release', () => {
  focusGame();
  releaseAll();
});
gameAction('focus-game', focusGame);
gameAction('apply-stick', applyStick);
$('gesture').addEventListener('change', releaseAll);

function option(select, value, label) {
  const node = document.createElement('option');
  node.value = value;
  localizedText(node, () => label);
  select.append(node);
}
function selectedMission() {
  return missions[Number($('mission').value)];
}
function refreshClasses() {
  const choice = selectedMission();
  if ($('practice-difficulty')) $('practice-difficulty').disabled = !!choice?.courseId;
  $('craft').disabled = !!choice?.courseId;
  if (choice?.courseId) {
    $('craft').replaceChildren();
    option($('craft'), 'scout', localizedMessage('interface:scoutFixedCourseClass'));
    return;
  }
  const entry = choice?.entry;
  if (!entry) return;
  const selected = $('craft').value;
  $('craft').replaceChildren();
  for (const recipe of entry.classRecipes) option($('craft'), recipe.id, recipe.label);
  if (entry.classRecipes.some((item) => item.id === selected)) $('craft').value = selected;
}
function resize() {
  const [width, height] = $('viewport').value.split('x').map(Number);
  const available = $('frame-space').clientWidth;
  const scale = Math.min(1, available / width);
  frame.style.width = `${width}px`;
  frame.style.height = `${height}px`;
  frame.style.transform = `scale(${scale})`;
  $('frame-space').style.height = `${Math.ceil(height * scale)}px`;
  localizedText($('viewport-readout'), () =>
    t('gameplay:requestedFrameReportsDisplayScale', {
      value1: width,
      value2: height,
      value3: frame.contentWindow?.innerWidth ?? '—',
      value4: frame.contentWindow?.innerHeight ?? '—',
      value5: Math.round(scale * 100),
    }),
  );
}
async function loadPractice() {
  const choice = selectedMission();
  if (!choice) return;
  const ticket = ++loadEpoch;
  $('load').disabled = true;
  status(t('interface:validatingPracticeBeforeOpeningTheRealGame'), false, true);
  try {
    const candidate = choice.courseId
      ? createLessonScenario(choice.courseId, {
          turnPolicy: $('steering').value,
          theme: choice.theme,
        })
      : editionProvider
        ? createEditionPracticeScenario(editionProvider, {
            missionId: choice.missionId,
            classId: $('craft').value,
            turnPolicy: $('steering').value,
            difficulty: $('practice-difficulty').value,
          })
        : entryScenario(choice.entry, choice.levelId, {
            classId: $('craft').value,
            turnPolicy: $('steering').value,
            seed: 1,
          });
    const { scenario, warnings } = await prepareScenario(candidate);
    if (ticket !== loadEpoch || disposed) return;
    const nextSession = crypto.randomUUID().replaceAll('-', '');
    // The same explicit practice handoff used by Playground. Persist only the
    // fully validated candidate; never write to profile, packs or reward stores.
    if (!choice.courseId && !editionProvider)
      sessionStorage.setItem('revealline.playground.current', JSON.stringify(scenario));
    let destination = choice.courseId
      ? firstFlightPreviewURL({
          lessonId: choice.courseId,
          turnPolicy: scenario.settings.turnPolicy,
          controllerSession: nextSession,
        })
      : editionProvider
        ? editionPracticePreviewURL(editionProvider, {
            missionId: choice.missionId,
            classId: scenario.settings.classId,
            turnPolicy: scenario.settings.turnPolicy,
            difficulty: $('practice-difficulty').value,
            controllerSession: nextSession,
            revision: ++revision,
          })
        : `../?practice=1&controller-preview=1&controller-session=${nextSession}&revision=${++revision}`;
    if (editionProvider && choice.courseId) {
      const course = new URL(destination, window.location.href);
      destination = editionProvider.href(Object.fromEntries(course.searchParams));
    }
    disconnect();
    loaded = false;
    session = nextSession;
    statusSequence = -1;
    paintPad();
    localizedText($('scope'), () => t('interface:loadingPractice'));
    localizedText($('focused'), () => '—');
    localizedText($('pad-status'), () => t('interface:notJoined'));
    frame.src = destination;
    status(
      `${choice.label} prepared. Loading the child game; the virtual pad stays disconnected until it reports ready.${warnings.length ? ` ${warnings.join(' ')}` : ''}`,
      false,
      true,
    );
  } catch (error) {
    if (ticket === loadEpoch && !disposed)
      status(t('gameplay:practiceWasNotReplaced', { value1: error.message }), true);
  } finally {
    if (ticket === loadEpoch && !disposed) $('load').disabled = false;
  }
}
$('load').addEventListener('click', loadPractice);
$('mission').addEventListener('change', refreshClasses);
$('viewport').addEventListener('change', resize);
frame.addEventListener('load', () => {
  if (!frame.getAttribute('src')) return;
  if (!loaded)
    status(t('interface:gameDocumentLoadedWaitingForThePracticeControlsToReport'), false, true);
  resize();
});
function receiveStatus(event) {
  if (disposed || event.source !== frame.contentWindow || event.origin !== origin) return;
  const value = parseControllerPreviewStatus(event.data);
  if (!value || value.session !== session || value.sequence <= statusSequence) return;
  statusSequence = value.sequence;
  if (!loaded) {
    loaded = true;
    connected = false;
    releaseAll();
    status(t('interface:practiceControlsAreReadyConnectTheVirtualPadToBegin'));
  }
  localizedText($('scope'), () => value.scope || t('interface:noActiveScope'));
  localizedText(
    $('focused'),
    () => value.focusedLabel || value.focusedId || t('interface:gameCanvasDocument'),
  );
  localizedText(
    $('pad-status'),
    () => `${value.assigned ? t('interface:joined') : t('interface:notJoined')} · ${value.message}`,
  );
  if (
    pendingStick &&
    value.readSequence >= pendingStick.minimumSequence &&
    value.readSequence < sequence
  ) {
    const { values } = pendingStick;
    cancelStick();
    axes.splice(0, 4, ...values);
    paintPad();
    localizedText($('axis-status'), () =>
      t('interface:stickValuesAppliedReleaseAllCentersBothSticksAndReleases'),
    );
    send();
  }
}
window.addEventListener('message', receiveStatus);
const heartbeat = setInterval(() => {
  if (connected) send();
}, 150);
const observer = new ResizeObserver(resize);
observer.observe($('frame-space'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) disconnect();
});
window.addEventListener('pagehide', (event) => {
  disconnect();
  loadEpoch++;
  // A history-cache return reuses this page and its iframe. Preserve the
  // listeners, but never resume a held virtual button on return.
  if (event.persisted) return;
  disposed = true;
  practiceExit.destroy();
  clearInterval(heartbeat);
  observer.disconnect();
  window.removeEventListener('message', receiveStatus);
});
window.addEventListener('pageshow', (event) => {
  if (!event.persisted || disposed) return;
  connected = false;
  releaseAll();
  $('load').disabled = !missions.length;
  resize();
});

async function json(path) {
  const response = await fetch(path);
  if (!response.ok)
    throw new Error(t('gameplay:contentRequestFailed', { value1: response.status }));
  return response.json();
}
try {
  if (origin === 'null')
    throw new Error(t('interface:serveThisPageOverLocalhostOrHttpsFileUrlsCannot'));
  editionProvider = await loadEditionToolProvider({
    locationRef: window.location,
    documentRef: document,
  });
  const packNotes = [];
  let courseTheme;
  if (editionProvider) {
    missions.push(...editionPracticeChoices(editionProvider));
    courseTheme = editionProvider.theme;
    $('practice-difficulty-field').hidden = false;
    for (const link of document.querySelectorAll('[data-workshop-tool="playground"]'))
      link.hidden = true;
    const home = document.querySelector('[data-workshop-return="game"]');
    if (home) localizedText(home, () => editionProvider.selection.edition.name);
  } else {
    const [campaign, themes, classRecipes] = await Promise.all([
      json('../content/campaign.json'),
      json('../content/themes.json'),
      json('../content/classes.json'),
    ]);
    const entry = { campaign, themes: themes.themes, classRecipes };
    for (const level of campaign.levels)
      missions.push({
        entry,
        levelId: level.id,
        label: `${contentText(campaign, 'title')} / ${contentText(level, 'name')}`,
      });
    courseTheme = themes.themes.find((theme) => theme.id === 'fpv');
    for (const [name, path] of [
      [t('interface:fieldcraft'), '../content/packs/fieldcraft.json'],
      [t('interface:sentinelRelay'), '../content/packs/sentinel-relay.json'],
      [t('interface:readingPractice'), './reading-practice.json'],
    ]) {
      try {
        status(`Loading and validating ${name} practice…`, false, true);
        const { pack } = await preparePack(await json(path));
        for (const campaign of pack.campaigns) {
          const entry = resolvePackCampaign(pack, campaign.id);
          for (const level of entry.campaign.levels)
            missions.push({
              entry,
              levelId: level.id,
              label: `${contentText(pack, 'name')} / ${contentText(level, 'name')}`,
            });
        }
      } catch (error) {
        packNotes.push(t('gameplay:unavailable', { value1: name, value2: error.message }));
      }
    }
  }
  for (const lesson of FIRST_FLIGHT_LESSONS)
    missions.push({
      courseId: lesson.id,
      theme: courseTheme,
      get label() {
        return t('gameplay:firstFlight2', { value1: contentText(lesson, 'title') });
      },
    });
  if (!disposed) {
    missions.forEach((mission, index) => option($('mission'), String(index), mission.label));
    $('mission').disabled = false;
    $('craft').disabled = false;
    refreshClasses();
    $('load').disabled = false;
    await loadPractice();
    if (packNotes.length)
      status(`${$('load-status').textContent} ${packNotes.join(' ')}`, false, !loaded);
  }
} catch (error) {
  status(`${error.message} Reload this page to retry.`, true);
}
