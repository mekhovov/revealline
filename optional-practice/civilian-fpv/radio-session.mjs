import { canonicalJSON } from '../../game/data-json.mjs';
import { defaultRadioProfile, validateRadioProfile } from './radio-profile.mjs';

/** Restore a uniquely identified, already verified mapping without acquiring input.
 * Device slots are not identities. Setup edits and in-flight pickup belong to the
 * runtime; reconnection must preserve both and still require deliberate arming. */
export function restoreVerifiedRadio(runtime, profileStore) {
  const result = (status, restored = false) => ({
    restored,
    status,
    reason: runtime.status().reason,
  });
  let state = runtime.status();
  if (state.editing || state.profileDirty) return result('editing');
  if (state.active) return result('ready');
  if (state.verified && !state.connectionLost) {
    if (runtime.preview().controls) return result('ready');
    state = runtime.status();
  }
  if (state.profile && !state.connectionLost) return result('unverified');
  if (profileStore?.status?.().unreadable) return result('invalid-profile');
  let candidates, previousProfile, saved;
  try {
    previousProfile = state.profile ? validateRadioProfile(state.profile) : null;
    const selected = profileStore?.snapshot().radio;
    saved = selected ? validateRadioProfile(selected) : null;
    candidates =
      typeof profileStore?.radios === 'function'
        ? profileStore.radios().map(({ profile }) => validateRadioProfile(profile))
        : saved
          ? [validateRadioProfile(saved)]
          : [];
    if (previousProfile) candidates.unshift(previousProfile);
    const fallback = defaultRadioProfile();
    // A known device's saved calibration (including an unverified draft) always
    // owns its mapping. The tested default must not silently replace it.
    if (
      !candidates.some(
        (profile) => canonicalJSON(profile.device) === canonicalJSON(fallback.device),
      )
    )
      candidates.push(fallback);
  } catch {
    return result('invalid-profile');
  }
  const devices = runtime.devices();
  if (devices.status !== 'available') return result('unavailable');
  const matchingDevices = (profile) =>
    devices.devices.filter(
      ({ index, ...identity }) => canonicalJSON(identity) === canonicalJSON(profile.device),
    );
  const restore = (profile, matches) => {
    if (matches.length > 1) return result('ambiguous');
    if (!runtime.select(matches[0].index)) return result('missing');
    runtime.setProfile(profile, { restoring: true });
    return runtime.verify() ? result('restored', true) : result('unverified');
  };
  // Explicit runtime and saved library choices can reconnect to one matching
  // device. Neither preference can distinguish two identical physical radios.
  if (previousProfile) {
    const matches = matchingDevices(previousProfile);
    if (matches.length)
      return previousProfile.verified ? restore(previousProfile, matches) : result('unverified');
  }
  if (saved) {
    const hardware = matchingDevices(saved);
    if (hardware.length) return saved.verified ? restore(saved, hardware) : result('unverified');
  }
  const matches = new Map();
  for (const profile of candidates) {
    if (!profile.verified) continue;
    const hardware = matchingDevices(profile);
    if (hardware.length > 1) return result('ambiguous');
    if (!hardware.length) continue;
    // Names and local profile IDs are metadata, not a different calibration.
    const { id, name, verified, format, ...calibration } = profile;
    const identity = canonicalJSON(calibration);
    if (!matches.has(identity)) matches.set(identity, { profile, hardware });
  }
  if (matches.size > 1) return result('ambiguous');
  if (!matches.size) return result('missing');
  const match = [...matches.values()][0];
  return restore(match.profile, match.hardware);
}
