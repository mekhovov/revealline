/** Cosmetic transforms only. Motion never changes simulation or collision data. */
export function bodyMotionPose(
  body,
  { seconds = 0, heading = 0, bank = 0, speedRatio = 0, reduced = false } = {},
) {
  const motion = body?.bodyMotion;
  if (!motion) return { heading, bank: reduced ? 0 : bank };
  if (
    motion.kind !== 'rigid-spin' ||
    !Number.isFinite(motion.radiansPerSecond) ||
    Math.abs(motion.radiansPerSecond) > 2 ||
    !Number.isFinite(motion.travelGain) ||
    motion.travelGain < 0 ||
    motion.travelGain > 1
  )
    throw new TypeError('Invalid cosmetic body motion.');
  // A logo is rotated as one rigid image. No shear, scaling or petal deformation.
  return {
    heading: reduced
      ? 0
      : seconds * motion.radiansPerSecond +
        Math.sin(heading) * Math.min(1, speedRatio) * motion.travelGain,
    bank: 0,
  };
}
