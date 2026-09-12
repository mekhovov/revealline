# Round 26 frozen browser and offline checks

Checked 12 September 2026 against frozen **v0.16.0**, source `8fb6b5782a6fee85211b9bbbfb3d13a1d1a60c43`. The standalone QA site ran on localhost port 8835. These were software-driven interactions with the actual published game UI, not physical-device or human playtesting. [Release integrity](frozen-integrity.json) separately establishes the archive, source and deterministic rebuild identities; this report covers browser behavior.

## Cache preparation and server stop

The [offline readiness result](../../../.cache/round-26/frozen-browser/offline-ready.json) reports all **135 offline files verified**, totaling **20,624,650 bytes**, with no missing or corrupt files. Its build ID is `88feeb938b2a1742a483a7cdb650de7e94ba05da85863c9a6f8fa4cdbe55763d`. This is the offline inventory, not the ZIP entry count.

While the server was available, ordinary Grid + buffer First Signal completed at 52.2%, score 8,160, three lives and HUD time 0:03. The next Relay Orchard flight was started and saved unfinished. See [ordinary win](../../../.cache/round-26/frozen-browser/ordinary-win.txt).

The operator then stopped server session 26956. A subsequent curl connection attempt returned code 7, connection refused. The journeys below occurred with that server still stopped. This demonstrates operation from the prepared browser cache while its storage is retained; it does not demonstrate a fresh installation with an empty cache and no connection.

## First course visit while offline

After the server stopped, How to play → Learn by playing loaded the course URL for its first visit on this QA origin. The [entry snapshot](../../../.cache/round-26/frozen-browser/offline-course-entry.txt) shows Close a line at Ready, 0:00, zero coverage and three lives. Actual Grid movement completed the lesson at 52.2%, score 8,160, three lives and HUD time 0:03; see [offline course win](../../../.cache/round-26/frozen-browser/offline-course-win.txt).

The first pointer attempt on Next did not advance, and a following Start lookup failed. No errors were observed for that attempt. Enter on Next did advance to the second lesson’s Ready screen. This is a recorded pointer-path limit, not a claimed flawless mouse journey or a diagnosed game defect.

The second lesson received Down for approximately 800ms followed by Up for approximately 850ms. The resulting self-cross cancelled the cut and cost one life; the [recovery snapshot](../../../.cache/round-26/frozen-browser/offline-course-recovery.txt) shows two lives, zero coverage, score zero, HUD time 0:02 and a paused flight. Skip, reduced-effects selection and Return to game were then exercised. The second lesson was not claimed complete in this route.

## Preserved flight, restoration and collection

The comparison starts after the authorized course-entry retention save. [Offline preservation](../../../.cache/round-26/frozen-browser/offline-preservation.json) records exact equality of `library`, `packs` and `session` between the [entry backup](../../../.cache/round-26/frozen-browser/offline-entry-baseline.backup.json) and [returned backup](../../../.cache/round-26/frozen-browser/offline-after-course.backup.json). Both files are 6,079 bytes, SHA-256 `6104b4d2c07bc0efd1cca9c854c252f7f1799e892b896b398d3efe7ddf31d108`.

The preserved normal profile had one gallery picture and one score. The suspended Grid flight retained run ID `57c4cedc-7dcb-4478-a230-50740c23a617`, tick 168 and checkpoint `02b4dadbc19f4c07`. No course awards or course-local preferences were added to that stored backup.

Load saved flight verified and restored it paused, with HUD time 0:01. Explicit Resume and Down continued the real Relay Orchard flight to 52.2%, relay 1/1, score 8,660 and three lives; its later paused HUD showed 0:06. See [restored paused state](../../../.cache/round-26/frozen-browser/offline-restored-paused.txt) and [resumed flight](../../../.cache/round-26/frozen-browser/offline-resumed-flight.txt). These are rounded displayed time labels rather than exact timing assertions.

Collection opened the earned First Signal picture and Play celebration operated offline. The [gallery snapshot](../../../.cache/round-26/frozen-browser/offline-gallery.txt) and [reviewed celebration screenshot](screenshots/frozen-offline-gallery-celebration.jpg) show the original village picture in its collection dialog. This was the ordinary campaign picture earned before the course, not a training reward. A still screenshot records a rendered moment; the Play celebration interaction was observed separately by the browser operator.

## First offline Playground visit

The Playground route was opened for its first visit after the server stopped, using the already prepared offline cache. Its finite First Flight preview loaded at an actual 320×640 CSS-pixel viewport. The visible [geometry capture](../../../.cache/round-26/frozen-browser/offline-playground-geometry.json) measured a 280×210 board at y214.19–424.19, eleven controls at least 44×44, no horizontal page overflow and no target/arena rectangle overlaps. Eight direction/action targets were wholly inside the viewport; Pause, Restart and Sound required vertical scrolling. This is not a claim that all eleven controls were simultaneously visible in that captured Ready layout.

Enter on Start followed by actual Down movement completed Close a line at 52.2%, score 8,160, three lives and HUD time 0:03. See [compact offline win](../../../.cache/round-26/frozen-browser/offline-compact-win.txt). The older geometry text retained inside that snapshot is not a new measurement of the completed scene.

## Scope and remaining limits

The saved [frozen console result](../../../.cache/round-26/frozen-browser/console.json) is empty; the operator also checked the first-visit Playground journey’s logs and observed no errors. The two QA tabs remained open when this report was prepared, and the server remained stopped. This report does not claim a browser restart, browser-cache eviction recovery, physical controllers, genuine coarse touch, text zoom or native-platform certification.

The frozen Next pointer anomaly is retained above. The [source browser report](source-browser.md) additionally preserves the earlier Lab Settings pointer anomaly and compact post-interaction clipping near four pixels. The successful compact Start and completed routes do not establish that every control interaction keeps the entire board visible. [frozen-offline.json](frozen-offline.json) is the compact machine-readable record of this bounded offline check.
