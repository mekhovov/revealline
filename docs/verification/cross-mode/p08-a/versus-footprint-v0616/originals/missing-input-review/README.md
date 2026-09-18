# Versus broad-cohort missing inputs

Exact source: `d34e283819376eb43e4942287d9767b22a4f6487`. All Git reads used `GIT_NO_LAZY_FETCH=1`. This agent ran no tests, hydrated no source/assets, and changed only this cache report. Parent owns active worktree and hydration.

The preserved initial run completed with 204 tests, 121 passing and 83 failing. The log contains seven distinct absent file/module roots, recorded with exact object IDs and sizes in `observed-roots.json`. Missing `game/app.mjs` prevents Solo boot; undefined session/record assertions downstream of that failure cannot establish a behavioral regression. Other import-time missing fixtures prevent complete test files from executing. The next fully hydrated whole-file run must determine whether independent runtime failures remain.

Parent has hydrated the seven roots and the app literal graph. An independent union walk of Solo app, Versus host and Team host visits 218 exact-source modules; none remains absent. The replay path in this cohort is a three-entry static markup loop in `couch-markup.test.mjs:55`; it does not import the Replay runtime.

`additional-paths.json` identifies 22 further paths absent at inventory time, totaling 44,789,594 logical bytes (42.71 MiB). `additional-inputs.json` includes exact Git object IDs, lengths and consumers. The installed-chapters file calls `buildFractureTheme('ukraine')` and `buildCountercurrentTheme('coupa')` at lines 831–832. Their complete builders validate all edition provenance and pinned source tables, then read exactly three selected original PNGs apiece. The two substantial geometry source packs remain required even though these tests do not display their embedded pictures. Do not hydrate unrelated theme originals or the complete compiled asset tree. Parent must budget this growth before hydration.

The template image reads are finite: `helpers/coop-presentation-fixture.mjs:14` resolves the two `COOP_PICTURE_BINDINGS` through compiled URLs (Orchard / Foundry PNGs ending `53f1206a…` and `d76f309d…`); `couch-static-picture-host.test.mjs:19` reads the FPV signal-01 and orchard-crossing owners (PNG ending `c1aedf89…` plus the shared Orchard). These are the three observed PNG roots, not three new production slots.

Solo boot `app.mjs:198–203` always requests six JSON resources; `archive-catalog.json` is the outstanding one identified by this review. `game/build-config.json` is retained as a small conditional source-version dependency (`app.mjs:4497`), not an observed unconditional failure. `game/replays/sentinel-routes.json` is read directly by the encounter/navigation whole files.

This static review is a bounded dependency inventory, not source-gate acceptance, native layout proof, image decode proof or public release verification. No source correction is warranted from the sparse-input failures alone.
