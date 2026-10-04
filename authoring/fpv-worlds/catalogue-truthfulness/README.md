# Imported catalogue labels

Imported courses have no validated activity, difficulty or estimated-duration fields. The host
previously labelled every import “Explore · intermediate · 4 min”. This change removes those
invented values without changing any project, compiled course, pack or proof identity.

The selected mode's validated criteria determine the limited inferred label. One consistent
`actor-track-v1` kind, optionally accompanied by ordinary holds and landings, is labelled Follow
when target travel is required and Observe otherwise. Mixed tracking kinds, gates, skills,
combat, hunting, survival and routes without tracking retain the neutral “Authored challenge”.
The same resolver supplies activity filtering and the row label. Imported courses without a
difficulty appear under All difficulties. Built-in explicit metadata remains unchanged.

This is a presentation correction, not a new metadata schema. Frozen Reservoir r16 and Festival
r5 packs and their separate demonstrations remain exact. Any future explicit authoring metadata
needs its own backward-compatible contract and pack/proof identity review.

The manual `qualify.mjs` extracts the actual host functions and filter predicate, exercises
validated course variants, checks every built-in entry in both languages and modes, and verifies
the two original pack round trips. The initial run passed 284 checks. Only one of the 95 original
admission inputs changes: `world-app.mjs`, +591 bytes. The projected source total is 16,742,229
bytes with 34,987 bytes remaining. This is not a fresh admission or a native-browser result.

Native public-control qualification and the final source-bound admission are pending. The
qualified evidence PR #1096 remains separate, and the human-authorized P1 main-merge hold remains
in force; this work does not lift that hold.
