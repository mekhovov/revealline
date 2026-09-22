# Session-only release originals

When another tab owns the profile writer, a fresh Legacy Solo attempt may need a published picture absent from the durable media history. Previously this blocked Next before download. The new path stages exact code-owned originals in tab memory, then accepts them only after the requested display is ready and the attempt still owns the operation.

## Boundaries

- This is an explicit known-writer-unavailable path, not a fallback after failed or uncertain persistent commits. Required metadata must remain readable.
- Campaign baseline checks, manual assignments, imported artwork ownership, exact content identity and immutable revisions remain authoritative. Chapter installation still requires its durable transaction.
- At most32 MiB of accepted plus reserved incoming originals and two pending stages are allowed. History is never silently evicted. A capacity failure preserves the prior attempt and requires export/recovery.
- The page owns immutable originals separately from decoded image leases. Closing a flight does not discard earned session originals. Permanent page retirement releases them; a cached history return retains them.
- Retry and world changes use accepted pins. A late, cancelled or stale stage cannot accept or replace a newer selection. No campaign, simulation, score or replay format changes are introduced.
- Collection reads a combined document for ownership, with explicit durable/session revision fields. Durable stores still receive their actual branded metadata; the combined view is not a durable snapshot.

## Player recovery

Game data shows **Prepare session originals** when the tab owns transient pictures. Preparation verifies an .rlmedia bundle, then presents **Download session originals**. Downloading does not imply the browser saved a file, and it does not export progress. Export game data separately. Restore originals in **Workshop → Pictures & stories** before importing the game-data JSON. Session exports contain immutable originals and owners but no default assignments, preserving explicit manual choices during merge.

Leaving the page with transient originals requests the browser's standard leave confirmation. Browser support and user activation affect that prompt; it is not a substitute for exporting. Prepared URLs are revoked on a new preparation, changed history, closing the dialog or permanent retirement. Cancellation and late results cannot publish a stale download.

## Verification contract

Exercise two same-origin tabs; retain the writer in one, then in the other win First Signal and choose Next when Relay Orchard's original is new to history. Keep the result visible during delayed preparation; enter play without a second Start. Verify zero modeled persistent writes and writer reacquisition, native image decoding, retained Retry/world-change pins, earned Collection viewing, export bytes and fresh restore. Distinguish modeled storage assertions from browser observations.

Required regression: an actual durable commit failure must still fail, unavailable metadata must not become an empty library, and imported/manual art must never become an unannounced published default. Include stale stage, aborted image decode, cancellation during export, capacity, exact byte preservation, missing originals and no-Undo recovery separately. A passing slot inventory or unit file is not full release acceptance.

This document describes an implementation candidate until its version/source is qualified, frozen, deployed and publicly verified. The coordinated release record supplies that identity.
