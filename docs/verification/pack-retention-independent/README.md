# Independent review: preserve a flight when another pack changes

**Scoped source review passes. Integration and publication remain open.**

Base: `8cffb36b29a38013eb9213845efd675c4864c9d8`. Candidate patch SHA256:
`ce08ebd1209320e32312b6716c1058e88079a56fe51d4ea509efe3ef0ac9d18f`.
Final app SHA256: `3643f4172c4d701216b337d26165f871f39faaa67b6179d239a4faa359076997`.
The patch is retained losslessly in `candidate.json` for exact later integration; it is not applied to this
branch's runtime. Preserve newer source/skills by adopting related hunks only.

## Verified regression and correction

The original host loses an unfinished installed-pack cut when an unrelated pack
is removed. An independent baseline run demonstrates tick30 → tick0, cutting
true → false, a new run object and different saved-session bytes. The profile
bytes remain unchanged. The failure is the intended active-run identity assertion,
not a fixture, import, timeout or memory error. Raw stdout is preserved losslessly
as a JSON string in `baseline.json` with its original hash.

The candidate passes **29/29 on Node22.22.2 and29/29 on Node20.19.5**, no skips,
across the complete `library-row-focus-host` and `pack-change-active-flight-host`
files. Checks cover unrelated removal/install preserving the paused cut and exact
profile/session bytes, rejected writes, active-pack removal, and replacement with
changed content even when ID/version match. Existing row/focus behavior remains
covered. These are actual app-host tests with modeled DOM/storage; they are not
physical input or browser-rendering evidence.

All1,052 candidate reads across4processes match264 exact sources. The separate
baseline process matches263 exact sources. `patch-proof.json` independently verifies
all six postimages and forward/reverse applicability to the declared base.

## Source reasoning

`preparePack`/registered libraries recursively freeze their contents. `installPack`
and `removePack` retain surviving frozen pack objects. Therefore reference equality
with the active pack proves survival without trusting names or version labels.
Changed/reparsed objects take the existing replacement path. The stronger
`preserveCurrentRun` append-only validation remains separate. Existing launch
guards, durable-write ownership and reconciliation still fence the commit.

The new decision also avoids cancelling pending mastery ownership when the active
pack survives. That source path was reviewed; these new tests do not directly
exercise a pending mastery callback or independently decode rendered artwork.

## Reproduce

Extract the `patch` string from `candidate.json` as `candidate.patch` (UTF-8,
without adding a newline). In an isolated full checkout of the exact base, apply
that patch and run:

```sh
node --max-old-space-size=768 --test --test-concurrency=1 game/test/library-row-focus-host.test.mjs game/test/pack-change-active-flight-host.test.mjs
```

Repeat on the two recorded Node versions. For the baseline oracle, retain the new
row test but restore the original base app, then run that exact test name using
`--test-name-pattern`. The retained run records contain exact executed arguments.
The local sparse loader reads missing production files from the pinned Git commit;
source hashes prove those reads instead of substituting production behavior.

## Integration boundaries

PR209/public v0.78 admission still owns the next publication. This review does not
allocate a version, merge source or close P06/P16. Adopt the runtime and two tests
with the corresponding guide/prompt/skill additions after the accepted-source
handoff, preserving unrelated maintained skill text. Whole-library replacement
needs its separate explicit replacement review; this patch does not silently
change import into merge. Final integrated gates, native/public journeys and
physical-device qualification remain required.
