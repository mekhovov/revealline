# Settle required progress before accepting play

Separating optional history and reducing duplicate validation still left required progress callbacks that could arrive after Start. On the supported maximum profile, the managed storage reproduction measured about 36–40 ms in the commit callback. An online retry could start the same work during play. These are source-model costs, not attributed iPhone or Steam Deck timings.

## Runtime boundary

Main Solo now includes its existing bounded required flush in the accepted attempt's preparation. Audio activation stays in the original user gesture. Selection is recorded once for that run; preparation remains paused while storage settles, then submits the prepared board and establishes the existing quiet cadence before accepting a fresh clock. Result, installed World and Hangar continuations join the same run's accepted resume. Cancellation, replacement, hidden state, lost focus or an open dialog prevent late automatic activation.

Storage failures retain the authoritative in-memory run and pending progress. The existing per-operation 1,500 ms timeout aborts its native work where possible; it is not a newly claimed total flush deadline. A late read or commit callback rechecks phase admission before expensive validation or publication. Online events do not initiate required work during active play, and Pause permits pending work to retry. Default public and other-mode stores keep their ungated behavior unless they opt into this predicate.

Only a privately validated native receipt can retire the exact confirmed pending prefix before a later phase check. Injected results must pass defensive validation first. Invalid results retain retryable events. A transaction already committed remains committed, even when later publication or confirmation is unavailable. No await was added inside a transaction, and required progress does not wait behind the optional-work queue.

The broader host checks exposed a real Skip persistence gap: an asynchronous resume was read as though it had already completed, so the post-resume Skip record could be omitted. Accepted replacement preparation now records selection and Skip before the next active clock. Failed picture preparation keeps the previous run and records neither an accepted replacement nor a Skip.

## Evidence

The frozen four-path patch is `.cache/solo-followup/required-progress-preparation/final-proposal.patch`: 36,924 bytes, SHA-256 `28b4306adf39638852ef511b8c227dd2b50da16ab0e1a893fbcc48f8c866be86`. Its applied app and profile hashes match the independently reviewed bytes. Nine native-storage model controls and five public-host controls cover delayed open/read/commit, timeout, invalid injected results, original gesture audio, cancellation, neutral Resume, recovery and exact Skip persistence.

The integrated fourteen-file profile/replay/storage group plus packaging-policy file passes **191 controls**, with all listed text sources stable. Receipt: `.cache/solo-followup/final-runtime-checks/integrated-profile-policy-v1.json`; log: 46,523 bytes, SHA-256 `30bb2a0d6d9f908b60fc6ed0f49a09497c9af6e6c96c7f511d990573a1cd3c64`. The separate predecessor now declares seventeen complete files without changing its five-minute test budget or the original 118-file production gate.

The initial four-file host group passes **40/44** with stable source bytes, including every new preparation control, layout preparation and starting-setup case. Its four equipment-fixture failures remain retained in `complete-host-v1.tap/json`; they require separate attribution and complete-file follow-up. Earlier candidate controls also retained the failed durable Skip assertions before this fix and pass after it. The actual integrated Demo, continuous-control and installed-World group also passes **19/19** with stable listed text sources; its log SHA-256 is `51b503ca1334808a2b9745967d0807a8cf2e462d9222e850a1b4766217df1778`. Full integrated candidate checks remain in progress.

These are source and managed-browser models. Native deserialization can incur browser work before a callback rejects further application processing. The verified bab3 package predates this patch; final-source production, native timing, resource stability and physical-device qualification remain required.
