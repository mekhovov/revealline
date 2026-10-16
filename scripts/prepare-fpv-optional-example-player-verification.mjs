#!/usr/bin/env node
/** Freeze an already-admitted player for manual optional-example host qualification. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => {
  throw Error(message);
};

function buildPlayer(html, sourceBase, frozenBase) {
  const setup = `
    const query=new URL(location.href).searchParams;
    window.fixtureLoadToken=query.get('token');window.fixtureErrors=[];
    const fixtureRecordError=message=>{fixtureErrors.push(String(message));parent.fixtureObserveError?.(String(message))};
    addEventListener('error',e=>fixtureRecordError(e.message));addEventListener('unhandledrejection',e=>fixtureRecordError(e.reason));
    Object.defineProperty(window,'localStorage',{value:parent.fixtureStorage});
    const nativeDB=window.indexedDB;
    const prefix=query.get('database');
    if(!prefix?.startsWith('fpv-optional-examples-'))throw Error('Isolated fixture database prefix required');
    Object.defineProperty(window,'indexedDB',{value:{
      open(name,version){const full=prefix+name;parent.fixtureRegisterDB(full);return version===undefined?nativeDB.open(full):nativeDB.open(full,version)},
      deleteDatabase:name=>nativeDB.deleteDatabase(prefix+name),cmp:nativeDB.cmp.bind(nativeDB)
    }});
    window.fixtureRecordWriteFault={after:null,count:0};
    const nativePut=IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put=function(...args){const fault=fixtureRecordWriteFault;if(this.name==='records'&&fault.after!==null&&fault.count++===fault.after){fault.after=null;const result=nativePut.apply(this,args);this.transaction.abort();return result}return nativePut.apply(this,args)};
    const nativeGet=IDBObjectStore.prototype.get;
    window.fixtureSessionReadFault={armed:false,count:0,restore(){this.armed=false;IDBObjectStore.prototype.get=nativeGet}};
    IDBObjectStore.prototype.get=function(...args){const request=nativeGet.apply(this,args),fault=fixtureSessionReadFault;if(fault.armed&&this.name==='session'&&this.transaction.mode==='readonly'&&this.transaction.db.name===prefix+'revealline.fpv.world-records.v1'&&args[0]==='active'){fault.count++;fault.restore();this.transaction.abort()}return request};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[]});
    window.fixtureYieldDelay=0;const nativeTimeout=window.setTimeout.bind(window);window.setTimeout=(callback,delay,...args)=>nativeTimeout(callback,delay===0&&fixtureYieldDelay?fixtureYieldDelay:delay,...args);
    if(query.get('clock')==='controlled'){
      let nextId=1;const callbacks=new Map();window.requestAnimationFrame=cb=>{const id=nextId++;callbacks.set(id,cb);return id};window.cancelAnimationFrame=id=>callbacks.delete(id);
      const owners=new WeakMap();let nextOwner=0;const trace={callbacks:0,owners:[],first:[],slow:[],last:[]};
      window.fixtureRAF={trace,stamp:performance.now(),deliver(delta=200){this.stamp+=delta;const pending=[...callbacks.entries()];callbacks.clear();for(const[,cb]of pending){if(!owners.has(cb)){owners.set(cb,nextOwner++);trace.owners.push({name:cb.name,calls:0,lastAt:null,maxGapMs:0})}const id=owners.get(cb),owner=trace.owners[id],at=performance.now(),gap=owner.lastAt===null?0:at-owner.lastAt;owner.lastAt=at;owner.calls++;owner.maxGapMs=Math.max(owner.maxGapMs,gap);const row={owner:id,name:cb.name,at,gapMs:gap,stamp:this.stamp,delta,status:document.getElementById('flight-status')?.textContent};trace.callbacks++;if(trace.first.length<16)trace.first.push(row);if(gap>250&&trace.slow.length<128)trace.slow.push(row);trace.last.push(row);if(trace.last.length>32)trace.last.shift();cb(this.stamp)}return pending.length}};
    }
  `;
  const boot = `
    import{mountWorldApp}from${JSON.stringify(`${frozenBase}/optional-practice/civilian-fpv/world-app.mjs`)};
    import{createFlightRenderer}from${JSON.stringify(`${frozenBase}/optional-practice/civilian-fpv/world-assets.mjs`)};
    import{worldStateIdentity}from${JSON.stringify(`${frozenBase}/optional-practice/civilian-fpv/world-model.mjs`)};
    window.fixtureWorldStateIdentity=worldStateIdentity;
    import{openWorldRecords}from${JSON.stringify(`${frozenBase}/optional-practice/civilian-fpv/world-records.mjs`)};
    window.fixtureRecords=await openWorldRecords(window.indexedDB);
    import{createFlightProfileStore,defaultRadioProfile,DEFAULT_RESPONSE}from${JSON.stringify(`${frozenBase}/optional-practice/civilian-fpv/radio-profile.mjs`)};
    createFlightProfileStore({storage:window.localStorage}).save({format:'FlightProfiles.v1',radio:defaultRadioProfile(),response:DEFAULT_RESPONSE});
    const rendererFactory=options=>{const renderer=createFlightRenderer(options);window.fixtureRenderer=renderer;const draw=renderer.draw,setCourse=renderer.setCourse;renderer.setCourse=function(course,...args){window.fixtureDrawState=null;window.fixtureRenderedCourse=course?.id;return Reflect.apply(setCourse,this,[course,...args])};renderer.draw=function(state,...args){const result=Reflect.apply(draw,this,[state,...args]);window.fixtureDrawState=state;return result};return renderer};
    window.fixtureApp=mountWorldApp({rendererFactory});
  `;
  if (!html.includes('data-fpv-worlds="true"') || !html.includes('</body>'))
    fail('Unsupported World HTML mount markers.');
  return html
    .replace('data-fpv-worlds="true"', 'data-fpv-worlds="fixture"')
    .replace(/<script\b[^>]*src="[^"]*world-app\.mjs"[^>]*><\/script>/, '')
    .replace(
      '<head>',
      `<head><base href="${sourceBase}/optional-practice/fpv-worlds/"><script>${setup}</script>`,
    )
    .replace('</body>', `<script type="module">${boot}</script></body>`);
}

async function main() {
  const args = process.argv.slice(2),
    options = {};
  for (let i = 0; i < args.length; i += 2) {
    assert(
      [
        '--player-root',
        '--player-receipt',
        '--harness',
        '--proof-file',
        '--out',
        '--source-revision',
      ].includes(args[i]) &&
        args[i + 1] &&
        !Object.hasOwn(options, args[i]),
    );
    options[args[i]] = args[i + 1];
  }
  assert(
    ['--player-root', '--player-receipt', '--harness', '--proof-file', '--out'].every(
      (key) => options[key],
    ),
    'Required: --player-root PATH --player-receipt JSON --harness docs/evidence/FILE.html --proof-file JSON --out dist/fpv-optional-example-player-NAME; optional --source-revision EXACT_SHA (default HEAD)',
  );
  const output = options['--out'];
  assert(/^dist\/fpv-optional-example-player-[a-z0-9-]{1,64}$/.test(output));
  assert(/^docs\/evidence\/[a-z0-9-]+\.html$/.test(options['--harness']));
  const playerRoot = await fs.realpath(options['--player-root']),
    receiptBytes = await fs.readFile(options['--player-receipt']),
    admitted = JSON.parse(receiptBytes);
  assert(
    /^[a-f0-9]{40}$/.test(admitted.sourceRevision) &&
      admitted.files.length === 102 &&
      admitted.checks.every((c) => c.passed),
    'Complete successful 102-file admitted player receipt required',
  );
  const workingHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT }).toString().trim();
  const candidate = options['--source-revision'] ?? workingHead;
  assert(/^[a-f0-9]{40}$/.test(candidate), 'Selected source must be an exact Git commit');
  const diff = execFileSync(
    'git',
    [
      'diff',
      '--name-only',
      admitted.sourceRevision,
      candidate,
      '--',
      'optional-practice',
      'game',
      'publishing',
    ],
    { cwd: ROOT },
  )
    .toString()
    .trim();
  assert(
    !diff,
    'The selected admitted player production inputs must equal the explicitly selected committed source: ' +
      diff,
  );
  assert(
    !execFileSync(
      'git',
      ['diff', 'HEAD', '--name-only', '--', 'optional-practice', 'game', 'publishing'],
      { cwd: ROOT },
    )
      .toString()
      .trim(),
    'Production working tree must equal commit',
  );
  const proofBytes = await fs.readFile(options['--proof-file']);
  assert(
    proofBytes.length > 0 && proofBytes.length <= 8 * 1024 * 1024,
    'Fixture archive limit 8 MiB (production limit unchanged)',
  );
  const proof = JSON.parse(proofBytes);
  assert(
    proof.format === 'FPVProofArchive.v2' &&
      Array.isArray(proof.records) &&
      proof.records.length > 0 &&
      proof.records.length <= 128,
  );
  const frozen = [],
    sourceFiles = {},
    candidateBase = '/' + output + '/candidate';
  let total = 0;
  for (const file of admitted.files) {
    const relative = file.path;
    assert(
      /^(?:(?:game|optional-practice|launcher)\/[a-zA-Z0-9_./-]+|optional-package\.json)$/.test(
        relative,
      ) && !relative.split('/').includes('..'),
    );
    const source = path.join(playerRoot, relative),
      stat = await fs.lstat(source);
    assert(stat.isFile() && !stat.isSymbolicLink());
    const bytes = await fs.readFile(source);
    assert(
      bytes.length === file.bytes && digest(bytes) === file.sha256,
      'Admitted member mismatch ' + relative,
    );
    total += bytes.length;
    assert(total <= 32 * 1024 * 1024);
    frozen.push({ relative, source, bytes });
    sourceFiles[relative] = digest(bytes);
  }
  assert(new Set(frozen.map((f) => f.relative)).size === 102);
  const html = frozen
    .find((f) => f.relative === 'optional-practice/fpv-worlds/index.html')
    .bytes.toString();
  const artifacts = new Map([
    ['index.html', await fs.readFile(path.join(ROOT, options['--harness']))],
    ['examples.json', proofBytes],
    ['player.html', Buffer.from(buildPlayer(html, candidateBase, candidateBase))],
  ]);
  const manifest = {
    format: 'FPVOptionalExampleAdmittedPlayerFixture.v1',
    candidate,
    workingHead,
    admittedSource: admitted.sourceRevision,
    admittedReceiptSha256: digest(receiptBytes),
    admittedZip: admitted.zip,
    candidateBase,
    sourceFiles,
    candidateHostSha256: sourceFiles['optional-practice/civilian-fpv/world-app.mjs'],
    proofArchive: {
      sha256: digest(proofBytes),
      bytes: proofBytes.length,
      records: proof.records.length,
    },
    fixtureFiles: Object.fromEntries([...artifacts].map(([name, bytes]) => [name, digest(bytes)])),
    currentSources: Object.fromEntries(
      Object.entries(sourceFiles).map(([name, sha]) => [candidateBase + '/' + name, sha]),
    ),
    scope:
      'Complete immutable admitted 102-file player; production inputs equal the explicitly selected committed source (default HEAD). Actual host and existing File/import/lookup UI; private IndexedDB prefix and controlled animation clock. No package rebuild, production changes, offline, device or FPS claim.',
  };
  const destination = path.join(ROOT, output);
  await fs.mkdir(destination);
  for (const { relative, source, bytes } of frozen) {
    const target = path.join(destination, 'candidate', relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.link(source, target);
    assert(digest(await fs.readFile(target)) === digest(bytes));
  }
  for (const [name, bytes] of artifacts)
    await fs.writeFile(path.join(destination, name), bytes, { flag: 'wx' });
  await fs.writeFile(
    path.join(destination, 'fixture-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    { flag: 'wx' },
  );
  console.log(
    JSON.stringify({
      prepared: true,
      candidate,
      admittedSource: admitted.sourceRevision,
      files: frozen.length,
      hardlinkedBytes: total,
      newBytes: [...artifacts.values()].reduce((n, b) => n + b.length, 0),
      output,
      manifestSha256: digest(JSON.stringify(manifest, null, 2) + '\n'),
    }),
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
