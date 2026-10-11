import fs from "node:fs";
import path from "node:path";

// Carga el archivo .env si existe (desarrollo local). En Railway las
// variables llegan del panel y este archivo no existe.
try {
  const file = path.resolve(process.cwd(), ".env");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      const key = m[1]!;
      const value = m[2]!.replace(/^(["'])(.*)\1$/, "$2");
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
} catch {
  /* sin .env: se usan las variables del sistema */
}

const bool = (v: string | undefined, fallback: boolean) =>
  v === undefined || v === "" ? fallback : !["false", "0", "no"].includes(v.toLowerCase());

export const env = {
  /** `npm run dev` pasa --dev; todo lo demás (npm start) corre en modo producción. */
  isProd: !process.argv.includes("--dev"),
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: process.env.DATABASE_URL ?? process.env.MYSQL_URL ?? "",
  jwtSecret: process.env.JWT_SECRET ?? "",
  adminEmail: (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase(),
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
  publicUrl: (
    process.env.PUBLIC_URL ??
    (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : "")
  ).replace(/\/$/, ""),
  seedDemo: bool(process.env.SEED_DEMO, true),
  r2: {
    accountId: process.env.R2_ACCOUNT_ID ?? "",
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    bucket: process.env.R2_BUCKET ?? "",
    publicUrl: (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, ""),
  },
  resendKey: process.env.RESEND_API_KEY ?? "",
  emailFrom: process.env.EMAIL_FROM ?? "",
};

export const r2Enabled = Boolean(
  env.r2.accountId && env.r2.accessKeyId && env.r2.secretAccessKey && env.r2.bucket && env.r2.publicUrl,
);

export function assertEnv() {
  const missing: string[] = [];
  if (!env.databaseUrl) missing.push("DATABASE_URL");
  if (!env.jwtSecret) missing.push("JWT_SECRET");
  if (missing.length) {
    console.error(
      `\n✗ Faltan variables de entorno obligatorias: ${missing.join(", ")}\n  Revisa .env.example para ver cómo configurarlas.\n`,
    );
    process.exit(1);
  }
  if (env.jwtSecret.length < 16) {
    console.warn("⚠ JWT_SECRET es muy corto: usa una cadena aleatoria de al menos 32 caracteres.");
  }
}
