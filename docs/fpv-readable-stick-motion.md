# Readable FPV stick motion

## Player change

Motor-power arcs are secondary cues: their stroke is now 1.2 SVG units at 40%
opacity, while the propellers, nose marker and measured movement remain clear.
The model and illustrative motor mix are unchanged.

A short input trail, origin ring and direction chevron show where each stick
came from. Reversals follow the most recent movement, including small corrections.
The trail preserves actual input amplitude, holds at most 12 points over 450 ms,
and fades when movement stops. It appears in the learning lab, World Studio
flight/replay and Academy flight/replay, including touch sticks.

Whole-lesson examples use one 0.5× playback clock through every objective.
Descriptions, stick elements and the isolated flight remain continuous across
natural step changes. Exact recorded commands remain visible as small filled
amber markers. A separately labelled hollow movement guide follows changes over
80 ms; it is a visual aid, never an input to the drone or motor animation. Live
cyan markers remain immediate. The full-travel axis explorer keeps its existing
0.2× teaching pace.

Pause, explicit step seeking, loop restart, reset, source/layout change and
manual takeover clear old trails. Reduced-motion preferences suppress the trail
and hollow motion guide. Recorded commands, physics, objective detection,
challenge identities and completion evidence are unchanged. The first Acro
lesson's EN/UK legend explanation now matches the new markers.

## Diagnosis and research

The prior coach already retained its simulation across objectives. Its
objective-specific clock nevertheless changed speed 46 times across the 58
recordings, including ten changes greater than 2×. Recorded commands themselves
also have deliberate discontinuities at manoeuvre boundaries. The new view
keeps one clock and distinguishes exact input from a presentation-only motion cue;
it does not rewrite verified recordings to disguise their commands.

The design follows [Material motion choreography](https://m1.material.io/motion/choreography.html):
retain the focal element across transitions and avoid competing motion. The
[VelociDrone manual](https://www.velocidrone.com/desktop_manual) provides a useful
simulator reference for transmitter-layout overlays and slower replay viewing.
The implementation also follows [W3C guidance on interaction animation](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)
by honoring reduced-motion preferences. The exact visual duration and intensity
are project choices, not requirements prescribed by those sources.

## Verification and limits

Functional evidence is recorded with this feature under `docs/evidence/`.
Checks use the real production coach, shared SVG component, both application
hosts and exact lesson recordings. Browser input is controlled for repeatable
verification. Additional unit coverage remains in R7. Physical TX15/controller
latency, unfamiliar-player acceptance and sustained device performance are not
claimed by these checks.

The trace owns no animation loop, timer, input listener or layout read. Hosts
supply their existing frame clock. Academy input/drone diagrams now refresh
outside its 100 ms text-HUD throttle; numeric diagnostic text retains that
throttle. This removes that presentation delay without changing simulation or
claiming measured end-to-end hardware latency.

Completed browser evidence: 69/69 focused checks (including all 58 exact lesson
replays), 119/119 full lesson continuity/takeover/manual-progression checks,
and 4/4 real Academy/World host checks. Receipts are
`fpv-stick-motion-browser-20261002.json`,
`fpv-stick-motion-continuity-20261002.json` and
`fpv-stick-motion-hosts-20261002.json` under `docs/evidence/`.
