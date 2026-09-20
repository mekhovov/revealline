# Pending replacement keeps Stay focused

Public v0.69.1 reproduced a transient focus loss after keyboard Replace & play: disabling the focused confirmation moved focus to the page while Stay remained available. The correction transfers focus to Stay synchronously before disabling Confirm, only when Confirm still owns focus and the document is visible and focused. It does not change mission, save, installation or resume logic.

The original failing regression is retained in `before.log`. The complete affected file passes 25/25 on Node20.19.5 in `after.log`, including actual run/checkpoint and save preservation. The browser check used exact base9050e566 plus the pinned app override. A deliberate five-second local chapter-response delay made the pending state observable: Stay was the enabled focused action. Normal completion returned to the chapter chooser without starting a flight. A later Enter arrived after completion and is not claimed as native cancellation evidence.

This extends the unpublished v0.69.3 focus correction. Earlier9050e566 qualification (7,015tests) remains its own source evidence; it does not qualify this successor. Final integration, full source gates and public checks remain required. See `native.json` for exact runtime pins and limitations.
