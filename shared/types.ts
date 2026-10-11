import { z } from "zod";

/* ───────────── Pedidos ───────────── */

export const ORDER_STATUSES = [
  "pendiente",
  "pagado",
  "preparando",
  "enviado",
  "entregado",
  "cancelado",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pendiente: "Pendiente de pago",
  pagado: "Pago confirmado",
  preparando: "En preparación",
  enviado: "Enviado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/** Pasos que ve el cliente en el seguimiento (cancelado va aparte). */
export const ORDER_TRACK_STEPS: OrderStatus[] = [
  "pendiente",
  "pagado",
  "preparando",
  "enviado",
  "entregado",
];

/* ───────────── Producto ───────────── */

export const colorSchema = z.object({
  name: z.string().min(1).max(40),
  hex: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
export type ProductColor = z.infer<typeof colorSchema>;

/* ───────────── Bloques de las subpáginas ───────────── */

export const blockSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("texto"),
    title: z.string().max(200).default(""),
    body: z.string().max(20000).default(""),
    align: z.enum(["izquierda", "centro"]).default("izquierda"),
  }),
  z.object({
    type: z.literal("imagen"),
    url: z.string().max(600).default(""),
    caption: z.string().max(300).default(""),
  }),
  z.object({
    type: z.literal("imagen_texto"),
    url: z.string().max(600).default(""),
    title: z.string().max(200).default(""),
    body: z.string().max(20000).default(""),
    imageSide: z.enum(["izquierda", "derecha"]).default("izquierda"),
  }),
  z.object({
    type: z.literal("preguntas"),
    title: z.string().max(200).default(""),
    items: z
      .array(z.object({ q: z.string().max(300), a: z.string().max(5000) }))
      .max(60)
      .default([]),
  }),
  z.object({
    type: z.literal("boton"),
    title: z.string().max(200).default(""),
    body: z.string().max(2000).default(""),
    label: z.string().max(60).default(""),
    href: z.string().max(400).default(""),
  }),
]);
export type Block = z.infer<typeof blockSchema>;
export type BlockType = Block["type"];

export const BLOCK_LABEL: Record<BlockType, string> = {
  texto: "Texto",
  imagen: "Imagen",
  imagen_texto: "Imagen con texto",
  preguntas: "Preguntas frecuentes",
  boton: "Llamado con botón",
};

/* ───────────── Ajustes de la tienda ───────────── */

export const settingsSchema = z.object({
  storeName: z.string().min(1).max(60),
  tagline: z.string().max(160),
  logoUrl: z.string().max(600),
  logoDarkUrl: z.string().max(600),
  faviconUrl: z.string().max(600),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  announcement: z.string().max(200),
  announcementHref: z.string().max(400),

  currency: z.string().length(3),
  locale: z.string().min(2).max(10),

  email: z.string().max(160),
  phone: z.string().max(60),
  whatsapp: z.string().max(40),
  address: z.string().max(240),
  instagram: z.string().max(240),
  tiktok: z.string().max(240),
  facebook: z.string().max(240),

  notifyEmail: z.string().max(160),
  lowStock: z.number().int().min(0).max(999),

  home: z.object({
    heroTitle: z.string().max(80),
    heroSubtitle: z.string().max(200),
    heroImageUrl: z.string().max(600),
    heroProductId: z.number().int().nullable(),
    heroCtaLabel: z.string().max(40),
    heroCtaHref: z.string().max(400),
    showcaseProductId: z.number().int().nullable(),
    showcaseTitle: z.string().max(120),
    showcaseText: z.string().max(400),
    storyTitle: z.string().max(160),
    storyText: z.string().max(600),
    perks: z
      .array(z.object({ title: z.string().max(60), text: z.string().max(200) }))
      .max(4),
  }),
});
export type Settings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: Settings = {
  storeName: "Gee",
  tagline: "Ropa esencial, hecha para durar.",
  logoUrl: "",
  logoDarkUrl: "",
  faviconUrl: "",
  accent: "#1d1d1f",
  announcement: "Envío gratis en compras desde $120",
  announcementHref: "/tienda",

  currency: "USD",
  locale: "es-CO",

  email: "",
  phone: "",
  whatsapp: "",
  address: "",
  instagram: "",
  tiktok: "",
  facebook: "",

  notifyEmail: "",
  lowStock: 3,

  home: {
    heroTitle: "Menos ruido. Mejor ropa.",
    heroSubtitle:
      "Piezas esenciales en algodón pesado, cortes limpios y colores que combinan entre sí.",
    heroImageUrl: "",
    heroProductId: null,
    heroCtaLabel: "Ver la colección",
    heroCtaHref: "/tienda",
    showcaseProductId: null,
    showcaseTitle: "Un corte. Todos tus colores.",
    showcaseText:
      "Elige el tono y míralo cambiar. El mismo patrón, la misma caída, en la paleta completa de la temporada.",
    storyTitle: "Diseñamos poco para diseñarlo bien.",
    storyText:
      "Cada prenda pasa meses en pruebas de tela, lavado y caída antes de llegar a la tienda. Sacamos pocas piezas por temporada y las hacemos para que sigan en tu clóset dentro de varios años.",
    perks: [
      { title: "Envío rápido", text: "Despachamos en 24 horas hábiles." },
      { title: "Cambios sin drama", text: "Tienes 30 días para cambiar talla o color." },
      { title: "Pago seguro", text: "Confirmamos tu pago antes de despachar." },
    ],
  },
};

/* ───────────── Dinero ───────────── */

/** Los precios se guardan en centavos (enteros). */
export function formatMoney(cents: number, currency = "USD", locale = "es-CO") {
  const noDecimals = ["COP", "CLP", "PYG", "JPY", "VES"].includes(currency);
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: noDecimals ? 0 : cents % 100 === 0 ? 0 : 2,
      maximumFractionDigits: noDecimals ? 0 : 2,
    }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}

export function slugify(input: string) {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

/** Rutas que usa la tienda y no pueden ser el slug de una subpágina. */
export const RESERVED_SLUGS = [
  "admin",
  "api",
  "tienda",
  "producto",
  "categoria",
  "carrito",
  "checkout",
  "pedido",
  "seguimiento",
  "media",
  "demo",
  "assets",
];
