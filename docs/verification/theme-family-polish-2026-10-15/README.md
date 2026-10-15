# R7 shared material review — 15 October 2026

Base: `fab00f38a0aa72f6afb5e1b7a4283799c842538f` (`main`).

## Changes reviewed

- Vyshyvanka retains scarlet, black and ivory. Its original over/under weave now varies yarn length and sparse highlights across a 48-pixel repeat. Lower-amplitude shading keeps large selected cards from becoming a regular checker. Embroidery remains at panel seams.
- Dnipro Porcelain now uses a dedicated original glaze tile with sparse paired mineral inclusions and catchlights. Paper fibers remain exclusive to Sakura's satin recipe. Existing cobalt rims, edge light and pressed relief remain intact.
- These are shared renderer material recipes. Game controls, picker previews, Theme Studio specimens and the embedded SIM interface consume the same sheet. Immutable theme document revisions, palettes, nine-slice frames, arcade/SIM assets and simulation inputs are unchanged.
- The review fixture refreshes diagnostics on `transitionend` and `transitioncancel`, and displays failed check names/expected/actual paint. Previously a snapshot taken during a family switch could leave a stale loading-rail failure onscreen after the controls had settled.

## Evidence

- [Theme tests](theme-tests.tap): 90/90 passing.
- [SIM appearance and explicit World UI/editor tests](sim-tests.tap): 61/61 passing.
- [Safari native-control results](browser-checks.json): all 18 installed families passed the existing action and field semantic oracles after switching. These inspect disabled/selected/destructive pairing, validation and focus boundaries, and loading rails; they are not an exhaustive screenshot comparison of every control/state.
- [Material preservation](material-preservation.json): all nine unaffected grain tiles remain byte-identical. Only the textile tile changed; one glaze tile was added. Shared CSS grew by 3,238 bytes. Steel recipes were not edited.
- Generated grain check, embedded SIM stylesheet check, changed-module ESLint, Prettier and `git diff --check` passed.
- [Vyshyvanka native-size close-up](vyshyvanka-native.jpg), [decoration Off](vyshyvanka-off.jpg), and [high contrast + reduced motion + large text](vyshyvanka-accessibility.jpg).
- [Dnipro native-size close-up](dnipro-native.jpg) and [high contrast + reduced motion + large text](dnipro-accessibility.jpg). Dnipro decoration Off also passed the rendered semantic checks.

Screenshots are resized JPEG review copies of native Safari Technology Preview captures. Player controls, compact Studio controls and tall cards were inspected in the runtime fixture. No saved player preferences were changed. This is desktop WebKit evidence, not physical touch/controller, every-screen, least-contrasting-pixel, SIM route/performance or full package/release qualification.

The initial source test attempts encountered modules intentionally omitted by the disk-saving sparse checkout; the required content and authoring fixtures were restored before the successful runs retained here. Browser cache also briefly mixed source revisions; the retained checks followed Reload Page From Origin. The transition diagnostic fix was separately reproduced while switching Ember Foundry to Polar Relay.

## Design basis

[Factorio's GUI tileset article](https://www.factorio.com/blog/post/fff-243) demonstrates reviewing reusable widgets together at different sizes and refining contrast/typography as a system. This review applies that method to original material recipes; no Factorio artwork is included. Texture identity is separated from interaction relief, and accessibility overrides remain the final presentation layer.

See the [current priority register](../../theme-priority-progress-2026-10-15.md) for what this evidence closes and what remains.
