# P03-E: Team lobby initial focus

This internal P03 work package gives an untouched foreground Team page one visible enabled default after ready. It does not start play or claim ongoing controller focus. Deliberate focus, background/error/recovery state and later frames cannot trigger a new automatic handoff.

Root observed the held source at a 1393 × 1348 desktop viewport: fresh lobby → Start focused; Enter → playing canvas; Escape → Resume; Tab, Tab, Enter → Change setup and Start focused; Shift+Tab → Challenge. [Original native observations](native-events.json) retain the snapshots and read-only focus facts. The preview used `return=versus`; it is not a frozen or public release.

The three complete focused suites passed **102/102 on Node 20.19.5 and Node 22.22.2**, with zero failures, cancellations or skips. They include hidden/disabled/inert/default filtering, intentional/preload/recovery focus, foreground loss, boot failure, and preservation of ordinary lobby/pause navigation. [Verification](verification.json) pins runtime/test source and the raw logs, including the initial incomplete diagnostic-heavy baseline and subsequent bounded negative baseline. ESLint, Prettier and Git whitespace checks passed.

Native preload/error/background cases, physical controllers, touch, phones and Safari remain unverified here. P03-A/B/C/D/E are internal work packages; P03 remains implementing. P03-D's separate story-focus commit is not merged in this branch. Combined-source, public and device qualification are still required; the public baseline remains v0.57.1.
