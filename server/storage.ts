import crypto from "node:crypto";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { db, schema } from "./db";
import { env, r2Enabled } from "./env";

let s3: S3Client | null = null;
function client() {
  s3 ??= new S3Client({
    region: "auto",
    endpoint: `https://${env.r2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env.r2.accessKeyId, secretAccessKey: env.r2.secretAccessKey },
  });
  return s3;
}

const EXT: Record<string, string> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "application/pdf": "pdf",
};

/**
 * Optimiza la imagen (máx. 2400 px, WebP) y la guarda en R2.
 * Sin R2 configurado, la guarda en la base de datos y la sirve desde /media/:id.
 */
export async function saveImage(input: Buffer, mime: string, folder = "img"): Promise<string> {
  let data = input;
  let type = mime;

  if (["image/jpeg", "image/png", "image/webp", "image/avif"].includes(mime)) {
    try {
      const sharp = (await import("sharp")).default;
      data = await sharp(input)
        .rotate()
        .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 86 })
        .toBuffer();
      type = "image/webp";
    } catch (err) {
      console.warn("No se pudo optimizar la imagen, se guarda el original:", (err as Error).message);
    }
  }

  const id = crypto.randomBytes(12).toString("hex");
  const ext = EXT[type] ?? "bin";

  if (r2Enabled) {
    const key = `${folder}/${id}.${ext}`;
    await client().send(
      new PutObjectCommand({
        Bucket: env.r2.bucket,
        Key: key,
        Body: data,
        ContentType: type,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
    return `${env.r2.publicUrl}/${key}`;
  }

  await db.insert(schema.media).values({ id, mime: type, data });
  return `/media/${id}.${ext}`;
}
