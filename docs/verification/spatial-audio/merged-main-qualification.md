# Audio integration qualification — 30 September 2026

PR #817 merged the sound redesign into main. This follow-up starts at
`908bc6b08d1999edafa79d1581d2bab9395285b7`, including the subsequent Demo audio
integration. It changes audio host tests and retains current verification;
no sound assets, runtime behavior, simulation or music catalogue are changed.
PR #795 is untouched. Delivery remains scheduled with milestone 57,
**v0.150.0 — Unified native experience**, under the canonical publisher.

## Corrected host journeys

The previous audio fixtures addressed controls through obsolete menu locations.
Versus Help is now reached through Settings → Help & Extras; music credits live
inside Audio Settings. The tests keep these surfaces visible while traversing
them, navigate up to Audio on the vertical controller category rail, activate it,
and move right into its controls before opening the nested music library.

Team foreground restoration now advances a neutral controller frame before an
explicit music Pause. The Versus mixed keyboard/controller test waits out the
existing Confirm echo window. These corrections exercise the current production
handlers without changing the guards or bypassing navigation. Assertions still
cover unchanged boards, master preferences, explicit Pause, source-link
activation, muted output and nested Back restoration.

## Results

- [138 focused checks](merged-main-focused.tap) pass, including Demo feedback,
  sound envelopes, preferences, distance mixing, actor coverage and offline closure.
- [24 Couch audio host checks](merged-main-host.tap) pass with no skipped tests.
- ESLint and Prettier pass for the changed test file; `git diff --check` passes.
- `npm run build` succeeds. The [build receipt](merged-main-build.json) verifies
  every runtime cue against the source bank and distribution inventory: 56 cues,
  4,479,040 bytes. All 58 WAVs, including the two redistribution source files,
  belong to `extras:spatial-audio`; the three metadata files remain core.
- The [native browser measurement](merged-main-native-mix.json) decodes 56/56
  cues and measures seven overlapping SFX scenarios without a compressor.
  The highest stereo peak is −19.48 dBFS; stereo and averaged mono stay unclipped.
  Movement mute stops both actors and restores ceramic/ratchet movement when
  enabled. No browser warnings or errors were observed.

The native measurement uses the source audition fixture. The development build
has no embedded source revision and is not an immutable release. Distribution
hashes establish byte integrity, not offline gameplay or human listening.
The [machine-readable receipt](merged-main-qualification.json) retains these limits.

## Remaining delivery checks

The newer packaging policy makes recorded sound bodies an explicit **Optional
spatial sound effects** download. A fresh built-package offline gameplay check
must install this extra; installing only the starter is not evidence that the
recorded sound bank is cached. The inventory membership and file hashes above
pass; a current offline gameplay observation remains open.

Sustained listening with music, speakers/headphones and physical devices remains
deferred under the current delivery priorities. Canonical immutable release
qualification and public acceptance also remain outstanding. Earlier evidence
files are retained as historical observations, not relabeled as current passes.
