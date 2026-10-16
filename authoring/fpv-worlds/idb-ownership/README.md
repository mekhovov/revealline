# Connection ownership diagnostic — authoring only

The original frozen 9196 player reported that its database connection was closing
before Roadworks could begin downloading. Published bytes and exact production
import validation passed. A fresh ordinary connection later downloaded and played
the same pack, and retained Fly still worked after the Library shortcut. That
recovery does not explain the earlier failure. Preserve both observations.

This tool gathers the missing **connection events and available ownership** during
future genuine player UI actions. It does not fix, retry, repair or prove the cause
of that failure. It adds nothing to a distributed player, package manifest or cache.

The first `0e02cf6f` / 9205 native review prepared Roadworks normally but exposed an
authoring access defect: the body-level diagnostic button was inert behind native
Flight and Home modals. Its report stayed closed, so connection capture is unknown.
That fixture and negative are preserved. The child correction reparents the access
button into the focused known native modal using focus and open-attribute events,
without taking focus. It declines unknown/ambiguous top layers and active flight;
it never pauses or reconnects the player. The later passive #1517 / 9206 native
receipt is preserved separately; it does not qualify the new transaction mode.

## Precise boundary

- A separate authoring HTML suppresses the production module's automatic mount,
  imports its unchanged exported host and explicitly supplies a window/factory
  facade. **This is diagnostic bootstrap, not exact default-entry execution.**
  Window/factory and method identities differ. Native requests, database objects,
  prototypes, call receivers/arguments, returned values and thrown errors are kept.
- The facade forwards **the normal application's** open calls once. The observer
  itself never lists, probes or opens a database, creates/upgrades schema, starts a
  transaction, issues a row/Blob read, deletes, aborts, refreshes, retries or writes storage.
  Normal player operations still create and write their own data through the usual
  UI. Do not confuse those operations with an observer-only storage snapshot.
- Passive listeners record successful opens, failed/blocked opens, versionchange
  and abnormal-close events. Application event properties and default actions are
  not replaced or prevented. Only five fixed known names are exposed; other names
  are redacted. Versions and event trust are recorded. Passive mode exports no content, keys, store names,
  raw error messages, raw stacks, private filesystem prefixes, origins, credentials,
  query strings or URL fragments are exported. Owned source paths/line/column are
  retained for mapping to the separately pinned source.
- An explicit `?idbCloseCalls=1` opt-in wraps **only observed database instances'**
  close method. This changes that method identity and its own property descriptor;
  it never patches a prototype. It records successful direct close-call locations
  while preserving native receiver, return and exception behavior. Borrowed methods
  applied to another connection and cached methods from before interception are not
  observed. Refused interception is reported as unknown, never zero calls.
  Without opt-in, ordinary explicit closes are unknown: the platform sends no
  close event for them. Stop restores an owned descriptor only if it is still this
  tool's wrapper, preserving any later application replacement.
- A separate `?idbTransactions=1` opt-in observes transactions already started by
  the caller on the three known World/region/record databases. It wraps only those
  instances' transaction method and returned readonly transaction/object-store
  methods; no prototype is changed. It observes allowlisted store names, mode,
  sanitized caller locations, completion/abort, and scalar counts from the player's
  own `getAll()`/`openCursor()` success events. It never reads cursor values, keys,
  project/record fields, asset Maps or Blob bytes, and never advances a cursor.
  No request is added. Failed starts preserve the original thrown object and keep
  scope unknown rather than coercing failed arguments again. Method identities and
  owned descriptors differ; this is an authoring experiment with measurable cost.
- Capture is limited to 32 connections, 64 concurrent pending requests, the latest
  128 events and four sanitized caller locations. Dropped counts remain explicit.
  Closed connections do not release identity slots, so later opens can become
  unobserved. No listener covers another factory, global/default import path,
  worker, tab or execution context. Events alone are not a liveness probe.
- Stop/pagehide removes all owned listeners and restores owned close/transaction wrappers;
  it **does not close a connection, abort a request, stop the player or change data**.
  Late requests still reach their ordinary handlers. Context destruction/unload
  behavior after capture stops is unobserved. There is no polling or automatic
  report serialization. Read/export are deliberate operations and have cost; never
  use this host during endurance, latency/FPS or exact-entry qualification.

The [IndexedDB closing algorithm](https://w3c.github.io/IndexedDB/#closing-connection)
distinguishes abnormal close events from explicit close calls. Neither event type
identifies the underlying disk, permission or application cause. `versionchange`
reports an upgrade/delete request from some owner, not permission to complete it.
This observer neither initiates nor blocks that operation.

## Listing and close evidence — new opt-in, native gate open

Use both `idbTransactions=1&idbCloseCalls=1` only in a separately identified,
supported authoring fixture. The earlier passive 9206 native receipt does not
qualify these new wrappers. Preserve the affected public context and every frozen
origin; this tool does not inspect that context or establish its contents.

Each observed transaction retains its opaque connection identity, known database,
actual store scope/mode, sanitized caller and preceding observed explicit-close,
versionchange and abnormal-close counts. A synchronous failed start is explicit
with an allowlisted error name; unobserved/refused close interception stays null.
Matching a real close owner and later error on one connection is useful future
evidence. A synthetic close in a memory test does not explain the public failures.

`listing.outcome` distinguishes `pending`, `failed`, `unknown`, `empty` and
`nonempty`. Only a completed readonly transaction with exactly one unfiltered,
successful count for each relevant listed store can establish empty. World
`active-only` means only projects were read; retained contents remain unknown.
`active-and-retained` requires both projects and the revisions cursor to finish.
Counts are raw store-row counts, with overlap between active and retained; they
are not unique world counts. Filtered, partially traversed, stopped, refused,
overflowed and outside-facade observations cannot establish empty. A successful
read characterizes that observed connection at that time, not original data loss,
current UI state, liveness or retention across a restart.

Transaction capture retains at most 128 rows, 32 concurrent transactions and four
listing requests per transaction. Saturating dropped/refused counts disclose lost
coverage. Request/transaction listeners and method wrappers retire at completion
or abort, and all owned methods retire on Stop without closing or aborting anything.
There is no polling or automatic export. Reporting remains a deliberate paused
operation. This tool must not be used for performance acceptance.

## Freeze a new diagnostic fixture; preserve existing origins

Only stage after the coordinator releases the sole renderer. Use a **fresh reserved
origin**, keeping original 9196, its package and all player data intact. Bind the
qualified package/archive/module hashes and these tool files in a new receipt.
Copy the admitted player unchanged and serve `observe.mjs`, `transactions.mjs`, `access.mjs` and `host.mjs` under
`/authoring/fpv-worlds/idb-ownership/`. Generate an additional `diagnostic.html`
**beside** its ordinary frozen index, not over it:

```text
node authoring/fpv-worlds/idb-ownership/prepare.mjs \
  --player /external/stage/frozen/site/optional-practice/fpv-worlds/index.html \
  --output /external/stage/frozen/site/optional-practice/fpv-worlds/diagnostic.html \
  --base /frozen/site/optional-practice/fpv-worlds/
```

Both output and its identity receipt must be new. The preparer refuses existing
evidence, alternate entry scripts, existing base elements, remote/path-escape bases
and duplicate player entries. It records the original HTML hash, separate generated
HTML hash and the five tool-module hashes. This receipt does not itself hash or
qualify the whole package. Independently recheck every frozen package member and
the separate authoring import closure before native use. Do not add source fallbacks
or edit the qualified worker to make the fixture load.

Open `/frozen/site/optional-practice/fpv-worlds/diagnostic.html?lang=en#packs` for
default passive database-event capture, or add `&idbCloseCalls=1` for the disclosed
instance-method interception. The host refuses a diagnostic URL in a different
directory from its base, preserving the player's relative navigation assumptions.
The normal password screen still applies; it is not bypassed.

## Bounded native procedure — not yet accepted

1. Record exact source/package/tool hashes, browser/OS, new origin, capture mode and
   initial UI. No other renderer or elapsed observation may run.
2. Use normal Play for Roadworks **before** other UI; preserve success or failure.
   Do not seed, delete, clear, corrupt or force-close a real database to manufacture
   a diagnosis. Pause through the real player before opening **Connection diagnostic**.
3. Choose **Read captured events**, then **Export observation**. Close the diagnostic
   and use the ordinary Library → Recorded flights & recovery → Back flow. Repeat
   compact/desktop and EN/UK transitions deliberately, checking the ordinary status.
   Read/export again only while paused; no automatic actions or refresh loop.
4. If the normal player reports a closing connection, preserve its UI and the bounded
   event history immediately. Match opaque connection IDs, names/versions, owned open
   locations, versionchange and any explicit/abnormal close evidence. Missing,
   overwritten, refused, stopped or outside-facade evidence stays unknown. A forced
   close event is not proof of a particular filesystem/GC/application cause.
5. Stop observing and export the stopped report. Confirm zero owned retire actions
   and pending requests. Verify ordinary player controls remain usable without any
   automatic arm, resume, reconnect, repair or data deletion. Keep every failed
   result. Bind native observations and exported file hashes outside browser storage.

No native observation of the new transaction mode is included yet. This tool does not close offline/restart,
eviction/quota, physical-device, exact-runtime or two-hour performance gates.

## Software checks

```text
TMPDIR=/external/temp node --test authoring/fpv-worlds/idb-ownership/verify.mjs
TMPDIR=/external/temp node --test authoring/fpv-worlds/idb-ownership/verify-transactions.mjs
```

Ten focused groups use only fresh in-memory fake IndexedDB, the existing test DOM
and temporary files.
They cover native-object/operation delegation, event/default-handler ownership,
explicit interception and restoration, redaction, bounded overflow, late request
completion after stop, foreign method receivers/constructors, and separate immutable
host preparation. The modal boundary models native inertness explicitly: a body
sibling cannot activate, the tool must belong to the current known modal, normal
focus stays put, unknown/active ownership is refused and teardown retires listeners.
This DOM model is not browser-layout acceptance. Fake IndexedDB lacks native WebIDL coercion/receiver checks; two
small delegated-boundary sentinels test those contracts explicitly. Its forced-close
helper and synthetic events are software stimuli, **not observed browser failures**.

Ten additional groups exercise the actual main741 WorldStore listing in isolated
fake IndexedDB, active/retained/empty counts, pending/immediate and mid-read aborts,
filtered/incomplete/stopped reads, caller-owned cursor progression, same-connection
close attribution, thrown identity, one argument coercion, detached snapshots,
unknown databases, later owners, refused interception and bounded capture. No
native closing failure or original public data visibility is reproduced by them.
