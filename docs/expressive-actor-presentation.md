# Expressive actor presentation and native flight additions

The shared `humanoid-actors.v1` catalogue contains twelve identities, three casts
and thirty-six procedural visual variants. Catalogue capability descriptions are
requirements for native adapters, not permission to insert an unsupported enemy
into a historical recipe. The painter does not consume game RNG or advance AI.

The detailed 28-pixel and compact 16-pixel renderers share palettes, silhouette
accessories, warning/recovery poses and shield-facing indicators. Classic keeps
its historical drawing API. Capture uses the compact painter, and destruction
uses matching coat colors and dropped equipment. Clean catches have bounded,
short feedback; blood remains conditional on both Brutal and Blood preferences.

Twenty-four new EN/UK lines are registered with the existing reaction and Studio
voice catalogue. Enemy lines share the three-incidental limit, warning priority,
cooldown and exact-line repeat suppression. Forty-eight generated macOS speech clips now provide two lines per family in
each locale, with immutable scripts/media in the existing voice library and
Studio replacement/original-restoration workflow. They total 868,186 bytes;
pronunciation and listening review remain pending. Captions remain usable when
speech is muted or unavailable. Hosts supply accepted
actor identity through reaction context, without rewriting simulation events.

## Creator workflow

The Capture Hunt editor now includes a pursuit authoring panel with target IDs,
coordinates, behavior, route waypoints, pair links, cast previews and the shared
field guide. Inspect invokes the production content compiler. Apply updates only
the chosen mission and owning campaign/pack revisions, retaining normal Undo,
source export and import. Existing Hunt objectives retain their target IDs and
positions. Capture Snake pursuit is supported through explicit Capture level
v13/core v14 and Team level v12/core v14 successors; its original population,
quota, growth, ordered bonuses and tail policy remain pinned. The original
source editions and saves retain their historical rules. See
`capture-snake-pursuit-boundary.md` for exact contracts and transport limits.

Shield and Brace are explicit authored Capture/Team policies in the new pursuit
successor only. Shield keeps its front committed for at least 0.8 seconds and
warns for 0.8 seconds before changing it; the exact side boundary is exposed.
Brace starts exposed, then cycles 0.8-second warning, 0.4-second straight burst,
and 1.6-second exposed recovery. Native actor freeze holds these phases. Actors
wait before moving into current player heads, cables or blocked geometry. Front
or closed-armor contact uses native fatal/protection ordering; protected players
cannot bypass armor. Enclosure removes either specialist regardless of armor.
A surviving Team partner may make the single accepted catch alongside another
seat's fatal front contact. Ordinary Varied generation never selects specialists.
Studio includes state previews for both armor states and a shield turn.

World Studio shows native Hunt actor guides and shared cast previews. Its spatial
view invalidates when the cast changes. Native 3D faces, cap silhouettes and cast
accessories use the shared palette without altering collision proxies.

## Twelve new native SIM courses

| Ground Routes     | Approach Windows  |
| ----------------- | ----------------- |
| Low Pass Depot    | Low Roof Window   |
| Split Yard Return | Roofline Exchange |
| Crossing Arrivals | Return Slot       |
| Shelter Arc       | Staggered Roofs   |
| Freight Slalom    | Window Chain      |
| Forked Depot      | Three-yard Finale |

These use finite, unarmed ground patrols, native manual flight physics and solid
echo tails in both Self-level and Acro. They do not claim grid fleeing, timed
shields, grid pickups or online flight. Eight six-course playlists now expose 48
Snake-related SIM courses. The prior 24-course and 12-course pack identities are
preserved; the new twelve have independent immutable content ownership.

Production schema and real collision-spawn admission were performed for all
twelve. Their routes, altitude choices, difficulty, controls and completion still
require human play qualification before public release. Those checks are not
represented as passed.

## Verification policy

Relevant catalogue, rendering, reaction, Studio round-trip and flight catalogue
regressions were authored without running automated suites, as required by the
repository's explicit waiver. Changed files received formatting and lint checks.
Production content compilation and course admission are validation, not evidence
that a human has completed or enjoyed a level.
