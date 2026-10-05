# Native interface review · 2026-10-05

Source runtime: `http://127.0.0.1:8888/game/overflight/` in the Codex in-app browser on the local macOS host. Screenshot viewport: 1280 × 720. Exact browser and OS build were not exposed by the browser test surface and are not asserted here. JPEG bytes are saved with `.jpg` names. These screenshots are interface evidence, not performance trials or human playtests.

Verified through ordinary visible controls:

- Survivor home → shared encounter library → Crosswinds → active gameplay → Pause → Settings.
- Raid operation link → shared encounter library → Patrol Break → active gameplay → Pause → Settings → How to play.
- Both operation Settings retain Sound, Creator, Asset, Motion, Voice, Theme and Music entry points. Creator links select the correct mode.
- Standard/Veteran choices are visible. Official encounter cards show their selected difficulty and retain canonical numbering.
- Ukrainian Raid home and encounter browser localize operation names, actions and encounter names; links retain `lang=uk`.
- Role previews use prepared native drone, soldier and vehicle sprites with facing/open-armor geometry.
- No errors or warnings were reported by the tab developer log during these flows.
- The fresh test origin started muted and remained muted. No saved audio, display, gore, theme, character or controller preference was changed. Ukrainian was selected by non-persistent URL context.

The battlefield recording route uses the existing `reviewBuild=breaker` public review harness, started manually through the native briefing. It is explicitly labeled automated review and uses ordinary movement/boost inputs.

The automated breaker review completed in 00:59 (198 destroyed, 95,100 score, best chain 60, seven armor breaks, no hull damage). This verifies completion and native results; an omniscient deterministic pilot does not establish ordinary-player balance. A second source reload captured the final shortened cache banner in `raid-battlefield-final-en.jpg`, showing three-lane attack geometry, facing shields and HUD at Sector 3. The earlier `raid-battlefield-en.jpg` also shows the live carrier armor indicator before that small banner wording change.

Verified the final Settings → Choose your drone action reaches the existing native Flight Deck with all seven airframes available before a sortie. No character was changed. The temporary verification tab was closed after capture; the source server remains owned by the parent task.
