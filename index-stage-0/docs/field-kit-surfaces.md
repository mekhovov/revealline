# Field Kit screens and navigation

The phase-6 surface layer finishes the existing menus around the shared Field Kit components and compiled collection. It preserves native dialogs, host-owned pause/input handling and the existing save, audio and chapter actions.

Settings has four keyboard-accessible categories: Controls, Audio, Display & accessibility, and Game data. Tabs support Left/Right and Home/End; leaving Controls cancels an active key-binding capture through its original handler. Game data opens the existing flight-library Saves and Packs sections. Collection opens the same records panel and keeps the original modal return route.

Collection prioritizes artwork, medals and mastery, with an expanded picture viewer. Flight records use stable numeric text. Reading, help, soundtrack, recovery and installed-content panels share the same text sizes, panel frames, controls and spacing. Existing locked, empty, missing-original and unavailable states retain their explanations and actions.

Couch setup/results, Replay Theater, controller practice and About opt into the same supporting-page styles and independent Standard/Large controls. The replay/couch hosts and authoring tools already receive the shared compiled presentation through the phase-5 page host. Generated privacy/credits pages include the surface stylesheet. Workshop remains a single navigation destination for the existing editors and local Asset Studio.

Pages release and archive catalogs use the same fonts, tokens, compiled components and Standard/Large selector. Each version has a Play action, source identity, ZIP and manifest links. The controller copies a bounded presentation dependency graph, font notices and hash-verified compiled assets into `catalog-ui/`, outside every frozen edition. The current/archived play URLs and all original game files remain intact. Historical controllers without compiled presentation retain a readable fallback. Catalog bytes count toward the existing main/archive budgets.

Workshop links directly to Motion lab, the picture/story editor, video-poster workshop and design atlas as well as the existing mission, enemy and asset tools. Motion lab now ships its explicit runtime files and includes shared text sizing and a Return to game link. Its independent preview inputs and toy ability rules remain intact.

`game/ui/field-kit-copy.mjs` provides stable English keys, locale fallback and plain-text named substitutions for the new menus and settings. Ukrainian translation is intentionally not supplied in this release. New labels use DOM text; asset artwork never carries translated words. Existing localization gaps elsewhere remain future translation work. Handjet display accents, Exo 2 interface text and Plex Mono numbers use the already verified English/Ukrainian font files. The diagnostic poster generator now also references the shipped Plex font instead of Pixelify; old fixture media remains immutable.

Validation covers keyboard category changes, cancellation through the existing key-capture handler, original Save/Pack/record routes, return focus, locale fallback and text substitution, normal pause/Continue behavior and build dependencies. Source screenshots under `docs/verification/fpv-redesign/phase6/` and the phase-5 combined-workspace review include portrait Large settings, controller practice and couch results. Actual native file transfer is separately recorded by the Asset Studio. These checks do not claim physical controllers, other browser engines, native 200% browser zoom or public/offline release qualification.

## Results artwork and role specimens

The results reading region leads with a bounded still drawn from the completed attempt's already loaded image and fit. Desktop uses adjacent artwork/details; narrow and short views keep the existing reading scroll region and action ownership. The full-picture action returns focus to its originating button. Missing managed originals remain unavailable; old sessions and explicitly legacy worlds use their already loaded original. The still is cleared for ready/pause/loss, and no new media lookup or pin is created.

Studio button variants now use actual primary, secondary, danger, icon, tab and chip semantics. Primary and danger defaults use amber/coral; press uses cyan; selected tabs/chips retain the amber marker. The icon specimen has a real accessible label, tabs own matched panels and arrow/Home/End navigation, and chip selection stays inside the isolated sample.

The Field Guide consumes the current FPV release enemy slots with the runtime pivot/rotor adapter. Other themes and releases without a resolved slot retain their existing artwork. Its enlarged preview keeps the physical center cue unchanged, and changing or closing the guide retains the existing practice/return ownership.
