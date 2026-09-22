# Editable Team relay-core states

Relay Yard exposes three optional presentation slots: `team.core.shielded`, `team.core.exposed`, and `team.core.secured`. Their 64×64 centered transparent bodies follow the actual stronghold state. The game retains its fixed ring, center cue and SHIELD/CAPTURE/SECURED labels. Artwork does not modify timing, geometry, attacks, capture, Support or rescue.

## Authoring

1. Open Asset Studio. Choose **Add Team presentation slots** for a historical workspace. The explicit, undoable upgrade adds only missing anchor/core contracts and appends one theme revision. Existing anchor uploads, collection appearance and historical records remain intact.
2. Search `team.core`. Choose **Field context → Couch Team → Relay Yard**. Inspect shielded artwork in **Initial field**, exposed artwork in **Relay core exposed**, and the final-picture behavior in **Completed field**.
3. Upload a transparent 64×64 PNG or use the single-layer pixel editor. Keep the pivot centered, omit embedded labels and retain a readable silhouette. Enter actual provenance and rights, validate and stage, then inspect Native size and the matching scene. An inactive scene says so explicitly.
4. Save locally and export `.rltheme`. Re-import the actual downloaded bundle and compare prepared bytes/history before adopting it through the release pipeline. Draft import and upgrade support Undo. A successful save starts a new draft history.

The victory painter displays the revealed picture, hiding objectives. Studio now reports this instead of falsely claiming that captured anchors or secured cores are visible. Use Native size to inspect secured artwork; imported multi-stronghold arenas may display a secured core while play continues elsewhere.

Historical collections without these optional bindings retain their shared core body, opacity and original palette. Recipe bindings use the shared core body with the registered state overlay. Uploaded state bodies replace only the matching body. Missing or malformed required prepared images fail before replacing the prior painter snapshot.

## Evidence and limits

The focused implementation covers real Team actor selection, fixed cues, immutable upgrades and truthful previews. Eight complete test files pass 95 checks on each of Node 20 and Node 22. Browser qualification exercises an existing saved anchor workspace, explicit upgrade, real upload, active/inactive/completed previews, save/reload, actual export/import and narrow layout. QA geometric uploads prove plumbing; they are not approved production artwork.

This does not complete P04 or P08-A. New production core artwork, remaining Team objective/effect roles, full imported-map qualification, physical input/accessibility checks, all release gates and public deployment remain separate acceptance requirements.
