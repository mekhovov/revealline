# Field Kit screens and navigation

The phase-6 surface layer finishes the existing menus around the shared Field Kit components and compiled collection. It preserves native dialogs, host-owned pause/input handling and the existing save, audio and chapter actions.

Settings has four keyboard-accessible categories: Controls, Audio, Display & accessibility, and Game data. Tabs support Left/Right and Home/End; leaving Controls cancels an active key-binding capture through its original handler. Game data opens the existing flight-library Saves and Packs sections. Collection opens the same records panel and keeps the original modal return route.

Collection prioritizes artwork, medals and mastery, with an expanded picture viewer. Flight records use stable numeric text. Reading, help, soundtrack, recovery and installed-content panels share the same text sizes, panel frames, controls and spacing. Existing locked, empty, missing-original and unavailable states retain their explanations and actions.

Couch setup/results, Replay Theater, controller practice and About opt into the same supporting-page styles and independent Standard/Large controls. The replay/couch hosts and authoring tools already receive the shared compiled presentation through the phase-5 page host. Generated privacy/credits pages include the surface stylesheet. Workshop remains a single navigation destination for the existing editors and local Asset Studio.

Versus fits each complete 4:3 or 2:1 board inside its own arena and passes that visible CSS width to the shared painter. The canvas contributes no intrinsic size to the layout; arena observation handles touch-pad, typography and viewport reflow. Hosts without ResizeObserver also reconcile wrapping statistics, state/input labels, encounter visibility/copy and visible equipment labels after both HUDs and the shell settle, before either board paints. This includes ordinary capture, score and life transitions. The existing menu update retains its single frame invocation and guarded focus ownership; unchanged layout signatures do not read geometry. Cached-page restoration refreshes the footprint without resuming play or changing the accepted picture. Maintenance prompt: “Test both seats at different width/height constraints, then change touch controls, Large text and orientation. Confirm unchanged checkpoints, picture identity and results while actor/cut sizing follows the visible board. Exercise hidden boards and late resize callbacks after restoration/disposal. Qualify actual native readability separately: the existing 64-logical-pixel enemy cap still limits a 240-pixel-wide 72-column board to 13.33 CSS pixels.”

Keep authored image fitting separate: [`object-fit: contain`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit) can leave a smaller bitmap inside a larger element box. That element width is not the board's displayed width. The [Resize Observer API](https://developer.mozilla.org/en-US/docs/Web/API/Resize_Observer_API) reports element-size changes independently of the viewport; the fallback tracks relevant content changes and avoids repeated geometry reads on unchanged frames.

Pages release and archive catalogs use the same fonts, tokens, compiled components and Standard/Large selector. Each version has a Play action, source identity, ZIP and manifest links. The controller copies a bounded presentation dependency graph, font notices and hash-verified compiled assets into `catalog-ui/`, outside every frozen edition. The current/archived play URLs and all original game files remain intact. Historical controllers without compiled presentation retain a readable fallback. Catalog bytes count toward the existing main/archive budgets.

Workshop links directly to Motion lab, the picture/story editor, video-poster workshop and design atlas as well as the existing mission, enemy and asset tools. Motion lab now ships its explicit runtime files and includes shared text sizing and a Return to game link. Its independent preview inputs and toy ability rules remain intact.

`game/ui/field-kit-copy.mjs` provides stable English keys, locale fallback and plain-text named substitutions for the new menus and settings. Ukrainian translation is intentionally not supplied in this release. New labels use DOM text; asset artwork never carries translated words. Existing localization gaps elsewhere remain future translation work. Handjet display accents, Exo 2 interface text and Plex Mono numbers use the already verified English/Ukrainian font files. The diagnostic poster generator now also references the shipped Plex font instead of Pixelify; old fixture media remains immutable.

Validation covers keyboard category changes, cancellation through the existing key-capture handler, original Save/Pack/record routes, return focus, locale fallback and text substitution, normal pause/Continue behavior and build dependencies. Source screenshots under `docs/verification/fpv-redesign/phase6/` and the phase-5 combined-workspace review include portrait Large settings, controller practice and couch results. Actual native file transfer is separately recorded by the Asset Studio. These checks do not claim physical controllers, other browser engines, native 200% browser zoom or public/offline release qualification.

## Software build information

Home keeps gameplay destinations and the quick sound control. Software release history belongs under About’s existing Build information disclosure, reached through the same-edition About links. Preserved software builds are not campaigns, modes or presentation collections. The Home version label remains separate from navigation. The existing Build information disclosure is the first content in About’s main region, before the long game guide, so that content cannot reflow above a focused build action during rotation.

About derives its sibling game entry before using the shared release-catalog resolver, including frozen editions whose About route ends in `site/site/about.html`. Its Release history link stays hidden, including under the button styles, until the page module initializes the correct destination synchronously. A failed or delayed catalog request leaves that initialized link and the current-build action usable. If the module itself cannot load, the history link stays hidden; the existing current-build fallback remains.

For this project’s HTTPS numbered archive sites only (`mekhovov.github.io/revealline-archive-N/releases/vX.Y.Z/site/site/about.html`), About reads the JSON catalogue from `https://mekhovov.github.io/revealline/releases/`. Those archives preserve immutable sites but publish an HTML catalogue redirect rather than their own JSON index. This explicit project-specific authority does not change the same-edition Return link, other hosts/projects, non-HTTPS routes, or the shared game resolver.

Build choices retain the strict archived-play validator. Only a validated relative release record is resolved against the fetched catalog’s URL (or the requested index URL when a response does not supply one). Approved canonical HTTPS records keep their exact URL, including a separate archive host. An invalid canonical field can fall back to a valid local record. Selecting a build only updates the explicit Open build link; it never navigates automatically or writes player data.

Maintenance prompt: “Check Home before a first flight and with a continued flight, retaining its Back, focus and checkpoint behavior. Open About from a source deployment and a frozen edition with query/hash state. Hold and fail the catalog request, then supply local and canonical records, including rejected inputs and canonical-to-local fallback. Verify the history link is unavailable before module initialization and correct before the request finishes; only explicit Open build activation may leave the page.” Keep modeled routing and URL tests distinct from native keyboard/controller journeys, compact Standard/Large layouts, 44-pixel target checks and public-release catalog qualification. A synthetic local catalog is not evidence that a frozen public catalog is deployed.

About’s controller owner starts before either catalogue request and keeps one stable page scope across loading, success and failure. A successful controller join immediately marks the already focused visible control, or selects Return when focus is outside the controls, without activating it. Held arrival input cannot join, and a held join cannot activate the selection; release and a fresh Confirm are required. D-pad moves among visible native controls; Confirm toggles Build information or enters/commits the existing select editor. Back cancels an active edit; otherwise it focuses the explicit same-edition Return to game link, which requires a separate Confirm to leave. Native keyboard/touch retain ordinary link, disclosure and select behavior. Escape cancels a controller edit first; inside a native select, text/input editor or editable content it remains the browser’s dismissal key. Outside editors it focuses Return. Return goes to the game entry; it does not restore an in-memory Workshop opener.

Controller hints have their own status region, separate from release and pack preparation. A select draft announces itself once in its adjacent live preview; the page hint does not repeat that announcement. About supplies local themed preview styling, with a full row after the header, preserved-build controls or pack-launch controls, so hints do not squeeze the native selectors and actions. Catalogue completion can invalidate a stale select draft but never confirms it, navigates or steals focus. Blur, hidden and cached-page departure clear edits and held input and stop the single controller frame loop. Foreground restoration starts at most one loop with neutral input required. Terminal departure destroys that owner and prevents late fetch/body success or failure from updating the departed page.

Navigation maintenance prompt: “Hold or fail each About catalogue request. Join using a neutral controller, toggle Build information, edit/commit/cancel the preserved-build selector, and use Back then Confirm to return to the same-edition game. Complete a catalogue while a selector is being edited; verify stale preview cancellation without navigation. Repeat blur/visibility/cached-page restoration with Confirm held, disconnect/rejoin, and terminal departure during fetch/body parsing. Keep ordinary keyboard/touch defaults, explicit links, loading messages, selected campaign data and the current-build fallback intact. Qualify native input, compact focus visibility and public source identity separately.”

## Results artwork and role specimens

The results reading region leads with a bounded still drawn from the completed attempt's already loaded image and fit. Desktop uses adjacent artwork/details; narrow and short views keep the existing reading scroll region and action ownership. The full-picture action returns focus to its originating button. Missing managed originals remain unavailable; old sessions and explicitly legacy worlds use their already loaded original. The still is cleared for ready/pause/loss, and no new media lookup or pin is created.

Studio button variants now use actual primary, secondary, danger, icon, tab and chip semantics. Primary and danger defaults use amber/coral; press uses cyan; selected tabs/chips retain the amber marker. The icon specimen has a real accessible label, tabs own matched panels and arrow/Home/End navigation, and chip selection stays inside the isolated sample.

The Field Guide consumes the current FPV release enemy slots with the runtime pivot/rotor adapter. Other themes and releases without a resolved slot retain their existing artwork. Its enlarged preview keeps the physical center cue unchanged, and changing or closing the guide retains the existing practice/return ownership.

## Standalone Workshop return navigation

The nine Workshop tools share a fixed same-release return contract: Asset Studio,
Mission playground, Enemy workshop, Motion lab, Pictures & stories, Video poster,
Design atlas, Replay Theater and Controller practice. **Return to Workshop** opens
Workshop with the originating tool focused. Back or Escape closes only Workshop,
leaving its opener focused on Home. **Return to game** (or a game wordmark) opens
Home. These actions do not launch or restore a flight.

Both outgoing and return links retain one validated `journey` route hint. They do
not adopt arbitrary return URLs, campaign selections, save identities or other
launch parameters. A small independent entry prepares complete link destinations
before enabling them, so returning does not wait for large editor/media modules.
Links between these registered standalone tools retain the same route as well.

Practice/course children retain their existing token/session owners. Enemy workshop
practice returns to its current draft; Controller practice releases held input and
uses its existing exit handshake. Replay Back cancels pending loading or pauses and
focuses Return to Workshop; activating the link remains deliberate. Video Poster
Back cancels active preparation first, then leaves through its existing Back action.
Page departure keeps each tool's existing cancellation and cleanup behavior; this
navigation feature does not persist unsaved editor work across document navigation.

Maintenance prompt: “Verify ordinary and authored-Journey Home → Workshop → each
of the nine tools → Return to Workshop → Back, with exact opener and release route.
Exercise Return to game separately. Try early return while dependencies load,
keyboard, touch and supported controller input. Check native Escape after both Home
and Workshop opened during boot. Preserve practice token/session return, Replay
pause/cancel, Video Poster cancel-first Back, history failure, newer focus, hidden
or disposed hosts and competing launch precedence. Measure 44-pixel return targets;
report modeled controls, native browser and physical devices separately. Do not
claim saved-attempt continuity from menu-only tests.”

The named Playground iframe also has an explicit nonmodal keyboard boundary.
Tab from its final control and Shift+Tab from its first control use the browser's
sequential frame traversal, after the game host suspends and releases input.
This applies to Solo/course, Versus and Team hosts reached inside that preview.
Native modal containment and Controller practice's separate session handshake
remain unchanged. Re-entering the preview does not start or resume a run. The
parent's custom-size help explains this keyboard exit. A second Return to Workshop
link directly after the preview avoids traversing all editor fields to leave.

Preview regression prompt: “At both ends of the Playground iframe, Tab/Shift+Tab
out and back in using native browser keys. Repeat in Solo, course and Couch,
and follow the in-frame mode links. Start, pause, leave and re-enter: require
explicit Resume and unchanged checkpoints. Keep real modals contained and the
Controller practice/enemy return protocols unchanged. Retire or replace a child
during suspension; it must not wrap or steal the newer focus.”

### Native Workshop checks and the Motion Lab exit

The [nine-tool keyboard record](verification/workshop-native-v070/README.md) checks
exact v0.70 source in the local browser with the authored Journey route. Each tool
returns to its own Workshop card, then Escape returns to the Workshop opener on
Home. It includes the Playground/Controller practice iframe boundaries and Replay
pause-before-return. It does not qualify physical controllers, touch, public Pages,
forced loading failures or saved-flight continuity.

Motion Lab now also has a visible Return to Workshop link before the study header.
It uses the existing return-link initializer, route validation and 44-pixel target
styling. The footer exit stays available after the controls. The native comparison
reduced initial sequential access from 47 Tab presses to one; Enter restored the
Motion Lab card and Escape restored Home. [Correction evidence](verification/motion-return-top/README.md)
binds the preview to the frozen source plus only this markup insertion.

Maintenance prompt: “Enter Motion Lab from Home/Workshop. The first native Tab
must reach the visible Return to Workshop link before the settings, retaining the
current Journey and release. Return must restore Motion Lab’s card; Escape then
returns to Home without launching a flight. Keep the footer exit and early loading
return usable. Inspect desktop, portrait and short landscape, report actual CSS
viewport sizes, and do not infer keyboard order by counting unchecked radio inputs.”


The [fresh-profile Legacy Missions check](verification/legacy-missions-native-v076/README.md)
on exact `734318d6` found matching chapter-card, briefing, Deploy and Home Start
captions across Base game, Pressure Lines and Frontier Lines. Keyboard briefing
reading and nested Escape returned to their actual openers. This did not reproduce
the register’s older stale-description report; saved/profile/recovery transitions
remain unverified. Do not infer a code fix or full issue closure from this path.
