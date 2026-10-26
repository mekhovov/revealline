# Exact receiver-noise loop optimization

The Demo CPU profile identified recurring receiver-noise work. Commit
`a159dd2ed12f02f0abcfc0b2d1e31bd564f5c61e` removes per-row temporary arrays,
hoists row constants and computes the same RGB noise offset once per pixel.
It preserves the random-number sequence, arithmetic grouping, channel write
order, clamping and validation, including overlapping input/output views. It
adds no pixel buffers and leaves playback, concealment and visual quality intact.

The bounded Node 22.22.2 experiment finished in 2.302 seconds on the development
Mac. Each size used nine alternating-order pairs; all 27 pairs favored the
optimized loop. All paired attempts and exact source hashes are in
[the evidence receipt](solo-noise-loop.json).

| Image dimensions | Old median per call | New median per call | Reduction |
| ---------------- | ------------------: | ------------------: | --------: |
| 512 × 512        |             2.846ms |             2.227ms |    21.75% |
| 512 × 288        |             1.605ms |             1.257ms |    21.71% |
| 160 × 120        |             0.214ms |             0.166ms |    22.53% |

The experiment checked 78 exact pixel/alias outputs and 18 rejected-input cases
against the retained old implementation. The four complete receiver, Demo
picture, menu-signal and renderer test files passed 49/49; lint and formatting
checks passed. The committed regression uses compact frozen-output digests so
a pixel mismatch cannot generate an unbounded buffer diff.

These measurements establish a reduction in this loop's Node CPU cost. They
do not establish browser frame improvement, reduced device temperature or
iPhone/SteamDeck acceptance. A Demo adaptive-quality policy was not added:
the profile showed recurring cost without demonstrating sustained callback
overload. Earlier 14ac package and native evidence retain their original scope.
