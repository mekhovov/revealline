# Shared mission selectors — 5 October 2026

The main game, Snake, Academy, Worlds/School and Gym now use the same mission
browser. Engines provide their catalogue, exact progress, read-only diagrams and
native launch callback; they do not implement another card grid or navigation
surface. Optional SIM packages receive the canonical browser through the existing
generated play-shell module and stylesheet.

## Delivered behavior

- All current missions remain in one scrollable gallery: 144 Snake missions in
  23 chapter sections, 204 Worlds/School courses, 12 Academy lessons and 12 Gym
  drills. Campaign controls jump within the gallery instead of hiding other
  chapters. Search and explicit filters can narrow the results.
- Cards show complete board/route schemes, mission names, stable numbers and
  earned progress. Snake uses native read-only starting boards; SIM adapters show
  actual checkpoints, targets, patrols and supported collision geometry.
- Selecting a card launches directly. Browsing, changing a filter and Back do not
  replace the accepted attempt. Failed scene loading restores a usable picker;
  leaving while a scene loads cannot steal Home's focus or launch a stale choice.
- Search, keyboard/controller navigation, focus restoration, Random, pinned goals,
  lazy preview allocation and compact layout have one implementation.
- Small layouts keep search and launch/Back controls visible. Secondary goal and
  rule controls live in disclosures. Full schemes use `contain`, not a cropped
  strip. Rotating immediately after clearing search keeps the new first result.
- Preview resources are released when cards leave view, owners disappear, rows
  change or the picker closes. Previews never advance or award gameplay.

## Verification

Source tested on `codex/snake-continuous-play` after integration with main
`e3e1e8b8d3b061a85c77f7bc82159db810dff688`.

| Check                                                                        | Result                                                            |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Shared browser, chooser, compact navigation, goal, menu retune and Gym suite | 137 passed                                                        |
| Snake host/adapter and main host row-focus suite                             | 87 passed                                                         |
| Academy, Worlds and replay-rate suites                                       | 80 passed                                                         |
| Gym and canonical SIM projection suite                                       | 20 passed; overlaps the shared run                                |
| Optional-package and default runtime metadata suite                          | 14 passed                                                         |
| Repository validation                                                        | Passed, including localization and byte-identical projections     |
| Repository lint                                                              | Passed                                                            |
| Worlds diagram sweep                                                         | 408 diagrams (204 courses × two flight modes), finite coordinates |

Real in-app browser checks used a separate localhost preview origin on port 50361. No player profile was cleared or imported. Verified:

- Snake: all 144 cards, chapter jumping, scrolling, cross-chapter search, one-click
  Contour Orbit launch, and a paused return to the chooser.
- 320×568 portrait: zero horizontal overflow; Snake and Worlds footer bottom
  558.8px and footer height 73.8px. Snake gallery retains about 306px of height.
- 740×360 Ukrainian Team: complete two-player boards, zero horizontal overflow,
  footer within the viewport, and reachable rule controls.
- Search → clear → immediate rotation: scroll remains at zero and Level #1 stays
  selected rather than jumping to a retired search anchor.
- Worlds: 204 cards and distinct target arrangements in the first six Hunt maps;
  First three starts with one activation and reaches Flight active.
- Academy: 12 cards; Fly a square starts with one activation.
- Gym: 12 cards; Four corners starts with one activation.

Preview allocation remains bounded near the viewport (12 Snake canvases for 144
cards in the observed desktop view); the full catalogue is still scrollable.

New main-game browser checks encountered the existing password gate and did not
bypass it. Main host compatibility is covered by automated chooser/focus tests.
Physical controller and touch hardware were not exercised; controller behavior
was covered by automated tests and touch-sized layouts by browser inspection.
No full distribution ZIP was rebuilt for this selector-only change. Package
policy, locale projection and canonical generation checks passed; earlier ZIP
receipts belong to their recorded source revisions.

## Screenshots

- [Snake desktop](snake-desktop.png)
- [Snake phone](snake-phone.png)
- [Snake Ukrainian Team, short landscape](snake-team-uk-landscape.png)
- [Worlds desktop](worlds-desktop.png)
- [Worlds phone](worlds-phone.png)
- [Academy phone](academy-phone.png)
- [Gym phone](gym-phone.png)
