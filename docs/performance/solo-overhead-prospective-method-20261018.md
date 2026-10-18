# Prospective overhead interval method

The pure assessors now accept the explicit manifest field
`analysisMethod: "paired-p95-endpoint-box-v1"`. With that field absent, their original
calculations, report fields and verdicts remain unchanged. Unknown method names reject;
the prospective method requires all ten declared pairs. No workflow selects it yet.
Executed declarations and historical results remain unchanged.

This is a **conditional clock-error sensitivity calculation**, not a measured overhead
pass. The observed minimum positive clock step is assumed to bound duration error; it
is not a demonstrated bound on browser privacy jitter. Normal browser policy, raw p95,
the 5% threshold, workloads and existing source, quality, replay, failure and inventory
gates are unchanged. Journal scope still excludes observer registration/delivery, drain
and export, GPU work and total browser CPU.

The journal assessor uses each validated window's recorded endpoint count, including
quantized-zero hooks and the active tail assigned to the final window. It computes
nearest-rank p95 independently over the lower and upper duration bounds, allowing sample
ranks to change. App diagnostics retain their existing per-duration error assumption.
Each matched pair then supplies a log-ratio interval. The upper Student-t endpoint is
convex and the lower endpoint is concave, so their extrema over the interval box occur
at vertices. All 1,024 vertices of the ten-pair box are evaluated; timestamp errors need
not be independent. This removes conservative algebraic slack, not observed failures.

Pure Node controls pass **100/100** on Node20.19.5. They include independent exhaustive
small-box comparisons, an eleven-count closed-form check for ten equal intervals,
rank reordering, scale invariance, monotonic widening, zero hooks, actual probe-produced
tail/count evidence, incomplete/censored reports, quality mismatch, raw failures and
unknown method rejection. Exact default synthetic report hashes match the pre-change
app and journal outputs. The automatic changed-test entry point also imports both
complete existing analyzer contracts. Scoped lint, formatting and diff checks pass;
all seven changed code/test inputs and seventeen recorded loaded paths stayed stable.

Original-assessor controls retain five expected missing-method failures. The broader
compatibility check also exposed an existing extracted-qualifier fixture missing its
default-off `qualityOptions`; that failure is retained, and the fixture now explicitly
supplies `null`. No production qualifier behavior changed.

Exact source hashes, original failures, complete TAP, commands and read-only math peer
review are recorded under
`.cache/solo-followup/overhead-method-prospective-20261018/`, principally `review.json`
and `final-v2-controls.json`. No native observation or historical cohort was reassessed.
Any future sparse consumer must include `scripts/solo-overhead-interval.mjs` and bind
the method prospectively before execution. If normal clock precision still cannot
establish the unchanged 5% bound, the gate remains unresolved.
