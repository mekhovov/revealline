# WebKit navigation error observation

The retained empty error strings do not establish that the browser reported an
empty message. The qualifier selected `error.stack` whenever it was non-null,
including the empty string. Playwright 1.62.1 constructs exactly that shape when
a WebKit JavaScript console error has no native stack trace: it preserves the
message and name but sets the stack to empty. See the pinned
[WebKit handler, lines 535–560](https://github.com/microsoft/playwright/blob/v1.62.1/packages/playwright-core/src/server/webkit/wkPage.ts#L535-L560).
This demonstrates observation loss; it does not identify the original exception.

Three independently retained reports locate the event within action 4, the
public-route `follow`, before its destination completes:

| Observation | Error UTC | Follow UTC start → completion |
| --- | --- | --- |
| Soak WebKit candidate r1 | 08:30:42.831 | 08:30:42.004 → 08:30:48.185 |
| Retry WebKit candidate r2 | 08:05:51.664 | 08:05:51.249 → 08:05:56.635 |
| Retry WebKit baseline r3 | 08:13:50.468 | 08:13:49.305 → 08:13:56.297 |

Each witness still reports the top-level `/game/playground/` URL. The recorded
destination is `/game/?practice=1&revision=2&performance=1`. That URL is an
observation of the page, not proof of the exception's originating frame or
source. The public `pageerror` event supplies the parsed Error alone; the client
separately passes source location to its context-level WebError event
([pinned client source](https://github.com/microsoft/playwright/blob/v1.62.1/packages/playwright-core/src/client/browserContext.ts)).
No additional observer or protocol subscription is introduced here. The
playground's page-hide cancellation paths remain source-level suspects only.
All historical errors and resulting failed rows remain failed and unattributed.

Future existing error witnesses gain bounded `name`, `message` and `stack`
fields, while `pageErrors` and its failure gate remain unchanged. Field limits
are 128, 1,024 and 4,096 UTF-16 code units, with explicit truncation and original
length. Non-string fields retain their type without coercion; thrown accessors
are marked unavailable. Nested values and arbitrary objects are never
serialized. Added metadata is below 32 KiB per event even under JSON escaping,
and the existing 100-event cap bounds this addition below 3.125 MiB. Existing
report, row and owner limits still apply. There is no per-frame operation,
timer, DOM traversal, upload, new native run or game-runtime change.

The complete seven-file control group passed **124/124**. It includes the
empty-stack/nonempty-message control, hostile and non-string fields, exact
limits, control characters, multibyte text, and altered historical witness,
declaration and workflow negatives. Scoped lint, formatting and diff checks
passed. Initial outcomes are retained: 100/101, then 106/107, plus a separate
14/17 profile group. Their failures were old helper pins compared to evolving
checkout bytes, including one preparer unit fixture that needed explicit
current inputs. No native result was converted to a pass.

Historical contracts now use a test-only witness independently derived from
27 exact Git blobs: actual c41 timing/audio declarations, actual 696 Long Rail
profile declaration, and the later parked 9e CPU declaration. The latter is
explicitly not original dispatch authority. Only changed observation helper
references use those records; other references still hash their current files.
Every historical declaration and workflow remains byte-identical. Future
execution admission continues to hash its own complete current tool closure.

Compact local receipts under `.cache/solo-followup/c41-successors/`:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `webkit-empty-errors-summary.json` | 6,252 | `2d929f0424f642a2b1bbd5fb8d2ec9d7bb7a7724ed22f58e8d0014985a59f079` |
| `playwright-webkit-wkPage.ts` | 61,995 | `31a1492936ecb34cea00628827ed830763f8f7a58fd761d0c4ecf4db6f6a4c9c` |
| `empty-error-controls-v1.tap` | 25,726 | `7e76c2c82586870ff7388fe27995401780936bd713003263887cd2fcd21035ca` |
| `empty-error-controls-v2.tap` | 27,176 | `8884160507bfe073dc95289b8416567f92cf15c0c0e66aa9f9f8df74565543ae` |
| `empty-error-profile-controls-v1.tap` | 7,593 | `05e4fbe0a8c840a178ca44d77e54424a3c2bb71492b923caad5c3cdd82c10a50` |
| `empty-error-controls-v3.tap` | 30,477 | `abd25691cf86400776ee4580bace5f1a091d92f114c6c15bc0b5d266c97e426a` |

The structured witness has not yet observed one of the unknown native errors.
A separately declared finite native observation is required to identify a
message or cause; no error exclusion or retry is authorized by this change.
