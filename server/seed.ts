import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { DEFAULT_SETTINGS, slugify, type Block, type ProductColor } from "../shared/types";
import { db, schema } from "./db";
import { env } from "./env";
import { getSettings, saveSettings } from "./settings";
import { DEMO_HERO, insertDemoCatalog, refreshDemoCatalog } from "./demoCatalog";

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

/**
 * Tiendas creadas antes de tener el logo: cambia el nombre provisional "Gee"
 * por THEARTOFGEE y pone el logo en imagen (negro y blanco). Corre una vez y
 * no toca un logo que ya hayan subido desde el panel.
 */
async function applyBrand() {
  const FLAG = "brand-v1";
  const [done] = await db.select().from(schema.settings).where(eq(schema.settings.key, FLAG)).limit(1);
  if (done) return;
  const s = await getSettings();
  await saveSettings({
    ...s,
    storeName: s.storeName === "Gee" ? DEFAULT_SETTINGS.storeName : s.storeName,
    logoUrl: s.logoUrl || DEFAULT_SETTINGS.logoUrl,
    logoDarkUrl: s.logoDarkUrl || (s.logoUrl ? "" : DEFAULT_SETTINGS.logoDarkUrl),
  });
  await db.insert(schema.settings).values({ key: FLAG, value: new Date().toISOString() });
}

export async function seed() {
  await ensureAdmin();

  const [done] = await db.select().from(schema.settings).where(eq(schema.settings.key, "seeded")).limit(1);
  if (done) {
    await applyBrand();
    if (env.seedDemo) await refreshDemoCatalog();
    return;
  }

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
    await insertDemoCatalog();
    await saveSettings({ ...DEFAULT_SETTINGS, home: { ...DEFAULT_SETTINGS.home, heroImageUrl: DEMO_HERO[0]!, heroImage2Url: DEMO_HERO[1]! } });
  }
  await db.insert(schema.settings).values([
    { key: "demo-photos-v1", value: new Date().toISOString() },
    { key: "brand-v1", value: new Date().toISOString() },
  ]);

  await db.insert(schema.settings).values({ key: "seeded", value: new Date().toISOString() });
}
