# Native isolated storage recovery

The exact packaged production world store from source `f5411438367b5bf3cadefdad55a775e6a8f0c2c6` passed a manual native IndexedDB recovery journey on 2026-10-15. The companion JSON pins its module, harness and screenshot.

A unique disposable fixture database held 182 bytes of logical synthetic payload. Revision A committed at generation 1. A connection-local modeled `QuotaExceededError` aborted installation of B without changing A or exposing B. A valid retry committed B at generation 2 while retaining A; a stale generation was rejected. Rollback activated A at generation 3 while retaining both revisions. Closing/reopening the connection, then reloading the page and explicitly reopening the same database, preserved exact A at generation 3.

The parent agent executed the visible controls through native CUA and supplied the observations. The fixture imported the unchanged packaged store, injected failure only on its own database connection, and never accessed production player databases or caches.

This verifies real native transaction abort and page-reload persistence with a modeled failure. It does not establish actual disk-quota exhaustion, browser-process restart recovery, storage eviction resistance, or device-wide behavior. Database engine overhead was not measured. The test database and external evidence remain preserved.
