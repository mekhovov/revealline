# FPV Flight Studio

This optional civilian practice package is separate from the arcade engine and the earlier `civilian-flight` gym. It presents the shared 50 Hz integer/quaternion model through a procedural Three.js scene. It is a simplified fictional teaching model, not a particular aircraft, configuration guide or qualification for real flight.

The twelve authored drills have separate self-level and Acro criteria. Both use manual throttle. Self-level requests a tilt and returns toward level with centred pitch/roll. Acro requests an angular rate; centring the sticks retains orientation. Neither mode holds position or altitude. The rendered millimetre positions, orientations, bounds, obstacles and goal volumes come from the exact course/model; light gates are criteria rather than additional solid obstacles.

## Play, observe and review

Choose a drill, input source and mode, then explicitly arm. The default first-person view can switch to chase or overview. Camera field of view and camera tilt affect presentation only. The active volume or directional gate is highlighted, and the coaching line displays the ordered criterion, dwell and applicable speed/tilt/heading limits. Hold progress resets if the model's criteria are no longer satisfied. Contact count and live throttle are visible.

**Watch example** uses an exact replay-verified demonstration. **Review your flight** replays recorded normalized inputs against their original model, course, mode and response. A displayed route is a sampled visualization of that replay. Neither observation path records practice completion. **Try this drill** creates a fresh practice attempt. Completion callbacks contain the original practice transcript and independently recomputed outcome; the notebook owns persistence and rewards separately.

Replay admission yields through the shared verifier at least every 200 model ticks. Closing a dialog, pausing, changing the drill/input source or disposing the app cancels pending reading and verification before playback can start. Live wins use the notebook's cooperative verification once; Next and Retry remain available while the exact completed proof is accepted independently of the next run.

Keyboard controls:

- W / S: pitch forward / back; A / D: roll left / right.
- Q / E: yaw left / right.
- Up / Down: increase / decrease manual throttle. Releasing these keys holds the current throttle value.
- Shift: smaller adjustments; P: pause.

Touch uses a clearly labelled Mode 2 diagram: yaw/throttle on the left, roll/pitch on the right. Release centres pitch, roll and yaw while preserving the selected throttle. The separate throttle slider is keyboard accessible. Device calibration, channel assignment, stick-layout illustrations and flight response are separate in **Radio & response**. Radio input is exclusive; a lost device never borrows keyboard controls.

Blur, hidden-page transitions, dialog opening, pointer cancellation, controller loss, rendering-context loss and long frame interruptions pause and neutralize local input. Pausing a radio retains its pickup requirement. A reset, changed mode, course or input source starts from the launch pad and clears the old pickup. Returning from a reading dialog does not automatically resume. A graphics-context loss requires reload; the current transcript remains exportable until then.

Without WebGL, course descriptions and controls remain readable, and simulation/replay is unavailable. The renderer respects reduced motion for cosmetic rotor movement; the actual first-person orientation remains the model's orientation. There is no camera shake or cinematic collision pause.

## Validation boundaries

`game/test/fpv-flight-ui.test.mjs` drives the actual shell with deterministic DOM boundaries and synthetic USB samples, verifying explicit arming, ownership, blur/dialog/reset, successful replay-checked practice delivery, preview isolation and cleanup. These are automated code tests, not browser-layout or physical radio evidence. Real USB compatibility, mobile ergonomics, visual comprehension and perceived flight response require the separately recorded device/human review.

The package has no live aircraft connection. Three.js is pinned locally with its license and source provenance under `vendor/`; there are no runtime CDN dependencies or generated background downloads.

## Shared game presentation and asset notices

The simulator consumes the main game's `game/ui/field-kit-tokens.css` and
`game/ui/native-menu-icons.mjs`, plus the original FPV / LINE wordmark. Its
`sim-presentation.mjs` embeds byte-identical copies of two fonts and three short
main-game UI recordings. This keeps the complete editable source archive within
the original 64-file policy without fetching additional assets at runtime.
Fonts load through `FontFace` from local bytes; cues decode only after explicit
sound activation. Mute, hidden pages, flight pause policy and disposal stop cues.
The shared original paths, exact byte sizes and SHA-256 identities are recorded
with each embedded asset.

After updating those main-game assets, run
`node scripts/refresh-fpv-presentation-assets.mjs`, then run the same command with
`--check` to verify that every embedded byte still matches the shared source.
The check also validates the selected clips against the main game's effect bank.

- Exo 2 2.010: `game/ui/fonts/field-kit/exo2-ui-400-600.woff2`,
  76,652 bytes, SHA-256
  `fce2dc8f15375b66d336c1defbca23dfb2310301b62c822206a0a013d19601ef`.
  Google Fonts source commit `809e4d8b8d7e9364a914909bb777679606c178b8`;
  full upstream glyph coverage, weight range 400–600. SIL OFL 1.1.
- Departure Mono 1.500 by Helena Zhang: unmodified
  `game/ui/fonts/departure-mono/DepartureMono-Regular.woff2`, 22,496 bytes,
  SHA-256 `5b4fed1daa90708aa9c6ee1190abca9dc22164a1c1def0020386e46b61038cfb`.
  Source: <https://github.com/rektdeckard/departure-mono/releases/tag/v1.500>.
  SIL OFL 1.1.
- IBM Plex Mono 2.3: `game/ui/fonts/field-kit/ibm-plex-mono-500.woff2`,
  40,080 bytes, SHA-256
  `0498bcb48294756b5ac9062290e1639e907b1ec69b5dc2e8cfdec3fab58e0bc8`.
  Copyright © 2017 IBM Corp. with Reserved Font Name "Plex". SIL OFL 1.1.
- Handjet 2.003: `game/ui/fonts/field-kit/handjet-display-600.woff2`,
  38,120 bytes, SHA-256
  `4797c11d5e17c3f5f9b5b3fa96efb4fd2aabb877fb4d625dfc8eb7465464e145`.
  Copyright 2018 The Handjet Project Authors (<https://github.com/rosettatype/Handjet/>).
  SIL OFL 1.1. Both use the same pinned Google Fonts source commit above, full
  upstream glyph coverage and the source recipes in `game/ui/fonts/field-kit/provenance.json`.
- Main-game `focus.wav`, `confirm.wav` and `cancel.wav`: Kenney Interface Sounds
  (`tick_001`, `back_001`) and UI Audio (`click1`), CC0 1.0. RevealLine prepared
  and normalized these cues; original sources and deterministic recipes remain
  under `authoring/audio/revealline-v1/`. These selected sounds do not contain
  EdgeTX speech or other recordings.
  Sources: <https://kenney.nl/assets/interface-sounds>,
  <https://kenney.nl/assets/ui-audio>;
  dedication: <https://creativecommons.org/publicdomain/zero/1.0/>.
- FPV / LINE wordmark: original generated project artwork. Exact source and
  unchanged image hash are in `game/ui/art/identity/fpv-line/provenance.json`.

The legacy simulator does not import world model loaders or editor gizmos. Its
package excludes those five unused addon files; the separate World Studio
package retains their reviewed exact dependencies.

### Exo 2 license

```text
Copyright 2013 The Exo 2 Project Authors (https://github.com/googlefonts/Exo-2.0)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://openfontlicense.org


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

### Departure Mono license

```text
Copyright 2022–2024 Helena Zhang (helenazhang.com).

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://openfontlicense.org


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

### IBM Plex Mono license

```text
Copyright © 2017 IBM Corp. with Reserved Font Name "Plex"

This Font Software is licensed under the SIL Open Font License, Version 1.1.

This license is copied below, and is also available with a FAQ at: http://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

### Handjet license

```text
Copyright 2018 The Handjet Project Authors (https://github.com/rosettatype/Handjet/)

This Font Software is licensed under the SIL Open Font License, Version 1.1.
This license is copied below, and is also available with a FAQ at:
https://scripts.sil.org/OFL


-----------------------------------------------------------
SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
-----------------------------------------------------------

PREAMBLE
The goals of the Open Font License (OFL) are to stimulate worldwide
development of collaborative font projects, to support the font creation
efforts of academic and linguistic communities, and to provide a free and
open framework in which fonts may be shared and improved in partnership
with others.

The OFL allows the licensed fonts to be used, studied, modified and
redistributed freely as long as they are not sold by themselves. The
fonts, including any derivative works, can be bundled, embedded,
redistributed and/or sold with any software provided that any reserved
names are not used by derivative works. The fonts and derivatives,
however, cannot be released under any other type of license. The
requirement for fonts to remain under this license does not apply
to any document created using the fonts or their derivatives.

DEFINITIONS
"Font Software" refers to the set of files released by the Copyright
Holder(s) under this license and clearly marked as such. This may
include source files, build scripts and documentation.

"Reserved Font Name" refers to any names specified as such after the
copyright statement(s).

"Original Version" refers to the collection of Font Software components as
distributed by the Copyright Holder(s).

"Modified Version" refers to any derivative made by adding to, deleting,
or substituting -- in part or in whole -- any of the components of the
Original Version, by changing formats or by porting the Font Software to a
new environment.

"Author" refers to any designer, engineer, programmer, technical
writer or other person who contributed to the Font Software.

PERMISSION & CONDITIONS
Permission is hereby granted, free of charge, to any person obtaining
a copy of the Font Software, to use, study, copy, merge, embed, modify,
redistribute, and sell modified and unmodified copies of the Font
Software, subject to the following conditions:

1) Neither the Font Software nor any of its individual components,
in Original or Modified Versions, may be sold by itself.

2) Original or Modified Versions of the Font Software may be bundled,
redistributed and/or sold with any software, provided that each copy
contains the above copyright notice and this license. These can be
included either as stand-alone text files, human-readable headers or
in the appropriate machine-readable metadata fields within text or
binary files as long as those fields can be easily viewed by the user.

3) No Modified Version of the Font Software may use the Reserved Font
Name(s) unless explicit written permission is granted by the corresponding
Copyright Holder. This restriction only applies to the primary font name as
presented to the users.

4) The name(s) of the Copyright Holder(s) or the Author(s) of the Font
Software shall not be used to promote, endorse or advertise any
Modified Version, except to acknowledge the contribution(s) of the
Copyright Holder(s) and the Author(s) or with their explicit written
permission.

5) The Font Software, modified or unmodified, in part or in whole,
must be distributed entirely under this license, and must not be
distributed under any other license. The requirement for fonts to
remain under this license does not apply to any document created
using the Font Software.

TERMINATION
This license becomes null and void if any of the above conditions are
not met.

DISCLAIMER
THE FONT SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO ANY WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT
OF COPYRIGHT, PATENT, TRADEMARK, OR OTHER RIGHT. IN NO EVENT SHALL THE
COPYRIGHT HOLDER BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
INCLUDING ANY GENERAL, SPECIAL, INDIRECT, INCIDENTAL, OR CONSEQUENTIAL
DAMAGES, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
FROM, OUT OF THE USE OR INABILITY TO USE THE FONT SOFTWARE OR FROM
OTHER DEALINGS IN THE FONT SOFTWARE.
```

# Directory and offline guide

Open [the bilingual player guide](guide.html) for choosing an app, first flight,
offline preparation, home-screen installation, updates, removal and recovery.
Use the maintained in-app control guide for exact input bindings.
Maintainers: [register and publish packages](../../docs/flight-practice-maintainer.md).

The package's `preview.png` is an actual local gameplay screenshot captured from
RevealLine source plus the SIM owner's startup correction on 2026-10-02. It is
not generated artwork and contains no privately imported world. Underlying
artwork/code retains the asset licenses documented in this package's inventory.
