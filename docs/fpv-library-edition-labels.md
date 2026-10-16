# Library edition labels

Duplicate world offerings can share a descriptive title. Their cards now have a concise localized edition label, and Download/Fly actions include it in their accessible names. Saved actions also include the revision from the verified descriptor. Removal names identify the same selected version.

Curated rows may provide `edition: { en, uk }`. This presentation metadata belongs to that exact immutable pin; it does not change a title, version, pin, source trust, download or active revision. The existing Coastal, Desert, Coaster and Hillside pairs receive short descriptions based on their existing published content. The separately reviewed Alpine follow-up can use “Refined contours” / “Уточнені контури” and “Original study” / “Початковий варіант” without changing its frozen package.

Unlisted saved versions use their verified revision. When labels collide (including identical revision strings), a short content identity distinguishes them; its prefix expands until unique among that world's displayed versions. An unlabelled duplicate offer also uses this honest fallback instead of guessing revision or upgrade order from its URL. Full immutable hashes continue to select operations and restore keyboard focus. No additional descriptor fetch is needed to paint cards.

## Verification

`node authoring/fpv-worlds/regions/verify-library-editions.mjs` exercises the production Library UI with isolated memory records:

- Distinct same-title EN/UK offers and unchanged descriptive titles, without fetching content.
- Download-to-saved label continuity; exact hash dispatch for both versions in both languages.
- Focus retained on the same version/action through localization.
- Equal-revision retained versions with colliding 12-character prefixes remain distinguishable.
- Leaving during a pending load still prevents a stale launch and retains every version.

The existing ten Library interaction scenarios, three storage-guidance groups, four committed-refresh groups and eight deadline checks also pass. These are functional checks, not native browser, hardware, real quota or complete package qualification. Native review and exact package qualification remain separate gates.
