# Neon Arcade and FPV Field Kit UI skins

Status: source candidate; frozen-build and human/device review pending.

Solo, Versus and Team now expose the same two named UI choices in Appearance & Accessibility:

- **Neon Arcade** is the default. It uses a high-contrast violet, cyan and amber pixel-arcade shell.
- **FPV Field Kit** uses the restrained blue, yellow and dark-panel treatment already established by
  the FPV presentation work.

The selection changes menu chrome immediately and remains independent from the actor choice. A
player can therefore use either UI skin with FPV actors or campaign-specific actors. Campaign art,
canvas palettes, reveal pictures, music, replay state and gameplay rules are not replaced.

The existing two-field menu preference remains the wire/storage contract. Its historical
`auto` value now resolves consistently to Neon Arcade instead of following a campaign theme, while
the historical `ukrainian` value resolves to FPV Field Kit. Existing stored choices therefore keep
working without a profile migration or write during startup.

Both skins retain the shared pixel frames, focus treatment, ornaments, Plain text, large text,
Reduced Effects and forced-colour behavior. Token checks cover WCAG contrast for text and functional
cues. Focus order and touch-target geometry are unchanged.

Replay Theater, controller practice, About, release catalogs and other pages that opt into the
shared supporting-page host now read the same validated menu-style record. They never write it and
do not add a second selector. Pages with native Solo, Versus or Team controls keep their existing
owner, preventing competing subscriptions. Frozen releases and authored canvas palettes remain
unchanged.

Focused automated checks cover both palettes, theme independence, storage/restoration, all three
gameplay selectors, paused-flight authority, replay preservation, controller editing, malformed
preference rejection and read-only adoption by supporting pages. Compact physical-device inspection
and human visual preference remain later gates.
