# Propulsion evidence: bounded bench-data increment

`PropulsionEvidence.v1` stores observations and evaluates one documented path through a bench test. It does not change any aircraft, controller, recording identity or default preset. A static component test is not whole-aircraft flight validation.

## Command × voltage surfaces: non-activating numerical prerequisite

`propulsion-surface.mjs` adds `PropulsionSurface.v1` as a separate source API. It
composes original `PropulsionEvidence.v1` voltage paths without changing their
format, validators or behavior. It is deliberately **not imported by the game,
inspector, aircraft catalog or worker**, and does not add a packaged runtime
module. R6 remains open: this supplies bounded interpolation and bench-load
arithmetic, not measured aircraft fitting, flight activation or fidelity evidence.

A surface requires exactly `format`, `id`, `name`, `currentBasis`, `paths`, and
`cells`. The identifier and name follow the original evidence limits.
`currentBasis` is explicitly `dc-input-at-recorded-voltage`, `phase-current`, or
`unknown`; the declaration is not verification of measurement topology. Each
path retains its own complete source, license, original units, uncertainty and
samples. All paths must explicitly identify the same motor, propeller, ESC, ESC
firmware and control protocol, with no unknown component fields. Their complete
conditions objects must match, including unknown values and notes; the API does
not infer equivalent test conditions or correct density or installation effects.

Each path must use voltage as its one-dimensional axis, with one fixed observed
command. Paths are ordered by strictly increasing **canonical** command. Percent
and normalized commands are compatible; microseconds remain microseconds and
cannot be mixed with normalized command. Source RPM is an observed output, never
inferred from command. The common voltage axis is the sorted union of all
canonical sample voltages in volts. Import limits are 256 KiB, 2–16 paths, 256
samples in total and 1–256 declared cells, with bounded nesting and strings.

Each cell is `[commandIndex, voltageIndex]`: it joins the adjacent command paths
and adjacent voltage knots at those indexes. Cells must be unique and sorted by
command index, then voltage index. All four corners must be original observations,
and both voltage edges must lie within declared continuous path intervals. A cell
cannot span a missing corner, intermediate grid knot or path coverage gap.
Undeclared cells remain holes. Original one-dimensional path coverage is also
available when the requested command exactly equals that path's command; this
does not create coverage between paths.

```js
import {
  validatePropulsionSurface,
  createPropulsionSurfaceEvaluator,
  solvePropulsionSurfaceLoad,
} from '../optional-practice/civilian-fpv/propulsion-surface.mjs';

const surface = validatePropulsionSurface(suppliedSurfaceJson);
const evaluator = createPropulsionSurfaceEvaluator(surface);
const point = evaluator.evaluate({ command: 0.375, voltage: 12 });
const load = solvePropulsionSurfaceLoad({
  loads: [{ surface, command: 0.375 }],
  openVoltage: 12.6,
  resistance: 0.1,
  currentLimit: null,
});
// The query and battery numbers above illustrate API units only, not a dataset,
// suitable aircraft settings, or a claim that this operating point is covered.
```

Evaluation uses deterministic bilinear arithmetic inside admitted cells, with
exact source knots and linear voltage-path interpolation at exact path commands.
Shared edges are closed; the first sorted cell wins on a shared voltage edge.
There is **no epsilon, snapping, triangulation or extrapolation**. A representable
coordinate just beyond the last covered cell remains unavailable, even when it
differs by only one floating-point step. An uncovered query returns
`outside-coverage`, `outside-domain` or `coverage-gap`, with no fabricated values.
Missing channels or uncertainties remain unavailable when a contributing endpoint
is missing; endpoints with zero interpolation weight do not mask an exact edge.

The evaluator exposes frozen source data, canonical axes/units, a local content
identity and diagnostics. Results are detached and retain each contributing
path's source declaration. Exact samples use `resultKind: 'source-sample'`;
interpolation uses `calculated`. Neither label verifies a supplied `measured`
declaration. Interpolated uncertainty values describe only endpoint interpolation,
not model error or propagated confidence. Different uncertainty declarations are
not blended; the result reports unavailable uncertainty and retains both source
interpretations. Negative and nonmonotonic readings are
preserved and diagnosed. Electrical power and efficiency remain unavailable for
phase or unknown current basis; shaft power can still be calculated from supplied
RPM and torque.

`solvePropulsionSurfaceLoad` accepts one to four independently specified commands
and manual ideal-battery inputs. It makes a covered voltage slice at each command
and delegates to the existing load kernel. An exact command keeps its original
path; an interpolated command produces a **calculated** slice with no propagated
uncertainty and no inferred redistribution permission. Original source metadata
remains in the wrapper's `sources`; `sliceKinds` distinguishes these two cases.
Surface and electrical-input identities remain bound to the result.

Sparse surfaces can produce more than the original path format's 32 intervals.
The surface load adapter intersects complete coverage, then delegates bounded
windows in order without changing that older limit. Only oversized calculated
slices are restricted to their containing covered interval; original paths stay
intact. `commonIntervals` records the complete common coverage, while
`loadCoverage: 'bounded-window'` identifies a retained delegated window in `load`.
The wrapper's status/reason describes the complete surface coverage; the nested
load receipt describes its own window. A root below a later window is therefore
reported as a coverage gap by the wrapper. Empty common coverage returns an
unavailable result without delegation. Source eligibility is checked before
window selection, so narrowing cannot hide missing current or unknown airspeed.

Unknown/phase current, missing or negative current, nonmonotonic source voltage
current, unsupported flow/scope, coverage holes and inadequate numerical
resolution return explicit unavailable results. Nonmonotonic source current
cannot become eligible through averaging with another path. The existing kernel
retains its static single-rotor/known-zero-airspeed requirement, common terminal
voltage, finite circuit-residual check and diagnostic-only current limit. There
is no current regulation, discharge simulation, interaction model, automatic
fit, physical-parameter write or new default preset.

Validation uses explicitly invented analytic surfaces, not reference-aircraft
data: dense bilinear checks, exact and adjacent floating-point edges, sparse
coverage, missing corners/channels, incompatible components/conditions, units,
nonmonotonic readings, current basis, independently solved circuit equations,
immutable provenance, parser bounds and unchanged original path/load tests.
Run `node --test game/test/fpv-aircraft-propulsion-surface.test.mjs
game/test/fpv-aircraft-propulsion-evidence.test.mjs
game/test/fpv-aircraft-propulsion-load.test.mjs`.

On 19 October 2026, Node 22.22.2 passed **50/50** focused checks: 20 new surface
checks and the 30 existing path/load checks. ESLint, scoped JavaScript/test
Prettier and `git diff --check` also passed. The new source module remains outside
the runtime dependency graph; no package, browser, device or physical-fidelity
qualification is claimed by this receipt.

Independent review identified two boundaries after that initial receipt: valid
64-interval slices exceeded the older delegated format's 32-interval limit, and
interpolated RPM/torque could violate the power bound even when both original
samples passed it. The bounded-window adapter above fixes the first issue. The
evaluator now diagnoses its final interpolated values, retaining negative or
power-inconsistent readings without clamping; phase/unknown current still cannot
produce an electrical-power comparison. Two new regressions fail on the original
implementation and pass after these repairs. The updated focused suite passes
**52/52** on Node 22.22.2, including early/late/endpoint roots across 64 disjoint
cells, coverage gaps, touching and disjoint windows, mixed source units, diagnostic
current limits and interpolated power. No runtime or original 1D format changed.

## Static quad forward adapter: non-activating preparation

`propulsion-quad.mjs` exports `evaluateStaticQuadPropulsion()` and introduces
`StaticQuadPropulsion.v1` input and `StaticQuadPropulsionResult.v1` output. It
connects four independently specified surfaces to a declared rotor layout and
calculates a steady body force/torque at their common battery operating point.
It remains **outside the game, inspector, controller, catalog and worker import
graphs**. No package admission, existing format, physical identity, saved setup,
recording or backend behavior changes.

The input requires all of these declarations; there are no implicit frame,
command-unit or torque interpretations:

- `format: 'StaticQuadPropulsion.v1'`.
- `frame: 'body-x-right-y-up-z-rear-origin-com'`, with positions relative to COM.
- `thrustAxis: 'positive-y'`: all four thrust vectors are parallel to body +y.
- `torqueBasis: 'steady-shaft-reaction-magnitude'`. This is a caller declaration,
  not verification that the measurement instrument recorded propeller reaction
  torque. It does not convert electromagnetic or transient motor torque.
- `units`: exactly `position: 'm'`, `force: 'N'`, `torque: 'N*m'`, `voltage: 'V'`,
  `current: 'A'`, and `resistance: 'ohm'`. Surface samples retain their original
  declared units and use the existing canonical conversion.
- `battery`: explicit `openVoltage`, `resistance`, and nullable `currentLimit`.
- `rotors`: exactly four records, in caller-supplied order. Each has a unique
  stable `id`, `position: {x, y, z}` bounded to ±2 m, `reactionDirection` of +1
  or −1, `command: {value, unit}`, and a complete `PropulsionSurface.v1` object.
  Reaction direction is the sign of body-y torque, not an inferred CW/CCW label.
  Command units must equal that surface's canonical `normalized` or `us` unit.
  Microseconds are never converted to normalized motor speed or RPM.

The boundary accepts bounded JSON data, copies it without invoking getters or
functions, and reconstructs all evaluators. Four original surface limits remain
in force, with a combined 1 MiB plus 4 KiB envelope. Input identifiers/order,
geometry, declarations, commands, battery inputs and surface identities bind the
result identity. Returned inputs, source receipts and calculated values are
recursively frozen and independent of subsequent caller edits.

The adapter first delegates the electrical calculation to
`solvePropulsionSurfaceLoad()`, retaining its current-basis, static single-rotor,
known-zero-airspeed, coverage, monotonic-current and numerical-resolution rules.
The adapter compares declared air density, temperature, pressure, humidity and
installation across the four surfaces. Two different known values make the
combined wrench unavailable; there is no normalization or equivalence inference.
Null values remain explicit `unknown-rotor-conditions` warnings and
`partially-unknown` environment status, including when all four values are
unknown. Equal known declarations are not independently verified conditions.
Mixed motor/propeller/ESC sets remain supported, and descriptive notes are inert.
The load receipt is retained even when these composition checks reject a wrench.

Every rotor is then evaluated at that same voltage. RPM, thrust, torque and
current must all be available and nonnegative at the operating point. Missing
or negative admitted channels, an unavailable coordinate, or the existing
shaft-power inconsistency diagnostic return `status: 'unavailable'` with no
`wrench` or aggregate `power`. Available point data and original load/source
receipts remain visible; evidence is neither clamped nor relabeled as measured.
Invalid source values rejected by the original validators remain input errors.
This operating-point check does not qualify all other points in a source dataset.

For supported points the body wrench, in N and N·m, is:

```text
force = (0, Σ thrust, 0)
torque = (−Σ position.z × thrust,
           Σ reactionDirection × reactionTorque,
           Σ position.x × thrust)
```

These are body coordinates, not the controller's signed roll/pitch/yaw axes.
The result retains per-rotor values and exposes supply, terminal electrical,
series-resistance loss and summed shaft power in watts. A current-limit excess
remains `limit-exceeded` with the original unregulated commands and wrench; it
is diagnostic data, not current limiting or permission to fly. Every result has
`resultKind: 'calculated'` and `flightEligible: false`, including successful ones.

The model has no motor transients, battery state/discharge, extra electronic
loads, wiring asymmetry, rotor interaction, advancing flow, drag, gravity,
collision or geometry-feasibility validation. It performs no inverse allocation
and does not choose or alter commands. The existing flight controller produces
normalized motor-speed requests, applies lag and uses an analytic electrical
model. Connecting these source-command surfaces to that controller requires a
separate versioned command mapping, allocator, achieved-torque feedback and
transient policy; this adapter does not supply those decisions.

Focused tests use invented affine current and bilinear rotor channels. Independent
closed-form battery-voltage, vector cross-product and power-balance oracles cover
symmetric and asymmetric layouts/commands, each rotor's reaction direction,
reordering, declared command units, known-condition conflicts and unknowns,
coverage gaps, limits, missing/negative
channels, inconsistent power, parser bounds and immutable inputs/results. They
establish numerical composition, not measured aircraft behavior or runtime
performance. Run the new suite alongside the unchanged surface/path/load suites:

```sh
node --test --test-concurrency=1 game/test/fpv-aircraft-propulsion-quad.test.mjs game/test/fpv-aircraft-propulsion-surface.test.mjs game/test/fpv-aircraft-propulsion-load.test.mjs game/test/fpv-aircraft-propulsion-evidence.test.mjs
```

On 19 October 2026, Node 20.19.5 passed **64/64** focused checks: twelve adapter
checks plus the unchanged 52 surface/path/load checks. Scoped ESLint, Prettier and
`git diff --check` pass. Composition review identified that the initial adapter
could combine conflicting known environmental declarations; the targeted negative
reproduces that result before the guard and passes afterward. No game build,
rendered acceptance, measured fitting or flight qualification is claimed.

## Local fixed-voltage inverse: non-activating preparation

`propulsion-inverse.mjs` exports `solveStaticQuadCommandCell()`. Its
`StaticQuadInverse.v1` input and `StaticQuadInverseResult.v1` result add a bounded
inverse to the static quad adapter. Given a requested body wrench, an ideal
fixed terminal voltage and **one explicitly selected admitted cell per rotor**,
it solves for the four ESC commands within those cells. This is a local numerical
calculation, not a global allocator or an aircraft tune. It remains outside all
live game, controller, catalog, inspector and worker imports and adds no packaged
runtime module. No existing format or flight behavior changes.

The input declares `format`, `frame`, `thrustAxis`, `torqueBasis`, `units`,
`supply`, `rotors` and `target`, with no optional or inferred fields:

- Frame, thrust axis, torque basis and all six SI units are exactly those of
  `StaticQuadPropulsion.v1` above. Positions are already relative to COM; they
  must not have the center-of-mass offset subtracted a second time.
- `supply` is exactly `{kind: 'ideal-fixed-terminal-voltage', voltage}` in volts.
  There is no battery-sag solve, current-limit policy or battery state in this
  inverse. Its forward check explicitly uses that voltage and zero series
  resistance; these are declared ideal-supply assumptions, not estimated battery
  properties.
- Exactly four `rotors` each contain `id`, `position`, `reactionDirection`,
  `commandUnit`, `cell` and the complete original `surface`. `cell` is its
  `[commandIndex, voltageIndex]` and must be a member of that surface's declared
  cells. The voltage must fall inside that cell's closed voltage interval.
  Covered exact-command paths cannot fill an undeclared cell. `commandUnit`
  must be the surface's canonical `normalized` or `us` unit. Different rotors
  may use different command units and components.
- `target` contains `force: {x,y,z}` in newtons and `torque: {x,y,z}` in N·m,
  using the declared body frame. Lateral force requests are unavailable because
  every rotor thrust is parallel to +y. Signed torque requests are supported;
  negative collective force is unavailable. These are not pilot roll/pitch/yaw
  fields. The existing controller convention is `roll=-bodyTorque.z`,
  `pitch=-bodyTorque.x`, `yaw=-bodyTorque.y`.

At a fixed voltage inside one admitted cell, thrust and reaction torque are
affine in the same command fraction `u`, with `0 ≤ u ≤ 1`. For each rotor, the
matrix column in `[force.y, torque.x, torque.y, torque.z]` order is:

```text
[Δthrust, −position.z × Δthrust,
 reactionDirection × ΔreactionTorque, position.x × Δthrust]
```

The offset is the wrench at all four lower command bounds. A deterministic 4×4
partial-pivot solve maps the requested wrench minus that offset to the four
fractions. Each rotor uses its own thrust and reaction-torque slopes; no common
torque/thrust ratio is substituted. Flat or decreasing thrust within the chosen
cell is unavailable. This conservative restriction does not modify the original
surface or claim that its other cells are invertible.

The versioned numerical policy uses fixed **1 N** and **1 N·m** output scales,
not per-row normalization that could conceal weak yaw or small-arm authority.
It rejects zero pivots, pivots no larger than `64 × Number.EPSILON` times the
original matrix infinity norm, nonfinite arithmetic and an estimated infinity
condition number above **10⁸**. This is a numerical eligibility rule, not a
measurement-accuracy claim. A singular or poorly resolved matrix produces no
usable commands.

Cell coordinates and voltage bounds have **no tolerance, clipping, snapping or
extrapolation**. An outside solution returns `outside-selected-command-cells`;
this does not claim the request is impossible in some other cells. Representing
a solved fraction in the surface's command unit must reconstruct that fraction
within `64 × Number.EPSILON`; otherwise the result is `command-resolution`.
An interval whose adjacent floating-point commands cannot represent the required
interior value therefore cannot silently collapse to a boundary.

Both cell endpoints and the final candidate pass through the existing static
quad adapter. Its source eligibility, missing-channel, current-basis, static-flow,
environment-conflict, negative-reading and power-consistency checks remain in
force. Checking only the endpoints is insufficient: interpolated RPM × torque
can exceed electrical power even when endpoint values do not. The final check
also requires exactly the declared terminal voltage and independently evaluates
the resulting force and torque. Residual limits are **10⁻⁹ N** for collective
force and **10⁻¹¹ N·m** per torque axis, plus **10⁻¹⁰ × max(|requested|,
|achieved|)** in the same units. Zero and near-zero requests are never used as
divisors. These arithmetic tolerances do not qualify the source measurements.

Results retain the input declaration, selected windows, original source receipts,
matrix/offset, condition estimate, available candidate fractions, forward receipt
and residuals. Top-level `sources` retains the lower-endpoint load receipts,
explicitly labeled `sourceReceiptContext: 'lower-command-endpoints'`; its
`command` fields describe those endpoints, not the allocated commands. The
final candidate's receipts remain under `forward`. `commands` is populated only
after all gates pass. Returned data
is detached and frozen; its identity includes the source content identities,
geometry, voltage, target, cells and numerical policy. Every result remains
`resultKind: 'calculated'` and `flightEligible: false`.

This increment does not interpret an ESC command as normalized motor speed or
RPM. It does not use `allocateAircraftThrust()`, whose existing flight model has
a different command domain and allocation policy. The domain selector below
adds a bounded search across declared cells. Choosing among multiple solutions,
desaturation/axis priorities, coupled
battery-sag inversion, armed idle/Airmode, motor transients, actual achieved-torque
feedback and versioned runtime integration remain separate work. The absence of
matched motor/propeller measurements still prevents a measured-fidelity claim.

The new synthetic suite covers independently solved symmetric moments,
asymmetric layouts and nonconstant torque/thrust ratios, mixed command units,
negative requests, singular and weak-axis matrices, exact/adjacent boundaries,
coverage holes, command resolution, missing evidence, environment conflicts,
interior power failures, near-zero residuals, bounded input and immutable
provenance. Run it with all four existing propulsion suites:

```sh
node --test --test-concurrency=1 game/test/fpv-aircraft-propulsion-inverse.test.mjs game/test/fpv-aircraft-propulsion-quad.test.mjs game/test/fpv-aircraft-propulsion-surface.test.mjs game/test/fpv-aircraft-propulsion-load.test.mjs game/test/fpv-aircraft-propulsion-evidence.test.mjs
```

On 19 October 2026, Node 20.19.5 passed **80/80** focused checks: sixteen inverse
checks and the unchanged sixty-four quad/surface/load/path checks. Scoped ESLint,
JavaScript/test Prettier and `git diff --check` pass. Independent review reproduced
the sixteen new checks and confirmed the signed vector construction, command-cell
limits and forward checks. That review also prompted the explicit lower-endpoint
source-receipt label above. This receipt establishes source-level numerical
preparation only; no new game build, browser flight, device or measured-aircraft
qualification is claimed.

## Fixed-voltage command-domain selection: non-activating preparation

`propulsion-domain.mjs` exports `solveStaticQuadCommandDomain()`. The new
`StaticQuadDomainInverse.v1` input uses the local inverse's complete frame, thrust
axis, torque basis, SI units, ideal fixed-voltage supply and target. Each rotor
contains `id`, `position`, `reactionDirection`, `commandUnit` and its original
`surface`, without a caller-selected `cell`. Existing formats and the cell solver
are unchanged. The module has no live aircraft, controller, worker, inspector or
package imports.

The searched domain is the **union of explicitly declared command cells at the
specified voltage**. It does not include isolated observed command paths that
are not edges of any admitted cell. Undeclared intervals remain holes; no cells
are inferred and no query is clamped, snapped or extrapolated. Every surface and
all its declared cells are validated first. Exact voltage comparisons select
covered cells. At a shared voltage knot, the lowest admitted voltage-cell index
is retained for each command interval: both adjacent cells use the same observed
path values in every channel at that knot, matching the surface evaluator's rule.

The Cartesian product of the four candidate lists is traversed in lexicographic
rotor/cell order. Its fixed limit is **256 combinations**; a larger domain is
unavailable, never silently truncated. One call to the unchanged local inverse
performs complete input validation and is reused as candidate zero. An empty or
over-budget domain therefore makes one validation call; an admitted search makes
at most 256 cell-solver calls. Candidate lists have at most 15 entries per rotor
under the existing surface limits. The result retains one selected result or one
unresolved result, plus at most two compact ambiguous-command summaries; it does
not collect every attempted forward receipt.

Each candidate retains the local solver's endpoint checks, fixed force/torque
scales, matrix conditioning, strict command bounds, exact terminal-voltage check,
power checks and forward residual tolerances. Only
`outside-selected-command-cells` is treated as a computed rejection that permits
the search to continue. Any other failure makes the search
`unresolved-command-cell` and returns no usable commands, even if an earlier cell
solved. Invalid evidence or a poorly conditioned cell cannot disappear from the
domain merely because another candidate works.

The result is solved only after the complete admitted search produces one exact
command vector. Exact duplicate vectors from shared command boundaries retain
the first lexicographic cell tuple and increment `duplicateSolutions`. Different
vectors produce `ambiguous-command-solutions`, even when the difference is only
rounding near a shared boundary. There is no epsilon-based merging. This is a
**calculated selection under the existing local inverse's numerical policy**,
not certified mathematical uniqueness: finite-precision out-of-cell rejection
can exclude an exact root very near a boundary. A targeted decimal-boundary test
demonstrates the conservative ambiguity outcome. A stronger uniqueness guarantee
would require a separately reviewed numerical error-bound method.

Other unavailable reasons are `no-admitted-cell-at-voltage`,
`command-domain-workload-limit` and `no-command-domain-solution`. Malformed records
still throw through complete validation. `commands` and `selection` remain null
on all unavailable outcomes. `workload` reports the candidate product, actual
cell-solver calls and exact duplicate count. The identity binds complete surface
content identities, ordered candidate lists, geometry, target, voltage, workload
limit and local numerical policy. Data are detached and deeply frozen.
Top-level `sources` are the validation cell's lower-command receipts, explicitly
labeled `sourceReceiptContext: 'validation-cell-lower-command-endpoints'`; those
source `command` values are not the selected commands. A successful `selection`
retains its full cell-inverse result and forward provenance.

Every outcome remains `resultKind: 'calculated'` and `flightEligible: false`.
This bounded synchronous inspection calculation is not a real-time allocator or
a performance-qualified flight loop. Coupled battery sag/current regulation,
desaturation and axis priorities, command-to-controller adaptation, motor
transients, physical measurements and versioned runtime/replay qualification
remain open R6 work.

The fifteen new synthetic tests cover an independent piecewise forward oracle,
asymmetric geometry, per-rotor slopes and mixed command units, exact and nearby
boundaries, voltage-knot ownership, declared holes, distinct multiple solutions,
near-boundary nonmerging, solved-plus-unresolved domains, singular/ill-conditioned
matrices, missing evidence, power failures, exact/over-budget workload limits,
immutable provenance and non-activation. They use invented data only. Run them
with the unchanged five propulsion suites:

```sh
node --test --test-concurrency=1 game/test/fpv-aircraft-propulsion-domain.test.mjs game/test/fpv-aircraft-propulsion-inverse.test.mjs game/test/fpv-aircraft-propulsion-quad.test.mjs game/test/fpv-aircraft-propulsion-surface.test.mjs game/test/fpv-aircraft-propulsion-load.test.mjs game/test/fpv-aircraft-propulsion-evidence.test.mjs
```

On 19 October 2026, this isolated change from
`5aef423f2b51133681ad43c864150eed1f34fe21` passed **95/95** focused checks on
Node 20.19.5: fifteen domain checks plus the unchanged eighty inverse/forward
checks. Scoped ESLint, JavaScript/test Prettier and `git diff --check` pass.
Independent read-only math/source review reproduced all fifteen new checks and
found no blocker. The preserved local log `fpv-propulsion-domain-tests-20261019.log`
has SHA-256 `b7e3331a43677bdf9fc055da96d3f72c38e5d6314b3790c307e0963ed8efe83a`.
This is source-level numerical preparation; no package build, browser/device
flight or measured-aircraft qualification is newly claimed.

## API and example

```js
import {
  createSyntheticPropulsionEvidence,
  validatePropulsionEvidence,
  createPropulsionEvidenceEvaluator,
} from '../optional-practice/civilian-fpv/propulsion-evidence.mjs';

const source = createSyntheticPropulsionEvidence(); // Invented numerical example only.
const imported = validatePropulsionEvidence(JSON.stringify(source));
const evaluator = createPropulsionEvidenceEvaluator(imported);
const result = evaluator.evaluate(0.375); // Canonical units listed by evaluator.axis.
```

The example supplies the complete JSON shape and is available offline. Its numbers are explicitly synthetic, not a manufacturer preset. The CC0 declaration applies only to those invented example numbers, not the implementation or any external dataset.

`validatePropulsionEvidence(objectOrJson)` returns detached data, retaining source units and observations. Limits are 256 KiB, 256 samples, 32 coverage intervals, bounded strings and nesting. Unsupported fields, missing schema fields, accessors, cycles and numeric strings are rejected.

`createPropulsionEvidenceEvaluator(source)` returns a frozen `evidence`, `identity`, canonical `axis`, `units`, `intervals`, `samples`, `diagnostics`, and an `evaluate(number)` method. Identity is a stable local content checksum, not a signature or a simulation identity. Returned evaluation objects are detached.

## Required record fields

| Field                  | Meaning                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `format`, `id`, `name` | Exact format string, bounded stable identifier and display name.                                                                                                                                                                      |
| `source`               | `kind` is `measured`, `calculated` or `synthetic`; also `title`, `url`, `revision`, `retrievedAt` (`YYYY-MM-DD`), `sha256` and `license`. Unknown metadata is explicitly `null`.                                                      |
| `source.license`       | `id`, `url`, `attribution`, and `redistribution`: `permitted`, `unknown` or `restricted`. Permission is a supplied provenance claim, never inferred or verified by this module. `permitted` requires a named license and attribution. |
| `components`           | Exact `motor`, `propeller`, `esc`, `escFirmware`, `controlProtocol` descriptions, or `null` individually.                                                                                                                             |
| `conditions`           | `flow`: `static`, `axial`, `edgewise`, `mixed`, `unknown`; `scope`: `single-rotor`, `whole-aircraft`, `unknown`; nullable `airDensityKgM3`, `temperatureC`, `pressurePa`, `humidityRatio` (0–1), `installation`, `notes`.             |
| `units`                | All seven channel keys below, with an explicit unit or `null` for an unavailable channel.                                                                                                                                             |
| `uncertainty`          | `kind`: `unknown`, `reported`, `absolute-bound`, `standard`, `expanded`; nullable `coverageFactor` (expanded only) and `notes`.                                                                                                       |
| `domain`               | `kind: 'one-dimensional-path'`, `axis`: `command`, `rpm`, `voltage` or `airspeed`; `intervals: [[start, end], ...]` in source axis units.                                                                                             |
| `samples`              | Strictly increasing axis samples. Each has `values` and `uncertainty` objects, both containing all seven channel keys. Uncertainty values are nonnegative absolute values in the channel's source unit, or `null`.                    |

| Channel    | Accepted units                | Canonical output                                               |
| ---------- | ----------------------------- | -------------------------------------------------------------- |
| `command`  | `normalized`, `percent`, `us` | `normalized` or `us`; PWM is never inferred to be motor speed. |
| `rpm`      | `rpm`, `rad/s`                | `rpm`                                                          |
| `voltage`  | `V`, `mV`                     | `V`                                                            |
| `airspeed` | `m/s`, `km/h`                 | `m/s`.                                                         |
| `thrust`   | `N`, `gf`, `kgf`              | `N`, using standard gravity 9.80665 m/s² for force conversion. |
| `torque`   | `N*m`, `N*cm`                 | `N*m`                                                          |
| `current`  | `A`, `mA`                     | `A`                                                            |

Thrust, torque and current may contain signed observations, including noise. They are never silently clamped or made monotonic. Torque denotes shaft-load torque, positive for positive mechanical consumption; a different source convention must be explicitly normalized before import. Preserve the source revision/hash and document transformations in notes. Missing values and uncertainties remain `null`.

## Evaluation and diagnostics

- Coverage intervals have sampled endpoints, are sorted and disjoint, and contain every sample. Isolated sampled points are allowed. Evaluation cannot bridge a gap, extrapolate, fabricate idle/full-throttle endpoints or infer a multidimensional surface.
- `status` is `sample`, `interpolated`, or `outside-coverage`. `sourceKind` independently preserves the evidence kind; a calculated sample never becomes measured.
- Results include `values`, `uncertainty`, `bracket` indices, `fraction`, `missingFields`, `power` and diagnostic codes. Outside coverage has `values: null`, plus `below-domain`, `above-domain` or `coverage-gap` as its reason.
- Linear interpolation requires both endpoint values. Its uncertainty fields are merely linear endpoint uncertainty values; they exclude interpolation/model error and are not a propagated statistical confidence interval. `uncertaintyBasis` and an informational diagnostic identify this limitation.
- Electrical power is `voltage × current`; shaft power is `torque × 2π × RPM / 60`. Missing inputs produce `null`, not zero. Efficiency is available only for positive electrical power with available shaft power.
- Negative load readings and shaft power exceeding electrical power generate warnings. Energy warnings compare central values, not uncertainty bounds, and do not prove a measurement is impossible. Neither warnings nor imports activate physics automatically.
- Source/condition/license text is inert. Render it as text, not HTML. No source URL is fetched. Unknown/restricted redistribution remains visible and does not block a user's local inspection.

## Conditional battery load calculation

`solvePropulsionEvidenceLoad` in `propulsion-load.mjs` calculates a static electrical operating point from one to four eligible voltage sweeps. This pure prerequisite for a later propulsion adapter is also available through the explicit inspection controls described below. It has no flight-runtime, preset, persistence or network integration, and does not change historical flight identities. No external measurement rows are bundled.

```js
import { solvePropulsionEvidenceLoad } from '../optional-practice/civilian-fpv/propulsion-load.mjs';

const result = solvePropulsionEvidenceLoad({
  evidence: [voltageSweep], // A complete PropulsionEvidence.v1 voltage-axis record.
  openVoltage: 4.2, // Explicit model assumption in volts, not a fitted battery parameter.
  resistance: 0.08, // Explicit model assumption in ohms.
  currentBasis: 'dc-input-at-recorded-voltage',
  currentLimit: 5, // Optional diagnostic threshold in amperes; null means no threshold.
});
```

The example's battery numbers are illustrative, not a recommended aircraft tune. The existing `createSyntheticPropulsionEvidence()` example has a **command axis**, so it deliberately returns `voltage-axis-required` rather than being reinterpreted as a voltage sweep. The numerical tests contain separate invented voltage sweeps.

The caller must establish that each path's current denotes **DC input current at its recorded terminal voltage**, and supply the explicit `currentBasis` declaration. Phase current cannot be substituted. The evidence schema cannot establish measurement topology: this declaration is a caller assumption, not source verification. The output records `assumptions.currentBasis: 'caller-declared'` and `assumptions.measurementTopology: 'unverified'`, separately from unchanged source metadata.

Eligible paths require:

- A voltage axis, `single-rotor` scope, `static` flow and explicitly recorded zero airspeed at every sample.
- A present, constant command at every sample. Canonical normalized and microsecond command units remain distinct; neither is converted to RPM or normalized motor speed. Different paths may use different fixed commands.
- Present, nonnegative DC input current, nondecreasing through the entire voltage sequence, including across coverage gaps. This supports a unique covered solution; noisy or nonmonotone evidence remains inspectable in the original module but is unavailable for this solver.

The circuit consists only of the supplied independent parallel loads at one common terminal voltage, powered by an ideal fixed open voltage and series resistance. A whole-aircraft path is rejected to prevent mixing measurement scopes. Each supplied path counts once; repeated paths explicitly model repeated identical independent loads. Rotor interaction, additional electronics, unequal wiring losses, transients, battery charge/temperature evolution and voltage regulation are outside this model. It is not a complete aircraft prediction or a measured battery fit.

The solver intersects all covered voltage intervals, merges their sample knots and solves `V + R × sum(I(V)) = openVoltage` within each covered piecewise-linear segment. It never assumes `I ∝ V²`, bridges gaps, extrapolates, invents idle/full-command endpoints, changes commands or constructs a command-by-voltage surface. Closed endpoints and isolated covered points are supported. A floating-point solution is accepted only when its re-evaluated residual is at most `32 × Number.EPSILON × max(|openVoltage|, |V|, |R × I|)` volts; that bound is reported as `residualToleranceVolts`. If the curve is too steep to represent a consistent operating voltage, the result is unavailable with `numerical-resolution` rather than a fabricated current at the rounded voltage.

The returned `PropulsionLoad.v1` object is detached and self-describing:

- `resultKind` is always `calculated`. `model` identifies the fixed battery model, linear load interpolation and common-voltage parallel connection; `assumptions` explicitly marks topology and current interpretation as unverified and load interactions as unmodeled.
- `sources` retains each evidence identity, source kind/license/revision, component descriptions, conditions, uncertainty metadata, canonical units, fixed-command declaration and diagnostics. Measured, calculated and synthetic sources remain distinct. Source text remains inert and no URL is fetched.
- `status` is `solved`, `limit-exceeded` or `unavailable`. `reason` and, where applicable, `pathIndex` identify unsupported conditions, missing current/commands, nonmonotone current, absent common coverage, a root outside coverage, a gap or numerical resolution. Malformed records and invalid circuit arguments throw instead of producing a partially accepted result.
- `operatingPoint` is null when unavailable. Otherwise it contains voltage, summed current, delivered electrical power, series-resistance loss, voltage residual and per-path evaluator results. The central-value power balance is `openVoltage × I = V × I + R × I²`. Missing thrust, torque or RPM stays null. No aggregate body force or reaction torque is inferred.
- A current threshold produces `limit-exceeded` while retaining the **unregulated** operating point. It does not clip current or solve at an invented lower command. Equality with the threshold is accepted.
- `uncertaintyBasis: 'central-values-only-not-propagated'` applies to the solved point. Per-path source/interpolation uncertainty is retained, but battery-parameter, model, interpolation and root uncertainty are not propagated.

Voltage and resistance arguments are finite numbers in `0..1000` V and `0..1000` ohms; an optional current threshold is `0..40000` A. These are parser bounds, not qualified hardware limits. Each path retains the original 256 KiB / 256-sample evidence limits, and the combined input is bounded. The local content checksum binds ordered evidence identities and circuit inputs; it is not a signature, measurement qualification or simulation identity.

Validation: `node --test game/test/fpv-aircraft-propulsion-load.test.mjs game/test/fpv-aircraft-propulsion-evidence.test.mjs`. Independent synthetic circuit oracles cover constant/affine and piecewise loads, multiple paths, knots, singleton/intersected/disconnected domains, zero voltage/resistance/current, missing channels, caller declarations, numerical resolution and immutability. Passing these checks qualifies the bounded numerical calculation only. R6 still requires conditioned command/voltage maps, consistent allocation and motor response, versioned runtime integration, and held-out physical evidence.

## Evidence reviewed and later activation

[Tyto test 6zd](https://database.tytorobotics.com/tests/6zd/dys-samguk-shu-hq-5045) includes command, RPM, force, torque, current and voltage, but is a battery-loaded sweep for a different component combination. It is not a full command-by-voltage surface; redistribution permission was not established. [T-Motor's MN4014 tables](https://store.tmotor.com/product/mn4014-kv330-motor-navigator-type.html) use different propellers from the catalog's X650 and lack torque/low-command coverage. [APC's files](https://www.apcprop.com/performance-data-new/) are calculated results. [UIUC](https://m-selig.web.engr.illinois.edu/props/propDB.html) provides measured propeller coefficients, not full electrical powertrain maps.

[ENOLA version 1](https://zenodo.org/records/20111572) is explicitly CC BY-SA 4.0 and separates experimental and numerical data. The inspected AeronautCAM9×5 and APC15×8 CSVs include uncertainty and airspeed, but lack motor electrical measurements. Their header is missing a separator between thrust and thrust uncertainty; a future adapter must record that normalization. No external measurement rows are bundled in this increment.

Flight activation remains separate. It needs an appropriate measured operating domain, a versioned voltage/current solver, variable torque/thrust allocation checks, explicit fallback labeling, and replay/numerical qualification. The existing analytic aircraft model and default configurations remain unchanged.

Validation: `node --test game/test/fpv-aircraft-propulsion-evidence.test.mjs`.

## Inspection panel integration

`mountPropulsionEvidencePanel({parent, locale, getAircraft})` from `propulsion-evidence-ui.mjs` mounts a collapsed EN/UK inspection panel. `locale` may be a language string or callback; `getAircraft` returns the current `AdvancedAircraft.v2` record or `null`. The lifecycle is `{root, refresh(), importEvidence(source), dispose()}`. Call `refresh()` after changing locale or aircraft, not on the physics clock. `importEvidence` returns a success boolean; invalid replacements preserve the existing dataset. Asynchronous file reads are bounded, and stale/disposed reads cannot replace a newer choice.

The panel supports local JSON files, pasted text and the explicit synthetic example. Source text uses safe DOM text. There is no aircraft write callback, persistence or network fetch. Equivalent-thrust comparison is available only for a covered single-rotor static point with known zero airspeed, nonnegative thrust, voltage inside the configured aircraft battery range (empty through full voltage, inclusive) and a compatible aircraft. This conservative guard prevents extrapolating a 1S motor to a 12 V bench point; it does not certify motor operating limits. It inverts the active single-motor thrust model at the supplied voltage, respects the motor output limit, and displays estimated current/torque. It does not reinterpret source command/RPM as normalized motor speed or apply battery sag, whole-aircraft current limits, density correction or transient modeling. Other cases explicitly show comparison unavailable.

Panel tests: `node --test game/test/fpv-aircraft-propulsion-evidence-ui.test.mjs`.

### Manual battery load inspection

The EN/UK panel now offers **Battery load calculation** for its currently imported
dataset. Open-circuit voltage and series resistance start blank; neither is copied
from the editable aircraft. The user must enter both, declare that the recorded
current is DC input current at its recorded terminal voltage (not phase current),
and explicitly press **Calculate load**. Numerical input bounds are the kernel's
parser limits, not recommended battery settings.

The copy count defaults to one and accepts integers from one through four. It
means repeated, identical, independent copies of the same single-rotor voltage
path, at its recorded fixed command and common terminal voltage. It is not an
automatic quadrotor configuration or a mixture of independently imported motors.
The existing command-axis synthetic example remains available for learning the
evidence format, but its load calculation is explicitly unavailable. The panel
does not reinterpret that example, create a new voltage sweep, or bundle external
measurements.

The result keeps measured-source declarations, calculated data and invented data
distinct. It displays the manual inputs and count, fixed command, terminal voltage,
total and per-copy current, power at open-circuit voltage, delivered power,
series-resistance loss, equation residual and numerical tolerance. Optional
per-copy thrust and shaft torque remain unavailable when absent; they are never
summed into aircraft forces or yaw torque. Original samples and interpolation
within a covered interval are labeled separately. Displayed calculation precision
does not establish measurement accuracy, and uncertainty is not propagated.

An optional total-current warning threshold only flags exceedance; it leaves the
unregulated operating point intact. Unsupported conditions, incomplete or
nonmonotone current, changing command, uncovered roots, gaps and inadequate
floating-point resolution produce explicit EN/UK unavailable explanations.
There is no apply-to-aircraft action, automatic fit, current regulator, discharge
simulation or command-to-RPM conversion.

Changing any calculation input clears its previous result. A successful dataset
replacement also clears the DC-current acknowledgment; an invalid import retains
the previous dataset and its corresponding calculation. Locale refresh preserves
the current inputs and result. Superseded file reads and disposal retain the
inspector's generation/lifecycle protections. Native labels, a fieldset legend,
button actions and a live result status support keyboard and assistive use.

Validation: `node --test game/test/fpv-aircraft-propulsion-load-ui.test.mjs
game/test/fpv-aircraft-propulsion-evidence-ui.test.mjs
game/test/fpv-aircraft-propulsion-load.test.mjs
game/test/fpv-aircraft-propulsion-evidence.test.mjs`. The seven new DOM checks use
invented analytic circuit oracles and cover explicit action, invalid inputs,
copies, diagnostic-only limits, unavailable conditions, source-kind retention,
inert text, stale imports, disposal and EN/UK labels. These are software checks,
not new browser/device measurements or physical-fidelity qualification. The UI
adds the already committed `propulsion-load.mjs` to the optional package closure;
measured runtime activation remains a separate R6 gate.

The Advanced practice tuning screen mounts this panel below its aircraft controls. Comparisons read the validated editable draft, refresh after field edits, aircraft selection and revert, and cannot modify the running worker. Incomplete drafts show comparison unavailable. The host uses its selected EN/UK locale at mount; a newly localized host gets a newly localized panel. Disposal removes listeners and ignores outstanding file reads.

Mounted integration checks: `node --test game/test/fpv-advanced-practice.test.mjs`. The evidence suite contains 16 pure evaluator checks and 9 panel checks; two host checks cover live draft comparison, frozen active flight settings, lifecycle cleanup and Ukrainian keyboard-accessible import. No additional third-party data or runtime dependencies are bundled. The combined optional-feature package measurements follow below.

## Combined optional-feature package measurements

Measured on 2026-10-17 from `29a84ba2f`, including the challenge checkpoint-resume, archive-host naming and Regional recording-rotation fixes. These builds include the three archive modules, bounded ghost sampling, the two evidence modules and the two optional challenge modules. They retain the existing pinned third-party dependencies.

| Build                   | Runtime files | Runtime bytes | Complete source files | Complete source bytes |
| ----------------------- | ------------: | ------------: | --------------------: | --------------------: |
| Academy standalone      |           137 |    11,811,221 |                   139 |            11,852,141 |
| World standalone        |           196 |    18,301,240 |                   198 |            18,350,012 |
| Combined native staging |           201 |    18,686,076 |                     — |                     — |

Academy's installed-core cache, which retains the full shared locale catalog, is 126 files / 12,819,887 bytes. Its original source inputs total 12,993,305 bytes. Runtime and source-input caps increase by 64 KiB each to **12 MiB + 256 KiB** and **12 MiB + 448 KiB** respectively. Standalone Academy remains below 12 MiB. World retains its 20 MiB cap; native staging retains its 256-file / 32 MiB cap. Explicit complete source-file limits become 139 for Academy and 198 for World. The final fixes retain all caps, leaving 25,169 bytes of installed-core headroom and 48,359 bytes of original-input headroom in Academy. Negative tests continue to reject omitted dependencies, incorrect source hashes and over-budget inputs.

The ghost display retains at most 8,192 position samples, including endpoints. Display interpolation does not replace complete replay verification; reduced display sampling is labeled approximate. Data imports and optional challenge selection do not change the default twelve-aircraft configurations.

Package checks: `node --test scripts/test-optional-fpv-package.mjs scripts/test-build-fpv-native.mjs scripts/test-world-texture-acceptance.mjs`. These package checks establish offline inclusion and bounded build output, not physical-device qualification.

### Load-inspector package measurements — 18 October 2026

The load inspector adds the first-party solver to the main, Academy, World and
native dependency closures. Complete source-file allowances rise by exactly one,
from 150 to **151** for Academy and 210 to **211** for World. Byte limits and
third-party dependencies are unchanged. Missing-solver negative tests protect
the offline dependency. The three focused package suites pass **19/19**.

| Build              | Runtime files | Runtime bytes | Complete source files | Complete source bytes |
| ------------------ | ------------: | ------------: | --------------------: | --------------------: |
| Academy standalone |           149 |    12,089,844 |                   151 |            12,132,214 |
| World standalone   |           209 |    18,596,589 |                   211 |            18,646,931 |
| Native inventory   |           214 |    18,985,854 |                     — |                     — |

Academy original inputs are 13,267,453 bytes, leaving 36,355 bytes under their
existing cap. World original inputs are 19,752,688 bytes. Bundled Academy is
138 files / 13,095,062 bytes, leaving only **12,138 bytes** under its unchanged
13,107,200-byte cap; integration and later source changes must remeasure this
narrow margin. Native inventory retains 14,568,578 bytes of headroom. Native
packaging/CSP checks do not constitute testing on a native device.

These measurements include package commit `f9ddc2693` and the reviewed load UI
content: `propulsion-evidence-ui.mjs` is 39,752 bytes with SHA-256
`29549afbc43963ae4a24b3bb087bb11b5260098993f94582c6f7867c488e1c32`;
`propulsion-load.mjs` is 7,768 bytes with SHA-256
`5a8697405784c5f6b3e8805fdd468ec560a7eee1c7a699e7aec708d1361bfb01`.
The combined evaluator, kernel and DOM suites pass **46/46**. Independent source,
test and documentation review found no blocking issue. This increment qualifies
local inspection software and packaging, not a measured propulsion runtime.

### Rendered inspector acceptance

On 18 October 2026, the local World source preview at `40611b264` opened the
inspector through the ordinary Settings → Workbench → Expert PID → Advanced
reference practice path. An explicitly invented voltage sweep, `I(V) = V` at
constant command, produced **2.5 V**, **2.5 A**, **12.5 W** at the ideal source,
**6.25 W** delivered and **6.25 W** series loss for manual inputs 5 V / 1 Ω / one
load. Residual was zero. Missing thrust and torque remained unavailable and the
synthetic provenance was visible.

Editing resistance cleared all prior result values immediately. Loading the
built-in command-axis example disabled calculation and explained that command or
RPM sweeps cannot be reinterpreted as voltage sweeps. No practice was started,
aircraft values applied or library saved. The temporary draft was reverted and
Basic view restored before closing the test tab. This is an English desktop
source-preview check, separate from EN/UK DOM coverage and offline package tests;
it does not qualify Ukrainian rendering, mobile layout or a deployed release.
