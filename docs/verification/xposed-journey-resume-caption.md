# Restored-flight caption lifecycle repair

Publication review observed `Flight resumed.` beneath a paused v0.67 flight after
Settings → Controls → Edit controller settings → Cancel → Escape. The simulation
was paused correctly; the untagged caption was stale. Frozen v0.67 and qualifying
v0.68 sources are not modified by this follow-up on the P01 branch.

Resume now tags only its own restored-flight notice. A later pause replaces that
specific notice with an accurate paused cue, including the kept unfinished line
when applicable. A fresh Resume updates that paused cue again. Other notices,
including failed saves and long-frame interruptions, are not blanket-cleared or
overwritten. Pause persistence can still supersede the routine caption with a
more important save warning.

The actual-host continuous-control/information cohort passes 22/22, no skips or
failures. Immediate and Grid + Buffer restored live-line tests check paused text,
unchanged checkpoint and valid exported replay. The added ground-flight test
checks repeated resume/pause, zero simulation advance from caption changes, and
preservation of an interruption warning across Settings navigation.
The separate Journey actual-host suite also passes 11/11 (127.7 seconds),
including ten consecutive Next clears, two-action Skip, restart, cold-load
cancellation, pack authority refusal and retained-result failure paths. Full
lint, formatting, validation and whitespace checks pass for this source slice.

Native local Journey loaded the retained test flight at 0:12, 0%, three lives and
zero score. Explicit Resume displayed `Flight resumed.`; Pause at 0:21 displayed
`Flight paused. Press Resume to continue.` The exact controller-settings draft
route above returned to the same 0:21, 0%, three lives and zero score, still paused,
with focus on Game settings and the corrected caption. No bindings were applied.
This is local source UI evidence, not acceptance on the public deployed source,
physical-controller testing, human enjoyment evidence, or whole-phase completion.
