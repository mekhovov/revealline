# Final large-profile cohort — retained outcomes

Run 39015298695 at exact tooling c41a02216c0811952232a387fd1743e09452c269 is failed. All six job artifacts passed API/source binding, archive hash, CRC and full member readback. All twelve actual arms are retained and independently reassessed: six Chromium passes; six WebKit failures. The exact a6 candidate and 8b baseline package/source/CSP admission passed in every job. Numerical results remain excluded.

| Engine / repetition |    Artifact | ZIP bytes | SHA-256                                                            |
| ------------------- | ----------: | --------: | ------------------------------------------------------------------ |
| chromium r1         | 12095785562 |    831341 | `5543f797ead6c551fe8890d38f39b37b3be546816ed2645ac5f042d2d5ee4853` |
| chromium r2         | 12095606520 |    831849 | `3414701c593cf0340466f0db7a4a17dfa614ed605c8399c119878ed995c144e7` |
| chromium r3         | 12096111923 |    831237 | `94dad7775a6c3c8b0c4370500abb4f483a0cf143f73b5ea2d5946a5ed567d6bd` |
| webkit r1           | 12095958661 |    769050 | `038d54800a929d1c28105d5f56ea2f263a3849e1e88745512628d1913e1b80cd` |
| webkit r2           | 12096068375 |    779374 | `b3b9d590a6728485f255cd486026a7b72febdd32a9cc8d34e1db99494b0236ff` |
| webkit r3           | 12095919998 |    769013 | `38633fbb317633f73f050728dbe4308bf4fa9faabaa641a665ecb5c878dbd019` |

Chromium completes the public import/reload, gameplay and strict native replay in all six arms. Each candidate has 60 application keyboard observations. Baseline raw numerical failures and candidate numerical passes are all excluded from timing qualification; the Node portability mismatches remain retained separately from passing same-engine replay.

WebKit candidate r1/r3 fail before profile import after startup auto-pauses on 313/284 ms playing intervals. The relevant measured update spans are 202/230 ms; these incomplete observations do not establish attribution beyond the measured span. The public pause control then becomes hidden and its original 30-second click deadline fails. All three baselines fail the initial shell-menu action before import. Their inner persistent-context cleanup is unconfirmed, while the outer process owner closes cleanly without ambiguity, survivors or forced cleanup. Those distinct statuses are both preserved.

WebKit candidate r2 imports the exact 2,788,121-byte profile (SHA `a71209967e8c3e3b687a0488075d59301a7adea62ea43fa60eba7a83d7df4e07`), retains the imported-profile snapshot and reaches the post-reload public menu sequence. Action 25 cannot press Resume because shell-home remains open and intercepts pointer events after action 24 Escape. Its original 60-second action fails; no steering sequence or strict native replay occurs. This is partial import/reload evidence only, not a completed large-profile gameplay pass.

All outer owners close cleanly. No WebKit arm has a qualifying native replay or complete scenario. No result is retried, removed, waived or promoted to performance/physical-device qualification. Complete raw artifacts, receipts and per-job independent-review.json files remain under `.cache/solo-followup/final-wave-v2/root-retention/large-profile-large-profile-*-retained/`; the twelve-arm compact record is `large-profile-all-final.json` beside this note.
