# Company Studio current input qualification

This receipt covers the bounded Phase 6 Company Studio source changes at
`70309f09fadd6926b2950e5ff59c4b5db09bc34c`, prepared from
`4dda032ec936599eb5b47a7592a717821a06a776`. Default-package admission is committed
separately as `0e04b5aa513acad281222434c91fa1c4ab6f2f5f`. The browser-discovered
shared disabled-fieldset correction is
`e159efd44ec2b82e45bba2d68eb695a3eade0954`. Source, automated checks,
package compilation and a partial virtual source/export journey have evidence;
native editing/reopen/export and separate native and virtual transfer-practice
segments passed. A
complete aggregate virtual journey remains unqualified. This is not a
publication or a complete Phase 6 sign-off.

## Scope and existing data contract

`/authoring/company-studio/` edits the registered edition catalog and its
existing declared JSON formats. It has seven steps, including explicit source
export and a separately verified compiled-artifact preview. Applied data,
unapplied JSON buffers and unapplied form fields remain distinct. The browser
keeps this work in memory; there is no persistent Save or draft autosave.

Export produces `revealline-company-source-draft.v1` with the catalog and all
declared source JSON. Binary assets stay in the source workspace. Declared
retained presentation JSON remains immutable original text, with the existing
registered byte/hash/receipt/audience validation. This batch does not alter
content formats, compiler rules, game saves or publication authority.

The separate `/authoring/company-studio/playtest.html` route contains illustrative
transfer exercises using the existing shared company workbench. Answers,
feedback and completion exist only in the page. They do not affect campaign
progress. Its task-card export contains no answers or results.

## Reproduced defects and bounded changes

The existing Company Studio baseline passed **38/38** before changes. New tests
executing the real Studio entry and markup then reproduced three asynchronous
state failures: delayed export still downloaded after newer JSON input; delayed
import erased newer JSON; and an older import completing last overwrote the
newer imported draft. A composed controller check also reproduced step focus on
a noninteractive heading, followed by neutral navigation moving away from the
chosen step's work.

The local changes are:

- `operation.mjs` supplies one real in-app dialog, owned by the existing shared
  authoring input host. Cancel is initially focused and Back cancels. The lease
  captures catalog/cache identity, selected edition/campaign, revision, report,
  raw JSON buffers and current form values. Newer operation/focus, blur, hidden
  state or pagehide retires it. Approval and cleanup both require exact operation
  ownership; an old promise cannot clear a newer confirmation handler.
- Export prepares and validates an independent complete source packet before
  requesting a download. Native imports prepare all required source data before
  requesting replacement confirmation. Catalog-only imports cannot partially
  replace the live draft if a declared file fails. History validation receives
  the cancellation signal. The final adoption is synchronous after preparation.
  Stale preparation failures cannot replace a newer status; errors during the
  current synchronous commit remain reportable.
- Reopen last exported draft retains the exact validated packet as immutable
  strings in memory. It uses the same production validators and Cancel-default
  replacement confirmation. It restores the exported edition, then focuses
  Company name. Reloading clears this convenience snapshot. No persistent Save,
  OS import, successful OS download or reload recovery is implied.
- Seven setup steps and their existing semantic headings now target reachable
  local controls. Explicit readers cover artwork provenance, compiler commands
  and imported report text. Shared navigation owns scrolling and Back restores
  the exact reading entry. These controls do not approve a report or artifact.
- A playtest-local wrapper provides brief, inspected-evidence and feedback
  readers. Open/Restart focuses Read practice brief. Commit hands focus from the
  noninteractive feedback block to Read practice feedback. The shared workbench
  still owns answer changes, validation and completion; it is unchanged.

Owned production files are
`authoring/company-studio/{studio.mjs,operation.mjs,reading.mjs,playtest.mjs,index.html,studio.css}`,
with the source contract documented in that directory's README. The existing
shared router and accepted Confirm lifecycle remain unchanged; there is no
second input poller or new storage domain.

The first separate virtual-practice attempt exposed a further real navigation
failure after valid completion: Up from Read feedback repeatedly tried to focus
a select inside the disabled answer fieldset. Its own `disabled` property was
false, but the browser correctly refused focus because it inherited disabling.
The initial finite fixture did not model that browser rule. This was not a
spatial-traversal assumption to work around with Sections.

The `e159efd44` follow-up changes only shared navigation eligibility to also
respect native `:disabled`. It keeps the first-legend exception, ordinary links
inside a fieldset, nested disabled fieldsets and the existing initially-disabled
reader Done contract. It does not change Confirm ownership or remove the
workbench's completion lock. Both the focused navigation fixture and actual
Company entry fixture now model inherited-disabled focus/click refusal.

## Automated evidence

The baseline was **38/38**. The final expanded cohort passed **86/86**, zero
skipped, on Node 20.19.5 in 12.51 seconds with stdout-only results. It includes
30 actual-entry host cases. These totals overlap and must not be added.

```sh
node --test --test-reporter=spec game/test/company-studio*.test.mjs game/test/company-playtest*.test.mjs game/test/authoring-input.test.mjs
```

The actual-entry host tests use the real Studio module, markup, source models
and shared authoring/controller owner with finite browser fixtures. They cover
complete validated packet export, invalid/unapplied JSON retention, latest-read
ownership, overlapping confirmation dialogs, seven stable controller step
focus destinations, raw-form and lifecycle fences, native Cancel, controller
Back/Confirm cancellation, explicit memory-only reopen and byte-identical
re-export, malformed/oversized input, failed catalog-only imports and stale
report reads. Reader/practice cases cover shared scrolling/Back, feedback focus,
readonly completion, task-only export, restart and pagehide clearing.

Independent review found no remaining blocker in the local operation, snapshot
adoption, readers and practice cleanup. ESLint, Prettier and `git diff --check`
passed for the bounded production and test files.
No new localization catalog keys were introduced; the existing Company tool
uses English labels. Actual layout, OS file delivery and physical controller
behavior are separate evidence gates.

The effective-disabled follow-up passed **254/254**, zero skipped, on Node
20.19.5 in 1.574 seconds, with stdout-only results:

```sh
node --test --test-reporter=spec game/test/controller-navigation.test.mjs game/test/controller-confirm-guard.test.mjs game/test/controller-confirm-lifecycle.test.mjs game/test/authoring-input.test.mjs game/test/company-studio-host.test.mjs
```

Five new navigation cases cover inherited fields and reenabling, first-legend
and nested-fieldset/link exceptions, a captured Confirm becoming disabled,
native Tab traversal, and initially-disabled Done registration. Three traversal
cases failed before the production correction. The 31st actual Company host
case also reproduced completed feedback → Restart failure before the fix and
passed afterward. Independent review passed. The **254- and 86-test cohorts
overlap** and must not be summed.

## Current browser and artifact evidence

The isolated current fixture is:

`http://127.0.0.1:8993/game/test/manual/authoring-controller.html?tool=companyStudioCurrent`

Only actual virtual-pad button commands mutate the product. Read-only inspection
compares source and exported bytes. The first run passed **three of four** stages,
including source edits, cancellation/invalid JSON, two explicit exports and the
memory-only reopen boundary. It then lost foreground ownership before the
transfer-practice handoff. A fresh aggregate repeat passed **two of four** stages,
including its first export, before the same foreground loss. These are partial
results, not a complete workflow pass. Browser `Page.getFrameTree` timeouts were
also observed. The input guard was not changed or reset to force a pass.

The first run produced two actual OS files,
`coupa-all-draft (2).json` and `coupa-all-draft (3).json`. Independent validation
passed for both:

- **2,848,697 bytes** each; SHA-256
  `52b96e384a7811dea077f072b19925da35e46926383e319d80f9317e78e3388b`.
- Strict UTF-8 and lossless byte round-trip, production source-draft validation,
  all **126 declared source files**, **26 retained originals**, and a **127-file**
  in-memory CLI workspace round-trip.
- The complete packet bytes match an independent reconstruction from committed
  `70309f09f` source with the observed Company name `Coupa qa` and edition
  revision `7`. There is no embedded binary media. All **137 validation input
  pins** were unchanged.

The receipt is
`/private/tmp/company-studio-virtual-partial-downloads-20260929.json`.
These exact files establish the partial source/export/reopen output, not the
uncompleted transfer-practice stage or a verified game artifact. Downloads were
preserved.

### Native Studio and separate transfer-practice observations

At `0e04b5aa5`, the browser owner completed the Studio editing/export segment with
native keyboard input and **no pointer reset**. It applied Company name
`Coupa native` and edition revision `7`; malformed theme JSON was rejected and
blocked export; repairing/applying the theme allowed the first export. After
adding a dirty `q` to the theme editor, Reopen opened with Cancel selected.
Escape preserved that dirty source. A second Reopen followed by explicit
Replace restored the exact clean exported source, Company name and revision,
and focused `brand-name`. A second explicit source export followed.

The two actual native files `coupa-all-draft (5).json` and
`coupa-all-draft (6).json` passed independent validation: **2,848,701 bytes**
each, SHA-256
`555a7da1015dadc59c93f08a2aa4a97918dba618a28ce68fa81d164047e64b73`.
Their complete packet bytes match the recorded `Coupa native` / revision `7`
changes independently reconstructed from committed source. Production validation
covers all 126 sources, 26 exact retained originals and a 127-file in-memory CLI
round-trip. This does not establish OS import, persistent Save/reload, or a
compiled whole-game preview.

A **separate native practice tab** passed:

- Commit with missing evidence and blank fields produced feedback; explicit
  feedback/evidence readers and Back returned to their own entry actions.
- Canceling a select kept its empty value. The correct `Reusable case`, `6`,
  and `4 November` selections completed the exercise and made its fields
  readonly. This native segment did not test an incorrect populated choice.
- Restart cleared all answers; Close cleared the practice. Following the real
  Studio link returned to a fresh tab-local Studio draft with Company name
  `Coupa` and Reopen disabled. The real Try transfer practice link reentered
  blank practice with all three values empty.
- The reentry select initially chose a culture exercise because of batched
  native-popup navigation. The operator inspected it and selected the intended
  requester exercise through the same native controls. No fixture or runtime
  correction was made.
- Close and explicit task-card export completed. The actual JSON is **1,786
  bytes**, SHA-256
  `6dfd5f7bdc3791416c01ceff7904364194929ce1ce194109a10ec33f5848ea37`,
  and matches the production answer-free task exactly. The native brief reader
  was not entered; feedback/evidence reading is the qualified scope.

These practice actions used native input without a pointer reset and did not
save answers or alter campaign progress. They are a separate segment from the
Studio source journey, not evidence that the stalled aggregate virtual handoff
passed. The native artifact receipt is
`/private/tmp/company-studio-native-downloads-20260929.json`; all 137 selected
validation pins match its committed source and remain unchanged. The extra
`coupa-all-draft (4).json` is recorded separately as the second partial virtual
run's single export, never as a complete aggregate pass.

### Final separate virtual-practice result

After the disabled-fieldset correction, the fresh independent fixture
`?tool=companyPracticeCurrent` passed **1/1 complete practice stage** at
`e159efd44`. It uses real pad-button commands and qualifies blank and wrong
answers, the brief/evidence/feedback Read and Back paths, canceled select,
correct readonly completion, Restart with blank answers, Close, real Studio
return with original catalog/Reopen reset, real practice reentry with blank
values, Close and the final explicit task-card download. No focus override,
Sections workaround or guard weakening was used to bypass the completed
fieldset.

Every measured reading region had a scroll maximum of **zero** in this run.
The result establishes reader entry/Back, not overflow scrolling. The actual
virtual `playtest-foundations-requirement-task (1).json` is **1,786 bytes**,
SHA-256 `6dfd5f7bdc3791416c01ceff7904364194929ce1ce194109a10ec33f5848ea37`.
It matches both the native task file and the production answer-free task bytes.
Its receipt is `/private/tmp/company-studio-virtual-practice-downloads-20260929.json`,
validated at `e159efd44`.

The combined `/private/tmp/company-studio-all-downloads-20260929.json` passes
**seven actual files in five distinct groups**: first partial virtual source
pair, second partial virtual single source export, native source pair, native
task, and final separate virtual task. It preserves each original validation
commit and each browser result separately. All **137 selected source/validator
pins** are identical across `70309f09f`, `0e04b5aa5`, `e159efd44` and current disk;
inventory SHA-256
`acb83171c705ce583375ff0d15ff4be84f45018a74fc4a89ca9b8ee2fffcfe5b`.
This selected validator/source inventory is not a claim of full module closure.

The prior aggregate **3/4** and **2/4** runs remain partial. Physical-pad,
full Ukrainian, verified-artifact and platform-native results remain open.

### Final-source native practice repeat

The browser owner repeated the complete separate practice path at
`e159efd44` with native keyboard input and **no pointer reset**. This repeat
qualified the brief, evidence and feedback Read/Back actions, blank-commit
rejection, canceled select, incorrect `Electronics kit` / `12` / `8 November`
rejection, and correct `Reusable case` / `6` / `4 November` completion.

The completed fieldset was disabled while each select's own `disabled` property
remained false. Up from feedback moved to `company-read-evidence-1`, skipping
those fields. Native Tab navigation then reached Restart, which cleared all
answers. Close, the real Studio link (Company reset to `Coupa`, Reopen disabled),
real practice reentry with all three requester values blank, Close and task
export passed again. The native Studio source-edit/export segment above remains
attributed to its observed `0e04b5aa5` source; it is not silently relabeled as
this repeat.

The eighth actual file, `playtest-foundations-requirement-task (2).json`, passed
strict UTF-8 and exact production task-byte validation at `e159efd44`:
**1,786 bytes**, SHA-256
`6dfd5f7bdc3791416c01ceff7904364194929ce1ce194109a10ec33f5848ea37`.
Its component receipt is
`/private/tmp/company-studio-final-native-practice-downloads-20260929.json`.
The final combined receipt,
`/private/tmp/company-studio-all-downloads-final-20260929.json`, passes **eight
actual files in six distinct groups**, retaining the earlier seven-file receipt
unchanged. All 137 selected source/validator pins and their inventory hash remain
unchanged. The final native practice task is a distinct group; the earlier
aggregate virtual runs are not promoted. No compiled-artifact preview or human
playtest approval is inferred.

## Packaging and remaining gates

The package audit found that the original default collector omitted both
Company Studio pages even though it admitted all their registered source JSON
and artwork. The bounded `0e04b5aa5` correction adds only
`authoring/company-studio` and its live facilitator link
`docs/company-editions-playtest.md` to the default build configuration.
The focused admission/playtest cohort passed **6/6** and independent read-only
review found no remaining issue in that change.

At `0e04b5aa513acad281222434c91fa1c4ab6f2f5f`:

- The Company Studio/practice closure captures **377 inputs / 104 modules**,
  including all **126 registered source JSON paths** and **125 artwork files**
  whose declared byte counts and SHA-256 values were verified.
- The default collector lists **1,741 paths**, with **zero manual fixtures**.
  This is a path count, not a byte hash of the complete default package. The
  untraversed README update is excluded from the captured runtime claim.
- All **868 unique captured paths** across the Company/practice closure,
  **835 edition inputs** and **six compiler pins** match both committed Git
  blobs and current disk, with zero mismatch or drift.
- The build configuration was the only changed edition input, so **all 14
  editions were freshly compiled sequentially in memory**. All passed normal
  admission and final offline-manifest size checks. The largest DroneAid
  aggregate is **66,785,386 bytes**, with **323,478 bytes** below the unchanged
  64 MiB cap. Edition outputs contain no multiplayer scene files or manual
  fixtures.

Receipts:

- `/private/tmp/company-studio-source-closure-0e04b5aa5-20260929.json`, SHA-256
  `724e5a50818faa7e87ebc8cbf4779004334b0eeb7278c8c40a3f45e2a49055fb`.
  Its source inventory hash is
  `32a2d97becdcca931d5cf861997d53009043b4258bf69c70328c5b717d3a0e77`.
- `/private/tmp/edition-package-company-studio-0e04b5aa5-20260929-full.json`,
  SHA-256 `a91556921481892ccda0c89b853129e071b44ebc84110cb0704fe51a2cf78f06`.
- `/private/tmp/company-studio-commit-attribution-0e04b5aa5-20260929.json`.

The later shared `e159efd44` navigation change affects an edition input. A
fresh final-source matrix passed **14/14** sequential in-memory compiles,
with **377 inputs / 104 modules**, **126 JSON paths / 125 verified artwork
pins**, and **868 unique captured paths** again matching committed Git and disk
without drift. The default path count remains **1,741**, with no test fixtures;
the untraversed README remains outside the byte-capture claim. The largest
edition is now **66,785,624 bytes**, with **323,240 bytes** of headroom.
The earlier receipts above remain attributed to their exact original source.

Final-source receipts at `e159efd44ec2b82e45bba2d68eb695a3eade0954`:

- `/private/tmp/company-studio-source-closure-fieldset-20260929.json`, SHA-256
  `8a7ef730ec4dd5352b333355ab7c465bafb16fac0e98918ee4fb75d66d3b9e04`;
  inventory SHA-256
  `5b9de91430847fdd3fe6e0612a3537627178945563183cdac50591188d808339`.
- `/private/tmp/edition-package-company-studio-fieldset-20260929-full.json`,
  SHA-256 `4e4f0124f5e754f9b4c0bfebb67bc4a5fffb8086daa0b0e10ae409f058b8523c`.
- `/private/tmp/company-studio-commit-attribution-fieldset-20260929.json`,
  SHA-256 `853c5baeb7f9ca057edf1c1257f85a3acb533133f4dfbc1ae2fd6f56be269f5f`.

No materialized web/native build, installed-offline browser acceptance or
deployment was performed for this batch.

The whole-game compiled-artifact preview requires a real compiler output and
its verified report. It is not replaced by the registered source-reference
link, a long-text reader or local transfer practice. Verified artifact review
and its observations/import flow remain a separate qualification gate, as do
complete aggregate input journeys, physical controllers, platform/native/offline
execution and publication.
