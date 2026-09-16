# P07 Campaign Tour — internal source checkpoint

This package implements the approved Couch format contract on base `1f3b9995af43879d54fb7b0053846f0723e2e069`, tree `cd4fa75395f045ffa02375e1784072044c2020d4`. It adds One race as the default, explicit First to two and authored Campaign tour; it preserves the earlier retained-Results transaction. The [guide](../../../couch-campaign-tour.md) explains player behavior and ownership.

**This is not P07 completion or a public release.** There is no native/browser or physical-device execution in this package. Current-P02 composition, full-source gates, public/offline acceptance, Solo/Team continuation and remaining reward/story work stay open. The runtime and test files are identified by exact hashes in [evidence.json](evidence.json); later documentation does not change the tested production bytes.

## Final bounded qualification

Nine complete test files passed **149/149 on Node 22.22.2** and **149/149 on Node 20.19.5**, with zero failures, cancellations, skips or TODOs. They ran serially in 324.18 and 346.94 seconds. Before and after each runtime, all 360 admitted inputs (73,873,423 bytes), canonical index and runtime binaries were unchanged. The complete commands, raw TAP logs, authority and input checks are preserved once each in [evidence.zip](evidence.zip).

The cases use real input, duel ticks and accepted terminal results. They cover default/explicit formats, real wins and draws, authored order, distinct routing and original images, rematch credit replacement, final completion without wrapping, failed/cancelled Next, cleanup reentry and focus/foreground vetoes. Installed tests check independent campaign groups, exact first-to-second original adoption, Ready/fresh Start, and removed-owner refusal without discarding earned Results or substituting a different map. The existing chapter test separately verifies an explicit setup transition between real wide and legacy owners; a tour does not mix their simulation versions.

The DOM, image-decode scheduling and IndexedDB boundaries are finite models. Original bytes, metadata, hashes, chapter readers, pointer transactions and core outcomes use their production APIs. The removal case models another owner having committed a pointer change; it does not certify a player-facing uninstall workflow. Tests assert no additional profile/content writes beyond their declared fixture setup or external transaction.

## Retained failures and corrections

The first eight-file Node 22 run completed at **130/132**. The host fixture incorrectly widened one legacy map without changing its version, so the module failed validation before any of its ten new host cases ran. A separate installed-owner test reached the successful Next refusal but used an `onclick`-only helper for Reset's event listener. Neither failure was hidden or counted as passing coverage.

The correction keeps every tour fixture at its campaign's legal 48×36 version, shifts Bravo's authored route by two cells and retains its distinct original. Reset uses the real click event and the existing readiness predicate. No production validator, core, deadlines, scoring or ownership rule changed. The ninth unchanged chapter file qualifies the separate cross-campaign grid transition. All ten new host cases actually run in the final passing pair.

`trace/host-pair-01/failed-fixture-originals/` contains the exact failed test bytes. They were reconstructed after the run by reversing only the known edits, then checked byte-for-byte against the pre-run held03 hashes; its README states that provenance. The earlier 16-case pure-owner pair is retained with its predecessor source identity and is not added to the final 149 total. The initial finite-intake refusal is preparation history, not a product failure.

## Archive map and reproduction

The archive contains 57 exact original files totaling 3,060,085 bytes, compressed to 889,296 bytes. Its SHA-256 is `a95e0240c4c0bef98377af96b08b67c88fccc701429e0632ed007e2c3b565888`. Each member has an original location, byte count and digest in the manifest. ZIP timestamps are fixed packaging metadata; execution times stay in original records.

| Archive member                         | Meaning                                                                |
| -------------------------------------- | ---------------------------------------------------------------------- |
| `trace/host-source-held-04.json`       | Eleven exact changed runtime/test files for the final qualification.   |
| `trace/host-inputs-held04.json`        | Full finite input inventory.                                           |
| `trace/host-pair-02/`                  | Final authority, before/after checks, raw logs and passing receipt.    |
| `trace/host-pair-01/`                  | Failed run, unchanged post-run source check and exact failed fixtures. |
| `trace/fixture-correction-held04.diff` | The two reviewed fixture corrections.                                  |
| `trace/pure-pair-01/`                  | Earlier isolated pure-owner evidence.                                  |
| `package/package.py`                   | Packaging and exact-byte verification procedure.                       |

Read the archived commands for local reproduction against these exact source bodies. Cache paths and runtime locations in the historical scripts are provenance, not a promise that an arbitrary fresh workspace already contains the admitted fixtures. Preserve all source/version boundaries when adapting the workflow. No Git version bump, release tag or deployment is created by this internal package.
