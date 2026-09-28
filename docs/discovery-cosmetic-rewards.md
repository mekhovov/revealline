# Exact optional character rewards

Cosmetic rewards use the existing body, motion and animation presets. They add no
class, collider, ability, score multiplier, XP balance or completion store.
`presets.rewardCharacters` is an optional allowlist of at most 32 playable body
IDs. The absence of this field preserves the previous edition output. A theme's
starter/class bodies, registered enemy actors and presentation-set starters
cannot also be reward bodies.

Authors create a body and its animation in Asset Studio using the normal preset
workflow, include its approved raster and dependencies in the edition's asset
list, and add that body ID to `rewardCharacters` in Company Studio's Actors step.
The shared Level/Campaign discovery editor offers a character binding selector.
Company Studio supplies its selected edition directly; standalone Level Studio
imports the existing Company source draft and requires an explicit owning
edition. The editor creates a new immutable reward revision and rebinds existing
discovery references through the shared revision authority. Required wins,
learning rules, gameplay and existing receipts stay unchanged.

The payload records an exact `recipeId` and derived `recipeRevision`. That revision
covers the original selected body, its animation recipe and approved asset
hashes. Compiler, source-draft import and runtime bootstrap resolve the same
registry. Raster bytes additionally pass the existing MIME/header, size and hash
checks. SVG, arbitrary URLs, unselected media and gameplay properties are not
admitted. Existing 4 MiB still-image, 32 MiB edition and core offline budgets stay
unchanged.

A first accepted reward receipt makes its exact body available in the existing
appearance selector. It does not automatically change the equipped character.
The earned Collection preview uses the same renderer and rigid motion adapter,
starts statically, and offers explicit Animate, Pause and Choose actions. Reduced
motion remains static. Preview, practice and Studio inspection do not create
receipts. Session-only rewards remain session-only under the existing reward
storage rules.

Studio previews use explicitly selected local originals; imported source packets
do not cause URL fetches. Both runtime and preview verify the exact bytes and
reuse bounded image decoding. Closing the preview cancels outstanding work and
releases decoded images, motion frames and preference subscriptions. A missing
or changed exact recipe retains the receipt and offers recovery through the
existing retained-presentation selector; it never silently equips newer artwork.
The printable view preserves the exact recipe identity and a useful text record.

Validation includes immutable author edits, source-packet round trips, selected
raster admission and negative pins/MIME, twenty renderer lifetime cycles,
reduced-motion and cancelled decodes, and a real shared Solo keyboard win that
unlocks the native picker while retaining identical authoritative checkpoints.
Only explicitly authored cosmetic rewards can be earned. The aircraft and textile
application bonuses grant their character automatically after all declared wins and
the verified fixture are complete; equipping it remains an explicit player action.
Human visual and physical-device qualification remains separate.
