# Editable Team emitter presentation

Relay Yard exposes `team.emitter.warning` (24×24) and `team.emitter.spark` (16×16). Both accept a centered transparent PNG or the registered `team.emitter.v1` recipe. The warning decorates an actual exposed-trail target; the spark follows its authoritative position along that trail. Neither adds a homing projectile or changes an attack.

## Authoring workflow

1. Open Asset Studio and choose **Add Team presentation slots** on an older workspace. This appends missing contracts and one theme revision, preserving anchor, core, Support and other existing bindings.
2. Search `team.emitter`. Choose **Field context → Couch Team → Relay Yard**. Use **Emitter warning** for the warning slot and **Travelling spark** for the spark. First Connection has no emitter; choose the compatible arena or Native size when shown the recovery message.
3. Upload at the slot's exact dimensions with center pivot (0.5, 0.5), sparse pixels and transparency. Enter true creator/source/rights, validate and stage. Inspect Native size and reduced effects. The warning line and target square, and the spark center/outline, remain game-owned above the artwork.
4. Play the preview to inspect movement and clearing. Paused and Reduced effects hold the selected state. Returning to Paused rebuilds the specimen. Save, export the actual `.rltheme` file, re-import and verify history before release adoption.

The two scenes use public controls on the unchanged Standard/seed17 Relay Yard: travel upward for 60 ticks, inward for 230, apply Support for one tick, continue inward for 39 and turn upward for 120. Warning is observed at tick 360; a moving spark at tick 430. Keeping the trail open allows the real emitter to launch. Securing it clears the spark. There are no fabricated run fields or altered level rules. The existing scene availability contract disables these scenes for First Connection.

Prepared warning frames are 24×24 and spark frames 16×16, with centered pivots. A malformed advertised frame fails before replacing the current painter snapshot. Historical themes without bindings preserve their prior colors, markers and geometry. Artwork cannot change warning duration, target choice, spark speed, collision, Support interception or clearing rules.

## Qualification boundary

Ten whole test files pass 115/115 on each of Node 20 and Node 22. They preserve historical fixture hashes and independently reproduce the emitter input trace, active/cleared states, failed-adoption retention, immutable upgrades and byte-exact asset round trips. Native browser checks cover both uploads, active/reduced/play states, saved revision reload, real disk export/import/Undo and narrow native previews. Browser review caught misleading incompatible-arena text; recovery now offers Native size instead of an unsupported Solo/Versus preview.

The original geometric PNGs used for verification are QA fixtures, not production art. Production artwork, rescue/recovery roles, full P04/P08 acceptance, physical devices, full release gates and public deployment remain separate requirements.
