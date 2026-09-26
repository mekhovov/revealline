# Content ownership and uniqueness review

Open [the complete inventory](inventory.html) for every current and historical mission/mode owner, original image thumbnail, exact source path and byte/pixel hash, normalized physics comparison and board diagram. [inventory.json](inventory.json) contains the machine-readable records and compatibility-retention roots.

The audit revalidates **12 Classic shared-original groups** and **106 authored originals reused across route revisions**. Those are different categories. The report also separates current Solo/Versus artwork sharing from historical reuse and presentation settings. Current findings are not a uniqueness approval.

The lifecycle registry changes discovery policy only. Historical source factories, exact original bytes, campaign/execution identities, profile keys and suspended-flight slots remain intact. Compatibility roots identify material that must be retained for saves, replays and earned pictures; they are not a replacement for complete runtime dependency closures in the offline catalogue.

Comparison includes complete Standard physics after the host's versioned gameplay tuning and Classic class recipes. Authored physics is independently hashed. Display names, artwork themes and music do not establish different gameplay. Static geometry matches are review candidates, not proof of duplicate experiences. Exact PNG pixels use the repository's bounded RGB8 decoder; perceptual similarity, rotations/reflections and human composition review remain separate gates.

## Pilot

[Play the neutral pilot](pilot-player.html) using the real Solo, Versus and Team engines. Start the repository's static server and open this page through that server; browser modules do not run from a `file:` URL. The player resolves real Gentle/Standard/Expert presets and has keyboard and touch controls, pause/reset, elapsed time, coverage, failures, win state and local observation export. It does not write profiles or claim approval.

[Review the designs and probes](pilot.html). Four Orchard-family successors and a distinct Horizon Versus course use new tooling-only identities; current Solo, Team and Pressure Lines controls remain available for comparison. The [Horizon project](pilot-horizon-project.json) is also importable in the existing content-design tooling.

All five candidate levels have public-input, replay-verified first-return evidence. **Full clears, difficulty balance, artwork approval and human playtests remain pending.** Inspect actual alternate route choices and failures before commissioning artwork or promoting any pilot to a current chapter. The intended complete-run durations in the briefs are targets, not measured results.

## Reproduce

```sh
node scripts/content-inventory.mjs --write
node scripts/content-inventory.mjs --check
node scripts/uniqueness-pilot.mjs --write
node scripts/uniqueness-pilot.mjs --check
node --test game/test/content-lifecycle.test.mjs game/test/uniqueness-pilot.test.mjs
```

Inventory generation validates all external pack/media producers and may take several minutes. It writes only these reports. Package artwork sizes deliberately exclude runtime, transfer encoding and storage overhead; the offline catalogue supplies complete package totals. Reports and the neutral player are tooling, excluded from normal gameplay downloads.
