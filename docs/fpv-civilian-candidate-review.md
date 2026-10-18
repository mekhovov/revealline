# Civilian aircraft candidate review

Research checked 18 October 2026. This is a source review, not an implementation or flight-validation result. No new presets, runtime changes, physical measurements or flight tests were made for this review.

## Decision

| Candidate                                                            | Bounded implementation decision                                                                                                                                                                                    | Remaining fidelity limitation                                                                                                                                                                                            |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| BETAFPV Cetus X, analog Betaflight ELRS, original 2022 configuration | Sufficient evidence for a named, specification-based recreational preset using the original F4 1S 12A board and two original 30C cells. Label the historical revision explicitly.                                  | Manufacturer and reviewer mass differ slightly; camera alternatives and battery dimensional revisions must remain visible. Propulsion, inertia, drag and controller response are not measured for the complete aircraft. |
| Current Cetus X ELRS retail configuration                            | Do not silently reuse the 2022 identity.                                                                                                                                                                           | Later flight-controller and battery changes need their own frozen reference; the generic bundled 75C description does not prove the identity or mass of a particular LAVA pack.                                          |
| CADDXFPV Protos 1.6, AIO 1.0, Ascent Lite                            | Sufficient evidence for an explicitly approximate Acro/SIM-self-level reference if inferred battery inclusion is accepted and displayed. Keep pending if the preset gate requires manufacturer-confirmed dry mass. | The 104.4 g battery-inclusion interpretation is corroborated, not explicitly stated by the manufacturer. Stock position hold and exact factory input/controller behavior are unsupported.                                |

Neither candidate supports a claim of exact real-aircraft behavior. A passing numerical or flight-software test would not remove these evidence limits.

## Cetus X: frozen historical configuration

The [manufacturer aircraft page](https://betafpv.com/products/cetus-x-brushless-quadcopter) distinguishes the Betaflight ELRS and proprietary Cetus variants. It lists 55 g without explicitly defining battery inclusion and documents later board/battery changes. Its current recommended-parts and package lists also differ. Do not treat shipping weights, the full retail kit, or spare batteries as installed mass.

The [original F4 1S 12A manufacturer manual](https://support.betafpv.com/hc/en-us/articles/10207774042009-Manual-for-Cetus-X-Quadcopter-F4-1S-12A-AIO-FC) anchors the old board generation. [Oscar Liang's hands-on November 2022 review](https://oscarliang.com/betafpv-cetus-x/) explicitly identifies the tested Betaflight ELRS variant and reports 56 g without batteries and 81 g with two 450 mAh cells. These are reviewer-reported values, without a supplied scale uncertainty; they are not measurements performed by this project.

| Installed item               | Frozen reference                                                                |
| ---------------------------- | ------------------------------------------------------------------------------- |
| Frame / wheelbase            | Cetus X ducted frame; 95 mm motor diagonal                                      |
| Motors                       | Four BETAFPV 1103, 11000 KV, 1.5 mm shaft                                       |
| Propellers                   | Gemfan 2020, four blades                                                        |
| Flight controller / receiver | F4 1S 12A AIO, SPI ExpressLRS 2.4 GHz, Betaflight variant                       |
| Camera / video               | C04 module; manufacturer allows Caddx Nano Ant or Runcam Nano 4; M04 analog VTX |
| Camera tilt range            | 0–40 degrees                                                                    |
| Installed batteries          | Two BT2.0 1S 450 mAh 30C cells, connected in series                             |

These identities are supported jointly by the manufacturer documentation and the historical review. Preserve the camera alternative in provenance; the evidence does not identify one exact sensor in the reviewed sample.

The [original BT2.0 cell specification](https://betafpv.com/collections/batt-1s/products/bt2-0-450mah-1s-30c-battery-4pcs) gives 12.7 g per cell, 450 mAh, 30C/60C, 4.35 V and 62 × 15.5 × 6.7 mm. It also discloses a later dimensional revision. Two installed cells therefore contribute **25.4 g**, giving **2S 450 mAh**, not 900 mAh. The 4.35 V figure is the full-cell voltage, not the pack nominal voltage. Battery dimensions are the currently published replacement-cell dimensions, not proven measurements of the 2022 sample.

One consistent reference inventory is **56 g reported dry mass + 25.4 g specified cells = 81.4 g calculated flying mass** (0.0814 kg). Retain the reviewer’s rounded 81 g and the manufacturer’s 55 g as differing source observations; do not relabel 81.4 g as a measured value. Alternatively, 55 + 25.4 = 80.4 g is a manufacturer-based nominal choice, with the same caveat. Choose one accounting basis explicitly.

The [propeller specification](https://betafpv.com/collections/propellers/products/gemfan-2020-4-blade-propellers-1-5mm-shaft) resolves actual diameter to **50.3 mm**, with 0.93 g mass, four blades and a 1.5 mm mounting hole. [BETAFPV's motor page](https://betafpv.com/collections/brushless-motors/products/1103-brushless-motors) identifies the 11000 KV variant. Motor, propeller, camera and electronics mass is already included in assembled dry mass: never add those components again. Their separate masses can inform a normalized inventory, but their installed positions and the residual frame/electronics distribution remain estimates.

Use SIM-authored starter rates and the independent SIM controller. Betaflight compatibility describes validated portable input settings, not execution of the original flight-controller firmware. This reference does not implement the other Cetus variant’s proprietary hold modes.

## Protos: model, battery and supported behavior

The [official Protos 1.6 manual, V1.4](https://cdn.shopify.com/s/files/1/0036/3921/4169/files/CADDX_PROTOS_1.6_FPV_Drone_User_Manual.pdf?v=1787640812), linked by the [manufacturer download center](https://www.caddxfpv.com/pages/download-center), identifies model **C0CA-FP027**: AIO 1.0, Ascent Lite, 78 mm motor diagonal, 1102 14000 KV motors, HQprop U40mm×3GR-PC-1.5mm, 110 × 102.8 × 41 mm envelope and 104.4 ± 1.5 g weight. It does not state that weight’s battery basis.

The [manufacturer battery page](https://www.caddxfpv.com/products/caddxfpv-protos-battery) identifies **C0PJ-DC016**, 2S1P 840 mAh Li-ion, 15C, 41.9 ± 0.5 g and 77.5 × 24 × 21 mm. Its energy is 6.384 Wh. The resulting 7.6 V energy/capacity ratio is calculated. A 15C rating implies 12.6 A arithmetically; it is not a measured current-versus-sag curve. Listed operating voltage reaches 8.70 V, while maximum charging voltage is 8.5 V: do not select 8.7 V as the default charged state solely from the operating range.

[WE are FPV's November 2025 hands-on review](https://www.wearefpv.fr/test-caddx-protos-ascent-20251124/) describes testing a supplied kit and explicitly says the aircraft weighs a little over 100 g **with battery**. This corroborates interpreting 104.4 g as flying mass; it is not an exact scale result. On that interpretation, **62.5 g dry = 104.4 − 41.9 g**, a calculation. Adding the two manufacturer tolerances gives a conservative 2.0 g subtraction bound; no statistical confidence interval is established. Manufacturer confirmation or an identified sample weighed both ways remains desirable.

The manual distinguishes stock Poshold, Angle and Acro. Poshold uses position/height sensing and cannot be represented by generic SIM self-level. Stock Angle also limits tilt and throttle. Acro offers 300/400/500 degrees/s maximum-rate choices, but the full curve, expo and response are unspecified. Offer only clearly named SIM Acro/self-level behavior; any starter curve is SIM-authored. Do not claim the factory hold, latency, firmware, PID tune or exact feel is reproduced.

The download center now lists Protos Betaflight firmware and drone/canopy 3D models. The [official Betaflight target](https://support.betaflight.com/targets/CADDX_PROTOS_F4) also exists. Consequently, “cannot run Betaflight” is not an accurate blanket exclusion. Neither existence establishes stock-firmware equivalence or a verified preset conversion. Asset redistribution licensing was not established; public availability alone does not authorize bundling those CAD files.

## Propulsion and remaining implementation evidence

No complete, matched Cetus X or Protos motor/propeller/ESC map was found in this bounded review. The [Protos replacement-motor page](https://www.caddxfpv.com/products/caddxfpv-1102-14000kv-brushless-motor-1-pc) identifies a part, not a validated thrust/current/RPM map. Do not substitute a different 1102/1103 motor or similarly sized propeller’s measurements.

For both candidates, center of mass, inertia, precise rotor placement, collision envelope, thrust/torque maps, motor transients, aerodynamic drag, battery resistance and controller gains need explicit estimate labels until suitable measurements exist. Current partial evidence does not validate high-speed drag or flight endurance. Runtime implementation would still require catalog/accounting tests, numerical qualification, editable-setting checks and representative practice flights across hosts. This review supplies the bounded evidence decision only.
