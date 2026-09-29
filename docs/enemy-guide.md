# Player field guide and impact practice

The in-game field guide teaches seven registered enemy roles, the optional travelling-line-impact rule, and four current-mission topics: optional Scout, optional Sentry, trail pursuit and head interception. It is separate from the Enemy workshop's authoring controls. The original eight entries retain short **Spot / Risk / Try** copy and, where the host supplies the corresponding palette or selected compiled role, their illustrations across FPV, Ukraine, retro and business appearances. The four current-mission entries use concise rule-derived guidance and the real practice renderer, without an unrelated role illustration. Previous/Next, native selects, Read guide, Play practice and Back work through the shared game navigation adapter; touch uses the same controls with nominal 44-pixel targets.

The impact topic offers two exercises on the existing `line-impact-demo` geometry. **Observe the strike** asks the player to leave Boost off and tap Down; an actual hostile line contact creates two fronts and the pursuing front causes a loss. **Escape with Boost** asks for Boost before Down; the same real cut reaches the opposite secured border before arrival and wins. Both Immediate and Grid + buffer are retained. These are separate practice attempts, not artificial rewards or scripted simulation outcomes. The preview illustration is explanatory and is not the lesson's timing authority.

Role lessons reuse the seven Enemy workshop scenario builders as new `guide-*` authored IDs. They select `rules.stopOnCapture:true`; impact practice retains its exact original level and rule identity. All scenarios use `masteryDefinition:null`. The host's persistent `practiceSession` guard prevents campaign progress, scores, unlocks or saved-flight writes. Retry starts the same scenario. Pause exposes the existing Restart and **Return to field guide** actions. Returning preserves the guide topic and leaves the original campaign paused for explicit Resume.

The four encounter topics are available only when the validated loaded mission contains the corresponding enabled optional role or pressure rule. Missing, disabled or malformed rules leave Play unavailable with an explanation; the reader can still inspect the guidance. Their practice is a fresh attempt of the exact effective level, starting craft, full class recipes, seed, steering and theme. A craft changed at a hangar does not replace the attempt's starting craft. The clone preserves combined threats and all authored capture behavior, without renaming the mission, applying tuning again or forcing a one-capture finish. Scout ram/capture, Sentry fixed aim and still-live recovery shots, and warning cancellation on an early return remain core rules, not scripted lesson outcomes.

Ordinary Spot/Risk/Try rows, Relay Sentinel counterplay and the common
movement/Pause/Retry instructions use live EN/UK message keys. Changing language
updates the same reader and active-practice hint without changing topic,
appearance, practice child, handoff or the paused parent attempt. The displayed
core-open phrase matches the existing localized state label. Stored lesson IDs
and authored scenario names remain unchanged. See [batch20 verification](verification/actor-batch-20/README.md)
for the original mixed-language failures and the complete focused checks.

## Integration

`game/enemy-guide.mjs` exports `ENEMY_GUIDE_TOPICS`, `enemyGuideEntry`, `enemyGuidePracticeInstructions` and `createEnemyGuideScenario`. The scenario factory uses actual runtime validation and accepts only known topics and turning modes. An unregistered presentation family falls back to FPV; missing registered theme data is an error. It does not install or mutate packs.

`game/encounter-guide.mjs` owns the four encounter entries, validated rule availability and exact scenario construction. Its small player-facing counterplay copy reuses the existing content counterplay authority. It does not import the authoring UI or create missions. Older hosts can omit the new callbacks: their original eight topics keep working, while encounter practice explains that a compatible loaded mission is required.

`attachEnemyGuide` from `game/ui/enemy-guide.mjs` creates its own dialog and practice iframe. Load the scoped `game/ui/enemy-guide.css` alongside the game theme. Pass:

```js
{
  document,
  window,
  themes,
  // False for editions that cannot admit the separate catalog lessons.
  catalogPracticeAvailable: true,
  getThemeId: () => theme.id,
  getTurnPolicy: () => turnPolicy,
  getLevel: () => run.level,
  getRunOptions: () => ({ seed: run.seed, classId: run.classId, classRecipes: run.classRecipes }),
  getMissionTheme: () => theme,
  // Optional edition adapter; null uses the owned session-storage handoff.
  resolveEncounterPracticeURL: ({ scenario, returnURL }) => null,
  loadImpactScenario: () => getJSON('content/scenarios/line-impact-demo.json'),
  onPractice: ({ signal, isCurrent }) => { /* pause parent flight and its music */ },
  onReturn: () => { /* clear parent input; restore prior listening intent only */ },
  onClose: () => { /* restore shared menu focus */ },
  onRead: (request) => navigation.beginReading(request)
}
```

An edition host sets `catalogPracticeAvailable:false`: its loader accepts only
admitted edition missions, so older catalog/impact practice cannot use the generic
Playground child. The guide keeps its readable lesson and a localized explanation;
it does not prepare a child, suspend the parent or write a handoff for that action.
The four supported current-mission encounter lessons retain their exact edition
adapter and no-awards boundary. This is truthful capability handling, not new
support for catalog exercises inside an edition.

Appearance availability is separate from practice availability. Missing canonical
palettes must not cause a paint exception or start requests for unrelated artwork.
An available compiled FPV role can still illustrate the selected lesson. If no
supported illustration is available, show the explanation and retain guidance and
Close. Ordinary non-edition hosts preserve their canonical themes captured before
pack selection, including restored FPV-only packs. Never fix the guide by changing
the live mission theme, inventing a palette or widening edition admission.

The return object has `open({topic})`, `close()`, `update(dt,{paused,reduced})`, `ownsPracticeFocus()`, a `practiceActive` getter, `dialog`, `frame` and `dispose()`. The opening button must pause the current flight before `open()`. Opening the guide alone must not start a new attempt or switch the selected campaign. The parent should pause its music while the child owns a game session, then restore only the prior listening intent on return; it must not run two soundtrack schedulers audibly or implicitly resume flight.

The visible role preview uses the same registered enemy artwork, surface accents and actor painter as flight. It requests only the selected role; topic/theme changes, a hidden document, page exit, practice preparation, closing and disposal release the old image lease. The line-impact entry keeps its explanatory diagram and requests no role artwork. An unavailable image retains its vector fallback and adds a separate artwork status without replacing practice or restoration messages. Decode completion repaints the sampled frame without advancing the guide clock or changing Pause/reduced-effects settings. Tests can inject `createBodyAssets({changed})` using the existing shared asset manager interface; no additional image pool or simulation is introduced.

The ordinary focus/visibility listening-restoration path must also defer while `practiceActive` is true, even when the iframe itself is not focused. Returning to the browser tab during a lesson must not restart the parent's soundtrack. An intentional music-only Pause before practice remains paused afterward; previously playing music resumes from its existing stream position when allowed.

Before the parent's gamepad sample/menu dispatch, suppress parent input while `ownsPracticeFocus()` is true. This checks only the public `document.activeElement === ownedIframe`, because `document.hasFocus()` can remain true while an embedded document has focus. Clear the parent router on entry/return so a held child command cannot act in the guide. Send guide Back directly to `close()` before the generic “operation in progress” cancellation hint. Native Escape is handled by the guide. Closing during active practice returns to the guide first; a subsequent Back closes it.

Only the documented preview handoff key, `revealline.playground.current` in session storage, is temporarily replaced. The old value is retained and restored on return/disposal only if the key still contains this launch's bytes. A newer explicit preview is preserved. No suspended-flight or profile key is written by this module. Preparation and storage errors remain visible. Cancel invalidates preparation and aborts its signal; asynchronous `onPractice` implementations must check that signal/current ticket before their own side effects. An old callback cannot close a later practice launch.

Encounter launches snapshot validated level, class recipes and setup before the first asynchronous operation; replacing the loaded level invalidates a pending launch. Edition hosts instead use `editionGuidePracticeURL`: it reconstructs only a mission admitted by the selected edition and compares its normalized effective rules and full class recipes before navigation. This route never overwrites the Playground handoff. A canonical uint32 `guide-seed` is accepted only with one explicit practice flag, edition mission, Guide return destination and valid return token; malformed or duplicate values are rejected. Existing controller practice keeps its seed-1 API. This adapter does not admit a different audience, transfer arbitrary replacement rules or award progress.

The shared workshop return bridge accepts an additive finite destination, `workshop` or `enemy-guide`, and a same-origin game URL. Defaults preserve the workshop route. The guide resolves the current game directory, retaining nested release prefixes. Each launch has a fresh 32-hex token; return still requires exact origin, expected child window, current token and the existing two-field message format. Arbitrary return actions, duplicate destination parameters and remote game URLs are rejected. The child receives a native **Return to field guide** action through the existing return adapter; there is no command to modify state or rewards.

## Failed practice startup

The Guide observes only its exact current child through the existing
`observePreviewReadiness` helper. A confirmed failure before readiness announces
recovery in EN/UK and focuses the existing Return action if the iframe still owns
focus. Slow loading alone does not cancel or change focus. A ready lesson keeps
its own recovery controls; the Guide does not monitor or take over running play.

A visible but inactive window defers the focus handoff until foreground return.
The same launch generation, URL, Window and failed Document must still match.
A newer focus choice, navigation, Return, close or disposal retires pending
recovery. Held controller Confirm cannot activate Return after the handoff;
neutral input and a fresh press are still required. The child's detailed error,
exact temporary handoff, return-token checks and paused parent remain intact.
See [batch21 evidence](verification/actor-batch-21/README.md).

## Verification

```sh
node --test game/test/enemy-guide.test.mjs game/test/encounter-guide.test.mjs game/test/enemy-guide-panel.test.mjs game/test/enemy-guide-host.test.mjs game/test/edition-controller-practice.test.mjs game/test/enemy-workshop-return.test.mjs
```

Checks retain the original eight topics across four themes and both policies, exact original impact geometry, real loss/escape inputs with verified replays, shared navigation, nested release URLs, pending cancellation, stale callbacks, storage failure, return authority, preserved preview bytes and an actual child-host loss → Retry → Return journey with zero player-profile writes. Encounter checks cover enabled/disabled/malformed rules, exact effective setup, real-core Scout and Sentry counterplay, combined pressure warning/cancellation and verified replays, localized copy, stale launches and admitted edition reconstruction. Advancing every role study once is not a claim that every study was won. Current DOM/Phaser/Canvas/controller boundaries are modeled; inspect the integrated browser guide, live-cut retention, lesson input, focus return, audio ownership and compact layouts separately. Physical phones/controllers and human comprehension remain their own gates.

The actual parent-host suite waits for accepted actor/picture preparation after Start, then starts a real unfinished cut in each turning mode, selects Large text without changing simulation identity, enters through Main menu, launches practice and verifies exact checkpoint/profile/suspended bytes. While the child owns focus, the parent does not even sample the gamepad. Held direction/Confirm cannot move focus, relaunch practice or resume flight after Return. Fresh explicit Resume waits for readiness and continues the parent's saved direction. Repeated launches reject old return tokens; cancellation cannot launch late. The real soundtrack store/player/Soundscape are exercised with modeled MP3 media elements to verify music-only Pause, stream-position continuity and focus/visibility isolation. These parent and child host cases execute separately across a modeled Window-message boundary, rather than claiming a simultaneous two-browser session.

The Field Guide deliberately paints its role illustration at 56 pixels inside its 192×112 canvas, using a frame copy and the existing small orbit. The visible note identifies this enlarged illustration and the unchanged center contact cue. Flight sizing, sampled pose, contact radius and collision rules do not change. The separate line-impact diagram retains its own label and geometry. Readability and clipping still require actual browser inspection; this is not a live-character size setting.

Opening Field Guide through Main menu → Workshop keeps both parent dialogs underneath it. Close guide, Back and Escape return focus to the Guide button in Workshop; leaving Workshop then returns to its Main menu opener. Returning from isolated practice restores the guide first. The same hierarchy remains when entered during an already-started flight; closing Main menu separately reveals that unchanged paused flight, which still requires explicit Resume. A direct flight opener, if supplied, still returns to its own paused origin. Destinations that can replace or start the campaign retain their existing title-closing behavior.

The specimen is displayed at 288×168 CSS pixels on wider screens and 192×112 CSS pixels at viewport widths of 480px or less. Its logical canvas remains 192×112, with the same 56px role artwork, orbit and center contact cue. The existing mobile dialog leaves 280px of content width at a 320px viewport, enough for the 192px specimen. At narrower widths, the specimen clamps to its container and preserves its 12:7 aspect ratio. This CSS enlargement does not change flight sprites or simulation geometry; actual browser layout and readability remain a separate check.

## Couch mission guidance

Versus Help uses the accepted `match.runs` rules and labels which players face
each enabled optional role. It refreshes on Help entry, preserves active reading
on locale changes, and never starts Solo practice or reads staged setup fields.
Team keeps its own hunter/relay/rescue rules; its two-front trail-impact advice
applies only to explicit Team impact editions. Do not map Solo pursuit semantics
onto Team hunters.
