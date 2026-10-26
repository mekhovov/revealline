# FPV combat implementation status — historical baseline

**This document describes the earlier combat implementation and r1 appearance pack, before the six-phase overhaul.** Its activity rules, package measurements, qualification claims and remaining work are historical. They are preserved for comparison, not presented as current results.

See the [current delivery report](overhaul-delivery.md), [player guide](player-guide.md) and [runtime qualification](overhaul-runtime-qualification.md) for the revised implementation, r2 assets and remaining release gates.

The original status was recorded on 2026-10-20 in the isolated local workspace. No publication approval is implied.

## Implemented in Phase 1

- **Activities and defaults:** Original course, Continuous combat, three-minute
  Target hunting, and Elimination. Learning defaults to Original; other flights
  default to Continuous. The two activity preferences are remembered separately.
  Public unscored free flight retains the player's choice. Editor previews,
  tuning trials, demonstrations, and historical replay keep their qualification
  rules. Combat results are separate from original course progress.
- **Moving, destroyable targets:** companions admit existing and generated actors
  against the host geometry, with populations up to 6, 12, or 20. Target families,
  vehicles, drones, hazards, and practice props support pulse hits and drone
  impacts. All companion actors are destroyable; optional props do not block
  completion. Difficulty caps simultaneous attackers at 2/3/4. Hunting replaces
  a defeated target after 50 accepted ticks when its spawn is clear. Continuous
  waves retain clear-spawn checks, intermissions, and a next-wave action.
- **Flight integration:** native World/legacy and Regional Standard/Advanced
  paths share the encounter definition and accepted-tick transaction. Pauses,
  rejected preparation, streaming, and stale launches do not commit combat
  progress. Regional flights expose return/restart actions outside the encounter
  area. Moving colliders, safe replacement placement, and relative collision
  speed are integrated with the applicable physics backends.
- **Effects using the current art:** shared family/cast equipment and material
  breakup, hit feedback, blood options, remains, surface marks, and audio. The
  existing shared destruction switches remain compatible; Auto/High/Ultra detail
  uses a separate preference. Up to 1,024 logical defeat records survive pause,
  origin changes, and paired recovery. Visible pieces and bursts have independent
  limits; oldest logical records are evicted only when the ring is full. Reduced
  motion and blood/remains choices take effect without changing damage rules.
- **Radio Fire:** optional binding, alias rejection, release-before-activation
  after arming/pause/focus/setup/disconnect, and combat-owned firing cooldown.
  `RadioProfile.v4` is used only with Fire; older profile formats and calibration
  remain usable. The user confirmed Fire works in Railway Valley before and
  after pause.
- **Studio:** shared validated companion definitions, activity/difficulty/
  population choices, actor health/damage/behavior, routes and spawn zones,
  undo/redo, export/import, and stable-ID source reimport with visible missing-ID
  decisions. Preview uses the same effect recipes as runtime. Companions bind to
  an exact map identity and leave immutable original packs unchanged.
- **Recovery:** paired flight/combat checkpoints and bounded rolling recordings
  keep continuous play running after the retained recording window rolls over.
  Recovery validates exact environment/configuration identity and bounded state.
  An explicit local-practice import handles retained history; full-proof import
  continues to reject incomplete history.

## Evidence obtained

| Check | Observed result | Scope and limit |
| --- | --- | --- |
| Course admission | 204 built-in courses and 41 courses in 20 downloadable packs; minimum 12 actors admitted; zero failures | [Admission report](native-downloadable-admission.json), with downloadable bytes/SHA and asset validation. This is static spawn/route admission, not a full playthrough or the 120-tick movement check below. |
| Regional admission/movement | 126 authored starts across 24 pinned regional revisions; all admitted 12 actors; 11–12 actors changed position after 120 accepted ticks | [Regional report](regional-admission.json): exact pinned terrain/scenery bytes were checked. This short runtime check does not establish long-session navigation or every combat outcome. |
| Integrated regression group | 256/256 passed | Focused Phase 1 integration run, including the host, runtime, physics, radio, Studio and presentation changes. Local run log: `/tmp/fpv-combat-final-focused.log`. Subsequent internal appearance tests are separate. |
| World UI regression group | 136/136 passed | [Regression log](world-ui-regressions.txt): full host UI group, optional-art fallback/same-attempt behavior, bounded asynchronous catch-up, fresh input, pause/focus/stall/replacement ownership, and preserved synchronous elapsed time. |
| Final art and packaging regression group | 107/107 passed | [Regression log](final-art-package-regressions.txt): admission, shared resources, appearance activation, fallback/cache/cancel, presentation and optional package/core-cache exclusion. |
| Optional-art Settings and Workshop delivery | Download, 36-character activation, same-state switching, cached reload and previews passed | [UI report](realistic-delivery-ui.md): production app on the isolated test host, exact pinned manifest/model, paused snapshot unchanged, zero pack requests on blocked-network reload, clean/bloody Workshop preview and cleanup. Password-form acceptance is outside this check. |
| Host/Studio/optional-art regression group | 21/21 passed | [Regression log](host-controls-studio-regressions.txt): production callback ownership/defaults, closing Studio during optional-art preparation, round trips, encounter controls, download/cache/cancellation ownership. |
| Additional host regression group | 60/60 passed | Regional preparation, storage, controller readiness, download picker, workbench and Studio setup. The missing tracked authoring HTML was hydrated exactly from HEAD; the pause fixture was updated for its current input context. |
| Transient contact / physics / appearance regression group | 75/75 passed | [Regression log](physics-contact-regressions.txt): early substep hull contacts, angular relative impact speed, rejected transaction rollback, unchanged historical physics hashes/recordings, both Advanced backends and real-consumer appearance activation. |
| Recovery/backend regression group | 53/53 passed | Moving actors, transactional restore, actual 36,000-tick rollover, explicit practice import, worker protocol, terrain, and historical Advanced proof/qualification checks. Groups overlap; counts must not be added into a unique test total. |
| Browser rendering stress | 600.006 seconds, 35,873 frames, 12 phases, no reported errors | [Native/procedural regional report](native-procedural-regional-stress.json): M4 Pro, headless Chrome, 1080p, 20 live actors, full remains ledger in effects-on phases. Effects update CPU p95 ≤1.6 ms; frame interval p95 16.7–16.8 ms. Synthetic actors/events exercise the real renderer, not the complete physics/radio/UI frame. |
| Actual Railway rendering stress | 600.008 seconds, 35,792 frames, six phases, no reported errors | [Railway report](railway-valley-stress.json): pinned terrain/scenery, 20 synthetic actors, full remains ring, 16 geometry transitions including 12 boundary recenters, six scene rebuilds/archive restores. Draw CPU p95 off/on: Low 0.5/1.5 ms, High 0.6/2.3 ms, Ultra 1.0/2.6 ms. Effects CPU p95 ≤1.7 ms is included in draw CPU, not additive. Frame interval p95 16.7–16.8 ms. |
| Complete accepted sessions | 4/4 focused cases passed | [Full-session acceptance](full-session-acceptance.md): actual radio/aircraft/session path completed 9,000 hunt ticks, 36,017 regional continuous ticks, boundary/return physics and paired recovery including the first post-rollover radio tick. Controlled six-target lane without return fire; CPU acceptance, not full-browser FPS. This separate count is not added to the integrated regression total. |
| Combined browser recovery and boundaries | Final late-state and Standard boundary cases passed, zero browser errors | [Browser acceptance](combined-browser-acceptance.md): the actual Advanced app/worker resumed tick 36,017 through 39,082, including UI save/restore; Standard crossed a streamed cell boundary and returned with the encounter unchanged. Both disposed their owned resources. Calibrated synthetic radio, Current art, controlled six-target fixture; the human USB check is separate. |
| Equipped-roster rendering stress | 600.014 seconds, 35,453 frames, zero errors | [Final roster report](realistic-roster-railway-performance.json): 20 skinned actors, actual Railway scenery, 1,024 logical remains, rotating casts, repeated eight-victim mixed effects and rebuilds. Presentation CPU p95 increases were 1.1/2.7/2.3 ms for Low/High/Ultra on the reference M4 Pro. |
| Physical radio | User confirmed yaw, manual Save, Railway flight, and Fire before/after pause | Real transmitter acceptance for these reported actions; other device transitions also have automated coverage. |
| First-hit preparation/audio | Empty-to-populated shader count stayed at nine; Web Audio output had a nonzero signal | [Shader report](shader-preparation.json), [audio report](audio-output.json). These are preparation and signal checks, not subjective visual or listening approval. |
| Optional package candidate | Admission exercised without raising caps; `publicEligible: false` | [Package report](package-admission.json): Worlds uses 210/210 source files; its input is 20,174,014/20,971,520 bytes. Academy input headroom is 1,091 bytes. Synthetic source bindings qualify this working-tree candidate only. |

The core tests additionally cover target replacement, attack caps, guarded-target
defeat paths, destructible props, accepted-hit deduplication, invalid recovery,
terrain support, and the full logical-remains ring. Presentation tests cover all
shared families/casts, bounded complete fragment clusters, restore/rebasing,
settings separation, and resource cleanup.

## Qualification limits

1. **Rendering evidence is bounded.** The Current and Realistic ten-minute
   desktop renderer checks completed. They exclude the full physics/radio/UI
   frame and snapshot-copy overhead. The separate
   [full-session tests](full-session-acceptance.md) exercise accepted aircraft
   physics, a 12-minute regional session, rolling history and paired recovery.
   [Actual browser checks](combined-browser-acceptance.md) additionally cover
   worker transport, late-recording recovery, native flight, and a regional
   boundary round trip. These are
   distinct workloads, not a combined worst-case FPS claim. Stress runs do not
   include projectile traffic;
   [a separate projectile check](regional-projectiles.json) covers that path.
   Other GPUs, mobile devices, and browsers remain unqualified. See the
   [presentation evidence](README.md) for methods and visual examples.
2. **Release qualification remains separate.** Generated projections and
   working-tree package admission were checked. Any further source edits require
   regeneration/freshness checks, and a release requires admission at its real
   source identity. The candidate record is neither deployment evidence nor
   public eligibility.
3. **Combat verification remains local practice.** Integrity/identity checks and
   paired recovery do not turn these new combat records into remotely attested
   or original-course qualified results. Rolled history is explicitly incomplete;
   it cannot claim full verified proof or original progression rewards.
4. **Destruction scope is encounter actors.** Static terrain/buildings and
   decorative map scenery are not universally destructible. Current effects use
   stylized procedural assets, cosmetic ballistic settling, and grounded plane
   marks; they are not articulated ragdolls, realistic wound meshes, or
   mesh-conforming decals.

## Phase 2 — equipped roster qualified on the reference desktop

The optional CC0 MakeHuman clothed pack now supplies all 36 family/cast identities,
paired live/distance rigs, four original motion clips, six authored damage regions
with caps, and shared role-specific equipment. Its proportions and textured game
art are more realistic than Current; this is not photorealistic art.

The actual browser loader has checked all 36 High-detail remains clusters, live
wardrobe, connected clean bodies, bloody breakup, and shield/brace states. A
settled-equipment pose mismatch caught in that review was corrected generically:
25 nodes reuse the original gear geometry with the body regions' authored idle
pose. Independent browser and builder matrices agree within 1.1e-7. Rebuilding
finalization plus settled gear from the same raw export produces byte-identical
manifest and GLB files.

The final pack is 13,610,307 download bytes including its manifest. Admission
estimates are 103,546,328 decoded bytes and 125,981,328 GPU bytes, with 60,691 unique
POSITION vertices. These are conservative admission estimates, not measured
process memory. The pack stays outside the bounded base FPV package.

Explicit download, validated caching, cancellation, Current fallback, same-attempt
art changes and Studio previews are implemented. The final equipped-roster
renderer benchmark passed: 600.014 seconds, 35,453 frames, zero errors, and
presentation CPU p95 increases of 1.1 / 2.7 / 2.3 ms
for Low / High / Ultra. The qualified pack is now pinned and selectable. See the
[release record](realistic-roster-release.md) for hashes and verification scope.
Actual browser Settings checks also passed explicit download, 36-character
activation, same-attempt switching and cache reuse with pack requests blocked.
Built-in Workshop clean/bloody previews and resource cleanup passed; see the
[UI delivery report](realistic-delivery-ui.md) for the test-host scope.
