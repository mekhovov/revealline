# Narrow HUD layout

At portrait widths up to 320 CSS pixels, Solo gives Coverage and Score complete
rows while Lives and Time use their intrinsic widths in the existing DOM order.
They share a row when both fit and wrap when a longer value needs more room. At
Versus widths from its documented 280-pixel minimum through 320 pixels, Pause
uses the first row and the series score and clock share the next. The parent
grid has a zero-minimum track so HUD content cannot enlarge both fitted arenas.

Keep Large text, complete numeric values and their glyphs, and the existing
44-pixel control targets. Reflow the HUD instead of cropping content, reducing
font sizes or changing canvas, simulation, collision, score or save behavior.
The HUD's actual height remains in layout. Solo's portrait arena follows it in
normal CSS flow, with the existing aspect-ratio and viewport constraints;
Versus uses its existing observed board fitter. Solo has no telemetry resize
observer. Wider and short-landscape Solo rules remain separate.

The retained regression targets are Solo viewport/document widths 280/285 and
266/277, and Versus 280/290 with Large text. Native verification must measure
document width and complete label/value/glyph bounds at 266, 280 and 320 pixels
for Solo and at 280 and 320 for Versus, then resize away and back. Include
Standard/Large and Theme/Plain, longer scores, timer/lives changes, Pause and
Results, visible focus outlines, and each Versus touch-control combination.
Check full arena containment/aspect, at least 44-pixel controls, and preserved
paused run, picture and input intent. Finite host tests supply layout rectangles;
they do not establish CSS fit, physical-device or whole-mode acceptance.

Authoring example: "Keep the current Large font and score glyph. Reflow the
narrow HUD, verify the full numeric value and focus outline in the real browser,
then rotate and return without restarting the paused attempt or replacing its
picture. Retain the original overflow and separate native results from modeled
host checks."

## Keyboard Pause focus

Solo Pause can sit two or four pixels from a viewport edge. Its native
`:focus-visible` outline now sits inside the existing 44-pixel button, with an
inset dark halo. This changes only the indicator; target size, arena geometry,
focus ownership, simulation and input behavior stay unchanged. The matching
`.controller-focus` selector is defensive styling. Current Solo controller menu
navigation excludes Pause and uses its gameplay pause command; this does not
add or qualify controller focus reachability.

## Retained local checks and remaining gates

The local HUD matrix covers 20 intended combinations: Solo at 266/280/320 pixels
and Versus at 280/320 pixels, with Standard/Large and Theme/Plain text. Examined
labels and complete displayed values fit without document-width overflow, and
ordinary settings/resize journeys retained the visible local attempts. The two
initial Versus Standard/Theme captures used the wrong measurement target; they
remain excluded, with corrected captures retained. The original Solo Pause
outline failure is also preserved.

The focused successor has ten native keyboard Pause checks across narrow
portrait, 844×390 landscape and portrait return. Its cyan ring and inset halo
remain inside the existing target. Settings setup used pointer input, so this
is not a complete keyboard-only settings journey. These checks add rendered
focus evidence; existing finite fitter/preference tests do not prove CSS fit.
The retained local host cohorts have 35 distinct passes on each Node version,
with their earlier missing-fixture refusals kept separately.

The later numeric fixtures exposed two failures in that frozen candidate:
Large `120:00` exceeded the Solo Time field at 266/280 pixels, and the raw
floating-point score `0.30000000000000004` overflowed at 320 pixels. Keep those
failures and the earlier four-path candidate immutable. They are static
formatter specimens, not earned scores or a maximum achievable run.

## Numeric successor

Solo's score label now uses the same maximum three fractional digits as the
existing result display, with grouping disabled for the compact HUD. Only raw
integer scores retain five-character zero-padding; fractions are not padded.
For example, `0.30000000000000004` displays as `0.3`, while `42` stays `00042`.
Close fractional raw scores can share a label, as they already can in results.
The raw score, replay, stored run and ranking remain unchanged. The timer still
uses floored, uncapped `m:ss`; it is not rounded, truncated or given a smaller
font. Intrinsic wrapping replaces the equal-width Lives/Time columns.

Focused tests exercise integer boundaries and fractional rounding, then close
a real six-cell cut through ordinary input with a validated `0.1` points rule.
The actual host displays `0.6` while the saved replay reconstructs the original
`0.6000000000000001` score. A paused redraw preserves its checkpoint and stored
bytes. These tests do not measure CSS or establish a native numeric fit.

Repeat the actual browser numeric specimens in Large Theme/Plain at Solo
266/280/320 pixels, including `120:00`, `1000000000` and the fractional label,
then return through short landscape. Confirm complete labels/values, unchanged
font size and Pause focus, no document overflow and full arena containment.
Change the timer from a short label to `120:00` and back after the actual host
is ready, measuring the arena below the growing HUD as well as startup layout.
The static HUD-only specimen cannot establish that host-level containment gate.
The scoped native successor passed Large Theme/Plain numeric specimens at
266/280/320 pixels: `120:00`, `1000000000`, nine lives and the compact fractional
label fit at unchanged font sizes. Six post-readiness short → long → short
cycles redistributed Lives/Time widths while HUD height stayed 239.875 pixels;
no additional row was needed in those specimens. Complete arena shells stayed
contained. These were disposable markup fixtures without Phaser or simulation,
not earned gameplay. Their shell was 4:3; the one-pixel border made the inner
canvas ratio slightly different, so this is not exact bitmap-aspect proof.
Root reviewed the pinned 17-file native packet and two selected images.

Final-source gameplay with the actor-size successor remains to be qualified.
Versus retains its separate 280-pixel minimum; this successor changes neither
its score labels nor that limit. Physical controller/touch, safe areas, maximum
zoom, full playthroughs, Team composition, offline behavior, integrated-source
qualification and public release remain separate gates. Do not turn finite
specimens into a universal maximum-value claim.
