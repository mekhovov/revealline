# Spatial review source loading

2026-09-21. Technical performance follow-up to the [combined review edition](journey-whole-spatial-review.md), not public deployment or P15 acceptance.

## Change and integrity boundary

The browser previously assembled and repeatedly validated several candidate
studies before producing the combined authored project. That canonical composer
now lives in `scripts/lib/whole-spatial-source.mjs`. The runtime factory parses
an authored JSON snapshot and still passes it through the ordinary shared
compiler. No runtime manifest, compiler ownership token, cache or validation
bypass is serialized. Each factory call owns a fresh editable source.

`node scripts/generate-whole-spatial.mjs --write` mechanically regenerates both
greybox and original-picture sources after fully composing and validating them.
The default command/`--check` compares exact bytes without writing. Build and
preflight invoke the selected source tree's checker, not a newer checkout's
composer. Historical trees without the artifact remain buildable. Stale data
fails before staging can replace an existing playable distribution.

The generated module adds 471,068 bytes. Its SHA-256 is
`c198c2fbced55f49e71034a4c210a4681f232cde98a7db746c7b60430c2adfb0`.
Loose files, stored ZIP entry bytes and offline integrity inventory agree. The
64 MiB offline and 950 MiB Pages guards are unchanged; full release capacity must
still be checked by the release owner.

## Measurements and verification

Separate local Node 20.19.5 processes measured the original-picture factory at
4,443 ms before and 0.63 ms after. Source JSON length remained 228,435 characters.
The normal compiler still took approximately 1.1 seconds; this change does not
remove that validation cost. These are bounded local measurements, not browser
download, warm Continue, Next-to-control or low-end-device benchmarks.

The previous 87-test integration cohort, six new snapshot tests and 27 existing
CLI/build tests pass on Node 20.19.5 and 22.22.2: 120 tests per runtime. This
includes 996 exact runtime projections across both artwork variants, all 83
missions, three presets and Solo/Versus. Snapshot tests also compare both full
authored sources against independent canonical composition, preserve fresh draft
ownership, reject invalid source through the compiler, inspect data-only exports,
verify selected-root read-only checking, and prove same-size corruption cannot
replace the prior ZIP. A separate concurrent-edit fixture proves packaging rejects
bytes changed after validation and preserves the previous playable distribution.
Lint, formatting and diff checks pass.

Independent review additionally compared both snapshots to the actual committed
pre-change factory, not only the moved composer. It found the validation-to-read
race, verified the repair and reran all six snapshot tests on Node 20 plus all
27 CLI tests on both runtimes. No remaining blocker was found for this bounded
packet; this is technical review, not human qualification.

An initial CLI run lacked the excluded `night-shift.json` copy fixture. Restoring
that absent tracked file unchanged from this worktree's HEAD made all 27 existing
CLI tests pass. Other sparse content/media reads retain the exact read-only Git
fallback described in the combined-edition report. This is not a full release
build from a populated source tree.

Native localhost Studio reload and Inspect compiled all 83 missions without the
previous command timeout or applying a new draft. Actual Solo reload retained
the scoped Continue position; one Continue restored the unfinished Two Keepers
flight with target 60%, zero earned score and three lives. It was left paused.
This check confirms the observed resume flow, not a precise latency threshold.

## Remaining

Release integration, PR/version/immutable artifact/Pages promotion, total release
size, real-device loading and warm transitions remain open. Human difficulty,
capture understanding, enjoyment, controller/accessibility qualification and the
rest of P00–P15 are not closed by this optimization. Mission rules, candidate
count, historical routes, progress identities and artwork pins do not change.
