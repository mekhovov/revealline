# Round 26 candidate browser checks

Checked on 12 September 2026 at isolated local port 8834 under the build CLI's production headers. This is browser software evidence, not physical-device, public-host or native-store verification.

The first candidate, `v0.16.0-rc1`, contains 138 manifest assets and has distribution SHA256 `d7a0d38fb57b82d794469b57465dc969406dd0d1479a94f7ed5775af64f4ab8c`. Its source revision is correctly null: it was built from the working tree. The landing's Play now link opened the packaged game. An ordinary First Signal attempt completed through Down input with 52.2% revealed, three lives, score 8,160 and displayed time 0:03. Entering First Flight through How to play, choosing Grid + buffer, and playing Close a line completed the practice lesson. Return opened the ordinary game at Ready; Collection still showed exactly one ordinary First Signal picture and its gold result. A public complete-backup export preserves the observed records.

Evidence: [ordinary win](../../../.cache/round-26/candidate-browser/ordinary-win.txt), [course win](../../../.cache/round-26/candidate-browser/course-grid-win.txt), [collection after training](../../../.cache/round-26/candidate-browser/collection-after-course.txt), [public backup](../../../.cache/round-26/candidate-browser/after-course.backup.json).

The landing browser exposed a duplicate version prefix (`vv0.16.0-rc1`). Deployment commits `131361e` and `1044627` corrected the template/build substitution and the subsequent JavaScript label update. This changed only the landing label path, not gameplay. Both the original build and observations remain preserved.

The corrected `v0.16.0-rc2` contains 138 assets, distribution SHA256 `f6109df3c06a1bad510f5df2db0d27d5a74e9ed91991e87acf6dc930a3f171f2`, and null source revision. Its shipped landing script exactly matches source SHA256 `3e714ed8b5fe12822f8d676808191affdea50f5edafa5ae1ae4302e8dd9c83f7`. After the page script completed, the Start playing link, picker and current card each showed one `v` prefix. Play now and Learn by playing reached the loaded Close a line Ready screen at zero time. A transient boot snapshot is retained separately from the loaded result. Browser error/warning logs were empty for the candidate tab during these journeys.

Evidence: [corrected live landing](../../../.cache/round-26/candidate-browser/final-landing.txt), [loaded course](../../../.cache/round-26/candidate-browser/final-course-ready-loaded.txt). This candidate does not include the full historical archive directory; the landing truthfully reports the archive as unavailable. The separate Pages exporter supplies that directory in a deployment.

Frozen-source rebuilding, archived-file preservation and offline checks are separate release evidence. No online multiplayer, player-retention or complete-device claim follows from these checks.
