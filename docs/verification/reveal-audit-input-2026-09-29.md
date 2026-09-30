# Reveal Audit current input qualification

This receipt covers the bounded historical source-review page at
`/authoring/design-atlas/reveal-audit.html`. Native keyboard checks and the first
complete virtual-controller attempt (**3/3**) passed on the dedicated
`localhost:8996` origin. The runtime and final package capture are attributed to
`6ef5559fc0aece83291e1079b3fb8a00404380f8` on `codex/reveal-audit-input`, based on
`8a81fb95c06812bd480263f648b89f2f1b14455a`. This follow-up branch does not advance
the coordinator-frozen PR #782.

## Product contract and bounded changes

Reveal Audit displays the historical **2026-09-14** design audit: **56 exact
owners**, comprising **39 raster owners / 21 unique raster originals** and
**17 procedural scenes**. It is not the current Content Production register or
a production approval. The recorded proposals for **38 new compositions / 44
exact frame exports** remain historical JSON fields; they are not new generated
assets or actions available in this page.

The page has no project Save, import, export, draft persistence or approval
operation. The controls inspect historical source identities, open owner
disclosures, read bounded regions, retry loading the study and navigate between
the real Atlas and this review. Original PNG, Markdown and JSON links use normal
browser navigation. Those raw-source handoffs remain outside this input
qualification and are not presented as an app-owned document viewer.

The local adapter reuses the existing singleton authoring input host, shared
Confirm lifecycle and bounded reading behavior. Raster and procedural sections
have explicit Read actions. Each owner disclosure also has its own reader.
Back or Confirm ends reading and restores the exact reader button. A subsequent
Back inside an open owner disclosure closes it and restores its summary.
Sections targets the intended controls; Page actions targets the real Atlas
return link. No additional gamepad poller or global Confirm relaxation was
added.

The loader stages a complete result before replacing the published review and
guards stale completions across cancellation, replacement and lifecycle changes.
Retry and Cancel have owned focus successors. Missing originals remain explicitly
unavailable rather than being replaced with invented art. Procedural previews
use the recorded seed-0 descriptor only when it matches the registered source.
The historical JSON and original artwork were not rewritten for this batch.

## Baseline observations and automated checks

The real native baseline reader **did work**. This receipt does not claim that
first Enter was broken in the baseline browser merely because a finite test
model exercised that case. The observed baseline defects were a stale
**Loading** status despite rendering all **21 + 17** records and Sections
navigation reaching the wrong controls. Both were corrected.

The final focused cohort passes **78/78**, with **25 Reveal**, **35 Atlas**,
**14 shared authoring** and **4 reference** cases:

```sh
node --test --test-reporter=dot game/test/reveal-audit-host.test.mjs game/test/authoring-reference.test.mjs game/test/authoring-input.test.mjs game/test/design-atlas-host.test.mjs
```

These are modeled host tests; they do not establish real-browser layout, full
image decoding, physical controller input or installed-offline behavior.
Overlapping earlier cohorts must not be added to this total.

Full EN/UK localization passes **10,917 messages / 8,584 references**. The
test-only current fixture and its registration pass scoped ESLint, Prettier,
syntax and diff checks. The final inventory checks pass **2/2**, with no skipped
cases. Manual fixtures remain outside player distributions.

## Native keyboard observations

The parent operated the actual page through unbound native keys, without a
pointer or accessibility-focus reset. The observed native viewport was
**1280 × 720**. This is not a 390px, 200% zoom, forced-colors or physical-device
qualification.

The following passed on the candidate, including a repeat of both section
readers after the final header change:

| Check                      | Observed result                                                                                                                                                               |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ready status               | English summary correctly reports 56 owners, 21 raster originals and 17 procedural scenes.                                                                                    |
| Raster section             | Native End reached **6560.5 / 6561 px**; Home restored zero.                                                                                                                  |
| Procedural section         | Native End reached **5915 / 5915 px**; Home restored zero.                                                                                                                    |
| First raster's five owners | Native End reached **303 / 303 px**; Home restored zero. First Back returned to the exact Read entry; second Back closed the disclosure and focused its summary.              |
| Live Ukrainian             | Reader label, tag and summary updated correctly. English was restored afterward. This is a scoped live-language check, not full Ukrainian coverage of every historical label. |
| Atlas return and reentry   | The real Atlas return link and References link reopened Reveal Audit; ephemeral owner disclosures reset closed.                                                               |
| Page actions               | On the final header structure, Page actions focused the real Atlas Home link.                                                                                                 |
| Retry                      | Native Retry completed and restored focus to the Retry button.                                                                                                                |

The final committed source was rechecked: both section readers reached the same
native bounds, the five-owner reader again reached 303px, live UK/EN labels and
Atlas return/reentry passed. One rapid key sequence before the Atlas input owner
finished mounting had no effect; the parent inspected readiness and retried after
the real owner was ready. No pointer or direct-focus reset converted that setup
sequence into a pass.

No timed real-network cancellation or forced image failure was introduced during
this native journey. Deferred-response, cancellation and stale-completion cases
remain separately attributed to the host tests.

## Current virtual-controller workflow

The test-only entry is
`game/test/manual/authoring-controller.html?tool=revealAuditCurrent`, using
`reveal-audit-current-workflow.mjs` on port 8996. It performs application actions
only through the real shared standard-pad command path. DOM/source/storage
observations do not invoke app handlers, force focus, synthesize keyboard events
or write application data.

The three intended stages are:

1. Verify the immutable historical JSON and every rendered exact owner. Read the
   complete raster section and its first owner disclosure to their bounds;
   exercise first and second Back, reopen and explicit disclosure close. Observe
   a decoded first original PNG or its honest unavailable fallback.
2. Verify all 17 procedural canvases' native dimensions and seed-0 labels. Read
   the procedural section and owner disclosure using Confirm and Back, then
   close and reopen the disclosure.
3. Navigate through the real Atlas return link and explicit Reveal reentry.
   Verify fresh complete content, reset disclosures, unchanged historical JSON
   and unchanged local/session storage snapshots.

The first actual attempt passes **3/3** at the final source. The outer runner is
**1280 × 720**, with an observed **1248 × 547** inner review viewport.

| Region                      | Observed bottom / maximum Y | Returned top | Exit                                         |
| --------------------------- | --------------------------- | ------------ | -------------------------------------------- |
| Raster section              | **6629 / 6629px**           | 0            | Back to exact Read entry                     |
| First raster owner list     | **389 / 389px**             | 0            | Back to entry; second Back closes to summary |
| Procedural section          | **5936.5 / 5937px**         | 0            | Confirm to exact Read entry                  |
| First procedural owner list | **0px overflow**            | 0            | Confirm to entry; Back closes to summary     |

The zero-overflow owner list qualifies entry/exit and focus, not scrolling. All
56 exact rendered owner rows, 21 original link paths and 17 native 384 × 288
canvases with seed-0 labels matched the historical record. The first PNG's
browser image element fully decoded at **1774 × 887**; this does not extend to
all 21 originals or claim pixel-exact procedural-renderer equivalence.

Real Atlas return and explicit Reveal reentry loaded a fresh complete review and
reset the owner disclosures. The historical JSON remained byte/hash-identical.
The observed **one local-storage key / zero session-storage keys** were unchanged.
The fixture did not write, erase or restore application storage. No fault was
forced in this browser attempt. Raw-source links were inspected as destinations,
not activated and qualified as browser handoffs.

The parent's compact transcription is
`/private/tmp/reveal-audit-browser-summary-20260929.json`. It summarizes actual
tool observations; it is not a raw browser trace archive.

## Historical asset verification

The independent source receipt is
`/private/tmp/reveal-audit-originals-20260929.json`, SHA-256
`681e047cce61c5d0bb84896d87ea2ab77eaf1bd8b9bbcd126e4e983790b55d61`.
It was captured against baseline `8a81fb95c` and verifies:

- All **21 local PNG originals**, totaling **58,559,149 bytes**, match the
  historical byte counts, SHA-256 values and PNG IHDR dimensions.
- All **39 raster owner/source identities** match the current registry, and
  all **17 procedural owners and seed-0 descriptors** match the recorded audit.
- The historical audit JSON remains **75,088 bytes**, SHA-256
  `f0952cdfaae60d8bed364a9cf2293aa036fe802a9551b55743e863712ff09eda`.

This receipt checks file bytes and PNG headers, not full pixel decoding of all
21 originals or rendered canvas pixels. The default distribution already
includes **9 of these originals / 25,559,211 bytes** for other features. The
other **12 originals / 32,999,938 bytes** remain source-only. Therefore the
source-review limitation does not imply that none of the historical pictures
ship in the game.

## Final package and source attribution

At `6ef5559fc`, the source closure covers **61 resources / 37 modules / 100
edges**: 60 module imports, 26 HTML resources, one data-module, three literal
URLs, nine CSS references and one explicit historical-audit fetch. It captures
**66 source pins**. The official default collector contains **1,838 paths** and
**zero test fixtures**. Existing folder admission includes the new local input
module without changing the build configuration or admitting additional PNGs.

All audit code/documents and the nine already-included originals remain optional
in the actual Solo, Versus and Team dependency selectors. The twelve omitted
originals stay source-only. No audit path leaks into the **574-file** standalone
company engine. This preserves the existing package boundary; a source-complete
browser review is not proof that every historical original is installed offline.

Compared with the preceding Viewport receipt, only the generated locale catalog
changed among **835 edition inputs / six compiler pins**. Fresh **14/14 sequential
in-memory edition compiles** pass. The largest DroneAid output is **66,787,354
bytes**, leaving **321,510 bytes** below 64MiB. The normal validation and final
budget checks were retained; no materialized package or additional art admission
was used.

The final union of 66 source, 26 historical, 835 edition and six compiler rows
contains **884 unique paths**, all matching exact Git blobs and disk bytes at the
committed source, with no drift. The final historical recheck also confirms all
21 original PNG pins and five historical/runtime inputs remain unchanged.

Receipts:

- `/private/tmp/reveal-audit-source-closure-final-20260929.json`
- `/private/tmp/reveal-audit-package-boundary-final-20260929.json`
- `/private/tmp/reveal-audit-original-recheck-final-20260929.json`
- `/private/tmp/reveal-audit-compiler-capture-final-20260929.json`
- `/private/tmp/reveal-audit-edition-package-final-20260929-full.json`
- `/private/tmp/reveal-audit-final-attribution-20260929.json`, SHA-256
  `97abdc98ba68f12fe4c9e9eaa53a182b67b43eab1c142c618331cfdc0f7e2a78`

Physical controllers, complete Ukrainian traversal, 200% browser zoom,
forced-colors rendering, installed-offline behavior, native webviews/devices,
raw-source browser handoffs and public deployment remain separate qualification.
There are no OS export artifacts for this read-only product.
