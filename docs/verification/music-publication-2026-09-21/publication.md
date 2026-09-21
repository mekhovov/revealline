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

## Game release sequencing at archive publication

PR #209 remains draft with no new version allocated. The game release controller holds soundtrack rebase/version work behind the accepted PR #211 UI release. Rebase, exact source CI, frozen-build/offline qualification, merge and game Pages deployment remain separate work. The public MP3 archive is already deployed independently.

## UA-FPV source follow-up — 21 September 2026

After the archive publication and its original rights audit, the user supplied [a specific YouTube video](https://www.youtube.com/watch?v=5tgI33haI4w), published by **Телебачення Торонто** on 10 December 2023 and crediting **Ницо Потворно** for vocals. The displayed title, artist metadata and approximate duration identify a candidate for **one of the 77 local recordings**, with **two of the 80 filename aliases**. The two local files share SHA-256 `417eea94faf4114996886dbcad58e158667df0dd94c497d847eabaf5fc64a9ba` and remain in private volume 02. No embedded URL/video ID authenticates those audio bytes against the remote video; the tag year also differs from the video's publication year.

The retained review inspected the expanded video description and channel About. Neither reviewed surface supplied a Creative Commons label or an express grant covering game use and standalone public MP3 redistribution. **Permission remains unverified.** Absence of a visible license is not proof of a confirmed Standard YouTube license. The recording remains private, the remaining 76 recordings require their own evidence, and no UA-FPV bytes have been added to the 70-track archive. The original audit and publication receipts remain unchanged.

The source check and a Ukrainian permission-request draft are retained locally in `.cache/ua-fpv-source-review-2026-09-21/`; the draft has not been sent. This follow-up makes no new download, listening, ownership, recording-safe or publication approval claim. The [updated import guide](../../ua-fpv-upload-guide.md) preserves the playable local path and now identifies accepted v0.77.0's continuing RLSTB1-only compatibility.
