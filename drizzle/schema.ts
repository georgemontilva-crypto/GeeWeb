import {
  mysqlTable,
  int,
  bigint,
  varchar,
  text,
  boolean,
  timestamp,
  mediumtext,
  customType,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

const mediumblob = customType<{ data: Buffer }>({
  dataType: () => "mediumblob",
});

/** Dinero en centavos. */
const money = (name: string) => bigint(name, { mode: "number" });

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  email: varchar("email", { length: 191 }).notNull().unique(),
  name: varchar("name", { length: 120 }).notNull().default(""),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const settings = mysqlTable("settings", {
  key: varchar("key", { length: 64 }).primaryKey(),
  value: mediumtext("value").notNull(),
});

export const categories = mysqlTable(
  "categories",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    description: varchar("description", { length: 400 }).notNull().default(""),
    imageUrl: varchar("image_url", { length: 600 }).notNull().default(""),
    sortOrder: int("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("categories_slug_idx").on(t.slug)],
);

export const products = mysqlTable(
  "products",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    tagline: varchar("tagline", { length: 200 }).notNull().default(""),
    description: text("description").notNull(),
    details: text("details").notNull(),
    price: money("price").notNull(),
    compareAtPrice: money("compare_at_price"),
    categoryId: int("category_id"),
    /** JSON: [{ name, hex }] */
    colors: text("colors").notNull(),
    /** JSON: ["S","M","L"] */
    sizes: text("sizes").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    featuredOrder: int("featured_order").notNull().default(0),
    isNew: boolean("is_new").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("products_slug_idx").on(t.slug),
    index("products_category_idx").on(t.categoryId),
  ],
);

export const productImages = mysqlTable(
  "product_images",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("product_id").notNull(),
    url: varchar("url", { length: 600 }).notNull(),
    /** Color al que pertenece la foto ("" = todas). */
    color: varchar("color", { length: 40 }).notNull().default(""),
    sortOrder: int("sort_order").notNull().default(0),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const productVariants = mysqlTable(
  "product_variants",
  {
    id: int("id").autoincrement().primaryKey(),
    productId: int("product_id").notNull(),
    color: varchar("color", { length: 40 }).notNull().default(""),
    size: varchar("size", { length: 40 }).notNull().default(""),
    sku: varchar("sku", { length: 80 }).notNull().default(""),
    stock: int("stock").notNull().default(0),
  },
  (t) => [index("product_variants_product_idx").on(t.productId)],
);

export const shippingMethods = mysqlTable("shipping_methods", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 300 }).notNull().default(""),
  eta: varchar("eta", { length: 80 }).notNull().default(""),
  price: money("price").notNull().default(0),
  /** Gratis desde este subtotal (null = nunca gratis). */
  freeOver: money("free_over"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
});

export const paymentMethods = mysqlTable("payment_methods", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 300 }).notNull().default(""),
  /** Datos que ve el cliente al terminar el pedido (cuenta, alias, etc.). */
  instructions: text("instructions").notNull(),
  requiresProof: boolean("requires_proof").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: int("sort_order").notNull().default(0),
});

export const coupons = mysqlTable(
  "coupons",
  {
    id: int("id").autoincrement().primaryKey(),
    code: varchar("code", { length: 40 }).notNull(),
    type: varchar("type", { length: 16 }).notNull().default("porcentaje"),
    /** porcentaje: 1-100 · fijo: centavos */
    value: money("value").notNull(),
    minSubtotal: money("min_subtotal").notNull().default(0),
    maxUses: int("max_uses"),
    usedCount: int("used_count").notNull().default(0),
    expiresAt: timestamp("expires_at"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("coupons_code_idx").on(t.code)],
);

export const orders = mysqlTable(
  "orders",
  {
    id: int("id").autoincrement().primaryKey(),
    number: varchar("number", { length: 24 }).notNull(),
    /** Llave privada del enlace de seguimiento. */
    token: varchar("token", { length: 64 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("pendiente"),

    customerName: varchar("customer_name", { length: 160 }).notNull(),
    customerEmail: varchar("customer_email", { length: 191 }).notNull(),
    customerPhone: varchar("customer_phone", { length: 60 }).notNull().default(""),
    customerDocument: varchar("customer_document", { length: 60 }).notNull().default(""),

    address: varchar("address", { length: 300 }).notNull().default(""),
    addressExtra: varchar("address_extra", { length: 200 }).notNull().default(""),
    city: varchar("city", { length: 120 }).notNull().default(""),
    region: varchar("region", { length: 120 }).notNull().default(""),
    postalCode: varchar("postal_code", { length: 30 }).notNull().default(""),
    country: varchar("country", { length: 80 }).notNull().default(""),
    notes: text("notes").notNull(),

    shippingMethod: varchar("shipping_method", { length: 120 }).notNull().default(""),
    shippingEta: varchar("shipping_eta", { length: 80 }).notNull().default(""),
    paymentMethod: varchar("payment_method", { length: 120 }).notNull().default(""),
    paymentInstructions: text("payment_instructions").notNull(),
    paymentRequiresProof: boolean("payment_requires_proof").notNull().default(false),
    paymentProofUrl: varchar("payment_proof_url", { length: 600 }).notNull().default(""),

    couponCode: varchar("coupon_code", { length: 40 }).notNull().default(""),
    subtotal: money("subtotal").notNull(),
    discount: money("discount").notNull().default(0),
    shippingCost: money("shipping_cost").notNull().default(0),
    total: money("total").notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("USD"),

    trackingNumber: varchar("tracking_number", { length: 120 }).notNull().default(""),
    trackingUrl: varchar("tracking_url", { length: 400 }).notNull().default(""),
    adminNotes: text("admin_notes").notNull(),

    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [
    uniqueIndex("orders_number_idx").on(t.number),
    uniqueIndex("orders_token_idx").on(t.token),
    index("orders_status_idx").on(t.status),
    index("orders_email_idx").on(t.customerEmail),
  ],
);

export const orderItems = mysqlTable(
  "order_items",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("order_id").notNull(),
    productId: int("product_id"),
    variantId: int("variant_id"),
    name: varchar("name", { length: 160 }).notNull(),
    color: varchar("color", { length: 40 }).notNull().default(""),
    size: varchar("size", { length: 40 }).notNull().default(""),
    imageUrl: varchar("image_url", { length: 600 }).notNull().default(""),
    price: money("price").notNull(),
    quantity: int("quantity").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderEvents = mysqlTable(
  "order_events",
  {
    id: int("id").autoincrement().primaryKey(),
    orderId: int("order_id").notNull(),
    status: varchar("status", { length: 20 }).notNull(),
    note: varchar("note", { length: 400 }).notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const pages = mysqlTable(
  "pages",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 140 }).notNull(),
    intro: varchar("intro", { length: 400 }).notNull().default(""),
    /** JSON: Block[] */
    blocks: mediumtext("blocks").notNull(),
    showInNav: boolean("show_in_nav").notNull().default(false),
    showInFooter: boolean("show_in_footer").notNull().default(true),
    isPublished: boolean("is_published").notNull().default(true),
    sortOrder: int("sort_order").notNull().default(0),
    seoDescription: varchar("seo_description", { length: 300 }).notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow().onUpdateNow(),
  },
  (t) => [uniqueIndex("pages_slug_idx").on(t.slug)],
);

/** Respaldo de imágenes cuando no hay Cloudflare R2 configurado. */
export const media = mysqlTable("media", {
  id: varchar("id", { length: 40 }).primaryKey(),
  mime: varchar("mime", { length: 80 }).notNull(),
  data: mediumblob("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
