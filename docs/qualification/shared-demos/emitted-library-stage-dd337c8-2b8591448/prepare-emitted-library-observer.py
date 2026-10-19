import pathlib,json,hashlib,re
root=pathlib.Path.cwd()
cap=root/'.cache/shared-demos-emitted-dd337c8-2b8591448'
out=root/'.cache/emitted-library-stage-observer'
out.mkdir(exist_ok=True)
manifest=json.loads((cap/'manifest.json').read_text())
sha=lambda b:hashlib.sha256(b).hexdigest()
pins=[]
def read(name):
 f=next(x for x in manifest['files'] if x['path']==name)
 b=(cap/'blobs'/f['sha256'] if f['storage']=='blob' else root/name).read_bytes()
 assert len(b)==f['bytes'] and sha(b)==f['sha256']
 return f,b.decode()
def once(s,a,b):
 assert s.count(a)==1,(a,s.count(a));return s.replace(a,b)
def save(name,f,original,projected):
 file=out/(name.replace('/','__'))
 file.write_text(projected)
 pins.append({'path':name,'original':{'bytes':len(original.encode()),'sha256':sha(original.encode()),'storage':f['storage']},'projection':{'path':str(file.relative_to(root)),'bytes':len(projected.encode()),'sha256':sha(projected.encode())}})
f,s=read('game/app.mjs'); original=s
for label,statement in [
 ('incoming.getUnifiedMissionLibrary','const host=await getUnifiedMissionLibrary(incomingCurrent);'),
 ('incoming.prewarm','await incomingPrewarm?.catch(()=>{});')]:
 s=once(s,statement,f'globalThis.__demoLibraryStage?.({json.dumps(label)},"enter");\n'+statement+f'\nglobalThis.__demoLibraryStage?.({json.dumps(label)},"settled");')
s=once(s,'const views=publishedRouteViews(route);','const views=publishedRouteViews(route);\nglobalThis.__demoLibraryStage?.("library.publishedViews","observed",{available:!!views,route:route.id});')
s=once(s,'if(globalThis.RevealLineBoot)globalThis.RevealLineBoot.ready();','globalThis.__demoLibraryStage?.("boot.ready","enter");\nif(globalThis.RevealLineBoot)globalThis.RevealLineBoot.ready();')
save('game/app.mjs',f,original,s)
for name,functions,imports in [
 ('game/mission-library/multiplayer-expeditions.mjs',['teamExpeditionLibrarySource','duelExpeditionLibrarySources'],['createTeamExpansionCandidates','createDuelExpansionCandidates','createCandidateTeamHost','createCandidateVersusHost']),
 ('game/mission-library/supplemental-hunt.mjs',['supplementalDuelSources'],['createHuntTrainingCandidates','createCandidateVersusHost'])]:
 f,s=read(name); original=s
 wrappers=[]
 for fn in functions:
  s=once(s,'export function '+fn+'(','function __native_'+fn+'(')
  wrappers.append(f'export function {fn}(...args) {{ return globalThis.__demoLibraryStageSync({json.dumps(fn)}, () => __native_{fn}.apply(this,args)); }}')
 for fn in imports:
  pattern=r'(?P<before>import\s*\{[^}]*?\b)'+re.escape(fn)+r'(?P<after>\b[^}]*?\}\s*from)'
  s,count=re.subn(pattern,lambda m:m['before']+fn+' as __native_'+fn+m['after'],s,count=1,flags=re.S)
  assert count==1,fn
  wrappers.append(f'function {fn}(...args) {{ return globalThis.__demoLibraryStageSync({json.dumps(fn)}, () => __native_{fn}.apply(this,args)); }}')
 s+='\n// Diagnostic observation only; original calls, results and thrown values are retained.\n'+'\n'.join(wrappers)+'\n'
 save(name,f,original,s)
source='scripts/qualify-demo-restoration-browser.mjs'
s=(root/source).read_text()
for m in ['shared-demo-browser-report.mjs','demo-restoration-observation.mjs','serve-production-preview.mjs']:
 s=s.replace("'./"+m+"'","'../scripts/"+m+"'")
s=s.replace("new URL('./demo-restoration-observation.mjs', import.meta.url)","new URL('../scripts/demo-restoration-observation.mjs', import.meta.url)")
s=s.replace("path: 'scripts/qualify-demo-restoration-browser.mjs'","path: '.cache/qualify-emitted-library-stage-observer.mjs'")
s=once(s,"import assert from 'node:assert/strict';","import assert from 'node:assert/strict';\nimport { fingerprintDemoSources } from '../scripts/demo-source-fingerprint.mjs';")
s=once(s,'const engine = args.browser;',"assert.equal(args.run, 'approved');\nassert.equal(args.browser, 'webkit');\nassert.equal(args.mode, 'solo');\nassert.ok(args['emitted-preview']);\nconst engine = args.browser;")
prep={'format':'EmittedLibraryStageObservationPreparationV1','head':'2b85914484ca3b49305d2a7e8c6451e52c73f339','capture':str(cap.relative_to(root)),'captureManifestSHA256':sha((cap/'manifest.json').read_bytes()),'durableHarness':{'path':source,'sha256':sha((root/source).read_bytes())},'projections':pins,'limits':['Diagnostic only; never replaces unchanged restoration qualification.','Only three declared JavaScript response bodies are instrumented. Original function arguments/results/throws retained; no yields, skipped work, error filters or gate/deadline changes.','All original control/watch/practice reload assertions and cleanup remain unchanged. Observations cannot prove unrelated CPU cost or eliminate timing perturbation.']}
(out/'preparation.json').write_text(json.dumps(prep,indent=2)+'\n')
addition='''const observerPreparation = JSON.parse(await readFile('.cache/emitted-library-stage-observer/preparation.json'));
const projections = new Map();
for (const pin of observerPreparation.projections) {
  const body = await readFile(pin.projection.path);
  assert.equal(sha(body), pin.projection.sha256);
  assert.equal(body.length, pin.projection.bytes);
  projections.set('/' + pin.path, { body, pin });
}
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), observerPreparation.head);
assert.equal(args['emitted-preview'], observerPreparation.capture, 'Use the explicitly projected capture.');
assert.equal(sha(await readFile(observerPreparation.capture + '/manifest.json')), observerPreparation.captureManifestSHA256);
assert.equal(sha(await readFile(observerPreparation.durableHarness.path)), observerPreparation.durableHarness.sha256);
const runtimeBefore = await fingerprintDemoSources(process.cwd());
assert.equal(runtimeBefore.sha256, manifest.sourceFingerprint);
assert.equal(runtimeBefore.files, manifest.files);
assert.equal(runtimeBefore.bytes, manifest.bytes);
const manifestBytesBefore = await readFile(manifestPath);
'''
s=once(s,'const report = {',addition+'const report = {\n  diagnosticOnly: true, observerPreparation, runtimeBefore, projectionResponses: [],')
s=once(s,"    if (request.url.startsWith('/demo-restoration-away')) {",'''    const projected = projections.get(request.url.split('?')[0]);
    if (projected && ['GET', 'HEAD'].includes(request.method)) {
      if (report.projectionResponses.length < 40)
        report.projectionResponses.push({ path: projected.pin.path, at: Date.now(), sha256: projected.pin.projection.sha256 });
      response.writeHead(200, { ...preview.headers, 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' });
      response.end(request.method === 'HEAD' ? undefined : projected.body);
    } else if (request.url.startsWith('/demo-restoration-away')) {''')
s=once(s,'      window.demoRestorationObservation = { id, lifecycle };','''      window.demoRestorationObservation = { id, lifecycle };
      const stageRows = [];
      window.demoLibraryStageRows = stageRows;
      window.__demoLibraryStage = (label, phase, detail = null) => {
        try {
          if (stageRows.length >= 160) return;
          const row = { label, phase, detail, monotonic: performance.now(), bootState: document.documentElement.dataset.bootState ?? null };
          stageRows.push(row);
          send({ kind: 'library-stage', ...row });
        } catch {}
      };
      window.__demoLibraryStageSync = (label, work) => {
        window.__demoLibraryStage(label, 'enter');
        let completed = false;
        try { const result = work(); completed = true; return result; }
        finally { window.__demoLibraryStage(label, completed ? 'settled' : 'threw'); }
      };''')
s=once(s,'      bodyState: document.body.dataset.flightState ?? null,','''      bodyState: document.body.dataset.flightState ?? null,
      bootState: document.documentElement.dataset.bootState ?? null,
      bootStatus: document.querySelector('#boot-status')?.textContent?.slice(0,1000) ?? null,
      activeElement: document.activeElement?.id ?? null,
      warning: document.querySelector('#warning')?.textContent?.slice(0,1000) ?? null,
      libraryStages: window.demoLibraryStageRows ?? [],
      menus: ['shell-menu','overlay-menu'].map(id => {
        const node = document.getElementById(id), rect = node?.getBoundingClientRect();
        return { id, rect: rect?.toJSON() ?? null, display: node ? getComputedStyle(node).display : null, visibility: node ? getComputedStyle(node).visibility : null, hit: rect ? document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.id ?? null : null };
      }),''')
s=once(s,'  clearTimeout(timer);','''  clearTimeout(timer);
  try {
    report.runtimeAfter = await fingerprintDemoSources(process.cwd());
    assert.deepEqual(report.runtimeAfter, runtimeBefore);
    assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), observerPreparation.head);
    assert.equal(sha(await readFile(manifestPath)), sha(manifestBytesBefore));
    assert.equal(sha(await readFile(observerPreparation.capture + '/manifest.json')), observerPreparation.captureManifestSHA256);
    assert.equal(sha(await readFile(observerPreparation.durableHarness.path)), observerPreparation.durableHarness.sha256);
    report.sourceUnchangedAtExit = true;
  } catch (error) { report.sourceUnchangedAtExit = false; report.complete = false; report.failure ??= browserErrorDescription(error); }
''')
s=once(s,'const entries = [',"report.instrumentation += ' Diagnostic-only exception: the three response bodies listed in observerPreparation are replaced by synchronous observation projections of their exact emitted originals. Native calls, results, thrown values and original readiness/test deadlines are unchanged. This is not an uninstrumented qualification pass.';\nreport.limitations.unshift(...observerPreparation.limits);\nconst entries = [")
s=once(s,'    report.failedState = await Promise.race([','''    report.failedScreenshot = args.report.replace(/\\.json$/, '-failed.png');
    try { await page.screenshot({ path: report.failedScreenshot, timeout: 1000 }); }
    catch (error) { report.failedScreenshotError = browserErrorDescription(error); }
    report.failedState = await Promise.race([''')
s=s.replace("'SharedDemoBrowserRestorationV2'","'SharedDemoEmittedLibraryStageDiagnosticV1'")
file=root/'.cache/qualify-emitted-library-stage-observer.mjs';file.write_text(s)
print(json.dumps({'probe':str(file.relative_to(root)),'sha256':sha(file.read_bytes()),'bytes':file.stat().st_size,'projectionPins':pins},indent=2))
