// CacheStorage commits bytes; each read gets an independent response stream.
export function committedCaches() {
  const caches = new Map();
  return {
    async open(name) {
      if (!caches.has(name)) caches.set(name, new Map());
      const entries = caches.get(name),
        key = (request) => (typeof request === 'string' ? request : request.url);
      return {
        async put(request, response) {
          entries.set(key(request), {
            bytes: await response.arrayBuffer(),
            headers: [...response.headers],
          });
        },
        async match(request) {
          const hit = entries.get(key(request));
          return hit ? new Response(hit.bytes.slice(0), { headers: hit.headers }) : undefined;
        },
        async delete(request) {
          return entries.delete(key(request));
        },
        async keys() {
          return [...entries.keys()].map((url) => new Request(url));
        },
      };
    },
  };
}
