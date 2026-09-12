# v0.19 public deployment

The deployment task **Deploy RevealLine to GitHub Pages** reported successful publication and public browser acceptance on 12 September 2026. This record attributes those checks to that task; it does not describe a second root-agent public-browser run. The task ID is `01a0961b-8c02-70c0-a4d3-0917cc9fe22c` and its completed turn is `01a096df-4740-79c2-8b2e-bb36f0a46a3e`.

Play [Reveal / Line](https://mekhovov.github.io/revealline/). [GitHub Actions run 34711246234](https://github.com/mekhovov/revealline/actions/runs/34711246234) passed all deployment gates, including 1,667 tests. The owner reported remote `main` at `9b97ea4ab0fa43c583c060d79f6806a6ec599b43`; annotated tag `v0.19.0` is object `b12479e46307dbc6178ee4189cba6940a6baba73`, peeling to that commit. Public build metadata identifies version `0.19.0` and that exact source revision. The frozen local archive carries label `v0.19.0`; matching source does not claim identical public build metadata or shared browser storage channels.

The reported public checks were:

- Landing, catalog and the archived v0.18 game returned HTTP 200. The version switcher retained access to that older game.
- Landing-page Night Shift selection generated the exact route, installed the pack and autoplayed Midnight Channel. In-game Pack/Level selections matched and the game canvas had focus.
- Save & pause followed by Export current attempt downloaded a valid `xonix-session.v1` file.
- Removing Night Shift preserved its saved flight. Export saved attempt produced a verified replay-only rescue with an explicit matching-campaign-required message. Reinstalling Night Shift restored the exact paused flight.
- Selecting uninstalled Living Threads inside the game installed it and selected Petals at Dawn at Ready. An explicit Start then began play with canvas focus. Pack selections persisted locally.
- Browser console and page errors remained empty for these journeys. No untracked root reports or external concept images were staged by the deployment owner.

Auto-deployment remains enabled for future pushes to `main`. The owner reported a nonblocking GitHub action-runtime deprecation warning; the workflow still succeeded. This report does not establish physical controller/touch compatibility, native signing/store acceptance, permanent browser-storage retention or human enjoyment.

The [local six source gates](v019-source-gates.md), [packaged offline browser journey](v019-browser.md) and [independent archived-source/candidate comparison](v019-integrity.md) identify their distinct evidence. The public-owner checks above supplement those records without relabeling earlier release failures.
