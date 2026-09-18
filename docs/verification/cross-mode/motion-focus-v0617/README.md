# v0.61.7 — Motion controls stay visible after rotation

Rotating Motion Lab from portrait to short landscape now brings the already-focused control back into view, including when the entire settings panel moved outside the viewport. Its label/value group receives 8 px of vertical scroll clearance so the focus outline is visible. Focus, edited values and paused intent remain unchanged.

This is a bounded P03 navigation correction. It does not close P03, P05, physical-device testing or the broader release plan.

## Source and implementation

- Parent: `4fd8e2dac4fdc851d0d2bf0b21e77162d9d405c9`; tree `d16edac0127fc96139445ae2365cc74499f80921`.
- Branch: `codex/p03-motion-focus-v0617`; package, lockfile and build configuration are synchronized to `0.61.7`.
- Runtime changes: the existing Motion display lifecycle owns one window-resize handler, and the Motion stylesheet supplies wrapper scroll margin. No global focus helper, game simulation, collision, score, media, preset or save behavior changes.
- The handler measures the viewport and the settings scrollport separately. An empty intersection still requires native scrolling. It uses the whole label/value group when that fits the scrollport and the focused control otherwise. It rejects stale focus, hidden/inert/disabled controls, background documents and departed/disposed owners. It never assigns focus or queues a future reveal.
- The Motion guide and runtime-maintainer AI skill include the corrected behavior and verification prompts.

## Preserved progression

| Candidate      | Evidence and outcome                                                                                                                                                                                                                |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial source | Actual-host regression failed because resize requested no scroll. The first correction passed 56/56 modeled cases on each Node version.                                                                                             |
| R1 native      | Real portrait-to-landscape rotation failed: the settings panel moved entirely above the viewport. The original early return treated its empty intersection as ineligible. Root observation and exact candidate bytes are preserved. |
| R2             | The actual native geometry became a regression: it failed against R1, then passed with the corrected scrollport-size calculation. Complete host/restoration files passed 57/57 on Node 20.19.5 and 22.22.2.                         |
| R2 native      | Theme Standard, Theme Large and Plain/Large kept Rotor radius focus/value and paused intent. Label/value/thumb were visible; the bottom focus outline still clipped at the panel edge.                                              |
| R3 native      | Only the wrapper's 8 px vertical scroll margin was added. Root checked Standard and Large at 390×844 → 844×390; focus stayed on Rotor radius at 27%, preview stayed paused, and top/bottom focus outlines were visible.             |

The authoritative native records are [R1](originals/root-native-r1.json), [R2](originals/root-native-r2.json) and [R3](originals/root-native-r3.json). Original frozen server bindings prove which runtime/CSS bytes each observation used. Screenshots were displayed inline; no exported images or fabricated hashes are claimed.

## Verification boundaries

The full 57-case Motion host/restoration cohorts ran on the final JavaScript and test bytes before the CSS-only R3 correction and version/documentation integration. Those files remain exact. The R3 stylesheet passed a narrow exact-change assertion and format check; native geometry establishes its vertical result. No unnecessary repeat of the DOM cohorts is claimed. Scoped lint, formatting, diff/index checks and all original command outputs are retained.

Read-only production-source tracing found no changed runtime path among the existing recipe fingerprint inputs. Motion display and styles are already runtime build inputs. No generated illustration, font, sprite or production recipe revision is required. Version availability was checked through exact local/remote refs and a release-descriptor 404 before the local bump.

The local preview serves immutable parent Git objects plus explicitly pinned overrides. Its GET-only smoke verified 152 entry/dependency/font/art responses before the correction, and the new frozen server responses were separately verified. This does not constitute public deployment, a full-game/browser qualification or offline acceptance.

`evidence-manifest.json` indexes every retained original's bytes and SHA-256. Historical candidate readiness files describe their own earlier scopes; they are not final-release approvals. Live server logs were copied as bounded point-in-time snapshots, not shutdown receipts.

## Still required

- Root line/hunk review, complete source gates/build, exact-source qualification, source PR, immutable release and deployed verification.
- Minor right-edge focus-outline clipping remains open; this correction addresses vertical clearance.
- Plain/Large native evidence is R2's predecessor observation on identical JavaScript; R3 Plain was not repeated.
- Physical rotation, touch/controller, assistive technology, visual-viewport keyboard behavior, zoom and the complete Motion field matrix remain separate.
- Continue the approved order: P03 navigation, P05 presentation, P08-A artwork/actors, P08-B feedback, P09 challenge, P07 rewards. This correction does not reorder those parent phases.
