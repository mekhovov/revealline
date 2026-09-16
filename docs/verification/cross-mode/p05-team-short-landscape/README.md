# Team short-landscape checkpoint

This CSS-only candidate follows committed composition
`1f3b9995af43879d54fb7b0053846f0723e2e069`. Its runtime is the tested composition
tree `a20e424d31331221791ae429c2b8bcc39cfee5af` with one changed file:
`game/couch/relay-rescue.css`, 18,395 bytes, SHA-256
`77f7ffa62432a8d27143bdd5455f15e2df4e70eca04818e17ac1573b5ac75afe`.
No host, input, core, markup, version, storage or content identity changed.

The compact live layout applies at landscape widths of at least 640 CSS pixels
and heights up to 500 CSS pixels. It budgets the HUD, objective, arena and Pause
against viewport height whether touch controls are hidden or shown. Explicit
shrinkable inner tracks contain the canvas at its intrinsic 2:1 ratio. Touch
gutters use the ability labels' intrinsic width, preserving Large text, the
centred direction cross and nominal 44 px targets. A matching-specificity width
rule lets the arena use its actual centre column. Lobby and viewport-bounded
pause ownership remain unchanged.

## Source and retained failures

The original combined-source observation at actual 760×351 showed a 732×366
canvas that could not fit with the HUD. Canvas focus already used
`preventScroll`; the source of the recorded earlier scroll was not established.
The correction changes layout only.

| Source                          | Native result                                                                                                                                                                            | Correction that followed                                        |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Held01 `4c3fc900`, origin 61867 | Actual 844×390, rather than the requested 760×351. Outer grid fit, but an implicit inner row grew to 408.56 px inside a 251.15 px arena row; the canvas overlapped the footer.           | Explicit shrinkable inner grid tracks and canvas minima.        |
| Held02 `13cdb8d4`, origin 62425 | Standard/hidden fit at actual 760×351. Large/shown ability labels wrapped in 68 px buttons, making a 206.07 px pad stack exceed its 190.53 px row. Centre hits alone missed the overlap. | Intrinsic label/gutter widths without smaller fonts or targets. |
| Held03 `e8b52b95`, origin 63124 | Standard/hidden and Large/shown fit at 760×351. At 844×390 an older touch-specific rule still capped the arena wrapper at 240 px.                                                        | One matching-specificity `width: 100%` declaration.             |
| Held04 `77f7ffa6`, origin 63822 | All 16 rendered geometry/hit cases passed at the measured dimensions.                                                                                                                    | Two clean external Large/shown cases also passed; scope below.  |

Each predecessor's original source, helper/configuration, binding, observations
and source-response checks is retained. Every origin freezes its one admitted
CSS body in memory and reads all other bodies from exact Git objects; later
working-file or branch changes cannot retarget it. Ten source responses matched
before and after each root-native boundary. The final source checks preceded
documentation work.

The temporary candidate commit `33f7335` hosted the frozen `a20e` tree without
pretending to be final integration history. After root native closure, the
isolated branch adopted committed parent `1f3b9995`; the complete game trees were
verified identical and held04 CSS stayed exact. The adoption receipt preserves
both identities and the unchanged preview provenance.

## Actual verification

No mirrored CSS tests or new product test runs were added. Formatting and changed
whitespace checks passed. The inherited composition's 19-file 414/414 pair on
each supported Node runtime qualifies its unchanged source, not this candidate's
rendered fit; the earlier 400/414 intake diagnostic remains in that composition's
own evidence.

Root's held04 matrix covers Relay Yard and First Connection, actual 760×351 and
844×390 viewports, Standard and Large text, and hidden and shown pads: 16 of 16
cases passed. The measured DPR was about 0.9 at the recorded browser zoom. Each
canvas retained 2:1 and full bounds; both player HUDs, objective and Pause fit.
Shown pad stacks stayed within their row without HUD/footer overlap. All 13
visible buttons passed centre and four inset hit points, with nominal 44 px
targets subject to measured fractional rounding.

Seventeen geometry snapshots include a separate 390×844 portrait spot-check.
Four native events record both players' pointer directions showing exposed
lines, both Support cooldowns, and Pause → portrait resize → explicit Resume.
The attempt lost a reserve; there is no win, capture-completion or rescue claim.
The portrait image and earlier banded in-app captures do not establish a clean
landscape visual matrix.

The independent clean-image review then covered Relay Yard at 760×351 and First
Connection at 844×390, both Large/shown at DPR 1. Both original PNGs were
personally inspected by the external owner and root: the whole arena, HUD,
objective, footer and pads fit without compositor bands. All 13 controls passed
44 px and five-point hit checks. These two initial views supplement the geometry
matrix; they do not qualify later actor, objective or revealed-artwork states.

R1 remains `FAILED_RETAINED`: after its successful Relay capture and Pause, later
setup traversal exceeded the 4 MiB observation metadata cap. R2 used a fresh
bounded browser to finish only the missing First Connection case. Its initial
execution label still requests visual review; the later combined review closes
that review. The original labels, trace, source bindings, helpers and both PNGs
are retained. These external live windows were each under 0.4 seconds and did
not steer or activate abilities. Root's separate four-event run supplies the
pointer-action observations above. Retained cancelled fetches and a favicon
404 do not support a blanket network-clean claim.

## Retained evidence

[evidence.json](evidence.json) maps each exact original to one unique member of
[evidence.zip](evidence.zip), recording decoded length and SHA-256. It includes
all four candidate source/preview boundaries, the original composition failure,
the root geometry and corrected assessment, and all 13 external R1/R2 originals
plus their manifest. The preliminary retention plan is preserved too. ZIP
round-trip checks compare every decoded member against its current original;
there are no rewritten historical reports or discarded failure labels.

## Boundaries

This is a scoped layout correction, not P05 or another phase acceptance. It does
not establish physical touch/controller behavior, every viewport/zoom/safe-area
combination, all edition/import artwork, full Team completion or public release.
The live layout's 640–500 media bounds are implementation scope, not certification
of every dimension in that interval. Current-P02 registry rebinding and broader
composition checks remain separate. The [display guide](../../../shared-display-preferences.md)
describes the shared preference contract; historical reports retain their own
source and native limits.
