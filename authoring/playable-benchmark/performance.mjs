const finiteDuration = (value) => Number.isFinite(value) && value >= 0;
const optionalDuration = (value) => value === null || finiteDuration(value);

function summarize(values) {
  const sorted = values.filter((value) => value !== null).sort((a, b) => a - b);
  const count = sorted.length;
  return {
    sampleCount: count,
    // Nearest-rank percentiles: retain measured outliers, without interpolation.
    p50Ms: count ? sorted[Math.ceil(count * 0.5) - 1] : null,
    p95Ms: count ? sorted[Math.ceil(count * 0.95) - 1] : null,
    worstMs: count ? sorted[count - 1] : null,
  };
}

/** Bounded, in-memory observations from the host's existing animation loop.
 * frameMs is a measured RAF interval for the whole two-view benchmark, never a
 * simulation step. referenceMs/comparisonMs time only their synchronous draw
 * calls; they do not measure GPU completion, presentation or end-to-end latency.
 *
 * The host records only uninterrupted, visible, ready, actively playing frames.
 * Reset between runs/appearances/modes. Rebase the host timestamp after any
 * pause/loading/ready/suspend; omit the first interval after rebasing. Call
 * excludeGap once for an excluded segment or long-frame pause, not per idle RAF.
 * This collector neither schedules frames nor clips slow valid observations.
 */
export function createBenchmarkPerformance({ capacity = 120 } = {}) {
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 600)
    throw new RangeError('Performance window must contain 1 to 600 frames.');
  const frames = [];
  let totalSamples = 0;
  let excludedGapCount = 0;
  let rejectedSampleCount = 0;
  return {
    record({ frameMs, referenceMs = null, comparisonMs = null } = {}) {
      if (
        !finiteDuration(frameMs) ||
        frameMs === 0 ||
        !optionalDuration(referenceMs) ||
        !optionalDuration(comparisonMs)
      ) {
        rejectedSampleCount++;
        return false;
      }
      frames.push({ frameMs, referenceMs, comparisonMs });
      if (frames.length > capacity) frames.shift();
      totalSamples++;
      return true;
    },
    excludeGap() {
      excludedGapCount++;
    },
    reset() {
      frames.length = 0;
      totalSamples = 0;
      excludedGapCount = 0;
      rejectedSampleCount = 0;
    },
    snapshot() {
      return {
        capacity,
        sampleCount: frames.length,
        totalSamples,
        excludedGapCount,
        rejectedSampleCount,
        frameInterval: summarize(frames.map((frame) => frame.frameMs)),
        referenceDrawCPU: summarize(frames.map((frame) => frame.referenceMs)),
        comparisonDrawCPU: summarize(frames.map((frame) => frame.comparisonMs)),
      };
    },
  };
}

/** Read only the active, successfully decoded comparison lease's provenance.
 * The loader validates these file dimensions/bytes against the PNG manifest and
 * actual decode, and owns every listed image even for a forced-size treatment.
 * 4*width*height is an RGBA payload estimate, not measured process/GPU memory.
 * Source bytes are separate compressed file sizes, not added to that estimate.
 * No estimate is made for approved/shared images, mission art, canvas backing
 * stores, GPU textures, decode caches, JavaScript heap or browser overhead.
 * Null provenance means the approved view owns no candidate override images;
 * malformed/absent resource knowledge is explicit, never an asserted zero total.
 */
export function candidateMemory(provenance = null) {
  const summary = {
    knownImageCount: 0,
    sourceBytes: 0,
    rgbaBytesLowerBound: 0,
    unknownCandidateImageCount: 0,
    approvedSharedImageCount: null,
    approvedSharedBytes: null,
  };
  if (provenance === null) return summary;
  if (provenance?.kind !== 'source-only-actor-comparison' || !Array.isArray(provenance.assets)) {
    summary.unknownCandidateImageCount = null;
    return summary;
  }
  const slots = new Set();
  for (const entry of provenance.assets) {
    const file = entry?.assetRevision?.file;
    const rgbaBytes = 4 * file?.width * file?.height;
    if (
      typeof entry?.slot !== 'string' ||
      !entry.slot ||
      slots.has(entry.slot) ||
      entry.assetRevision?.kind !== 'image' ||
      ![file?.width, file?.height, file?.bytes].every(
        (value) => Number.isSafeInteger(value) && value > 0,
      ) ||
      !Number.isSafeInteger(rgbaBytes) ||
      !Number.isSafeInteger(summary.rgbaBytesLowerBound + rgbaBytes) ||
      !Number.isSafeInteger(summary.sourceBytes + file.bytes)
    ) {
      summary.unknownCandidateImageCount++;
      continue;
    }
    slots.add(entry.slot);
    summary.knownImageCount++;
    summary.sourceBytes += file.bytes;
    summary.rgbaBytesLowerBound += rgbaBytes;
  }
  return summary;
}
