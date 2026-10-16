import { freezeDesign } from '../content-design/catalogs.mjs';

/** Keep one immutable snapshot of the exact accepted draft, so selecting a
 * mission can reuse the compiler's owned-source cache. Revision labels alone
 * are insufficient: imported content can reuse them with different data. */
export function createStudioDraftSnapshot(getSession) {
  let owner, text, source;
  return () => {
    const current = getSession();
    const serialized = current.export();
    if (current !== owner || serialized !== text) {
      source = freezeDesign(JSON.parse(serialized));
      owner = current;
      text = serialized;
    }
    return source;
  };
}
