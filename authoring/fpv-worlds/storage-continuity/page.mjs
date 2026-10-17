import {
  observeStorageContinuity,
  validateContinuitySnapshot,
  compareContinuitySnapshots,
} from "./observe.mjs";
const capture = document.querySelector("#capture"),
  exportButton = document.querySelector("#export"),
  baselineFile = document.querySelector("#baseline"),
  status = document.querySelector("#status");
let snapshot = null,
  baseline = null;
async function show() {
  const comparison =
    snapshot && baseline
      ? await compareContinuitySnapshots(baseline, snapshot)
      : null;
  status.textContent = JSON.stringify({ comparison, snapshot }, null, 2);
}
capture.addEventListener("click", async () => {
  capture.disabled = true;
  exportButton.disabled = true;
  snapshot = null;
  status.textContent =
    "Reading existing databases and hashing actual stored bytes…";
  try {
    snapshot = await observeStorageContinuity();
    await show();
    exportButton.disabled = false;
  } catch (error) {
    status.textContent = `Observation failed: ${error.message}`;
  } finally {
    capture.disabled = false;
  }
});
baselineFile.addEventListener("change", async () => {
  baseline = null;
  try {
    const file = baselineFile.files[0];
    if (!file) return show();
    if (file.size > 32 * 1024 * 1024)
      throw new Error("Baseline exceeds the 32 MiB observation limit.");
    baseline = await validateContinuitySnapshot(JSON.parse(await file.text()));
    await show();
  } catch (error) {
    baseline = null;
    status.textContent = `Baseline refused: ${error.message}`;
  }
});
exportButton.addEventListener("click", () => {
  if (!snapshot) return;
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `fpv-storage-continuity-${snapshot.completedAt.replace(/[:.]/g, "-")}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
