import { getLocale, setLocale } from '../i18n/index.mjs';
import { ROOM_PROTOCOL, restoreTrustedRoomSnapshot } from './room-core.mjs';
import {
  ROOM_CONTROL_PROTOCOL,
  roomServiceEndpoint,
  terminalRoomError,
  createRoomClientLifecycle,
} from './room-client-lifecycle.mjs';
import { onNativeInactive, exportJSONFile } from '../platform.mjs';
import { drawClassicBoard } from '../snake/classic-view.mjs';
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
const endpoint = roomServiceEndpoint(location, document.documentElement.dataset.roomService);
const display = createDisplayPreferences(),
  destruction = createDestructionPreferences(),
  remains = createEncounterDisplayPreferences();
const presentation = createClassicPresentation({ displayPreferences: display }),
  appearance = sharedActorAppearance();
const SESSION_KEY = 'revealline.private-room.seat.v1';
let credentials = null,
  state = null,
  stopped = false,
  polling = null,
  pauseRequest = null,
  booting = false,
  previousFrame = null;
let canvases = [],
  painters = [],
  flights = [],
  eventIds = new Set();
const messages = {
  title: ['Private rooms', 'Приватні кімнати'],
  intro: [
    'Play with a friend. Both players choose Ready before the server starts the exact same recipe.',
    'Грайте з другом. Обидва обирають «Готово», і сервер запускає однакову місію.',
  ],
  'recipe-label': ['Mission and seats', 'Місія та гравці'],
  'targets-label': ['Prey', 'Цілі'],
  'pace-label': ['Snake pace', 'Темп Snake'],
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
    'Arrow keys or WASD steer your own drone. Space pauses both boards. A lost connection pauses play; reconnect within 60 seconds, then both choose Ready.',
    'Стрілки або WASD керують вашим дроном. Пробіл зупиняє обидва поля. Після втрати зв’язку поверніться за 60 секунд і обидва оберіть «Готово».',
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
  lifecycle.suspend();
  direction = null;
  boost = false;
  previousFrame = null;
  syncControls();
}
function abandonLocal(message) {
  lifecycle.abandon();
  direction = null;
  boost = false;
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
function connectionError(error, owner = credentials) {
  if (credentials !== owner || lifecycle.snapshot().phase === 'abandoned') return;
  if (terminalRoomError(error)) {
    abandonLocal();
    return;
  }
  suspendLocal();
  notice(
    say(
      `Connection interrupted: ${error.message}. Controls are paused. Reconnecting…`,
      `Зв’язок перервано: ${error.message}. Керування призупинено. Відновлюємо зв’язок…`,
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
async function own(value, { restoring = false } = {}) {
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
  credentials = value;
  state = null;
  lifecycle.own(value, { restoring });
  saveSeat(value);
  $('setup').hidden = true;
  $('lobby').hidden = false;
  $('invitation').hidden = !value.invite;
  if (value.invite) {
    const invite = new URL(location.href);
    invite.searchParams.delete('room');
    invite.hash = `invite=${value.invite}`;
    $('invite').value = invite.href;
  }
  syncControls();
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
    connectionError(error, owner);
  } finally {
    if (pauseRequest === operation) pauseRequest = null;
  }
}
function selection() {
  return { id: $('recipe').value, pace: $('pace').value, targets: $('targets').value, seed: 17 };
}
let acquiring = false;
for (const [id, path] of [
  ['create', '/rooms'],
  ['public', '/matchmaking'],
])
  $(id).addEventListener('click', async () => {
    if (acquiring || credentials) return;
    acquiring = true;
    try {
      await own(await api(path, selection()));
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
    const owner = credentials;
    $(id).disabled = true;
    try {
      await api(path, { activation: state.controlActivation }, owner);
      if (credentials === owner) await poll();
    } catch (error) {
      connectionError(error, owner);
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
  const owner = credentials;
  if (!owner || state?.status !== 'finished' || lifecycle.snapshot().phase !== 'connected') return;
  try {
    const receipt = await api('/result', undefined, owner);
    if (credentials !== owner) return;
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
  lifecycle.release();
  direction = null;
  boost = false;
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
}
$('leave').addEventListener('click', leave);
reconnect.addEventListener('click', () => {
  if (lifecycle.snapshot().phase === 'abandoned') leave();
  else if (credentials) void poll();
  else void boot();
});
async function allocateBoards(snapshot, owner, epoch) {
  const count = snapshot.engine.runs.length;
  const nextCanvases = Array.from({ length: count }, (_, index) => {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', say(`Player ${index + 1} board`, `Поле гравця ${index + 1}`));
    return canvas;
  });
  let nextPainters = [];
  if (snapshot.engine.kind === 'team') nextPainters = [createCoopPainter(nextCanvases[0])];
  else if (snapshot.engine.kind === 'capture') {
    const [presets, pack] = await Promise.all([
      fetch('../../authoring/motion-lab/presets.json').then((response) => response.json()),
      fetch('../content/packs/fieldcraft.json').then((response) => response.json()),
    ]);
    nextPainters = nextCanvases.map(() => new BoardPainter(presets));
    await Promise.all(nextPainters.map((painter) => painter.setLook(pack.themes[0], 'fpv-body')));
  }
  if (credentials !== owner || stopped || document.hidden || epoch !== lifecycle.snapshot().epoch) {
    nextPainters.forEach((painter) => painter?.dispose?.());
    return;
  }
  painters.forEach((painter) => painter?.dispose?.());
  canvases = nextCanvases;
  painters = nextPainters;
  flights = [];
  $('boards').replaceChildren(...canvases);
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
    if (replacement) {
      direction = null;
      boost = false;
      eventIds.clear();
      await allocateBoards(snapshot, owner, epoch);
    }
    if (credentials !== owner || stopped || document.hidden || !lifecycle.accept(snapshot, epoch))
      return;
    if (!replacement)
      snapshot.engine.runs = snapshot.engine.runs.map((run, index) =>
        Object.assign(state.engine.runs[index], run),
      );
    state = snapshot;
    if (!lifecycle.canPlay()) {
      direction = null;
      boost = false;
    }
    syncControls();
    $('identity').textContent =
      `${snapshot.recipe.family} · ${snapshot.recipe.level.id} · ${snapshot.recipe.level.revision} · ${snapshot.contentHash}`;
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
    if (snapshot.status === 'abandoned') abandonLocal();
  } catch (error) {
    connectionError(error, owner);
  } finally {
    if (polling === operation) polling = null;
  }
}
let direction = null,
  boost = false;
function input(next = direction) {
  if (!lifecycle.canPlay() || stopped || document.hidden) return;
  direction = next;
  lifecycle.submit({ direction, boost, support: boost });
}
const keys = {
  ArrowUp: 'up',
  KeyW: 'up',
  ArrowRight: 'right',
  KeyD: 'right',
  ArrowDown: 'down',
  KeyS: 'down',
  ArrowLeft: 'left',
  KeyA: 'left',
};
document.addEventListener('keydown', (event) => {
  if (event.target.closest('input,select,textarea') || event.repeat) return;
  if (keys[event.code]) {
    event.preventDefault();
    void input(keys[event.code]);
  }
  if (event.code === 'Space' && lifecycle.canPlay()) {
    event.preventDefault();
    $('pause').click();
  }
});
document.querySelectorAll('[data-direction]').forEach((button) =>
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    void input(button.dataset.direction);
  }),
);
$('support').addEventListener('pointerdown', (event) => {
  if (!lifecycle.canPlay() || stopped || document.hidden) return;
  event.currentTarget.setPointerCapture(event.pointerId);
  boost = true;
  void input();
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
  $('support').addEventListener(type, () => {
    if (boost) {
      boost = false;
      void input();
    }
  });
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
        drawClassicBoard(canvas, run, {
          presentation: presentation.snapshot(),
          cast: cast === 'authored' ? 'rivals' : cast,
          reduced,
          flight: flights[index],
          cssWidth: canvas.clientWidth,
          pixelRatio: devicePixelRatio || 1,
          ...fx,
          showRemains: remains.snapshot().showRemains,
        });
      } else if (state.engine.kind === 'team')
        painters[index]?.paint(run, {
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
    $('recipe').replaceChildren(
      ...catalogue.entries.map((entry) => {
        const option = document.createElement('option');
        option.value = entry.id;
        option.textContent = `${entry.family} · ${entry.mode} · ${entry.title[uk ? 'uk' : 'en']}`;
        return option;
      }),
    );
    $('create').disabled = false;
    $('public').hidden = !catalogue.public;
    const invitation = new URLSearchParams(location.hash.slice(1)).get('invite');
    if (invitation) {
      await own(await api('/join', { invite: invitation }));
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
    void removeNativeInactive?.();
    removeNativeInactive = null;
  }
});
window.addEventListener('pageshow', () => {
  stopped = false;
  previousFrame = null;
  void poll();
});
requestAnimationFrame(frame);
void boot();
