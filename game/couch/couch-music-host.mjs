import { Soundscape } from '../ui/audio.mjs';
import { createSoundtrackPlayer } from '../ui/soundtrack-player.mjs';
import { attachSoundtrackPanel } from '../ui/soundtrack-panel.mjs';
import { createManagedMediaStore } from '../managed-media-store.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { createCouchMusicLibrary } from './couch-music-library.mjs';
import { createCouchMusicSession } from './couch-music-session.mjs';

/** Shared Settings controls and a single persistent page session. The host owns
 * modal/input scope and the frame pump; this adapter never resumes gameplay.
 */
export function attachCouchMusicHost({
  document: doc = globalThis.document,
  root,
  prefix,
  audioMaster,
  audioPreferences,
  soundscape,
  canOpen = () => true,
  getOwner = () => null,
  onOpen = () => {},
  onClose = () => {},
} = {}) {
  const media = doc.createElement('audio');
  if (typeof media.play !== 'function') return null;
  const ownsSound = !soundscape;
  const sound = soundscape ?? new Soundscape({ persistentMusic: true, audioMaster });
  sound.configure({ master: 1 });
  const manager = createManagedMediaStore({ storyMedia: true });
  const store = createSoundtrackStore({ managedStore: manager });
  const lifetime = new AbortController();
  let library,
    session,
    panel,
    disposed = false,
    visit = null,
    context = {},
    warning = '',
    contextWarning = '';
  const section = doc.createElement('section');
  section.setAttribute('data-couch-music', prefix);
  section.setAttribute('aria-label', 'Music');
  const make = (tag, name, text) => {
    const node = doc.createElement(tag);
    node.id = `${prefix}-music-${name}`;
    if (text !== undefined) node.textContent = text;
    section.append(node);
    return node;
  };
  make('h3', 'title', 'Music');
  const status = make('p', 'status', 'Loading the shared music library…');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const action = (name, text, fn) => {
    const node = make('button', name, text);
    node.type = 'button';
    node.onclick = () => run(fn);
    return node;
  };
  const play = action('play', 'Play music', () => session.play());
  action('pause', 'Pause music', () => session.pause());
  action('previous', 'Previous track', () => player.previous());
  action('next', 'Next track', () => player.next());
  const label = make('label', 'volume-label', 'Music volume · this session');
  label.setAttribute('for', `${prefix}-music-volume`);
  const volume = make('input', 'volume');
  for (const [key, value] of Object.entries({ type: 'range', min: '0', max: '1', step: '0.01' })) {
    volume.setAttribute(key, value);
    volume[key] = value;
  }
  volume.value = '0.55';
  volume.oninput = volume.onchange = () => {
    try {
      session.setVolume(Number(volume.value));
      render();
    } catch (error) {
      report(error);
    }
  };
  action('library', 'Music library', () => open());
  const retry = action('retry', 'Retry music library', () => load());
  make('p', 'note', 'Music volume lasts for this visit. Master sound is shared across game modes.');
  root.append(section);
  const player = createSoundtrackPlayer({
    soundscape: sound,
    audioElement: media,
    audioMaster,
    readAsset: (hash) => library.readAsset(hash),
    onChange: () => {
      if (session) render();
    },
  });
  library = createCouchMusicLibrary({ player, managedStore: manager });
  session = createCouchMusicSession({ player, library, soundscape: sound });
  panel = attachSoundtrackPanel({
    document: doc,
    store,
    player,
    audioMaster,
    musicSession: session,
    adoptLibrary: (value) => library.adoptVerifiedSnapshot(value),
    onLibrary: async () => {
      await player.prepare();
      render();
    },
    onError: report,
    getContext: () => context,
    onMasterMuted: (value) => audioPreferences.setMuted(value),
    onMasterVolume: (value) => audioPreferences.setVolume(value),
    beforeAudio: () => player.wake(),
    onVolume: () => render(),
    onPlayback: () => render(),
    onOpen: () => {
      if (!canOpen()) throw new Error('Return to Audio Settings to open the music library.');
      visit = getOwner();
      onOpen();
    },
    canRestoreFocus: () => !disposed && canOpen() && getOwner() === visit,
    onClose: () => {
      visit = null;
      onClose();
      render();
    },
  });
  function report(error) {
    if (disposed) return;
    warning = error?.message || String(error);
    render();
  }
  function render() {
    if (disposed || !session) return;
    const state = session.snapshot(),
      track = state.playback;
    const preparing =
      ['idle', 'loading', 'saving'].includes(state.library.status) || state.preparing;
    const text = preparing
      ? state.library.status === 'saving'
        ? 'Saving the shared music library…'
        : 'Preparing the shared music library…'
      : state.library.error
        ? `Music library: ${state.library.error}. Gameplay and built-in music remain available.`
        : warning ||
          contextWarning ||
          track.preparation?.message ||
          track.error ||
          `${track.track?.title || 'Selected soundtrack'} · ${track.status}${state.needsPlayGesture ? ' · Choose Play music.' : ''}`;
    if (status.textContent !== text) status.textContent = text;
    status.dataset.state = preparing
      ? 'busy'
      : state.library.error || warning || track.error
        ? 'error'
        : 'ready';
    retry.hidden = !state.library.error;
    retry.disabled = preparing;
    play.disabled = !state.readyForStart && !track.playing;
    if (doc.activeElement !== volume) volume.value = String(track.volume);
    panel?.update();
  }
  async function run(work) {
    if (disposed) return false;
    try {
      warning = '';
      const pending = work();
      render();
      return await pending;
    } catch (error) {
      report(error);
      return false;
    } finally {
      render();
    }
  }
  async function load() {
    const pending = session.loadLibrary({ signal: lifetime.signal });
    render();
    try {
      return await pending;
    } finally {
      render();
    }
  }
  async function open() {
    if (disposed || !canOpen()) return false;
    await panel.open();
    return panel.isOpen();
  }
  void run(load);
  return Object.freeze({
    sound,
    player,
    library,
    session,
    root: () => (panel.isOpen() ? panel.element : null),
    primary: () => doc.getElementById('soundtrack-close'),
    contains: (element) => section.contains(element) || panel.element.contains(element),
    back: () => panel.close(),
    open,
    start: () => run(() => session.start()),
    resume: () => run(() => session.resume()),
    suspend: () => {
      session.suspend();
      render();
    },
    update(active, theme, state) {
      session.update(active, theme, state);
      render();
    },
    setContext(value) {
      contextWarning = '';
      context = Object.freeze({ ...value });
      session.setAcceptedContext(context);
      render();
    },
    contextPending(themeId, message = 'Preparing exact mission music assignments…') {
      contextWarning = message;
      context = Object.freeze({ themeId });
      session.setAcceptedContext(context);
      render();
    },
    report,
    dispose() {
      if (disposed) return;
      disposed = true;
      lifetime.abort();
      panel.dispose();
      session.dispose();
      player.dispose();
      library.close();
      store.close();
      manager.close();
      if (ownsSound) sound.dispose();
      section.remove();
    },
  });
}
