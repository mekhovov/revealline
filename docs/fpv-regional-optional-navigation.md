# Optional directions within regional free flight

Pause offers **Guide me there** beside the authored starting-point selector and
saved-place selector. It selects a direction target without restarting, arming or
moving the drone. Guidance starts off and can be switched off in Pause. Changing
the installed region/revision clears it. Retry, camera and mode changes within
that exact revision keep the chosen direction.

During active flight the existing compact HUD shows the selected place, horizontal
distance and a direction relative to the **drone nose**, including Chase/Overview.
A small higher/lower cue is descriptive, not a command to climb through geometry.
The HUD explicitly says this is not a route. There is no through-wall marker,
visibility claim, autopilot, score, proximity completion or collision query. At a
nearly vertical attitude, horizontal heading is unknown rather than invented.
Menus and preparation/recovery messages retain priority over navigation.

The target comes only from the verified region's authored starts or a validated
saved place bound to its exact installed descriptor identity. Coordinates remain
in global millimetres; renderer-origin recentring cannot make the bearing jump.
The observer never loads source cells or waits on network/storage during flight.
No new runtime module, asset, package-count increase or memory budget increase.

## Verification

`node authoring/fpv-worlds/regions/verify-optional-navigation.mjs` verifies eight
bearings, wraparound, inverted/vertical/unknown heading, height bands, exact-revision
rejection, input immutability and global recentre invariance. Two actual production
sessions per mode receive the same 500 commands, with only one observed by the
navigation helper; physical state, ticks, contacts and inputs match exactly.
Preparation remains disarmed and disposal releases owned resources.

Native keyboard/touch/radio menu selection, EN/UK responsive layout and camera
readability remain pending the frozen source review. No new packaged/offline,
physical-device or sustained performance acceptance is claimed by this increment.
