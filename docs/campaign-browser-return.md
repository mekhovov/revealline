# Return from the campaign browser

Opening More chapters from Missions now keeps that navigation context. Back to
Missions, Escape and controller Back restore the Missions screen and focus More
chapters. A subsequent Back returns to the original Home opener or paused field.
The selected chapter and mission remain selected; returning does not resume play.

The shell supplies a single-use return callback to the catalogue host. It retains
the original mission visit and rejects return after a newer mission visit, dialog,
visible field focus, background transition or shell destruction. Normal catalogue
Play closes without calling this Back callback, so accepted launches remain direct.
The shared catalogue defaults and Couch hosts retain their own return destinations.

## Maintenance prompt

“Verify Home and paused-field entry into Missions, More chapters and Back using
button activation, Escape and a modeled standard-controller B sample. Check the
Back label, exact More chapters focus, original outer return, selected content,
paused checkpoint and save bytes. Hold the catalogue request, return and finish
it late; it must not reopen or take focus. Introduce a newer dialog or field focus
while closing, and test the hidden-page case. Qualify normal Download & play and
its explicit replacement separately. Keep native keyboard, modeled controller,
physical input, public acceptance and responsive evidence distinct.”

Run `worlds-return-host.test.mjs`, `optional-chapters-host.test.mjs`,
`modal-navigation.test.mjs`, `asset-studio-return.test.mjs` and
`optional-chapters-host-copy.test.mjs` and `optional-world-play-host.test.mjs`. The historical catalogue host assertions
that required a detour through Home are updated to the direct-return contract;
all pack, checkpoint, retained artwork and late-response assertions remain.
The accepted-launch retirement callback also returns to Missions; its test retains
the new attempt identity, zero tick, paused state, artwork disposal count and
unchanged saved profile while requiring the exact More chapters focus.
The imported-art conflict fixture now enters Missions before activating More
chapters; clicking its hidden control from Home is not a player navigation path.

This correction does not by itself complete the unified catalogue, full cross-mode
navigation, offline readiness, physical-device checks or the wider UX programme.
