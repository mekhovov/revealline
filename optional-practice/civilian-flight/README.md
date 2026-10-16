# Optional civilian flight gym

This is a separate, simplified **assisted kinematic practice model**, not the
arcade game engine or a model of a particular aircraft. Commands select planar
velocity, yaw rate and climb rate. Neutral holds position. There is no inertia,
gravity, battery, motor model, radio setup or real aircraft connection. Floor and
boundary contacts are constrained, not simulated crashes. Completion is evidence
that a fictional route was followed in this model, not real flight proficiency.

The twelve bilingual drills cover lift/return, a steady point, forward/back,
lateral movement, a square, compass turns, turn/travel, height changes, slalom,
figure eight, two small landing pads and a synthesis tour. All checkpoints must
be reached in order; altitude and heading tolerances matter. Hold requirements
use fixed model steps. There is no deadline or campaign progression reward.

## Play and author

Serve the repository and visit `optional-practice/civilian-flight/`. Choose a
drill and Start. WASD/arrows control planar movement relative to the nose; Q/E
turn it; R/F climb/descend. Space/Escape pauses. Touch buttons work while held.
Keyboard controls belong to the focused gym. Leaving focus, hiding the page or
losing a selected gamepad pauses and clears input. Resume requires an explicit
action and fresh input. A standard-mapped four-axis gamepad can be selected;
unsupported/missing pads fall back to keyboard and touch. The illustrated Mode 2
assignment is specific to this educational model, not a universal channel map.

Controls & authoring contains JSON export/import. A catalogue has a versioned
model identity, civilian scenario, bounded gym, 1–24 drills with English/Ukrainian
copy, a floor spawn and 1–32 ordered checkpoints. Geometry is centimetres;
heading is clockwise degrees from the top of the diagram. Each checkpoint
declares radius, altitude tolerance, optional heading/tolerance, consecutive
hold ticks (20 ticks/second), and whether a settled floor landing is required.
Unknown/executable fields and out-of-bounds fixtures are rejected before import.

The practice transcript records bounded normalized inputs and exact catalogue
identity. `replayPractice` recomputes outcomes without accepting a completion
flag. A recording is bounded to 12,000 command segments or 72,000 model ticks;
reaching that storage bound pauses with an explicit request to reset the attempt.
Successful route results live only in this page visit; no Journey, reward,
profile, edition selection or shared game save is modified. Catalogue and
transcript JSON can be copied for explicit transfer. Reading/authoring pauses
practice. Canvas failure retains a text position/target interface. There are no
ambient motion effects, shake or flashing; model motion is necessary feedback.

## Separate optional distribution

`node scripts/build-optional-practice.mjs <new-output-directory>` creates a
development-only site and deterministic ZIP. It admits only this app's explicit
files and named shared validation/input/i18n dependencies. It projects validator
messages for English/Ukrainian instead of carrying unrelated edition catalogues.
`optional-package.json` lists exact byte counts and SHA-256 values, source
classification, package identity and unqualified engine references. The builder
can accept exact commit/tree references, but still requires release qualification.

The unchanged default/core build does not include `optional-practice/`. This
archive has its own 8 MiB/64-file bound and does not increase the existing core or
edition budgets. The release pipeline must explicitly admit/publish the optional
artifact; building it does not promote it. No core or edition compiler was changed.

In a built HTTPS/localhost package, Prepare offline registers a worker scoped to
this app directory and verifies every dependency before activation. Cache names
include the app path and immutable package revision. Removal unregisters only
that exact scope and removes only its cache prefix; game/edition caches and all
origin-wide storage remain untouched. A browser may control install presentation;
the manifest has an explicit separate app ID. Real multi-device installation and
controller evidence are deferred, not inferred from automated tests.

The optional builder reuses RevealLine's original deterministic 192/512-pixel
installation icons. The generated icons belong to this package's own verified
file list and worker cache; no other installation supplies them at runtime.

The distinction between stick assignment and flight-mode response follows
[ArduPilot's transmitter-layout documentation](https://ardupilot.org/copter/docs/common-radio-control-calibration.html)
and [PX4's flight-mode documentation](https://docs.px4.io/main/en/flight_modes_mc/manual_stabilized).
The gym's assisted rules are authored simplifications, not assertions about those
flight controllers. Real device calibration and operational flying are excluded.

# Directory and offline guide

Open [the bilingual player guide](guide.html) for choosing an app, first flight,
offline preparation, home-screen installation, updates, removal and recovery.
Use the maintained in-app control guide for exact input bindings.
Maintainers: [register and publish packages](../../docs/flight-practice-maintainer.md).

The package's `preview.png` is an actual local gameplay screenshot captured from
RevealLine source plus the SIM owner's startup correction on 2026-10-02. It is
not generated artwork and contains no privately imported world. Underlying
artwork/code retains the asset licenses documented in this package's inventory.

## Shared menu presentation and preferences

The gym reuses the canonical five-mode picker, categorized settings, and shared
display, theme, menu-animation and master-audio preferences. These settings affect
presentation only; drill state and recorded inputs remain owned by the practice
model. Offline preparation and catalogue/transcript tools stay available in this
package. When opened beside the main game, additional shared tools load on demand;
a standalone package retains its local tools when that extension is unavailable.

The admitted SIM presentation module embeds the exact main-game font and menu-cue
bytes, so the gym does not fetch font files or sound clips from another install.
The shared stylesheet has no external resources. Embedded asset provenance and
full font licenses follow.

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
