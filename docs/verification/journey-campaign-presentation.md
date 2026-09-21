# Journey campaign presentation successor

## Scope and evidence boundary

The original-picture teaching review assigned Horizon to all nine later
campaigns, Neon through Apex. An explicit presentation successor now binds those
59 missions to their own campaign identities. The24 earlier missions retain their
exact editions. This closes a source/theme binding gap; it does **not** complete
campaign-specific character artwork, materials, reactions, music, human visual
validation or public release qualification.

The existing twelve visual settings and83 original background pins are unchanged.
The new palettes support those settings while retaining one functional vocabulary:
gold active-route accent, mint reclaimed-ground cue, coral danger cue, the same
craft and role silhouettes, outlines and role labels. Reclaimed ground is never
renamed universally safe. Existing player-selected visual overrides retain their
precedence; this source projection neither reads nor writes player preferences.

W3C's [non-text contrast guidance](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)
informs the unrounded3:1 flat-color checks for functional colors against the authored
field. Paper/muted text against field and paper against ink receive4.5:1 checks.
Its [use-of-color guidance](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)
supports retaining shape and text distinctions rather than changing role meanings
by campaign. These checks do not establish WCAG compliance: actual revealed images,
antialiasing, thin marks, user overrides and physical displays need separate review.

## Shared implementation and immutable editions

- `themes.json` remains the only palette/render-definition registry. Nine valid
  entries are appended; the original three definitions and Legacy themes are unchanged.
- `campaign-presentation.mjs` explicitly maps chapter IDs to stable theme IDs.
  It copies sources before changing presentation, rejects unknown/mixed-theme
  chapters, and does not advance an already-bound source a second time.
- `createWholeJourneyChapterSources({campaignPresentation:true})` feeds composition
  and adaptation inspection. No second level registry or copied geometry is introduced.
- Changed missions, campaigns and packs receive a `-theme-1` revision. Maps,
  coverage, actors, warnings, controls, difficulty, objectives, optional goals and
  asset bytes remain exact. Simulation hashes remain unchanged for all498
  Solo/Versus preset manifests; run identity/result revisions deliberately differ.
- The explicit `?journey=whole-originals-v3` route owns the independent
  `revealline.suspended.journey-whole-originals.v3` slot. Earlier opening/authored,
  whole-originals and v2 routes do not expand or migrate.
- Studio's optional whole-library inspection and play links select v3. Inspection
  still requires explicit Apply. The exact authored theme loader rejects missing
  themes instead of silently substituting Horizon.
- `node scripts/audit-journey-adaptations.mjs --edition campaign-originals`
  resolves the same source editions. Historical default and v2 audit selections
  remain available;48 references/66 links/83 missions still have zero final dispositions.

## Presentation and soundtrack handoff

The table is a creative brief, **not** installed recordings or saved assignments.
Music implementation belongs to the soundtrack owner after accepted integration.
Do not persist these briefs into player libraries or replace an explicit choice.
All scenes below describe the reveal art; procedural fallback scenes remain within
the existing renderer's supported vocabulary.

| Chapter | Campaign IDs (including optional Remix) | Stable theme ID | Visual material / setting | Suggested music character; gameplay energy |
| --- | --- | --- | --- | --- |
| Horizon | prologue, horizon-school, horizon-remixes | horizon | Warm dawn, open shore and small landmarks | Spacious melodic exploration;2 |
| Border | border-bloom, border-remixes | border-bloom | Quiet garden stone and muted green | Light rhythmic movement;2 |
| Signal | signal-gardens, signal-remixes | signal-gardens | Cool glass, planted paths and blue-gray structure | Airy electronic detail;3 |
| Neon | neon-contours, neon-remixes | neon-contours | Midnight harbor water and amber windows | Restrained night-drive pulse;3 |
| Rover | rover-yard, rover-remixes | rover-yard | Salvaged copper, olive-gray steel and repair sheds | Dry percussive workshop motion;3 |
| Fracture | fractured-grid, fracture-remixes | fractured-grid | Tidal blue-green stone, bridges and copper repairs | Measured tidal pulse with space for erosion warnings;3 |
| Phase | phaseworks, phase-remixes | phaseworks | Brass optics, sunset stone and muted plum | Clockwork layers with clear warning space;4 |
| Livewire | livewire-foundry, livewire-remixes | livewire-foundry | Warm charcoal, cooled ceramic and steel | Controlled industrial rhythm, not continuous maximum tension;4 |
| Relay | relay-labyrinth, relay-remixes | relay-labyrinth | Sandstone archives, shaded canals and olive patina | Interlocking exploratory phrases;3 |
| Crosswind | crosswind-array, crosswind-remixes | crosswind-array | Cloud-blue highlands, pale grasses and brass instruments | Airy forward motion;4 |
| Sentinel | sentinel-crown, sentinel-remixes | sentinel-crown | Weathered violet-gray citadel stone and bronze | Measured monumental tension, room for shield/attack cues;4 |
| Apex | apex-aurora, apex-remixes | apex-aurora | Polar indigo water, warm cabins and lavender aurora | Broad returning motifs with capstone lift;4 |

Numbers are proposed authored energy1–5, not enemy speed or a promise of tracks.
Optional finales may use5 only after listening with actual threat cues. Automatic
selection must preserve explicit playlist/genre/Fusion/My Mix choices and saved
map > campaign > theme > global assignment precedence. Solo-compatible Versus
must keep the same base campaign music identity; Team identity remains separately
qualified. No synthetic recording workaround or unreviewed rights claim is added.

## Verification

Seven dedicated tests pass on Node20.19.5 and22.22.2: palette/schema/body validity,
contrast floors, copy-on-write and fail-closed projection, all498 physical
equivalents (354 explicit new presentation manifests and144 exact earlier manifests),
249 exact Solo host selections,249 exact Versus host selections,83 Studio
greybox scenario constructions, and adaptation-edition parity.

The60-test source/route/Studio/CLI/picture/theme/readability cohort passes Node22.
Node20 companion regressions, full71-Solo/71-Versus actual-host flows on both
Nodes and native observations are pending at this source checkpoint. The host
tests retain every frozen route/checkpoint and compare all physical replay sections
against the new edition without mutating runtime state or rewriting expected hashes.

No new PR, version, release, Pages deployment or accepted-tree CI pass is claimed.
The release owner's device priority and selective integration hold remain in force.
