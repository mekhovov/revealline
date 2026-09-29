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
left stale by a catalogue change. **Play exact Solo preview** now accepts an
explicitly enabled combat edition. Static inspection and validated export remain
available. Team combat and paired-race Studio launches remain unsupported; the
Studio does not substitute Solo for either mode.

## Exact Solo practice preview

1. Accept the intended mission edition and its explicit combat setting. For an
   enabled Solo edition, leave **Show enemy remains** checked or clear it for the
   next preview, then choose **Play exact Solo preview** and **Start mission**.
2. Inspect scout/sentry bodies, locked warning rays, fired projectiles and capture
   cancellation through the actual shared `BoardPainter`. Pause and reduced
   effects preserve the information needed to read live threats.
3. Close the preview to return to the accepted project. Practice preserves the
   authored scenario and bypasses ordinary fresh-attempt gameplay tuning. It
   writes no mission awards or campaign progress.

The ready card and **Mission brief** now derive optional-actor guidance from the
enabled mission rules. Scout-only editions explain contact and enclosure removal;
editions with sentries also explain the locked ray, warning bar and counterplay.
Later steering does not retarget a sentry's shot. Closing before it fires cancels
the warning, while a sentry in recovery can still have a live shot. The full brief
warns against crossing that shot to reach its owner and distinguishes removable
bracketed bodies from ordinary territory-retaining keepers. Authored prose stays
complete, followed by the rule-derived explanation. Absent, disabled or empty
optional populations retain their previous brief, and combined pressure guidance
remains visible. English and Ukrainian use the same rule gates.

The [briefing checks](../game/test/combat-brief.test.mjs) cover compiled optional
candidates and the actual practice host. Public-input core fixtures establish
fixed aim after a direction change, a live shot during recovery, warning
cancellation on an earlier return, and scout removal by contact or enclosure.
These are deterministic counterplay checks, not human fairness or physical-device
qualification.

The [Sentry practice qualification](../game/test/sentry-practice-qualification.test.mjs)
also completes both existing Standard/seed1 Sentry detour routes through the actual
Solo application, including warning Pause, verified export and retained Retry.
Grid-center evades a fired shot; Immediate performs one capture cancellation and
later ram removal. Their exact historical checkpoints and recorder inputs remain
unchanged. When translating a direct-core trace, a post-capture movement command
requires a fresh native key gesture: the host intentionally clears held movement.
Do not remove that safety rule or force input/state to reproduce a trace. See
[the bounded evidence and fixture correction](verification/actor-batch-19/README.md).

The live presentation is additive. Absent or disabled combat preserves the
existing drawing commands. Bodies and warnings sit below exposed trails and
ordinary keepers; fired projectiles remain above keepers and below the craft.
Optional scrap is cosmetic and does not alter the original picture bytes. No new
behavior or default mission is introduced. The historical held patch in
`docs/patches/combat-board-e9434d03.patch` remains unchanged; the
[integration tests](../game/test/combat-board-adapter.test.mjs) now exercise the
actual checked-out painter as well as retained historical evidence.

### Global remains preference and exact preview override

Solo, Versus and Team Settings share **Show enemy remains**, which defaults to
shown. Ordinary Solo, both Versus painters and Replay use it for inert optional
residue. Team exposes the shared control without enabling unsupported combat.
The separate strict `revealline.encounter-display.v1` record contains only its
format and boolean choice; historical display, player, scenario and replay
schemas remain unchanged. Reading never saves. Corrupt or future records retain
their bytes, and failed or disabled persistence leaves the choice active for the
current session. Explicit Retry verifies persistence before sharing resumes.

**Show enemy remains** starts checked. Studio exposes it only when the selected
mission resolves to valid, explicitly enabled Solo combat. It is hidden and
disabled for ordinary, disabled, non-Solo, missing or rejected mission editions.
Changing missions preserves the checkbox's choice within the open Studio page.
Turning it off hides inert remains; live enemies, locked aim warnings, shots and
brief sparks remain visible. The option does not change reduced-effects behavior.

Each launch snapshots the choice after validating the mission and before waiting
for theme or artwork loading. A later checkbox change applies to the next launch.
Native Retry retains the current child's launch choice. Close, replacement launch
and page departure retire the pending operation; a late completion cannot revive
that preview or write its scenario after retirement.

The explicit Studio choice travels in the child's URL as `preview-remains=show`
or `preview-remains=hide`, for example
`?practice=1&revision=studio-7&preview-remains=hide`. The
[practice presentation parser](../game/ui/practice-presentation.mjs) accepts an
override only for an actual practice session, excluding course sessions, with
exactly one `practice=1` and one recognized `preview-remains` value. That accepted
launch choice overrides the global preference for the owned preview. Missing,
unknown, malformed or duplicate values grant no override; the host uses the
global preference. Ordinary game and course sessions ignore preview parameters.

A successful launch still uses the existing tab-scoped scenario transport.
Showing and hiding remains produce byte-identical scenario payloads; the choice
is not written into the project, scenario, replay or persistent player settings.
Real optional-combat routes produce identical authoritative checkpoints and
verified replays for both choices. The
[host checks](../game/test/practice-presentation-host.test.mjs),
[query and localized control checks](../game/test/practice-presentation.test.mjs)
and [Studio lifecycle checks](../game/test/studio-preview-readiness.test.mjs)
cover these boundaries. This is a Studio practice control, not a global remains
preference write. The separate global control and cross-mode persistence are
covered by the [Batch 11 evidence](verification/actor-batch-11/README.md).

If a frame fails after startup, the practice child stops simulation and gameplay
input and displays a persistent failure message. It cannot Resume or Retry that
failed instance. Use **Close preview** or the child Return action, correct the
draft if necessary, then choose **Play exact Solo preview** again to launch a fresh child. The failure latch is separate
from boot recovery, survives a cached-page return and does not change normal
awarding-game error behavior. The parent retains the project and launch context.
See the [mounted failure checks](../game/test/practice-render-failure-host.test.mjs).

This is delivered source capability, not public-release acceptance. Explicit
effects provenance now includes the combat adapters and their consumed geometry
helpers, so production review must reopen before adoption. Exact production
reapproval, frozen/public bytes, ordinary public play, broader counterplay and
full-mission qualification remain required. Human fairness and physical-device
checks are separate evidence. C3/C4/C5/C6 implementation continues in parallel;
the deferred C2 pilot does not block these independent changes.

## Maintenance prompt

Paused Field details reads the existing strict combat projection and groups live
scouts, sentry warnings, recovery and shots. Running event collection omits this
extra geometry read. Recovery does not clear an earlier projectile; freeze holds
patrol and projectile time. Invalid active data must say guidance is unavailable,
not zero hazards. No optional section is added for absent or disabled combat.
Terminal retained records use ended copy, including when the winning enclosure
removed every actor. Exact known combat events receive historical urgency only;
new unknown types remain visible as unknown effects.

The actual ordinary Details opener retains its existing `pause(true)` save:
only `savedAt` refreshes, with the same replay and continuation. Do not claim
that opening is write-free. Reading, scrolling and Back add no writes; reward-free
practice remains write-free throughout. Native keyboard evidence, model clocks,
injected freeze-state tests and physical-device checks are separate categories.
See [batch 13](verification/actor-batch-13/README.md).

“Compile explicit optional-on and optional-off editions without downgrading the
current actor catalogue. Through the actual Solo painter, compare absent/off
commands, exercise pressure and sentry locks together, pause/reduced effects,
shot travel, legal capture cancellation and exact replay/restoration. Import the
source in Studio, launch ordinary no-awards practice, make a cut, pause, Close
and relaunch. Compare Show enemy remains on/off: preserve live threat cues,
scenario bytes and replay identity; snapshot before media loading, reject
ambiguous preview-query values and retain the choice across mission selection.
Inject a controlled renderer fault only in the host test, with
Confirm held: after release, native Return must work without blur. Retire stale
loads and ready monitors on pagehide. Inspect complete board/HUD fit at 1280×720,
390×844 and 844×390; do not call pointer clicks touch certification. Preserve
failing baseline evidence and require exact production reapproval before release.”
