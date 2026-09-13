# Dawn Signal — original story candidate

A small craft returns to a coastal signal station at dawn, descends and settles on its wooden landing platform. This is one **silent, eight-second source candidate**, held for the future complete story integration. It has no runtime registration, still identity, earned receipt or published delivery claim.

The unchanged [generated illustration](illustration-original.png) is 1672 × 941. Its [exact generation request](tool-requests.json) and [readable prompt](illustration-prompt.txt) are separate from the original [procedural animation source](animate.swift). The craft, small water glints and lantern motion were authored in Swift, not generated as video. The full illustration is contained with nearest sampling in the 640 × 360 movie; H.264 compression changes the resulting decoded pixels. The raw illustration remains intact.

## Reviewable candidate

- [Silent H.264 MP4](candidate-v1/dawn-signal.mp4): 640 × 360, 12 fps, 96 frames, 8 seconds, 713,732 bytes. SHA-256 `d643a6ebbf92b93dc57a0cfe65ca4bcf484ceecd8ed632ed6476707ec720e85a`.
- [Exact decoded poster](candidate-v1/poster.png): 640 × 360, 422,581 bytes. SHA-256 `71fad383778452f730bb9278858acb86aeba275e2a5d3c9e050c221603e02707`. Native request **4.0 seconds**, observed frame timestamp **4.0 seconds**.
- Actual decoded review frames at [0 seconds](candidate-v1/frame-00.png), [2 seconds](candidate-v1/frame-24.png), [6 seconds](candidate-v1/frame-72.png) and [95/12 seconds](candidate-v1/frame-95.png).
- [Native inspection](candidate-v1/native-inspection.json) records every decoded sample timestamp/pixel hash and each PNG's requested versus observed time. [Provenance](provenance.json) records source hashes, exact tool output, processing and limits.

All five decoded PNGs and the original illustration were visually inspected. The scene retains the detailed navy/teal/amber pixel style; the small craft remains distinct against sky and settles beside the lit cottage. These are static frame observations plus actual native full-video decoding, not browser playback, phone contrast, physical-controller or codec portability approval. The movie has **zero audio tracks** and counts toward **no finished soundtrack**.

## Reproduce without replacing accepted bytes

On macOS with Xcode command-line tools, create the parent output directory first, then choose a new output directory:

```sh
mkdir -p .cache/dawn-signal
xcrun swift authoring/library/dawn-signal-story/animate.swift \
  authoring/library/dawn-signal-story/illustration-original.png \
  .cache/dawn-signal/a-new-generation
```

The source refuses an already existing destination. It does not claim a filesystem sandbox: choose a trusted output path. Frame-index motion is deterministic, while encoder and PNG bytes may vary across native SDKs. Never overwrite the accepted outputs to assert byte reproducibility. The initial successful generation and its two deprecated blocking-wait warnings remain in the worktree cache; the second generation completed without those warnings and produced the same five decoded PNGs.

## Integration boundary

Proposed segment: **0 ≤ time < 8 seconds**. The final actual sample begins at 95/12 seconds; duration is not a promise of a frame beginning at 8. No browser `currentTime` or requestVideoFrameCallback observation is claimed here.

First save the exact poster through the real still workflow, retain its full authored identity/presentation revision/asset hash, then prepare and bind the original MP4 through the reviewed story API. The content metadata deliberately has `runtimeBinding: null`; it must not be used as a fabricated runtime descriptor or assigned by map name. An earned story still requires the coordinated versioned session/first-earned authority, explicit Play/Skip/Replay, music restoration and real backup/offline acceptance described by the [story authoring guide](../../../docs/story-workshop-authoring.md).

No runtime, build, catalog, storage, host, version or release file is changed. This is one generated illustration, one original procedural animation and a derived poster. Provenance records how the source was made; it does not independently certify copyright clearance or exclusive rights.

The root visual review accepted the actual frames at 0, 4 and 95/12 seconds as source content. For the eventual demo's earned still, it recommends the **existing final-frame PNG** [frame-95.png](candidate-v1/frame-95.png): native requested and observed time **95/12 seconds (7.916666666666667)**, 442,522 bytes, SHA-256 `7f851f9806a1be994b2279f3d1acc4f2f39884ac6cf2fdf6b8a7813e61c73745`. This lets playback return to the same landing scene. It is an alternate proposed binding, not a newly captured image or an existing award; the original 4-second `poster.png` remains unchanged as acquisition evidence.
