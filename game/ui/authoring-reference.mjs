import { mountAuthoringInputHost } from './authoring-input-host.mjs';
import { registerAuthoringEditor } from './authoring-editors.mjs';
import { authoringAttribute, authoringLabel } from './authoring-copy.mjs';
import { setMenuIcon } from './native-menu-icons.mjs';

const owners = new WeakMap();

export function createReferenceScrollAdapter(element, win) {
  let active = false;
  return {
    enter() {
      active = true;
      element.setAttribute('aria-pressed', 'true');
      return true;
    },
    isCurrent: () => active && element.isConnected && !element.ownerDocument.hidden,
    focus: () => element.focus({ preventScroll: true }),
    handle(command) {
      if (command.back || command.menu) return 'cancel';
      if (command.confirm || command.confirmCommit) return 'done';
      const step = Math.max(80, Math.round(win.innerHeight * 0.6));
      const delta = { up: [0, -step], down: [0, step], left: [-step, 0], right: [step, 0] }[
        command.direction
      ];
      if (delta) win.scrollBy({ left: delta[0], top: delta[1], behavior: 'instant' });
    },
    exit() {
      active = false;
      element.setAttribute('aria-pressed', 'false');
    },
  };
}

/** Native media remains the playback owner. Explicit DOM buttons/range expose
 * its commands to the shared navigator; no autoplay or key simulation. */
export function attachReferenceMedia(media) {
  const doc = media.ownerDocument,
    nativeControls = media.controls;
  const controls = doc.createElement('div'),
    play = doc.createElement('button'),
    mute = doc.createElement('button'),
    seek = doc.createElement('input'),
    status = doc.createElement('span');
  controls.className = 'authoring-reference-media';
  play.type = mute.type = 'button';
  seek.type = 'range';
  seek.min = '0';
  seek.max = '0';
  seek.step = '1';
  seek.value = '0';
  authoringAttribute(seek, 'aria-label', 'mediaPosition');
  status.setAttribute('role', 'status');
  controls.append(play, mute, seek, status);
  media.after(controls);
  media.controls = false;
  let disposed = false,
    pendingPlay = false;
  const refresh = () => {
    authoringLabel(play, media.paused ? 'playMedia' : 'pauseMedia');
    setMenuIcon(play, 'play');
    authoringLabel(mute, media.muted ? 'unmuteMedia' : 'muteMedia');
    setMenuIcon(mute, media.muted ? 'mute' : 'sound');
    seek.disabled = !Number.isFinite(media.duration) || media.duration <= 0;
    seek.max = seek.disabled ? '0' : String(media.duration);
    seek.value = String(media.currentTime || 0);
  };
  play.onclick = async () => {
    if (!media.paused || pendingPlay) {
      pendingPlay = false;
      media.pause();
      refresh();
      return;
    }
    pendingPlay = true;
    status.textContent = '';
    try {
      await media.play();
      if (disposed || !pendingPlay) media.pause();
    } catch {
      if (!disposed) authoringLabel(status, 'mediaUnavailable');
    } finally {
      pendingPlay = false;
      if (!disposed) refresh();
    }
  };
  mute.onclick = () => {
    media.muted = !media.muted;
    refresh();
  };
  seek.oninput = () => {
    if (!seek.disabled)
      media.currentTime = Math.max(0, Math.min(media.duration, Number(seek.value)));
  };
  const events = [
    'loadedmetadata',
    'durationchange',
    'timeupdate',
    'play',
    'pause',
    'ended',
    'volumechange',
  ];
  events.forEach((event) => media.addEventListener(event, refresh));
  refresh();
  return {
    pause() {
      pendingPlay = false;
      media.pause();
    },
    destroy() {
      disposed = true;
      pendingPlay = false;
      media.pause();
      events.forEach((event) => media.removeEventListener(event, refresh));
      controls.remove();
      media.controls = nativeControls;
    },
  };
}

export function mountAuthoringReference({
  document: doc = globalThis.document,
  window: win = doc.defaultView,
} = {}) {
  if (owners.has(doc)) return owners.get(doc);
  const returnLink = doc.createElement('a'),
    read = doc.createElement('button'),
    help = doc.createElement('span');
  let fallback = new URL('../../authoring/asset-studio/', import.meta.url),
    catalogHome = false;
  const home = doc.querySelector('meta[name="revealline-reference-home"]')?.content;
  if (home) {
    const candidate = new URL(home, win.location.href);
    if (candidate.origin === win.location.origin) {
      fallback = candidate;
      catalogHome = true;
    }
  }
  let destination = fallback;
  try {
    const previous = new URL(doc.referrer);
    if (
      previous.origin === win.location.origin &&
      previous.href !== win.location.href &&
      !/\/game\/test\//.test(previous.pathname) &&
      /\/(?:authoring|game)\//.test(previous.pathname)
    )
      destination = previous;
  } catch {
    /* Direct gallery entry returns to the authoring owner. */
  }
  returnLink.href = destination.href;
  authoringLabel(
    returnLink,
    destination === fallback ? (catalogHome ? 'returnCatalog' : 'returnLibrary') : 'returnPage',
  );
  setMenuIcon(returnLink, 'back');
  read.type = 'button';
  read.className = 'authoring-reference-read';
  authoringLabel(read, 'readPage');
  setMenuIcon(read, 'content');
  authoringLabel(help, 'readHelp');
  help.className = 'authoring-input-hint';
  const host = mountAuthoringInputHost({
    document: doc,
    window: win,
    onPageBack: () => returnLink.click(),
  });
  const rail = doc.querySelector('.authoring-input-rail');
  rail.classList.add('authoring-reference-rail');
  rail.append(returnLink, read, help);
  if (destination.pathname === win.location.pathname)
    returnLink.onclick = (event) => {
      event.preventDefault();
      win.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      rail.querySelector('button')?.focus();
    };
  if (catalogHome) {
    const originalReturn = doc.querySelector('main .return-link');
    if (originalReturn) {
      originalReturn.href = fallback.href;
      originalReturn.onclick = returnLink.onclick;
      authoringLabel(originalReturn, 'returnCatalog');
    }
  }
  const reader = createReferenceScrollAdapter(read, win);
  read.onclick = () => reader.enter();
  const unregister = registerAuthoringEditor(read, reader, {
    keyboard: true,
  });
  const media = [...doc.querySelectorAll('audio,video')].map(attachReferenceMedia);
  const pause = () => media.forEach((owner) => owner.pause());
  win.addEventListener('blur', pause);
  doc.addEventListener('visibilitychange', pause);
  const originalDestroy = host.destroy;
  host.destroy = () => {
    unregister();
    media.forEach((owner) => owner.destroy());
    win.removeEventListener('blur', pause);
    doc.removeEventListener('visibilitychange', pause);
    originalDestroy();
    owners.delete(doc);
  };
  owners.set(doc, host);
  return host;
}
