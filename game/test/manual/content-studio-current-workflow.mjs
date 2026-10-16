// Test-only qualification. Application mutations use real shared pad commands;
// read-only snapshots and the production compiler inspect the resulting source.
import { canonicalJSON } from '../../data-json.mjs';
import { compileContentProject, resolveMission } from '../../content-design/project.mjs';
import { CONTENT_DRAFT_DATABASE } from '../../content-design/drafts.mjs';
import { validateScenario } from '../../content.mjs';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const same = (a, b) => canonicalJSON(a) === canonicalJSON(b);
const snapshotStorage = (storage) =>
  Array.from({ length: storage.length }, (_, index) => storage.key(index))
    .sort()
    .map((key) => [key, storage.getItem(key)]);
const entryId = `qse-${Date.now().toString(36)}`;
const practiceKey = 'revealline.playground.current';
async function fingerprint(blob) {
  const bytes = await blob.arrayBuffer();
  return {
    bytes: bytes.byteLength,
    sha256: [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join(''),
  };
}
async function readDrafts(win) {
  const db = await new Promise((resolve, reject) => {
    const request = win.indexedDB.open(CONTENT_DRAFT_DATABASE);
    request.onupgradeneeded = () => {
      request.transaction.abort();
      reject(new Error('The product must create its draft database before the read-only check'));
    };
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(['heads', 'revisions'], 'readonly'),
        output = {};
      for (const name of ['heads', 'revisions']) {
        const store = transaction.objectStore(name),
          keys = store.getAllKeys(),
          values = store.getAll();
        values.onsuccess = () => {
          output[name] = keys.result.map((key, index) => [key, values.result[index]]);
        };
      }
      // IDB is owned by the iframe realm. Its JSON-only records need a local
      // read snapshot before the production canonicalizer's plain-object guard
      // can compare them with this runner realm's compiled source. No store or
      // application object is changed, and every stored key/value is retained.
      transaction.oncomplete = () => resolve(JSON.parse(JSON.stringify(output)));
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
const head = (snapshot, id) => {
  const revision = snapshot.heads.find(([key]) => key === id)?.[1];
  return snapshot.revisions.find(([key]) => key === `${id}@${revision}`)?.[1] ?? null;
};
function preserved(previous, current, allowedId) {
  for (const name of ['heads', 'revisions']) {
    const after = new Map(current[name]);
    for (const [key, value] of previous[name])
      assert(
        after.has(key) && same(after.get(key), value),
        `Historical ${name} entry changed: ${key}`,
      );
    const oldKeys = new Set(previous[name].map(([key]) => key));
    for (const [key, value] of current[name]) {
      if (oldKeys.has(key)) continue;
      assert(
        name === 'heads' ? key === allowedId : value.projectId === allowedId,
        `An unrelated ${name} entry was added: ${key}`,
      );
    }
  }
}

export const contentStudioCurrent = [
  'Current Content Studio: inspect, cancel, validate, edit, checkpoint, preview and export',
  `/game/studio/?project=${entryId}`,
  async (p) => {
    const win = p.doc.defaultView,
      $ = (id) => p.doc.getElementById(id),
      source = () => compileContentProject($('source').value).source;
    assert(
      win.location.port === '8992' && ['127.0.0.1', 'localhost'].includes(win.location.hostname),
      'Use the dedicated Content Studio qualification origin on port 8992.',
    );
    await p.wait(
      () =>
        p.doc.documentElement.dataset.toolState === 'ready' &&
        p.doc.querySelector('.authoring-input-rail'),
      30000,
    );
    assert(
      p.doc.documentElement.lang.startsWith('en'),
      'This bounded receipt uses English controls.',
    );
    await p.wait(() => $('status').textContent.startsWith('Saved locally · checkpoint '), 15000);
    const before = await readDrafts(win),
      originalLocal = snapshotStorage(win.localStorage),
      originalSession = snapshotStorage(win.sessionStorage),
      originalSource = $('source').value,
      projectId = `qsc-${Date.now().toString(36)}`,
      originalDownloadCount = p.downloads.length;
    assert(
      !head(before, projectId),
      'The generated project identity already exists; do not overwrite it.',
    );
    assert(source().id === entryId, 'The fixture did not open its dedicated starter project.');
    const waitSaved = async (expected) => {
      const deadline = Date.now() + 15000;
      let saved, latest;
      do {
        latest = await readDrafts(win);
        saved = head(latest, expected.id);
        if (saved && same(saved.project, expected)) return saved;
        await new Promise((resolve) => setTimeout(resolve, 50));
      } while (Date.now() < deadline);
      const expectedReceipt = await fingerprint(new Blob([canonicalJSON(expected)])),
        actualReceipt = saved ? await fingerprint(new Blob([canonicalJSON(saved.project)])) : null;
      throw new Error(
        `The exact accepted project did not reach a saved checkpoint: ${JSON.stringify({
          expectedId: expected.id,
          observedHead: latest.heads.find(([key]) => key === expected.id) ?? null,
          observedRevisionKeys: latest.revisions
            .filter(([, value]) => value.projectId === expected.id)
            .map(([key]) => key),
          savedProjectId: saved?.project.id ?? null,
          expectedCanonical: expectedReceipt,
          actualCanonical: actualReceipt,
        })}`,
      );
    };
    const setNumber = async (id, value, { cancel = false } = {}) => {
      await p.choose(`#${id}`);
      await p.choose('[data-editor-action="all"]');
      await p.choose('[data-editor-action="backspace"]');
      for (const key of String(value)) await p.choose(`[data-editor-action="${key}"]`);
      if (cancel) await p.pulse('back');
      else await p.choose('[data-editor-action="done"]');
    };
    const goSource = async () => {
      await p.section('#studio-source-title');
      assert(p.doc.activeElement === $('source'), 'Source section did not focus its real editor.');
    };
    await p.section('#studio-project-title');
    assert(
      p.doc.activeElement === $('project-id'),
      'Project section did not focus its identity field.',
    );
    const originalId = $('project-id').value;
    await p.edit('#project-id', ['end', 'q'], { cancel: true });
    assert($('project-id').value === originalId, 'Canceled project ID changed the field.');
    const difficulty = $('difficulty').value;
    await p.choose('#difficulty');
    await p.pulse('down');
    await p.pulse('back');
    assert(
      $('difficulty').value === difficulty,
      'Canceled difficulty changed the selected preset.',
    );
    await p.choose('#project-id');
    await p.choose('[data-editor-action="all"]');
    await p.choose('[data-editor-action="backspace"]');
    let layout = null;
    for (const key of projectId) {
      const nextLayout = /^[a-z]$/.test(key) ? 'en' : 'symbols';
      if (layout !== nextLayout) {
        await p.choose(`[data-editor-action="${nextLayout}"]`);
        layout = nextLayout;
      }
      await p.choose(`[data-editor-action="${key}"]`);
    }
    await p.choose('[data-editor-action="done"]');
    assert(
      $('project-id').value === projectId,
      'Letters/Symbols entry did not commit the exact new identity.',
    );
    await p.choose('#new');
    await p.wait(() => !$('apply').disabled);
    assert(
      source().id === projectId,
      'New project inspection did not stage the requested identity.',
    );
    assert(
      !head(await readDrafts(win), projectId),
      'Inspecting New project saved it before Apply.',
    );
    assert(
      same(await readDrafts(win), before),
      'New project inspection changed an existing checkpoint.',
    );
    await p.choose('#apply');
    assert(
      p.doc.activeElement.id === 'validate',
      'Apply did not hand focus to the enabled Inspect source action.',
    );
    await p.choose('#save');
    const starter = source(),
      firstCheckpoint = await waitSaved(starter);
    assert(
      starter.id === projectId && firstCheckpoint.revision === 1,
      'New accepted project did not start at checkpoint one.',
    );
    assert(
      originalSource !== $('source').value,
      'New project did not replace the accepted workbench.',
    );

    await goSource();
    const acceptedText = $('source').value;
    await p.edit('#source', ['end', 'q'], { cancel: true });
    assert($('source').value === acceptedText, 'Canceled source text changed the document.');
    await p.edit('#source', ['end', 'q']);
    const invalidSource = $('source').value;
    await p.choose('#validate');
    await p.wait(() => $('status').dataset.error === 'true');
    assert(
      $('apply').disabled && $('source').value === invalidSource,
      'Invalid JSON was accepted or erased.',
    );
    assert(
      same(head(await readDrafts(win), projectId), firstCheckpoint),
      'Invalid source changed the saved accepted project.',
    );
    await p.choose('#new');
    await p.wait(() => $('studio-source-discard')?.open);
    assert(
      p.doc.activeElement.id === 'studio-source-discard-cancel',
      'Discard must default to Cancel.',
    );
    await p.pulse('back');
    assert(
      !$('studio-source-discard').open && $('source').value === invalidSource,
      'Discard Back lost the unapplied JSON.',
    );
    assert(
      same(head(await readDrafts(win), projectId), firstCheckpoint),
      'Discard cancellation changed the checkpoint.',
    );
    await goSource();
    await p.edit('#source', ['end', 'backspace']);
    assert($('source').value === acceptedText, 'Repair did not restore the exact accepted JSON.');
    await p.choose('#validate');
    await p.wait(() => !$('apply').disabled);
    assert(
      same(head(await readDrafts(win), projectId), firstCheckpoint),
      'Valid inspection implicitly saved.',
    );
    await p.choose('#apply');
    assert(
      p.doc.activeElement.id === 'validate',
      'Repaired Apply stranded focus on its disabled action.',
    );
    assert(same(source(), starter), 'Explicit repaired Apply changed the project content.');
    p.record(
      'A unique New project was inspected without saving and adopted only on Apply. Project/difficulty/source drafts canceled; malformed JSON stayed available and could not Apply; in-app discard Back retained it and the saved checkpoint; repaired JSON compiled before explicit Apply',
      '#validation',
      { projectId, firstCheckpoint: firstCheckpoint.revision, retainedDrafts: before.heads.length },
    );

    await p.section('#map-name');
    const beforeGeometry = source(),
      beforeMission = beforeGeometry.missions.find((row) => row.id === $('mission').value),
      oldMap = beforeGeometry.maps.find(
        (row) => row.id === beforeMission.map.id && row.revision === beforeMission.map.revision,
      ),
      x = Number($('x').value) + 1,
      y = Number($('y').value) + 1;
    await p.choose('#board');
    await p.pulse('right');
    await p.pulse('down');
    assert(same(source(), beforeGeometry), 'Cursor movement changed geometry before Confirm.');
    await p.pulse('confirm');
    await p.pulse('back');
    const geometry = source(),
      geometryMission = geometry.missions.find((row) => row.id === beforeMission.id),
      newMap = geometry.maps.find(
        (row) => row.id === geometryMission.map.id && row.revision === geometryMission.map.revision,
      );
    assert(
      geometry.maps.length === beforeGeometry.maps.length + 1,
      'Geometry did not create one new map revision.',
    );
    assert(
      same(
        geometry.maps.find((row) => row.id === oldMap.id && row.revision === oldMap.revision),
        oldMap,
      ),
      'Geometry rewrote the original map revision.',
    );
    assert(
      same(newMap.foundations.at(-1), { x, y, w: Number($('w').value), h: Number($('h').value) }),
      'Confirmed geometry differs from the visible controller cursor/rectangle.',
    );
    const geometryCheckpoint = await waitSaved(geometry);
    await goSource();
    await p.edit('#source', ['end', 'q']);
    const pendingGeometryText = $('source').value;
    await p.choose('#undo');
    await p.wait(() => $('studio-source-discard')?.open);
    assert(
      $('source').value === pendingGeometryText &&
        same(head(await readDrafts(win), projectId), geometryCheckpoint),
      'Requesting Undo discarded or saved unapplied invalid source before confirmation.',
    );
    await p.choose('#studio-source-discard-confirm');
    await p.wait(() => !$('studio-source-discard').open);
    assert(same(source(), beforeGeometry), 'Undo did not restore the exact prior project.');
    await p.choose('#redo');
    assert(same(source(), geometry), 'Redo did not restore the exact geometry revision.');
    assert(
      p.doc.activeElement.id === 'undo',
      'Last Redo did not restore focus to the enabled Undo action.',
    );
    await p.expand('details:has(#tuning-form)');
    const oldCoverage = $('target-coverage').value;
    await setNumber('target-coverage', '66', { cancel: true });
    assert(
      $('target-coverage').value === oldCoverage,
      'Canceled numeric draft changed target territory.',
    );
    await setNumber('target-coverage', '65');
    assert(same(source(), geometry), 'Unapplied tuning fields changed the project.');
    await p.choose('#tuning-form button[type="submit"]');
    const accepted = source(),
      missionId = $('mission').value;
    assert(
      accepted.missions.find((row) => row.id === missionId).coverage === 0.65,
      'Challenge Apply did not commit the visible 65% target.',
    );
    await p.choose('#save');
    const saved = await waitSaved(accepted);
    p.record(
      'Controller cursor movement stayed unapplied until Confirm; geometry created one immutable map revision. Dirty invalid source remained intact until explicit Discard Continue permitted one Undo; one Redo restored exact geometry. Canceled numeric tuning stayed unchanged; validated 65% target was explicitly applied and reached a saved checkpoint',
      '#status',
      { projectId, checkpoint: saved.revision, map: geometryMission.map, coverage: 0.65 },
    );

    await p.choose('#play');
    await p.wait(
      () =>
        !$('preview-panel').hidden &&
        $('preview').contentDocument?.documentElement.dataset.bootState === 'ready',
      60000,
    );
    const frame = $('preview'),
      child = frame.contentDocument,
      scenario = JSON.parse(win.sessionStorage.getItem(practiceKey)),
      expected = resolveMission(compileContentProject(accepted), missionId, {
        difficulty: $('difficulty').value,
        mode: 'solo',
      });
    assert(
      validateScenario(scenario).valid && same(scenario.level, expected.level),
      'Exact Solo preview staged different or invalid mission rules.',
    );
    assert(p.doc.activeElement !== frame, 'Asynchronous preview boot stole editor ownership.');
    await p.choose('.authoring-preview-enter');
    await p.wait(() => p.doc.activeElement === frame && child.hasFocus());
    const returnButton = child.querySelector('.authoring-preview-return');
    assert(
      returnButton && p.visible(returnButton),
      'Preview has no visible real Return to editor action.',
    );
    assert(
      p.visible(child.querySelector('#game-overlay')),
      'Entering preview unexpectedly started gameplay.',
    );
    for (let step = 0; step < 100 && child.activeElement !== returnButton; step++)
      await p.pulse('down');
    assert(child.activeElement === returnButton, 'Controller could not reach preview Return.');
    await p.pulse('confirm');
    await p.wait(() => p.doc.activeElement.classList.contains('authoring-preview-enter'));
    assert(same(source(), accepted), 'Preview handoff changed the accepted source.');
    await p.choose('#close-preview');
    assert(
      $('preview-panel').hidden && $('preview').getAttribute('src') === 'about:blank',
      'Close preview retained its child document.',
    );
    assert(p.doc.activeElement.id === 'play', 'Closing preview did not restore the exact opener.');
    assert(
      same(head(await readDrafts(win), projectId), saved),
      'Preview wrote a content checkpoint.',
    );
    p.record(
      'Exact Solo scenario passed production validation and matched the accepted compiled mission. Boot retained editor ownership; explicit Enter then real child Return restored it without starting gameplay. Close released the preview and focused Play',
      '#preview-status',
      {
        projectId,
        missionId,
        difficulty: $('difficulty').value,
        stagingKey: practiceKey,
        priorStagingValuePresent: originalSession.some(([key]) => key === practiceKey),
      },
    );

    const exportBackup = async () => {
      const count = p.downloads.length;
      await p.choose('#export');
      await p.wait(() => p.downloads.length === count + 1);
      const blob = p.downloads.at(-1).blob,
        text = await blob.text(),
        parsed = JSON.parse(text),
        compiled = compileContentProject(parsed);
      assert(
        blob.type === 'application/json' && same(compiled.source, accepted),
        'Backup failed production compilation or differs from accepted source.',
      );
      assert(
        text === JSON.stringify(accepted),
        'Backup is not the exact accepted project serialization.',
      );
      return { text, receipt: { name: `${projectId}-backup.json`, ...(await fingerprint(blob)) } };
    };
    const firstExport = await exportBackup();
    await p.choose('#load');
    await p.wait(() => !$('apply').disabled);
    assert(same(source(), accepted), 'Inspect saved did not reopen the exact current checkpoint.');
    assert(
      same(head(await readDrafts(win), projectId), saved),
      'Inspect saved rewrote the checkpoint.',
    );
    await p.choose('#apply');
    assert(
      p.doc.activeElement.id === 'validate',
      'Saved-source Apply stranded focus on its disabled action.',
    );
    await p.choose('#save');
    assert(
      same(await waitSaved(accepted), saved),
      'Reapplying an unchanged saved checkpoint created different persisted data.',
    );
    const secondExport = await exportBackup();
    assert(
      firstExport.text === secondExport.text &&
        firstExport.receipt.sha256 === secondExport.receipt.sha256,
      'Reopened backup is not byte-identical.',
    );
    const after = await readDrafts(win);
    preserved(before, after, projectId);
    assert(
      same(
        after.revisions.find(([key]) => key === `${projectId}@${firstCheckpoint.revision}`)?.[1],
        firstCheckpoint,
      ),
      "Later edits or reopening rewrote the new project's original immutable checkpoint.",
    );
    assert(
      same(snapshotStorage(win.localStorage), originalLocal),
      'Content Studio changed unrelated local storage.',
    );
    assert(
      same(
        snapshotStorage(win.sessionStorage).filter(([key]) => key !== practiceKey),
        originalSession.filter(([key]) => key !== practiceKey),
      ),
      'Content Studio changed unrelated session storage.',
    );
    assert(
      p.downloads.length === originalDownloadCount + 2,
      'Unexpected extra export was prepared.',
    );
    p.record(
      'Two explicit Export backup actions produced production-compiled ContentProjectV1 JSON identical to the accepted saved project. Inspect saved, Apply and Save reopened that exact checkpoint without rewriting it; all pre-existing draft heads/revisions and unrelated storage remained unchanged',
      '#status',
      {
        projectId,
        checkpoint: saved.revision,
        exports: [firstExport.receipt, secondExport.receipt],
        retained: {
          heads: before.heads.length,
          revisions: before.revisions.length,
          localKeys: originalLocal.length,
          sessionKeys: originalSession.length,
        },
        appendedCheckpoints: after.revisions.length - before.revisions.length,
        boundary:
          'Real shared virtual-pad commands only. Read-only database snapshots/production compiler inspect results; no fixture model/storage writes. The product retains the new project and replaces only its known Solo-preview session staging key. No full reload, OS file import, candidate catalog, Team exports, media/tracing, actor/objective editors, full gameplay or publication is qualified. Explicit Export/Blob evidence requires separate actual OS-file validation; physical controllers and native platforms remain separate.',
      },
    );
  },
];
