# HUD text and stick layout qualification

The World host updates its HUD on every native animation callback, including
paused flight. Reassigning unchanged labels needlessly replaces text nodes, and
reading each stick's `clientWidth` between those writes repeatedly requests
layout. The focused change keeps the existing pixel transforms and exact
`clientWidth * .34` radius, reads both radii before writing either stick's labels,
and assigns a HUD text node only when its final text differs. Objective text is
composed in the original order before one assignment. It does not change flight,
recording, input mapping, quality, collision, rewards, or proof clocks.

The measured source pair is baseline
`5cde6dbc97c3067b6023d2bf7fd97fe251805347` and candidate
`3f88812a8d3bf47577443184d555c43c0fb526f8`. The only changed original input is
`world-app.mjs`, +121 bytes, SHA-256
`16e42c7053211392921666c2763c47876d0739e74f614f7de8d63fc76e7e89b3`.
The subsequent merge of published visual-source capacity `5bd8f36d7` leaves that
host byte-identical. Package admission and native acceptance are recorded
separately below; a source overlay is not a newly admitted package.

## Bounded native attribution

The initial zero-overlay admitted-player run (`8950`, 190 checks) identified
native stick-width reads as a larger CPU share than recorder-related clones.
Its final Woodland paused-settings window had an irregular 1,008 ms RAF gap;
that window is preserved and is not treated as a stable timing reference.

The matched `8951` / `8952` source runs each passed 190 checks. Each ran one
visible player at a time, Container Yard 08 then Woodland 01, with four five-second
windows per course: Ready/disarmed, verified demonstration, ordinary grounded
practice, and paused Settings. All eight paired windows retained focus,
visibility, intended status, and 5,000–5,002 ms measured duration.

| Native CPU metric per host callback   | Baseline | Candidate |
| ------------------------------------- | -------: | --------: |
| Mean across the eight window means    | 1.879 ms |  1.528 ms |
| Paused monitored text/attribute calls |       14 |         4 |

Host callback CPU decreased in every window, by 0.238–0.549 ms. The two native
width getters accounted for a decrease of 0.248–0.407 ms per callback. Clone work
was approximately 0.05–0.11 ms per callback and is unchanged. Full per-window
values and coverage are in `evidence/paired-attribution.json`.

These are instrumented CPU observations on one local browser, not FPS, GPU
elapsed time, device performance, or a general latency guarantee. The runs were
sequential, not randomized. Native practice stayed grounded with neutral
controls. Demonstration and ordinary course presentation profiles differ; the
Woodland course name does not establish a natural presentation profile in every
window. Unknown external CPU/GPU contention remains possible. One native
practice boundary advanced 251 rather than 250 ticks; no clock was adjusted.

Wrappers preserve original functions, arguments, return values and promises.
Measured windows collect aggregates only. Boundary snapshots and provenance
hashing occur outside timing windows. Renderer timing measures CPU command
submission. Nested measurements must not be summed, and recorded observer CPU
is only a lower bound. LoAF/longtask support is feature-detected; neither paired
run observed a qualifying entry starting inside its windows, which does not
establish absence of jank or capture earlier-starting overlapping entries.

The approach follows browser guidance to batch layout reads before writes and
avoid repeated synchronous layout, with no promised performance magnitude:
[layout and layout thrashing](https://web.dev/articles/avoid-large-complex-layouts-and-layout-thrashing).
The optional attribution follows the
[Long Animation Frames API](https://developer.chrome.com/docs/web-platform/long-animation-frames).

## Functional qualification

`functional/qualify-renderers.mjs` is a manual authoring comparison, not added
permanent unit coverage. It parses the two exact committed host files and
executes their actual rendering functions against isolated DOM/size adapters.
The retained native state is only a display seed; synthetic objective flags do
not purport to be reachable flights, completed objectives, or verified proofs.
The comparison, including the final repository-formatted r3 script, passed 456 checks:
68 objective cases and 160 input cases.

Objective coverage includes EN/UK terminal and hold/progress text, all nine actor
tracking hints, ordered/unordered hunt progress and failures, checkpoint and
replay-section wording, and mode-practice prefixes. Input coverage includes
EN/UK, Modes 1–4, five input sources, asymmetric axes, and four widths including
hidden zero-width controls. Results compare exact text, attributes, flags,
transforms and read order; native browser geometry is qualified separately.

`functional/run.mjs` uses public controls in sequential native baseline and
candidate hosts. It covers EN/UK, four viewport widths, compact/expanded/setup
displays, source switching, Acro/Self-level restarts, hunt and actor-track text,
and a genuinely progressed verified demonstration with nonzero recorded stick
displacement. Each recorded transform is compared with that host's actual paused
input and native width, including native dot-center geometry. It also checks
unchanged candidate text-node ownership across paused frames, native paused
state, warnings/errors, and disposal. Source/display switching does not certify
connected radio/controller/touch hardware. Geometry behind Settings is not
advertised as a flight screenshot or pixel comparison.

The initial native fixture `8954` completed all 43 baseline cases, then stopped
when candidate navigation reused the disposed baseline observer before the new
document loaded. Both host records had the same storage prefix and time origin.
The complete failure and original fixture are retained. The corrected immutable
`8955` requires the new document URL, unique storage prefix, undisposed observer,
and shell ownership before continuing. That native run passed 869 checks across
86 cases (43 per variant), with no warnings or errors. All baseline/candidate
static HUD geometry and text comparisons passed; each nonzero recorded-control
case matched its own actual native paused state and width.

## Reproduction

Use Node 22 and absolute paths. Preparers refuse existing output directories and
verify all immutable source hashes before hardlinking assets. Never modify the
linked player files. Root performs the actual native browser run and exports
the complete receipt textarea in bounded chunks.

```sh
node authoring/fpv-worlds/hud-layout/attribution/prepare.mjs ROOT ADMITTED_8DF_PLAYER SOURCE_INVENTORY EXACT_REVISION NEW_OUTPUT
node authoring/fpv-worlds/hud-layout/functional/prepare.mjs BASELINE_SOURCE_FIXTURE CANDIDATE_SOURCE_FIXTURE NEW_OUTPUT
node authoring/fpv-worlds/hud-layout/functional/qualify-renderers.mjs ROOT BASELINE_REVISION CANDIDATE_REVISION NATIVE_8950_RECEIPT NEW_RECEIPT
node authoring/fpv-worlds/hud-layout/functional/prepare-admitted.mjs BASELINE_SOURCE_FIXTURE ADMITTED_PLAYER ADMITTED_INVENTORY EXACT_REVISION NEW_OUTPUT
```

The attribution preparer deliberately requires the exact admitted 8df closure
(102 package members, 95 original inputs) and one declared committed host
overlay. Its other 101 members remain immutable. It is not a generic way to
label arbitrary current source as admitted. The functional preparer retains
both verified fixture inventories and rehashes their complete closures.
The optional admitted preparer retains the historical baseline and verifies a
newly staged candidate's exact revision, tree, 95-input inventory and 102
immutable members. It creates no candidate runtime overlay; committed-source
verification is inherited from the checked admission/staging receipt.

## Integrated admission

Clean candidate `a60d1b27fc83f7dbf03cc61cb76168c7026cbb7b` normally integrates
published main `5bd8f36d7767dcd9dda740865b4d8f19ddbe7c28`. Full Node 22
`npm run validate` passed, including localization and all generated-source
identity checks. The selected existing appearance/radio cases passed 15/15;
the four texture cases initially could not load two sparse-checkout assets.
Restoring their exact tracked 9,133 bytes allowed those unchanged cases to pass
4/4. The initial missing-file result is retained, not called a passing run.
Scoped ESLint, syntax, formatting, and diff checks passed. No new unit cases or
full D6 suite were added or claimed.

The normal optional-package builder admitted all three packages with two
identical builds and committed-input/ZIP-member verification. Worlds contains
102 members and 95 original inputs totaling 16,736,075 bytes, leaving 41,141
bytes under the unchanged 16 MiB original-source ceiling and retaining the
104-file ceiling. Its ZIP is 15,545,985 bytes, SHA-256
`1c6fc014ff6689db7051e2a640f699a24811f06943574fc892c733c2c16bd376`,
package revision
`2fa1e4c7faa6dbaf63d22e044e4679e8eca820e47e954544efcc8b0631a5ea2a`.

All 95 integrated committed inputs match the admitted inventory. The native
qualified host remains byte-identical; 94 inputs also exactly match the source
fixture. The sole other difference is main's lossless `world-visuals.mjs`
projection, independently checked for exact normalized AST, token spelling,
comments and line terminators. This bridge, the full staging inventory, and
all admission receipts are retained. Source browser parity and artifact
admission are distinct evidence; no repeated native package matrix, public
deployment or offline acceptance is implied.

Evidence gzip files are lossless; `evidence/manifest.json` records original and
compressed byte counts and SHA-256 hashes. Full D6 qualification, sustained
hardware performance, physical input devices, all-course playthroughs and
offline behavior are outside this increment.
