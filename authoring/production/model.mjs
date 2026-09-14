/** Pure authoring data: never imports a runtime, reads files or grants media authority. */
export const FORMAT = 'revealline-production-register.v1';
export const THEMES = Object.freeze(['fpv', 'ukraine', 'retro', 'coupa']);
export const CLASSES = Object.freeze([
  'scout',
  'bomber',
  'carrier',
  'interceptor',
  'fiber',
  'impact',
  'trapper',
]);
export const TREATMENTS = Object.freeze(['compact', 'detailed']);
export const STAGES = Object.freeze([
  'planned',
  'produced',
  'inspected',
  'source-integrated',
  'browser-verified',
  'released',
]);
const ENEMIES = [
  'bouncer',
  'border-patrol',
  'contour-patrol',
  'claimed-rover',
  'eroder',
  'lane-boss',
  'relay-sentinel',
];
const ADAPTERS = [
  'pressure',
  'route',
  'world',
  'sentinel',
  'sentinel-world',
  'fracture',
  'fracture-world',
  'countercurrent',
  'body',
  'dawn',
  'synth',
  'authored',
];
const KINDS = ['picture', 'presentation', 'story', 'track'];
const CHECKS = Object.freeze({
  picture: {
    inspected: ['provenance', 'decode', 'framing', 'reveal-contrast', 'display-sizes'],
    'source-integrated': ['source-integration'],
    'browser-verified': ['full-reveal', 'collection'],
    released: ['release'],
  },
  presentation: {
    produced: ['production'],
    inspected: [
      'provenance',
      'idle',
      'movement',
      'ability-warning',
      'hit-recovery',
      'contact',
      'reduced-effects',
      'display-sizes',
    ],
    'source-integrated': ['source-integration'],
    'browser-verified': ['in-game'],
    released: ['release'],
  },
  story: {
    inspected: ['provenance', 'decode', 'poster-segment', 'audio-review'],
    'source-integrated': ['source-integration'],
    'browser-verified': ['play-pause-skip-end', 'first-earned', 'collection', 'recovery'],
    released: ['release'],
  },
  track: {
    produced: ['production'],
    inspected: ['provenance', 'full-listen', 'transitions', 'game-mix'],
    'source-integrated': ['source-integration'],
    'browser-verified': ['in-game'],
    released: ['release'],
  },
  reserve: { inspected: ['provenance', 'decode', 'visual-review', 'curation'] },
});
const fail = (at, message) => {
  throw new TypeError(`${at}: ${message}`);
};
const same = (a, b) => canonical(a) === canonical(b);
const key = (r) => `${r.id}@${r.revision}`;
const refKey = (r) => `${r.workId}@${r.workRevision}`;
const bindingKey = (r) => `${r.slotId}@${r.revision}`;
export function canonical(value) {
  let nodes = 0;
  const visit = (v, depth) => {
    if (++nodes > 60000 || depth > 20) fail('register', 'data exceeds bounds');
    if (v === null || typeof v === 'boolean') return v;
    if (typeof v === 'string') {
      if (v.length > 8192) fail('register', 'text too long');
      return v;
    }
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (Array.isArray(v)) return v.map((x) => visit(x, depth + 1));
    if (!v || Object.getPrototypeOf(v) !== Object.prototype)
      fail('register', 'plain JSON required');
    const out = Object.create(null);
    for (const k of Object.keys(v).sort()) {
      const d = Object.getOwnPropertyDescriptor(v, k);
      if (!d || !('value' in d)) fail('register', 'accessors are not JSON');
      out[k] = visit(d.value, depth + 1);
    }
    return out;
  };
  const text = JSON.stringify(visit(value, 0));
  if (new TextEncoder().encode(text).byteLength > 2 * 1024 * 1024)
    fail('register', 'metadata exceeds 2 MiB');
  return text;
}
function object(v, fields, at) {
  if (
    !v ||
    Array.isArray(v) ||
    typeof v !== 'object' ||
    !same(Object.keys(v).sort(), fields.split(' ').sort())
  )
    fail(at, `expected fields ${fields}`);
}
function text(v, at, max = 512) {
  if (typeof v !== 'string' || !v.trim() || v.length > max)
    fail(at, 'nonempty bounded text required');
}
function id(v, at) {
  if (typeof v !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,119}$/.test(v)) fail(at, 'invalid id');
}
function integer(v, at, max = 1000000) {
  if (!Number.isSafeInteger(v) || v < 1 || v > max) fail(at, 'positive bounded integer required');
}
function choice(v, allowed, at) {
  if (!allowed.includes(v)) fail(at, `expected ${allowed.join(', ')}`);
}
function list(v, at, max = 4096) {
  if (!Array.isArray(v) || v.length > max) fail(at, 'bounded array required');
}
export function validateSourcePath(v) {
  if (
    typeof v !== 'string' ||
    v.length > 240 ||
    !/^[a-zA-Z0-9._/-]+$/.test(v) ||
    v.split('/').some((s) => !s || s === '.' || s === '..' || s.startsWith('.')) ||
    !/^(authoring|game|docs|motion-lab)\//.test(v)
  )
    fail('path', 'ordinary repository source path required');
  return v;
}
function pin(v, at) {
  object(v, 'path bytes sha256', at);
  validateSourcePath(v.path);
  integer(v.bytes, `${at}.bytes`, 128 * 1024 * 1024);
  if (!/^[a-f0-9]{64}$/.test(v.sha256)) fail(at, 'invalid SHA-256');
}
function owner(v, at) {
  object(v, 'baseCampaignKey levelId levelRevision themeId', at);
  text(v.baseCampaignKey, at, 200);
  id(v.levelId, at);
  text(v.levelRevision, at, 32);
  choice(v.themeId, THEMES, at);
}
function unique(rows, getKey, at) {
  const m = new Map();
  for (const row of rows) {
    const k = getKey(row);
    if (m.has(k)) fail(at, `duplicate ${k}`);
    m.set(k, row);
  }
  return m;
}
function freeze(v) {
  if (v && typeof v === 'object') {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
}
function slotsFor(r) {
  const slots = r.maps.flatMap((m) =>
    THEMES.map((themeId) => ({
      id: `picture.${m.id}.${themeId}`,
      kind: 'picture',
      mapId: m.id,
      themeId,
      owners:
        r.layouts.find((l) => l.id === m.layoutId)?.owners.filter((o) => o.themeId === themeId) ??
        [],
    })),
  );
  for (const classId of CLASSES)
    for (const themeId of THEMES)
      for (const treatmentId of TREATMENTS)
        slots.push({
          id: `presentation.${classId}.${themeId}.${treatmentId}`,
          kind: 'presentation',
          classId,
          themeId,
          treatmentId,
        });
  for (const themeId of THEMES)
    for (let i = 1; i <= 3; i++)
      slots.push({ id: `story.${themeId}.${i}`, kind: 'story', themeId });
  for (const [kind, n] of [
    ['reserve', 40],
    ['track', 24],
  ])
    for (let i = 1; i <= n; i++) slots.push({ id: `${kind}.${i}`, kind });
  return slots;
}
function compatible(slot, work, handle) {
  const at = `${slot.id}.handle`;
  if (work.kind !== (slot.kind === 'reserve' ? 'picture' : slot.kind))
    fail(at, 'incompatible work kind');
  if (slot.themeId && work.themeId && slot.themeId !== work.themeId) fail(at, 'wrong work theme');
  choice(handle?.kind, [slot.kind], at);
  if (slot.kind === 'picture' || slot.kind === 'story') {
    object(handle, slot.kind === 'picture' ? 'kind owner' : 'kind owner storyId storyRevision', at);
    owner(handle.owner, at);
    if (handle.owner.themeId !== slot.themeId || !work.owners.some((o) => same(o, handle.owner)))
      fail(at, 'owner is not an exact declared work owner');
    if (slot.kind === 'picture' && !slot.owners.some((o) => same(o, handle.owner)))
      fail(at, 'owner belongs to another planned layout');
    if (slot.kind === 'story') {
      id(handle.storyId, at);
      integer(handle.storyRevision, at);
      if (handle.storyId !== work.sourceId || handle.storyRevision !== work.revision)
        fail(at, 'story revision mismatch');
    }
  } else if (slot.kind === 'presentation') {
    object(handle, 'kind classId themeId treatmentId bodyId style', at);
    for (const k of ['classId', 'themeId', 'treatmentId'])
      if (handle[k] !== slot[k]) fail(at, `wrong ${k}`);
    if (
      handle.bodyId !== work.sourceId ||
      handle.style !== (slot.treatmentId === 'compact' ? 'microtile' : 'hybrid')
    )
      fail(at, 'body/style differs from declared treatment');
  } else if (slot.kind === 'track') {
    object(handle, 'kind trackId', at);
    if (handle.trackId !== work.sourceId) fail(at, 'wrong track identity');
  } else object(handle, 'kind', at);
}
/** Validate metadata and append-only identity history; file verification is explicitly separate. */
export function validateProductionRegister(input, { previous = null } = {}) {
  const r = JSON.parse(canonical(input));
  object(
    r,
    'format revision basis context layouts maps works bindings assessments deliveries enemies authorities',
    'register',
  );
  if (r.format !== FORMAT) fail('format', 'unsupported register');
  integer(r.revision, 'revision');
  object(
    r.basis,
    'maps themes classes treatments presentationBasis storiesPerTheme reserves tracks',
    'basis',
  );
  if (
    !same(r.basis, {
      maps: 29,
      themes: THEMES,
      classes: CLASSES,
      treatments: TREATMENTS,
      presentationBasis: 'player-class',
      storiesPerTheme: 3,
      reserves: 40,
      tracks: 24,
    })
  )
    fail('basis', 'v1 target basis must remain explicit and unchanged');
  object(r.context, 'sourceCommit limitations', 'context');
  if (!/^[a-f0-9]{40}$/.test(r.context.sourceCommit))
    fail('context', 'exact source commit required');
  list(r.context.limitations, 'limitations', 40);
  r.context.limitations.forEach((s) => text(s, 'limitation', 2000));
  for (const name of [
    'layouts',
    'maps',
    'works',
    'bindings',
    'assessments',
    'deliveries',
    'enemies',
    'authorities',
  ])
    list(r[name], name);
  r.authorities.forEach((p) => pin(p, 'authority'));
  unique(r.authorities, (p) => p.path, 'authorities');
  const layouts = unique(r.layouts, (v) => v.id, 'layouts');
  for (const l of r.layouts) {
    object(l, 'id title source variantOf owners', 'layout');
    list(l.owners, 'layout.owners', 32);
    l.owners.forEach((o) => owner(o, 'layout.owner'));
    unique(l.owners, canonical, 'layout.owners');
    id(l.id, 'layout');
    text(l.title, 'layout');
    pin(l.source, 'layout.source');
    if (l.variantOf !== null && !layouts.has(l.variantOf)) fail('layout', 'unknown variant parent');
    let at = l;
    const seen = new Set();
    while (at) {
      if (seen.has(at.id)) fail('layout', 'variant cycle');
      seen.add(at.id);
      at = layouts.get(at.variantOf);
    }
  }
  const maps = unique(r.maps, (v) => v.id, 'maps');
  if (maps.size !== 29) fail('maps', 'exactly 29 planning slots required');
  const selected = new Set();
  for (const m of r.maps) {
    object(m, 'id selection layoutId', 'map');
    id(m.id, 'map');
    choice(m.selection, ['unassigned', 'proposed', 'approved'], 'map');
    if (m.selection === 'unassigned' ? m.layoutId !== null : !layouts.has(m.layoutId))
      fail('map', 'selection/layout mismatch');
    if (m.layoutId) {
      let l = layouts.get(m.layoutId);
      while (l.variantOf) l = layouts.get(l.variantOf);
      if (selected.has(l.id)) fail('map', 'a layout family cannot fill multiple planning slots');
      selected.add(l.id);
    }
  }
  const works = unique(r.works, key, 'works');
  for (const w of r.works) {
    object(
      w,
      'id revision kind title themeId source sourceId adapter files owners derivedFrom dependencies',
      'work',
    );
    id(w.id, 'work');
    integer(w.revision, 'work');
    choice(w.kind, KINDS, 'work');
    text(w.title, 'work');
    if (w.themeId !== null) choice(w.themeId, THEMES, 'work');
    pin(w.source, 'work.source');
    id(w.sourceId, 'work.sourceId');
    choice(w.adapter, ADAPTERS, 'work.adapter');
    const adapterKind = {
      pressure: 'picture',
      route: 'picture',
      world: 'picture',
      sentinel: 'picture',
      'sentinel-world': 'picture',
      fracture: 'picture',
      'fracture-world': 'picture',
      countercurrent: 'picture',
      body: 'presentation',
      dawn: 'story',
      synth: 'track',
      authored: 'picture',
    };
    if (adapterKind[w.adapter] !== w.kind) fail('work.adapter', 'incompatible adapter kind');
    list(w.dependencies, 'work.dependencies', 24);
    w.dependencies.forEach((p) => pin(p, 'dependency'));
    unique(w.dependencies, (p) => p.path, 'dependencies');
    list(w.files, 'work.files', 8);
    list(w.owners, 'work.owners', 32);
    w.owners.forEach((o) => owner(o, 'work.owner'));
    unique(w.owners, canonical, 'work.owners');
    for (const f of w.files) {
      object(f, 'role file width height durationSeconds', 'work.file');
      choice(f.role, ['original', 'movie', 'poster', 'audio', 'concept'], 'file.role');
      pin(f.file, 'file');
      for (const k of ['width', 'height']) if (f[k] !== null) integer(f[k], k, 16384);
      if (
        f.durationSeconds !== null &&
        (!Number.isFinite(f.durationSeconds) || f.durationSeconds <= 0 || f.durationSeconds > 7200)
      )
        fail('file.duration', 'invalid duration');
    }
    unique(w.files, (f) => f.role, 'work.files');
    if (w.kind === 'presentation' && (w.files.length !== 1 || w.files[0].role !== 'concept'))
      fail('presentation', 'one source concept reference required');
    if (w.kind === 'track' && w.files.length) fail('track', 'synth recipe has no recording');
    if (w.kind === 'picture' && (w.files.length !== 1 || w.files[0].role !== 'original'))
      fail('picture', 'one original required');
    if (
      w.kind === 'story' &&
      (w.files.length !== 2 ||
        !w.files.some((f) => f.role === 'movie') ||
        !w.files.some((f) => f.role === 'poster'))
    )
      fail('story', 'independent movie and poster required');
    if (w.derivedFrom !== null) {
      object(w.derivedFrom, 'workId workRevision', 'derivedFrom');
      if (!works.has(refKey(w.derivedFrom))) fail('derivedFrom', 'unknown work');
    }
    let at = w;
    const seen = new Set();
    while (at) {
      if (seen.has(key(at))) fail('work', 'derivation cycle');
      seen.add(key(at));
      at = at.derivedFrom ? works.get(refKey(at.derivedFrom)) : null;
    }
  }
  const slots = new Map(slotsFor(r).map((s) => [s.id, s]));
  const bindings = unique(r.bindings, bindingKey, 'bindings');
  const latest = new Map();
  for (const b of r.bindings) {
    object(b, 'slotId revision workId workRevision previous handle', 'binding');
    integer(b.revision, 'binding');
    id(b.workId, 'binding');
    integer(b.workRevision, 'binding');
    const slot = slots.get(b.slotId),
      work = works.get(refKey(b));
    if (!slot || !work) fail('binding', 'unknown slot/work');
    if (
      b.previous !== (b.revision === 1 ? null : b.revision - 1) ||
      (b.previous !== null && !bindings.has(`${b.slotId}@${b.previous}`))
    )
      fail('binding', 'broken previous history');
    compatible(slot, work, b.handle);
    if (!latest.has(b.slotId) || latest.get(b.slotId).revision < b.revision)
      latest.set(b.slotId, b);
  }
  const assessments = unique(r.assessments, (a) => a.id, 'assessments');
  for (const a of r.assessments) {
    object(
      a,
      'id slotId bindingRevision workId workRevision check outcome reviewer date evidence resolves',
      'assessment',
    );
    id(a.id, 'assessment');
    integer(a.bindingRevision, 'assessment');
    const b = bindings.get(`${a.slotId}@${a.bindingRevision}`),
      slot = slots.get(a.slotId);
    if (!b || b.workId !== a.workId || b.workRevision !== a.workRevision)
      fail('assessment', 'exact binding/work subject required');
    choice(a.check, Object.values(CHECKS[slot.kind]).flat(), 'assessment.check');
    choice(a.outcome, ['pass', 'fail'], 'assessment');
    text(a.reviewer, 'reviewer', 160);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(a.date) ||
      Number.isNaN(Date.parse(a.date)) ||
      new Date(a.date).toISOString().slice(0, 10) !== a.date
    )
      fail('assessment', 'invalid date');
    list(a.evidence, 'evidence', 16);
    if (!a.evidence.length) fail('assessment', 'evidence required');
    a.evidence.forEach((e) => pin(e, 'evidence'));
    if (a.resolves !== null) {
      const prev = assessments.get(a.resolves);
      if (
        !prev ||
        prev.id === a.id ||
        prev.date > a.date ||
        prev.slotId !== a.slotId ||
        prev.bindingRevision !== a.bindingRevision ||
        prev.check !== a.check
      )
        fail('assessment', 'invalid resolution subject/date');
      let at = prev;
      const seen = new Set([a.id]);
      while (at) {
        if (seen.has(at.id)) fail('assessment', 'resolution cycle');
        seen.add(at.id);
        at = assessments.get(at.resolves);
      }
    }
  }
  unique(r.deliveries, (d) => d.id, 'deliveries');
  for (const d of r.deliveries) {
    object(d, 'id title works evidence', 'delivery');
    id(d.id, 'delivery');
    text(d.title, 'delivery');
    list(d.works, 'delivery.works');
    unique(d.works, refKey, 'delivery.works');
    for (const w of d.works) {
      object(w, 'workId workRevision', 'delivery.work');
      if (!works.has(refKey(w))) fail('delivery', 'unknown work');
    }
    pin(d.evidence, 'delivery.evidence');
  }
  unique(r.enemies, (e) => `${e.typeId}.${e.themeId}`, 'enemies');
  for (const e of r.enemies) {
    object(e, 'typeId themeId skinId source', 'enemy');
    choice(e.typeId, ENEMIES, 'enemy');
    choice(e.themeId, THEMES, 'enemy');
    if (e.skinId !== `${e.typeId}.${e.themeId}.v1`) fail('enemy', 'semantic skin mismatch');
    pin(e.source, 'enemy.source');
  }
  if (previous) {
    const old = validateProductionRegister(previous);
    if (r.revision !== old.revision + 1) fail('revision', 'proposal must advance once');
    if (!same(old.basis, r.basis)) fail('basis', 'cannot change targets');
    for (const [name, getKey] of [
      ['works', key],
      ['bindings', bindingKey],
      ['assessments', (a) => a.id],
      ['deliveries', (d) => d.id],
      ['layouts', (l) => l.id],
    ]) {
      const now = new Map(r[name].map((v) => [getKey(v), v]));
      for (const v of old[name])
        if (!same(now.get(getKey(v)) ?? null, v))
          fail(name, 'immutable history changed or removed');
    }
    if (
      !same(
        old.maps.map((m) => m.id),
        r.maps.map((m) => m.id),
      )
    )
      fail('maps', 'planning slot identities changed');
  }
  return freeze(r);
}
function inspectValidated(r, slot) {
  const b =
    r.bindings.filter((x) => x.slotId === slot.id).sort((a, b) => b.revision - a.revision)[0] ??
    null;
  const work = b ? r.works.find((w) => key(w) === refKey(b)) : null;
  const reviews = b
    ? r.assessments.filter((a) => a.slotId === slot.id && a.bindingRevision === b.revision)
    : [];
  const resolved = new Set(reviews.map((a) => a.resolves).filter(Boolean));
  const active = reviews.filter((a) => !resolved.has(a.id));
  const passed = (check) =>
    active.some((a) => a.check === check && a.outcome === 'pass') &&
    !active.some((a) => a.check === check && a.outcome === 'fail');
  let stage = 'planned';
  const missing = [];
  let advance = !!work;
  for (const s of STAGES.slice(1)) {
    const required = CHECKS[slot.kind][s] ?? [];
    if (s === 'produced') {
      if (slot.kind === 'presentation' || slot.kind === 'track')
        advance = advance && passed('production');
      else advance = advance && !!work?.files.length;
    }
    if (
      slot.kind === 'reserve' &&
      ['source-integrated', 'browser-verified', 'released'].includes(s)
    )
      break;
    const absent = required.filter((c) => !passed(c));
    missing.push(...absent);
    advance = advance && !absent.length;
    if (advance) stage = s;
  }
  return {
    ...slot,
    binding: b,
    work,
    stage,
    missingChecks: [...new Set(missing)],
    failedChecks: active.filter((a) => a.outcome === 'fail').map((a) => a.check),
    history: r.bindings.filter((x) => x.slotId === slot.id),
  };
}
export function inspectProductionSlot(input, slotId) {
  const r = validateProductionRegister(input),
    slot = slotsFor(r).find((s) => s.id === slotId);
  if (!slot) fail('slot', 'unknown slot');
  return freeze(inspectValidated(r, slot));
}
/** A bounded frontend inventory; validate once rather than once per displayed slot. */
export function listProductionSlots(input) {
  const r = validateProductionRegister(input);
  return freeze(slotsFor(r).map((slot) => inspectValidated(r, slot)));
}
export function summarizeProduction(input) {
  const r = validateProductionRegister(input),
    rows = slotsFor(r).map((s) => inspectValidated(r, s));
  const domains = {};
  for (const kind of ['picture', 'presentation', 'story', 'reserve', 'track']) {
    const cohort = rows.filter((s) => s.kind === kind);
    domains[kind] = {
      target: cohort.length,
      bound: cohort.filter((s) => s.binding).length,
      missing: cohort.filter((s) => !s.binding).length,
      stages: Object.fromEntries(
        STAGES.map((stage) => [stage, cohort.filter((s) => s.stage === stage).length]),
      ),
    };
  }
  const workRoot = (w) => {
    while (w.derivedFrom) w = r.works.find((p) => key(p) === refKey(w.derivedFrom));
    return w;
  };
  // Both semantic derivation and exact bytes participate in dedupe. Connected components
  // prevent a renamed/recompressed derivative from becoming an additional reserve.
  const groups = new Map();
  const find = (id) => {
    if (!groups.has(id)) groups.set(id, id);
    if (groups.get(id) !== id) groups.set(id, find(groups.get(id)));
    return groups.get(id);
  };
  const join = (a, b) => groups.set(find(a), find(b));
  for (const w of r.works) {
    const family = `work:${workRoot(w).id}`;
    find(family);
    if (w.kind === 'presentation' || !w.files.length)
      join(family, `recipe:${w.adapter}:${w.source.path}:${w.sourceId}`);
    for (const f of w.files.filter((f) => ['original', 'movie', 'audio'].includes(f.role)))
      join(family, `bytes:${f.file.sha256}`);
  }
  const identities = (subset) =>
    new Set(subset.filter((s) => s.work).map((s) => find(`work:${workRoot(s.work).id}`)));
  const pictures = identities(rows.filter((s) => s.kind === 'picture')),
    reserves = identities(rows.filter((s) => s.kind === 'reserve'));
  const delivered = new Set(r.deliveries.flatMap((d) => d.works.map(refKey)));
  const deliveredKind = (kind) =>
    new Set(
      r.works
        .filter((w) => w.kind === kind && delivered.has(key(w)))
        .map((w) => find(`work:${workRoot(w).id}`)),
    ).size;
  return freeze({
    format: FORMAT,
    revision: r.revision,
    maps: {
      target: 29,
      proposed: r.maps.filter((m) => m.selection === 'proposed').length,
      approved: r.maps.filter((m) => m.selection === 'approved').length,
      unassigned: r.maps.filter((m) => m.selection === 'unassigned').length,
    },
    domains,
    uniquePictureWorks: pictures.size,
    uniqueReserveWorks: [...reserves].filter((k) => !pictures.has(k)).length,
    reserveOverlap: [...reserves].filter((k) => pictures.has(k)).length,
    sharedPresentationWorks: identities(rows.filter((s) => s.kind === 'presentation')).size,
    recipeTracks: new Set(
      r.works
        .filter((w) => w.kind === 'track' && !w.files.length)
        .map((w) => `${w.source.path}:${w.sourceId}`),
    ).size,
    uniqueStoryWorks: identities(rows.filter((s) => s.kind === 'story')).size,
    qualifiedStoryWorks: identities(
      rows.filter((s) => s.kind === 'story' && s.stage === 'released'),
    ).size,
    historicalDelivery: { pictures: deliveredKind('picture'), stories: deliveredKind('story') },
    enemyHandles: r.enemies.length,
    missingPictureSlots: rows.filter((s) => s.kind === 'picture' && !s.binding).map((s) => s.id),
    limitations: r.context.limitations,
  });
}
export function proposeProductionBinding(
  input,
  { slotId, workId, workRevision, expectedBinding, handle },
) {
  const old = validateProductionRegister(input);
  const current =
    old.bindings.filter((b) => b.slotId === slotId).sort((a, b) => b.revision - a.revision)[0] ??
    null;
  if ((current?.revision ?? null) !== expectedBinding)
    fail('expectedBinding', 'stale binding revision');
  const next = JSON.parse(JSON.stringify(old));
  next.revision++;
  next.bindings.push({
    slotId,
    revision: (current?.revision ?? 0) + 1,
    workId,
    workRevision,
    previous: current?.revision ?? null,
    handle,
  });
  return validateProductionRegister(next, { previous: old });
}
