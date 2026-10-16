# Global travelling trail-impact successor

Status: implementation candidate; public release and human balance review pending.

## Scope

- `whole-spatial-v6` is an explicit 91-mission Solo/Versus successor and the normal entry route.
- Every eligible enemy and active lane uses the existing `line-impact.v1` Pressure Lines contract at authored speed 24.
- Runtime pressure tuning applies that value once: approximately 28.8 cells/s on Gentle, 38.4 on Standard and 48 on Expert.
- The eleven missions that authored fourteen special `impact-carrier` actors now retain the same actor IDs, positions, headings, tiers, movement and field-retention behavior as ordinary `field-keeper` actors.
- The second Prologue mission introduces the travelling-impact rule. Later missions practice it; no geometry or objective changes were made to the first three teaching missions.
- v5 and all earlier routes, sessions, progress keys and replay identities remain unchanged and selectable.

## Contract retained from Pressure Lines

- A physical strike on an unfinished ordered trail seeds one pair of fronts per source per cut.
- The departure front ends at the departure point; the craft-bound front follows the growing trail.
- A valid closure clears the fronts, and closure wins a simultaneous arrival tie.
- Freeze prevents new enemy-generated seeds but does not pause existing fronts. Enemy slow does not alter front speed.
- Direct craft contact, self-contact and lethal terrain remain immediate failures.
- Ordinary enemy movement remains straight between physical impacts; this change adds no mid-flight retargeting.

## Verification completed locally

- All 91 missions compiled for Solo and Versus at Gentle, Standard and Expert: 546 resolved manifests.
- Exact v5 route snapshot retained; v6 has its own pinned route snapshot, session key and profile key.
- Geometry, maps, objectives, presentation, actor counts and actor motion fields compare equal to v5 apart from the deliberate carrier-role replacement.
- Existing engine impact tests continue to own collision, multi-front, freeze, closure-tie, replay and suspension behavior.
- Queryless Solo and Versus launch the v6 Journey; the remote unified inventory retains 91 Journey plus 110 Classic missions.

## Explicitly not completed here

- Classic Current/Original editions and their authored Next isolation.
- Team `(playerId, cutId)` impact ownership, partial-trail rebasing and rescue/disconnect behavior.
- The reported post-capture automatic-departure bug remains unreproduced and is not claimed fixed.
- Public frozen-build verification, physical devices and human balance/fun qualification remain pending.
