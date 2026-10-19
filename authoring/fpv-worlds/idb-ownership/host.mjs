import {
  createIDBOwnershipObserver,
  windowWithObservedIDB,
} from "./observe.mjs";
import { mountDiagnosticAccess } from "./access.mjs";

// Loaded ONLY by a separately generated authoring HTML, never by a player package.
const marker = document.querySelector(
  'meta[name="idb-diagnostic-player-module"]',
);
if (!marker) throw new Error("A generated IDB diagnostic host is required.");
const playerURL = new URL(marker.content, document.baseURI);
if (
  playerURL.origin !== location.origin ||
  playerURL.search ||
  playerURL.hash ||
  !playerURL.pathname.endsWith(
    "/optional-practice/civilian-fpv/world-app.mjs",
  ) ||
  new URL(".", location.href).pathname !==
    new URL(".", document.baseURI).pathname
)
  throw new Error(
    "The diagnostic host requires its same-origin frozen World player.",
  );
const observer = createIDBOwnershipObserver({
  indexedDB: window.indexedDB,
  captureExplicitClose:
    new URL(location.href).searchParams.get("idbCloseCalls") === "1",
  captureTransactions:
    new URL(location.href).searchParams.get("idbTransactions") === "1",
});
const originalEntry = document.documentElement.dataset.fpvWorlds;
// Suppress only the module's default auto-mount, then invoke the same exported host.
delete document.documentElement.dataset.fpvWorlds;
let app;
try {
  const { mountWorldApp } = await import(playerURL.href);
  if (originalEntry !== undefined)
    document.documentElement.dataset.fpvWorlds = originalEntry;
  app = mountWorldApp({
    document,
    window: windowWithObservedIDB(window, observer.indexedDB),
  });
  // Keep the ordinary host handle, while clearly marking this as diagnostic boot.
  globalThis.fpvWorldStudio = app;
} catch (error) {
  if (originalEntry !== undefined)
    document.documentElement.dataset.fpvWorlds = originalEntry;
  observer.stop();
  throw error;
}

const button = document.createElement("button"),
  dialog = document.createElement("dialog"),
  title = document.createElement("h2"),
  help = document.createElement("p"),
  read = document.createElement("button"),
  save = document.createElement("button"),
  stop = document.createElement("button"),
  back = document.createElement("button"),
  report = document.createElement("pre"),
  style = document.createElement("style");
button.textContent = "Connection diagnostic";
button.type = read.type = save.type = stop.type = back.type = "button";
button.id = "idb-diagnostic-open";
dialog.id = "idb-diagnostic-report";
title.id = "idb-diagnostic-title";
title.textContent = "Authoring connection observation";
dialog.setAttribute("aria-labelledby", title.id);
help.textContent =
  "Pause through the normal player before reading. This diagnostic boot uses a factory/window facade. Optional close and transaction interception change observed instances’ method identities. Transaction capture counts only known listing requests already issued by the player; no extra reads, contents, keys or liveness probe. Incomplete, failed and stopped capture cannot establish empty storage or explain the original public failures.";
read.textContent = "Read captured events";
save.textContent = "Export observation";
stop.textContent = "Stop observing";
back.textContent = "Back to player";
style.textContent = `
  #idb-diagnostic-open { position: fixed; left: 8px; bottom: 8px; z-index: 2147483000; padding: 10px; font: 14px system-ui; }
  #idb-diagnostic-report { max-width: 64rem; max-height: 85dvh; overflow: auto; }
  #idb-diagnostic-report pre { white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.4 monospace; }
  #idb-diagnostic-report button { margin: 4px; min-height: 44px; }
`;
dialog.append(title, help, read, save, stop, back, report);
document.head.append(style);
document.body.append(button, dialog);
const show = () => {
  report.textContent = JSON.stringify(observer.snapshot(), null, 2);
};
const access = mountDiagnosticAccess({
  document,
  button,
  dialog,
  onOpen() {
    show();
    dialog.showModal();
    back.focus();
  },
});
read.addEventListener("click", show);
back.addEventListener("click", () => {
  dialog.close();
  button.focus();
});
stop.addEventListener("click", () => {
  observer.stop();
  stop.disabled = true;
  show();
});
save.addEventListener("click", () => {
  const snapshot = observer.snapshot();
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `fpv-idb-ownership-${Date.now()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener(
  "pagehide",
  () => {
    access.destroy();
    observer.stop();
  },
  { once: true },
);
// No interval, renderer, refresh, reconnect or automatic report serialization.
void app.ready.catch(() => {}); // The normal host already reports its own readiness error.
