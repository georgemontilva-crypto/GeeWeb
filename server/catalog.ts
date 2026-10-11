import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import type { ProductColor } from "../shared/types";
import { db, schema } from "./db";

const { products, productImages, productVariants, categories } = schema;

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export type ProductCard = {
  id: number;
  name: string;
  slug: string;
  tagline: string;
  price: number;
  compareAtPrice: number | null;
  categoryId: number | null;
  isNew: boolean;
  isFeatured: boolean;
  isActive: boolean;
  colors: ProductColor[];
  sizes: string[];
  images: { url: string; color: string }[];
  stock: number;
};

export type ProductSort = "destacados" | "nuevos" | "precio_asc" | "precio_desc" | "nombre";

const ORDER: Record<ProductSort, SQL[]> = {
  destacados: [desc(products.isFeatured), asc(products.featuredOrder), desc(products.createdAt), desc(products.id)],
  nuevos: [desc(products.isNew), desc(products.createdAt), desc(products.id)],
  precio_asc: [asc(products.price)],
  precio_desc: [desc(products.price)],
  nombre: [asc(products.name)],
};

export async function listProductCards(opts: {
  categoryId?: number;
  search?: string;
  featured?: boolean;
  onlyNew?: boolean;
  ids?: number[];
  includeInactive?: boolean;
  sort?: ProductSort;
  limit?: number;
}): Promise<ProductCard[]> {
  const where: SQL[] = [];
  if (!opts.includeInactive) where.push(eq(products.isActive, true));
  if (opts.categoryId) where.push(eq(products.categoryId, opts.categoryId));
  if (opts.featured) where.push(eq(products.isFeatured, true));
  if (opts.onlyNew) where.push(eq(products.isNew, true));
  if (opts.ids) {
    if (opts.ids.length === 0) return [];
    where.push(inArray(products.id, opts.ids));
  }
  if (opts.search?.trim()) {
    const q = `%${opts.search.trim().replace(/[%_\\]/g, "\\$&")}%`;
    where.push(or(like(products.name, q), like(products.tagline, q), like(products.description, q))!);
  }

  const rows = await db
    .select()
    .from(products)
    .where(where.length ? and(...where) : undefined)
    .orderBy(...ORDER[opts.sort ?? "destacados"])
    .limit(opts.limit ?? 200);

  return hydrate(rows);
}

async function hydrate(rows: (typeof products.$inferSelect)[]): Promise<ProductCard[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [imgs, stocks] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(inArray(productImages.productId, ids))
      .orderBy(asc(productImages.sortOrder), asc(productImages.id)),
    db
      .select({ productId: productVariants.productId, stock: sql<number>`cast(sum(${productVariants.stock}) as signed)` })
      .from(productVariants)
      .where(inArray(productVariants.productId, ids))
      .groupBy(productVariants.productId),
  ]);
  const stockBy = new Map(stocks.map((s) => [s.productId, Number(s.stock ?? 0)]));
  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    tagline: p.tagline,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    categoryId: p.categoryId,
    isNew: p.isNew,
    isFeatured: p.isFeatured,
    isActive: p.isActive,
    colors: parseJson<ProductColor[]>(p.colors, []),
    sizes: parseJson<string[]>(p.sizes, []),
    images: imgs.filter((i) => i.productId === p.id).map((i) => ({ url: i.url, color: i.color })),
    stock: stockBy.get(p.id) ?? 0,
  }));
}

export async function getProductDetail(where: SQL, includeInactive = false) {
  const [p] = await db
    .select()
    .from(products)
    .where(includeInactive ? where : and(where, eq(products.isActive, true)))
    .limit(1);
  if (!p) return null;
  const [imgs, variants, cat] = await Promise.all([
    db
      .select()
      .from(productImages)
      .where(eq(productImages.productId, p.id))
      .orderBy(asc(productImages.sortOrder), asc(productImages.id)),
    db.select().from(productVariants).where(eq(productVariants.productId, p.id)).orderBy(asc(productVariants.id)),
    p.categoryId
      ? db.select().from(categories).where(eq(categories.id, p.categoryId)).limit(1)
      : Promise.resolve([]),
  ]);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    tagline: p.tagline,
    description: p.description,
    details: p.details,
    price: p.price,
    compareAtPrice: p.compareAtPrice,
    categoryId: p.categoryId,
    category: cat[0] ? { id: cat[0].id, name: cat[0].name, slug: cat[0].slug } : null,
    isNew: p.isNew,
    isFeatured: p.isFeatured,
    isActive: p.isActive,
    colors: parseJson<ProductColor[]>(p.colors, []),
    sizes: parseJson<string[]>(p.sizes, []),
    images: imgs.map((i) => ({ url: i.url, color: i.color })),
    variants: variants.map((v) => ({ id: v.id, color: v.color, size: v.size, sku: v.sku, stock: v.stock })),
  };
}
export type ProductDetail = NonNullable<Awaited<ReturnType<typeof getProductDetail>>>;

export async function uniqueSlug(
  table: "products" | "categories" | "pages",
  base: string,
  ignoreId?: number,
): Promise<string> {
  const t = schema[table];
  const root = base || "item";
  let slug = root;
  for (let n = 2; n < 500; n++) {
    const [hit] = await db.select({ id: t.id }).from(t).where(eq(t.slug, slug)).limit(1);
    if (!hit || hit.id === ignoreId) return slug;
    slug = `${root}-${n}`;
  }
  return `${root}-${Date.now()}`;
}
