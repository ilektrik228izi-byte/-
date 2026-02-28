const json = (payload, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...extraHeaders }
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // This repo contains a Node.js backend (`server.js`) that cannot run natively
    // as-is on Cloudflare Workers. We return an explicit response for API routes.
    if (url.pathname.startsWith('/api/')) {
      return json(
        {
          ok: false,
          error: 'API routes are not available in this Workers static deployment.',
          hint: 'Deploy server.js to a Node runtime (Docker/VM) and keep Workers for frontend/static hosting.'
        },
        501
      );
    }

    // Try static asset first.
    const response = await env.ASSETS.fetch(request);
    if (response.status !== 404) return response;

    // SPA fallback for client-side routes.
    return env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
  }
};
