// Authoring control ownership only; no simulation or storage API is called here.
const knownDialogs = new Set([
  "flight-dialog",
  "sim-settings",
  "world-radio-dialog",
  "drone-hangar",
  ...[
    "home",
    "pause",
    "missions",
    "briefing",
    "settings",
    "expert",
    "help",
    "workshop",
    "results",
  ].map((name) => `worlds-shell-${name}-dialog`),
]);

/** A body sibling is inert behind showModal(). Keep access in its actual native owner. */
export function mountDiagnosticAccess({
  document: doc,
  button,
  dialog,
  onOpen,
  MutationObserver = doc.defaultView?.MutationObserver,
} = {}) {
  let destroyed = false;
  function reconcile() {
    if (destroyed) return;
    const modals = [...doc.querySelectorAll("dialog:modal")];
    const focused = doc.activeElement?.closest?.("dialog");
    // The report has its own Back control. Do not move its opener into itself.
    if (modals.includes(dialog)) {
      button.hidden = focused !== dialog;
      return;
    }
    const owner =
      modals.includes(focused) && knownDialogs.has(focused.id)
        ? focused
        : modals.length === 1 && knownDialogs.has(modals[0].id)
          ? modals[0]
          : null;
    // DOM order is not top-layer order. Decline ambiguous/unknown ownership.
    button.hidden = modals.length > 0 && !owner;
    if (button.hidden) return;
    const parent = owner ?? doc.body;
    if (button.parentNode !== parent) parent.append(button);
    // Reparenting must not take focus from the normal player control.
  }
  const watcher =
    typeof MutationObserver === "function"
      ? new MutationObserver(reconcile)
      : null;
  for (const node of [...knownDialogs]
    .map((id) => doc.getElementById(id))
    .filter(Boolean)
    .concat(dialog))
    watcher?.observe(node, { attributes: true, attributeFilter: ["open"] });
  const request = () => {
    reconcile();
    if (destroyed || button.hidden || dialog.open) return;
    if (doc.getElementById("flight-dialog")?.dataset.flightState === "active") {
      button.title =
        "Pause through the normal player before reading connection events.";
      return;
    }
    button.title = "";
    onOpen();
  };
  doc.addEventListener("focusin", reconcile, true);
  doc.addEventListener("close", reconcile, true);
  button.addEventListener("click", request);
  reconcile();
  return Object.freeze({
    destroy() {
      if (destroyed) return;
      destroyed = true;
      watcher?.disconnect();
      doc.removeEventListener("focusin", reconcile, true);
      doc.removeEventListener("close", reconcile, true);
      button.removeEventListener("click", request);
    },
  });
}
