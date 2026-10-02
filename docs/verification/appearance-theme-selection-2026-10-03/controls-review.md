# Immediate theme selection — focused control checks

Date: 2026-10-03. Scope: shared appearance cards and native selector, actual Solo/Team/Versus Settings behavior, curated family previews, and atomic presentation loading. This is source/handler evidence; actual browser review and the final combined source cohort are recorded separately.

The dropdown and gallery now consume one read-only host inventory. Both contain Follow campaign/community, Classic Field Kit, all installed families and the host's curated community families. Names match across both representations. Custom names retain their exact revision. The Follow card previews the context's interface even when the user's personal choice differs; curated cards use their actual interface colors. This API does not write preferences or prepare resources.

Changing the native selector or activating a card immediately calls the existing complete-theme action. There is no Apply control. The existing host still prepares resources and rejects superseded loads before replacing the accepted presentation. Selection keeps accessibility preferences; the existing complete-choice action resets optional per-part customizations. Rendering and browsing choices do not write preferences. No simulation, renderer freeze, replay, course or progress behavior is changed.

Card/button and select/option nodes are reconciled by family identity. Ordinary preference, loading, status and accessibility updates retain their DOM identity and focus. Versus controller navigation recognizes semantic theme cards instead of a fixed list of eight IDs, so Follow, Classic Field Kit, new built-ins and curated cards use the same activation path. Native select editing still permits cancellation before committing that native control; committing it requires no second Apply step.

`controls-focused.tap` records **32/32 passing tests**, with no skips, using Node 20.19.5 and serial execution of:

- `game/test/unified-appearance.test.mjs`
- `game/test/theme-family-host.test.mjs`
- `game/test/menu-style-host.test.mjs`
- `game/test/curated-community-theme-host.test.mjs`

New/revised checks exercise immediate card and selector persistence; equal inventories/names; exact curated and Follow colors; retained focused DOM nodes; latest-wins asynchronous preparation; a failed load retaining the accepted presentation with retry recovery; controller Follow/Classic activation; paused Solo/Team/Versus checkpoint preservation; unchanged painter commands, authored media and unrelated storage; and all installed Arcade variants plus retained historical assets. Targeted ESLint, Prettier and `git diff --check` also passed.

The complete display/input/environment acceptance matrix, physical controller testing and visual quality of new artwork are outside this focused result. Additional families and locale/catalog updates were developed concurrently and receive the parent's final combined validation.

## Selector parity follow-up

The first 32-test receipt predates a further compatibility correction. Current Classic Field Kit (`legacy@r2`) now applies its declared semantic palette, shared typography and component styling even if an old hidden UI-skin preference remains in storage. The same rule is implemented in the generated first-paint template. Exact pinned `legacy@r1` retains its old styling adapter. No preference migration writes or retained-document mutations were added.

SIM now offers Classic Field Kit explicitly as an interface choice. The separate Authored option still resolves the retained r1 adapter; no Classic world collection is advertised because none exists. Interface-only selections preserve the resolved world and do not request an appearance switch for an armed session. Asset Studio chrome uses the host's admitted inventory, including curated custom themes with exact revision labels, without applying an authoring action to the workspace. Its authored-basis and specimen selectors retain their separate document-preview responsibilities.

`selector-parity.tap` records **45/45 passing tests**, no skips, on the follow-up source using Node 20.19.5 and serial execution of unified appearance, theme system, SIM family controls and Studio appearance basis suites. New behavior checks compare preview tokens with actual applied variables under both old menu palettes, preserve pinned r1, exercise SIM's explicit Classic/Authored/Follow paths, and apply a curated Studio chrome choice while retaining focus and workspace content. Targeted ESLint, Prettier and diff checks passed. The parent owns generated-artifact refresh, cold-bootstrap verification and final combined validation.
