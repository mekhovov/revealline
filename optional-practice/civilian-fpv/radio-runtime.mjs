import { canonicalJSON } from '../../game/data-json.mjs';
import {
  FLIGHT_CONTROLS,
  neutralFlightInput,
  normalizeRadioInput,
  radioDeviceIdentity,
  radioDeviceKey,
  radioSwitch,
  validateRadioProfile,
} from './radio-profile.mjs';

/** No physics here. All faults release input ownership and require explicit pickup.
 * An unchanged Gamepad timestamp is valid for a held control, not a disconnect. */
export function createRadioRuntime({ getGamepads, onFreeze = () => {}, onReset = () => {} }) {
  let selected = null,
    profile = null,
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
    armOffSeen = false;
  const freeze = (why) => {
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
    if (!pad || !profile) return null;
    try {
      return normalizeRadioInput(profile, pad);
    } catch {
      if (reason !== 'invalid-sample') freeze('invalid-sample');
      verified = false;
      return null;
    }
  }
  function armReason(command) {
    if (!profile) return 'mapping-incomplete';
    if (!verified) return 'verify-controls';
    if (!command) return 'device-lost';
    if (profile.switches.arm && !armOffSeen) return 'arm-off-first';
    if (pickup) {
      if (FLIGHT_CONTROLS.some((key) => Math.abs(command[key] - pickup[key]) > 0.07))
        return 'pickup-controls';
    } else {
      if (command.throttle > 0.04) return 'throttle-high';
      if (['roll', 'pitch', 'yaw'].some((key) => Math.abs(command[key]) > 0.08))
        return 'centre-controls';
    }
    return 'ready';
  }
  function requestArm() {
    const command = sample();
    reason = armReason(command);
    if (reason !== 'ready') return false;
    if (profile.switches.arm) {
      try {
        const pad = read();
        if (!pad) return false;
        if (!radioSwitch(profile, pad, 'arm', previous.arm)) {
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
    frozen = false;
    pickup = null;
    live = command;
    reason = 'active';
    return true;
  }
  return {
    devices,
    select(index) {
      freeze('device-selected');
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
      return !!selected;
    },
    setProfile(value, { restoring = false } = {}) {
      freeze('profile-changed');
      profile = validateRadioProfile(value);
      verified = false;
      // Losing hardware during restoration is not an unsaved calibration edit.
      profileDirty = !restoring;
    },
    verify() {
      const command = sample();
      verified = !!command && !!profile?.verified;
      if (verified) {
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
    raw: read,
    poll() {
      const command = sample();
      if (!command) return neutralFlightInput();
      const pad = read();
      if (!pad) return neutralFlightInput();
      let next;
      try {
        next = Object.fromEntries(
          ['arm', 'pause', 'reset'].map((key) => [
            key,
            radioSwitch(profile, pad, key, previous[key]),
          ]),
        );
      } catch {
        if (reason !== 'invalid-sample') freeze('invalid-sample');
        verified = false;
        return neutralFlightInput();
      }
      if (!next.arm) armOffSeen = true;
      const edges = Object.fromEntries(
        Object.keys(next).map((key) => [key, next[key] && !previous[key]]),
      );
      if (edges.reset) {
        freeze('reset');
        pickup = null;
        onReset();
      } else if (edges.pause) freeze('paused');
      else if (active && profile.switches.arm && !next.arm) {
        freeze('disarmed');
        // This sample already observed the deliberate OFF position. Preserve
        // it so a subsequent ON edge does not require an extra OFF frame.
        armOffSeen = true;
      } else if (!active && edges.arm && armOffSeen) requestArm();
      previous = next;
      if (active) live = command;
      else
        reason = ['device-lost', 'invalid-sample'].includes(reason) ? reason : armReason(command);
      return active ? { ...live } : neutralFlightInput();
    },
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
        armSwitchBound: !!profile?.switches.arm,
      };
    },
  };
}
