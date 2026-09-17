# Production / Viewport integration requirements

**Result: retain the existing production ledger, compiled derivatives and both history indexes unchanged.** The seven supporting-tool runtime changes do not alter any of their declared inputs. This is a read-only contract review, not an executed reproduction/build result.

## Why no regeneration is required

- `scripts/produce-field-kit-theme.mjs:24–32` lists the finite UI, screens, motion, effects and audio recipe inputs; none is one of the seven changed paths. `:95–100` hashes only those named recipe bytes. The new helper consumes `game/display-preferences.mjs` without changing it; the HTML consumes existing Field Kit styles without changing them.
- `authoring/production/sources.mjs:109–112` restricts source history to `authoring/motion-lab/render-character.mjs` and `game/ui/actor-presentation.mjs`. Neither changes. All four production registers and the metadata/source history indexes were inspected as exact Git bytes; none references any changed tool path. Do not append snapshots for unrelated HTML/CSS/host modules or rewrite historical approval data.
- `scripts/presentation-production-history.mjs:15–17,31–35,62–66` preserves an unchanged accepted ledger and creates revisions only for changed content/quality/tokens. `scripts/produce-field-kit-theme.mjs:310–335,367–375` distinguishes read-only `--check` from the ledger/derivative writer. Running `--write` here would add no justified production content.

## Required release preparation

1. Include the seven runtime paths, their complete affected tests, the two separately scoped P03 regression candidates, related documentation and actual native evidence. Preserve the seven path identities recorded in `review.json`.
2. Run the existing final-source gates. The workflow explicitly retains `node scripts/produce-field-kit-theme.mjs --check` and `node scripts/check-field-kit-readiness.mjs` (`.github/workflows/qualify-release-source.yml:75–80`). A static no-input-change finding is not a pass for those commands.
3. The readiness command validates the committed ledger and rejects a local ledger differing from HEAD (`scripts/check-field-kit-readiness.mjs:47–70`). Its `declarationOnly` result (`:35–43`) is not fresh visual approval. Do not regenerate the ledger merely to bind a new game version.
4. Keep the ordinary build, immutable release, publication and actual public gates. The generated build manifests/offline inventory belong to the ordinary build; no additional committed presentation derivative update follows from this correction.

## Public scope boundary

`game/build-config.json` currently includes `game`, `site` and explicitly selected authoring paths, but not `authoring/production`, `authoring/viewport-lab` or `authoring/shared`. `scripts/game-cli.mjs:189–200` copies only that include set, excluding `game/test`. Therefore none of these seven runtime files ships in the current public site. Their corrected authoring routes are local/source tools; do not invent a deployed tool URL or claim the Pages game visibly changed from them. Publishing those tools later would be a separate deliberate include/dependency/privacy-size review, not a prerequisite for this source correction.

## Review limits

No source/index/ledger changes, network, compiler, build or test execution occurred. The parent’s native observations and final-source qualification remain separate evidence. This report is bound to HEAD `c7c4ed747636e66c0319a1843140c39fc6d4b38d`; new version fields do not themselves change the finite compiler inputs above.
