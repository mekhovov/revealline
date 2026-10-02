# Neon coverage merge repair

The merge at `466754cde` lost two main-branch coverage blocks and restored an obsolete terrain limit. This was a branch integration regression, not an existing main failure. The comparison baseline was main `ba598ca65`.

Restored main behavior:

- Classic terrain admits up to 512 rectangles. The integrating task restored that validator limit; Hunt's owned-copy boundary now also admits the same 512-item array limit already used by level validation and normalization.
- A coverage descriptor has exactly the supported `reachable-routes.v1` shape. Its initial safe-to-safe route budget must be nonzero and must include every required objective.
- `createRun` again records the fixed eligible mask, excluded-cell count and reachable denominator. Without that initialization the merged branch incorrectly used all field cells for a Neon coverage goal.

Historical v4/v5 coverage admission remains unchanged; v6–v8 still reject this policy. Hunt v9 can preserve the policy only with empty relay gates, empty directional fields and no staged encounter: the geometry inherited from an admitted v5 level. Off/Patrol derived from that successor return to v5 and remove only its empty successor geometry descriptors. Other Hunt derivatives keep the existing v8 downgrade. No policy is silently removed or applied to gate-dependent geometry.

Direct content admission and initial-state inspection covered all 16 Neon Reference and 38 Neon Mosaic levels. Their maximum terrain counts are 399 and 191 respectively. All 54 authored levels validated, and all 270 Off/Patrol/Bonus/capture-plus-quota/Hunt derivatives admitted with the same reachable denominator as their source. Returning each Hunt derivative to Off/Patrol produced v5. Channels records 2,114 eligible and 188 excluded cells; Spirals records 1,216 eligible and 1,164 excluded cells. Each inspected eligible-mask sum matched its denominator and the coverage analyzer.

Focused invalid-descriptor inspection rejected an unknown policy version, an extra policy field and a v8 level carrying route coverage. Source comparison confirmed main's weighted capture and erosion accounting, route analyzer, map rectangle limits, and level copy/normalization limits remain present; no additional loss was found in those overlapping core/map paths.

Existing source recipes and historical version formats were not rewritten. A checkpoint produced by the unqualified development merge while its coverage initialization was missing can fail exact restoration after this repair; that does not represent a change to the intended main-branch production recipe. Do not migrate or reinterpret that checkpoint silently.

Automated suites remain **WAIVED_SKIPPED_NOT_PASSED**. These observations are content/initial-state inspection, not completion playthroughs or human qualification. Scoped ESLint, formatting and syntax checks cover the repaired files; the integrating task owns full content/build validation.
