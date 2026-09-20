# Release maintenance follow-up — 20 September 2026

Observed v0.67 publisher source qualification annotations warn that checkout@v4 and setup-node@v4 target Node 20 and are forced to run using Node 24. This action runtime is separate from the game tests, which actually ran under configured Node 20.19.6 in both hosted families.

Primary-source review:
- https://github.com/actions/checkout : v5 introduced Node 24, minimum runner 2.327.1; v6 changed credential persistence; current v7 adds fork checkout restrictions for pull_request_target/workflow_run and ESM. Do not enable unsafe fork checkout.
- https://github.com/actions/setup-node : v5 introduced Node 24; v6 automatic npm caching/removal of always-auth; current v7 removes dummy NODE_AUTH_TOKEN fallback and uses ESM. Explicit node-version remains the game-toolchain selector. Disable automatic package-manager caching when not intentionally configured.
- https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/ : official deprecation and upgrade guidance.

P18 maintenance item, queued after this frozen publication: inventory actual workflows and inputs; choose reviewed immutable Node-24-compatible action SHAs; preserve explicit game runtime selection, credential boundaries and non-cancelling publication concurrency; qualify changes through PR and exact runner identities. Verify hosted runner requirements and review the announced ubuntu-latest migration separately. Do not change frozen tags or ongoing runs, use compatibility opt-outs, or report the action-runtime transition as a game-runtime upgrade.
