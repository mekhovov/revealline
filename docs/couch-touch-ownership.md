# Shared touch cancellation ownership

The shared Solo-style steering adapter tracks one finger per couch seat. An extra
finger on an occupied pad is ignored. Its later cancellation must not pause either
player. The prior legacy child-button listener reacted to every cancellation,
including an ignored finger on a D-pad arrow. It now requires that button's own
tracked capture; the shared steering adapter continues to handle its captured
finger. This applies to both Versus and Team through their shared input adapter.

Solo had the same legacy child-button path: cancelling an ignored finger cleared
the active gesture even though it did not pause the flight. Solo now delegates
child-button cancellation to the shared steering adapter whenever it is attached;
legacy controls retain their established lifecycle handling. The mounted Solo-host
regression proves the original finger remains captured and can turn, then confirms
that cancelling that real finger still pauses.

Losing a real steering finger still pauses the shared game and retires physical
input for both seats. Permitted saved directions are retained for explicit Resume;
old movement or capture-loss events cannot take over. A fresh gesture controls
only its own seat. The change does not alter the simulation, score or replay format.

The regression uses three steering styles and two simultaneous steering fingers,
then an ignored third finger on the actual D-pad child button. It verifies both
non-interruption and genuine interruption. Legacy input/navigation and real-core
continuous-steering tests remain in the regression cohort. Final integrated
host/browser checks and physical iPhone multitouch remain required.

MDN's [multi-touch guidance](https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Multi-touch_interaction)
tracks pointer state independently per touch target. Its
[pointercancel reference](https://developer.mozilla.org/en-US/docs/Web/API/Element/pointercancel_event)
describes interruption of a pointer stream. The game distinguishes that pointer's
ownership rather than treating every cancellation as a global game action.
