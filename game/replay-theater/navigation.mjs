import { localizedText, t } from '../i18n/index.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { attachControllerConfirmGuard } from '../ui/controller-confirm-guard.mjs';
import { createControllerConfirmLifecycle } from '../ui/controller-confirm-lifecycle.mjs';

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
  const now = () => win.performance?.now?.() ?? Date.now();
  const $ = (id) => doc.getElementById(id),
    router = createControllerRouter({ readPads, eventTarget: win, now });
  let destroyed = false,
    active = !doc.hidden,
    status = '',
    jumpTimer = null,
    jumpGeneration = 0,
    lifecycle;
  const foreground = () => !destroyed && active && !doc.hidden && doc.hasFocus?.() !== false;
  const scope = () => (pending() ? 'theater-loading' : 'theater');
  const guard = attachControllerConfirmGuard({
    document: doc,
    now,
    confirmPressed: () => foreground() && router.menuConfirmPressed(),
    beforeNativeActivation: (event) => {
      if (foreground()) lifecycle?.beforeNativeActivation(event);
    },
  });
  const defer = win.setTimeout?.bind(win) ?? globalThis.setTimeout,
    clearDeferred = win.clearTimeout?.bind(win) ?? globalThis.clearTimeout;
  const listeners = [];
  const listen = (target, type, callback, options) => {
    target?.addEventListener?.(type, callback, options);
    listeners.push(() => target?.removeEventListener?.(type, callback, options));
  };
  function hint(message) {
    const node = $('navigation-status');
    if (node) localizedText(node, typeof message === 'function' ? message : () => message);
  }
  const controllerStatusKeys = {
    disposed: 'interface:controllerInputIsStopped',
    unavailable: 'interface:controllerAccessIsUnavailableKeyboardAndTouchRemainAvailable',
    disconnected: 'interface:controllerDisconnectedReleaseControlsThenPressAFaceButtonTo',
    joined: 'interface:controllerJoinedReleaseControlsToContinue',
    unsupported: 'interface:thisControllerHasNoStandardMappingKeyboardAndTouchRemain',
    'waiting-controller': 'interface:connectAControllerAndUseItWhileThisPageIs',
    'ready-to-join': 'interface:pressAFaceButtonOrMenuToJoin',
    'waiting-neutral': 'interface:releaseTheControllerButtonsAndMovementStick',
    connected: 'interface:dPadMovesFocusSouthConfirmsEastGoesBackMenu',
  };
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
  const cancelJump = () => {
    jumpGeneration++;
    if (jumpTimer !== null) clearDeferred(jumpTimer);
    jumpTimer = null;
  };
  const jump = $('jump-playback');
  listen(jump, 'click', (event) => {
    if (
      destroyed ||
      !active ||
      event.defaultPrevented ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      event.shiftKey ||
      (event.button !== undefined && event.button !== 0) ||
      jump.getAttribute('href') !== '#playback' ||
      jump.hasAttribute('download') ||
      !['', '_self'].includes((jump.getAttribute('target') || '').toLowerCase())
    )
      return;
    cancelJump();
    const generation = jumpGeneration;
    // Preserve native fragment scrolling/history. Its default action may leave
    // focus on BODY, so hand off only afterward and while this intent is current.
    jumpTimer = defer(() => {
      jumpTimer = null;
      if (
        destroyed ||
        !active ||
        doc.hidden ||
        doc.hasFocus?.() === false ||
        event.defaultPrevented ||
        generation !== jumpGeneration ||
        (doc.activeElement && ![doc.body, jump, $('playback')].includes(doc.activeElement))
      )
        return;
      router.clear();
      focus(preferred());
    }, 0);
  });
  // A newer user action owns focus, even when it does not focus an element.
  listen(doc, 'keydown', cancelJump, true);
  listen(doc, 'pointerdown', cancelJump, true);
  function back() {
    if (pending()) {
      cancelLoad();
      focus(preferred());
    } else {
      pause();
      focus($('return-game'));
      hint(
        () =>
          `Playback paused. ${$('return-game').textContent.trim() || t('interface:return')} is focused; activate it to leave.`,
      );
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
    getScope: scope,
    getDefaultFocus: preferred,
    keyboard: true,
    onBack: back,
    onMenu: () => {
      if (pending()) back();
      else {
        pause();
        focus(preferred());
        router.clear();
        hint(() => t('interface:playbackPausedChoosePlayWhenReady'));
      }
    },
    activateControl: (element) => guard.activate(element),
    onNativeInput: (event) => {
      lifecycle?.nativeInput(event);
      router.clear();
    },
    onHint: hint,
  });
  lifecycle = createControllerConfirmLifecycle({
    document: doc,
    readConfirm: (options) => router.readMenuConfirm(options),
    getContext: () => ({
      scope: scope(),
      root: doc.body,
      focused: doc.activeElement,
      active: foreground(),
    }),
    navigation,
    guard,
    now,
  });
  function suspend() {
    if (destroyed) return;
    cancelJump();
    active = false;
    lifecycle.cancel('theater-inactive', { hard: true });
    router.clear();
    navigation.clear();
    if (pending()) cancelLoad();
    pause();
    onInactive();
  }
  function wake() {
    if (destroyed) return;
    active = true;
    lifecycle.cancel('theater-wake', { hard: true });
    router.clear();
    navigation.clear();
  }
  function destroy() {
    if (destroyed) return;
    suspend();
    destroyed = true;
    lifecycle.destroy();
    router.destroy();
    navigation.destroy();
    guard.destroy();
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
      const sampledScope = scope();
      const frame = router.sample({
        scope: sampledScope,
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
        const key = controllerStatusKeys[status];
        hint(key ? () => t(key) : frame.status.message);
      }
      if (status === 'joined') navigation.engage();
      lifecycle.sample(frame.confirmSnapshot);
      if (foreground() && sampledScope === scope())
        navigation.handle({ ...frame.ui, confirm: false });
    },
  };
}
