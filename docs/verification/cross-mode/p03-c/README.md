# P03-C — Solo / Team return and retained flight

Status: implemented, independently reviewed and scoped-tested preparation at `cf169ebd1a214ef2c6b7eb54946860ffe58de644`. No version, public release or full P03 acceptance is claimed. P01/P02 acceptance and final integrated qualification remain required.

## Player-visible result

Ready Solo entry opens Team directly with a one-use menu return ticket. An unfinished Solo flight first offers Stay or Leave after checked save retention. Back from Team restores the exact Missions selection and focuses Team. It does not load or resume a flight; Continue remains explicit.

Unavailable menu-return storage offers a truthful title fallback. Failed flight retention never navigates automatically and requires a separate explicit Leave. The bounded record carries menu identity, never a checkpoint or arbitrary destination. Existing installed identity, save ownership, replay verification and newer-writer guards remain authoritative.

## Evidence

Nine complete test files pass **149/149 on each of Node 20.19.5 and 22.22.2**, with no skips or cancellations. Static checks and independent source review pass. Source receipts preserve earlier fixture/host-model/lint failures and the raw final log hashes; committed text copies only remove trailing whitespace.

Actual browser keyboard checks at 1393×1348 CSS pixels covered ready Solo → Missions → Mode → Team → Escape → exact Missions/Team focus. The unfinished path loaded an existing saved flight (1.5%, three lives, 2:51, 340 points), opened Team departure, chose Stay, reopened and explicitly left. Team Back restored the menu without loading the run; explicit Continue restored the same recorded HUD and paused state. Explicit Resume returned focus to the live arena. Reloading the consumed return URL opened the title with Continue focused, rather than repeating the menu return.

All eleven held source pins remained unchanged; HTTP bodies for the five affected runtime/HTML modules matched those pins. The preview uses the source overlay and exact fallback source recorded in the server receipt, not a frozen distribution. Native JSON observations are retained under `native/`.

## Remaining boundaries

- Denied storage, newer-save races, pending cancellation and readback failures have source-host evidence; they were not injected into the native browser.
- Only the observed FPV Pressure Lines / Orchard Crossing selection was used for this native pass; wider theme/campaign coverage remains in integration.
- Team lobby initially leaves focus on BODY. Escape works, but initial Start focus is a separate remaining P03 correction.
- No physical controller, touch, responsive, full-build, public or offline acceptance is implied.
