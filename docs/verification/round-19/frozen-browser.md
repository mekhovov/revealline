# Frozen v0.9.0 browser and offline continuation

Observed 12 September 2026 in the Codex in-app browser. The owned server at `http://127.0.0.1:8813` served only `releases/v0.9.0/site`, with production headers. The page showed v0.9.0. The [integrity report](integrity-notes.md) pins its source to `315a4782a159f2274f7200e3470ec20c3859707b` and verifies its exact archive and distribution.

Settings → Prepare offline play reported **115 files verified**. Equipment Workshop installed through its bundled expansion button and opened normally. Tap steering was enabled. The owned server was then stopped; an independent HTTP request failed with curl exit 7. The user's separate port 8767 server remained running and untouched. Reloading the isolated 8813 page still loaded the frozen game from its verified cache.

With that server still stopped, Saves & loads imported the legal `workshop-02-grid-center.session.json` fixture through the ordinary file picker. Its replay-backed prefix restored Neon Switchboard at 33.2%, three lives and 5,600 points, with both pickups, both suppressed crossings and the Heavy carrier switch checked. This fixture supplied the earlier route inputs; it was not a manually flown full attempt or an injected victory.

Resume and Move up completed the final cut at **71.1%, three lives, 11,910 points and gold**. The result reported **Power Circuit seal earned and saved**. Collection opened the correct completed picture; its detail view showed Light carrier → Heavy carrier, Grid + buffer, seed 1 and Power Circuit. [The offline gallery screenshot](screenshots/frozen-offline-picture.jpg) records that visible result.

After another reload with the server still stopped, the exported player library contained **one picture, one score and one seal**, 2,402 bytes, SHA-256 `e12d6d3bf47fbbfe6eec8e904d6c283b60d1fd40ceff1275731ee6868d489e7c`. The local evidence file is `.cache/round-19/frozen-earned.library.json`. Sampled warning and error logs were empty. The QA tab was kept separate from the fresh user-facing version.

The out-of-order restored map exposed an existing mission-list issue: its earned picture was viewable, but the map button remained locked because its predecessor was uncleared. A focused replayability fix is approved for the next chapter-reward iteration. This v0.9 artifact is preserved unchanged and is not described as fixing that issue.

The [candidate browser report](candidate-browser.md) separately records all three Workshop pictures and authored seals. [Source browser checks](source-browser.md) cover authoring, replacement/archival, practice isolation and measured CSS sizes. Offline success depends on the browser retaining its storage. These checks do not certify physical controllers/touch devices, native stores, public hosting or player enjoyment.
