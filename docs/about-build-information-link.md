# About: direct Build information entry

The game’s Build information links already target `site/about.html#versions`. Previously, that route scrolled to a closed disclosure, requiring a second action to reach the requested release information. The About navigation owner now opens the disclosure immediately for this exact fragment, including an explicit later hash visit. Optional release and pack catalogue requests remain independent.

Ordinary About and other fragment destinations keep the compact default. This change does not focus a control, switch builds, start play, or write progress. Escape retains the existing Return to game focus action. A manually closed disclosure remains closed through cached-page restoration. Terminal departure removes the new hash listener with the existing input owner.

## Verification boundary

Based on source `4bb553d06d62f7a8cce301c77b245573838bfdcb`, four new host cases fail on the original navigation code and pass with the correction. All three complete related files pass 43/43 on Node 20.19.5 and Node 22.22.2. The existing host default now represents ordinary About; explicit deep-link cases cover the current, immutable-release and archive route forms. Catalogue waits, controller editing, disconnect, focus, cleanup and release URL validation remain in the complete cohort.

Public v0.69.3 reproduced the closed section at the game’s exact `#versions` target. A source-pinned local browser then verified the corrected open section, its visible contents, Tab reaching the disclosure summary, Escape selecting Return to game, and an ordinary About visit remaining collapsed. The local archive catalogue was unavailable and displayed its existing honest fallback; this confirms opening is independent of catalogue success. No physical-controller, touch, mobile, offline, final-source release or public correction acceptance is claimed by this candidate.
