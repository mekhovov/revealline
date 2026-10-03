import { getLocale, setLocale } from '../i18n/index.mjs';
import { ROOM_PROTOCOL, restoreTrustedRoomSnapshot } from './room-core.mjs';
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
const endpoint =
  document.documentElement.dataset.roomService ||
  (['127.0.0.1', 'localhost'].includes(location.hostname) ? 'http://127.0.0.1:8783' : null);
const display = createDisplayPreferences(),
  destruction = createDestructionPreferences(),
  remains = createEncounterDisplayPreferences();
const presentation = createClassicPresentation({ displayPreferences: display }),
  appearance = sharedActorAppearance();
const SESSION_KEY = 'revealline.private-room.seat.v1';
let credentials = null,
  state = null,
  sequence = 0,
  stopped = false,
  polling = false,
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
async function api(path, body) {
  if (!endpoint)
    throw new Error(
      say(
        'This host has no approved room service.',
        'Для цього сайту не налаштовано сервіс кімнат.',
      ),
    );
  const response = await fetch(new URL(path, endpoint), {
    method: body === undefined ? 'GET' : 'POST',
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    headers: {
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(credentials ? { Authorization: `Bearer ${credentials.token}` } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(4000),
  });
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? `Room service ${response.status}`);
  return value;
}
async function own(value) {
  if (value.protocol !== ROOM_PROTOCOL) throw new Error('Room protocol mismatch.');
  credentials = value;
  state = null;
  sequence = 0;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  $('setup').hidden = true;
  $('lobby').hidden = false;
  $('invitation').hidden = !value.invite;
  if (value.invite) {
    const invite = new URL(location.href);
    invite.search = '';
    invite.hash = `invite=${value.invite}`;
    $('invite').value = invite.href;
  }
  await poll();
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
  ['pause', '/pause'],
  ['rematch', '/rematch'],
])
  $(id).addEventListener('click', async () => {
    try {
      await api(path, {});
      await poll();
    } catch (error) {
      notice(error.message);
    }
  });
$('receipt').addEventListener('click', async () => {
  try {
    const receipt = await api('/result'),
      url = URL.createObjectURL(new Blob([JSON.stringify(receipt)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `room-${credentials.roomId}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    notice(error.message);
  }
});
$('leave').addEventListener('click', () => {
  // Capture the current bearer synchronously, then retire local ownership before any await.
  void api('/leave', {}).catch(() => {});
  credentials = null;
  state = null;
  sessionStorage.removeItem(SESSION_KEY);
  painters.forEach((painter) => painter?.dispose?.());
  painters = [];
  canvases = [];
  $('boards').replaceChildren();
  $('lobby').hidden = $('controls').hidden = true;
  $('setup').hidden = false;
  $('result').textContent = '';
  notice(say('Choose a new room.', 'Виберіть нову кімнату.'));
});
async function allocateBoards(snapshot, owner) {
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
  if (credentials !== owner || stopped) {
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
  if (!credentials || polling || stopped) return;
  polling = true;
  const owner = credentials;
  try {
    const wire = await api('/snapshot');
    if (credentials !== owner) return;
    if (
      wire.contentHash !== credentials.contentHash ||
      wire.engineVersion !== credentials.engineVersion
    )
      throw new Error('The room content identity changed.');
    const snapshot = restoreTrustedRoomSnapshot(wire);
    if (!state || state.generation !== snapshot.generation) {
      sequence = 0;
      state = null;
      direction = null;
      boost = false;
      eventIds.clear();
      await allocateBoards(snapshot, owner);
    } else
      snapshot.engine.runs = snapshot.engine.runs.map((run, index) =>
        Object.assign(state.engine.runs[index], run),
      );
    if (credentials !== owner) return;
    sequence = Math.max(sequence, snapshot.seats[credentials.seat].acknowledged);
    state = snapshot;
    $('controls').hidden = snapshot.status !== 'playing';
    $('ready').hidden = !['waiting', 'paused'].includes(snapshot.status);
    $('pause').hidden = snapshot.status !== 'playing';
    $('rematch').hidden = $('receipt').hidden = snapshot.status !== 'finished';
    $('identity').textContent =
      `${snapshot.recipe.family} · ${snapshot.recipe.level.id} · ${snapshot.recipe.level.revision} · ${snapshot.contentHash}`;
    $('seats').textContent = snapshot.seats
      .map(
        (seat, index) =>
          `${index + 1}${index === credentials.seat ? say(' (you)', ' (ви)') : ''}: ${!seat.joined ? say('waiting for invite', 'очікує запрошення') : seat.ready ? say('ready', 'готово') : say('not ready', 'не готово')}`,
      )
      .join(' · ');
    notice(
      say(
        `Room ${snapshot.status}${snapshot.pauseReason ? ` · ${snapshot.pauseReason}` : ''}`,
        `Кімната: ${{ waiting: 'очікування', playing: 'гра', paused: 'пауза', finished: 'завершено', abandoned: 'залишена' }[snapshot.status]}`,
      ),
    );
    if (snapshot.result)
      $('result').textContent = snapshot.result.winner
        ? say(`Result: ${snapshot.result.winner}`, `Результат: ${snapshot.result.winner}`)
        : say(
            `Result: ${snapshot.result.outcome ?? snapshot.result.reason ?? 'finished'}`,
            `Результат: ${snapshot.result.outcome ?? 'завершено'}`,
          );
    // Repeated snapshots do not repeat effects, reactions or result ownership.
    for (const event of snapshot.events) eventIds.add(event.id);
    if (eventIds.size > 256) eventIds = new Set(snapshot.events.map((event) => event.id));
  } catch (error) {
    if (credentials !== owner) return;
    notice(
      say(
        `Connection interrupted: ${error.message}. Reconnecting…`,
        `Зв’язок перервано: ${error.message}. Повертаємося…`,
      ),
    );
  } finally {
    polling = false;
  }
}
let direction = null,
  boost = false;
let inputChain = Promise.resolve();
async function input(next = direction) {
  if (state?.status !== 'playing') return;
  direction = next;
  const owner = credentials,
    generation = state.generation;
  const captured = { direction, boost, support: boost };
  inputChain = inputChain.then(async () => {
    if (credentials !== owner || state?.generation !== generation || state?.status !== 'playing')
      return;
    try {
      await api('/input', { sequence: ++sequence, generation, ...captured });
    } catch (error) {
      if (credentials === owner && state?.generation === generation) {
        // A timed-out request may already have been accepted. Never reuse its sequence
        // for a different control; later snapshots reconcile the monotonic acknowledgement.
        sequence = Math.max(sequence, state.seats[owner.seat].acknowledged);
        notice(error.message);
      }
    }
  });
  return inputChain;
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
  if (event.code === 'Space') {
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
document.addEventListener('visibilitychange', () => {
  if (document.hidden && state?.status === 'playing') void api('/pause', {}).catch(() => {});
});
window.addEventListener('orientationchange', () => {
  if (state?.status === 'playing') void api('/pause', {}).catch(() => {});
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
        paused = state.status !== 'playing';
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
        painters[index]?.draw(canvas.getContext('2d'), run, dt, {
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
  try {
    const catalogue = await api('/catalogue');
    if (catalogue.protocol !== ROOM_PROTOCOL) throw new Error('Room protocol mismatch.');
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
      history.replaceState(null, '', location.pathname);
    } else {
      const previous = sessionStorage.getItem(SESSION_KEY);
      if (previous) await own(JSON.parse(previous));
      else
        notice(
          say(
            'Choose a mission, create a room, then share the invitation.',
            'Виберіть місію, створіть кімнату та поділіться запрошенням.',
          ),
        );
    }
  } catch (error) {
    notice(
      say(
        `Room service unavailable: ${error.message}. Local play is ready from the main game.`,
        `Сервіс кімнат недоступний: ${error.message}. Локальна гра доступна з головного меню.`,
      ),
    );
  }
}
setInterval(() => void poll(), 150);
window.addEventListener('pagehide', () => {
  stopped = true;
});
window.addEventListener('pageshow', () => {
  stopped = false;
});
requestAnimationFrame(frame);
void boot();
