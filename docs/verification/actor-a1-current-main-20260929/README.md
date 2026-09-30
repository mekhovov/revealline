# Prepared A1 integration evidence

Source-only patch; production admission and public acceptance remain pending.

The patch, complete logs, exact path inventory, loader and per-file SHA256 manifest
are preserved inside `evidence.tar.gz`. Extract it before following the commands
below; its internal paths refer to that extracted package. The archive is a
reproducible integration handoff, not an approved runtime release.

- Exact application base: `64c8b9d81604984363666abadae236d9f2f76f7f`.
- Donor PR761 source: `d9f37b57066b97add90b0ac96d0b5efe834d58e0`.
- Patch: `actor-a1-current-main-20260929.patch`, 17 paths (8 runtime, 7 tests, 2 fixtures).
- `manifest.json` records exact base/candidate path hashes and every packaged evidence-file hash.
- `focused.tap`: 152/152 pass. `preservation.tap`: 31/31 pass.
- `baseline-expected-failure.tap`: 3/3 deliberately selected new rotor regressions fail on unchanged main (240/390/1152px); these are reproduction evidence, not candidate failures.
- Syntax/format/scoped ESLint pass. Independent read-only patch review found no blocker.

## Integrator instructions

Use an owner-approved integration checkout at the exact base above. This evidence package did not create a checkout or mutate source/refs. Check `git rev-parse HEAD` before applying; the following are future integration instructions, not actions already performed:

```sh
git apply --check --whitespace=error-all /absolute/path/to/actor-a1-current-main-20260929.patch
git apply /absolute/path/to/actor-a1-current-main-20260929.patch
node --test --test-concurrency=1 --test-reporter=tap game/test/rotor-presentation.test.mjs game/test/actor-presentation.test.mjs game/test/coop-actor-presentation.test.mjs game/test/coop-hunter-pose.test.mjs game/test/coop-freeze-presentation.test.mjs game/test/coop-recovery-pose.test.mjs game/test/contact-cue-comparison.test.mjs
node --test --test-concurrency=1 --test-reporter=tap game/test/enemy-catalog.test.mjs game/test/actor-appearance-lease.test.mjs
```

Evidence used Node22.22.2. Run the checkout's normal scoped syntax/lint/format checks as well. For another base, merge the narrow hunks deliberately and rerun the checks; do not replace entire renderer/producer files from the older worker. PR783 has separate picture/jammer/reception ownership, disposal and masking changes. Root's Team Large-text work is another integration input.

## Boundaries

The Solo renderer preserves current-main `themeFamily` forwarding. The independent fpv62 actor lease and all approved PNG/geometry bytes remain unchanged. No candidate registration, schema/core/app/producer/production manifest/version/build/release changes are in this patch. Default Team prepared contact rendering is deliberately corrected to one foreground unfilled physical circle; legacy fallback and identity badges remain.

Expected A1 admission scope remains 59 slots (7 motion, 10 effects, 37 Team, 5 equipment) only while app/audio stay unchanged. Extend producer dependency closures for new helpers, support the current effects20 predecessor, and compose a reviewed exact-source continuation with the original Team/default/image and equipment PNG guards. These production-admission steps are not included or approved here. Audio52 remains independent. Native/cross-mode integrated visual, build, device and public-release qualification remains open.

## Temporary harness provenance

The successful tests ran against individual temporary candidate files plus exact-main module bytes read with `git show` through the retained loader. Necessary JSON and tiny original PNG fixtures came from existing local main objects; no lazy fetch, image downloads or full checkout. Existing node_modules was reused. `harness/module-inputs.json` preserves unique observed module hashes. The loader/manifest retain their original temporary paths for audit; a complete source checkout uses the ordinary commands above without this loader.

The first loader attempt missed macOS `/private/tmp` canonical paths; the initial adjacent lease run lacked local PNG fixtures and reached its Git-cwd fallback. Both harness failures are retained and were corrected without changing patch bytes. Their later passing receipts are separate. `report.md` and `report.json` retain the original absolute evidence paths and detailed prerequisites.
