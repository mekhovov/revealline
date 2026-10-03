import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, dirname, relative } from 'node:path';
import { canonicalJSON, required } from '../../game/data-json.mjs';
import { ROOM_CONTROL_PROTOCOL } from '../../game/online/room-client-lifecycle.mjs';
import { CLASSIC_SNAKE_LEVELS } from '../../game/snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../../game/snake/classic-setup.mjs';
import { FIRST_CONNECTION } from '../../game/coop/first-connection.mjs';
import { RELAY_YARD } from '../../game/coop/relay-yard.mjs';
import { prepareRunningEnemyLevel } from '../../game/hunt/running-enemies.mjs';
import { prepareTeamRunningEnemies } from '../../game/hunt/team-running-enemies.mjs';
import { createPursuitCampaignCandidates } from '../../game/content-design/pursuit-campaign-candidates.mjs';
import { createContentExecutionCatalog } from '../../game/content-design/execution.mjs';
import {
  ROOM_PROTOCOL,
  createAuthoritativeRoom,
  joinAuthoritativeRoom,
  touchAuthoritativeRoom,
  readyAuthoritativeRoom,
  pauseAuthoritativeRoom,
  submitAuthoritativeInput,
  stepAuthoritativeRoom,
  rematchAuthoritativeRoom,
  snapshotAuthoritativeRoom,
  exportAuthoritativeRoomResult,
  abandonAuthoritativeRoom,
} from '../../game/online/room-core.mjs';

const token = () => randomBytes(32).toString('hex');
const digest = (value) => createHash('sha256').update(canonicalJSON(value)).digest('hex');
const fail = (code, status, message) => {
  throw Object.assign(new TypeError(message), { code, status });
};
const root = fileURLToPath(new URL('../../', import.meta.url));
export async function roomEngineIdentity() {
  const files = new Map(),
    pending = [];
  for (const folder of ['game/core', 'game/coop', 'game/hunt', 'game/snake', 'game/online']) {
    for (const item of await readdir(resolve(root, folder), { withFileTypes: true }))
      if (item.isFile() && item.name.endsWith('.mjs')) pending.push(`${folder}/${item.name}`);
  }
  pending.push('game/data-json.mjs', 'services/rooms/server.mjs');
  // Shared tuning, geometry and validators live outside the five engine folders.
  // Bind their relative source dependencies too, not just the entry modules.
  while (pending.length) {
    const file = pending.pop();
    if (files.has(file)) continue;
    const bytes = await readFile(resolve(root, file));
    files.set(file, bytes);
    if (!/\.(?:mjs|js)$/.test(file)) continue;
    for (const match of bytes
      .toString('utf8')
      .matchAll(/\b(?:from\s+|import\s*(?:\(\s*)?)['"](\.[^'"]+\.(?:mjs|js|json))['"]/g)) {
      const dependency = relative(root, resolve(root, dirname(file), match[1]));
      required(!dependency.startsWith('..'), 'Room source dependency leaves the repository.');
      pending.push(dependency);
    }
  }
  const hash = createHash('sha256');
  for (const [file, bytes] of [...files].sort(([left], [right]) => left.localeCompare(right))) {
    hash.update(`${file}\0${bytes.length}\0`);
    hash.update(bytes);
  }
  return hash.digest('hex');
}

export async function roomCatalogue() {
  const pack = JSON.parse(
    await readFile(new URL('../../game/content/packs/fieldcraft.json', import.meta.url), 'utf8'),
  );
  const collect = (value) =>
    Array.isArray(value)
      ? value.flatMap(collect)
      : value && typeof value === 'object'
        ? value.version?.startsWith('xonix-level.')
          ? [value]
          : Object.values(value).flatMap(collect)
        : [];
  const capture = collect(pack);
  const pursuit = ['versus', 'team'].flatMap((mode) => {
    const source = createPursuitCampaignCandidates({ team: mode === 'team' });
    const executions = createContentExecutionCatalog(source, { mode });
    return executions.entries
      .filter((entry) => entry.difficulty === 'standard')
      .flatMap((entry) =>
        entry.campaign.levels.map((level) => ({
          id: `capture:${mode}:${entry.campaignId}:${level.id}`,
          family: 'capture',
          mode,
          title: { en: level.name ?? level.id, uk: level.name ?? level.id },
          level,
        })),
      );
  });
  return [
    ...CLASSIC_SNAKE_LEVELS.flatMap((entry) =>
      ['versus', 'team'].map((mode) => ({
        id: `snake:${mode}:${entry.id}`,
        family: 'snake',
        mode,
        title: entry.title,
        level: entry.level,
      })),
    ),
    ...capture.map((level) => ({
      id: `capture:versus:${level.id}`,
      family: 'capture',
      mode: 'versus',
      title: { en: level.name ?? level.id, uk: level.name ?? level.id },
      level,
    })),
    ...[FIRST_CONNECTION, RELAY_YARD].map((level) => ({
      id: `capture:team:${level.id}`,
      family: 'capture',
      mode: 'team',
      title: { en: level.name ?? level.id, uk: level.name ?? level.id },
      level,
    })),
    ...pursuit,
  ];
}
/** Dedicated service; static game hosting cannot own rooms. It accepts exact catalogue recipes only. */
export async function createRoomService({
  origins = ['http://127.0.0.1:8779', 'http://localhost:8779'],
  now = () => performance.now(),
  maxRooms = 64,
  allowPublic = false,
  catalogue = null,
} = {}) {
  const entries = catalogue ?? (await roomCatalogue());
  const engineVersion = await roomEngineIdentity();
  const rooms = new Map(),
    credentials = new Map(),
    invitations = new Map();
  const activations = new WeakMap();
  const syncActivation = (room, invalidate = false) => {
    const prior = activations.get(room);
    if (invalidate || prior?.status !== room.status || prior?.generation !== room.generation) {
      room.controlProtocol = ROOM_CONTROL_PROTOCOL;
      room.controlActivation = token();
      activations.set(room, { status: room.status, generation: room.generation });
    }
  };
  const allowed = new Set(origins);
  const read = async (request) => {
    let size = 0;
    const chunks = [];
    for await (const chunk of request) {
      size += chunk.length;
      required(size <= 4096, 'Room request is too large.');
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  };
  const admit = (selection) => {
    const entry = entries.find((item) => item.id === selection.id);
    required(entry, 'Choose an available exact room recipe.');
    required(['normal', 'slow', 'fast'].includes(selection.pace ?? 'normal'), 'Invalid pace.');
    required(
      ['authored', 'moving', 'varied'].includes(selection.targets ?? 'authored'),
      'Invalid prey rules.',
    );
    const level =
      entry.family === 'snake'
        ? prepareClassicSnakeLevel(entry, {
            pace: selection.pace ?? 'normal',
            format: 'campaign',
            targetRules: selection.targets ?? 'authored',
            preset: 'classic',
          })
        : selection.targets === 'authored' || !selection.targets
          ? entry.level
          : entry.mode === 'team'
            ? prepareTeamRunningEnemies(entry.level, {
                style: selection.targets === 'varied' ? 'varied' : 'original',
              })
            : prepareRunningEnemyLevel(entry.level, {
                style: selection.targets === 'varied' ? 'varied' : 'original',
              });
    const accepted = level.level ?? level;
    return { family: entry.family, mode: entry.mode, level: accepted, seed: selection.seed ?? 17 };
  };
  const allocate = (selection, publicRoom = false) => {
    required(rooms.size < maxRooms, 'The room service is full. Try again later.');
    const recipe = admit(selection),
      id = randomBytes(16).toString('hex');
    const room = createAuthoritativeRoom(recipe, {
      id,
      contentHash: digest(recipe),
      engineVersion,
      now: now(),
    });
    const bearer = token(),
      invite = token();
    syncActivation(room);
    credentials.set(bearer, { id, seat: 0 });
    invitations.set(invite, id);
    room.public = publicRoom;
    rooms.set(id, room);
    return {
      roomId: id,
      token: bearer,
      invite,
      seat: 0,
      protocol: ROOM_PROTOCOL,
      controlProtocol: ROOM_CONTROL_PROTOCOL,
      contentHash: room.contentHash,
      engineVersion,
    };
  };
  const join = (id) => {
    const room = rooms.get(id);
    required(room, 'The room no longer exists.');
    joinAuthoritativeRoom(room, now());
    const bearer = token();
    credentials.set(bearer, { id, seat: 1 });
    for (const [invite, value] of invitations) if (value === id) invitations.delete(invite);
    return {
      roomId: id,
      token: bearer,
      seat: 1,
      protocol: ROOM_PROTOCOL,
      controlProtocol: ROOM_CONTROL_PROTOCOL,
      contentHash: room.contentHash,
      engineVersion,
    };
  };
  const server = createServer(async (request, response) => {
    const origin = request.headers.origin;
    const headers = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    const send = (status, value) => {
      response.writeHead(status, headers);
      response.end(JSON.stringify(value));
    };
    try {
      if (!origin || !allowed.has(origin))
        fail('ORIGIN_NOT_ALLOWED', 403, 'This game origin is not approved for rooms.');
      headers['Access-Control-Allow-Origin'] = origin;
      headers.Vary = 'Origin';
      if (request.method === 'OPTIONS') {
        headers['Access-Control-Allow-Methods'] = 'GET, POST';
        headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
        return send(204, null);
      }
      const url = new URL(request.url, 'http://rooms.invalid');
      if (request.method === 'GET' && url.pathname === '/catalogue')
        return send(200, {
          protocol: ROOM_PROTOCOL,
          controlProtocol: ROOM_CONTROL_PROTOCOL,
          public: allowPublic,
          entries: entries.map(({ level, ...entry }) => ({ ...entry, revision: level.revision })),
        });
      if (request.method === 'POST' && url.pathname === '/rooms')
        return send(201, allocate(await read(request)));
      if (request.method === 'POST' && url.pathname === '/join') {
        const body = await read(request),
          id = invitations.get(body.invite);
        if (!id) fail('INVITE_UNAVAILABLE', 410, 'This invitation is invalid or already used.');
        return send(200, join(id));
      }
      if (request.method === 'POST' && url.pathname === '/matchmaking') {
        required(allowPublic, 'Public matchmaking is not enabled on this service.');
        const body = await read(request),
          identity = digest(admit(body));
        const available = [...rooms.values()].find(
          (room) =>
            room.public &&
            room.status === 'waiting' &&
            !room.seats[1].joined &&
            room.contentHash === identity,
        );
        return send(200, available ? join(available.id) : allocate(body, true));
      }
      const auth = credentials.get(request.headers.authorization?.replace(/^Bearer /, ''));
      if (!auth)
        fail('SEAT_UNAVAILABLE', 401, 'This seat is unavailable. Request a new invitation.');
      const room = rooms.get(auth.id);
      if (!room) fail('ROOM_UNAVAILABLE', 410, 'This room expired. Request a new invitation.');
      touchAuthoritativeRoom(room, auth.seat, now());
      syncActivation(room);
      if (request.method === 'GET' && url.pathname === '/snapshot')
        return send(200, snapshotAuthoritativeRoom(room));
      if (request.method === 'GET' && url.pathname === '/result')
        return send(200, exportAuthoritativeRoomResult(room));
      required(request.method === 'POST', 'Unsupported room operation.');
      const body = await read(request);
      // Body delivery can span a pause/resume or rematch. Check the current
      // service activation after reading, before admitting any queued action.
      if (
        ['/ready', '/pause', '/input', '/rematch'].includes(url.pathname) &&
        body.activation !== room.controlActivation
      )
        fail('STALE_ACTIVATION', 409, 'Refresh the room before sending new controls.');
      if (url.pathname === '/ready') readyAuthoritativeRoom(room, auth.seat, now());
      else if (url.pathname === '/pause') {
        pauseAuthoritativeRoom(room);
        // A reconnecting waiting/paused seat must not retain an earlier Ready.
        if (['waiting', 'paused'].includes(room.status))
          room.seats.forEach((seat) => {
            seat.ready = false;
          });
        syncActivation(room, true);
      } else if (url.pathname === '/input') submitAuthoritativeInput(room, auth.seat, body, now());
      else if (url.pathname === '/rematch') rematchAuthoritativeRoom(room, auth.seat, now());
      else if (url.pathname === '/leave') abandonAuthoritativeRoom(room, auth.seat, now());
      else throw new TypeError('Unsupported room operation.');
      syncActivation(room);
      send(200, {
        acknowledged: room.seats[auth.seat].acknowledged,
        status: room.status,
        generation: room.generation,
        controlActivation: room.controlActivation,
      });
    } catch (error) {
      send(error.status ?? 400, {
        error: String(error.message).slice(0, 240),
        code: error.code ?? 'INVALID_REQUEST',
      });
    }
  });
  let lastTick = now(),
    remainder = 0;
  const timer = setInterval(() => {
    const time = now();
    const elapsed = time - lastTick;
    lastTick = time;
    if (elapsed > 250) {
      for (const room of rooms.values()) {
        pauseAuthoritativeRoom(room, 'service-stall');
        syncActivation(room);
      }
      remainder = 0;
    } else remainder += Math.max(0, elapsed);
    const steps = Math.floor((remainder + 1e-7) / (1000 / 120));
    remainder -= steps * (1000 / 120);
    for (const [id, room] of rooms) {
      try {
        for (let tick = 0; tick < steps; tick++) stepAuthoritativeRoom(room, time);
      } catch {
        room.status = 'abandoned';
        room.result = { outcome: 'abandoned', reason: 'service-error' };
      }
      syncActivation(room);
      if (
        time - room.touchedAt > 120000 &&
        ['abandoned', 'finished', 'waiting'].includes(room.status)
      ) {
        rooms.delete(id);
        for (const [key, value] of credentials) if (value.id === id) credentials.delete(key);
        for (const [key, value] of invitations) if (value === id) invitations.delete(key);
      }
    }
  }, 4);
  timer.unref();
  server.on('close', () => clearInterval(timer));
  return server;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = await createRoomService({
    origins: (process.env.ROOM_ORIGINS ?? 'http://127.0.0.1:8779,http://localhost:8779').split(','),
    allowPublic: process.env.ROOM_PUBLIC === 'qualified',
  });
  const port = Number(process.env.PORT ?? 8783);
  server.listen(port, process.env.HOST ?? '127.0.0.1', () =>
    console.log(`RevealLine rooms listening on ${port}; source ${root}`),
  );
}
