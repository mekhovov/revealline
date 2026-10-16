# Neon delivery and playability — 15 October 2026

This follow-up closes the missing distribution galleries and records complete moving-enemy wins for the existing 16 Reference and 38 Words & Symbols levels. It preserves all level geometry, enemy placements, artwork and mission identities. Local unit suites and Ukrainian translation remain deferred at the user's request.

## Delivered changes

- The distribution includes the Neon artwork and Mosaic layout galleries, their images, editable scenarios and linked documentation.
- All 54 artwork cards and 38 layout cards link to the exact current-rule main-game mission. The Mosaic gallery retains a separate **Try editable copy** action and scenario download.
- About-page pack cards link to the pictures. Duplicate gallery assets load on demand instead of consuming the mandatory offline cache. Both playable Neon packs retain their own explicit offline chapter downloads.
- A repeatable source audit joins each of the 77 recently added paintings to its image fingerprint, level revision, pack, source file and public URL. It also compares the official Classic catalog with the merged Classic artwork delivery.
- A deterministic route search produces ordinary directional input for the real game engine. An independent run and the public replay verifier validate every winning receipt.

## Evidence

| Evidence | Result | Boundary |
|---|---|---|
| [Winning routes](winning-routes.json), [summary](winning-routes.md) | 216 wins: all 54 levels × Standard/Gentle × grid-center/immediate; no lives lost | Current rules, Scout, seed 1. A legal route is evidence of feasibility, not human difficulty approval or a guarantee for every seed, class or game mode. |
| [Image and catalog inventory](inventory.json) | 77 distinct original paintings correctly bound; all 209 current picture owners have images | This chat's Classic/Neon scope; not every independently maintained mode or private import. |
| [Catalog preservation](catalog-preservation.json) | All 164 official Classic identities retained from PR #1003 | Does not inspect browser saves or private imported packs. |
| [Static visual review](visual-review.md) | All 77 paintings and 54 layout projections reviewed; retain existing art | Partial-reveal contrast, reward crops, physical screens and human approval remain pending. |
| [Distribution audit](build-delivery.json) | Both galleries and all 92 exact play links resolve to emitted files; all linked assets exist; both pack hashes match | Local production build, not a claim that the PR is deployed on Pages. |
| [Artwork gallery browser capture](gallery-browser.jpg), [layout gallery capture](layout-gallery-browser.jpg) | Source galleries render normally; clicking FPV reaches the exact mission URL | The game then presents its existing password gate. No gameplay acceptance is inferred from that click. |

No new artwork or terrain changes were indicated by the completed inspections. In particular, a route search initially failing to find a path was treated as a search limitation, not proof that a map needed redesign. Winding return paths, waits and alternate approaches found valid wins without changing the authored levels.

The archive contains compact `[direction, ticks]` commands, effective level fingerprints, options, completion time, coverage, denominator and final authoritative checkpoint. Enemies, damage and erosion remain active. Speculative captures only rank search candidates; they never enter the recorded replay. The final denominator must remain constant and the route must win without losing a life. The recorded times are simulated game time, not route-search duration or predicted human completion time.

## Reproduce the checks

From the repository root, with its ordinary Node dependencies installed:

```sh
node scripts/audit-neon-delivery.mjs
node scripts/refresh-classic-artwork.mjs --check
node scripts/generate-current-art.mjs
node scripts/game-cli.mjs build
node scripts/audit-neon-build.mjs dist
```

The delivery audit needs the PR #1003 merge commit `dcdad7f7b8c05c20e192564a981c8f9448460653` available locally for the historical catalog comparison. Generated inventory reports identify their source revision. `build-delivery.json` describes the exact distribution fingerprint recorded there; a null build revision means a local candidate build, not a published release.

Replay the checked-in commands without searching for new routes:

```sh
for difficulty in standard gentle; do
  for steering in grid-center immediate; do
    node scripts/qualify-neon-routes.mjs \
      --receipts=docs/qualification/neon-level-completion/winning-routes.json \
      --output=/tmp/neon-route-verification \
      --difficulty="$difficulty" --steering="$steering" --resume --replay-only || exit 1
  done
done
```

Every supplied receipt is replayed; `--resume` does not trust an existing success flag. Level/options drift invalidates reuse, a changed checkpoint fails, and an incomplete route gives a nonzero exit. To search after an intentional gameplay change, omit `--receipts` and `--replay-only`, use a new output directory, and optionally filter with `--pack=neon-reference-pack` or `--level=spirals`. A search failure alone does not prove impossibility.

## Remaining acceptance and plan status

| Plan item | Status | Exact next acceptance |
|---|---|---|
| R1 — review galleries and links | Implemented; local build and source browser checked | After merge/publication, confirm both Pages galleries load and a fresh authorized profile opens the selected current mission. |
| R2 — complete playable wins | Complete for the documented 216-run matrix | Human play/balance and broader seed/class/device sampling are explicitly outside these deterministic receipts. |
| R3 — fidelity, symbols and pictures | Static review complete; in-game acceptance pending | Inspect partial reveals, completed reward crops and actor/trail contrast for all 77 paintings through the normal game UI. |
| R4 — creator workflow | Existing implementation reviewed; browser round trip pending | Text and opaque/transparent/inverted image → preview → Apply → edit → play → export → re-import; compare geometry, enemies and reveal art. Exercise Undo, invalid/oversized files, delayed decoding, edits during import and Cyrillic text. |
| R5 — sharing and discovery | Exact links and gallery discovery improved; browser matrix pending | Copy/fallback, refresh, retry/Next, fresh recipient, base/Neon/optional packs and unavailable/retired identity handling. The normal Journey remains separate from the Classic mission catalog. |
| R6 — offline upgrades and preservation | Repeatable inventory and build descriptors checked; installed-profile acceptance pending | Install each pack online, restart offline, interrupt retrieval, update an older installed profile, resume saves and confirm custom art/progress survives. Never clear a user's existing profile to make a check pass. |
| R7 — route variety | No evidence-backed geometry correction identified | Human route-variety review can flag specific repeated decisions; unique hashes and a winning bot route are not a substitute. |
| R8 — optional/deferred work | Deferred as agreed | No unit-test expansion, Ukrainian translation, new level batch or hosted custom-level publishing in this follow-up. |

The browser's ordinary password unlock is required for the pending in-game, creator and installed-profile checks. It was requested from the user; no credential or authenticated session was supplied during this pass. The gate was not disabled, bypassed or simulated. These items remain open rather than being described as completed.

After this PR is merged, verify the Pages release marker contains the merged changes before reporting the gallery URLs as live. The inventory and visual ledger contain exact public play URLs for review; those URLs are not a claim of completed recipient acceptance.
