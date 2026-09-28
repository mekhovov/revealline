# Optional patrols alongside current pressure roles

Studio can prepare an optional scout/sentry edition of a project pinned to
`journey-actors-v9` without changing its pursuit or interception recipes.
Use **Prepare authoring**, add an **Optional scout** or **Optional sentry** through
the existing actor panel, then explicitly apply the combat enabled setting.
New preparation starts disabled; adding actors does not change that setting.
The existing draft Apply/Undo/export path owns every accepted change.

This closes a catalogue compatibility gap: preparation previously changed v9 to
v8 project-wide. That changed an untouched Standard pressure mission's warning,
commitment and cooldown from 90/144/300 ticks to 120/180/306 ticks. The shared
compiler also rejected combat on v9 even though its registered catalogue inherits
both optional roles. Preparation now retains a registered catalogue with those
capabilities; older catalogues still upgrade to v8. Unregistered catalogues and
combat fields on v7 remain invalid.

The selected mission receives a distinct draft edition. Other missions retain
their exact resolved rules and simulation identities. Maps, original picture
bindings, catalogue recipes, defaults and historical replays are unchanged.
On/off editions retain authored optional actors; they have distinct execution
identities. Scouts and sentries remain separate from region-retaining keepers
and pressure actors. No inline physics or timing override is admitted.

The [combined authoring tests](../game/test/combat-pressure-authoring.test.mjs)
compile all three difficulties in Solo and Versus, exercise round-trip export
and Undo, and reject unsupported catalogue/actor commands. Bounded optional
fixtures pair each current pressure role with a sentry under both turn policies.
Real inputs observe the pressure lock and commitment alongside a sentry warning
and fired shot; replay and session restoration retain the simultaneous states.
A different return route closes a cut and cancels both attacks without losing a
life. These fixtures use **authored catalogue values**, not fresh-attempt gameplay
tuning, and are not added to the current Journey or benchmark missions.

The [Studio control tests](../game/test/studio-combat-authoring.test.mjs) cover
preparation, explicit enable, retained pressure timing and rejection of controls
left stale by a catalogue change. The enabled-combat gameplay-preview guard is
still enforced: static inspection and validated export are available, while
readable live presentation must be qualified separately. Team combat, human
fairness, full-mission clears and production adoption remain outside this slice.

## Next dependency: actual Solo preview presentation

Enabling the practice preview requires an additive combat layer in the actual
`game/ui/render.mjs` painter. The held adapter in
`docs/patches/combat-board-e9434d03.patch` and its temporary patched-module tests
are design/evidence inputs, not proof that the shipped painter already draws
these actors or projectiles. Preserve its source history when adopting it.

The practice host also needs a latched failure path after startup: stop
simulation and input, show a visible child-frame error, and retain Close and
fresh Relaunch. `RevealLineBoot.fail()` ignores post-ready failures; forwarding
an exception there alone cannot recover a later malformed combat frame.
Only after both paths pass should the scenario, Play button and explanatory-copy
guards be removed together for Solo. Team remains unsupported. Practice already
retains the exact authored scenario and bypasses ordinary fresh-attempt tuning;
keep that identity and no-awards behavior.

This is a C4 technical dependency, not a reason to wait for the deferred C2
human pilot. Qualify combined warning/commit/projectile/capture states through
the real painter, post-ready failure and clean relaunch, pause/reduced effects,
small layouts and retained original artwork before admitting the preview.
