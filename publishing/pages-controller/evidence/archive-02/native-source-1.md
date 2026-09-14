# v0.32 archive acceptance

Archive-02 now serves v0.32 without changing its frozen game. [Archive PR 3](https://github.com/mekhovov/revealline-archive-02/pull/3) merged as `aed15ad7cedbdf42ef91f054f0d25c9b076c3ec9`; workflow `34776855345` and deployment `6425362041` succeeded. The independent public audit matched all **1,777 files / 731,963,905 bytes**, including nine hidden files and all 1,535 prior bodies, with no retries or failures.

The actual browser journey began on the old main prefix with an unfinished cut paused at **0% / 0 points / three lives / 2:58**. Opening the canonical archive URL and choosing Continue restored that cut paused. Explicit Resume, without a new direction, completed **51.5% / 12,060 / three lives / 2:56** and stopped the craft at safe ground. An earlier earned Orchard picture remained viewable. Its Gold result was not earned by this test cut.

After an explicit blank-page unload, reopening the canonical URL and choosing Continue restored that same completed capture paused. Query and fragment were retained; browser logs were empty. A cache verification reported **223 verified files / 45,287,721 bytes**, with no missing or corrupt files. Internet remained enabled, so this is cache verification and online reopening, not a stopped-network cold test.

Two earlier outcomes remain recorded: initial chapter installation stayed pending until normal navigation recovered its installed state; initial offline preparation timed out. One offline retry after disk cleanup succeeded, without establishing why the first attempt failed. Historical v0.31 offline/music limitations remain separate.

This accepts allocation `f82060fd3efccbf593961d3923cdeae9be0e04484bcd2b19c115dbc34a277a1a` for the next main release. Its subsequent old-prefix forwarding/worker transition still requires a post-deployment browser check. Archive capacity remains 800,000,000 bytes; main capacity remains 950,000,000 bytes.

Local root receipt: `.cache/round46/archive032-native/receipt.json`, **8,273 bytes**, SHA-256 `58e213738bef5b1c1754cf469daa7e9e06a7c1433a8dc442d59d1ea9ac29663f`. Public byte-audit receipt: `.cache/round46/archive02-expand-032/public-http-receipt-lagrange.json`, SHA-256 `7abfe0f0930a0154bb0b5ab06114ab453904becf5ed1d3cdfb9f8145807b09e8`.
