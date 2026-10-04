# Compatible world catalogues

`index.json` remains the `FPVWorldLibrary.v1` catalogue for the original Library
player. Every row there must import successfully in that retained player. Do not
add capabilities, runtime versions, or other row fields: its exact-key parser
would reject the entire catalogue.

`surface-coating-v1/index.json` uses the same schema, limits, immutable commit/path,
byte size and SHA-256 identity. Only players with the required
`REVEALLINE_surface_coating` version 1 capability request it. Their generated
dedicated worker accepts this exact index URL; immutable pack URL and hash checks
are unchanged. Both catalogues are currently empty. A world enters a catalogue
only after its final pack, courses, examples, presentation and installation are
qualified. A compatible world may appear in both catalogues; a coating-dependent
world must never enter the original one.

Catalogue versions select an existing, fixed capability contract. They do not
negotiate arbitrary imported features or permit executable content. Future
required features need another compatibility decision before publication.

An older cached player still rejects a directly imported coating-dependent pack.
New players distinguish a well-formed but unsupported required extension from
malformed extension declarations. EN/UK guidance explains that the current SIM
cannot import the feature and directs the player to the existing Flight practice
launcher: **Check available practice → Play available version**. If that version
still lacks the feature, a compatible pack is required. **Prepare offline** caches
the version currently opened; it does not upgrade an old version. No import error
automatically navigates, clears caches, removes data, or strips a required feature.

The native update journey and the first real catalogue row require their own
observations. An empty catalogue and a diagnostic pack are not delivery of an
additional world.
