# Design Atlas current input qualification

This bounded Phase 6 receipt covers the Design Atlas reader/download batch at
`17fa81cb94ee563976f2f9969980894f10e32177` and the Copy status deadline follow-up at
`2a42cc6c1c79e4a0dc6557b823a8206c6dd4fbf1`. The final current virtual-controller
browser journey passed **4/4** stages against the follow-up. Native keyboard,
actual downloaded text and physical-device qualification have separate evidence
boundaries below.

## Scope and changes

Design Atlas is a read-only original interface study. Its nine screens and
eighteen states illustrate proposed game and authoring behavior. Selecting an
illustrated validation error, success, flight or Workshop action does not run a
domain validator, save a project, install content or start gameplay. There is no
project Save/Reopen or generated-asset export to qualify here.

The Atlas already used the shared authoring input owner. Its long sections,
nested short-landscape preview and horizontally overflowing coverage matrix
needed explicit reading controls. The matrix's raw `tabindex` did not make it a
controller navigation candidate. The bounded local adapter now provides real
Read and scroll buttons for sections, direction subarticles, the current mock
preview, the two-axis matrix and the expanded illustrative brief. Sections
chooses stable reader destinations. No shared input owner or second poller was
added.

Native Enter enters a reader once; arrows and page keys scroll within its
actual bounds. Confirm or Back exits to the exact, visible opener. Reading
steps do not repeatedly scroll the page back to that button. New focus, hidden
or unfocused documents, dialogs, page lifecycle changes and replacement of the
mock preview retire stale reading ownership without taking focus back. Reader
labels and open Sections remain localized without replacing their controls.

An explicit Download example brief anchor beside Copy prepares the exact
visible UTF-8 text, with a locale-specific `.txt` filename. It neither starts a
download automatically nor exports a project/schema. Repeated activations use
the same prepared URL; language changes replace its exact bytes after DOM
translation. Old URLs are revoked on replacement/disposal/pagehide, and a
persisted page return rebuilds the link. Clipboard behavior remains separate.

Actual virtual-pad use exposed a clipboard write that never settled. The small
follow-up limits the UI wait to two seconds, then uses the existing fallback
message and foreground/owner checks. The OS write still starts synchronously
within the original activation. Its late success or failure cannot overwrite
the timeout result or a newer Copy operation. The application does not claim to
cancel an operating-system clipboard write.

## Automated checks

The final focused cohort passed **52/52**, with zero skipped tests on Node
20.19.5 (stdout-only receipt):

```sh
node --test game/test/design-atlas-host.test.mjs game/test/direct-tools-loading.test.mjs game/test/authoring-input.test.mjs
```

The count comprises 35 actual Atlas host cases, three existing direct-tool
loading cases and fourteen shared authoring input cases. The host harness loads
the actual Atlas HTML/module and production router, navigation and Confirm
owner; finite layout geometry is test data, not browser rendering evidence.
Coverage includes both matrix axes, native first Enter, inactive button arrows,
Home/End/page keys, Tab escape, exact Back restoration, bounded section scroll,
preview replacement, brief disclosure, lifecycle/focus retirement, Sections
EN→UK→EN, real download anchor activation, exact EN/UK Blob bytes, URL cleanup
and unsupported URL support without breaking Copy.

Eight timeout regressions cover the 1,999/2,000 ms boundary, synchronous
clipboard invocation before timer setup, early timer cleanup, ignored late
resolve/reject, newer focus and hidden/unfocused owners, a newer Copy
generation, and synchronous clipboard denial. ESLint, Prettier and
`git diff --check` passed for the bounded runtime/test changes. Independent
source review found no blocking issue. The full localization check passed
**10,913 messages / 8,580 references**.

## Current controller browser journey

The isolated current fixture is:

`http://127.0.0.1:8991/game/test/manual/authoring-controller.html?tool=atlasCurrent`

It requires English and a foreground page. Real standard-pad button pulses
navigate production controls; the fixture does not call product handlers,
focus a target to bypass navigation or mock/read the Clipboard API. It compares
the complete pre-existing local/session storage snapshots without writing
player data. Initial host setup is not controller input qualification.

The first observed run completed its first three stages but timed out waiting
for Copy's pending promise. This is a failed full journey and is the direct
reason for the status deadline fix. A later fresh attempt failed before any
stage because the previous native language check had retained Ukrainian. That
was the explicit English precondition, not a product failure. English was
restored through the UI before the final fresh run.

The final run against `2a42cc6c1` passed all four stages:

| Stage                            | Observed result                                                                                                                                                                                                                                                                                                |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Studies and mock routes          | Canceled selector drafts preserved the current illustration; all nine screens/eighteen states and eleven representative mock destinations passed. Mock navigation returned focus to the screen selector and stayed in Atlas.                                                                                   |
| Viewports, specimens and reading | Settled CSS preview widths were 768, 390, 740 and 1,120 px in an actual 1,248 × 547 iframe. EN/UK specimen controls passed. The nested preview reached Y 226/226; the section reader moved within the observed page interval 916.4297–1,143.9375 and returned to its opener.                                   |
| Inventory and matrix             | The player/support/system/authoring filters returned 10/11/4/7 rows, 32 total. Matrix Y reached 2,122.5 of 2,123. X maximum was zero, so this virtual run does not qualify horizontal matrix scrolling.                                                                                                        |
| Illustrative brief and download  | The illustrated Workshop path opened the brief. Copy reached the bounded two-second fallback with the exact visible text selected. Two explicit, unprevented Download activations used the same prepared URL and EN filename, with no new Blob allocation. Both referenced the exact 812-byte text/hash below. |

The brief did not overflow at this iframe size, so the virtual result does not
qualify long-brief scrolling. The separate narrow native check does. Reading
Back/Confirm restored each exact entry. The final run retained all existing
storage entries: one local entry and zero session entries. CSS width choices
are design studies, not device emulation or physical-device certification.

## Native keyboard and clipboard boundary

The native check used actual unbound keyboard input for the bounded native
checks, without a pointer reset. At 390 × 844, the matrix reached horizontal
X 412 and vertical Y 2,588.5 of 2,589. With the Short landscape preview selected inside that same outer viewport,
the illustrated validation-error preview reached Y 493/493. The brief reached Y 126.5 of 127.
Escape restored the exact reader opener rather than invoking a mock action or
opening a different destination.

The real Return to Workshop route restored focus to `shell-design-atlas`;
Return reopened the tool with the expected transient defaults:
`title` / `returning` / inventory `all`. The selected Ukrainian application
locale survived the route transition, then English was restored through the UI
for the final controller fixture. These are native route-return and bounded
live-locale checks, not project persistence or a complete Ukrainian workflow.
Native EN and UK explicit download activations produced the actual OS files
validated below.

Native Copy reported fulfillment, but the CUA native paste/read bridge reported
that its virtual clipboard had no data. No actual clipboard-byte receipt was
obtained. A success message or fulfilled promise is not proof of clipboard
contents, and this observation does not establish a production clipboard bug.
The text-download fallback and its files do not qualify clipboard behavior.
The retained `clipboard-native-probe.html` is a diagnostic fixture, not an
alternate product clipboard implementation.

## Actual text artifacts

`/private/tmp/atlas-native-downloads-20260929.json` validates the actual files
under `/Users/oleksandr.mekhovov/Downloads/` against the committed
`tools:atlas.exampleBrief` source in EN/UK at `2a42cc6c1`. Both pass strict UTF-8
parsing, exact text and exact encoded-byte comparison; no BOM or trailing
newline is added. Source and download bytes remained unchanged after checking.

| Actual native filename                | Bytes | SHA-256                                                            |
| ------------------------------------- | ----: | ------------------------------------------------------------------ |
| `fpv-line-atlas-example-brief-en.txt` |   812 | `406e39d5dd71db82904f0573336a877528d312be344a551382977a5c2c23814e` |
| `fpv-line-atlas-example-brief-uk.txt` | 1,497 | `d6272b86cf1d0c739172b7a710e2d07cb6766a1800e0726be762b08bb1074ec0` |

The final virtual run also produced `fpv-line-atlas-example-brief-en (1).txt`
and `fpv-line-atlas-example-brief-en (2).txt`, each **812 bytes** with the same
EN SHA-256 above. The final combined receipt
`/private/tmp/atlas-all-downloads-20260929.json` passed **4/4 actual OS files**;
`/private/tmp/atlas-virtual-downloads-20260929.json` retains the virtual pair
separately. All three EN files are byte-identical. Native EN/UK file modification
times were 10:07:27.552Z / 10:08:47.478Z; the virtual pair were
10:10:59.506Z / 10:10:59.628Z on 2026-09-29. Timestamps and file validation are
observed facts; input provenance comes from the distinct native
and virtual browser journeys.

The reusable validator is
`/private/tmp/validate-atlas-download-20260929.mjs`. It performs strict fatal
UTF-8 parsing, lossless UTF-8 roundtrip, full exact authoritative text/byte
comparison, committed-source matching and before/after source/file stability.
Downloads are preserved. Plain-text validation authenticates the illustrative
brief only. No project importer/domain validator, generated-image quality or
clipboard bytes are implied.

## Packaging and remaining gates

The `17fa81cb9` in-memory matrix passed all fourteen editions. Its largest normal
output was **66,783,284 bytes**, **325,580 bytes** below the 64 MiB cap. The
source closure and final follow-up attribution receipts are:

- `/private/tmp/design-atlas-source-closure-copy-timeout-20260929.json`
- `/private/tmp/design-atlas-commit-attribution-copy-timeout-20260929.json`
- `/private/tmp/edition-package-design-atlas-20260929-full.json`

The follow-up closure captured **66 source inputs / 38 static modules** with
**59 module edges**. All **1,725** default collector files excluded manual test
fixtures. The inventory SHA-256 is
`6eea85ee4ca688132a1e26131d697ef57e6101d4466abc037fde191cc4e22efa`.
The closure receipt file SHA-256 is
`a230fc087e83002a70c96a4374058807232e46d3cbc233aa24159d6b5633b2a9`.
All 66 Atlas inputs, 835 edition inputs and six compiler/checker pins—**864
unique paths**—match Git blobs at `2a42cc6c1`, with no disk drift or mismatch.
The 835 edition inputs and six compiler pins did not change after the existing
matrix, so no redundant recompile was performed. Its embedded source revision
remains `17fa81cb9`; attribution does not rewrite that build metadata or imply a
new distribution.

The closure traversal includes the related `reveal-audit.html` reference route,
but this browser journey does not qualify that route. Twenty-one historical
source-only reference images are documented as unavailable when omitted;
this batch does not admit/copy those originals into packages. The closure check
is not exhaustive evaluation of computed catalog resources.

Physical controllers, OS/browser clipboard byte behavior, native-platform
execution, an installed offline run and publication remain separate gates.
No materialized build, signed native package, release delivery, real editor
Save/import/validation, or generated artwork claim is made by this receipt.
