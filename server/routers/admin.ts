import { and, asc, desc, eq, gte, inArray, like, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import {
  ORDER_STATUSES,
  RESERVED_SLUGS,
  blockSchema,
  colorSchema,
  settingsSchema,
  slugify,
  type Block,
  type OrderStatus,
} from "../../shared/types";
import { db, schema } from "../db";
import { adminProcedure, fail, router } from "../trpc";
import { getSettings, saveSettings } from "../settings";
import { getProductDetail, listProductCards, parseJson, uniqueSlug } from "../catalog";
import { changeOrderStatus, loadOrder } from "../orders";
import { sendOrderStatus } from "../email";
import { r2Enabled, env } from "../env";

const {
  categories,
  products,
  productImages,
  productVariants,
  orders,
  orderItems,
  shippingMethods,
  paymentMethods,
  coupons,
  pages,
} = schema;

const id = z.object({ id: z.number().int() });
const money = z.number().int().min(0).max(9_000_000_000_000);
const PAID: OrderStatus[] = ["pagado", "preparando", "enviado", "entregado"];

/* ───────────── Inicio ───────────── */

const dashboard = adminProcedure.query(async () => {
  const s = await getSettings();
  const since = (days: number) => new Date(Date.now() - days * 86_400_000);

  const [totals] = await db
    .select({
      revenue30: sql<number>`cast(coalesce(sum(case when ${orders.status} in ('pagado','preparando','enviado','entregado') and ${orders.createdAt} >= ${since(30)} then ${orders.total} else 0 end), 0) as signed)`,
      orders30: sql<number>`cast(coalesce(sum(case when ${orders.status} <> 'cancelado' and ${orders.createdAt} >= ${since(30)} then 1 else 0 end), 0) as signed)`,
      pending: sql<number>`cast(coalesce(sum(case when ${orders.status} = 'pendiente' then 1 else 0 end), 0) as signed)`,
      toShip: sql<number>`cast(coalesce(sum(case when ${orders.status} in ('pagado','preparando') then 1 else 0 end), 0) as signed)`,
    })
    .from(orders);

  const daily = await db
    .select({
      day: sql<string>`date_format(${orders.createdAt}, '%Y-%m-%d')`,
      total: sql<number>`cast(coalesce(sum(${orders.total}), 0) as signed)`,
      count: sql<number>`cast(count(*) as signed)`,
    })
    .from(orders)
    .where(and(gte(orders.createdAt, since(13)), ne(orders.status, "cancelado")))
    .groupBy(sql`date_format(${orders.createdAt}, '%Y-%m-%d')`);

  const recent = await db
    .select({
      id: orders.id,
      number: orders.number,
      status: orders.status,
      customerName: orders.customerName,
      total: orders.total,
      currency: orders.currency,
      createdAt: orders.createdAt,
      hasProof: sql<number>`${orders.paymentProofUrl} <> ''`,
    })
    .from(orders)
    .orderBy(desc(orders.id))
    .limit(6);

  const low = await db
    .select({
      productId: products.id,
      name: products.name,
      color: productVariants.color,
      size: productVariants.size,
      stock: productVariants.stock,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(and(eq(products.isActive, true), lte(productVariants.stock, s.lowStock)))
    .orderBy(asc(productVariants.stock), asc(products.name))
    .limit(8);

  const top = await db
    .select({
      name: orderItems.name,
      units: sql<number>`cast(sum(${orderItems.quantity}) as signed)`,
      revenue: sql<number>`cast(sum(${orderItems.quantity} * ${orderItems.price}) as signed)`,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(and(inArray(orders.status, PAID), gte(orders.createdAt, since(30))))
    .groupBy(orderItems.name)
    .orderBy(desc(sql`sum(${orderItems.quantity})`))
    .limit(5);

  const [counts] = await db
    .select({ products: sql<number>`cast(count(*) as signed)` })
    .from(products)
    .where(eq(products.isActive, true));

  const days: { day: string; total: number; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
    const hit = daily.find((x) => x.day === d);
    days.push({ day: d, total: Number(hit?.total ?? 0), count: Number(hit?.count ?? 0) });
  }

  return {
    revenue30: Number(totals?.revenue30 ?? 0),
    orders30: Number(totals?.orders30 ?? 0),
    pending: Number(totals?.pending ?? 0),
    toShip: Number(totals?.toShip ?? 0),
    activeProducts: Number(counts?.products ?? 0),
    days,
    recent: recent.map((r) => ({ ...r, hasProof: Boolean(Number(r.hasProof)) })),
    low,
    top: top.map((t) => ({ name: t.name, units: Number(t.units), revenue: Number(t.revenue) })),
    storage: r2Enabled ? ("r2" as const) : ("db" as const),
    emailEnabled: Boolean(env.resendKey && env.emailFrom),
  };
});

/* ───────────── Productos ───────────── */

const productInput = z.object({
  id: z.number().int().optional(),
  name: z.string().trim().min(1, "Escribe el nombre del producto.").max(160),
  slug: z.string().trim().max(180).default(""),
  tagline: z.string().trim().max(200).default(""),
  description: z.string().max(20000).default(""),
  details: z.string().max(20000).default(""),
  price: money,
  compareAtPrice: money.nullable().default(null),
  categoryId: z.number().int().nullable().default(null),
  colors: z.array(colorSchema).max(24).default([]),
  sizes: z.array(z.string().trim().min(1).max(40)).max(24).default([]),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  isNew: z.boolean().default(false),
  images: z.array(z.object({ url: z.string().min(1).max(600), color: z.string().max(40).default("") })).max(60).default([]),
  variants: z
    .array(
      z.object({
        color: z.string().max(40).default(""),
        size: z.string().max(40).default(""),
        sku: z.string().trim().max(80).default(""),
        stock: z.number().int().min(0).max(1_000_000),
      }),
    )
    .max(600)
    .default([]),
});

const productsRouter = router({
  list: adminProcedure
    .input(z.object({ search: z.string().max(80).optional(), categoryId: z.number().int().optional() }).optional())
    .query(async ({ input }) =>
      listProductCards({
        includeInactive: true,
        search: input?.search,
        categoryId: input?.categoryId,
        sort: "nuevos",
        limit: 500,
      }),
    ),

  get: adminProcedure.input(id).query(async ({ input }) => {
    const p = await getProductDetail(eq(products.id, input.id), true);
    if (!p) throw fail("Ese producto no existe.", "NOT_FOUND");
    return p;
  }),

  save: adminProcedure.input(productInput).mutation(async ({ input }) => {
    const uniq = <T,>(arr: T[], key: (x: T) => string) => {
      const seen = new Set<string>();
      return arr.filter((x) => {
        const k = key(x).toLowerCase();
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    };
    const colors = uniq(input.colors, (c) => c.name);
    const sizes = uniq(input.sizes, (s) => s);
    const slug = await uniqueSlug("products", slugify(input.slug || input.name), input.id);

    const base = {
      name: input.name,
      slug,
      tagline: input.tagline,
      description: input.description,
      details: input.details,
      price: input.price,
      compareAtPrice: input.compareAtPrice && input.compareAtPrice > input.price ? input.compareAtPrice : null,
      categoryId: input.categoryId,
      colors: JSON.stringify(colors),
      sizes: JSON.stringify(sizes),
      isActive: input.isActive,
      isFeatured: input.isFeatured,
      isNew: input.isNew,
    };

    return db.transaction(async (tx) => {
      let productId = input.id;
      if (productId) {
        await tx.update(products).set(base).where(eq(products.id, productId));
      } else {
        const [ins] = await tx.insert(products).values(base);
        productId = ins.insertId;
      }

      await tx.delete(productImages).where(eq(productImages.productId, productId));
      if (input.images.length) {
        await tx.insert(productImages).values(
          input.images.map((img, i) => ({
            productId: productId!,
            url: img.url,
            color: colors.some((c) => c.name === img.color) ? img.color : "",
            sortOrder: i,
          })),
        );
      }

      // Una variante por cada combinación color × talla. Se conservan los
      // ids existentes para no romper bolsas ni pedidos ya hechos.
      const combos: { color: string; size: string }[] = [];
      for (const c of colors.length ? colors.map((x) => x.name) : [""]) {
        for (const s of sizes.length ? sizes : [""]) combos.push({ color: c, size: s });
      }
      const key = (v: { color: string; size: string }) => `${v.color}\u0001${v.size}`;
      const given = new Map(input.variants.map((v) => [key(v), v]));
      const existing = await tx.select().from(productVariants).where(eq(productVariants.productId, productId));
      const existingBy = new Map(existing.map((v) => [key(v), v]));
      const keep = new Set<number>();

      for (const combo of combos) {
        const g = given.get(key(combo));
        const e = existingBy.get(key(combo));
        if (e) {
          keep.add(e.id);
          await tx
            .update(productVariants)
            .set({ stock: g?.stock ?? e.stock, sku: g?.sku ?? e.sku })
            .where(eq(productVariants.id, e.id));
        } else {
          await tx
            .insert(productVariants)
            .values({ productId, color: combo.color, size: combo.size, stock: g?.stock ?? 0, sku: g?.sku ?? "" });
        }
      }
      const drop = existing.filter((v) => !keep.has(v.id)).map((v) => v.id);
      if (drop.length) await tx.delete(productVariants).where(inArray(productVariants.id, drop));

      return { id: productId, slug };
    });
  }),

  remove: adminProcedure.input(id).mutation(async ({ input }) => {
    await db.transaction(async (tx) => {
      await tx.delete(productImages).where(eq(productImages.productId, input.id));
      await tx.delete(productVariants).where(eq(productVariants.productId, input.id));
      await tx.delete(products).where(eq(products.id, input.id));
    });
    return { ok: true };
  }),

  toggle: adminProcedure
    .input(z.object({ id: z.number().int(), field: z.enum(["isActive", "isFeatured", "isNew"]), value: z.boolean() }))
    .mutation(async ({ input }) => {
      if (input.field === "isFeatured" && input.value) {
        const [max] = await db
          .select({ m: sql<number>`coalesce(max(${products.featuredOrder}), 0)` })
          .from(products)
          .where(eq(products.isFeatured, true));
        await db
          .update(products)
          .set({ isFeatured: true, featuredOrder: Number(max?.m ?? 0) + 1 })
          .where(eq(products.id, input.id));
      } else {
        await db.update(products).set({ [input.field]: input.value }).where(eq(products.id, input.id));
      }
      return { ok: true };
    }),

  /** Orden en que salen los destacados en el inicio. */
  reorderFeatured: adminProcedure.input(z.object({ ids: z.array(z.number().int()).max(200) })).mutation(async ({ input }) => {
    await db.transaction(async (tx) => {
      for (const [i, pid] of input.ids.entries()) {
        await tx.update(products).set({ featuredOrder: i + 1 }).where(eq(products.id, pid));
      }
    });
    return { ok: true };
  }),
});

/* ───────────── Categorías ───────────── */

const categoriesRouter = router({
  list: adminProcedure.query(async () => {
    const rows = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
    const counts = await db
      .select({ categoryId: products.categoryId, n: sql<number>`cast(count(*) as signed)` })
      .from(products)
      .groupBy(products.categoryId);
    return rows.map((c) => ({ ...c, productCount: Number(counts.find((x) => x.categoryId === c.id)?.n ?? 0) }));
  }),

  save: adminProcedure
    .input(
      z.object({
        id: z.number().int().optional(),
        name: z.string().trim().min(1, "Escribe el nombre de la categoría.").max(120),
        slug: z.string().trim().max(140).default(""),
        description: z.string().trim().max(400).default(""),
        imageUrl: z.string().max(600).default(""),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const slug = await uniqueSlug("categories", slugify(input.slug || input.name), input.id);
      const data = {
        name: input.name,
        slug,
        description: input.description,
        imageUrl: input.imageUrl,
        isActive: input.isActive,
      };
      if (input.id) {
        await db.update(categories).set(data).where(eq(categories.id, input.id));
        return { id: input.id };
      }
      const [max] = await db.select({ m: sql<number>`coalesce(max(${categories.sortOrder}), 0)` }).from(categories);
      const [ins] = await db.insert(categories).values({ ...data, sortOrder: Number(max?.m ?? 0) + 1 });
      return { id: ins.insertId };
    }),

  remove: adminProcedure.input(id).mutation(async ({ input }) => {
    await db.update(products).set({ categoryId: null }).where(eq(products.categoryId, input.id));
    await db.delete(categories).where(eq(categories.id, input.id));
    return { ok: true };
  }),

  reorder: adminProcedure.input(z.object({ ids: z.array(z.number().int()).max(300) })).mutation(async ({ input }) => {
    for (const [i, cid] of input.ids.entries()) {
      await db.update(categories).set({ sortOrder: i + 1 }).where(eq(categories.id, cid));
    }
    return { ok: true };
  }),
});

/* ───────────── Pedidos ───────────── */

const ordersRouter = router({
  list: adminProcedure
    .input(
      z.object({
        status: z.enum(ORDER_STATUSES).optional(),
        search: z.string().max(80).optional(),
        page: z.number().int().min(1).default(1),
      }),
    )
    .query(async ({ input }) => {
      const where: SQL[] = [];
      if (input.status) where.push(eq(orders.status, input.status));
      if (input.search?.trim()) {
        const q = `%${input.search.trim().replace(/[%_\\]/g, "\\$&")}%`;
        where.push(or(like(orders.number, q), like(orders.customerName, q), like(orders.customerEmail, q), like(orders.customerPhone, q))!);
      }
      const cond = where.length ? and(...where) : undefined;
      const size = 25;
      const [rows, [count], byStatus] = await Promise.all([
        db
          .select({
            id: orders.id,
            number: orders.number,
            status: orders.status,
            customerName: orders.customerName,
            customerEmail: orders.customerEmail,
            city: orders.city,
            total: orders.total,
            currency: orders.currency,
            paymentMethod: orders.paymentMethod,
            shippingMethod: orders.shippingMethod,
            hasProof: sql<number>`${orders.paymentProofUrl} <> ''`,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .where(cond)
          .orderBy(desc(orders.id))
          .limit(size)
          .offset((input.page - 1) * size),
        db.select({ n: sql<number>`cast(count(*) as signed)` }).from(orders).where(cond),
        db
          .select({ status: orders.status, n: sql<number>`cast(count(*) as signed)` })
          .from(orders)
          .groupBy(orders.status),
      ]);
      const total = Number(count?.n ?? 0);
      return {
        items: rows.map((r) => ({ ...r, hasProof: Boolean(Number(r.hasProof)) })),
        total,
        pages: Math.max(1, Math.ceil(total / size)),
        counts: Object.fromEntries(byStatus.map((b) => [b.status, Number(b.n)])) as Partial<Record<OrderStatus, number>>,
      };
    }),

  get: adminProcedure.input(id).query(async ({ input }) => {
    const data = await loadOrder(eq(orders.id, input.id));
    if (!data) throw fail("Ese pedido no existe.", "NOT_FOUND");
    return data;
  }),

  setStatus: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(ORDER_STATUSES),
        note: z.string().trim().max(400).default(""),
        notify: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const res = await changeOrderStatus(input.id, input.status, input.note);
      if (res.changed && input.notify) {
        const data = await loadOrder(eq(orders.id, input.id));
        if (data) void sendOrderStatus(data.order);
      }
      return res;
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.number().int(),
        trackingNumber: z.string().trim().max(120),
        trackingUrl: z.string().trim().max(400),
        adminNotes: z.string().max(5000),
      }),
    )
    .mutation(async ({ input }) => {
      await db
        .update(orders)
        .set({ trackingNumber: input.trackingNumber, trackingUrl: input.trackingUrl, adminNotes: input.adminNotes })
        .where(eq(orders.id, input.id));
      return { ok: true };
    }),
});

/* ───────────── Clientes ───────────── */

const customers = adminProcedure.query(async () => {
  const rows = await db
    .select({
      email: orders.customerEmail,
      name: sql<string>`max(${orders.customerName})`,
      phone: sql<string>`max(${orders.customerPhone})`,
      city: sql<string>`max(${orders.city})`,
      orders: sql<number>`cast(count(*) as signed)`,
      spent: sql<number>`cast(coalesce(sum(case when ${orders.status} in ('pagado','preparando','enviado','entregado') then ${orders.total} else 0 end), 0) as signed)`,
      last: sql<Date>`max(${orders.createdAt})`,
    })
    .from(orders)
    .groupBy(orders.customerEmail)
    .orderBy(desc(sql`max(${orders.createdAt})`))
    .limit(1000);
  return rows.map((r) => ({ ...r, orders: Number(r.orders), spent: Number(r.spent), last: new Date(r.last) }));
});

/* ───────────── Envíos ───────────── */

const shippingRouter = router({
  list: adminProcedure.query(() =>
    db.select().from(shippingMethods).orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.id)),
  ),
  save: adminProcedure
    .input(
      z.object({
        id: z.number().int().optional(),
        name: z.string().trim().min(1, "Escribe el nombre del envío.").max(120),
        description: z.string().trim().max(300).default(""),
        eta: z.string().trim().max(80).default(""),
        price: money,
        freeOver: money.nullable().default(null),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const { id: sid, ...data } = input;
      if (sid) {
        await db.update(shippingMethods).set(data).where(eq(shippingMethods.id, sid));
        return { id: sid };
      }
      const [max] = await db.select({ m: sql<number>`coalesce(max(${shippingMethods.sortOrder}), 0)` }).from(shippingMethods);
      const [ins] = await db.insert(shippingMethods).values({ ...data, sortOrder: Number(max?.m ?? 0) + 1 });
      return { id: ins.insertId };
    }),
  remove: adminProcedure.input(id).mutation(async ({ input }) => {
    await db.delete(shippingMethods).where(eq(shippingMethods.id, input.id));
    return { ok: true };
  }),
});

/* ───────────── Pagos ───────────── */

const paymentsRouter = router({
  list: adminProcedure.query(() =>
    db.select().from(paymentMethods).orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.id)),
  ),
  save: adminProcedure
    .input(
      z.object({
        id: z.number().int().optional(),
        name: z.string().trim().min(1, "Escribe el nombre del método de pago.").max(120),
        description: z.string().trim().max(300).default(""),
        instructions: z.string().max(5000).default(""),
        requiresProof: z.boolean().default(true),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const { id: pid, ...data } = input;
      if (pid) {
        await db.update(paymentMethods).set(data).where(eq(paymentMethods.id, pid));
        return { id: pid };
      }
      const [max] = await db.select({ m: sql<number>`coalesce(max(${paymentMethods.sortOrder}), 0)` }).from(paymentMethods);
      const [ins] = await db.insert(paymentMethods).values({ ...data, sortOrder: Number(max?.m ?? 0) + 1 });
      return { id: ins.insertId };
    }),
  remove: adminProcedure.input(id).mutation(async ({ input }) => {
    await db.delete(paymentMethods).where(eq(paymentMethods.id, input.id));
    return { ok: true };
  }),
});

/* ───────────── Cupones ───────────── */

const couponsRouter = router({
  list: adminProcedure.query(() => db.select().from(coupons).orderBy(desc(coupons.id))),
  save: adminProcedure
    .input(
      z.object({
        id: z.number().int().optional(),
        code: z
          .string()
          .trim()
          .min(2, "El código debe tener al menos 2 caracteres.")
          .max(40)
          .regex(/^[A-Za-z0-9_-]+$/, "Usa solo letras, números y guiones."),
        type: z.enum(["porcentaje", "fijo"]),
        value: money,
        minSubtotal: money.default(0),
        maxUses: z.number().int().min(1).nullable().default(null),
        expiresAt: z.date().nullable().default(null),
        isActive: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const { id: cid, ...rest } = input;
      const data = { ...rest, code: rest.code.toUpperCase() };
      if (data.type === "porcentaje" && (data.value < 1 || data.value > 100)) {
        throw fail("El porcentaje debe estar entre 1 y 100.");
      }
      const [taken] = await db.select().from(coupons).where(eq(coupons.code, data.code)).limit(1);
      if (taken && taken.id !== cid) throw fail("Ya existe un cupón con ese código.");
      if (cid) {
        await db.update(coupons).set(data).where(eq(coupons.id, cid));
        return { id: cid };
      }
      const [ins] = await db.insert(coupons).values(data);
      return { id: ins.insertId };
    }),
  remove: adminProcedure.input(id).mutation(async ({ input }) => {
    await db.delete(coupons).where(eq(coupons.id, input.id));
    return { ok: true };
  }),
});

/* ───────────── Subpáginas ───────────── */

const pagesRouter = router({
  list: adminProcedure.query(async () => {
    const rows = await db.select().from(pages).orderBy(asc(pages.sortOrder), asc(pages.title));
    return rows.map(({ blocks: _b, ...p }) => p);
  }),

  get: adminProcedure.input(id).query(async ({ input }) => {
    const [p] = await db.select().from(pages).where(eq(pages.id, input.id)).limit(1);
    if (!p) throw fail("Esa página no existe.", "NOT_FOUND");
    return { ...p, blocks: parseJson<Block[]>(p.blocks, []) };
  }),

  save: adminProcedure
    .input(
      z.object({
        id: z.number().int().optional(),
        title: z.string().trim().min(1, "Escribe el título de la página.").max(160),
        slug: z.string().trim().max(140).default(""),
        intro: z.string().trim().max(400).default(""),
        seoDescription: z.string().trim().max(300).default(""),
        blocks: z.array(blockSchema).max(80).default([]),
        showInNav: z.boolean().default(false),
        showInFooter: z.boolean().default(true),
        isPublished: z.boolean().default(true),
      }),
    )
    .mutation(async ({ input }) => {
      const wanted = slugify(input.slug || input.title);
      if (RESERVED_SLUGS.includes(wanted)) {
        throw fail(`La dirección "/${wanted}" ya la usa la tienda. Elige otra.`);
      }
      const slug = await uniqueSlug("pages", wanted, input.id);
      const data = {
        title: input.title,
        slug,
        intro: input.intro,
        seoDescription: input.seoDescription,
        blocks: JSON.stringify(input.blocks),
        showInNav: input.showInNav,
        showInFooter: input.showInFooter,
        isPublished: input.isPublished,
      };
      if (input.id) {
        await db.update(pages).set(data).where(eq(pages.id, input.id));
        return { id: input.id, slug };
      }
      const [max] = await db.select({ m: sql<number>`coalesce(max(${pages.sortOrder}), 0)` }).from(pages);
      const [ins] = await db.insert(pages).values({ ...data, sortOrder: Number(max?.m ?? 0) + 1 });
      return { id: ins.insertId, slug };
    }),

  remove: adminProcedure.input(id).mutation(async ({ input }) => {
    await db.delete(pages).where(eq(pages.id, input.id));
    return { ok: true };
  }),

  reorder: adminProcedure.input(z.object({ ids: z.array(z.number().int()).max(300) })).mutation(async ({ input }) => {
    for (const [i, pid] of input.ids.entries()) {
      await db.update(pages).set({ sortOrder: i + 1 }).where(eq(pages.id, pid));
    }
    return { ok: true };
  }),
});

/* ───────────── Ajustes ───────────── */

const settingsRouter = router({
  get: adminProcedure.query(() => getSettings()),
  save: adminProcedure.input(settingsSchema).mutation(async ({ input }) => {
    await saveSettings(input);
    return { ok: true };
  }),
});

export const adminRouter = router({
  dashboard,
  customers,
  products: productsRouter,
  categories: categoriesRouter,
  orders: ordersRouter,
  shipping: shippingRouter,
  payments: paymentsRouter,
  coupons: couponsRouter,
  pages: pagesRouter,
  settings: settingsRouter,
});
