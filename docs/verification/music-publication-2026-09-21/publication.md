# Licensed MP3 archive publication — 21 September 2026

The [public soundtrack archive](https://mekhovov.github.io/revealline-soundtracks-01/) serves **70 exact creator MP3s**, with a searchable player, genre filter, repeat-all/shuffle, pause/resume, downloads, credits, source links and licenses. MP3s are committed in the separate [project-owned repository](https://github.com/mekhovov/revealline-soundtracks-01). This publication does not update the game runtime, catalogue, version or current deployment.

- Archive commit: `833bacbe2fa6a426053085fbd9c408d0a2cac21c`.
- Pages [run 35567341476](https://github.com/mekhovov/revealline-soundtracks-01/actions/runs/35567341476): verification and deployment both passed.
- GitHub deployment ID: `6562708902`.
- Deployment manifest SHA-256: `5c4f28b184258e4980ab04ad698bab8b200134d73b717f06568a2768aa1a420f`.
- Audio: **354,986,122 bytes**, 70 MP3s; full public payload: **355,267,348 bytes**.
- [Remote delivery audit](public-delivery.json): 78 served files, including every MP3, returned HTTP 200 at the exact expected HTTPS URL and matched length/SHA-256. Audio was streamed for verification without retaining another local copy.
- The zero-byte `.nojekyll` marker is verified in the deployment payload but returns HTTP 404 as a Pages configuration dotfile. The [first remote attempt](public-first-attempt.txt) and its corrected scope are retained; no MP3 exception was made.

## Rights and scope

The [rights audit](rights-audit.json) records 55 CC0, 12 CC BY 3.0 and three CC BY 4.0 recordings. All 70 have creator/source/license notices; all nine Zander Noriega artist credits link the requested artist page. All 33 OGG-to-MP3 conversions retain notices and original file identities. The source and production-register hashes, exact recording selection and limited publication authorization are pinned.

This archive is about 339 MiB. Adding it to the existing 864,317,088-byte game Pages payload would exceed GitHub Pages' 1 GB published-site limit. The release controller approved a separate archive repository, publishing MP3s once without duplicating the 15 album-pack payloads. [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits).

UA-FPV remains local: all 80 filenames / 77 unique recordings are preserved in four upload packs. The user's source clarification was “youtube”; no exact playlist/channel link or recording-specific public redistribution license was supplied. No UA-FPV audio or artwork is in this public repository. The [local upload guide](../../ua-fpv-upload-guide.md) remains available.

AI original production remains paused after listening rejection. No rejected AI track is included. There are **zero approved original compositions**, zero catalogue admissions from this publication and no claim of Content ID clearance or full musical review.

## Checks

[Independent builder/verifier evidence](independent-verifier/README.md) records full local exact-byte verification, the 38 passing builder/archive tests, prior refusal checks and their limits. [Final independent site review](site-review-final.json) pins the final renderer/player and checks credits, conversion notices, queue cycles, pause/resume and retry notices. Earlier review evidence remains unchanged.

Local validation, lint and both repository formatting checks passed; their logs are retained beside this document. These changes add a separate preview builder/site and documentation without changing the frozen production ledger or game code. PR #209 receives fresh hosted checks on its new source commit; the prior all-green run for `6b0c3d0a` remains historical evidence only.

[Browser evidence](browser-check.json) separates local numeric media checks from public accessible-control checks. Local MP3 excerpts played, paused, resumed without resetting position and advanced within a genre. The live Pages index filtered 12 retro recordings; Raspberry Jam played, pause/resume worked and Next advanced to Escalate. The public player was left paused. Numeric public media inspection timed out; accessible controls showed playback state. An earlier browser-native audio-widget automation crash is retained as a limitation; explicit page controls passed. No full-track listening, physical iPhone, offline game or frozen-build qualification is inferred.

## Game release sequencing

PR #209 remains draft with no new version allocated. The game release controller holds soundtrack rebase/version work behind the accepted PR #211 UI release. Rebase, exact source CI, frozen-build/offline qualification, merge and game Pages deployment remain separate work. The public MP3 archive is already deployed independently.
