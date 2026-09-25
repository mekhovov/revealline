# Team original-picture fixture reconciliation

This test-only correction was prepared on exact production source
`f6fea50063b1824d5e7f12b826697975194a171d`. It changes no runtime,
presentation asset, gameplay rule, version or published release.

## Reproduced fixture failure

On the unchanged base, `game/test/team-originals-host.test.mjs` failed both of
its cases before their player assertions ran. The Team host now prepares the
compiled actor presentation during boot, but the older original-picture
fixture had replaced `fetch` with a handler that accepted only reveal-picture
paths. It rejected the compiled `runtime.<sha256>.json` request with `Only
registered candidate image paths may be fetched in this fixture`.

The three original-picture host fixtures now delegate only the compiled
presentation runtime and hashed asset path forms already validated by the
shared actor transport. Their reveal-picture handlers remain strict: an
unregistered request still fails, modeled offline pictures still fail, and
all exact image hashes, release counts, retained-result, retry, progress and
navigation assertions remain. Each affected suite additionally proves that
the Team host requested its current compiled actor authority.

The changing-return pressure fixture also carried an older final-destination
expectation. Current Team Journey authority, independently covered by
`team-journey-next-host.test.mjs`, ends the explicit Journey after its twelfth
mission and hides Next. The corrected expectation verifies that exact ending
copy and that the accepted picture remains retained. It does not make legacy
content unavailable through its existing browser entry.

## Integrated lifecycle correction

The first combined UX2 inventory reproduced three separate already-paused Team
lifecycle failures after blur, hidden, and persisted pagehide. The game correctly
retired Help and stale controller intent, but the controller echo window also
consumed the first fresh keyboard Confirm after the held controller was released.

The shared guard now exposes an explicit lifecycle-neutral boundary. A held
controller remains blocked after return; once a neutral frame is sampled, a fresh
keyboard action is accepted immediately. The ordinary delayed Steam keyboard and
trusted-click echo window remains unchanged. The guard suite passes 18/18 and the
complete Team host passes 77/77, including all three lifecycle paths.

The integrated original-picture cases passed in the serial changed-test inventory.
Repository lint, repository/native formatting, validation, motion syntax and
`git diff --check` are rerun on the final reconciled source. The existing v0.112.0
metadata remains unchanged.

## Evidence boundaries

The affected tests exercise the real Team host through modeled DOM, image
decode, keyboard commands and exact repository picture bytes. They do not
establish native browser rendering, physical controller/touch behavior,
network/offline readiness, visual approval or public-release qualification.
