# Mission search recovery (F77a)

The shared mission browser previously left an empty card area and a zero count when a query or filter excluded every row. Compact Filters identified an active selection without naming its values. This slice explains the current result and shows the selected collection, editions and mode in the existing status paragraph.

Clear search remains the existing query-only action. Reset filters is a separate footer action, reachable outside the compact filter disclosure. It resets collection to All, editions to Current and mode to the latest accepted hosting mode while retaining the search text and detailed-card preference. It does not broaden availability, download content, change the accepted gameplay mission, resume a paused run or launch a new mission. Search and filters can therefore be recovered separately.

An empty currently registered list says that no missions are listed in this view yet; it does not claim remote discovery has completed or that the global catalogue is empty. Query-only, filter-only, combined and default-view empty results have separate guidance. Existing loading/failure feedback remains visible. Unavailable rows keep their real cards and availability actions rather than becoming a false empty-result message.

After updating all three filter values, Reset dispatches one ordinary bubbling mode-change event. The existing filter handler owns pending-selection/preparation retirement, rendering and state persistence; native host listeners retain remote metadata and preview visibility ownership. Snake supplies its current accepted mode because one chooser can survive an explicit Solo-to-Team mission launch; an invalid or retired callback falls back to the initial supported host mode. Reset observes the same active-view, visibility and focus boundaries as the existing search actions. After explicit reset it focuses the first enabled visible card, or Search when none exists. It does not reclaim focus after newer host work. The existing state owner retains browsing context on Back and handoff; no new persistence key is added.

## Research and limits

[W3C's status-message explanation](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) describes search-result feedback that can be announced without receiving focus and cautions against excessive interruption. This implementation reuses the current `role="status"`, with no additional assertive region or focus movement when results or language update.

[The Scottish Government search-filter pattern](https://designsystem.gov.scot/patterns/search-results/search-filters) provides a reference for exposing applied filters and an explicit recovery action. The game retains its native filters and query-only clear action; Reset filters changes browsing state only.

Automated coverage exercises the real shared browser, library adapters and controller navigation with modeled compact layout. Exact rendered footer/status geometry at 320 px and landscape, listening with assistive technology, physical devices and PWA/offline behavior require separate evidence. No browser, device or accessibility-conformance claim follows from these source tests. Full source validation remains a separate gate after the focused checks.

The native Snake regression uses the supported Archive editions filter and verifies that it is actually selected before recovery. Reset returns it to Current while retaining the query, accepted host mode and paused replay. Official Snake does not offer Custom collection filtering; shared-browser Custom cases exercise providers that explicitly offer that collection.
