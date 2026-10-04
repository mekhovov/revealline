# Optional measured gate-section lesson

This bounded D3 increment offers one existing lesson, **Three gates, one smooth
line** (`beginner-24`), when the result's already-selected measured section is a
gate. It uses the greatest positive section difference from the same compatible
best flight already used by the sector display, or the longest completed section
when that comparison does not select a loss. It does not infer overshoot, poor
attitude, contact causes, or a pilot's skill from a duration.

Only independently verified ordinary World practice receives this suggestion.
School, legacy Academy, playback, authoring preview and unscored section practice
retain their existing result paths. No new lesson, unlock, scoring rule, physics,
course definition or recording is added to the runtime catalogue.

The learner deliberately opens the optional lesson in their original mode. The
shared play menu offers a return before completion; after early exit the School
menu retains the return action. The host preserves the original course snapshot,
installed pack/course identity, playlist and index, control source, camera and
response. Returning validates the installed dependency and exact saved playlist
again, then starts the prior challenge paused without rewriting its already
advanced bookmark. An unrelated course launch clears the detour. This is an
in-memory detour, not an additional persistent recovery format.

## Qualification checkpoint

Source candidate is on `codex/fpv-gate-section-coaching`, based on
`a087facd9ca57f0e7519aa161cb6acc86a7eee3e`. The frozen v1 host SHA-256 is
`451d9145f22bc5b3eb77f7ea605a46a5bb4b6e4ce2b138bb8bb7d4f75be14019`.
The normal merge `f942dab3e5404923f65c80cf6ad6133d23e28597` incorporates main
`72d6661b117e1cf1d76ac5de44381685c63d19b9`; the coaching host is byte-identical.
Incoming runtime changes are the already-merged Solar material/UV paths, guarded
away from the Warehouse/School fixtures. Browser acceptance, clean current-main
package admission and the packaged player are pending. This checkpoint is not a
publication or live-delivery claim.

The first actual browser run passed its first 15 checks (including verified
measured loss and one playlist advancement), then stopped on a fixture mistake:
it waited for the lesson's Arm control to be enabled while the intentional lesson
guide blocks Arm. The real lesson loaded paused correctly. The complete failure
and v1 manifest are retained in `docs/evidence/fpv-gate-coaching-browser-v1-failure.json`
and `fpv-gate-coaching-source-v1-fixture.json`. The v2 observer waits for the exact
lesson, its open guide and the Ready status; it does not change the production
guide or arming rule.

The v2 run passed 112 checks, including both modes, Ukrainian at 390 px, early
return, return after lesson results, camera/source/response restoration and the
advanced bookmark. It stopped when a Return refusal overlapped the asynchronous
pack-removal completion message. Its full failed receipt and manifest are kept.
The final observer preserves status mutations and checks the refusal adjacent to
Return through that overlap, rather than treating a completed-removal wait as
proof that concurrent feedback is correct.

Review also identified stale dependency-read and preparation windows. The host
now reads the exact pack from IndexedDB and only then reads the saved playlist;
it guards the entire asynchronous return by its flight token and detour context.
The detour survives preparation failure and clears only after the original scene
is ready. A dedicated status paragraph beside Return preserves a refusal when an
unrelated operation writes the shared status. No stale rejection may overwrite a
newly selected route. The frozen v5 host hash is
`5ba1182b7f1e2d96931353fbaf5982dee3eefd540feb4795b849b655fcd5d7b3`;
v3/v4 are preserved unrun fixture snapshots, not passing evidence.

The v5 functional controls use a second real database connection to remove,
revise and restore the original pack. A native readonly transaction is held
while a playlist changes, then released; a separate held read is aborted after
an unrelated route takes ownership. Explicit fixture-only renderer preparation
rejections cover failed-return retry and superseded failure. Normal rendering
and storage calls retain their receivers, arguments and results outside those
declared fault cases. These controls do not modify production pause or Arm rules.

The actual v5 run passed 188 assertions before its last storage-race observation
compared the unrelated flight's Ready copy with its later Paused copy. The full
failure is retained in `fpv-gate-coaching-browser-v5-failure.json`; its studio-only
trace does not establish which lifecycle action changed the flight status. The
v6 fixture retains the same production host and observes native transaction abort
completion plus the flight-status setter's call stack. It requires the unrelated
course, controls, zero ticks and cleared return context to remain exact. Any
status change must come from the unchanged `pauseFlight` path, with no error
handler write. This diagnostic does not disable a pause or treat the prior failed
run as passing evidence.

The manual input preparer derives a slower ordinary Warehouse gate flight from
the existing offline authoring pilot by changing only gate travel speed to
350 mm/s. Both modes complete without contacts and with full health, and an
independent replay reconstructs every measured section. It also verifies the
last-tick recovery prefixes and ordinary neutral-input completion. These are
fixture inputs, not a shipped autopilot or recommended example archive.

The real-host fixture restores those exact prefixes through the existing
`startFlight` recovery API, then uses actual Arm and neutral input for the last
tick. Normal result verification runs before any assertion. The fixture freezes
the production module closure and pins its styles/assets, uses isolated browser
storage, and observes rendering without replacing it. It does not alter pause
guards, inject result state, or claim named-device performance. No additional
unit coverage is introduced.

```sh
node scripts/prepare-fpv-gate-coaching-proofs.mjs
node scripts/prepare-fpv-gate-coaching-verification.mjs dist/fpv-gate-coaching-verification-source-v1
```

Existing frozen destinations are immutable. A changed fixture requires a new
directory and hash manifest; previous failed or superseded evidence is retained.
