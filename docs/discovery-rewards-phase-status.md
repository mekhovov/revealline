# Discovery rewards implementation status

This is the implementation ledger for **Make every level a discovery and every
campaign a memorable journey**. It distinguishes implemented candidate code from
published editions and from the remaining catalogue. Human and physical-device
evidence is deferred at the user's request, not recorded as passed.

## Current delivery batch

The first content batch contains fourteen bilingual reward definitions:

- **Coupa / Spend in Motion:** six first-win picture-and-knowledge discoveries and
  **The Connected Village**, a finale requiring six distinct mission wins.
- **DroneAid Netherlands / Workshop Lights:** six first-win discoveries and
  **A Workshop Built Together**, another six-win finale.

Each finale collects its campaign's six exact existing pictures, an original
reflection guide and an explicit link to the official public source. Rewards are
shareable local discoveries, not coupons, certifications or verified claims of
real-world impact. English and Ukrainian copy is authored in the sidecars;
sources remain attached to each knowledge payload.

The generator adds `rewardPath` only to these two campaign descriptors. Existing
mission, map, boot and artwork documents are unchanged. Allowed completion
identities come from the same Solo content execution and pressure tuning as the
game. A win on mission six cannot replace a missing earlier win. All three
existing difficulties are eligible.

The four affected editions receive new immutable content revisions:
`coupa-all` 6 → 7, `coupa-adventure` 5 → 6, `droneaid-nl-community` 5 → 6,
and `droneaid-nl-workshop-lights` 4 → 5. Four exact pre-change presentations
were captured from the integration base and appended to their retained history;
existing snapshots and their order are preserved.

The content is shared between each campaign's permitted aggregate and standalone
edition. Runtime progress and earned receipts remain scoped to the selected
logical edition. A campaign reward file does not authorize access to another
edition's content or progress.

## Phase ledger

| Phase                            | Status in this batch                                                                                                                                                    | Remaining                                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 0. Baseline                      | Existing shared engine, Journey, company pipeline, media and reward authorities inspected                                                                               | Maintain compatibility checks against the integration base                                                                      |
| 1. Reward foundation             | Candidate implementation and the two complete six-mission reward pilots                                                                                                 | End-to-end host, persistence and qualification validation before declaring complete                                             |
| 2. Game feel and authoring       | Company Studio supports sidecar creation, explicit single/all-mission rule choice, bilingual knowledge authoring, advanced JSON editing and synthetic progress previews | Expedition map, result sequence, complete cross-studio round trips, media-specific adapters and shared player-renderer previews |
| 3. Four new edition slices       | Not implemented by this batch                                                                                                                                           | Twelve new missions across Social Drone UA, Victory Drones, Ukraine and FPV Learning                                            |
| 4. First finales and control lab | Not implemented                                                                                                                                                         | Complete the first six-mission campaign in each new edition and simplified flight-control practice                              |
| 5. Content expansion             | Not implemented                                                                                                                                                         | Remaining 84 missions after the first 24; all 18 new campaign finales                                                           |
| 6. Flight simulator              | Not implemented                                                                                                                                                         | Separate optional simulator and 12 civilian practice drills                                                                     |
| 7. Qualification and rollout     | Not complete                                                                                                                                                            | Frozen candidate qualification, rollback, release evidence and authorized publication                                           |

The future catalogue remains **18 new campaigns / 108 new missions / 12 flight
practice drills**. These are not counts of work delivered by the pilot:

| Edition                 | Planned campaigns | Planned missions |
| ----------------------- | ----------------: | ---------------: |
| Social Drone UA         |                 2 |               12 |
| Victory Drones          |                 2 |               12 |
| Ukraine: Living Culture |                 6 |               36 |
| FPV Learning            |                 8 |               48 |

The two existing pilot campaigns do not consume that new-content count. Future
missions retain the shared engine and enemy behaviour. Schools/families,
beginners and hobbyists receive different learning explanations rather than
company-specific simulation rules.

## Source and visual evidence

Public sources checked on 28 September 2026:

- [Coupa culture](https://careers.coupa.com/en/life-at-coupa/) for the village's
  collaboration, accountability and belonging context.
- [Coupa purchase-order documentation](https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/features-and-processes-in-the-coupa-supplier-portal/purchase-orders/about-purchase-orders)
  for the distinction between documented supplier communication routes.
- [Coupa invoicing FAQ](https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/features-and-processes-in-the-coupa-supplier-portal/invoices/faq-about-invoicing-for-suppliers)
  for customer-dependent setup and incomplete payment details.
- [DroneAid Netherlands](https://drone-aid.nl/en) for its public technical learning
  and Ukraine-support mission, and [public reports](https://drone-aid.nl/en/reports)
  for the distinction between illustrated stories and dated evidence.

No employee photographs, new logos or outside media were imported. Existing
illustrated mission pictures retain their exact public inventory hash and their
existing review state. Reuse does not turn pending human artwork review into
approval. The fictional examples are not product policies, assembly instructions
or deployment claims.

## Recorded focused checks

- `node --test game/test/company-rewards.test.mjs`: **5 passed**. Covers bilingual
  payloads, exact admitted pictures, all six required wins, wrong gameplay and
  brand rejection, absent-asset rejection, generator round trips and the four
  exact retained pre-reward presentations.
- `node --test game/test/company-studio-rewards.test.mjs game/test/company-artwork.test.mjs game/test/edition-retained-presentation.test.mjs game/test/company-studio-ui.test.mjs`:
  **22 passed**. Includes explicit author choices, synthetic preview states,
  generic company authoring and existing studio/presentation compatibility.
- `node scripts/produce-company-content.mjs --check`: verifies all **103**
  generated company files, including the two new reward sidecars.
- Existing source, boot and artwork files remain byte-identical in the pilot
  generation diff; catalog changes are limited to the two `rewardPath` fields,
  four edition revisions and their four exact retained-presentation records.

Additional integration evidence:

- The company/edition regression suite passed **363 tests** after storage
  and multiple-pack hardening. Subsequent changed-view checks are recorded in
  the PR alongside that complete suite result.
- Storage is bounded to 1,500 ms by default. Tests cover stalled opens/transactions,
  late callbacks, quotas, corrupt saves, write leases, exact-edition imports and
  20 visits with matching database open/close counts.
- Existing Solo controls, Continue/Retry, edition switching and all fourteen
  edition startup paths pass. A reward-enabled controller-practice regression
  proves startup works without a Journey authority and cannot grant discoveries.
- Actual pilot builds were each compiled twice. Their complete ZIP bytes matched:
  Coupa adventure **533 files / approximately 25.1 MB ZIP**; DroneAid workshop
  **537 files / approximately 25.8 MB ZIP**. These are development compile checks, not
  published or qualified immutable releases. Both remain under existing budgets.
- The public source-eligibility check and 103-file content generator check pass.
  Changed-code lint, formatting and localization checks pass.
- Desktop browser smoke inspection confirmed the Ukrainian Collection and Company
  Studio's explicit **5/6 locked** finale preview. This is engineering inspection,
  not the deferred human learning/pacing study.
- Full repository `game-cli validate` is blocked by historical artwork omitted
  from this sparse checkout (`authoring/library/fpv-role-presentations/originals`).
  Selected edition builds and source checks pass; the full-checkout CI/release
  gate is still required. No check was waived or recorded as passing.

These checks do not establish physical-device performance, the requested p95
frame-time target, learning effectiveness, a completed cross-studio workflow or
public publication. Human and physical-device review remain explicitly deferred.

## Release handling

Combine compatible reviewed work in one integration PR while the release queue
is occupied. Preserve per-batch validation receipts and immutable artifacts. Do
not allocate versions or publish directly from this content generator. Existing
release coordination controls version allocation, promotion and publication.
Keep the 64 MiB / 2,000-file core offline budget and exact dependency/exclusion
checks; these pilots add JSON and reuse existing pictures.
