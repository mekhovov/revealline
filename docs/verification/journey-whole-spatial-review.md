# Combined spatial and pressure review edition

2026-09-21. Explicit candidate integration, **not P13 acceptance or a public
release**. The new `?journey=whole-spatial-v1` Solo/Versus route and Studio's
“Inspect combined spatial + pressure review” use one compiler source. Historical
opening/authored/whole-originals routes and their source factories stay intact.

## What is combined

The existing 71 core missions and 12 optional Remixes retain their sequence,
campaign picture bindings and actor materials. This is not 83 newly created
missions. All use the explicit pressure-v2 policy: Gentle/Standard/Expert enemy
movement factors 1.0/1.4/1.75, attack-rest factors 1.25/0.85/0.65 and 5/3/2 lives.
Player handling and warning windows stay fixed. These remain balance hypotheses,
not human-qualified difficulty ratings. Actual Solo brief/settings and Versus
settings now describe the selected policy instead of the historical v1 text.

Nine encounters select the already reviewed spatial successors:

| Campaign       | Selected successors                             |
| -------------- | ----------------------------------------------- |
| Horizon        | Island Outpost; Courtyard Return                |
| Fractured Grid | Two Districts                                   |
| Phaseworks     | A Return in Reserve                             |
| Livewire       | Cross the Afterglow; Switchyard; Split Junction |
| Sentinel       | Twin Receivers; Relay Perimeter                 |

Selection preserves each study's exact runtime levels and mission revisions,
while retaining the common campaign presentation. Maps are keyed by ID and
revision; conflicting content under an existing immutable key is rejected.
Superseded revisions are removed only when no remaining mission references them.
No new combat, cultural or timed-bonus studies are silently enrolled by this
edition. Team retains its separate authored programme, not converted Solo boards.

## Progress and recovery boundaries

The new route owns `revealline.suspended.journey-whole-spatial.v1` and the stable
IndexedDB profile record `journey-whole-spatial-v1`. Solo and Versus share that
record with separate mode cursors/receipts. Historical callers still use the
unchanged database and `journey` record. Release versions are not part of either
key. Existing clears, skips and Continue positions are neither migrated nor
deleted; old clears cannot silently label revised encounters completed.

Review exports use a scoped v2 backup envelope and an edition-specific filename.
Inspection and restore reject historical/unscoped or foreign-edition backups
before enabling Apply or mutating the session. Historical v1 export/restore and
the actual historical reader remain compatible. Scoped storage failure retains
session progress, supports export and retries the same record. Shared difficulty
preferences remain shared; content-review progress does not.

## Verification

The 87-test cohort passes on Node 20.19.5 and 22.22.2. It includes:

- 996 exact runtime comparisons: two artwork variants × 83 missions × three
  presets × Solo/Versus. The nine selections match their isolated studies; the
  other 74 match the pressure-v2 base. Full level objects, including revision,
  and simulation identities match; presentation/assets remain base-owned.
- Fresh source ownership, immutable selections, historical routes, and one
  71-mission core sequence in both hosts. All 12 Remixes stay optional; core ends
  at Home Signal without automatically launching a Remix.
- Actual Solo first clear → Next → two-activation Skip, scoped save, mode
  destination and reload Continue with an identical authoritative checkpoint.
  Old progress remains unchanged. A failed cross-pack picture load preserves run,
  picture and progress; retry skips directly into Border Bloom without a clear
  award or mandatory menu.
- Actual paired-board first clear with equal independently owned simulations,
  Next/Skip and the matching Solo destination; only the scoped Versus receipt and
  skip records change.
- Bidirectional cursor/clear/skip isolation, concurrent mode persistence,
  scoped-backup round-trip, foreign-backup rejection in the actual recovery UI,
  failed-save export/retry, legacy backups and cross-release reader compatibility.
- Existing pressure, route, actor-host, mode-navigation and Studio/preview suites.

The new test files are `whole-spatial-candidates`, `whole-spatial-host` and
`journey-profile-editions`. The remainder is `journey`, `journey-backup`,
`journey-cross-release`, `content-route`, `journey-actor-host`,
`journey-mode-navigation`, `whole-journey-candidates`, `content-studio`,
`studio-preview-readiness`, `content-studio-empty` and `content-pressure-difficulty`.
Sparse-checkout tests read missing tracked content/media bytes from exact Git
source `daaef1facfe573cf13a7da2132ea8fd57aded898`; existing working source wins and
nothing is substituted or written. Lint, formatting and diff checks pass.

Independent review verified the composer and found the original shared-profile
and unscoped-backup hazards; both were repaired and regression tested. It repeated
32 focused profile/backup/historical-reader/Team-progress checks on both Node
runtimes, then independently passed all four actual-host checks. Final review
found no blocker. This is technical review, not human playtest evidence.

## Native observations and open gates

In a separate localhost Studio draft, Inspect compiled 83 maps/missions while
leaving the one-mission workbench unchanged. Apply created the explicit
whole-spatial project checkpoint. Twin Receivers showed revised foundations,
three required objectives, two shield relays and the shared capture vocabulary.
Its ordinary exact Solo preview started and paused, then returned to the draft.

The actual Solo review URL displayed its unvalidated-build label and corrected
pressure-v2 description. Continue started First Return; a keyboard cut earned
34.3%, 8,160 points and a no-loss clear. One Next started Choose Your Share without
a menu; Skip showed an explicit confirmation and then started the 60% Two Keepers
mission with zero earned score and three lives. The test flight was left paused.
This is a bounded native keyboard observation, not the full device matrix
or a human duration/enjoyment estimate.

Cold source construction is still expensive: approximately 4.5–5.4 seconds in
observed Node runs before host preparation. Native Studio Inspect exceeded one
browser-control command timeout despite completing successfully. No performance
target is marked passed. Precompilation/loading responsiveness, warm transition
measurements, full device/controller/accessibility qualification, wider seed/
mastery/pacing review and genuine human sessions remain open. Original assets are
reused; this integration is not a new artwork approval.

Release-owner integration, reviewed PR, version bump, immutable release and
verified GitHub Pages promotion remain separate gates. A local route or passing
test does not prove that the public site includes this edition.
