# Eager Solo source audit — 17 October 2026

The existing static module inventory parses imports without evaluating game code.
Node 22.22.2 inspected two exact Git revisions; it did not launch a browser or
build a package. Counts cover static JavaScript dependencies reachable from
`game/app.mjs`. They exclude later dynamic imports, HTML resources and compressed
network transfer, and do not measure parsing, evaluation or gameplay time.

| Exact source                                               | Eager modules | UTF-8 source bytes |
| ---------------------------------------------------------- | ------------: | -----------------: |
| Main comparison `8b01991942dc764b8aa4726851699ce1985e53ae` |           654 |          8,415,591 |
| Candidate `cce49c81d82b79aefc24898f32eeebc609e569fb`       |           583 |          7,982,700 |

The reduction is 71 modules and 432,891 source bytes. The candidate also includes
the documented later main integration, so this comparison does not isolate an
individual optimization. It grants no native startup or performance pass.

The largest remaining static dependency is generated localization (1,265,063
bytes), followed by the main app (590,775), industrial environment data (422,824)
and the generated content registry (356,931). Optional surfaces still reachable
statically include the soundtrack panel (150,675), library panel (78,515), mission
browser (50,153) and optional-chapter panel (46,070). These byte counts identify
further inspection targets, not measured causes of the reported device stalls.

A separate local kernel executes only the frozen generated translation bundle
in three fresh Node VM contexts within one process. Evaluation takes 133.39,
120.82 and 132.93 ms; first compilation takes 1.62 ms and subsequent compilations
reuse process-level engine state. The generated module synchronously decompresses
and parses the complete translation resources before bootstrap. This identifies
a startup computation worth native profiling, not a reproduced gameplay hitch:
eager evaluation precedes application setup, and the probe includes neither
browser scheduling nor transport. Do not shift deferred translation work into
the first active frame or change required localization/recovery behavior on
this local evidence alone. The raw kernel output and source/helper hashes are
retained separately in the same receipt.

Any later deferral must preserve trusted audio activation, shared owners,
controller/menu access and error recovery. A dynamic import started during
preparation can finish during play; moving an import alone is insufficient.
Keep required evaluation inside preparation or an explicitly open paused menu,
and measure the resulting production startup separately. Do not revise the
current frozen package's source identity or reinterpret earlier observations.

Two primary-source examples refine this decision. Chrome's script-evaluation
guidance explains that a large dynamic import still creates a large evaluation
task; making its network request asynchronous does not make evaluation free.
Keep optional menu evaluation behind the accepted pause boundary, with required
startup work completed before play. [Script evaluation and long tasks](https://web.dev/articles/script-evaluation-and-long-tasks).
WebKit's Speedometer work found that allocations in one workload can cause
collection during a later workload. Removing the unreachable chooser therefore
eliminates unnecessary allocation and ownership, but a stopwatch around its
constructor alone cannot establish its full cost. Preserve startup and subsequent
active-play observations in the matched runs; do not force garbage collection or
discard early frames to make the comparison cleaner.
[WebKit allocation and collection findings](https://webkit.org/blog/15249/).

Raw outputs and helper hashes are retained under
`.cache/solo-followup/eager-graph-cce/receipt.json`. Both main inventory outputs
are 1,352 bytes: baseline SHA-256
`e30564b43042f5df4509b484befeff45cd62ba8ae9fda0346d6777bcb69e079d`,
candidate SHA-256
`d1aa6c0c1d1f5dee25c2932493be222e16f6e8271c5ecf96a68a3d0ee88be964`.
The separate detail output lists the largest files and design/studio dependencies.

## Current packaged-source boundary: ab45

The same read-only inventory on exact `ab45bfde5d54d612cbba9b038a46f13d13f417ec`
finds 584 eager Solo modules and 7,969,834 UTF-8 source bytes, compared with
654 and 8,415,591 at the fixed 8b baseline. This is 70 fewer modules and
445,757 fewer source bytes across all intervening changes, not an isolated
optimization result or a measured transfer/startup improvement. Its 1,352-byte
output has SHA-256 `fa2dbd8419c226247b87cbe9b571267b998eb268028274e29b681b97dd25a5f2`,
retained as `.cache/solo-followup/readiness-eager-ab45.json`; no module was evaluated.

Review of the remaining imports does not justify moving them into the first
active frame. In particular, soundtrack-panel attachment also owns persisted
online sources and playback settings; the library panel also owns gallery,
backup, export, cancellation and recovery callbacks used before opening.
These boundaries require an ownership extraction before any further deferral.
The current runtime completes required evaluation before play and defers the
proved unnecessary constructions. Preserve this boundary while measuring ab45;
a blind dynamic-import replacement would not satisfy preparation or user-gesture
requirements. This is a recorded tradeoff, not a claim that every remaining
static module is essential or that startup qualification is complete.
