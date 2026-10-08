# P2 chapter environments — implementation and qualification register

Updated 5 October 2026. P2 is applied for actual-source qualification on `codex/industrial-chapter-environments`, from recoverable WIP checkpoint `96833542d392e725105a89dc22ddd19e794ac748` above P1 baseline `4bc2179fee3a12a938b3475a501c5125fca979b4`. The first complete actual-source verification used clean commit `1717a5348111ae673209056b0eeef3e15e220f58`; its results and the subsequent targeted packaging corrections are distinguished below. P1 remains first in the public-delivery sequence; this P2 branch is not approved for merge or release. The corrected local software checks and committed-source builds passed at `9d305906107922993d921371725b509695eb035a`. The later exact head `1be3c8e32650b8c5f21747bdbdb3e64f94782b30` passed all eleven executed hosted checks; its unallocated-PR stage was intentionally skipped. Reconciliation now incorporates final P1 `dd44ea0046c50c58aa9b1d8f23f62c670d22a64c`, preserving both native Start fixes and P2 accepted appearance/session ownership. Successor checks belong to their own exact source; physical-device, human-play and hosted HTTPS qualification are not implied.

Draft preparation began against `6320712822ed65c706eabfaeaa2447063092cce5` and continued while P1 advanced. Historical cache-loader receipts below retain their own source/draft hashes; applying those modules does not retroactively make the receipts proof of the checkpoint or a delivered build. The user already approved the corrected overhead art treatment; artistic approval is not a pending prerequisite for this batch.

## Local baseline qualification at `9d3059061079`

The corrected source is clean and pinned to tree `c541673598266aab7031483e55a635f281b50c5e`. All completed reruns below retain that exact identity; the earlier failed `1717a5348111` receipts remain in the history section.

| Completed check                    | Result and receipt                                                                                                                                                                                      |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full Appearance workflow, 54 files | **491/491 pass**, zero failures/cancellations/skips/todo; canonical source unchanged. `.cache/industrial-appearance-9d3059061-art.json`.                                                                |
| Complete creator phase             | **217/217 pass**, source and tested files unchanged. `.cache/industrial-verification/9d3059061079-oGeQnU/creator.json`.                                                                                 |
| Mandatory static validation        | Lint, root/native formatting, content/localization and generated-source validation passed. `.cache/p2-final-{lint,format,native-format,validate}.log`.                                                  |
| Main committed-source build        | **Passed**, 2,998 entries / 900,326,444 bytes; source unchanged. This is the in-memory committed-source build and manifest validation, not a claimed emitted main ZIP. `.cache/p2-9d305906-build.json`. |
| Native optional packages           | Academy and Worlds each built twice reproducibly; committed inputs, source/runtime ZIP members and limits verified at this head. `.cache/p2-native-optional-9d305906/p2-native-verification.json`.      |

The corrected delta changes main package admission, two targeted tests and review documentation/evidence, not gameplay or presentation runtime. The unaffected gameplay **209/209**, presentation **328/328**, recordings **16/16**, rooms **80/80**, local UX **360/360** and additional Capture **381/381** observations remain bound to `1717a5348111`; they were not unnecessarily repeated locally or relabeled as `9d3059061079` runs. [Draft PR #1095](https://github.com/mekhovov/revealline/pull/1095) runs all six phases against its exact hosted head before delivery. The local software/build results are achieved. The later hosted baseline completed at `1be3c8e32650`; successor verification, merge/release and the manual qualification below remain separate.

The first hosted run at `9d3059061079` passed five industrial phases but failed local UX with **340/341**: the World appearance host module could not load its locked `fake-indexeddb` dependency, so its twenty tests never started. The workflow had installed only root dependencies. The follow-up installs the existing `authoring/fpv-worlds` lockfile for that phase, with install scripts disabled; it changes no runtime dependency or gameplay assertion. A cross-contract dependency/setup regression and the complete World host file passed **33/33** locally (`.cache/p2-ci-dependency-fix/receipt.json`). The initial hosted failure remains recorded. The corrected exact-head run at `1be3c8e32650` subsequently passed all six phases, including all 360 local-UX cases.

## Completed hosted baseline and final P1 reconciliation

Exact P2 head `1be3c8e32650b8c5f21747bdbdb3e64f94782b30` passed all six
industrial phases with unchanged-source receipts: gameplay **209**, creator
**217**, presentation **329**, recordings **16**, rooms **80**, and local UX
**360**—**1,211 test executions**, zero failures, cancellations, skips or todo.
Appearance passed **491/491** plus main/Worlds builds. Company candidate,
capacity, optional practice and Community hosted acceptance passed. All eleven
executed checks succeeded; the unallocated-PR stage was intentionally skipped.
This is the pre-reconciliation software baseline, not proof of a later head.

The final P1 merge preserves the exact-owner asynchronous Versus Start and
Team post-start focus choice, along with corrected native menu, catalogue and
steering fixtures. The title-mode fixture retains P2 saved-envelope unwrapping
while loading the requested native steering preference before boot. Recheck
these native hosts together with accepted appearance, Retry/Continue and
session ownership at the actual successor commit. The PR check records and
committed-source receipts identify that source; earlier results keep their
original identity. P2 remains a review draft without merge or auto-merge.

## Reconciled source and additional host findings

Reconciliation head `355d152b653e60f093611c912faca2d29093c2e0` passed all eleven
executed hosted checks. Industrial phases passed **1,211/1,211**, Appearance
passed **491/491** with game/Worlds builds, and Company candidate, capacity,
optional-package and Community hosted checks passed. Mandatory lint,
root/native formatting and content/localization/generated-source validation
also passed. Native Start/menu cohorts passed **65/65 on Node 20** and
**24/24 on Node 22**; an appearance/session/Team cohort passed **88/88 on
Node 20** and **32/32 on Node 22**. These overlapping executions are not a
unique-test total.

The clean committed-source main build at that head passed with **2,998 entries /
900,327,548 bytes**, below the 950 MB operating threshold. Manifest SHA-256:
`d87291f5a40b6913ccce86eda1d7f767a7077e7830bf71e000e869f8d93d426c`.
This is a canonical in-memory build, not a P2 public deployment.

An additional serial Node 20 run of 27 changed host files reached its unchanged
30-minute command bound: **269 top-level passes and six failures** were emitted,
without a final TAP summary. Twenty-five files completed; touchscreen input
needs full retirement evidence and the Ukraine role file had not started.
The failed/incomplete receipt is retained at
`.cache/p2-355d-remaining-changed-tests/receipt.json`, with per-file coverage in
`completion-coverage.json`. It is not a passing suite.

Three failed restore/import checks clicked a native action without joining its
completion. The Details check also used Load saved flight after that control
was hidden. Diagnostic joins completed the original checkpoint, history and
retained-picture assertions, but did not reproduce the earlier five-second
expiry. The narrow follow-up uses visible Library import for the backup and
Details restores, awaits the actual retained-picture import, and joins Featured
preparation in the Restart-status fixture. The latter retains its running-state
predicate and explicitly checks picture readiness. No global readiness
deadline, gameplay assertion, runtime rule or source asset changes.

Cache-only proposals passed the complete backup/Details files (**15/15**) and
the corrected picture/Restart-status files (**24/24**). The first proposal's
duplicate import and premature running assertion are retained as diagnostic
failures; they were never applied to source. These proposal results are not
committed-source verification. The successor commit requires its own complete
affected-file runs, remaining input files, mandatory validation and build.

Two other failures remain **unreproduced, with no demonstrated root-cause fix**:
mission replacement waited for background picture readiness after confirmation,
and Settings reload waited for initial picture readiness. Logging-only runs
retained their original five-second predicates and passed. Replacement's
current owner completed roughly 0.8 seconds after confirmation while paused at
tick zero; the Settings reload owner became ready in roughly 3.1 seconds. No
native rejection or stale owner was observed. Those tests and runtime paths
remain unchanged. Their records are under
`.cache/p2-355d-picture-lifecycle-diagnostic/`. Any recurrence requires diagnosis
of the original owner, preparation stage and error; a later pass does not erase
the failed observation or establish a fix. Keep these distinct from the earlier
installed-pack picture finding below.

P2 remains an unmerged review draft. The preceding hosted results were obtained
against the stacked P1 branch; retargeting to main adds its applicable required
checks. Physical devices, audible playback, broader play review and real HTTPS
rooms remain separate qualification work.

## Applied implementation scope

| Area                | Concrete coverage                                                                                                                                                                                                                         | Boundary                                                                                                                                                                               |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chapter kits        | 14 existing chapters: four Capture Solo/Versus, six Capture Team, two Snake, two SIM. Their original 84 layouts plus six current native pursuit courses receive exact source admission.                                                   | The inventory totals 90 level/course identities, not 90 new layouts. Native Refuge/Meeting r2 retain separate identity from historical r1.                                             |
| Materials           | Concrete, earth, metal, masonry, timber and damaged surfaces, each using its existing four restrained variants.                                                                                                                           | Combinations vary by chapter; no new texture revision, geometry, physical material or gameplay rules.                                                                                  |
| Authority           | 600 exact registered source/form rows: 324 ordinary engine/mode forms and 276 distinct room forms; 756 native room preparation aliases.                                                                                                   | These counts are not levels. Complete source hashes, immutable definitions and trusted host ownership are required; a copied ID or structural pin grants no rendering authority.       |
| Retained appearance | Capture/Snake/Team presentation envelopes, native SIM ThemeProfile v3, private-room local appearance ownership and bounded restoration.                                                                                                   | Fresh Start accepts; Retry/Continue retain accepted collection, art revision and environment. Historical absence stays absent; mismatched pins reject atomically.                      |
| Native rendering    | Capture Solo/Versus/Team and modern Snake use owned wall/slow/lethal bindings. SIM overrides native procedural concrete/grass/steel/timber finishes.                                                                                      | Retro Snake retains its green board/walls. Custom/Company imagery, imported mesh bindings, required opaque coating, collision/hazard roles and revealed pictures keep their ownership. |
| Studio              | 14 native full-theme packages, three terrain rasters each, actual published 335-slot contract, native import/adopt/merged-byte validation. Native World authoring explicitly detaches an official environment before changing its source. | Import is an explicit full-theme choice. This is not a new partial-package import mechanism or automatic replacement of personal artwork.                                              |
| Discovery           | EN/UK review cards, actual-size material specimens, named missions and verified native routes.                                                                                                                                            | Capture opens a collection then mission selection. Snake links select mode and level. SIM selects a course, with flight mode chosen natively.                                          |

The applied implementation covers the chapter/material binding gap. The separate [native caught-clip bridge](actor-defeat-clips.md) now connects admitted generic atlases to actual Team hunter and Capture relay defeat events, with bounded retirement, pause/Reduced behavior and silent restore/seek. It preserves existing Hunt soldier destruction. Generic actors without a distinct native notice or defeat lifecycle do not receive invented phases; their Studio clip availability is not evidence of a missing gameplay state. Native SIM Lookout already samples its genuine notice phase. Both batches are present in the P2 checkpoint; their local software/build evidence is recorded above, and hosted baseline checks passed at `1be3c8e32650`. The reconciliation successor requires its own exact-head checks before delivery.

## Player and creator access

The existing player control is **Settings → Enemy appearance preset → Military Field · soldiers and vehicles**. It applies the matching appearance and roster; **Running enemies** separately controls optional humanoid populations, and **Soldier uniform** selects the supported cast. The Hunt hub's military level directory identifies actual native missions and vehicle roles. Snake targets remain humanoids; choosing artwork does not add vehicle combat or change objectives.

After P2 qualification and delivery, starting a fresh eligible official mission with Military Field accepts its chapter environment automatically. Players do not need a Studio package or a review URL. Retry, Continue and restored attempts retain their accepted appearance; changing a preference does not recolor an already accepted attempt. Original level artwork and creator/Company-owned source images remain available and owned by their original source. Retro Snake retains its green board treatment. The new chapter bindings are currently available on the P2 qualification branch and are not claimed as public functionality yet.

The fourteen `.rltheme` downloads serve creators who explicitly want the complete chapter theme in Asset Studio. Import stages a full-theme selection using the existing native workflow; Save persists it. It is not an automatic installation, a partial terrain patch, or a prerequisite for player-side Military Field. Existing workspace originals remain retained by the verified native import workflow. Cancellation and save/export follow the existing Studio controls.

## Actual-source evidence at `1717a5348111`

Counts below describe overlapping scoped runs; they must not be summed as unique coverage. These actual-source runs used Node 22.22.2 without draft or diagnostic loaders. The industrial phase receipts are in `.cache/industrial-verification/1717a5348111-1zu9Xh/`; each retains its exact source and test identities. The complete six-phase run **failed** because the creator phase found a real distribution omission.

| Scope                                               | Observed result                                   | Interpretation                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gameplay                                            | **209/209 pass**                                  | Native gameplay regressions; no new rules or human completion claim.                                                                                                                                                                                                                                                                   |
| Creator                                             | **216/217 pass; one failure**                     | The main distribution did not admit `optional-practice/civilian-fpv/industrial-environment.mjs`, imported by the native World hosts. This is a production packaging omission, distinct from the earlier draft-loader enumeration limitation.                                                                                           |
| Presentation                                        | **328/328 pass**                                  | Includes the seven native caught-clip regressions, chapter bindings and retained presentation ownership.                                                                                                                                                                                                                               |
| Recordings                                          | **16/16 pass**                                    | Scoped recording compatibility and native reconstruction.                                                                                                                                                                                                                                                                              |
| Rooms                                               | **80/80 pass**                                    | Local room appearance ownership, retained restore and integration.                                                                                                                                                                                                                                                                     |
| Local UX                                            | **360/360 pass**                                  | Complete required local-UX phase.                                                                                                                                                                                                                                                                                                      |
| Additional Capture hosts                            | **381/381 pass** across 29 complete files         | Actual committed source, no loader; unchanged source before/after. Includes installed-pack replacement, saved appearances, Library and Company/custom ownership paths. Receipt: `.cache/p2-actual-capture-hosts/1717a5348111-hcXlpK/receipt.json`. The earlier intermittent picture refusal did not recur; no cause or fix is claimed. |
| Full Appearance workflow cohort                     | **489/491 pass** across 54 files                  | Two assertions retained the prior optional-package closure count, 76 runtime / 78 source files. The admitted closure is now 78 / 80. Receipt: `.cache/industrial-appearance-1717a5348-art.json`; exact source unchanged.                                                                                                               |
| Environment producer and published Studio admission | **Generation check passed; 2/2 regressions pass** | All 16 generated outputs match committed bytes; all fourteen packages use the native published workspace contract, retain originals and reject unpublished slots. Receipt: `.cache/industrial-studio-producer-1717a5348-art.json`; exact source unchanged.                                                                             |
| Native optional archives                            | **Passed**                                        | Two reproducible builds of Academy and Worlds from this commit, with source/runtime ZIP membership, hashes, committed inputs and package limits verified. Details below. These archives are not publicly eligible.                                                                                                                     |

After those frozen runs retired, the main distribution admission was corrected, both exact optional closure counts were updated, and byte-identical runtime/source checks were added for the shared environment authority and data modules. The targeted four-file run then passed **23/23**, including Company distribution references, native environment admission, optional packages and published Studio transport (`.cache/p2-packaging-corrections.tap`). This is evidence for the corrected working tree, not a replacement 217/217 creator or 491/491 Appearance receipt at `1717a5348111`. The subsequent complete creator and Appearance reruns, static validation and corrected build passed at `9d3059061079`, as recorded above; the original failed receipts are preserved.

### Preserved draft history

The earlier cache-loader cohorts passed presentation **328/328** on Node 20, gameplay **209/209**, recordings **16/16**, rooms **80/80** and local UX **360/360**. The draft creator result was **216/217**, with filesystem enumeration unable to include cache-only modules. That historical harness limitation does not explain or waive the real missing main-distribution adapter found after application. Native SIM draft qualification passed **65/65** after coating/HUD reconciliation; Capture painter regressions passed **3/3** on Node 20 and Node 22; four review-page DOM regressions passed. Their receipts retain their own source/draft hashes and are not relabeled as actual-source results.

Capture's historical nineteen-file cohort completed **174/176**; the two corrected complete files and five Company ownership hosts then passed **111/111**. Additional envelope-host runs recorded **142/154**, then **113/118**, then **32/33**, followed by a diagnostic complete replacement-file **25/25**. The final draft manifest covered 58 files, SHA-256 `d299a213215d5312771c55b40edbd703eab198ce37ec7da93cee49ab73d69d47`; authority/envelope checks passed **17/17** on Node 20. Earlier timeout and failure receipts remain retained. The subsequent actual-source **381/381** cohort provides a complete later compatibility observation, while the unresolved intermittent finding remains open below.

### Open qualification finding: installed-pack picture preparation

Two `mission-replacement-host.test.mjs` cases—installed-pack download and save failure handling—intermittently failed the native `run.tick > 0` assertion **before** their intended download/storage faults were installed. Start was visible and enabled. After awaiting its real handler and advancing 20 simulation frames, the attempt remained in briefing with picture pending, no dialogs or console errors, and the native picture-unavailable message. The complete failing boundary receipt is **24/25** (`capture/mission-replacement-start-boundary.receipt.json`).

The next full diagnostic receipt is **25/25** (`capture/mission-replacement-native-picture-diagnostic.receipt.json`), using an ignored logging-only loader. It did not reproduce the refusal or obtain its original error stack. Relevant database opens were asset storage and separately routed soundtrack storage; the suspected Journey database alias was not demonstrated. Native decode deadlines are 15 seconds, so the approximately five-second failed test does not establish a decode timeout. No production workaround, deadline increase, automatic retry or weakened assertion was applied. The later actual-source 381/381 Capture cohort also completed this file without the refusal. Retain this finding as unreproduced, with its cause unknown; capture and investigate the original preparation error if it recurs. Neither passing observation is evidence of a root-cause fix.

### Actual browser and Studio evidence

The portable [browser evidence package](qualification/industrial-art/environments-v1/README.md) contains unchanged screenshots, sanitized receipts, source identity and a SHA-256 manifest for `1717a5348111`. It shows modern Snake **Refuge Bays** in paired Versus with the Twin Intercepts timber kit. Desktop viewport measurements at **320/360/390 × 740 CSS px** recorded no horizontal or vertical document overflow; the smallest directional buttons measured **45.328125/52/56 CSS px**, respectively. The startup images establish visible material binding and layout, not successful interception, mission completion or multiplayer balance.

Through the actual-source native Asset Studio UI, **Guarded Crossings** was imported at revision 106, saved as generation 3, exported, reimported at revision 107, saved as generation 4 and reloaded at revision 107. Saved and Draft previews were both Ready. The actual export contains **335 slots**, is **8,810,992 bytes**, and has SHA-256 `558e9333894054f13708a123cf353815f7a5e4dd3249aceb502aa7ce51133dda`. Every retained file was verified; the wall, slow and lethal terrain hashes match the chapter inventory. The export includes retained workspace originals, explaining its size relative to the chapter import. Its sanitized [round-trip receipt](qualification/industrial-art/environments-v1/studio-roundtrip.json) preserves those hashes without personal paths. This is one complete interactive actual-source kit round trip, not fourteen interactive browser checks.

The earlier draft UI evidence remains separate: Twin Intercepts imported, saved, exported and reimported with both previews Ready. Its actual 335-slot export was 8,774,786 bytes, SHA-256 `7e0827aaddf66ebbbf41b306123efc2a75144f0b32793e9b22caf1b82552d88b` (`.cache/p2-draft-studio-export.json`). The browser download-event adapter timed out, but the actual file was inspected and reimported. Other draft observations showed Cable Cutoff timber, Low Pass Depot native ready and a UK chapter review fitting 320/360/390 widths. These earlier observations retain their draft scope.

Neither browser batch establishes physical input, audibility, performance, landscape/enlarged-text coverage or human play acceptance. The screenshots and source receipts are review evidence, not independent server attestation or a public delivery claim.

## Budgets and native archive proof

The corrected fourteen Studio packages total **13,837,091 bytes**. They are separate review downloads, not native optional runtime assets. All 16 generated outputs reproduced byte-for-byte at `1717a5348111` and again during final validation at `9d3059061079`. Each chapter adds at most **3,072 decoded raster bytes** for its three terrain images; this is not a page/GPU memory benchmark. The admission data module is 330,026 bytes and the pure authority module 9,240 bytes. Existing actor, effects, custom model and package limits are unchanged.

The latest native archive receipt is `.cache/p2-native-optional-9d305906/p2-native-verification.json`. It pins commit `9d305906107922993d921371725b509695eb035a` and tree `c541673598266aab7031483e55a635f281b50c5e`, verifies six generated projections byte-for-byte, builds both packages twice and independently checks on-disk source/runtime ZIP membership and hashes. The earlier `.cache/p2-native-optional-1717a534/p2-native-verification.json` remains separately retained. `committedInputsVerified`, `zipMembersVerified` and reproducibility passed; `publicEligible` remains **false**.

| Package     | Actual runtime payload       | Existing runtime limit       | Actual source archive members |
| ----------- | ---------------------------- | ---------------------------- | ----------------------------- |
| FPV Academy | 78 files / 4,817,042 bytes   | 96 files / 8,388,608 bytes   | 80 files / 4,846,913 bytes    |
| FPV Worlds  | 115 files / 16,135,231 bytes | 128 files / 20,971,520 bytes | 117 files / 16,170,535 bytes  |

Payload bytes above exclude ZIP container overhead. Both packages include the shared authority and data modules; they do not import the fourteen Studio packages. The native Worlds adapter is present in the Worlds archive. Academy and Worlds distribution ZIP hashes are `735d6e8bcadb2509234083b08bba9a97b23514814623aa0769ff9cdccc92c359` and `ba9c36d27bac1d7a414b90ddc640562a3096c6fc750ad6a6e4f89cc929a46a16`; corresponding source ZIP hashes are retained in the receipt. The older cache-overlay dry audit remains historical evidence, not the basis for these archive claims. No budget increase was needed.

The **main** distribution at `1717a5348111` failed before packaging because its explicit admission list omitted the native environment adapter (`.cache/p2-1717a534-build.log`). The corrected admission and main committed-source build subsequently passed at `9d3059061079`, with 2,998 entries / 900,326,444 bytes and unchanged canonical source. This main result has its own receipt; it is not inferred from the standalone optional archives. Both generations of archive/build receipts retain their original source identity.

## Remaining delivery checks

1. Require all six hosted industrial phases and applicable PR checks on the reconciled PR #1095 head, plus affected native Start/session host checks and a committed-source build. The `1be3c8e32650` hosted baseline is complete; keep all earlier local/build receipts at their original identities. A merge or documentation follow-up does not change the source identity of already completed evidence.
2. Preserve the installed-pack preparation finding as unreproduced with no root-cause fix. The actual-source 381/381 Capture cohort passed, but any recurrence requires the original preparation error and ownership/lifecycle diagnosis, not a timeout increase or automatic retry.
3. Preserve native package `publicEligible: false` until the separate review/release gates are satisfied. Main manifest validation and actual optional ZIPs are proven software outputs, not public deployment. Keep P1 first in the public-delivery sequence.
4. Extend interactive/browser and physical qualification only with clearly named kits and source heads. All fourteen Studio packages have automated native admission; Guarded Crossings has the actual-source import→save→export→reimport→save→reload evidence above. That is not fourteen physical-device or human-play approvals.

## Remaining manual and device qualification

- Review each chapter kit in native play: concealed Capture cells remain opaque, revealed photographs stay readable, functional wall/slow/lethal cues remain distinct, and SIM route/goal/hazard materials remain legible at flight camera distance. Inspect the chosen palette/material combination, not only isolated swatches.
- Exercise Solo, paired Versus, shared Team and rooms at maximum supported populations/effects. Check warnings above debris, clean/brutal/no-blood/remains combinations, muted and real audio playback, pause, Retry, retained Continue/reload, interrupted loading, offload/reinstall and repeated Studio preview disposal.
- Measure real low-end phones and desktop devices at 320/360/390 widths, portrait/landscape, EN/UK, enlarged text, simultaneous touch and physical gamepads. Record frame time, memory/lease retirement and control/board visibility; desktop viewport emulation does not replace these measurements.
- Keep human interception/recognition/enjoyment review distinct from generated completion witnesses. Artwork approval is already recorded, but chapter-level readability and willingness to replay are not established by successful test routes.

Broader campaigns, new combat/destructible-terrain mechanics, public matchmaking, hosted accounts, ghosts and networked SIM remain optional. This batch does not promote Military Field to the published/recommended default, alter unrelated source-slot approvals, or supply a hosted HTTPS room service.
