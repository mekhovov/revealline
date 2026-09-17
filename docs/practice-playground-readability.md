# Controller Practice and Playground readability

This is the guide for the proposed P05 supporting-tool integration. **It is not a release or phase acceptance record.** The first composed runtime candidate is exact source `822f3290787c704a217e7c185d4b8beb7a527e82` (tree `88bd680e09210f9bf56ca18465fdb46afb2f1307`) plus the reviewed twelve-path parent `e674b1ba1234f98a1d957345a7d52bf3caf5930c9df8bf7b6488b3842e00f021` and two-path successor `c79fd47750a57a7b3aa27dd211ddb5ec9f4f34c8408169a277d7157877cc5d87`. The patches overlap in two paths, so that composition has twelve runtime/test paths. The feature is not already present in the unmodified `822f3290` base.

The later history-restoration correction `eb0cd33f2bf2b85d15695ba5f870943ebf580793f135c962feca3befe2becbe1` updates its display owner and adds one regression file, bringing the current candidate to thirteen runtime/test paths. Its focused model and actual browser return evidence supplement the earlier cohort; they do not change the earlier source bindings or grant release acceptance.

Current publication and full-phase status remain in [Delivery priorities](delivery-priorities.md) and the [execution register](cross-mode-execution.md). This guide does not revise their accepted-current statements or the existing [Team display contract](team-display-clearance.md).

## What changes for players and creators

Controller Practice and Playground use the game's shared Theme/Plain text, Standard/Large size and effective reduced-effects preference. Controller Practice keeps its existing text-size selector; Playground adopts shared choices without a second settings form. The controls and instructions can update while the hosted application is still loading. Failed saving keeps the local selection usable and leaves a visible warning, including after later cosmetic copy loads.

Reading changes do not edit a map, reset virtual controls, replace the child preview, alter a recording or write scores/progress. Shared host preferences and the embedded practice flight's session-only preferences remain separate. A persisted return uses the existing shared authority; an unsaved local choice stays authoritative after denied saving. Terminal departure retires the display owner, preserving the application's existing input/cancellation rules. Modeled lifecycle events do not prove that a browser admitted a page to its history cache.

## History return and selector ownership

Browser Back can restore a form control after the current display preferences are already applied. An old selector value is not a user-requested preference change. The display host reconciles its marked controls from the existing owner on `pageshow` and once in a cancellable next task, rereading current state so newer explicit and unsaved local choices win. The repair makes no storage write, child operation or focus move; ordinary explicit selection retains its existing persistence behavior and failure warning. Repeated show coalesces work, and departure/disposal cancels the deferred pass.

The retained native failure was real Practice → home → Display → browser Back: body Plain/Standard/reduced while the selector incorrectly showed Large. After the correction, the same route agreed on Plain/Standard/reduced; explicit Large changed host body and selector without replacing that current child session. A second home/Display/Back journey agreed on Theme/Large/full. The corrected return observations used a 390×844 browser viewport; the initial failure was recorded at 844×390. Navigation itself created new child sessions, so the records do not establish BFCache preservation. See [before/after originals and focused tests](verification/cross-mode/p05-practice-playground/history-restoration/README.md).

## Map descriptions beside the canvas

Signal zones have dashed map markings and readable descriptions. Hangars have diamond-framed markers and their own descriptions. These decorations make the role easier to identify; they do not change cells, collision, activation range or pointer mapping.

The descriptions report coordinates from the top-left cell, starting at zero. Signal speed is rounded to a whole percentage for display; Level JSON keeps the exact authored value. Boost and ability restrictions follow their separate optional flags. Signal-resistant craft retain the existing resistance rules.

Omitting the hangar list uses the default at spawn. An empty list disables switching, and an omitted radius on an individual hangar defaults to two cells. Switching still needs proximity, safe ground under the player, no active cut and the existing cooldown. A marker alone is not permission to switch and does not require claimed ground under the hangar centre.

Use the existing coordinate controls to edit without a pointer. An actual edit or Undo updates the working configuration and its descriptions together. Reading settings make no history entry.

## Undo, focus and explicit preview

Undo restores the previous working configuration and source through the existing editor sync. That deliberate operation also replaces any unapplied Level JSON draft; it is not a promise to preserve a draft that was never applied.

When another history entry remains, Undo stays available and keeps its focus. When the last Undo disables itself, it hands off only its own retiring focus to the available selected brush, with existing editor actions as fallbacks. Newer focus and hidden/unfocused documents retain their ownership. The control does not automatically launch a preview or replay a direction.

The running child keeps its current configuration until **Play configuration** is explicitly activated. This separates experimenting in the editor from changing the active preview.

## Current measurements and saved captures

Live readouts describe the currently loaded, measurable child document. Replacing that child immediately switches the readouts to waiting. Delayed, inaccessible or failed content cannot keep the previous arena, control or launch measurements labelled as current. An empty set says that no relevant controls were measured; it cannot produce Infinity/NaN minima or prove that all controls are visible.

An explicit geometry capture is a separate historical snapshot. Later preview activity marks it as an earlier capture without replacing its content or timestamp. Capture again deliberately to update it. Bounds and finite target sizes are diagnostics, not a complete test of clipping, overlap, keyboard access or physical touch usability.

## Evidence and open gates

The [selected evidence](verification/cross-mode/p05-practice-playground/README.md) retains each original source identity. The original U1–R1 rows retain their earlier cutoff; later history and integrated-browser rows add scoped progress without accepting the entire matrix. No screenshots are invented where the browser could only display them inline.

| Evidence | Established scope | Remaining boundary |
| --- | --- | --- |
| Fresh composition on `822f3290` | All twelve parent preimages match; only parent e674 then successor c79 are applied. All 901 inputs stay unchanged. Eleven complete files pass on Node 20.19.5 and 22.22.2: **127 leaf cases plus one parent group, 128 reported results per runtime**. | This is a model cohort, not full-source qualification, a build or native/public acceptance. Counts are repeated across runtimes, not added together. |
| History restoration correction | Three complete focused files pass **61/61 on each Node 20/22 runtime**. Native before-failure and after-repair return are retained with distinct source/runtime bindings. Host body and selector agree after Back, and an explicit size change preserves the current child. | History timing is modeled in regression tests; actual returns created new child sessions. BFCache, physical controls, wider responsive/zoom coverage, final committed-source qualification and public acceptance remain separate. |
| Later integrated browser supplement | On `822f3290 + e674 + c79 + eb0`, Practice and Playground Theme/Large document widths fit 390×844 and 844×390. Actual Scout → Fiber draft → Undo restores Scout while child revision 1 stays unchanged. Actual exported-pack import decodes; explicit Play changes to revision 2 and Start/Pause works. | These are scoped later observations, not a complete layout/input or R1 gate. G4 nonempty offscreen actions, U3 native owner/background refusal, desktop 200% zoom, physical hardware and final qualification remain open. |
| Native U1/U2 | On `170508f1 + e674 + c79`, real edits and last Undo restore the configuration; the selected brush receives retiring focus, actual next Tab proceeds, and the child waits for explicit Play. | These observations are bound to that earlier base, not the fresh composed source. |
| Native U3 | Newer-owner/background refusal has modeled evidence. | Ordinary pointer activation owns Undo focus; a non-owner or background invocation was not naturally reproduced. No native pass is claimed. |
| Native U4 | Actual Theme/Standard and Plain/Large at 390×844 and 844×390; additional Theme/Large at 351×760. | Plain/Standard, the complete Theme/Large target matrix, meaningful desktop 200% zoom and physical touch/controller checks remain open. Initial desktop was 1422×800 at DPR 0.9, not the requested 1280×720. |
| Native G1–G3 | Empty measurements; actual playing Pause measurement; a 12-second delayed replacement; explicit HTTP 503 then Play recovery; unchanged historical capture were observed. | Only one visible Pause target was measured on a fine-pointer browser. This is not a visible touch-pad or generic timeout/recovery qualification. |
| Native G4 | Compact 320×640 and landscape 844×390 child measurements recover without changing the child revision or historical capture. | A nonempty offscreen action set was not observed; its discriminator remains modeled. |
| R1 / release | Ordinary preset, draft, Undo and Play paths have scoped native evidence; fresh composed cohorts pass. | File import was not repeated in that native pass. Wider parent reading/input checks, final integrated source gates, build/artifact checks, deployed bytes and public affected journeys remain required. |

Original fixture assertion failures and the old-parent five-defect discriminators remain attached to their original production/test bytes. The corrected model and native observations do not relabel those failed attempts as passing. The new composition refreshed Team runtime/CSS, build configuration and maintainer guidance from exact `822f3290`; it did not copy obsolete runtime from the older 901-file fixture.

Adoption still needs a related-hunk review, an unused synchronized version, final committed-source qualification, immutable release/publication and affected public journeys. Keep Controller Practice's wider display/input matrix, physical hardware, browser-admitted history return and zoom separate. Full P05 remains incomplete.
