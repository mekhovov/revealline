# Recorded section replay and practice

A completed or interrupted World Studio attempt offers **Watch this section**
next to section practice. Both actions select the largest measured loss against a
compatible personal best, or the longest recorded section when no comparison is
available. Duration alone is not described as a weak flying skill.

Playback starts at the exact recorded entry: original course identity, response
settings, attitude, momentum, actor state and command tick are reconstructed by
replaying the verified prefix. It stops at that objective's verified completion
boundary. If the recording ends earlier, the screen explicitly calls it an
unfinished section; it does not present it as a successful demonstration.

The end screen offers **Practise this section**, **Watch again**, and **Fly full
challenge**. Practice restores the same entry and requires deliberate arming and
input pickup. Neither section playback nor practice creates records, medals,
recovery evidence or playlist progress. Changing appearance does not silently
replace the recorded world. Changing mode requires compatible recorded evidence;
missing, invalid or unreached sections fall back to labelled unscored practice
from the original launch point.

The original Academy v1 playback remains unchanged. This increment adds the
section learning loop for v2 World Studio courses; it does not add new levels or
change objective identities, flight physics, recordings or medal thresholds.

## Verification

Run the functional qualifier and generate the real-host browser fixture:

```sh
node scripts/qualify-fpv-section-replay.mjs --output docs/fpv-section-replay-functional-verification.json
node scripts/prepare-fpv-section-replay-verification.mjs --out dist/fpv-section-replay-verification-source-01
```

The browser fixture uses production HTML/runtime, isolated storage and controlled
inputs. Its device cases verify software behavior, not a physical radio, phone or
Steam Deck. Additional unit coverage stays in H/R7. Human feedback is pending and
nonblocking for implementation under the owner's 3 October instruction.

Functional qualification passes 7/7 groups: 154 installed v2 proofs, 312,948
recorded ticks and all 768 recorded sections, including 312 actor-bearing and
20 combat sections. The unchanged checkpoint contract also passes its 716 exact
entry restorations and 615 safe fallbacks. Receipts:
[section replay](fpv-section-replay-functional-verification.json) and
[checkpoint regression](evidence/fpv-section-checkpoint-regression.json).

The actual production-host browser fixture passes **51/51** checks with real
WebGL: result selection, slow playback, watch/practice/again, pause/reset,
interrupted/invalid evidence, superseded preparation, persistence isolation,
English/Ukrainian and 390px layout. See
[source browser receipt](fpv-section-replay-browser-verification.json).
These controlled cases do not measure physical controller latency or FPS.

Frozen candidate `c5b7b3771` (including Themes #967) passed all three optional admissions, exact committed
inputs/ZIP members and two byte-identical builds. World Studio is 99 source files /
14,423,222 bytes, within 104 files / 16 MiB. The actual frozen-package browser
fixture also passes **51/51** checks. See [package receipt](fpv-section-replay-package-verification.json)
and [packaged browser receipt](fpv-section-replay-packaged-browser-verification.json).
Later source reconciliation is recorded separately in the delivery checkpoint.
A local player build or open PR does not establish public availability.
