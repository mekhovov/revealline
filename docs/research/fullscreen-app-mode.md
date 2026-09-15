# Fullscreen and installed-game delivery

Researched 2026-09-14 for the browser release. The implementation deliberately combines two user-controlled paths instead of trying to hide browser chrome by scrolling or browser sniffing.

| Player environment                              | Delivery behavior                                                                                                                                        |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop browser, Steam Deck browser, TV browser | The visible Fullscreen button uses the standard Fullscreen API after a direct player gesture. Escape or the browser's own exit action remains available. |
| Installed Android game                          | The web-app manifest requests `fullscreen`, which provides the immersive game surface when the platform supports it.                                     |
| Installed desktop or iPadOS game                | Platforms that do not support PWA fullscreen fall back to the manifest's `standalone` app window, without normal browser navigation chrome.              |
| iPhone/iPad Home Screen game                    | Apple standalone metadata accompanies the manifest, allowing the Home Screen launch to open as a web app. Safe-area-aware layout remains in use.         |
| Unsupported or embedded browser                 | The fullscreen button is absent; the existing responsive layout remains usable and does not pretend fullscreen succeeded.                                |

The Fullscreen API requires transient user activation, so it is only invoked from the button's direct click handler. It is not requested at launch or from a controller event. The game does not lock orientation: players can use portrait touch controls or landscape/controller play, and platform/browser exit controls are never suppressed.

The adapter reports browser fullscreen and installed fullscreen/standalone display modes (including iOS Home Screen standalone) through `data-game-fullscreen`. The current shared responsive layout continues to own safe areas, header reserves and D-pad clearance. The earlier overlay CSS was not adopted during the cross-mode rebase: it removed control gutters, obscured playable cells and reduced telemetry to 10px. P03/P08 of the [cross-mode execution register](../cross-mode-execution.md) qualify any later layout changes. Adapter tests establish display-state behavior, not physical-device fullscreen or layout acceptance.

Sources: [MDN Fullscreen API](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen), [web.dev PWA display modes](https://web.dev/learn/pwa/app-design), and [Apple Safari web-app configuration](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html).
