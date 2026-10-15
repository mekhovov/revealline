# Flight practice: expanded player-flow checks

Hosting and publication remain deferred. This continuation follows the
[repair report](flight-practice-repair-2026-10-15.md), advancing C2 without
changing SIM mechanics, controls, rendering or training content.

## Integration and method

Rebased cleanly onto main `d452bda9e22acf705751f11584cdcd5b0a0d4640`.
This includes SIM's Alpine quiet-timber/station-concourse Library offers and
World Library flight-record navigation. Those inputs differ from the earlier
`50b7612e8` candidate; that candidate's receipts remain historical.

The registered v2 observer adds ten exact cases: EN/UK Gym, Academy Self-level
and Acro, and Worlds Self-level and Acro. It observes document language and the
localized Settings label, selects modes through Settings → Gameplay, and checks
public movement, pause stability and retry. The original v1 four-case protocol
remains supported without extending its claims.

A separate two-case Gym protocol requires a fresh lift-and-land exercise,
ordinary R/F input, visible lift, ordered 0/2 → 1/2 → 2/2 checkpoints, landing,
the native completion/result/checkmark, and released input keys. It captures
completion before entering Settings → Data to export the actual transcript.
The standalone runner independently replays that export with the exact native
catalogue/model and byte-matched seven-file dependency closure from the admitted
Gym package. Future unlisted imports fail closed. Run each frozen candidate in
a fresh process; this verifier is not intended to span repository revisions
through a long-lived Node module cache.

The whole envelope, including original runtime/source archives and inventories,
is admitted before staging. Gym plans bind Gym's revision; the generic loader's
existing default Academy selection remains compatible. Authority snapshots and
exclusive evidence outputs preserve failed attempts as well as passes. This
does not insert a transcript into the browser or synthesize native completion.

Independent read-only review found no blockers in the helper, replay or runner
integration; 34 focused tests passed (18 observer, 12 input-helper, 4 replay).
The [maintainer guide](flight-practice-maintainer.md#repeat-player-flow-observations-locally)
documents protocol selection and safe access handling.

## Acceptance boundary

Fresh candidate build and native-browser results will be recorded separately
below. Unit tests alone do not complete C2. Both observers start from stable app
launchers, not the main-game Flight practice directory. FPV exercise completion,
first-time human learning, physical input/accessibility, distinct-version
migration and public-host acceptance remain separate gates. `qualified` stays
false; no review approval is fabricated.
