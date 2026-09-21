# Team presentation display ownership

`createCoopPresentationDisplay` coordinates the selected attempt's painter snapshot,
menu Auto-theme reference and optional DOM presentation layer. It does not select
content, prepare pictures, release attempt leases, write preferences or modify a
simulation.

Supply `getSelection`, `getDefaultSnapshot`, `painter`, `element` and
`setMenuPresentation`. Optional `isDisposed` prevents late work; `paintOptions`
provides current display accessibility options. `initialMenuSnapshot` defaults to
`null`, the menu component's declared initial fallback. It is independent of the
painter: the page loader may already bind a prepared painter before the first menu
update. An already initialized menu must supply its actual initial snapshot.

The API consists of:

- `sync()` applies the selected binding snapshot, or the current page default when
  there is no selection. It returns `true` only while that target still owns the
  display. Stale/reentrant work returns `false`; application failures throw.
- `paintPrepared(candidate, binding)` paints a preflight with the exact proposed
  snapshot and current options, then restores the previous painter. It never
  applies a menu or DOM theme. A newer display adoption invalidates the old
  preflight and raises `AbortError`; nested read-only preflights restore in stack
  order. `picture` always comes from the exact supplied binding.
- `dispose()` retires the display-owned DOM cleanup once and stops future work.
  The host separately disposes its painter, menu controls, page and attempt leases.

Every rejected sync restores both the previous painter and the previous menu
snapshot, including `null`, while its transaction still owns the display. Resetting
only the visible palette attribute is insufficient: `attachMenuStyleControls`
retains the theme used by Auto and reapplies it when preferences refresh. A menu
setter that changes state before throwing must therefore be rolled back through
that setter. A dirty marker forces the next sync to repair all surfaces even when
its selected object matches the previous committed trackers.

Each callback and cleanup can reenter application code. A newer transaction owns
its own painter/menu/DOM layer; older rollback must never overwrite it. Cleanup is
idempotent. If rollback also fails, an `AggregateError` reports the original and
rollback failures and later sync remains eligible to repair. Once a new display
owner commits, a failure retiring the old cleanup cannot discard the new owner.

The host must route initial page readiness, preparation retries, lobby-ready
selection, run adoption and rollback through this owner. After initialization,
avoid direct menu presentation writes that bypass its stored baseline. The host
also retains its existing run/selection guards around preflight and supplies the
appropriate selected attempt; this module does not decide which attempt is current.
Preview rendering uses its own painter and must not call this page display owner.

Application functions must return their cleanup handle or roll back any partial
application before throwing. This is the existing presentation DOM-owner contract;
a caller cannot recover a resource for which a throwing function never returned
ownership. The page owns default CSS; the display owns only the extra selected
attempt layer.

Qualification uses real `createPresentationDOMOwner` and
`attachMenuStyleControls`, including Auto palette behavior, explicit preferences,
null fallback and later `pageshow` refresh. The DOM/CSS/painter are modeled, so these
checks do not replace native browser or public release journeys. No new production
assets, default theme, save records or release version are adopted here.

Maintenance prompt: “Treat Team painter, menu internal Auto-theme and DOM styles
as one guarded display transition. Prove failure after mutation, stale callbacks,
newer-owner reentry, explicit null baseline, preference refresh, preflight restore
and exact cleanup. Never roll an old snapshot over a newer accepted owner; do not
claim a palette-only comparison proves ownership or native qualification.”
