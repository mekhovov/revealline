# Recovery and archive status localization — 18 October 2026

Implemented at `39a8be8c19c2a107b7be2352f45dbfe5cc23f5cd`; not yet published.

A rendered language switch exposed a stale English recovery-result sentence in
Ukrainian UI. Recovery controls now retain a message renderer and resolve it
when painting. Unchanged messages do not rewrite the live status node. The
known archive-full product message also translates; unknown diagnostics remain
literal text. Ownership, cancellation, writes, recording and physics are unchanged.

## Automated qualification

The old implementation failed six locale-switch regressions; unknown-diagnostic
preservation already passed. Another regression observed 50 status writes for
50 unchanged paints. The corrected recovery/archive suites pass **36/36**,
including zero repeated status writes and exactly one write per language change.
Independent review, formatting and lint passed.

Actual package checks pass **19/19**, with no skipped tests. The
[complete receipt](fpv-locale-package-qualification-20261018.json) binds source,
file inventories and logs. Bundled Academy is **13,106,939 / 13,107,200 bytes**,
leaving **261 bytes**. File inventories remain 151/151 for Academy and 211/211
for World; no limit was raised. More browser functionality requires reviewed
byte savings and another real package measurement.

## Rendered acceptance

The exact frozen source was served at
`http://127.0.0.1:8871/optional-practice/fpv-worlds/index.html` in a separate local
tab. Another task owned port 8786; its process was left untouched. This fresh
origin was not the earlier full-store context or the public site.

An unsaved Meteor75 draft ran stationary for 6.02 seconds in Self-level. Its
5.00-second checkpoint restored successfully and remained paused. Switching
English → Ukrainian → English changed the existing recovery-result sentence
correctly each time while retaining the same paused physical state. The free-flight
panel correctly stated that there were no course splits. This is a recovery/UI
check, not a takeoff, lesson-completion or fidelity claim.

Screenshot `recovery-status-uk-fixed.png` in the task's sustained-flight evidence
shows the corrected Ukrainian result. The language returned to English, the
temporary draft was reverted to My drone / Legacy feel with zero changes, and
the temporary tab/server were closed. No setup save or archive deletion occurred.
The fresh origin did not reproduce archive capacity; known-full and unknown-error
translation coverage here is automated, not another rendered full-store pass.

Publication, public acceptance and the older missing-archive incident remain open.
