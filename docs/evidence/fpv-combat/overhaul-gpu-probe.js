// Qualification-only asynchronous GPU timer. No gameplay or renderer-source changes.
// https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/
(() => {
  globalThis.createFpvGpuProbe = (gl, { sampleEvery = 15, maxPending = 8 } = {}) => {
    const extension = gl.getExtension('EXT_disjoint_timer_query_webgl2');
    const values = [], pending = [], errors = [], counts = new Map();
    const counter = tag => { if (!counts.has(tag)) counts.set(tag, { issued: 0, discarded: 0, skipped: 0 }); return counts.get(tag); };
    let frame = 0, discarded = 0, skipped = 0, disjointEvents = 0, contextLosses = 0, issued = 0;
    let wasDisjoint = false, wasLost = false;
    const drop = (item) => { try { gl.deleteQuery(item.query); } catch {} discarded++; counter(item.tag).discarded++; };
    const poll = () => {
      const lost = gl.isContextLost();
      if (lost) {
        if (!wasLost) contextLosses++;
        wasLost = true;
        while (pending.length) drop(pending.pop());
        return false;
      }
      wasLost = false;
      if (!extension) return false;
      const disjoint = Boolean(gl.getParameter(extension.GPU_DISJOINT_EXT));
      if (disjoint) {
        if (!wasDisjoint) disjointEvents++;
        wasDisjoint = true;
        while (pending.length) drop(pending.pop());
        return false;
      }
      wasDisjoint = false;
      for (let i = pending.length - 1; i >= 0; i--) {
        const item = pending[i];
        if (gl.getQueryParameter(item.query, gl.QUERY_RESULT_AVAILABLE)) {
          const ns = gl.getQueryParameter(item.query, gl.QUERY_RESULT);
          if (Number.isFinite(ns) && ns >= 0) values.push({ ms: ns / 1e6, tag: item.tag });
          else { discarded++; counter(item.tag).discarded++; }
          gl.deleteQuery(item.query); pending.splice(i, 1);
        } else if (frame - item.frame > 600) {
          drop(item); pending.splice(i, 1);
        }
      }
      return true;
    };
    const percentile = (list, p) => {
      if (!list.length) return null;
      const sorted = [...list].sort((a, b) => a - b);
      return Math.round(sorted[Math.floor((sorted.length - 1) * p)] * 1000) / 1000;
    };
    return {
      around(render, { active = true, tag = null } = {}) {
        frame++;
        let query = null;
        try {
          const ready = poll();
          if (active && ready && frame % sampleEvery === 0) {
            if (pending.length < maxPending && !gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) {
              query = gl.createQuery();
              if (query) { gl.beginQuery(extension.TIME_ELAPSED_EXT, query); issued++; counter(tag).issued++; }
            } else { skipped++; counter(tag).skipped++; }
          }
        } catch (error) { if (errors.length < 8) errors.push(error.message); }
        try { return render(); }
        finally {
          if (query) {
            try { gl.endQuery(extension.TIME_ELAPSED_EXT); pending.push({ query, tag, frame }); }
            catch (error) { drop({ query, tag }); if (errors.length < 8) errors.push(error.message); }
          }
        }
      },
      poll,
      summary(tag = undefined) {
        poll();
        const samples = values.filter(value => tag === undefined || value.tag === tag).map(value => value.ms);
        return { available: Boolean(extension), measured: samples.length > 0, samples: samples.length,
          gpuP50: percentile(samples, .5), gpuP95: percentile(samples, .95), gpuP99: percentile(samples, .99),
          gpuMax: samples.length ? Math.max(...samples) : null,
          issued: tag === undefined ? issued : counter(tag).issued,
          pending: pending.filter(item => tag === undefined || item.tag === tag).length,
          discarded: tag === undefined ? discarded : counter(tag).discarded,
          skipped: tag === undefined ? skipped : counter(tag).skipped,
          globalDisjointEvents: disjointEvents, globalContextLosses: contextLosses, errors: [...errors], sampleEvery, maxPending,
          method: 'https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/',
          scope: 'Sampled flight-view render GPU work: elapsed time around the actual flight renderer render call, including its shadow and other internal passes. Excludes browser compositor, worker CPU and other contexts. Availability polling only; no finish, flush or synchronous result readback before availability.' };
      },
      dispose() { while (pending.length) drop(pending.pop()); },
    };
  };
})();
