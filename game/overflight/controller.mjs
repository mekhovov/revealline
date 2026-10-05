import {
  resolveControllerBindings,
  sampleControllerStick,
  controllerBindingLabels,
  controllerStickLabel,
} from '../controller-bindings.mjs';
import { createControllerRouter } from '../ui/controller-router.mjs';
import { createSoloRadioInput } from '../ui/solo-radio-input.mjs';
import { mapProfile } from '../couch/controller-profiles.mjs';
import { loadLibrary } from '../library.mjs';
import { editionIdFromLocation, resolveEditionContext } from '../edition-context.mjs';
import { t } from '../i18n/index.mjs';

// Only an absent preference gets the mode's RT dash default. An explicit shared
// mapping, including the ordinary game's RB default, remains exactly as saved.
export function overflightControllerBindings(saved = null) {
  const bindings = resolveControllerBindings(saved);
  if (saved == null) bindings.flight.buttons.boost = 7;
  return bindings;
}

/** Read the same release/edition profile as native play, without owning or
 * writing another settings store. Corrupt preferences never become new defaults. */
export async function loadOverflightControllerPreferences({
  window: win = globalThis.window,
  version,
} = {}) {
  if (version === undefined) {
    version = 'DEV';
    try {
      const response = await win.fetch(new URL('../build-info.json', import.meta.url));
      if (response.ok) version = (await response.json()).version;
    } catch {
      // Source checkouts have no generated build-info.json, like native play.
    }
  }
  try {
    const { profileKey } = resolveEditionContext({
      version,
      editionId: editionIdFromLocation(win.location),
    });
    const saved = loadLibrary(win.localStorage, profileKey);
    return {
      profileKey,
      version,
      bindings: saved.library.preferences.controllerBindings,
      enabled: !saved.warning,
      warning: saved.warning,
    };
  } catch {
    return {
      version,
      bindings: null,
      enabled: false,
      warning: t('interface:controllerAccessIsUnavailableKeyboardAndTouchRemainAvailable'),
    };
  }
}

const pressed = (button) =>
  button?.pressed === true ||
  (Number.isFinite(button?.value) && button.value >= 0.5 && button.value <= 1);
const emptyUI = () => ({
  direction: null,
  confirmStart: false,
  confirmCommit: false,
  back: false,
  menu: false,
});

/** Shared ownership, remapping, raw-profile admission and menu edges, with a
 * continuous 2D flight vector instead of the router's grid-game direction. */
export function createOverflightController({
  window: win = globalThis.window,
  readPads = () => win.navigator.getGamepads?.() ?? [],
  bindings: saved = null,
  enabled = true,
} = {}) {
  let bindings = overflightControllerBindings(saved),
    scope = 'menu:boot',
    identity = null,
    stickActive = false,
    rawState = new Map(),
    confirmActive = false,
    last = null,
    destroyed = false;
  const radio = createSoloRadioInput({
    readPads,
    eventTarget: win,
    // This host only consumes restored profiles. Keep the shared setup session
    // non-editable so a menu Confirm cannot select/persist a Couch seat here.
    // The router below independently owns the actual flight/menu scope.
    getScope: () => 'flight',
  });
  let sampledPads = [];
  const router = createControllerRouter({
    readPads: () => (sampledPads = radio.readPads()),
    rawProfile: radio.rawProfile,
    eventTarget: win,
    bindings,
    autoJoin: true,
    // This mode has a momentary dash; a continuous-flight toggle is not a dash.
    boostMode: 'hold',
  });
  function reset() {
    stickActive = false;
    rawState = new Map();
    confirmActive = false;
  }
  function clear() {
    reset();
    router.clear();
  }
  function sample({ scope: nextScope, timeMs } = {}) {
    const output = {
      x: 0,
      y: 0,
      boost: false,
      pause: false,
      neutral: true,
      disconnected: false,
      ui: emptyUI(),
    };
    if (destroyed || !enabled) return output;
    if (scope !== nextScope) reset();
    scope = nextScope;
    const frame = router.sample({ scope, timeMs });
    last = frame;
    const nextIdentity = JSON.stringify(frame.assigned);
    if (nextIdentity !== identity) reset();
    identity = nextIdentity;
    output.status = frame.status;
    output.disconnected = frame.disconnected;
    // Unknown raw devices are ignored, including their unmapped throttle. A
    // held known device still blocks the host's post-menu input release gate.
    output.neutral = frame.assigned
      ? frame.confirmSnapshot.neutral
      : !['waiting-neutral', 'ready-to-join'].includes(frame.status.code);
    if (frame.status.code !== 'connected') return output;
    if (scope !== 'flight') {
      output.ui = {
        direction: frame.ui.direction,
        confirmStart: frame.ui.confirm,
        confirmCommit: confirmActive && !frame.confirmHeld && !frame.ui.back && !frame.ui.menu,
        back: frame.ui.back,
        menu: frame.ui.menu,
      };
      confirmActive =
        frame.ui.back || frame.ui.menu
          ? false
          : frame.confirmHeld && (confirmActive || frame.ui.confirm);
      return output;
    }
    output.pause = frame.flight.pause || frame.flight.hangar;
    if (output.pause || frame.flight.stop) return output;
    const pad = Array.from(sampledPads).find((pad) => pad?.index === frame.assigned?.index);
    if (!pad) return output;
    if (pad.mapping === 'standard') {
      const stick = sampleControllerStick(bindings, 'flight', pad.axes, stickActive);
      stickActive = stick.active;
      const buttons = bindings.flight.buttons;
      const x =
        Number(pressed(pad.buttons[buttons.right])) - Number(pressed(pad.buttons[buttons.left]));
      const y =
        Number(pressed(pad.buttons[buttons.down])) - Number(pressed(pad.buttons[buttons.up]));
      output.x = x || (stick.active ? stick.x : 0);
      output.y = y || (stick.active ? stick.y : 0);
    } else {
      const profile = radio.rawProfile(pad.index);
      const mapped = mapProfile(profile, pad, rawState);
      rawState = mapped.state;
      if (!mapped.valid) return output;
      const strength = (action) =>
        Math.max(
          0,
          ...profile.flight[action].map((source, index) => {
            if (!mapped.state.get(`flight:${action}:${index}`)) return 0;
            return source.kind === 'axis'
              ? Math.min(
                  1,
                  Math.max(
                    0,
                    (pad.axes[source.index] - source.center) / (source.end - source.center),
                  ),
                )
              : 1;
          }),
        );
      output.x = strength('right') - strength('left');
      output.y = strength('down') - strength('up');
    }
    output.boost = frame.flight.boost;
    return output;
  }
  return {
    sample,
    clear,
    setPreferences(next) {
      bindings = overflightControllerBindings(next.bindings);
      enabled = next.enabled !== false;
      router.setBindings(bindings);
      reset();
    },
    labels() {
      if (last?.assigned?.mapping === '')
        return {
          directions: '↑ → ↓ ←',
          confirm: t('common:controls.confirm'),
          back: t('common:controls.backCancel'),
        };
      return {
        ...controllerBindingLabels(bindings, last?.assigned?.id).menu,
        directions: controllerStickLabel(bindings, 'menu'),
      };
    },
    destroy() {
      destroyed = true;
      reset();
      router.destroy();
      radio.dispose();
    },
  };
}
