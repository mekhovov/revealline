export async function captureBeforeValidation(capture, validate) {
  let value, captureError, validationError;
  let captureFailed = false,
    validationFailed = false;
  try {
    value = await capture();
  } catch (error) {
    captureFailed = true;
    captureError = error;
  }
  try {
    validate();
  } catch (error) {
    validationFailed = true;
    validationError = error;
  }
  return { value, captureFailed, captureError, validationFailed, validationError };
}

export async function settlePostflightChecks(checks, admit = () => {}) {
  const results = [];
  for (const { label, check } of checks) {
    try {
      await admit(label);
    } catch (error) {
      results.push({ label, status: 'unavailable', error });
      continue;
    }
    try {
      await check();
      results.push({ label, status: 'passed' });
    } catch (error) {
      results.push({ label, status: 'failed', error });
    }
  }
  return results;
}
