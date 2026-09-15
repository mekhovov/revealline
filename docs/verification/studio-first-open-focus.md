# First-open music Studio keyboard focus

Native browser checks found that the first Studio opening could leave focus on the document after loading. A cached reopening correctly focused Close, so checking only an already-opened library missed the problem.

At source `e7fc48d24cae75922789e31f63dccf9787b44351`, two fresh first-open observations ended on BODY after “Saved library loaded.” Its complete CI still passed 4,099 tests across 368 files plus 69 production checks in [run 34934186045](https://github.com/mekhovov/revealline/actions/runs/34934186045). That pass did not override the native finding.

The first correction, `a9d13d5785fdce0c3cad0a8b600b712e5667f926`, passed 30 panel tests on Node 20 and 22 but failed the same native first-open journey. It required focus displacement immediately after disabling Close; the delayed-blur path remained uncovered. Both failed native observations are retained under `.cache/round47/player-library-e7fc48d-native/` and `.cache/round47/player-library-a9d13d5-native/`.

The successor `f63939e77cef4208f6fd54c2fc0684928744a2ed` remembers the initially focused control, observes later focus choices before reading, and checks for empty focus after settlement. It restores Close only if the initial disabling remains the cause and the panel is still visible/open. Later user focus, closure, disposal and hidden-document guards prevent an unwanted focus jump. The runtime-maintainer skill records this contract.

## Verification

- Whole panel suite: **33/33 on Node 20.19.5 and 22.22.2**. Exact a9 with the delayed model failed the two delayed-success/failure cases; the corrected source passed them. Native-like disabled blur replaces the old test model's always-retained focus.
- Syntax, lint, format and diff checks passed. No artwork, simulation, media format or saved-library bytes changed. The Studio panel is outside the declared production recipe inputs.
- Fresh native source preview `http://127.0.0.1:58524/game/`, 15 September 2026: title Settings → Audio → library via Tab/Enter. After the initial read, **Close studio held focus** with document visibility reported visible; Tab reached Previous. Escape returned to the Settings library opener. Cached reopening focused Close; a second Back returned to title Settings with the game still ready for launch.
- Preview source tree: `2e614f87b8d71625a5e247d7ffbf947016ec316b`. The native receipt is `.cache/round47/player-library-f63939e-native/music-studio-focus.json`, SHA-256 `9c8f511680c0782899c2e2ca162c369dece247debe4f1d3e745325a2bdf1e0eb`. Automated receipts are `.cache/studio-first-focus/verification.json` and `.cache/studio-delayed-focus/verification.json` in the owned candidate worktree.

The earlier cyclic-object assertion diagnostic consumed excessive memory and was stopped; the retained test evidence separates that diagnostic failure from the scalar-assertion regression results. No timeout or test requirement was weakened.

This is a scoped native keyboard check. It does not certify actual MP3 upload/listening, injected native storage failure, every menu, physical controllers/devices, or frozen/public release acceptance. The updated complete source still needs its own full release qualification.
