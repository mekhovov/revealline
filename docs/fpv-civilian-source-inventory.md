# Civilian source-kit inventory and disposition

Reviewed **18 October 2026**. The Swarm page checks completed at **19:22 CEST
(17:22 UTC)**. This is a source inventory and a mapping to existing SIM aircraft;
it does not add presets or claim measured flight equivalence.

Current priorities: [SIM completion plan](fpv-current-completion-plan.md).
Aircraft details and modeling limits: [civilian kit references](fpv-civilian-kits.md).

## Result

- **Swarm: 41 public kit records accounted for:** one explicitly civilian kit
  maps to the implemented Mobula8, three are equipment/supplies rather than
  aircraft, eighteen are excluded military-specific entries, and nineteen remain
  ambiguous collections without an established civilian reference.
- **Spreadsheet: all 10 returned tabs accounted for.** Their titles, headings or
  introductions identify military use. All are excluded from the recreational
  implementation; none is an additional implemented SIM aircraft.
- The game retains **13 aircraft presets**. The source name **Кімнатний пілот**
  maps to **Happymodel Mobula8**; it is not a second aircraft with a kit name.
- The earlier request to implement every kit is therefore **not fulfilled as
  stated**. This inventory closes the missing source-disposition record, not the
  unresolved civilian definitions or the excluded military scope.

“Excluded” is a scope decision, not a technical backlog or an ETA. “Ambiguous”
is not a claim that a collection is military: the inspected source metadata does
not establish a complete civilian reference suitable for a named preset.

## Access and completeness

The [Swarm kits page](https://swarm.army/kits) serves a JavaScript loading shell.
Its HTML explicitly preloads the first-party
[kit feed](https://static.swarm.army/kits.json) and
[model feed](https://static.swarm.army/models.json). The kit feed returned 41
records marked public. Every corresponding `/kits/<slug>` URL below was retrieved
and returned HTTP 200; each response was the application loading shell. Names and
descriptions were therefore inspected in the site's declared data feed, rather
than inferred from search snippets. This is not a claim that 41 rendered browser
screens were visually checked. No authenticated/private kits, historical/deleted
records or future additions are included.

The connected Google Sheets metadata returned the workbook **Рекомендовані
компоненти - Народний FPV**, its exact ten tab names and IDs. A bounded header and
introduction read succeeded for every tab: `A1:G8` on the first five and `A1:F8`
on the remaining five. That was enough to establish their stated purpose. This
inventory deliberately does not reproduce or evaluate military component lists,
combination choices, performance, payloads or operating instructions. It does not
claim a cell-by-cell inspection of those excluded configurations. The web
extractor alone could not open the workbook; connector reads succeeded. No tab
returned by metadata was inaccessible, and no additional tab was assumed.

Source snapshot checksums, for audit comparison rather than availability claims:

| Public first-party data |   Bytes | SHA-256                                                            |
| ----------------------- | ------: | ------------------------------------------------------------------ |
| `kits.json`             |  10,413 | `990d0f1ab8dd55f9191801192273569655c69c26a232527f5593d8c965fca770` |
| `models.json`           | 147,780 | `b3b906f9e9ff16a0180402429afcae3dd3d22d34e15e93cbf2557a29263f364b` |

These feeds may change. A future audit must refresh the inventory rather than
assuming this count remains current.

## Swarm: every returned public kit

Names below retain the source spelling and punctuation. Military entries are
listed only by name and disposition; no component combinations are derived.
Every row's source page returned HTTP 200 during this review.

| Exact source name / page                                                       | SIM status                            | Reason or mapping                                                                              |
| ------------------------------------------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [SD 7" Основний](https://swarm.army/kits/sd-7-optimal-kit)                     | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [SD 10" Основний](https://swarm.army/kits/sd-10-main-kit)                      | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [SD 7" НЕ баланс](https://swarm.army/kits/sd-7-budjet-kit)                     | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [SD 8" Основний](https://swarm.army/kits/sd-8-main-kit)                        | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [VD 7" Основний](https://swarm.army/kits/vd-7-optimal-kit)                     | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [VD 8" Основний](https://swarm.army/kits/vd-8-optimal-kit)                     | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [VD 10" Основний](https://swarm.army/kits/vd-10-optimal-kit)                   | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [Тестовий Бомжоліт 7"](https://swarm.army/kits/test-bomj-7)                    | Ambiguous — not implemented           | No purpose or complete civilian reference revision stated.                                     |
| [MAFIA Камік 7 v2](https://swarm.army/kits/mafia-7-v2)                         | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [Дід Панас 10"](https://swarm.army/kits/SD10_Did_Panas)                        | Ambiguous — not implemented           | No civilian purpose or complete reference revision stated.                                     |
| [DK 7"](https://swarm.army/kits/dk-7)                                          | Ambiguous — not implemented           | No purpose or complete civilian reference revision stated.                                     |
| [SD 10" оптимальний XL10 V6 + Dua](https://swarm.army/kits/sd10-optima-xl10)   | Ambiguous — not implemented           | Component names alone do not establish a complete civilian aircraft.                           |
| [24 ОМБр](https://swarm.army/kits/24ombr)                                      | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [MAFIA Бомбер 8](https://swarm.army/kits/mafia-8b)                             | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [TDD 10'' 4.9](https://swarm.army/kits/tdd-10)                                 | Ambiguous — not implemented           | No purpose or complete civilian reference revision stated.                                     |
| [SD 10 YaVa](https://swarm.army/kits/sd-10-yava)                               | Ambiguous — not implemented           | No purpose or complete civilian reference revision stated.                                     |
| [Соц-Ретранслятор](https://swarm.army/kits/social-retranslator)                | Ambiguous — not implemented           | Source describes an airborne relay; no recreational aircraft or flight model is pinned.        |
| [SWARM 13"](https://swarm.army/kits/swarm-13)                                  | Ambiguous — not implemented           | No civilian purpose or complete reference revision stated.                                     |
| [SD 10" оптимальний Mark 4 + Dual](https://swarm.army/kits/sd-10-optimal-dual) | Ambiguous — not implemented           | Component names alone do not establish a complete civilian aircraft.                           |
| [10-тка бомбер](https://swarm.army/kits/10-bomber-ksn)                         | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [SD 8" + Flashhobby](https://swarm.army/kits/sd8-flashhobby)                   | Ambiguous — not implemented           | A component variant is named, without a complete civilian reference.                           |
| [SD 8" + ReadytoSky](https://swarm.army/kits/sd8-readytosky)                   | Ambiguous — not implemented           | A component variant is named, without a complete civilian reference.                           |
| [Бомжоліт 7"](https://swarm.army/kits/bomj-7)                                  | Ambiguous — not implemented           | The source itself does not recommend this collection; no validated civilian reference.         |
| [DK 10"](https://swarm.army/kits/dk-10)                                        | Ambiguous — not implemented           | No purpose or complete civilian reference revision stated.                                     |
| [V1 7"](https://swarm.army/kits/dmytro-v1-7)                                   | Ambiguous — not implemented           | No purpose or complete civilian reference revision stated.                                     |
| [Шкварка 8”](https://swarm.army/kits/shkvarka-8)                               | Ambiguous — not implemented           | No purpose or complete civilian reference revision stated.                                     |
| [дронарня](https://swarm.army/kits/axdrone)                                    | Ambiguous — not implemented           | Parts-oriented description; no single complete civilian aircraft pinned.                       |
| [Паяльне обладнання](https://swarm.army/kits/soldering)                        | Not an aircraft                       | Tools, equipment or consumables; not a drone preset or installed aircraft mass.                |
| [SD 10" Бомбер-аналог](https://swarm.army/kits/sd-10-bomber-analog)            | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [SD 10" Бомбер-цифра](https://swarm.army/kits/sd-10-bomber-digital)            | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [Розхідники для батарей](https://swarm.army/kits/batteries)                    | Not an aircraft                       | Tools, equipment or consumables; not a drone preset or installed aircraft mass.                |
| [Інструменти](https://swarm.army/kits/tools)                                   | Not an aircraft                       | Tools, equipment or consumables; not a drone preset or installed aircraft mass.                |
| [Кімнатний пілот](https://swarm.army/kits/home-pilot)                          | Implemented civilian aircraft mapping | Happymodel Mobula8 → `mobula8-analog-2023`; kit name and aircraft name are distinct.           |
| [SD 10" ППО](https://swarm.army/kits/sd-10-anti-air)                           | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [SWARM 8"](https://swarm.army/kits/swarm-8)                                    | Ambiguous — not implemented           | Generic kit description; civilian purpose and complete variant remain unspecified.             |
| [VD 10" Бюджетний](https://swarm.army/kits/vd-10-budjet)                       | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [SD 10" UA](https://swarm.army/kits/sd-10-ua-kit)                              | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [тест товарів](https://swarm.army/kits/testukr)                                | Ambiguous — not implemented           | Test collection; no complete named civilian aircraft identified.                               |
| [SD ArduPilot бомбер](https://swarm.army/kits/sd-10-ardupilot-bomber)          | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |
| [SD 7"](https://swarm.army/kits/dron-31)                                       | Ambiguous — not implemented           | No purpose or complete civilian reference revision stated.                                     |
| [SDUA ППО 9" (8s)](https://swarm.army/kits/sd-10-anti-air-8s)                  | Excluded — military-specific          | Source title or description identifies a military configuration; no operational model created. |

## Civilian kit mapping: Кімнатний пілот

The [source kit](https://swarm.army/kits/home-pilot) explicitly describes civilian
flying. Its aircraft entry is spelled **Happymodel Mobula 8** in the source model
feed. The SIM displays **Happymodel Mobula8** and freezes the **2023 analog SPI
ELRS** manufacturer variant as `mobula8-analog-2023`, revision 1. The kit does not
pin every board revision or supplied battery, so this is an explicitly documented
reference selection, not an exact reproduction of every retail option.

The other eight kit entries are ground equipment: RadioMaster Boxer ELRS M2,
VIFLY ShortSaver2, HappyModel ES900TX ELRS 915MHz Micro TX, SKYZONE Cobra X V2/V4,
ToolkitRC M7, ToolkitRC ADP200, VIFLY ToothStor and LCD5802D 5.8G 40CH 7" Monitor.
They do not become separate aircraft and are not added to airborne mass. Radio
and video transmission are not emulated by the SIM.

The existing preset uses the named manufacturer's assembled aircraft and an
explicitly selected reference battery. Its geometry is simplified; propulsion,
inertia, drag and other unmeasured coefficients remain estimates. See
[the complete variant, evidence and conflicts](fpv-civilian-kits.md#happymodel-mobula8-analog-2023-spi-elrs).
This audit does not alter its flight behavior, visuals or saved configuration.

## Spreadsheet: every returned tab

Workbook: [Рекомендовані компоненти - Народний FPV](https://docs.google.com/spreadsheets/d/1nCYfjbcyr1H6p-15pXcK9bmx5YWTSem229Sen8fiLLo/edit).
The ten rows follow the source tab order; each link opens its exact `gid`.
All header/intro reads succeeded. Each disposition is **Excluded — military-specific;
not implemented as a recreational SIM preset**.

| Exact tab name / source                                                                                                                         |     Tab ID | Disposition evidence                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------: | ---------------------------------------------------------------------------------- |
| [7inch - Народний FPV](https://docs.google.com/spreadsheets/d/1nCYfjbcyr1H6p-15pXcK9bmx5YWTSem229Sen8fiLLo/edit#gid=863560665)                  |  863560665 | Heading identifies a military attack configuration.                                |
| [8inch - Народний FPV](https://docs.google.com/spreadsheets/d/1nCYfjbcyr1H6p-15pXcK9bmx5YWTSem229Sen8fiLLo/edit#gid=189503767)                  |  189503767 | Heading identifies a military bomber configuration.                                |
| [10inch - Народний FPV](https://docs.google.com/spreadsheets/d/1nCYfjbcyr1H6p-15pXcK9bmx5YWTSem229Sen8fiLLo/edit#gid=1559269264)                | 1559269264 | Heading identifies a military bomber configuration.                                |
| [10inch - бюджетна десятка](https://docs.google.com/spreadsheets/d/1nCYfjbcyr1H6p-15pXcK9bmx5YWTSem229Sen8fiLLo/edit#gid=419522671)             |  419522671 | Heading names a military unit and purpose.                                         |
| [10inch - дрон на оптоволокні](https://docs.google.com/spreadsheets/d/1nCYfjbcyr1H6p-15pXcK9bmx5YWTSem229Sen8fiLLo/edit#gid=1474153111)         | 1474153111 | Introduction identifies military use; no communication or component model derived. |
| [десятка для 77ОАМБр](https://docs.google.com/spreadsheets/d/1nCYfjbcyr1H6p-15pXcK9bmx5YWTSem229Sen8fiLLo/edit#gid=405459374)                   |  405459374 | Title and heading name a military unit.                                            |
| [10inch - Pilotix](https://docs.google.com/spreadsheets/d/1nCYfjbcyr1H6p-15pXcK9bmx5YWTSem229Sen8fiLLo/edit#gid=1972070624)                     | 1972070624 | Introduction identifies military use.                                              |
| [13inch - Народний FPV](https://docs.google.com/spreadsheets/d/1nCYfjbcyr1H6p-15pXcK9bmx5YWTSem229Sen8fiLLo/edit#gid=1438253294)                | 1438253294 | Heading identifies a military bomber configuration.                                |
| [15inch - Народна цифра](https://docs.google.com/spreadsheets/d/1nCYfjbcyr1H6p-15pXcK9bmx5YWTSem229Sen8fiLLo/edit#gid=1385780565)               | 1385780565 | Heading identifies a military bomber configuration.                                |
| [15inch - логіcтичний дрон для 65ОМБр](https://docs.google.com/spreadsheets/d/1nCYfjbcyr1H6p-15pXcK9bmx5YWTSem229Sen8fiLLo/edit#gid=1997831413) | 1997831413 | Title names a military unit; introduction identifies military use.                 |

## Remaining civilian decisions and estimates

| Priority | Item                                                     | Current status and next dependency                                                                                                                                                                                                                                                          | Planning estimate                                                                                                                                                                                                                     |
| -------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P2       | Nineteen ambiguous Swarm collections                     | No complete civilian reference is established. Clarify civilian purpose and exact variant before deciding whether any distinct preset is appropriate; do not assume every parts collection is a flyable aircraft.                                                                           | No delivery date until the identity/purpose is resolved. A newly supported civilian preset may take approximately 1–3 working days for implementation and basic software checks after complete evidence, excluding measured fidelity. |
| P2       | Exact kit label versus aircraft label                    | Documented mapping is complete: Кімнатний пілот → Happymodel Mobula8. The retail kit is not a separate airframe.                                                                                                                                                                            | Complete for this inventory; no runtime rename was made.                                                                                                                                                                              |
| P2       | Cetus X and CADDXFPV Protos civilian research candidates | These are separate previously researched retail candidates, not additional entries in either inventory above. Battery-weight/variant ambiguity and proprietary assistance remain unresolved; see [candidate details](fpv-civilian-kits.md#civilian-kit-discovery-and-remaining-candidates). | No calendar ETA before those specifications and supported behavior are established.                                                                                                                                                   |
| P2       | Measured real-aircraft equivalence                       | Existing SIM estimates are labeled honestly. Suitable matching bench data and flight logs remain unavailable; source component names cannot establish exact behavior.                                                                                                                       | Not responsibly dateable until a measurement/fitting scope and appropriate data exist.                                                                                                                                                |
| Excluded | Military-specific entries                                | The 18 site entries and all 10 spreadsheet tabs above have no operational component model or simulation preset in this recreational scope.                                                                                                                                                  | No implementation ETA; this is an exclusion rather than blocked work.                                                                                                                                                                 |

The estimates are conditional effort ranges, not scheduled delivery promises. The
source inventory itself is complete for the public records and accessible tabs
returned on the review date. Ordinary practice, existing presets and continued
software work do not depend on resolving these remaining source ambiguities.
