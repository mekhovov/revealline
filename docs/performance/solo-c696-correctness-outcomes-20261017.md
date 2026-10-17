# c696 startup, worker and idle correctness outcomes

[Run 39032516813](https://github.com/mekhovov/revealline/actions/runs/39032516813)
passes all eight declared correctness rows. The candidate is the verified
`c696af41857840359ae473558b90682f3d71f2db` package, the comparator is
`8b01991942dc764b8aa4726851699ce1985e53ae`, and tooling is
`0febd334619731adc26dfa3df78aab02991563af`. Both complete package/source/CSP
admissions pass. These observations do not cover the later controller-hint and
Boost change in `890e7cc5d`, or replace the original a6 first-eight failure.

The complete 807,272-byte artifact `12100938294` has SHA-256
`fb005ddd3ee3330573b4025a545db54354d153ff78606ead4c6f78bacbb5e152`.
All 79 members, 3,894,239 expanded bytes, have ZIP CRC and independent hash/readback
checks. Every command owner closes without forced cleanup, ambiguous identities,
survivors or resource violations. The readback is retained at
`.cache/solo-followup/c696-first-eight-observations/39032516813/analysis.json`,
37,548 bytes, SHA-256
`26fa24feb96a3f7f50ff247251ed6c5f5f9842c6c3d9262b803c4594d2d752fe`.

| Declared checks                                      | Result                                                                                                                                                    |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static MP3 worker, Chromium and WebKit               | Valid input matches canonical metadata; malformed and truncated inputs reject; gameplay remains running; no main-thread fallback or pending bytes remain. |
| Paused/covered board, Chromium and WebKit            | Identical retained pixels, zero clears/draws, and continued controller polls. Resize causes one new submission; Resume restores drawing.                  |
| First 30 seconds, baseline/candidate in both engines | All four public scenarios complete and strict same-engine replays match. Cross-engine Node reconstruction mismatches remain recorded separately.          |

The worker reports also retain blocked requests to the external soundtrack
catalogue under the served `connect-src 'self'` policy. The worker URL and its
validation pass; this is not a claim that all catalogue requests were permitted
or that ordinary soundtrack playback was qualified.

The cohort was declared **performance-excluded correctness**, with CPU factor 1
and one observation per build/browser. Its raw numerical results remain:

| First-30-second row | Application work p95 | Raw numerical result              |
| ------------------- | -------------------: | --------------------------------- |
| Baseline Chromium   |               9.4 ms | Fail                              |
| Candidate Chromium  |                 3 ms | Observed-window pass              |
| Baseline WebKit     |                 8 ms | Fail                              |
| Candidate WebKit    |                 4 ms | Fail; 3.806% missed opportunities |

Candidate Chromium has no prior-running-phase interval of at least 50 ms.
Candidate WebKit's sole such interval is 197 ms and crosses running into the
public Pause; there is no fully running-to-running interval of at least 50 ms
in this observation. The transition remains in the raw cadence counts. Its
maximum measured running application work is 16 ms, with no overload pause.
This does not explain the remaining ordinary missed deadlines or clear the
unchanged 1% gate.

Both first-30-second browser contexts use 1280 × 800 CSS pixels at DPR 1. The
separate compact Full/Reduced observations use 400 × 850 at DPR 3 and a different
route. Their differences cannot establish a density, layout, decoration or
graphics-backend cause. A controlled density comparison must hold the other
conditions fixed. These hosted desktops do not qualify iPhone 17 Pro Safari,
Steam Deck OLED, graphics presentation, heat or sustained device behavior.
