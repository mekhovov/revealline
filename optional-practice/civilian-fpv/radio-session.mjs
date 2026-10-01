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
  let candidates;
  try {
    if (state.profile) candidates = [validateRadioProfile(state.profile)];
    else {
      const saved = profileStore?.snapshot().radio;
      if (saved && !saved.verified) return result('unverified');
      candidates = saved
        ? [validateRadioProfile(saved), defaultRadioProfile()]
        : [defaultRadioProfile()];
    }
  } catch {
    return result('invalid-profile');
  }
  const devices = runtime.devices();
  if (devices.status !== 'available') return result('unavailable');
  for (const profile of candidates) {
    if (!profile.verified) continue;
    const matches = devices.devices.filter(
      ({ index, ...identity }) => canonicalJSON(identity) === canonicalJSON(profile.device),
    );
    if (matches.length > 1) return result('ambiguous');
    if (!matches.length) continue;
    if (!runtime.select(matches[0].index)) return result('missing');
    runtime.setProfile(profile, { restoring: true });
    return runtime.verify() ? result('restored', true) : result('unverified');
  }
  return result('missing');
}
