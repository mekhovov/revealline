# Current edition landing matrix

The actual default-package edition routes passed **112 rendered browser checks** at source `c0a8757501ed84d85e8f8054d3d351a6fd557f01`: all 14 editions, English/Ukrainian, Neon Arcade/FPV Field Kit, and 390×844 portrait/844×390 landscape. Each of the 112 combinations passed all 13 assertions. The compact [receipt](edition-menu-matrix-2026-09-29.json) records the routes, source hashes and checked properties.

`game/test/manual/edition-menu-matrix.html` loads real player pages in a sized iframe. It waits for the selected edition and image decoding, then for fonts and two rendered frames. Measurements check the exact edition title and scene, locale and palette, Solo-only capabilities, four main actions, fullscreen availability, registered action icons, minimum 44px control heights, essential control bounds, normal word wrapping and absence of horizontal overflow. This is production host DOM/CSS, not cloned landing markup.

The browser was the Codex in-app browser at the dedicated `http://127.0.0.1:8984` test origin. The run used standard Theme text and reduced effects, so artwork decoding is established here; animation is qualified separately. Only three test-origin preference records are temporarily configured; original values are restored in `finally`, and the iframe is unloaded. No Start, Continue, mission selection or save-management actions were invoked.

These checks establish rendered control bounds and icon registration. They do not compare icon shapes or inspect every label’s inner text bounds. This qualifies the current default-package edition landing layout measurements. It does **not** qualify keyboard/controller-only journeys, fullscreen activation inside every platform, true 200% browser zoom, installed offline launchers, native builds, physical controllers or published bytes. Those remain separate plan gates.

Reproduce with the source server on a dedicated origin, open `/game/test/manual/edition-menu-matrix.html`, and choose **Run edition matrix**. The fixture is excluded from player packaging.
