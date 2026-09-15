# Incoming v0.56 source review

Read-only comparison of P00 `acc9f265b651017fd268ffd8bbe6989bec614c41` with open PR #51 candidate `20f017963e6f3875ce6388a198a6fb601e0aea40`, observed 2026-09-15. This candidate is separate from frozen v0.55. Its source findings do not establish release, browser or physical-device acceptance. Repeat the comparison against the version actually integrated before P01.

## Preserve and refresh before P01

- **Library/data A21–A25:** retain the new five-file backup operation's busy/cancel ownership and native download links. Add a dedicated inventory row. Initial metadata/game reads precede the first progress announcement; final coverage hashing and consistency rereads retain the music-phase copy. Label these real stages without releasing ownership while cancelled reads remain pending.
- **Music Studio A37:** retain first-open focus restoration after immediate/delayed loading blur, including guards for deliberate subsequent focus, hidden/disposed/closed dialogs and cached reopening. Existing cancellation waits remain relevant.
- **Team A47:** refresh selectors for lobby/pause disclosures and Auto/Show/Hide touch controls. Preserve explicit Resume, ordered Back handling, held-input clearing and controller-seat visibility. Pack import still awaits `file.text()` before an initial status; its request/run/disposal fences remain authoritative.
- **Additional authoring row:** inventory the source-only reserve illustration catalogue's manifest and selected-image loading, including its `imageRequest` guard. It is distinct from Asset Studio and published mission artwork.

The candidate source adopts shared Team fonts/tokens/components, 44-pixel direction targets, short-landscape control gutters and a scrollable fixed pause panel. These overlap P03/P05/P08-A layout acceptance and require actual browser checks after integration. The Team painter, map artwork resolver and presentation bindings remain unchanged, so these changes do not complete map presentation parity.

Boot, Deploy, Continue, theme loading, Asset Studio, Versus preparation, offline, recovery, replay and local media opening retain their P00 inventory findings. No P01 implementation or test run accompanied this review.
