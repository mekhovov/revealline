# Shared audio audit — 14 October 2026

No new audio owner, bypass or Riy-only volume setting is needed. Riy uses the existing Overflight sound adapter, and escort defeats enter the shared canonical defeat path. The new focus-command event maps to the existing pulse cue.

Verified in code and selected tests:

- Five destruction categories distinguish infantry, armor, light machinery, heavy machinery and electronics. Their cooldowns are 90, 110, 160, 220 and 140 milliseconds respectively. The recorded bank has three variants per category; production source and headroom tests already exist separately.
- Eight human-reaction cue slots use a shuffle bag, with no immediate repeat across bags/retries. They are independent of the visual gore setting. The shared preference defaults to reactions, while Classic disables the vocal layer and keeps impacts.
- Vocal admission allows at most two simultaneous reactions, requires at least 250 ms between onsets, and refills one token per second into a two-token bucket. Playback is bounded to 0.7 seconds. Offscreen humanoid reactions are filtered beyond 560 units by the Overflight adapter.
- Warning priority interrupts humanoid reactions and commentary/dialogue. Reaction admission also rejects while radio, dialogue or an urgent warning owns the foreground. Mass deaths coalesce by category per simulation transaction instead of playing a cue for every body.
- Recorded and procedural feedback share a 16-feedback / 64-total voice ceiling with priority-based replacement. The shared output compressor uses a −12 dB threshold, 12 dB knee and 5:1 ratio. This is a bounded mix, not a claim of measured output loudness on speakers.
- A fresh profile's shared master preference is muted with volume 0.65. Enabling audio is a user action. Existing saved choices remain authoritative. Start/retry uses the shared ESC startup cue once per run and retains one rotor-loop owner.
- Missing destruction samples have immediate bounded procedural fallback; late decoding does not replay an old death. Missing vocal samples retain the dry classic impact rather than manufacturing another sound owner.
- Pause, mute, SFX settings and disposal govern these paths. Published Studio audio replacements use the same ownership and priority rules.

Evidence: `audio-tests.tap` (18 passing) and `reaction-policy-tests.tap` (5 selected passing, 5 skipped by selection). Sources inspected: `game/overflight/audio.mjs`, `game/ui/destruction-audio.mjs`, `game/ui/human-reaction-policy.mjs`, `game/ui/audio.mjs`, `game/ui/feedback-director.mjs`, `game/ui/audio-output.mjs`, `game/audio-preferences.mjs`, and `game/hunt/preferences.mjs`.

No subjective listening judgment is claimed. The earlier silent canvas captures cannot demonstrate mix quality. A recording that includes the real audio output, or a user listening pass, is still needed to judge repetition, perceived loudness, music balance and whether the focus cue is distinctive enough during a dense fight. The selected technical tests do not substitute for that review.
