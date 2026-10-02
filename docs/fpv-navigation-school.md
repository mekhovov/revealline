# Expanded navigation and precision school

2 October 2026. This increment adds sixteen original Acro lessons: eight
Experienced and eight Advanced. There are now 42 learning lessons and 259 guided
steps: 30 primary Acro lessons and 12 optional self-level lessons. Together with
the existing 60 world challenges, the selectable catalogue contains102 challenges.
All remain open; tier selection recommends a sequence without locking content.

## Authored tasks

Experienced: Braking marks, Altitude staircase, Compass cross, Backward return,
S-turn handover, Wide corner/tight exit, Three landing approaches and Landmark
rally. Advanced: Slalom rhythm, High–low ribbon, Platform approach, Corridor
turnaround, Over/around/under, Read the landmarks, Between floors and Precision
pilot route. Routes have different geometry, order and tasks, not recolours or
medal variants. Three courses explicitly land on named raised collision surfaces.

Every lesson includes English and Ukrainian instruction, an exact full-flight
recording, continuous lesson playback and unscored checkpoint takeover. The
school exposes All, Beginner, Experienced, Advanced and Optional self-level
filters. Continue and Next follow the expanded primary order. Existing completion
evidence retains exact revision matching; original26 lesson/course identities,
recordings and earned completion remain valid. The primary beginner order stays
exported separately for callers needing only those14 lessons.

The maintained offline authoring pilot now resolves a named landing surface's
actual top height. A missing/unsupported support surface reports an error;
it cannot silently qualify a floor landing as a platform landing. Original floor
commands are preserved. Runtime handling and recording formats are unchanged.

## Evidence

`docs/evidence/fpv-navigation-model-20261002.json` records16 full, independently
replayed recordings with zero contacts/full health. Each recording is reproduced
byte-for-byte by the maintained command pilot. Original26 course and pack
identities are unchanged;21,875 original pilot commands match the parent.

`fpv-navigation-continuous-browser-20261002.json` records87/87 checks: all42
lessons,259 step descriptions, continuous loop/seek/takeover, exact final state,
indefinite completed practice, lifecycle and fallback disposal. This local
in-app-browser run measured maximum open42.6ms and last-step seek40.2ms. These are
operation samples, not sustained device frame times or physical-radio latency.
The tier/menu receipt passes12/12 production-host checks, including preserved progress, exact-revision exclusion, tier order, Continue, language, focus and fullscreen. Package admission is recorded after the frozen source build.

Actual packaged player inspection covers the raised-platform lesson and its
fullscreen checkpoint view. Human first-time player acceptance, fluent Ukrainian
review and physical radio/device-performance qualification remain outstanding.
Additional unit coverage remains deferred to the final phase. Public availability
requires protected merge and public deployment verification.

## Next increment

[The researched mastery plan](fpv-mastery-school-plan.md) defines sixteen further
Pro/Master lessons. Their trick criteria and recordings are separate work: an
upright endpoint alone cannot prove a roll, and a gate route alone cannot prove
an orbit. They are not included in the counts or completion claims above.
