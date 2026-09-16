# P03 focused integration evidence

Packaged original evidence; independent review and P03 acceptance remain separate.

The public baseline is v0.58.1, with scoped P02-A acceptance retained. This is P03 integration evidence, **not a released P03 or completed phase**. Its runs qualify exact working-file cohorts captured in their original before/after manifests. A recorded HEAD is an observation; generated or edited files were not necessarily committed at that point.

## Separate attempts and results

| Attempt | Node | Complete files | Passing / executed | Meaning |
|---|---|---:|---:|---|
| Initial non-Team | 20.19.5 | 30 | 603/644 | 41 Collection fixture setup failures retained |
| Gallery parent correction | 20.19.5 | 1 | 42/42 | Corrected fixture plus new parent/removal regression |
| Gallery parent correction | 22.22.2 | 1 | 42/42 | Same focused correction on the other runtime |
| Corrected non-Team | 22.22.2 | 30 | 645/645 | Complete corrected cohort before later production/seam edits |
| Team foreground before fix | 22.22.2 | 1 | 73/77 | Four added lifecycle regressions fail the unchanged host |
| Team integration after runtime correction | 20.19.5 | 9 | 204/205 | One Versus Help-reading scope assertion still failed |
| Team integration with corrected reader scope | 20.19.5 | 9 | 205/205 | Final passing complete cohort, including shared Couch audio/reading files |
| Team integration with corrected reader scope | 22.22.2 | 9 | 205/205 | Same final cohort on the other runtime |
| Versus final seams | 20.19.5 | 3 | 75/75 | Passing final seam cohort |
| Versus final seams | 22.22.2 | 3 | 75/75 | Passing final seam cohort |

Do not add these overlapping counts. The initial Node20 command plus the corrected Gallery file is not a clean 645-case Node20 run. The earlier 645-case Node22 result does not retroactively qualify later changes. The final Versus cohort is the complete `couch-shell`, `couch-navigation` and `couch-static-picture-host` files; the final Team-labelled cohort also contains shared Couch reading/audio tests. These are original group names, not mutually exclusive mode totals.

Every selected attempt retains its actual command, raw stdout/stderr (including empty logs), exit, receipt, final result, runner identity, admission/selection and full physical input snapshots. Original failed attempts remain unchanged. Expected behavior in earlier proposal READMEs is historical preparation, not an executed result; the later original attempt records establish what actually ran.

## Production and historical identity

The production admission receipt records 614 source files, 56 Prettier files and the complete 7,879-entry Git index at `902bd54002734f16d83f7ee96a1a49859dba87e6`. The later explicitly named history test and two fixtures bring the expanded window to 617 source files plus 56 package files. Admission helpers, exact manifests and their original receipts are retained.

The initial canonical write/check logs both report measured Field Kit revision 25, 293 slots, 131 files and 4,007,816 original asset bytes. They explicitly describe a production candidate requiring real-screen review. These files are original stdout, not independently reconstructed command exits or final readiness evidence. Later expanded-run snapshots retain the actual generated ledger/compiled hashes and state; no theme revision is guessed from an earlier candidate.

The immutable P02 oracle comes from source `c93019a344f6f4c6ac03940c77ea09c81122d911`, tree `f6055cbcba92d45ef1da2b5d16e7e4f1158c8d2a`. Its derivation validates the published ledger, P01 reconstruction and 127 original payloads. The 6,829,381-byte ledger is not duplicated: its exact Git path, source and SHA-256 are retained by the oracle, derivation and bundle manifest. The oracle proposal remains a historical proposal; actual test inputs are recorded separately by the runs.

## Reading the archive

`manifest.json` maps each original cache path, byte count and SHA-256 to an archive `member`. Identical bodies, including repeated input snapshots and the full Git index, are stored once. Every source path still has its own mapping; aliases are exact byte equality, not reconstructed or summarized replacements. Original cache files are never removed or rewritten.

Root `README.md` and `manifest.json` are packaging summaries. Original helpers, this preparation template, proposal documentation and original records live under `originals/`. Historical absolute paths in records remain untouched. The package contains no source/distribution rebuild and no new game assets.

This evidence does not establish native layout, keyboard/controller hardware, real touch, acoustic listening, offline/public qualification, final production readiness or full P03 acceptance. Those gates remain separate. Sampled workspace peaks are not unsampled transient-peak or RAM guarantees.

## Preparation and execution

Preparation files are cache-only. `intake.json` pins the six previously completed attempts and supporting originals. Its Versus-pending state is retained historically; `versus-completion.json` now pins the completed 75/75 results on both Nodes. `package-evidence.py` has not been executed by the preparing agent.

After parent review, run `python3 .cache/p03-final-composition-audit/integration-bundle-preparation/package-evidence.py --execute` from the repository root. Without `--execute`, it prints the plan only. It creates a fresh cache `delivery/` containing `evidence.zip`, the readable README, manifest and receipt, with a combined 5 MiB maximum. It rejects existing output, changed originals and incomplete results, rechecks every ZIP member against its original, and does not run tests or change source, Git, releases or remote state. Copy only that reviewed delivery set into Git later; admission and staging remain owned by the parent.
