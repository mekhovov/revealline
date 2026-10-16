# Operation Frontiers — Release B, 13 October 2026

The production catalogue now contains **240 missions in 35 chapters**. This release adds the second 48 missions, completing the approved 96-mission expansion count. The original-catalogue audit is tracked separately in #1164.

## Delivered

| Chapter | Distinct decisions |
| --- | --- |
| Signal Smugglers | Carry freight around local coverage, intercept broadcast sources, choose Pulse detours, and hold receiver shortcuts during changing reception. |
| Breaking Ground | Choose permanent eroded notches versus temporary cable gates, unload before a breach, and use excavation routes around ricochets. |
| Refuge Labyrinths | Predict announced shelters, redirect prey through garden forks, hold hedge shortcuts, and alternate three delivery courts. |
| Supply Gambits | Trade distance for Pulse or Reel, manage a short cable at a long gate, choose which supply to take, and combine delivery with changing encounters. |
| Twin Operations | Share cargo progress and relay activations, use opposed levers, coordinate two gates, and complete simultaneous Team extraction. Every mission also supports Solo. |
| Living Citadels | Combine dispatch, cargo, reception, warned fire, wrapping, machinery and three-stage deliveries in reclaimed stone courts. |

All 48 have explicit geometry and EN/UK tactical descriptions. They use the existing v5 engine, shared selector/status/preview renderer and continuous-play controller. Cargo and switches do not count as enemies. Variable jammer missions retain completion stars and exact personal records, without fixed-schedule higher grades.

## Evidence

- **288** authoritative winning input journals: 48 missions × Solo/Team × slow/normal/fast.
- **180** additional verified wins across hazard seeds 73 and 2026, covering all 15 variable-jammer missions in both modes and all paces. Seed tampering fails verification.
- Across Releases A and B, **576** winning records saved and reopened. Serialized storage measured **2,270,243 bytes**, below the existing 24 MiB logical proof budget.
- 16 catalogue/library/world integration tests and all four B qualification/capacity tests pass. Historical pilot and accepted-artwork regressions found by the broader run are fixed in the audit PR.
- Shared-source generation is byte-identical; localization check passes.
- Browser: all 240 missions appear in the shared selector. Ukrainian search finds the finale and one activation launches it directly. Team cargo plays to completion in the lab. At 320px the board is 296px wide with no document overflow. A 667×320 pause keeps Resume available and other actions scrollable.

## Still required for the full expansion plan

Per-mission visual focal arrangements and richer state-driven reactions; final four-look/six-world visual acceptance; bounded terrain caching and comparative frame timings; final full/optional/offline packaging; physical-device/controller and player observation. The mission/proof counts above do not claim these remaining acceptance items or establish subjective enjoyment.
