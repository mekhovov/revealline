# Phase 0 verification — 24 September 2026

Status: **source and scoped native verification complete; PR/release/public acceptance pending**. Phases 1–8 remain unimplemented. This record does not claim a new release or a full desktop/mobile browser matrix.

## Candidate

Isolated branch `codex/creator-phase0-guide`, based on reviewed main `1deaae1a9a30c6146ecbb36c83cf43c9346a57c0`. The modified development checkout and other tasks' worktrees were preserved. The initial bounded checkout selected 2,373 files / 414,467,369 bytes, then added required authoring code and 67 build inputs / 13,299,997 bytes. No historical payloads were deleted.

Shipped candidate scope: a browser-readable beginner guide linked from Playground and Studio, Markdown walkthrough/reference/maintainer instructions, phase register and a two-mission runtime expansion. The original Studio example remains byte-identical.

## Actual local observations

Observer: Codex in-app browser on macOS, localhost port 8771, keyboard input and native file-chooser flow. This isolated origin had no campaign progress before the test. It is not a separately provisioned browser profile or deployed-release check.

1. Opened the HTML guide and activated **Download Two crossings**. The actual downloaded file matched the authored fixture: SHA-256 `701e53e5e1e344b5a4f4ff879f1a9a3530d6542e478ad13ebe77426636d23093`.
2. Opened the compatibility player (`game/?journey=legacy`). Used **Settings → Game data → Installed chapters → Install a pack file** and selected that actual downloaded file. The UI reported **Validated and installed** and displayed **Play Creator guide · two crossings**.
3. Used the installed card's Play, then Start mission and a native Down key. First crossing legally reached 100% coverage, 15,640 points, three lives, with the earned-picture result and **Next mission**.
4. Next continued the campaign. Paused, chose Restart mission and confirmed it; the attempt reset to zero time/score with three lives. A native Down key then completed **MISSION 02 / SECOND CROSSING**, 100% coverage and 15,640 points.
5. Reloaded and opened Collection. Both First crossing and Second crossing remained listed with Gold and 15,640-point records. Opening First crossing displayed the completed-level picture.
6. In Content Studio, selected the existing source example through **Inspect import**. Inspection enabled Apply while preserving the accepted draft. Applied, saved checkpoint 1, exported and reloaded. The restored project retained **Community Pilot** and its source identity.
7. Opened **Play exact Solo preview**. The runtime explicitly identified practice/no campaign rewards. Start and native Down legally connected the island for 0.6% coverage; Escape paused with explicit Resume. This is a capture check, not a full clear of the Studio sample.

The Studio export's download-event observer timed out, while the UI reported download requested. Filesystem inspection found the actual new 1,773-byte backup; its SHA-256 is `4a5290829dff769cc22bb3d383625cf8812fd8127dab96f8ac5e1dab870198e1`. Its parsed project data equals the source example. The source file uses different whitespace and has SHA-256 `c1c51cd83ce3a20aa1d7030951442ac60de2aa33d523ea2586b7968531e10e5a`; whole-file equality is not claimed. The download was not repeated. A Collection locator initially matched two visible buttons; selecting the observed Home control resolved that observer ambiguity without changing the app.

The compatibility player's installed-card Play path was exercised. A separate check from the default Journey root reached Settings → Game data → Installed chapters, but clicking the sample's Play button produced no visible launch. This pre-existing default-host gap is retained for Phase 1 investigation. The guide now links directly to the verified `?journey=legacy` pack player and does not claim the untested Custom-filter route. Library & saves is not a Home action at this baseline. The first default-root observer also timed out during startup; the next inspection found the normal Home screen, after which the actual Settings actions succeeded.

## Source checks

- `node --test game/test/community-creator-guide.test.mjs game/test/packs.test.mjs`: 10/10 passed. The new fixture test uses the production pack reader, installation and export/import roundtrip, then legal Down input on both maps in Immediate and Grid + buffer. All four routes win without life loss (414 ticks each in the direct core check).
- The supplied Studio example passed `compile-content-project.mjs --check`, `--journey --pack opening --mode solo --difficulty standard`, and `--pacing --pack opening --mode solo`. All six Solo/Versus × Gentle/Standard/Expert resolutions passed. Existing warning/release-readiness distinctions remain intact.
- Scoped ESLint, Prettier and whitespace checks passed before PR preparation.

## Preserved setup/build failures

- A Chrome browser provider was unavailable; verification used the available in-app browser. Native browser inventory did not expose Chrome, Firefox or Safari. No cross-engine or physical-device pass is claimed.
- The initial sparse preview lacked authoring module dependencies; the game also identified missing motion-lab presets. Exact tracked runtime dependencies were restored in this worktree, then the native tests above passed.
- The first build rejected an attempted private `.cursor` include. The include was removed and the guide links to the repository release procedure instead.
- The corrected local build then stopped at absent optional source `authoring/library/four-worlds-chapters`. This is a bounded-checkout input failure, not a successful build. Full hosted PR build/preflight and release readiness remain required; no production validator was relaxed.

## Release acceptance still required

Record the final PR/source SHA, current hosted gates, allocated immutable release, original artifact hashes, publication run and deployed browser checks here or in a linked immutable receipt. Check the guide and both download URLs in the actual released artifact. Complete Chromium, Firefox and Safari acceptance where available; retain unavailable engines explicitly. No `.rlpack`, automatic generation, modern Custom campaign integration or community publication capability is claimed by this phase.
