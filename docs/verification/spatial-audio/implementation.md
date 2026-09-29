# Spatial sound implementation record

## Phases

1. Baseline: isolated managed checkout of current main `321408a3cfd75ae230d760f39fb692503652601a`; preserve the original working directory. Inspected runtime actors, capture and terrain events, replay ownership, multiplayer hosts and existing audio transport. Acquired three official CC0 packs and preserved used originals/licenses.
2. Infrastructure: presentation-only `FeedbackDirector`, local PCM bank, bounded voices, asynchronous preload with no delayed event replay, per-source gains/stereo, independent menu bus and preferences. Existing published-asset aliases remain supported; music catalogue and save/replay schemas remain unchanged.
3. Integration: Solo, Versus, Team, company player and Replay Theater call the shared director. Gameplay-event identities are per run, tick/time/index. Versus has two decorative slots per board; shared Team sources use nearest active listener once. Existing simulation commands are unchanged.
4. Presentation: three capture sizes, material contact variations, body movement families, separate result/terrain-state signatures, independent menu toggle/volume, cell-clipped reveal gestures and gate release pulses. Existing win/loss presentation durations are unchanged.
5. Qualification: focused tests and native observations recorded below. Complete release qualification remains required before immutable publication.

## Coverage matrix

| Authority | Feedback |
|---|---|
| Moving player body | Rotor/motor, wing/cloth, grain/paper, wheel textures; body override remains independent of ability |
| Moving field, border, contour enemies | Distance gain, screen-position pan, source retirement; no decorative idle or blink sounds |
| Ground rover | Dormant quiet; warning, activation, cancellation, moving layer |
| Eroder | Preparation warning, actual erosion, blocked erosion; changed terrain reactivation |
| Lane/relay encounter | Warning/opening/phase/stage events; final run result supersedes capture ending |
| Combat patrol | Lock, fire, impact, cancellation, elimination, projectile removal |
| Team threats | Warning, committed attack, launched/intercepted/cleared impact, recovery, down/revive, rescue, shared support |
| Walls/foundations | Blocked held-direction transition or authoritative capture stop; no repeating collision while held |
| Slow terrain | Entry/release, active texture; safe captured cells no longer emit |
| Signal zone | Entry/exit and authoritative suppression/recovery; one positioned texture per zone |
| Directional field | Movement-dependent flow/resistance rate |
| Relay gate | Release cue and short safe-cell pulse; passability remains immediate |
| Pickup/hangar | Successful supply, class switch, rejected action, deployment, shield/scan/pulse |
| Picture capture | Claimable-area tiers; closure + reveal + material gesture; terrain neutralization |
| Results | Start/retry, damage, respawn, loss and victory |
| Menus | Keyboard navigation, confirm/back; independent persisted enable + 35% default volume |
| Replay/practice | Existing controlled subject; replay pause/restart/inactive cleanup; historical events never replay after decoding |

All twelve Journey material entries select a material profile from their registered source theme, with legacy FPV/Atlas/Retro/Spend Network and custom-family fallback. Source assets are shared to keep memory bounded. This is not a claim of individually recorded vocalizations for every skin.

## Verification evidence

- Focused sound/mixer/render/offline suite: 115 tests passed (audio lifecycle, published aliases, attenuation, capture sizes, per-board deduplication/fairness, freeze/frame stability, storage defaults and binary provenance).
- Content and presentation validation passed, including English/Ukrainian localization.
- Native Chromium 154 / macOS: final 42-asset bank decoded 42/42 in the production audition page.
- Native shared-master probe at 48 kHz, 2026-09-29T08:06:23Z: all six checks passed; initial/mid-play mute and zero volume measured zero; quarter-volume RMS ratio 0.24965009; restored ratio 0.99944865; owned context closed.
- Local production build passed (1818 files); all 42 WAV files plus the bank module are now in the core offline cache, and their built bytes match source. See `build.json`; this is packaging evidence, not an immutable release certificate.
- Native Solo keyboard run completed the first mission: 34.3% coverage, 8160 score, three lives retained, no console errors. Master was muted, so this verifies gameplay/presentation only.
- Native Solo booted and showed Audio → Menu sounds enabled, Menu volume 35. Disabled/20% settings survived reload; enabled/35% was then restored.
- The initial full repository run exposed stale expectations/imports and an initial new fake-DOM compatibility failure; subsequent inspection also found new Team/Versus initialization regressions, corrected in the radio follow-up below. The new widget was corrected to use normal span elements. The broad run was stopped after failures and a pending Couch fixture; its output is not a green release gate. Replay/offline integration subsequently passed 19 tests, and the two Team reveal tests plus paused-music effects regression passed independently.
- Baseline evidence: main's combat adapter test imports missing `game/ui/player-locator.mjs`; continuous-host asserts historical session v4 while current runtime emits v6; boot build fixture omits `authoring/motion-lab/animation.mjs`. These require separate qualification/triage.
- Offline audit caught WAV references missing from the core cache. The scanner now follows WAV literals in the bank; a dedicated closure regression preserves essential effects while excluding source originals and optional music.
- A temporary full baseline extraction exhausted disk space. Only this task's incomplete `.cache/main-baseline` extraction was removed; user projects and existing worktrees were preserved. Subsequent checks use bounded fixtures.

## Release gate

Do not mark the sound design fully qualified from modeled or native digital checks alone. Remaining acceptance includes matched-level subjective audition, speaker/headphone and native device playback, sustained listening, and a fully green exact-source release gate. The intended attenuation and budgets are implemented policy, not subjective approval. Keep a draft review available while those gates remain open; do not publish a production release certificate claiming they passed.

## FPV radio follow-up — 29 September 2026

- Add original ESC-style startup/retry cues (explicitly not a real drone recording) and official EdgeTX English/Ukrainian “Armed” recordings. The EdgeTX GPL-2.0 assets have a pinned upstream revision, preserved unmodified sources, processing recipe and full license distributed through the Credits page.
- Speech has independent persisted enable/volume controls (35% default), one shared voice, foreground placement, urgency interruption and SFX lifecycle cleanup. Non-FPV bodies do not speak; replay silent starts stay silent. No unsupported battery, telemetry, disarm or mode claims are announced.
- Correct the earlier broad actorStyle insertion: it read uninitialized appearance state in Team/Versus routing. Actor hints now exist only in feedback calls, leaving route/save contracts unchanged. The actual host cohort passed 15 tests; cross-mode entry passed 16; Team Next passed 2. Company teardown fixture now verifies retiring the new menu/radio controls.
- Native Chromium decoded 46/46 assets. Solo radio off/20% survived reload while menu remained on/35%; restored radio on/35% afterward. Native Versus entered both running boards, Team entered a shared arena and paused after capture; no console errors observed. These are browser observations, not physical-device or subjective listening results.
- Updated focused sound/master/preferences/offline/company/replay cohort passed 114 tests; the 17-case director cohort includes a successful twenty-minute simulated two-board voice/lifecycle soak. The bank totals 1,431,432 bytes (~1.37 MiB, ~4.10 MiB decoded at 48 kHz). File inspection found no clipped PCM samples; this does not certify mixed-output headroom or listening quality.
- Targeted baseline reruns reproduced 17 failures on the original main source across route expectations, session v4/v6 expectations, Team teaching-preference writes, controller ownership and a missing actor-artwork fixture. See `radio-baseline.json`. Other full-suite failures and timeouts are not automatically classified as baseline. The broad run used 60-second file timeouts for diagnosis and included sources subsequently repaired; it cannot be an exact-source release certificate.
- A real CC0 startup-click recording was found at https://freesound.org/people/LudwigMueller/sounds/329545/, but its original requires login and it is not a verified Betaflight ESC melody. It remains a research candidate, not a bundled sample.

Release remains held for unresolved full-suite qualification and subjective/device listening. Neither the original 42-sound evidence nor the new radio checks close those gates.

## Repeated-cue comfort revision — user listening feedback

- Replace confirm with edited Kenney UI Audio clicks; replace sharp scratch/maximize gestures with filtered scroll/pluck/drop ingredients. Three variants each for confirm, paper and pickup; all used CC0 originals are retained. Capture tiers use a brushed seal rather than arpeggios, equal RMS with longer/broader texture. Lower routine contacts and closure; suppress redundant closure when capture supplies the seal.
- Measured file RMS: confirm −34.8 dBFS (previous −13.5), paper −41.2 (previous −13.8), pickup −32.4 (previous −11.2); all reveal tiers −37.0. These values describe PCM, not perceived loudness or comfort approval.
- Movement loops were about −30 dBFS before additional gains of 0.10 player/0.18 enemy. New rotor/motor/wheel loops are −21 dBFS with near gains 0.25/0.30 and stronger midrange; this raises near movement roughly 17/13.5 dB respectively. Correct FPV field enemies selecting wheel textures. Reserve a moving player and nearby enemy before filling decorative slots; preserve the four-layer ceiling and distance curve.
- The audition's player was stationary and therefore silent. It now moves, supports body selection, and shows actual active source names. Native browser decoded 52/52 assets, displayed player/enemy rotor sources, switched the player to wings, and retired the enemy at the distance cutoff. This is scheduling/decoding evidence, not a claim to have listened through the user's speakers.
- Current focused cohort: 117 passed; current Team/Versus actor and cross-mode entry cohort: 31 passed. Focused coverage includes crowded-board source reservations, variation-wide cooldowns, capture-layer coalescing, radio lifecycle and the simulated twenty-minute soak. Current bank: 52 runtime assets, 1,453,856 bytes (~1.39 MiB; ~4.16 MiB decoded at 48 kHz). See `comfort-file-inspection.json`; older file-inspection evidence is historical.
- Explicitly retain the EdgeTX license, provenance and unmodified recordings in every mode's offline closure. Ordinary Credits links are not dependency roots. The new closure regression passes.
- Stop the superseded broad diagnostic run after source changes; no exact-source full-suite pass is claimed. Broader Team Next fixture tests also expose unresolved cancellation/preparation waits. Keep the release gate open.
