// Development-only observation in the game's own realm. The caller installs
// this before importing the ordinary host; no production module imports it.
const installed = new WeakMap();
const channel = 'revealline-gameplay-audio-observation.v1';
const limits = Object.freeze({
  owners: 16,
  events: 240,
  starts: 400,
  decodes: 128,
  hashBytes: 8 * 1024 * 1024,
  pendingHashes: 8,
});
const short = (value, max = 160) => (typeof value === 'string' ? value.slice(0, max) : null);
const number = (value) => (Number.isFinite(value) ? value : null);
const hex = (bytes) =>
  [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, '0')).join('');

export function installGameplayAudioObserver({
  Soundscape,
  window: win = globalThis.window,
  document: doc = win.document,
  AudioContext = win.AudioContext,
  AudioBufferSourceNode = win.AudioBufferSourceNode,
  metadata = {},
} = {}) {
  if (installed.has(win)) throw new Error('One gameplay audio observer per document.');
  if (!Soundscape?.prototype || !AudioContext?.prototype || !AudioBufferSourceNode?.prototype)
    throw new Error('The native audio classes and exact host Soundscape are required.');
  const metadataJSON = JSON.stringify(metadata);
  if (metadataJSON.length > 65536) throw new Error('Observation metadata exceeds its bound.');
  const retainedMetadata = JSON.parse(metadataJSON);
  const owners = new Map(),
    contexts = new WeakMap(),
    buffers = new WeakMap(),
    sources = new WeakMap();
  const decoded = new Map(),
    events = [],
    starts = [],
    restorers = [],
    removers = [];
  const dropped = { owners: 0, events: 0, starts: 0, decodes: 0, hashes: 0, observerErrors: 0 };
  let serial = 0,
    activeDelivery = null,
    live = true,
    timer = null,
    pendingHashes = 0,
    pagehideQueued = false;
  let lifecycle = 'observing';
  const id = (map, object, prefix) => {
    if (!object || (typeof object !== 'object' && typeof object !== 'function')) return null;
    if (!map.has(object)) map.set(object, `${prefix}-${++serial}`);
    return map.get(object);
  };
  const stamp = () => ({ time: number(win.performance?.now?.()), at: new Date().toISOString() });
  const safe = (callback) => {
    try {
      return callback();
    } catch {
      dropped.observerErrors++;
      return undefined;
    }
  };
  const append = (list, value, kind) => {
    if (!live) return;
    if (list.length >= limits[kind]) {
      list.shift();
      dropped[kind]++;
    }
    list.push(value);
    schedule();
  };
  const owner = (sound) => {
    if (!owners.has(sound)) {
      if (owners.size >= limits.owners) {
        dropped.owners++;
        return null;
      }
      owners.set(sound, `sound-${++serial}`);
    }
    return owners.get(sound);
  };
  const state = (sound) => ({
    owner: owner(sound),
    enabled: Boolean(sound.enabled),
    disposed: Boolean(sound.disposed),
    paused: Boolean(sound.paused),
    gameplayPaused: Boolean(sound.gameplayPaused),
    master: { muted: Boolean(sound.audioMaster?.muted), volume: number(sound.audioMaster?.volume) },
    context: sound.context
      ? {
          id: id(contexts, sound.context, 'context'),
          state: short(sound.context.state),
          currentTime: number(sound.context.currentTime),
        }
      : null,
  });
  const bufferFacts = (buffer) =>
    buffer
      ? {
          id: id(buffers, buffer, 'buffer'),
          duration: number(buffer.duration),
          frames: number(buffer.length),
          channels: number(buffer.numberOfChannels),
          sampleRate: number(buffer.sampleRate),
        }
      : null;
  const voice = (sound, value) => ({
    name: short(value.name),
    board: typeof value.board === 'number' ? value.board : short(value.board),
    bus: short(value.bus),
    feedback: Boolean(value.feedback),
    cueFamily: short(value.cueFamily),
    source: id(sources, value.source, 'source'),
    buffer: bufferFacts(value.source?.buffer),
    // Bytes can be identical: retain exact buffer identity against the ready bank.
    fallbackBufferNames: [...(sound.feedbackDirector?.buffers ?? [])]
      .filter(([, buffer]) => buffer === value.source?.buffer)
      .map(([name]) => short(name))
      .slice(0, 16),
  });
  const eventFacts = (value) => ({
    type: short(value?.type),
    player: number(value?.player),
    tick: number(value?.tick),
    status: short(value?.status),
    levelId: short(value?.levelId),
  });
  function snapshot() {
    return {
      format: channel,
      metadata: retainedMetadata,
      lifecycle,
      live,
      limits,
      dropped: { ...dropped },
      observedAt: new Date().toISOString(),
      owners: [...owners.keys()].map(state),
      events: structuredClone(events),
      starts: structuredClone(starts),
      decodes: [...decoded.values()].map((entry) => ({ ...entry })),
      boundary:
        'Native normal-host event and source observations only; no generated inputs, events, state, buffers, clocks or acoustic acceptance.',
    };
  }
  function publish() {
    if (timer !== null) win.clearTimeout(timer);
    timer = null;
    safe(() => {
      const report = snapshot();
      const target = doc.getElementById('gameplay-audio-observer-report');
      if (target) target.textContent = JSON.stringify(report);
      if (win.parent !== win) win.parent.postMessage({ channel, report }, win.location.origin);
    });
  }
  function schedule() {
    if (live && timer === null) timer = win.setTimeout(publish, 100);
  }
  function wrap(prototype, key, handler) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, key),
      original = prototype[key];
    if (typeof original !== 'function') throw new Error(`Observation requires ${key}.`);
    const replacement = function (...args) {
      return handler.call(this, original, args);
    };
    Object.defineProperty(prototype, key, {
      configurable: true,
      writable: true,
      value: replacement,
    });
    restorers.push(() => {
      if (prototype[key] !== replacement) return;
      if (descriptor) Object.defineProperty(prototype, key, descriptor);
      else delete prototype[key];
    });
  }
  function listen(target, type, callback) {
    target.addEventListener(type, callback);
    removers.push(() => target.removeEventListener(type, callback));
  }
  function dispose() {
    if (!live) return;
    lifecycle = 'observer-stopped';
    live = false;
    if (timer !== null) win.clearTimeout(timer);
    timer = null;
    for (const restore of restorers.reverse()) safe(restore);
    for (const remove of removers) safe(remove);
    publish();
    installed.delete(win);
  }
  const api = Object.freeze({ snapshot, dispose });
  try {
    wrap(Soundscape.prototype, 'configure', function (original, args) {
      const result = Reflect.apply(original, this, args);
      safe(() => {
        owner(this);
        schedule();
      });
      return result;
    });
    wrap(Soundscape.prototype, 'events', function (original, args) {
      const previous = activeDelivery;
      const delivery = safe(() => ({
        id: `delivery-${++serial}`,
        ...stamp(),
        owner: owner(this),
        board:
          typeof args[3]?.board === 'number' ? args[3].board : (short(args[3]?.board) ?? 'solo'),
        mode: short(args[3]?.mode),
        levelId: short(args[1]?.level?.id),
        tick: number(args[1]?.tick),
        status: short(args[1]?.status),
        events: Array.isArray(args[0]) ? args[0].slice(0, 32).map(eventFacts) : [],
        eventOverflow: Math.max(0, (args[0]?.length ?? 0) - 32),
        starts: [],
      }));
      activeDelivery = delivery;
      try {
        const result = Reflect.apply(original, this, args);
        safe(() => {
          if (delivery && (delivery.events.length || delivery.starts.length)) {
            delivery.state = state(this);
            delivery.voices = [...(this.voices ?? [])]
              .filter((value) => delivery.starts.includes(id(sources, value.source, 'source')))
              .slice(0, 64)
              .map((value) => voice(this, value));
            append(events, delivery, 'events');
          }
        });
        return result;
      } finally {
        activeDelivery = previous;
      }
    });
    wrap(Soundscape.prototype, 'dispose', function (original, args) {
      const result = Reflect.apply(original, this, args);
      safe(() => {
        owner(this);
        schedule();
        // Observe completion, returning the exact original Promise/return value.
        if (result?.then)
          result.then(
            () => {
              if (live) publish();
            },
            () => {
              if (live) schedule();
            },
          );
      });
      return result;
    });
    wrap(AudioContext.prototype, 'decodeAudioData', function (original, args) {
      // Copy before the native decoder may detach its input, but do not delay,
      // hold, replace, transcode or manufacture the native decoder result.
      let copied = null;
      safe(() => {
        if (
          args[0] instanceof ArrayBuffer &&
          args[0].byteLength <= limits.hashBytes &&
          pendingHashes < limits.pendingHashes
        )
          copied = args[0].slice(0);
        else dropped.hashes++;
      });
      const result = Reflect.apply(original, this, args);
      safe(() => {
        if (!copied || !result?.then) return;
        pendingHashes++;
        const context = id(contexts, this, 'context'),
          bytes = copied.byteLength;
        const native = result.then(
          (buffer) => ({ buffer }),
          (error) => ({ decodeError: error }),
        );
        const hashed = Promise.resolve()
          .then(() => win.crypto.subtle.digest('SHA-256', copied))
          .then(
            (digest) => ({ sha256: hex(digest) }),
            (error) => ({ hashError: error }),
          );
        Promise.all([native, hashed])
          .then(([outcome, hash]) =>
            safe(() => {
              if (!live) return;
              if (outcome.decodeError) {
                append(
                  events,
                  {
                    kind: 'native-decode-rejected',
                    context,
                    bytes,
                    error: short(outcome.decodeError.name),
                    ...stamp(),
                  },
                  'events',
                );
                return;
              }
              if (hash.hashError) {
                append(
                  events,
                  {
                    kind: 'observer-hash-error',
                    context,
                    bytes,
                    error: short(hash.hashError.name),
                    ...stamp(),
                  },
                  'events',
                );
                return;
              }
              const facts = bufferFacts(outcome.buffer);
              if (decoded.size >= limits.decodes) {
                decoded.delete(decoded.keys().next().value);
                dropped.decodes++;
              }
              decoded.set(facts.id, { ...facts, context, bytes, sha256: hash.sha256, ...stamp() });
              schedule();
            }),
          )
          .finally(() => {
            pendingHashes--;
          });
      });
      return result;
    });
    wrap(AudioBufferSourceNode.prototype, 'start', function (original, args) {
      const result = Reflect.apply(original, this, args);
      safe(() => {
        const source = id(sources, this, 'source');
        if (activeDelivery && activeDelivery.starts.length < 128)
          activeDelivery.starts.push(source);
        else if (activeDelivery) dropped.starts++;
        append(
          starts,
          {
            source,
            delivery: activeDelivery?.id ?? null,
            owner: activeDelivery?.owner ?? null,
            buffer: bufferFacts(this.buffer),
            context: id(contexts, this.context, 'context'),
            when: number(args[0]),
            offset: number(args[1]),
            duration: number(args[2]),
            ...stamp(),
          },
          'starts',
        );
      });
      return result;
    });
    const output = doc.createElement('output');
    output.id = 'gameplay-audio-observer-report';
    output.hidden = true;
    doc.body.append(output);
    listen(win, 'message', (event) => {
      if (
        event.source !== win.parent ||
        event.origin !== win.location.origin ||
        event.data?.channel !== channel
      )
        return;
      if (event.data.action === 'snapshot') publish();
      if (event.data.action === 'stop') dispose();
    });
    listen(win, 'pagehide', (event) => {
      lifecycle = event.persisted ? 'bfcache-pagehide' : 'pagehide';
      // Unloading documents need not run another timer. Observe this boundary
      // now, then the ordinary synchronous host handlers in one coalesced job.
      // Async context closure is reported only by the actual dispose completion.
      publish();
      if (!pagehideQueued) {
        pagehideQueued = true;
        queueMicrotask(() => {
          pagehideQueued = false;
          if (live) publish();
        });
      }
    });
    listen(win, 'pageshow', () => {
      lifecycle = 'observing';
      schedule();
    });
    listen(win, 'blur', schedule);
    listen(win, 'focus', schedule);
    listen(doc, 'visibilitychange', schedule);
    listen(doc, 'click', schedule);
    listen(doc, 'keydown', schedule);
    installed.set(win, api);
    publish();
    return api;
  } catch (error) {
    dispose();
    throw error;
  }
}
