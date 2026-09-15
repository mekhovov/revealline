# Scoped P02-A functional audio recipe review

Reviewed on 2026-09-15 for the local v0.58.0 candidate based on `4c85277ac7393eeeabab035387d4d4ae8734aba1`. This review covers functional shared-output policy and its preserved recipe/transport contracts. It is not an album, listening-panel, speaker-quality, complete browser/device or public-release approval. At this initial review checkpoint, P01 production history was not integrated; the candidate integration and binding update below records the later state.

## Exact direct inputs

The producer's audio input order is significant. SHA-256 of these four raw file bodies concatenated in the listed order is **`ffc98cb5fae178aa91524368abbe5d62f13e79ab7726f0f312feb4e64dc4e130`**. The [integration receipt](integrated-source-native.json) records the same byte sizes, individual hashes and calculation rule. No build or producer import was used to derive this digest.

| Input                           |  Bytes | SHA-256                                                            |
| ------------------------------- | -----: | ------------------------------------------------------------------ |
| `game/ui/audio.mjs`             | 26,731 | `b0703011e0981ed4d86d62cb36b721f65f52e7033a4f63417a81287731ee0388` |
| `game/ui/published-audio.mjs`   |  5,718 | `3e9e7c163fcd936661fa609870b4b5dfb9099139c8c87e261d966908637c73d0` |
| `game/ui/soundtrack-player.mjs` | 24,085 | `6b45ab2c75fc313443c97ec3a64ed8e1526d89052292c6c3ab2c9817b1465932` |
| `game/ui/audio-master.mjs`      |  5,277 | `b7f4ffa09292d03aa18c3377d343da5699b2affd38f0459ad4e0daa384f8670c` |

The earlier P01 three-input digest `998a1326a484cb3a492770ec68b927181ae5cb6d0041cdf309628fefd9349a95` cannot approve this successor. Adding the master module to provenance is intentional: changes to its output policy must reopen the audio recipe review.

## Functional finding

The independent source review found no blocker in the output-policy composition at this fingerprint:

- The shared authority owns synchronous mute/volume policy and revisioned observation, without owning storage, contexts, track selection or Play. Failed output listeners do not prevent other listeners receiving a mute. Newer reentrant intent wins over an older notification.
- Native media bindings compose explicit local volume with master once, enforce local/shared mute and zero volume, and reassert effective output on native play/volume events. Those events cannot overwrite local/master intent. Equality/readback guards prevent notification loops where a native platform ignores or quantizes volume. They do not prove that platform's audible partial-volume support.
- Soundscape applies shared gain at its master output after existing local settings; mute/zero closes that gain immediately. Track recipes, music/effects buses, preview attenuation and transport epochs stay distinct. Deferred enable/resume uses the current gate. Published cue routing remains on the existing guarded Soundscape buses; this change adds no cue or composition.
- The streamed player retains its local music/fade/duck envelope and native media ownership, with shared attenuation applied once. Shared changes neither restart its track nor alter its desired playback. Disposing one output releases only its own binding; page authority remains separately owned.

Host/media source review complements the four-input recipe fingerprint. The persistence adapter validates the separate two-scalar origin-local record and preserves in-memory intent on save failure. Studio exposes explicit master controls without turning Play completion into Unmute. Stories multiply cinematic volume once, retain optional playback and release their own duck/media leases. Asset Studio binds both previews independently. These surrounding paths have their own receipt pins; the four-input digest is not a claim to cover every host import or HTML file.

## Evidence supporting this scope

- [Core](receipts/core.json): five complete files, 78/78 on Node 20.19.5 and 22.22.2. Relevant cases cover immediate/zero gating, independent local volume, native event reassertion, pending Play/context resume, transport intent and lease/disposal behavior.
- [Preferences](receipts/preferences-runs.json): 24/24 on both runtimes, including storage-area/current-value identity, late profile/reentrant intent, failed writes and remote preference adoption without Play.
- [Media integration](receipts/studio-story.json): four complete files, 85/85 on both runtimes. Actual presentation functions exercise local/master composition, delayed video/audition, lazy dialog injection, saved/draft preview ownership and pending teardown. Its earlier panel/authoring pins remain superseded where recorded.
- [Master precision](receipts/master-percent-alignment.json): six complete files, 68/68 on both runtimes with 17 stable listed pins. It adds actual-host range sanitization at 13%, cross-page 1% changes and modeled controller confirmation while preserving paused state.
- [Later integration](integrated-source-native.json): 17 complete files, 256/256 on Node 22.22.2, TAP 31.498 seconds, plus root-observed scoped static passes. The exact command is retained; no complete before/after source identity manifest or full six-gate result is claimed.
- Root's bounded native source observations establish corrected Studio/Settings 1% values, 13% navigation persistence, both procedural previews reaching stopped state, two owned MP3 imports at 2.0375 seconds, a native muted audition progressing, and explicit playlist Pause/seek `0.2` surviving Unmute/Mute. Actual current/draft previews of the saved rising MP3 also remain muted while both play, including after the draft native speaker-button override attempt. [Native text and transport evidence](integrated-source-native.json) preserves the exact observations and their limits. No audible listening is inferred.

## Initial production-binding checkpoint (historical)

This document supplies the functional source review for the exact digest above. It does **not** change `REVIEWED_RECIPE_INPUTS`, regenerate the ledger, promote an asset or approve the final integrated P01/P02-A release. The retained [history-support run](receipts/production-fingerprint-support.json) is still 6/7 on each runtime because the real current audio approval is absent; its synthetic invalidation fixture is not approval evidence.

At that checkpoint, the producer owner was required to preserve the incoming P01 history, confirm these exact inputs still match, then explicitly bind this scoped review and regenerate canonically. Require whole history/readiness/output tests and producer `--check` afterward. Any changed direct input invalidates this fingerprint; a later final-source gate must bind the complete candidate independently. Old assets/revisions, approved artwork, composition counts and public acceptance remain unchanged by this review note.

## Candidate integration and binding

The P02-A branch merged P01 candidate `cc9f8ff` in `0b541da`, preserving its incoming revision-22 production history byte-for-byte. All four reviewed audio modules retained the exact hashes above. P01 itself remains unaccepted; this candidate binding does not approve its release or any unresolved loading journey.

The producer now explicitly binds this scoped functional review to the unchanged four-input digest. Canonical successor generation, history/readiness checks and complete final-source qualification remain required. The [native mixer check](output-probe/README.md) adds digital output evidence at these same audio inputs, separately from physical listening and native MP3/video gain. The earlier strict approval failure remains historical evidence.
