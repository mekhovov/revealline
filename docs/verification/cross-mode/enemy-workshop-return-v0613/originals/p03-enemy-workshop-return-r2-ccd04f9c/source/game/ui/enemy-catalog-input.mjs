/** Parent authoring input owner. A focused child game must have sole controller ownership. */
export function createEnemyCatalogInput({ document: doc, frame, router, navigation, getScope }) {
  return {
    clear() {
      router.clear();
    },
    poll(timeMs) {
      if (doc.hidden || !doc.hasFocus() || doc.activeElement === frame) {
        router.clear();
        return false;
      }
      navigation.handle(router.sample({ scope: getScope(), timeMs }).ui);
      return true;
    },
  };
}
