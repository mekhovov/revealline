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

## Evidence reviewed and later activation

[Tyto test 6zd](https://database.tytorobotics.com/tests/6zd/dys-samguk-shu-hq-5045) includes command, RPM, force, torque, current and voltage, but is a battery-loaded sweep for a different component combination. It is not a full command-by-voltage surface; redistribution permission was not established. [T-Motor's MN4014 tables](https://store.tmotor.com/product/mn4014-kv330-motor-navigator-type.html) use different propellers from the catalog's X650 and lack torque/low-command coverage. [APC's files](https://www.apcprop.com/performance-data-new/) are calculated results. [UIUC](https://m-selig.web.engr.illinois.edu/props/propDB.html) provides measured propeller coefficients, not full electrical powertrain maps.

[ENOLA version 1](https://zenodo.org/records/20111572) is explicitly CC BY-SA 4.0 and separates experimental and numerical data. The inspected AeronautCAM9×5 and APC15×8 CSVs include uncertainty and airspeed, but lack motor electrical measurements. Their header is missing a separator between thrust and thrust uncertainty; a future adapter must record that normalization. No external measurement rows are bundled in this increment.

Flight activation remains separate. It needs an appropriate measured operating domain, a versioned voltage/current solver, variable torque/thrust allocation checks, explicit fallback labeling, and replay/numerical qualification. The existing analytic aircraft model and all twelve default configurations remain unchanged.

Validation: `node --test game/test/fpv-aircraft-propulsion-evidence.test.mjs`.

## Inspection panel integration

`mountPropulsionEvidencePanel({parent, locale, getAircraft})` from `propulsion-evidence-ui.mjs` mounts a collapsed EN/UK inspection panel. `locale` may be a language string or callback; `getAircraft` returns the current `AdvancedAircraft.v2` record or `null`. The lifecycle is `{root, refresh(), importEvidence(source), dispose()}`. Call `refresh()` after changing locale or aircraft, not on the physics clock. `importEvidence` returns a success boolean; invalid replacements preserve the existing dataset. Asynchronous file reads are bounded, and stale/disposed reads cannot replace a newer choice.

The panel supports local JSON files, pasted text and the explicit synthetic example. Source text uses safe DOM text. There is no aircraft write callback, persistence or network fetch. Equivalent-thrust comparison is available only for a covered single-rotor static point with known zero airspeed, nonnegative thrust, voltage inside the configured aircraft battery range (empty through full voltage, inclusive) and a compatible aircraft. This conservative guard prevents extrapolating a 1S motor to a 12 V bench point; it does not certify motor operating limits. It inverts the active single-motor thrust model at the supplied voltage, respects the motor output limit, and displays estimated current/torque. It does not reinterpret source command/RPM as normalized motor speed or apply battery sag, whole-aircraft current limits, density correction or transient modeling. Other cases explicitly show comparison unavailable.

Panel tests: `node --test game/test/fpv-aircraft-propulsion-evidence-ui.test.mjs`.

The Advanced practice tuning screen mounts this panel below its aircraft controls. Comparisons read the validated editable draft, refresh after field edits, aircraft selection and revert, and cannot modify the running worker. Incomplete drafts show comparison unavailable. The host uses its selected EN/UK locale at mount; a newly localized host gets a newly localized panel. Disposal removes listeners and ignores outstanding file reads.

Mounted integration checks: `node --test game/test/fpv-advanced-practice.test.mjs`. The evidence suite contains 16 pure evaluator checks and 9 panel checks; two host checks cover live draft comparison, frozen active flight settings, lifecycle cleanup and Ukrainian keyboard-accessible import. No additional third-party data or runtime dependencies are bundled. The combined optional-feature package measurements follow below.

## Combined optional-feature package measurements

Measured on 2026-10-17 from `8e682b929`, including the final challenge checkpoint-resume and archive-host naming fixes. These builds include the three archive modules, bounded ghost sampling, the two evidence modules and the two optional challenge modules. They retain the existing pinned third-party dependencies.

| Build                   | Runtime files | Runtime bytes | Complete source files | Complete source bytes |
| ----------------------- | ------------: | ------------: | --------------------: | --------------------: |
| Academy standalone      |           137 |    11,810,740 |                   139 |            11,851,660 |
| World standalone        |           196 |    18,300,759 |                   198 |            18,349,531 |
| Combined native staging |           201 |    18,685,595 |                     — |                     — |

Academy's installed-core cache, which retains the full shared locale catalog, is 126 files / 12,819,406 bytes. Its original source inputs total 12,992,824 bytes. Runtime and source-input caps increase by 64 KiB each to **12 MiB + 256 KiB** and **12 MiB + 448 KiB** respectively. Standalone Academy remains below 12 MiB. World retains its 20 MiB cap; native staging retains its 256-file / 32 MiB cap. Explicit complete source-file limits become 139 for Academy and 198 for World. The final fixes retain all caps, leaving 25,650 bytes of installed-core headroom and 48,840 bytes of original-input headroom in Academy. Negative tests continue to reject omitted dependencies, incorrect source hashes and over-budget inputs.

The ghost display retains at most 8,192 position samples, including endpoints. Display interpolation does not replace complete replay verification; reduced display sampling is labeled approximate. Data imports and optional challenge selection do not change the default twelve-aircraft configurations.

Package checks: `node --test scripts/test-optional-fpv-package.mjs scripts/test-build-fpv-native.mjs scripts/test-world-texture-acceptance.mjs`. These package checks establish offline inclusion and bounded build output, not physical-device qualification.
