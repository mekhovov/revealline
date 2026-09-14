# Text presentation and saved preferences

The current solo game offers **Theme font** and **Plain** in Display & accessibility.
Theme font retains the selected presentation's display, interface and numeric
faces. The current Field Kit uses Handjet accents, Exo 2 interface text and IBM
Plex Mono counters. Plain uses ordinary platform text and monospace counters.
Text size is independent of this choice.

The saved value `pixel` is retained for compatibility and means Theme font. Do not
rename stored records or replace a historical font choice with an old asset just
because this value says `pixel`. Existing profiles that omit `textFace` acquire the
default in memory; reading a profile does not rewrite its raw stored document.
Malformed explicit values still fail the ordinary preference validator.

## Presentation boundaries

- Apply the validated preference to `body.dataset.textFace` in the solo host.
- The Plain CSS rule overrides all three Field Kit font roles, including the
  release host's inline tokens. The legacy `--pixel-font` remains an adapter.
- Pass the preference to `BoardPainter.draw`; `canvasTextFonts` supplies the same
  UI/numeric distinction to painted warnings, pickups and recovery feedback.
- Switching back to Theme font removes the CSS override and uses the accepted
  presentation snapshot's fonts. Do not mutate its immutable theme record.
- Text changes never modify a run, its geometry, pending direction, queued turn,
  fixed-tick commands, replay hash or saved flight. Opening Settings pauses and
  only explicit Resume continues movement.
- This preference belongs to the current solo shell. Separate Workshop pages,
  historical releases and native OS dialogs retain their own presentation. Do
  not claim those surfaces inherit this setting without implementing and testing
  their host lifecycle.

## Verification and further work

Preference and host tests cover old omitted fields, invalid values, save/backup
round trips, unavailable storage and a paused unfinished cut in both turn modes.
Canvas integration must retain theme fonts by default and select platform fonts
for Plain without changing simulation state. Visual qualification must inspect
both choices and both text sizes on title, briefings, Settings, Collection,
results and recovery, including portrait and short landscape. A computed CSS rule
or an automated test alone does not establish legibility or physical-device
support.

Keep the semantic font roles when adding new themes. Avoid rasterizing menu text
into backgrounds: translations, text sizing and the Plain option need actual text.
The [Xbox navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112)
supports predictable digital navigation and preserving access when a layout
reflows. Its [input guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/107)
also covers complete keyboard journeys and alternatives to prolonged holds.
These are design references, not a claim of full guideline compliance.
