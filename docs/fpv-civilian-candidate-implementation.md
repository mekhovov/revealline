# Civilian Cetus X and Protos implementation

Implemented 18 October 2026 from the [candidate source review](fpv-civilian-candidate-review.md).
This record separates implementation, numerical checks and publication. It does not
establish measured whole-aircraft fidelity or reproduction of stock firmware.

## Catalog additions

Catalog revision **3** adds two immutable revision-1 references. The thirteen earlier
complete default configurations retain their exact SHA-256 identities, including
physics, controller, rates, camera and component baselines. Existing saved setups
are not rewritten. The catalog now contains **15 aircraft**.

| SIM name            | Frozen identity                                                                  | Installed mass and battery                                                                                                                      | Supported response                                                                                                                                                                            |
| ------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BETAFPV Cetus X     | `cetus-x-betaflight-2022` · original 2022 analog Betaflight SPI ELRS / F4 1S 12A | 56 g reviewer-reported dry + two specified 12.7 g original BT2.0 cells = **81.4 g calculated**. The series pair is **2S 450 mAh**, not 900 mAh. | Independent SIM Acro/self-level controller; SIM-authored Actual 600°/s maximum, 100°/s center, 25% expo. No proprietary Cetus hold behavior.                                                  |
| CADDXFPV Protos 1.6 | `protos-16-aio-1-0` · AIO 1.0 / Ascent Lite, manual V1.4                         | **104.4 g inferred battery-inclusive mass**; 41.9 g manufacturer pack and 62.5 g calculated remainder. C0PJ-DC016 **2S1P 840 mAh Li-ion**.      | Approximate independent SIM Acro/self-level; SIM-authored Actual 500°/s maximum, 100°/s center, 25% expo. No stock position/height hold, Angle restrictions or factory input/PID equivalence. |

Both use the existing complete-aircraft schema, independent controller, 500 Hz
backend, setup library, practice hosts, component editing and recording paths.
No new control mode or controller conversion was introduced. Both start with
battery depletion off; their mass, voltage sag and power limits remain active.
The picker retains the existing explicit choice of starter rates or current rates.

## Evidence and boundaries

Cetus X retains the manufacturer's 55 g figure and the reviewer's rounded 81 g
flying figure as differing observations. The chosen 56 g dry value is explicitly
**Published reviewer measurement**, not a measurement performed by this project or
a manufacturer specification. Its 81.4 g flying weight is a calculation. Camera
sensor alternatives and later board/cell revisions remain documented. Actual
propeller diameter is 50.3 mm with four blades; the overall body envelope and
installed component positions remain estimates.

Protos's manual does not explicitly state whether its 104.4 ± 1.5 g includes the
battery. A hands-on review corroborates a little over 100 g with battery; the
preset therefore labels the interpretation **Inferred from sources**. Subtracting
the specified 41.9 ± 0.5 g pack gives a 62.5 g dry estimate and a conservative 2 g
combined tolerance bound, not a statistical confidence interval. Manufacturer
confirmation or a weighed identified sample would improve this reference.

The Protos pack remains Li-ion. Its 7.6 V nominal value is calculated from
6.384 Wh / 0.840 Ah. Full charge uses the specified **8.5 V charging maximum**, not
the 8.70 V operating upper limit. Its 6.0 V empty-state boundary, resistance and
current curve are SIM estimates. The 12.6 A current ceiling is the arithmetic
15C × 0.840 Ah rating; Cetus X similarly uses 13.5 A from 30C × 0.450 Ah. Neither
rating is a measured sag or powertrain map.

The catalog supports per-reference voltage bounds without changing any older
reference's values. Descriptive evidence and URLs remain outside numerical flight
records. Runtime workers reconstruct ordinary bounded configuration data.

## Physical and visual estimates

No matched complete propulsion map was available for either aircraft. Starting
per-motor nominal thrust is estimated at 0.78 N for Cetus X and 0.72 N for Protos;
estimated motor lag is 22 ms and 24 ms respectively. Inertia, rotor arrangement,
reaction torque, directional drag, resistance, sensor behavior and SIM controller
gains use the same explicit modeling approach as the existing catalog. These
values are not fitted to a manufacturer's advertised endurance or inferred from
KV alone.

The active evaluator calculates approximately **44.9% hover / 3.82 thrust-to-weight**
for the Cetus X reference and **55.1% / 2.55** for Protos with the fresh reference
pack and modeled sag. These are SIM calculations, not measured product performance.

Original simplified meshes show guarded rotors, a canopy, scale-specific
dimensions and distinct illustrative colors. Cetus X uses an underslung pack
depiction; Protos uses the upper/rear canopy battery bay described in its manual. Cetus X has four
blades per propeller; Protos has three. Geometry follows the modeled body/rotors
and remains a simplified representation. No manufacturer CAD or photographs are
redistributed. Paint, blade appearance and canopy presentation do not enter
physics or recording identities.

## Player-facing disclosure

The main aircraft panel displays the historical/inferred-reference caveat in
English or Ukrainian before its collapsible evidence section. Evidence labels now
distinguish manufacturer specifications, published reviewer measurements,
calculations, inferences and estimates. Important notes remain inert text in their
original language, with translated labels. Browsing either entry does not write
saved settings or change an active flight.

## Validation and delivery

- Exact hashes of all thirteen prior complete default configurations are unchanged.
- Targeted tests cover installed-mass accounting, series-cell capacity, inferred
  provenance, charge-voltage limits, new visible EN/UK disclosures, editable
  components, previews and original renderer geometry.
- **185/185 focused checks passed** after formatting: catalog/accounting, previews,
  renderer, tuning UI and course hosts. The course matrix launches **15 aircraft ×
  216 Academy/World/Beginner catalog entries × two modes = 6,480 combinations**;
  these are startup checks, not completed missions. Edited batteries and additional
  camera payloads also launch in each course host.
- The existing full-catalog numerical test passed for **all 15 aircraft** at the
  frozen 500 Hz against 2 kHz, including accuracy, contacts, capacity and repeatability
  (15.4 seconds on this local runtime). This is numerical evidence, not a new
  cross-browser/device matrix or real-aircraft validation.
- **13/13 Regional host checks passed**, including all 15 references entering both
  modes and 60 baseline/rates/PID/mass comparison runs. These use the existing
  verified terrain fixture; they are not an exhaustive flight through every
  downloadable region. A missing unchanged fixture was first restored to the
  sparse checkout before the successful run.
- The standalone renderer test passed **8/8** after restoring a missing unchanged
  sparse-checkout dependency; the initial missing-module failure was an incomplete
  test checkout, not a failing flight result. The final 185-check run includes the
  same renderer checks. Focused lint, formatting and diff-whitespace checks pass.
- No claim of deployed availability is made by this local implementation record.
  Publication must be tied to the final merged build and public acceptance.

The existing physical-device, measured-aircraft and scored-promotion gates remain
open. Passing these software tests cannot turn either estimated reference into an
exact real-aircraft replica.

## Camera synchronization correction during review

Actual browser review also exposed an unrelated camera-input defect: incomplete
FOV text such as `4` was copied into the range control, which a native browser
clamps to 40 degrees. Synchronization now accepts only a valid in-range value.
Invalid raw text, focus and the last valid slider/preview are retained. EN/UK
regressions fail on the previous behavior and pass with the correction; they also
cover valid numeric input, change-only commits, slider-to-numeric updates and
unchanged persistence. All **134 tuning-UI checks** pass after this correction.

A separately reported valid numeric 86/range 82 mismatch was not reproduced by
these tests; it requires final browser confirmation rather than a claimed extra
fix. Numerical flight configuration and camera semantics are unchanged.
