# Round 09 — Ground equipment, support systems and military roles

Accessed **12 September 2026**. The companion [reference catalog](../../authoring/catalogs/round-09-ground-references.json) contains **34 curated entries and 34 distinct primary-source URLs**. It is an extensible starting library, not a complete equipment inventory, current order of battle, recognition manual or runtime content pack.

The useful game-design opportunity is a mixture of **patrols, region hazards, objective nodes and support characters**. A different real-world machine need not require a different simulation. Several bodies can share one readable Xonix behavior; mission identity, cosmetics, challenge rules and map geometry remain separate.

## What was inspected, and what was not

This pass read public government, state-exporter and manufacturer text through the web tool. Individual catalog sources record whether the evidence was fetched page text, PDF text or an indexed official search extract. A search extract is useful for the narrow claim it exposes, but it is not a complete page review. No gameplay footage, equipment footage or equipment photographs were visually inspected in this particular ground-reference pass. All silhouette descriptions below are **proposed art direction**, requiring a later source-specific visual pass before anyone calls a sprite an accurate depiction.

Manufacturer and government material establishes public names, advertised classes or attributed reports. Marketing language, performance claims and wartime success claims are deliberately not carried into game balance. A dated delivery report is not a present deployment claim; a trade-show exhibit is not proof of an operational fleet; an export model is not proof that its origin country operates that version.

Some access limits were material. PRACTIKA's products page returned 503 on direct fetch, while official indexed text exposed KOZAK-2M1 and HORUNGY. Several Rosoboronexport PDFs were available only as indexed text; official Rostec HTML/indexed releases provide additional product identity. The KRET/Rostec EW article returned 502 on direct fetch. AutoKrAZ PDF text was retrievable, but a later image capture failed; no visual inspection is claimed for that brochure. The blocked Spetstechnoexport PDF and unresolved Proximus/Bukovel page were **not** used as foundations for entries. The catalog uses 80K6M and Kvertus instead.

## Curated roster

Public-reference context is source-backed within the limits above. **Every silhouette and game-use cell is our proposal**, not a real capability or procedure. The entry links lead to primary sources; the JSON retains additional corroboration and caveats.

| Reference | Origin / operator context | Proposed silhouette shorthand | Proposed Xonix role |
|---|---|---|---|
| [Oplot](https://progress.gov.ua/en/technika/osnovnyj-bojovyj-tank-oplot-4/) | Ukraine; state-export listing, operator unspecified | Wide tracks + faceted turret | Friendly reveal landmark or explicitly assigned heavy roamer |
| [BTR-4 Bucephalus](https://mod.gov.ua/en/news/a-bold-assault-warhorse-that-can-swim-btr-4-bucephalus-overview) | Ukraine; Ukrainian service described by MoD | Long wheeled hull + roof block | Allied transport objective |
| [KOZAK-2M1](https://practika.ua/produktsiya/) | Ukraine; manufacturer product listing | Short hood + angular crew box | Contour patrol skin |
| [Novator](https://ukrarmor.com/products/novator/) | Ukraine design; imported chassis; reported defense deliveries | Compact nose + separate rear platform | Allied supply marker |
| [Medical VARTA](https://ukrarmor.com/products/varta-is-an-aromoured-multi-purpose-vehucle-ampv-5/) | Ukraine; medical variant listed, generic family text | Tall rear body + original medical-kit badge | Evacuation-area objective |
| [KrAZ-6322 Soldier](https://www.autokraz.com.ua/downloads/KrAZ_military_vehicles_eng_cum.pdf) | Ukraine; AutoKrAZ cargo/personnel product | Long bonnet + cargo rectangle | Reclaimed-ground delivery token |
| [2S22 Bohdana](https://mod.gov.ua/en/news/german-quality-to-strengthen-the-bohdana-key-facts-about-the-zetros-chassis-for-200-units-of-bohdana-self-propelled-artillery-systems-to-be-delivered-to-ukraine-by-germany) | Ukraine system; chassis varies by version | Truck body + single barrel cue | Friendly artillery card landmark |
| [VILKHA](https://www.luch.kiev.ua/en/catalogue-of-product) | Ukraine; LUCH product listing | Truck + repeated short rack motif | Collection objective node |
| [NEPTUNE](https://www.luch.kiev.ua/en/catalogue-of-product) | Ukraine; LUCH product listing | Truck + long canister blocks | Coastal gallery objective node |
| [Kvertus EW family](https://kvertus.ua/en/) | Ukraine; EW manufacturer family | Case/antenna + waveform badge | Allied support node; separate fictional slow-field skin |
| [HORUNGY](https://practika.ua/horungy/) | Ukrainian modernization of Soviet BTR-60 | Wheeled lower body + taller cabin | Reusable contour patrol skin |
| [80K6M radar](https://progress.gov.ua/en/technika/mobile-three-dimensional-radar-station-80k6m/) | Ukrainian export offering; maker unresolved on page | Flat panel + small truck | Friendly information node |
| [Military communications node](https://mod.gov.ua/en/about-us/land-forces) | Category; communications component in MoD overview | Shelter/mast + linked-dot badge | Connection objective node |
| [Lynx UGV](https://roboneers.net/product/lynx) | Ukraine; Roboneers cargo/evacuation platform | Low wheeled deck + cargo module | Friendly courier token |
| [THeMIS cargo/evacuation variant](https://milremrobotics.com/milrem-robotics-delivers-the-themis-ugv-to-ukraine/) | Estonian origin; reported Ukrainian charity recipient | Twin track pods + low central deck | Supply/evacuation objective |
| [Magura V5](https://gur.gov.ua/en/content/ukraintsi-zibraly-shche-10-milioniv-na-udarni-magury-dlia-hur-mo) | Ukraine; GUR reference | Slim boat + small deck block | Sea-map player cosmetic |
| [Sea Baby](https://u24.gov.ua/news/avdiivka_navaldrone) | Ukraine; SBU project via UNITED24 | Broader angular boat + foam wake | Alternate sea-map player cosmetic |
| [T-90MS](https://rostec.ru/en/media/pressrelease/4518075/) | Russia; export model, operator unspecified | Broad tracks + forward barrel cue | Explicitly hostile open-field roamer skin |
| [BMP-3](https://roe.ru/pdfs/pdf_4442.pdf) | Russian export-product reference; operator unspecified | Low tracked wedge + small turret | Compact open-field roamer skin |
| [BTR-82A](https://roe.ru/pdfs/pdf_1886.pdf) | Russia; BTR-80A-derived export product | Wheeled long hull + small turret | Interior-contour patrol skin |
| [Ural-4320 family](https://uralaz.ru/models/ural-4320/) | Soviet-origin family; modern Russian products | Prominent hood + canvas cargo box | Mission-tagged logistics token |
| [Krasukha EW family](https://rostec.ru/en/media/news/ew-in-the-sky-and-on-the-ground/) | Russia; KRET/Rostec EW family | Dish/antenna + broken-wave badge | Fictional player-only slow-region node |
| [Pantsir-S1](https://rostec.ru/en/media/news/rostec-shall-create-overseas-service-centers-for-pantsirs/) | Russia; foreign customers explicitly discussed | Tall modules + central sensor cue | Telegraphed pulsing region-hazard node |
| [Tor-M2E](https://rostec.ru/en/media/news/rosoboronexport-to-demonstrate-modern-army-and-navy-equipment-at-defexpo-india-2018/) | Russia; export product, operator unspecified | Boxy tracked base + raised module | Distinct checkerboard region-hazard node |
| [Msta-S](https://rostec.ru/en/media/news/rostec-has-fielded-a-new-batch-of-the-msta-s-and-akatsia-self-propelled-guns/) | Russia; historical manufacturer delivery report | Tracked base + tall turret box | Slowly announced abstract tile pulse |
| [Tornado-G](https://rostec.ru/en/media/news/rostec-military-equipment-takes-part-in-wwii-victory-parade-/) | Russia; parade/product report | Truck + repeating rack blocks | Sequence of visibly announced board pulses |
| [Uran-6](https://rostec.ru/en/media/pressrelease/4518075/) | Russia; product listing for a mine-clearing robot | Small tracked machine + front attachment | Fictional territory eroder or recovery objective |
| [Military engineer / sapper](https://mod.gov.ua/en/about-us/support-forces-of-the-armed-forces-of-ukraine) | Military role category | Tool bag + spade/wrench badge | Repair/bridge objective |
| [Military medic / evacuation crew](https://mod.gov.ua/en/about-us/medical-forces) | Military support role category | Pack + original heart-in-bag badge | Friendly recovery objective |
| [Military logistics driver / mechanic](https://mod.gov.ua/en/about-us/logistics-forces-of-the-armed-forces-of-ukraine) | Military support role category | Box/wheel + wrench badge | Delivery objective |
| [Military command / communications staff](https://mod.gov.ua/en/about-us/land-forces) | Original combined military staff archetype | Headset/tablet + linked-dot badge | Briefing node or authored challenge-phase token |
| [Military observer / spotter](https://mod.gov.ua/en/about-us/land-forces) | Original military observation archetype | Binocular badge + compact figure | Image-clue objective or visible warning patrol |

| [Military infantry / patrol team](https://mod.gov.ua/en/news/the-list-of-combat-roles-and-military-specialties-available-to-volunteers-under-the-contract-18-24-program-has-been-expanded) | Role category; no individual unit or faction inferred | Compact figure/team + pack/equipment cue | Explicitly hostile military contour/ground patrol, or allied escort objective |
| [Military drone operator](https://mod.gov.ua/en/news/contract-18-24-list-of-afu-units-and-established-posts-for-unmanned-systems-operators-approved) | Role category; public operator specialties | Controller/goggles + original rotor badge | Allied scan objective or explicitly hostile military hazard-phase node |

The infantry/patrol and drone-operator entries complete the personnel range alongside engineer, medic, logistics, command/comms and observer roles. Their sources establish public military specialties; the opposing patrol or hazard-node variants are our fictional arcade proposals. The source country does not assign their game faction.

## Identity must remain separate from the machine

Store reference identity, design/manufacturing origin, historical source date, documented operator and fictional mission allegiance separately. An empty operator list means this pass did not establish one. It must not be filled from the origin field.

Three examples make the distinction concrete:

- HORUNGY is a Ukrainian modernization of a Soviet vehicle. Its lineage does not imply Russian ownership. [PRACTIKA's product description](https://practika.ua/horungy/)
- THeMIS provides the reverse pattern: a foreign-developed platform with a reported Ukrainian recipient. The 2022 Milrem source names a charitable organization, so it does not establish a particular military unit. [Milrem's delivery announcement](https://milremrobotics.com/milrem-robotics-delivers-the-themis-ugv-to-ukraine/)
- T-90MS is the export reference in this roster. T-90M is a different designation; the export listing does not substantiate T-90MS deployment in the Russian-Ukrainian war. [Rosoboronexport's SOFEX product list](https://rostec.ru/en/media/pressrelease/4518075/)

Captured equipment, transfers, locally modified vehicles and shared older families make allegiance especially unsafe to infer from shape. This roster does not claim that any particular pictured vehicle was captured. If a future level needs that story, add a dated source for that particular instance or label the situation fictional.

For the current Ukrainian FPV theme, friendly defenders and explicitly hostile invading military operators can have clear original badges and silhouettes. Civilian nationality, language, skin tone, a work uniform or a commercial truck must never define an enemy. Medical and evacuation roles in this catalog are support/rescue objectives. Use no **Z** markings anywhere in these concepts, and do not substitute an unverified real unit emblem for explicit game metadata.

## A small behavior vocabulary can support the whole roster

This is an authoring proposal, not a list of implemented behaviors:

| Behavior | Useful skins | Readable contract for a future level |
|---|---|---|
| Open-field roamer | Tank, IFV, compact robot | Round role badge; occupies unrevealed field; body detail never changes collision radius |
| Interior-contour patrol | APC, compact armored truck | Square route badge; follows the authored capture contour, including internal edges |
| Reclaimed-ground mover | Friendly courier, supply truck; separately authored hostile patrol | Road/footprint badge; rules state whether it is a support token or a hazard |
| Stationary objective node | Relay, radar, supply station, engineer | Diamond badge and a precise objective label: reveal, connect, deliver or restore |
| Region hazard | Fictional EW, air-defense or artillery skin | Warning outline, countdown and effect icon; cosmetic machine artwork does not determine the affected cells |
| Territory eroder | Original bulldozer/robot skin | Notched outline; a visible warning precedes any reclaimed-cell change |
| Support objective | Medic, evacuation carrier, mechanic | Clear friendly or neutral badge; positive recovery/delivery outcome |

This preserves the distinctions found in the [Reloaded research](round-05-reloaded-motion-audit.md) and [gameplay direction](../round-05-gameplay-direction.md): an open-field enemy, a line patrol, a revealed-ground enemy and a territory eroder are different roles. Reclaimed ground cannot be described as universally safe if a level includes a revealed-ground hazard.

Terrain remains a second, independent vocabulary. A **solid wall** blocks both player and enemies; **slow terrain** slows the player while enemies are unaffected when that rule is selected; a **lethal field** has explicit contact behavior. Do not draw all three as interchangeable dark patches. Keep the live cut, return edge and player head visible above machinery, antenna motion and picture detail. A slow-region skin inspired by EW is deliberately fictional: it does not describe radio propagation, equipment weaknesses or a real countermeasure.

## Three useful chapter prototypes

**Field atlas:** an allied FPV reveals an original rural Ukrainian illustration. A small open-field roamer and one interior-contour patrol teach the two movement domains. A logistics marker creates a second objective after the capture threshold. The reward is a vehicle or landscape gallery card, with the captured percentage retained accurately.

**Restore the network:** a fictional military relay, engineer and medical staging area form three visible objectives. Completing a region around each earns a different support reward. One telegraphed region hazard supplies pressure; completing a relay can pause that game hazard by an authored rule. This is a puzzle about territory and visible timing, without real communications or targeting procedures.

**Coastal postcards:** a Magura-inspired or Sea-Baby-inspired player body traverses the same authored capture geometry. Wake, ripple and deck animation are cosmetic components. Supply and lighthouse-like objective markers provide a coastal identity; background pictures can remain photographic, painted or pixel-art. A body change must preserve the selected immediate or grid-center-buffered turn mode.

These concepts fit the existing [gameplay plan](../round-08-gameplay-plan.md) and [character collection direction](../round-08-character-collection.md). Names, background art, palettes, sounds and body components can vary without turning a cosmetic reward into a stronger vehicle.

## Art and authoring recommendations

Build one clear silhouette for each behavior before drawing all 34 references. A compact production shortlist would be a player FPV, one APC patrol, one heavy roamer, one abstract region-hazard node, one courier robot and one medical objective. Other references become interchangeable skins or gallery subjects when there is an actual need for them.

Retain three presentations of the same geometry: **microtile**, **detailed** and **hybrid**. At the smallest size, a two-tone hull plus a role badge is more useful than trying to preserve each wheel or antenna. At larger sizes, the body, wheels/tracks, turret/antenna, wake, dust and feedback effects can be independent animation components. Any motion is driven by authored simulation state without changing the collider, heading response or turn mode.

Use muted olive, warm earth, indigo water and restrained Ukrainian blue/yellow accents where appropriate. Reserve the brightest small highlight for the player head and active cut. Machinery can be recognizable without making every object neon, copying manufacturer photography, reproducing logos or importing real military insignia. Original medical-kit/heart icons work better for this concept set than copying protected humanitarian emblems.

Each future asset recipe should carry its parent/reference link, allegiance, fictional role, original prompt, style, actual output dimensions, visual-review state and sprite-readiness result. A catalog entry is **reference-only**; it supplies neither an approved asset nor proof of working animation. A real implementation of any new challenge requires a separate ruleset change and tests.

## Validation performed

The JSON was checked for parseability, 34 unique IDs, the normalized atlas fields, valid source URL shapes, access dates, explicit reference-only status and non-empty caveats. The companion Markdown's local links were resolved against the workspace. These are research-artifact checks only: no runtime code, schemas, game rules or skills were edited by this subtask.

