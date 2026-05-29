export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    const headers = new Headers({
      "X-Content-Type-Options": "nosniff",
      "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
      "Referrer-Policy": "strict-origin-when-cross-origin",
    });

    if (url.pathname.startsWith("/cities/")) {
      headers.set("Cache-Control", "public, max-age=86400, immutable");
    }

    return new Response("Not found", { status: 404, headers });
  },
} satisfies ExportedHandler;
