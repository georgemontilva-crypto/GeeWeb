import { eq, inArray, notLike, sql } from "drizzle-orm";
import { slugify } from "../shared/types";
import { db, schema } from "./db";
import { getSettings, saveSettings } from "./settings";

/*
 * Catálogo de ejemplo con fotos reales de Unsplash (licencia Unsplash:
 * uso libre, comercial incluido, sin atribución obligatoria). Las fotos
 * se cargan directo desde images.unsplash.com, no se guardan en R2.
 */

const photo = (id: string, w = 1200, h = 1500) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const DEMO_HERO = [photo("1603189343302-e603f7add05a", 1600, 2000), photo("1490481651871-ab68de25d43d", 1600, 2000)];

const ROPA = ["XS", "S", "M", "L", "XL"];
const CINTURA = ["28", "30", "32", "34", "36"];

const CATEGORIES = [
  { name: "Camisetas", description: "Algodón pesado, cuello firme y cortes que no se deforman." },
  { name: "Buzos y hoodies", description: "Felpa perchada por dentro, lisa por fuera." },
  { name: "Camisas y chaquetas", description: "Las capas que terminan el conjunto." },
  { name: "Pantalones", description: "Rectos, cómodos y con caída." },
  { name: "Vestidos", description: "Una sola pieza, listo." },
  { name: "Accesorios", description: "Lo que acompaña todos los días." },
];

const KNIT = "Algodón peinado 100 %\nTela prelavada: no encoge\nCosturas reforzadas en hombros y cuello\nLavar con agua fría, secar a la sombra";

type DemoColor = { name: string; hex: string; photos: string[] };
type DemoProduct = {
  code: string;
  name: string;
  tagline: string;
  category: string;
  price: number;
  compareAt?: number;
  sizes: string[];
  colors: DemoColor[];
  featured?: boolean;
  isNew?: boolean;
  description: string;
  details: string;
};

const PRODUCTS: DemoProduct[] = [
  {
    code: "HOOD",
    name: "Hoodie Peso Pesado",
    tagline: "480 g de felpa. Se nota al ponértelo.",
    category: "Buzos y hoodies",
    price: 8900,
    sizes: ROPA,
    colors: [{ name: "Gris", hex: "#9b9b9d", photos: ["1556821840-3a63f95609a7", "1564557287817-3785e38ec1f5"] }],
    featured: true,
    isNew: true,
    description:
      "Nuestro hoodie más denso. Felpa de 480 g perchada por dentro, capucha de doble capa que mantiene la forma y un bolsillo canguro con refuerzo en las esquinas. Corte recto y un poco amplio.",
    details: "Felpa de algodón 480 g/m²\nCapucha de doble capa\nPuños y cintura en rib 2×2\nLavar del revés con agua fría",
  },
  {
    code: "CUERO",
    name: "Chaqueta de Cuero",
    tagline: "Cuero liso, cierre metálico, corte al cuerpo.",
    category: "Camisas y chaquetas",
    price: 24900,
    sizes: ROPA,
    colors: [{ name: "Negro", hex: "#141414", photos: ["1512068549487-5e79d74c7fc3", "1553591589-2e96ef7eca65"] }],
    featured: true,
    isNew: true,
    description: "Chaqueta de cuero con cierre asimétrico, solapas con broche y forro liso. Se suaviza con el uso y gana carácter con los años.",
    details: "Cuero bovino\nForro de viscosa\nCierres metálicos\nLimpieza especializada",
  },
  {
    code: "TEE",
    name: "Camiseta Esencial",
    tagline: "La que terminas usando todos los días.",
    category: "Camisetas",
    price: 3200,
    sizes: ROPA,
    colors: [
      { name: "Blanco", hex: "#f7f7f5", photos: ["1521572163474-6864f9cf17ab", "1581655353564-df123a1eb820"] },
      { name: "Negro", hex: "#141414", photos: ["1583743814966-8936f5b7be1a"] },
    ],
    featured: true,
    description:
      "Algodón peinado de 220 g con el peso justo: cae bien, no se transparenta y aguanta lavadas sin torcerse. Cuello en rib de 2 cm que no se da de sí.",
    details: KNIT,
  },
  {
    code: "BOMBER",
    name: "Chaqueta Bomber",
    tagline: "Liviana, forrada y con cierre metálico.",
    category: "Camisas y chaquetas",
    price: 12900,
    compareAt: 14900,
    sizes: ROPA,
    colors: [{ name: "Café", hex: "#7a5a3c", photos: ["1591047139829-d91aecb6caea"] }],
    featured: true,
    description: "Bomber de corte limpio con forro liso. Cuello, puños y cintura en rib; dos bolsillos laterales y uno interior.",
    details: "Exterior: sarga de algodón\nForro: poliéster reciclado\nCierre metálico\nLavar en ciclo suave",
  },
  {
    code: "OXFORD",
    name: "Camisa Oxford",
    tagline: "Abotonada, lavada, lista.",
    category: "Camisas y chaquetas",
    price: 5800,
    sizes: ROPA,
    colors: [
      { name: "Azul", hex: "#9fb7d8", photos: ["1602810316693-3667c854239a"] },
      { name: "Blanco", hex: "#f7f7f5", photos: ["1602810318383-e386cc2a3ccf"] },
    ],
    featured: true,
    description: "Oxford de algodón lavado para que se sienta suave desde el primer día. Cuello suave y bajo curvo para usarla por fuera.",
    details: "Oxford 100 % algodón\nBotones de nácar\nPlanchar a temperatura media",
  },
  {
    code: "LARGA",
    name: "Camiseta Manga Larga",
    tagline: "El mismo algodón, para cuando refresca.",
    category: "Camisetas",
    price: 4200,
    sizes: ROPA,
    colors: [
      { name: "Blanco", hex: "#f7f7f5", photos: ["1620799140408-edc6dcb6d633"] },
      { name: "Negro", hex: "#141414", photos: ["1618354691551-44de113f0164"] },
    ],
    isNew: true,
    description: "Manga larga en algodón peinado de 220 g, puños en rib y corte recto.",
    details: KNIT,
  },
  {
    code: "JEAN",
    name: "Chaqueta de Jean",
    tagline: "Denim rígido que se amolda a ti.",
    category: "Camisas y chaquetas",
    price: 9800,
    sizes: ROPA,
    colors: [{ name: "Índigo", hex: "#3e5a85", photos: ["1611312449408-fcece27cdbb7", "1555583743-991174c11425"] }],
    description: "Chaqueta trucker en denim de 13 oz, botones metálicos y bolsillos al pecho con tapa.",
    details: "Denim 100 % algodón, 13 oz\nBotones metálicos\nLavar del revés",
  },
  {
    code: "SASTRE",
    name: "Pantalón Sastre",
    tagline: "Pierna recta, pinza al frente.",
    category: "Pantalones",
    price: 7800,
    sizes: CINTURA,
    colors: [{ name: "Negro", hex: "#141414", photos: ["1780566036313-1f12261769e8", "1780566036289-2ee30453f560"] }],
    isNew: true,
    description: "Pantalón de sastre en lana fría con pinza al frente y pierna recta. Funciona con traje o con camiseta.",
    details: "Lana fría con elastano\nPretina con presillas\nLimpieza en seco",
  },
  {
    code: "VEST",
    name: "Vestido Camisero",
    tagline: "Una pieza y sales.",
    category: "Vestidos",
    price: 9400,
    sizes: ROPA,
    colors: [{ name: "Blanco y negro", hex: "#d9d9d9", photos: ["1601597565151-70c4020dc0e1"] }],
    description: "Vestido de manga larga con caída fluida. Funciona con tenis en el día y con botas en la noche.",
    details: "Viscosa 100 %\nLargo: media pierna\nLavar en ciclo delicado",
  },
  {
    code: "GORRA",
    name: "Gorra Seis Paneles",
    tagline: "Sarga lavada, ajuste metálico.",
    category: "Accesorios",
    price: 2800,
    sizes: [],
    colors: [{ name: "Blanco", hex: "#f7f7f5", photos: ["1691256676359-20e5c6d4bc92"] }],
    description: "Gorra de seis paneles en sarga lavada. Visera curva y cierre ajustable.",
    details: "Sarga 100 % algodón\nTalla única ajustable",
  },
  {
    code: "TOTE",
    name: "Tote de Lona",
    tagline: "Cabe el portátil y el mercado.",
    category: "Accesorios",
    price: 2400,
    sizes: [],
    colors: [{ name: "Crudo", hex: "#e6dccb", photos: ["1544816155-12df9643f363", "1548863227-3af567fc3b27"] }],
    description: "Lona gruesa de 12 oz con asas largas para llevar al hombro y un bolsillo interior.",
    details: "Lona de algodón 12 oz\n38 × 42 cm\nBolsillo interior",
  },
];

async function ensureCategories() {
  const ids = new Map<string, number>();
  const existing = await db.select().from(schema.categories);
  for (const [i, c] of CATEGORIES.entries()) {
    const hit = existing.find((e) => e.slug === slugify(c.name));
    if (hit) {
      ids.set(c.name, hit.id);
      continue;
    }
    const [ins] = await db
      .insert(schema.categories)
      .values({ name: c.name, slug: slugify(c.name), description: c.description, sortOrder: i + 1 });
    ids.set(c.name, ins.insertId);
  }
  return ids;
}

export async function insertDemoCatalog() {
  const catIds = await ensureCategories();
  let featuredOrder = 0;
  for (const [pi, p] of PRODUCTS.entries()) {
    const [ins] = await db.insert(schema.products).values({
      name: p.name,
      slug: slugify(p.name),
      tagline: p.tagline,
      description: p.description,
      details: p.details,
      price: p.price,
      compareAtPrice: p.compareAt ?? null,
      categoryId: catIds.get(p.category) ?? null,
      colors: JSON.stringify(p.colors.map((c) => ({ name: c.name, hex: c.hex }))),
      sizes: JSON.stringify(p.sizes),
      isFeatured: Boolean(p.featured),
      featuredOrder: p.featured ? ++featuredOrder : 0,
      isNew: Boolean(p.isNew),
    });
    const productId = ins.insertId;

    let order = 0;
    await db.insert(schema.productImages).values(
      p.colors.flatMap((c) => c.photos.map((id) => ({ productId, url: photo(id), color: c.name, sortOrder: order++ }))),
    );

    const sizes = p.sizes.length ? p.sizes : [""];
    await db.insert(schema.productVariants).values(
      p.colors.flatMap((c, ci) =>
        sizes.map((size, si) => {
          // Existencias variadas, con alguna talla agotada para ver ese estado.
          const n = (pi * 7 + ci * 5 + si * 3) % 13;
          return {
            productId,
            color: c.name,
            size,
            stock: n === 4 ? 0 : n + 2,
            sku: [p.code, c.name, size].filter(Boolean).join("-").toUpperCase().replace(/\s+/g, ""),
          };
        }),
      ),
    );
  }
  console.log(`✓ Catálogo de ejemplo creado: ${PRODUCTS.length} productos con fotos.`);
}

/**
 * Tiendas creadas con la versión anterior tienen prendas dibujadas (/demo/*.svg).
 * Si todas las fotos siguen siendo esas, se cambia el catálogo por el de fotos
 * reales. Si ya subieron algún producto propio, no se toca nada.
 */
export async function refreshDemoCatalog() {
  const FLAG = "demo-photos-v1";
  const [done] = await db.select().from(schema.settings).where(eq(schema.settings.key, FLAG)).limit(1);
  if (done) return;

  const [drawn] = await db
    .select({ n: sql<number>`cast(count(*) as signed)` })
    .from(schema.productImages)
    .where(sql`${schema.productImages.url} like '/demo/%'`);
  const [own] = await db
    .select({ n: sql<number>`cast(count(*) as signed)` })
    .from(schema.productImages)
    .where(notLike(schema.productImages.url, "/demo/%"));

  if (Number(drawn?.n ?? 0) > 0 && Number(own?.n ?? 0) === 0) {
    const ids = (await db.select({ id: schema.products.id }).from(schema.products)).map((p) => p.id);
    if (ids.length) {
      await db.delete(schema.productImages).where(inArray(schema.productImages.productId, ids));
      await db.delete(schema.productVariants).where(inArray(schema.productVariants.productId, ids));
      await db.delete(schema.products).where(inArray(schema.products.id, ids));
    }
    await insertDemoCatalog();

    const s = await getSettings();
    if (!s.home.heroImageUrl) {
      await saveSettings({
        ...s,
        home: { ...s.home, heroImageUrl: DEMO_HERO[0]!, heroImage2Url: DEMO_HERO[1]!, heroProductId: null, showcaseProductId: null },
      });
    }
  }
  await db.insert(schema.settings).values({ key: FLAG, value: new Date().toISOString() });
}
