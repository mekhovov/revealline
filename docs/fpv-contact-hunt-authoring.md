# Author native FPV Contact Hunt challenges

FPV World Studio now creates and edits Contact Hunt objectives through its
existing actor editor. It uses the accepted `FlightCourse.v2` course and
`hunt-contact-v1` objective, the normal validation/Undo transaction and existing
course JSON, project and preview paths. No new flight physics, actor type,
replay interpretation or optional-package file slot is introduced.

## Open and create

1. Open **FPV SIM → FPV World Studio → Workshop**, or the native Studio's
   `#creator` link. Create a challenge copy of a course.
2. Under **Actors & encounters → Contact Hunt**, choose **Add unarmed Hunt
   target**. This creates an ordinary native ground patrol with firing disabled
   and selects it. Position it clear of obstacles. It stays at its position until
   you add a waypoint route; its route and speed remain editable below.
3. Choose **Both flight modes**, **Self-level** or **Acro**. Add eligible targets
   to the list and use **Catch earlier/later** to arrange them. Enable **Require
   the listed catch order** only for an ordered challenge.
4. Optionally enable **Grow a solid echo tail after catches**. Set links per
   catch, the maximum length, clear distance behind the drone and tail collision
   radius. With the option off, catching does not add a tail.
5. Choose **Add Contact Hunt**. Use the normal preview to inspect target
   placement and fly the accepted course. Save/export through the existing
   Studio actions.

The preset creates an actor, not an objective or a new attempt. Adding it to a
Hunt objective is a separate explicit action. Existing unarmed hostile ground
patrols and sentries can also be selected; vehicles, airborne drones, hazards,
civilians and armed actors are not Contact Hunt targets.

## Edit and retain ownership

Select an existing Hunt objective in the panel or the native criterion picker.
**Apply Hunt settings**, objective ordering and removal affect only that selected
flight mode. Creating in both modes copies the accepted settings independently;
later changes in one do not silently change the other. Target-list edits remain
drafts until Apply. Draft targets, order and tail fields survive adding another
unarmed actor and switching between mode objectives. Moving an objective applies
its current draft settings and moves its source binding in one validated edit;
an invalid draft prevents the move. A newly added actor is available to select
without silently extending an existing draft's quota.

Each mode admits one Contact Hunt objective with one to twelve distinct, finite
targets. Conflicting defeat/tracking targets, duplicate Hunt objectives, invalid
tail settings and stale edits are rejected without changing the previous course.
The production validator remains authoritative. A Hunt objective cannot be
duplicated through the generic criterion controls.

Deleting an actor removes its Hunt references in both modes. Changing a target
to Rival or Civilian also removes those incompatible references. Surviving target
order is retained; empty objectives are removed with their source bindings. If
that leaves a mode without objectives, the existing actor-removal fallback adds
a short survival objective. These are edits to the challenge copy and remain
undoable. Hunt targets cannot have firing enabled until removed from all Hunt
objectives. Explicitly removing a sole objective is disabled: add another
objective first.

The panel retains native finite populations and authored looping ground routes.
It does not add fleeing AI, grid armor, tank combat or shared-world multiplayer.
Studio exports and imported courses still require their ordinary validation and
content ownership; this authoring feature does not qualify a new mission for
release.

## Verification boundary

Regression sources cover the unarmed preset, accepted targets/order/tail values,
per-mode edits and objective bindings, atomic conflict rejection, target deletion,
role changes, stale edits, localized controls and accepted JSON round-trips.
They are authored but not run under the repository's automated-suite waiver.
Scoped ESLint, formatting and generated-runtime byte-identity checks accompany
the change. Manual Studio preview/Undo/export and committed-package checks are
recorded separately by the release owner; no human route or device qualification
is implied.
