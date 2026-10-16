# Installed Team results and media continuation — 15 October 2026

## Source and reproduced failure

Continued from fetched main `206ccd8b53180c061d394069037678de1b33761b` on
`codex/creator-team-results-20261015`, preserving the primary checkout. The prior cold-intake
correction merged in [PR #1519](https://github.com/mekhovov/revealline/pull/1519).
Its Pages job was superseded by a newer main publication. At this checkpoint, public deployment
metadata still identified `b066cf5dabab1f9395c50e04d249c54a68ac8caf`; public adoption of the
cold-intake correction and this Team correction is not yet claimed.

The new integration test reproduced a media-specific continuation defect. A generated two-level
campaign installed with two exact pictures. The first mission legally completed and recorded its
correct earned-picture hash, but Next created a new picture selection without the campaign's
`teamMedia`. The next mission started without its supplied picture. Selecting the same mission
again from the installed library acquired the correct picture, explaining why start-only checks
missed this path.

Next now carries the accepted campaign media into an ordinary same-pack successor. A destination
from discovery uses its own media, and an authored Journey destination receives no imported media.
The existing preparation, cancellation, first-paint and adoption guards still own the transition.
No gameplay geometry, actor settings, stored edition, legacy evidence or earned reward changes.

## New host acceptance

The regression uses the actual generated pack, installed-media store, current gameplay tuning,
production Team host, legal keyboard direction/Support inputs and original picture-byte hashes.
The existing current-host route helper now accepts an explicit authored level so the generated
mission's actual identity is exercised. It does not substitute a built-in level for that mission.
Historical boosted simulation routes remain separate and unchanged.

On Standard with Full teamwork, the new journey verifies:

1. Generate, prepare and install a two-mission media campaign with distinct approved PNG bytes.
2. Launch the first exact installed mission through the visible mission library.
3. Earn an ordinary win, persist its exact picture hash and open its earned-picture viewer.
4. Deliberately choose Next and verify that the successor paints its own exact decoded picture.
5. Confirm that merely starting Next has not awarded that mission's picture; pause and persist its
   initial unfinished checkpoint.
6. Recreate the host with the same storage, select the saved successor and legally complete it.
7. Retain both distinct earned hashes, remove the completed attempt and offer no invented successor
   after the final mission.

The first test draft used an asynchronous predicate with a synchronous wait helper and was
corrected locally. The subsequent actual-image assertion failed on the unchanged production host,
including after advancing render frames. The production media handoff correction makes that exact
assertion pass. The test is registered in both the creator acceptance runner and industrial
creator CI phase.

## Verification and remaining gates

The focused installation/media-results/continuation cohort passed **13/13 tests**, with no
failures, skips or cancellations. Repository source validation (`node scripts/game-cli.mjs validate`),
changed-module ESLint, formatting and diff checks passed. The final strengthened journey rerun also passed **3/3**, including preservation of the saved
attempt ID and legal cut contributions from both seats. These are finite DOM/Canvas/IndexedDB and
image-decoder observations, not a native browser victory, physical audio or human balance approval.

The built-in browser's existing Team edition `48575fd9d3b95e0cbc367fe4e957fae235b9015bf9e62dc61b03237bf5b3be71`
remains paused. Its 211,020-byte actual download matches that SHA-256. Both players' normal inputs,
reserve-loss recovery and pause were observed; no browser win or Next pass is claimed. The saved
attempt was retained when Restart offered a discard confirmation.

Keep native Team win/earned viewer/Next, Team video controls, other difficulty/teamwork settings,
real browser quota failure, peak memory, physical clean-profile transfer and the named desktop
browser matrix open. GitHub Pages remains the static host; public community accounts/uploads still
need an independently selected backend and operational acceptance.
