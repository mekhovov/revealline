# Flight practice: repair and player-flow acceptance

Hosting remains deferred. This continuation follows the
[pointer correction](flight-practice-pointer-2026-10-15.md) with package recovery
checks and observation of the ordinary player controls.

## Source and integration

The branch rebased cleanly onto main `691351e1d757276eea7e94cc08fca07f6a16021f`.
That main includes SIM's new Lunar shelter Library offer. The earlier candidate
does not contain that offer; retain its exact source identity in every receipt.
Its package source is `bf31260eb82530eeca38e1c2d84f63a22696946e`, tree
`e86346d82dc81d8d0fee94f7ab189668cb743e56`, envelope SHA-256
`128b8447235424fcb18aa1cc99a49a6ebeccb23cc86d7a0704c85fd2793cbd4c`.
All three original package archives remain independently admitted development
artifacts. No release has been allocated or selected.

## Verification exchange diagnostics

The earlier [failed installation run](flight-practice-pointer-20261015/installation-unverified.json)
prepared all three apps, then Academy's active runtime verification was
inconclusive after every window closed. Open stayed hidden. Missing files would
normally produce the separate confirmed repair state. The receipt cannot
distinguish a timeout from a registration/message error or a worker-reported
inspection exception. The [unchanged retry](flight-practice-pointer-20261015/installation-retry.json)
passed all nine checkpoints; that does not establish the cause of the failure.

The observer now offers opt-in registration/status-message/page-lifecycle tracing
and first-page CDP worker events. It forwards native calls, promises, transferred
ports and replies without changing the admitted package files. It never starts a
message port, changes a password form, forces worker activation or retries a
failed verification automatically. The per-document and aggregate event limits
are bounded; output contains only selected public status metadata.

```sh
OPTIONAL_INSTALLATION_DIAGNOSTICS=1 \
OPTIONAL_INSTALLATION_COLD_RELAUNCHES=5 \
node scripts/observe-optional-installation.mjs \
  PLAYWRIGHT_MODULE EXACT_CANDIDATE NEW_REPORT_JSON
```

Supply authorized access through a protected environment or silent input. Keep
credentials out of command arguments, plans and evidence. Repetitions accept
integers 1–5; the original ten-minute observation and 30-second status limits
remain unchanged. This instrumentation can affect scheduling, so retain its
results as diagnostic evidence. CDP worker events come from the first page's
session, which detaches when that page closes. Protocol bindings continue across
new pages. The protocol event definitions are documented in the
[Chrome ServiceWorker domain](https://chromedevtools.github.io/devtools-protocol/tot/ServiceWorker/).

| Receipt                                                                        | Observed result                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Initial diagnostic](flight-practice-repair-20261015/cold-diagnostic.json)     | Nine checkpoints passed; 398 events, 48 status requests, 42 replies observed; no explicit unknown reply. Slowest observed reply about 10.8 seconds.                                                                                                                                |
| [Five-round diagnostic](flight-practice-repair-20261015/cold-five-rounds.json) | All three apps reopened in each of five closed-window rounds, followed by installed-window and browser-process restart checks; nine checkpoints passed. 500 events, 71 status requests, 65 replies observed; no explicit unknown reply. Slowest observed reply about 2.83 seconds. |

Neither run dropped aggregate events. Some requests outlived their page's
navigation and therefore have no reply in that document's trace; that alone is
not evidence of a 30-second timeout. The deliberate damaged-package fixture
produced worker-install errors as expected. The five immediate reopen rounds do
not prove that the browser stopped every worker between rounds; the later
browser-process restart is a separate recorded transition. Both runs cleaned
their owned apps, browser/profile and server.

The intermittent failure remains unresolved. These observations justify better
future diagnosis, not a speculative runtime fix or a claim of universal cold
startup reliability.

## C7: cache/worker repair and isolation

The [native browser report](flight-practice-repair-20261015/cache-repair.json)
passed **16 checkpoints** in Chrome 155.0.8059.80 at 1440 × 900, DPR 1. Each of the
three apps was prepared through its ordinary controls. The observer separately
deleted exactly one hash-verified cached `index.html`, and unregistered exactly
the owning runtime worker while leaving its cached files intact.

All six faults produced **Needs repair**, withheld prepared/offline Open, and
kept the public Remove/Download actions available. Public repair restored the
complete exact cache six times. Removing each app's runtime copy preserved both
siblings' cache contents, worker identities and installation pointers. The
original artifacts, staged files and observer sources remained unchanged. All
cleanup operations passed; there were no page errors.

This is controlled fault injection in a disposable profile. It does not prove
actual browser eviction or device quota exhaustion. All observed database stores
were empty, saved-place storage absent and the profile record absent. These
fingerprints establish isolation of those observed states, **not preservation of
populated worlds or progress**. Gym records and unrelated localStorage keys were
outside the observer's allowlist. A populated World case remains required.

### Populated World repair follow-up

The separate [v2 report](flight-practice-repair-20261015/cache-repair-seeded.json)
passes **18 checkpoints** on the same exact `bf31260eb` packages. Through the
ordinary Workshop controls it cloned the “First three” template, named it
“C7 retained world”, and installed it. The actual World Studio database then
contained one project, one revision and one metadata record. Their full
fingerprints stayed unchanged through all six faults, six repairs and three
scoped removals. A final page reload showed the same installed card ID/title.
All source/artifact checks and cleanup passed, with no page errors.

This closes the earlier empty-project-store limitation for **that one authored
template copy**. It does not qualify imported model assets, regional content,
flight records, profiles, `.rlpack` import/export, process restart or native
browser eviction. The [complete original output archive](flight-practice-repair-20261015/cache-repair-seeded-originals.tar.gz)
retains the plan, 18 checkpoints, eight screenshots and source witnesses.

```sh
node scripts/observe-practice-cache-repair.mjs \
  EXACT_PLAN_JSON PLAYWRIGHT_MODULE NEW_OUTPUT_DIRECTORY
```

The plan pins the envelope, source commit/tree and all three package revisions.
Use the original retained plan as a shape example and replace every pin when
testing another admitted candidate. Never substitute a newer source name in an
older receipt. [Original outputs and hashes](flight-practice-repair-20261015/README.md)
include every checkpoint, the six screenshots and observer-source snapshots.

## Automated verification and remaining gates

The current practice suite passed **346 tests**, zero failures/skips; its
[original log](flight-practice-repair-20261015/practice-tests.log) includes the
quota integration regression. The new `practice:observer:test` suite passed
31 tests and is now required in candidate CI. The installation-observer suite
passed 14 tests; independent review repeated all 45 checks. The C7 v2 observer
has 10 focused tests. These are test-tool checks, not browser acceptance.
The earlier pointer continuation retains its 345-test practice result,
10 pointer-tool tests, native UI regressions and all failed attempts. Later
source changes require their own appropriate checks.

### Player-flow attempts retained

The [first attempt](flight-practice-repair-20261015/first-flight-attempt1.json)
failed all four declared cases because of test assumptions about Pause,
Settings Back and the tutorial Retry control. The [second attempt](flight-practice-repair-20261015/first-flight-attempt2.json)
passed Gym and Worlds movement/pause/retry, but both Academy cases stopped with
Settings open: a background Home button was layout-visible behind the modal.
The observer now checks the actual open-dialog state before selecting Start.
Both failed aggregate results and original screenshots are preserved. Neither
attempt establishes exercise completion or an Academy runtime defect.

The corrected [third attempt](flight-practice-repair-20261015/first-flight-attempt3.json)
passed all four declared EN cases: Gym, Academy Self-level, Academy Acro and
Worlds Self-level. Each deliberately started, gained at least 0.2 m on the visible
HUD, held a paused state for 600 ms, retried to its initial height/zero FPV speed,
then moved and paused again. Cleanup and source checks passed. Controls used
ordinary keyboard actions plus pointer Pause/viewport activation; no force click,
runtime hook, imported proof or storage injection supplied motion. The receipt's
`qualified: false` remains intentional: this is not full C2, a completed exercise,
the main-game directory route, UK, Worlds Acro, human learning or physical input.

### Controlled quota-denial protocol

`OPTIONAL_INSTALLATION_QUOTA_PROBE=1` adds an opt-in Academy preparation failure
using Chromium's `Storage.overrideQuotaForOrigin` on the disposable loopback
origin. It verifies zero quota, keeps all three saved installation pointers,
checks failed-scope cleanup, and restores the default quota without clearing
origin data. Only after the existing ordinary rollback does it try the pristine
alternate path again, preserving the single retained-version slot. Uncertain
reset or pending work prevents a passing result. Native results are still pending.

This is a controlled **origin-wide quota override**, not actual disk exhaustion,
browser eviction or proof of a particular `Cache.put` exception. Registration
may fail before asset caching. The API and reset semantics are defined by
[Chrome's Storage protocol](https://chromedevtools.github.io/devtools-protocol/tot/Storage/#method-overrideQuotaForOrigin).

Remaining priorities are the intermittent verification failure; populated content
preservation; the full directory/flight/exercise route in both locales; distinct
version migration with a protected active flight; cancellation/stall/write-denial
cases; and device, accessibility, performance, learning and content reviews.
The existing candidate archives all use `v0.151.1`; their different commits are
not evidence of a distinct-version release migration. Hosting and public release
selection remain deferred. See the
[executable checklist](flight-practice-release-checklist-2026-10-15.md).
