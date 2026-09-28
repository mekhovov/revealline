# Verified learning discoveries

A reward may require both explicitly selected mission wins and named lesson
completions. The lesson reference pins its ID, revision, fixture revision, content
identity and mission. This optional bonus never controls Next, arcade progression,
simulation or scoring. Mastery predicates remain unavailable for edition export.

In Company Studio, open **Learning & rewards → Create a knowledge reward**. Choose
the mission rule, then check the learning assignments to require. Each assignment's
mission must also be explicitly included in the win rule. The JSON editor can
revise the same exact references. Preview uses synthetic evidence and cannot write
player records. Studio packets, selected edition compilation and retained
presentations keep the required lesson sidecar; an omitted or changed lesson fails
admission rather than silently satisfying an older promise.

The existing lesson proof store remains the completion authority. It replays the
arcade recording and ordered workbench actions before adopting a completed attempt.
Verification alone does not grant anything. The reward host consumes a cached
projection only after verified hydration, commit or import. Reading, retrying a
mission and changing display state do not re-run verification every frame.

The projection distinguishes verified session records from successfully persisted
records. A quota failure or lost writer lease can reveal a bonus in the current tab
with the existing save warning. It cannot save that receipt through an unrelated
later arcade win or the reward retry action. Persisting the exact proof subsequently
makes its reward eligible for saving. Existing durable records remain usable.

Changed or unavailable historical lessons do not inherit completion. Their original
proof bytes remain in the existing recovery journal; restoring the exact selected
lesson permits verification again. Already earned collectible receipts and their
promised payload revisions retain the existing backup/import behavior. These local
receipts are not signed certificates or secure entitlements, and importing one does
not create a verified lesson completion.

## Authored pilot: Find the Need

The `coupa-source-to-pay` campaign has an optional bilingual discovery,
`coupa-source-to-pay-01-learning-discovery@1`. It requires both an accepted
**Find the Need** mission win and the exact existing **Write the requirement**
lesson (lesson revision 3, fixture revision 1, with its full content identity).
Its reward explains the fictional workshop decision and offers a second,
unscored library requirement puzzle. It neither gates Next nor changes an
arcade rule, mission identity, or lesson fixture.

The factory in `game/company-campaigns/learning-rewards.mjs` receives only the
campaign's selected lessons and checked gameplay bindings. The generator emits
an independent reward sidecar. Only Coupa Foundations and Coupa All select this
campaign; other audience editions do not load its reward. Those editions advance
to revisions 7 and 8 respectively. Their exact preceding presentations are
registered as `*-before-learning-bonus.json`, including previous reward promises
and lesson bytes. Existing progress can qualify through verified proof hydration;
no completion is inferred from a displayed lesson or a claimed saved flag.
