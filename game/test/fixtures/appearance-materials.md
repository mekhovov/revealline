# Runtime material checks

`appearance-materials.html` is a test-only page. Serve it with the repository's
usual local static server (or explicitly copy these fixture files into a review
build). It imports the production resolver and stylesheet, stores no preferences,
and renders native controls without inline paint.

Choose the inner theme, optional enclosing theme, state, decoration, contrast,
text size, and motion settings. Hover the normal sample or its blank twin to test
an actual pointer state. The forced hover/pressed rows use the same production
selectors and are useful for stable screenshots; they are not evidence of native
pointer input. Check keyboard focus independently.

Choose **Material close-up · native sizes** to inspect a compact flight panel,
recessed field, Creator inspector and tall mission cards. Player controls use
44px targets; fine-pointer Studio controls use 32px targets. Large text and coarse
pointers expand the Studio targets through the production resolver. The fixture
only supplies layout; colors, materials, state treatment and target tokens come
from the runtime. Capture this composition as **PNG at native viewport scale**
(and repeat at device scale 2) to review grain, repeated patterns and edge detail.
The `closeUp` measurement field records the actual rendered sizes and paint.
Keep close-up captures in a separate directory from the 19-pair contrast captures;
the close-up composition has no blank twins and is for native-scale visual review.

The state rows remain the same 19 matched pairs. `semantics` in the measurement
JSON separately checks the actual computed selected-disabled and danger-pressed
paint, including both blank twins. Selected-disabled must use the disabled panel
and muted text with no material frame, finish or shadow. Pressed danger must retain
the hazard/on-hazard pair with no amber frame. The visible semantic status reports
failures even when a different row or the close-up composition is selected. System
forced colors and the retained legacy adapter explicitly skip token-color checks.
Check `semantics.status === 'passed'` separately from the pixel contrast report;
a readable but semantically incorrect color is still a regression.

Each row has a labeled control and an equal-size blank twin. The twin keeps the
same foreground color, background, role, and state; its label is hidden only to
avoid sampling antialiased text as background. `#specimen-measurements` contains
computed paint and both viewport/document reading rectangles. Capture it together
with a **full-page screenshot** after fonts and the requested state have settled.
Save both with the same base filename in an otherwise empty capture directory.

Run the captured-pixel check:

```sh
python3 game/test/fixtures/sample-appearance-contrast.py /tmp/captures \
  --output /tmp/captured-contrast.json
```

The sampler identifies the actual image encoding, regardless of extension. PNG
uses Python's standard library. JPEG uses macOS `sips` only to decode a temporary
PNG for pixel access; originals are never modified. The temporary file is deleted.
JPEG results are explicitly marked lossy, and passing requires a 0.2 margin over
4.5 normal, 3 disabled, or 7 high-contrast. The margin is a practical safeguard,
not a bound on every possible JPEG compression error. The report measures captured
pixels, not lossless renderer output. It checks every unique background RGB value
inside each reading rectangle and records the least contrasting value/location.

The script skips unrelated JSON files without matching images or sample metadata.
An unsupported encoding, alpha, foreground syntax, or out-of-image crop fails
rather than silently claiming coverage. A nonzero exit means a contrast failure,
a narrow JPEG margin, a decoding/metadata error, or no usable captures.

Include the theme, muted panel helper, selected/hover/pressed combinations,
primary/danger controls, disabled combinations, and native input. Foreground
metadata reads the actual label color, including the muted helper's semantic tone.
Also exercise Industrial inside DOS, DOS inside
Industrial, decorative Off, high contrast, reduced motion, and forced colors where
the browser/OS supports them. These checks complement the Node tests: declaration
and token assertions alone cannot establish contrast after texture compositing.
