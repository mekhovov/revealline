# Ignored touch cancellation: Solo, Versus and Team

Both input hosts retained legacy arrow-button cancellation handlers after adopting
the shared Solo-style steering adapter. In couch mode a cancelled ignored extra
finger on an arrow paused both players. In Solo it cleared the actual steering
finger, preventing further turns with that finger. The regressions reproduce these
separate effects against exact8cff runtime sources.

Couch button cancellation now requires that button's own tracked pointer. Solo
child-button cancellation defers to the shared adapter when it is installed.
Legacy Solo lifecycle handling remains available when that adapter is absent.
The actual steering finger still triggers the intended pause; stale capture loss
cannot cause another pause, and fresh input belongs only to its seat.

The couch baseline is5/6 on each runtime. Its corrected seven-file input,
navigation, preference and real-core cohort passes113/113 on Node20.19.5 and22.22.2.
The separate Solo mounted-host reproducer fails at active-finger ownership on
Node22; the corrected complete host and legacy-input files pass66/66 on both
runtimes. All final runs have zero skips. These are separate source compositions,
not a single combined release qualification. The manifests bind each loaded
tracked module to its exact candidate or frozen base bytes.

The initial couch run was limited to384MiB and terminated on a navigation test's
allocation after103 passing cases. The same complete cohort passes at a bounded
1024MiB. This was an explicit test-resource limit, not a reported browser crash.
Its original log and hash are retained; no navigation test was removed. Solo used
a768MiB limit. An early finite fixture queried a dataset-only value as an attribute;
its corrected button lookup retains actual child-button event bubbling.

No asset hydration, distribution build, version bump, PR or deployment is included.
After accepted v0.78, rebase these changes with the held device/Team work and run
final shared-input/audio overlap, browser journeys and public gates. Physical
multitouch/iPhone/Steam Deck acceptance remains separate.

See [behavior and research rationale](../../couch-touch-ownership.md) and the
runtime-maintainer skill's shared touch cancellation prompt.
