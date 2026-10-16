# Pilot recording batch: plan and delivery status

The initial fetch resolved main to `c5885a15561a88331c5566c5312392c4e5d8daf5`.
While this batch was separated, main advanced to
`d9ff8b86b71c3de0d337fc0a5eeb394b37c73e2f` with #741’s test-only synchronization
fix. The independent branch is based on that newer main commit.
The inventory/measurement/company/screening inputs #726, #729, #738 and #747
remain open. Cumulative integration #746 now exists; this pilot batch is based directly on main and does not modify that candidate,
allocate a release or dispatch publication. Existing milestones and holds remain under the release
coordinator. The inventory stack remains separate; this batch has no dependency on it.

The neutral player previously sent Team's `support` field to the Versus engine,
which rejects it. A shared public-input session now fixes that command shape and
supports replay-checkable v2 exports for all three modes. Initial configuration
is captured before Team runtime mutation. The verifier resolves current
canonical content and rejects stale configurations, altered outcomes/events,
invalid or oversized input streams and inputs after termination. Partial runs
are explicitly distinguished from terminal results and clears. Reset is required
after termination or the ten-minute recording limit.

The unchanged Solo First return control completed in 469 ticks (3.908333 seconds)
on Standard, seed 17, with public `down` inputs; its complete result replays.
A Team regression records player 1's line-impact downing and reserve revival,
and player 2's return, with correct seat attribution. Neither observation closes
the five replacement pilots' full-run/alternative-route/difficulty review gate.
The desktop in-app browser ran both Versus boards for 12.9 seconds and paused
normally; screenshot: `/tmp/revealline-pilot-versus-browser.png`. The browser
export download-event observation timed out, so that UI-to-file path is not
claimed as verified. Exported data and CLI file verification are tested directly.
No physical-device, full gameplay journey or offline acceptance is claimed.

Next batch: record complete replacement-pilot routes and meaningful alternatives
using [the recording guide](PILOT-OBSERVATIONS.md), then review difficulty and
composition before bulk artwork production. Package externalization and recovery
qualification remain independent work; this batch delivers no download-size cut.

## Completed foundations and remaining phase gates

| Phase                      | Implemented foundation                                                                                                    | Remaining                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Inventory and preservation | Base ownership and lifecycle retention; submitted Team/company inventory and combined artwork screening in #726/#738/#747 | Visual review and full old-save/replay/earned-picture restoration evidence                                    |
| Distinct gameplay          | Five neutral designs, first-return probes; this batch adds real-engine observation replay and fixes Versus play           | Complete replacement runs, meaningful alternative routes, failures/difficulty evaluation and human approval   |
| Unique artwork             | Exact/transform/perceptual screening tooling                                                                              | Approved replacement compositions, provenance and in-game review                                              |
| Smaller offline packages   | Starter/chapter installation, independent optional music, verified resumable files; #729 measures frozen sizes            | Externalize embedded images, split mode internals, qualify rendition formats and measure storage/update peaks |
| Qualification and release  | Focused automated evidence and immutable publishing foundations                                                           | Blocked-network complete journeys, failure/recovery/migration tests and physical installed-device evidence    |

All five phase gates remain open. Published v0.141.7 is still the release baseline;
567.39 MiB gameplay and 346.78 MiB optional music are #729's frozen measurements,
not new measurements or reductions delivered here. The v0.142.0 milestone remains
a reservation subject to release coordination.

## Validation

The stacked-worktree focused run passed 42/42 tests, followed by 5/5 final session
checks after tightening identity validation. Repository validate, lint and
formatting passed. These checks overlap; the full suite remains waived, not
passed. No distribution build or publishing action was performed. Logs are
`/tmp/revealline-pilot-replay-tests.log`, `-final-session-tests.log`,
`-validate.log`, `-lint.log` and `-format.log`, with the same prefix. After separation onto `d9ff8b86`, the independent focused suite passed 38/38
(including exact pilot-report reproduction). The lower count excludes unrelated
inventory-stack selector tests. Log: `/tmp/revealline-pilot-replay-main-tests.log`.
Scoped lint/format and whitespace checks also passed on the final files.
