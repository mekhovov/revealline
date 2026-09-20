# P01 — authored Journey execution boundary

`createContentExecutionCatalog` is the candidate host's immutable preset index.
It resolves Gentle, Standard and Expert independently from the same authored
ContentProjectV1 through `resolveContentJourney`; it never applies the legacy
Gentle projection to an already resolved level. Player movement remains 10 cells/s,
lives are 5/3/2, and measured keepers use 0.85/1/1.1 of their catalog speed.

Pack and campaign ownership are explicit in both select and exact-execution
lookup. The same campaign may belong to more than one pack without losing its
navigation owner. The index cannot load assets, install packs, publish editions
or grant official progress. Do not pass its entries into the Legacy execution
catalog; its selection API intentionally requires the pack owner.

Seven focused tests passed locally on 20 September 2026, covering all preset
engine levels, source immutability, exact identity lookup, shared campaign
membership, cross-campaign ordering, CLI parity and invalid authority/mode inputs.
This is a host integration building block, not a mounted Journey route or public
release acceptance.

Remaining host integration must:

- Adopt an exact compiled project and its immutable media pins transactionally.
- Keep candidate play ineligible for official awards; published content needs a
  separate reviewed edition authority and persistent stable navigation IDs.
- Preserve Legacy Standard/Gentle, old saves/replays and their original identities.
  Never relabel or reinterpret a historic Gentle execution as Journey Gentle.
- Give the new Journey a deliberate Expert selection without making historical
  preference records invalid or silently converting an active attempt.
- Use the existing retained-result preparation owner for Next/Skip/cancellation,
  rearm controls individually and qualify failed media/load/save behavior.
- Mount and test the actual Solo and paired-board hosts. Do not substitute the
  isolated Studio scenario preview for an uninterrupted ten-mission Journey.

Team remains a separate versioned adapter: its older connected-ground geometry,
speed and rescue-life contract cannot be silently reinterpreted as this policy.
