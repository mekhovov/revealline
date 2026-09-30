# Discovery editor lifecycle recovery

This forward recovery is based on main `53444e0f7ab400df3222df6db181c10cd7dc0a3e`.
It restores the omitted transient suspension contract from the historical
Discovery authoring lineage without replaying the broad original commits.

## Preserved behavior

- Both Company Studio and Content Studio suspend Discovery on pagehide. Only
  terminal navigation disposes its editor tree. The Company lesson/whole-game
  preview ownership correction already merged in #848 remains unchanged.
- Shared exploration, teaser, cosmetic, asset, audio/video, playlist and feedback
  editors stop transient previews without removing field nodes or resetting
  uncommitted values. Pending asset/media/cosmetic preparation generations retire;
  abortable work is aborted and transient URLs/audio ownership are released.
- Parent sidecar reads also have a generation fence, preventing late read success
  or failure after suspension/disposal from adopting data or repainting status.
- Cached-page return does not rebuild these editors or automatically resume media.
  A subsequent explicit preview action remains necessary. Existing explicit Apply
  persistence semantics are not changed or represented as cancellable transactions.

No player progress, reward receipts, save schema, production ledger, compiled
artwork/audio, version, workflow, branch protection or publication budget changes.
The small runtime source increase still requires normal hosted Pages capacity
and deployment checks; source review is not a package-budget pass.

## Verification and limitations

The complete parent/child lifecycle delta and both current host call sites were
read. Syntax-only Node parsing succeeded for all eleven prepared JavaScript
modules. The new regression module contains twelve cases: preserved draft fields;
late parent import success/failure; four late child packet reads; delayed feedback
audio enable; and both hosts under cached and terminal pagehide.

Tests are **WAIVED_SKIPPED_NOT_PASSED** under the integration waiver. They have
not been executed locally. First exact-source execution and any fixture failures
belong to follow-up #813. The callback-isolation cases are not whole-browser
navigation tests. Packaged browser/BFCache, listening and physical-controller
acceptance remain separate; no previous test cohorts are relabeled or summed.
