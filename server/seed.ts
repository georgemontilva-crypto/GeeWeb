import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { DEFAULT_SETTINGS, slugify, type Block, type ProductColor } from "../shared/types";
import { db, schema } from "./db";
import { env } from "./env";
import { saveSettings } from "./settings";

const C: Record<string, ProductColor> = {
  negro: { name: "Negro", hex: "#1c1c1e" },
  blanco: { name: "Blanco", hex: "#fbfbfb" },
  hueso: { name: "Hueso", hex: "#ece6da" },
  gris: { name: "Gris", hex: "#a5a7ab" },
  arena: { name: "Arena", hex: "#cdbb9f" },
  oliva: { name: "Oliva", hex: "#6f7658" },
  noche: { name: "Azul noche", hex: "#26314a" },
  cobalto: { name: "Cobalto", hex: "#2a4fd6" },
  vino: { name: "Vino", hex: "#6b2836" },
  cielo: { name: "Cielo", hex: "#b3c8e2" },
  lila: { name: "Lila", hex: "#b9aadb" },
  grafito: { name: "Grafito", hex: "#4a4b50" },
};

const ROPA = ["XS", "S", "M", "L", "XL"];
const CINTURA = ["28", "30", "32", "34", "36"];

type DemoProduct = {
  file: string;
  name: string;
  tagline: string;
  category: string;
  price: number;
  compareAt?: number;
  colors: string[];
  sizes: string[];
  featured?: boolean;
  isNew?: boolean;
  description: string;
  details: string;
};

const CATEGORIES = [
  { name: "Camisetas", description: "Algodón pesado, cuello firme y cortes que no se deforman." },
  { name: "Buzos y hoodies", description: "Felpa perchada por dentro, lisa por fuera." },
  { name: "Camisas y chaquetas", description: "Las capas que terminan el conjunto." },
  { name: "Pantalones", description: "Rectos, cómodos y con caída." },
  { name: "Vestidos", description: "Una sola pieza, listo." },
  { name: "Accesorios", description: "Lo que acompaña todos los días." },
];

const DETAILS_KNIT =
  "Algodón peinado 100 %\nTela prelavada: no encoge\nCosturas reforzadas en hombros y cuello\nLavar con agua fría, secar a la sombra";

const PRODUCTS: DemoProduct[] = [
  {
    file: "hoodie",
    name: "Hoodie Peso Pesado",
    tagline: "480 g de felpa. Se nota al ponértelo.",
    category: "Buzos y hoodies",
    price: 8900,
    colors: ["cobalto", "negro", "gris", "hueso"],
    sizes: ROPA,
    featured: true,
    isNew: true,
    description:
      "Nuestro hoodie más denso. Felpa de 480 g perchada por dentro, capucha de doble capa que mantiene la forma y un bolsillo canguro con refuerzo en las esquinas. El corte es recto y un poco amplio, pensado para llevarlo solo o encima de una camiseta.",
    details: "Felpa de algodón 480 g/m²\nCapucha de doble capa con cordón plano\nPuños y cintura en rib 2×2\nCorte recto, hombro caído\nLavar del revés con agua fría",
  },
  {
    file: "camiseta",
    name: "Camiseta Esencial",
    tagline: "La que terminas usando todos los días.",
    category: "Camisetas",
    price: 3200,
    colors: ["negro", "blanco", "hueso", "cobalto", "oliva"],
    sizes: ROPA,
    featured: true,
    description:
      "Algodón peinado de 220 g con el peso justo: cae bien, no se transparenta y aguanta lavadas sin torcerse. Cuello en rib de 2 cm que no se da de sí.",
    details: DETAILS_KNIT,
  },
  {
    file: "bomber",
    name: "Chaqueta Bomber",
    tagline: "Liviana, forrada y con cierre metálico.",
    category: "Camisas y chaquetas",
    price: 12900,
    compareAt: 14900,
    colors: ["oliva", "negro", "noche"],
    sizes: ROPA,
    featured: true,
    isNew: true,
    description:
      "Una bomber de corte limpio en sarga de algodón con forro liso. Cuello, puños y cintura en rib; dos bolsillos laterales y uno interior. Ideal para entretiempo.",
    details: "Exterior: sarga de algodón\nForro: poliéster reciclado\nCierre metálico de doble carro\nDos bolsillos laterales y uno interior\nLavar en ciclo suave",
  },
  {
    file: "oversize",
    name: "Camiseta Oversize",
    tagline: "Hombro caído, manga al codo.",
    category: "Camisetas",
    price: 3800,
    colors: ["lila", "hueso", "negro", "grafito"],
    sizes: ROPA,
    featured: true,
    isNew: true,
    description:
      "El mismo algodón de la Esencial en un patrón amplio: hombro caído, manga hasta el codo y largo recortado para que no se vea como una talla más grande.",
    details: DETAILS_KNIT,
  },
  {
    file: "pantalon",
    name: "Pantalón Recto",
    tagline: "Pierna recta, cintura con cordón.",
    category: "Pantalones",
    price: 6800,
    colors: ["arena", "negro", "oliva"],
    sizes: CINTURA,
    featured: true,
    description:
      "Sarga suave con un toque de elastano. Cintura elástica con cordón, pierna recta y bota sin puño. Se viste igual con tenis que con zapatos.",
    details: "Sarga 97 % algodón, 3 % elastano\nCintura elástica con cordón\nBolsillos laterales y uno trasero\nLargo estándar 78 cm de entrepierna",
  },
  {
    file: "buzo",
    name: "Buzo Cuello Redondo",
    tagline: "El clásico, sin logos.",
    category: "Buzos y hoodies",
    price: 7400,
    colors: ["gris", "noche", "arena"],
    sizes: ROPA,
    description:
      "Felpa de 400 g con el triángulo de refuerzo en el cuello, como los de siempre. Corte regular, puños firmes y un interior perchado que abriga sin pesar.",
    details: "Felpa de algodón 400 g/m²\nRefuerzo en V en el cuello\nPuños y cintura en rib\nLavar del revés con agua fría",
  },
  {
    file: "camisa",
    name: "Camisa Oxford",
    tagline: "Abotonada, lavada, lista.",
    category: "Camisas y chaquetas",
    price: 5800,
    colors: ["cielo", "blanco", "hueso"],
    sizes: ROPA,
    description:
      "Oxford de algodón lavado para que se sienta suave desde el primer día. Cuello suave, bolsillo al pecho y bajo curvo para usarla por fuera.",
    details: "Oxford 100 % algodón\nBotones de nácar reciclado\nBolsillo al pecho\nPlanchar a temperatura media",
  },
  {
    file: "vestido",
    name: "Vestido Midi",
    tagline: "Una pieza y sales.",
    category: "Vestidos",
    price: 8400,
    colors: ["vino", "negro", "hueso"],
    sizes: ROPA,
    isNew: true,
    description:
      "Vestido sin mangas en punto con cuerpo, corte en la cintura y falda con vuelo que llega a media pierna. Funciona con tenis en el día y con botas en la noche.",
    details: "Punto 95 % viscosa, 5 % elastano\nCorte en cintura, falda en A\nLargo: media pierna\nLavar en ciclo delicado",
  },
  {
    file: "short",
    name: "Short Diario",
    tagline: "De la casa a la calle.",
    category: "Pantalones",
    price: 4200,
    colors: ["negro", "arena", "gris"],
    sizes: ROPA,
    description:
      "Short en felpa liviana con cintura elástica y cordón. Largo arriba de la rodilla y bolsillos profundos.",
    details: "Felpa liviana 280 g/m²\nCintura elástica con cordón\nBolsillos laterales\nTiro de 18 cm",
  },
  {
    file: "gorra",
    name: "Gorra Seis Paneles",
    tagline: "Sarga lavada, ajuste metálico.",
    category: "Accesorios",
    price: 2800,
    colors: ["cobalto", "negro", "hueso"],
    sizes: [],
    description: "Gorra de seis paneles sin estructura, en sarga lavada. Visera curva y cierre metálico ajustable.",
    details: "Sarga 100 % algodón\nTalla única ajustable\nCierre metálico",
  },
  {
    file: "tote",
    name: "Tote de Lona",
    tagline: "Cabe el portátil y el mercado.",
    category: "Accesorios",
    price: 2400,
    colors: ["hueso", "negro"],
    sizes: [],
    description:
      "Lona gruesa de 12 oz con asas largas para llevar al hombro y un bolsillo interior para llaves y celular.",
    details: "Lona de algodón 12 oz\n38 × 42 cm, fuelle de 10 cm\nBolsillo interior",
  },
];

const text = (title: string, body: string): Block => ({ type: "texto", title, body, align: "izquierda" });

const PAGES: { title: string; intro: string; nav: boolean; blocks: Block[] }[] = [
  {
    title: "Nosotros",
    intro: "Hacemos pocas prendas y las hacemos bien.",
    nav: true,
    blocks: [
      text(
        "Por qué existimos",
        "Empezamos porque no encontrábamos básicos que duraran. Camisetas que no se torcieran a la tercera lavada, buzos que mantuvieran el color, pantalones que no perdieran la forma.\n\nHoy diseñamos una colección corta cada temporada. Cada pieza pasa por pruebas de tela, lavado y caída antes de llegar a la tienda.",
      ),
      text(
        "Cómo trabajamos",
        "Producimos en lotes pequeños con talleres que conocemos por nombre. Cuando algo se agota, lo volvemos a hacer solo si de verdad vale la pena.",
      ),
      { type: "boton", title: "Mira lo que hay esta temporada", body: "", label: "Ver la colección", href: "/tienda" },
    ],
  },
  {
    title: "Envíos y cambios",
    intro: "Cuánto tarda, cuánto cuesta y qué hacer si no te quedó.",
    nav: false,
    blocks: [
      text(
        "Envíos",
        "Despachamos en 24 horas hábiles después de confirmar tu pago. Te escribimos por correo con el número de guía apenas el paquete sale.\n\nLos tiempos y costos de cada método aparecen antes de pagar.",
      ),
      text(
        "Cambios",
        "Tienes 30 días desde que recibes tu pedido para cambiar talla o color. La prenda debe estar sin uso y con sus etiquetas.\n\nEscríbenos con tu número de pedido y te indicamos cómo enviarla.",
      ),
      text(
        "Devoluciones",
        "Si prefieres el reembolso, lo hacemos por el mismo medio de pago en un plazo de 5 días hábiles después de recibir la prenda.",
      ),
    ],
  },
  {
    title: "Guía de tallas",
    intro: "Medidas de la prenda extendida sobre una superficie plana.",
    nav: false,
    blocks: [
      text(
        "Camisetas y buzos",
        "XS: pecho 48 cm, largo 66 cm\nS: pecho 51 cm, largo 68 cm\nM: pecho 54 cm, largo 70 cm\nL: pecho 57 cm, largo 72 cm\nXL: pecho 60 cm, largo 74 cm",
      ),
      text(
        "Pantalones",
        "28: cintura 72 cm\n30: cintura 77 cm\n32: cintura 82 cm\n34: cintura 87 cm\n36: cintura 92 cm",
      ),
      text("Entre dos tallas", "Si prefieres un ajuste holgado, elige la mayor. Nuestros cortes son rectos, no ceñidos."),
    ],
  },
  {
    title: "Preguntas frecuentes",
    intro: "Lo que más nos preguntan.",
    nav: false,
    blocks: [
      {
        type: "preguntas",
        title: "",
        items: [
          { q: "¿Cómo pago mi pedido?", a: "Al finalizar la compra verás los datos de pago del método que elegiste. Cuando pagues, sube el comprobante desde la página de tu pedido." },
          { q: "¿Cuándo despachan?", a: "En 24 horas hábiles después de confirmar el pago." },
          { q: "¿Puedo cambiar la talla?", a: "Sí. Tienes 30 días desde que recibes el pedido." },
          { q: "¿Cómo sigo mi pedido?", a: "Entra a Seguir mi pedido con tu número de pedido y tu correo, o usa el enlace que te enviamos." },
          { q: "¿Las prendas encogen?", a: "No. Todas las telas de punto son prelavadas." },
        ],
      },
    ],
  },
  {
    title: "Contacto",
    intro: "Escríbenos. Respondemos de lunes a sábado.",
    nav: true,
    blocks: [
      text(
        "Estamos para ayudarte",
        "Si tienes dudas sobre una talla, un pedido o un cambio, escríbenos y te respondemos el mismo día hábil.\n\nLos datos de contacto de la tienda aparecen al final de la página.",
      ),
    ],
  },
  {
    title: "Términos y condiciones",
    intro: "",
    nav: false,
    blocks: [
      text(
        "Términos de compra",
        "Este es un texto de ejemplo. Reemplázalo desde el panel, en Páginas, con los términos y condiciones de tu tienda: precios, medios de pago, tiempos de entrega, cambios, garantías y jurisdicción.",
      ),
    ],
  },
  {
    title: "Política de privacidad",
    intro: "",
    nav: false,
    blocks: [
      text(
        "Tus datos",
        "Este es un texto de ejemplo. Reemplázalo desde el panel, en Páginas, con tu política de tratamiento de datos: qué datos recoges, para qué los usas y cómo puede un cliente pedir que se eliminen.",
      ),
    ],
  },
];

export async function ensureAdmin() {
  const [count] = await db.select({ n: sql<number>`cast(count(*) as signed)` }).from(schema.users);
  if (Number(count?.n ?? 0) > 0) return;
  if (!env.adminEmail || !env.adminPassword) {
    console.warn("⚠ No hay usuarios y faltan ADMIN_EMAIL / ADMIN_PASSWORD: no podrás entrar al panel.");
    return;
  }
  await db.insert(schema.users).values({
    email: env.adminEmail,
    name: "Administrador",
    passwordHash: await bcrypt.hash(env.adminPassword, 11),
  });
  console.log(`✓ Usuario administrador creado: ${env.adminEmail}`);
}

export async function seed() {
  await ensureAdmin();

  const [done] = await db.select().from(schema.settings).where(eq(schema.settings.key, "seeded")).limit(1);
  if (done) return;

  await saveSettings(DEFAULT_SETTINGS);

  await db.insert(schema.shippingMethods).values([
    { name: "Envío estándar", description: "Entrega a domicilio", eta: "3 a 5 días hábiles", price: 600, freeOver: 12000, sortOrder: 1 },
    { name: "Envío express", description: "Prioridad en despacho y entrega", eta: "1 a 2 días hábiles", price: 1400, freeOver: null, sortOrder: 2 },
    { name: "Recoger en tienda", description: "Te avisamos cuando esté listo", eta: "Disponible en 24 horas", price: 0, freeOver: null, sortOrder: 3 },
  ]);

  await db.insert(schema.paymentMethods).values([
    {
      name: "Transferencia bancaria",
      description: "Paga desde tu banco y sube el comprobante",
      instructions: "Banco: (tu banco)\nTipo de cuenta: (ahorros o corriente)\nNúmero: (tu número de cuenta)\nTitular: (nombre del titular)\n\nEdita estos datos en el panel, en Pagos.",
      requiresProof: true,
      sortOrder: 1,
    },
    {
      name: "Pago contra entrega",
      description: "Pagas en efectivo cuando recibes",
      instructions: "Ten el valor exacto listo al momento de la entrega.",
      requiresProof: false,
      sortOrder: 2,
    },
  ]);

  await db.insert(schema.coupons).values({ code: "BIENVENIDA10", type: "porcentaje", value: 10, minSubtotal: 0 });

  for (const [i, p] of PAGES.entries()) {
    await db.insert(schema.pages).values({
      title: p.title,
      slug: slugify(p.title),
      intro: p.intro,
      blocks: JSON.stringify(p.blocks),
      showInNav: p.nav,
      showInFooter: true,
      sortOrder: i + 1,
    });
  }

  if (env.seedDemo) {
    const catIds = new Map<string, number>();
    for (const [i, c] of CATEGORIES.entries()) {
      const [ins] = await db
        .insert(schema.categories)
        .values({ name: c.name, slug: slugify(c.name), description: c.description, sortOrder: i + 1 });
      catIds.set(c.name, ins.insertId);
    }

    let featuredOrder = 0;
    for (const [pi, p] of PRODUCTS.entries()) {
      const colors = p.colors.map((k) => C[k]!);
      const [ins] = await db.insert(schema.products).values({
        name: p.name,
        slug: slugify(p.name),
        tagline: p.tagline,
        description: p.description,
        details: p.details,
        price: p.price,
        compareAtPrice: p.compareAt ?? null,
        categoryId: catIds.get(p.category) ?? null,
        colors: JSON.stringify(colors),
        sizes: JSON.stringify(p.sizes),
        isFeatured: Boolean(p.featured),
        featuredOrder: p.featured ? ++featuredOrder : 0,
        isNew: Boolean(p.isNew),
      });
      const productId = ins.insertId;

      const images: (typeof schema.productImages.$inferInsert)[] = [];
      p.colors.forEach((key, ci) => {
        images.push({ productId, url: `/demo/${p.file}-${key}.svg`, color: C[key]!.name, sortOrder: ci * 2 });
        images.push({ productId, url: `/demo/${p.file}-${key}-detalle.svg`, color: C[key]!.name, sortOrder: ci * 2 + 1 });
      });
      await db.insert(schema.productImages).values(images);

      const variants: (typeof schema.productVariants.$inferInsert)[] = [];
      colors.forEach((color, ci) => {
        const sizes = p.sizes.length ? p.sizes : [""];
        sizes.forEach((size, si) => {
          // Existencias variadas, con alguna talla agotada para ver ese estado.
          const n = (pi * 7 + ci * 5 + si * 3) % 13;
          variants.push({
            productId,
            color: color.name,
            size,
            stock: n === 4 ? 0 : n + 2,
            sku: [p.file, color.name, size].filter(Boolean).join("-").toUpperCase().replace(/\s+/g, ""),
          });
        });
      });
      await db.insert(schema.productVariants).values(variants);
    }
    console.log(`✓ Catálogo de ejemplo creado: ${PRODUCTS.length} productos.`);
  }

  await db.insert(schema.settings).values({ key: "seeded", value: new Date().toISOString() });
}
