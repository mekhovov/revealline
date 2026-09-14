# Archive 03: v0.33.0 and v0.34.0 canonical acceptance

Observed 2026-09-13 on the desktop browser. This evidence supports the additive
v0.37 source allocation of these two frozen releases to Archive 03. It does not
change either archived game or the frozen v0.36 allocation. Source adoption and
future main-prefix forwarding remain separate steps.

Archive 03 [PR1](https://github.com/mekhovov/revealline-archive-03/pull/1) merged as
`1870c68ee5a05c60c55b3be2eb528fb035076207`.
[Run 34786078410](https://github.com/mekhovov/revealline-archive-03/actions/runs/34786078410)
used the default archived-CLI builds and deployed successfully as `6427090863`.
The complete public audit verified **524 direct responses / 308,441,778 bytes**,
including all **519 original canonical rows** and three hidden files. Every body
matched its expected SHA-256, decoded length and MIME, with zero retries. Public
byte acceptance is distinct from the native observations below.

| Canonical game                                                                          | Restored flight                                                          | Existing earned picture                           | Preparation after retained timeout                |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------- | ------------------------------------------------- |
| [v0.33.0](https://mekhovov.github.io/revealline-archive-03/releases/v0.33.0/site/game/) | Actual vertical unfinished cut, paused at 0% / 0 points / 3 lives / 2:57 | Orchard Crossing, GOLD, 16,480 points / 8.65s     | 238 core files; frozen inventory 45,409,025 bytes |
| [v0.34.0](https://mekhovov.github.io/revealline-archive-03/releases/v0.34.0/site/game/) | Actual downward unfinished cut, paused at 0% / 0 points / 1 life / 0:29  | Split Signal Foundry, GOLD, 15,280 points / 5.06s | 248 core files; frozen inventory 45,469,859 bytes |

Both canonical visits initially refused Continue because the matching installed
pack was unavailable. The zero-pack catalogs, saved flight and earned metadata
were retained. Native installation of the old FPV Illustrated Pressure pack for
v0.33 and Route Choices Tactical pack for v0.34 restored availability. Root
returned without choosing a new chapter and explicitly loaded the saved flights.
The initial missing-pack cause is unresolved; it is not attributed to routing.
The pre-existing missing custom First Signal original in v0.33 remains missing.

The v0.33 restored-cut screenshot is byte-identical to its authoritative old-main
baseline. The earlier 2:58 border-only baseline is retained but is not evidence of
an unfinished cut. Root's later Resume attempt remained wall-blocked; a fresh
Right input secured 1.5% / 360 points / three lives / 2:55. A fresh canonical tab
restored that paused result without another installation.

The v0.34 screenshots show the same cut across viewport sizes, then visible
downward movement after root's explicit Resume-only 350 ms interval. It paused at
0% / 0 points / one life / 0:28. Canonical-to-old-main-to-canonical visits restored
that same visible state without another installation. Root recorded preservation
of the explicit query and fragment. This was manual navigation between existing
URLs, not a test of new automatic forwarding.

Both full reward pictures and their old Gold results match the baseline. No new
win is claimed. Frozen source inspection confirms release-version keys for the
profile, packs and suspended flight, with the same `revealline-assets-v1` database
name and no project-path component. These contracts are consistent with shared
recovered content on the same origin; they do not explain the initial absence.

Each first offline-preparation timeout is retained. An explicit retry later
showed 238 or 248 files verified. The byte totals above come from the frozen
inventories, not a browser transfer counter. **The network remained available:**
these are preparation and restored-state checks, not disconnected-network or
cold-device qualification. No forced worker activation, cache deletion or
injected gameplay state was used. Captured log snapshots were empty. Physical
phone/controller checks and historical UI defects remain outside this scope.

A supplemental v0.34 canonical couch visit reached the native lobby: both boards were ready at zero points with three lives, the 90-second setup and Start round action visible. This is an entry smoke check only; no match, two-player control, controller hardware or multiplayer result was tested. The saved lobby screenshot and text are retained separately from the canonical receipt.

Evidence: canonical receipt `d1cbf4b95a46114ea170f4cfd35e5a2d533182bfed546d40f1e268e88b88d082`,
independent canonical peer `5f5bf5ec9c23d78c62b12ea95e69c53c536f13abd5932b438dfacc9986cb699f`,
main baseline `af706eb094a9d92ef787d2cedc1b34bd67ccde755d1d4b5e5b5a1c68da7f1759`,
public audit `2c950de411f61361e246f0f4e78947f029925fc8e940e080337aac488e168190`
and public peer `eb78cdbcb3ba2c9cf7bfedcdbf1b30b74dbb6a6f8167e99e0286d1d7ce1b2ead`.
Raw records are retained under `.cache/round47/archive033-034-native` and
`.cache/round47/archive03-publication`. Key durations, navigation order and the
online condition are root-observed actions; persisted screenshots establish the
visible states and artwork, not a full hidden-storage snapshot.

Before a future main release is accepted, run the existing bridge/worker
regressions and its exact Pages inventory/budget checks. After deployment, verify
old v0.33/v0.34 prefixes preserve query/fragment and saved/earned contexts while
naturally forwarding to the canonical locations. Those cutover checks have not
yet run. Preserve all historical releases, tags, originals and failed attempts.
