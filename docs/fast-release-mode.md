# Full source qualification restored

Full source qualification is restored by explicit owner direction from **24 September 2026** in the approved soundtrack master plan. That later direction supersedes the temporary 22 September fast-release waiver for new feature releases. Deferred checks did not pass during the waiver and remain recorded as skipped evidence.

The repository Actions variable `REVEALLINE_FULL_CI` is the operational switch. Its required value is `true`. A missing or false value fails to run the four shards and cannot satisfy a feature plan that requires all six source gates.

## What blocks a source pull request

The `Build and deploy GitHub Pages` workflow requires:

1. exact pull-request head and tracked-source identity before commands;
2. dependency installation;
3. validation, ESLint, game/native formatting and production provenance checks;
4. all four full test shards;
5. the deterministic static build;
6. exact tracked-source identity after every shard and build; and
7. the aggregate `release-ready` result.

`release-ready` is the stable required context. It requires preflight, four shards and build while full CI is enabled. Individual matrix names should not be branch-protection contexts because matrix names may change.

Manual **Qualify release source** with `run_tests=true` must also run all four shards before a freeze used for a new feature release. Skipped jobs are visible evidence, never passing test results.

## GitHub Pages publication

Publication continues to require the reviewed main selector, the highest stable release match, bounded ZIP extraction, frozen archive and metadata validation, exact artifact assembly, an independent reread of every prepared artifact byte, a final latest-release recheck, and the main-only `github-pages` deployment environment.

The release event routes an eligible immutable tag to the sole publisher. It does not rebuild historical source. Workflow, policy, documentation, evidence-only and controller-test-only merges do not redeploy unchanged Pages bytes.

## Historical temporary waiver

From 22 September until this restoration, `publishing/test-policy.json` used `mode: waived` under authorization `explicit-user-request-20260922`. Source identity, release-critical validation and deterministic builds remained blocking, while four shards and extended checks were skipped. Preserve those run annotations; do not describe them as passes.

A future waiver requires a new explicit owner request and a reviewed policy PR with a new authorization identity, scope, reason and restoration text. Changing only the repository variable cannot authorize a waiver.

## Restoration sequence

1. Merge the reviewed policy/documentation PR.
2. Set `REVEALLINE_FULL_CI=true`.
3. Run **Qualify release source** on current `main` with `run_tests=true` and confirm validation, static/provenance checks and all four shards pass.
4. Rerun each pending feature PR at its exact stable head. Merge only after its required source gates pass.
5. Qualify and freeze the actual merge commit before creating the immutable release.
