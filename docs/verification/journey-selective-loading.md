# Selective Journey source loading

2026-09-21, successor to `7ea5f399`. This closes one startup dependency problem,
not P13/P15 performance or public acceptance. No level, actor, physics, preset,
artwork, progress identity or release version changes.

## Change and preservation boundary

Solo and Versus previously imported every candidate composer and the large spatial
snapshot before choosing a route. The shared sequence helper also pulled this
content into all three mode hosts. Now the browser loads only the selected source
family through fixed local imports after checking the existing route whitelist.
Legacy/unknown routes load no candidate family; Solo Practice still bypasses the
authored route. There is no user-derived import URL or fallback to another edition.

The synchronous authoring/CLI interface remains available. Both entry points use
the same extracted route definition and immutable chapter order. The sequence
helper is unchanged apart from its module boundary. Normal compilation, artwork
verification and attempt ownership checks remain in place.

All ten route outputs match JSON byte-length/SHA-256 pins captured at the exact
pre-change commit, including content, metadata, save/profile keys and order.
Repeated loads produce separate frozen objects, not shared mutable source state.

## Measured dependency inventory

`scripts/measure-journey-modules.mjs` parses static imports using Node's
`vm.SourceTextModule`; it never evaluates game modules or writes files. Compare:

```sh
node --no-warnings --experimental-vm-modules scripts/measure-journey-modules.mjs 7ea5f399f6f9a0e8ac6dc86d44da5f51c2574519
node --no-warnings --experimental-vm-modules scripts/measure-journey-modules.mjs
```

Each selected-family profile is the union of the entry's eager static graph and
that family's static dependencies. Other runtime imports and non-module assets
are excluded. These are exact uncompressed UTF-8 **source bytes**, not browser
requests, transferred bytes, bundle sizes, cache effects or latency measurements.

| Profile                     | Solo modules / bytes | Versus modules / bytes |
| --------------------------- | -------------------: | ---------------------: |
| Before: every profile       |      278 / 3,312,743 |        218 / 2,600,369 |
| After: eager only           |      250 / 2,563,028 |        190 / 1,850,652 |
| After: opening              |      253 / 2,583,161 |        193 / 1,870,785 |
| After: Horizon + Border     |      255 / 2,598,348 |        195 / 1,885,972 |
| After: historical originals |      279 / 2,784,697 |        219 / 2,072,321 |
| After: spatial family       |      252 / 3,092,553 |        192 / 2,380,177 |

Removing approximately 750 kB from the eager graph is **not** a 750 kB saving for
every selected route. Spatial routes subsequently load their snapshot: their
measured union saves 220,190 bytes in Solo and 220,192 in Versus. Historical
originals add one small module overall while dropping the unrelated snapshot.
No controlled browser speedup is claimed. The previous
[native timing samples](journey-performance-observations.md) are not an A/B test.

## Native failure and recovery

Local real-browser keyboard checks used port 8846 and `whole-spatial-v4`, without
engine-state injection. A test-only HTTP 503 for the selected spatial module caused:

- Solo: visible “Flight on hold” and Reload game, rather than a Legacy game.
- Versus: visible module-load failure and disabled Start race, rather than another
  edition or an incomplete playable board.

After removing the test fault, Reload game / browser reload recovered the correct
labelled review edition. Solo Continue → ordinary Down cut cleared First return
with 34.3%, 3 lives and 8,160 points → one Next loaded the 65% second mission.
Versus Start → ordinary Player 1 `S` cut produced the same Player 1 clear → one Next
started both next-mission boards. Player 2 stayed idle; this is not a native
simultaneous-input or two-human qualification claim. These observations establish
scoped load-error recovery and direct continuation, not timing acceptance.
Solo was then reloaded: Continue named Choose your share and restored that
65%-target mission with “Flight resumed.” Both review sessions were left paused.
The historical `opening` route separately displayed Opening Journey / First return
and Continue entered its 30%-target board. With the spatial Solo tab still open,
it truthfully reported another tab owned saving and stayed session-only. This
temporary check was closed; it does not prove a second writer can save concurrently.

## Verification and remaining gates

The 18 focused regression tests pass independently on Node 20.19.5 and 22.22.2:
historical pins, frozen fresh ownership, selected/invalid route imports,
module-failure rejection, lean shared hosts, and literal dynamic-module packaging.
The packaging assertion uses the real `game` build include; it is deliberately
not a full release/media assembly in this sparse worktree. The test-only loader
hook is excluded from that distribution.

Independent code review found no blocker. The broader 31-file host/content cohort
is still running on both supported Node versions; this candidate commit is not
promotion-ready until its final outcome is recorded. Its first Node 22 historical
Solo campaign check already passes all 71 clears, 70 Next transitions and failed
picture-preload recovery for `whole-originals-v3`; that single result is not the
whole cohort. Controlled repeated browser measurements, Team startup,
public/offline distribution, ten-mission timing, physical devices and human
acceptance remain open. Original AI music generation remains paused.

The broader cohort extends the prior 25-file ornament/workshop integration with
`content-route-loader`, `whole-originals-host`, `journey-host`, `content-team-host`,
`team-journey-next-host` and `team-originals-host` test files. Local runs use the
existing read-only sparse-content shim: working files take precedence, and only
missing tracked content/media is read from exact source
`daaef1facfe573cf13a7da2132ea8fd57aded898`. It does not replace production code,
inject engine state or establish full-distribution/public acceptance.
