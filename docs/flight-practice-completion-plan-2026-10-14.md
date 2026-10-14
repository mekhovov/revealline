# Flight practice: completion plan and priority review

Updated 14 October 2026. This refines the approved three-app plan; it does not
authorize a new publisher, relaxed reviews, a different host, or changes to SIM
mechanics. Implementation and public release are separate completion states.

## Baseline and concurrent ownership

PR #930 delivered the directory, descriptors, stable launchers, shared offline
installation and guides. PR #1195 restores practice staging in the replacement
main Pages workflow and verifies the deployed selection. It merged on 14 October
as `7c98f1619`; deployment verification remains separate. Follow-on PR #1198 now
targets main directly, so neither implementation lane waits for the old stack.

The Practice branch is rebased onto main
`184a2458c336c43ed0638c3b8ae981a05c1e54a6`, including merged SIM recovery PR #1193,
regional authoring PRs #1197/#1200 and Snake acceptance/retry changes. Earlier candidate receipts remain historical,
bound to their recorded source, rather than being relabelled as this revision.
The unrelated primary checkout and active SIM worktrees are untouched.

SIM's current **World Library** discovery, regional-world, asset, flight-control,
lesson and rendering work stays with SIM. Practice's **application directory**,
shared installation checks, packaging, publishing and guides can proceed in
parallel. Integrate accepted SIM commits from main, not files copied from active
worktrees. Freeze a new candidate after shared runtime inputs change. Preserve
the existing validated appearance-selection handoff added by SIM; it is not an
arbitrary destination or executable query parameter.

## What is already implemented

| Area                | Implemented                                                                                                                  | Remaining proof or refinement                                                                                     |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Discovery           | Three descriptor-driven cards, gameplay previews, purposes, inputs, requirements, versions/sizes, EN/UK, Play/details        | Public selection still empty; verify current browser focus/layout and real released bytes                         |
| Compatibility       | v1 index retained, bounded revision-keyed details, safe routes, metadata fallback                                            | Repeat current public compatibility checks after deployment                                                       |
| Failure handling    | Dated last-known catalogue, empty/failure states, retry/navigation                                                           | Exercise current interrupted/offline requests in browser                                                          |
| Offline preparation | Hash/dependency/worker readiness, progress/cancel, inactivity and overall bounds, previous version retention, scoped removal | Extend installed-app observer to World Studio and closed-window offline relaunch; physical/browser matrix remains |
| Publishing          | Three-app reproducibility/admission, existing publisher/selector, explicit empty overlay                                     | Main workflow repair must deploy; full retained-site capacity and reviewed release selection remain               |
| Guides              | EN/UK player HTML/repository help, maintainer descriptor/preflight/preview/release recipe                                    | Correct drift against current SIM menus, follow guides from scratch, collect current screenshots                  |
| Fourth app          | Automated registration, four-card preview, admission, update/rollback/retirement                                             | Add real browser launch/installation/lifecycle observation; never publish sample                                  |

Prior 290/290 practice and 37/37 SIM recovery checks are useful recorded evidence,
not automatic approval of a later source. See the
[continuation record](flight-practice-continuation-2026-10-14.md) for exact sources.

## Research refinements

These are recommendations inferred from the cited examples, not promises that
RevealLine has already passed their acceptance checks.

1. **Keep capacity as a release prerequisite.** GitHub documents a 1 GB published
   site limit. Our existing 950,000,000-byte guard provides a stricter boundary.
   Count expanded active **and retained** package files, stable launcher copies,
   directory and final metadata, not compressed downloads alone. Keep a repeatable
   preflight and require the existing exact assembled-site check to approve
   capacity. [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).
2. **Tell players what is actually available offline.** VelociDrone Mobile shows
   offline availability per track and explains its limited retention. Adopt the
   clarity, not its automatic oldest-track deletion: RevealLine must preserve
   player records and its promised previous working app version. Separate app-shell
   readiness from imported World content readiness.
   [VelociDrone Mobile manual](https://www.velocidrone.com/mobile_manual).
3. **Treat storage estimates as advice, not a guarantee.** Browser storage and
   eviction are origin-wide; app-specific caches do not create separate quotas.
   A saved pointer or installed icon is not readiness evidence. Test missing
   assets, denied writes and recovery without recommending indiscriminate site-data
   deletion. Persistent-storage permission may reduce eviction risk but cannot
   replace exports or readiness checks.
   [MDN storage and eviction](https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria).
4. **Preserve old sessions during updates.** Prepare the next immutable version
   without replacing an active flight. Include two open versions and close-all-
   windows relaunch in evidence; do not use forced worker activation as a shortcut.
   [web.dev update guidance](https://web.dev/learn/pwa/update).
5. **Make authoring information previewable.** Steam separates item metadata and
   previews from content downloading; Microsoft Flight Simulator asks for clear
   dependencies and support contact. Keep our descriptor/preflight/preview recipe
   and verify it using a real fourth sample instead of adding a second registry
   or marketplace UI.
   [Steam Workshop implementation](https://partner.steamgames.com/doc/features/workshop/implementation?language=english),
   [Flight Simulator metadata](https://docs.flightsimulator.com/html/Developer_Mode/Project_Editor/Marketplace_Data.htm).
6. **Verify focus continuity, not merely an outline rule.** Keyboard/controller
   focus should stay visible after a status change, retry or language switch.
   Exercise narrow screens, zoom and modal exits as well as ordinary tab order.
   [Xbox UI focus guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/113).

Search, ratings, subscriptions, more packages, automatic cache eviction and new
training systems remain out of scope. Three apps do not justify those costs.

## Priorities for review

| Priority / remaining item                                 | Why it is needed and what it brings                                                                              | Impact of not doing it                                                                            | Completion evidence / dependency                                                                                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0 — Restore and verify deployed directory**            | Repairs missing `/practice/index.json`; even an empty selection gives usable help/navigation                     | Menu still appears broken; a green main-page check can conceal missing practice files             | Reviewed #1195 deployment plus exact-source site receipt; independent of candidate qualification                                                           |
| **P0 — Sustainable retained-site capacity**               | Makes updates and rollback deployable, with room for metadata and growth                                         | First release has almost no margin; a later update can fail the whole site deployment             | Repeatable measured preflight, content-preserving reduction or approved hosting decision, then full exact inventory under unchanged guard                  |
| **P0 — Source-bound installation/recovery qualification** | Proves three apps coexist, launch offline after every window closes, preserve records and survive failed updates | “Ready offline” or an installed icon can mislead; failures can strand players or lose saved state | Current frozen bytes; all-three observer, distinct-candidate upgrade/rollback, missing-file/quota/cancellation checks; physical checks separately recorded |
| **P0 — Reviewed release and selection**                   | Converts implemented software into the three playable public packages the user requested                         | Catalogue remains intentionally empty regardless of how many local checks pass                    | Required evidence, correctly allocated release version, verified uploaded/downloaded originals, reviewed selector and public one-Play/offline checks       |
| **P1 — Correct and synchronize player guides**            | Removes menu drift, explains package versus world downloads and input setup at the point of use                  | Players follow dead-end instructions or assume an imported world is an app; support load rises    | EN/UK parity checks, actual current screenshots and task walkthroughs; link maintained SIM onboarding                                                      |
| **P1 — Fourth-app browser recipe**                        | Demonstrates maintainers can add an app without package-specific renderer changes and reverse a bad update       | File fixtures may pass while the actual launch/update/retirement journey fails                    | Unpublished temporary sample: four cards, one Play, explicit start/pause/retry, update, offline reopen, rollback and retirement                            |
| **P1 — Device/accessibility/performance baseline**        | Establishes supported input paths, focus/status announcements and acceptable use on target devices               | A technically downloadable package may be unplayable with a radio, touch or assistive technology  | Named browser/device/input, source/hash, screenshots and limitations; no synthetic substitute for physical or human observations                           |
| **P2 — Wider first-time-player and recovery polish**      | Finds confusing selection/onboarding and long-session issues after baseline release                              | Usability and device-edge issues persist, but do not justify adding unrelated catalogue features  | Real novice sessions and broader devices; integrate verified SIM updates and refresh reports                                                               |

P0 means release-blocking, not “stop all development.” P1 work proceeds alongside
P0 investigations. Existing admission policy may require parts of the P1 device
matrix before publication; priority labels do not waive those gates.

## Capacity alternatives and decision boundary

The previous measured lower bound was 947,349,762 bytes for main plus one three-app
generation, and 974,609,441 for two, before all publication overhead. New main
commits require new measurements. The previous generation is a sizing model, not
an already published optional release.

1. **Recommended first: audited content-preserving packaging savings.** Remove
   only proven non-runtime build payload or unnecessary duplicates whose routes
   and authoring/original-download contracts remain intact. Validate all reference
   closures and existing retention behavior. Low architectural disruption, but
   there may be no sufficient safe saving.
2. **If insufficient: separately approved delivery architecture.** Move suitable
   immutable content to a supported distribution path with explicit CORS, integrity,
   offline, ownership, bandwidth and retention contracts. This can create sustainable
   room but is not a small Practice fix and must not be chosen implicitly.
3. **Not recommended: remove content, omit the prior version or raise the guard.**
   These change user-visible guarantees or conceal the host limit. They require
   an explicit product decision and are not part of this implementation.

## Parallel execution and release sequence

- **Capacity lane:** current no-write inventory, safe-savings audit, reusable
  capacity preflight and regression coverage.
- **Installation lane:** extend the existing observer to all three apps, bounded
  failure diagnostics and genuinely closed-window offline relaunch.
- **Guide lane:** fix EN/UK instructions and stale qualification claims; test
  parity against maintained app interfaces.
- **Integration lane:** research/plan, fourth-app browser lifecycle, combined
  tests/review, then update PRs without waiting idly for the queue.

After independent changes pass, rebase accepted main changes again if required,
freeze one exact candidate, reproduce/admit all three apps and bind qualification
to its bytes. Review, publish, select and verify through the existing release
process. Old receipts stay historical; changing candidate runtime invalidates
assumptions that depend on it. Do not repeatedly rebuild while SIM is still
changing unless an integration check specifically needs those commits.

Phase 1 remains open until all three apps are actually selected/playable on Pages,
genuine offline relaunch passes, upgrades preserve working installations and
records, and the temporary sample recipe works. Manual/device or architectural
decisions must be explicitly assigned when automation cannot supply them; no
invented pass, silent waiver or indefinite wait for a PR substitutes for completion.

## This continuation's results

- Rebased the publication repair onto `f0ccfd37`; kept it separate in #1195.
  Continued verification/guides/capacity work on `codex/flight-practice-qualification`
  without waiting for that PR to merge.
- Added the capacity command and retained-version accounting to the existing
  bundle tool. The [measured review](flight-practice-capacity-review-2026-10-14.md)
  includes stable launcher duplication: current observed core plus the admitted
  development packages and comparable retention reserve is at least **975,134,465
  bytes**, **25,134,465 bytes over** the unchanged guard, before further overhead.
  It explicitly distinguishes the mixed-source sizing model from release proof.
- Corrected English/Ukrainian guides to match current SIM/Gym settings, offline
  preparation, controller choices, explicit resume, and safe storage removal.
  Removed stale World Studio package-limit and waived-test claims. Added guide
  parity/navigation regression coverage.
- Added all-three installed-app observation and bounded cleanup/password handling.
  The real admitted-candidate run is **blocked by its password gate**: no preparation
  checkpoint passed, no gate bypassed, and cleanup succeeded. An authorized test
  password was requested. Helper tests do not constitute app qualification.
- The real-browser fourth-sample recipe passes six checkpoints on installed Chrome
  155.0.8059.40: discovery/launch/start/pause/retry, previous preparation, changed-byte
  update retaining previous, zero-tab offline reopen with a failed uncached network
  probe, rollback, and retirement preserving immutable URLs. The known password
  and synthetic review records apply only to this unpublished fixture.
- Final combined practice regression suite: **304 passed, 0 failed, 0 skipped**
  after the observer's locale/menu regressions were added (the earlier run was 303).
  The optional browser companion is a separate opt-in check, not included in that
  count. Current physical-device, screen-reader, human-learning and public-package
  acceptance are still missing.

Retained browser evidence: [six-checkpoint recipe receipt](flight-practice-qualification-20261014/recipe-browser.json),
[actual sample pause screen](flight-practice-qualification-20261014/sample-paused.png),
and [real-candidate credential blocker](flight-practice-qualification-20261014/installation-blocked.json).
The screenshot is copied byte-for-byte from the temporary path named in the
receipt. These records explicitly identify baseline/source and fixture limits.

The plan's current recommendation is to finish these independent improvements,
keep the publication repair moving through normal review, and resolve the
measured content-delivery decision before claiming a sustainable public release.
Do not mark “three playable public apps” done on the strength of local fixtures.

### Latest integration checkpoint

- #1195 is merged; #1198 is rebased onto `184a2458c` and targets main. The latest
  main deployment is still running at this checkpoint; `/practice/index.json`
  still returns 404, so deployed recovery is not yet marked passed.
- A bounded, read-only lossless audit checked 30 images (90,551,929 bytes) and
  measured 1,235,912 bytes of potential savings. This does not close the measured
  retained-version gap. No image bytes, pinned hashes, original-download routes,
  retained versions or size guards were changed. The audit has five regressions,
  including rejecting transparency semantics it cannot preserve.
- Directory introduction text now supports arbitrary catalogue counts rather than
  promising exactly three apps; a 0/3/4-card regression covers the maintainer recipe.
- Controlled three-app testing found an Academy first-pointer focus/layout issue
  on the Workshop disclosure. The native keyboard route is usable; observation
  records that route and does not claim pointer qualification. SIM/UI follow-up
  remains required. These controlled packages are not the actual release candidate.
