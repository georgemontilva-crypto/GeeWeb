import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { ORDER_STATUSES, type Block } from "../../shared/types";
import { db, schema } from "../db";
import { fail, publicProcedure, router } from "../trpc";
import { getSettings } from "../settings";
import { getProductDetail, listProductCards, parseJson } from "../catalog";
import { checkoutInput, createOrder, loadOrder, resolveCoupon } from "../orders";
import { sendOrderCreated } from "../email";
import { rateLimit } from "../auth";

const { categories, pages, products, shippingMethods, paymentMethods, orders } = schema;

function publicOrder(data: NonNullable<Awaited<ReturnType<typeof loadOrder>>>) {
  const { order: o, items, events } = data;
  return {
    number: o.number,
    token: o.token,
    status: o.status as (typeof ORDER_STATUSES)[number],
    customerName: o.customerName,
    customerEmail: o.customerEmail,
    address: [o.address, o.addressExtra, o.city, o.region, o.postalCode, o.country].filter(Boolean).join(", "),
    shippingMethod: o.shippingMethod,
    shippingEta: o.shippingEta,
    paymentMethod: o.paymentMethod,
    paymentInstructions: o.paymentInstructions,
    paymentRequiresProof: o.paymentRequiresProof,
    paymentProofUrl: o.paymentProofUrl,
    couponCode: o.couponCode,
    subtotal: o.subtotal,
    discount: o.discount,
    shippingCost: o.shippingCost,
    total: o.total,
    currency: o.currency,
    trackingNumber: o.trackingNumber,
    trackingUrl: o.trackingUrl,
    createdAt: o.createdAt,
    items: items.map((i) => ({
      name: i.name,
      color: i.color,
      size: i.size,
      imageUrl: i.imageUrl,
      price: i.price,
      quantity: i.quantity,
    })),
    events: events.map((e) => ({ status: e.status, note: e.note, createdAt: e.createdAt })),
  };
}

export const storeRouter = router({
  /** Todo lo que necesita el marco de la tienda: marca, menú y categorías. */
  bootstrap: publicProcedure.query(async () => {
    const [s, cats, pgs] = await Promise.all([
      getSettings(),
      db
        .select()
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.sortOrder), asc(categories.name)),
      db
        .select({
          title: pages.title,
          slug: pages.slug,
          showInNav: pages.showInNav,
          showInFooter: pages.showInFooter,
        })
        .from(pages)
        .where(eq(pages.isPublished, true))
        .orderBy(asc(pages.sortOrder), asc(pages.title)),
    ]);
    const { notifyEmail: _n, lowStock: _l, ...publicSettings } = s;
    return {
      settings: publicSettings,
      categories: cats.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        imageUrl: c.imageUrl,
      })),
      pages: pgs,
    };
  }),

  home: publicProcedure.query(async () => {
    const s = await getSettings();
    const [featured, latest] = await Promise.all([
      listProductCards({ featured: true, sort: "destacados", limit: 12 }),
      listProductCards({ sort: "nuevos", limit: 8 }),
    ]);
    const heroProduct =
      (s.home.heroProductId ? await getProductDetail(eq(products.id, s.home.heroProductId)) : null) ??
      (featured[0] ? await getProductDetail(eq(products.id, featured[0].id)) : null);
    const showcaseId =
      s.home.showcaseProductId ??
      [...featured, ...latest].find((p) => p.colors.length > 2 && p.id !== heroProduct?.id)?.id ??
      null;
    const showcase = showcaseId ? await getProductDetail(eq(products.id, showcaseId)) : null;

    // Imagen representativa para cada categoría sin foto propia.
    const cats = await db
      .select()
      .from(categories)
      .where(eq(categories.isActive, true))
      .orderBy(asc(categories.sortOrder), asc(categories.name));
    const catTiles = await Promise.all(
      cats.map(async (c) => {
        const sample = await listProductCards({ categoryId: c.id, limit: 1 });
        return {
          id: c.id,
          name: c.name,
          slug: c.slug,
          description: c.description,
          imageUrl: c.imageUrl || sample[0]?.images[0]?.url || "",
          hasCustomImage: Boolean(c.imageUrl),
        };
      }),
    );

    return { featured, latest, heroProduct, showcase, categories: catTiles };
  }),

  products: publicProcedure
    .input(
      z.object({
        category: z.string().max(140).optional(),
        search: z.string().max(80).optional(),
        sort: z.enum(["destacados", "nuevos", "precio_asc", "precio_desc", "nombre"]).default("destacados"),
        onlyNew: z.boolean().optional(),
      }),
    )
    .query(async ({ input }) => {
      let categoryId: number | undefined;
      if (input.category) {
        const [c] = await db.select().from(categories).where(eq(categories.slug, input.category)).limit(1);
        if (!c || !c.isActive) return { items: [], category: null };
        categoryId = c.id;
        const items = await listProductCards({ categoryId, search: input.search, sort: input.sort, onlyNew: input.onlyNew });
        return { items, category: { name: c.name, slug: c.slug, description: c.description } };
      }
      const items = await listProductCards({ search: input.search, sort: input.sort, onlyNew: input.onlyNew });
      return { items, category: null };
    }),

  product: publicProcedure.input(z.object({ slug: z.string().max(180) })).query(async ({ input }) => {
    const product = await getProductDetail(eq(products.slug, input.slug));
    if (!product) return null;
    const related = (
      await listProductCards({ categoryId: product.categoryId ?? undefined, limit: 8 })
    ).filter((p) => p.id !== product.id);
    const fill =
      related.length >= 3
        ? []
        : (await listProductCards({ limit: 8 })).filter(
            (p) => p.id !== product.id && !related.some((r) => r.id === p.id),
          );
    return { product, related: [...related, ...fill].slice(0, 4) };
  }),

  /** Estado actual (precio, stock) de los artículos guardados en la bolsa. */
  cart: publicProcedure
    .input(z.object({ variantIds: z.array(z.number().int()).max(80) }))
    .query(async ({ input }) => {
      if (input.variantIds.length === 0) return [];
      const rows = await db
        .select({
          variantId: schema.productVariants.id,
          stock: schema.productVariants.stock,
          color: schema.productVariants.color,
          size: schema.productVariants.size,
          productId: products.id,
          name: products.name,
          slug: products.slug,
          price: products.price,
          isActive: products.isActive,
        })
        .from(schema.productVariants)
        .innerJoin(products, eq(products.id, schema.productVariants.productId))
        .where(inArray(schema.productVariants.id, input.variantIds));
      const mine = rows;
      const cards = await listProductCards({ ids: [...new Set(mine.map((m) => m.productId))], includeInactive: true });
      return mine.map((r) => {
        const card = cards.find((c) => c.id === r.productId);
        const img =
          card?.images.find((i) => i.color === r.color) ?? card?.images.find((i) => i.color === "") ?? card?.images[0];
        return { ...r, imageUrl: img?.url ?? "" };
      });
    }),

  page: publicProcedure.input(z.object({ slug: z.string().max(140) })).query(async ({ input }) => {
    const [p] = await db
      .select()
      .from(pages)
      .where(and(eq(pages.slug, input.slug), eq(pages.isPublished, true)))
      .limit(1);
    if (!p) return null;
    return {
      title: p.title,
      slug: p.slug,
      intro: p.intro,
      seoDescription: p.seoDescription,
      blocks: parseJson<Block[]>(p.blocks, []),
    };
  }),

  checkoutOptions: publicProcedure.query(async () => {
    const [ship, pay] = await Promise.all([
      db
        .select()
        .from(shippingMethods)
        .where(eq(shippingMethods.isActive, true))
        .orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.id)),
      db
        .select()
        .from(paymentMethods)
        .where(eq(paymentMethods.isActive, true))
        .orderBy(asc(paymentMethods.sortOrder), asc(paymentMethods.id)),
    ]);
    return {
      shipping: ship.map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        eta: s.eta,
        price: s.price,
        freeOver: s.freeOver,
      })),
      payment: pay.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        requiresProof: p.requiresProof,
      })),
    };
  }),

  coupon: publicProcedure
    .input(z.object({ code: z.string().trim().min(1).max(40), subtotal: z.number().int().min(0) }))
    .mutation(async ({ input, ctx }) => {
      if (!rateLimit(`coupon:${ctx.ip}`, 20, 10 * 60_000)) {
        throw fail("Demasiados intentos. Espera unos minutos.", "TOO_MANY_REQUESTS");
      }
      const c = await resolveCoupon(input.code, input.subtotal);
      if (!c) throw fail("Escribe un código de cupón.");
      return { code: c.code, discount: c.discount, type: c.type, value: c.value };
    }),

  createOrder: publicProcedure.input(checkoutInput).mutation(async ({ input, ctx }) => {
    if (!rateLimit(`order:${ctx.ip}`, 8, 10 * 60_000)) {
      throw fail("Hiciste varios pedidos seguidos. Espera unos minutos e inténtalo de nuevo.", "TOO_MANY_REQUESTS");
    }
    const created = await createOrder(input);
    const data = await loadOrder(eq(orders.id, created.orderId));
    if (data) void sendOrderCreated(data.order, data.items);
    return { token: created.token, number: created.number };
  }),

  order: publicProcedure.input(z.object({ token: z.string().min(20).max(64) })).query(async ({ input }) => {
    const data = await loadOrder(eq(orders.token, input.token));
    return data ? publicOrder(data) : null;
  }),

  /** Buscar un pedido con su número y el correo con el que se hizo. */
  findOrder: publicProcedure
    .input(z.object({ number: z.string().trim().min(3).max(24), email: z.email("Escribe un correo válido.") }))
    .mutation(async ({ input, ctx }) => {
      if (!rateLimit(`find:${ctx.ip}`, 12, 10 * 60_000)) {
        throw fail("Demasiados intentos. Espera unos minutos.", "TOO_MANY_REQUESTS");
      }
      const number = input.number.toUpperCase().replace(/^#/, "");
      const [o] = await db
        .select({ token: orders.token })
        .from(orders)
        .where(
          and(
            eq(orders.number, number.startsWith("GE-") ? number : `GE-${number}`),
            eq(orders.customerEmail, input.email.toLowerCase()),
            ne(orders.token, ""),
          ),
        )
        .limit(1);
      if (!o) throw fail("No encontramos un pedido con ese número y ese correo.", "NOT_FOUND");
      return { token: o.token };
    }),
});
