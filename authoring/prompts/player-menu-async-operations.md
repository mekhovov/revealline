# Player menu asynchronous-operation prompt

When a player action starts asynchronous preparation, activate the real visible
control and join the operation owned by its existing handler. Propagate that
promise through a wrapper only when the runtime handler currently discards it.
Do not add another operation, a global sleep, or a longer polling allowance.

Assert immediate player feedback before awaiting: a named operation, live status,
the appropriate Cancel or Retry action, and the correct focus owner. After the
operation settles, assert the final gameplay, selection, picture, checkpoint and
return-focus state. A fulfilled promise may represent success, cancellation or a
handled failure.

For destructive restore/import flows, readiness is the installation of the real
replacement-review handler. Observing readiness must never click Confirm. Require
the existing review text, Undo availability statement and deliberate player
acceptance before awaiting completion. Prove timeout cleanup, early rejection,
observer restoration and unchanged storage/assets on failure.

For cancelled lazy menus, join the original opening operation after blur, focus or
pointer cancellation. Prove that late completion does not reopen the menu or
steal focus, then reopen deliberately through the visible control. Keep finite
case bounds and reproduce the old failure with delay at the actual dependency.

Record complete-file results separately from delayed selected cases and full CI.
Modeled DOM timing does not establish browser latency, physical-controller or
public-release qualification.
