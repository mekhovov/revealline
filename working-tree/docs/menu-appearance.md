# Shared menu appearance — P05-B source candidate

This candidate extends P05-A `3f934b7508645d2cad03466276d20e8d038f9d76`
with menu colours and static ornaments in Solo, Versus and Team. It is local
preparation, not a released or completed P05 phase. P03 operation-focus successors,
P08 artwork integration, production regeneration and version changes are absent.
The [shared display policy](shared-display-preferences.md) remains unchanged.

## Player controls and ownership

Each existing Options/Display panel adds **Menu colours** (Automatic or Ukrainian
blue & yellow) and **Menu ornaments** (Off, Subtle or Rich). Defaults are Automatic
and Subtle. Text style remains the first Options control. These ordinary labelled
selectors participate in the existing keyboard/controller navigation; changing them
never prepares, starts, saves, replaces or resumes a flight.

`game/menu-style-preferences.mjs` owns `revealline.menu-style.v1`, a separate
origin-local record containing exactly `palette` (`auto`/`ukrainian`) and
`ornaments` (`off`/`subtle`/`rich`). The complete JSON record is limited to 256 UTF-8
bytes. Startup reads without saving. Invalid or unavailable stored data falls back
without overwriting the original bytes. Explicit validated edits apply in memory
before attempting a two-field save. Failed or disallowed saving announces a
session-only result beside the controls and protects that local intent from later
storage events. Events must match the current storage object and current record.
There is no new profile schema, legacy migration or display/audio record field.
Solo retains its practice/course/recovery/writer permission guard; Couch never
writes Solo progress. Terminal disposal releases listeners and decorations.

## Palette and static decoration

`game/presentation/menu-styles.mjs` defines a code-owned menu colour record.
Automatic uses the approved Ukrainian menu palette for the accepted `fpv` theme;
other accepted authored themes keep their own colours. The existing no-snapshot
fallback is declared FPV. Explicit Ukrainian selects this menu treatment for any
authored theme. This classification consumes the already accepted snapshot's theme
ID; it is not an asset resolver or a replacement for the host's content validation.

The Ukrainian menu uses ink `#071527`, panel `#10243e`, text `#f6f3e8`, secondary
text `#a8b8cc`, focus `#67aaff`, primary accent `#ffd64a` and danger `#ff7169`.
Decorative blue is `#0057b7`. No red/black preset is added. Only menu containers map
these derived variables onto existing colour tokens. Root tokens, authored theme
IDs/revisions, pictures, fonts, sounds, asset references and all painter inputs
remain owned by their existing adapters. Theme font/Plain, Standard/Large and
Reduced effects keep the same meaning. There is no simulation or artwork adoption.

Original frame images and their numeric border slices remain bound. Within the
Ukrainian menu scope, their raster centres are not filled: opaque menu surfaces
must remain visible beneath functional labels and selected/disabled action states.
This uses the existing border-only slice variables, including each button's own
primary/danger/secondary role. It does not modify an image or a generated registry.

Ornaments are static inset geometric bands: Off hides them; Subtle draws narrow
side bands; Rich adds wider bands and a top/bottom border. Rich narrows in short or
narrow layouts, and forced-colours mode hides decoration. Ornaments are
`aria-hidden`, nonfocusable and ignore pointer events. They never enter the arena,
HUD or separate authoring documents. A page-owned child-list observer covers late
player dialogs such as the Music Library, including dialog content replacement.
It ignores ordinary content additions, releases detached dialogs and disconnects
on disposal; stale observer or presentation completions cannot replace a newer
appearance owner. Existing dialog, fixed pause panel and focus ownership remain
unchanged. Couch surfaces with enabled ornaments reserve a 28px border-box gutter:
8px inset, up to 8px stripe, the inherited focus outline/offset and clearance.
Off restores existing spacing; Team lobby retains its larger block padding.
Shrink constraints allow controls to fit without clipping. This source budget is
not proof of responsive geometry; layout and scrolling still need actual checks.

## Evidence boundaries

The [retained candidate evidence](verification/cross-mode/p05-b/README.md) records
205/205 in eight complete files on each supported Node runtime, source peers,
unchanged finite input pins, static checks and earlier diagnostics. After a real
native gutter failure, the two complete affected files passed 22/22 per runtime;
the final test-label clarification passed the complete appearance file 12/12 per
runtime. These counts overlap and are not summed into a new qualification.

Focused actual-host tests use the real Solo/Versus/Team code, core and existing
navigation with finite browser/Canvas boundaries. They check both Solo turn
policies during a paused unfinished cut, exact checkpoint/slot retention and valid
continued replay; cross-page menu restoration without progress/display/audio
writes; unchanged Team drawing commands; native-select controller editing; denied
save; storage-event identity; and terminal cleanup. The finite Solo DOM models only
unprevented interior Tab's browser default. That is not native keyboard evidence.
Unit tests cover strict records, reentrancy, atomic preference validation, immutable
authored canvas inputs, newer-owner cleanup and late/rerendered dialog decoration.

Opaque token calculations give these contrast ratios: primary text/panel 14.07:1;
secondary or disabled text/panel 7.73:1; focus/panel 6.53:1; danger/panel 5.82:1;
dark text on primary, focus/hover and danger fills 13.07:1, 7.66:1 and 6.82:1.
The inherited disabled rule explicitly uses opacity 1, muted text and panel fill;
focus uses a 3px outline with a dark outer gap. These are source/token checks,
not measured final pixels, image-edge contrast or complete accessibility proof.
Plain/Large does not by itself prove zoom or reflow.

Root's original twelve-event/eight-PNG desktop run observed menu persistence,
reachable choices and late Music Library ownership, then found Rich stripes crossing
Versus and Team labels. The corrected six-event/five-PNG run measured clear text
and focus bounds in those surfaces (minimum sampled gaps 6.44px/5.33px, without
horizontal overflow), verified Team paused Rich/Off/Subtle choices and closed
Options without Resume. All original failures and corrections remain in the
[scoped record](verification/cross-mode/p05-b/README.md). Four settled opaque DOM
colour pairs are separately calculated there; neither those pairs nor source tokens
certify every state. The Music Library retains existing teal primary text.

Remaining P05 work includes spacing between Team pause actions and the mode row,
whose outlines touch/overlap while labels remain legible. Check narrow/short layout
and actual browser zoom, all intended text-face/size and disabled/loading, primary,
danger and hover combinations, and confirmation panels. The recorded desktop DPR
difference is not a controlled zoom test. Verify real storage-event/denied-save and
unchanged system-motion behavior separately. Resume remains explicit. Physical
controller/touch/device, public/offline and full-source release qualification are
separate gates; this work does not close them.
