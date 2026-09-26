# UX4 Versus countdown and short Retry cue

## Candidate scope

This unversioned v0.138 candidate is based on the local cumulative v0.137
stack at `99ee4f5f05adb0b13e0f26b2b04fad347b2eec4c`, including the v0.136
Team teaching and v0.137 deliberate terminal Retry sources. It reconciles the
presentation intent from draft PR #552 without adopting that draft's hidden
test-time shortcut. Exact-head release qualification is still required before
any release is cut.

A newly prepared Versus mission presents `3`, `2`, `1` for exactly 700 ms
each, then `GO` for 350 ms. Retry presents `READY` for 600 ms, then `GO`
for 300 ms. The animation-frame clock owns the cue; the cue owns no timeout and
does not mutate either simulation clock.

Both boards remain at tick zero and the visible race clock remains at its full
starting value until the first `GO` frame. That frame releases play without
spending hidden simulation time. Keyboard, standard-controller and touch state
accepted during the blocking phases is cleared at the release boundary. A
physical control held through `GO` remains blocked until neutral/release and a
new gesture.

Pause, blur, visibility loss, persisted page hide and an assigned-controller
disconnect pause the duel and retire the visible cue. Resume restarts the
interrupted recipe from its first phase. A non-persisted page hide cancels the
cue with the rest of the host. A mission adopted directly from the shared
library uses the same full mission recipe. Ordinary Resume after live play does
not add a new countdown.

The status overlay is atomic, polite live-region copy. `READY` and `GO` follow
the active English or Ukrainian interface locale. Reduced effects keeps all
timing and removes the decorative shadow; it does not shorten or bypass a
phase. This change intentionally adds no cue audio.

## Automated evidence

The focused pure test asserts every phase boundary, including the final
millisecond of both `GO` phases. The host test asserts exact Player 1 and Player
2 ticks plus the visible DOM clock at each new-match and Retry boundary. It also
exercises actual host keyboard, standard-gamepad and touch adapters, locale
switching, reduced effects, accessibility attributes, Pause, blur, hidden
documents, both page-hide forms and controller disconnect.

The Couch host fixture exposes `await page.settleStartCue()` for tests whose
subject begins after the presentation gate. It advances through the blocking
phases by RAF and stops on the first `GO` frame at tick zero. Timing tests use
ordinary explicit frames and never infer completion from rendered prose.

## Qualification limits

Modeled DOM, keyboard, gamepad and touch events are automated component
evidence. They are not physical controller, Steam Deck, touch-device,
screen-reader, zoom or short-landscape evidence. No current browser capture,
deployed offline run, human readability assessment or audio-device result is
claimed here. Those checks remain part of the exact rebased release
qualification and the later cumulative UX6 pass.
