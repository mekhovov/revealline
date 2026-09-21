# Journey connection recovery proof

Source: `7058a84d` on the isolated integration follow-up branch.

The same23-case cohort was run with the unchanged8cff backend and with the corrected backend. Baseline:16pass/7fail. Corrected:23pass/0fail on Node20.19.5 and Node22.22.2, no skipped/cancelled cases. This includes the eight new connection-recovery tests, existing Journey tests and backup tests. Every loaded tracked module was verified against its exact Git blob; inventories and transcript hashes are retained. A narrow loader redirects only the new test’s imports to the unchanged base and replaces only the tested profile module with the exact committed candidate bytes. No unrelated dirty checkout source is used.

Checks preserve explicit failure followed by retry, unsaved clear availability, exactly one successful persistence write, stale connection/request ownership, concurrent readers and normal quota failure. Scoped ESLint, formatting and whitespace checks pass. No profile format or simulation identity changes. The runtime maintainer skill and storage guide are updated with these boundaries.

These are finite IndexedDB observations, not native force-close injection, device tests or whole-source acceptance. The disk-constrained full source run remains interrupted, and no build, version, PR or public deployment is allocated by this correction. Integrate after the current release queue and verify the final intended source through required gates.
