# Measurement resolution and the remaining overhead gate

The existing overhead verdicts remain unresolved. Reviewing their analyzers explains why repeating the same twenty arms can remain inconclusive even after application work improves. This is a measurement limitation, not evidence that diagnostics are free or expensive.

The Chromium application comparison retains nine admissible pairs, one quality mismatch and its original +1.26% point estimate with a −7.51% to +10.87% conservative interval. WebKit retains zero admissible pairs, early reduction and one interrupted arm. The separate journal comparison retains all raw performance failures and endpoint uncertainty. No row is relabeled here. [Original results](solo-final-native-progress-20261017.md).

For ten hypothetical identical matched pairs, zero sample variance and equal on/off p95 `p`, the current conservative sensitivity calculation alone gives an upper relative bound of `((p + e) / (p - e)) ** (1 + 2.263 / 3) - 1`. Application diagnostics use the observed clock step for `e`; journal envelopes account for every measured endpoint. This algebra assumes the analyzers' declared duration-error model and is not a stronger guarantee about browser privacy jitter.

| Hypothetical equal-arm example              | Error allowance `e` | Upper sensitivity bound, before any sample variance |
| ------------------------------------------- | ------------------- | --------------------------------------------------- |
| Application p95 6.3 ms                      | 0.1 ms              | +5.73%                                              |
| Application p95 3 ms                        | 0.1 ms              | +12.41%                                             |
| Journal envelope p95 3 ms, twelve endpoints | 1.2 ms              | +342.13%                                            |

These are calculations, not new browser observations. At ten pairs the equal-arm p95 must exceed approximately `71.918 × e` for this sensitivity term alone to fall below 5%. Unequal observed arms can yield different bounds; this is not a general impossibility proof. More frames do not remove this systematic allowance, and frames are not independent experimental repetitions.

Before commissioning another full overhead cohort, review the declared method's resolving power against the source-bound pilot's work and clock precision. Keep ordinary security/timer settings. Do not add CPU load, disable adaptation, replace p95 with a total/mean, discard failed pairs, or increase repetitions after looking at results to manufacture a pass. If normal precision cannot establish the bound, retain the unresolved gate and collect a separately scoped diagnostic only when it can answer a concrete question. Any future measurement method needs a prospective declaration and independent validation; old results keep their old method.

The W3C High Resolution Time specification permits coarsening and jitter and does not guarantee submillisecond precision. Its clock example shows why coarse timestamps can distort frame-rate estimates. NIST's paired-observation example supports analyzing differences between matched experimental units rather than treating all frame samples as independent runs. [High Resolution Time](https://www.w3.org/TR/hr-time-3/#dfn-coarsen-time), [paired observations](https://www.itl.nist.gov/div898/handbook/prc/section3/prc311.htm).

The calculation and hashes of both exact analyzers and the three retained analyses are in `.cache/solo-followup/overhead-resolution-review/analysis.json`. No runtime, analyzer, threshold, workflow, timer configuration or historical evidence changes in this review.
