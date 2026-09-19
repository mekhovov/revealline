# Versus session formats and same-mission rematch

P07-V1 is a bounded continuation feature. It is not the ordered campaign tour, complete catalogue journey or full P07 acceptance. Source, native and public qualification must be recorded separately.

## Player behavior

Versus defaults to **One race**, with **First to two** available in Race setup. No new mandatory setup step is added. This preference belongs to the current page and is not written to player saves.

One race ends with its first win or draw. Results shows **Rematch: [mission name]**. A First to two session retains the existing win threshold: a draw awards no point, **Next round: [mission name]** continues an unfinished series, and **Rematch: [mission name]** starts a new series after completion. Setup remains the explicit way to choose another mission. These actions never imply a next campaign mission.

The accepted round recipe owns format, mission, craft, steering, time and theme. Summary, rules, result headings and continuation use that accepted format; later hidden selector values cannot rewrite them. The new Format selector participates in the existing keyboard/controller setup navigation and is disabled outside Ready.

## Preparation and ownership

A rematch is a new in-memory race on the same mission. Its picture is prepared by the existing fresh-race resolver. Retry after failed preparation keeps that candidate’s captured choice; it is not another race or an artwork reselection. Exact complete-presentation/theme retention is a later contract.

Old Results, both board references, displayed original and scores remain usable until the candidate is prepared and confirmed. Failure or cancellation keeps them. Totals reset only when a new One race or completed-series rematch commits. Existing once-only settlement prevents repeated frames, picture viewing or menu returns from awarding another point.

Installed missions pass their existing authored-original readiness, installation and metadata-generation checks before commit. Their confirmed rematch can start from the original deliberate activation, just like a shipped mission. There is no extra mandatory Start screen when that action still owns the foreground and current attempt.

An admitted activation synchronously focuses the Start/Rematch button because touch activation does not focus a button in every browser. After focus callbacks, the host rechecks the original run, generation, controller, intent, foreground, scope and focus before preparing. Later user focus choices or foreground loss cannot be undone by completion. Failure to establish the focus owner conservatively leaves the existing result usable.

Blur or another focus choice may allow preparation to reach Ready, but a fresh Start is required. Back, Settings, View, replacement setup, Cancel or disposal retire the pending action according to the existing transaction. Physical input is cleared at the accepted boundary; controller neutral gates and explicit Resume remain intact.

## Qualification

Use actual host/core/input flows and legal wins or ordinary timeout draws. Record simulated DOM, image decoding, storage and controller boundaries. Composed-source checks are not ordinary-source or browser qualification.

- Default win and draw, named Rematch, repeated-frame settlement and View/Results return.
- Explicit First to two: win, draw, win; threshold, retained score and accepted reset.
- Captured format and setup copy remain stable after hidden selector changes.
- Keyboard and modeled controller Format selection, cancel and confirm.
- Shipped and installed one-action continuation, including an activation with focus initially on the body or another control.
- Delayed read/decode/confirmation, failure, Cancel, stale metadata and replacement generation; retain current Results and release only owned images.
- Blur, hidden page, Back, Settings, newer focus and held Confirm; no stale automatic launch or Solo writes.

Native checks must independently cover keyboard, touch and physical controller, portrait/short landscape/1280×800, Large/Plain text and 200% zoom. Verify long mission names, readable format/rules, both board artwork and neutral controls. Include deployed installed content and offline recovery. No native or public pass is implied by this document.

## Release sequence

This feature is integrated with Team entry, picture parity, Next and Ready ownership on qualified v0.61.24 source `bb8cd8ea8af0cbec6af7e633c05d1bec78815938`. Keep the existing Pause correction. [The candidate checkpoint](couch-team-delivery.md) separates focused checks and native observations from release acceptance. Integrate and qualify the exact composed source before a new synchronized package/lock/build version, commit, immutable freeze, PR/Pages deployment and public byte/play verification. All six source gates and applicable build/artifact checks remain required.

Ordered authenticated campaign tours, campaign endings, teaser/full previews, global complete-theme collections and later production campaigns remain unfinished. No gameplay-rule, persistent Couch-save or Solo progression changes are included.
