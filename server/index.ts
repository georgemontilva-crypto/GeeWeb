import fs from "node:fs";
import path from "node:path";
import express, { type NextFunction, type Request, type Response } from "express";
import cookieParser from "cookie-parser";
import multer from "multer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { eq } from "drizzle-orm";
import { assertEnv, env, r2Enabled } from "./env";
import { db, runMigrations, schema } from "./db";
import { createContext, router } from "./trpc";
import { readSession, rateLimit } from "./auth";
import { saveImage } from "./storage";
import { seed } from "./seed";
import { getSettings } from "./settings";
import { storeRouter } from "./routers/store";
import { authRouter } from "./routers/auth";
import { adminRouter } from "./routers/admin";
import { sendProofReceived } from "./email";

export const appRouter = router({ store: storeRouter, auth: authRouter, admin: adminRouter });
export type AppRouter = typeof appRouter;

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/gif", "image/svg+xml"];
const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 12 * 1024 * 1024, files: 1 } });

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Título y metadatos por página, para buscadores y para compartir enlaces. */
async function headFor(url: string) {
  const s = await getSettings();
  let title = `${s.storeName} | ${s.tagline}`;
  let description = s.tagline;
  let image = s.logoUrl;
  const pathname = url.split("?")[0] ?? "/";

  const productSlug = pathname.match(/^\/producto\/([^/]+)/)?.[1];
  if (productSlug) {
    const [p] = await db.select().from(schema.products).where(eq(schema.products.slug, productSlug)).limit(1);
    if (p?.isActive) {
      title = `${p.name} | ${s.storeName}`;
      description = p.tagline || p.description.slice(0, 160);
      const [img] = await db
        .select()
        .from(schema.productImages)
        .where(eq(schema.productImages.productId, p.id))
        .orderBy(schema.productImages.sortOrder)
        .limit(1);
      if (img) image = img.url;
    }
  } else if (pathname.startsWith("/admin")) {
    title = `Panel | ${s.storeName}`;
  } else if (pathname.startsWith("/tienda")) {
    title = `Tienda | ${s.storeName}`;
  } else if (pathname !== "/") {
    const slug = pathname.replace(/^\/+|\/+$/g, "");
    if (slug && !slug.includes("/")) {
      const [pg] = await db.select().from(schema.pages).where(eq(schema.pages.slug, slug)).limit(1);
      if (pg?.isPublished) {
        title = `${pg.title} | ${s.storeName}`;
        description = pg.seoDescription || pg.intro || description;
      }
    }
  }

  const abs = (u: string) => (u.startsWith("/") && env.publicUrl ? `${env.publicUrl}${u}` : u);
  return [
    `<title>${esc(title)}</title>`,
    `<meta name="description" content="${esc(description)}" />`,
    `<meta property="og:title" content="${esc(title)}" />`,
    `<meta property="og:description" content="${esc(description)}" />`,
    `<meta property="og:type" content="website" />`,
    image ? `<meta property="og:image" content="${esc(abs(image))}" />` : "",
    s.faviconUrl ? `<link rel="icon" href="${esc(s.faviconUrl)}" />` : "",
    pathname.startsWith("/admin") ? `<meta name="robots" content="noindex" />` : "",
  ]
    .filter(Boolean)
    .join("\n    ");
}

async function main() {
  assertEnv();

  console.log("→ Aplicando migraciones…");
  await runMigrations();
  await seed();

  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    next();
  });
  app.use(cookieParser());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  /* Imágenes guardadas en la base de datos (cuando no hay R2). */
  app.get("/media/:file", async (req, res) => {
    const id = String(req.params.file).replace(/\.[a-z0-9]+$/i, "");
    const [row] = await db.select().from(schema.media).where(eq(schema.media.id, id)).limit(1);
    if (!row) {
      res.status(404).end();
      return;
    }
    res.setHeader("Content-Type", row.mime);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    if (row.mime === "image/svg+xml") {
      res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
    }
    res.end(row.data);
  });

  /* Subida de imágenes desde el panel. */
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    const uid = await readSession(req);
    if (!uid) {
      res.status(401).json({ error: "Inicia sesión para subir imágenes." });
      return;
    }
    const file = req.file;
    if (!file || !IMAGE_TYPES.includes(file.mimetype)) {
      res.status(400).json({ error: "Sube una imagen JPG, PNG, WebP, AVIF, GIF o SVG." });
      return;
    }
    const url = await saveImage(file.buffer, file.mimetype, "img");
    res.json({ url });
  });

  /* Comprobante de pago que sube el cliente desde su pedido. */
  app.post("/api/upload/comprobante", upload.single("file"), async (req, res) => {
    const ip = (req.headers["x-forwarded-for"]?.toString().split(",")[0] ?? req.ip ?? "").trim();
    if (!rateLimit(`proof:${ip}`, 10, 10 * 60_000)) {
      res.status(429).json({ error: "Demasiados intentos. Espera unos minutos." });
      return;
    }
    const token = String(req.body?.token ?? "");
    const file = req.file;
    if (!file || !PROOF_TYPES.includes(file.mimetype)) {
      res.status(400).json({ error: "Sube el comprobante como imagen (JPG, PNG) o PDF." });
      return;
    }
    const [order] = await db.select().from(schema.orders).where(eq(schema.orders.token, token)).limit(1);
    if (!order || token.length < 20) {
      res.status(404).json({ error: "No encontramos ese pedido." });
      return;
    }
    if (order.status !== "pendiente") {
      res.status(400).json({ error: "Este pedido ya no está pendiente de pago." });
      return;
    }
    const url = await saveImage(file.buffer, file.mimetype, "comprobantes");
    await db.update(schema.orders).set({ paymentProofUrl: url }).where(eq(schema.orders.id, order.id));
    await db
      .insert(schema.orderEvents)
      .values({ orderId: order.id, status: "pendiente", note: "Comprobante de pago recibido" });
    void sendProofReceived({ ...order, paymentProofUrl: url });
    res.json({ url });
  });

  app.use(
    "/api/trpc",
    express.json({ limit: "2mb" }),
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError({ error, path: p }) {
        if (error.code === "INTERNAL_SERVER_ERROR") console.error(`tRPC ${p}:`, error);
      },
    }),
  );

  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "No existe." });
  });

  if (env.isProd) {
    const dist = path.resolve(process.cwd(), "dist/public");
    const template = fs.readFileSync(path.join(dist, "index.html"), "utf8");
    app.use(
      "/assets",
      express.static(path.join(dist, "assets"), { immutable: true, maxAge: "1y", fallthrough: false }),
    );
    app.use(express.static(dist, { index: false, maxAge: "1d" }));
    app.use(async (req, res, next) => {
      if (req.method !== "GET") return next();
      try {
        const head = await headFor(req.originalUrl);
        res.status(200).set({ "Content-Type": "text/html", "Cache-Control": "no-cache" });
        res.end(template.replace("<!--app-head-->", head));
      } catch (err) {
        next(err);
      }
    });
  } else {
    const { createServer } = await import("vite");
    const vite = await createServer({ server: { middlewareMode: true }, appType: "custom" });
    app.use(vite.middlewares);
    app.use(async (req, res, next) => {
      if (req.method !== "GET") return next();
      try {
        const raw = fs.readFileSync(path.resolve(process.cwd(), "client/index.html"), "utf8");
        const html = await vite.transformIndexHtml(req.originalUrl, raw);
        res.status(200).set({ "Content-Type": "text/html" });
        res.end(html.replace("<!--app-head-->", await headFor(req.originalUrl)));
      } catch (err) {
        vite.ssrFixStacktrace(err as Error);
        next(err);
      }
    });
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const e = err as { code?: string; message?: string };
    if (e?.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: "El archivo pesa más de 12 MB." });
      return;
    }
    const status = (err as { status?: number })?.status;
    if (status && status >= 400 && status < 500) {
      res.status(status).end();
      return;
    }
    console.error(err);
    res.status(500).json({ error: "Algo falló en el servidor. Inténtalo de nuevo." });
  });

  app.listen(env.port, "0.0.0.0", () => {
    console.log(`✓ Tienda lista en el puerto ${env.port}`);
    console.log(`  Imágenes: ${r2Enabled ? "Cloudflare R2" : "base de datos (configura R2 para producción)"}`);
    console.log(`  Correos: ${env.resendKey && env.emailFrom ? "Resend" : "desactivados (falta RESEND_API_KEY / EMAIL_FROM)"}`);
  });
}

main().catch((err) => {
  console.error("✗ No se pudo iniciar el servidor:", err);
  process.exit(1);
});
