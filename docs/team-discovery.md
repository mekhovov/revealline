# Team Arenas discovery

**Browse Team arenas** is available in Team setup and paused/results controls.
Base: `dae39ba7d4f1a64e309566f9cacca826958e7de2`. This feature does not complete
the unified cross-mode catalogue or P06.

## Available content

The same-page browser lists the two approved starter arenas, **First Connection**
and **Relay Yard**, plus every arena in the currently opened local Team pack.
Cards identify pack, source and objective; accessible Play names also identify the pack and source when arena titles repeat. Selecting a starter retains the opened
pack and artwork owner for a later return. Another validated import replaces that
local entry. This is a page-session browser, not persistent pack installation.

There are **no downloadable Team campaigns in this feature**. Solo/Versus packs
and Team packs have different schemas and rules. Created Team JSON packs and
`.rlteam` artwork bundles use the advanced setup file picker. Future downloads need
reviewed Team content, exact artwork dependencies and a qualified installer.

## Optional artwork preview

Cards add a 288×144 artwork teaser and a separate **Preview** action beside the
existing Play action. Preview enlarges the same concealed teaser in the same dialog;
it does not expose the full picture, start a simulation, complete an arena or add
an earned picture. The opaque centre scales with the view, retaining the same
proportional border as the card. Its caption says **Locked preview · Win to reveal
the full picture**. Scenery does not define collision geometry. Earned Results
**View picture** and creator Studio previews retain the full original. **Back to arenas** returns to the cards and their selected arena without
opening a nested modal. A failed preview offers **Retry preview**.

Preview uses the exact Team content and artwork resolver. Keep at most one actual
preview preparation in flight, including after cancellation while an underlying
decode is still settling. Copy only the bounded teaser/expanded-view pixels needed by
the UI, then release the temporary decoded-image lease. Changing view, closing,
foreground loss or a newer request must prevent stale pixels and statuses from
being adopted. Preview never disposes the accepted attempt's picture or local
pack owner. These are the additive implementation contracts, not completed native
or release evidence.

## Attempt and artwork contract

These are source contracts; completed evidence is recorded below.

- One **Play** action prepares and starts the selected arena. The existing attempt
  or result, picture and setup remain until content and artwork are ready. Failure
  or cancellation must not replace them.
- Replacing a paused attempt requires **Stay** or **Replace & play**, with Stay
  initially focused. Stay keeps the old attempt paused; Resume remains explicit.
  Play retains the current challenge and teamwork settings.
- Adoption publishes the candidate run, exact pack and picture ownership together.
  Retry keeps accepted visuals; Next follows the accepted pack's arena order.
  A matching name or level ID alone cannot authorize different content or artwork.
- Completing a pack focuses **Browse Team arenas** directly on Results. Back keeps the earned result and original picture. **Change setup** remains a separate explicit action.
- Accepted starter play updates the existing Team arena bookmark only after adoption; local same-ID imports never replace that bookmark. Storage denial or a newer callback focus cannot break play or steal focus.
- The browser does not award Solo pictures or write Solo sessions, saves or
  progression. Local Team packs and attempts remain page-local.

## Cancellation, navigation and accessibility

Preparation shows live status and **Cancel preparation**. Cancel, Back, foreground
loss and stale visits retire work; late completion cannot start play or overwrite
status. Errors retain Play. Cancel keeps the browser open.

The UI owns the dialog visit; the host owns preparation, adoption and input release.
Close retires ownership before abort/callbacks. Back restores a valid opener only
if no newer visit or focus owner has taken over. Successful Play closes without
restoring the opener; the host focuses the new arena only if it is still running.

Controller routing uses the discovery dialog root and current Play/Cancel primary
control; nested Stay/Replace takes precedence. Cards follow DOM order, wrap text,
use one column at narrow widths and have 44px minimum buttons. Status does not
take focus.

## Qualification and remaining checks

The parent discovery feature's isolated Node suites passed **209/209 on Node 20
and 209/209 on Node 22** across
host, discovery, lobby focus/preview, shared Settings, Next/reentry and imported
artwork/continuation/retry. Discovery covers keyboard, pointer and modeled
controllers, including disconnect/reconnect and explicit Resume. Tests exercise
real `.rlteam` original bytes with a finite DOM and Canvas harness; native browser
focus restoration is modeled. Those parent counts do not qualify the additive
teaser/full preview feature or physical-device/public play.

The earlier unearned-full-preview implementation passed **100/100 on Node 20 and 100/100 on Node 22**
across eight scoped suites: picture scheduling, actual-host preview, discovery
panel/host/input, lobby preview, Next and custom artwork. Eight new host cases
include real `.rlteam` bytes and a legal win→Preview→Back→Next journey; seven
scheduler cases cover bounded preparation and cleanup. These still use finite
DOM/Image/Canvas boundaries and modeled input. Independent source review found
no outstanding issue in its stated scope; all 29 materialized simulation files
remain unchanged. Native preview layout/input, offline, integrated release gates
and public play remain required.

Review corrected two stale test actions after adding Browse: the first Tab after
Start now reaches Browse, and returning to setup must select Change setup explicitly.
Original failures remain in the qualification evidence. A real admission-focus
regression has a failing-then-passing test. Independent source review confirms all
29 materialized simulation files match the reviewed base.

The final presentation correction increases selector specificity so shared panel
padding cannot override compact gallery spacing. Browse is disabled in initial
markup until the host binds its action. Targeted discovery suites are rerun after
these corrections; exact hashes and outcomes are in the handoff receipt.

Native checks remain required: keyboard/touch/controller navigation, dialog
close/focus, rotation, narrow and short-landscape layouts, long imported packs,
Large/Plain text, 200% zoom and foreground return. Complete the integrated source,
build/release gates and immutable public checks. Record physical-controller,
offline and public-play evidence separately. Also check exact-artwork concealed preview,
one-preparation bounds, copy/release, failure/Retry, Back selection/focus and no
earned-picture or Solo-save mutations. Reviewed Team downloads remain later P06 work.

## Maintainer prompt

> Extend Team Arenas from the reviewed source. Preserve starter/local pack identity
> and exact artwork. Stage Play; default to Stay and keep Resume explicit. Test
> cancellation, failure, blur, stale completion, reentry, Next and Retry through
> the real host; assert no Solo writes. Preserve focus ownership, live status and
> 44px targets. Do not relabel Solo packs as Team-compatible or invent downloads.
> Keep player Preview optional, concealed and unearned, with one actual preparation in flight and
> bounded copied pixels; release temporary image leases without touching the run.
> Update this guide; separate modeled, native, physical-device and release evidence.

## Expanded-preview responsive layout

The complete concealed preview frame and Back action must fit together. In landscape, allocate the dialog’s available height after navigation, title, caption and status, then fit the entire 2:1 picture with `object-fit: contain`. Do not independently assign most of the viewport height to the picture. On portrait screens, use natural image height, a `height: fit-content` dialog and non-expanding rows instead of a fixed-height letterbox. `height: auto` alone does not prevent the modal grid from stretching. Keep overflow available for enlarged text and recovery messages.

Hide gallery-only copy in the expanded view. The visible caption states “Locked preview · Win to reveal the full picture”; successful loading announcements remain available to assistive technology. Loading, errors, cancellation and procedural-scene explanations stay visible. Keep the existing Back/Retry ownership and minimum 44-pixel targets.

Qualify settled screenshots and geometry at 844×390, 600×400, 390×844 and desktop, including Large/Plain text and 200% zoom. Rotate without closing the picture; verify the same artwork and focus remain. Exercise failed loading and Retry, then Back to the exact Preview opener and Back again to the gallery opener. Finite DOM tests and CSS checks do not establish browser geometry, physical input or public release readiness.

## Reference guidance — checked 20 September 2026

The [W3C modal-dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) calls for contained focus, Escape and focus returning to the invoking control. [Xbox navigation guidance](https://learn.microsoft.com/en-us/xbox/accessibility/xbox-accessibility-guidelines/112) supports consistent input/navigation and predictable focus. [MDN object-fit guidance](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/object-fit) describes `contain` for showing the complete image. These sources support the existing discovery and preview contracts; they do not replace the separate native, hardware or public qualification gates.

## Picture reward boundary

Player discovery keeps both the 288×144 card and 1152×576 expanded view concealed.
Their border widths are 24 and 96 pixels respectively. Preview never unlocks or
awards a picture. Preserve the exact artwork, current attempt/result, resource
lease, cancellation, Retry and Back focus contracts. Creator Studio views and
earned Results viewing remain complete; this does not introduce a global spoiler
preference or a new progress store. The prior full-preview native and test
records remain historical. Qualify this correction on its own final source and
public journey before acceptance.
