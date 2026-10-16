# Pause, Skip and mission start: plan for review

Reviewed 1 October 2026 (Europe/Berlin). Scope: the Pause/Skip/start-screen requests in this chat. Priorities below are recommendations for user review, not changes to the shared release milestone or other teams' commitments.

## Evidence and corrections to the previous report

- [PR #831](https://github.com/mekhovov/revealline/pull/831) merged on 30 September as `dc37f277e634aa7ca99730dacb8f222cc8c34769` and is included in observed main `955c539a757c08c534c9038500785b20e64abb36`.
- Both [deployment metadata](https://mekhovov.github.io/revealline/main-deployment.json) and [game metadata](https://mekhovov.github.io/revealline/game/build-info.json) identify `955c539a757c08c534c9038500785b20e64abb36`. The first calls it `main-955c539a757c`; the second retains version `0.142.4`. This proves deployment identity, not a new browser playthrough or cached-client update.
- The latest listed formal GitHub release remains [v0.142.3](https://github.com/mekhovov/revealline/releases/tag/v0.142.3). Continuous main can deliver changes before the next named release. The earlier statement that release aggregation was the only unfinished work omitted current public/device acceptance.
- [Milestone 57](https://github.com/mekhovov/revealline/milestone/57) still targets v0.150.0. The active-release variable now also names v0.150.0. Its older predecessor wording requires coordinator interpretation; do not invent new serial release obligations from that wording.
- The milestone snapshot has ten open PRs and fourteen open issues/PRs combined. An open milestone item is not automatically a dependency of Pause/Skip. The shared release coordinator must identify the chosen release scope and defer other inputs explicitly where appropriate.
- Later landing simplification (#854) moved How to Play into Settings → Help & Extras. Current `game/ui/native-menus.mjs` still moves `shell-help` to that category. Thus the original top-level Help request was implemented in #831 but is superseded in current main. This is an explicit product decision for this review.
- Earlier test cohorts and browser observations retain their recorded source revisions. They do not certify all subsequent changes. The 57-, 30-, and 75-test batches overlap and must not be added as a unique test count. Full PR test/build jobs skipped by policy are not passes.

## Completed implementation

| Requirement | Evidence/status |
| --- | --- |
| Resume first, then Missions, Sound, Config, Home | Merged compact Pause structure; current main retains the grouped markup. |
| Restart / Skip / Choose / Info | Implemented, with restart confirmation and in-place information expansion. |
| Universal normal Solo Skip | Implemented with authoritative successor ordering across campaigns/packs/collections and final-to-first wrap; excludes tutorial/practice/scenario/non-Solo cases. |
| Safe two-step Skip | Resolves destination first, warns of no rewards, validates successor before replacing the old attempt; cancellation, stale identity, failure and retry have focused coverage. |
| No reward for Skip | No clear, medal, mastery, unlock or picture award; Journey receipt where supported; Classic/Custom cursor behavior. |
| Sound and Next song | Master mute and queue-aware Next; no Pause music Play/Pause control. |
| Fullscreen | Main/Pause controls and header removal implemented, with support/state handling. |
| Start-screen layout | Stable preparation status and action arrangement; visible mission-load cancellation controls removed. |
| Navigation | Default Resume focus, focus restoration, checkpoint preservation, keyboard/controller ordering and touch duplicate-activation coverage. |
| Responsive behavior | Prior browser checks at 320×568, 390×844, 568×320, 844×390, 1024×768 and 1440×900; Ukrainian and large text also checked. Physical devices and all later integrated revisions are separate acceptance. |
| Delivery | Source merged, plan-owned feature checkout clean/synced, deployed main metadata includes the merge. Formal v0.150 release remains pending. |

## Proposed remaining work in priority order

P0: a confirmed defect that prevents playing, loses progress or grants incorrect rewards. P1: next acceptance needed to close this player's request. P2: useful release/follow-up work that should not indefinitely delay the first usable result. No new P0 defect was established by this planning review.

### R1 — Check the actual public game and an existing saved client — P1, first

**What:** use the current public route to start a normal Solo mission, pause, inspect all groups, expand Info, visit Settings/Choose and return, arm/cancel Skip, then confirm one Skip. Observe both a fresh session and a retained profile/cache, without clearing the player's data. Record the actual source revision and route; an older immutable release URL is expected to stay old.

**Why:** the repeated complaint was that the visible game still looked old or broken. Source merges and deployment metadata cannot prove that the player's browser loaded the fixed UI or that later shared changes preserved it.

**Benefit:** a demonstrated working entry point and a clear diagnosis if an old URL, retained client, deployment or UI regression explains the mismatch.

**If deferred:** we could call the request finished while the player still sees the original problem.

**Done when:** current public Start/Pause/Skip work with stable buttons and retained progress; any mismatch is either corrected or explicitly explained with a verified route. Confirmed failures become P0 correction work. No automatic cache/save reset.

### R2 — Verify the small-iPhone experience and accessibility — P1, next

**What:** repeat portrait and short-landscape checks on the selected integrated build, then use a real iPhone when available. Cover Safari browser bars, rotation, notch/home-indicator safe areas, scrolling, touch, long Ukrainian labels and large text. Add real 200% browser zoom and forced-colors checks on a supporting desktop browser. Test supported fullscreen behavior without requiring unsupported iOS APIs.

**Why:** the screenshots showed cropping. Desktop viewport simulation does not reproduce all mobile browser chrome, safe-area or physical touch behavior; app large text is also different from browser zoom.

**Benefit:** the menu remains readable and every action stays reachable on the devices that motivated the request.

**If deferred:** uncommon orientations or text settings may still hide actions despite a successful desktop check. This is an evidence gap, not proof of a current defect.

**Done when:** no overlapping/horizontally clipped actions, useful touch targets, reachable Home/Resume and correct focus scrolling in the selected conditions. If hardware is unavailable, record the exact untested cases and keep device acceptance open.

### R3 — Verify failure/recovery and physical controller use — P1, bounded

**What:** on the integrated build, exercise delayed/failed successor preparation, Back/Resume while Skip is armed, mission-owner boundaries and no-reward behavior. Verify saved checkpoint and opener restoration through the same menu journey. Reuse existing tests where source attribution remains valid. Run one physical controller/Steam Deck journey, including reconnect and touch followed by controller release, when hardware is available.

**Why:** a menu can look correct while double activation skips an extra level, failed preparation loses a run or returning from Settings resumes unintentionally. These paths have earlier tests, but current integrated/hardware acceptance is narrower.

**Benefit:** confidence that Skip and menu navigation preserve the player's attempt and progress.

**If deferred:** low-frequency input/download failures could interrupt play; virtual-controller checks cannot establish physical-device behavior.

**Done when:** failed or canceled Skip retains the original paused run, successful Skip adopts exactly one successor with no reward, and navigation restores the correct focus. Record unavailable hardware separately rather than inventing a pass. Keep this scoped to the menu journey, not a new whole-product reliability project.

### R4 — Choose the location of How to Play — review decision, low implementation effort

**Current behavior:** Settings → Help & Extras. **Original request:** top-level main menu, absent from Pause.

**Recommendation:** keep the compact current landing and preserve Help in Settings, provided the start screen's Learn by playing remains easy to discover. If first-time-player discoverability matters more than one extra landing action, restore a top-level How to Play shortcut. Both choices should preserve one underlying Help flow.

**Why/benefit:** this resolves a real difference between the original requirement and later integrated navigation. It prevents future work from alternating between contradictory menu contracts.

**If deferred:** the feature remains reachable, but the original request cannot honestly be marked fully satisfied and later changes may reverse the layout again.

**Done when:** user chooses the preferred placement; the documented contract, implementation and navigation checks agree. No runtime relocation is authorized by this proposed recommendation alone.

### R5 — Qualify and publish a stable named release — P2 for live access; P1 for distributable delivery

**What:** have the release coordinator select the smallest compatible scope, identify true dependencies, and defer unrelated unfinished inputs as needed. Run required source, package/capacity and release validation on one fixed candidate, including the full-suite requirement from the original plan or an explicitly recorded alternative. Publish one named release and smoke-test its exact URL and update path.

**Why:** continuous main changes over time; a named release gives a reproducible version, distributable packages and a stable support/rollback reference. It is distinct from the current live game already containing the source.

**Benefit:** a dependable release users can bookmark, download and report bugs against.

**If deferred:** live fixes may remain available, but the latest formal tag/downloads trail them. Deferring this does not by itself mean the live menu is broken.

**Done when:** one selected commit passes applicable gates and the published package/public route is verified. Keep skipped/full-suite limitations explicit. Do not make every optional authoring, simulator or Demo enhancement a menu dependency merely because it shares milestone 57.

### R6 — Additional visual polish and wider feature work — P3, defer

**What:** only add spacing/icon/copy refinements after observing an actual usability issue. Separate unrelated simulator courses, Demo content, creator galleries and artwork from this menu closure plan; their existing owner plans continue independently.

**Why/benefit:** optional refinements can make the menus feel more coherent, but the requested hierarchy and main layout fixes already exist.

**If deferred:** the current visual design remains; no known core menu capability is lost. A newly reproduced usability defect is reprioritized under R1/R2 instead.

**Done when:** this plan closes after the chosen placement and acceptance/release decisions. Optional ideas remain backlog items rather than permanent completion blockers.

## Recommended batches for user review

1. **Prove the fix players see:** R1 plus browser-accessible R2/R3 checks. Correct only reproduced regressions; produce a reviewable public/demo route with the build identity.
2. **Finish the original device promise:** physical iPhone and controller checks from R2/R3; resolve R4. If devices are unavailable, carry an explicit hardware limitation instead of stalling all delivery.
3. **Freeze a stable release:** R5 through the existing release coordinator, with optional unrelated features deferred where appropriate. This can proceed alongside device scheduling under an explicit acceptance decision.
4. **Optional refinement:** R6 only after user feedback establishes value.

Review choices: (a) compact landing with Help in Settings versus a top-level Help shortcut; (b) whether physical iPhone/controller acceptance is required before the named release, or can be a documented follow-up; (c) prioritize a small stable menu release versus including more milestone features. Recommended defaults: compact landing, real iPhone check prioritized because cropping was reported, and the smallest compatible release scope. These are proposals, not changes to release policy or queues.

This update changes only this scoped planning document. Broader delivery plans have concurrent local edits and are intentionally not rewritten here. No new runtime tests or browser playthrough were performed in this planning turn.
