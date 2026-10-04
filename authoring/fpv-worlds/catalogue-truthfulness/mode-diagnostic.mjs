// Appended to the same public-control helpers by prepare.mjs. No runtime overlay change.
async function execute() {
  try {
    fixture = await (await fetch('fixture.json')).json();
    receipt.fixture = fixture;
    receipt.limitations.push(
      'This is a diagnostic of public first-flight replay changing the selected mode, then public Missions access; no required expectation that the suspected defect reproduces.',
    );
    for (const row of fixture.files) {
      const response = await fetch(row.path),
        bytes = await response.arrayBuffer();
      check(
        response.ok && bytes.byteLength === row.bytes && (await sha(bytes)) === row.sha256,
        'Frozen served bytes ' + row.path,
      );
    }
    await mount();
    await preferences('en', 'self-level');
    await missions('packs');
    await upload('import-pack', 'content/diagnostic.rlpack', 'catalogue-diagnostic.rlpack');
    await missions();
    filters();
    selectWorld(fixture.packs.diagnostic.world);
    const before = rows();
    check(
      before.find((r) => r.title === 'catalogue-mode-split')?.metadata === 'Follow a subject',
      'Self-level diagnostic row starts Follow',
    );
    set('first-flight-mode', 'acro');
    click(q('#watch-first-flight'));
    await until(
      () => q('#flight-mode').value === 'acro' && !q('#world-pause').disabled,
      'Actual Acro example is active',
      45000,
    );
    receipt.replayStartStatus = q('#flight-status').textContent;
    await home();
    const paused = p.app.snapshot();
    check(
      paused.course === 'flight-01' &&
        paused.replay?.kind === 'demonstration' &&
        paused.replay.mode === 'acro' &&
        paused.state.status === 'paused',
      'Actual public Acro replay changed mode and paused normally',
      { course: paused.course, replay: paused.replay, status: paused.state.status },
    );
    await missions();
    const after = rows(),
      entry = after.find((r) => r.title === 'catalogue-mode-split');
    check(
      q('#flight-mode').value === 'acro' && !!entry,
      'Actual Missions returns to retained world with Acro selected',
    );
    receipt.modeObservation = {
      before,
      after,
      selectedMode: q('#flight-mode').value,
      expected: 'Observe a subject',
      actual: entry.metadata,
      stale: entry.metadata !== 'Observe a subject',
    };
    // A normal existing filter change is an independent repaint reference, not a repair.
    filters('observe');
    selectWorld(fixture.packs.diagnostic.world);
    check(
      rows().length === 1 && rows()[0].metadata === 'Observe a subject',
      'Existing filter repaint agrees with selected Acro criterion',
    );
    await finish('mode diagnostic owner');
    receipt.completed = true;
    $('status').textContent = receipt.modeObservation.stale
      ? 'DIAGNOSTIC: stale mode label reproduced'
      : 'DIAGNOSTIC: mode label current';
  } catch (error) {
    receipt.error = { message: error.message, stack: error.stack };
    try {
      receipt.failure = {
        status: q('#flight-status')?.textContent,
        rows: rows(),
        mode: q('#flight-mode')?.value,
        body: d.body.innerText,
      };
    } catch (capture) {
      receipt.captureError = String(capture);
    }
    try {
      await finish('failed mode diagnostic');
    } catch (cleanup) {
      receipt.cleanupError = String(cleanup);
    }
    $('status').textContent = 'FAILED';
  } finally {
    output();
  }
}
$('run').addEventListener(
  'click',
  () => {
    $('run').disabled = true;
    void execute();
  },
  { once: true },
);
