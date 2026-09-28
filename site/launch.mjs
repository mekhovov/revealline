// Classic script so a downloaded file can explain how to launch even when ES
// modules are blocked. Only the current origin's game is entered automatically.
(() => {
  const host = globalThis;
  const fallback = {"errors:thisIsADownloadedCopyChoosePlayOnlineOrStart": "This is a downloaded copy. Choose Play online, or start a local server to play this copy.", "errors:openYourArcade": "Open your arcade."};
  const t = (key) => host.RevealLineI18n?.t(key) || fallback[key];
  const doc = host.document;
  const scriptURL = doc.currentScript.src;
  const target = new URL('../game/', scriptURL);
  const current = new URL(host.location.href);
  const game = doc.getElementById('launch-game');
  target.search = current.search;
  target.hash = current.hash;
  game.href = target.href;
  if (current.protocol === 'file:') {
    game.hidden = true;
    doc.getElementById('boot-title').textContent = t("errors:openYourArcade");
    doc.getElementById('boot-status').textContent =
      t("errors:thisIsADownloadedCopyChoosePlayOnlineOrStart");
    doc.getElementById('boot-local').open = true;
    return;
  }
  if (['http:', 'https:'].includes(current.protocol) && target.origin === current.origin)
    host.location.replace(target.href);
})();
