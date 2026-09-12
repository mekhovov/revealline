import {
  CONTROLLER_PREVIEW_FORMAT,
  parseControllerPreviewStatus,
} from '../ui/controller-preview.mjs';
import { entryScenario } from '../playground/model.mjs';
import { prepareScenario } from '../imports.mjs';
import { preparePack, resolvePackCampaign } from '../packs.mjs';
import { FIRST_FLIGHT_LESSONS, createLessonScenario } from '../first-flight.mjs';
import { firstFlightPreviewURL } from '../ui/first-flight-preview.mjs';

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
  disposed = false;
const status = (message, error = false) => {
  $('load-status').textContent = message;
  $('load-status').classList.toggle('error', error);
};
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
    $(`axis-${index}-value`).textContent = Number(input.value).toFixed(2);
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
  $('connection-status').textContent = connected
    ? `Virtual pad connected. ${held.size} button(s) held. Axes: ${axes.map((value) => value.toFixed(2)).join(', ')}.`
    : 'Virtual pad disconnected.';
}
function cancelStick(message) {
  if (!pendingStick) return;
  clearTimeout(pendingStick.timer);
  pendingStick = null;
  if (message) $('axis-status').textContent = message;
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
  $('axis-status').textContent = 'Both sticks centered; all buttons released.';
}
for (const input of axisInputs)
  input.addEventListener('input', () => {
    const value = Number(input.value);
    input.value = String(
      Number.isFinite(value) ? Math.round(Math.max(-1, Math.min(1, value)) * 100) / 100 : 0,
    );
    clearPhysical(false);
    $('axis-status').textContent =
      'Draft only. Apply stick returns focus to the game after neutral input is sampled.';
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
  $('axis-status').textContent = 'Waiting for the game to sample neutral input…';
  ticket.timer = setTimeout(() => {
    if (pendingStick !== ticket) return;
    pendingStick = null;
    axes.fill(0);
    paintPad();
    send();
    $('axis-status').textContent =
      'Stick was not applied. Focus the game and retry Apply stick. Release all resets both stick drafts.';
  }, 2000);
}
function disconnect() {
  connected = false;
  releaseAll();
}
function press(index) {
  if (!connected || !loaded) return;
  cancelStick('Pending stick application cancelled by a button gesture.');
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
  node.textContent = label;
  select.append(node);
}
function selectedMission() {
  return missions[Number($('mission').value)];
}
function refreshClasses() {
  const choice = selectedMission();
  $('craft').disabled = !!choice?.courseId;
  if (choice?.courseId) {
    $('craft').replaceChildren();
    option($('craft'), 'scout', 'Scout · fixed course class');
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
  $('viewport-readout').textContent =
    `${width} × ${height} requested · frame reports ${frame.contentWindow?.innerWidth ?? '—'} × ${frame.contentWindow?.innerHeight ?? '—'} · ${Math.round(scale * 100)}% display scale`;
}
async function loadPractice() {
  const choice = selectedMission();
  if (!choice) return;
  const ticket = ++loadEpoch;
  $('load').disabled = true;
  status('Validating practice before opening the real game…');
  try {
    const candidate = choice.courseId
      ? createLessonScenario(choice.courseId, {
          turnPolicy: $('steering').value,
          theme: choice.theme,
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
    if (!choice.courseId)
      sessionStorage.setItem('revealline.playground.current', JSON.stringify(scenario));
    const destination = choice.courseId
      ? firstFlightPreviewURL({
          lessonId: choice.courseId,
          turnPolicy: scenario.settings.turnPolicy,
          controllerSession: nextSession,
        })
      : `../?practice=1&controller-preview=1&controller-session=${nextSession}&revision=${++revision}`;
    disconnect();
    loaded = false;
    session = nextSession;
    statusSequence = -1;
    paintPad();
    $('scope').textContent = 'Loading practice';
    $('focused').textContent = '—';
    $('pad-status').textContent = 'Not joined';
    frame.src = destination;
    status(
      `${choice.label} prepared. Connect the virtual pad when the game appears.${warnings.length ? ` ${warnings.join(' ')}` : ''}`,
    );
  } catch (error) {
    if (ticket === loadEpoch && !disposed)
      status(`Practice was not replaced: ${error.message}`, true);
  } finally {
    if (ticket === loadEpoch && !disposed) $('load').disabled = false;
  }
}
$('load').addEventListener('click', loadPractice);
$('mission').addEventListener('change', refreshClasses);
$('viewport').addEventListener('change', resize);
frame.addEventListener('load', () => {
  if (!frame.getAttribute('src')) return;
  loaded = true;
  statusSequence = -1;
  connected = false;
  releaseAll();
  resize();
});
function receiveStatus(event) {
  if (disposed || event.source !== frame.contentWindow || event.origin !== origin) return;
  const value = parseControllerPreviewStatus(event.data);
  if (!value || value.session !== session || value.sequence <= statusSequence) return;
  statusSequence = value.sequence;
  $('scope').textContent = value.scope || 'No active scope';
  $('focused').textContent = value.focusedLabel || value.focusedId || 'Game canvas / document';
  $('pad-status').textContent = `${value.assigned ? 'Joined' : 'Not joined'} · ${value.message}`;
  if (
    pendingStick &&
    value.readSequence >= pendingStick.minimumSequence &&
    value.readSequence < sequence
  ) {
    const { values } = pendingStick;
    cancelStick();
    axes.splice(0, 4, ...values);
    paintPad();
    $('axis-status').textContent =
      'Stick values applied. Release all centers both sticks and releases every button.';
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
  if (!response.ok) throw new Error(`Content request failed (${response.status}).`);
  return response.json();
}
try {
  if (origin === 'null')
    throw new Error(
      'Serve this page over localhost or HTTPS; file URLs cannot host the controller bridge.',
    );
  const [campaign, themes, classRecipes] = await Promise.all([
    json('../content/campaign.json'),
    json('../content/themes.json'),
    json('../content/classes.json'),
  ]);
  const entry = { campaign, themes: themes.themes, classRecipes };
  for (const level of campaign.levels)
    missions.push({ entry, levelId: level.id, label: `${campaign.title} / ${level.name}` });
  const packNotes = [];
  for (const [name, path] of [
    ['Fieldcraft', '../content/packs/fieldcraft.json'],
    ['Sentinel Relay', '../content/packs/sentinel-relay.json'],
    ['Reading practice', './reading-practice.json'],
  ]) {
    try {
      const { pack } = await preparePack(await json(path));
      for (const campaign of pack.campaigns) {
        const entry = resolvePackCampaign(pack, campaign.id);
        for (const level of entry.campaign.levels)
          missions.push({ entry, levelId: level.id, label: `${pack.name} / ${level.name}` });
      }
    } catch (error) {
      packNotes.push(`${name} unavailable: ${error.message}`);
    }
  }
  for (const lesson of FIRST_FLIGHT_LESSONS)
    missions.push({
      courseId: lesson.id,
      theme: themes.themes.find((theme) => theme.id === 'fpv'),
      label: `First Flight / ${lesson.title}`,
    });
  if (!disposed) {
    missions.forEach((mission, index) => option($('mission'), String(index), mission.label));
    $('mission').disabled = false;
    $('craft').disabled = false;
    refreshClasses();
    $('load').disabled = false;
    await loadPractice();
    if (packNotes.length) status(`${$('load-status').textContent} ${packNotes.join(' ')}`);
  }
} catch (error) {
  status(error.message, true);
}
