# Studio native opener completion contract

The native Settings → Studio controller test must wait for the original public opener to complete before editing its lazily loaded authoring controls. The dialog and Close action can become usable after the saved-library reload while the authoring module is still pending. That early state does not promise that the native track listbox exists.

This fixture-only prerequisite captures the promise returned by the existing `soundtrack-open.onclick` during the unchanged controller Confirm activation. It invokes the original handler with the original receiver and arguments, asserts exactly one public invocation and a real completion promise, records its terminal completion through both fulfillment and rejection callbacks. The same existing readiness wait and deadline now require that completion together with the original dialog/Close predicate. Only after that bounded wait does it await the already-terminal original promise to propagate rejection. A `finally` around the whole join restores the original handler while the fixture still owns its temporary wrapper. The existing dialog, listbox, range, preview/cancel/apply, Back/focus, paused-clock and error assertions remain. No production module, shared helper, timeout, controller event, production readiness condition or expected result changes.

## Evidence and remaining checks

Exact lifecycle head `8e3340484c184401a555f257b2ba5f2007ed4f1c` passed all eight changed whole files, 414 cases. Its separate preview run `39330463032` completed 1889 cases: 1877 passed and 12 failed, without skips, cancellations or todos. One failure was this unchanged native test reading `size` from its absent track listbox at line 949; the other failures were nine Replay unexpected-read assertions and two FPV package byte-budget errors. Complete failure evidence remains retained. Preview packaging was skipped.

Source review traces the native opener directly to `soundtrackPanel.open()`. That operation starts lazy authoring, awaits the saved-library reload, and then awaits authoring before returning. The test previously waited only for the dialog and Close action. These source facts motivate the completion fence; they are not an executed baseline or product-cause finding.

At preparation, the new fixture has not been executed or statically qualified. Complete native-file, source, preview, package and device results must be recorded against its eventual exact version. Prior lifecycle and separate Replay prerequisite results do not qualify this test correction.
