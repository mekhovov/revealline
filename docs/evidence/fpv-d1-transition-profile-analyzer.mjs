import fs from 'node:fs';
import crypto from 'node:crypto';

const [input, output = '/tmp/fpv-d1-transition-profile-analysis.json'] = process.argv.slice(2);
if (!input) throw Error('Usage: node /tmp/analyze-fpv-d1-transition-profile.mjs RECEIPT.json [ANALYSIS.json]');
const raw = fs.readFileSync(input), r = JSON.parse(raw);
if (r.format !== 'FPVD1BoundedTransitionProfile.v1') throw Error('Unexpected receipt format');
const complete = r.spans.filter(s => Number.isFinite(s.start) && Number.isFinite(s.end));
const overlap = (a,b) => Math.max(0, Math.min(a.end,b.end)-Math.max(a.start,b.start));
const union = intervals => {
  const rows=intervals.filter(([a,b])=>b>a).sort((a,b)=>a[0]-b[0]);
  let total=0, left=null, right=null;
  for (const [a,b] of rows) {
    if (left===null) { left=a; right=b; }
    else if (a<=right) right=Math.max(right,b);
    else { total+=right-left; left=a; right=b; }
  }
  return total+(left===null?0:right-left);
};
const taskRows = (span,type) => r.tasks.filter(t=>t.type===type && overlap(span,{start:t.start,end:t.start+t.duration}));
const clip = (span,interval) => [Math.max(span.start,interval.start), Math.min(span.end,interval.end)];
function scheduling(span) {
  const tasks=taskRows(span,'longtask'), loaf=taskRows(span,'long-animation-frame');
  const heartbeat = name => {
    const rows=r[name].filter(t=>overlap(span,{start:t.at-t.intervalMs,end:t.at}));
    return { callbacksEndingWithin: rows.filter(t=>t.at>=span.start&&t.at<=span.end).length,
      maxOverlappingIntervalMs: rows.length?Math.max(...rows.map(t=>t.intervalMs)):null,
      intervalsAbove1000Ms: rows.filter(t=>t.intervalMs>1000).map(t=>({at:t.at,intervalMs:t.intervalMs,overlapMs:overlap(span,{start:t.at-t.intervalMs,end:t.at})})) };
  };
  return { longTaskCount:tasks.length,
    longTaskCoveredMs:union(tasks.map(t=>clip(span,{start:t.start,end:t.start+t.duration}))),
    longTaskMaxMs:tasks.length?Math.max(...tasks.map(t=>t.duration)):null,
    longAnimationFrameCount:loaf.length,
    longAnimationFrameBlockingMs:loaf.map(t=>({start:t.start,duration:t.duration,blockingDuration:t.blockingDuration})),
    visibilityAtStart:r.visibility.filter(v=>v.at<=span.start).at(-1)??null,
    visibilityEvents:r.visibility.filter(v=>v.at>=span.start&&v.at<=span.end),
    raf:heartbeat('raf'), timer50ms:heartbeat('timers') };
}
const within = (span,kind) => complete.filter(s=>s.kind===kind&&s.start>=span.start&&s.end<=span.end);
const preparations=complete.filter(s=>s.kind==='runtime.prepare').map(span=>{
  const asyncRows=within(span,'three.compileAsync.total'), syncRows=within(span,'three.compile.sync');
  const asyncUnion=union(asyncRows.map(s=>[s.start,s.end]));
  return {context:span.context,start:span.start,wallMs:span.wallMs,
    instrumentationAvailable:span.rendererWrappersAvailable,
    compileAsync:asyncRows.map(s=>({wallMs:s.wallMs,dispatchMs:s.dispatchMs,postDispatchWaitMs:s.wallMs-s.dispatchMs})),
    synchronousCompile:syncRows.map(s=>({wallMs:s.wallMs,observerBeforeMs:s.observerBeforeMs,scope:s.scope,programsBefore:s.programsBefore.length,programsAfter:s.programsAfter.length,materialCountReturned:s.materialCountReturned})),
    prepareOutsideCompileAsyncMs:asyncRows.length?span.wallMs-asyncUnion:null,
    outsideCompileMeaning:'Includes production final LINK_STATUS checks, scheduling/microtask time, and harness overhead; not isolated GL time.',
    scheduling:scheduling(span)};
});
const loads=complete.filter(s=>s.kind==='runtime.loadScene').map(span=>{
  const parse=within(span,'gltf.parseAsync.total'), dispatch=within(span,'gltf.parse.dispatch'), images=within(span,'three.imageLoader.callback');
  return {context:span.context,start:span.start,wallMs:span.wallMs,blobBytes:span.blobBytes,
    beforeParseMs:parse.length?Math.min(...parse.map(s=>s.start))-span.start:null,
    parseAsync:parse.map(s=>({wallMs:s.wallMs,dispatchMs:s.dispatchMs})),
    parseDispatchMs:dispatch.map(s=>s.wallMs),
    afterParseMs:parse.length?span.end-Math.max(...parse.map(s=>s.end)):null,
    imageCallbacks:images.length,imageWaitUnionMs:union(images.map(s=>[s.start,s.end])),
    longestImages:images.toSorted((a,b)=>b.wallMs-a.wallMs).slice(0,4).map(s=>({wallMs:s.wallMs,dispatchMs:s.dispatchMs,urlKind:s.urlKind,image:s.image})),
    scheduling:scheduling(span)};
});
const stage = name=>complete.filter(s=>s.kind===name).map(s=>({context:s.context,start:s.start,wallMs:s.wallMs,scheduling:s.wallMs>1000?scheduling(s):undefined}));
const result={format:'FPVD1TransitionProfileAnalysis.v1',receipt:{path:input,bytes:raw.length,sha256:crypto.createHash('sha256').update(raw).digest('hex')},
  sourceHead:r.sourceHead,harnessSha256:r.harnessSha256,mode:r.mode,completed:r.completed,instrumentationComplete:r.instrumentationComplete,dropped:r.dropped,observerSupport:r.observerSupport,
  errors:r.errors,warnings:r.warnings,contextLosses:r.contextLosses,visibility:r.visibility,
  notes:['Intervals are wall clock, not GPU elapsed time or hardware FPS.','Async loading waits overlap; union and longest waits are reported, not summed.','Long-task overlap and callback gaps localize observation; they do not identify root cause by themselves.','Detailed instrumentation adds scope traversal and wrapper bookkeeping; outer-only mode can evaluate observer effects on the same bounded sequence.','The sequence preserves high-quality state into the next load, but omits other arenas, camera views, receipt serialization and most draws from the original qualification.','A missed stall in this smaller experiment does not falsify the original failure.'],
  preparations,loads,setCourse:stage('runtime.setCourse'),setQuality:stage('runtime.setQuality'),environmentProbe:stage('three.pmrem.fromScene'),disposedResources:r.disposedResources};
fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output,completed:r.completed,mode:r.mode,preparations:preparations.length,loads:loads.length,
  slowestPreparations:preparations.toSorted((a,b)=>b.wallMs-a.wallMs).slice(0,3),
  slowestLoads:loads.toSorted((a,b)=>b.wallMs-a.wallMs).slice(0,3)},null,2));
