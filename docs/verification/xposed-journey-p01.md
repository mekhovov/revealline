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
