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
- Studio's optional whole-library inspection and play links select v3. All nine
  individual later-chapter inspections use the same projection. Inspection
  still requires explicit Apply. The exact authored theme loader rejects missing
  themes instead of silently substituting Horizon.
- `node scripts/audit-journey-adaptations.mjs --edition campaign-originals`
  resolves the same source editions. Historical default and v2 audit selections
  remain available;48 references/66 links/83 missions still have zero final dispositions.

## Presentation and soundtrack handoff

### Current production boundary and machine-readable direction

On21 September2026 the soundtrack owner confirmed the user's explicit pause on
original AI music production after rejected listening samples. Its source record is
`docs/music-production-pause.md` in the soundtrack worktree. Original approvals
remain zero; this Journey continuation does not resume synthesis or treat the
existing five procedural genres as approved campaign compositions. Rights,
recording quality, musical approval and game-catalogue enrollment remain distinct.

`game/content-design/campaign-music-direction.mjs` now provides twelve frozen
direction briefs with preferred genre tags, separate menu/gameplay roles and
authored energy. It selects no recording, writes no assignment, accesses no audio
transport/preferences and grants no rights. Ukrainian recordings are not inferred
from scenery or assigned without the soundtrack owner's rights and musical review.

`createJourneyMusicDirectionReview(routeId)` binds the brief to exact compiler
baseCampaignKey, level/revision and theme identities. V3 and V4 each report249
preset mission contexts and match the compatible Versus host exactly, including
Remixes. Material-successor themes never replace the old assignment identity.
`createTeamMusicDirectionReview({ actors })` reports36 contexts for each explicit
Team variant using the separately validated pack hash. It retains the current
prepared FPV context and keeps desired authored materials separate; it does not
pretend the live Team look has already adopted those themes.

18 relevant direction/identity checks pass on Node20.19.5 and22.22.2. The soundtrack
owner retains runtime matching and all precedence/continuity work. Do not spread
the whole direction object into the soundtrack context: use only its existing
exact context fields and separately reviewed scene/energy hints. Genre hints
never override an explicit genre, playlist or My Mix choice. No composition,
listening approval, publication or Pages enrollment is established by metadata.

The soundtrack owner reviewed source59416554 and accepted this metadata handoff,
not a runtime merge or musical approval. Its integration must use a compact
lookup, not import route/host review factories into playback. Preferred genres
are Automatic ranking hints, never hard catalogue filters or saved assignments.
Menu hints apply only to true title/campaign browsing, never Settings, Pause,
results or quick retries. Explicit Ukrainian/other genres, Fusion, My Mix and
playlist choices continue to win.

The table is a creative brief, **not** installed recordings or saved assignments.
Music implementation belongs to the soundtrack owner after accepted integration.
Do not persist these briefs into player libraries or replace an explicit choice.
All scenes below describe the reveal art; procedural fallback scenes remain within
the existing renderer's supported vocabulary.

| Chapter   | Campaign IDs (including optional Remix)   | Stable theme ID  | Visual material / setting                                | Suggested music character; gameplay energy                     |
| --------- | ----------------------------------------- | ---------------- | -------------------------------------------------------- | -------------------------------------------------------------- |
| Horizon   | prologue, horizon-school, horizon-remixes | horizon          | Warm dawn, open shore and small landmarks                | Spacious melodic exploration;2                                 |
| Border    | border-bloom, border-remixes              | border-bloom     | Quiet garden stone and muted green                       | Light rhythmic movement;2                                      |
| Signal    | signal-gardens, signal-remixes            | signal-gardens   | Cool glass, planted paths and blue-gray structure        | Airy electronic detail;3                                       |
| Neon      | neon-contours, neon-remixes               | neon-contours    | Midnight harbor water and amber windows                  | Restrained night-drive pulse;3                                 |
| Rover     | rover-yard, rover-remixes                 | rover-yard       | Salvaged copper, olive-gray steel and repair sheds       | Dry percussive workshop motion;3                               |
| Fracture  | fractured-grid, fracture-remixes          | fractured-grid   | Tidal blue-green stone, bridges and copper repairs       | Measured tidal pulse with space for erosion warnings;3         |
| Phase     | phaseworks, phase-remixes                 | phaseworks       | Brass optics, sunset stone and muted plum                | Clockwork layers with clear warning space;4                    |
| Livewire  | livewire-foundry, livewire-remixes        | livewire-foundry | Warm charcoal, cooled ceramic and steel                  | Controlled industrial rhythm, not continuous maximum tension;4 |
| Relay     | relay-labyrinth, relay-remixes            | relay-labyrinth  | Sandstone archives, shaded canals and olive patina       | Interlocking exploratory phrases;3                             |
| Crosswind | crosswind-array, crosswind-remixes        | crosswind-array  | Cloud-blue highlands, pale grasses and brass instruments | Airy forward motion;4                                          |
| Sentinel  | sentinel-crown, sentinel-remixes          | sentinel-crown   | Weathered violet-gray citadel stone and bronze           | Measured monumental tension, room for shield/attack cues;4     |
| Apex      | apex-aurora, apex-remixes                 | apex-aurora      | Polar indigo water, warm cabins and lavender aurora      | Broad returning motifs with capstone lift;4                    |

Numbers are proposed authored energy1–5, not enemy speed or a promise of tracks.
Optional finales may use5 only after listening with actual threat cues. Automatic
selection must preserve explicit playlist/genre/Fusion/My Mix choices and saved
map > campaign > theme > global assignment precedence. Solo-compatible Versus
must keep the same base campaign music identity; Team identity remains separately
qualified. No synthetic recording workaround or unreviewed rights claim is added.

## Verification

Eight dedicated tests pass on Node20.19.5 and22.22.2: palette/schema/body validity,
contrast floors, copy-on-write and fail-closed projection, all498 physical
equivalents (354 explicit new presentation manifests and144 exact earlier manifests),
249 exact Solo host selections,249 exact Versus host selections,83 Studio
greybox scenario constructions, individual Studio-handler projection/Apply
boundaries, and adaptation-edition parity.

The original60-test source/route/Studio/CLI/picture/theme/readability cohort passes
both Nodes; the additional eighth presentation test also passes both. All71 Solo
host clears,70 Next actions, exact theme selectors/art pins, failed-preload recovery,
separate receipts and final voluntary exit pass Node22 (505s) and Node20 (650s).
The host
tests retain every frozen route/checkpoint and compare all physical replay sections
against the new edition without mutating runtime state or rewriting expected hashes.

Native exact `bd150e3f`, read-only port8814, owned browser1/tab38:
the chooser directly launched Folded corner, Read the lock and Crossing complete.
Screenshots show their distinct original images, foundation/terrain/role shapes
and3 starting lives. Read-only inspection of the native theme selector confirms
`neon-contours`, `livewire-foundry` and `apex-aurora`, each the only
offered authored theme for its mission. The unclaimed field remains deliberately
opaque; these observations are not whole-image contrast or new character-art proof.
No complete native playthrough is claimed.

Studio inspection compiled83 without replacing the one-mission workbench; explicit
Apply produced24 packs/25 campaigns/83 missions in the new local project. Selecting
Folded corner retained222 foundation cells/2158 earnable cells and the same
three actors. Play exact Solo preview reached Engine ready/Practice and its
native theme selector chose Neon Contours. Closing preview returned to the draft.
Warnings still explicitly mark candidate art and disconnected foundations.
After the server advanced to exact `da267de0`, standalone Neon inspection
showed all seven `neon-contours` mission revisions while preserving the83-mission
workbench until Apply. Explicit Apply opened `neon-greybox-candidates-themes`
with exactly seven missions. Its mission/theme revisions match the whole-library
projection. This is not an additional standalone native gameplay playthrough.

### Failure found by stronger Versus assertions

Both original full-host runs failed at the first Horizon → Border Next transition:
the `race-theme` selector still displayed Horizon, although the new round recipe,
picture and painter received Border. Earlier whole-host assertions checked boards
and artwork but not the selector. This was an existing continuation-control bug,
not an enemy-speed or theme-renderer failure. The failed runs are retained as
evidence; no assertion or frozen replay was weakened.

A six-line hunk in `couch.mjs` now replaces theme options and selected value only
after the prepared next attempt is committed and its ownership rechecked. Failed,
cancelled and stale preparation must keep previous controls. A focused real-host
regression first reproduced the stale Horizon value; after the fix it passes,
including an intentionally failed Border picture, preservation of both prior
boards/picture/theme options, and successful retry into the exact Border theme.
After the fix, all71 equal Versus races and70 deliberate Next transitions pass
with exact theme-selector and original-picture checks on Node22 (123s) and
Node20 (174s). Both modes retain their separate71 completion receipts and
end deliberately before optional Remixes. The56-test candidate-host/static-picture/
lease cohort also passes both Nodes, covering cancellation, stale acquisitions,
failed/retried Next, interrupted focus, mode return and retained muted music.
The injected artwork/decode refusal traces in these tests are expected negatives.

Native exact `67aaaab8` on the same owned port/tab confirms active Horizon
race → chooser → Behind the patrol adopts only Border Bloom in the theme selector.
The paused summary agrees. A subsequent chooser transition to Folded corner
adopts only Neon Contours; a live screenshot shows equal paired boards, the same
original picture and3 lives each. The final state is paused. This verifies
native chooser continuation, not native completion of all71 races or a
physical two-controller session.

All local test processes for this batch completed. Scoped ESLint, formatting and
diff checks pass; no full accepted-tree CI pass is inferred.
The UX owner confirmed no overlap; integrate this small hunk into accepted
`prepareNext`, never replace the root owner's complete couch host.

No new PR, version, release, Pages deployment or accepted-tree CI pass is claimed.
The release owner's device priority and selective integration hold remain in force.
