# Older chapters: native menu acceptance

Source `4ffabee2174b051c2b131fe8d2ecc84f6c4b8ad5` groups the four original First Light editions behind an initially closed **Older chapters** disclosure. They keep their original campaign identities, rules and saves. Nine current chapters remain in the main list.

Actual keyboard testing at 1280×720 reached the disclosure through nine normal Tab presses, opened it with Enter and selected R4 through Tab/Enter. A real R4 flight was paused, then Missions reopened the current older chapter and focused its card. Closing the disclosure removed its cards from Tab navigation; Escape returned to the paused game. Reload/Continue preserved the saved flight and its selected chapter. Standard and Large text were checked through the actual settings control.

The first native review found two independent tall lists made the dialog excessively long and scrolled mission choices out of view. The corrected desktop layout uses one bounded scroll container around the chapter section. Both Standard and Large now retain the mission column alongside the current chapter. The summary measured 53px high at 22px Large text. Initial and corrected screenshots remain recorded; the Standard settling-scroll screenshot is distinct from the settled focus measurement.

Source qualification has 51 affected Node22 and 8 focused Node20 passing tests, plus an independently reviewed CSS-only correction. Mobile CSS below 800px is unchanged; this is not a new compact viewport or physical touch/controller certification. Broader menu/device qualification remains P1.14/P7.

Native receipt: `.cache/round46/older-chapters-native/receipt.json`, SHA-256 `69ac723186e295ff63f78a5c1abdf4b0687585cc707fd1d3614789fc4c81e652`. The source handoff links the original checks, CSS correction and independent review. This is successor source awaiting the next frozen/public release.
