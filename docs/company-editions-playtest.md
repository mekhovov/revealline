# Company editions: formative playtest packet

Prepared 26 September 2026 against the authored 33 missions and 24 lessons. **Human playtesting has not happened yet.** Every observation below is pending. This packet prepares the sessions; it does not approve the content, artwork, accessibility or release.

## Decision this round supports

Before producing more reveal pictures, establish whether a person can identify the arcade objective, recover and inspect evidence, explain a configuration’s consequence, and apply the idea to changed fictional records. Use one first mission from each learning campaign, plus First Connection as a warm-up. These first missions are available without manufacturing campaign progress. The three DroneAid missions are a separate short narrative/readability check.

The game has eight candidate reveal pictures: First Connection, the four Coupa learning openings and all three DroneAid missions. **Twenty-five missions still lack dedicated reveal pictures: twenty learning missions and five adventure missions.** The eight existing pictures are candidates, not evidence of final visual approval. Do not produce the remaining artwork until this formative gate has observations and a recorded design decision.

## What the game actually does

- Every authored map is 72 × 36 cells. Every mission has one visible required `connection` objective, permanent walls/return islands, and a coverage target. The target rises from 48% to 64% through each six-mission campaign; DroneAid ends at 56%.
- A positive cut closure or objective capture releases the next lesson record in authored order. Winning releases any remaining records. No record is assigned to a particular pictured desk or building. Initially the records are locked. Inspect marks a recovered record as read; Configure and Commit operate only at safe checkpoints or results.
- Geometry, threats and arcade score do not change in response to a lesson answer. An incorrect commit explains the problem and leaves the draft editable. Arcade completion and learning completion are separate requirements for progression.
- Reflections have several valid approaches and no values/personality score. The game’s flower is the official Coupa mark with the agreed cosmetic rotation exception; it is not Coupa’s Navi assistant. Threats represent fictional process friction, not people or suppliers.
- The current 40–180-second mission duration is an authoring target, not an observed human completion time. Machine routes for one seed prove reachability, not usability or pacing.

If a player assumes that a scenic workstation controls record availability, record the misunderstanding. Do not coach them into a mechanic the game does not implement. If the evidence step feels like unrelated questions after an arcade level, that is a design finding to resolve before art expansion.

## Facilitation and setup

Plan a 15–25-minute session per audience, allowing breaks and extra time. This is a scheduling allowance, not a speed requirement. Recruit people who resemble the intended audience; include novice arcade players and different input or motion preferences. A small first round finds problems but does not estimate a population’s learning performance. Keep culture sessions voluntary and do not report personal reflection choices to a manager.

1. Start the local server with `node scripts/game-cli.mjs serve --port 8768`. Use a separate browser test profile so existing progress is untouched. Do not clear a participant’s storage. Record the Git commit, edition ID/revision, lesson and fixture revisions, browser/device, viewport, input method, difficulty and motion preference. Save only consented, publication-safe evidence; use an anonymous participant ID.
2. Open `http://127.0.0.1:8768/game/company.html?edition=coupa-adventure`. Play **First Connection**. Give only the normal in-game instructions. Ask, “What are you trying to complete?” and “What can interrupt your route?” Record whether they can identify the objective marker, coverage goal, safe return and visible threat.
3. Open the audience URL below. Ask the participant to complete its first mission and assignment. Observe the first record unlock, a safe workbench opening, their first commit and recovery from any error. Do not demand that they fail, and do not manufacture a wrong answer to improve the evidence.
4. Before showing any solution, ask, “What evidence did you use?”, “What would the other choice change?” and “What happened in the game, and what happened in the fictional record?” Record the explanation in their own words. A correct dropdown selection without an explanation is insufficient evidence of comprehension.
5. Open [Transfer practice](../authoring/company-studio/playtest.html), select the corresponding second fixture below, and let the participant inspect its records. This uses the game’s workbench controls without arcade recovery or progression. Capture their initial answer and explanation **before Commit** reveals feedback. The cards also work as a verbal or written exercise. This checks immediate near transfer only, not retention or real Coupa proficiency.
6. Ask what was confusing, enjoyable or tiring. Repeat a short part with reduced motion or a different input if the participant wants to. Stop for discomfort or an inaccessible control; log the blocking issue rather than a learning failure.

| Audience      | URL suffix                   | First mission / assignment                  | Distinct outcome                                                                         | Transfer fixture                   |
| ------------- | ---------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------- |
| Culture       | `?edition=coupa-culture`     | Hello, Village / Make a first connection    | Choose a connection approach, explain its consequence and a follow-up; no value judgment | `playtest-culture-connection`      |
| Source-to-pay | `?edition=coupa-foundations` | Find the Need / Write the requirement       | Derive item, quantity and arrival from the need instead of copying an offer              | `playtest-foundations-requirement` |
| Operations    | `?edition=coupa-operations`  | Find Your Work / Choose the actionable task | Distinguish an assigned task from another role’s work or an informational notification   | `playtest-operations-owner`        |
| Developers    | `?edition=coupa-developers`  | Resource Atlas / Plan a resource read       | Select the requested business object and a read operation; do not create a record        | `playtest-developers-resource`     |

### Second-fixture participant cards

Use `http://127.0.0.1:8768/authoring/company-studio/playtest.html` for the interactive tasks. All records are available for Inspect immediately. Open, restart, task selection, close and leaving the page clear the current response; no answers or results are written to storage or sent anywhere. Export task cards downloads only participant information. The page earns no campaign credit and captures no human observations automatically.

The executable source is [playtest-fixtures.mjs](../game/company-campaigns/playtest-fixtures.mjs). These four tasks have separate lesson/mission identities and are not imported into the shipped catalog. The participant export removes expected answers, coaching feedback, reflection consequences and success text:

```sh
node --input-type=module -e 'import {COMPANY_PLAYTEST_FIXTURES,companyPlaytestTask} from "./game/company-campaigns/playtest-fixtures.mjs"; console.log(JSON.stringify(COMPANY_PLAYTEST_FIXTURES.map(row => companyPlaytestTask(row.id)), null, 2));'
```

Present only the exported task’s brief, role, records and choices. Do not show the source module or facilitator notes until the initial response is recorded.

| Task        | Changed evidence                                                                                                                                | Neutral follow-up                                                              |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Culture     | A teammate cannot attend live and has asked for a written introduction. Two asynchronous connection approaches remain available.                | “How would you find out whether your approach helped this teammate?”           |
| Foundations | Twelve learners share six stations. Kits already exist; each station needs a case by 4 November. An unsolicited offer proposes more kits, late. | “Which facts changed the requirement from the first workshop?”                 |
| Operations  | You are now the approver assigned to R-405. The old R-301 address task belongs to requester Lee.                                                | “Why does the familiar R-301 task no longer belong to you?”                    |
| Developers  | A support lookup needs an existing invoice’s status. The supplier name is only context.                                                         | “Which part of the first request plan stays the same, and which part changes?” |

<details>
<summary>Facilitator answer and reasoning guide — do not show before the response</summary>

- Culture: both offered approaches complete an unscored reflection. Listen for respect for the stated asynchronous preference and a concrete follow-up. Do not infer belonging or personality from the choice.
- Foundations: six reusable cases by 4 November. Existing kits remove the need for new kits; paired stations change the quantity basis. Buying twelve kits repeats surface details instead of applying the requirement concept.
- Operations: open R-405 and review its supporting quote. Selection assigns work; it does not grant approval. The requester’s address task and approved-invoice notification remain separate.
- Developers: `invoices` with `GET`. The resource changes because the requested result changes; the read operation remains appropriate. Mentioning a supplier does not turn an invoice lookup into a supplier lookup.

The generic reducer can replay these choices for fixture integrity, but an unbound local attempt earns no Journey progress. Automated correctness does not establish that a participant understood the task.

</details>

### Record observations without inventing a result

Copy one row per participant and task. Record “not observed” when a step was skipped; do not replace it with pass.

| Participant / task | Build + lesson pins | Objective/threat explanation before help | First record unlock understood? | Safe workbench + first commit | Explanation of consequence | Transfer first answer + reasoning | Assistance / access barriers | Time, pauses, deaths, retries | Decision / owner |
| ------------------ | ------------------- | ---------------------------------------- | ------------------------------- | ----------------------------- | -------------------------- | --------------------------------- | ---------------------------- | ----------------------------- | ---------------- |
| Pending            | Pending             | Pending                                  | Pending                         | Pending                       | Pending                    | Pending                           | Pending                      | Pending                       | Pending          |

| Representative            | Current human observation | Open decision                                                                       |
| ------------------------- | ------------------------- | ----------------------------------------------------------------------------------- |
| First Connection          | Not tested                | Goal, threat and safe-return readability                                            |
| Hello, Village + transfer | Not tested                | Is reflection useful and visibly unscored?                                          |
| Find the Need + transfer  | Not tested                | Does the player derive a requirement rather than memorize the first answer?         |
| Find Your Work + transfer | Not tested                | Can the player change action when the role changes?                                 |
| Resource Atlas + transfer | Not tested                | Can the player separate object selection from read/write intent?                    |
| DroneAid Workshop Lights  | Not tested                | Recognizable community workshop; safe return and required objective                 |
| DroneAid Community Relay  | Not tested                | Collection/packing story and differentiated route decisions                         |
| DroneAid After the Storm  | Not tested                | Fictional support narrative understood; slow terrain and two threats remain legible |

After a round, keep verbatim observations separate from interpretations. Fix any observed blocker or incorrect domain inference, then retest that case. Record a named design decision on whether to proceed to the next art batch, repeat the slice, or change the interaction. If people pass choices by guessing or treat the arcade as unrelated to the assignment, investigate that finding; do not paper over it with more art. A successful formative round still does not satisfy the separate installed-PWA, storage recovery, rollback, accessibility or performance release gates.

## Content audit: all 24 lessons

Reviewed against current official sources on 26 September 2026. This is an authored content review, **not company endorsement or human validation**. Requirements, amounts, dates, workflow policies and identifiers are fictional. Exact screen layouts, tenant permissions and production payloads are deliberately outside the scope.

| Campaign / lesson | Claim and handoff checked                                       | Audit disposition                                                                                         |
| ----------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Culture 01        | Optional introduction paths; Cultivate Belonging                | Current public value; both consequences valid                                                             |
| Culture 02        | Listen and confirm a shared handoff; Drive Success for #AllofUs | Current public value; no customer story asserted                                                          |
| Culture 03        | Asynchronous participation and advance questions                | Fictional inclusive practice; no inferred disability                                                      |
| Culture 04        | Owner, status, next step; Own our Results                       | Current public value; open question retained                                                              |
| Culture 05        | Small reversible experiment; Build Tomorrow Together            | Current public value; improvement is not guaranteed                                                       |
| Culture 06        | Share learning and credit contributions                         | Fictional reflection; no culture score                                                                    |
| S2P 01            | Need before supplier offer                                      | Feedback now explains missing equipment, quantity and date consequences                                   |
| S2P 02            | Compare full scope, date and budget                             | Feedback identifies why each rejected offer fails                                                         |
| S2P 03            | Carry agreed scope/terms forward                                | Document handoff only; no invented legal rule                                                             |
| S2P 04            | Draft → required internal review → possible order               | Fictional threshold/owner; submission does not itself issue an order                                      |
| S2P 05            | Actual partial delivery on the right line                       | Feedback explains the hidden outstanding quantity and wrong-order risk                                    |
| S2P 06            | Reconcile documents; approved does not mean paid                | Added explicit simplified AP acceptance rule and no-other-holds assumption; not a general approval policy |
| Operations 01     | Assigned work versus notification                               | Requester board is fictional; not a replica of supplier CSP Workbench                                     |
| Operations 02     | Repair quantity, save draft separately from submit              | Feedback explains premature review and under-ordering                                                     |
| Operations 03     | Apply this case’s quote requirement                             | No universal monetary threshold claimed; specific repair reason preserved                                 |
| Operations 04     | Pending change leaves accepted order unchanged                  | Source narrowed to current PO-change documentation; owner is fixture policy                               |
| Operations 05     | Correct item line and actual quantity                           | Feedback distinguishes undelivered goods and wrong-line posting                                           |
| Operations 06     | Invoice discrepancy, preserve correct receipt                   | AP/supplier handoff is fixture policy; no country-specific correction rules                               |
| Developer 01      | Business resource + GET for an existing-record read             | Core API concept; no network request                                                                      |
| Developer 02      | Unattended client credentials + needed read permission          | Scope names are training labels; no credentials or tenant setup instructions                              |
| Developer 03      | Continue a frozen filtered read                                 | Two tiny pages are a local fixture, not Coupa’s page size or a general cursor contract                    |
| Developer 04      | Resolve active existing fixture references                      | No claim that every accounting configuration requires a preexisting full account                          |
| Developer 05      | Repair quantity on a quantity-based draft line                  | Source narrowed to requisition creation examples; successful draft is not order issuance                  |
| Developer 06      | Retry confirmed-absent failed item; reconcile before success    | Explicit local recovery policy; does not promise endpoint idempotency or safe blind retries               |

Practice lesson revisions advance to 3 for the causal feedback changes. S2P-06’s changed records advance its fixture revision to 2. Culture lessons remain revision 3 / fixture 2. Practice campaign/project/pack revisions and their four affected editions advance to 2. Map and mission geometry revisions remain 1; the existing simulation proofs must still match. Older learning transcripts do not silently satisfy revised lessons; compatible arcade progress can remain.

## Mission design audit: all 33 maps

All topologies are distinct. Six-mission campaigns deliberately share the same escalation schedule: one field keeper in missions 1–2; two in mission 3; field keeper plus perimeter patrol in missions 4–5; two plus patrol in mission 6. Mission 5 adds slow terrain. This consistency supports learning controls, but whether repeated escalation becomes monotonous is untested. Walls are permanent obstacles, islands are safe returns, and scenery cannot create new collision rules.

| Campaign                 | Missions in order: route distinction to observe                                                                                                                                                                                                                                         | Gap to investigate                                                                                                                        |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Spend in Motion          | 01 First Connection: central return; 02 Supplier Square: divided courts; 03 Paper Jam: split field threats; 04 Shared Routes: long dock versus small return; 05 Quarter-End Weather: slow centre and outer patrol; 06 Make Room for Tomorrow: central/outer garden choice               | Only 01 has a dedicated candidate picture. Supplier/community scenery must never label suppliers as enemies.                              |
| Inside the Village       | 01 Hello, Village: separated meeting returns; 02 Listen, Then Link: divided courtyard; 03 Room for Everyone: side returns and centre; 04 Own the Handoff: exposed lane with interior return; 05 Build Tomorrow: separated benches and slow centre; 06 All of Us: several return islands | Reflection records are sequential, not bound to people or rooms. Only 01 has a candidate picture.                                         |
| From Need to Value       | 01 Find the Need: single interior return; 02 Choose Together: paired offer islands; 03 Terms Bridge: middle bridge return; 04 Request to Order: three handoff returns; 05 Received in Part: split delivery returns and slow lane; 06 Close the Loop: three-record composition           | Visual “record stations” are metaphors, not selectable objects. Only 01 has a candidate picture.                                          |
| A Day in Coupa           | 01 Find Your Work: opposing task returns; 02 Repair the Draft: evidence shelves; 03 Review the Request: three-room split; 04 Handle the Change: desk/dock connection; 05 Record the Delivery: central and side bays; 06 Clear the Exception: three-wall obstruction and two returns     | Future picture must not resemble a live Coupa UI. Only 01 has a candidate picture.                                                        |
| Connect the Network      | 01 Resource Atlas: two reference returns; 02 Scoped Access: centre and side routes; 03 Beyond Page One: three returns; 04 Known References: separated reference islands; 05 Draft, Validate, Explain: three walls and slow lane; 06 Run Ledger: four returns and mixed threats          | Network scenery must not imply live API calls or credentials. Only 01 has a candidate picture.                                            |
| DroneAid Community Relay | 01 Workshop Lights: two workbench returns; 02 Community Relay: centre dock and outer hubs; 03 After the Storm: two return islands, slow lane and two field keepers                                                                                                                      | All three have candidate pictures. The third story is fictional civilian support, not a documented mission or a drone-operation tutorial. |

DroneAid’s Portugal site describes technical workshops and a military-support destination; Germany’s site describes community workshops and humanitarian destinations. These regional descriptions are not interchangeable. The pilot borrows the public workshop/community identity while telling a clearly fictional civilian story. It must not claim that DroneAid is exclusively civilian or that the illustrated recovery operation actually happened. The Portugal wildfire page is an open call, not evidence of completed deployments.

## Art coverage and first post-gate batch

**Composition briefs only — no generation authorized by this packet.** Retain the approved Coupa navy/royal-blue tokens, Poppins UI and original intact mark. The home/presentation identity and glyphs stay separate from generated scenic art. Use the existing candidate style as a reference; do not redraw logos, invent employees, imitate a product screen or put legibility-critical text inside an image. Keep hazards, objective marker, trail and safe-ground overlays readable over partial reveals. Inspect the actual board crop at narrow and wide viewports before registering any derivative.

First batch, only after the recorded formative decision, contains at most three pictures:

| Mission                        | Composition brief tied to the actual map                                                                                                                                                                                                                                                                     | Readability review                                                                                                                                                          |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S2P-02 Choose Together         | A market seen from above, three distinct offer pavilions around two calm central return plazas. Map walls at x17/y10 and x49/y10 divide side lanes; central foundations at x29/y10 and x29/y23 suggest shared comparison space. Use cases, delivery parcels and a simple budget ledger as decorative motifs. | No baked-in answer, supplier villain or implied click target. The actual objective near x15.5/y8.5 and both playable return islands must stand out under renderer overlays. |
| Operations-02 Repair the Draft | An orderly request workshop with a central review desk and a smaller side shelf. Walls at x17/y8 and x43/y8 form a partial upper divider; returns at x30/y15 and x14/y25 provide quiet resting areas. Loose cards gather into a coherent draft without product UI imitation.                                 | Keep lower return visible; avoid dense paper lines that resemble the player trail. Show incompleteness through objects, not tiny text.                                      |
| Developer-02 Scoped Access     | A friendly reference-data garden with two calm central collection plazas. Permanent walls at x17/y12 and x43/y22 frame the route; returns at x32/y8 and x32/y23 anchor the composition. Small read-only book motifs suggest selective access; no locks that look like new gameplay gates.                    | Do not depict credentials or executable payloads. Keep decorative “network” lines faint enough to distinguish from active cuts and threats.                                 |

Coordinates above are composition references only. The engine remains authoritative; confirm them against the authored map before final production. Reusing one image on multiple maps must not be described as separate finished mission art.

Remaining review batches (never more than three images at once): Culture 02–04; S2P 03–05; Operations 03–05; Developers 03–05; S2P/Operations/Developers 06; Culture 05–06; Adventure 02–04; Adventure 05–06. This covers exactly the 25 missing slots. Every batch needs source/provenance, crop/contrast, reduced-motion context and story review before assigning an asset revision. A new picture changes presentation identity and must preserve the pinned old release for exact restoration.

## Sources and verification

- [Coupa Life at Coupa](https://careers.coupa.com/en/life-at-coupa/) and [Belonging](https://careers.coupa.com/en/life-at-coupa/belonging/) support the current four values and community framing; the fictional choices are our instructional scenarios.
- [Source-to-pay glossary](https://docs.coupa.com/en/coupa-glossary/overview/s) supports the process scope, not the fixture’s prices or thresholds.
- [Requisitions](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/transactional-resources/requisitions-api-requisitions) and [creation examples](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/transactional-resources/requisitions-api-requisitions/requisitions-api-example-calls) distinguish draft creation and submission, and explain quantity-based line validation.
- [Receipts](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/transactional-resources/receipts-api) documents receiving quantities and associations. The exercise’s counts and reconciliation rule are fictional.
- [Invoice statuses](https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/features-and-processes-in-the-coupa-supplier-portal/invoices/view-and-manage-invoices) distinguishes acceptance for payment from a payment event. [PO changes](https://docs.coupa.com/en/supplier-documentation/coupa-for-suppliers/the-coupa-supplier-portal-or-csp/features-and-processes-in-the-coupa-supplier-portal/purchase-orders/view-and-manage-pos/edit-a-po-in-the-csp) documents that changes become effective after approval.
- [Core API introduction](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/get-started-with-the-api), [OIDC clients](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/oauth-2.0-and-oidc/openid-connect-clients), [querying options](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/get-started-with-the-api/querying-options) and [integration runs](https://docs.coupa.com/en/developer-documentation/the-coupa-core-api/resources/transactional-resources/integrations-api-integrations/integration-runs-api) support the developer concepts. No live endpoint behavior is inferred from the local fixtures.
- [DroneAid Portugal](https://drone-aid.pt/en), [DroneAid Germany](https://drone-aid.de/) and the [Portugal wildfire open call](https://drone-aid.pt/pt/open-call/wildfires) establish distinct regional/public context; they do not document the pilot’s fictional scenes.

Automated fixture checks:

```sh
node --test game/test/company-playtest-fixtures.test.mjs game/test/company-learning.test.mjs game/test/company-evidence.test.mjs game/test/company-campaign-routes.test.mjs
node scripts/produce-company-content.mjs --check
```

These checks establish valid frozen task data, changed-answer behavior, isolated task identities and unchanged legal arcade routes. They do not populate the human-observation tables above.
