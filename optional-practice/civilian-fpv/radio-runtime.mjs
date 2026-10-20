import { canonicalJSON } from '../../game/data-json.mjs';
import {
  FLIGHT_CONTROLS,
  RADIO_COMBAT_ACTIONS,
  RADIO_CONTROL_SWITCHES,
  RADIO_CONTROL_LAYOUT_FORMAT,
  neutralFlightInput,
  normalizeRadioInput,
  radioDeviceIdentity,
  radioDeviceKey,
  radioSwitch,
  validateRadioProfile,
  validateRadioControlLayout,
} from './radio-profile.mjs';

/** No physics here. All faults release input ownership and require explicit pickup.
 * An unchanged Gamepad timestamp is valid for a held control, not a disconnect. */
export function createRadioRuntime({
  getGamepads,
  onFreeze = () => {},
  onReset = () => {},
  onCamera = () => {},
  onCombatAction = () => {},
  now = () => globalThis.performance?.now?.() ?? 0,
}) {
  let diagnostic = null,
    previousTimestamp = null,
    timestampIntervals = [];
  const clearDiagnostics = () => {
    diagnostic = null;
    previousTimestamp = null;
    timestampIntervals = [];
  };
  let selected = null,
    profile = null,
    navigationProfile = null,
    controlLayout = null,
    provisionalMenu = null,
    controlLayoutLoaded = false,
    controlLayoutDirty = false,
    layoutConflict = false,
    verified = false,
    active = false,
    frozen = false,
    connectionLost = false,
    editing = false,
    profileDirty = false;
  let live = neutralFlightInput(),
    pickup = null,
    reason = 'select-device';
  let previous = { arm: false, pause: false, reset: false },
    armOffSeen = false,
    cameraOffSeen = false,
    cameraPressed = false,
    fireOffSeen = false,
    fireActive = false;
  let context = { owner: 'flight', key: 'flight', resumeAllowed: true, playback: false },
    resumeRequested = false,
    armEdgePending = false,
    menuPrevious = {};
  const combatOffSeen = new Set();
  const legacyOffSeen = new Set();
  const switchesProfile = () => controlLayout ?? profile;
  const clearActions = () => {
    combatOffSeen.clear();
    legacyOffSeen.clear();
    cameraOffSeen = cameraPressed = false;
    fireOffSeen = fireActive = false;
    armEdgePending = resumeRequested = false;
    menuPrevious = {};
  };
  const freeze = (why) => {
    clearActions();
    if (active) pickup = { ...live };
    active = false;
    live = neutralFlightInput();
    frozen = true;
    reason = why;
    armOffSeen = false;
    previous = { arm: false, pause: false, reset: false };
    onFreeze(why);
  };
  function devices() {
    if (typeof getGamepads !== 'function') return { status: 'unavailable', devices: [] };
    try {
      return {
        status: 'available',
        devices: Array.from(getGamepads() ?? [])
          .filter((pad) => pad?.connected !== false && pad)
          .flatMap((pad) => {
            try {
              return [{ index: pad.index, ...radioDeviceIdentity(pad) }];
            } catch {
              return [];
            }
          }),
      };
    } catch {
      return { status: 'unavailable', devices: [] };
    }
  }
  function read() {
    if (!selected) {
      reason = devices().status === 'unavailable' ? 'unavailable' : 'select-device';
      return null;
    }
    try {
      const pad = Array.from(getGamepads() ?? []).find(
        (item) => item && item.index === selected.index && item.connected !== false,
      );
      if (!pad || radioDeviceKey(pad) !== selected.key) throw new Error('device-replaced');
      return pad;
    } catch {
      connectionLost = true;
      if (reason !== 'device-lost') freeze('device-lost');
      verified = false;
      return null;
    }
  }
  function sample() {
    const pad = read();
    if (!pad || !profile) {
      clearDiagnostics();
      return null;
    }
    try {
      const controls = normalizeRadioInput(profile, pad);
      const timestamp = Number.isFinite(pad.timestamp) && pad.timestamp > 0 ? pad.timestamp : null;
      if (timestamp !== null && previousTimestamp !== null && timestamp > previousTimestamp)
        timestampIntervals = [...timestampIntervals, timestamp - previousTimestamp].slice(-20);
      if (timestamp === null || (previousTimestamp !== null && timestamp < previousTimestamp))
        timestampIntervals = [];
      previousTimestamp = timestamp;
      diagnostic = {
        raw: Object.fromEntries(
          FLIGHT_CONTROLS.map((axis) => [axis, pad.axes[profile.channels[axis].axis]]),
        ),
        calibrated: { ...controls },
        sampledAtMs: now(),
        sampleAgeMs: timestamp === null ? null : Math.max(0, now() - timestamp),
        cadenceHz: timestampIntervals.length
          ? Math.round(
              (1000 * timestampIntervals.length) /
                timestampIntervals.reduce((sum, interval) => sum + interval, 0),
            )
          : null,
      };
      return controls;
    } catch {
      clearDiagnostics();
      if (reason !== 'invalid-sample') freeze('invalid-sample');
      verified = false;
      return null;
    }
  }
  function armReason(command) {
    if (editing) return 'setup';
    if (context.owner === 'capture') return 'setup';
    if (context.owner === 'playback' || context.playback) return 'playback';
    if (context.owner === 'menu' && !context.resumeAllowed) return 'menu';
    if (!profile) return 'mapping-incomplete';
    if (!verified) return 'verify-controls';
    if (!command) return 'device-lost';
    if (layoutConflict) return 'layout-conflict';
    if (controlLayout && !controlLayout.switches.arm) return 'arm-unassigned';
    if (controlLayout && !context.resumeAllowed) return 'menu';
    if (!controlLayout && profile.switches.arm && !armOffSeen) return 'arm-off-first';
    if (pickup) {
      if (FLIGHT_CONTROLS.some((key) => Math.abs(command[key] - pickup[key]) > 0.07))
        return 'pickup-controls';
    } else {
      if (command.throttle > 0.04) return 'throttle-high';
      if (['roll', 'pitch', 'yaw'].some((key) => Math.abs(command[key]) > 0.08))
        return 'centre-controls';
    }
    if (controlLayout && !armOffSeen) return 'arm-off-first';
    return 'ready';
  }
  function requestArm() {
    const command = sample();
    reason = armReason(command);
    if (reason !== 'ready') return false;
    if (controlLayout && (!armEdgePending || context.playback || context.owner === 'playback')) {
      reason = 'arm-off-first';
      return false;
    }
    if (switchesProfile().switches.arm) {
      try {
        const pad = read();
        if (!pad) return false;
        if (!radioSwitch(switchesProfile(), pad, 'arm', previous.arm)) {
          reason = 'arm-switch-off';
          return false;
        }
      } catch {
        if (reason !== 'invalid-sample') freeze('invalid-sample');
        verified = false;
        return false;
      }
    }
    active = true;
    armEdgePending = false;
    fireOffSeen = fireActive = false;
    frozen = false;
    pickup = null;
    live = command;
    reason = 'active';
    return true;
  }
  return {
    devices,
    rawDevices() {
      try {
        return Array.from(getGamepads?.() ?? [])
          .filter((pad) => pad && pad.connected !== false)
          .flatMap((pad) => {
            try {
              radioDeviceIdentity(pad);
              const axes = Array.from(pad.axes),
                buttons = Array.from(pad.buttons, (button) =>
                  typeof button === 'number' ? button : button?.value,
                );
              if (
                !axes.every((value) => Number.isFinite(value) && value >= -1 && value <= 1) ||
                !buttons.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
              )
                return [];
              return [
                {
                  index: pad.index,
                  id: pad.id,
                  mapping: pad.mapping,
                  connected: true,
                  axes,
                  buttons,
                },
              ];
            } catch {
              return [];
            }
          });
      } catch {
        return [];
      }
    },
    setControlLayout(value, { restoring = false } = {}) {
      const next = value === null ? null : validateRadioControlLayout(value, { profile });
      if (next && selected && canonicalJSON(next.device) !== selected.key)
        throw new TypeError('Control layout belongs to another radio');
      if (canonicalJSON(next) !== canonicalJSON(controlLayout)) freeze('layout-changed');
      controlLayout = next;
      controlLayoutLoaded = true;
      controlLayoutDirty = !restoring;
      layoutConflict = false;
      if (!next) context = { owner: 'flight', key: 'flight', resumeAllowed: true, playback: false };
      return next ? structuredClone(next) : null;
    },
    controlLayout: () => (controlLayout ? structuredClone(controlLayout) : null),
    setProvisionalMenu(value) {
      menuPrevious = {};
      if (value === null) {
        provisionalMenu = null;
        return;
      }
      if (!Number.isInteger(value?.index) || value.index < 0)
        throw new TypeError('Invalid provisional radio index');
      const layout = validateRadioControlLayout({
        format: RADIO_CONTROL_LAYOUT_FORMAT,
        layout: 'six-switch',
        device: value.device,
        switches: Object.fromEntries(
          RADIO_CONTROL_SWITCHES.map((key) => [
            key,
            ['fire', 'weapon'].includes(key) ? (value.switches?.[key] ?? null) : null,
          ]),
        ),
      });
      provisionalMenu = { index: value.index, layout };
    },
    setContext(value) {
      if (!['flight', 'menu', 'capture', 'playback'].includes(value?.owner))
        throw new TypeError('Invalid radio input owner');
      const next = {
        owner: value.owner,
        key: String(value.key ?? value.owner),
        resumeAllowed: value.resumeAllowed === true,
        playback: value.playback === true || value.owner === 'playback',
      };
      if (
        context.owner === next.owner &&
        context.key === next.key &&
        context.resumeAllowed === next.resumeAllowed &&
        context.playback === next.playback
      )
        return;
      const prior = context;
      context = next;
      clearActions();
      // Do not undo a live Flight edge accepted by the pause-root owner.
      if (active && next.owner !== 'flight') freeze(next.owner === 'menu' ? 'menu' : next.owner);
      if (prior.owner !== next.owner || prior.key !== next.key || !next.resumeAllowed) {
        armOffSeen = false;
        previous = { arm: false, pause: false, reset: false };
      }
    },
    consumeResumeRequest() {
      const requested = resumeRequested;
      resumeRequested = false;
      return requested;
    },
    menuPreview() {
      const provisional =
        provisionalMenu && ['menu', 'capture'].includes(context.owner) ? provisionalMenu : null;
      let pad = null;
      if (provisional) {
        try {
          pad = Array.from(getGamepads?.() ?? []).find(
            (item) =>
              item?.index === provisional.index &&
              item.connected !== false &&
              radioDeviceKey(item) === canonicalJSON(provisional.layout.device),
          );
        } catch {
          pad = null;
        }
      } else pad = read();
      const layout = provisional?.layout ?? controlLayout,
        navigation = provisional ? null : navigationProfile,
        result = {
          key: provisional ? canonicalJSON(provisional.layout.device) : selected?.key,
          index: provisional?.index ?? selected?.index,
          controls: null,
          stickMode: navigation?.stickMode ?? profile?.stickMode ?? 2,
          verified: false,
          layout: layout?.layout ?? null,
          switches: null,
          provisional: !!provisional,
          pickup: pickup ? { ...pickup } : null,
          reason,
        };
      if (!pad) return result;
      try {
        if (navigation) {
          result.controls = normalizeRadioInput(navigation, pad);
          result.verified = true;
        }
        if (layout) {
          result.switches = Object.fromEntries(
            RADIO_CONTROL_SWITCHES.map((key) => [
              key,
              radioSwitch(layout, pad, key, menuPrevious[key]),
            ]),
          );
          menuPrevious = result.switches;
        }
      } catch {
        result.controls = null;
        result.verified = false;
        result.switches = null;
      }
      return result;
    },
    select(index) {
      const previousKey = selected?.key;
      freeze('device-selected');
      clearDiagnostics();
      verified = false;
      profile = null;
      selected = null;
      connectionLost = false;
      profileDirty = false;
      try {
        const pad = Array.from(getGamepads?.() ?? []).find(
          (item) => item?.index === index && item.connected !== false,
        );
        if (pad) selected = { index, key: radioDeviceKey(pad) };
        reason = selected
          ? 'mapping-incomplete'
          : typeof getGamepads === 'function'
            ? 'select-device'
            : 'unavailable';
      } catch {
        reason = 'unavailable';
      }
      if (selected?.key !== previousKey) {
        controlLayout = navigationProfile = null;
        controlLayoutLoaded = controlLayoutDirty = layoutConflict = false;
      }
      return !!selected;
    },
    setProfile(value, { restoring = false } = {}) {
      freeze('profile-changed');
      clearDiagnostics();
      profile = validateRadioProfile(value);
      if (controlLayout) {
        try {
          validateRadioControlLayout(controlLayout, { profile });
          layoutConflict = false;
        } catch {
          layoutConflict = true;
        }
      }
      verified = false;
      // Losing hardware during restoration is not an unsaved calibration edit.
      profileDirty = !restoring;
    },
    verify() {
      const command = sample();
      verified = !!command && !!profile?.verified;
      if (verified) {
        navigationProfile = structuredClone(profile);
        connectionLost = false;
        profileDirty = false;
      }
      reason = verified ? armReason(command) : 'verify-controls';
      return verified;
    },
    requestArm,
    freeze,
    disconnect(index) {
      if (selected?.index === index) {
        clearDiagnostics();
        connectionLost = true;
        freeze('device-lost');
        verified = false;
      }
    },
    reset({ notify = true, pickup: restoredPickup = null } = {}) {
      if (
        restoredPickup !== null &&
        (!restoredPickup ||
          FLIGHT_CONTROLS.some((key) => {
            const value = restoredPickup[key];
            return !Number.isFinite(value) || value < (key === 'throttle' ? 0 : -1) || value > 1;
          }))
      )
        throw new TypeError('Recovered radio pickup needs normalized flight controls.');
      freeze('reset');
      pickup = restoredPickup
        ? Object.fromEntries(FLIGHT_CONTROLS.map((key) => [key, restoredPickup[key]]))
        : null;
      if (notify) onReset();
    },
    beginSetup() {
      editing = true;
      freeze('setup');
    },
    editProfile() {
      profileDirty = true;
      verified = false;
      freeze('profile-changed');
    },
    endSetup() {
      editing = false;
    },
    preview() {
      const controls = sample();
      return {
        controls,
        stickMode: profile?.stickMode ?? 2,
        verified: !!controls && verified,
      };
    },
    diagnostics({ refresh = true } = {}) {
      if (refresh) sample();
      return diagnostic
        ? structuredClone(diagnostic)
        : { raw: null, calibrated: null, sampleAgeMs: null, cadenceHz: null };
    },
    raw: read,
    poll() {
      const command = sample();
      if (!command) return neutralFlightInput();
      const pad = read();
      if (!pad) return neutralFlightInput();
      let next;
      try {
        next = Object.fromEntries(
          (controlLayout
            ? RADIO_CONTROL_SWITCHES
            : ['arm', 'pause', 'reset', 'camera', 'fire', ...RADIO_COMBAT_ACTIONS]
          ).map((key) => [key, radioSwitch(switchesProfile(), pad, key, previous[key])]),
        );
      } catch {
        if (reason !== 'invalid-sample') freeze('invalid-sample');
        verified = false;
        return neutralFlightInput();
      }
      const canResume =
        context.resumeAllowed && !editing && ['flight', 'menu', 'playback'].includes(context.owner);
      if (!next.arm && (!controlLayout || canResume)) armOffSeen = true;
      const edges = Object.fromEntries(
        Object.keys(next).map((key) => [key, next[key] && !previous[key]]),
      );
      if (controlLayout) {
        if (
          previous.arm &&
          !next.arm &&
          (active || context.owner === 'flight' || context.owner === 'playback')
        ) {
          freeze('menu');
          armOffSeen = canResume;
        } else if (!active && edges.arm) {
          if (canResume && armOffSeen) {
            if (context.playback && verified) resumeRequested = true;
            else {
              armEdgePending = true;
              requestArm();
              armEdgePending = false;
            }
          }
          // An ON edge in a nested menu/capture is consumed, never deferred.
          armOffSeen = false;
        }
      } else {
        for (const action of ['reset', 'pause'])
          if (!next[action] && verified && !editing) legacyOffSeen.add(action);
        if (
          context.owner === 'flight' &&
          verified &&
          !editing &&
          edges.reset &&
          legacyOffSeen.has('reset')
        ) {
          freeze('reset');
          pickup = null;
          onReset();
        } else if (
          context.owner === 'flight' &&
          verified &&
          !editing &&
          edges.pause &&
          legacyOffSeen.has('pause')
        )
          freeze('paused');
        else if (active && profile.switches.arm && !next.arm) {
          freeze('disarmed');
          // This sample already observed the deliberate OFF position.
          armOffSeen = true;
        } else if (!active && edges.arm && armOffSeen && canResume) requestArm();
      }
      const ownsFlight = active && context.owner === 'flight' && !context.playback;
      // View is presentation-only: require a fresh OFF, press and release
      // during this active ownership period. Menus/focus/reconnect clear it.
      if (!ownsFlight || editing || !verified) cameraOffSeen = cameraPressed = false;
      else if (!next.camera) {
        const changeCamera = cameraOffSeen && cameraPressed;
        cameraOffSeen = true;
        cameraPressed = false;
        if (changeCamera) onCamera();
      } else if (cameraOffSeen) cameraPressed = true;
      // Fire is a held intent, never an emission clock. Every new input owner
      // must first observe OFF after arming; the encounter owns shot cooldowns.
      if (!ownsFlight || editing || !verified || !switchesProfile().switches.fire)
        fireOffSeen = fireActive = false;
      else if (!next.fire) {
        fireOffSeen = true;
        fireActive = false;
      } else fireActive = fireOffSeen;
      for (const action of RADIO_COMBAT_ACTIONS) {
        if (!ownsFlight || editing || !verified) combatOffSeen.delete(action);
        else if (!next[action]) combatOffSeen.add(action);
        else if (edges[action] && combatOffSeen.has(action)) {
          combatOffSeen.delete(action);
          onCombatAction(action);
        }
      }
      previous = next;
      if (ownsFlight) live = command;
      else if (!active && !['device-lost', 'invalid-sample'].includes(reason)) {
        const nextReason = armReason(command);
        reason =
          nextReason === 'ready' && switchesProfile().switches.arm && !next.arm
            ? 'arm-switch-off'
            : nextReason;
      }
      return ownsFlight ? { ...live } : neutralFlightInput();
    },
    fireHeld: () =>
      active &&
      verified &&
      !editing &&
      context.owner === 'flight' &&
      !context.playback &&
      fireActive,
    status() {
      return {
        active,
        frozen,
        verified,
        reason,
        selected: selected ? { ...selected } : null,
        pickup: pickup ? { ...pickup } : null,
        profile: profile ? canonicalJSON(profile) : null,
        connectionLost,
        editing,
        profileDirty,
        controlLayoutLoaded,
        controlLayoutDirty,
        controlLayout: controlLayout?.layout ?? null,
        armSwitchBound: !!switchesProfile()?.switches.arm,
        fireBound: !!switchesProfile()?.switches.fire,
        fireReady: active && verified && !editing && fireOffSeen,
      };
    },
  };
}
