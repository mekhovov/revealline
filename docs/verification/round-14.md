# Round 14 — authored pictures and returning players

Recorded 12 September 2026. This iteration delivers a three-picture illustrated Ukrainian chapter, clearer mission launch/continuation, and explicit copying from compatible earlier releases. The broader game goal remains active; this report is not a public-host, native-device or human-enjoyment certification.

## Implemented

- **Homeward Skies:** Copper Orchard, River Switchyard and Home Beacon each reveal a distinct original 1448 × 1086 pixel-art PNG. Exact sources and effective prompts are retained under `authoring/library/homeward-skies/`; built-in `image_gen` produced them. Actors, collision, cable, interference and effects remain independent layers. The installed pack carries its own three images and configurable synthwave, rock and ambient descriptors.
- **Measured equipment choices:** the chapter adapts the first three Fieldcraft layouts with its own campaign/reward identity. Six role routes demonstrate fiber resistance, supply/emitter suppression, hangar switching and impact recovery. Forty-two ordinary routes keep every class playable in both turning modes. Four action-omission traces establish particular benefits without inventing mandatory ability-event goals.
- **Continuation:** campaign entry offers the first accessible uncleared map. Saved flights have an explicit ready-screen action and restore paused through existing replay validation. A fully cleared campaign offers its collection and deliberate replay selection. Explicit map/gallery selections remain honored. Startup still opens the base campaign; selecting another installed campaign resolves that campaign's continuation.
- **Concise launch UI:** the card shows actual coverage, required objectives and hard limits. Full authored prose remains in Mission brief. Launch buttons sit outside scrolling text. Selecting a mission returns the board and launch control to view; the class selector says Starting class because a hangar can change the active craft during a flight.
- **Earlier-release copy:** release builds discover compatible same-origin profiles, review their complete contents, revalidate under the source's writer/backup locks, and compare a canonical SHA-256 fingerprint at Copy. Changed sources require another review action. Destination adoption uses the established backup journal and Undo path; no source writes or merge are introduced.
- **Tooling and guidance:** original-art embedding and legal-input browser-fixture generators, per-map source/proof records, transfer/art/chapter guides, two updated AI skills, and current reference research. The playground now reports whether launch actions fit inside its arena as well as measuring gameplay controls.

See [chapter details](../homeward-skies.md), [continuity contract](../continuity-transfer.md), [art workflow](../authored-art.md) and [reference findings](../research/round-14-player-continuity.md). The [v0.3.0 fulfillment audit](../round-14-fulfillment-audit.md) preserves the larger outstanding scope rather than redefining this iteration as a finished game.

## Automated evidence

The final source gate passes **605 tests**, lint, both formatting checks and structural validation, with no monitored source changes during the checks. [Exact source inventory and logs](round-14/source-gates.md) identify the tested inputs. Both changed skills passed the installed skill validator.

Homeward has **52 checked traces**: six role clears, 42 class/turn fallback clears and four omission comparisons. Existing expansion fixtures were preserved; six ordinary Homeward fixtures append to them. Content now totals **25 separately identified maps**, four expansion packs, seven gameplay classes and five ability primitives. The previous 308 map/class/turn combinations plus Homeward's 42 cover 350 configurations at authored seed 1. These overlapping proofs are not hundreds of human sessions or distinct mechanics.

Each embedded original matches its source PNG byte for byte. The pack is 11,371,849 bytes and fits the existing image, pack and offline limits without increasing them. Source prompts, actual dimensions and SHA-256 records appear in the [art identity audit](round-14/art-identity.json).

## Actual browser observations

Checks used an isolated origin on port 8796. Existing collections on the development/version server at 8767 were not replaced. The candidate was a working-tree build; exact frozen-artifact checks are recorded separately after committing.

**Transfer:** a v0.3.0 fixture was installed through that release's ordinary backup UI. Keeping it open caused Review to fail with a source-busy explanation. After closing it, Review reported two completed maps, five pictures, seven score records, two campaigns, three packs and one saved flight. Changing a preference in the source between Review and Copy updated the preview without replacing the empty destination. A subsequent deliberate Copy adopted the collection; Undo restored zero pictures/packs and no flight; repeating the copy succeeded. The new ready screen offered Relay Orchard and loaded the copied First Signal flight paused.

**Art installation and rewards:** the actual Homeward install button decoded all three PNGs successfully. Each of three replay-verified near-finish sessions was imported through the ordinary save UI and finished with a real direction control: Orchard Right, Switchyard Up, Beacon Right. Earlier inputs came from deterministic fixtures, not manual play. The UI results were:

| Mission          | Steering / active craft                                      | Captured |  Score | Lives |
| ---------------- | ------------------------------------------------------------ | -------: | -----: | ----: |
| Copper Orchard   | Immediate / Fiber relay                                      |    74.1% | 12,590 |     3 |
| River Switchyard | Grid + buffer / Heavy carrier after a recorded hangar switch |    71.1% | 11,910 |     3 |
| Home Beacon      | Immediate / Impact craft                                     |    73.1% | 11,740 |     3 |

Every View picture action showed the corresponding complete original. The collection grew from five to eight pictures, and Homeward displayed 3 / 3 with a genuine campaign-complete overview. Its picture viewer replayed the existing animated celebration. Reload retained the earned chapter records, and selecting Homeward returned its completed overview. Selecting an explicit mission remained a replay rather than an automatic restart.

Screenshots: [Orchard](round-14/screenshots/copper-orchard-earned.png), [Switchyard](round-14/screenshots/river-switchyard-earned.png), [Beacon](round-14/screenshots/home-beacon-earned.png), [celebration sample](round-14/screenshots/beacon-celebration.png), [corrected launch card](round-14/screenshots/copper-orchard-ready.png).

**Portable artwork:** Export complete backup produced 11,398,487 UTF-8 bytes, eight pictures, ten score records and four installed packs. The backup's Homeward object exactly matched the shipped pack, including all original PNG bytes. SHA-256: `e4dc9786a842930975d48060dad8550d6a4c0090d8a98114e85b80e253b5da57`. The browser control's initial text extraction was tool-truncated at 200,000 characters; reading the visible copy field in bounded chunks recovered the full valid JSON. No product export truncation occurred, and a requested download alone was not counted as an OS save.

**Layouts:** the actual illustrated scenario entered the playground successfully. All six CSS fixtures—390 × 844, 844 × 390, 1024 × 768, 1280 × 720, 1065 × 912 and 320 × 640—showed the whole arena, gameplay controls and Start inside the arena, with no horizontal overflow. Phone/tablet/coarse fixtures meet 44 × 44; the mouse-oriented desktop retains its 34 × 28 gameplay minimum. [Measured readouts](round-14/layout-fixtures.json) are same-browser layout evidence, not physical Safari/touch/controller tests. The ordinary desktop ready screen also displayed both Load saved flight and Start without scrolling its text.

## Remaining goal work

This chapter improves picture rewards, but its underlying layouts reuse Fieldcraft and its PNG subjects remain static beneath the existing celebration. The broader content request still needs additional authored theme chapters, richer enemy/actor art and interaction variety, boss/mastery progression, full controller menu navigation, soundtrack listening and representative playtests. Telegram member artwork is still unavailable in the retained intake; none was silently bundled.

Native wrappers remain in the source with updated package metadata. The previously preserved v0.3.0 macOS artifact and iOS evidence are not reclassified as v0.4.0 native runtime tests. Full Xcode/device testing, permitted native UI observation, publisher signing/notarization, Steam services and a named public deployment remain target-specific outstanding work. No claim of a perfect, proven addictive or publicly deployed game is made.
