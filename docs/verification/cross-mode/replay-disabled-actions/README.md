# Replay disabled-action correction — local v0.60.7 candidate

Disabled Play looked like an available primary action because shared and legacy ID selectors overrode the disabled component colors. This candidate guards both active/hover rules against native `disabled` and `aria-disabled="true"`. Playback, keyboard ownership, replay bytes, checkpoints and scoring are unchanged.

The base is `9c89f997cdbf0c8266fa65247832dcf2281d61ba` (the Settings source ancestor). **This is a local candidate, not an accepted public release.** Settings ancestry, final exact-source qualification and the public deployment gates remain pending. P03/P05 remain incomplete.

## Evidence and scope

- Existing complete navigation, display-host and menu-appearance files: 29/29 checks on Node 20 and separately 29/29 on Node 22, with no failures or skips. No new mirror test was added. These original checks apply to the five-path candidate before the version-only packaging change; they are not a full-suite qualification of this commit.
- The initial Node 20 cache-fixture attempt omitted a dynamic host import. Its failure and subsequent exact-Git dependency closure correction remain in the originals. It was not a product regression.
- Root's real browser played the built-in Copper Crossing recording to tick 1305 and checkpoint `861a6de2ffd7e119`; no progress was awarded. Baseline disabled Play remained amber. Candidate Play used muted text, panel background and dashed line border; enabled colors remained primary. Completion handed owned focus to Restart, keyboard Restart returned to tick 0, and Plain/Large repeated the completed-state result.
- Request-byte reconciliation matched all 164 baseline and 164 candidate GET records against exact Git or the two CSS overrides. Twelve browser originals are retained. The extensionless screenshots are JPEG, 1056 × 720; DOM viewport 1280 × 720 is a separate observation.
- Actual worktree-path formatting and diff checks pass. The earlier cache-path formatter ignored `.cache`; its zero exit was not a valid style inspection. The first actual-path failure and the correction are preserved: one whitespace-only wrap inside the shared hover selector, with unchanged matching semantics.
- Root closed its tabs and the two verified local server processes were stopped. No empty/loading/error-state native pass, aria-disabled-only native pass, physical controller/touch qualification or public acceptance is claimed.

[`manifest.json`](manifest.json) pins each losslessly copied original, including failed attempts. Historical absolute paths remain in those originals; the manifest locates their repository copies. The original handoff describes the cache candidate, not a newer qualified source. The corrected styles and [supporting-screen guide](../../../supporting-screen-readability.md) are authoritative product/guidance changes.

Full source gates, release artifacts, published inventory and affected public journeys must pass before this correction is accepted publicly.
