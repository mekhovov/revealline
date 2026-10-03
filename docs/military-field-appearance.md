# Military Field appearance

Select **Settings → Appearance → Military Field**. The existing theme host shares this choice with Capture Solo/Versus/Team, Snake and FPV SIM; a previously pinned attempt retains its accepted appearance until the next attempt. The appearance is also available as a base in Theme Studio, including exported/imported theme candidates. Authored/custom image replacements remain owned by their creator and are not overwritten.

The Living Routes hub also offers **Apply Military Field · Solo / Versus / Team / Snake** links. They explicitly select the complete appearance before opening that mode, including replacing a previously selected author-art override with the shared field material. A bare `appearanceFamily=military-field&appearanceRevision=r1` URL only provides the context default: existing personal appearance and authored-art preferences still take precedence.

Original overhead vehicles replace verified built-in mechanical enemy art. They retain the existing enemy's movement, contact danger, defeat conditions and audio event ownership. Unlike ordinary huntable humanoids, these mechanical enemies do **not** become harmless touch catches.

| Existing mechanical role                        | Military Field appearance    |
| ----------------------------------------------- | ---------------------------- |
| Bouncer; Team drifter                           | Field utility car            |
| Claimed-ground rover                            | Cargo truck                  |
| Border patrol; Team hunter                      | Eight-wheel armored carrier  |
| Contour patrol                                  | Scout car with radio/map kit |
| Eroder; lane boss                               | Tracked tank                 |
| Relay sentinel / inherited Team core appearance | Radar/relay truck            |
| Solid wall                                      | Concrete checkpoint block    |
| Slow terrain                                    | Rutted ground                |
| Lethal terrain                                  | Marked hazard barrier        |

Each vehicle has transparent surrounding pixels, an overhead silhouette and a small Russian tricolor. The shared actor sampler supplies heading and wheel/tread animation; Reduced effects suppresses the animation. Player FPV artwork retains its original colors and rotors. The SIM player has a blue/yellow battery marking in this appearance.

Snake uses the concrete wall material on its modern board. Retro Field intentionally keeps its own green board and chunky walls. Snake prey stays humanoid; this appearance does not create new vehicle targets or collisions.

FPV SIM uses the native articulated soldier mesh with the shared Field/Worn/Winter palettes and webbing, plus a detailed field utility car for existing vehicle actors. Its native path, shots and collision proxy remain unchanged. Additional native 3D tank, truck and radar actor models are not part of this delivery. SIM obstacle materials follow the new concrete/enamel/steel palette without moving any obstacle.

The original art takes broad visual reference from [the manufacturer's BTR-82A sheet](https://roe.ru/pdfs/pdf_1886.pdf) and [Ural vehicle photographs](https://uralaz.ru/); no photographs, logos or third-party game assets are embedded. These sources inform silhouette and equipment appearance only.

Regression scenarios are authored in `game/test/military-field-art.test.mjs`; automated suites remain waived. Scoped ESLint and Prettier passed. The shared theme validator accepted all 19 interface component roles and contrast requirements; native SIM material/profile resolution accepted the new family. Device, human play and release-package qualification are tracked by the parent delivery.
