import { createControllerRouter } from '../ui/controller-router.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';

/** Standalone, silent playback navigation. Commands operate native controls;
 * they never enter the recording or read the player's profile. */
export function attachReplayNavigation({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  readPads,
  pending,
  cancelLoad,
  pause,
  togglePlay,
  step,
  onInactive = () => {},
  onDispose = () => {},
} = {}) {
  const $ = (id) => doc.getElementById(id),
    router = createControllerRouter({ readPads, eventTarget: win });
  let destroyed = false,
    active = !doc.hidden,
    status = '';
  const listeners = [];
  const listen = (target, type, callback, options) => {
    target?.addEventListener?.(type, callback, options);
    listeners.push(() => target?.removeEventListener?.(type, callback, options));
  };
  function hint(message) {
    const node = $('navigation-status');
    if (node && node.textContent !== message) node.textContent = message;
  }
  const preferred = () =>
    pending()
      ? $('cancel-load')
      : !$('play-pause').disabled
        ? $('play-pause')
        : !$('restart').disabled
          ? $('restart')
          : $('load-example');
  const focus = (node) => {
    node?.focus({ preventScroll: true });
    node?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  function back() {
    if (pending()) {
      cancelLoad();
      focus(preferred());
    } else {
      pause();
      focus($('return-game'));
      hint('Playback paused. Back to the game is focused; activate it to leave.');
    }
    router.clear();
  }
  // The shared keyboard adapter excludes canvases. Preserve the theater's
  // documented shortcuts before its document capture listener runs.
  listen(
    doc,
    'keydown',
    (event) => {
      if (
        destroyed ||
        event.defaultPrevented ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.target !== $('board') ||
        !['Space', 'ArrowRight'].includes(event.code)
      )
        return;
      event.preventDefault();
      router.clear();
      if (!event.repeat) (event.code === 'Space' ? togglePlay : step)();
    },
    true,
  );
  const navigation = attachControllerNavigation({
    document: doc,
    getRoot: () => doc.body,
    getScope: () => (pending() ? 'theater-loading' : 'theater'),
    getDefaultFocus: preferred,
    keyboard: true,
    onBack: back,
    onMenu: () => {
      if (pending()) back();
      else {
        pause();
        focus(preferred());
        router.clear();
        hint('Playback paused. Choose Play when ready.');
      }
    },
    onNativeInput: () => router.clear(),
    onHint: hint,
  });
  function suspend() {
    if (destroyed) return;
    active = false;
    router.clear();
    navigation.clear();
    if (pending()) cancelLoad();
    pause();
    onInactive();
  }
  function wake() {
    if (destroyed) return;
    active = true;
    router.clear();
    navigation.clear();
  }
  function destroy() {
    if (destroyed) return;
    suspend();
    destroyed = true;
    router.destroy();
    navigation.destroy();
    listeners.forEach((remove) => remove());
    onDispose();
  }
  listen(win, 'blur', suspend);
  listen(win, 'focus', wake);
  listen(win, 'pagehide', (event) => (event.persisted ? suspend() : destroy()));
  listen(win, 'pageshow', wake);
  listen(doc, 'visibilitychange', () => (doc.hidden ? suspend() : wake()));
  return {
    suspend,
    destroy,
    sample(now) {
      if (destroyed || !active || doc.hidden || doc.hasFocus?.() === false) return;
      const frame = router.sample({
        scope: pending() ? 'theater-loading' : 'theater',
        timeMs: now,
      });
      navigation.sync();
      if (frame.disconnected) {
        pause();
        navigation.clear();
        onInactive();
      }
      if (frame.status.code !== status) {
        status = frame.status.code;
        hint(
          status === 'connected'
            ? 'D-pad moves focus · South confirms · East goes back · Menu pauses playback.'
            : frame.status.message,
        );
      }
      if (status === 'joined') navigation.engage();
      else navigation.handle(frame.ui);
    },
  };
}
