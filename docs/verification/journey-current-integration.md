# Journey integration with the current player shell

Status: implementation and focused verification; not published or phase acceptance.

The integration combines current source `aadd855e` with stable P01 `3556e257`.
Their verified common ancestor is `6a42faca`; shallow local history is not evidence
of unrelated repositories. Current optional chapter ownership, cancellation and
Team threat guidance remain intact alongside candidate artwork and Journey flow.

## Corrections found during integration

- The initial opening compiler omitted the authored Arcade policy. New projects
  now use `journey-arcade-v2`; legacy `journey-v1` remains a registered immutable
  behavior. The new policy suppresses manual ability/Supply/Boost at core authority,
  including replays, and retains all four contact bonuses.
- Candidate saved-flight restoration passed through the installed Legacy pack
  resolver. It now resolves exact candidate ownership and the saved preset.
  Next-attempt difficulty intent remains separate from the restored flight.
- Team host tests now inspect actual Drifter guidance, preserving the original
  pinned-preset, controls and recovery assertions.

## Evidence and limits

The initial four-file policy/core/compiler cohort passed 22 tests on Node20.19.5.
The retained save failure reported an uninstalled chapter despite successful replay
verification; the corrected targeted host test passes. Sixty renewed routes preserve
every legacy checkpoint and every non-policy outcome section, win without life loss
and verify exact replays. Original fixture files are retained with `legacy-` names;
the CLI refuses changed legacy identities/checkpoints and compares renewed fixtures
by default. `--write` explicitly renews only after all per-route checks.

Native browser checks at 1280×720: keyboard title Continue, active flight with no
manual-action hints, Down then attempted E/R, explicit Escape and focused Resume;
visible Arcade Edition confirmed. Before the policy change, a real First return
win yielded 34.3%, 8,160 points and three lives/stars. That earlier observation does
not independently qualify the corrected policy's whole native win sequence.

The renewed seven-file host/route cohort passes 54/54 on Node20.19.5. The combined
eleven-file policy/compiler/host/route cohort passes 76/76 on Node22.22.2. The
separate historical-route CLI regression passes 1/1 on Node20.19.5. These cohorts
overlap; their counts are not added as unique tests. Selected production/test
modules pass lint.

A further native corrected-policy run resumed its saved Down direction, closed a
34.3% cut on Choose your share with 8,160 points/three lives, stopped on reclaimed
ground, retained the result while idle, and paused explicitly with Resume focused.

Full exact-source gates, public deployment, offline/browser recovery and physical
controller/touch acceptance remain outstanding. Screenshots were observed inline;
no exported screenshot hashes are claimed. Integration does not certify the whole
Journey phase or human enjoyment.

## Navigation reference recheck

The September 20 recheck of [Xbox UI navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112)
supports consistent digital-input navigation, predictable focus and accessible Back
routes. Continue/Pause/Resume observations here are scoped checks; they do not
establish all-menu or physical-controller acceptance. No new claim about XPOSED
input timing or internal algorithms follows from this reference.

## Final gap correction candidate — 2026-09-20

The f009474a integration is not the final accepted release. Review found that
Journey Versus inherited the timed Legacy host, and older Journey policy saves
were safely rejected with misleading pack-install guidance.

- Adopted the bounded 408a7b1d untimed protocol/host changes: explicit
  `xonix-duel.untimed.v1`, zero authored duration and null match deadline.
  Legacy timed-v1 still defaults to 90 seconds, retains its shape and rejects zero.
  Untimed packet validation requires explicit matching protocol context.
- Candidate saved flights unavailable in the current authored edition retain their
  original bytes and direct the player to export before choosing a new mission.
- Preserved the original v1 reference crosswalk byte-for-byte. Renewed v2 pins only
  after proving old policy identities; source references, uncertainty and human
  playtest requirements remain unchanged. Adopted b42c3bb9's bounded correction.
- Node 20.19.5: 44 actual-host, untimed/timed core, recovery and shell tests passed;
  three crosswalk tests passed. Initial sparse-fixture failures are retained in
  `.cache/p01-music-integration-review-r1/final-gap-tests-r1.log`; exact committed
  fixtures were restored before the successful r2 run.

The unpublished version remains 0.69.0. This correction needs fresh qualification
of the final source, immutable publication and deployed journeys. Earlier CI runs
remain evidence for f009474a, not this changed candidate.

Node 22.22.2 independently passed the same 47 tests (44 host/core/recovery/shell
and three crosswalk checks). Changed JavaScript passed ESLint; changed runtime/test
files passed Prettier without further edits. These are local focused gates.
