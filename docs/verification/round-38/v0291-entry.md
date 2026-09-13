# v0.29.1 immutable-entry correction — in progress

This is the living status record for **P7.7**. It is not a frozen release receipt. Source SHA, candidate gate counts, artifact hashes, PR/deployment and public-browser results remain pending until attached by the release owner.

## Trigger and preserved evidence

Frozen v0.29.0 source: `f40e1d9ecf262ba94915ddc3fc05eda074058b7a`. All six source gates and **2,355 tests** passed. Its independent rebuild matched 221 loose files, 217 manifest assets and 218 ZIP entries; the offline inventory contained 211 files / 44,864,621 bytes. All **1,207 public files / 297,561,239 bytes** matched the prepared public inventory.

An actual previously visited browser at mutable `/game/` showed new boot HTML with a hidden loading status and no readiness handshake, leaving the launch screen unfinished. This is consistent with cached v0.28 completion; the browser resource/cache provenance was not inspected. The controlled HTTP fixture below reproduces that older-app combination separately. The [immutable v0.29 permalink](https://mekhovov.github.io/revealline/releases/v0.29.0/site/game/) boots. Network-byte equality and this browser failure are separate findings; neither should be erased. The original source, tag, artifacts and cached v0.29 delivery drafts remain unchanged. Final failure/public evidence belongs to the [v0.29 record](v029-release.md).

## Bounded correction

- Version metadata becomes 0.29.1; no new gameplay, replay or media formats.
- Public mutable-root HTML entries use targets relative to the actual entry URL, selecting corresponding paths in the complete immutable edition under localhost or the deployed project prefix. Scripted forwarding preserves query/fragment. Canonical metadata still identifies the published GitHub address. A keyboard-accessible Play link works when inline navigation is blocked; the static fallback does not promise query/fragment forwarding. Standalone ZIP/source/native entry remains unchanged.
- `current-entry-routing.json` inventories each intentional root body override and its source/output hashes. Current and historical versioned runtimes remain exact; root non-HTML compatibility files remain.
- A finite root HTML retirement worker derives its scope from its own script URL and requires an exact registration match. Only known same-origin GET navigation routes are handled, including directory/index/slashless forms. It excludes `/releases/`, uses normal activation and unregisters its own root registration. It does not access/delete caches, profiles or IndexedDB, force activation/takeover, or navigate active games. Existing root tabs may need a normal close/reopen before migration. The immutable permalink is directly available; offline preparation at the new scope remains explicit.
- If app import resolves without a readiness handshake, show a usable failure, restore visible status and retain inert gameplay. A genuinely pending import remains loading; the existing slow-load message is not a false timeout failure.

## Passed source-browser failure recovery

The actual HTTP stale-app fixture loaded the older v0.28 app against the new boot surface. The browser displayed **Flight on hold**, explained that startup was not confirmed, and focused **Reload game**. The owner's DOM inspection confirmed that the main region remained inert and `display: none`; the retained screenshot visibly contains the native failure screen and no legacy controls. Evidence: `.cache/round39/browser/stale-app-recovered.txt` and `.png`.

This passes the bounded source-browser missing-handshake recovery check. It is not a frozen-artifact, old-worker migration, upgraded public-entry or full public-delivery result.

## Qualification status

| Gate                                   | Status      | Required evidence                                                                                                                                                            |
| -------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Logical source and focused regressions | In progress | Exact changed-file checks, boot import/readiness failures, alias prefix/query/hash behavior and conservative worker scope                                                    |
| Source-browser stale-app recovery      | Passed      | Actual HTTP fixture displays Flight on hold, focused Reload, hidden/inert main; retained round-39 browser snapshot and screenshot                                            |
| Exact candidate                        | Pending     | Source SHA; six isolated gates; version consistency; complete test counts/logs                                                                                               |
| Freeze and independent rebuild         | Pending     | New immutable tag/artifacts, exact inventory/ZIP/source hashes, old releases/tags unchanged                                                                                  |
| Browser migration                      | Pending     | Fresh and previously cached root entry, actual document/module URLs, normal root-worker lifecycle, preserved saved flight, explicit Resume and canonical offline preparation |
| Public delivery                        | Pending     | Reviewed/merged PR, successful Pages workflow, complete public inventory against prepared overrides and immutable bytes, actual public cached/fresh-browser startup          |

No cache or profile deletion is an acceptable migration shortcut. If an old active root worker still serves an old page until tabs close normally, record that limitation rather than forcing takeover. A direct versioned link and usable native error screen provide explicit recovery.

The previous frozen stopped-server browser journey is evidence for v0.29's immutable offline release, not an already completed v0.29.1 migration check. Physical devices remain unqualified; direct `file://` browser navigation was denied by tool policy and is covered only by finite boot tests. P3 binary download/fresh-profile restoration, P5 media authoring, full P6 production, human enjoyment and native-store readiness remain outside this correction.

See the [boot contract](../../boot-launch.md), [delivery workflow](../../feature-delivery-workflow.md) and [current roadmap](../../implementation-roadmap.md).
