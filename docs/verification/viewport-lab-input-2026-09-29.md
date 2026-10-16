# Viewport Lab current input qualification

The bounded Phase 6 runtime is
`05ef9c79298504a50dff361c8c1e3a3163ad77c4`; optional-package admission is
`dea0fc7eed6cb536becb82cde02470a07d2dc345`. The native Couch handoff and parent readers below passed. Two initial
virtual-controller attempts passed two of four stages before exposing a real
landing navigation defect. With that defect corrected, the fresh complete
virtual-controller workflow passes **4/4** with unchanged input commands.
The shared group correction is
`76b56eccf30f93dff41699e2fac1532f88aff7bf`; final package attribution follows below.

## Product contract and bounded changes

`/authoring/viewport-lab/` loads the real Solo or Couch page into one same-origin
iframe. Selecting a target changes the pending request; only the explicit Load
button replaces the embedded document. The five presets set actual CSS-pixel
dimensions: 390 × 844, 844 × 390, 768 × 1024, 1280 × 720 and 1280 × 800. Resizing
retains the existing iframe, document and source URL; it does not scale the game
or emulate hardware, browser zoom, touch behavior or physical safe areas.

The Lab has no project Save, draft store, import or export. Embedded games use
their ordinary same-origin storage and save/pause behavior. Loading another
target replaces that document; this receipt does not claim preservation of an
unsaved running game across replacement. No gameplay was deliberately started
in these menu-only checks.

The local input adapter reuses the shared authoring owner and Confirm lifecycle.
Explicit Read and scroll actions own bounded stage and notes scrolling. Back or
Confirm ends reading and restores the exact opener; inactive reader arrows
remain ordinary navigation. Sections targets real controls. The existing Enter
preview and real child Return buttons remain the only intentional input handoff.
No extra pad poller or direct child command forwarding was added.

Native testing also exposed implicit form submission: pressing Return on Game
could load a target. The runtime now makes Load a real `type="button"` action
and prevents implicit form submission. Enter on the target selector cannot
replace the child. The source status still reports a load request; the fixture
separately waits for each real game's ready menu before calling it loaded.

## Automated checks

At `05ef9c792`, **56/56** focused tests pass, zero failed or skipped, using
Node 20.19.5 (0.635 seconds, stdout-only):

```sh
node --test --test-reporter=spec game/test/viewport-input-host.test.mjs game/test/viewport-startup-host.test.mjs game/test/authoring-host-display.test.mjs game/test/authoring-input.test.mjs
```

This includes sixteen new actual Viewport cases plus the existing startup,
display-preference and shared-authoring cases. The implicit-submit regression
failed before the explicit Load correction. Finite host geometry is modeled
test data, not real-browser layout evidence. A separate package cohort passes **9/9**, zero skipped:

```sh
node --test game/test/viewport-tooling-build.test.mjs game/test/production-tooling-build.test.mjs scripts/test-offline-core-closure.mjs
```

It comprises two Viewport, five Production and two offline-core cases. These
results overlap earlier package cohorts and must not be summed. Final exact
admission metrics are recorded separately when finalized.

Full EN/UK localization passes **10,914 messages / 8,581 references**. The new
test-only current fixture and registration pass scoped ESLint, Prettier, syntax
and diff checks. The later landing-group correction passes a **230/230** overlapping controller/
Confirm/Viewport cohort, zero skipped (0.884 seconds, stdout-only). Four exact-
geometry keyboard/controller regression cases failed before the correction;
the corrected cases and a fifth grid tie-preservation case pass. At the final
shared correction `76b56eccf`, the exact command is:

```sh
node --test --test-reporter=dot game/test/controller-navigation.test.mjs game/test/controller-confirm-guard.test.mjs game/test/controller-confirm-lifecycle.test.mjs game/test/viewport-input-host.test.mjs
```

The final unchanged Couch composition cohort separately passes **8/8**, zero
skipped, in 54.661 seconds:

```sh
node --test --test-reporter=spec game/test/couch-composite-menu-navigation.test.mjs
```

Both use Node 20.19.5 with stdout-only results. The 230-case cohort includes the
Viewport input tests and Confirm lifecycle, not the earlier startup/display
cohort; overlapping results are not added together.

## Native keyboard observations

The parent operated the actual IAB page on the dedicated `localhost:8995`
origin with unbound native keys and no pointer or accessibility-focus reset.
The observed viewport was **1280 × 720**. A requested 390-pixel override only
took effect later and is not evidence that this native sequence ran at 390px.

The following passed:

- Return on Game did not implicitly load. Explicit Couch Load was used.
- Native Tab reached the preset, stage reader, direct-open link and Enter
  preview. Return on Enter preview deliberately entered the real child.
- Native Tab reached child Settings; Return opened it and Escape returned.
  Three Tabs then reached the real child Return action. Return restored the
  parent's Enter preview button without reloading the game.
- With the 1280 × 800 child preset, stage reading reached horizontal
  **106/106 px** and vertical **303/303 px**. Home restored both axes to zero.
  The earlier 768 × 1024 preset reached vertical **527/527 px**.
- Notes reading entered and exited correctly; its measured overflow was zero,
  so no native notes-scroll claim is made.

Native Solo boot/handoff remains unqualified: IAB accessibility targeting
rerouted between the parent and child DOM. No pointer reset or direct focus
call was used to convert that limitation into a pass. Native full-gameplay,
history/BFCache and Workshop departure/reentry were not tested here.

## Current virtual-controller attempts

The test-only entry is
`game/test/manual/authoring-controller.html?tool=viewportCurrent`, using
`viewport-current-workflow.mjs` at the same dedicated origin. Actual shared
standard-pad commands perform every application interaction. DOM, URL and
storage reads are observations; the fixture does not invoke domain handlers,
set focus, synthesize keys or write application storage.

Its four intended stages are:

1. Cancel target and preset drafts, select Solo without loading it, explicitly
   Load, then await the actual ready Solo menu while parent focus remains owned.
2. Visit all five exact sizes and prove the same iframe, child document, source
   URL and assignment count. Read both stage axes to their limits and back;
   exercise Back and Confirm for stage/notes readers.
3. Explicitly enter Solo, open Settings, Back, and use the real child Return.
   Stage Couch, cancel a different target, and resize without replacing Solo.
4. Explicitly replace Solo with ready Couch, join its controller, open/Back from
   Settings and use the real child Return. Report normal storage key deltas.

The first two observed attempts stop after **2/4** completed stages:

| Attempt           | Observed runner                                               | Result and limitation                                                                                                                                                                                                 |
| ----------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| First             | 1280px wide                                                   | Selector cancellation, actual Solo readiness, all five exact sizes and bounded readers passed. Stage reached X **138/138 px**, Y **470/470 px**. Child traversal could not reach Settings from the Solo mode control. |
| Diagnostic repeat | **390 × 844**; Lab iframe **358 × 641**; child **1280 × 800** | The same first two stages passed. The failure-only trace proved a repeated **Down: Solo → Fullscreen; Up: Fullscreen → Solo** cycle. No guard, input timing or traversal rule was relaxed.                            |

The retained child reported input modality `controller` and **Controller ready**;
the pad was installed, sampled and joined. Solo's reader calls the current
`navigator.getGamepads()` on every sample, so early API capture was ruled out.
Actual mode/action geometry showed why the spatial score could skip the
intervening full-width action group in favor of the left-aligned Fullscreen
control. The diagnostic preserves the real failure; it is not a completed
controller workflow or a missing-device waiver.

The correction scores cross-axis separation between control edges rather than
centers when leaving a horizontal or vertical group. A full-width action
overlapping the movement path is therefore no longer penalized for its distant
center. Existing grid scoring and stable ties are preserved. The
fixture kept its original commands and failure guards. A fresh complete run
then passes **4/4**:

- All five exact child dimensions retain the same iframe, document and source
  until explicit replacement. The actual Solo and Couch ready menus, not just
  a request status or nonempty `src`, are verified.
- Stage reading reaches X **972/972 px** and Y **386/386 px**, returns both to
  zero, and exits by Back/Confirm. Notes reaches Y **25/25 px**. Read-only DOM
  measurements confirm a **390 × 844** outer runner and approximately
  **358 × 641** inner Lab viewport (host outer box 362 × 645.4375).
- Explicit Solo entry reaches Settings. One Back closes Settings and restores
  its exact opener; the real child Return restores parent Enter. Pending Couch,
  canceled target selection and 844 × 390 resizing retain the existing Solo
  document.
- Only explicit Load replaces it with Couch. Controller join, Settings, one
  Back and the real child Return pass without starting a match.
- The source is assigned exactly twice: `null` → `../../game/` →
  `../../game/couch/`. Actual child load paths are `/game/` and `/game/couch/`.
  All observed local/session added, changed and removed key lists are empty.
  This is an observation of this menu-only run, not a promise that embedded
  games never write origin storage.

The parent's compact browser transcription is
`/private/tmp/viewport-browser-summary-20260929.json`; it summarizes tool
observations and is not a raw trace archive. Neither failed attempt is silently
promoted to a full pass.

After the complete PASS observation, the loaded Couch page later displayed a
Journey-save timeout/recovery panel although no Play action had been started.
That subsequent normal-game storage behavior is not qualified by the earlier
menu pass. The sampled empty key deltas do not prove absent later writes or
successful persistence. Save recovery, draft persistence and long-running
embedded-game state remain outside this receipt.

## Packaging and remaining boundaries

Optional admission is attributed to `dea0fc7ee`; final source and compilation
are attributed to `76b56eccf`. The default collector lists **1,837 paths**, with
**10 new optional Workshop files / 83,901 raw bytes** and zero test fixtures.
The Lab and four immediate guide documents remain outside Solo/Versus/Team
startup and the standalone company engines. Guide links are not recursively
admitted. Offline Couch requires its Versus runtime/content prerequisites;
installing Workshop alone does not establish a usable offline child preview.

The parent closure contains **142 resources / 123 modules / 370 edges** (341
module, 15 HTML-resource, one data-module, four literal-URL and nine CSS edges).
The capture pins 152 source paths. Solo/Couch entry bytes and package presence
are pinned separately; this scanner does not traverse their child runtime
graphs. This is not a hash of the complete default package or proof that every
preview can launch offline.

Compared with the previous Production matrix, three of 835 edition inputs
changed: build configuration, the generated locale catalog and menu group
navigation. Six compiler pins remain unchanged. Fresh **14/14 sequential
in-memory edition compiles** pass at `76b56eccf`. The largest DroneAid output is
**66,786,998 bytes**, leaving **321,866 bytes** below 64 MiB. Combined source,
edition and compiler evidence covers **859 unique paths** with exact Git/disk
matches and no drift. Prior receipts and generated source metadata remain
separately attributed.

Receipts:

- `/private/tmp/viewport-source-closure-final-20260929.json`
- `/private/tmp/viewport-package-admission-final-20260929.json`
- `/private/tmp/viewport-edition-package-final-20260929-full.json`
- `/private/tmp/viewport-compiler-capture-final-20260929.json`
- `/private/tmp/viewport-final-attribution-20260929.json`

Inventory checks pass **2/2**. The owned origin 8995 server and test tabs were
stopped after qualification; temporary browser viewport settings were reset.
No materialized web/native build, installed-offline exercise or public release
was performed in this input batch. Manual fixtures are test-only and must
remain outside player distributions.

There are no OS export artifacts to validate for this product. The fixture
does not assert zero origin writes after booting real games; its final stage
reports added, changed and removed local/session keys. The final complete run
observed no key deltas; neither partial run completed that final observation. Physical pads, native
webviews/devices, full Ukrainian browser coverage and complete Solo/Couch
gameplay remain separate qualification.
