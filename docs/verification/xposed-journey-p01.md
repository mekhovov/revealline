# Journey P01 — framework implementation checkpoint

20 September 2026. Local candidate **0.69.0**, `codex/xposed-journey-p01`,
stacked on corrected P00 `6a42faca`. Neither P00 nor P01 publication is implied.
This reuses the isolated worktree; the user's dirty original remains untouched.

## Implemented candidate scope

- One owned, bounded-JSON project compiler resolves packs, campaigns, pinned map
  revisions, mission designs, actor tiers and deterministic difficulty presets.
  CLI and Studio use this compiler. No hidden per-mission physics override.
- Explicit foundation level.v5/core.v6/replay.v7/checkpoint.v6 and pack/scenario.v6
  preserve historical selectors. Interior islands and spawn candidates, stable
  earned denominator, zero initial score, permanent erosion protection, contour
  assignment and objective-anchor paths to foundations are supported.
- Local `game/studio/`: visible board, foundation/wall/terrain/spawn editing,
  copy-on-write map revisions, effective rules, fixed-time component inspection,
  JSON project inspection/explicit apply, exact Solo practice preview, undo/redo,
  coalesced autosave, immutable checkpoints, conflict refusal, retry and backup.
- Starter is one original greybox, explicitly not a released Horizon mission.
  Preview uses temporary existing theme presentation, not final original artwork.

## Evidence obtained so far

- Focused cohort passed **103/103**, no skipped/cancelled/todo, before the later
  spawn-clearance and island-anchor additions; repeat for the final source.
  Includes historical Classic/Wide runtime, progression/presentation/transport,
  new foundation replay/capture and project/map/draft/Studio/CLI tests.
- Full ESLint passed at the initial Studio slice. Final source gates remain due.
- CLI and Studio manifests matched direct resolution in all three presets.
  Concurrent draft saves, stale-head conflict refusal, save failure, unavailable
  storage and bounded hung-open retry tested with the finite IndexedDB model.
- Actual native in-app browser opened Studio, saved checkpoint 1, added a second
  island (25 → 50 foundation cells), and Undo restored the original map revision
  and 25-cell denominator exclusion. Checkpoint 3 saved the restored draft.
- The actual engine booted the foundation scenario in Practice with 3 lives and
  0% coverage. Start → Down legally closed on the interior island, yielding 0.6%
  and 140 points, retaining 3 lives and stop-on-capture/fresh-direction messaging.
  Pausing and closing preview returned to the intact editor. Desktop screenshot
  inspected; this is not small-screen, controller, touch or human enjoyment proof.
- Initial adapter test failed because preview omitted required null mastery and
  empty visual-overrides fields. Corrected; all 14 project/draft/Studio tests passed.
- After spawn clearance, actual blocked erosion, and island anchor changes,
  the complete focused cohort passed **105/105**, no failed/skipped/cancelled/todo.
  The first anchor fixture asserted the path backwards; the implementation already
  follows the historical objective-to-anchor ordering. Corrected that expectation.
- A guessed `verify-field-kit.mjs` command was absent. This is not a failed
  production gate; the actual workflow command is `produce-field-kit-theme.mjs --check`.
- That actual command initially refused the stale effects ledger after the new
  runtime selector. Experimental source stage 33 and scoped reviewed successor 34 reproduced:
  293 slots, 131 files, original 4,007,816 payload bytes. The 42-test renderer
  cohort passed. See `p01-foundation-effects-review.md`; no new artwork was generated.
- Readiness correctly requires the new ledger committed before checking it; its
  pre-commit refusal is not a release pass. The version is consistently 0.69.0 in
  package, lock and build config; no release tag exists for this candidate.

## Still required before P01 completion

Finish authored Prologue/Horizon curriculum, original per-mission art, first Remix,
route/pacing evidence and runtime Journey registry/preset integration. Bring Team
through the shared geometry adapter and qualify actual couch behavior separately;
the current compiler explicitly refuses unsupported Team mode. Complete minimal
Studio recovery/preview race hardening and keyboard/small-screen checks. Full
Studio visual CRUD and manual image workflow remain P02, not claimed by JSON editing.

The provisional FPV34 experiment exposed 9 failures in a 44-case Team/Studio cohort
because existing pictures pin revision 32. Rather than alter those identities, the
new foundation visual adapter now leaves the historical effects renderer and FPV32
production ledger byte-identical. The unpublished 33/34 outputs were archived with
hash receipts before the generator-owned outputs were mechanically restored. The
Team cohort must be rerun; do not confuse experiment tests with final source gates.

The adapter follow-up passed **47/47** affected Team/Studio/foundation-transport
tests and **106/106** full focused framework/legacy cases, all with zero skips.
Source validation passed (version 0.69.0, 679 files, existing four navigation
warnings), full ESLint passed, and unchanged production FPV32 reproduces with
194 required reviewed slots. Readiness here checks declarations/bytes only, not
new visual acceptance; the pre-commit source identity still names P00.

Run full exact-source CI, reviewed phase PR, integrated-baseline qualification,
immutable release and GitHub Pages public-byte/native acceptance. Human validation
remains pending. Do not infer any publication from local version numbers.

## Opening greyboxes and Studio recovery follow-up

The first framework source `a423221f` is draft PR172. Its hosted preflight and
ordinary build passed; the four full test shards were still running at this
follow-up. That result does not qualify the newer work below.

- Ten original candidates: three Prologue missions, six Horizon School missions
  in two learning arcs, and a separately grouped optional Remix. Each records its
  route choice, capture consequence, lesson, mastery and intended duration.
  All share the measured keeper speed; threat counts and bands do not drop at
  the opening campaign boundary. All starting field chambers have retainers.
- Each has a deterministic, legal first return using the actual engine without
  losing a life. This is **not** a complete clear, measured human duration,
  difficulty validation, final artwork, reference disposition or release claim.
- Studio exposes the ten candidates through Inspect → explicit Apply, without
  replacing the existing project during inspection. Versus-only geometry can be
  inspected but cannot silently launch a Solo game.
- Recovery inspects any earlier checkpoint and restores by appending a new head.
  It retains intervening history and refuses a stale cross-tab restore. The
  project URL preserves the selected project across reload without another
  persistent storage dependency. Late reads/imports lose authority after edits;
  a previous session's delayed save cannot label the new session saved.
- Preview loading and JSON decoding have a finite deadline and cancellation even
  when a transport ignores abort. Failure remains in the preview panel and cannot
  overwrite a newer preview's status. Closing/replacing unloads the old iframe.
- New focused cohort: **16/16** passed; expanded framework, Classic and Wide
  regression cohort: **168/168** passed, zero failures/skips/cancellations/todos.
  Full lint and formatting passed; source validation reports 682 files, valid
  literal references, version 0.69.0 and the same four navigation warnings.
- Native browser: inspected checkpoint 2 while checkpoint 3 remained applied;
  Apply restored its 50 foundation cells as checkpoint 4; Undo restored 25 cells
  as checkpoint 5. The original project survived separately when the ten-mission
  project was explicitly applied and saved as its own checkpoint 1. Reload
  reopened that custom project. Courtyard/Expert inspection showed two lives,
  unchanged 10 cells/s movement and 140 denominator-excluded foundation cells.

A command naming a nonexistent Classic replay test did not run; corrected to
the actual Classic transport/cohort files above. The unavailable `npx` mise shim
was bypassed using the already installed Prettier entry with the existing Node
20.19.5 runtime; no global environment configuration was changed.

## Complete-route feasibility and first reveal artwork

- All ten Standard/seed-1/immediate-turn candidates now have complete legal
  clear routes. The retained command segments are replayed from a fresh run and
  verified again through replay.v7 against exact simulation identities and final
  authoritative checkpoints. All keep three lives. Search-derived routes use
  privileged offline lookahead: their roughly 7–44 second initial clear times are
  **not** human pacing/balance evidence or proof that the intended lesson occurs.
- Native First return exposed a concrete cleanup problem: its natural downward
  cut earned 816/2380 cells (34.3%), just short of the original 35% quota. The
  candidate target is now 30%, so that first closure completes the opening lesson.
  The direct first route replaces the earlier search route and clears in 414
  ticks. A regression checks all three presets and both turn policies, keeping
  actual earned coverage at 816/2380 rather than changing it for victory.
- The built-in imagegen skill produced one original 2:1 coastal-observatory
  picture, copied unchanged into `game/content-design/assets/horizon-r1/`.
  `PROMPTS.md` retains the exact prompt, source filename and hash/size/dimensions.
  It is an art candidate, not a finished visual acceptance. The other nine
  opening pictures, campaign actor styling and audio remain outstanding.
- Optional `AssetRevisionV1` entries pin original bytes, dimensions and local
  versioned PNG paths inside a project. Missing asset references fail compilation.
  Studio requires a verified loaded revision, refuses changed bytes/dimensions,
  external paths and redirects, and bounds stalled fetches/streams. Art leaves
  the simulation identity unchanged and confers no official progress authority.
- Native Practice loaded the exact pinned picture; a legal closure revealed
  only the left reclaimed region, showed 34.3% and 8160 points, and retained three
  lives. The functional grid and unreclaimed field remained separate. This was
  before the quota correction, not a complete visual/accessibility acceptance.
- After explicitly applying the quota correction, native Start → Down completed
  the mission: the result displayed the full original picture, 34.3% earned,
  8,160 points, three remaining lives and 0:03. This confirms the cleanup fix and
  earned-percentage preservation in the real host; it is not enjoyment evidence.
- Expanded framework/Classic/Wide cohort passed **173/173**, zero skips/failures,
  before the quota correction. The subsequent eight asset/curriculum tests pass,
  including the new six-combination cleanup regression. The initial replay test
  asserted the wrong result field (`valid`); corrected to the existing `match`
  API, with reconstructed terminal status independently required to be `won`.
- Full lint/format and source validation passed at the asset slice (686 files,
  unchanged four navigation warnings). Exact final-source hosted gates remain due.

Local free space declined below 500 MiB during concurrent workspace activity. No
large artifact download/build, bulk art generation or user-data deletion was
performed. Small source changes and the one 2.3 MiB original image remain safe to
retain; further bulk work must respect the existing storage reserve.

## Capture-teaching continuation fix

The accepted closure emits `cells.claimed` followed by `capture.stopped`.
The latter used to replace the Journey explanation with a generic percentage.
It now preserves occupied-region/enemy teaching and appends the fresh-direction
instruction. Legacy/non-Journey feedback is unchanged; no simulation or replay
semantics changed. This correction must be integrated into final P00 source and
qualified there; frozen `34e3f742` receipts do not cover it.

The real-host regression installs a two-keeper Classic fixture through the
visible library, closes a legal cut, and requires both occupied regions and
their actors to remain explained after stopping and another frame. Full Classic
and Journey host cohort: **15/15 passed**, no failures, skips or cancellations,
including ten consecutive clears and campaign-boundary load failure/retry.
The first test setup left Journey's chooser open by invoking the legacy briefing
helper; using the actual title-screen/library entry fixed that fixture, without
relaxing gameplay or official-content authority. Changed-file lint and diff
whitespace checks passed.

## Complete-route preset/control matrix

All ten candidates now have pinned legal complete routes for Gentle, Standard
and Expert under both Immediate and Grid + Buffer: **60 combinations**, all
finishing without losing a life. The additional 50 routes are independently
searched for their enemy timing and steering policy; the Standard/Immediate
route is not assumed to transfer unchanged. Every route is replayed from fresh
state and verified through replay.v7 against its simulation identity and final
checkpoint. The complete five-test curriculum cohort passed with no skips or
failures. These privileged offline search routes prove feasibility only, not
human reaction windows, comparative difficulty, intended route learning,
accessibility, device handling, ordinary clear duration or enjoyment.

## Frozen capture visualization

Studio now projects the engine's existing frozen component result directly onto
the map: dots for retained field, hatching for would-fill regions, outlined
hypothetical trail cells, rings around field-retaining actors and a filled center
for affected objectives. The same facts have an accessible text summary. A
visibility toggle and clear-inspection action alter neither geometry nor saved
checkpoints; changing mission/preset discards the old hypothetical trail.

Patrol markers use engine-resolved initial positions rather than trying to draw
authored contour-edge recipes as coordinates. Field keepers, outer patrols and
frontier patrols have circle, diamond and triangle markers respectively. The
overlay is explicitly a snapshot, never a legal-route guarantee or live forecast.

Five focused regressions pass: occupied/empty regions and objectives, two-sided
line-only retention, remote empty chamber auto-fill, nonmutating patterned
rendering/toggle, and finite non-retaining patrol markers. Before this UI slice,
the expanded compiler/foundation/Classic/Wide/Journey non-host cohort passed
**164/164**, no skips/failures. Full lint and source validation pass with 688
files and the same four navigation warnings.

Native Studio verification: First return's hypothetical vertical cut reports
782 would-fill cells + 34 trail cells and visibly hatches only the empty region;
Two keepers reports two retained regions, both named anchors, zero would-fill
cells and 34 trail cells. Hiding the overlay removes its legend; clearing the
inspection restores the unsplit view and empty input while checkpoint 3 remains
unchanged. A CSS display rule initially overrode the legend's hidden attribute;
the scoped correction was reloaded and verified in the browser. This evidence
does not claim complete small-screen, assistive-technology or human validation.

The shared resolver now also reports wall-isolated occupied chambers, unreachable
required/optional objectives, an optimistic coverage ceiling, and remote empty
chambers/objectives that would fill automatically. These diagnostics use engine
initial retention and static wall connectivity; they do not promise legal cuts,
terrain clearance, timing or enjoyable cleanup. Impossible quotas and required
objectives are errors in candidate diagnostics, not silent geometry corrections.
All ten opening candidates avoid these known topology errors and unintended
initial empty regions. Diagnostics + Studio/CLI + full-route cohort: **15/15**
passed with no skips/failures after the resolver addition.

## Foundation paired-board qualification

The actual paired-board engine now runs all 60 opening mission/preset/steering
routes. Identical inputs finish both independently allocated boards on the same
tick with identical authoritative checkpoints and a draw, inside the ordinary
90-second race limit. The island fixture also awards either seat when only that
seat follows its complete route; the idle seat earns no territory and retains
its original foundations. Pause freezes both boards and neutral Resume does not
reuse steering.

Two actual Couch host fixtures (Immediate and Grid + Buffer) load the compiled
interior-spawn candidate through the real campaign reader, Start both boards and
close legal island departures via both keyboard input routes. Both stop with
three lives and equal checkpoints; foundations stay excluded from coverage.
The complete new file passes **10/10**, no skips/failures, in 6.73 seconds. This
finite host model does not establish native rendering, physical two-controller
play, completed race navigation, human fairness or Team compatibility. No Solo
clear is substituted for paired-board evidence, and Team remains unsupported by
the project adapter until its distinct recovery/topology contract is implemented.

## Direct candidate structure editing

The shared structural-edit boundary now creates missions, campaigns and packs,
duplicates missions, renames items, adds explicit parent membership and moves an
item earlier/later within that parent. Studio exposes these actions without JSON
editing; every change passes the project compiler before the existing undo and
autosave session adopts it. Duplicates pin the same immutable map until a geometry
edit forks one consumer. A starter mission is explicitly an untested band-1 island
template, not automatically relabeled for a harder campaign. Invalid bands,
references, duplicate IDs and inappropriate commands fail without changing source.
Archive/restore, dependency-aware removal and the manual image workflow remain P02
work; this is not claimed as complete CRUD or publication support.

Structure, Studio/CLI, draft history and checkpoint recovery: **20/20 passed**,
zero failures/skips. Full lint/format and validation pass (690 files, the same four
navigation warnings). Subsequent CSS-only target sizing was checked separately.

Native browser scope used a separate `studio-structure-check` local project.
Created a pack, campaign and mission, duplicated the mission, reordered it,
undid/redid that order, then added 25 foundation cells to only the copy. The
original retained 25 cells; the copy showed 50. Reload restored checkpoint 8,
both items and the accepted campaign order. This confirms local UI/persistence,
not published-content authority or complete device accessibility.

At 390×844 the new controls originally measured 38.5–40 px. Corrected inputs and
selects now measure 44 px; portrait and 844×390 layouts have no horizontal overflow.
The short-landscape form was scrollable, not fully visible at once. An initial
screenshot request had zero viewport width; explicit responsive dimensions allowed
inspection. No image-file receipt is claimed for inline screenshots. The temporary
viewport override was reset. Physical touch/controllers and 200% zoom remain open.

## Opening artwork expansion

Four additional original PNGs are pinned for Choose your share, Two keepers,
Nearby shore and Island outpost. With First return, five missions now resolve
distinct reveal compositions through the same verified asset boundary. Exact
prompts, original filenames and byte/dimension/hash pins are retained alongside
the unchanged generated images. No third-party artwork was used. All five
images are 1774 × 887 and remain below the existing 4 MiB per-image limit.

The ten-test asset/curriculum cohort passes with no failures or skips. It checks
every pinned image's original bytes, dimensions, unique composition hash, single
mission consumer and successful bounded loading; all ten simulation identities
remain identical with and without artwork. Existing replay routes still pass.

Native Studio inspected and explicitly applied the updated collection. Its
existing saved project caused the expected stale-head refusal: the updated
candidate remained usable session-only, and the stored predecessor was not
overwritten. Island outpost's real Practice host loaded the new picture, started
on its interior foundation at zero earned coverage and legally connected it to
the top perimeter. The displayed result was 0.6%, 140 points and three lives,
with stop-on-capture and fresh-direction feedback. Pause/Resume did not reuse
steering; closing preview returned to the intact session draft. Desktop
1024 × 768 screenshots were inspected inline, with no exported image receipt.
This is partial-reveal/launch evidence, not a full clear or whole-set contrast,
small-screen, physical-controller or human playability acceptance.

A first browser locator action failed while the default viewport was unusable;
the same visible action succeeded after establishing the explicit test viewport.
That override was reset. Three further generated originals (Stepping stones,
Two bays, Courtyard return) remain unreferenced outside the project until disk
capacity permits a safe copy. Long way home and the Remix still need generation.
No image-copy, large artifact download or release build is attempted below the
existing 512 MiB reserve. No user files were deleted to obtain capacity.

Follow-up: capacity later recovered above that reserve. All ten original image
candidates are now integrated; the preceding five-picture section is historical
evidence, not the current inventory. See `xposed-journey-horizon-art.md` for the
complete set, 100-test cohort, actual Courtyard partial reveal and remaining
contrast/host/human gates. None is promoted to visually qualified by generation.

## Authored Journey registry adapter

`resolveContentJourney` resolves explicit authored pack/campaign/mission order
through the existing project compiler and Journey catalog. Pack selection filters
the authored order; it does not invent a second order. Core and optional Remix
packs can be resolved separately. Unsupported-mode missions are omitted with
contiguous runtime indexes; empty selections and unsupported Team fail explicitly.

Each runtime campaign contains the same levels as direct mission resolution.
Gentle/Standard/Expert change execution identity but not stable navigation keys,
and paired-board/Solo use identical physics. This bypasses no host authority and
does not silently run Journey levels through Legacy's different Gentle policy.
All entries are `candidate`, with official progress ineligible. Artwork references
still require independent verified loading. Gameplay host adoption is still due.

The CLI exposes this same resolver:
`node scripts/compile-content-project.mjs project.json --journey --pack journey-opening --difficulty expert`.
The ten-test Journey-registry plus Studio/CLI/history cohort passes without skips
or failures, including actual Solo/paired engines for every mission/preset,
cross-campaign Next, optional Remix separation and contradictory CLI rejection.
