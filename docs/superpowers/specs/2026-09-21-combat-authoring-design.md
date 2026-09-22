# Optional combat D2b — shared authoring and inspection

Status: approved by independent specification review, no blocking findings. Continues the approved
[D2 contract](2026-09-21-optional-combat-design.md) after verified runtime commit
`851a2100`. User-authorized automatic continuation replaces routine approval
pauses, not review or release gates. AI soundtrack remains paused.

## Bounded outcome

Authors can create, modify and remove optional scouts/sentries using the existing
mission actor list, choose an explicit mission on/off edition, inspect exact
effective pressure and non-retaining capture consequences, and export validated
candidates. One registry/compiler serves Studio, CLI, diagnostics and core.

This increment does not enable invisible hazards in a gameplay preview. D2c owns
live pixel actors, aim/projectiles, feedback and the player-facing preference.
Until that renderer is implemented and qualified, enabled-combat Studio gameplay
launch fails with a clear explanation; static map/capture inspection and core
route tests remain available. Disabled combat can use normal gameplay preview.
No public enrollment, Team conversion or automatic publication.

## Alternatives

1. **Selected:** additive actor catalogue v8 and an explicit optional mission
   combat setting, with normal actor CRUD and a separate small edition control.
   Old catalogues and maps remain immutable; combat data uses the D2a extension.
2. A new parallel NPC editor/collection: rejected because it duplicates actor
   ownership, IDs, validation and admin workflows.
3. Infer combat mode from actor presence or artwork: rejected because disabling
   would erase authored intent and old replay identities could become ambiguous.

## Registry and mission contract

Register `journey-actors-v8`, inheriting v7 recipes unchanged and adding
`optional-scout` and `optional-sentry`. Explicit recipe metadata distinguishes
combat roles from ordinary enemy recipes; do not infer from an ID prefix.

Both roles use measured/standard/brisk speeds1.8/2.2/2.6 cells/s and turn120 ticks.
Sentry timing is sense16, scan30, opening480, warning180, recovery180, rest1200,
shot speed8 and life360. The shared compiler scales movement and rest once using
the pinned difficulty catalogue, rounding rest to integer ticks. All other values
are fixed; no per-instance physics/timing controls. Runtime validation rechecks
the resolved descriptor in every supported mode/preset.

Authored instances use `{id, role, tier, x, y, heading:[x,y]}` like field actors.
Add optional `combat: {version:'mission-combat.v1', enabled:boolean}` to existing
mission formats V1–V4, matching the additive timed-bonus pattern. Exact keys.

- Any optional-combat role requires an explicit combat setting and v8 catalogue.
- A combat setting requires v8, even with no actors or `enabled:false`.
- Empty combat populations are valid while authoring; no inferred defaults.
- The existing24 total mission-actor limit remains (ordinary plus combat), with
  at most8 sentries. No new hidden population outside the actor list.
- Presence of the combat field or any optional role rejects Team, even disabled.
  Existing Team-only and mixed-mode noncombat missions remain unchanged.
- Compile ordinary actors into `level.enemies` and combat actors into
  `classic.combatPatrols.actors`, mapping role to scout/sentry and heading to
  headingX/Y. Do not silently filter unknown roles. Descriptor absence stays absent.
- Retain the existing level/schema pairs and frozen v1–v7 manifests exactly.

The compiler must not merge these actors into line-impact actor IDs, pressure
actor recipes, encounter enemy bindings or region-retaining seeds.

## Explicit edition operations

Provide two copy-on-write validated commands:

- Prepare combat authoring for one existing non-Team mission: upgrade the cloned
  project's catalogue to v8, add `combat.enabled:false` if absent, preserve its
  actors/map/objectives/quota, compile before returning. Existing v8 roles cannot
  be downgraded. No automatic insertion of NPCs.
- Set a prepared mission's `enabled` boolean. Preserve all descriptors and
  geometry. An unchanged value is an exact no-op. Invalid/missing mission or
  unprepared combat data fails without returning a partially edited project.

Changed mission, ancestor campaigns, containing packs and project receive
deterministic new revision tokens. Unrelated mission/map/asset revisions and
resolved physics remain unchanged. A later reversal is a new edition, not an old
receipt disguised as the original. Player progress and published editions are
not mutated. These are authoring operations, not the D2c player preference.

Existing actor add/replace/remove continues through `editContentActor`, validated
against all supported presets/modes. Removing the last optional actor leaves the
explicit combat setting intact. Adding a first optional actor never silently
enables combat.

## Studio and shared inspection

Use the existing draft session apply/undo/checkpoint machinery. Add a compact
mission combat section with current state, Prepare authoring, an explicit on/off
control, and validation feedback. Disable/hide preparation for Team; explain why.
Changing unsaved controls does nothing until Apply. Draft context changes invalidate
stale editor commands, just like actor editing. No publication side effects.

Actor editor lists the two roles only when catalogue v8 and mission combat data
are explicit. It offers cell-centred position, existing heading and speed tier,
with exact compiled movement/rest/warning facts from the same registry helpers.
Explain: removable by craft contact/capture, no region retention, only sentry
projectile harms, disabled actors are authored but inactive. Ordinary keeper
warnings remain distinct. No per-map tuning loophole through the form.

Static preview includes both active runtime patrol markers and authored disabled
markers, explicitly labelled inactive. Use distinct biped/bracket paths rather
than ordinary keeper circles, with a sentry weapon-bar distinction. These are
authoring diagrams, not final live pixel assets.

Pressure inspection resolves each authored actor from its correct runtime
collection and reports combat enabled state, resolved speed and sentry timing.
Never report disabled actors as active pressure or count them as retaining threats.
Historical noncombat report rows remain exactly unchanged.

Capture snapshot inspection adds optional removed-combat IDs only when a combat
descriptor is present. Compute from the shared hypothetical filled/trail cells
using D2a's radius envelope, without mutating state or advancing random streams.
Disabled actors yield an empty removal list. Existing retaining-region/remote
fill/objective diagnostics stay authoritative; warn if active combat starts in
an empty region that will be removed by the next unrelated closure. Do not treat
that warning as a validation failure or a guaranteed live prediction.

Enabled gameplay launch is guarded centrally in preview preparation, as well as
the Studio button, until D2c provides actual readable actors/shots. Do not create
a fake renderer, hide invisible attacks by disabling runtime combat, or claim a
static diagram as a gameplay/native pass. Exported candidates retain explicit
unqualified-combat diagnostics; no automatic release or official-progress awards.

## Encounter studies

Three original optional greyboxes form one short learning arc:

1. **Workshop sweep:** non-retaining scout beside alternative returns. Choose
   contact removal or enclosure while the ordinary keeper still retains field.
2. **Sentry detour:** generous wall-screened approach and two return choices.
   Change route after a locked shot, or enclose the sentry before firing.
3. **Two-bay service:** combine one known sentry with scout removals and separate
   retained bays; choose threat removal versus a useful connecting return.

Bands4–5, no countdown or required elimination objective, no bonus dependency.
One optional mastery each; original map geometry should create the decision,
not decorative military imagery. Use workshop/robot visual direction and existing
coherent theme IDs; final artwork remains D2c/later content work. Preserve all
existing factories and mark these as separate studies, not core Journey additions.

Every study records route decision, lesson, counterplay, capture consequence,
introduced/practised/combined mechanics, memorable moment, duration hypothesis,
difficulty facets, mastery and Solo/Versus qualification. No quantity quota.

## Implementation sequence and acceptance

1. Register v8 and exact recipes; extend strict mission validation/compiler and
   explicit Team rejection. Test v1–v7 identities, all tiers/presets, missing
   flags, disabled validation and enemy/combat separation.
2. Add copy-on-write edition commands and tests for dependency revision changes,
   no-ops, undo/redo, invalid rollback and unrelated levels/assets unchanged.
3. Integrate actor/control editor, shared pressure inspection, static markers and
   capture consequences. Test stale contexts, roles, warning text, disabled state,
   rendering paths and central no-invisible-preview guard. Native observations
   remain pending if the browser surface is unavailable; never invent them.
4. Build the three explicit studies; compile all presets/steering routes with
   combat on and off, seeded replay/equal-board checks and no-bonus clears. Evidence
   must include removal and actual warning/shot/evasion, not only actor presence.
5. Run existing catalogue/compiler/Studio/preview/pressure/Team and core cohorts
   on Node20/22. Independent review; commit bounded increment, report truthful
   remaining D2c/D2d/human/deployment gates to release owner.

Use the explicit sequence as the unavailable writing-plans helper fallback.
The approved D2a engine remains unchanged unless a demonstrated integration defect
requires a tested fix. No broad app/Team-host or publisher/version ownership changes.
