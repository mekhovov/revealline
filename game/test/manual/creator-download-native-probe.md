# Native Creator download probe

Serve this repository, then open
`/game/test/manual/creator-download-native-probe.html?draft=<existing-draft-id>`
on the **same origin and port** that holds the draft. The required ID follows
the Creator draft format: a lowercase letter followed by up to 59 lowercase
letters, digits or hyphens. An absent or invalid ID opens no editor. The query
cannot supply a remote URL or change the embedded application route.

Use native keyboard navigation in the embedded real Picture Campaign Creator.
Generate and review the restored draft if necessary, approve it, focus Download
and press Enter or Space. The probe never focuses or activates controls and
does not install a virtual pad. Explicit actions inside Creator retain their
normal storage effects; select a qualification draft if those writes should be
isolated from your working content.

The visible `#probe-report` keeps the latest 100 observations:

- native key, click and focus events, including trusted/untrusted identity;
- `defaultPrevented` after the event's task, observed from window capture before
  document guards can stop propagation;
- blob MIME type and byte length, using the original `URL.createObjectURL` and
  preserving its returned URL and download behavior;
- focus, page visibility, browser user activation and the initial gamepad state.

A typical successful native export records a blob, a trusted Download click and
an untrusted `A` click whose `download` filename and `blob` protocol are present;
neither click is prevented. **Blob creation or a dispatched anchor is not proof
of an OS download.** Obtain the actual file receipt separately and validate its
bytes with the production bundle importer and an actual image decoder.

The September 29 qualification used this probe to isolate a standalone IAB
download-observation failure: native Enter in the probe created an actual OS
file with both clicks unprevented, an active user gesture and no gamepad. No
production download or Confirm-guard change was justified by that observation.
This is a diagnostic fixture, excluded from runtime/release packages.
