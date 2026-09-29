# Narrow HUD layout

At portrait widths up to 320 CSS pixels, Solo gives Coverage and Score complete
rows while Lives and Time share equal columns in their existing DOM order. At
Versus widths from its documented 280-pixel minimum through 320 pixels, Pause
uses the first row and the series score and clock share the next. The parent
grid has a zero-minimum track so HUD content cannot enlarge both fitted arenas.

Keep Large text, complete numeric values and their glyphs, and the existing
44-pixel control targets. Reflow the HUD instead of cropping content, reducing
font sizes or changing canvas, simulation, collision, score or save behavior.
The HUD's actual height remains in layout; the existing arena fitter owns the
remaining space and full-picture aspect ratio. Wider and short-landscape Solo
rules remain separate.

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

Maximum-value score/time fixtures remain pending. The observed Versus exterior
halo, physical controller/touch, safe areas, maximum zoom, full playthroughs,
Team composition, offline behavior, integrated-source qualification and public
release remain separate gates. Preserve all stale or failed captures and their
corrections; do not turn ordinary visible values into a maximum-value claim.
