# Propulsion evidence: bounded bench-data increment

`PropulsionEvidence.v1` stores observations and evaluates one documented path through a bench test. It does not change any aircraft, controller, recording identity or default preset. A static component test is not whole-aircraft flight validation.

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

| Build | Runtime files | Runtime bytes | Complete source files | Complete source bytes |
| --- | ---: | ---: | ---: | ---: |
| Academy standalone | 149 | 12,089,844 | 151 | 12,132,214 |
| World standalone | 209 | 18,596,589 | 211 | 18,646,931 |
| Native inventory | 214 | 18,985,854 | — | — |

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
