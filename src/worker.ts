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

    if (url.pathname.startsWith("/assets/")) {
      headers.set("Cache-Control", "public, max-age=31536000, immutable");
    }

    headers.set("Content-Type", "text/html; charset=utf-8");
    return new Response("<!DOCTYPE html><html><head><title>Not Found</title></head><body><h1>404 — Not Found</h1></body></html>", { status: 404, headers });
  },
} satisfies ExportedHandler;
