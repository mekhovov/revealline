# Equipment seals

The v0.8 source gives each Homeward Skies picture one optional equipment goal. A seal records a particular route and setup; it never replaces the normal capture goal or blocks a picture, medal, scoreboard entry or next mission. The three goals use existing fictional arcade abilities.

Install **Homeward Skies** from **Library & saves → Expansion packs**, then choose **Play Homeward Skies**. The ready and pause cards show the current goal's requirements. A shorter summary appears below the controls during flight. Both Immediate and Grid + buffer steering are supported.

| Mission          | Optional seal | What counts                                                                                                                                                                     |
| ---------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copper Orchard   | Steady Signal | Close one cut through eight distinct active interference cells with signal resistance, then win without losing a life. Fiber relay provides resistance.                         |
| River Switchyard | Supply Line   | Collect supplies at the west and south pads; close a cut containing two distinct suppressed cells in each signal region; switch to Heavy carrier at the south hangar; then win. |
| Home Beacon      | Safe Return   | Start an impact pulse from a live cut of at least three cells, stun the cable cutter with that pulse, complete the return home, then win without losing a life.                 |

## What the checklist means

Supply Line's two regions can be completed on different cuts. Each region needs its threshold on one closed cut; several fragments do not add together. Open-line cells are pending until the line returns safely. A failed, shield-cancelled or redeployed open cut loses its pending cells. Earlier successful crossings, refills and the accepted switch remain credited within that attempt. **Supply Line does not require a clean finish.**

Only a successful refill counts: visiting a pad or pressing Supply with full charges is insufficient. Only a successful switch at the named hangar counts: selecting Heavy carrier before launch is not that switch. The checklist describes requirements, not a mandatory order. Light carrier is the recommended starting tool for the existing route.

Safe Return distinguishes an unused pulse, a qualifying pulse whose craft is still returning, and a completed return. The pulse must affect the named actor itself; another existing field cannot substitute. A pulse on safe ground, a shorter exposed cut, a miss, a rejected action or an unrelated recovery earns no credit. A lost life prevents this seal in that attempt while ordinary play continues. The observer makes no claim that the pulse was necessary to survive.

These requirements use gameplay recipes and actual events. A drone body, propeller style, theme, image or label does not grant an ability. Changing appearance is independent from choosing equipment.

## Finish, save and revisit

The full picture is collected first. The app then checks the entire recorded winning attempt against the installed map and equipment roster. The normal Continue action remains available during verification. A successful local write reports the seal earned and saved. If storage is unavailable, the app identifies a session-only result and keeps export available; it does not announce a persistent save.

Collection cards show their seals. Open the picture for the initial equipment and any later switches, steering mode, seed and date. For example, Supply Line can show **Light carrier → Heavy carrier · Immediate · seed 1**. Different qualifying setups remain separate metadata records. Repeating the same setup does not create an unbounded duplicate list.

Save & pause stores the existing replay-backed flight. Load reconstructs all checklist progress from its input prefix, including an open cut or pending impact recovery. Partial goal counters are never trusted from saved JSON. A complete backup carries the library, installed content and suspended attempt together; import and Undo retain their existing cancellation and rollback behavior. Previously completed ordinary missions receive no invented new seals.

The gallery spans installed campaign histories. The separately labeled **Campaign achievements** section describes the campaign currently selected in the flight deck. Its existing cosmetic unlocks remain campaign-specific. This label clarifies scope; it does not change earned progress.

## Extend the framework

Definitions are currently registered sidecars outside map and pack JSON. The [equipment plan](round-18-equipment-mastery-plan.md) specifies the two v2 compositions, and the [observer contract](mastery-observer-contract.md) describes the implemented boundary. The facade remains [`game/mastery.mjs`](../game/mastery.mjs); v2 equipment observation lives in [`mastery-equipment.mjs`](../game/mastery-equipment.mjs). Built-in registration and presentation use [`ui/mastery-view.mjs`](../game/ui/mastery-view.mjs).

- Definition v1 remains the exact Steady Signal pair and retains `mastery-v1-2e6aae3f42f3d3c2`.
- Definition v2 accepts only the Supply Line or Safe Return predicate composition, with bounded local references. It is not an expression language or executable script.
- `mastery-v1-` names the existing digest algorithm. The complete canonical definition, including its schema version, participates in the hash.
- Core v2, normalized maps, campaign/board identities, replay v3, session v1, record v1 and library v2 remain unchanged by these extra goals.
- Altered content or definitions retain old records as archived metadata. An imported seal is never proof of a newly verified attempt.
- Practice can display a goal but cannot save it as a player award. Replay Theater remains a read-only viewer.

The [separate pack/scenario-v2 plan](round-18-pack-mastery-plan.md) is future implementation. Do not add `masteries` to a v1 pack or expect the existing upload control to install a new definition. Use the [eight equipment-authoring prompts](../authoring/prompts/round-18-equipment-goals.md) and existing maintainer/designer skills for supported variations and verification work.

The original [Steady Signal guide](round-17-mastery-increment.md) describes that historical increment. More actor-specific goals, staged bosses, new art/music chapters and network services remain separate work. Deterministic traces and browser checks establish the behaviors they exercise; human enjoyment, physical devices, native signing and public deployment need their own evidence in the [release guide](public-release.md).
