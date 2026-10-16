---
id: testing
title: Testing
importance: high
filePaths:
  - package.json
  - scripts/game-cli.mjs
  - scripts/run-test-shard.mjs
  - scripts/test-game-cli.mjs
  - game/test/core-capture.test.mjs
  - game/test/profile-writer.test.mjs
  - game/test/replay.test.mjs
  - services/community/package.json
  - publishing/test-policy.json
  - publishing/test-policy.mjs
  - .github/workflows/qualify-release-source.yml
  - docs/development.md
relatedPages:
  - getting-started
  - runtime-data-flow
  - persistence-and-replays
  - community-service
  - operations-and-configuration
---

# Testing

The root suite uses Node's test runner through `scripts/game-cli.mjs`, with deterministic file discovery and bounded file concurrency. It covers several repository areas, but it does not discover every package's tests. Release qualification additionally consults an explicit test policy, so a successful workflow cannot by itself be read as evidence that suites ran. [scripts/game-cli.mjs:1477](../../scripts/game-cli.mjs#L1477), [.github/workflows/qualify-release-source.yml:181](../../.github/workflows/qualify-release-source.yml#L181)

## Commands and coverage

| Command                                              | What the source configures                                                                                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run validate`                                   | Localization check, build/content validation, and presentation metadata check. [package.json:14](../../package.json#L14)                                                                         |
| `npm run lint`                                       | ESLint on explicit game, practice, intake, scripts, site, and platform globs. [package.json:15](../../package.json#L15)                                                                          |
| `npm test`                                           | Recursively finds `test-*.mjs` and `*.test.mjs` in `scripts`, `game`, `authoring/motion-lab`, and the two native test directories. [scripts/game-cli.mjs:1479](../../scripts/game-cli.mjs#L1479) |
| `npm run format:check`                               | Checks the root script's explicit file globs; native formatting has a separate command. [package.json:20](../../package.json#L20), [package.json:28](../../package.json#L28)                     |
| `npm --prefix services/community test`               | Runs the service package's `test/*.test.mjs`. [services/community/package.json:24](../../services/community/package.json#L24)                                                                    |
| `node scripts/run-test-shard.mjs --shard 1/4 --list` | Lists one deterministic subset without running tests. [scripts/run-test-shard.mjs:53](../../scripts/run-test-shard.mjs#L53)                                                                      |

Root file concurrency is `min(4, max(1, availableParallelism() - 1))`. Neither `services/community` nor `publishing` appears in the root discovery directories; targeted scripts such as `company:test` explicitly include selected publishing tests. CI's shard runner uses the same directory list and selects sorted files by index modulo shard count, but its Node invocation does not apply the root CLI's concurrency flag. [scripts/game-cli.mjs:1479](../../scripts/game-cli.mjs#L1479), [package.json:35](../../package.json#L35), [scripts/run-test-shard.mjs:9](../../scripts/run-test-shard.mjs#L9), [scripts/run-test-shard.mjs:55](../../scripts/run-test-shard.mjs#L55)

## Representative contracts

- Core capture tests assert malformed geometry rejection, source-data ownership, and enemy-seeded region retention. These are simulation/validator tests. [game/test/core-capture.test.mjs:25](../../game/test/core-capture.test.mjs#L25), [game/test/core-capture.test.mjs:61](../../game/test/core-capture.test.mjs#L61)
- Profile tests assert a single lifetime writer lease and a session-only second tab using a lock fixture. [game/test/profile-writer.test.mjs:31](../../game/test/profile-writer.test.mjs#L31)
- Replay tests distinguish modified input from forged summaries and reject missing tick records. [game/test/replay.test.mjs:185](../../game/test/replay.test.mjs#L185)
- Build tests compare fixture ZIP bytes across builds and check every manifest checksum. This demonstrates the intended reproducibility contract; it is not a fresh full-distribution result. [scripts/test-game-cli.mjs:341](../../scripts/test-game-cli.mjs#L341)

## Release policy

At this working-tree snapshot, `publishing/test-policy.json` sets `mode: waived`. The parser rejects malformed policies, while `forceTests` can select required mode. The qualification workflow enables that override only when both the repository variable `REVEALLINE_FULL_CI` and the `run_tests` input allow it. Validation, lint, root/native formatting, and the production-readiness check remain unconditional steps in that job; production collection reproduction runs when its script exists. These are observations of configuration, not authorization to change it. [publishing/test-policy.json:1](../../publishing/test-policy.json#L1), [publishing/test-policy.mjs:11](../../publishing/test-policy.mjs#L11), [publishing/test-policy.mjs:38](../../publishing/test-policy.mjs#L38), [.github/workflows/qualify-release-source.yml:181](../../.github/workflows/qualify-release-source.yml#L181), [.github/workflows/qualify-release-source.yml:210](../../.github/workflows/qualify-release-source.yml#L210)

The development guide requires browser journeys for input/media changes and treats physical-device acceptance separately. Static validation cannot establish decoded-image quality, focus behavior, audio output, or hardware usability. [docs/development.md:99](../development.md#L99)

## Evidence

- [scripts/game-cli.mjs:1477](../../scripts/game-cli.mjs#L1477): root test discovery and execution.
- [scripts/run-test-shard.mjs:55](../../scripts/run-test-shard.mjs#L55): CI partitioning.
- [.github/workflows/qualify-release-source.yml:206](../../.github/workflows/qualify-release-source.yml#L206): separately gated Python utility tests.

## Coverage and limitations

Retrieval terms: `test-concurrency`, `--test`, `runTests`, `forceTests`, `assert`, `validate`. Twelve files were selectively inspected. Application suites, builds, browser acceptance, and hosted CI were not run during this documentation task. Test existence and assertions are documented; no passing application-test verdict is claimed.

## Related

[Getting started](getting-started.md) · [Runtime data flow](runtime-data-flow.md) · [Persistence and replays](persistence-and-replays.md) · [Community service](community-service.md) · [Operations and configuration](operations-and-configuration.md)
