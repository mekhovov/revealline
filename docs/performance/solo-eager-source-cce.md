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

Raw outputs and helper hashes are retained under
`.cache/solo-followup/eager-graph-cce/receipt.json`. Both main inventory outputs
are 1,352 bytes: baseline SHA-256
`e30564b43042f5df4509b484befeff45cd62ba8ae9fda0346d6777bcb69e079d`,
candidate SHA-256
`d1aa6c0c1d1f5dee25c2932493be222e16f6e8271c5ecf96a68a3d0ee88be964`.
The separate detail output lists the largest files and design/studio dependencies.
