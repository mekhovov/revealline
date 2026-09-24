const boundedReport = (value) => {
  const report = value && typeof value === 'object' ? value : { message: String(value ?? '') };
  if (Buffer.byteLength(JSON.stringify(report)) > 64 * 1024)
    throw new Error('Validation report exceeds 64 KiB.');
  return report;
};

export async function processNextValidationJob({
  repository,
  blobStore,
  validatePackage,
  workerId,
  clock = () => new Date(),
  retryDelayMs = 30_000,
}) {
  const claimed = await repository.claimValidationJob({ workerId });
  if (!claimed) return null;
  try {
    const blob = await blobStore.open(claimed.submission.blobKey);
    if (!blob || blob.size !== claimed.submission.actualSize)
      throw new Error('Staged package is missing or has a different size.');
    const outcome = await validatePackage({
      body: blob.body,
      submission: claimed.submission,
      validatorVersion: claimed.job.validatorVersion,
    });
    if (!outcome || typeof outcome.accepted !== 'boolean')
      throw new Error('Validator returned an invalid result.');
    const report = boundedReport(outcome.report ?? {});
    return repository.completeValidationJob({
      jobId: claimed.job.id,
      workerId,
      accepted: outcome.accepted,
      result: report,
      rejectionCode: outcome.rejectionCode,
    });
  } catch (error) {
    const retryAt = new Date(clock().getTime() + retryDelayMs).toISOString();
    await repository.releaseValidationJob({
      jobId: claimed.job.id,
      workerId,
      retryAt,
      result: { code: 'worker_error', message: String(error?.message ?? error).slice(0, 500) },
    });
    throw error;
  }
}
