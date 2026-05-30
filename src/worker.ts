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

    if (url.pathname === "/api/alerts") {
      const nwsUrl = new URL("https://api.weather.gov/alerts/active");
      nwsUrl.searchParams.set("status", "actual");
      nwsUrl.searchParams.set("message_type", "alert,update");
      const area = url.searchParams.get("area");
      if (area) nwsUrl.searchParams.set("area", area);

      const nwsRes = await fetch(nwsUrl.toString(), {
        headers: { "User-Agent": "(cold-locator, colder.itiszack.com)" }
      });
      return new Response(nwsRes.body, {
        headers: {
          "Content-Type": "application/geo+json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=300",
        }
      });
    }

    if (url.pathname === "/api/health") {
      const checks = {
        worker: "ok",
        nws: "unknown",
        openMeteo: "unknown",
        timestamp: Date.now()
      };

      const [nwsRes, omRes] = await Promise.allSettled([
        fetch("https://api.weather.gov/", {
          method: "GET",
          headers: { "User-Agent": "(cold-locator, colder.itiszack.com)" }
        }),
        fetch("https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m&forecast_days=1", {
          method: "HEAD"
        })
      ]);

      checks.nws = nwsRes.status === "fulfilled" && nwsRes.value.ok ? "ok" : "error";
      checks.openMeteo = omRes.status === "fulfilled" && omRes.value.ok ? "ok" : "error";

      return new Response(JSON.stringify(checks), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60",
        }
      });
    }

    headers.set("Content-Type", "text/html; charset=utf-8");
    return new Response("<!DOCTYPE html><html><head><title>Not Found</title></head><body><h1>404 — Not Found</h1></body></html>", { status: 404, headers });
  },
} satisfies ExportedHandler;
