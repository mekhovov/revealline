# Locked entry: language and keyboard input

Source: `d19382e03b`, based on main `fab00f38a0aa72f6afb5e1b7a4283799c842538f`.
This is a bounded continuation of the native-menu plan, not completion of
controller-only entry or whole-game acceptance.

## Player behavior

The password screen follows the existing English/Ukrainian preference, then the
browser's supported languages, with English fallback. An explicitly labeled
language selector can change the entry screen without clearing the password or
an existing error. Only that explicit choice writes the ordinary locale key.
Denied storage still permits a language change for this entry screen; it does not
establish preference persistence into a later application session.

Tab and Shift-Tab cycle through language, password and Unlock within the locked
dialog. During verification the password is read-only and Unlock stays focusable
with `aria-disabled`; a submission guard prevents repeated checks. A late failure
does not steal focus from a newer language choice. Successful verification starts
the protected scripts once and clears the password field. Verification and page
loading errors have English/Ukrainian explanations.

The gate remains self-contained because ordinary application/localization scripts
are deliberately inert before unlock. No controller/gameplay modules, external
resources or new package dependencies are loaded before authorization. Existing
password metadata, derivation, remembered-access keys, script order and locked-page
rules remain unchanged. The tests use a separate synthetic credential.

## Verification

- **11/11 runtime cases pass** in `game/test/access-gate-runtime.test.mjs` on
  Node 20.19.5. Coverage includes remembered/wrong/correct credentials, blocked
  storage, missing crypto/config, locale fallback and changes, keyboard traversal,
  pending and post-unlock duplicate submission, late focus ownership, rejected
  crypto and post-unlock script-loading errors.
- **Three selected page/packaging cases pass** in `game/test/access-gate.test.mjs`:
  game/launch configuration, idempotent generated-page protection, and offline
  launcher/update descriptors carrying the protected bytes. The source-page
  inventory case was excluded from this selected rerun and is **not a pass**.
- The initial broader run had **12 passes and two environmental failures**:
  the sparse checkout lacked an original-art directory and the launcher icon.
  Restoring the exact tracked launcher icon allowed its unchanged packaging case
  to pass. The full source-page collector still needs a complete checkout; its
  guard and expectations were not modified. Do not add overlapping run counts.
- Scoped ESLint, formatting and `git diff --check` pass.
- Repository localization validation passes for English/Ukrainian: 13,651 messages
  and 9,049 references. The small pre-unlock vocabulary is deliberately local to
  the gate and is covered by the runtime tests rather than loaded catalogs.
- **No browser or physical-device acceptance:** the computer-use provider returned
  “Browser is not available: iab” and an empty supported-browser list. No browser
  permission, access protection, saved game, cache or worker was bypassed/cleared.
  The focus and language claims above have modeled runtime evidence only.
- No materialized distribution build, installed-app upgrade, public-route check
  or release acceptance is claimed by this batch. Required full-checkout CI remains
  separate from these local checks.

## Checkout recovery

The previously clean October 1 branch was already contained in main. The first
rebase failed with ENOSPC while materializing regional terrain assets. It was
aborted, preserving the original branch. All 10,162 new partial-checkout files
were individually verified against fetched Git blobs before their redundant
copies were removed; no unmatched file was found. Other owners' work/evidence was
left alone. A worktree-local sparse checkout now omits large media, not source
from Git or release inventories. The second rebase completed without conflicts at
`fab00f38a0`; the runtime work is on `codex/access-entry-ux-20261015`.

## Next acceptance and implementation

1. On a supported browser, check narrow English/Ukrainian layouts, native Tab /
   Shift-Tab, incorrect-password retry and the real post-unlock handoff. Use an
   authorized credential; do not bypass the gate to manufacture acceptance.
2. Complete the full page-inventory check in a complete checkout and the required
   exact-head CI checks. Package and publication ownership remains with Releases.
3. Add controller-only pre-unlock text entry within the same protected startup
   boundary, then qualify it with a real controller. This batch deliberately does
   not load the ordinary game/controller owner before authorization.
4. Continue the player-focused order: current public landing, progress recovery,
   installed-phone update, and a visible living-background showcase. Existing
   Demo and creator-owner work should be reused, not duplicated.
