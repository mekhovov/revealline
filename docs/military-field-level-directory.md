# Find military characters and vehicles

Open **Living Routes → Find levels with soldiers and vehicles**, or
`game/hunt/military-levels.html` in the same game installation.

In the normal Settings menu, choose **Enemy appearance preset → Military Field**,
then Start or Restart. The directory's **Apply Military Field** button makes the
same explicit choice through the shared artwork preferences and complete theme
host. Merely visiting the page or following a level link does not change a
personal appearance choice. Uniforms remain independently selectable under
**Character appearance**; the tactical cast is labeled **Field kit**.

**Running enemies** separately adds optional humanoids to the next ordinary
Capture attempt when admitted by its geometry. Authored hunt missions already
contain targets. Gore, blood and remains control effects only. Military Field
never changes enemy rules or replaces creator-owned custom artwork.

## Useful starting levels

| Level                            | Modes                        | Existing content                                                                     |
| -------------------------------- | ---------------------------- | ------------------------------------------------------------------------------------ |
| Crossing Post                    | Capture Solo / Versus        | Patroller, Courier and a dangerous ordinary keeper with eligible utility-car artwork |
| Pincer Yard                      | Capture Team                 | Refuge seeker, Switchback and shared interception                                    |
| Relay Rendezvous                 | Capture Team                 | Two partners seeking a meeting point                                                 |
| Cable Cutoff                     | Snake Solo / Versus / Team   | Refuge seeker and Switchback; no vehicle actors                                      |
| Shield Window                    | Snake Solo / Versus / Team   | A specialist with protected front contact; no vehicle actors                         |
| Runner Court                     | Native SIM Self-level / Acro | Runner and utility car                                                               |
| Burst Lanes                      | Native SIM Self-level / Acro | Sprinter and cargo truck                                                             |
| Refuge Return · Committed routes | Native SIM Self-level / Acro | Refuge seeker, optional Courier and armored carrier                                  |
| Switchback Crossing              | Native SIM Self-level / Acro | Switchback, Patroller and tank                                                       |
| Meeting Yard · Committed routes  | Native SIM Self-level / Acro | Rendezvous pair and radar truck                                                      |
| Armor Windows                    | Native SIM Self-level / Acro | Shield and Brace specialists                                                         |

The five native pursuit vehicles are parked, unarmed actors outside the required
contact-hunt quota. Their appearance does not introduce vehicle-combat mechanics.
Other existing Capture examples include **First fracture** for the tank look,
**Wake the yard** for the cargo-truck look and **First relay** for the radar-truck
look, provided their verified built-in artwork is selected.

## Catalogue and navigation contract

The directory derives 175 Capture entries from current default, Hunt and Pursuit
sources, plus all 96 Classic Snake entries. It loads 54 current native hunt
courses separately if the optional source catalogue is available. These are
catalogue entries grouped by modes, not a claim of 325 unique new layouts or of
complete historical/community coverage.

Capture links open the correct collection; the card explicitly asks the player
to select that exact name in Missions. No unsupported per-mission URL parameter
is invented. Snake uses its real `level`/`mode` route, and native flight uses the
existing `snake-course` route. The current corrected Refuge/Meeting revisions
precede retained historical versions. Optional package failure keeps the core
directory available and exposes its simulator installation link.

The page starts with recommended examples. Searching automatically includes the
full catalogue. Filters select seat arrangement and vehicle presence; results
render in batches of 36. Both English and Ukrainian UI text are provided.
Preview-only `artReview` pins survive owned native links, while ordinary links
use the player's actual preference. The normal Military Field preset selects
the approved v3 treatment without requiring that URL parameter.

## Verification

`game/test/military-level-directory.test.mjs`: **9 passed** on Node 22.22.2.
Coverage includes catalogue identities, source-derived vehicle semantics,
Ukrainian search, current native revisions, deployment-relative exact/collection
links, no implicit preference mutation, explicit preset preparation, failed
optional loading, denied preference persistence, explicit review-pin replacement and late responses after disposal.
Scoped ESLint and Prettier checks pass.

The DOM fixture is not a physical-device layout or gameplay-completion claim.
Prototype chapter qualification and public release retain their existing gates.
