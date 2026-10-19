# F64 · Hunt attempt facts and personal progress

Candidate based on captured `main` `a94f2a6c3dac43ebeead58036a7b890414dfff37`.
Implementation review, full source validation and browser/device acceptance remain separate gates.

## Player change

Terminal Hunt copy has separate lines for this attempt and personal progress for the exact accepted setup. Current score, target/contact/enclosure counts and won-attempt style facts cannot inherit an earlier attempt's clean/contact achievements. Personal best and accumulated milestones still use the existing exact mode/recipe record identity and merge behavior.

One missing existing style goal is shown in this order: all targets, all by contact, no damage. All three earned means completion copy, with no invented extra goal. Bonus hunting stays optional; capture-quota still requires capture and its real quota. Hunt-only and full-population quotas explicitly say all targets are already required to win and only the other style goals are optional. These are cosmetic existing milestones, not new lesson progress, rewards or mechanics.

Live/paused readouts keep their existing compact visible text. Snake tail, chain, ordered-target and bonus suffix production code is unchanged. Only terminal text uses line breaks. Personal records available only in this session get an explicit saving-unavailable line.

## Ownership

`game/hunt/records.mjs` extracts the existing won-attempt milestone calculation for a pure presentation read. The damage-owner precedence and stored criteria are unchanged. Record keys, schema, merge, bounded retention, once-per-run completion, corrupt/future-data protection and session fallback are unchanged. Locale refresh reads facts; it does not call completion or saving. The status node owns no result actions and does not replace their subtree or focus.

Actual adapters remain unchanged: primary Solo shares an owner between live and `record:false` result status; each Versus seat does the same in `versus` mode; Team shares the `team` owner between its two status containers. Solo practice retains its existing `record:false` live owner. A result view's `record:false` is not treated as proof that the attempt is practice.

## Focused result

Ten complete files pass **66/66, zero skips**: `hunt-status.test.mjs`, `hunt-records.test.mjs`, `hunt-status-core.test.mjs`, `hunt-status-host.test.mjs`, `hunt-host.test.mjs`, `hunt-feedback-layout.test.mjs`, `hunt-core.test.mjs`, `coop-hunting.test.mjs`, `snake-hunt-core.test.mjs`, and `team-hunt-progress.test.mjs`. This total includes three application adapter cases and three separately identified command-completed core cases; it does not turn either into browser acceptance. Changed-file ESLint, Prettier and diff checks pass.

## Verification boundaries

- New component/model cases first ran against unchanged captured main: **9 failures, 4 passes**, establishing the missing presentation behavior. Terminal states in those fixtures are deliberate model data, not native play evidence.
- New command-completed core fixtures validate real Solo/Versus-core Hunt and Team Hunt wins through commands, without assigning terminal status or moving actors/players. Display/current milestones match stored milestones, with one Hunt-record write and no other storage key. These are core/component evidence, separate from application adapter tests.
- New actual application adapter cases exercise ordinary Solo with running enemies, both actual Versus seat pairs, and Team live/result pairs. They retain accepted state, current controls/focus and Hunt storage through EN → UK → EN. Finite DOM/image boundaries make no browser, rasterization, artwork, sound or hardware claim.
- Existing complete record, Hunt host, feedback layout, Solo/Team Hunt core, Snake Hunt core and Team Hunt progress files are retained in the focused cohort. Added record cases cover the exact existing damage-owner precedence and a pure read's lack of writes/mutation.
- An initial advanced-level injection into the legacy Solo base catalog was rejected by its correct pack/simulation version admission. It was an invalid fixture, not a runtime finding. The actual ordinary Solo adapter replaced that fixture.
- A separate authored Solo Hunt route attempt stopped at picture admission: `Picture unavailable. Your flight remains paused` / `SoloInitialPictureFailureV1`. No media was restored and that authored route is not claimed qualified. Ordinary Solo, Versus and Team coverage is not an artwork substitute.
- An initial core comparison exposed `structuredClone` normalizing a null-prototype cache. Comparing cloned snapshots on both sides preserves the full state assertion without changing production or game expectations.

No global helper, timeout or existing assertion was weakened. No hydration, build, snapshot, full lint/validator or browser session was run for this feature. Disk remains below the agreed reserve; those gates must wait. EN/UK browser result wrapping and retained actions, authored Solo picture availability, actual handheld/PWA offline and physical-controller acceptance remain open.
