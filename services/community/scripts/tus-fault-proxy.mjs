import { createServer } from 'node:http';

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

const required = (condition, message) => {
  if (!condition) throw new Error(message);
};

const boundedBody = async (request, maximumBytes) => {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    required(size <= maximumBytes, `Proxy request exceeded ${maximumBytes} bytes.`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, size);
};

const requestHeaders = (headers) => {
  const result = new Headers();
  for (const [name, value] of Object.entries(headers)) {
    if (value !== undefined && !HOP_BY_HOP_HEADERS.has(name.toLowerCase()))
      result.set(name, Array.isArray(value) ? value.join(', ') : value);
  }
  return result;
};

const responseHeaders = (headers, { upstream, proxyOrigin }) => {
  const result = {};
  for (const [name, value] of headers) {
    if (HOP_BY_HOP_HEADERS.has(name.toLowerCase())) continue;
    if (name.toLowerCase() === 'location') {
      const location = new URL(value, upstream);
      if (location.origin === upstream.origin) {
        const prefix = upstream.pathname.endsWith('/')
          ? upstream.pathname
          : `${upstream.pathname}/`;
        const relativePath = location.pathname.startsWith(prefix)
          ? location.pathname.slice(prefix.length)
          : location.pathname.replace(/^\//u, '');
        result[name] = new URL(`${relativePath}${location.search}`, proxyOrigin).href;
        continue;
      }
    }
    result[name] = value;
  }
  return result;
};

const finishResponse = async (response, upstreamResponse, context) => {
  const body = Buffer.from(await upstreamResponse.arrayBuffer());
  response.writeHead(upstreamResponse.status, responseHeaders(upstreamResponse.headers, context));
  response.end(body);
};

/**
 * Local HTTP boundary for proving tus recovery against a real network failure.
 *
 * The first PATCH is accepted from the client, but only the configured prefix
 * is committed to the upstream tus resource. Once the upstream answers, this
 * proxy destroys the browser-facing socket before returning any response. A
 * later client invocation must recover the authoritative offset with HEAD.
 */
export async function startTusFaultProxy({
  upstreamURL,
  allowRemoteUpstream = false,
  dropAfterBytes = 17,
  maximumRequestBytes = 1024 * 1024,
  requestTimeoutMs = 5_000,
} = {}) {
  const upstream = new URL(upstreamURL);
  required(['http:', 'https:'].includes(upstream.protocol), 'Proxy upstream URL is invalid.');
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(upstream.hostname);
  required(loopback || allowRemoteUpstream, 'Fault proxy upstream must be loopback-only.');
  required(
    loopback || upstream.protocol === 'https:',
    'Remote fault proxy upstream must use HTTPS.',
  );
  required(
    !upstream.username && !upstream.password && !upstream.search && !upstream.hash,
    'Fault proxy upstream URL must not contain credentials, a query, or a fragment.',
  );
  upstream.pathname = upstream.pathname.endsWith('/') ? upstream.pathname : `${upstream.pathname}/`;
  required(
    Number.isSafeInteger(dropAfterBytes) && dropAfterBytes > 0,
    'Dropped PATCH byte count is invalid.',
  );
  required(
    Number.isSafeInteger(maximumRequestBytes) && maximumRequestBytes >= dropAfterBytes,
    'Proxy request byte limit is invalid.',
  );
  required(
    Number.isSafeInteger(requestTimeoutMs) && requestTimeoutMs > 0,
    'Proxy request timeout is invalid.',
  );

  const audit = {
    requests: 0,
    submissionCreates: 0,
    uploadCreates: 0,
    patchOffsets: [],
    patchBytes: [],
    headOffsets: [],
    faultInjected: false,
    committedBeforeDrop: null,
  };
  let proxyOrigin;

  const server = createServer(async (request, response) => {
    try {
      audit.requests += 1;
      const method = request.method ?? 'GET';
      const requestURL = new URL(request.url ?? '/', upstream);
      const target = new URL(requestURL.pathname.replace(/^\//u, ''), upstream);
      target.search = requestURL.search;
      const body = ['GET', 'HEAD'].includes(method)
        ? null
        : await boundedBody(request, maximumRequestBytes);
      const isUploadsEndpoint = requestURL.pathname === '/v1/uploads';
      const isUploadResource = requestURL.pathname.startsWith('/v1/uploads/');

      if (method === 'POST' && requestURL.pathname === '/v1/submissions')
        audit.submissionCreates += 1;
      if (method === 'POST' && isUploadsEndpoint) audit.uploadCreates += 1;

      const headers = requestHeaders(request.headers);
      if (body) headers.set('content-length', String(body.length));

      if (method === 'PATCH' && isUploadResource) {
        const offset = Number(request.headers['upload-offset']);
        required(Number.isSafeInteger(offset) && offset >= 0, 'PATCH offset is invalid.');
        audit.patchOffsets.push(offset);
        audit.patchBytes.push(body.length);
        if (!audit.faultInjected) {
          required(
            body.length > dropAfterBytes,
            'The first PATCH must exceed the configured dropped byte count.',
          );
          const prefix = body.subarray(0, dropAfterBytes);
          headers.set('content-length', String(prefix.length));
          const committed = await fetch(target, {
            method,
            headers,
            body: prefix,
            redirect: 'error',
            signal: AbortSignal.timeout(requestTimeoutMs),
          });
          const committedBody = await committed.text();
          required(
            committed.status === 204,
            `Upstream rejected the fault prefix (${committed.status}): ${committedBody}`,
          );
          const committedOffset = Number(committed.headers.get('upload-offset'));
          required(
            committedOffset === offset + prefix.length,
            'Upstream committed an unexpected offset before the fault.',
          );
          audit.faultInjected = true;
          audit.committedBeforeDrop = committedOffset;
          request.socket.destroy();
          return;
        }
      }

      const forwarded = await fetch(target, {
        method,
        headers,
        ...(body ? { body } : {}),
        redirect: 'error',
        signal: AbortSignal.timeout(requestTimeoutMs),
      });
      if (method === 'HEAD' && isUploadResource) {
        const offset = Number(forwarded.headers.get('upload-offset'));
        audit.headOffsets.push(Number.isSafeInteger(offset) ? offset : null);
      }
      await finishResponse(response, forwarded, { upstream, proxyOrigin });
    } catch (error) {
      if (response.destroyed || request.socket.destroyed) return;
      response.writeHead(502, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(`Fault proxy failed: ${error.message}`);
    }
  });
  server.requestTimeout = requestTimeoutMs;
  server.headersTimeout = requestTimeoutMs;
  server.keepAliveTimeout = Math.min(requestTimeoutMs, 1_000);
  server.on('clientError', (_error, socket) => socket.destroy());

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen({ host: '127.0.0.1', port: 0 }, resolve);
  });
  const address = server.address();
  required(address && typeof address === 'object', 'Fault proxy did not bind a TCP address.');
  proxyOrigin = `http://127.0.0.1:${address.port}/`;

  return Object.freeze({
    origin: proxyOrigin,
    snapshot: () =>
      Object.freeze({
        ...audit,
        patchOffsets: Object.freeze([...audit.patchOffsets]),
        patchBytes: Object.freeze([...audit.patchBytes]),
        headOffsets: Object.freeze([...audit.headOffsets]),
      }),
    async close() {
      server.closeAllConnections();
      await new Promise((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  });
}
