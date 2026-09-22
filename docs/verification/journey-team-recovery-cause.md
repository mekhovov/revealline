# Team automatic recovery retains the observed cause

2026-09-22. Bounded player-feedback correction, not a new difficulty rule or
completion of human failure-readability acceptance.

## Defect and change

A real-keyboard double self-crossing reproduced the issue: the host briefly
wrote the cause, then same-step shared recovery replaced it with only “Both
craft are back. One team reserve used.” Individual reserve recovery similarly
discarded the preceding explanation after the recovery interval.

The host now snapshots the pending/current-step knockdowns before revival clears
them. Individual reserve messages retain their own observed cause; shared recovery
deduplicates the two observed causes. Existing descriptions still distinguish
craft contact, trail impact, roamer contact, self-crossing and lethal terrain.
No history means no invented explanation. Retry clears the old attempt's history.
Contact rescue and its existing messages are unchanged.

Only presentation changes. Core events, map/schema identities, damage, reserve
cost, recovery timing, controls and input rearming remain unchanged. There is
no new overlay, click, pause or mandatory reading delay. This does not prevent
later genuine gameplay messages from replacing the recovery caption.

## Evidence and limitations

The shared-recovery keyboard regression first failed on the missing self-crossing
cause, then passed with the existing reserve/retry checks. New real-keyboard
tests use the pinned Twin Depots outer shortcut on all three presets: a real
keeper hits the trail, automatic individual recovery spends exactly one reserve,
and the cause remains in the ready-to-steer message without opening a menu.
Deliberate paused Retry still uses its existing confirmation and clears the old
caption. Pure checks cover distinct/deduplicated causes and empty history.

The four-file host/recovery/live-rescue/roamer cohort passes92/92 on both
Node20.19.5 and22.22.2. ESLint and whitespace checks pass. The first version
of the new Retry test omitted the existing discard confirmation; the corrected
test operates that real control and waits for the new attempt, rather than
changing production confirmation behavior.

Independent read-only review found no blocker: immediate/delayed event ordering,
per-player attribution, new-attempt resets and rollback history ownership were
checked. The production delta changes no core input or simulation schema.

Native screen-reader, compact-screen, controller and human understanding checks
remain open. No new native screenshot or audio evidence is claimed. Publication
requires the existing release owner's reviewed build and Pages verification.
