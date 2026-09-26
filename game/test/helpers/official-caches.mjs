export function memoryCaches() {
  const values = new Map();
  return {
    values,
    async keys() {
      return [...values.keys()];
    },
    async delete(name) {
      return values.delete(name);
    },
    async open(name) {
      if (!values.has(name)) values.set(name, new Map());
      const items = values.get(name),
        key = (request) => (typeof request === 'string' ? request : request.url);
      return {
        async match(request) {
          return items.get(key(request))?.clone();
        },
        async put(request, response) {
          items.set(key(request), response.clone());
        },
        async delete(request) {
          return items.delete(key(request));
        },
        async keys() {
          return [...items.keys()].map((url) => new Request(url));
        },
      };
    },
  };
}
