import { useRef, useState } from "react";
import { Link } from "wouter";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
  type MotionValue,
} from "motion/react";
import { ChevronLeft, ChevronRight, RefreshCw, ShieldCheck, Truck, Sparkles } from "lucide-react";
import { trpc, type Out } from "@/lib/trpc";
import { imageFor, useMoney, useShop } from "@/lib/shop";
import { cart } from "@/lib/cart";
import { ButtonLink, IconButton, Spinner, cx, toast } from "@/components/ui";
import { Price, ProductGrid, Swatch } from "@/components/ProductCard";

type HomeData = Out["store"]["home"];
type Detail = NonNullable<HomeData["heroProduct"]>;
const EASE = [0.28, 0.11, 0.32, 1] as const;

const tint = (hex: string, amount = 12) => `color-mix(in srgb, ${hex} ${amount}%, #f5f5f7)`;

/* ───────────── Portada: la prenda cambia de color al bajar ───────────── */

function ProductHero({ product }: { product: Detail }) {
  const shop = useShop()!;
  const home = shop.settings.home;
  const money = useMoney();
  const reduce = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const colors = product.colors.length ? product.colors.slice(0, 5) : [{ name: "", hex: "#d2d2d7" }];
  const [idx, setIdx] = useState(0);
  const active = colors[idx] ?? colors[0]!;

  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  useMotionValueEvent(p, "change", (v) => {
    const t = Math.min(0.999, Math.max(0, (v - 0.3) / 0.62));
    const next = v < 0.3 ? 0 : Math.floor(t * colors.length);
    setIdx((cur) => (cur === next ? cur : next));
  });

  const clip = useTransform(p, [0.04, 0.3], ["inset(0px round 0px)", "inset(12px round 44px)"]);
  const titleOpacity = useTransform(p, [0, 0.2], [1, 0]);
  const titleY = useTransform(p, [0, 0.26], ["0vh", "-12vh"]);
  const titleScale = useTransform(p, [0, 0.26], [1, 0.92]);
  const garmentY = useTransform(p, [0, 0.3], ["27vh", "0vh"]);
  const garmentScale = useTransform(p, [0, 0.3, 1], [1.16, 1, 1.04]);
  const uiOpacity = useTransform(p, [0.26, 0.36], [0, 1]);
  const uiY = useTransform(p, [0.26, 0.38], [24, 0]);
  const pointer = useTransform(p, (v) => (v > 0.28 ? "auto" : "none"));
  const introPointer = useTransform(p, (v) => (v < 0.16 ? "auto" : "none"));

  const firstVariant = (color: string) =>
    product.variants.find((v) => v.color === color && v.stock > 0) ?? product.variants.find((v) => v.stock > 0);
  const href = `/producto/${product.slug}${active.name ? `?color=${encodeURIComponent(active.name)}` : ""}`;

  if (reduce) {
    return (
      <section className="px-3 pt-[76px]">
        <div className="rounded-panel bg-mist px-6 pb-10 pt-16 text-center" style={{ background: tint(active.hex) }}>
          <h1 className="display mx-auto max-w-[12ch] text-[clamp(3rem,9vw,7rem)]">{home.heroTitle}</h1>
          <p className="mx-auto mt-5 max-w-[46ch] text-[19px] text-ink-2">{home.heroSubtitle}</p>
          <div className="mt-7">
            <ButtonLink href={home.heroCtaHref || "/tienda"} size="lg">
              {home.heroCtaLabel || "Ver la colección"}
            </ButtonLink>
          </div>
          <img
            src={imageFor(product.images, active.name)}
            alt={product.name}
            className="mx-auto mt-6 aspect-[4/5] w-full max-w-[520px] object-contain"
          />
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className="relative h-[320vh]" aria-label={home.heroTitle}>
      <div className="sticky top-0 h-dvh overflow-hidden">
        <motion.div
          className="absolute inset-0 transition-[background-color] duration-700 ease-apple"
          style={{ clipPath: clip, backgroundColor: tint(active.hex) }}
        />

        {/* Titular: queda detrás de la prenda y se desvanece al bajar */}
        <motion.div
          className="absolute inset-x-0 top-[13dvh] z-10 px-5 text-center"
          style={{ opacity: titleOpacity, y: titleY, scale: titleScale }}
        >
          <h1 className="display mx-auto max-w-[9.5ch] text-[clamp(3.4rem,12.4vw,12.5rem)]">{home.heroTitle}</h1>
          <p className="mx-auto mt-4 max-w-[30ch] text-[16px] leading-snug text-ink-2 lg:hidden">{home.heroSubtitle}</p>
        </motion.div>

        {/* Prenda */}
        <motion.div
          className="pointer-events-none absolute inset-0 z-20 grid place-items-center"
          style={{ y: garmentY, scale: garmentScale }}
        >
          <div className="relative aspect-[4/5] h-[min(74dvh,820px)] max-w-[92vw]">
            {colors.map((c, i) => (
              <img
                key={c.name}
                src={imageFor(product.images, c.name)}
                alt={i === idx ? `${product.name} ${c.name}` : ""}
                fetchPriority={i === 0 ? "high" : "low"}
                className={cx(
                  "absolute inset-0 size-full object-contain transition-opacity duration-500 ease-apple",
                  i === idx ? "opacity-100" : "opacity-0",
                )}
              />
            ))}
          </div>
        </motion.div>

        {/* Texto de entrada: en pantallas grandes va en las esquinas, fuera de la prenda */}
        <motion.div
          className="absolute inset-x-0 bottom-[5dvh] z-30 flex items-end justify-center px-6 lg:bottom-[7dvh] lg:justify-between lg:px-[6vw]"
          style={{ opacity: titleOpacity, pointerEvents: introPointer }}
        >
          <p className="hidden max-w-[23ch] text-[19px] leading-snug text-ink lg:block xl:text-[21px]">
            {home.heroSubtitle}
          </p>
          <ButtonLink href={home.heroCtaHref || "/tienda"} size="lg">
            {home.heroCtaLabel || "Ver la colección"}
          </ButtonLink>
        </motion.div>

        {/* Segunda escena: nombre del color y compra */}
        <motion.div
          className="absolute inset-0 z-30 flex flex-col justify-between p-7 pt-[92px] sm:p-12 sm:pt-[104px] lg:flex-row lg:items-center lg:justify-between lg:px-[6vw]"
          style={{ opacity: uiOpacity, y: uiY, pointerEvents: pointer }}
        >
          <div className="w-full lg:w-[27vw]">
            <p className="text-[15px] text-ink-2 sm:text-[17px]">{product.name}</p>
            <div className="relative mt-1 h-[1.18em] overflow-hidden text-[clamp(2.6rem,5.6vw,6rem)]">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.p
                  key={active.name}
                  className="display absolute inset-x-0 top-0 whitespace-nowrap leading-[1.1]"
                  initial={{ y: "70%", opacity: 0, filter: "blur(8px)" }}
                  animate={{ y: "0%", opacity: 1, filter: "blur(0px)" }}
                  exit={{ y: "-70%", opacity: 0, filter: "blur(8px)" }}
                  transition={{ duration: 0.5, ease: EASE }}
                >
                  {active.name || product.name}
                </motion.p>
              </AnimatePresence>
            </div>
            {colors.length > 1 && (
              <div className="mt-4 flex items-center gap-1.5" aria-hidden>
                {colors.map((c, i) => (
                  <Swatch key={c.name} hex={c.hex} name={c.name} selected={i === idx} size={16} />
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col items-start gap-4 lg:max-w-[22vw] lg:items-end lg:text-right">
            <p className="hidden max-w-[28ch] text-[17px] text-ink-2 lg:block">{product.tagline}</p>
            <div className="flex w-full items-center justify-between gap-4 lg:w-auto lg:flex-col lg:items-end">
              <Price
                price={product.price}
                compareAt={product.compareAtPrice}
                className="text-[21px] font-semibold tracking-[-0.02em]"
              />
              <ButtonLink href={href} size="lg">
                Comprar
              </ButtonLink>
            </div>
            {product.sizes.length === 0 && firstVariant(active.name) && (
              <button
                type="button"
                className="text-[15px] text-ink-2 underline-offset-4 hover:text-ink hover:underline"
                onClick={() => {
                  cart.add(firstVariant(active.name)!.id);
                  toast("Agregado a la bolsa");
                }}
              >
                Agregar a la bolsa por {money(product.price)}
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ───────────── Portada con foto a sangre ───────────── */

function PhotoHero({ image }: { image: string }) {
  const home = useShop()!.settings.home;
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const clip = useTransform(p, [0, 0.6], ["inset(0px round 0px)", "inset(12px round 44px)"]);
  const scale = useTransform(p, [0, 1], [1, 1.12]);
  return (
    <section ref={ref} className="relative h-[100dvh] min-h-[560px]">
      <motion.div className="absolute inset-0 overflow-hidden" style={reduce ? undefined : { clipPath: clip }}>
        <motion.img
          src={image}
          alt=""
          className="size-full object-cover"
          style={reduce ? undefined : { scale }}
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-black/10" />
      </motion.div>
      <div className="wrap relative flex h-full flex-col justify-end pb-[9dvh] text-white">
        <h1 className="display max-w-[11ch] text-[clamp(3.2rem,9.5vw,9rem)]">{home.heroTitle}</h1>
        <p className="mt-5 max-w-[44ch] text-[19px] text-white/85">{home.heroSubtitle}</p>
        <div className="mt-7">
          <ButtonLink href={home.heroCtaHref || "/tienda"} size="lg" className="!bg-white !text-ink">
            {home.heroCtaLabel || "Ver la colección"}
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Destacados: carrusel de tarjetas altas ───────────── */

function FeaturedRail({ items }: { items: HomeData["featured"] }) {
  const rail = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });
  const onScroll = () => {
    const el = rail.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft < 8, end: el.scrollLeft + el.clientWidth > el.scrollWidth - 8 });
  };
  const move = (dir: 1 | -1) => {
    const el = rail.current;
    const card = el?.querySelector<HTMLElement>("[data-card]");
    if (el && card) el.scrollBy({ left: dir * (card.offsetWidth + 20), behavior: "smooth" });
  };
  if (items.length === 0) return null;

  return (
    <section className="pt-24 sm:pt-32" aria-labelledby="destacados">
      <div className="wrap flex items-end justify-between gap-6">
        <h2 id="destacados" className="headline text-[clamp(2.2rem,5vw,4rem)]">
          Lo que más se lleva.
        </h2>
        <Link
          href="/tienda"
          className="hidden shrink-0 pb-2 text-[17px] text-ink-2 underline-offset-4 hover:text-ink hover:underline sm:block"
        >
          Ver toda la tienda
        </Link>
      </div>

      <div
        ref={rail}
        onScroll={onScroll}
        className="no-scrollbar mt-9 flex snap-x snap-mandatory gap-5 overflow-x-auto scroll-smooth pb-2 [padding-inline:max(clamp(16px,4vw,44px),calc((100vw-1320px)/2+clamp(16px,4vw,44px)))] [scroll-padding-inline:max(clamp(16px,4vw,44px),calc((100vw-1320px)/2+clamp(16px,4vw,44px)))]"
      >
        {items.map((p, i) => {
          const color = p.colors[0];
          return (
            <Link
              key={p.id}
              href={`/producto/${p.slug}`}
              data-card
              className="group relative flex h-[min(74vh,600px)] min-h-[480px] w-[82vw] max-w-[440px] shrink-0 snap-start flex-col overflow-hidden rounded-card bg-mist transition-[background-color] duration-500"
              style={{ backgroundColor: color ? tint(color.hex, 9) : undefined }}
            >
              <div className="relative z-10 p-7 sm:p-8">
                <p className="mb-1 h-5 text-[14px] font-medium text-[#b4530a]">{p.isNew ? "Nuevo" : ""}</p>
                <h3 className="text-[28px] tracking-[-0.03em] sm:text-[32px]">{p.name}</h3>
                <p className="mt-1.5 max-w-[26ch] text-[16px] leading-snug text-ink-2">{p.tagline}</p>
                <Price price={p.price} compareAt={p.compareAtPrice} className="mt-3 text-[16px]" />
              </div>
              <img
                src={imageFor(p.images, color?.name)}
                alt=""
                loading={i < 2 ? "eager" : "lazy"}
                className="absolute inset-x-0 bottom-[-6%] mx-auto h-[70%] object-contain transition-transform duration-700 ease-apple group-hover:-translate-y-2 group-hover:scale-[1.05]"
              />
            </Link>
          );
        })}
      </div>

      <div className="wrap mt-5 flex justify-end gap-2">
        <IconButton label="Anteriores" onClick={() => move(-1)} disabled={edge.start} className="bg-mist hover:bg-mist-2">
          <ChevronLeft className="size-5" />
        </IconButton>
        <IconButton label="Siguientes" onClick={() => move(1)} disabled={edge.end} className="bg-mist hover:bg-mist-2">
          <ChevronRight className="size-5" />
        </IconButton>
      </div>
    </section>
  );
}

/* ───────────── Vitrina: un producto, todos sus colores ───────────── */

function ColorShowcase({ product }: { product: Detail }) {
  const home = useShop()!.settings.home;
  // Abre con el último color de la lista: suele ser el más vistoso.
  const [color, setColor] = useState(product.colors[product.colors.length - 1]);
  if (!color) return null;
  return (
    <section className="px-3 pt-24 sm:pt-32" aria-labelledby="vitrina">
      <div
        className="mx-auto grid max-w-[1400px] items-center gap-4 overflow-hidden rounded-panel transition-[background-color] duration-700 ease-apple lg:grid-cols-2"
        style={{ backgroundColor: tint(color.hex, 16) }}
      >
        <div className="order-2 px-7 pb-10 sm:px-12 lg:order-1 lg:py-16 lg:pl-[6vw]">
          <h2 id="vitrina" className="headline max-w-[13ch] text-[clamp(2.2rem,4.6vw,4rem)]">
            {home.showcaseTitle}
          </h2>
          <p className="mt-5 max-w-[42ch] text-[17px] text-ink-2 sm:text-[19px]">{home.showcaseText}</p>

          <div className="mt-9">
            <p className="text-[15px]">
              <span className="text-ink-2">{product.name} en </span>
              <span className="font-semibold">{color.name}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Elige un color">
              {product.colors.map((c) => (
                <Swatch
                  key={c.name}
                  hex={c.hex}
                  name={c.name}
                  size={30}
                  selected={c.name === color.name}
                  onSelect={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-5">
            <ButtonLink href={`/producto/${product.slug}?color=${encodeURIComponent(color.name)}`} size="lg">
              Comprar
            </ButtonLink>
            <Price price={product.price} compareAt={product.compareAtPrice} className="text-[19px]" />
          </div>
        </div>

        <div className="relative order-1 mx-auto aspect-[4/5] w-full max-w-[560px] lg:order-2">
          <AnimatePresence initial={false}>
            <motion.img
              key={color.name}
              src={imageFor(product.images, color.name)}
              alt={`${product.name} ${color.name}`}
              className="absolute inset-0 size-full object-contain"
              initial={{ opacity: 0, scale: 0.94, rotate: -2 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 1.04 }}
              transition={{ duration: 0.55, ease: EASE }}
            />
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Categorías en mosaico ───────────── */

const BENTO = [
  "sm:col-span-2 lg:row-span-2",
  "lg:col-span-2",
  "",
  "",
  "sm:col-span-2",
  "sm:col-span-2",
];

function Categories({ items }: { items: HomeData["categories"] }) {
  if (items.length === 0) return null;
  return (
    <section className="wrap pt-24 sm:pt-32" aria-labelledby="categorias">
      <h2 id="categorias" className="headline text-[clamp(2.2rem,5vw,4rem)]">
        Compra por categoría.
      </h2>
      <div className="mt-9 grid auto-rows-[230px] gap-4 sm:grid-cols-2 sm:gap-5 lg:auto-rows-[270px] lg:grid-cols-4">
        {items.map((c, i) => {
          const big = i % BENTO.length === 0;
          const small = items.length >= 4 && BENTO[i % BENTO.length] === "";
          return (
            <Link
              key={c.id}
              href={`/categoria/${c.slug}`}
              className={cx(
                "group relative overflow-hidden rounded-card bg-mist p-7",
                items.length >= 4 ? BENTO[i % BENTO.length] : "sm:col-span-2",
              )}
            >
              {c.hasCustomImage ? (
                <>
                  <img
                    src={c.imageUrl}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover transition-transform duration-700 ease-apple group-hover:scale-[1.04]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/45 to-transparent" />
                </>
              ) : (
                c.imageUrl && (
                  <img
                    src={c.imageUrl}
                    alt=""
                    loading="lazy"
                    className={cx(
                      "absolute object-contain transition-transform duration-700 ease-apple group-hover:scale-[1.06]",
                      big
                        ? "bottom-[-8%] right-[-2%] h-[86%] sm:right-[4%] lg:inset-x-0 lg:bottom-[-4%] lg:mx-auto lg:h-[74%]"
                        : small
                          ? "bottom-[-22%] right-[-4%] h-[118%] lg:inset-x-0 lg:bottom-[-12%] lg:mx-auto lg:h-[76%]"
                          : "bottom-[-22%] right-[-4%] h-[118%]",
                    )}
                  />
                )
              )}
              <div className={cx("relative max-w-[60%]", c.hasCustomImage && "text-white", (big || small) && "lg:max-w-none")}>
                <h3 className={cx("tracking-[-0.03em]", big ? "text-[28px] lg:text-[36px]" : "text-[24px]")}>{c.name}</h3>
                {c.description && (
                  <p
                    className={cx(
                      "mt-1.5 text-[15px] leading-snug",
                      c.hasCustomImage ? "text-white/85" : "text-ink-2",
                      !big && "hidden lg:block",
                      small && "lg:hidden",
                    )}
                  >
                    {c.description}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

/* ───────────── Historia: el texto se enciende al leerlo ───────────── */

function Word({ progress, range, children }: { progress: MotionValue<number>; range: [number, number]; children: string }) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return <motion.span style={{ opacity }}>{children} </motion.span>;
}

function Story() {
  const home = useShop()!.settings.home;
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.55"] });
  const words = `${home.storyTitle} ${home.storyText}`.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  return (
    <section className="wrap pt-28 sm:pt-40" aria-label="Nuestra historia">
      <p ref={ref} className="headline mx-auto max-w-[24ch] text-[clamp(1.9rem,4.6vw,4rem)] leading-[1.08] sm:max-w-[26ch]">
        {reduce
          ? words.join(" ")
          : words.map((w, i) => (
              <Word key={i} progress={scrollYProgress} range={[i / words.length, Math.min(1, (i + 3) / words.length)]}>
                {w}
              </Word>
            ))}
      </p>
    </section>
  );
}

const PERK_ICONS = [Truck, RefreshCw, ShieldCheck, Sparkles];

function Perks() {
  const perks = useShop()!.settings.home.perks;
  if (perks.length === 0) return null;
  return (
    <section className="wrap pt-24 sm:pt-32" aria-label="Por qué comprar aquí">
      <ul className={cx("grid gap-x-10 gap-y-9 border-t border-line pt-10 sm:grid-cols-2", perks.length >= 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
        {perks.map((perk, i) => {
          const Icon = PERK_ICONS[i % PERK_ICONS.length]!;
          return (
            <li key={i}>
              <Icon className="size-7" strokeWidth={1.5} aria-hidden />
              <h3 className="mt-4 text-[21px] tracking-[-0.025em]">{perk.title}</h3>
              <p className="mt-1.5 max-w-[32ch] text-[16px] text-ink-2">{perk.text}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function Home() {
  const shop = useShop()!;
  const { data, isLoading } = trpc.store.home.useQuery();

  if (isLoading || !data) {
    return (
      <div className="grid h-dvh place-items-center">
        <Spinner />
      </div>
    );
  }

  const hero = shop.settings.home.heroImageUrl ? (
    <PhotoHero image={shop.settings.home.heroImageUrl} />
  ) : data.heroProduct ? (
    <ProductHero product={data.heroProduct} />
  ) : (
    <section className="wrap pb-6 pt-[22dvh] text-center">
      <h1 className="display mx-auto max-w-[10ch] text-[clamp(3.2rem,11vw,10rem)]">{shop.settings.home.heroTitle}</h1>
      <p className="mx-auto mt-6 max-w-[46ch] text-[19px] text-ink-2">{shop.settings.home.heroSubtitle}</p>
      <div className="mt-8">
        <ButtonLink href={shop.settings.home.heroCtaHref || "/tienda"} size="lg">
          {shop.settings.home.heroCtaLabel || "Ver la colección"}
        </ButtonLink>
      </div>
    </section>
  );

  return (
    <>
      {hero}
      <FeaturedRail items={data.featured} />
      {data.showcase && data.showcase.colors.length > 1 && <ColorShowcase product={data.showcase} />}
      <Categories items={data.categories} />
      <Story />
      {data.latest.length > 0 && (
        <section className="wrap pt-24 sm:pt-36" aria-labelledby="recientes">
          <div className="flex items-end justify-between gap-6">
            <h2 id="recientes" className="headline text-[clamp(2.2rem,5vw,4rem)]">
              Recién llegado.
            </h2>
            <Link
              href="/tienda?nuevo=1"
              className="hidden shrink-0 pb-2 text-[17px] text-ink-2 underline-offset-4 hover:text-ink hover:underline sm:block"
            >
              Ver las novedades
            </Link>
          </div>
          <div className="mt-9">
            <ProductGrid products={data.latest.slice(0, 4)} />
          </div>
        </section>
      )}
      <Perks />
    </>
  );
}
