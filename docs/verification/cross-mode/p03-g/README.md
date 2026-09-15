# P03-G: confirm unfinished mission replacement

This internal P03 candidate adds Stay/Replace to four explicit Solo actions: mission card, Level, Campaign and Pack selection (including the chapter card). A paused or restored unfinished attempt is included. Same live selection does not reset it. Generic restore, replay, Library adoption, ready/terminal selection and authored Tactical Hangar contracts are retained.

The checked-save seam is shared with P03-C: pause without unchecked autosave, verify replay/checkpoint under the backup lock, check writer/recovery and bounded readback, and preserve a changed saved slot. Stay keeps the actual run/recorder and queued turn; Replace selects without starting. A failed save warns of possible loss; a later saved-slot change requires another deliberate Replace. Pack download/save/cancel failures leave the old run intact; a committed pack is not promised to roll back after a later failure.

## Executed source checks

Six complete files passed **101/101 on Node 22.22.2 and 101/101 on Node 20.19.5**, with no failures, cancellations or skips: mission replacement host, mode return unit/host, checked flight retention, mission picker and difficulty host. [Verification](verification.json) pins exact source and logs. The 21 new host cases (including two reload subtests) use actual app/core/serializers and finite modeled browser/storage boundaries. They are not native decoder, quota or hardware proof. Syntax/lint, formatting, changed Markdown targets and Git whitespace checks passed.

## Root’s native observations

[The first 21 records](native-before-copy.json) cover all four adapters on the held runtime before the status-copy correction. A restored Orchard Crossing flight remained paused at 0%, two lives and 2:41 through same-selection and Stay. Chapter Replace prepared Base without starting. A Relay Orchard attempt remained at five seconds/three lives through card Stay; confirmed card Replace focused the newly selected First Signal card. Native Level/Campaign/Pack changes restored actual select values while prompting; Escape returned to the exact opener. Tab wrapped inside Stay/Replace.

Those checks found stale previous-mission text. One source line now updates successful card selection to “<mission> selected. Deploy when ready.” [The cumulative 24-record file](native-with-copy.json) retains the original 21 and adds the narrow successor check: explicit Continue → Relay Orchard card → Replace focused/selected the new card, showed the corrected text and ready 0:00, without automatic start. [Before](native-before-verification.json) and [after](native-after-verification.json) guards pin source and native files; root also reported byte-identical served app/HTML. [The exact one-line correspondence](status-successor.json) binds the two runtime versions. Its original pending-recheck wording is historical; the after guard and three appended native records close that narrow check.

[Confirmation screenshot](replacement-confirmation.jpg) and [corrected selection](selected-card-status.jpg) are root’s original images. The packaging reviewer checked their bytes, not new visual behavior.

## Retained limits and failures

[Retention](retention.json) maps original cache paths to exact copies or lossless gzip. Initial fixture failures are preserved: premature Start before picture readiness, hidden Flight setup, wrong expected pack level, and a modal model that incorrectly used DOM order. The actual gallery queued-focus conflict was corrected at the card adapter. A later error-copy assertion was corrected to the existing wrapped chapter-download message. The old pre-status 101-case pair remains supporting evidence only; the final pair uses the status successor. One metadata command refused a reserved Python keyword before writing; the corrected receipt is retained. An initial finite import search refused a nonexistent optional native bridge; no build or broad asset hydration followed.

This proves only the described source and desktop keyboard journeys on the local source preview. No full P03, combined release, public deployment, physical controller/touch, phone/Safari or disconnected-network acceptance is claimed. Native storage-failure interleavings were not attempted; those remain host evidence. The confirmation’s excessive full-height blank space is a P05 layout follow-up. Starting class/Steering currently reprepare live attempts and remain explicit P03-H work; Team setup departure and broader mode entry remain separate. No version, schema, simulation, artwork or music change is included.
