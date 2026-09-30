# Content Studio current input qualification

This receipt covers the bounded Phase 6 Content Studio changes at
`eb45f1b656141a4408ca5b6bb80ac7c041c3d389` and the shared controller field-name
follow-up at `e40d777732396203d21993b835eae7304ff9bdf6`, with the final
inspection-status repair committed as `52a18ef970a1c5d0da19dc24c660e9c445cc19c5`.
The final current virtual-controller journey passed all four stages. Native
editing and a separate reload/export continuation passed. All four actual JSON
downloads passed independent production validation. Complete native preview and
physical-controller qualification remain open.

## Scope and existing persistence contract

Content Studio at `/game/studio/` edits a real `ContentProjectV1`. It already
used the shared authoring router, controller field/source/grid adapters and
explicit embedded-preview handoff. This batch keeps that single input owner
and the accepted Confirm lifecycle.

The accepted project and unapplied source JSON are separate. Inspect source,
New project and Inspect saved stage a candidate; Apply explicitly adopts a
validated candidate. Accepted edits autosave after the existing 300 ms debounce.
Save checkpoint / retry uses the same coalescing persistence path. Unapplied
source text is not autosaved. Export backup serializes only the accepted
project; it does not export all checkpoint history, media originals or dirty
JSON. These existing boundaries are preserved.

## Reproduced failures and source changes

The initial broader cohort contained 140 tests: **139 passed and one failed**.
That failure was a stale raw-HTML assertion about attribute adjacency/button
whitespace in `studio-picture-entry-labels.test.mjs`. The test now checks the
actual DOM label and control identity. It was not evidence of a product input
failure.

The new actual-host harness then reproduced **five failures in its first eight
cases**: Apply disabled itself and left focus on BODY; terminal Undo did the
same; late preview completion scrolled the page after newer focus, blur or a
hidden-document transition. Source inspection also found the browser-owned
`window.confirm` draft-discard prompt, which the in-game controller owner could
not navigate, and missing Project/Source destinations in Sections.

The bounded changes are:

- `game/studio/source-discard.mjs` replaces the discard prompt with an in-app
  dialog. Cancel is the default. Back preserves dirty JSON and restores the
  original action when it still owns foreground focus. Continue grants one
  retry only for the exact session, accepted export, dirty text and form values
  captured when the dialog opened. Changed inputs or lifecycle ownership retire
  approval without applying an old candidate.
- Studio's guarded retry re-enters its error-handling boundary, so an approved
  async read that rejects is reported instead of escaping as an unhandled
  rejection. Specialized editor retries revalidate their command. The image
  workbench also verifies its current inspection/media identity and recompiles
  the candidate before adoption.
- `game/studio/action-focus.mjs` moves focus before an owned control disables
  itself: Apply goes to Inspect source; terminal Undo/Redo goes to the available
  opposite action, or Save when neither is available. It does not borrow focus
  from another control or a background document.
- Async preview completion may reveal its panel only while the original Play
  action retains foreground intent. New focus, any later key/pointer/touch/wheel
  input, blur, hidden state or pagehide retires that reveal permission. This
  focus/scroll lease does not own project mutations.
- Existing PROJECT and SOURCE labels are semantic headings with explicit
  Sections destinations at `project-id` and `source`. They reuse localized
  labels without adding duplicate visible headings.

The source batch changes the Studio host, local helpers, editor retry calls,
HTML/CSS and EN/UK tools messages. Its discard prompt accurately asks whether
to discard unapplied JSON and continue; it does not promise that the ensuing
Undo or editor command leaves the accepted project unchanged. There is no new
input poller, storage format, import format or global Confirm policy.

The separate `e40d77773` follow-up fixes the shared field-name resolver. A real
controller opening of Local project ID had shown the implementation ID
`project-id` because the resolver ignored the visible caption inside a
localized span. Names now use ordered `aria-labelledby` references, then an
explicit `aria-label`, associated labels, the legacy ID fallback and finally
localized Value. Nested captions and whitespace are handled without pulling
input, select, textarea, button, option or decorative text into the name.
Intentionally hidden explicit caption references are retained. Input activation,
editing and Confirm ownership are unchanged.

The final `52a18ef97` repair addresses a native-observed stale global error:
successful source inspection now publishes the same existing, localized report
to Validation and global Status, clearing the error flag. The report truthfully
requires Apply. It neither adopts the staged checkpoint nor changes a currently
applied later draft or the stored checkpoint.

## Automated evidence

The final Studio source cohort at `eb45f1b65` passed **186/186**, zero skipped,
on Node 20.19.5 in 9.70 seconds, with stdout-only results:

```sh
node --test --test-reporter=spec game/test/content-studio*.test.mjs game/test/studio-*.test.mjs game/test/authoring-input.test.mjs
```

This includes the 140 existing cases, 32 new actual Studio host cases and 14
shared authoring-input cases. The host harness executes the real Studio module
and markup with finite DOM/IndexedDB fixtures. Coverage includes staged versus
accepted JSON, invalid-source retention, exact checkpoint Save/Inspect/Apply,
export/import inspection, history focus, real shared-controller Confirm,
discard cancellation and one-use approval, changed forms, async retry rejection,
specialized actor retry, canceled/late import, preview return/cancellation and
late reveal ownership across focus, lifecycle and scroll intent.

After the shared label correction, the affected cohort passed **251/251**, zero
skipped, on Node 20.19.5 in 8.52 seconds:

```sh
node --test --test-reporter=spec game/test/controller-navigation.test.mjs game/test/content-studio-host.test.mjs game/test/authoring-input.test.mjs game/test/controller-confirm-guard.test.mjs game/test/controller-confirm-lifecycle.test.mjs
```

Seven new navigation tests cover nested EN→UK→EN captions, excluded control and
decorative subtrees, ARIA precedence and ordered references, explicit hidden
captions, multiple associated labels and unnamed-field fallbacks. A 33rd actual
Studio host case first reproduced the `project-id` heading, then passed with
the localized dialog heading and field accessible names on EN→UK→EN reopening.
Back restores the source field and preserves its value.

The 186- and 251-test cohorts overlap; their totals must not be added. The full
localization check passed **10,914 messages / 8,581 references**. ESLint,
Prettier and `git diff --check` passed for the bounded runtime/test changes.
These finite-host checks do not establish actual browser layout, OS download
delivery, physical controller behavior or a completed editing journey.

The inspection-status follow-up at `52a18ef97` passed **51/51**, zero skipped,
on Node 20.19.5 in 8.97 seconds. It comprises 34 actual-host, eight domain, two
empty-project and seven Studio-navigation cases:

```sh
node --test --test-reporter=spec game/test/content-studio-host.test.mjs game/test/content-studio.test.mjs game/test/content-studio-empty.test.mjs game/test/content-studio-navigation.test.mjs
```

The new real-controller case goes from malformed JSON through Inspect saved and
explicit discard Continue.
It verifies that the success report clears the global error, Apply is enabled,
and both the stored checkpoint and the currently applied later draft remain
unchanged until Apply. This cohort overlaps the earlier totals. Independent
review found no remaining issue in the small status change.

## Current browser fixture and observed attempts

The current fixture is:

`http://127.0.0.1:8992/game/test/manual/authoring-controller.html?tool=contentStudioCurrent`

It opens a unique `qse-…` starter URL, waits for the product's initial checkpoint,
then takes read-only IndexedDB and web-storage snapshots. A separate `qsc-…`
project is created through the real Local project ID → New project → Apply
controls. Existing projects and immutable revisions are not cleared, reused or
deleted. Both new qualification projects remain available for inspection.

The first actual virtual attempt completed zero stages because the test runner
tried to enter punctuation from the Letters layout. The fixture was corrected
to select the real Letters/Symbols layouts for each part of the new identity;
it does not inject field values or bypass the input owner. This fixture failure
is separate from the real localized-field-name defect fixed at `e40d77773`.

A later `e40d77773` attempt also completed zero stages: its 15-second saved-state
comparison timed out although the UI showed checkpoint 1 for `qsc-mummhclg`.
The fixture had compared IndexedDB objects from the child iframe with compiled
objects in the runner realm. The canonical JSON helper's plain-object check
did not recognize the other realm, so the fallback retained a different key
order. The correction copies the read-only, JSON-only snapshot into the runner
realm before strict comparison. It does not write storage, change a production
guard or relax the comparison. A separate VM reproduction retained every
serialized value while confirming that changed coverage, missing mastery and
an extra map still fail comparison. This is fixture correction, not a claim of
failed product persistence.

The intended four-stage journey uses real standard-pad commands for canceled
field/select/source drafts; rejected malformed JSON and discard Back; explicit
Apply; one immutable geometry revision and guarded Undo/Redo; a canceled numeric
draft and validated 65% target; exact Solo preview Enter/child Return/Close;
Save/Inspect saved/Apply; and two identical accepted-project JSON backups.
Read-only snapshots require every pre-existing head/revision and unrelated
local/session entry to remain unchanged. Only the existing
`revealline.playground.current` preview staging key may change. No fixture code
writes or restores storage directly.

The fresh final run against the status-repair source committed at `52a18ef97`
passed **4/4 stages**:

| Stage                              | Observed result                                                                                                                                                                                                                                                                 |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source inspection and cancellation | New project identity was inspected without saving and adopted only by Apply. Project ID, difficulty and source drafts canceled. Malformed JSON was rejected without replacement; discard Back retained it and its checkpoint, and repaired JSON compiled before explicit Apply. |
| Geometry, history and challenge    | One immutable map revision `draft-c8985d3a7a46bfdc` was added. Dirty invalid JSON remained until explicit discard Continue permitted one Undo; Redo restored the exact geometry. A numeric draft canceled, then a 65% target was explicitly applied and saved.                  |
| Exact Solo preview                 | The staged scenario passed production validation and matched the accepted mission. Explicit Enter preview, actual child Return and Close restored editor ownership without starting gameplay.                                                                                   |
| Saved checkpoint and backup        | Inspect saved → Apply → Save retained the exact checkpoint. Two explicit exports contained identical accepted-project JSON. The virtual workflow did not perform a complete page reload.                                                                                        |

The new project was `qsc-mummzqt6`, with three new checkpoints and final
checkpoint **3**. It preserved all **five pre-existing heads / ten pre-existing
revisions**. There were zero unrelated local/session keys to preserve; only the
known Practice staging key changed. The new project and its immutable
checkpoints remain available for inspection.

The browser export receipt is **2,060 bytes**, SHA-256
`d39c6084ebcf22015c75e2b9478dc19a0181b7a9fd72d7f7036fdee8a197087b`
for both backups. Browser Blob evidence alone is not counted as file delivery.
The separate actual-file validation below passed with the same expected bytes
and hash.

## Native keyboard observations and preview boundary

The native journey used the `e40d77773` runtime plus the small inspection-status
repair committed at `52a18ef97`. Appending `q` to source JSON
and choosing Inspect produced the expected validation error. Inspect saved then
opened the in-app discard prompt. Cancel retained the dirty text and returned
focus to Load; Continue staged saved checkpoint 1. The valid checkpoint was not
adopted automatically. After the repair, global status correctly showed the
current successful inspection with `error=false`. Explicit Apply focused
Inspect source.

Native Return on the map canvas applies the current rectangle directly; it is
not a separate controller-style entry-only action. Three immutable additions at
`20,12`, `21,13` and `21,14` were observed. Undo/Redo restored the exact serialized
project, and the accepted work reached checkpoint 6. These are native edit,
validation, discard and history observations, not qualification of every editor.

The exact Solo preview reached Engine ready with a real child game. However,
subsequent unbound native Tab/Escape had no visible effect while parent DOM
focus remained on Play and the child had not been explicitly entered. A complete
fresh native-keyboard preview handoff is therefore **not qualified**. This is
consistent with the previously recorded Playground/Enemy IAB accessibility
owner boundary; the current observation alone does not identify the event
target without a passive trace.

Source inspection confirms that keys delivered to an unentered child are
intentionally consumed before gameplay. A queued child key cannot steal newer
parent focus. Parent-delivered Tab would move between the editor controls and
parent Escape would open Sections. The shared guard remains unchanged: bypassing
it to make this browser-automation route respond could permit accidental child
input before Enter preview. No pointer-reset handoff or full native-preview pass
is claimed here.

A separate native continuation reloaded the page and restored the exact whole
source string at checkpoint 6. With no pointer reset, native keys used Sections
→ Page actions to Save and Export. A second full page reload again restored the
same complete source string; another native Export produced the second file.
This qualifies saved-project reload and repeated native export separately from
the unresolved embedded-preview input boundary.

## Actual artifacts and package attribution

Both actual native files under `/Users/oleksandr.mekhovov/Downloads/` passed
independent production validation and were retained unchanged:

- `native-menu-studio-20260929-native-backup.json`
- `native-menu-studio-20260929-native-backup (1).json`
- Size: **2,688 bytes each**
- SHA-256: `aab5ccacb69046b5866f6bbe0962d272d151fc2e6afd516881c869e7f61a642b`
- Project: `native-menu-studio-20260929-native`
- Project revision: `draft-541cfdd56d34a7d7`
- Four map revisions, one mission, one campaign and one pack; no asset originals.

Receipt `/private/tmp/content-studio-native-downloads-20260929.json` verifies
strict UTF-8 decoding, lossless encoding, `compileContentProject`, canonical
recompilation and exact compact export bytes. It resolves all six Solo/Versus
difficulty projections and verifies every map reference. A separately derived
starter project with the three observed 5 × 5 foundation additions at `20,12`,
`21,13` and `21,14` matches the complete downloaded project and bytes, including
final map revision `draft-e782e2e546695d0f`. The two files are byte-identical.

The validator's ten selected source inputs match Git blobs at `e40d77773` and
remained unchanged after checking. The actual file modification times are
12:11:39.073Z and 12:12:03.560Z on 2026-09-29; native input provenance is supplied
by the separate browser continuation, not inferred from timestamps. These
checks validate JSON artifacts and their production projections; they do not
qualify native preview input or human gameplay.

The actual virtual-controller pair also passed full production validation:

- `qsc-mummzqt6-backup.json`
- `qsc-mummzqt6-backup (1).json`
- Size: **2,060 bytes each**
- SHA-256: `d39c6084ebcf22015c75e2b9478dc19a0181b7a9fd72d7f7036fdee8a197087b`
- Project revision: `draft-a0abfb0598aed63f`
- Map revision: `draft-c8985d3a7a46bfdc`

Both match the browser's expected hash and exact bytes. A separately derived
starter `qsc-mummzqt6`, one production foundation edit at `21,13` with size
5 × 5, and the production challenge command for 65% coverage, zero seconds and
the original facets reproduce the full artifact bytes. Strict UTF-8 parsing,
canonical recompilation, compact serialization and all six mode/difficulty
projections pass. This is an exact semantic and byte comparison, not a filename
or partial-field check.

Receipts `/private/tmp/content-studio-virtual-downloads-20260929.json` and
`/private/tmp/content-studio-all-downloads-20260929.json` preserve the virtual
pair separately and all four actual files together. Ten compiler inputs plus
three derivation inputs match final HEAD `52a18ef97`; the three derivation inputs
also match `e40d77773`. These selected validation pins are not presented as a
complete browser dependency closure. All artifacts remain unchanged.

The fresh sequential in-memory matrix at `e40d77773` passed all **14 editions**.
Changes to the shared localization catalog and controller navigation required
this new compile; the earlier Design Atlas matrix was not simply relabeled.
The largest edition was DroneAid aggregate: **668 output files / 66,785,386
bytes**, with **323,478 bytes** headroom below 64 MiB. All fourteen outputs
excluded multiplayer menu scenes and manual fixtures from their Solo closures.

The default collector admitted **1,727 files**, with zero manual fixtures.
Literal Content Studio and its real Practice-preview dependency traversal
captured **327 inputs / 307 static modules / 1,058 module edges**. Source-picker
choices were enumerated separately as finite runtime dependencies. All 327
Studio/Practice inputs, 835 edition inputs and six compiler/checker pins—**999
unique paths**—matched Git blobs and disk at `e40d77773`, with no drift.

Receipts:

- `/private/tmp/content-studio-source-closure-20260929.json`
- `/private/tmp/edition-package-content-studio-20260929-full.json`
- `/private/tmp/content-studio-commit-attribution-20260929.json`

The Studio/Practice input inventory SHA-256 is
`f320baf3dbdc7264f75bb83069fd0ef5f35cf9ee828b62558c839525787dd270`.
The commit-attribution receipt SHA-256 is
`4caaf2d1a595e5eb27094c2255e1d09531f5a5dc73da97a2e61504ee52811284`.
The original working-tree compile metadata is retained; attribution does not
rewrite it. This is source/dependency and in-memory admission evidence, not a
materialized distribution, exhaustive computed-resource audit, installed
offline run, native binary or release.

Final attribution at `52a18ef970a1c5d0da19dc24c660e9c445cc19c5` passed for all
**999 unique paths**, with no Git mismatch or disk drift. The Studio/Practice
closure remains 327 inputs / 307 modules / 1,058 module edges; the default
collector remains 1,727 files with zero test fixtures. All **835 edition inputs
and six compiler/checker pins** were unchanged after the Studio-only status
repair, so the `e40d77773` fourteen-edition matrix is reused without another
compile. Earlier receipts and their compile metadata are preserved.

The final follow-up receipts are:

- `/private/tmp/content-studio-source-closure-status-20260929.json`, SHA-256
  `cbd0a24d43ed75bf5e56804b16a931c142fc2344b4baa438b978acb05b2c536f`
- `/private/tmp/content-studio-commit-attribution-status-20260929.json`, SHA-256
  `2d7118f9a061e579a2353cfa98de860d5ad9e62d63611efcfde61742e4ae24ca`

The final Studio/Practice inventory SHA-256 is
`139bf9ad51be06c95ed185325c6e8ad0ac185ec8c0616344cc47d6a8afdaea2c`.
The captured Studio module is 52,432 bytes, SHA-256
`508758748ffa137f7af2650c4418e8e7a5ec2470124dbe0cfc573896023acbef`.

## Remaining boundaries

This bounded journey does not cover OS file import, candidate-library selection,
every specialized actor/objective/structure editor, tracing/media recovery,
Team exports, a complete gameplay run, guide-prose
reading, a full Ukrainian journey, physical controllers, native platforms,
installed offline execution or publication. A compiled candidate is not a human
playtest. Final follow-up package attribution is recorded separately from the
complete artifact checks above.
