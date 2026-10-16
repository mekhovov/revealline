# Lunar Basin district connections

This evidence closes the automated transit portion of the source plan while
preserving every terrain/scenery payload from source #1452, `694afb3a`.
It does not change the frozen source review on port9151 or add a Library row.

Seven 24 m-wide connecting lines now start at the exact authored 3 m-AGL
positions, climb to 24 m AGL, cross into the adjacent district and descend to its
authored starting position. The lower, closer landmark routes remain separate.
The 32 m-AGL exploratory scenario is preserved externally; this published proof
uses the planned 24 m transit height and includes both vertical transitions.

All fourteen production command flights across Self-level and Acro pass:
225,282 ticks, 48 origin recentres and no route contacts. Twelve disarmed starts,
four intentional ground/roof contacts, paused-input isolation and disposal also
pass. No waypoint teleporting or alternative physics is used after scenario
initialization. The actual source poses, source hashes and final command hashes
are recorded in `connections-flight-verification.json`.

The source verifier checks another 1,535 centre/edge sphere sweeps, including
vertical climbs/descents, against the same exact 57 canonical meshes. Peak
prepared resources remain 548,808 bytes; retained plus staged is 1,097,616 bytes.
Original twelve-route verification remains compatible with the verifier's
default input. The optional scenario argument changes only what is tested.

Reproduce with a new scenario file:

```sh
node prepare-connections.mjs EXACT_SOURCE_DIRECTORY NEW_SCENARIO_JSON
node verify-preparation.mjs EXACT_SOURCE_DIRECTORY NEW_SCENARIO_JSON
node verify-commanded-flight.mjs EXACT_SOURCE_DIRECTORY NEW_SCENARIO_JSON
```

These are source checks against the identified preserved production runtime
`e006821b9ce49d97e52ec9bdd9c2ae4725ce94b5`, not a new package or native player
acceptance. Native pilot-height art, material readability, delivery, current
package, ordinary player lifecycle, physical devices and sustained play remain
open gates. The region is still a fictional terrestrial-physics flight study.
