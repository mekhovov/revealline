# First Light R2: playtest revision

Status: source integration and browser verification in progress. This is the response to the eight deficiencies reported in v0.23, not completion of the whole P0–P9 roadmap.

## Change and evidence register

| Requirement | Change | Acceptance evidence |
| --- | --- | --- |
| Stop on closing a cut | Optional `rules.stopOnCapture` in level.v4; solo/couch clear intent before the next substep | 12 core checks; actual solo save/load/both turning policies; four couch keyboard/controller multi-substep regressions. Archived recipes unchanged. |
| Stronger pressure | Separate 65/75/85% R2 chapter; faster field motion, contour, rover, erosion, terrain/pickups and telegraphed lanes | 12 normal-input verified routes; release tick after each nonterminal capture. Old timed routes fail on R2, and remain valid in their own edition. Human challenge assessment still pending. |
| Character animation and size | Facing-aware four-theme enemy bodies, moving treads/rotors, CSS-size compensation for enemies and player | 59 focused presentation/reward checks, separate contact markers, Pause/Freeze/reduced-effects support. Browser inspection performed; no physical-device claim. |
| Cut and capture feedback | Bright contrast core, bounded short tails and newly secured-cell sweep | Cosmetic effects never modify coverage/score; replay checkpoints unchanged. |
| Keyboard/controller menus | Actual top-modal order, opener restoration, neutral gate after native handoff, Help/achievement readers, ordinary audition controls | 133 affected navigation checks. Actual browser keyboard Title→Missions→Collection→Escape restored Missions and its Collection opener without resuming. |
| Consistent native presentation | Bundled pixel font, sharp controls, full-screen briefing/pause, dark panels; chapter/mission picker enhancement | Desktop and phone browser checks found and corrected legacy arena caps, small-text fallbacks, clipped briefings and landscape overflow. Final picker/responsive pass pending. |

## Scope boundaries

R2 deliberately reuses the three original First Light pictures. It does not count them as additional illustrations or claim a finished video library. P5 shared media storage remains a separate prepared source change and is excluded from this revision. Browser audio backup/download qualification, physical controllers, actual phones/handhelds, signed packages, network play and public deployment retain their separate gates.

The prior v0.23 and v0.24 releases remain independently playable. Exact candidate source gates, immutable packaging and HTTP checks will be linked here after they pass. [Requirement/priorities register](../../implementation-roadmap.md) and [reference decisions](../../research/first-light-playtest-r2.md) record why this revision takes priority over bulk production.
