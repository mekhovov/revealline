# Game-data replacement review

P07-A/P16-A: complete game-data imports and earlier-release copies wait for a deliberate replacement decision. This is a player safeguard, not a release approval gate.

The review follows W3C’s guidance on preventing unintended changes to stored user data through review, checking or reversibility. It is not a claim of whole-game WCAG conformance. [W3C SC 3.3.4](https://www.w3.org/WAI/WCAG22/Understanding/error-prevention-legal-financial-data.html)

## Player flow

1. Choose a backup file, paste its JSON, or choose Copy reviewed progress from an earlier release.
2. Validation and preparation acknowledge the action immediately in Library's existing operation rail.
3. Before a replacement write, the rail names the affected data: picture records, scores, preferences, installed packs and saved flight. It explicitly states whether a verified Undo copy is available. Embedded pack artwork is included. Separately stored picture originals, stories and custom music are not replaced by this game-data import.
4. **Keep current data** cancels. **Replace game data** enters the existing guarded backup transaction. Escape during review cancels and retains Library. Close or pagehide retires the review; an old confirmation cannot become a later write.
5. Successful import exposes Undo when the previous data was verified. A cancelled or failed import does not discard an existing Undo. Completing Undo returns keyboard focus to Export game data, since Undo is then disabled.

The review defaults focus to Keep current data only while the originating operation still owns focus. It must not steal a newer Close or other deliberate focus choice. Both actions use the shared 44-pixel controls; the explanation is focusable and scrollable in short viewports. Status updates use the existing live status owner rather than opening another modal.

## Ownership and compatibility

Backup review uses the read-only `checkProfileReplacement` guard. Keep, Close and rejected preparation preserve pending optional-seal verification. A seal may finish during review; the destination identity check then rejects that stale Undo snapshot and requests a fresh import. Only an accepted backup acquires a synchronous `holdCommits` boundary before its first await. Successful durable replacement cancels the old jobs before chapter-readiness work; a verified unchanged or fully rolled-back failure resumes the same jobs. Uncertain recovery, lost ownership or an unreadable/remaining backup marker cancels those jobs rather than writing into ambiguous storage. Direct player-library replacement retains its separate destructive hook. Compare current in-memory and durable profile/session identity before/after preparation and again after the player's choice. If it changes, refuse and request a fresh import. Exact external asset verification, writer ownership, backup locks, journaling and rollback remain in the existing transaction.

Earlier-release copies revalidate their reviewed source after the replacement decision. A changed fingerprint updates the source preview and refuses the copy. The source remains read-only. Cancelling during the recheck cannot enter commit. Once commit begins, Stop waiting keeps its existing meaning; it is not transaction cancellation.

A complete game-data backup remains distinct from a coordinated game-and-originals backup set. This feature does not change historical formats, simulation state, ownership of earned originals, or include unrelated media in JSON. Player-library-only and single-attempt imports retain their existing separate paths.

## Qualification

Require tests for verified and unavailable Undo, failed snapshot preparation, Keep/Replace, Escape, Close, pagehide, stale completion, changed destination/source, import failure, retained prior Undo, pending seal retention on Keep/Close and known-safe failure, stale review after an earned seal, successful replacement cancellation, held verification and unsafe recovery, and focus after import/Undo. Exercise v1/v2 backups, external chapters and saved flights. Keep native browser, modeled input, physical controllers, screen readers, offline and public release evidence separate.

Historical patch integration must include the Undo handler’s logical successor as well as the shared operation rail. Successful Undo disables itself and returns still-owned focus to Export game data. Model native dialog opening events in nested-modal host tests; assert DOM identity as a boolean so a failed check reports the mismatch without recursively formatting the entire page. Keep the failed run and requalify affected tests after correcting runtime code.

Maintainer prompt: [backup replacement review](../authoring/prompts/backup-replacement-review.md).
