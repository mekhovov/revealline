# Story restore keyboard continuation — v0.69.3 candidate

A real keyboard restore of the owned Dawn Signal `.rlstory` on source
9cbe0be5686e4f7063370299050df71402146af7 left focus on BODY after the
consumed Restore button was disabled. Escape still returned to the workshop
opener, but the next Tab had lost the local workflow position.

The story adapter now forwards its operation focus owner and logical successor
to the existing guarded parent operation. Only an operation still owning focus
may restore to **Review chosen story backup**, after controls are re-enabled.
Cancellation, closing, backgrounding, and a deliberate focus move retire that
ownership. The consumed Restore remains disabled. Storage, bytes, scoring and
historic readers do not change.

Guidance reviewed 2026-09-20: [W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).
Its logical-focus-continuation principle informs this in-dialog completion;
it is not a claim of screen-reader or physical-controller certification.

## Evidence boundary

The initial sparse test run lacked an exact owned MP3 fixture (setup failure).
The first regression iteration exposed an adapter that failed to forward focus
options; correcting the parent wrapper made all 13 complete story-panel tests
pass on Node 20.19.5. Those checks include genuine storage transactions, original
byte round trips, native-disable modeling, observer failure, cancellation and
focus moved elsewhere. No failing test was removed or success condition relaxed.

The native correction passed on the hash-pinned isolated preview: the successful
restore focused Review chosen story backup, left consumed Restore disabled, and
Escape returned to Open local media. See `native.json`. Full final-source gates
and public verification remain required before acceptance. The base v0.69.2 remains independently qualifying.
