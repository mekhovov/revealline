# v0.142.4 source browser check

Checked 29 September 2026 in the Codex in-app browser at 1280 × 800, against
runtime source commit `48ed40ae1731a82278d6c2bf1b5419e116ad1be1`. This is a
source check, not packaged Chrome or physical Steam Deck acceptance. The build
label is explicitly DEV because source placeholders have not been packaged.

The existing `scripts/controller-confirm-browser-fixture.mjs` served the source
with its documented input shim. Trusted browser Enter, Space and pointer events
also exposed Gamepad A snapshots; render callbacks were deferred across each
hold. No direct application action or fabricated trusted event was invoked.
Sound changed false → true for Enter, true → false for pointer, then false → true
for Space. Trace records show one guarded Gamepad commit on each release and
consumption of the pointer release click. Press state remained unchanged on down.
The native Enter tap lasted about 78 ms and the Space tap about 5 ms.

The same native-event path opened Missions once. The final DOM contained Home
under the active Missions dialog, 186 mission cards, diagnostics inside the
active `journey-chooser` dialog, and three controller help disclosures all closed
and invisible. Read-only fixture and diagnostic records are retained as
`native-events.json.gz` and `native-trace.txt.gz`.

A separate neutral-controller source view showed the campaign rail and shared
mission cards at 1280 × 800. Published-download entries correctly report that
original-picture download needs a published build. This source check does not
claim those downloads, frozen artifacts, long-hold browser interleavings, every
pause action, or physical-device acceptance. The final release train and same-
build Steam Deck short/long-press tests remain separate gates.
