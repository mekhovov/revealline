# PR 209 — failed preflight and local generator regression

This preserves evidence for [GitHub run 35549279481](https://github.com/mekhovov/revealline/actions/runs/35549279481),
attempt 1, at exact PR head `ed039c08b68c7b2a59824a9e78f38ee5734308ef`.
The completed run concluded **failure**. Its
[preflight job 106180903504](https://github.com/mekhovov/revealline/actions/runs/35549279481/job/106180903504)
failed in “Validate, lint, and format source” on 2026-09-21 at 00:58:33 UTC.

[Run metadata](run-35549279481.json) and the [failed-step log](run-35549279481-failed.log)
are unmodified stdout from `gh run view` using the exact arguments recorded in
[manifest.json](manifest.json). The manifest pins their byte lengths and SHA-256
hashes, together with byte-for-byte copies of the two local logs below. ANSI
formatting and the original log timestamps are preserved. No signed download URLs
or authentication material are included.

The failed step reached `npm run format:check` after validation output and lint.
Prettier reported these nine files, then exited with code 1:

- `game/content/soundtrack-catalogue.mjs`
- `game/test/collection-records-return-host.test.mjs`
- `game/test/gallery-return-host.test.mjs`
- `game/test/optional-world-play-host.test.mjs`
- `game/test/solo-result-continuation-host.test.mjs`
- `game/test/story-flight-host.test.mjs`
- `game/test/title-entry-host.test.mjs`
- `game/test/title-mode-departure-host.test.mjs`
- `game/ui/soundtrack-player.mjs`

Because the step used Bash `-e`, the later native-format and motion-lab syntax
commands were not reached. Production-ledger and immutable-production-source
steps were skipped. The workflow's tracked-source checks before and after
preflight succeeded; that does not replace those skipped production checks.
The `release_gate`, `build`, and `test` jobs were skipped.

| Original local log                              | Observed final TAP result                                                                      |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Before](revealline-pr209-generator-before.log) | Publication-writer formatting regression failed: 0 passed, 1 failed, 5 skipped by name filter. |
| [After](revealline-pr209-generator-after.log)   | All 6 generator/distribution tests passed; 0 failed or skipped.                                |

The before/after logs were copied from the matching `/tmp/revealline-pr209-generator-*.log`
files after the after-log contained its final 6/6 summary. Their original shell
argv, exit statuses and source hashes are not embedded in the logs and are not
inferred. The after-result establishes a focused local repair check, **not** a
successful successor CI run or qualification of an exact successor commit.

Source-ledger review and broader qualification remain separate. This evidence
does not approve recordings, allocate a version, publish an archive, or authorize
a release. No runtime, ledger or source-generator file was changed to retain it.
