# Exact historical Team visual identities

`prepareTeamVisualThemeContext` validates the accepted full pack through
`validateCoopPack`, verifies exact selected-level membership, copies the inputs
before hashing and then snapshots the presentation context. It never edits a level
or treats a label as content ownership.

The Team context reader retains the historical validator's domains without trimming,
normalization or revision coercion:

- Local pack IDs use the existing lowercase letter/digit/hyphen identifier, up to 80
  characters. Historical pack revisions remain positive bounded integers; foundation
  pack revision strings retain all their original characters, up to 80.
- Team level IDs remain nonempty strings up to 100 characters, including spaces and
  Unicode. Level revisions remain nonempty strings up to 100 characters or positive
  integer Numbers, including historical values outside the safe-integer range.
- The opaque JSON representation is preserved. Numeric `2`, string `"2"` and string
  `" 2 "` remain distinct identities and hashes. No new numerical calculation is
  performed on an authored revision.

These context shape checks are not a replacement for pack validation. The pack's
actual version still decides whether its revision can be numeric or textual.
A detached context admits the union of those shapes because it does not carry the
pack format; it cannot establish that a particular format accepted those values.
Accepted gameplay ownership remains with the validated pack and exact level membership. Solo, Versus and Journey identity contracts retain
their existing restrictions.

Catalogue and visual-theme pin round trips preserve these exact Team values. A
changed sibling level changes the full-pack hash even if the selected level is
unchanged. A same-ID edited level cannot become an accepted member or inherit an
existing compatible catalogue entry.

Run `node --test game/test/team-visual-theme-identity-compatibility.test.mjs` with the
existing visual-theme identity, catalogue, pin, lease and Journey identity suites.
Cover boundaries, invalid inputs, both revision types, whitespace/Unicode, exact
membership, full-owner hashes, cancelled preparation and portable JSON round trips.

This adapter correction does not ship a retained-theme catalogue, load old assets,
relax `.rlteam` receipt equality, alter picture pins or adopt produced Team artwork.
A retained presentation still requires its exact code-owned runtime manifest hash,
verified asset bytes and a separately owned lease. Default-theme revision changes
must qualify those compatibility and lifecycle paths before publication.

Maintenance prompt: “Preserve the exact domains already accepted by Team's pack and
level validators when adapting them for visual-theme contexts. Never sanitize IDs
or coerce revisions. Keep Solo/Journey restrictions intact; prove complete-owner
hashing, exact membership, no input mutation and catalogue/pin round trips. Record
this as an identity prerequisite, not as retained-snapshot or public acceptance.”
