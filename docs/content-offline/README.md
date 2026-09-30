# Content ownership and uniqueness review

See the [current phased status and delivery batches](STATUS-2026-09-30.md),
[historical implementation evidence](implementation.md) and the
[measured package sizes](packages.md) for the accompanying offline changes.

Open [the registered-content inventory](inventory.html) for current and historical Classic, Journey and Team mission/mode owners, original image thumbnail, exact source path and byte/pixel hash, normalized physics comparison and board diagram. [inventory.json](inventory.json) contains the machine-readable records and compatibility-retention roots.

The audit revalidates **12 Classic shared-original groups** and **106 authored originals reused across route revisions**. Those are different categories. The report also separates current Solo/Versus artwork sharing from historical reuse and presentation settings. The supplementary [company ownership report](company-inventory.html) covers all 14 editions, their 69 canonical current missions and 26 retained presentations through the runtime reader. Its [machine-readable records](company-inventory.json) retain separate edition save identities and compare originals against this base inventory. The [combined company/base screen](company-artwork-screening.html) adds exact transforms and nearest-match contact sheets. Human composition review and full historical restoration evidence remain unfinished. Current findings are not a uniqueness approval or a complete shipped-content gate.

The lifecycle registry changes discovery policy only. Historical source factories, exact original bytes, campaign/execution identities, profile keys and suspended-flight slots remain intact. Compatibility roots identify material that must be retained for saves, replays and earned pictures; they are not a replacement for complete runtime dependency closures in the offline catalogue.

Comparison includes complete Standard physics after the host's versioned gameplay tuning and Classic class recipes. Authored physics is independently hashed. Display names, artwork themes and music do not establish different gameplay. Static geometry matches are review candidates, not proof of duplicate experiences. Exact PNG pixels use the repository's bounded RGB8 decoder. The supplementary [artwork screening report](artwork-screening.html) now covers exact rotations/reflections and bounded perceptual/crop/recoloring hypotheses; human composition review remains required. [Screening contracts and review instructions](ARTWORK-SCREENING.md) explain the opt-in new-art gate.

## Pilot

[Play the neutral pilot](pilot-player.html) using the real Solo, Versus and Team engines. Start the repository's static server and open this page through that server; browser modules do not run from a `file:` URL. The player resolves real Gentle/Standard/Expert presets and has keyboard and touch controls, pause/reset, elapsed time, coverage, failures, win state and local observation export. It does not write profiles or claim approval. [Pilot batch status](PILOT-STATUS-2026-09-28.md) and [replay-checkable observations](PILOT-OBSERVATIONS.md) now use the same public-input session code as the player and support all three modes.

[Review the designs and probes](pilot.html). Four Orchard-family successors and a distinct Horizon Versus course use new tooling-only identities; current Solo, Team and Pressure Lines controls remain available for comparison. The [Horizon project](pilot-horizon-project.json) is also importable in the existing content-design tooling.

All five candidate levels have public-input, replay-verified first-return evidence. **Full clears, difficulty balance, artwork approval and human playtests remain pending.** Inspect actual alternate route choices and failures before commissioning artwork or promoting any pilot to a current chapter. The intended complete-run durations in the briefs are targets, not measured results.

## Reproduce

```sh
node scripts/content-inventory.mjs --write
node scripts/content-inventory.mjs --check
node scripts/company-content-inventory.mjs --write
node scripts/company-content-inventory.mjs --check
node --test scripts/test-company-content-inventory.mjs
node scripts/content-artwork-screening.mjs --write
node scripts/content-artwork-screening.mjs --check
node scripts/company-artwork-screening.mjs --write
node scripts/company-artwork-screening.mjs --check
node scripts/uniqueness-pilot.mjs --write
node scripts/uniqueness-pilot.mjs --check
node --test game/test/content-lifecycle.test.mjs game/test/uniqueness-pilot.test.mjs
node --test game/test/artwork-screening.test.mjs
```

Inventory generation validates all external pack/media producers and may take several minutes. It writes only these reports. Package artwork sizes deliberately exclude runtime, transfer encoding and storage overhead; the offline catalogue supplies complete package totals. Reports and the neutral player are tooling, excluded from normal gameplay downloads.
