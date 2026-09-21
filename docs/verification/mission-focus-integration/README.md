# Mission focus integration

The completed-card selector now preserves its connected selected card before an explicit Deploy. The capture listener remembers the card before host reconstruction; a matching bubbling listener restores through the existing revocable focus lease afterward.

Independent checks on the handheld source pass 81 tests each on Node 20.19.5 and 22.22.2, including controller A selection, D-pad traversal, A launch, handoff and replacement. The unchanged gallery reproduces the nested-click focus failure. Original logs and the sparse missing-entry setup error are retained as exact text with hashes. All actual source reads were reconciled before the version-only bump.

The separately retained browser evidence uses accepted595 plus the exact corrected gallery, not the later versioned build. Physical Deck/iPhone and final public acceptance remain open.
