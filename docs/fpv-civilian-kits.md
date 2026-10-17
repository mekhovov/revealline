# Civilian FPV kit references

Checked 18 October 2026. This addition models the civilian Happymodel Mobula8 whoop for recreational practice. It does not reproduce military configurations or equipment. Other catalog aircraft remain available with their existing saved configurations.

## Happymodel Mobula8 analog, 2023 SPI ELRS

Preset ID: `mobula8-analog-2023`, preset revision 1. The catalog is revision 2; adding an aircraft does not change the original twelve presets' revision numbers or complete numerical configurations.

The [manufacturer's original analog aircraft specification](https://www.happymodel.cn/index.php/2023/04/29/happymodel-mobula8-1-2s-85mm-micro-fpv-whoop-drone/) identifies this frozen configuration:

| Component or property | Reference                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------------- |
| Assembled aircraft    | 43 g, excluding battery; includes installed electronics, motors, propellers and video system |
| Frame                 | Mobula8, 85 mm wheelbase; published aircraft envelope 120 × 120 × 50 mm                      |
| Motors                | Four EX1103, 11000 KV                                                                        |
| Propellers            | Gemfan Hurricane 2023, three blades, 1.5 mm shaft                                            |
| Flight controller     | X12 ELRS V2.1; STM32F411; published sensor alternatives ICM20689 / ICM42688P                 |
| ESC                   | Integrated BLHeli_S 4-in-1, 12 A per channel                                                 |
| Receiver              | Integrated SPI ExpressLRS 2.4 GHz                                                            |
| Video                 | Caddx ANT 1200 TVL camera and onboard OpenVTX                                                |
| Reference pack        | SIM-selected LAVA 2S 450 mAh LiHV, XT30                                                      |
| Flying mass           | 69.1 g: assembled 43 g plus one 26.1 g pack                                                  |

The current manufacturer page also mentions X12 V2.3 and links newer products. Those changes are not silently substituted into the 2023 preset. Radio, ESC and camera descriptions identify installed components; the SIM does not execute their firmware or emulate radio/video transmission.

The aircraft maker recommends 2S 450–650 mAh packs but supplies no battery. The [BETAFPV LAVA pack specification](https://betafpv.com/products/lava-2s-3s-4s-450mah-75c-battery-2pcs) supplies the selected 450 mAh pack's 26.1 g mass, 7.6 V nominal voltage and 63 × 15.5 × 13.5 mm envelope. This is an explicit SIM reference choice within the recommended capacity, not a claim that Happymodel bundles or endorses this particular pack. Actual frame retention/clearance has not been measured.

## Conflicting dimensions and modeling limits

The aircraft page describes its installed Gemfan 2023 propeller diameter as **52.17 mm**. The separate [2023 Mobula8 frame page](https://www.happymodel.cn/index.php/2023/04/28/mobula8-frame-85mm-brushless-whoop-frame/) gives a **51 mm** maximum. The preset follows the complete-aircraft installed-component specification, retains the conflicting frame figure in its visible provenance, and makes no claim of measured duct clearance. The frame source describes its color as transparent black. Published overall dimensions guide the representation; the body and ducts remain simplified geometry.

Mass, motor identity, propeller identity and wheelbase are manufacturer specifications. Center of mass, inertia, rotor arrangement, thrust, reaction torque, motor response, drag, pack resistance/current limits and controller gains remain documented estimates. No matched bench map or flight-log fit has been supplied. Similar motor size or KV is insufficient to establish exact flight behavior.

The preset uses the common aircraft-aware physics, collision, practice, recording and recovery paths. Its default battery depletion is off. Actual starter rates use 100°/s center sensitivity, 600°/s maximum and 25% expo on each axis; these are SIM-authored settings. Selecting a preset keeps the existing choice between aircraft starter rates and the player's current rates.

## Regression coverage

Catalog tests check component accounting, revision pinning, immutable descriptive metadata, source conflicts, complete numerical configurations and all original configuration hashes. The shared checks iterate over the catalog, so new aircraft receive the same physical-validity and editable-component coverage without a fixed twelve-aircraft assumption. Numerical qualification and visual acceptance are separate from whole-aircraft measurement validation.

## Civilian kit discovery and remaining candidates

The [Indoor pilot kit](https://swarm.army/kits/home-pilot) explicitly describes civilian flying and lists the Mobula8 alongside ground equipment. Radios, goggles, chargers and tools are not separate aircraft or additional airborne mass. The new preset freezes a named manufacturer variant because the retail kit does not pin every board revision.

The wider source catalog and spreadsheet include military-specific configurations; those were excluded from this recreational implementation. No component combinations or operational models were derived from those entries.

Additional civilian kits sold in Ukraine were checked against primary manufacturer documentation:

| Candidate                        | Sources                                                                                                                                                       | Reason it remains a research candidate                                                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BETAFPV Cetus X, Betaflight ELRS | [Manufacturer](https://betafpv.com/products/cetus-x-brushless-quadcopter), [Ukrainian retailer](https://wondertech.ua/ua/drones/kvadrokopter-cetus-x-fpv-kit) | Published 55 g weight does not explicitly state whether batteries are included. Supplied BT2.0 cells are not identified sufficiently to assume the newer LAVA pack mass. The proprietary Cetus-controller variant is a separate aircraft. |
| CADDXFPV Protos RTF              | [Manufacturer](https://www.caddxfpv.com/products/caddxfpv-protos-fpv-drone-rtf-kit), [Ukrainian retailer](https://flymod.net/item/protos_rtf_kit)             | Published aircraft weight does not state the battery-inclusion basis. Proprietary assisted flight is not reproduced by the independent SIM controller.                                                                                    |

These are international brands offered by Ukrainian retailers, not claims of Ukrainian manufacture.

## Visual presentation

The shared aircraft picker now shows an offline top view, front direction, a metric scale, propeller diameter and the simulated rotor/body span for every catalog aircraft. It explicitly describes the simplified, fitted-to-panel view. Published product-envelope dimensions and the estimated collision geometry are different quantities.

The Mobula8 in-flight model uses dark ducts, a contrasting orange canopy, three-blade props and an underslung battery. Appearance is illustrative, not photogrammetry or manufacturer CAD. Visual descriptors never affect the flight configuration, collisions, recording hashes or comparison rules. Existing two-blade references also show two blades.

Local checks passed: 61 aircraft/catalog/physics/runtime/course/qualification tests, including the full catalog against the 2 kHz numerical reference; 17 offline-package/native-build tests; and 101 focused preview/tuning UI tests. The course launch matrix now covers 13 presets × 216 courses × two flight modes (5,616 launches). These checks establish software and numerical behavior, not measured real-aircraft equivalence.
