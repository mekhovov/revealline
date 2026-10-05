import { attachInput } from '../ui/input.mjs';
import { createControllerRouter, neutralControllerFlight } from '../ui/controller-router.mjs';

/** One assigned controller owns both room menus and native steering. The host
 * still owns Ready/Pause and all simulation; this adapter only samples input. */
export function attachRoomInput({
  arena,
  active,
  getScope,
  onPause,
  onSteer,
  onNavigate,
  onGamepad = () => {},
  readPads,
}) {
  const router = createControllerRouter({ readPads, autoJoin: true });
  let command = neutralControllerFlight(),
    status = null,
    destroyed = false;
  const input = attachInput({
    arena,
    active,
    continuousSteering: () => true,
    readControllerCommand: () => command,
    onPause: () => {
      clear();
      onPause();
    },
    onSteer,
  });
  function clear() {
    command = neutralControllerFlight();
    router.clear();
    input.clear();
  }
  const hidden = () => {
    if (document.hidden) clear();
  };
  // Use the same boundary as rooms.css. A resized desktop/hybrid window can
  // relocate held touch controls without emitting an orientationchange event.
  const sideControls = window.matchMedia?.(
    '(max-height: 500px) and (orientation: landscape) and (max-width: 899px), (max-height: 500px) and (orientation: landscape) and (pointer: coarse)',
  );
  const layoutChanged = () => {
    const playing = active();
    clear();
    if (playing) onPause();
  };
  sideControls?.addEventListener('change', layoutChanged);
  // The picker has no room credentials yet, so transport suspension cannot
  // own its input cleanup. Foreground loss always retires physical menu holds.
  window.addEventListener('blur', clear);
  document.addEventListener('visibilitychange', hidden);
  return Object.freeze({
    clear,
    poll() {
      if (destroyed) return input.poll();
      if (document.hidden || document.hasFocus?.() === false) {
        clear();
        return input.poll();
      }
      const scope = getScope(),
        frame = router.sample({ scope });
      command = frame.flight;
      if (frame.status.code !== status) {
        status = frame.status.code;
        onGamepad(frame.status.message);
      }
      if (frame.disconnected) {
        clear();
        if (active()) onPause();
      } else if (scope !== 'flight') {
        onNavigate(frame.ui);
      }
      // A menu action may synchronously close its dialog. The sample belongs
      // to the old scope and cannot become a flight command in that activation.
      return input.poll();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      clear();
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', hidden);
      sideControls?.removeEventListener('change', layoutChanged);
      input.destroy();
      router.destroy();
    },
  });
}
