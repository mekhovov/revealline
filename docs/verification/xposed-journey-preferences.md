# Journey next-attempt preferences — integration prerequisite

The separately versioned `JourneyPreferencesV1` record uses the stable
`revealline.journey-preferences.v1` key. It stores only Gentle/Standard/Expert
intent. Neither the historical library schema nor the existing v1 Journey
progress schema changes. Reading does not write or migrate either record.

This is a tested host-integration prerequisite, **not a shipped Expert selector**.
The actual Solo/Versus/Team host controls and authored Journey launch adoption
remain pending. Studio inspection must not silently change player preferences.

Explicit selection saves synchronously for the next attempt. A previously
selected, frozen compiler execution retains its rules and identity. Missing data
defaults to Standard; inaccessible storage keeps session-only intent with an
error, retry, and export. Corrupt or future-version bytes are preserved even
after a new selection. Recovery can retry after the underlying record is repaired;
this adapter does not authorize clearing that record.

Fresh same-storage events and restored-page reads update next-attempt intent,
never an active engine. Stale events are ignored. Unsaved local intent survives
remote updates until explicitly retried. Disposal removes both event listeners.
Export contains a validated preference record, not progress or award authority.

Nine focused tests cover all three presets and reopen, strict bounded parsing,
uninvoked getters, corrupt/future records, unavailable/read-denied/quota-full
storage, retry/export, event freshness, restored pages, immutable snapshots,
observer failure/reentrancy, disposal, and exact shared-compiler selection.
The compiler check confirms unchanged player speed and navigation identity,
Standard three lives versus Expert two, different execution identity, and
candidate official-progress ineligibility. It does not claim native UI, human
playability, release publication, or completed host isolation.

Host integration gates still required:

1. Capture this preference revision in asynchronous launch tickets; a newer
   deliberate selection must invalidate an older pending adoption.
2. Use the shared authored execution catalog directly, never Legacy Gentle
   projection, and resolve explicit pack/campaign ownership.
3. Isolate candidate progress, Legacy bookmarks, collection/mastery awards,
   recovery records, and verified presentation assets before enabling play.
4. Test actual-host Next/Retry/Skip, failure/cancellation, cross-campaign changes,
   native controls, storage warnings/export/retry, and unchanged Legacy behavior.
