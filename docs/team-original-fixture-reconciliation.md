# Team original-picture fixture reconciliation

This test-only correction was prepared on exact production source
`1fd63337ba1d1635d117877bf16c3e95d83a4167`. It changes no runtime,
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

## Separate inherited lifecycle failures

The untouched `game/test/coop-host.test.mjs` still reports three failures on
this exact base, all at its existing assertion on line 1532:

- already-paused Team retires Help and controller intent on **blur**;
- the same lifecycle contract on **hidden**;
- the same lifecycle contract on persisted **pagehide**.

The complete file produced 77 cases: 74 passed and those three failed. All
three observed `coop-resume.disabled === false` where the test expects `true`
after returning to the foreground. They reproduce without the Team-original
fixture correction, share no changed file or actor-picture request path, and
remain a separate lifecycle investigation. No assertion or runtime behavior
for them is changed here.

The final serial run of the three corrected original-picture host files passed
all 17 reported tests with zero failures, skips or cancellations. The focused
changing-return case also passed independently. Repository lint, formatting,
native formatting, validation and `git diff --check` passed. These checks used
the repository's existing v0.112.0 metadata unchanged.

## Evidence boundaries

The affected tests exercise the real Team host through modeled DOM, image
decode, keyboard commands and exact repository picture bytes. They do not
establish native browser rendering, physical controller/touch behavior,
network/offline readiness, visual approval or public-release qualification.
