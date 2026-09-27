# Main-repository-only releases

Effective 2026-09-27, the user's main-repository-only order supersedes historical archive preparation instructions. One canonical integrator/publisher owns the release.

1. Integrate and qualify the complete requested source, preserving all historical data and failures. Merge protected main only after required exact-source/head/base checks and independent review.
2. Qualify/freeze one final testing release and independently inspect its original artifacts. Publish its immutable assets only in `mekhovov/revealline`.
3. Synchronize the original metadata and qualification with `sync-release-metadata.mjs`. Review the selector under `hostingPolicy: "main-repository-only"`; do not modify the frozen allocations/admissions or legacy record pins.
4. Deploy the selected current ZIP through the main-only `publish-frozen-pages.yml`. Keep the five-entry global history policy; unarchived historical rows have Download ZIP, not Play. Their old HTML URLs provide an honest download landing. Their worker retires only through normal activation, without clearing caches/saves, claiming clients or forcing navigation. Already accepted archive links remain unchanged.
5. Require complete artifact reread, latest-stable recheck, actual public-byte audit and bounded current-player acceptance. An old installed worker may retain its old offline game; that is not evidence of fresh navigation or current-public acceptance.

No new archive repository, allocation, historical deployment, archive authority API request/cache, archive browser admission or per-PR release belongs in this sequence. Existing archive infrastructure and evidence are preserved as historical compatibility records. The main site still has its 950,000,000-byte budget. No capacity or integrity guard is waived by this policy.

Expected savings are removal of repository preparation, archive deployment, historical full-body/browser admission and repeated archive-authority network checks. This does not shorten the required source, current artifact or public-byte checks, and no wall-clock speedup is claimed until measured.
