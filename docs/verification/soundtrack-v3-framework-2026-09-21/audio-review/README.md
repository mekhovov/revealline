# Scoped functional audio source review

The bounded review found and corrected a Recording mode bypass: Automatic could
fall back to published theme audio whose video/Content ID permissions were
unknown. Published fallback is now excluded in Recording mode. Regressions cover
fresh playback and enabling the mode while published audio is playing or paused.
The actual Studio Save & use path invokes the tested `selectListening` API.

The final audio recipe fingerprint is
`42509346fbac2c57c8f365dbb2fc8d9c30c9fb0b0110d7a63356c6273ee19f98`.
It hashes, in order, `game/ui/audio.mjs`, `game/ui/published-audio.mjs`,
`game/ui/soundtrack-player.mjs` and `game/ui/audio-master.mjs`, using the same
concatenation as `fieldKitRecipeSources`. [review.json](review.json) records the
base revision, HEAD, actual file hashes, commands, outcomes and review limits.
HEAD alone does not identify the reviewed working-tree correction.

- Initial core run: **261/261 passed**, before the missing Recording mode case.
- Corrected core run: **263/263 passed**, with unchanged recorded input hashes.
- Player/correction subset: **50/50 passed** (overlaps the core run).
- Practice host: **5/5 passed** after its stale DB4 assertion was corrected to DB5.
  Legacy seed versions and original-byte/zero-write checks were preserved.
- The broader mixed host run: **118 passed, 9 failed**. It overlapped source and
  production regeneration. All failures came from Team refusing stale picture
  bindings (root confirmed theme revision 38 versus ledger 40), before audio
  assertions could complete. This failed run is retained; a corrected binding
  successor and fresh host run are required. Picture guards were not relaxed.
- Repository Prettier and scoped ESLint passed for the three edited files.

The retained TAP files accompany the JSON; their counts overlap and must not be
added. Source review covered current/next deck ownership, cancellation, sequential
permission fallback, master/music/lifecycle separation, menu activation, genre
selection and reference-only recovery. No further defect was identified in that
bounded audio scope after correction. Whole-host and release qualification remain
separate and incomplete at this receipt.

This agent previously authored core/Couch changes and authored the correction;
this is a separate review pass, **not an independent-author signoff for all code**.
A separate agent is recording an independent review. No music was auditioned.
There is **zero musical or recording approval**, no physical-device or codec
qualification, no offline listening qualification, no full-suite pass and no
publication approval. Earlier native persistence ambiguity remains recorded in
the parent verification note; this source review does not explain it.
