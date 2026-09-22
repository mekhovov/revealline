# D2c/C2a — held BoardPainter combat adapter

Status: approved by independent specification review on2026-09-21. The user
authorized automatic continuation; routine approval waits are waived, not
technical review or release ownership.

## Boundary and alternatives

Release owner explicitly permits a held renderer patch against `e9434d03` while
reserving app/Versus preferences, receipts, Team host and preview enablement until
accepted v0.78 plus Team intake. The exact renderer Git blob is
`f93317fa0d48d862ecffa29d4cd3b854d04a35b9`. Our current renderer also has relay,
directional-field and newer locator adapters; none may be replaced by the older
base. Deliver an additive patch, not a copied historical renderer.

Selected: a reviewable unified patch and executable adapter tests against the exact
base, also checked against our newer renderer. Alternative: edit the shared host
now (violates ownership); alternative: another independent static renderer (does
not verify the actual board layering). Neither is selected.

## Contract

Use the approved C1 combatView and drawing functions. BoardPainter owns one bounded
sprite cache, reset on setLook/setLevel. Each draw projects combat once. Invalid
active combat throws a clear `Cannot render optional combat` diagnostic before any
canvas command or painter animation change. The future host must catch it, stop
the preview and show it; this patch alone does not satisfy that host requirement.
The Studio enabled-combat preview guard remains unchanged.

Add a cosmetic `showCombatScrap` draw option, default true. It only controls inert
scrap through C1's showScrap option; reduced effects, scale and CSS width use existing
BoardPainter inputs. No storage, audio, options UI, run mutation or identity change.

Layer order: art/mask/terrain, scrap, existing capture/wall/terrain/hazard passes;
combat bodies then existing enemy pressure, combat warning, active trail, existing
enemy bodies, combat projectiles, status and player. Victory uses the validated
terminal combat projection for static scrap over the revealed picture, with no
live bodies, rays or shots. Existing fullReveal behavior for historical runs is
unchanged. Paused/frozen visuals use simulation ticks, not painter elapsed time.

## Verification and bounded implementation plan

1. Commit this spec, obtain independent review, then create the patch using
   apply_patch. No actual shared renderer file is edited.
2. Tests read a byte-exact pinned renderer fixture and verify its canonical Git
   blob hash, so fresh/shallow CI never needs to fetch an unrelated candidate.
   Apply the patch in an isolated temporary directory and execute the resulting real module with imports
   resolved to this lane's versioned dependencies. No fake wins or replaced engine.
3. Exercise actual public-step warning/shot/removal states, pause/reduced/small
   viewport, cache reset, scrap toggle, full-picture terminal rendering, malformed
   active data and absent/disabled identity. Compare historical command streams
   against the unpatched pinned renderer. Test patch applicability against the
   current newer relay/directional renderer too; preserve all unrelated bytes.
4. Run C1/D2 and relevant BoardPainter regressions on Node20/22; independent review.
   Record source/patch hashes and exact limitations. Send owner held intake only.

No native live-gameplay, human balance, accepted-host integration, Team support,
publication or whole-D2c completion claim. Human and host checks remain open.
The unavailable writing-plans helper is replaced by this explicit bounded sequence.
