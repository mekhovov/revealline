# Overflight presentation review — 2026-10-05

Runtime candidate: `2a80117ee210cfe1fb85ae8fd65b4d260e7902a4`, stacked above the Creator/Community branch and reconciled with main `e3e1e8b8d3b061a85c77f7bc82159db810dff688`.

## Delivered behavior

- Seven accepted native drone bodies in the flight briefing, with shared EN/UK names and a preview painted from the same geometry as play. Selection is saved, locked during an active sortie, recorded in the appearance identity and preserved on retry. Behavior remains identical across characters; the identity is available for a later gameplay design.
- No permanent white player circle. Larger collision-safe cosmetic propeller sweeps, twelve baked rotor phases, subtle banking/boost motion, and compact hull/airframe/protection indicators beneath the drone.
- Shared remains, brutal-destruction and blood settings. Existing humanoid destruction and machinery debris are baked into the atlas during preparation. Remains stay at their defeat positions until the oldest traces are recycled; no navigation/collision changes.
- A fixed 512-record defeat mailbox, 1,024 retained ground traces, at most 320 visible settled traces and 24 moving death effects. Overflow affects only cosmetic history; damage, kills, rewards and visible living enemies are never sampled. Reduced effects suppresses death motion, and disabling blood immediately changes the retained traces' presentation.
- HUD hull, spare airframes, kills, level, salvage progress, build and boost status. Upgrade reveals have a short emblem/spark animation and staggered cards; chosen modules receive a brief flight toast. Reduced effects and reduced-motion preferences suppress animation.
- Native results show the actual outcome, kills, elapsed time, collected salvage, earned upgrades, completed milestones and final build. Victory/loss retain the existing shell actions.
- Shared sound/master/music services. Added boost, arrival, upgrade and reroll cues; result cues use explicit UI ownership so pausing combat cannot cut them off. Existing authored audio and native fallback motifs remain available.
- Shared optional commentator controls, captions, voice library and soundtrack ducking. New EN/UK milestone lines are registered for native Voice Studio; they use captions until a matching recording exists. The existing Engineer victory recording is available when speech is enabled and the recording is prepared. No generated speech or separate audio owner was introduced.

## Automated evidence

- `overflight-tests.tap`: 132/132 checks pass, including the full existing Overflight cohort and new character, remains and feedback coverage.
- `shared-audio-tests.tap`: 127/127 affected audio/reaction checks pass. This overlaps the Overflight cohort; counts must not be added together.
- `validation.log`: the complete `npm run validate` command passes, including localization, native content/metadata and all generated optional-runtime checks.
- Targeted ESLint, canonical source Prettier checks and `git diff --check` pass. The generated optional reaction projection is verified byte-for-byte by its generator, rather than rewritten by the general formatter.

Coverage includes identical complete seeded simulation state for all seven character IDs; custom image ownership across delayed renderer retirement; 700 accepted deaths through a bounded mailbox; exactly-once rewards; 700 visible living actors alongside the full residue budget; gore/reduced-effect toggles without gameplay mutation or runtime painting; context restoration and disposal; actual procedural result nodes on the menu bus; and prepared result dialogue that ducks music and cannot replay after a visibility interruption.

## Native browser review

All captures below use the runtime candidate above, through the actual shell and Phaser renderer in the Codex browser. These are interaction and appearance checks, not performance qualification or human playtesting.

- `native-win.jpg` / `native-win.txt`: the ordinary-input automated Fan + shield route completes at 05:42 with 4,733 kills, 5,443 collected salvage and ten choices. The native results show the final tank, elite and evolution milestones, final build and shared Engineer caption. `browser-console.json` contains no captured warning/error entries for that completed run.
- `native-loss.jpg` / `native-loss.txt`: a stationary, unupgraded Heavy carrier with one airframe loses at 00:16, with nine kills. The native loss result and Retry work; `native-heavy-carrier-retry.jpg` shows the same selected craft, local hull indicator and reset statistics. This is a presentation check, not evidence about upgraded camping builds.
- `flight-deck.jpg` and `flight-deck-uk.jpg`: EN/UK native selector and accepted Heavy carrier preview. All seven native identities are offered. The selected character persists through a fresh page load.
- `upgrade-reward.jpg`: a naturally earned level-four draft, captured during its staggered reveal. Automated review disables manual card selection; normal play retains the interactive cards. Current/next visual patterns remain visible alongside the achievement treatment.
- `native-battlefield-gore.jpg`: native shared blood/debris and retained traces during the run. `native-feedback-observation.json` is the compact diagnostic header captured through the UI at 01:04: 176 retained defeats, 175 settled traces and six moving defeats in the last frame, selected carrier artwork, shared gore enabled, and an enabled/running/unmuted audio context. The native soundtrack UI reports the actual playing track. Spoken reactions were off for this observation, so it does not establish audible new dialogue.

The diagnostic observation is explicitly invalid for benchmark acceptance (`interrupted`, incomplete windows), and omits raw interval pages. Its purpose is to verify content identity, resource counts and feedback wiring only.

## Resource and evidence limits

The new inventory is 883 frames in two textures: a 2040×2040 atlas plus 256×256 ground, **16,908,544 base RGBA bytes (16.13 MiB)**. Retained CPU recovery canvases consume another equal amount. Decoded accepted artwork, temporary preparation surfaces and other browser/GPU resources are additional; this is not a total-memory figure.

Previous performance receipts describe the prior renderer. These new bounds and tests do not establish 60 FPS on Iris Xe. Physical-gamepad, reference-device and human enjoyment/readability acceptance remain open. This change does not claim to resolve the separately reviewed late-build camping balance issue.

The native source preview is served at `http://127.0.0.1:8886/game/overflight/play.html`. The earlier frozen build at port 8884 remains intact. No duplicate full build or distribution ZIP was generated.
