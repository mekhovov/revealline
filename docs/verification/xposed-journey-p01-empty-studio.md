# P01 — empty Content Studio projects

20 September 2026; candidate branch, not release acceptance.

The shared compiler already accepts projects with no missions. Studio previously
refused them during source inspection. It now admits the same valid source and
shows an explicit empty workbench with a direct Create first mission action.
Mission-owned canvas, rules, diagnostics and hypothetical capture output are
cleared; geometry, capture and preview tools are disabled until a mission exists.
Published content, saved predecessor checkpoints and player progress are unchanged.

Verification:

- 13/13 focused Studio/structure tests passed. Two new tests cover empty
  checkpoints, pack/campaign/mission creation, Undo/Redo and empty-board UI reset.
- 86/86 content/foundation/Horizon tests passed locally on the working candidate,
  including the separately pending five-background artwork changes. This is not
  exact-commit hosted qualification or an addition to P00's source-gate totals.
- ESLint, selected Prettier checks and validate passed: 696 distribution files,
  with the same four navigation warnings for non-distribution links.
- Native in-app browser, owned `studio-empty-check` project: Inspect → Apply an
  empty source; clear old board and disabled controls; Create first mission focuses
  the stable ID; create a mission enables map/preview; Undo returns to empty;
  save checkpoint 4 and fresh reload retain the empty project. No existing user
  project was modified. A 390×844 inspection showed the complete empty-state
  explanation and action without clipping; viewport override was reset.
- An older owned tab with unapplied JSON did not reload into the new code. A
  separate test-project tab verified fresh adoption; this is not a runtime bug.
- Native creation revealed stale source-inspection copy after applying. Render now
  reports the current draft's map/mission counts; fresh reload confirmed the copy.

Scope limits: no physical touch/controller, complete accessibility audit, measured
latency, human enjoyment, full empty-project feature set or public Pages acceptance.
Archive/delete/restore and manual image workflows remain separate planned work.
