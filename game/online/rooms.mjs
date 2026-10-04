import { getLocale, setLocale } from '../i18n/index.mjs';
import { ROOM_PROTOCOL, restoreTrustedRoomSnapshot } from './room-core.mjs';
import { canonicalJSON } from '../data-json.mjs';
import {
  validateRoomCatalogue,
  assertRoomRecipeBinding,
  roomSelectionLink,
  roomInvitationLink,
  readRoomSelection,
  readRoomInvitation,
} from './room-content.mjs';
import {
  ROOM_CONTROL_PROTOCOL,
  roomServiceEndpoint,
  terminalRoomError,
  createRoomClientLifecycle,
  prepareRoomBoardPainters,
} from './room-client-lifecycle.mjs';
import { onNativeInactive, exportJSONFile } from '../platform.mjs';
import { drawClassicBoard, classicCatchMarks } from '../snake/classic-view.mjs';
import { createHuntDestruction } from '../hunt/destruction.mjs';
import { mountRoomUI } from './room-ui.mjs';
import { createRoomBoardPresentation, reconcileRoomPresentationRuns } from './room-events.mjs';
import { advanceClassicFlight } from '../snake/classic-flight-art.mjs';
import { createClassicPresentation } from '../snake/classic-presentation.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createDestructionPreferences, sharedActorAppearance } from '../hunt/preferences.mjs';
import { createDisplayPreferences } from '../display-preferences.mjs';
import { createEncounterDisplayPreferences } from '../encounter-display-preferences.mjs';
const linkedLocale = new URL(location.href).searchParams.get('lang');
if (['en', 'uk'].includes(linkedLocale)) setLocale(linkedLocale, { persist: false });
const $ = (id) => document.getElementById(id),
  uk = getLocale() === 'uk';
const say = (en, ua) => (uk ? ua : en);
const setText = (id, value) => {
  if ($(id).textContent !== value) $(id).textContent = value;
};
const endpoint = roomServiceEndpoint(location, document.documentElement.dataset.roomService);
const display = createDisplayPreferences(),
  destruction = createDestructionPreferences(),
  remains = createEncounterDisplayPreferences();
const presentation = createClassicPresentation({ displayPreferences: display }),
  appearance = sharedActorAppearance(),
  teamPresentation = createRoomBoardPresentation();
const SESSION_KEY = 'revealline.private-room.seat.v1';
let credentials = null,
  state = null,
  stopped = false,
  polling = null,
  pauseRequest = null,
  booting = false,
  previousFrame = null,
  acceptedRecipeJSON = null;
let catalogueEntries = [],
  unavailableEntries = [],
  selectedSeed = 17;
let canvases = [],
  painters = [],
  flights = [],
  eventIds = new Set(),
  effects = [],
  roomUI = null;
const messages = {
  title: ['Private rooms', 'Приватні кімнати'],
  intro: [
    'Play with a friend. Both players choose Ready before the server starts the exact same recipe.',
    'Грайте з другом. Обидва обирають «Готово», і сервер запускає однакову місію.',
  ],
  'recipe-label': ['Mission and seats', 'Місія та гравці'],
  'targets-label': ['Prey', 'Цілі'],
  'pace-label': ['Snake pace', 'Темп Snake'],
  'share-label': ['Share this mission selection', 'Поділитися вибором місії'],
  'accepted-title': ['Accepted mission', 'Прийнята місія'],
  'identity-label': ['Exact recipe and source', 'Точна місія та джерело'],
  'result-scope': [
    'Room results and replay exports are separate from local records and official chapter rewards.',
    'Результати кімнати та повтори зберігаються окремо від локальних рекордів і нагород офіційних розділів.',
  ],
  create: ['Create private room', 'Створити приватну кімнату'],
  public: ['Find an unranked player', 'Знайти суперника без рейтингу'],
  'invite-label': ['Invite your friend', 'Запросіть друга'],
  ready: ['Ready / Resume', 'Готово / Продовжити'],
  pause: ['Pause both', 'Пауза для обох'],
  rematch: ['Rematch', 'Зіграти ще'],
  leave: ['Leave room', 'Залишити кімнату'],
  receipt: ['Save match replay', 'Зберегти повтор матчу'],
  support: ['Support / Boost', 'Підтримка / Прискорення'],
  keys: [
    'Arrow keys or WASD steer. Shift boosts, E uses equipment and R collects supplies when available. Hold Space for Team Support; P or Escape pauses both players. After reconnecting within 60 seconds, both choose Ready.',
    'Стрілки або WASD керують дроном. Shift прискорює, E активує обладнання, R збирає припаси. У Team утримуйте пробіл для підтримки; P або Escape зупиняє обох. Поверніться за 60 секунд і обидва оберіть «Готово».',
  ],
  qualification: [
    'Private rooms preview · server outcomes stay separate from local chapter rewards. Public matchmaking requires a qualified service.',
    'Попередня версія приватних кімнат · серверні результати окремі від локальних нагород. Публічний пошук потребує перевіреного сервісу.',
  ],
};
for (const [id, words] of Object.entries(messages)) $(id).textContent = words[uk ? 1 : 0];
if (uk) {
  ['За задумом', 'Рухливі вороги', 'Різноманітні цілі'].forEach((label, i) => {
    $('targets').options[i].textContent = label;
  });
  ['Повільно', 'Звичайно', 'Швидко'].forEach((label, i) => {
    $('pace').options[i].textContent = label;
  });
}
const notice = (value) => {
  $('notice').textContent = value;
};
const reconnect = document.createElement('button');
reconnect.id = 'reconnect';
reconnect.hidden = true;
reconnect.textContent = say('Reconnect', 'Відновити зв’язок');
$('notice').after(reconnect);
const lifecycle = createRoomClientLifecycle({
  sendInput: (body, owner, signal) => api('/input', body, owner, signal),
  onError: (error, owner) => connectionError(error, owner),
});
const roomError = (message, code) => Object.assign(new Error(message), { code });
const saveSeat = (value) => {
  try {
    if (value) sessionStorage.setItem(SESSION_KEY, JSON.stringify({ ...value, service: endpoint }));
    else sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* A live ephemeral seat does not require browser storage. */
  }
};
function syncControls() {
  const phase = lifecycle.snapshot().phase;
  const live = lifecycle.canPlay() && !stopped && !document.hidden;
  $('controls').hidden = !live;
  $('ready').hidden = phase !== 'connected' || !['waiting', 'paused'].includes(state?.status);
  $('pause').hidden = !live;
  $('rematch').hidden = $('receipt').hidden = phase !== 'connected' || state?.status !== 'finished';
  reconnect.hidden = !['recovering', 'abandoned'].includes(phase);
  reconnect.textContent =
    phase === 'abandoned'
      ? say('Choose another room', 'Вибрати іншу кімнату')
      : say('Reconnect', 'Відновити зв’язок');
}
function suspendLocal() {
  roomUI?.suspend();
  teamPresentation.reset();
  lifecycle.suspend();
  polling?.controller.abort();
  polling = null;

  previousFrame = null;
  syncControls();
}
function abandonLocal(message) {
  roomUI?.suspend();
  roomUI?.shell.open('missions');
  lifecycle.abandon();
  polling?.controller.abort();
  polling = null;
  roomUI?.shell.update({ phase: 'ready', canResume: false });
  saveSeat(null);
  $('invitation').hidden = true;
  syncControls();
  notice(
    message ??
      say(
        'This room is no longer available. Choose another room or ask your friend for a new invitation.',
        'Ця кімната більше недоступна. Виберіть іншу або попросіть друга надіслати нове запрошення.',
      ),
  );
}
function connectionError(error, owner = credentials, epoch = null) {
  const current = lifecycle.snapshot();
  if (
    credentials !== owner ||
    current.phase === 'abandoned' ||
    (epoch !== null && epoch !== current.epoch)
  )
    return;
  if (terminalRoomError(error)) {
    abandonLocal();
    return;
  }
  suspendLocal();
  const detail =
    error.code === 'ROOM_ARTWORK_TIMEOUT'
      ? say('Room artwork preparation timed out', 'Час очікування оформлення кімнати вичерпано')
      : error.message;
  notice(
    say(
      `Connection interrupted: ${detail}. Controls are paused. Reconnecting…`,
      `Зв’язок перервано: ${detail}. Керування призупинено. Відновлюємо зв’язок…`,
    ),
  );
}
async function api(path, body, owner = credentials, signal = null) {
  if (!endpoint)
    throw new Error(
      say(
        'This host has no approved room service.',
        'Для цього сайту не налаштовано сервіс кімнат.',
      ),
    );
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  else signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 4000);
  try {
    const response = await fetch(new URL(path, endpoint), {
      method: body === undefined ? 'GET' : 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(owner ? { Authorization: `Bearer ${owner.token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });
    const value = await response.json();
    if (!response.ok) throw roomError(value.error ?? `Room service ${response.status}`, value.code);
    return value;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
async function own(value, { restoring = false, catalogueId = null, expectedHash = null } = {}) {
  if (value?.protocol !== ROOM_PROTOCOL || value?.controlProtocol !== ROOM_CONTROL_PROTOCOL)
    throw roomError('Room protocol mismatch. Choose a new room.', 'ROOM_PROTOCOL_MISMATCH');
  if (
    !/^[a-f0-9]{32}$/.test(value.roomId) ||
    !/^[a-f0-9]{64}$/.test(value.token) ||
    ![0, 1].includes(value.seat) ||
    !/^[a-f0-9]{64}$/.test(value.contentHash) ||
    !/^[a-f0-9]{64}$/.test(value.engineVersion)
  )
    throw roomError('The saved room seat is invalid.', 'SEAT_UNAVAILABLE');
  if (expectedHash && expectedHash !== value.contentHash)
    throw roomError('The invitation refers to different room content.', 'ROOM_IDENTITY_MISMATCH');
  if (catalogueId) value = { ...value, catalogueId };
  credentials = value;
  state = null;
  teamPresentation.reset();
  acceptedRecipeJSON = null;
  lifecycle.own(value, { restoring });
  saveSeat(value);
  $('setup').hidden = true;
  $('lobby').hidden = false;
  // Share only after the full snapshot is bound to the owned recipe hash.
  $('invitation').hidden = true;
  $('invite').value = '';
  $('accepted-mission').textContent = say(
    'Checking accepted mission…',
    'Перевіряємо прийняту місію…',
  );
  $('accepted-source').textContent = '';
  $('identity').textContent = '';
  syncControls();
  roomUI?.shell.open('missions');
  await poll();
}
async function requestPause(activation = state?.controlActivation) {
  if (!credentials || !activation || pauseRequest || lifecycle.snapshot().phase === 'abandoned')
    return;
  const owner = credentials,
    epoch = lifecycle.snapshot().epoch;
  const operation = { controller: new AbortController() };
  pauseRequest = operation;
  try {
    await api('/pause', { activation }, owner, operation.controller.signal);
    if (credentials === owner) lifecycle.pauseAcknowledged(epoch);
  } catch (error) {
    connectionError(error, owner, epoch);
  } finally {
    if (pauseRequest === operation) pauseRequest = null;
  }
}
function selection() {
  return {
    id: $('recipe').value,
    pace: $('pace').value,
    targets: $('targets').value,
    seed: selectedSeed,
  };
}
function sourceLabel(kind) {
  return {
    builtin: say('Built-in missions', 'Вбудовані місії'),
    community: say('Community', 'Спільнота'),
    company: say('Company', 'Компанія'),
  }[kind];
}
function showAcceptedMission(snapshot) {
  const recipe = snapshot.recipe,
    content = recipe.content;
  const mission = content?.mission;
  setText(
    'accepted-mission',
    `${mission?.title[uk ? 'uk' : 'en'] ?? recipe.level.name ?? recipe.level.id} · ${recipe.family} · ${recipe.mode}`,
  );
  setText(
    'accepted-source',
    content
      ? `${sourceLabel(content.source.kind)} · ${content.source.title[uk ? 'uk' : 'en']}${content.source.version ? ` · ${content.source.version}` : ''} · ${say('Shared game artwork', 'Спільне оформлення гри')}`
      : say('Historical built-in room recipe', 'Історична вбудована місія кімнати'),
  );
  setText(
    'identity',
    [
      `${say('Mission', 'Місія')}: ${recipe.level.id} @ ${recipe.level.revision}`,
      ...(content
        ? [
            `${say('Catalogue', 'Каталог')}: ${content.catalogueId}`,
            `${say('Source', 'Джерело')}: ${content.source.id}`,
            ...(content.source.sha256
              ? [`${say('Package SHA256', 'SHA256 пакета')}: ${content.source.sha256}`]
              : []),
          ]
        : []),
      `${say('Seed', 'Зерно')}: ${recipe.seed}`,
      `${say('Recipe SHA256', 'SHA256 місії')}: ${snapshot.contentHash}`,
      `${say('Engine', 'Рушій')}: ${snapshot.engineVersion}`,
    ].join('\n'),
  );
}
function updateSelection(requestedId = null) {
  const entry = catalogueEntries.find((item) => item.id === $('recipe').value);
  $('create').disabled = $('public').disabled = !entry;
  $('share-selection').hidden = !entry;
  $('pace').disabled = entry?.family !== 'snake';
  if (!entry) {
    const unavailable = unavailableEntries.find(
      (item) =>
        item.id === requestedId ||
        (item.id.startsWith('import:') && requestedId?.startsWith(`${item.id}:`)),
    );
    $('selection-source').textContent = unavailable
      ? `${unavailable.title[uk ? 'uk' : 'en']}: ${unavailable.reason[uk ? 'uk' : 'en']}`
      : say(
          'This exact mission is not admitted by this room service. Choose another mission.',
          'Цю точну місію не прийнято сервісом кімнат. Виберіть іншу місію.',
        );
    return;
  }
  const source = entry.content?.source;
  $('selection-source').textContent = source
    ? `${sourceLabel(source.kind)} · ${source.title[uk ? 'uk' : 'en']}${source.version ? ` · ${source.version}` : ''}`
    : sourceLabel('builtin');
  $('share').value = roomSelectionLink(location.href, selection());
}
for (const id of ['recipe', 'pace', 'targets'])
  $(id).addEventListener('change', () => updateSelection());
let acquiring = false;
for (const [id, path] of [
  ['create', '/rooms'],
  ['public', '/matchmaking'],
])
  $(id).addEventListener('click', async () => {
    if (acquiring || credentials) return;
    acquiring = true;
    try {
      const chosen = selection();
      if (!catalogueEntries.some((entry) => entry.id === chosen.id)) return;
      await own(await api(path, chosen), { catalogueId: chosen.id });
    } catch (error) {
      notice(error.message);
    } finally {
      acquiring = false;
    }
  });
for (const [id, path] of [
  ['ready', '/ready'],
  ['rematch', '/rematch'],
])
  $(id).addEventListener('click', async () => {
    if (
      !credentials ||
      lifecycle.snapshot().phase !== 'connected' ||
      document.hidden ||
      stopped ||
      $(id).hidden ||
      $(id).disabled
    )
      return;
    const owner = credentials,
      epoch = lifecycle.snapshot().epoch;
    $(id).disabled = true;
    try {
      await api(path, { activation: state.controlActivation }, owner);
      if (credentials === owner) await poll();
    } catch (error) {
      connectionError(error, owner, epoch);
    } finally {
      $(id).disabled = false;
    }
  });
$('pause').addEventListener('click', () => {
  if (!lifecycle.canPlay()) return;
  suspendLocal();
  void requestPause();
});
$('receipt').addEventListener('click', async () => {
  const owner = credentials,
    accepted = state;
  if (!owner || state?.status !== 'finished' || lifecycle.snapshot().phase !== 'connected') return;
  try {
    const receipt = await api('/result', undefined, owner);
    if (credentials !== owner || state?.generation !== accepted.generation) return;
    if (
      receipt.protocol !== ROOM_PROTOCOL ||
      receipt.contentHash !== owner.contentHash ||
      receipt.engineVersion !== owner.engineVersion ||
      receipt.tick !== accepted.tick ||
      canonicalJSON(receipt.result) !== canonicalJSON(accepted.result)
    )
      throw roomError('The result belongs to different room content.', 'ROOM_IDENTITY_MISMATCH');
    await assertRoomRecipeBinding(receipt.recipe, owner.contentHash, accepted.recipe);
    if (credentials !== owner || state?.generation !== accepted.generation) return;
    const exported = await exportJSONFile(receipt, `room-${owner.roomId}.json`);
    if (credentials === owner)
      notice(
        exported.status === 'requested'
          ? say(
              'Download requested. Check your downloads or Save dialog.',
              'Завантаження запитано. Перевірте завантаження або вікно збереження.',
            )
          : exported.message,
      );
  } catch (error) {
    if (credentials === owner) notice(error.message);
  }
});
function leave() {
  const owner = credentials;
  if (owner && lifecycle.snapshot().phase !== 'abandoned')
    void api('/leave', {}, owner).catch(() => {});
  credentials = null;
  polling?.controller.abort();
  polling = null;
  pauseRequest?.controller.abort();
  pauseRequest = null;
  state = null;
  teamPresentation.reset();
  acceptedRecipeJSON = null;
  lifecycle.release();

  saveSeat(null);
  painters.forEach((painter) => painter?.dispose?.());
  painters = [];
  canvases = [];
  flights = [];
  eventIds.clear();
  $('boards').replaceChildren();
  $('lobby').hidden = $('controls').hidden = true;
  $('setup').hidden = false;
  $('result').textContent = '';
  reconnect.hidden = true;
  notice(say('Choose a new room.', 'Виберіть нову кімнату.'));
  effects.forEach((effect) => effect.reset());
  effects = [];
  roomUI?.update(null);
}
function followInvitation() {
  let invitation;
  try {
    invitation = readRoomInvitation(location.href);
  } catch (error) {
    notice(error.message);
    return;
  }
  if (!invitation) return;
  if (credentials?.invite === invitation.invite && lifecycle.snapshot().phase !== 'abandoned') {
    history.replaceState(null, '', `${location.pathname}${location.search}`);
    return;
  }
  // Hash-only navigation does not reload the page. Retire the old seat and use
  // the same boot/admission path as a fresh invitation, including its SHA pins.
  leave();
  location.reload();
}
window.addEventListener('hashchange', followInvitation);
$('leave').addEventListener('click', leave);
reconnect.addEventListener('click', () => {
  if (lifecycle.snapshot().phase === 'abandoned') leave();
  else if (credentials) void poll();
  else void boot();
});
async function allocateBoards(snapshot, owner, epoch, signal) {
  const count = snapshot.engine.runs.length;
  const nextCanvases = Array.from({ length: count }, (_, index) => {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', say(`Player ${index + 1} board`, `Поле гравця ${index + 1}`));
    return canvas;
  });
  const nextPainters = await prepareRoomBoardPainters(
    async ({ signal: artworkSignal, retain }) => {
      if (snapshot.engine.kind === 'team') retain(createCoopPainter(nextCanvases[0]));
      else if (snapshot.engine.kind === 'capture') {
        const read = async (url) => {
          const response = await fetch(url, { signal: artworkSignal });
          if (!response.ok)
            throw new Error(
              say(
                `Room artwork unavailable (${response.status})`,
                `Оформлення кімнати недоступне (${response.status})`,
              ),
            );
          return response.json();
        };
        const [presets, pack] = await Promise.all([
          read('../../authoring/motion-lab/presets.json'),
          read('../content/packs/fieldcraft.json'),
        ]);
        const prepared = nextCanvases.map(() => retain(new BoardPainter(presets)));
        await Promise.all(prepared.map((painter) => painter.setLook(pack.themes[0], 'fpv-body')));
      }
    },
    { signal },
  );
  if (credentials !== owner || stopped || document.hidden || epoch !== lifecycle.snapshot().epoch) {
    nextPainters.forEach((painter) => painter?.dispose?.());
    return;
  }
  painters.forEach((painter) => painter?.dispose?.());
  canvases = nextCanvases;
  painters = nextPainters;
  flights = [];
  effects.forEach((effect) => effect.reset());
  effects = canvases.map(() => createHuntDestruction());
  roomUI.boards(canvases, snapshot);
  $('boards').classList.toggle('paired', count === 2);
}

async function poll() {
  if (
    !credentials ||
    polling ||
    pauseRequest ||
    stopped ||
    document.hidden ||
    lifecycle.snapshot().phase === 'abandoned'
  )
    return;
  const operation = { controller: new AbortController() };
  polling = operation;
  const owner = credentials,
    epoch = lifecycle.snapshot().epoch;
  let errorEpoch = epoch;
  try {
    const wire = await api('/snapshot', undefined, owner, operation.controller.signal);
    if (credentials !== owner || epoch !== lifecycle.snapshot().epoch || stopped || document.hidden)
      return;
    if (
      wire.roomId !== owner.roomId ||
      wire.contentHash !== owner.contentHash ||
      wire.engineVersion !== owner.engineVersion
    )
      throw roomError('The room content identity changed.', 'ROOM_IDENTITY_MISMATCH');
    if (
      wire.controlProtocol !== ROOM_CONTROL_PROTOCOL ||
      !/^[a-f0-9]{64}$/.test(wire.controlActivation)
    )
      throw roomError('Room controls protocol mismatch.', 'ROOM_PROTOCOL_MISMATCH');
    let snapshot;
    try {
      snapshot = restoreTrustedRoomSnapshot(wire);
    } catch {
      throw roomError('The room snapshot identity changed.', 'ROOM_IDENTITY_MISMATCH');
    }
    try {
      const recipeJSON = canonicalJSON(snapshot.recipe);
      if (acceptedRecipeJSON === null) {
        await assertRoomRecipeBinding(snapshot.recipe, owner.contentHash);
        if (owner.catalogueId && snapshot.recipe.content?.catalogueId !== owner.catalogueId)
          throw new Error('The shared mission selection changed.');
        if (
          credentials !== owner ||
          epoch !== lifecycle.snapshot().epoch ||
          stopped ||
          document.hidden
        )
          return;
        acceptedRecipeJSON = recipeJSON;
      } else if (recipeJSON !== acceptedRecipeJSON)
        throw new Error('The accepted mission changed.');
    } catch {
      throw roomError(
        'The accepted room recipe or source identity changed.',
        'ROOM_IDENTITY_MISMATCH',
      );
    }
    if (
      lifecycle.snapshot().pauseRequired &&
      !['finished', 'abandoned'].includes(snapshot.status)
    ) {
      await requestPause(snapshot.controlActivation);
      return;
    }
    // Terminal outcomes remain server-owned, including during recovery.
    if (['finished', 'abandoned'].includes(snapshot.status)) lifecycle.pauseAcknowledged(epoch);
    const replacement = !state || state.generation !== snapshot.generation;
    const recovering = lifecycle.snapshot().phase !== 'connected';
    if (replacement || recovering) teamPresentation.reset();
    if (replacement) {
      eventIds.clear();
      await allocateBoards(snapshot, owner, epoch, operation.controller.signal);
    }
    if (credentials !== owner || stopped || document.hidden || !lifecycle.accept(snapshot, epoch))
      return;
    // Admission may rotate the control epoch. Presentation failures after that
    // point still belong to this newly accepted activation, unlike late I/O.
    errorEpoch = lifecycle.snapshot().epoch;
    snapshot.engine.runs = reconcileRoomPresentationRuns(state?.engine.runs, snapshot.engine.runs, {
      replacement,
      recovering,
    });
    state = snapshot;
    syncControls();
    showAcceptedMission(snapshot);
    if (owner.invite) {
      const invite = roomInvitationLink(location.href, { ...owner, recipe: snapshot.recipe });
      if ($('invite').value !== invite) $('invite').value = invite;
      $('invitation').hidden = false;
    }
    $('seats').textContent = snapshot.seats
      .map(
        (seat, index) =>
          `${index + 1}${index === owner.seat ? say(' (you)', ' (ви)') : ''}: ${!seat.joined ? say('waiting for invite', 'очікує запрошення') : seat.ready ? say('ready', 'готово') : say('not ready', 'не готово')}`,
      )
      .join(' · ');
    notice(
      snapshot.status === 'paused'
        ? say(
            'Room paused. Both players must choose Ready to resume.',
            'Кімнату призупинено. Обидва гравці мають обрати «Готово», щоб продовжити.',
          )
        : say(
            `Room ${snapshot.status}`,
            `Кімната: ${{ waiting: 'очікування', playing: 'гра', finished: 'завершено', abandoned: 'залишена' }[snapshot.status]}`,
          ),
    );
    $('result').textContent = snapshot.result
      ? snapshot.result.winner
        ? say(`Result: ${snapshot.result.winner}`, `Результат: ${snapshot.result.winner}`)
        : say(
            `Result: ${snapshot.result.outcome ?? snapshot.result.reason ?? 'finished'}`,
            `Результат: ${snapshot.result.outcome ?? 'завершено'}`,
          )
      : '';
    for (const event of snapshot.events) eventIds.add(event.id);
    if (eventIds.size > 256) eventIds = new Set(snapshot.events.map((event) => event.id));
    roomUI.update(snapshot, { replacement, recovering });
    if (snapshot.status === 'abandoned') abandonLocal();
  } catch (error) {
    connectionError(error, owner, errorEpoch);
  } finally {
    if (polling === operation) polling = null;
  }
}
function suspend() {
  if (!credentials || ['abandoned', 'idle'].includes(lifecycle.snapshot().phase)) return;
  suspendLocal();
  void requestPause();
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) suspend();
  else {
    previousFrame = null;
    void poll();
  }
});
window.addEventListener('orientationchange', suspend);
window.addEventListener('offline', suspend);
window.addEventListener('blur', suspend);
window.addEventListener('online', () => void poll());
let removeNativeInactive = null;
void onNativeInactive(suspend)
  .then((remove) => {
    removeNativeInactive = remove;
  })
  .catch((error) => {
    if (credentials) connectionError(error);
  });
function frame(time) {
  const dt = Math.min(0.1, previousFrame === null ? 0 : (time - previousFrame) / 1000);
  previousFrame = time;
  roomUI?.frame();
  if (state)
    state.engine.runs.forEach((run, index) => {
      const canvas = canvases[index];
      if (!canvas) return;
      const reduced = display.snapshot().effectiveReducedEffects,
        fx = destruction.snapshot(),
        paused = !lifecycle.canPlay() || stopped || document.hidden;
      if (state.engine.kind === 'snake') {
        flights[index] = advanceClassicFlight(flights[index], dt * 1000, !paused, reduced);
        const cast = appearance.snapshot().cast;
        effects[index]?.advance({ valid: true, eliminations: classicCatchMarks(run) }, dt, {
          key: run,
          paused,
          reduced,
          ...fx,
          sources: run.snakes.map((snake) => ({
            ...snake.body[0],
            id: snake.id,
            direction: snake.direction,
          })),
        });
        drawClassicBoard(canvas, run, {
          attemptKey: `${state.roomId}:${state.generation}`,
          presentation: presentation.snapshot(),
          effects: effects[index],
          boardStyle: roomUI.boardStyle(),
          style: roomUI.tailStyle(),
          cast: cast === 'authored' ? 'rivals' : cast,
          reduced,
          flight: flights[index],
          cssWidth: roomUI.width(index) ?? canvas.clientWidth,
          pixelRatio: devicePixelRatio || 1,
          ...fx,
          showRemains: remains.snapshot().showRemains,
        });
      } else if (state.engine.kind === 'team')
        painters[index]?.paint(teamPresentation.project(run, { paused }), {
          reduced,
          ...fx,
          showRemains: remains.snapshot().showRemains,
        });
      else {
        if (canvas.width !== run.width * 16) {
          canvas.width = run.width * 16;
          canvas.height = run.height * 16;
        }
        painters[index]?.draw(canvas.getContext('2d'), run, paused ? 0 : dt, {
          paused,
          reduced,
          ...fx,
          showCombatScrap: remains.snapshot().showRemains,
          displayCSSWidth: canvas.clientWidth,
        });
      }
    });
  requestAnimationFrame(frame);
}
async function boot() {
  if (booting || credentials) return;
  booting = true;
  reconnect.hidden = true;
  try {
    const catalogue = await api('/catalogue');
    if (catalogue.protocol !== ROOM_PROTOCOL || catalogue.controlProtocol !== ROOM_CONTROL_PROTOCOL)
      throw roomError('Room protocol mismatch.', 'ROOM_PROTOCOL_MISMATCH');
    const accepted = validateRoomCatalogue(catalogue.entries, catalogue.unavailable ?? []);
    catalogueEntries = accepted.entries;
    unavailableEntries = accepted.unavailable;
    const groups = ['builtin', 'community', 'company']
      .map((kind) => {
        const group = document.createElement('optgroup');
        group.label = sourceLabel(kind);
        for (const entry of catalogueEntries.filter(
          (item) => (item.content?.source.kind ?? 'builtin') === kind,
        )) {
          const option = document.createElement('option');
          option.value = entry.id;
          option.textContent = `${entry.family} · ${entry.mode} · ${entry.title[uk ? 'uk' : 'en']}${entry.content?.source.kind !== 'builtin' && entry.content?.source ? ` · ${entry.content.source.title[uk ? 'uk' : 'en']} · ${entry.content.source.sha256.slice(0, 8)}` : ''}${entry.content?.source.version ? ` · ${entry.content.source.version}` : ''}`;
          group.append(option);
        }
        return group;
      })
      .filter((group) => group.children.length);
    $('recipe').replaceChildren(...groups);
    const requested = readRoomSelection(location.href);
    const requestedId = requested.id;
    selectedSeed = requested.seed;
    if (requestedId && !catalogueEntries.some((entry) => entry.id === requestedId)) {
      const missing = document.createElement('option');
      missing.value = '';
      missing.textContent = say(
        'Requested mission unavailable — choose another',
        'Запитана місія недоступна — виберіть іншу',
      );
      missing.selected = true;
      missing.disabled = true;
      $('recipe').prepend(missing);
    } else if (requestedId) $('recipe').value = requestedId;
    $('pace').value = requested.pace;
    $('targets').value = requested.targets;
    updateSelection(requestedId);
    $('public').hidden = !catalogue.public;
    const invitation = readRoomInvitation(location.href);
    if (invitation) {
      await own(await api('/join', { invite: invitation.invite }), invitation);
      history.replaceState(null, '', `${location.pathname}${location.search}`);
    } else {
      let previous = null;
      try {
        const saved = sessionStorage.getItem(SESSION_KEY);
        if (saved && saved.length <= 2048) previous = JSON.parse(saved);
      } catch {
        saveSeat(null);
      }
      if (previous?.service === endpoint) await own(previous, { restoring: true });
      else
        notice(
          say(
            'Choose a mission, create a room, then share the invitation.',
            'Виберіть місію, створіть кімнату та поділіться запрошенням.',
          ),
        );
    }
  } catch (error) {
    if (terminalRoomError(error)) saveSeat(null);
    if (error.code === 'INVITE_UNAVAILABLE')
      history.replaceState(null, '', `${location.pathname}${location.search}`);
    reconnect.hidden = !endpoint;
    notice(
      say(
        `Room service unavailable: ${error.message}. Local play is ready from the main game.`,
        `Сервіс кімнат недоступний: ${error.message}. Локальна гра доступна з головного меню.`,
      ),
    );
  } finally {
    booting = false;
  }
}
setInterval(() => void poll(), 150);
window.addEventListener('pagehide', (event) => {
  suspend();
  stopped = true;
  if (!event.persisted) {
    roomUI?.dispose();
    effects.forEach((effect) => effect.reset());
    void removeNativeInactive?.();
    removeNativeInactive = null;
  }
});
window.addEventListener('pageshow', () => {
  stopped = false;
  previousFrame = null;
  void poll();
});
roomUI = mountRoomUI({
  getState: () => state,
  getSeat: () => credentials?.seat ?? 0,
  canPlay: () => lifecycle.canPlay() && !stopped && !document.hidden,
  submit: (control) => lifecycle.submit(control),
  pause: suspend,
  display,
  destruction,
});
requestAnimationFrame(frame);
void boot();
