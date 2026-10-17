# Earned capture and erosion raster — held native protocol

This closes a coverage gap in the synthetic renderer checks: cache invalidation
must also be inspected after cells change through legal gameplay. The new explicit
`earned-capture-erosion-v1` protocol is prepared for the exact candidate
`cce49c81d82b79aefc24898f32eeebc609e569fb` / tree
`71f7e4cb3b0a39c1d281635774371a693794dd22`. No package identity, workflow release or
native result is declared here. Actual verified production-package readback is
required before a later manifest can admit either browser.

## Fixed legal model

The new `first-fracture-earned-raster.fixture` is 3,425 bytes, SHA-256
`f645e2f2d07571e0a5423ab15ec72f365e5658fea6dc844bb30934411daf119d`.
Its level is byte-value equivalent to the existing accepted normalized First
Fracture fixture and the standard authored mission. Its simulation identity is
`51ae3b099a516de5`. All 17 direction/tick segments come unchanged from the existing
standard/immediate First Fracture clear route, with seed 1 and Scout. No cell,
actor, event, timer or result state is patched.

Node execution of those 3,570 fixed ticks reaches the existing won checkpoint
`4e10c76cdb1ad249` and strict public replay match. The complete route produces
five closures (12, 520, 714, 441 and 98 cells), three erosion events and four
erosion warnings. It never subsequently recaptures an eroded cell: **repair is
unobserved for this route**, not passed. The authoritative run states selected
for native comparison are:

| Stage                                   | Tick | Checkpoint         |
| --------------------------------------- | ---: | ------------------ |
| Initial                                 |    0 | `1a2d0faf53398b0a` |
| Immediately before the 520-cell capture |  605 | `8d9c4d5c2ee4ff1b` |
| After the 520-cell capture              |  606 | `ab2c5bb9da4cbeff` |
| First erosion warning                   | 1213 | `9073a37c1eed5f46` |
| After actual erosion of cell 611        | 1273 | `32408d538f72e813` |
| Later 714-cell capture                  | 1806 | `0a44b69b5a02cfdf` |
| Final won state                         | 3570 | `4e10c76cdb1ad249` |

The same serialized protocol body exercises the model in Node contracts and the
source-native core/replay modules in the browser. Node tests are model/admission
evidence only. Every selected checkpoint, mechanic count and final replay must
match before native painting begins. The exported replay and proof are retained.

## Native comparisons and boundaries

For each full/reduced/minimal tier, replay the legal route into one live run and
keep two painters populated across all seven selected transitions. They use two
opaque, distinctly colored original images. Each painter and its run preserve
identity; no manual invalidate/reset occurs. At each stage compare the populated
painters to rebuilt-cache controls with matched presentation history, including
an independent identical-input repeat and a zero-dt stability check. Each control
replays the same legal run and the same two draws at every preceding selected
stage, then calls existing `invalidate()` only on its own caches before the
target draws. The populated subject owners never invalidate or reset. All draws use paused presentation at time
zero, fixed signal-off settings, the same procedural actors and 1,200 × 600
framebuffer. The host context remains 400 × 850 CSS pixels / DPR 3. Functional
erosion warnings remain part of the native state and drawing.

Require exact equality of all channels for the rebuilt/repeat/populated controls.
Concealed cell interiors must have zero image-dependent differences, with over
1,000 sampled pixels. After any earned capture, the exposed region must have
over 1,000 pixels and more than half must differ between the two originals. The
initial state has no earned exposed-picture requirement. These positive controls
prevent an empty or uniformly concealed rendering from passing. Any control
difference makes concealment unobserved and fails the row; no one-channel or
one-pixel tolerance is admitted.

Each passing row retains both colored-image PNGs. At the first failing row,
retain PNG and raw RGBA for all six comparator frames, then stop and explicitly
mark the remaining planned rows unobserved. This bounds failure evidence without
turning omitted comparisons into passes. Up to 48 PNGs and six raw comparators
fit the existing 64 MiB raster-output allowance; each raw comparator is exactly
2,880,000 bytes. The replay is at most 1 MiB and shares that output allowance.
The existing 128 MiB row / 256 MiB helper evidence limits and 120-second native
observation / 20-minute row-command deadlines remain unchanged. No retries.

The protocol records at most 80 painter identities, 160 destination surfaces and
1,024 layer-canvas factory identities. These are bounded test-owned identity
counts, not production instrumentation or a complete browser/GPU memory census.
Disposed controls release their canvases. There is no prototype interception or
forced rendering backend. Optional actor catalogues remain explicitly procedural,
as in the original raster controls; shipped artwork equivalence is separate.

The existing hosted adapter/observer continues to verify the exact production
archive, source responses, CSP, process/context/server closure and frozen tool
inputs. The new protocol requires its own frozen helper and fixture. The default
synthetic protocol bodies, prior artifacts, failed historical macOS pixel control
and timing gates remain unchanged. All outcomes are correctness diagnostics;
physical iPhone/Steam Deck, thermal, performance and general human-play validation
remain separate.

## Rejected control and causal correction

Before any native execution, source inspection and an actual Node actor-projection
control showed that a brand-new painter was not presentation-equivalent. Paused
actors retain their prior heading, while a new owner initializes from current
velocity. At warning tick 1213, for example, cutter heading was 4.71238898038469
in the historical owner and 1.5707963267948966 in the new owner; keeper headings
were 0.7853981633974483 and 3.9269908169872414. This is a rejected proposed
comparison, **not a renderer failure**.

The corrected control replays the exact prior stage draws on its own legal run
before rebuilding its caches. Existing `BoardPainter.invalidate()` clears cached
layers, prepared pictures, adapters, ground and filters but preserves actor
presentation history. Per-row evidence records the preceding draw counts and
control-only invalidation; the adapter rejects mismatches or any subject reset.
A projection regression proves both the original mismatch and exact equality of
all actor-frame values with matched history, with unchanged authoritative
checkpoints. Pixel tolerances, stages, route and observation deadlines are unchanged.
