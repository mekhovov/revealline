# Team briefing guidance

Team setup, launch and paused Help advice use `coopArenaGuidance` from `game/couch/coop-briefing.mjs`. The helper reads already validated level data and cut policy; it never changes the recipe or simulation. Setup uses the explicitly selected level/configuration. Launch uses the accepted run’s level/configuration so an inactive setup draft cannot describe another attempt.

Hunter charge/recovery advice appears only with Hunters. Drifter patrol advice appears only with Drifters. Every authored stronghold has an emitter, including strongholds in a territory challenge. Those levels need spark warnings and relay instructions even though victory is measured by coverage. Do not promise that cores can be skipped: a 100% coverage target may require clearing them. Multi-core goals use a plural briefing heading; the existing exact objective/HUD remains authoritative.

The same Support copy populates both setup and paused Help; Start refreshes it from the accepted run and preserves the crawling explanation. Support copy describes slowing enemies and intercepting sparks only where those targets exist. Rescue guidance remains available on every arena: the rescuer must be on safe ground near a downed partner and hold Support without steering. The one-second hold avoids spending a team reserve. Enemy-free does not mean failure-free: self-intersection and ordinary movement rules remain unchanged.

## Maintenance verification

Verify enemy-free, Hunter-only, Drifter-only and mixed arenas, with and without relay emitters, under joint and independent cuts. Include coverage maps with relay cores and maps with multiple required cores. Confirm actual setup, Start, paused Help, Retry and Next messages. Read Help with the keyboard, leave reading with Escape, then close Help; focus returns to the visible Help opener and the clock stays paused. Return to the starter arenas and check their guidance again. Preparation cancellation must preserve the current attempt and its picture.

Keep the existing actual-host goal, HUD and continuation assertions. Pure-copy cases establish conditional text and input immutability only; they cannot establish host wiring, native readability, physical input or release readiness. Inspect expanded briefing text with Large/Plain preferences and portrait/short-landscape viewports. Qualify the added module in the published and offline build before release acceptance.
