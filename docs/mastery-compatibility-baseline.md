# Immutable v0.6.0 baseline for optional mastery

Captured on 12 September 2026, before the Steady Signal observer increment. [The compatibility test](../game/test/compatibility-v060.test.mjs) compares current source against [stored v0.6.0 facts](../game/test/fixtures/compatibility-v060.json). It does not generate its own expected checkpoints. No gameplay, mastery, pack, library or replay behavior was changed to create this baseline.

Run it with:

```sh
node --test game/test/compatibility-v060.test.mjs
```

The initial capture passes **29 tests**. Normal execution needs the compact fixture, current modules and current bundled content. It does not invoke Git, read a frozen release, download anything, decode artwork or run a fixture-update command.

## Source and capture provenance

The authority is [frozen v0.6.0](../releases/v0.6.0/release.json), source commit `e88bab7e9677c82419aca35557c858c670425f16`:

| Artifact                                    | SHA-256                                                            |
| ------------------------------------------- | ------------------------------------------------------------------ |
| `source.tar`                                | `8b0ad855a170c16d9d217aa9bc25619d518b4b74d16a25889c2c46989a21388d` |
| Site manifest                               | `6803d6dc471165de4ab4a61af7c5a24ec8472e47f55b0a2d9c1a6324ddadd2c3` |
| Distribution ZIP, recorded release identity | `5eb72e65a262a57cbbff7d3c485c0a99d3857c3bfe2233092e8463e50b8b042d` |

During capture, the source archive hash and site manifest hash were checked. Twenty-six relevant site files were checked against the manifest's byte counts and hashes; those input paths/hashes are retained in the fixture. The core entry point, replay, sessions, library, campaign, class recipes and both selected proof files were additionally compared byte-for-byte with their source archive entries. This capture did not repeat ZIP reconstruction; the ZIP value above identifies the already frozen distribution.

The one-time capture executed the **archived site's modules**, using the archived `campaign-routes.json` and `homeward-routes.json` input segments. It asserted their existing expected summaries and, where available, checkpoint objects before retaining the new baseline. Live-cut suspension and continuation also executed the archived session/replay APIs. Current source was used only afterward as the implementation under test.

The fixture is under 128 KiB and contains no image data URLs, sprites, music or full pack copies. Repeated replay envelope fields and the seven-class roster are shared within the fixture. The test reconstructs those envelopes from stored fields; it never normalizes a current level or calls a current recorder to manufacture the expected old replay. A canonical SHA-256 pinned in the test protects the whole fixture's semantic content, independently of whitespace formatting.

## What is frozen

All five existing campaign keys, all 25 normalized map hashes, and both seed-1 Scout board identities per map are retained. Those 50 board checks exercise the legacy `boardIdentity` API's empty-route default; the nine completed-route checks below additionally preserve the actual recorded class routes used for scores:

| Campaign       | Maps | Exact campaign key                  |
| -------------- | ---: | ----------------------------------- |
| First Signal   |   12 | `first-signal/2/88639f3aab7b6cc1`   |
| Night Shift    |    3 | `night-shift/1/7b8ffcade23e3175`    |
| Living Threads |    3 | `living-threads/1/e3287c370bec5e41` |
| Fieldcraft     |    4 | `fieldcraft/1/96ae746769a8b440`     |
| Homeward Skies |    3 | `homeward-skies/1/0d01f5687b3c38ff` |

The production JSON roster and core's default roster must retain all seven class loadout hashes and `roster-v1-e159e435`. Each representative completed route also retains its actual initial class, final class route, board identity and seven-part completion-variant key. In particular, the Switchyard board includes its real Bomber → Carrier route; a hypothetical empty route is not substituted for the completed scoreboard identity.

| Archived recorded route               | Steering    | Ticks | Final state-v2 checkpoint |
| ------------------------------------- | ----------- | ----: | ------------------------- |
| First Signal / Interceptor            | Immediate   |   820 | `952a6d30e19f2a66`        |
| First Signal / Interceptor            | Grid-center |   820 | `f9829f980c3035a2`        |
| Copper Orchard / Fiber                | Immediate   | 1,305 | `66789a9f13e6229c`        |
| Copper Orchard / Fiber                | Grid-center | 1,305 | `20ee4fb4f807d72d`        |
| Copper Orchard / ordinary Interceptor | Immediate   | 3,748 | `43794a01fcf2c187`        |
| Copper Orchard / ordinary Interceptor | Grid-center | 3,751 | `b76744b899a72620`        |
| River Switchyard / Bomber → Carrier   | Grid-center | 1,210 | `95464ded0cf26bc5`        |
| Home Beacon / Impact                  | Immediate   | 1,120 | `893fa3b7d385d7d2`        |
| First Signal map 7 / legacy lane boss | Grid-center |   612 | `d270417b7269d777`        |

Every trace checks its full summary, all twelve authoritative checkpoint sections, recorded replay envelope and canonical digest of the entire ordered tick-event sequence. Additional checkpoints at ticks 100, 240 and 500 detect intermediate divergence that a matching terminal result might hide. Both synchronous and asynchronous public replay verifiers must accept the retained `xonix-replay.v3` / `xonix-core.v2` documents using `fnv1a64-state-v2`.

Four archived `xonix-session.v1` documents cover genuine suspended live cuts:

- First Signal in both steering modes, paused at tick 509 with eight live trail cells.
- Copper Orchard / Fiber in both steering modes, paused at tick 180 with eighteen live trail cells during its first resistant cut.

Restore must reproduce the old checkpoint, retained live trail and released input state. Suspending that restored flight again must reproduce the same session. Continuing the remaining recorded inputs must reproduce the archived continued replay, including its explicit release boundary, and reach the original winning checkpoint. This checks old action/turn latches and reconstruction semantics as well as the visible picture result.

## Relationship to Steady Signal

The [mastery plan](round-15-mastery-plan.md) keeps optional definitions and observer state outside legacy level, physics, summary and checkpoint objects. The two Fiber routes and their ordinary Interceptor counterparts provide an existing positive/control pair for the observer. These compatibility tests assert only their pre-mastery simulation facts; they do not award seals, authorize practice rewards or claim that a partial current-cut preview qualifies.

An observer must sample each actual fixed tick without changing the run or event order. Reconstruct its partial cut state through the same replay/restore path. Its own tests should prove that a successful qualifying resistant closure counts, while failed or redeployed cuts, stationary dwell, non-resistant routes and fragments of separate attempts do not. Those predicates are deliberately not inserted into the frozen v0.6.0 checkpoint.

## How to treat a failure

Do **not** regenerate this fixture from current code to make a failure disappear. First inspect the named checkpoint section, event digest, normalized-map hash or identity. Fix an unintended old-version change; introduce an explicit new-version branch for deliberately new gameplay. Keep old replay/session readers and the old campaign serialization intact. The existing proof suites remain additional requirements and should not be rewritten around these nine examples.

If archival provenance itself is found incorrect, investigate against the recorded commit/archive and review a correction explicitly. A later release needs a separately named baseline; it must not overwrite this file or its integrity pin.

This is representative simulation and identity coverage, not exhaustive gameplay or migration certification. It does not independently freeze every class on every board, verify full-backup/profile migration, check image bytes, exercise browser storage, or replace live keyboard/touch/controller testing. Those existing suites and release checks remain necessary.
