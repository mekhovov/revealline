# Shared game demonstrations

**Delivery status:** implementation and prior qualification evidence are retained, but the full approved plan is not complete. See the [updated implementation plan and status](shared-game-demos-plan.md) for the pushed latest-main integration and deadline corrections, offline exact-tick diagnostics, remaining qualification checks, and conditional estimates. The behavior below describes the implemented design; it is not a claim that every final acceptance gate has passed.

The ordinary game menus expose **Watch a demo** for the current mode and **Watch all modes** for a continuous mixed rotation. Eligible idle menus enter the current mode after 60 seconds. Reduced-motion settings disable idle entry by default; the player can change that choice in demo Details.

## Scope and inventory

The inventory is derived from the authored catalogs, not a fixed count in the runtime. It covers standard authored Solo missions, Snake Solo missions, supported SIM course/flight-mode pairs, and FPV Survival scenarios. Team/Versus, Raid, prototypes, free flight, editors, custom combinations, and separately installed external chapters are excluded. Classic Current-rules projections are alternative setups of existing authored missions. Selected company editions remain separate distributions and retain their own content boundaries.

The Solo audit includes the default Journey and prior editions exposed by the ordinary mission library, in addition to Classic originals. See [the scope audit](qualification/solo-demo-scope.json). Coverage qualification fails on missing, stale, nonterminal, or insufficient-progress performances. Device availability does not count as coverage.

The synchronized catalog currently requires **890 level/variant entries**:

| Mode         | Required entries | Native coverage                                                               |
| ------------ | ---------------: | ----------------------------------------------------------------------------- |
| Solo         |              240 | 101 Classic originals, 91 current Journey missions, 48 prior Journey missions |
| Snake Solo   |              240 | Every authored Solo mission and mechanic                                      |
| SIM          |              392 | Every authored course with each supported flight mode                         |
| FPV Survival |               18 | Every authored standard scenario                                              |

Additional recordings and browser-specific strict performances do not increase these coverage counts or rotation weight.

The default hosted build contains the complete SIM recording inventory. The standalone `fpv-worlds` download keeps its existing 210-file/20 MiB limit and omits the shared demo bridge and corpus. When that bridge is absent, its demo entry stays hidden and ordinary flight remains available. Opening a demo never installs the missing package.

## Shared ownership

`game/ui/demo-host.mjs` owns the modal, controls, focus, captions, audio controls, fullscreen, practice handoff, and scene retirement. `game/ui/demo-shell.mjs` is the canonical toolbar markup; `scripts/refresh-demo-shell.mjs` projects it into the main Solo page. Native pages install that same shell through `game/ui/demo-entry.mjs` and register its actions with their ordinary menu navigation.

`game/demo-registry.mjs` loads adapters lazily. An adapter enumerates lightweight sources, supplies native presentation and semantic events, mounts its renderer, and reconstructs isolated practice. Every player implements `play`, `pause`, `advance`, `phase`, `forkForPractice`, and `dispose`. Cleanup may return a promise. Only the shared scheduler advances watching; renderer callbacks do not advance simulation. Each engine keeps its existing timestep and replay format.

`game/demo-director.mjs` and `game/demo-rotation.mjs` select a mode, then an unvisited level/variant, then a recording. More recordings do not give a level extra weight. Ordinary cycles avoid adjacent repeats when alternatives exist; bounded fault recovery may reuse the last verified performance before rotation continues. Complete performances retain their real outcomes and recap; Next is immediate. Existing qualified Solo bots and improvisation remain available.

`game/demo-modes/solo.mjs`, `solo-view.mjs`, and `solo-practice.mjs` keep Solo rendering, artwork admission, and practice outside the shared host. The Snake, SIM, and Survival adapters reuse their ordinary simulations and renderers. SIM shares its existing demonstration resolver. Survival recordings include actual movement, upgrade choices, and rerolls.

## Loading, cancellation, and lifecycle

- Metadata enumeration does not decode the recording catalog or create scenes. A missing optional engine cannot delay other available modes indefinitely.
- Each source has a 15-second deadline. Startup and recovery together have a 30-second budget, including alternate candidates and cleanup. Cleanup is awaited with a bounded deadline; a stuck owner blocks replacement rather than allowing overlapping engines.
- At most one next recording payload is prefetched. It cannot create another renderer, physics world, or player.
- Individual bad recordings are skipped. An unavailable renderer or package suspends its mode for the session. Retry explicitly retries availability; Back remains available. Demo entry never installs an optional package.
- A late asynchronous result is disposed instead of adopted. Failed preparation and close/reopen share the same retirement barrier.
- Hidden watching preserves bounded playback and listening intent without painting. Freeze suspends scheduling; resume rebases time. Practice pauses on foreground loss. Reloaded/discarded pages boot through their ordinary entry flow.

The host exposes bounded source/failure/loading diagnostics and compact owned-scene/resource snapshots. Browser qualification logs at most 800 endurance samples. These are diagnostics, not player progression.

## Practice and player data

Takeover reconstructs the displayed checkpoint into an isolated native practice session. The initiating fresh input is applied once. Held keys, controller drift, and SIM radio/throttle pickup retain their neutral/arming gates. Return to watching restores the original performance.

Watching and practice do not write scores, rewards, ordinary saves, recovery records, or tuning preferences. Explicit demo settings and explicit audio changes remain player choices. All entry pages share the existing per-build demo-settings channel; native entries read the same small build identity, and the earlier global shared key is a read-only fallback when that channel has no saved settings. Opening a demo never migrates storage or clears Solo recording consent. Audio controls borrow the page's existing player; rotation and pause do not create a second music player or replace listening intent.

Play from beginning uses ordinary guarded departure and exact mission identity. Eligible ordinary launches arrive at Ready; SIM remains disarmed. Solo preserves its existing eligibility rules: installed locked missions enter isolated practice, and uninstalled missions open the normal chooser. Solo artwork uses existing earned-picture rules. A separate Journey profile cannot unlock another route's art. Existing Solo personal recordings remain supported; other modes do not collect personal recordings.

## Explanations and accessibility

The presentation identifies mode, mission, goal, and recorded/live source. Captions come from actual events, stay visible for at least six seconds, pause with playback, discard stale warnings, and retain the last five explanations in Details. Their observed history follows language changes. Shared controls support keyboard navigation, focus restoration, reduced motion, and narrow layouts; native SIM and Survival controls retain their own input handling.

## Qualification

Recordings bind to exact content and simulation identities. Newly generated recordings include checkpoints every five simulation seconds, in addition to full native replay verification. A checkpoint mismatch identifies the first mismatching checkpoint; it does not claim to identify an exact divergent tick between sparse checkpoints. Existing narrowly scoped reviewed Solo compatibility remains unchanged. New Solo and Survival browser alternatives are separately authored, bounded, strict performances; they do not relax checkpoint equality or fabricate outcomes.

Exact-tick investigation uses the offline `scripts/diagnose-demo-ticks.mjs` tool. Capture a reference in a known-good runtime; it independently verifies the complete replay, observes a second complete run, and retains every native tick identity plus a detached checksum receipt. Compare the same recording, content, simulation and setup in the candidate runtime. Comparison finds the first mismatch even when states later reconverge, and reports the unchanged native verification result separately. It never admits a failed recording or rewrites checkpoints. Keep the reference and its receipt from the verified run; checksums detect accidental changes, not a forged pair.

```sh
node scripts/diagnose-demo-ticks.mjs --mode=sim --recording=optional-practice/civilian-fpv/demo-data/beginner-01-self-level-5b7652234b696e5a.json --capture=.cache/beginner-reference.trace.json
node scripts/diagnose-demo-ticks.mjs --mode=sim --recording=optional-practice/civilian-fpv/demo-data/beginner-01-self-level-5b7652234b696e5a.json --reference=.cache/beginner-reference.trace.json --report=.cache/beginner-comparison.json
```

The same interfaces support Solo, Snake, SIM and Survival. Browser-compatible capture/comparison APIs and `scripts/qualify-demo-ticks-browser.mjs` exercise real native observations in installed browser engines. Select the exact browser-specific performance where required; a different recording is a different reference. Trace generation is on demand, bounded to 32 MiB, and excluded from game/package output. Per-tick Survival hashing can take several minutes; normal demo startup continues to use sparse diagnostics and full native verification.

Preparation diagnostics retain one bounded snapshot per existing director event: elapsed stages, up to four candidate variants, preferred engine, prefetch use and latest verified tick. Successful and failed snapshots freeze before entering the capped history, so late work cannot rewrite them. These session-only observations distinguish import, payload, verification, artwork, renderer and retirement delays without recording player input or writing progress.

Repeatable checks (`npm run demos:check` runs the four native coverage commands):

```sh
node scripts/audit-solo-demo-scope.mjs
node scripts/qualify-solo-demos.mjs
node scripts/generate-snake-demos.mjs --check
node scripts/qualify-sim-demos.mjs
node scripts/generate-survival-demos.mjs --check
node --test --test-concurrency=2 game/test/demo-*.test.mjs game/test/snake-demo.test.mjs
npm run validate
npm run build
```

Browser harnesses use an explicitly supplied, already installed Playwright runtime and browser executable. They are restricted to a local server and do not install browsers. `scripts/qualify-shared-demo-browser.mjs` exercises mixed playback, takeover, pause, narrow controls, persistence, repeated retirement, Chromium freeze/resume, graphics loss, offline recovery, and the two-hour rotation. `scripts/qualify-native-demo-browser.mjs` checks the published Snake/Survival adapters through complete playback and isolated practice. SIM and Solo have separate complete-catalog browser harnesses because they preserve their native verification pipelines.

Machine-readable evidence is retained under [qualification/shared-demos](qualification/shared-demos). Reports identify the browser, tested inventory, failures, timing, and completion status. A report with `complete: false` is an outstanding check, not a qualification receipt.

Physical-controller/radio feel, real mobile touch behavior, audible output, and unfamiliar-player comprehension require human/device review and are recorded separately from automated browser checks. Public deployment is a separate step after qualification.

## Research behind the implementation

These examples informed the agreed design; the numeric timing, inventory, and acceptance thresholds are this game's choices.

- [HaxeFlixel's replay example](https://haxeflixel.com/demos/Replay/) demonstrates recorded inputs for attract modes. This implementation reuses native simulations and verifies complete recordings against their exact content identity.
- [Tekken 8's official replay guidance](https://tk8.tekken-official.jp/mode/replay.php) connects contextual advice with immediate practice. Here, observed events drive explanations and the displayed checkpoint can become isolated practice.
- [Game Accessibility Guidelines](https://gameaccessibilityguidelines.com/allow-players-to-progress-through-text-prompts-at-their-own-pace/) recommends player-paced, pausable, or reviewable prompts. Here, captions pause with playback and remain available in recent history; six seconds is a minimum display time, not an assumption about every reader's speed.
- [Factorio's determinism testing](https://factorio.com/blog/post/fff-55) combines inexpensive checks with deeper mismatch investigation. Here, sparse diagnostic checkpoints supplement full replay verification and never relax its acceptance criteria.
- [MDN's WebGL guidance](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices#delete_objects_eagerly) recommends explicit resource retirement. Each adapter releases its owned scene before a replacement can mount.
- [Chrome's lifecycle guidance](https://developer.chrome.com/docs/web-platform/page-lifecycle-api) distinguishes hidden, frozen, and discarded pages. The shared clock handles visibility and freezing separately, and ordinary boot handles a discarded page's reload.


Solo Fresh preserves the existing progression and installation rules, as confirmed during qualification: locked missions keep the isolated-practice fallback, and uninstalled exact missions open the normal mission chooser. Demo watching and takeover do not install packs or unlock progress. Eligible installed missions use guarded ordinary preparation to Ready.
