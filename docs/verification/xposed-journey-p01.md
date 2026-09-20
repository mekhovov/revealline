# Journey P01 — framework implementation checkpoint

20 September 2026. Local candidate **0.69.0**, `codex/xposed-journey-p01`,
stacked on frozen P00 `34e3f742`. Neither P00 nor P01 publication is implied.
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
