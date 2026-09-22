# Usable focus during Library preparation

When a Library action disables its focused initiating control, focus moves synchronously to the visible, enabled **Cancel operation** control first. Preparation must not leave keyboard/controller users on an empty page focus while a usable cancellation action is available.

The move uses a separate short-lived focus lease. Preserve the existing return lease, logical pack-row successors, and newer-focus/lifecycle vetoes. Never claim BODY as a new opener, move an unaffected Close action, or recover background intent. Reveal Cancel before the move and exclude it from the subsequent disable pass. Recheck operation ownership and the dialog’s actual open state after focus listeners run: native Close sets `open` to false before its queued close event. Retire the current task without restoring focus immediately; reentrant Close or replacement work must not let a retired operation lock controls or begin reading.

The same task owner covers pack/file installation, installed-pack removal, backup/file import, game-data/player-library/pack export, backup Undo, saved-flight restore and earlier-release Review/Copy. Attempt export, coordinated backup sets and content launch have separate owners and are not changed by this correction.

Replacement review keeps the current action focused as its label becomes **Keep current data**. A newer Close or other focus decision still wins. Explicit cancellation restores the actual opener; completion/error uses the existing guarded return destination, including a remaining pack row. Once commit begins, **Stop waiting** still detaches observation rather than rolling back storage and does not restore an obsolete opener.

Qualification uses the actual Solo host with local native-disable behavior on both opener and Cancel, deferred fetch/file/storage operations, and existing lifecycle/new-focus tests. It checks initial cancellation access, return focus, failure, logical row replacement, review, reentrant Close and detached commit behavior. Modeled input is distinct from native browser/device and public-release evidence; retain those separate gates.
