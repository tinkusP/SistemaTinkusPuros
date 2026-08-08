import type { CorsOptions } from "cors";

const whitelist = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  process.env.FRONTEND_URL,
].map((url) => url?.trim()).filter((url): url is string => Boolean(url));

const esOrigenRedLocal = (origin: string) => {
  try {
    const url = new URL(origin);
    if (!["http:", "https:"].includes(url.protocol) || !["5173", "5174"].includes(url.port)) return false;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" ||
      /^10\.(?:\d{1,3}\.){2}\d{1,3}$/.test(url.hostname) ||
      /^192\.168\.(?:\d{1,3})\.(?:\d{1,3})$/.test(url.hostname) ||
      /^172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3})\.(?:\d{1,3})$/.test(url.hostname);
  } catch { return false; }
};

export const corsConfig: CorsOptions = {
  origin(origin, callback) {
    console.log("🟡 Origin recibido:", origin);

    // Permite solicitudes sin origin:
    // Postman, curl, Swagger o comunicación interna.
    if (!origin) {
      return callback(null, true);
    }

    const estaEnWhitelist = whitelist.includes(origin);

    // Permite URLs temporales generadas por Cloudflare Tunnel.
    // Solo se recomienda durante desarrollo.
    const esCloudflareTunnel =
      process.env.NODE_ENV !== "production" &&
      /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/i.test(origin);

    if (estaEnWhitelist || esOrigenRedLocal(origin) || esCloudflareTunnel) {
      console.log("✅ Origin permitido:", origin);
      return callback(null, true);
    }

    console.error("❌ Origin bloqueado:", origin);

    return callback(
      new Error(`Origen no permitido: ${origin}`),
    );
  },

  credentials: true,

  methods: [
    "GET",
    "POST",
    "PUT",
    "PATCH",
    "DELETE",
    "OPTIONS",
  ],

  allowedHeaders: [
    "Content-Type",
    "Authorization",
  ],
};
