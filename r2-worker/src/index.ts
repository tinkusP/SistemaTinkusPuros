const prefijo = "/objects/";

function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function claveDesdeUrl(url: URL): string | null {
  if (!url.pathname.startsWith(prefijo)) return null;
  const clave = decodeURIComponent(url.pathname.slice(prefijo.length));
  if (!clave || clave.startsWith("/") || clave.includes("..")) return null;
  return clave;
}

async function autorizado(request: Request, secreto: string): Promise<boolean> {
  const recibido = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(recibido)),
    crypto.subtle.digest("SHA-256", encoder.encode(secreto)),
  ]);
  return crypto.subtle.timingSafeEqual(a, b);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (!(await autorizado(request, env.STORAGE_TOKEN))) {
      return json({ error: "No autorizado" }, 401);
    }

    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, storage: "R2" });
    }

    const clave = claveDesdeUrl(url);
    if (!clave) return json({ error: "Ruta de objeto inválida" }, 400);

    try {
      if (request.method === "PUT") {
        await env.ARCHIVOS.put(clave, request.body, {
          httpMetadata: {
            contentType: request.headers.get("content-type") ?? "application/octet-stream",
            cacheControl: request.headers.get("x-cache-control") ?? "private, max-age=3600",
          },
          customMetadata: {
            uploadedAt: new Date().toISOString(),
          },
        });
        return json({ ok: true, key: clave }, 201);
      }

      if (request.method === "GET" || request.method === "HEAD") {
        const objeto = await env.ARCHIVOS.get(clave);
        if (!objeto) return json({ error: "Archivo no encontrado" }, 404);
        const headers = new Headers();
        objeto.writeHttpMetadata(headers);
        headers.set("etag", objeto.httpEtag);
        headers.set("content-length", String(objeto.size));
        headers.set("x-content-type-options", "nosniff");
        headers.set("content-security-policy", "default-src 'none'");
        return new Response(request.method === "HEAD" ? null : objeto.body, { headers });
      }

      if (request.method === "DELETE") {
        await env.ARCHIVOS.delete(clave);
        return json({ ok: true });
      }

      return json({ error: "Método no permitido" }, 405);
    } catch (error) {
      console.error(JSON.stringify({ event: "r2_request_failed", method: request.method, key: clave, error }));
      return json({ error: "No se pudo procesar el archivo" }, 500);
    }
  },
} satisfies ExportedHandler<Env>;
