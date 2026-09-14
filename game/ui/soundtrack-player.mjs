import { boundedJSON, canonicalJSON, required } from '../data-json.mjs';
import {
  BUILTIN_SOUNDTRACK_TRACKS,
  BUILTIN_SOUNDTRACK_PLAYLISTS,
  emptySoundtrackLibrary,
  resolveSoundtrackLibrary,
  resolveSoundtrackSelection,
  soundtrackOrder,
} from '../soundtrack.mjs';
import { validateTrack } from './music.mjs';
import { inspectMP3, ownSoundtrackBlob, throwIfSoundtrackAborted } from '../mp3.mjs';

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const cancel = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      reject(new DOMException('Music transition cancelled.', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', cancel);
      resolve();
    }, ms);
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) cancel();
  });
/** Session transport only. The host owns gestures, page lifecycle, settings persistence and SFX. */
export function createSoundtrackPlayer({
  soundscape,
  audioElement = globalThis.document?.createElement('audio'),
  readAsset,
  onChange = () => {},
  random = Math.random,
  URLImpl = globalThis.URL,
  fadeMs = 120,
} = {}) {
  required(
    soundscape?.persistentMusic === true &&
      [
        'setSongEndHandler',
        'pauseMusic',
        'resumeMusic',
        'musicPosition',
        'seekMusic',
        'enable',
        'update',
        'configure',
      ].every((key) => typeof soundscape[key] === 'function'),
    'A persistent Soundscape with transport hooks is required.',
  );
  required(
    audioElement &&
      typeof audioElement.play === 'function' &&
      typeof audioElement.addEventListener === 'function' &&
      typeof readAsset === 'function' &&
      typeof onChange === 'function' &&
      typeof random === 'function',
    'Soundtrack player requires media, storage and callback adapters.',
  );
  required(
    Number.isInteger(fadeMs) && fadeMs >= 0 && fadeMs <= 250,
    'Invalid music transition duration.',
  );
  const media = audioElement;
  let library = emptySoundtrackLibrary(),
    context = {},
    override = null,
    playlist = null,
    queue = [],
    index = -1,
    current = null,
    pending = null,
    dirty = false;
  let published = null,
    authored = null,
    lastPositionSecond = -1,
    resourceGeneration = 0,
    notice = null;
  let status = 'idle',
    error = null,
    desired = false,
    disposed = false,
    suspended = false,
    volume = soundscape.getSettings().music,
    fade = 1,
    url = null,
    generation = 0,
    operation = null,
    pendingSeek = null;
  let failed = new Set(),
    fallbackUsed = false,
    listeners = [];
  const gainLeases = new Map();
  const tracks = () => [
    ...BUILTIN_SOUNDTRACK_TRACKS,
    ...library.tracks,
    ...(authored ? [authored] : []),
    ...(published ? [published] : []),
  ];
  const resolve = () => {
    const selected = resolveSoundtrackSelection(
      { ...library, selection: { playlistId: override } },
      context,
    );
    if (selected.source === 'default' && published?.allowed())
      return {
        source: 'published',
        playlist: {
          id: 'builtin.published.current',
          title: published.title,
          trackIds: [published.id],
          order: 'ordered',
          repeat: 'all',
        },
      };
    if (selected.source === 'default' && authored)
      return {
        source: 'authored',
        playlist: {
          id: 'builtin.authored.current',
          title: authored.title,
          trackIds: [authored.id],
          order: 'ordered',
          repeat: 'all',
        },
      };
    return selected;
  };

  function position() {
    if (!current) return { positionSeconds: 0, durationSeconds: 0 };
    if (current.kind === 'synth') {
      const p = soundscape.musicPosition();
      return { ...p, positionSeconds: pendingSeek ?? p.positionSeconds };
    }
    const durationSeconds =
      current.kind === 'published'
        ? Number.isFinite(media.duration)
          ? Math.max(0, media.duration)
          : 0
        : current.asset.durationSeconds;
    return {
      positionSeconds:
        pendingSeek ??
        (Number.isFinite(media.currentTime)
          ? Math.max(0, Math.min(media.currentTime, durationSeconds))
          : 0),
      durationSeconds,
    };
  }
  function snapshot() {
    return Object.freeze({
      status,
      playing: status === 'playing',
      desired,
      track: current
        ? Object.freeze({
            id: current.id,
            title: current.title,
            artist: current.artist,
            kind: current.kind,
          })
        : null,
      playlistId: playlist?.id ?? null,
      pendingPlaylistId: pending?.playlist.id ?? null,
      selection: override,
      source: pending?.source ?? resolve().source,
      queue: Object.freeze([...queue]),
      queueIndex: index,
      volume,
      error,
      notice,
      ...position(),
    });
  }
  function emit() {
    try {
      onChange(snapshot());
    } catch {
      /* A view callback cannot change transport authority. */
    }
  }
  function gains() {
    const master = soundscape.getSettings().master;
    let factor = 1;
    for (const value of gainLeases.values()) factor = Math.min(factor, value);
    soundscape.configure({ music: volume * fade * factor });
    media.volume = Math.max(0, Math.min(1, master * volume * fade * factor));
  }
  /** Temporary attenuation only; the player remains the owner of base volume/intent.
   * Overlapping owners use the lowest factor. Each owner releases only its lease.
   */
  function acquireGain({ factor } = {}) {
    required(Number.isFinite(factor) && factor >= 0 && factor <= 1, 'Music gain must be 0..1.');
    required(!disposed, 'The soundtrack player is disposed.');
    const token = {};
    gainLeases.set(token, factor);
    try {
      gains();
      required(!disposed, 'The soundtrack player is disposed.');
    } catch (failure) {
      gainLeases.delete(token);
      try {
        gains();
      } catch {
        /* Preserve the failed mixer application; later transport updates can retry. */
      }
      throw failure;
    }
    return Object.freeze({
      release() {
        if (!gainLeases.delete(token) || disposed) return;
        gains();
      },
    });
  }
  function cancel() {
    generation++;
    operation?.abort();
    operation = null;
  }
  function clearMedia() {
    resourceGeneration++;
    for (const [type, fn] of listeners) media.removeEventListener(type, fn);
    listeners = [];
    media.pause();
    media.removeAttribute('src');
    try {
      media.load();
    } catch {}
    if (url !== null) {
      try {
        URLImpl.revokeObjectURL(url);
      } catch {}
      url = null;
    }
  }
  function bind(type, fn) {
    media.addEventListener(type, fn);
    listeners.push([type, fn]);
  }
  function install(selection, { after = null } = {}) {
    playlist = selection.playlist;
    queue = [...soundtrackOrder(playlist, { random, previousTrackId: after })];
    index = -1;
    if (after && playlist.order === 'ordered') {
      const at = queue.indexOf(after);
      if (at >= 0) index = at;
    }
    pending = null;
    dirty = false;
  }
  function nextIndex(natural) {
    if (natural && playlist?.repeat === 'one' && index >= 0 && !failed.has(queue[index]))
      return index;
    const at = index + 1;
    if (at < queue.length) return at;
    return playlist?.repeat === 'all' ? 0 : -1;
  }
  function playableIndex(start) {
    if (start < 0) return -1;
    for (let count = 0; count < queue.length; count++) {
      const at = (start + count) % queue.length;
      if (playlist.repeat !== 'all' && at < start) return -1;
      if (!failed.has(queue[at]) && tracks().some((t) => t.id === queue[at])) return at;
    }
    return -1;
  }
  async function fadeOut(signal) {
    if (status !== 'playing' || fadeMs === 0) return;
    for (let i = 1; i <= 4; i++) {
      throwIfSoundtrackAborted(signal);
      fade = 1 - i / 4;
      gains();
      await wait(fadeMs / 4, signal);
    }
  }
  async function startAt(at, { fading = false } = {}) {
    if (disposed || suspended) return false;
    cancel();
    const token = generation,
      controller = new AbortController();
    operation = controller;
    try {
      if (fading) await fadeOut(controller.signal);
      if (token !== generation) return false;
      soundscape.pauseMusic();
      clearMedia();
      index = at;
      current = tracks().find((t) => t.id === queue[index]) ?? null;
      pendingSeek = null;
      if (!current) return failedTrack('Track is unavailable.', token);
      status = desired ? 'loading' : 'paused';
      fade = 1;
      gains();
      emit();
      if (current.kind === 'synth') {
        soundscape.setTrack(current.recipe);
        soundscape.resetMusic();
        if (desired) {
          const allowed = await soundscape.enable();
          if (token !== generation || disposed) return false;
          if (!allowed) {
            status = 'blocked';
            error = 'Enable audio to play music.';
            emit();
            return false;
          }
          if (pendingSeek !== null) {
            soundscape.seekMusic(pendingSeek);
            pendingSeek = null;
          }
          soundscape.resumeMusic();
          status = 'playing';
        }
      } else {
        const blob =
          current.kind === 'published'
            ? await current.readBlob({ signal: controller.signal })
            : ownSoundtrackBlob(
                await readAsset(current.asset.sha256, { signal: controller.signal }),
              );
        throwIfSoundtrackAborted(controller.signal);
        if (current.kind === 'published') {
          required(
            blob instanceof Blob &&
              blob.size > 0 &&
              blob.size <= 4 * 1024 * 1024 &&
              ['audio/wav', 'audio/ogg', 'audio/mpeg'].includes(blob.type),
            'Published audio is unavailable.',
          );
        } else {
          const actual = await inspectMP3(blob, { signal: controller.signal });
          required(
            canonicalJSON(actual) === canonicalJSON(current.asset),
            'Stored audio bytes do not match this track.',
          );
        }
        if (token !== generation || disposed) return false;
        url = URLImpl.createObjectURL(blob);
        const expectedURL = url,
          resource = resourceGeneration;
        const valid = () =>
          resource === resourceGeneration &&
          !disposed &&
          url === expectedURL &&
          (!media.currentSrc || media.currentSrc === expectedURL);
        bind('ended', () => {
          if (valid() && desired && !suspended) void advance(true);
        });
        bind('error', () => {
          if (valid()) void failedTrack('This track could not be played.', generation);
        });
        bind('timeupdate', () => {
          if (valid()) emit();
        });
        bind('loadedmetadata', () => {
          if (valid() && pendingSeek !== null) {
            try {
              media.currentTime = pendingSeek;
            } catch {}
            pendingSeek = null;
          }
          if (valid()) emit();
        });
        media.preload = 'metadata';
        media.loop = false;
        media.src = url;
        media.load();
        gains();
        if (desired) {
          const enabled = soundscape.enable();
          if (
            current.kind === 'published' &&
            (!(await enabled) || token !== generation || disposed || !desired)
          )
            return false;
          await media.play();
          await enabled;
          if (token !== generation || disposed || !desired) return false;
          status = 'playing';
        }
      }
      error = null;
      emit();
      return status === 'playing';
    } catch (failure) {
      if (token !== generation || disposed || failure?.name === 'AbortError') return false;
      if (failure?.name === 'NotAllowedError') {
        status = 'blocked';
        error = 'Your browser needs an audio play action.';
        emit();
        return false;
      }
      return failedTrack(failure?.message || 'This track could not be played.', token);
    }
  }
  async function failedTrack(message, token) {
    if (token !== generation || disposed) return false;
    if (current) failed.add(current.id);
    error = message;
    notice = message;
    emit();
    let at = playableIndex(
      index + 1 < queue.length ? index + 1 : playlist?.repeat === 'all' ? 0 : -1,
    );
    if (at < 0 && !fallbackUsed) {
      fallbackUsed = true;
      install(resolveSoundtrackSelection(emptySoundtrackLibrary()));
      at = playableIndex(0);
    }
    if (at < 0) {
      desired = false;
      status = 'error';
      soundscape.pauseMusic();
      clearMedia();
      emit();
      return false;
    }
    // A failure skips each ID at most once until the next explicit user retry/selection.
    return startAt(at);
  }
  async function advance(natural = false) {
    if (disposed || suspended) return false;
    if (dirty || pending) {
      const next = resolve(),
        oldPlaylist = playlist?.id,
        oldTrack = current?.id;
      install(next, { after: oldPlaylist === next.playlist.id ? oldTrack : null });
    }
    const at = playableIndex(nextIndex(natural));
    if (at < 0) {
      cancel();
      desired = false;
      status = 'ended';
      soundscape.pauseMusic();
      media.pause();
      emit();
      return false;
    }
    return startAt(at, { fading: !natural });
  }
  function setAuthoredTrack(value) {
    let next = null;
    if (value !== null) {
      const recipe = boundedJSON(value, {
        maxBytes: 2048,
        maxNodes: 20,
        maxDepth: 2,
        maxString: 120,
      });
      const checked = validateTrack(recipe);
      required(checked.valid, checked.errors.join('; '));
      next = Object.freeze({
        id: 'builtin.authored',
        kind: 'synth',
        title: recipe.name,
        artist: 'Authored game soundtrack',
        recipe: Object.freeze(recipe),
      });
    }
    if (canonicalJSON(authored) === canonicalJSON(next)) return snapshot();
    authored = next;
    const selected = resolve();
    if (selected.source === 'authored' || playlist?.id === 'builtin.authored.current') {
      dirty = true;
      pending = selected;
    }
    emit();
    return snapshot();
  }
  /** Code-owned release fallback only; never enters the saved track library. */
  function setPublishedTrack(value) {
    if (disposed) return snapshot();
    if (value !== null)
      required(
        value &&
          /^published\.[a-f0-9]{64}$/.test(value.id) &&
          typeof value.title === 'string' &&
          typeof value.readBlob === 'function' &&
          typeof value.allowed === 'function',
        'Invalid published music adapter.',
      );
    if (!value && current?.kind === 'published') {
      cancel();
      clearMedia();
      soundscape.pauseMusic();
      current = null;
      status = 'paused';
    }
    published = value
      ? Object.freeze({
          ...value,
          title: value.title.slice(0, 160),
          artist: 'Published game theme',
          kind: 'published',
        })
      : null;
    const selected = resolve();
    if (selected.source === 'published' || playlist?.id === 'builtin.published.current') {
      dirty = true;
      pending = selected;
    }
    emit();
    return snapshot();
  }
  function setLibrary(value) {
    const next = resolveSoundtrackLibrary(value),
      previousStored = library.selection.playlistId;
    library = next;
    if (
      override !== null &&
      ![...next.playlists, ...BUILTIN_SOUNDTRACK_PLAYLISTS].some((p) => p.id === override)
    )
      override = null;
    if (!current || next.selection.playlistId !== previousStored)
      override = next.selection.playlistId;
    failed = new Set();
    fallbackUsed = false;
    dirty = true;
    pending = resolve();
    emit();
    return snapshot();
  }
  function setContext(value) {
    const owned = boundedJSON(value, { maxBytes: 4096, maxNodes: 20, maxDepth: 2, maxString: 512 });
    resolveSoundtrackSelection({ ...library, selection: { playlistId: override } }, owned);
    context = owned;
    const next = resolve();
    if (next.playlist.id !== playlist?.id) pending = next;
    else if (!dirty) pending = null;
    emit();
    return snapshot();
  }
  async function selectPlaylist(id) {
    resolveSoundtrackSelection({ ...library, selection: { playlistId: id } }, context);
    override = id;
    failed = new Set();
    fallbackUsed = false;
    install(resolve());
    return startAt(0, { fading: true });
  }
  async function play() {
    if (disposed || suspended) return false;
    desired = true;
    failed = new Set();
    fallbackUsed = false;
    if (
      current &&
      index >= 0 &&
      queue[index] === current.id &&
      status !== 'ended' &&
      status !== 'error' &&
      (current.kind === 'synth' || url !== null)
    ) {
      const token = generation;
      try {
        if (current.kind === 'synth') {
          const enabled = await soundscape.enable();
          if (token !== generation || disposed || !desired) return false;
          if (!enabled) {
            status = 'blocked';
            error = 'Enable audio to play music.';
            emit();
            return false;
          }
          if (token !== generation || !desired) return false;
          if (pendingSeek !== null) {
            soundscape.seekMusic(pendingSeek);
            pendingSeek = null;
          }
          soundscape.resumeMusic();
        } else {
          const enabled = soundscape.enable();
          if (
            current.kind === 'published' &&
            (!(await enabled) || token !== generation || disposed || !desired)
          )
            return false;
          await media.play();
          await enabled;
        }
        if (token !== generation || !desired) return false;
        status = 'playing';
        error = null;
        gains();
        emit();
        return true;
      } catch (failure) {
        if (token !== generation) return false;
        if (failure?.name === 'NotAllowedError') {
          status = 'blocked';
          error = 'Your browser needs an audio play action.';
          emit();
          return false;
        }
        return failedTrack(failure?.message || 'Playback failed.', token);
      }
    }
    if (!playlist || dirty || status === 'ended' || status === 'error') install(resolve());
    return startAt(Math.max(0, index));
  }
  function setIntent(value) {
    required(typeof value === 'boolean', 'Listening intent must be a boolean.');
    if (disposed) return snapshot();
    required(
      status !== 'playing' && status !== 'loading',
      'Restore listening intent only while music is inactive.',
    );
    desired = value;
    emit();
    return snapshot();
  }
  function pause() {
    if (disposed) return;
    desired = false;
    cancel();
    soundscape.pauseMusic();
    media.pause();
    fade = 1;
    gains();
    status = 'paused';
    emit();
  }
  function seek(seconds) {
    required(
      Number.isFinite(seconds) && seconds >= 0 && current && seconds <= position().durationSeconds,
      'Invalid music seek position.',
    );
    if (current.kind === 'synth') pendingSeek = soundscape.seekMusic(seconds) ? null : seconds;
    else if (media.readyState >= 1) media.currentTime = seconds;
    else pendingSeek = seconds;
    emit();
  }
  function setVolume(value) {
    required(Number.isFinite(value) && value >= 0 && value <= 1, 'Music volume must be 0..1.');
    volume = value;
    gains();
    emit();
  }
  async function previous() {
    if (disposed || suspended) return false;
    failed = new Set();
    fallbackUsed = false;
    if (position().positionSeconds > 3) {
      seek(0);
      return desired ? play() : false;
    }
    return startAt(Math.max(0, index - 1), { fading: true });
  }
  function update(active, theme, state = {}) {
    if (disposed) return;
    gains();
    soundscape.update(active, theme, state);
    if (current?.kind === 'synth' && status === 'playing') {
      const second = Math.floor(position().positionSeconds);
      if (second !== lastPositionSecond) {
        lastPositionSecond = second;
        emit();
      }
    }
  }
  function suspend() {
    if (disposed) return;
    cancel();
    suspended = true;
    media.pause();
    soundscape.suspend();
    status = 'suspended';
    emit();
  }
  async function resume() {
    if (disposed) return false;
    suspended = false;
    if (!desired) {
      status = 'paused';
      emit();
      return false;
    }
    return play();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    desired = false;
    cancel();
    soundscape.setSongEndHandler(null);
    soundscape.pauseMusic();
    clearMedia();
    fade = 1;
    gainLeases.clear();
    gains();
    status = 'disposed';
    emit();
  }
  soundscape.pauseMusic();
  soundscape.setSongEndHandler(() => {
    if (!disposed && desired && !suspended && current?.kind === 'synth') void advance(true);
  });
  return Object.freeze({
    setLibrary,
    setContext,
    setAuthoredTrack,
    setPublishedTrack,
    selectPlaylist,
    play,
    pause,
    setIntent,
    next: () => advance(false),
    previous,
    seek,
    setVolume,
    acquireGain,
    update,
    suspend,
    resume,
    dispose,
    snapshot,
  });
}
