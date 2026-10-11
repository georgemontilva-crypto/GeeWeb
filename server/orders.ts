import crypto from "node:crypto";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { OrderStatus } from "../shared/types";
import { db, schema, type Tx } from "./db";
import { fail } from "./trpc";
import { getSettings } from "./settings";

const { orders, orderItems, orderEvents, products, productVariants, productImages, coupons, shippingMethods, paymentMethods } =
  schema;

export const checkoutInput = z.object({
  items: z
    .array(z.object({ variantId: z.number().int(), quantity: z.number().int().min(1).max(50) }))
    .min(1)
    .max(60),
  customer: z.object({
    name: z.string().trim().min(3, "Escribe tu nombre completo.").max(160),
    email: z.email("Escribe un correo válido.").max(191),
    phone: z.string().trim().min(6, "Escribe un teléfono de contacto.").max(60),
    document: z.string().trim().max(60).default(""),
    address: z.string().trim().min(4, "Escribe la dirección de entrega.").max(300),
    addressExtra: z.string().trim().max(200).default(""),
    city: z.string().trim().min(2, "Escribe la ciudad.").max(120),
    region: z.string().trim().max(120).default(""),
    postalCode: z.string().trim().max(30).default(""),
    country: z.string().trim().max(80).default(""),
    notes: z.string().trim().max(1000).default(""),
  }),
  shippingMethodId: z.number().int(),
  paymentMethodId: z.number().int(),
  couponCode: z.string().trim().max(40).default(""),
});
export type CheckoutInput = z.infer<typeof checkoutInput>;

/** Valida un cupón contra un subtotal y devuelve el descuento en centavos. */
export async function resolveCoupon(code: string, subtotal: number, tx: Tx | typeof db = db) {
  const clean = code.trim().toUpperCase();
  if (!clean) return null;
  const [c] = await tx.select().from(coupons).where(eq(coupons.code, clean)).limit(1);
  if (!c || !c.isActive) throw fail("Ese cupón no existe o ya no está activo.");
  if (c.expiresAt && c.expiresAt.getTime() < Date.now()) throw fail("Ese cupón ya venció.");
  if (c.maxUses !== null && c.usedCount >= c.maxUses) throw fail("Ese cupón ya alcanzó su límite de usos.");
  if (subtotal < c.minSubtotal) throw fail("Tu compra aún no alcanza el mínimo de este cupón.");
  const discount =
    c.type === "porcentaje" ? Math.round((subtotal * Math.min(100, c.value)) / 100) : Math.min(subtotal, c.value);
  return { id: c.id, code: c.code, type: c.type, value: c.value, discount };
}

export function shippingPrice(method: { price: number; freeOver: number | null }, subtotalAfterDiscount: number) {
  if (method.freeOver !== null && subtotalAfterDiscount >= method.freeOver) return 0;
  return method.price;
}

export async function createOrder(input: CheckoutInput) {
  const settings = await getSettings();

  // Une cantidades si el mismo artículo llega repetido.
  const wanted = new Map<number, number>();
  for (const i of input.items) wanted.set(i.variantId, (wanted.get(i.variantId) ?? 0) + i.quantity);
  const variantIds = [...wanted.keys()];

  const result = await db.transaction(async (tx) => {
    const variants = await tx
      .select()
      .from(productVariants)
      .where(inArray(productVariants.id, variantIds))
      .for("update");
    if (variants.length !== variantIds.length) {
      throw fail("Uno de los productos de tu bolsa ya no está disponible. Revísala e inténtalo de nuevo.");
    }
    const productIds = [...new Set(variants.map((v) => v.productId))];
    const [prods, imgs] = await Promise.all([
      tx.select().from(products).where(inArray(products.id, productIds)),
      tx
        .select()
        .from(productImages)
        .where(inArray(productImages.productId, productIds))
        .orderBy(asc(productImages.sortOrder), asc(productImages.id)),
    ]);

    let subtotal = 0;
    const lines = variants.map((v) => {
      const p = prods.find((x) => x.id === v.productId);
      const quantity = wanted.get(v.id)!;
      if (!p || !p.isActive) throw fail("Uno de los productos de tu bolsa ya no está disponible.");
      const label = [p.name, v.color, v.size].filter(Boolean).join(" · ");
      if (v.stock < quantity) {
        throw fail(
          v.stock === 0
            ? `${label} se agotó. Quítalo de la bolsa para continuar.`
            : `Solo quedan ${v.stock} de ${label}. Ajusta la cantidad para continuar.`,
        );
      }
      subtotal += p.price * quantity;
      const mine = imgs.filter((i) => i.productId === p.id);
      const image = mine.find((i) => i.color === v.color) ?? mine.find((i) => i.color === "") ?? mine[0];
      return { variant: v, product: p, quantity, imageUrl: image?.url ?? "" };
    });

    const [ship] = await tx
      .select()
      .from(shippingMethods)
      .where(and(eq(shippingMethods.id, input.shippingMethodId), eq(shippingMethods.isActive, true)))
      .limit(1);
    if (!ship) throw fail("Elige un método de envío.");
    const [pay] = await tx
      .select()
      .from(paymentMethods)
      .where(and(eq(paymentMethods.id, input.paymentMethodId), eq(paymentMethods.isActive, true)))
      .limit(1);
    if (!pay) throw fail("Elige un método de pago.");

    const coupon = await resolveCoupon(input.couponCode, subtotal, tx);
    const discount = coupon?.discount ?? 0;
    const shippingCost = shippingPrice(ship, subtotal - discount);
    const total = Math.max(0, subtotal - discount) + shippingCost;

    for (const l of lines) {
      await tx
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} - ${l.quantity}` })
        .where(eq(productVariants.id, l.variant.id));
    }
    if (coupon) {
      await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(coupons.id, coupon.id));
    }

    const token = crypto.randomBytes(24).toString("hex");
    const c = input.customer;
    const [ins] = await tx.insert(orders).values({
      number: `tmp-${token.slice(0, 16)}`,
      token,
      status: "pendiente",
      customerName: c.name,
      customerEmail: c.email.toLowerCase(),
      customerPhone: c.phone,
      customerDocument: c.document,
      address: c.address,
      addressExtra: c.addressExtra,
      city: c.city,
      region: c.region,
      postalCode: c.postalCode,
      country: c.country,
      notes: c.notes,
      shippingMethod: ship.name,
      shippingEta: ship.eta,
      paymentMethod: pay.name,
      paymentInstructions: pay.instructions,
      paymentRequiresProof: pay.requiresProof,
      couponCode: coupon?.code ?? "",
      subtotal,
      discount,
      shippingCost,
      total,
      currency: settings.currency,
      adminNotes: "",
    });
    const orderId = ins.insertId;
    const number = `GE-${10000 + orderId}`;
    await tx.update(orders).set({ number }).where(eq(orders.id, orderId));

    await tx.insert(orderItems).values(
      lines.map((l) => ({
        orderId,
        productId: l.product.id,
        variantId: l.variant.id,
        name: l.product.name,
        color: l.variant.color,
        size: l.variant.size,
        imageUrl: l.imageUrl,
        price: l.product.price,
        quantity: l.quantity,
      })),
    );
    await tx.insert(orderEvents).values({ orderId, status: "pendiente", note: "Pedido recibido" });
    return { orderId, token, number };
  });

  return result;
}

export async function loadOrder(where: ReturnType<typeof eq>) {
  const [order] = await db.select().from(orders).where(where).limit(1);
  if (!order) return null;
  const [items, events] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.id)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(asc(orderEvents.id)),
  ]);
  return { order, items, events };
}

/**
 * Cambia el estado de un pedido. Al cancelar devuelve las unidades al
 * inventario; al reactivar un pedido cancelado las vuelve a descontar.
 */
export async function changeOrderStatus(orderId: number, status: OrderStatus, note = "") {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw fail("Ese pedido no existe.", "NOT_FOUND");
    if (order.status === status) return { changed: false };

    const wasCancelled = order.status === "cancelado";
    const willCancel = status === "cancelado";
    if (wasCancelled !== willCancel) {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      for (const i of items) {
        if (!i.variantId) continue;
        await tx
          .update(productVariants)
          .set({
            stock: willCancel
              ? sql`${productVariants.stock} + ${i.quantity}`
              : sql`greatest(0, ${productVariants.stock} - ${i.quantity})`,
          })
          .where(eq(productVariants.id, i.variantId));
      }
    }
    await tx.update(orders).set({ status }).where(eq(orders.id, orderId));
    await tx.insert(orderEvents).values({ orderId, status, note });
    return { changed: true };
  });
}
