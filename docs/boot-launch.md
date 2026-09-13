# Native launch and startup failures

The generated distribution root opens the current game title directly. The optional project overview, pack cards and release picker remain at `site/about.html`; they are no longer a stop before playing. Source checkout preview is `/site/`, while `/game/` remains the direct game address.

About's build picker prefers a validated `canonicalPlay` URL when present and otherwise uses the version-relative `play` route. Only bounded HTTPS archive-game URLs or version-relative game paths are accepted; script schemes, credentials, traversal and arbitrary destinations are rejected. Choosing a build never navigates until the player activates **Open build**. Old bridge routes remain usable when no canonical entry is supplied.

`site/launch.mjs` forwards HTTP(S) entry pages to the game on the same origin using its own script URL. This preserves a Pages project prefix and nested frozen-release paths. Query parameters and the fragment survive forwarding. A downloaded `file://` page never redirects externally; its **Play online** link is an explicit player action. The static page explains the local-server alternative.

`game/index.html` starts with a small inline dark styling guard. Until `data-boot-state` is `ready`, every direct body child except the launch screen and scripts is concealed. Existing game controls are also inert. This prevents an empty mission selector, unfinished HUD or legacy webpage layout from appearing while startup is pending or broken. The static launch screen and its links remain usable when JavaScript is disabled or the bootstrap itself cannot be downloaded.

`game/boot.mjs` is deliberately loaded as a **classic external script**, despite the file extension. Its dependency-free launch and failure UI therefore works before ES-module imports, including directly opened files. After the document and renderer arrive, it imports `app.mjs` and catches import rejection. A renderer or stylesheet load error also preserves the launch screen. Slow loading updates its message after 15 seconds without inventing an error or retrying in a loop.

The game host calls `RevealLineBoot.ready()` only on successful setup and `fail(error)` on initialization failure. Readiness removes the inert guard; failure never does. The host refreshes reading/focus after revealing the native menu, since controls concealed during initialization cannot receive normal browser focus. Scene updates remain blocked while a boot controller exists but its state is not ready. No simulation, replay format or score authority is changed.

The launch screen uses ordinary links and expandable local-server guidance, keyboard direction navigation and neutral-gated standard controller input. Native keyboard or pointer use prevents an old held controller direction from reclaiming focus. The boot controller stops its scheduler on readiness. Its static pixel bars do not need motion effects. Error help is allowed to scroll even after a partial game-shell setup.

The existing public/native Content Security Policy permits the external scripts and inline **styles** used here. There is no inline JavaScript, eval, automatic external redirect or new file-system permission. The build includes and hashes boot assets in the same offline inventory as the rest of the edition; historical release artifacts are not rewritten. Native platform runtime qualification remains separate.

## Focused verification

```sh
node --test game/test/boot.test.mjs game/test/boot-host.test.mjs game/test/boot-build.test.mjs game/test/content-launch.test.mjs
```

The classic-script VM checks exercise the actual boot source with finite DOM/time/controller boundaries. Its import-failure case deliberately rejects through the VM loader and is not browser network evidence. Actual-app host checks cover failed content initialization retaining inert controls and saved bytes, plus a successful paused title. Build checks use actual entry/boot/site source with small unrelated dependency fixtures, native policy transformation, reproducible output and exact offline inventory hashes. They do not certify raster layout, disabled-JavaScript browser behavior or physical controllers.

Before a release, inspect the ordinary browser at the generated root and direct game URL, a directly opened `game/index.html`, disabled JavaScript, and an actual blocked/missing game module. Confirm dark first paint, no usable game controls on failure, readable/scrollable launch help, and working keyboard focus after successful startup. Repeat at narrow portrait and short landscape sizes. Do not equate these checks with physical-device or native-store qualification.

Round 38's actual HTTP browser check reached the native title with ready state and working focus. The in-app browser's security policy denied direct `file://` navigation, so the actual-file browser check remains unavailable; the passing file-path checks are finite modeled evidence only. Do not bypass that restriction through another browser surface or protocol. A separately owned HTTP fixture with a refused module can qualify a network-failure path, but does not prove direct-file behavior or disabled-JavaScript rendering.

## Authoring and device contract

Every theme, content pack and interface change must preserve the same launch/error surface and the separation between the native player menus and authoring/marketing tools. A missing image or failed module is not permission to expose empty selectors, a legacy flight deck or placeholder controls. New visuals must preserve readable focus, working links, contrast, safe-area padding and scrollable failure help, including a partially initialized shell.

Derive available gameplay actions and their hints from the **effective authored action policy**. Direction-only Arcade editions must not advertise manual abilities, supply collection or Boost merely because a selected class has those recipes; classic contact pickups remain separate. Tactical and archived editions retain their authored actions and identities. Do not rewrite old replays, saved runs or historical proof inputs when changing a current edition's teaching text or menu presentation.

Keep keyboard, pointer, touch and controller access explicit. Confirm/Back and focused menu controls must not issue flight commands; old held inputs cannot reclaim control after a newer device input. Refresh focus and reading semantics after hidden launch UI becomes visible. Check both turning policies and the actual active control layout. Mouse coordinates, a resized desktop viewport and simulated Gamepad samples are different evidence from real phone/controller operation.

For each advertised device class, record the browser/OS, CSS viewport, input used, readable target/text dimensions and the journey exercised. Include narrow portrait, short landscape, desktop and handheld layouts; test safe areas and Large text. Record failures and unavailable hardware honestly. A canvas fixture, generated picture, prepared soundtrack file, passing source test or native wrapper build cannot stand in for browser delivery, listening, physical input or player enjoyment.
