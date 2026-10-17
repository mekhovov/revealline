# Keep optional Journey history out of active progress work

An ordinary Journey read or reconnect could inspect and serialize the optional performance-history field after gameplay had started. A supported 2,096,991-byte envelope took about 103–105 ms to inspect in the Node reproduction; merely deferring inspection still left a 30–32 ms defensive copy before admission. These measurements identify synchronous source work, not an observed iPhone or Steam Deck duration.

## Change

The store-created default backend now reads only required profile, picture and star fields for ordinary progress operations. A private receipt distinguishes an unread history field from a genuinely absent history. Separate optional observations coalesce through the existing preparation owner and read matching profile/history values together. Validation, hashing, replay verification and publication remain required, but run only when that owner admits them.

Only private native-result identities can avoid an additional defensive copy or duplicate wrapper validation. Public observations and injected backends retain defensive validation; there is no caller-supplied trust flag. Throwing accessors, superseded observations and disposal retire their operation lifetimes.

Optional database work rechecks the phase after opening and before processing request results. If play began, a transaction can retry only after its own phase-triggered abort is confirmed. The original 1,500 ms storage deadline starts at the first admitted I/O attempt and never renews across retries or queued admission. A long active interval can therefore end the optional attempt. No admission wait occurs inside an open transaction, and no preparation slot is held across native I/O. Completion after an attempted cancellation is never described as a rollback.

Required writes, manual flush, public backup behavior and cross-tab compare-and-swap checks remain intact. The online handler skips a redundant flush when progress is already durable. The optional capture adapter can also reuse that durable state only on the private default path; injected and unscheduled backends retain their original refresh behavior.

## Validation

- Twelve complete Journey, replay, data and backup files pass **165 controls** in the final source-model group. Controls include delayed native callbacks crossing Start, required writes while optional work is blocked, confirmed-abort-only retries, cancellation, the single deadline, corruption, cross-tab conflicts and private-receipt boundaries.
- Three complete files on the integrated working tree pass **30 controls**, including the actual Solo transition host. This overlaps the first group and is not an additional distinct-case total.
- Scoped lint, formatting and exact applied-file hashes pass. Original failures remain in `top-getter-before.tap`, `storage-exact-before.tap` and `default-refresh-before.tap` under `.cache/solo-followup/performance-observe-admission/`.

The final packet is recorded in `storage-final-review.json`; its patch SHA-256 is `c592b54e9cfc89a088809f3fc9651dcf654016ee0e0977c977f3180cf0e98344`. The integrated host result is `tracked-host-v1.tap`, SHA-256 `18879e4bdca9250348bf285e986901c53fb2f121ebbf9be8b820c14b5e224911`.

## Remaining cost and qualification

The maximum supported profile reproduction is 4,192,992 bytes; adding the next receipt exceeds the unchanged 4 MiB budget. With the optional-history correction, modeled empty flush samples fall from 198.7–221.3 ms to 35.7–51.5 ms. Required select operations still perform repeated profile validation: their immediate work is 42.6–47.6 ms, and the modeled commit callback is 61.1–83.0 ms. A separate follow-up will remove redundant validation of privately owned input while retaining full output validation. Total asynchronous record-to-durable time is not one synchronous stall, and nested measurements must not be added twice.

These are Node and managed-IndexedDB model results. Browser deserialization, final-source native timing, repeated-transition retention and physical-device qualification remain unmeasured by this change. An optional read issued before Start can still incur browser work before its callback rejects further application processing.

## Required progress follow-up

The private backend and store already hold validated profile data. Their required event path now copies only the writable root and mode containers before applying the existing transition, then runs the complete final profile validator. The public event entry still validates its input; restore retains its defensive path. Idempotent completion, prior receipts, byte/node/array limits, transaction order and failure isolation are unchanged.

The source proposal is `required-events/proposal.patch`, SHA-256 `ea7a7f3705a6d04ee78342feaf6d8fdacf2500377ad7e1f4fdaee2ed9e5fcff3`, under `.cache/solo-followup/performance-observe-admission/`. Its two paths are `game/journey/profile.mjs` and `game/test/journey-profile-owned-transition.test.mjs`. Thirteen complete files pass **169 controls** in 3.37 seconds with stable listed source bytes; this includes the preceding storage controls and is not an additional distinct-case total. The new tests freeze the actual private transition inputs, compare every supported mode/event to public output bytes, check unchanged failure isolation, and retain explicit byte/node/array/generation overflow rejection. The earlier validation-count failure and test-fixture correction remain recorded.

At a valid 4,192,992-byte profile plus a 2,096,991-byte optional sidecar, the same-process required select model reduces full profile validations from eight to five. Immediate record work falls from 35–38 ms to 21–23 ms; the actual modeled commit callback falls from 54–58 ms to 36–40 ms. The required read callback remains about 20–22 ms. The total asynchronous record-to-durable interval falls from 154–161 ms to 107–114 ms, but it is not a single synchronous stall and nested timings must not be added twice. The exact measurements and source identities are in `required-events/select-cost.json`; complete test/source receipts are `required-events/complete-v1.tap` and `complete-v1.json`.

Full output validation and browser storage deserialization still have a cost. Start records selection before accepting play, but its asynchronous required flush can deliver after play begins. A pending or failed save can also retry on an online event during play; that required durability path is intentionally not placed behind the optional-work owner. These source paths make the remaining callback cost relevant to gameplay risk, without attributing any retained native stall to it. Native timing and physical-device qualification remain separate.
