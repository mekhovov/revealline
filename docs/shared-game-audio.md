# Shared game audio

The game modes share audio ownership, output routing, persisted master preferences and encounter cue recipes. Capture, grid Snake, native FPV physics and the assisted 2D gym keep their existing simulations; sound is a presentation adapter and never changes movement, collision, scoring, replay identity or random state.

## Coverage

| Play surface                       | Shared host                                                        | Audible feedback                                                                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capture Solo                       | Soundscape / FeedbackDirector                                      | Player and enemy movement, native combat warnings/shots/impacts, humanoid tells/catches, capture, pickups and results                               |
| Capture Versus                     | One Soundscape for both boards                                     | Same cues with actual on-screen board positioning; two decorative loops per board and four total                                                    |
| Capture Team                       | Soundscape through Team music host                                 | Native cooperative events, direct Team combat actors, humanoid movement/tells and once-only accepted combat cues                                    |
| Classic Snake Solo / Versus / Team | Soundscape plus Classic presentation adapter                       | FPV rotor, nearby moving prey, warning/burst/recovery/blocked tells, catches, shutter warning/open/close, Pulse/Reel, supply appearance and results |
| FPV Worlds / World Studio play     | Shared flight mixer and menu host                                  | Drone motor/airflow, nearest moving vehicle, nearby patrol/sentry footsteps, native shots/impacts/catches, route objectives and reaction dialogue   |
| FPV Academy / Academy Studio play  | Same flight mixer, projected into admitted SIM presentation source | Native drone movement, contacts and route completion; menu samples share the flight context                                                         |
| Assisted 2D civilian flight gym    | Thin centimetre-to-audio projection into the same flight mixer     | Audible flight activity, ordered checkpoint/finish cues and localized Sound toggle                                                                  |

Military Field machine appearances use wheeled/tracked movement recipes without changing enemy roles or collision. Humanoid loops remain distinct from vehicle loops. Static obstacles do not emit continuous motor noise. Native SIM drones do not emit human footsteps.

Editor inspection, catalogue portraits and static previews do not autoplay. Studio play attempts use their normal game host. Historical import/restore seeds observation cursors rather than replaying old catches or shots. Verified flight playback is silent in the newly connected hosts; importing or verifying a result does not create audio.

## Shared authority and lifecycle

`game/ui/audio-output.mjs` owns the common context factory and output topology: music, effects, menu and dialogue feed the master; movement and radio feed effects. The shared compressor limits summed output. Each live game page has one owned context; paired boards do not create one per player. SIM menus connect to their flight host and do not create a second context.

The persisted `revealline.audio-master.v1` mute/volume preference applies across modes and tabs. Sound controls update this authority. Existing local effects, movement, menu and dialogue faders remain subordinate. Legacy SIM mute is a fallback only when there is no shared preference. An explicit unmute/Start/Arm or trusted menu gesture creates or resumes the context; changing storage preferences never creates one. iOS playback session selection is shared with Capture.

Pause stops movement loops and one-shots. Retry and course replacement reset observation/cue ownership. Hidden-page and focus loss follow each host's existing pause policy. Snake pause also invalidates pending activation, and pagehide suspends terminal accents. A later trusted menu gesture can wake the shared flight context while the simulation remains paused and its motor gains remain zero.

`game/ui/encounter-audio.mjs` contains semantic recipes for notices, warnings, bursts, recovery, catches, gunfire, impacts, supplies, shutters and objectives. Capture/Snake use prepared samples where available and immediate oscillator fallbacks otherwise. Fallbacks preserve stereo position, sweep and cleanup/priority ownership. Decoding never replays expired events. Flight uses the same recipe's procedural rendition in its existing graph.

Warning cues interrupt low-priority dialogue. Incidental tells have longer cooldowns; multiple accepted kills in one transaction produce a bounded accent. FeedbackDirector retains its existing 16 feedback-voice / 64 total-voice ceiling and four movement loops. The native flight mixer caps one-shots at 12 and uses one nearby vehicle layer and one distance-limited footstep cadence. No timer, sound asset or completion callback advances gameplay.

## Packaging and source identity

- Capture and Snake import canonical shared modules directly.
- Academy's existing `sim-presentation.mjs` embeds a checked source projection, generated by `scripts/refresh-fpv-academy-audio.mjs`; there are no additional Academy package slots.
- Worlds' existing reaction runtime projects canonical flight/shared sources using `scripts/refresh-fpv-reaction-runtime.mjs`; there are no additional Worlds package slots.
- The smaller assisted gym admits its presentation adapter and seven named shared audio source files explicitly. Its 64-file / 8 MiB package cap remains unchanged.
- Generated projections are refreshed from canonical sources and checked for byte identity. Package validation remains authoritative; none of these adapters broadens accepted executable content at runtime.

## Verification and remaining qualification

Relevant regressions are authored in `game/test/shared-encounter-audio.test.mjs`: output routing; phase recipe distinctions; Snake catches/supplies/restore; shared flight context, mute and terminal catch; offline stereo; gym units and non-mutation; procedural Pause/Retry ownership. Automated suites remain explicitly waived and were not run.

Targeted ESLint and formatting checks cover changed audio modules and hosts. The release owner records aggregate localization, source-projection, optional-package, source-identity and committed-source build outcomes with the rest of this change. This document does not claim a successful production build or human listening review.

Still required for release qualification: listening in EN/UK on Safari/iOS and Chromium, speaker/headphone mix, muted/unmuted tab synchronization, missing samples/offline operation, simultaneous Versus feedback, Team warning clarity, pause/resume after activation, route reset, hidden pages and actual controller/touch devices.

## References

The implementation retains player-controlled mute and gesture activation, decodes short effects into reusable buffers, and uses AudioParam scheduling rather than conflicting direct writes while sound is active. These choices follow [MDN Web Audio best practices](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices).

Separate gain nodes and stereo panning follow the graph-based routing shown in [MDN's Web Audio guide](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Using_Web_Audio_API). The shared engine uses native Web Audio and the existing game sample library; it adds no external audio library or runtime media service.
