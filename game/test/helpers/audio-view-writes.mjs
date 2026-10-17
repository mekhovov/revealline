// Count writes at the modeled DOM boundary without changing their effects.
export function observeAudioViewWrites(root) {
  let writes = 0;
  const undo = [];
  const visit = (element) => {
    for (const key of ['textContent', 'value', 'disabled', 'hidden']) {
      const own = Object.getOwnPropertyDescriptor(element, key);
      let owner = element,
        descriptor;
      while (owner && !(descriptor = Object.getOwnPropertyDescriptor(owner, key)))
        owner = Object.getPrototypeOf(owner);
      if (!descriptor || (!descriptor.set && !('value' in descriptor))) continue;
      let value = element[key];
      Object.defineProperty(element, key, {
        configurable: true,
        get: () => (descriptor.get ? descriptor.get.call(element) : value),
        set: (next) => {
          writes++;
          if (descriptor.set) descriptor.set.call(element, next);
          else value = next;
        },
      });
      undo.push(() => {
        if (own) Object.defineProperty(element, key, 'value' in own ? { ...own, value } : own);
        else delete element[key];
      });
    }
    const own = Object.getOwnPropertyDescriptor(element, 'setAttribute');
    const original = element.setAttribute;
    if (typeof original === 'function') {
      element.setAttribute = function (...args) {
        writes++;
        return original.apply(this, args);
      };
      undo.push(() =>
        own ? Object.defineProperty(element, 'setAttribute', own) : delete element.setAttribute,
      );
    }
    for (const child of element.children ?? []) visit(child);
  };
  visit(root);
  return {
    count: () => writes,
    reset: () => {
      writes = 0;
    },
    stop: () => {
      for (const f of undo.reverse()) f();
    },
  };
}
